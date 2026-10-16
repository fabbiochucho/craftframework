// Server side of the validation lifecycle (PR 5): the derived status view, who to
// email, and the reminder run. Pure rules live in src/lib/validationLifecycle.ts.
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  capacityActions, engagementMembers, organizations, users, validationFollowUps, validationNotifications, validations, type ValidationRow,
} from '../../db/schema.js'
import {
  daysUntil, dueReminders, effectiveExpiry, effectiveStatus, nextFollowUp, STATUS_LABEL, type FollowUpMode, type NextFollowUp, type ReminderKind, type Status,
} from '../../src/lib/validationLifecycle.js'
import { sendReminderEmail } from './reminder-email.js'
import { logger } from './logger.js'

export type Described = {
  status: Status
  statusLabel: string
  expiresAt: Date
  followUp: NextFollowUp
  completedFollowUps: Array<{ dueOn: string; result: string; note: string; completedAt: Date }>
}

export async function describeValidation(v: ValidationRow, now = new Date()): Promise<Described> {
  const [done, actions] = await Promise.all([
    db.select().from(validationFollowUps).where(eq(validationFollowUps.validationId, v.id)),
    db.select({ questionId: capacityActions.questionId, dueDate: capacityActions.dueDate, status: capacityActions.status }).from(capacityActions).where(eq(capacityActions.orgId, v.orgId)),
  ])
  const dates = { status: v.status as never, expiresAt: v.expiresAt, surveillanceDueAt: v.surveillanceDueAt, surveillanceDoneAt: v.surveillanceDoneAt }
  const expiresAt = effectiveExpiry(dates)
  const followUp = nextFollowUp({
    mode: v.followUpMode as FollowUpMode, issuedAt: v.issuedAt, expiresAt, completedDueOn: done.map((d) => d.dueOn), tracked: v.trackedIndicators, actions, now,
  })
  const status = effectiveStatus(dates, followUp.overdue, now)
  return {
    status, statusLabel: STATUS_LABEL[status], expiresAt, followUp,
    completedFollowUps: done.map((d) => ({ dueOn: d.dueOn, result: d.result, note: d.note, completedAt: d.completedAt })).sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
  }
}

/** Organisation contacts and the validator lead for a validation. Best-effort recipients for notices. */
export async function contactsFor(v: ValidationRow): Promise<{ org: string[]; validator: string[] }> {
  const [org] = await db.select({ email: organizations.email }).from(organizations).where(eq(organizations.id, v.orgId))
  const staff = await db.select({ email: users.email }).from(users).where(and(eq(users.orgId, v.orgId), eq(users.role, 'admin')))
  const lead = await db.select({ email: engagementMembers.email }).from(engagementMembers)
    .where(and(eq(engagementMembers.engagementId, v.engagementId), eq(engagementMembers.role, 'lead'), eq(engagementMembers.status, 'named')))
  const clean = (l: Array<string | null | undefined>) => [...new Set(l.filter((e): e is string => !!e && /@/.test(e)).map((e) => e.toLowerCase()))]
  return { org: clean([org?.email, ...staff.map((s) => s.email)]), validator: clean(lead.map((l) => l.email)) }
}

/** Fire-and-forget notice. A mail failure never fails the action that caused it. */
export async function notify(to: string[], subject: string, text: string): Promise<void> {
  if (!to.length) return
  try {
    const result = await sendReminderEmail({ to, subject, text })
    if (result === 'not_configured') logger.warn('validation-lifecycle', 'email not configured; notice not sent')
  } catch (err) {
    logger.error('validation-lifecycle', 'notice failed', err)
  }
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
          }, `${v.id}-${p.kind}-${p.dueOn}-${offset}-${to}`)
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
