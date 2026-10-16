import type { Config } from '@netlify/functions'
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { legacyWorkspaceState } from '../../db/legacy-schema.js'
import {
  auditLogs, engagementMembers, firmMembers, materialEvents, organizations, validationCheckpoints, validationCipActions, validationEngagements,
  validations, validationStatusHistory, type EngagementMemberRow, type MaterialEventRow, type ValidationEngagementRow, type ValidationRow,
} from '../../db/schema.js'
import { canAccessOrg, forbidden, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { decryptField, encryptField } from '../lib/crypto.js'
import { logger } from '../lib/logger.js'
import { isProgrammeTeam } from '../lib/training.js'
import { audit, ensureValidation, notify, partiesOf, recordStatus, refreshValidation, syncCheckpoints } from '../lib/validation-lifecycle.js'
import { cleanScores, FRAMEWORKS } from '../../src/lib/validationReview.js'
import {
  decideEvent, deriveStatus, EVENT_DECISIONS, FOLLOW_UP_KINDS, materialEvent, MATERIAL_EVENT_KEYS, progressSentence, reportedLate,
  reportingDeadline, shortenedExpiry, TERMINAL_STATUSES, addMonths, type FollowUpKind, type ValidationStatus,
} from '../../src/lib/validity.js'

// /api/validation-lifecycle — validator system PR 5 (spec: "Validity and statuses", "CIP and the follow-up schedule").
//
//   GET    /org/:orgId                         the organisation's validations (organisation staff)
//   GET    /:engagementId                      lifecycle of one finalised engagement
//   PUT    /:engagementId/schedule             {kind}  propose the follow-up schedule (validator lead or organisation)
//   POST   /:engagementId/schedule/agree       the other side agrees the current proposal
//   PUT    /:engagementId/consent              {funder}  organisation: engaging funder may see CIP progress
//   POST   /:engagementId/cip                  {text, owner?, dueDate?, indicatorIds}  add a CIP action
//   PUT    /:engagementId/cip/:actionId        edit owner, due date, wording, indicators (not once done)
//   DELETE /:engagementId/cip/:actionId        remove an action that is not done and not from a qualification
//   POST   /:engagementId/cip/:actionId/done   {proof, selfScores?}  organisation: done WITH evidence; updates the self-assessment
//   POST   /:engagementId/checkpoints/:id/complete  {result, note}  validator lead records a follow-up / surveillance check
//   POST   /:engagementId/events               {eventType, occurredOn, description}  organisation or CRAFT programme team reports a material event
//   POST   /:engagementId/events/:id/respond   {response}  organisation answers an event
//   POST   /:engagementId/events/:id/resolve   {decision, note, scopeNote?}  validator lead: reinstate | rescope | withdraw
//   POST   /:engagementId/events/:id/contest   {reason}  organisation disputes it (goes to the Independent Review Panel, PR 7)
//   POST   /:engagementId/shorten              {months, reason}  validator lead: shorten validity for a named risk (never extend)
//   POST   /:engagementId/withdraw             {reason}  validator lead
//
// Validity is never extended by anything here: expires_at only moves earlier.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string) => json({ error }, 400)
const notFound = () => json({ error: 'Not found' }, 404)
const conflict = (error: string) => json({ error }, 409)

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s)), 'Not a date')
const text = (max: number, min = 1) => z.string().trim().min(min).max(max)
const scheduleSchema = z.object({ kind: z.enum(FOLLOW_UP_KINDS) })
const consentSchema = z.object({ funder: z.boolean() })
const actionSchema = z.object({ text: text(2000), owner: text(200).nullish(), dueDate: isoDay.nullish(), indicatorIds: z.array(z.string().max(40)).max(60).default([]) })
const actionPatchSchema = z.object({ text: text(2000).optional(), owner: text(200).nullable().optional(), dueDate: isoDay.nullable().optional(), indicatorIds: z.array(z.string().max(40)).max(60).optional() })
const doneSchema = z.object({ proof: text(1000, 3), selfScores: z.record(z.string().max(40), z.number().int().min(0).max(5)).optional() })
const completeSchema = z.object({ result: z.enum(['confirmed', 'not_confirmed']), note: z.string().trim().max(2000).default('') })
const eventSchema = z.object({ eventType: z.enum(MATERIAL_EVENT_KEYS), occurredOn: isoDay, description: text(4000) })
const respondSchema = z.object({ response: text(4000) })
const resolveSchema = z.object({ decision: z.enum(EVENT_DECISIONS), note: text(2000, 3), scopeNote: z.string().trim().max(2000).optional() })
const contestSchema = z.object({ reason: text(2000, 3) })
const shortenSchema = z.object({ months: z.number().int().min(1).max(23), reason: text(1000, 3) })
const withdrawSchema = z.object({ reason: text(2000, 3) })

// funderReview: the caller is staff of the funding partner on a funder review. They see CIP progress only with the organisation's consent.
type Standing = { org: boolean; lead: boolean; member: boolean; funder: boolean; funderReview: boolean; programme: boolean }

async function standingFor(email: string, orgIdOfCaller: string, e: ValidationEngagementRow, members: EngagementMemberRow[], caller: Parameters<typeof canAccessOrg>[0]): Promise<Standing> {
  const named = members.find((m) => m.email === email && m.status === 'named')
  let funder = false
  if (e.funderFirmId) {
    const [m] = await db.select({ e: firmMembers.email }).from(firmMembers).where(and(eq(firmMembers.firmId, e.funderFirmId), eq(firmMembers.email, email), eq(firmMembers.status, 'active')))
    funder = !!m
  }
  return {
    org: orgIdOfCaller === e.orgId && (await canAccessOrg(caller, e.orgId, 'write')),
    lead: named?.role === 'lead', member: !!named, funder, funderReview: funder && e.type === 'funder_review', programme: await isProgrammeTeam(email),
  }
}

const live = (v: ValidationRow) => !TERMINAL_STATUSES.includes(v.status as ValidationStatus)

export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (caller.readOnly) return forbidden()
    const [id, sub, a, b] = new URL(req.url).pathname.replace(/^\/api\/validation-lifecycle\/?/, '').split('/').filter(Boolean)
    if (!id) return notFound()
    const readBody = async () => { try { return await req.json() } catch { return null } }
    const now = new Date()

    // The organisation's own list (for the CIP page).
    if (id === 'org' && sub && req.method === 'GET') {
      if (!(await canAccessOrg(caller, sub, 'read'))) return forbidden()
      const rows = await db.select().from(validations).where(eq(validations.orgId, sub)).orderBy(desc(validations.issuedAt))
      const out = []
      for (const v of rows) {
        const cur = await refreshValidation(v, now)
        const actions = await db.select().from(validationCipActions).where(eq(validationCipActions.validationId, v.id)).orderBy(asc(validationCipActions.createdAt))
        const cps = await db.select().from(validationCheckpoints).where(eq(validationCheckpoints.validationId, v.id)).orderBy(asc(validationCheckpoints.dueAt))
        out.push({ ...summary(cur), engagementId: cur.engagementId, actions: actions.map(actionView), checkpoints: cps.map(checkpointView) })
      }
      return json({ validations: out })
    }

    const [e] = await db.select().from(validationEngagements).where(eq(validationEngagements.id, id))
    if (!e) return notFound()
    const members = await db.select().from(engagementMembers).where(eq(engagementMembers.engagementId, id))
    const who = await standingFor(caller.email, caller.orgId, e, members, caller)
    if (!who.org && !who.member && !who.funder && !who.programme) return notFound()
    const found = await ensureValidation(id)
    if (!found) return notFound()
    let v = await refreshValidation(found, now)
    const fw = FRAMEWORKS[v.framework]
    const parties = await partiesOf(v)
    const act = (action: string, target = v.id) => audit(caller.email, action, target, v.orgId)

    if (req.method === 'GET' && !sub) return json(await view(v, who))

    // -- everything below writes ------------------------------------------------------
    if (req.method === 'PUT' && sub === 'consent' && !a) {
      if (!who.org) return forbidden()
      const p = consentSchema.safeParse(await readBody())
      if (!p.success) return bad('Say whether the engaging funder may see CIP progress')
      await db.update(validations).set({ funderCipConsent: p.data.funder, funderCipConsentBy: caller.email, funderCipConsentAt: now, updatedAt: now }).where(eq(validations.id, v.id))
      await act(p.data.funder ? 'allowed the engaging funder to see CIP progress' : 'withdrew the engaging funder\'s view of CIP progress')
      return json({ ok: true })
    }

    // Schedule: either side proposes, the other agrees.
    if (sub === 'schedule') {
      if (!who.org && !who.lead) return forbidden()
      if (!live(v) || v.outcome === 'not_validated') return conflict('This validation has no follow-up schedule to change')
      if (req.method === 'PUT' && !a) {
        const p = scheduleSchema.safeParse(await readBody())
        if (!p.success) return bad('Choose milestone, every 3 months, every 6 months, or end of plan')
        const asValidator = who.lead && !who.org
        const changed = p.data.kind !== v.followUpKind
        const [row] = await db.update(validations).set({
          followUpKind: p.data.kind,
          followUpValidatorOk: asValidator ? true : changed ? false : v.followUpValidatorOk,
          followUpOrgOk: asValidator ? (changed ? false : v.followUpOrgOk) : true,
          updatedAt: now,
        }).where(eq(validations.id, v.id)).returning()
        await syncCheckpoints(row, now)
        await act(`proposed follow-up schedule ${p.data.kind}`)
        return json({ ok: true, agreed: row.followUpOrgOk && row.followUpValidatorOk })
      }
      if (req.method === 'POST' && a === 'agree') {
        const [row] = await db.update(validations).set(who.org ? { followUpOrgOk: true, updatedAt: now } : { followUpValidatorOk: true, updatedAt: now }).where(eq(validations.id, v.id)).returning()
        await syncCheckpoints(row, now)
        await act(`agreed follow-up schedule ${row.followUpKind}`)
        return json({ ok: true, agreed: row.followUpOrgOk && row.followUpValidatorOk })
      }
    }

    // CIP actions: the organisation and the lead validator plan; only the organisation marks done.
    if (sub === 'cip') {
      if (!who.org && !(who.lead && !who.funderReview)) return forbidden()
      if (!live(v) || v.status === 'expired') return conflict('This validation is closed; its plan can no longer be changed')
      const inFw = new Set((fw?.indicators ?? []).map((i) => i.id))
      const validIds = (ids: string[]) => ids.every((x) => inFw.has(x))
      if (req.method === 'POST' && !a) {
        const p = actionSchema.safeParse(await readBody())
        if (!p.success) return bad('An action needs wording; owner and due date are dates in YYYY-MM-DD')
        if (!validIds(p.data.indicatorIds)) return bad('Unknown indicator')
        const aid = `cip_${crypto.randomUUID()}`
        await db.insert(validationCipActions).values({ id: aid, validationId: v.id, orgId: v.orgId, text: p.data.text, indicatorIds: [...new Set(p.data.indicatorIds)], owner: p.data.owner ?? null, dueDate: p.data.dueDate ?? null, createdBy: caller.email })
        await syncCheckpoints(v, now)
        await act('added a CIP action', aid)
        return json({ id: aid }, 201)
      }
      const [action] = a ? await db.select().from(validationCipActions).where(and(eq(validationCipActions.id, a), eq(validationCipActions.validationId, v.id))) : []
      if (a && !action) return notFound()
      if (req.method === 'PUT' && a && !b) {
        if (action.status === 'done') return conflict('A completed action cannot be edited')
        const p = actionPatchSchema.safeParse(await readBody())
        if (!p.success) return bad('Invalid change')
        if (p.data.indicatorIds && !validIds(p.data.indicatorIds)) return bad('Unknown indicator')
        await db.update(validationCipActions).set({
          ...(p.data.text !== undefined ? { text: p.data.text } : {}), ...(p.data.owner !== undefined ? { owner: p.data.owner } : {}),
          ...(p.data.dueDate !== undefined ? { dueDate: p.data.dueDate } : {}), ...(p.data.indicatorIds ? { indicatorIds: [...new Set(p.data.indicatorIds)] } : {}), updatedAt: now,
        }).where(eq(validationCipActions.id, a))
        await syncCheckpoints(v, now)
        await act('edited a CIP action', a)
        return json({ ok: true })
      }
      if (req.method === 'DELETE' && a && !b) {
        if (action.status === 'done') return conflict('A completed action cannot be removed')
        if (action.qualificationId) return conflict('An action that answers a qualification cannot be removed')
        await db.delete(validationCipActions).where(eq(validationCipActions.id, a))
        await syncCheckpoints(v, now)
        await act('removed a CIP action', a)
        return json({ ok: true })
      }
      if (req.method === 'POST' && a && b === 'done') {
        if (!who.org) return forbidden()
        if (action.status === 'done') return conflict('Already done')
        const p = doneSchema.safeParse(await readBody())
        if (!p.success) return bad('Proof of completion (an evidence reference) is required')
        if (!action.owner || !action.dueDate) return bad('Give the action an owner and a due date first')
        const updates = p.data.selfScores ?? {}
        if (Object.keys(updates).some((k) => !action.indicatorIds.includes(k))) return bad('Self-scores can only be updated for the indicators this action is linked to')
        await db.transaction(async (tx) => {
          await tx.update(validationCipActions).set({ status: 'done', proof: p.data.proof, doneAt: now, doneBy: caller.email, updatedAt: now }).where(eq(validationCipActions.id, a))
          if (fw && Object.keys(updates).length) {
            // Marking done with evidence updates the SELF-assessment. The frozen validation is untouched.
            const [row] = await tx.select().from(legacyWorkspaceState).where(and(eq(legacyWorkspaceState.orgId, v.orgId), eq(legacyWorkspaceState.key, fw.scoresKey)))
            let current: Record<string, number> = {}
            try { current = row ? cleanScores(JSON.parse(decryptField(row.value)), new Set(fw.indicators.map((i) => i.id))) : {} } catch { current = {} }
            const merged = { ...current, ...updates }
            await tx.insert(legacyWorkspaceState).values({ orgId: v.orgId, key: fw.scoresKey, value: encryptField(JSON.stringify(merged)), updatedAt: now })
              .onConflictDoUpdate({ target: [legacyWorkspaceState.orgId, legacyWorkspaceState.key], set: { value: encryptField(JSON.stringify(merged)), updatedAt: now } })
          }
        })
        await act(`marked CIP action done with evidence${Object.keys(updates).length ? ` and updated self-scores for ${Object.keys(updates).join(', ')}` : ''}`, a)
        await syncCheckpoints(v, now) // may bring the follow-up forward; can never extend validity
        return json({ ok: true })
      }
    }

    if (req.method === 'POST' && sub === 'checkpoints' && a && b === 'complete') {
      if (!who.lead) return forbidden()
      if (!live(v)) return conflict('This validation is closed')
      const p = completeSchema.safeParse(await readBody())
      if (!p.success) return bad('Choose confirmed or not confirmed')
      if (p.data.result === 'not_confirmed' && !p.data.note) return bad('Say what could not be confirmed')
      const [cp] = await db.select().from(validationCheckpoints).where(and(eq(validationCheckpoints.id, a), eq(validationCheckpoints.validationId, v.id)))
      if (!cp) return notFound()
      if (cp.state === 'done') return conflict('Already recorded')
      await db.update(validationCheckpoints).set({ state: 'done', result: p.data.result, note: p.data.note, doneAt: now, doneBy: caller.email }).where(eq(validationCheckpoints.id, cp.id))
      await act(`recorded ${cp.kind} check: ${p.data.result}`, cp.id)
      v = await refreshValidation(v, now)
      return json({ ok: true, status: v.status })
    }

    if (req.method === 'POST' && sub === 'events' && !a) {
      if (!who.org && !who.programme) return forbidden()
      if (!live(v) || v.expiresAt === null) return conflict('This validation is closed; there is nothing to suspend')
      const p = eventSchema.safeParse(await readBody())
      if (!p.success) return bad('Choose the event, the date it happened (YYYY-MM-DD) and describe it')
      const occurred = new Date(`${p.data.occurredOn}T00:00:00.000Z`)
      if (occurred.getTime() > now.getTime()) return bad('The event date cannot be in the future')
      const def = materialEvent(p.data.eventType)!
      const side = who.org ? 'organization' : 'programme_team'
      const due = reportingDeadline(p.data.eventType, occurred)!
      const late = side === 'organization' ? reportedLate(p.data.eventType, occurred, now) : false
      const eid = `mev_${crypto.randomUUID()}`
      await db.transaction(async (tx) => {
        await tx.insert(materialEvents).values({
          id: eid, validationId: v.id, orgId: v.orgId, eventType: p.data.eventType, starred: def.starred, description: p.data.description, occurredOn: p.data.occurredOn,
          reportedBy: caller.email, reportedBySide: side, reportedAt: now, reportDue: due.toISOString().slice(0, 10), late,
        })
        // Reporting sets "suspended pending review".
        if (v.status !== 'suspended') {
          await tx.update(validations).set({ status: 'suspended', statusChangedAt: now, updatedAt: now }).where(eq(validations.id, v.id))
          await recordStatus(tx as never, v, v.status, 'suspended', `Material event reported: ${def.label}`, caller.email)
        }
        await tx.insert(auditLogs).values({ actor: caller.email, action: `${side === 'organization' ? 'reported' : 'recorded'} a material event (${p.data.eventType}${def.starred ? ', starred' : ''}${late ? ', reported late' : ''})`, target: eid, category: 'Validation', orgId: v.orgId })
      })
      const subject = `CRAFT validation ${v.verificationId}: material event ${side === 'organization' ? 'reported' : 'recorded by the CRAFT programme team'}`
      const body = `${parties.orgName}: ${def.label}.\n\nThe validation is suspended pending the validator's review. Open it: ${new URL(req.url).origin}/engagements/${v.engagementId}/validity`
      await notify(parties.validator, subject, body, `mev-${eid}-validator`)
      if (side === 'programme_team') await notify(parties.org, subject, `${body}\n\nYou can respond to this event on the same page.`, `mev-${eid}-org`)
      return json({ id: eid, status: 'suspended', late }, 201)
    }

    if (sub === 'events' && a) {
      const [ev] = await db.select().from(materialEvents).where(and(eq(materialEvents.id, a), eq(materialEvents.validationId, v.id)))
      if (!ev) return notFound()
      if (req.method === 'POST' && b === 'respond') {
        if (!who.org) return forbidden()
        const p = respondSchema.safeParse(await readBody())
        if (!p.success) return bad('A response is required')
        await db.update(materialEvents).set({ orgResponse: p.data.response, orgRespondedBy: caller.email, orgRespondedAt: now }).where(eq(materialEvents.id, ev.id))
        await act('responded to a material event', ev.id)
        return json({ ok: true })
      }
      if (req.method === 'POST' && b === 'contest') {
        if (!who.org) return forbidden()
        if (ev.contestedAt) return conflict('Already contested')
        const p = contestSchema.safeParse(await readBody())
        if (!p.success) return bad('Say why you disagree')
        await db.update(materialEvents).set({ contestedAt: now, contestedBy: caller.email, contestReason: p.data.reason }).where(eq(materialEvents.id, ev.id))
        await act('contested a material event decision; referred to the Independent Review Panel', ev.id)
        return json({ ok: true, referredTo: 'review_panel' })
      }
      if (req.method === 'POST' && b === 'resolve') {
        if (!who.lead) return forbidden()
        if (ev.status !== 'pending_review') return conflict('Already decided')
        if (!live(v)) return conflict('This validation is closed')
        const p = resolveSchema.safeParse(await readBody())
        if (!p.success) return bad('Choose reinstate, re-scope or withdraw, and give your reasons')
        if (p.data.decision === 'rescope' && !p.data.scopeNote) return bad('Say how the scope is now limited')
        const others = await db.select({ id: materialEvents.id }).from(materialEvents).where(and(eq(materialEvents.validationId, v.id), eq(materialEvents.status, 'pending_review'), ne(materialEvents.id, ev.id)))
        const out = decideEvent(p.data.decision, others.length)
        await db.transaction(async (tx) => {
          await tx.update(materialEvents).set({ status: out.eventStatus, resolvedBy: caller.email, resolvedAt: now, resolutionNote: p.data.note }).where(eq(materialEvents.id, ev.id))
          if (out.withdraw) {
            if (others.length) await tx.update(materialEvents).set({ status: 'withdrawn', resolvedBy: caller.email, resolvedAt: now, resolutionNote: 'Validation withdrawn' }).where(inArray(materialEvents.id, others.map((x) => x.id)))
            await tx.update(validations).set({ status: 'withdrawn', withdrawnReason: p.data.note, statusChangedAt: now, updatedAt: now }).where(eq(validations.id, v.id))
            await recordStatus(tx as never, v, v.status, 'withdrawn', p.data.note, caller.email)
          } else {
            if (p.data.decision === 'rescope') {
              await tx.update(validations).set({ scopeNote: [v.scopeNote, p.data.scopeNote].filter(Boolean).join('\n'), updatedAt: now }).where(eq(validations.id, v.id))
            }
            if (!out.keepSuspended && v.status === 'suspended') {
              // Back to whatever the dates say (current, follow-up overdue or expired); never past expiry.
              const cps = await tx.select().from(validationCheckpoints).where(eq(validationCheckpoints.validationId, v.id))
              const next = deriveStatus({ status: 'current', now, expiresAt: v.expiresAt, checkpoints: cps.map((x) => ({ kind: x.kind as never, dueAt: x.dueAt, state: x.state as never })) })
              await tx.update(validations).set({ status: next.status, expiresAt: next.expiresAt, statusChangedAt: now, updatedAt: now }).where(eq(validations.id, v.id))
              await recordStatus(tx as never, v, 'suspended', next.status, `${p.data.decision === 'rescope' ? 'Re-scoped' : 'Reinstated'}: ${p.data.note}`, caller.email)
            }
          }
        })
        await act(`decided a material event: ${p.data.decision}`, ev.id)
        await notify(parties.org, `CRAFT validation ${v.verificationId}: decision on a material event`, `${parties.orgName}: the validator decided to ${p.data.decision === 'rescope' ? 're-scope' : p.data.decision} the validation.\n\nReasons: ${p.data.note}\n\nIf you disagree you can contest it: ${new URL(req.url).origin}/engagements/${v.engagementId}/validity`, `mev-${ev.id}-decision`)
        v = (await db.select().from(validations).where(eq(validations.id, v.id)))[0]
        return json({ ok: true, status: v.status })
      }
    }

    if (req.method === 'POST' && sub === 'shorten' && !a) {
      if (!who.lead) return forbidden()
      if (!live(v) || v.expiresAt === null) return conflict('This validation is closed')
      const p = shortenSchema.safeParse(await readBody())
      if (!p.success) return bad('Give a shorter period in months and name the risk')
      const next = shortenedExpiry(v.expiresAt, addMonths(v.issuedAt, p.data.months))
      if (!next) return bad('Validity can only be shortened, never extended')
      if (next.getTime() <= now.getTime()) return bad('That would end the validation now; withdraw it instead')
      await db.update(validations).set({ expiresAt: next, validityMonths: p.data.months, validityChoice: 'shorter', validityReason: p.data.reason, updatedAt: now }).where(eq(validations.id, v.id))
      await recordStatus(db, v, v.status, v.status, `Validity shortened to ${p.data.months} months: ${p.data.reason}`, caller.email)
      await syncCheckpoints({ ...v, expiresAt: next, validityMonths: p.data.months }, now)
      return json({ ok: true, expiresAt: next })
    }

    if (req.method === 'POST' && sub === 'withdraw' && !a) {
      if (!who.lead) return forbidden()
      if (!live(v)) return conflict('This validation is closed')
      const p = withdrawSchema.safeParse(await readBody())
      if (!p.success) return bad('A reason is required to withdraw a validation')
      await db.transaction(async (tx) => {
        await tx.update(validations).set({ status: 'withdrawn', withdrawnReason: p.data.reason, statusChangedAt: now, updatedAt: now }).where(eq(validations.id, v.id))
        await recordStatus(tx as never, v, v.status, 'withdrawn', p.data.reason, caller.email)
      })
      await notify(parties.org, `CRAFT validation ${v.verificationId} withdrawn`, `${parties.orgName}: the validator withdrew this validation.\n\nReason: ${p.data.reason}`, `withdraw-${v.id}`)
      return json({ ok: true, status: 'withdrawn' })
    }

    return notFound()
  } catch (err) {
    logger.error('/api/validation-lifecycle', 'failed', err)
    return json({ error: 'Validation lifecycle request failed' }, 500)
  }
}

const summary = (v: ValidationRow) => ({
  id: v.id, verificationId: v.verificationId, framework: v.framework, outcome: v.outcome, validatedRung: v.validatedRung, issuedAt: v.issuedAt, expiresAt: v.expiresAt,
  status: v.status, statusChangedAt: v.statusChangedAt, validityMonths: v.validityMonths, validityChoice: v.validityChoice, validityReason: v.validityReason, surveillance: v.surveillance,
  withdrawnReason: v.withdrawnReason, scopeNote: v.scopeNote,
  followUp: { kind: v.followUpKind as FollowUpKind, validatorOk: v.followUpValidatorOk, orgOk: v.followUpOrgOk, indicatorIds: v.followUpIndicators },
})
const actionView = (a: typeof validationCipActions.$inferSelect) => ({
  id: a.id, text: a.text, indicatorIds: a.indicatorIds, owner: a.owner, dueDate: a.dueDate, status: a.status, proof: a.proof, doneAt: a.doneAt, doneBy: a.doneBy, fromQualification: !!a.qualificationId,
})
const checkpointView = (c: typeof validationCheckpoints.$inferSelect) => ({
  id: c.id, kind: c.kind, dueAt: c.dueAt, state: c.state, result: c.result, note: c.note, doneAt: c.doneAt, indicatorIds: c.indicatorIds,
})
const eventView = (e: MaterialEventRow) => ({
  id: e.id, eventType: e.eventType, label: materialEvent(e.eventType)?.label ?? e.eventType, starred: e.starred, description: e.description, occurredOn: e.occurredOn,
  reportedBySide: e.reportedBySide, reportedAt: e.reportedAt, reportDue: e.reportDue, late: e.late, status: e.status, resolvedAt: e.resolvedAt, resolutionNote: e.resolutionNote,
  orgResponse: e.orgResponse, contestedAt: e.contestedAt, contestReason: e.contestReason,
})

async function view(v: ValidationRow, who: Standing) {
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, v.orgId))
  const limited = who.funderReview && !who.org
  const base = { ...summary(v), engagementId: v.engagementId, organization: org?.name ?? '', viewer: { org: who.org, lead: who.lead, funder: limited, programme: who.programme && !who.org && !who.member && !who.funder } }
  const history = await db.select().from(validationStatusHistory).where(eq(validationStatusHistory.validationId, v.id)).orderBy(asc(validationStatusHistory.createdAt))
  const cps = await db.select().from(validationCheckpoints).where(eq(validationCheckpoints.validationId, v.id)).orderBy(asc(validationCheckpoints.dueAt))
  const actions = await db.select().from(validationCipActions).where(eq(validationCipActions.validationId, v.id)).orderBy(asc(validationCipActions.createdAt))
  const nextDue = cps.filter((c) => c.state === 'pending').map((c) => c.dueAt)[0] ?? null
  const progress = { done: actions.filter((x) => x.status === 'done').length, total: actions.length, nextDue, sentence: progressSentence(actions.filter((x) => x.status === 'done').length, actions.length, nextDue) }
  const events = await db.select().from(materialEvents).where(eq(materialEvents.validationId, v.id)).orderBy(desc(materialEvents.reportedAt))
  // The engaging funder sees status, validity, the schedule and (only with the organisation's consent) CIP progress.
  // A funder reviewer who leads the review also sees material events, because they decide them.
  if (limited) {
    return { ...base, funderConsent: v.funderCipConsent, history, checkpoints: cps.map(checkpointView), events: who.lead ? events.map(eventView) : [], cip: v.funderCipConsent ? { progress } : null }
  }
  // The CRAFT programme team sees status, history and events, not the organisation's plan.
  if (who.programme && !who.org && !who.member) return { ...base, history, checkpoints: cps.map(checkpointView), events: events.map(eventView) }
  return {
    ...base, funderConsent: v.funderCipConsent, history, checkpoints: cps.map(checkpointView), actions: actions.map(actionView), progress,
    events: events.map(eventView),
  }
}

export const config: Config = { path: ['/api/validation-lifecycle', '/api/validation-lifecycle/*'] }
