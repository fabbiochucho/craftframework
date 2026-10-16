import type { Config } from '@netlify/functions'
import { createHash } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { legacyWorkspaceState } from '../../db/legacy-schema.js'
import {
  accessGrants, auditLogs, engagementDeclarations, engagementMembers, firms, organizations, validationDebriefs, validationEngagements,
  validationQualifications, validationReviews, validationScores, validatorProfiles,
  type EngagementMemberRow, type ValidationEngagementRow, type ValidationReviewRow,
} from '../../db/schema.js'
import { canAccessOrg, forbidden, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { grantAllows } from '../lib/access-policy.js'
import { decryptField } from '../lib/crypto.js'
import { reconcileEngagement, sweepEngagements } from '../lib/engagement-access.js'
import { logger } from '../lib/logger.js'
import { engagementLabel, GRANT_ROLE, type EngagementScope, type EngagementType } from '../../src/lib/engagements.js'
import { effectiveAccreditation } from '../../src/lib/validatorDirectory.js'
import {
  canonicalJson, cleanScores, finalisationProblems, finalScores, FRAMEWORKS, impliedRung, indicatorsInScope, levelsAchieved, METHODS,
  OUTCOMES, SUFFICIENCY, trustDelta, type Outcome,
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
//   POST   /:id/finalise                lead: outcome + freeze (snapshot + SHA-256); revokes every team grant
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
const qualificationSchema = z.object({ text: z.string().trim().min(1).max(2000), indicatorIds: z.array(z.string().max(40)).min(1).max(60) })
const finaliseSchema = z.object({ outcome: z.enum(OUTCOMES), summary: z.string().max(4000).optional() })

type Ctx = {
  e: ValidationEngagementRow
  members: EngagementMemberRow[]
  review: ValidationReviewRow | null
  me: EngagementMemberRow | null
  org: boolean
  reviewer: boolean
  lead: boolean
}

async function selfScores(orgId: string, key: string, ids: Set<string>): Promise<Record<string, number>> {
  const [row] = await db.select().from(legacyWorkspaceState).where(and(eq(legacyWorkspaceState.orgId, orgId), eq(legacyWorkspaceState.key, key)))
  if (!row) return {}
  try { return cleanScores(JSON.parse(decryptField(row.value)), ids) } catch { return {} }
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
    const ctx: Ctx = { e, members, review: review ?? null, me, org, reviewer, lead: reviewer && me!.role === 'lead' }
    const fw = FRAMEWORKS[e.framework]
    if (!fw) return bad('Unsupported framework')
    const scope = e.scope as EngagementScope
    const inScope = indicatorsInScope(fw, scope)
    const ids = new Set(inScope.map((i) => i.id))

    if (req.method === 'GET' && !sub) return json(await view(ctx, fw, scope, ids))

    // Everything below writes. The review is created lazily by the first reviewer write.
    const frozen = ctx.review?.status === 'finalised' || e.status === 'finalised'

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
    if (!ctx.reviewer) return frozen ? conflict('This review is finalised') : forbidden()
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
        const problems = finalisationProblems({
          fw, scope, validatorScores, negotiated, method: row.method as never, fieldworkStart: row.fieldworkStart, fieldworkEnd: row.fieldworkEnd,
          outcome: p.data.outcome, qualifications: quals,
        })
        if (problems.length) return bad('This review cannot be finalised yet', { problems })

        const self = await selfScores(e.orgId, fw.scoresKey, ids)
        const final = finalScores(validatorScores, negotiated)
        const rung = impliedRung(fw, final, scope)
        const achieved = levelsAchieved(fw, final, scope)
        const now = new Date()
        const snapshot = JSON.parse(JSON.stringify(await buildSnapshot({ e, members, fw, scope, row, scoreRows, debriefRows, quals, self, final, validatorScores, negotiated, rung, achieved, outcome: p.data.outcome, summary: p.data.summary ?? '', finalisedAt: now, finalisedByEmail: caller.email })))
        // Hash the JSON-typed form: it is what Postgres stores, so anyone can re-hash the stored snapshot.
        const sha = createHash('sha256').update(canonicalJson(snapshot)).digest('hex')
        await tx.update(validationReviews).set({
          status: 'finalised', outcome: p.data.outcome, outcomeSummary: p.data.summary ?? '', validatedRung: p.data.outcome === 'not_validated' ? null : rung,
          snapshot, snapshotSha256: sha, finalisedAt: now, finalisedBy: caller.email, updatedAt: now,
        }).where(eq(validationReviews.id, row.id))
        await tx.update(validationEngagements).set({ status: 'finalised', updatedAt: now }).where(eq(validationEngagements.id, id))
        await tx.insert(auditLogs).values({ actor: caller.email, action: `finalised review: ${p.data.outcome}${p.data.outcome === 'not_validated' ? '' : `, rung ${rung}`} (sha256 ${sha.slice(0, 12)}…)`, target: row.id, category: 'Validation', orgId: e.orgId })
        return json({ ok: true, outcome: p.data.outcome, validatedRung: p.data.outcome === 'not_validated' ? null : rung, sha256: sha })
      })
      // The engagement is finalised: every team member's access ends now.
      if (result.status === 200) await reconcileEngagement(id)
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
  const base = { engagementStatus: e.status, framework: { key: fw.key, name: fw.name, version: fw.version }, scope, type: e.type }
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
    const rows = trustDelta(fw, scope, self, validatorScores).map((t) => {
      const s = scoreRows.find((x) => x.indicatorId === t.id)
      const d = debriefRows.find((x) => x.indicatorId === t.id)
      return { ...t, sufficiency: s?.sufficiency ?? null, comment: s?.comment ?? '', evidenceRef: s?.evidenceRef ?? '', orgResponse: d?.orgResponse ?? '', negotiated: d?.negotiatedScore ?? null }
    })
    const problems = finalisationProblems({ fw, scope, validatorScores, negotiated, method: (review?.method ?? null) as never, fieldworkStart: review?.fieldworkStart ?? null, fieldworkEnd: review?.fieldworkEnd ?? null, outcome: null, qualifications: quals })
      .filter((x) => x !== 'Choose an outcome')
    return {
      ...base, status: review?.status ?? 'draft', lead: ctx.lead, method: review?.method ?? null, fieldworkStart: review?.fieldworkStart ?? null, fieldworkEnd: review?.fieldworkEnd ?? null,
      levels: fw.levels, rows, qualifications: quals, problems,
      rungs: { self: impliedRung(fw, self, scope), validator: impliedRung(fw, finalScores(validatorScores, negotiated), scope) },
      scored: Object.keys(validatorScores).length, total: ids.size,
    }
  }
  // The organisation sees nothing of the validator's work until the debrief opens.
  if (review?.status === 'debrief') {
    const self = await selfScores(e.orgId, fw.scoresKey, ids)
    const validatorScores = Object.fromEntries(scoreRows.filter((s) => ids.has(s.indicatorId)).map((s) => [s.indicatorId, s.score]))
    return {
      ...base, status: 'debrief', method: review.method, fieldworkStart: review.fieldworkStart, fieldworkEnd: review.fieldworkEnd, levels: fw.levels,
      rows: trustDelta(fw, scope, self, validatorScores).map((t) => {
        const s = scoreRows.find((x) => x.indicatorId === t.id)
        const d = debriefRows.find((x) => x.indicatorId === t.id)
        return { ...t, comment: s?.comment ?? '', orgResponse: d?.orgResponse ?? '', negotiated: d?.negotiatedScore ?? null }
      }),
    }
  }
  return { ...base, status: review ? 'in_progress' : 'not_started' }
}

type SnapshotInput = {
  e: ValidationEngagementRow; members: EngagementMemberRow[]; fw: (typeof FRAMEWORKS)[string]; scope: EngagementScope; row: ValidationReviewRow
  scoreRows: Array<typeof validationScores.$inferSelect>; debriefRows: Array<typeof validationDebriefs.$inferSelect>
  quals: Array<{ id: string; text: string; indicatorIds: string[] }>
  self: Record<string, number>; final: Record<string, number>; validatorScores: Record<string, number>; negotiated: Record<string, number>
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
  return {
    schema: 1,
    framework: { key: fw.key, name: fw.name, version: fw.version },
    scope: s.scope,
    engagement: { id: e.id, type: e.type, label: label.label, statement: label.statement, engagedBy, createdBySide: e.createdBySide, requiresRereview: e.requiresRereview },
    organization: { name: org?.name ?? '', country: org?.country ?? '' },
    validatorFirm: firmName(e.validatorFirmId), funder: firmName(e.funderFirmId),
    team,
    method: s.row.method, fieldwork: { start: s.row.fieldworkStart, end: s.row.fieldworkEnd },
    outcome: s.outcome, outcomeSummary: s.summary, validatedRung: s.outcome === 'not_validated' ? null : s.rung, impliedRung: s.rung,
    selfRung: impliedRung(fw, s.self, s.scope), levelsAchieved: s.achieved,
    levelScores: levelsInScope.map((l) => ({ level: l, self: fw.levelScore(l, s.self), validator: fw.levelScore(l, s.validatorScores), final: fw.levelScore(l, s.final) })),
    indicators: indicatorsInScope(fw, s.scope).map((i) => {
      const sc = s.scoreRows.find((x) => x.indicatorId === i.id)
      const d = s.debriefRows.find((x) => x.indicatorId === i.id)
      return {
        id: i.id, level: i.level, domain: i.domain, self: s.self[i.id] ?? null, validator: s.validatorScores[i.id] ?? null, negotiated: s.negotiated[i.id] ?? null, final: s.final[i.id] ?? null,
        sufficiency: sc?.sufficiency ?? null, comment: sc?.comment ?? '', evidenceRef: sc?.evidenceRef ?? '', orgResponse: d?.orgResponse ?? '',
      }
    }),
    qualifications: s.quals.map((q) => ({ text: q.text, indicatorIds: q.indicatorIds })),
    finalisedAt: s.finalisedAt.toISOString(), finalisedBy: profiles.find((p) => p.email === s.finalisedByEmail)?.name ?? 'Validator',
  }
}

export const config: Config = { path: ['/api/validation-reviews', '/api/validation-reviews/*'] }
