import type { Config } from '@netlify/functions'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  auditLogs, engagementMembers, firmMembers, firms, organizations, validationCheckpoints, validationCipActions, validationConcerns, validationEvents, validationFunderConsents,
  validations, type EngagementMemberRow, type ValidationRow,
} from '../../db/schema.js'
import { canAccessOrg, forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { contactsFor, describeValidation, notify, recordStatusHistory, statusHistory, syncCheckpoints } from '../lib/validation-lifecycle.js'
import { ensureStatement, ensureVerificationId, publicUrlFor } from '../lib/public-validation.js'
import { cleanPublicOptions } from '../../src/lib/validationStatement.js'
import { logger } from '../lib/logger.js'
import {
  cipActionProblems, cipDoneProblems, cipProgress, EVENT_DECISIONS, FOLLOW_UP_MODES, isStarred, MATERIAL_EVENTS, MATERIAL_EVENT_KEYS, progressLine, reportingDeadline,
  statusAfterDecision, MS_DAY, STATUS_LABEL,
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
//   PUT    /:id/public                organisation staff: what the public page shows beyond the mandatory facts
//   GET    /concerns                  platform admin: concerns raised from public pages (PUT /concerns/:cid {status})
//   GET    /cip                       organisation staff: this organisation's validations with their CIP actions
//   POST   /:id/cip-actions           organisation staff: add an improvement action {text, indicatorIds, owner?, dueDate?}
//   PUT    /:id/cip-actions/:aid      organisation staff: edit an open action
//   POST   /:id/cip-actions/:aid/done organisation staff: mark done (needs owner, due date and proof)
//   POST   /:id/cip-actions/:aid/reopen   organisation staff: reopen a done action
//   DELETE /:id/cip-actions/:aid      organisation staff: remove a manually added action
//   PUT    /:id/funder-consent        organisation staff: let a funding partner see schedule and progress, or withdraw that
//   GET    /funder                    funding-partner staff: progress of validations whose organisation consented
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
const cipCreateSchema = z.object({
  text: z.string().trim().min(1).max(1000), indicatorIds: z.array(z.string().max(40)).min(1).max(30),
  owner: z.string().trim().max(200).nullish(), dueDate: z.string().nullish(),
})
const cipEditSchema = z.object({
  text: z.string().trim().min(1).max(1000).optional(), indicatorIds: z.array(z.string().max(40)).min(1).max(30).optional(),
  owner: z.string().trim().max(200).nullish(), dueDate: z.string().nullish(),
})
const cipDoneSchema = z.object({ proof: z.string().trim().min(1).max(2000), owner: z.string().trim().max(200).optional(), dueDate: z.string().optional() })
const consentSchema = z.object({ funderFirmId: z.string().min(1).max(200), granted: z.boolean() })
const decisionSchema = z.object({ decision: z.enum(EVENT_DECISIONS), note: z.string().trim().min(1).max(2000) })

type Ctx = { v: ValidationRow; members: EngagementMemberRow[]; org: boolean; lead: boolean; member: boolean; admin: boolean; funder: boolean }

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
      // A funding partner sees only progress, and only while the organisation's consent for its firm stands.
      const funder = (await funderFirmIds(v.id, caller.email)).length > 0
      const ctx = { v, members, org, lead: mine?.role === 'lead', member: !!mine, admin, funder }
      return org || mine || admin || funder ? ctx : null
    }

    /** Validations a signed-in funding-partner member may follow. */
    const funderValidations = async (): Promise<ValidationRow[]> => {
      const firmsOf = await myFunderFirms(caller.email)
      if (!firmsOf.length) return []
      const consents = await db.select().from(validationFunderConsents).where(and(inArray(validationFunderConsents.funderFirmId, firmsOf), isNull(validationFunderConsents.revokedAt)))
      return consents.length ? db.select().from(validations).where(inArray(validations.id, consents.map((c) => c.validationId))) : []
    }

    if (id === 'concerns') {
      if (!admin) return forbidden()
      if (req.method === 'GET' && !sub) {
        const rows = await db.select({ c: validationConcerns, vid: validations.verificationId, org: organizations.name }).from(validationConcerns)
          .innerJoin(validations, eq(validations.id, validationConcerns.validationId)).innerJoin(organizations, eq(organizations.id, validations.orgId)).orderBy(desc(validationConcerns.createdAt))
        return json(rows.map(({ c, vid, org }) => ({ id: c.id, verificationId: vid, organization: org, category: c.category, message: c.message, contactName: c.contactName, contactEmail: c.contactEmail, status: c.status, createdAt: c.createdAt })))
      }
      if (req.method === 'PUT' && sub) {
        const p = z.object({ status: z.enum(['new', 'in_review', 'closed']) }).safeParse(await readBody())
        if (!p.success) return bad('A status is required')
        const done = await db.update(validationConcerns).set({ status: p.data.status, handledBy: caller.email, handledAt: new Date() }).where(eq(validationConcerns.id, sub)).returning({ id: validationConcerns.id })
        return done.length ? json({ ok: true }) : notFound()
      }
      return notFound()
    }

    if (id === 'cip') {
      if (req.method !== 'GET') return notFound()
      if (caller.orgId === '' || !(await canAccessOrg(caller, caller.orgId, 'read'))) return forbidden()
      const mine = await db.select().from(validations).where(eq(validations.orgId, caller.orgId)).orderBy(desc(validations.issuedAt))
      const canEdit = await canAccessOrg(caller, caller.orgId, 'write')
      const out = []
      for (const row of mine) out.push({ ...(await cipView(row)), canEdit })
      return json(out)
    }

    if (id === 'funder') {
      if (req.method !== 'GET') return notFound()
      const out = []
      for (const row of await funderValidations()) out.push(await funderView(row))
      return json(out)
    }

    if (!id) {
      if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })
      const funded = await funderValidations()
      const mineRows = await db.select({ e: engagementMembers.engagementId }).from(engagementMembers)
        .where(and(eq(engagementMembers.email, caller.email), eq(engagementMembers.status, 'named')))
      const rows = (await db.select().from(validations).orderBy(desc(validations.issuedAt)))
        .filter((v) => v.orgId === caller.orgId || mineRows.some((m) => m.e === v.engagementId) || admin || funded.some((f) => f.id === v.id))
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

    // A funding partner (and nobody else on this validation) gets the reduced progress view only.
    if (ctx.funder && !ctx.org && !ctx.member && !ctx.admin) {
      return req.method === 'GET' && !sub ? json(await funderView(v)) : forbidden()
    }

    if (req.method === 'GET' && !sub) return json(await detail(ctx))

    const live = v.status === 'current' || v.status === 'suspended'
    const editable = v.status !== 'withdrawn' && v.status !== 'superseded'

    if (sub === 'cip-actions') {
      if (!ctx.org) return forbidden()
      if (!editable) return conflict('This validation is closed')
      const known = new Set((FRAMEWORKS[v.framework]?.indicators ?? []).map((i) => i.id))
      if (req.method === 'POST' && !eid) {
        const p = cipCreateSchema.safeParse(await readBody())
        if (!p.success) return bad('Say what will be done and link it to at least one indicator')
        if (p.data.indicatorIds.some((x) => !known.has(x))) return bad('Link only indicators of this framework')
        const problems = cipActionProblems({ text: p.data.text, indicatorIds: p.data.indicatorIds, owner: p.data.owner, dueDate: p.data.dueDate })
        if (problems.length) return json({ error: problems[0], problems }, 400)
        const aid = `cip_${crypto.randomUUID()}`
        await db.insert(validationCipActions).values({
          id: aid, validationId: id, orgId: v.orgId, text: p.data.text, indicatorIds: [...new Set(p.data.indicatorIds)], owner: p.data.owner || null, dueDate: p.data.dueDate || null, createdBy: caller.email,
        })
        await audit(caller.email, `added improvement action: ${p.data.text.slice(0, 120)}`, aid, v.orgId)
        await syncCheckpoints(v)
        return json(await detail(ctx), 201)
      }
      if (eid) {
        const [action] = await db.select().from(validationCipActions).where(and(eq(validationCipActions.id, eid), eq(validationCipActions.validationId, id)))
        if (!action) return notFound()
        if (req.method === 'PUT' && !act) {
          if (action.status === 'done') return conflict('Reopen the action before changing it')
          const p = cipEditSchema.safeParse(await readBody())
          if (!p.success) return bad('Invalid action')
          const next = { text: p.data.text ?? action.text, indicatorIds: p.data.indicatorIds ?? action.indicatorIds, owner: p.data.owner === undefined ? action.owner : p.data.owner || null, dueDate: p.data.dueDate === undefined ? action.dueDate : p.data.dueDate || null }
          if (next.indicatorIds.some((x) => !known.has(x))) return bad('Link only indicators of this framework')
          const problems = cipActionProblems(next)
          if (problems.length) return json({ error: problems[0], problems }, 400)
          await db.update(validationCipActions).set({ ...next, indicatorIds: [...new Set(next.indicatorIds)], updatedAt: now }).where(eq(validationCipActions.id, eid))
          await audit(caller.email, `edited improvement action (owner ${next.owner ?? 'none'}, due ${next.dueDate ?? 'none'})`, eid, v.orgId)
          await syncCheckpoints(v)
          return json(await detail(ctx))
        }
        if (req.method === 'POST' && act === 'done') {
          const p = cipDoneSchema.safeParse(await readBody())
          if (!p.success) return bad('Add proof that the action was done')
          const owner = p.data.owner?.trim() || action.owner
          const dueDate = p.data.dueDate || action.dueDate
          const problems = cipDoneProblems({ owner, dueDate, proof: p.data.proof })
          if (problems.length) return json({ error: problems[0], problems }, 400)
          // Atomic: only an open action can be marked done, once.
          const done = await db.update(validationCipActions).set({ status: 'done', owner, dueDate, proof: p.data.proof, doneAt: now, doneBy: caller.email, updatedAt: now })
            .where(and(eq(validationCipActions.id, eid), eq(validationCipActions.status, 'open'))).returning({ id: validationCipActions.id })
          if (!done.length) return conflict('This action is already done')
          await audit(caller.email, `marked improvement action done with proof: ${p.data.proof.slice(0, 160)}`, eid, v.orgId)
          await syncCheckpoints(v)
          return json({ ...(await detail(ctx)), reassess: action.indicatorIds })
        }
        if (req.method === 'POST' && act === 'reopen') {
          const reopened = await db.update(validationCipActions).set({ status: 'open', proof: '', doneAt: null, doneBy: null, updatedAt: now })
            .where(and(eq(validationCipActions.id, eid), eq(validationCipActions.status, 'done'))).returning({ id: validationCipActions.id })
          if (!reopened.length) return conflict('This action is not done')
          await audit(caller.email, `reopened improvement action (earlier proof: ${action.proof.slice(0, 160)})`, eid, v.orgId)
          await syncCheckpoints(v)
          return json(await detail(ctx))
        }
        if (req.method === 'DELETE' && !act) {
          if (action.qualificationId) return conflict('This action answers a qualification, so it cannot be removed')
          await db.delete(validationCipActions).where(eq(validationCipActions.id, eid))
          await audit(caller.email, `removed improvement action: ${action.text.slice(0, 120)}`, eid, v.orgId)
          await syncCheckpoints(v)
          return json(await detail(ctx))
        }
      }
      return notFound()
    }

    if (req.method === 'PUT' && sub === 'funder-consent' && !eid) {
      if (!ctx.org) return forbidden()
      const p = consentSchema.safeParse(await readBody())
      if (!p.success) return bad('Choose a funding partner')
      const [firm] = await db.select({ id: firms.id, name: firms.name }).from(firms).where(and(eq(firms.id, p.data.funderFirmId), eq(firms.kind, 'funding_partner')))
      if (!firm) return bad('Funding partner not found')
      const [existing] = await db.select().from(validationFunderConsents).where(and(eq(validationFunderConsents.validationId, id), eq(validationFunderConsents.funderFirmId, firm.id)))
      if (p.data.granted) {
        if (existing && !existing.revokedAt) return json(await detail(ctx))
        if (existing) await db.update(validationFunderConsents).set({ revokedAt: null, revokedBy: null, grantedBy: caller.email, grantedAt: now }).where(eq(validationFunderConsents.id, existing.id))
        else await db.insert(validationFunderConsents).values({ id: `vfc_${crypto.randomUUID()}`, validationId: id, funderFirmId: firm.id, grantedBy: caller.email })
        await audit(caller.email, `consented to ${firm.name} seeing the validation's schedule and progress`, id, v.orgId)
      } else {
        if (!existing || existing.revokedAt) return json(await detail(ctx))
        await db.update(validationFunderConsents).set({ revokedAt: now, revokedBy: caller.email }).where(eq(validationFunderConsents.id, existing.id))
        await audit(caller.email, `withdrew ${firm.name}'s access to the validation's schedule and progress`, id, v.orgId)
      }
      return json(await detail(ctx))
    }

    if (req.method === 'PUT' && sub === 'public' && !eid) {
      if (!ctx.org) return forbidden()
      const options = cleanPublicOptions(await readBody())
      await db.update(validations).set({ publicOptions: options }).where(eq(validations.id, id))
      await audit(caller.email, `set public page options: ${Object.keys(options).join(', ') || 'none'}`, id, v.orgId)
      return json(await detail(ctx))
    }

    if (req.method === 'PUT' && sub === 'schedule' && !eid) {
      if (!(ctx.org || ctx.lead)) return forbidden()
      if (!live) return conflict('This validation is closed')
      const p = scheduleSchema.safeParse(await readBody())
      if (!p.success) return bad('Choose a follow-up schedule')
      await db.update(validations).set({ followUpMode: p.data.mode, followUpSetBy: caller.email, followUpSetAt: now }).where(eq(validations.id, id))
      await audit(caller.email, `set follow-up schedule: ${p.data.mode}`, id, v.orgId)
      await syncCheckpoints({ ...v, followUpMode: p.data.mode })
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
      // The pending checkpoint at this date becomes done; if the schedule had not materialised it yet, record it directly.
      const dueOn = d.followUp.dueOn
      const marked = await db.update(validationCheckpoints).set({ state: 'done', result: p.data.result, note: p.data.note ?? '', doneAt: now, doneBy: caller.email })
        .where(and(eq(validationCheckpoints.validationId, id), eq(validationCheckpoints.kind, 'follow_up'), eq(validationCheckpoints.dueOn, dueOn), eq(validationCheckpoints.state, 'pending')))
        .returning({ id: validationCheckpoints.id })
      if (!marked.length) {
        const added = await db.insert(validationCheckpoints).values({ id: `cp_${crypto.randomUUID()}`, validationId: id, kind: 'follow_up', dueOn, indicatorIds: v.trackedIndicators, state: 'done', result: p.data.result, note: p.data.note ?? '', doneAt: now, doneBy: caller.email })
          .onConflictDoNothing().returning({ id: validationCheckpoints.id })
        if (!added.length) return conflict('This follow-up is already recorded')
      }
      await syncCheckpoints(v)
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
      await db.update(validationCheckpoints).set({ state: 'done', result: 'confirmed', doneAt: now, doneBy: caller.email })
        .where(and(eq(validationCheckpoints.validationId, id), eq(validationCheckpoints.kind, 'surveillance'), eq(validationCheckpoints.state, 'pending')))
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
      if (v.surveillanceDueAt && v.surveillanceDueAt.getTime() >= to.getTime()) {
        await db.delete(validationCheckpoints).where(and(eq(validationCheckpoints.validationId, id), eq(validationCheckpoints.kind, 'surveillance'), eq(validationCheckpoints.state, 'pending')))
      }
      await syncCheckpoints((await fresh(ctx)))
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
  const [before] = await db.select({ status: validations.status }).from(validations).where(eq(validations.id, id))
  await db.update(validations).set({ status, statusReason: status === 'current' ? null : reason, statusChangedAt: now, statusChangedBy: by }).where(eq(validations.id, id))
  await recordStatusHistory(db, id, before?.status ?? null, status, reason, by, now)
}

async function myFunderFirms(email: string): Promise<string[]> {
  const rows = await db.select({ id: firms.id }).from(firmMembers).innerJoin(firms, eq(firms.id, firmMembers.firmId))
    .where(and(eq(firmMembers.email, email), eq(firmMembers.status, 'active'), eq(firms.kind, 'funding_partner')))
  return rows.map((r) => r.id)
}

/** The caller's funding-partner firms that hold a standing consent for this validation. */
async function funderFirmIds(validationId: string, email: string): Promise<string[]> {
  const mine = await myFunderFirms(email)
  if (!mine.length) return []
  const consents = await db.select().from(validationFunderConsents)
    .where(and(eq(validationFunderConsents.validationId, validationId), inArray(validationFunderConsents.funderFirmId, mine), isNull(validationFunderConsents.revokedAt)))
  return consents.map((c) => c.funderFirmId)
}

// Always built from the current row: callers update first, then respond.
const fresh = async (ctx: Ctx): Promise<ValidationRow> => (await db.select().from(validations).where(eq(validations.id, ctx.v.id)))[0] ?? ctx.v

async function summary(ctx: Ctx) {
  const v = await fresh(ctx)
  const [d, [org]] = await Promise.all([describeValidation(v), db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, v.orgId))])
  return {
    id: v.id, organization: org?.name ?? '', framework: FRAMEWORKS[v.framework]?.name ?? v.framework, outcome: v.outcome, validatedRung: v.validatedRung,
    status: d.status, statusLabel: STATUS_LABEL[d.status], issuedAt: v.issuedAt, expiresAt: d.expiresAt, nextFollowUp: d.followUp.dueOn,
    can: { org: ctx.org, lead: ctx.lead, funder: ctx.funder && !ctx.org && !ctx.member && !ctx.admin },
  }
}

/** What a consenting funding partner sees: schedule and progress as counts and dates, never the actions, owners or proof. */
async function funderView(v: ValidationRow) {
  const [d, [org]] = await Promise.all([describeValidation(v), db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, v.orgId))])
  const progress = cipProgress(d.cipActions)
  return {
    id: v.id, funderView: true, organization: org?.name ?? '', framework: FRAMEWORKS[v.framework]?.name ?? v.framework, outcome: v.outcome, validatedRung: v.validatedRung,
    status: d.status, statusLabel: STATUS_LABEL[d.status], issuedAt: v.issuedAt, expiresAt: d.expiresAt, verificationId: v.verificationId,
    scheduleMode: v.followUpMode, nextFollowUp: d.followUp.dueOn, followUpOverdue: d.followUp.overdue, progress, progressLine: progressLine(progress, d.followUp.dueOn),
    can: { org: false, lead: false, funder: true },
  }
}

/** The organisation's view of one validation's improvement plan, for the CIP page. */
async function cipView(v: ValidationRow) {
  const d = await describeValidation(v)
  const consents = await db.select({ c: validationFunderConsents, firm: firms.name }).from(validationFunderConsents)
    .innerJoin(firms, eq(firms.id, validationFunderConsents.funderFirmId)).where(and(eq(validationFunderConsents.validationId, v.id), isNull(validationFunderConsents.revokedAt)))
  const progress = cipProgress(d.cipActions)
  return {
    id: v.id, verificationId: v.verificationId, outcome: v.outcome, validatedRung: v.validatedRung, status: d.status, statusLabel: STATUS_LABEL[d.status], expiresAt: d.expiresAt,
    scheduleMode: v.followUpMode, nextFollowUp: d.followUp.dueOn, followUpOverdue: d.followUp.overdue, broughtForward: d.followUp.broughtForward, tracked: v.trackedIndicators,
    progress, progressLine: progressLine(progress, d.followUp.dueOn),
    actions: d.cipActions.map((a) => ({ id: a.id, text: a.text, indicatorIds: a.indicatorIds, owner: a.owner, dueDate: a.dueDate, status: a.status, proof: a.proof, doneAt: a.doneAt, fromQualification: !!a.qualificationId })),
    funders: consents.map(({ c, firm }) => ({ firmId: c.funderFirmId, name: firm, grantedAt: c.grantedAt })),
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
  const verificationId = await ensureVerificationId(v)
  const statement = await ensureStatement({ ...v, verificationId })
  return {
    ...(await summary(ctx)),
    verificationId, publicUrl: publicUrlFor(verificationId), pdfSha256: statement?.sha256 ?? null, publicOptions: v.publicOptions,
    validityMonths: v.validityMonths, validityReason: v.validityReason, statusReason: v.statusReason,
    surveillance: v.surveillanceDueAt ? { dueAt: v.surveillanceDueAt, doneAt: v.surveillanceDoneAt } : null,
    followUp: { mode: v.followUpMode, ...d.followUp, history: d.completedFollowUps, tracked: v.trackedIndicators },
    cip: { actions: d.cipActions.map((a) => ({ id: a.id, text: a.text, indicatorIds: a.indicatorIds, owner: a.owner, dueDate: a.dueDate, status: a.status, proof: a.proof, fromQualification: !!a.qualificationId })), progress: cipProgress(d.cipActions), progressLine: progressLine(cipProgress(d.cipActions), d.followUp.dueOn) },
    checkpoints: d.checkpoints.map((c) => ({ id: c.id, kind: c.kind, dueOn: c.dueOn, state: c.state, result: c.result, note: c.note, doneAt: c.doneAt, indicatorIds: c.indicatorIds })),
    statusHistory: (await statusHistory(v.id)).map((h) => ({ from: h.fromStatus, to: h.toStatus, reason: h.reason, at: h.createdAt })),
    funderConsents: ctx.org ? (await cipView(v)).funders : undefined,
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
