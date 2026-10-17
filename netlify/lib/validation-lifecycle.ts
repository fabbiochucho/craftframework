// Server side of the validation lifecycle (PR 5): the derived status view, who to
// email, and the reminder run. Pure rules live in src/lib/validationLifecycle.ts.
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  capacityActions, engagementMembers, organizations, users, validationCheckpoints, validationCipActions, validationEngagements, validationNotifications,
  validationReviews, validations, validationStatusHistory, type CheckpointRow, type CipActionRow, type ValidationRow,
} from '../../db/schema.js'
import {
  checkpointSyncPlan, daysUntil, derivedStatusReason, dueReminders, effectiveExpiry, effectiveStatus, nextFollowUp, STATUS_LABEL, type FollowUpMode, type NextFollowUp,
  type ReminderKind, type Status,
} from '../../src/lib/validationLifecycle.js'
import { sendReminderEmail } from './reminder-email.js'
import { logger } from './logger.js'

export type Described = {
  status: Status
  statusLabel: string
  expiresAt: Date
  followUp: NextFollowUp
  /** Completed follow-up checkpoints, oldest first. */
  completedFollowUps: Array<{ dueOn: string; result: string; note: string; completedAt: Date }>
  checkpoints: CheckpointRow[]
  cipActions: CipActionRow[]
}

export async function describeValidation(v: ValidationRow, now = new Date()): Promise<Described> {
  const [checkpoints, cipActions, legacy] = await Promise.all([
    db.select().from(validationCheckpoints).where(eq(validationCheckpoints.validationId, v.id)).orderBy(asc(validationCheckpoints.dueOn)),
    db.select().from(validationCipActions).where(eq(validationCipActions.validationId, v.id)).orderBy(asc(validationCipActions.createdAt)),
    // The organisation's general CIP also counts when an action there is about a tracked indicator.
    db.select({ questionId: capacityActions.questionId, dueDate: capacityActions.dueDate, status: capacityActions.status }).from(capacityActions).where(eq(capacityActions.orgId, v.orgId)),
  ])
  const done = checkpoints.filter((c) => c.kind === 'follow_up' && c.state === 'done')
  const dates = { status: v.status as never, expiresAt: v.expiresAt, surveillanceDueAt: v.surveillanceDueAt, surveillanceDoneAt: v.surveillanceDoneAt }
  const expiresAt = effectiveExpiry(dates)
  const followUp = nextFollowUp({
    mode: v.followUpMode as FollowUpMode, issuedAt: v.issuedAt, expiresAt, completedDueOn: done.map((d) => d.dueOn), tracked: v.trackedIndicators,
    actions: [...cipActions.map((a) => ({ indicatorIds: a.indicatorIds, dueDate: a.dueDate, status: a.status })), ...legacy], now,
  })
  const status = effectiveStatus(dates, followUp.overdue, now)
  return {
    status, statusLabel: STATUS_LABEL[status], expiresAt, followUp, checkpoints, cipActions,
    completedFollowUps: done.map((d) => ({ dueOn: d.dueOn, result: d.result ?? 'confirmed', note: d.note, completedAt: d.doneAt ?? now })),
  }
}

type Db = Pick<typeof db, 'insert' | 'select' | 'delete' | 'update'>

/** One row of the status history. Every change of the shown status goes through here. */
export async function recordStatusHistory(tx: Db, validationId: string, from: string | null, to: string, reason: string, actor: string, at?: Date) {
  await tx.insert(validationStatusHistory).values({ id: `vsh_${crypto.randomUUID()}`, validationId, fromStatus: from, toStatus: to, reason, actor, ...(at ? { createdAt: at } : {}) })
}

export async function statusHistory(validationId: string) {
  return db.select().from(validationStatusHistory).where(eq(validationStatusHistory.validationId, validationId)).orderBy(asc(validationStatusHistory.createdAt))
}

/**
 * The calendar moves the shown status too (expired, follow-up overdue, back to current). Those moves
 * are not decisions, so they are recorded here, once, by the daily run (actor "system").
 */
export async function syncDerivedStatus(v: ValidationRow, now = new Date()): Promise<boolean> {
  if (v.status !== 'current') return false
  const d = await describeValidation(v, now)
  const [last] = await db.select().from(validationStatusHistory).where(eq(validationStatusHistory.validationId, v.id)).orderBy(desc(validationStatusHistory.createdAt)).limit(1)
  const lastTo = last?.toStatus ?? null
  if (lastTo === d.status) return false
  // No history at all (nothing was ever recorded): start it with the issue, which is how every validation begins.
  if (!last) {
    await recordStatusHistory(db, v.id, null, 'current', 'Validation issued', 'system', v.issuedAt)
    if (d.status === 'current') return true
    return (await syncDerivedStatus(v, now)) || true
  }
  // Recorded when observed, so the history stays in order and each row follows from the last; the reason carries the date it really happened.
  const on = d.status === 'expired' ? d.expiresAt.toISOString().slice(0, 10) : d.status === 'follow_up_overdue' ? d.followUp.dueOn : null
  await recordStatusHistory(db, v.id, lastTo, d.status, derivedStatusReason(d.status, on), 'system', now)
  return true
}

/**
 * Keep the checkpoints table equal to the schedule: the surveillance point (24-month validations) and
 * exactly one pending follow-up point at the date the schedule now wants. Idempotent; called whenever
 * something that moves the schedule changes (issue, schedule, CIP action, follow-up) and by the daily run.
 */
export async function syncCheckpoints(v: ValidationRow, now = new Date()): Promise<void> {
  if (v.surveillanceDueAt) {
    await db.insert(validationCheckpoints).values({
      id: `cp_${crypto.randomUUID()}`, validationId: v.id, kind: 'surveillance', dueOn: v.surveillanceDueAt.toISOString().slice(0, 10), indicatorIds: v.trackedIndicators,
      ...(v.surveillanceDoneAt ? { state: 'done', doneAt: v.surveillanceDoneAt, doneBy: 'system', result: 'confirmed' } : {}),
    }).onConflictDoNothing()
  }
  const d = await describeValidation(v, now)
  const open = v.status === 'current' || v.status === 'suspended'
  const pending = d.checkpoints.filter((c) => c.kind === 'follow_up' && c.state === 'pending')
  const plan = checkpointSyncPlan(pending.map((c) => c.dueOn), open && d.status !== 'expired' ? d.followUp.dueOn : null)
  if (plan.remove.length) {
    await db.delete(validationCheckpoints).where(and(eq(validationCheckpoints.validationId, v.id), eq(validationCheckpoints.kind, 'follow_up'), eq(validationCheckpoints.state, 'pending'), inArray(validationCheckpoints.dueOn, plan.remove)))
  }
  if (plan.add) {
    await db.insert(validationCheckpoints).values({ id: `cp_${crypto.randomUUID()}`, validationId: v.id, kind: 'follow_up', dueOn: plan.add, indicatorIds: v.trackedIndicators }).onConflictDoNothing()
  }
}

const cleanEmails = (l: Array<string | null | undefined>) => [...new Set(l.filter((e): e is string => !!e && /@/.test(e)).map((e) => e.toLowerCase()))]

/** The organisation's contact address and its admins. Best-effort recipients for notices. */
export async function orgContactsFor(orgId: string): Promise<string[]> {
  const [org] = await db.select({ email: organizations.email }).from(organizations).where(eq(organizations.id, orgId))
  const staff = await db.select({ email: users.email }).from(users).where(and(eq(users.orgId, orgId), eq(users.role, 'admin')))
  return cleanEmails([org?.email, ...staff.map((s) => s.email)])
}

/** Organisation contacts and the validator lead for a validation. */
export async function contactsFor(v: Pick<ValidationRow, 'orgId' | 'engagementId'>): Promise<{ org: string[]; validator: string[] }> {
  const lead = await db.select({ email: engagementMembers.email }).from(engagementMembers)
    .where(and(eq(engagementMembers.engagementId, v.engagementId), eq(engagementMembers.role, 'lead'), eq(engagementMembers.status, 'named')))
  return { org: await orgContactsFor(v.orgId), validator: cleanEmails(lead.map((l) => l.email)) }
}

/** Fire-and-forget notice. A mail failure never fails the action that caused it. Returns what the provider did. */
export async function notify(to: string[], subject: string, text: string): Promise<'accepted' | 'failed' | 'not_configured' | 'skipped'> {
  if (!to.length) return 'skipped'
  try {
    const result = await sendReminderEmail({ to, subject, text }, undefined, 'validation_notice')
    if (result === 'not_configured') logger.warn('validation-lifecycle', 'email not configured; notice not sent')
    return result
  } catch (err) {
    logger.error('validation-lifecycle', 'notice failed', err)
    return 'failed'
  }
}

/**
 * Tell the organisation its validator opened the debrief. Sent once: debrief_notified_at is set only after the
 * provider accepted the email, so the daily run retries a notice that could not be sent and never repeats one that was.
 */
export async function sendDebriefNotice(reviewId: string): Promise<'accepted' | 'failed' | 'not_configured' | 'skipped'> {
  const [r] = await db.select({ review: validationReviews, orgId: validationEngagements.orgId, orgName: organizations.name })
    .from(validationReviews).innerJoin(validationEngagements, eq(validationEngagements.id, validationReviews.engagementId))
    .innerJoin(organizations, eq(organizations.id, validationEngagements.orgId)).where(eq(validationReviews.id, reviewId))
  if (!r || r.review.status !== 'debrief' || r.review.debriefNotifiedAt) return 'skipped'
  const result = await notify(await orgContactsFor(r.orgId), `CRAFT: the debrief for ${r.orgName} is open`,
    `Your validator has finished scoring and opened the debrief for ${r.orgName}.\n\nYou can now see the validator's scores and comments next to your own, and respond to any indicator you dispute. The validator may then record negotiated scores before finalising.\n\nSign in to CRAFT, open Engagements and choose the engagement's review.`)
  if (result === 'accepted') {
    await db.update(validationReviews).set({ debriefNotifiedAt: new Date() }).where(and(eq(validationReviews.id, reviewId), isNull(validationReviews.debriefNotifiedAt)))
  }
  return result
}

/**
 * Daily housekeeping before the reminders: re-sync every live validation's checkpoints, record the calendar's
 * status moves in the history, and retry debrief notices that could not be sent.
 */
export async function runLifecycleMaintenance(now = new Date()): Promise<{ checkpoints: number; statusMoves: number; debriefNotices: number }> {
  const live = await db.select().from(validations).where(inArray(validations.status, ['current', 'suspended']))
  let statusMoves = 0
  for (const v of live) {
    await syncCheckpoints(v, now)
    if (await syncDerivedStatus(v, now)) statusMoves++
  }
  const pending = await db.select({ id: validationReviews.id }).from(validationReviews).where(and(eq(validationReviews.status, 'debrief'), isNull(validationReviews.debriefNotifiedAt)))
  let debriefNotices = 0
  for (const p of pending) if ((await sendDebriefNotice(p.id)) === 'accepted') debriefNotices++
  return { checkpoints: live.length, statusMoves, debriefNotices }
}

const KIND_TEXT: Record<ReminderKind, string> = { follow_up: 'follow-up check', expiry: 'expiry', surveillance: 'surveillance check' }

/**
 * Daily run: email the organisation and the validator 30 and 7 days before each follow-up point,
 * the surveillance check and the expiry. Idempotent: a reminder is logged only once the provider
 * accepted it, so an unconfigured or failing provider is retried the next day and never double-sent.
 */
export async function sendDueReminders(now = new Date()): Promise<{ checked: number; sent: number; failed: number; notConfigured: number }> {
  const rows = await db.select().from(validations).where(eq(validations.status, 'current'))
  const out = { checked: rows.length, sent: 0, failed: 0, notConfigured: 0 }
  for (const v of rows) {
    const d = await describeValidation(v, now)
    if (d.status === 'expired') continue
    const points: Array<{ kind: ReminderKind; dueOn: string }> = []
    if (d.followUp.dueOn) points.push({ kind: 'follow_up', dueOn: d.followUp.dueOn })
    points.push({ kind: 'expiry', dueOn: d.expiresAt.toISOString().slice(0, 10) })
    if (v.surveillanceDueAt && !v.surveillanceDoneAt) points.push({ kind: 'surveillance', dueOn: v.surveillanceDueAt.toISOString().slice(0, 10) })
    const [{ org, validator }, org2] = [await contactsFor(v), await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, v.orgId))]
    const recipients = [...new Set([...org, ...validator])]
    for (const p of points) {
      const sentRows = await db.select({ offset: validationNotifications.offsetDays, recipient: validationNotifications.recipient }).from(validationNotifications)
        .where(and(eq(validationNotifications.validationId, v.id), eq(validationNotifications.kind, p.kind), eq(validationNotifications.dueOn, p.dueOn)))
      for (const to of recipients) {
        const sentOffsets = sentRows.filter((r) => r.recipient === to).map((r) => r.offset)
        for (const offset of dueReminders(p.dueOn, sentOffsets, now)) {
          const days = daysUntil(p.dueOn, now)
          const result = await sendReminderEmail({
            to,
            subject: `CRAFT validation: ${KIND_TEXT[p.kind]} due ${p.dueOn} (${org2[0]?.name ?? 'your organisation'})`,
            text: `This is an automated CRAFT reminder.\n\nThe ${KIND_TEXT[p.kind]} for the validation of ${org2[0]?.name ?? 'the organisation'} is due on ${p.dueOn} (${days} day${days === 1 ? '' : 's'}).\n` +
              (p.kind === 'expiry' ? 'After this date the validation shows as expired on its verification page.\n' : '') +
              '\nSign in to CRAFT to see the validation and its follow-up schedule.',
          }, `${v.id}-${p.kind}-${p.dueOn}-${offset}-${to}`, 'validation_reminder')
          if (result === 'accepted') {
            out.sent++
            await db.insert(validationNotifications).values({ validationId: v.id, kind: p.kind, dueOn: p.dueOn, offsetDays: offset, recipient: to }).onConflictDoNothing()
          } else if (result === 'failed') out.failed++
          else out.notConfigured++
        }
      }
    }
  }
  return out
}
