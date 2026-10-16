// ============================================================================
// Validator lifecycle — server helpers (PR 5)
// ----------------------------------------------------------------------------
// Creating the issued validation at finalise, deriving statuses from the clock,
// the follow-up checkpoints, reminder and debrief emails. The rules themselves
// (validity periods, transitions, schedule maths) are pure and live in
// src/lib/validity.ts; this file only reads and writes rows.
//
// Invariant: nothing here ever moves expires_at later. The only writes to it
// are the issue itself, a shortening, and a missed surveillance check.
// ============================================================================

import { randomBytes } from 'node:crypto'
import { and, eq, inArray, isNull, ne } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  auditLogs, engagementMembers, organizations, validationCheckpoints, validationCipActions, validationEngagements, validationReminders,
  validationQualifications, validationReviews, validations, validationStatusHistory, type CipActionRow, type ValidationRow,
} from '../../db/schema.js'
import { FRAMEWORKS, indicatorsInScope, type Outcome } from '../../src/lib/validationReview.js'
import type { EngagementScope } from '../../src/lib/engagements.js'
import {
  chooseValidity, computeExpiry, DEFAULT_FOLLOW_UP, deriveStatus, bringForward, milestoneMet, planCheckpoints, reminderDue, REMINDER_DAYS,
  TERMINAL_STATUSES, verificationIdFrom, type ActionLite, type FollowUpKind, type ValidationStatus, type ValidityPlan,
} from '../../src/lib/validity.js'
import { logger } from './logger.js'
import { sendReminderEmail, type EmailAcceptance } from './reminder-email.js'

export type Db = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
const asDb = (tx: Tx | typeof db): Db => tx as unknown as Db

export const audit = (actor: string, action: string, target: string, orgId: string) =>
  db.insert(auditLogs).values({ actor, action, target, category: 'Validation', orgId })

export async function recordStatus(d: Db, v: { id: string; orgId: string }, from: string | null, to: string, reason: string, actor: string) {
  await d.insert(validationStatusHistory).values({ id: `vsh_${crypto.randomUUID()}`, validationId: v.id, fromStatus: from, toStatus: to, reason, actor })
  await d.insert(auditLogs).values({ actor, action: `validation status ${from ?? '—'} → ${to}${reason ? `: ${reason}` : ''}`, target: v.id, category: 'Validation', orgId: v.orgId })
}

const lite = (a: CipActionRow): ActionLite => ({ dueDate: a.dueDate, done: a.status === 'done', indicatorIds: a.indicatorIds })

/** Qualified indicators plus the ones blocking the next rung: all a follow-up re-checks. */
export function followUpScope(i: { framework: string; scope: EngagementScope; finalScores: Record<string, number>; qualifications: Array<{ indicatorIds: string[] }> }): string[] {
  const fw = FRAMEWORKS[i.framework]
  if (!fw) return []
  const inScope = new Set(indicatorsInScope(fw, i.scope).map((x) => x.id))
  const out = new Set<string>()
  for (const q of i.qualifications) for (const id of q.indicatorIds) if (inScope.has(id)) out.add(id)
  for (const id of fw.blocking(i.finalScores)) if (inScope.has(id)) out.add(id)
  return [...out]
}

type Snapshot = { indicators?: Array<{ id: string; final: number | null }>; qualifications?: Array<{ text: string; indicatorIds: string[] }> }

/**
 * Create the issued validation for a finalised review: verification id, expiry, history, follow-up
 * checkpoints, the CIP actions seeded from the qualifications, and supersession of the previous one.
 * Runs inside the finalise transaction, so a review is never finalised without its validation.
 */
export async function createValidation(txOrDb: Tx | typeof db, i: {
  reviewId: string; engagementId: string; orgId: string; framework: string; scope: EngagementScope
  outcome: Outcome; rung: number | null; issuedAt: Date; plan: ValidityPlan; followUp: FollowUpKind
  snapshot: Snapshot; qualificationRows: Array<{ id: string; text: string; indicatorIds: string[] }>; actor: string
}): Promise<ValidationRow> {
  const d = asDb(txOrDb)
  const id = `val_${crypto.randomUUID()}`
  const verificationId = verificationIdFrom(randomBytes(8))
  const expiresAt = i.outcome === 'not_validated' ? null : computeExpiry(i.issuedAt, i.plan)
  const finalScores = Object.fromEntries((i.snapshot.indicators ?? []).filter((x) => x.final != null).map((x) => [x.id, x.final as number]))
  const scope = i.outcome === 'not_validated' ? [] : followUpScope({ framework: i.framework, scope: i.scope, finalScores, qualifications: i.qualificationRows })
  const [row] = await d.insert(validations).values({
    id, reviewId: i.reviewId, engagementId: i.engagementId, orgId: i.orgId, framework: i.framework, verificationId, outcome: i.outcome,
    validatedRung: i.outcome === 'not_validated' ? null : i.rung, issuedAt: i.issuedAt, validityMonths: i.plan.months, validityChoice: i.plan.choice,
    validityReason: i.plan.reason, surveillance: i.plan.surveillance, expiresAt, status: 'current', statusChangedAt: i.issuedAt,
    followUpKind: i.followUp, followUpValidatorOk: true, followUpOrgOk: false, followUpIndicators: scope,
  }).returning()
  await recordStatus(d, row, null, 'current', 'Issued', i.actor)
  if (i.outcome === 'not_validated') return row

  // A newer validation of the same framework replaces any earlier one still in force.
  const older = await d.select().from(validations).where(and(
    eq(validations.orgId, i.orgId), eq(validations.framework, i.framework), ne(validations.id, id),
    inArray(validations.status, ['current', 'follow_up_overdue', 'suspended']), ne(validations.outcome, 'not_validated')))
  for (const o of older) {
    await d.update(validations).set({ status: 'superseded', supersededBy: id, statusChangedAt: i.issuedAt, updatedAt: i.issuedAt }).where(eq(validations.id, o.id))
    await recordStatus(d, o, o.status, 'superseded', `Replaced by ${verificationId}`, i.actor)
  }

  // CIP actions: one per qualification, to be given an owner and a due date by the organisation.
  const actions: CipActionRow[] = []
  for (const q of i.qualificationRows) {
    const [a] = await d.insert(validationCipActions).values({
      id: `cip_${crypto.randomUUID()}`, validationId: id, orgId: i.orgId, text: q.text, indicatorIds: q.indicatorIds, qualificationId: q.id, createdBy: i.actor,
    }).returning()
    actions.push(a)
  }
  const planned = planCheckpoints({ issuedAt: i.issuedAt, expiresAt: expiresAt!, months: i.plan.months, surveillance: i.plan.surveillance, kind: i.followUp, actions: actions.map(lite), scope })
  for (const p of planned) {
    await d.insert(validationCheckpoints).values({ id: `chk_${crypto.randomUUID()}`, validationId: id, kind: p.kind, dueAt: p.dueAt, indicatorIds: scope })
  }
  return row
}

/**
 * A finalised review that predates the lifecycle (finalised in PR 3, before verification ids existed)
 * gets its validation the first time anything looks at it: standard validity from its own finalise date.
 */
export async function ensureValidation(engagementId: string): Promise<ValidationRow | null> {
  const [existing] = await db.select().from(validations).where(eq(validations.engagementId, engagementId))
  if (existing) return existing
  const [review] = await db.select().from(validationReviews).where(eq(validationReviews.engagementId, engagementId))
  if (!review || review.status !== 'finalised' || !review.finalisedAt || !review.outcome) return null
  const [e] = await db.select().from(validationEngagements).where(eq(validationEngagements.id, engagementId))
  if (!e) return null
  const outcome = review.outcome as Outcome
  const { plan } = chooseValidity({ outcome, rung: review.validatedRung })
  if (!plan) return null
  const snapshot = (review.snapshot ?? {}) as Snapshot
  return db.transaction(async (tx) => {
    const quals = await tx.select().from(validationQualifications).where(eq(validationQualifications.reviewId, review.id))
    const row = await createValidation(tx, {
      reviewId: review.id, engagementId, orgId: e.orgId, framework: e.framework, scope: e.scope as EngagementScope, outcome, rung: review.validatedRung,
      issuedAt: review.finalisedAt!, plan, followUp: DEFAULT_FOLLOW_UP, snapshot,
      qualificationRows: quals.map((q) => ({ id: q.id, text: q.text, indicatorIds: q.indicatorIds })), actor: 'system',
    })
    await tx.insert(auditLogs).values({ actor: 'system', action: `issued lifecycle record ${row.verificationId} for a review finalised before PR 5`, target: row.id, category: 'Validation', orgId: e.orgId })
    return row
  }).catch(async (err) => {
    // A concurrent caller created it first (unique review_id / engagement_id): use theirs.
    const [again] = await db.select().from(validations).where(eq(validations.engagementId, engagementId))
    if (again) return again
    throw err
  })
}

/** Recompute follow-up checkpoints after an action or schedule change. Never pushes a check later once agreed or overdue. */
export async function syncCheckpoints(v: ValidationRow, now = new Date(), d: Db = db): Promise<void> {
  if (v.expiresAt === null || TERMINAL_STATUSES.includes(v.status as ValidationStatus)) return
  const actions = (await d.select().from(validationCipActions).where(eq(validationCipActions.validationId, v.id))).map(lite)
  const cps = await d.select().from(validationCheckpoints).where(eq(validationCheckpoints.validationId, v.id))
  const kind = v.followUpKind as FollowUpKind
  const planned = planCheckpoints({
    issuedAt: v.issuedAt, expiresAt: v.expiresAt, months: v.validityMonths, surveillance: false, kind, actions, scope: v.followUpIndicators,
  })
  const locked = v.followUpValidatorOk && v.followUpOrgOk
  const pending = cps.filter((c) => c.kind === 'follow_up' && c.state === 'pending')
  const doneFollowUps = cps.filter((c) => c.kind === 'follow_up' && c.state === 'done')

  if (kind === 'fixed_3' || kind === 'fixed_6') {
    const keep = new Set<string>()
    for (const p of planned) {
      if (p.dueAt.getTime() <= now.getTime()) continue
      const same = cps.find((c) => c.kind === 'follow_up' && c.dueAt.getTime() === p.dueAt.getTime())
      if (same) keep.add(same.id)
      else await d.insert(validationCheckpoints).values({ id: `chk_${crypto.randomUUID()}`, validationId: v.id, kind: 'follow_up', dueAt: p.dueAt, indicatorIds: v.followUpIndicators })
    }
    // Pending points of a previous schedule that have not yet come due fall away; overdue ones stay.
    for (const c of pending) if (!keep.has(c.id) && c.dueAt.getTime() > now.getTime()) await d.delete(validationCheckpoints).where(eq(validationCheckpoints.id, c.id))
    return
  }

  // milestone / end_of_plan: a single follow-up point.
  const target = planned.find((p) => p.kind === 'follow_up')?.dueAt
  if (!target) return
  const met = milestoneMet(kind, actions, v.followUpIndicators)
  const existing = [...pending].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0]
  for (const extra of pending) if (extra !== existing && extra.dueAt.getTime() > now.getTime()) await d.delete(validationCheckpoints).where(eq(validationCheckpoints.id, extra.id))
  if (!existing) {
    // Re-created only if nothing has been done for this schedule (e.g. it was switched from fixed intervals).
    if (!doneFollowUps.length) {
      const due = bringForward(target, now, met)
      await d.insert(validationCheckpoints).values({ id: `chk_${crypto.randomUUID()}`, validationId: v.id, kind: 'follow_up', dueAt: due, indicatorIds: v.followUpIndicators })
    }
    return
  }
  // A point already past due is never moved (it would hide the overdue status).
  if (existing.dueAt.getTime() < now.getTime()) return
  // Once both sides agreed the schedule, the point can only move earlier.
  const base = locked ? new Date(Math.min(existing.dueAt.getTime(), target.getTime())) : target
  const next = bringForward(base, now, met)
  if (next.getTime() !== existing.dueAt.getTime()) await d.update(validationCheckpoints).set({ dueAt: next }).where(eq(validationCheckpoints.id, existing.id))
}

/** Bring one validation's status up to date with the clock. Idempotent; writes history only on a change. */
export async function refreshValidation(v: ValidationRow, now = new Date()): Promise<ValidationRow> {
  if (TERMINAL_STATUSES.includes(v.status as ValidationStatus) || v.expiresAt === null) return v
  const checkpoints = await db.select().from(validationCheckpoints).where(eq(validationCheckpoints.validationId, v.id))
  const next = deriveStatus({
    status: v.status as ValidationStatus, now, expiresAt: v.expiresAt,
    checkpoints: checkpoints.map((c) => ({ kind: c.kind as 'surveillance' | 'follow_up', dueAt: c.dueAt, state: c.state as 'pending' | 'done' })),
  })
  const expiryChanged = next.expiresAt && next.expiresAt.getTime() !== v.expiresAt.getTime()
  if (next.status === v.status && !expiryChanged) return v
  const [row] = await db.update(validations).set({ status: next.status, expiresAt: next.expiresAt, statusChangedAt: now, updatedAt: now })
    .where(and(eq(validations.id, v.id), eq(validations.status, v.status))).returning()
  if (!row) return (await db.select().from(validations).where(eq(validations.id, v.id)))[0] ?? v
  if (next.status !== v.status) await recordStatus(db, v, v.status, next.status, next.reason, 'system')
  return row
}

/** The daily status sweep over every validation still in motion. */
export async function sweepValidations(now = new Date()): Promise<{ checked: number; changed: number }> {
  const live = await db.select().from(validations).where(inArray(validations.status, ['current', 'follow_up_overdue', 'suspended']))
  let changed = 0
  for (const v of live) {
    const next = await refreshValidation(v, now)
    if (next.status !== v.status) changed += 1
  }
  return { checked: live.length, changed }
}

// --- email ----------------------------------------------------------------------
const baseUrl = () => (process.env.URL || process.env.SITE_URL || '').replace(/\/$/, '')
const link = (engagementId: string) => `${baseUrl()}/engagements/${engagementId}/validity`

export async function partiesOf(v: Pick<ValidationRow, 'orgId' | 'engagementId'>): Promise<{ org: string | null; validator: string | null; orgName: string }> {
  const [org] = await db.select({ name: organizations.name, email: organizations.email }).from(organizations).where(eq(organizations.id, v.orgId))
  const [lead] = await db.select({ email: engagementMembers.email }).from(engagementMembers).where(and(
    eq(engagementMembers.engagementId, v.engagementId), eq(engagementMembers.role, 'lead'), eq(engagementMembers.status, 'named')))
  const [e] = await db.select({ validatorEmail: validationEngagements.validatorEmail }).from(validationEngagements).where(eq(validationEngagements.id, v.engagementId))
  return { org: org?.email?.trim() || null, validator: lead?.email ?? e?.validatorEmail ?? null, orgName: org?.name ?? 'the organisation' }
}

export async function notify(to: string | null, subject: string, text: string, key: string): Promise<EmailAcceptance | 'no_recipient'> {
  if (!to) return 'no_recipient'
  const result = await sendReminderEmail({ to, subject, text }, key)
  if (result === 'not_configured') logger.info('validation-lifecycle', 'email provider not configured; would send', { to, subject })
  if (result === 'failed') logger.warn('validation-lifecycle', 'email provider rejected a message', { subject })
  return result
}

const when = (d: Date) => d.toISOString().slice(0, 10)

/** 30 and 7 days before each verification point and expiry, to the organisation and the validator. */
export async function sendDueReminders(now = new Date()): Promise<{ considered: number; sent: number; failed: number; skipped: number }> {
  const live = await db.select().from(validations).where(and(inArray(validations.status, ['current', 'follow_up_overdue', 'suspended']), ne(validations.outcome, 'not_validated')))
  const out = { considered: 0, sent: 0, failed: 0, skipped: 0 }
  for (const v of live) {
    if (!v.expiresAt) continue
    const cps = await db.select().from(validationCheckpoints).where(and(eq(validationCheckpoints.validationId, v.id), eq(validationCheckpoints.state, 'pending')))
    const sentRows = await db.select().from(validationReminders).where(eq(validationReminders.validationId, v.id))
    const points = [{ point: 'expiry', dueAt: v.expiresAt, label: 'validity expires' }, ...cps.map((c) => ({ point: c.id, dueAt: c.dueAt, label: c.kind === 'surveillance' ? 'surveillance check is due' : 'follow-up check is due' }))]
    const parties = await partiesOf(v)
    for (const p of points) {
      out.considered += 1
      const sent = sentRows.filter((r) => r.point === p.point).map((r) => r.daysBefore)
      const days = reminderDue(p.dueAt, now, sent)
      if (days === null) continue
      const subject = `CRAFT validation ${v.verificationId}: ${p.label} on ${when(p.dueAt)}`
      const text = `This is an automated CRAFT reminder.\n\nValidation ${v.verificationId} for ${parties.orgName}: the ${p.label} on ${when(p.dueAt)} (${days === 7 ? 'in a week' : 'in about a month'}).\n\n` +
        `${p.point === 'expiry' ? 'Plan a new validation if you want the result to stay current.' : 'The follow-up re-checks only the qualified or blocking indicators.'}\n\nOpen it: ${link(v.engagementId)}`
      const results = await Promise.all([
        notify(parties.org, subject, text, `val-${v.id}-${p.point}-${days}-org`),
        notify(parties.validator, subject, text, `val-${v.id}-${p.point}-${days}-validator`),
      ])
      if (results.includes('failed')) { out.failed += 1; continue }
      if (!results.includes('accepted')) { out.skipped += 1; continue }
      // Looser thresholds are satisfied too, so a missed day never produces a second email.
      for (const t of REMINDER_DAYS.filter((x) => x >= days)) {
        await db.insert(validationReminders).values({ validationId: v.id, point: p.point, daysBefore: t }).onConflictDoNothing()
      }
      out.sent += 1
    }
  }
  return out
}

/** Tell the organisation that its debrief is open. Marks debrief_notified_at only once a send was accepted. */
export async function notifyDebriefOpen(reviewId: string): Promise<EmailAcceptance | 'no_recipient' | 'skipped'> {
  const [r] = await db.select().from(validationReviews).where(eq(validationReviews.id, reviewId))
  if (!r || r.status !== 'debrief' || r.debriefNotifiedAt) return 'skipped'
  const [e] = await db.select().from(validationEngagements).where(eq(validationEngagements.id, r.engagementId))
  if (!e) return 'skipped'
  const [org] = await db.select({ name: organizations.name, email: organizations.email }).from(organizations).where(eq(organizations.id, e.orgId))
  const result = await notify(org?.email?.trim() || null, 'Your CRAFT validation debrief is open',
    `The validator has opened the debrief for ${org?.name ?? 'your organisation'}.\n\nYou can now see the validator's scores and comments, respond to any indicator you disagree with, and the validator can record negotiated scores.\n\nOpen the review: ${baseUrl()}/engagements/${e.id}/review`, `debrief-${r.id}`)
  if (result === 'accepted') await db.update(validationReviews).set({ debriefNotifiedAt: new Date() }).where(eq(validationReviews.id, r.id))
  return result
}

export async function sendPendingDebriefNotices(): Promise<number> {
  const open = await db.select({ id: validationReviews.id }).from(validationReviews).where(and(eq(validationReviews.status, 'debrief'), isNull(validationReviews.debriefNotifiedAt)))
  let sent = 0
  for (const r of open) if ((await notifyDebriefOpen(r.id)) === 'accepted') sent += 1
  return sent
}

/** Backfill: every finalised review gets its validation (finalised before this PR shipped). */
export async function backfillValidations(): Promise<number> {
  const rows = await db.select({ engagementId: validationReviews.engagementId }).from(validationReviews)
    .leftJoin(validations, eq(validations.reviewId, validationReviews.id))
    .where(and(eq(validationReviews.status, 'finalised'), isNull(validations.id)))
  let made = 0
  for (const r of rows) if (await ensureValidation(r.engagementId)) made += 1
  return made
}
