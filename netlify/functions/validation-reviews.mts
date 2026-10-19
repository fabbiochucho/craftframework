import type { Config } from '@netlify/functions'
import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  accessGrants, auditLogs, engagementDeclarations, engagementMembers, evidenceRegistry, firms, organizations, validationEvidenceLinks, wsOrgMembers, validationDebriefs, validationEngagements,
  validationCipActions, validationQualifications, validationReviews, validationScores, validations, validatorProfiles,
  type EngagementMemberRow, type ValidationEngagementRow, type ValidationReviewRow,
} from '../../db/schema.js'
import { canAccessOrg, forbidden, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { grantAllows } from '../lib/access-policy.js'
import { fieldLookupHashes } from '../lib/crypto.js'
import { decodeEvidence } from '../lib/evidence-storage.js'
import { HttpError, requireOrgAccess } from '../lib/orgAccess.js'
import { reconcileEngagement, specialismsMissing, sweepEngagements } from '../lib/engagement-access.js'
import { logger } from '../lib/logger.js'
import { engagementLabel, GRANT_ROLE, type EngagementScope, type EngagementType } from '../../src/lib/engagements.js'
import { effectiveAccreditation } from '../../src/lib/validatorDirectory.js'
import { FOLLOW_UP_MODES, issuedValidity, validityProblems } from '../../src/lib/validationLifecycle.js'
import { generateVerificationId } from '../../src/lib/validationStatement.js'
import { ensureStatement } from '../lib/public-validation.js'
import { loadModuleProfile, loadScopeSelfScores } from '../lib/validator-quality.js'
import { missingSpecialismMessage } from '../../src/lib/specialisms.js'
import type { ModuleProfile } from '../../src/lib/foundationModules.js'
import { recordStatusHistory, sendDebriefNotice, syncCheckpoints } from '../lib/validation-lifecycle.js'
import {
  allInScope, canonicalJson, isPrimaryFramework, cappedNegotiated, cleanScores, finalisationProblems, finalScores, FRAMEWORKS, impliedRung, indexResults, indicatorsInScope, levelConfirmations, levelsAchieved,
  METHODS, scopeIndices, OUTCOMES, paperCaps, SUFFICIENCY, supportsRung, trustDeltaWithCaps, type Outcome, type PaperCap, type Sufficiency,
} from '../../src/lib/validationReview.js'

// /api/validation-reviews/:engagementId — validator system PR 3 (spec: "Review, outcome and freeze").
//
//   GET    /:id                         the review (reviewer: full; organisation: debrief view; after freeze: the snapshot)
//   PUT    /:id/setup                   lead: method + fieldwork dates
//   PUT    /:id/scores/:indicator       reviewer: own 0-5 score, evidence sufficiency, comment, evidence reference
//   POST   /:id/debrief/open            lead: open the optional debrief
//   PUT    /:id/debrief/:indicator      organisation staff: response to an indicator (debrief only)
//   PUT    /:id/negotiated/:indicator   lead: record the negotiated score, or null to clear (debrief only)
//   POST   /:id/qualifications          lead: add a qualification linked to indicators
//   DELETE /:id/qualifications/:qid     lead: remove one
//   GET    /:id/evidence-options        organisation staff: evidence items they may link (workspace assessor or above)
//   POST   /:id/evidence/:indicator     organisation staff: link an existing evidence item to an indicator ({ evidenceId })
//   DELETE /:id/evidence/:indicator/:evidenceId   organisation staff: remove a link
//   POST   /:id/finalise                lead: outcome + validity + freeze (snapshot + SHA-256); issues the validation (PR 5); revokes every team grant
//
// A reviewer sees the organisation's self-scores only while their grant is active and unexpired.
// Once finalised nothing here can change the review.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string, extra: object = {}) => json({ error, ...extra }, 400)
const notFound = () => json({ error: 'Not found' }, 404)
const conflict = (error: string) => json({ error }, 409)
const audit = (actor: string, action: string, target: string, orgId: string) =>
  db.insert(auditLogs).values({ actor, action, target, category: 'Validation', orgId })

const setupSchema = z.object({
  method: z.enum(METHODS),
  fieldworkStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fieldworkEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
const scoreSchema = z.object({
  score: z.number().int().min(0).max(5),
  sufficiency: z.enum(SUFFICIENCY),
  comment: z.string().max(4000).optional(),
  evidenceRef: z.string().max(1000).optional(),
})
const responseSchema = z.object({ response: z.string().trim().min(1).max(4000) })
const negotiatedSchema = z.object({ score: z.number().int().min(0).max(5).nullable() })
const evidenceLinkSchema = z.object({ evidenceId: z.number().int().positive() })
const MAX_LINKS_PER_INDICATOR = 20
const qualificationSchema = z.object({ text: z.string().trim().min(1).max(2000), indicatorIds: z.array(z.string().max(40)).min(1).max(60) })
const finaliseSchema = z.object({
  outcome: z.enum(OUTCOMES),
  summary: z.string().max(4000).optional(),
  // Validity (PR 5): default 12 months (6 with qualifications); 24 for rung 5+ without qualifications; shorter with a named risk.
  validityMonths: z.number().int().min(1).max(24).optional(),
  validityReason: z.string().trim().max(1000).optional(),
  followUpMode: z.enum(FOLLOW_UP_MODES).optional(),
})

type Ctx = {
  e: ValidationEngagementRow
  /** The organisation's module profile: which index indicators are in scope. */
  profile: ModuleProfile
  /** Set when a named validator lacks a specialism the scope needs; they cannot review. */
  specialismBlock: string | null
  members: EngagementMemberRow[]
  review: ValidationReviewRow | null
  me: EngagementMemberRow | null
  org: boolean
  reviewer: boolean
  lead: boolean
}


export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (caller.readOnly) return forbidden()
    await sweepEngagements()
    const url = new URL(req.url)
    const [id, sub, who, extra] = url.pathname.replace(/^\/api\/validation-reviews\/?/, '').split('/').filter(Boolean)
    if (!id) return notFound()
    const readBody = async () => { try { return await req.json() } catch { return null } }

    const [e] = await db.select().from(validationEngagements).where(eq(validationEngagements.id, id))
    if (!e) return notFound()
    const members = await db.select().from(engagementMembers).where(eq(engagementMembers.engagementId, id))
    const [review] = await db.select().from(validationReviews).where(eq(validationReviews.engagementId, id))
    const me = members.find((m) => m.email === caller.email && m.status === 'named') ?? null
    const org = caller.orgId === e.orgId && (await canAccessOrg(caller, e.orgId, 'write'))
    // A reviewer needs everything the engagement requires AND a live validator grant.
    let reviewer = false
    if (me && me.orgApproved && e.status === 'active' && e.orgStatus === 'accepted') {
      const [g] = await db.select().from(accessGrants).where(and(eq(accessGrants.orgId, e.orgId), eq(accessGrants.grantee, caller.email)))
      reviewer = !!g && g.role === GRANT_ROLE && g.status === 'active' && grantAllows(g, 'read')
    }
    if (!me && !org) return notFound()
    const fw = FRAMEWORKS[e.framework]
    if (!fw || !isPrimaryFramework(fw.key)) return bad('Unsupported framework')
    const scope = e.scope as EngagementScope
    // A specialist index needs the specialism on every reviewer of an independent validation (funder reviews are the
    // funder's own staff), checked again here in case it lapsed since joining.
    const missing = reviewer && e.type === 'independent_validation' ? await specialismsMissing(caller.email, scope) : []
    const specialismBlock = missing.length ? missingSpecialismMessage(missing) : null
    if (specialismBlock) reviewer = false
    const profile = scopeIndices(scope).length ? await loadModuleProfile(e.orgId) : {}
    const ctx: Ctx = { e, members, review: review ?? null, me, org, reviewer, lead: reviewer && me!.role === 'lead', profile, specialismBlock }
    const inScope = allInScope(fw, scope, profile)
    const ids = new Set(inScope.map((i) => i.id))
    const selfScores = (orgId: string, _key: string, idSet: Set<string>) => loadScopeSelfScores(orgId, fw, scope, idSet)

    if (req.method === 'GET' && !sub) return json(await view(ctx, fw, scope, ids))

    // Everything below writes. The review is created lazily by the first reviewer write.
    const frozen = ctx.review?.status === 'finalised' || e.status === 'finalised'

    // The organisation's evidence, linked per indicator. A link is a reference to an item in the evidence registry.
    if (sub === 'evidence-options' && req.method === 'GET' && !who) {
      if (!ctx.org) return forbidden()
      return json({ options: await evidenceOptions(caller.email, caller.role === 'super_admin') })
    }
    if (sub === 'evidence' && who) {
      if (!ctx.org) return forbidden()
      if (frozen) return conflict('This review is finalised')
      if (e.status !== 'proposed' && e.status !== 'active') return conflict('This engagement is no longer open')
      if (!ids.has(who)) return bad('Not an indicator in scope')
      if (req.method === 'POST' && !extra) {
        const p = evidenceLinkSchema.safeParse(await readBody())
        if (!p.success) return bad('Choose an evidence item')
        const [ev] = await db.select().from(evidenceRegistry).where(and(eq(evidenceRegistry.id, p.data.evidenceId), isNull(evidenceRegistry.archivedAt), ne(evidenceRegistry.status, 'rejected')))
        if (!ev) return notFound()
        // The evidence's own permissions apply: the caller must be an assessor or above in the workspace organisation that holds it.
        try { await requireOrgAccess(caller, ev.orgId, 'assessor') } catch (err) {
          if (err instanceof HttpError) return err.status === 404 ? notFound() : forbidden()
          throw err
        }
        const existing = await db.select({ id: validationEvidenceLinks.id }).from(validationEvidenceLinks)
          .where(and(eq(validationEvidenceLinks.engagementId, id), eq(validationEvidenceLinks.indicatorId, who)))
        if (existing.length >= MAX_LINKS_PER_INDICATOR) return bad(`At most ${MAX_LINKS_PER_INDICATOR} evidence items per indicator`)
        const linkId = `evl_${crypto.randomUUID()}`
        const inserted = await db.insert(validationEvidenceLinks).values({
          id: linkId, engagementId: id, indicatorId: who, evidenceId: ev.id, documentName: ev.documentName, documentType: ev.documentType,
          sha256: await evidenceSha256(ev.filePath), linkedBy: caller.email,
        }).onConflictDoNothing().returning({ id: validationEvidenceLinks.id })
        if (inserted.length) await audit(caller.email, `linked evidence #${ev.id} to ${who}`, id, e.orgId)
        return json({ ok: true, id: inserted[0]?.id ?? null }, inserted.length ? 201 : 200)
      }
      if (req.method === 'DELETE' && extra) {
        const evidenceId = Number(extra)
        if (!Number.isInteger(evidenceId)) return notFound()
        const gone = await db.delete(validationEvidenceLinks)
          .where(and(eq(validationEvidenceLinks.engagementId, id), eq(validationEvidenceLinks.indicatorId, who), eq(validationEvidenceLinks.evidenceId, evidenceId)))
          .returning({ id: validationEvidenceLinks.id })
        if (!gone.length) return notFound()
        await audit(caller.email, `unlinked evidence #${evidenceId} from ${who}`, id, e.orgId)
        return json({ ok: true })
      }
      return notFound()
    }

    if (req.method === 'PUT' && sub === 'debrief' && who) {
      if (!ctx.org) return forbidden()
      if (!ids.has(who)) return bad('Not an indicator in scope')
      const p = responseSchema.safeParse(await readBody())
      if (!p.success) return bad('A response is required')
      if (!ctx.review) return conflict('The review has not started')
      return await locked(ctx.review.id, async (tx, r) => {
        if (r.status !== 'debrief') return conflict(r.status === 'finalised' ? 'This review is finalised' : 'The debrief is not open')
        const now = new Date()
        await tx.insert(validationDebriefs).values({ reviewId: r.id, indicatorId: who, orgResponse: p.data.response, respondedBy: caller.email, respondedAt: now })
          .onConflictDoUpdate({ target: [validationDebriefs.reviewId, validationDebriefs.indicatorId], set: { orgResponse: p.data.response, respondedBy: caller.email, respondedAt: now } })
        await tx.insert(auditLogs).values({ actor: caller.email, action: `responded in debrief on ${who}`, target: r.id, category: 'Validation', orgId: e.orgId })
        return json({ ok: true })
      })
    }

    // The remaining writes are the reviewer team's.
    if (!ctx.reviewer) return frozen ? conflict('This review is finalised') : ctx.specialismBlock ? json({ error: ctx.specialismBlock }, 403) : forbidden()
    if (frozen) return conflict('This review is finalised')
    const ensure = async (): Promise<ValidationReviewRow> => {
      if (ctx.review) return ctx.review
      const [row] = await db.insert(validationReviews).values({ id: `rev_${crypto.randomUUID()}`, engagementId: id, createdBy: caller.email })
        .onConflictDoNothing().returning()
      const r = row ?? (await db.select().from(validationReviews).where(eq(validationReviews.engagementId, id)))[0]
      if (row) await audit(caller.email, 'started the review', r.id, e.orgId)
      return r
    }

    if (req.method === 'PUT' && sub === 'scores' && who) {
      if (!ids.has(who)) return bad('Not an indicator in scope')
      const p = scoreSchema.safeParse(await readBody())
      if (!p.success) return bad('A score from 0 to 5 and an evidence sufficiency are required')
      const r = await ensure()
      return await locked(r.id, async (tx, row) => {
        if (row.status === 'finalised') return conflict('This review is finalised')
        const [old] = await tx.select({ score: validationScores.score }).from(validationScores)
          .where(and(eq(validationScores.reviewId, row.id), eq(validationScores.indicatorId, who)))
        const set = { score: p.data.score, sufficiency: p.data.sufficiency, comment: p.data.comment ?? '', evidenceRef: p.data.evidenceRef ?? '', scoredBy: caller.email, updatedAt: new Date() }
        await tx.insert(validationScores).values({ reviewId: row.id, indicatorId: who, ...set })
          .onConflictDoUpdate({ target: [validationScores.reviewId, validationScores.indicatorId], set })
        await tx.insert(auditLogs).values({ actor: caller.email, action: `scored ${who}: ${old ? old.score : '—'} → ${p.data.score} (${p.data.sufficiency})`, target: row.id, category: 'Validation', orgId: e.orgId })
        return json({ ok: true })
      })
    }

    // Lead-only controls.
    if (!ctx.lead) return forbidden()

    if (req.method === 'PUT' && sub === 'setup' && !who) {
      const p = setupSchema.safeParse(await readBody())
      if (!p.success) return bad('A method and fieldwork dates (YYYY-MM-DD) are required')
      if (p.data.fieldworkEnd < p.data.fieldworkStart) return bad('Fieldwork cannot end before it starts')
      const r = await ensure()
      return await locked(r.id, async (tx, row) => {
        if (row.status === 'finalised') return conflict('This review is finalised')
        await tx.update(validationReviews).set({ method: p.data.method, fieldworkStart: p.data.fieldworkStart, fieldworkEnd: p.data.fieldworkEnd, updatedAt: new Date() }).where(eq(validationReviews.id, row.id))
        await tx.insert(auditLogs).values({ actor: caller.email, action: `set method ${p.data.method}, fieldwork ${p.data.fieldworkStart} to ${p.data.fieldworkEnd}`, target: row.id, category: 'Validation', orgId: e.orgId })
        return json({ ok: true })
      })
    }

    if (req.method === 'POST' && sub === 'debrief' && who === 'open') {
      const r = await ensure()
      return await locked(r.id, async (tx, row) => {
        if (row.status !== 'draft') return conflict(row.status === 'finalised' ? 'This review is finalised' : 'The debrief is already open')
        await tx.update(validationReviews).set({ status: 'debrief', updatedAt: new Date() }).where(eq(validationReviews.id, row.id))
        await tx.insert(auditLogs).values({ actor: caller.email, action: 'opened the debrief', target: row.id, category: 'Validation', orgId: e.orgId })
        return json({ ok: true })
      }).then(async (res) => {
        // Tell the organisation (outside the transaction; a mail failure never undoes the debrief, the daily run retries it).
        if (res.status === 200) {
          const sent = await sendDebriefNotice(r.id)
          await audit(caller.email, `debrief opened; organisation notice ${sent === 'accepted' ? 'sent' : sent === 'skipped' ? 'not needed' : 'queued for retry'}`, r.id, e.orgId)
        }
        return res
      })
    }

    if (req.method === 'PUT' && sub === 'negotiated' && who) {
      if (!ids.has(who)) return bad('Not an indicator in scope')
      const p = negotiatedSchema.safeParse(await readBody())
      if (!p.success) return bad('A score from 0 to 5, or null to clear')
      if (!ctx.review) return conflict('The review has not started')
      return await locked(ctx.review.id, async (tx, row) => {
        if (row.status !== 'debrief') return conflict(row.status === 'finalised' ? 'This review is finalised' : 'The debrief is not open')
        const now = new Date()
        const set = { negotiatedScore: p.data.score, negotiatedBy: caller.email, negotiatedAt: now }
        await tx.insert(validationDebriefs).values({ reviewId: row.id, indicatorId: who, ...set })
          .onConflictDoUpdate({ target: [validationDebriefs.reviewId, validationDebriefs.indicatorId], set })
        await tx.insert(auditLogs).values({ actor: caller.email, action: `negotiated ${who}: ${p.data.score ?? 'cleared'}`, target: row.id, category: 'Validation', orgId: e.orgId })
        return json({ ok: true })
      })
    }

    if (sub === 'qualifications') {
      const r = await ensure()
      if (req.method === 'POST' && !who) {
        const p = qualificationSchema.safeParse(await readBody())
        if (!p.success) return bad('Qualification wording and linked indicators are required')
        if (p.data.indicatorIds.some((x) => !ids.has(x))) return bad('Link only indicators in scope')
        return await locked(r.id, async (tx, row) => {
          if (row.status === 'finalised') return conflict('This review is finalised')
          const qid = `qual_${crypto.randomUUID()}`
          await tx.insert(validationQualifications).values({ id: qid, reviewId: row.id, text: p.data.text, indicatorIds: [...new Set(p.data.indicatorIds)], createdBy: caller.email })
          await tx.insert(auditLogs).values({ actor: caller.email, action: 'added a qualification', target: qid, category: 'Validation', orgId: e.orgId })
          return json({ id: qid }, 201)
        })
      }
      if (req.method === 'DELETE' && who && !extra) {
        return await locked(r.id, async (tx, row) => {
          if (row.status === 'finalised') return conflict('This review is finalised')
          const gone = await tx.delete(validationQualifications).where(and(eq(validationQualifications.id, who), eq(validationQualifications.reviewId, row.id))).returning({ id: validationQualifications.id })
          if (!gone.length) return notFound()
          await tx.insert(auditLogs).values({ actor: caller.email, action: 'removed a qualification', target: who, category: 'Validation', orgId: e.orgId })
          return json({ ok: true })
        })
      }
    }

    if (req.method === 'POST' && sub === 'finalise' && !who) {
      const p = finaliseSchema.safeParse(await readBody())
      if (!p.success) return bad('Choose an outcome')
      const r = await ensure()
      // Every validator named on the record must hold the specialisms its indices need at the moment it is frozen.
      if (e.type === 'independent_validation') {
        for (const m of members.filter((x) => x.status === 'named')) {
          const gap = await specialismsMissing(m.email, scope)
          if (gap.length) return bad('This review cannot be finalised yet', { problems: [`${m.email}: ${missingSpecialismMessage(gap)}`] })
        }
      }
      const result = await locked(r.id, async (tx, row) => {
        if (row.status === 'finalised') return conflict('This review is finalised')
        const [scoreRows, debriefRows, qualRows] = await Promise.all([
          tx.select().from(validationScores).where(eq(validationScores.reviewId, row.id)),
          tx.select().from(validationDebriefs).where(eq(validationDebriefs.reviewId, row.id)),
          tx.select().from(validationQualifications).where(eq(validationQualifications.reviewId, row.id)),
        ])
        const validatorScores = Object.fromEntries(scoreRows.filter((s) => ids.has(s.indicatorId)).map((s) => [s.indicatorId, s.score]))
        const negotiated = Object.fromEntries(debriefRows.filter((d) => d.negotiatedScore != null && ids.has(d.indicatorId)).map((d) => [d.indicatorId, d.negotiatedScore as number]))
        const quals = qualRows.map((q) => ({ id: q.id, text: q.text, indicatorIds: q.indicatorIds }))
        const sufficiency = sufficiencyOf(scoreRows, ids)
        const problems = finalisationProblems({
          fw, scope, validatorScores, negotiated, sufficiency, method: row.method as never, fieldworkStart: row.fieldworkStart, fieldworkEnd: row.fieldworkEnd,
          outcome: p.data.outcome, qualifications: quals, profile: ctx.profile,
        })
        if (problems.length) return bad('This review cannot be finalised yet', { problems })

        const self = await selfScores(e.orgId, fw.scoresKey, ids)
        // A negotiated score above 2 on evidence the validator marked insufficient stands at 2 (paper-compliance cap).
        const caps = paperCaps(negotiated, sufficiency)
        const final = finalScores(validatorScores, cappedNegotiated(negotiated, caps))
        // Only a scope that includes level 1 yields a rung; a partial scope records the levels it confirmed instead.
        const rung = supportsRung(scope) ? impliedRung(fw, final, scope) : 0
        const evidenceLinks = await tx.select().from(validationEvidenceLinks).where(eq(validationEvidenceLinks.engagementId, id))
        const choice = p.data.validityMonths != null ? { months: p.data.validityMonths, reason: p.data.validityReason ?? '' } : null
        const validityIssues = validityProblems(p.data.outcome, rung, choice)
        if (validityIssues.length) return bad('This review cannot be finalised yet', { problems: validityIssues })
        const achieved = levelsAchieved(fw, final, scope)
        const now = new Date()
        const snapshot = JSON.parse(JSON.stringify(await buildSnapshot({ profile: ctx.profile, e, members, fw, scope, row, scoreRows, debriefRows, quals, self, final, validatorScores, negotiated, caps, evidenceLinks, rung, achieved, outcome: p.data.outcome, summary: p.data.summary ?? '', finalisedAt: now, finalisedByEmail: caller.email })))
        // Hash the JSON-typed form: it is what Postgres stores, so anyone can re-hash the stored snapshot.
        const sha = createHash('sha256').update(canonicalJson(snapshot)).digest('hex')
        await tx.update(validationReviews).set({
          status: 'finalised', outcome: p.data.outcome, outcomeSummary: p.data.summary ?? '', validatedRung: p.data.outcome === 'not_validated' || !supportsRung(scope) ? null : rung,
          snapshot, snapshotSha256: sha, finalisedAt: now, finalisedBy: caller.email, updatedAt: now,
        }).where(eq(validationReviews.id, row.id))
        await tx.update(validationEngagements).set({ status: 'finalised', updatedAt: now }).where(eq(validationEngagements.id, id))
        let issuedId: string | null = null
        if (p.data.outcome !== 'not_validated') {
          // The issued validation: validity, follow-up schedule, and the indicators a follow-up re-checks
          // (the qualified ones plus those holding back the next rung). It supersedes the previous current one.
          const issued = issuedValidity(p.data.outcome, now, choice?.months)
          const tracked = [...new Set([...quals.flatMap((q) => q.indicatorIds), ...fw.blocking(cleanScores(final, ids)), ...scopeIndices(scope).flatMap((f) => f.blocking(cleanScores(final, ids)))])]
          issuedId = `val_${crypto.randomUUID()}`
          const previous = await tx.select({ id: validations.id }).from(validations)
            .where(and(eq(validations.orgId, e.orgId), eq(validations.framework, fw.key), eq(validations.status, 'current')))
          await tx.insert(validations).values({
            id: issuedId, reviewId: row.id, engagementId: id, orgId: e.orgId, framework: fw.key, outcome: p.data.outcome, validatedRung: rung, issuedAt: now,
            validityMonths: issued.months, validityReason: choice?.reason ?? '', expiresAt: issued.expiresAt, surveillanceDueAt: issued.surveillanceDueAt,
            verificationId: generateVerificationId(), trackedIndicators: tracked, followUpMode: p.data.followUpMode ?? 'milestone', followUpSetBy: caller.email, followUpSetAt: now,
          })
          await recordStatusHistory(tx as never, issuedId, null, 'current', 'Validation issued', caller.email, now)
          // Each qualification becomes an improvement action for the organisation to own, date and prove.
          for (const q of quals) {
            await tx.insert(validationCipActions).values({ id: `cip_${crypto.randomUUID()}`, validationId: issuedId, orgId: e.orgId, text: q.text, indicatorIds: q.indicatorIds, qualificationId: q.id, createdBy: caller.email })
          }
          for (const old of previous) {
            await tx.update(validations).set({ status: 'superseded', statusReason: 'Superseded by a newer validation', statusChangedAt: now, statusChangedBy: caller.email, supersededBy: issuedId })
              .where(eq(validations.id, old.id))
            await recordStatusHistory(tx as never, old.id, 'current', 'superseded', 'Superseded by a newer validation', caller.email, now)
            await tx.insert(auditLogs).values({ actor: caller.email, action: 'superseded by a newer validation', target: old.id, category: 'Validation', orgId: e.orgId })
          }
          await tx.insert(auditLogs).values({ actor: caller.email, action: `issued validation: ${issued.months} months, expires ${issued.expiresAt.toISOString().slice(0, 10)}${issued.surveillanceDueAt ? `, surveillance ${issued.surveillanceDueAt.toISOString().slice(0, 10)}` : ''}`, target: issuedId, category: 'Validation', orgId: e.orgId })
        }
        await tx.insert(auditLogs).values({ actor: caller.email, action: `finalised review: ${p.data.outcome}${p.data.outcome === 'not_validated' ? '' : supportsRung(scope) ? `, rung ${rung}` : `, levels confirmed: ${achieved.join(', ') || 'none'}`} (sha256 ${sha.slice(0, 12)}…)`, target: row.id, category: 'Validation', orgId: e.orgId })
        return json({ ok: true, outcome: p.data.outcome, validatedRung: p.data.outcome === 'not_validated' || !supportsRung(scope) ? null : rung, confirmedLevels: supportsRung(scope) ? null : achieved, sha256: sha, validationId: issuedId })
      })
      // The engagement is finalised: every team member's access ends now.
      if (result.status === 200) {
        await reconcileEngagement(id)
        // Issue the statement PDF now so its SHA-256 is fixed at issue. Best effort: the public page makes it on first view if this fails.
        const [issued] = await db.select().from(validations).where(eq(validations.reviewId, r.id))
        if (issued) {
          await syncCheckpoints(issued).catch((err) => logger.error('/api/validation-reviews', 'checkpoints failed', err))
          await ensureStatement(issued).catch((err) => logger.error('/api/validation-reviews', 'statement PDF failed', err))
        }
      }
      return result
    }

    return notFound()
  } catch (err) {
    logger.error('/api/validation-reviews', 'failed', err)
    return json({ error: 'Validation review request failed' }, 500)
  }
}

// Runs fn with the review row locked, so a score edit can never interleave with the freeze.
async function locked(reviewId: string, fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], row: ValidationReviewRow) => Promise<Response>): Promise<Response> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(validationReviews).where(eq(validationReviews.id, reviewId)).for('update')
    if (!row) return notFound()
    return fn(tx, row)
  })
}

async function view(ctx: Ctx, fw: (typeof FRAMEWORKS)[string], scope: EngagementScope, ids: Set<string>) {
  const { e, review } = ctx
  const selfScores = (orgId: string, _key: string, idSet: Set<string>) => loadScopeSelfScores(orgId, fw, scope, idSet)
  const base = {
    engagementStatus: e.status, framework: { key: fw.key, name: fw.name, version: fw.version }, scope, type: e.type,
    indices: scopeIndices(scope).map((f) => ({ key: f.key, name: f.name, version: f.version })), specialismBlock: ctx.specialismBlock,
  }
  if (review?.status === 'finalised') {
    return { ...base, status: 'finalised', outcome: review.outcome, validatedRung: review.validatedRung, sha256: review.snapshotSha256, finalisedAt: review.finalisedAt, snapshot: review.snapshot }
  }
  const [scoreRows, debriefRows, qualRows] = review ? await Promise.all([
    db.select().from(validationScores).where(eq(validationScores.reviewId, review.id)),
    db.select().from(validationDebriefs).where(eq(validationDebriefs.reviewId, review.id)),
    db.select().from(validationQualifications).where(eq(validationQualifications.reviewId, review.id)),
  ]) : [[], [], []]
  if (ctx.reviewer) {
    const self = await selfScores(e.orgId, fw.scoresKey, ids)
    const validatorScores = Object.fromEntries(scoreRows.filter((s) => ids.has(s.indicatorId)).map((s) => [s.indicatorId, s.score]))
    const negotiated = Object.fromEntries(debriefRows.filter((d) => d.negotiatedScore != null && ids.has(d.indicatorId)).map((d) => [d.indicatorId, d.negotiatedScore as number]))
    const quals = qualRows.map((q) => ({ id: q.id, text: q.text, indicatorIds: q.indicatorIds }))
    const sufficiency = sufficiencyOf(scoreRows, ids)
    const caps = paperCaps(negotiated, sufficiency)
    const evidence = await linkedEvidence(e.id)
    if (evidence.length) await audit(ctx.me!.email, `viewed ${evidence.length} linked evidence item${evidence.length === 1 ? '' : 's'}`, e.id, e.orgId)
    const rows = trustDeltaWithCaps(fw, scope, self, validatorScores, negotiated, sufficiency, ctx.profile).map((t) => {
      const s = scoreRows.find((x) => x.indicatorId === t.id)
      const d = debriefRows.find((x) => x.indicatorId === t.id)
      return { ...t, sufficiency: s?.sufficiency ?? null, comment: s?.comment ?? '', evidenceRef: s?.evidenceRef ?? '', orgResponse: d?.orgResponse ?? '', evidence: evidence.filter((x) => x.indicatorId === t.id) }
    })
    const problems = finalisationProblems({ fw, scope, validatorScores, negotiated, sufficiency, method: (review?.method ?? null) as never, fieldworkStart: review?.fieldworkStart ?? null, fieldworkEnd: review?.fieldworkEnd ?? null, outcome: null, qualifications: quals, profile: ctx.profile })
      .filter((x) => x !== 'Choose an outcome')
    return {
      ...base, status: review?.status ?? 'draft', lead: ctx.lead, method: review?.method ?? null, fieldworkStart: review?.fieldworkStart ?? null, fieldworkEnd: review?.fieldworkEnd ?? null,
      levels: fw.levels, rows, qualifications: quals, problems,
      partialScope: !supportsRung(scope),
      rungs: supportsRung(scope) ? { self: impliedRung(fw, self, scope), validator: impliedRung(fw, finalScores(validatorScores, cappedNegotiated(negotiated, caps)), scope) } : null,
      confirmedLevels: supportsRung(scope) ? null : levelConfirmations(fw, finalScores(validatorScores, cappedNegotiated(negotiated, caps)), scope),
      // The band each index would get on the scores so far (a preview for the team; final at freeze).
      indexBands: indexResults(scope, finalScores(validatorScores, cappedNegotiated(negotiated, caps)), ctx.profile),
      scored: Object.keys(validatorScores).length, total: ids.size,
    }
  }
  // The organisation sees nothing of the validator's work until the debrief opens.
  if (review?.status === 'debrief') {
    const self = await selfScores(e.orgId, fw.scoresKey, ids)
    const validatorScores = Object.fromEntries(scoreRows.filter((s) => ids.has(s.indicatorId)).map((s) => [s.indicatorId, s.score]))
    const negotiated = Object.fromEntries(debriefRows.filter((d) => d.negotiatedScore != null && ids.has(d.indicatorId)).map((d) => [d.indicatorId, d.negotiatedScore as number]))
    const evidence = await linkedEvidence(e.id)
    return {
      ...base, status: 'debrief', method: review.method, fieldworkStart: review.fieldworkStart, fieldworkEnd: review.fieldworkEnd, levels: fw.levels,
      indicators: allInScope(fw, scope, ctx.profile), evidence,
      rows: trustDeltaWithCaps(fw, scope, self, validatorScores, negotiated, sufficiencyOf(scoreRows, ids), ctx.profile).map((t) => {
        const s = scoreRows.find((x) => x.indicatorId === t.id)
        const d = debriefRows.find((x) => x.indicatorId === t.id)
        return { ...t, comment: s?.comment ?? '', orgResponse: d?.orgResponse ?? '' }
      }),
    }
  }
  // Before the debrief the organisation sees only the evidence it has linked.
  return { ...base, status: review ? 'in_progress' : 'not_started', ...(ctx.org ? { indicators: allInScope(fw, scope, ctx.profile), evidence: await linkedEvidence(e.id) } : {}) }
}

const sufficiencyOf = (scoreRows: Array<{ indicatorId: string; sufficiency: string }>, ids: Set<string>): Record<string, Sufficiency> =>
  Object.fromEntries(scoreRows.filter((s) => ids.has(s.indicatorId)).map((s) => [s.indicatorId, s.sufficiency as Sufficiency]))

/** SHA-256 of the stored evidence file, or null when it cannot be read. Only the hash is kept. */
async function evidenceSha256(filePath: string): Promise<string | null> {
  try {
    const data = await getStore('evidence').get(filePath, { type: 'arrayBuffer' })
    return data ? createHash('sha256').update(Buffer.from(decodeEvidence(data))).digest('hex') : null
  } catch { return null }
}

/** The evidence linked to an engagement's indicators, with the registry's current state (read-only metadata, no contents). */
async function linkedEvidence(engagementId: string) {
  const links = await db.select().from(validationEvidenceLinks).where(eq(validationEvidenceLinks.engagementId, engagementId))
  if (!links.length) return []
  const registry = await db.select().from(evidenceRegistry).where(inArray(evidenceRegistry.id, links.map((l) => l.evidenceId)))
  return links.sort((a, b) => +a.linkedAt - +b.linkedAt).map((l) => {
    const r = registry.find((x) => x.id === l.evidenceId)
    return {
      indicatorId: l.indicatorId, evidenceId: l.evidenceId, name: l.documentName, documentType: l.documentType, sha256: l.sha256, linkedBy: l.linkedBy, linkedAt: l.linkedAt,
      available: !!r && !r.archivedAt, status: r?.status ?? null, expiryDate: r?.expiryDate ?? null, mimeType: r?.mimeType ?? null, sizeKb: r?.fileSizeKb ?? null,
    }
  })
}

/** Evidence the caller may link: items held by workspace organisations where they are an assessor or above. */
async function evidenceOptions(email: string, superAdmin: boolean) {
  const hashes = fieldLookupHashes(email)
  const memberOf = hashes.length ? or(inArray(wsOrgMembers.userIdHash, hashes), eq(wsOrgMembers.userId, email))! : eq(wsOrgMembers.userId, email)
  const orgIds = superAdmin ? null : (await db.select({ orgId: wsOrgMembers.orgId }).from(wsOrgMembers)
    .where(and(memberOf, inArray(wsOrgMembers.role, ['owner', 'admin', 'assessor'])))).map((m) => m.orgId)
  if (orgIds && !orgIds.length) return []
  const items = await db.select().from(evidenceRegistry)
    .where(and(isNull(evidenceRegistry.archivedAt), ne(evidenceRegistry.status, 'rejected'), orgIds ? inArray(evidenceRegistry.orgId, orgIds) : undefined))
    .limit(500)
  return items.map((x) => ({ id: x.id, name: x.documentName, documentType: x.documentType, status: x.status, expiryDate: x.expiryDate, mimeType: x.mimeType, sizeKb: x.fileSizeKb }))
}

type SnapshotInput = {
  profile: ModuleProfile
  e: ValidationEngagementRow; members: EngagementMemberRow[]; fw: (typeof FRAMEWORKS)[string]; scope: EngagementScope; row: ValidationReviewRow
  scoreRows: Array<typeof validationScores.$inferSelect>; debriefRows: Array<typeof validationDebriefs.$inferSelect>
  quals: Array<{ id: string; text: string; indicatorIds: string[] }>
  self: Record<string, number>; final: Record<string, number>; validatorScores: Record<string, number>; negotiated: Record<string, number>
  caps: Record<string, PaperCap>; evidenceLinks: Array<typeof validationEvidenceLinks.$inferSelect>
  rung: number; achieved: number[]; outcome: Outcome; summary: string; finalisedAt: Date; finalisedByEmail: string
}

async function buildSnapshot(s: SnapshotInput) {
  const { e, fw } = s
  const named = s.members.filter((m) => m.status === 'named')
  const profiles = named.length ? await db.select().from(validatorProfiles).where(inArray(validatorProfiles.email, named.map((m) => m.email))) : []
  const decls = await db.select().from(engagementDeclarations).where(eq(engagementDeclarations.engagementId, e.id))
  const [org] = await db.select({ name: organizations.name, country: organizations.country }).from(organizations).where(eq(organizations.id, e.orgId))
  const firmIds = [e.validatorFirmId, e.funderFirmId].filter((x): x is string => !!x)
  const firmRows = firmIds.length ? await db.select({ id: firms.id, name: firms.name }).from(firms).where(inArray(firms.id, firmIds)) : []
  const firmName = (fid: string | null) => firmRows.find((f) => f.id === fid)?.name ?? null
  const team = named.map((m) => {
    const p = profiles.find((x) => x.email === m.email)
    const d = decls.filter((x) => x.memberEmail === m.email).sort((a, b) => +b.signedAt - +a.signedAt)[0]
    return {
      name: p?.name ?? 'Unnamed', role: m.role, accreditation: p ? effectiveAccreditation(p) : 'none', accreditedUntil: p?.accreditedUntil ?? null,
      declaration: d ? { version: d.version, text: d.text, signedName: d.signedName, signedAt: d.signedAt, fundedDisclosure: d.fundedDisclosure, disclosure: d.disclosure } : null,
    }
  })
  const engagedBy = e.createdBySide === 'organization' ? (org?.name ?? '') : e.createdBySide === 'funder' ? (firmName(e.funderFirmId) ?? '') : (firmName(e.validatorFirmId) ?? team[0]?.name ?? '')
  const label = engagementLabel({ type: e.type as EngagementType, funderName: firmName(e.funderFirmId), engagedBy, members: team.map((t) => ({ name: t.name, accreditation: t.accreditation })) })
  const levelsInScope = [...new Set(indicatorsInScope(fw, s.scope).map((i) => i.level))]
  const inScope = allInScope(fw, s.scope, s.profile)
  return {
    // 2: CRAFT indices validated alongside the ladder (spec §7). Schema 1 snapshots have no `indices` and no per-indicator `framework`.
    schema: 2,
    framework: { key: fw.key, name: fw.name, version: fw.version },
    indices: indexResults(s.scope, s.final, s.profile).map((r) => {
      const own = new Set(inScope.filter((i) => i.framework === r.key).map((i) => i.id))
      return { ...r, qualifications: s.quals.filter((q) => q.indicatorIds.some((x) => own.has(x))).map((q) => q.text) }
    }),
    moduleProfile: s.profile,
    scope: s.scope,
    engagement: { id: e.id, type: e.type, label: label.label, statement: label.statement, engagedBy, createdBySide: e.createdBySide, requiresRereview: e.requiresRereview },
    organization: { name: org?.name ?? '', country: org?.country ?? '' },
    validatorFirm: firmName(e.validatorFirmId), funder: firmName(e.funderFirmId),
    team,
    method: s.row.method, fieldwork: { start: s.row.fieldworkStart, end: s.row.fieldworkEnd },
    outcome: s.outcome, outcomeSummary: s.summary, validatedRung: s.outcome === 'not_validated' || !supportsRung(s.scope) ? null : s.rung, impliedRung: s.rung,
    // A scope that skips level 1 confirms levels, never a rung: each in-scope level and whether the final scores achieve it.
    partialScope: !supportsRung(s.scope), confirmedLevels: supportsRung(s.scope) ? null : levelConfirmations(fw, s.final, s.scope),
    selfRung: impliedRung(fw, s.self, s.scope), levelsAchieved: s.achieved,
    levelScores: levelsInScope.map((l) => ({ level: l, self: fw.levelScore(l, s.self), validator: fw.levelScore(l, s.validatorScores), final: fw.levelScore(l, s.final) })),
    indicators: inScope.map((i) => {
      const sc = s.scoreRows.find((x) => x.indicatorId === i.id)
      const d = s.debriefRows.find((x) => x.indicatorId === i.id)
      return {
        id: i.id, framework: i.framework, level: i.level, domain: i.domain, self: s.self[i.id] ?? null, validator: s.validatorScores[i.id] ?? null, negotiated: s.negotiated[i.id] ?? null, final: s.final[i.id] ?? null,
        sufficiency: sc?.sufficiency ?? null, comment: sc?.comment ?? '', evidenceRef: sc?.evidenceRef ?? '', orgResponse: d?.orgResponse ?? '',
        // Paper-compliance cap on the negotiated score, when it applied.
        paperCap: s.caps[i.id] ? { negotiated: s.caps[i.id].negotiated, capped: s.caps[i.id].capped } : null,
        // References only (id, name, hash): never file contents.
        evidence: s.evidenceLinks.filter((l) => l.indicatorId === i.id).sort((a, b) => a.evidenceId - b.evidenceId)
          .map((l) => ({ id: l.evidenceId, name: l.documentName, type: l.documentType, sha256: l.sha256 })),
      }
    }),
    qualifications: s.quals.map((q) => ({ text: q.text, indicatorIds: q.indicatorIds })),
    finalisedAt: s.finalisedAt.toISOString(), finalisedBy: profiles.find((p) => p.email === s.finalisedByEmail)?.name ?? 'Validator',
  }
}

export const config: Config = { path: ['/api/validation-reviews', '/api/validation-reviews/*'] }
