import type { Config } from '@netlify/functions'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  auditLogs, engagementMembers, organizations, validationEvents, validationFollowUps, validations, type EngagementMemberRow, type ValidationRow,
} from '../../db/schema.js'
import { canAccessOrg, forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { contactsFor, describeValidation, notify } from '../lib/validation-lifecycle.js'
import { logger } from '../lib/logger.js'
import {
  EVENT_DECISIONS, FOLLOW_UP_MODES, isStarred, MATERIAL_EVENTS, MATERIAL_EVENT_KEYS, reportingDeadline, statusAfterDecision, MS_DAY, STATUS_LABEL,
} from '../../src/lib/validationLifecycle.js'
import { FRAMEWORKS } from '../../src/lib/validationReview.js'

// /api/validations — the issued validation's lifecycle (validator system PR 5).
//
//   GET    /                          validations the caller is party to
//   GET    /:id                       detail: status, validity, follow-ups, material events, history
//   PUT    /:id/schedule              organisation staff or the lead: follow-up schedule (the other side is told)
//   POST   /:id/follow-ups            lead: record the follow-up due now (re-checks the tracked indicators only)
//   POST   /:id/surveillance          lead: record the 12-month surveillance check of a 24-month validation
//   PUT    /:id/shorten               lead: shorten the validity for a named risk (never longer)
//   POST   /:id/withdraw              lead: withdraw with a reason
//   POST   /:id/events                organisation staff (or the CRAFT programme team): report a material event => suspended pending review
//   PUT    /:id/events/:eid/respond   organisation staff: respond to a recorded event
//   POST   /:id/events/:eid/decision  lead: reinstate, re-scope or withdraw
//
// Status is never trusted from the client: 'follow-up overdue' and 'expired' follow the calendar
// (src/lib/validationLifecycle.ts); suspended / withdrawn / superseded are recorded decisions.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string) => json({ error }, 400)
const notFound = () => json({ error: 'Not found' }, 404)
const conflict = (error: string) => json({ error }, 409)
const audit = (actor: string, action: string, target: string, orgId: string) =>
  db.insert(auditLogs).values({ actor, action, target, category: 'Validation', orgId })

const scheduleSchema = z.object({ mode: z.enum(FOLLOW_UP_MODES) })
const followUpSchema = z.object({ result: z.enum(['confirmed', 'concerns']), note: z.string().trim().max(4000).optional() })
const shortenSchema = z.object({ expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().trim().min(1).max(1000) })
const reasonSchema = z.object({ reason: z.string().trim().min(1).max(1000) })
const eventSchema = z.object({
  eventKey: z.enum(MATERIAL_EVENT_KEYS), occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), details: z.string().trim().max(4000).optional(),
})
const respondSchema = z.object({ response: z.string().trim().min(1).max(4000) })
const decisionSchema = z.object({ decision: z.enum(EVENT_DECISIONS), note: z.string().trim().min(1).max(2000) })

type Ctx = { v: ValidationRow; members: EngagementMemberRow[]; org: boolean; lead: boolean; member: boolean; admin: boolean }

export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (caller.readOnly) return forbidden()
    const url = new URL(req.url)
    const [id, sub, eid, act] = url.pathname.replace(/^\/api\/validations\/?/, '').split('/').filter(Boolean)
    const readBody = async () => { try { return await req.json() } catch { return null } }
    const admin = isSuperAdmin(caller.email)

    const context = async (v: ValidationRow): Promise<Ctx | null> => {
      const members = await db.select().from(engagementMembers).where(eq(engagementMembers.engagementId, v.engagementId))
      const mine = members.find((m) => m.email === caller.email && m.status === 'named')
      const org = caller.orgId === v.orgId && (await canAccessOrg(caller, v.orgId, 'write'))
      const ctx = { v, members, org, lead: mine?.role === 'lead', member: !!mine, admin }
      return org || mine || admin ? ctx : null
    }

    if (!id) {
      if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })
      const mineRows = await db.select({ e: engagementMembers.engagementId }).from(engagementMembers)
        .where(and(eq(engagementMembers.email, caller.email), eq(engagementMembers.status, 'named')))
      const rows = (await db.select().from(validations).orderBy(desc(validations.issuedAt)))
        .filter((v) => v.orgId === caller.orgId || mineRows.some((m) => m.e === v.engagementId) || admin)
      const out = []
      for (const v of rows) {
        const ctx = await context(v)
        if (ctx) out.push(await summary(ctx))
      }
      return json(out)
    }

    const [v] = await db.select().from(validations).where(eq(validations.id, id))
    if (!v) return notFound()
    const ctx = await context(v)
    // Other organisations' validations are invisible, not merely forbidden.
    if (!ctx) return notFound()
    const now = new Date()

    if (req.method === 'GET' && !sub) return json(await detail(ctx))

    const live = v.status === 'current' || v.status === 'suspended'

    if (req.method === 'PUT' && sub === 'schedule' && !eid) {
      if (!(ctx.org || ctx.lead)) return forbidden()
      if (!live) return conflict('This validation is closed')
      const p = scheduleSchema.safeParse(await readBody())
      if (!p.success) return bad('Choose a follow-up schedule')
      await db.update(validations).set({ followUpMode: p.data.mode, followUpSetBy: caller.email, followUpSetAt: now }).where(eq(validations.id, id))
      await audit(caller.email, `set follow-up schedule: ${p.data.mode}`, id, v.orgId)
      const c = await contactsFor(v)
      await notify(ctx.org ? c.validator : c.org, 'CRAFT validation: follow-up schedule changed', `The follow-up schedule of a validation was set to "${p.data.mode}". Sign in to CRAFT to review it.`)
      return json(await detail(ctx))
    }

    // Everything below changes a live validation.
    if (req.method === 'POST' && sub === 'follow-ups' && !eid) {
      if (!ctx.lead) return forbidden()
      const d = await describeValidation(v, now)
      if (d.status !== 'current' && d.status !== 'follow_up_overdue') return conflict('This validation is not open to follow-up')
      if (!d.followUp.dueOn) return conflict('No follow-up is due')
      const p = followUpSchema.safeParse(await readBody())
      if (!p.success) return bad('A result is required')
      const added = await db.insert(validationFollowUps).values({ id: `fu_${crypto.randomUUID()}`, validationId: id, dueOn: d.followUp.dueOn, result: p.data.result, note: p.data.note ?? '', completedBy: caller.email })
        .onConflictDoNothing().returning({ id: validationFollowUps.id })
      if (!added.length) return conflict('This follow-up is already recorded')
      await audit(caller.email, `recorded follow-up due ${d.followUp.dueOn}: ${p.data.result}`, id, v.orgId)
      if (p.data.result === 'concerns') await notify((await contactsFor(v)).org, 'CRAFT validation: follow-up raised concerns', 'The validator recorded concerns at a follow-up check. Sign in to CRAFT to see the validation.')
      return json(await detail(ctx))
    }

    if (req.method === 'POST' && sub === 'surveillance' && !eid) {
      if (!ctx.lead) return forbidden()
      const d = await describeValidation(v, now)
      if (!v.surveillanceDueAt || v.surveillanceDoneAt) return conflict('No surveillance check is due')
      if (d.status === 'expired' || !live) return conflict('This validation is closed')
      await db.update(validations).set({ surveillanceDoneAt: now }).where(eq(validations.id, id))
      await audit(caller.email, 'recorded the surveillance check', id, v.orgId)
      return json(await detail(ctx))
    }

    if (req.method === 'PUT' && sub === 'shorten' && !eid) {
      if (!ctx.lead) return forbidden()
      if (!live) return conflict('This validation is closed')
      const p = shortenSchema.safeParse(await readBody())
      if (!p.success) return bad('A new end date and the named risk are required')
      const to = new Date(`${p.data.expiresOn}T00:00:00Z`)
      if (!(to.getTime() > now.getTime())) return bad('The new end date must be in the future')
      if (to.getTime() >= v.expiresAt.getTime()) return bad('A validity period can only be shortened')
      await db.update(validations).set({
        expiresAt: to, validityReason: p.data.reason,
        surveillanceDueAt: v.surveillanceDueAt && v.surveillanceDueAt.getTime() >= to.getTime() ? null : v.surveillanceDueAt,
      }).where(eq(validations.id, id))
      await audit(caller.email, `shortened validity to ${p.data.expiresOn} (${p.data.reason})`, id, v.orgId)
      await notify((await contactsFor(v)).org, 'CRAFT validation: validity shortened', `The validator shortened the validity of your validation to ${p.data.expiresOn}. Reason: ${p.data.reason}`)
      return json(await detail(ctx))
    }

    if (req.method === 'POST' && sub === 'withdraw' && !eid) {
      if (!ctx.lead) return forbidden()
      if (!live) return conflict('This validation is closed')
      const p = reasonSchema.safeParse(await readBody())
      if (!p.success) return bad('A reason is required')
      await setStatus(id, 'withdrawn', p.data.reason, caller.email, now)
      await audit(caller.email, `withdrew the validation (${p.data.reason})`, id, v.orgId)
      await notify((await contactsFor(v)).org, 'CRAFT validation: withdrawn', `Your validation was withdrawn by the validator. Reason: ${p.data.reason}`)
      return json(await detail(ctx))
    }

    if (sub === 'events') {
      if (req.method === 'POST' && !eid) {
        if (!(ctx.org || ctx.admin)) return forbidden()
        if (!live) return conflict('This validation is closed')
        const p = eventSchema.safeParse(await readBody())
        if (!p.success) return bad('Choose the event and say when it happened (YYYY-MM-DD)')
        const occurred = new Date(`${p.data.occurredOn}T00:00:00Z`)
        if (occurred.getTime() > now.getTime() + MS_DAY) return bad('The event cannot be in the future')
        const star = isStarred(p.data.eventKey)
        const deadline = reportingDeadline(occurred, star)
        const side = ctx.org ? 'organization' : 'programme'
        const late = now.getTime() > deadline.getTime() + MS_DAY
        const evId = `evt_${crypto.randomUUID()}`
        await db.insert(validationEvents).values({
          id: evId, validationId: id, eventKey: p.data.eventKey, details: p.data.details ?? '', occurredOn: p.data.occurredOn, reportedBy: caller.email,
          reportedBySide: side, deadlineOn: deadline.toISOString().slice(0, 10), late,
        })
        // Reporting suspends the validation pending the validator's review.
        if (v.status === 'current') await setStatus(id, 'suspended', `Material event reported: ${MATERIAL_EVENTS.find((e) => e.key === p.data.eventKey)!.label}`, caller.email, now)
        await audit(caller.email, `${side === 'programme' ? 'programme team recorded' : 'reported'} material event ${p.data.eventKey}${late ? ' (late)' : ''}; validation suspended pending review`, evId, v.orgId)
        const c = await contactsFor(v)
        const label = MATERIAL_EVENTS.find((e) => e.key === p.data.eventKey)!.label
        await notify(side === 'organization' ? c.validator : [...c.org, ...c.validator], 'CRAFT validation suspended pending review', `A material event was ${side === 'programme' ? 'recorded by the CRAFT programme team' : 'reported by the organisation'}: ${label}. The validation is suspended pending the validator's review.${side === 'programme' ? ' The organisation can respond in CRAFT.' : ''}`)
        return json(await detail(ctx), 201)
      }
      if (req.method === 'PUT' && eid && act === 'respond') {
        if (!ctx.org) return forbidden()
        const p = respondSchema.safeParse(await readBody())
        if (!p.success) return bad('A response is required')
        const done = await db.update(validationEvents).set({ orgResponse: p.data.response, orgRespondedAt: now })
          .where(and(eq(validationEvents.id, eid), eq(validationEvents.validationId, id))).returning({ id: validationEvents.id })
        if (!done.length) return notFound()
        await audit(caller.email, 'responded to a material event', eid, v.orgId)
        await notify((await contactsFor(v)).validator, 'CRAFT validation: the organisation responded', 'The organisation responded to a recorded material event. Sign in to CRAFT to review it.')
        return json(await detail(ctx))
      }
      if (req.method === 'POST' && eid && act === 'decision') {
        if (!ctx.lead) return forbidden()
        const p = decisionSchema.safeParse(await readBody())
        if (!p.success) return bad('A decision (reinstate, re-scope or withdraw) and a note are required')
        const open = await db.select().from(validationEvents).where(and(eq(validationEvents.validationId, id), eq(validationEvents.status, 'open')))
        const target = open.find((e) => e.id === eid)
        if (!target) return conflict('That event is not open')
        const evStatus = p.data.decision === 'reinstate' ? 'reinstated' : p.data.decision === 're_scope' ? 're_scoped' : 'withdrawn'
        await db.update(validationEvents).set({ status: evStatus, decidedBy: caller.email, decidedAt: now, decisionNote: p.data.note }).where(eq(validationEvents.id, eid))
        const next = statusAfterDecision(p.data.decision, open.length - 1)
        if (v.status === 'suspended' || next === 'withdrawn') await setStatus(id, next, p.data.note, caller.email, now)
        await audit(caller.email, `decided on material event: ${p.data.decision} (${p.data.note})`, eid, v.orgId)
        await notify((await contactsFor(v)).org, 'CRAFT validation: decision on the reported event', `The validator decided to ${p.data.decision.replace('_', '-')} the validation. Note: ${p.data.note}`)
        return json(await detail(ctx))
      }
    }

    return notFound()
  } catch (err) {
    logger.error('/api/validations', 'failed', err)
    return json({ error: 'Validation request failed' }, 500)
  }
}

async function setStatus(id: string, status: 'current' | 'suspended' | 'withdrawn', reason: string, by: string, now: Date) {
  await db.update(validations).set({ status, statusReason: status === 'current' ? null : reason, statusChangedAt: now, statusChangedBy: by }).where(eq(validations.id, id))
}

// Always built from the current row: callers update first, then respond.
const fresh = async (ctx: Ctx): Promise<ValidationRow> => (await db.select().from(validations).where(eq(validations.id, ctx.v.id)))[0] ?? ctx.v

async function summary(ctx: Ctx) {
  const v = await fresh(ctx)
  const [d, [org]] = await Promise.all([describeValidation(v), db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, v.orgId))])
  return {
    id: v.id, organization: org?.name ?? '', framework: FRAMEWORKS[v.framework]?.name ?? v.framework, outcome: v.outcome, validatedRung: v.validatedRung,
    status: d.status, statusLabel: STATUS_LABEL[d.status], issuedAt: v.issuedAt, expiresAt: d.expiresAt, nextFollowUp: d.followUp.dueOn,
    can: { org: ctx.org, lead: ctx.lead },
  }
}

async function detail(ctx: Ctx) {
  const v = await fresh(ctx)
  const [d, events, history] = await Promise.all([
    describeValidation(v),
    db.select().from(validationEvents).where(eq(validationEvents.validationId, v.id)),
    db.select({ at: auditLogs.createdAt, action: auditLogs.action }).from(auditLogs)
      .where(and(eq(auditLogs.category, 'Validation'), inArray(auditLogs.target, [v.id, ...(await db.select({ id: validationEvents.id }).from(validationEvents).where(eq(validationEvents.validationId, v.id))).map((e) => e.id)]))),
  ])
  return {
    ...(await summary(ctx)),
    validityMonths: v.validityMonths, validityReason: v.validityReason, statusReason: v.statusReason,
    surveillance: v.surveillanceDueAt ? { dueAt: v.surveillanceDueAt, doneAt: v.surveillanceDoneAt } : null,
    followUp: { mode: v.followUpMode, ...d.followUp, history: d.completedFollowUps, tracked: v.trackedIndicators },
    events: events.sort((a, b) => +b.reportedAt - +a.reportedAt).map((e) => ({
      id: e.id, key: e.eventKey, label: MATERIAL_EVENTS.find((m) => m.key === e.eventKey)?.label ?? e.eventKey, starred: isStarred(e.eventKey), details: e.details,
      occurredOn: e.occurredOn, reportedAt: e.reportedAt, reportedBySide: e.reportedBySide, deadlineOn: e.deadlineOn, late: e.late, status: e.status,
      orgResponse: e.orgResponse, decisionNote: e.decisionNote,
    })),
    history: history.sort((a, b) => +new Date(a.at ?? 0) - +new Date(b.at ?? 0)),
    eventTypes: MATERIAL_EVENTS,
    canReport: ctx.org || ctx.admin,
  }
}

export const config: Config = { path: ['/api/validations', '/api/validations/*'] }
