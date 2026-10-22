import type { Config } from '@netlify/functions'
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  auditLogs, firmMembers, firms, organizations, panelRoster, trainingStaff, validationEngagements, validationFunderConsents, validationRereviews, validationReviews, validations, validatorProfiles,
  type RereviewRow, type ValidationRow,
} from '../../db/schema.js'
import { canAccessOrg, forbidden, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { isProgrammeTeam } from '../lib/training.js'
import { logger, monitored } from '../lib/logger.js'
import { contactsFor, notify } from '../lib/validation-lifecycle.js'
import { applyValidationOutcome, conflictCheck, type ConflictSubject } from '../lib/review-panel.js'
import { effectiveAccreditation } from '../../src/lib/validatorDirectory.js'
import { REREVIEW_DECLARATION, REREVIEW_OUTCOME_LABEL, REREVIEW_OUTCOMES, REREVIEW_REASON_LABEL, REREVIEW_REASONS, type RereviewOutcome, type RereviewReason } from '../../src/lib/validatorQuality.js'

// /api/re-reviews — re-review of an issued validation (spec: "Re-review").
//
//   GET  /                     the re-reviews the caller may see (programme team: all; reviewer: theirs; organisation; following funder)
//   GET  /:id                  one re-review; the reviewer and the programme team also get the frozen review
//   POST /request              funding-partner staff following the validation: require a re-review {validationId, note?}
//   POST /                     programme team: open one {validationId, reason, reviewerEmail, note?}
//   PUT  /:id/reviewer         programme team: assign a request, or someone else while in progress {reviewerEmail}
//   POST /:id/decide           the reviewer: {outcome: stands | amended | withdrawn, reasons, declaration}
//
// The re-reviewer is an active Senior Validator on the review panel roster, currently accredited, from a different
// firm, with no ties to the parties in the last three years (the panel's conflict check). Flags never open one.
// A challenge to the outcome goes to the Independent Review Panel.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string, extra: object = {}) => json({ error, ...extra }, 400)
const notFound = () => json({ error: 'Not found' }, 404)
const conflict = (error: string) => json({ error }, 409)
const email = z.string().trim().toLowerCase().email().max(200)
const openSchema = z.object({ validationId: z.string().min(1).max(200), reason: z.enum(REREVIEW_REASONS), reviewerEmail: email, note: z.string().trim().max(2000).optional() })
const reviewerSchema = z.object({ reviewerEmail: email })
const requestSchema = z.object({ validationId: z.string().min(1).max(200), note: z.string().trim().max(2000).optional() })
const decideSchema = z.object({ outcome: z.enum(REREVIEW_OUTCOMES), reasons: z.string().trim().min(20).max(6000), declaration: z.string() })

const funderStaff = async (firmId: string | null): Promise<string[]> => firmId
  ? (await db.select({ email: firmMembers.email }).from(firmMembers).where(and(eq(firmMembers.firmId, firmId), eq(firmMembers.status, 'active')))).map((r) => r.email)
  : []

/** Validations a funding partner's staff member follows: their firm engaged on it, or the organisation lets it follow. */
async function followedValidations(me: string): Promise<string[]> {
  const firmIds = (await db.select({ id: firms.id }).from(firmMembers).innerJoin(firms, eq(firms.id, firmMembers.firmId))
    .where(and(eq(firmMembers.email, me), eq(firmMembers.status, 'active'), eq(firms.kind, 'funding_partner')))).map((r) => r.id)
  if (!firmIds.length) return []
  const engaged = await db.select({ id: validations.id }).from(validations).innerJoin(validationEngagements, eq(validationEngagements.id, validations.engagementId))
    .where(inArray(validationEngagements.funderFirmId, firmIds))
  const consented = await db.select({ id: validationFunderConsents.validationId }).from(validationFunderConsents)
    .where(and(inArray(validationFunderConsents.funderFirmId, firmIds), isNull(validationFunderConsents.revokedAt)))
  return [...new Set([...engaged, ...consented].map((r) => r.id))]
}
const programmeTeam = async () => (await db.select({ email: trainingStaff.email }).from(trainingStaff).where(eq(trainingStaff.role, 'programme_team'))).map((r) => r.email)

/** Why this person cannot re-review this validation; empty when they can. */
/** `r` is the re-review (if it exists yet): a funder who required it is a party, and so is the firm they work for. */
async function reviewerProblems(v: ValidationRow, reviewer: string, raiser: string, r?: Pick<RereviewRow, 'requestedBy'>): Promise<string[]> {
  const [onRoster] = await db.select().from(panelRoster).where(eq(panelRoster.email, reviewer))
  if (!onRoster || !onRoster.active || onRoster.kind !== 'senior_validator') return ['The re-reviewer must be an active Senior Validator on the review panel roster']
  const [prof] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.email, reviewer))
  if (!prof || effectiveAccreditation(prof) !== 'accredited') return ['The re-reviewer must be a currently accredited validator']
  const lead = (await contactsFor(v)).validator[0] ?? null
  const subject: ConflictSubject = { engagementId: v.engagementId, orgId: v.orgId, subjectValidatorEmail: lead, raisedBy: r?.requestedBy ?? raiser, raisedSide: r?.requestedBy ? 'funder' : 'programme', appealOf: null }
  return conflictCheck(subject, reviewer)
}

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (caller.readOnly) return forbidden()
    const [id, sub] = new URL(req.url).pathname.replace(/^\/api\/re-reviews\/?/, '').split('/').filter(Boolean)
    const readBody = async () => { try { return await req.json() } catch { return null } }
    const me = caller.email.toLowerCase()
    const staff = await isProgrammeTeam(caller.email)
    const audit = (action: string, target: string, orgId: string) => db.insert(auditLogs).values({ actor: caller.email, action, target, category: 'Validation', orgId })
    const validationOf = async (vid: string) => (await db.select().from(validations).where(eq(validations.id, vid)))[0] as ValidationRow | undefined

    /** Who the caller is to this re-review, or null when they may not see it. */
    const roleIn = async (r: RereviewRow, v: ValidationRow): Promise<'staff' | 'reviewer' | 'party' | null> => {
      if (staff) return 'staff'
      if (r.reviewerEmail === me) return 'reviewer'
      if (caller.orgId === r.orgId && (await canAccessOrg(caller, r.orgId, 'read'))) return 'party'
      if ((await followedValidations(me)).includes(v.id)) return 'party'
      return null
    }
    const describe = async (rs: RereviewRow[]) => {
      if (!rs.length) return []
      const vals = await db.select().from(validations).where(inArray(validations.id, rs.map((r) => r.validationId)))
      const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, rs.map((r) => r.orgId)))
      const names = await db.select({ email: validatorProfiles.email, name: validatorProfiles.name }).from(validatorProfiles).where(inArray(validatorProfiles.email, rs.flatMap((r) => (r.reviewerEmail ? [r.reviewerEmail] : []))))
      return rs.map((r) => {
        const v = vals.find((x) => x.id === r.validationId)
        return {
          id: r.id, validationId: r.validationId, verificationId: v?.verificationId ?? null, validatedRung: v?.validatedRung ?? null, validationStatus: v?.status ?? null,
          organization: orgs.find((o) => o.id === r.orgId)?.name ?? '', reason: r.reason, reasonLabel: REREVIEW_REASON_LABEL[r.reason as RereviewReason] ?? r.reason, note: r.note,
          reviewer: r.reviewerEmail ? names.find((n) => n.email === r.reviewerEmail)?.name ?? 'Senior Validator' : null, status: r.status,
          outcome: r.outcome, outcomeLabel: r.outcome ? REREVIEW_OUTCOME_LABEL[r.outcome as RereviewOutcome] : null, reasons: r.reasons, effects: r.effects ?? [],
          mine: r.reviewerEmail === me, createdAt: r.createdAt, decidedAt: r.decidedAt,
        }
      })
    }
    /** Organisation contacts, the validator, the engaging funder's staff and the reviewer. */
    const everyone = async (v: ValidationRow, r: Pick<RereviewRow, 'reviewerEmail' | 'requestedBy'>) => {
      const c = await contactsFor(v)
      const [e] = await db.select({ funderFirmId: validationEngagements.funderFirmId }).from(validationEngagements).where(eq(validationEngagements.id, v.engagementId))
      return [...new Set([...c.org, ...c.validator, ...await funderStaff(e?.funderFirmId ?? null), r.reviewerEmail, r.requestedBy].filter((x): x is string => !!x))]
    }

    // ---- List and open --------------------------------------------------------------------------------------
    if (!id) {
      if (req.method === 'GET') {
        let rs: RereviewRow[]
        if (staff) rs = await db.select().from(validationRereviews).orderBy(desc(validationRereviews.createdAt))
        else {
          const funded = await followedValidations(me)
          const ownOrg = caller.orgId && (await canAccessOrg(caller, caller.orgId, 'read')) ? caller.orgId : null
          rs = await db.select().from(validationRereviews).where(or(
            eq(validationRereviews.reviewerEmail, me),
            ...(ownOrg ? [eq(validationRereviews.orgId, ownOrg)] : []),
            ...(funded.length ? [inArray(validationRereviews.validationId, funded)] : []),
          )).orderBy(desc(validationRereviews.createdAt))
        }
        return json(await describe(rs))
      }
      if (req.method === 'POST') {
        if (!staff) return forbidden()
        const p = openSchema.safeParse(await readBody())
        if (!p.success) return bad('A validation, a reason and a re-reviewer are required')
        const v = await validationOf(p.data.validationId)
        if (!v) return notFound()
        if (v.status === 'withdrawn' || v.status === 'superseded') return conflict(`This validation is ${v.status}; there is nothing to re-review`)
        if (p.data.reason === 'funder_required') {
          const [e] = await db.select({ requiresRereview: validationEngagements.requiresRereview }).from(validationEngagements).where(eq(validationEngagements.id, v.engagementId))
          if (!e?.requiresRereview) return bad('The funding partner did not make a re-review a term of this engagement')
        }
        const problems = await reviewerProblems(v, p.data.reviewerEmail, caller.email)
        if (problems.length) return bad(problems[0], { reasons: problems })
        const rid = `rr_${crypto.randomUUID()}`
        // The one-open-per-validation index decides races.
        const created = await db.insert(validationRereviews)
          .values({ id: rid, validationId: v.id, orgId: v.orgId, reason: p.data.reason, note: p.data.note ?? '', reviewerEmail: p.data.reviewerEmail, openedBy: caller.email })
          .onConflictDoNothing().returning({ id: validationRereviews.id })
        if (!created.length) return conflict('A re-review of this validation is already requested or in progress')
        await audit(`opened re-review (${p.data.reason}) assigned to ${p.data.reviewerEmail}`, rid, v.orgId)
        await notify(await everyone(v, { ...p.data, requestedBy: null }), 'A CRAFT validation is being re-reviewed',
          `Validation ${v.verificationId ?? v.id} is being re-reviewed by a Senior Validator from a different firm (${REREVIEW_REASON_LABEL[p.data.reason]}).\n\nThe re-reviewer reads the frozen review and decides whether the validation stands, is amended or is withdrawn. The validation's status does not change while this happens.`)
        return json({ ok: true, id: rid }, 201)
      }
      return notFound()
    }

    // ---- A funding partner requires a re-review ---------------------------------------------------------------
    if (id === 'request' && !sub && req.method === 'POST') {
      const p = requestSchema.safeParse(await readBody())
      if (!p.success) return bad('A validation is required')
      const v = await validationOf(p.data.validationId)
      // Only a funder that follows the validation may require it; to anyone else it does not exist.
      if (!v || !(await followedValidations(me)).includes(v.id)) return notFound()
      if (v.status === 'withdrawn' || v.status === 'superseded') return conflict(`This validation is ${v.status}; there is nothing to re-review`)
      const rid = `rr_${crypto.randomUUID()}`
      const created = await db.insert(validationRereviews)
        .values({ id: rid, validationId: v.id, orgId: v.orgId, reason: 'funder_required', note: p.data.note ?? '', status: 'requested', requestedBy: caller.email })
        .onConflictDoNothing().returning({ id: validationRereviews.id })
      if (!created.length) return conflict('A re-review of this validation is already requested or in progress')
      await audit('funding partner required a re-review', rid, v.orgId)
      const c = await contactsFor(v)
      await notify([...new Set([...await programmeTeam(), ...c.org, ...c.validator])], 'A funding partner has required a re-review',
        `A funding partner that follows validation ${v.verificationId ?? v.id} has required a re-review.${p.data.note ? `\n\nTheir note: ${p.data.note}` : ''}\n\nThe CRAFT programme team will assign a Senior Validator from a different firm. The validation's status does not change while this happens.`)
      return json({ ok: true, id: rid }, 201)
    }

    const [r] = await db.select().from(validationRereviews).where(eq(validationRereviews.id, id))
    if (!r) return notFound()
    const v = await validationOf(r.validationId)
    if (!v) return notFound()
    const role = await roleIn(r, v)
    if (!role) return notFound()

    if (!sub && req.method === 'GET') {
      const [row] = await describe([r])
      // Only the re-reviewer and the programme team read the frozen review itself.
      if (role === 'party') return json(row)
      const [review] = await db.select({ snapshot: validationReviews.snapshot, sha: validationReviews.snapshotSha256, outcome: validationReviews.outcome }).from(validationReviews).where(eq(validationReviews.id, v.reviewId))
      return json({ ...row, review: review ?? null, declaration: REREVIEW_DECLARATION })
    }

    if (sub === 'reviewer' && req.method === 'PUT') {
      if (role !== 'staff') return forbidden()
      if (r.status === 'decided') return conflict('This re-review has been decided')
      const p = reviewerSchema.safeParse(await readBody())
      if (!p.success) return bad('A re-reviewer email is required')
      const problems = await reviewerProblems(v, p.data.reviewerEmail, r.openedBy ?? caller.email, r)
      if (problems.length) return bad(problems[0], { reasons: problems })
      const done = await db.update(validationRereviews).set({ reviewerEmail: p.data.reviewerEmail, status: 'assigned', openedBy: r.openedBy ?? caller.email, updatedAt: new Date() })
        .where(and(eq(validationRereviews.id, r.id), eq(validationRereviews.status, r.status))).returning({ id: validationRereviews.id })
      if (!done.length) return conflict('This re-review changed meanwhile; reload and try again')
      await audit(r.reviewerEmail ? `re-review reassigned from ${r.reviewerEmail} to ${p.data.reviewerEmail}` : `re-review request assigned to ${p.data.reviewerEmail}`, r.id, r.orgId)
      await notify(r.reviewerEmail ? [p.data.reviewerEmail] : await everyone(v, { reviewerEmail: p.data.reviewerEmail, requestedBy: r.requestedBy }),
        r.reviewerEmail ? 'You have been asked to re-review a CRAFT validation' : 'A CRAFT validation is being re-reviewed',
        `Validation ${v.verificationId ?? v.id} is being re-reviewed by a Senior Validator from a different firm. The re-reviewer reads the frozen review in CRAFT and decides whether it stands, is amended or is withdrawn.`)
      return json({ ok: true })
    }

    if (sub === 'decide' && req.method === 'POST') {
      if (role !== 'reviewer') return forbidden()
      const p = decideSchema.safeParse(await readBody())
      if (!p.success) return bad('Choose an outcome and write your reasons (at least 20 characters)')
      if (p.data.declaration !== REREVIEW_DECLARATION) return bad('Confirm you have no conflict of interest')
      // Circumstances can change after assignment: check again before the decision takes effect.
      const problems = await reviewerProblems(v, me, r.openedBy ?? '', r)
      if (problems.length) return bad(problems[0], { reasons: problems })
      const now = new Date()
      const out = await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(validationRereviews).where(eq(validationRereviews.id, r.id)).for('update')
        if (locked.status !== 'assigned' || locked.reviewerEmail !== me) return null
        const effects = await applyValidationOutcome(tx as never, v.id, p.data.outcome, { why: `Re-review ${r.id}`, by: `re-review ${r.id}`, actor: `rereview:${r.id}`, reasons: p.data.reasons, now })
        await tx.update(validationRereviews).set({ status: 'decided', outcome: p.data.outcome, reasons: p.data.reasons, effects, decidedAt: now, updatedAt: now }).where(eq(validationRereviews.id, r.id))
        await tx.insert(auditLogs).values({ actor: caller.email, action: `re-review decided: ${p.data.outcome}`, target: r.id, category: 'Validation', orgId: r.orgId })
        return effects
      })
      if (!out) return conflict('This re-review is no longer open for a decision')
      await notify(await everyone(v, r), 'A CRAFT re-review has been decided',
        `The re-review of validation ${v.verificationId ?? v.id} is complete: ${REREVIEW_OUTCOME_LABEL[p.data.outcome]}.\n\nReasons: ${p.data.reasons}\n\nIf you disagree, you can take it to the Independent Review Panel as a challenge to a re-review outcome.`)
      return json({ ok: true, outcome: p.data.outcome, effects: out })
    }

    return notFound()
  } catch (err) {
    logger.error('/api/re-reviews', 'failed', err)
    return json({ error: 'Something went wrong' }, 500)
  }
}

export const config: Config = { path: ['/api/re-reviews', '/api/re-reviews/*'] }

export default monitored(handleRequest)
