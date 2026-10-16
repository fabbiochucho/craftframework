// ============================================================================
// CRAFT validator system — validity, statuses, material events, follow-ups (PR 5)
// ----------------------------------------------------------------------------
// Pure rules shared by /api/validations, the daily reminder job and the pages.
// Dates are handled in UTC. See docs/superpowers/specs/2026-10-16-validator-system.md
// ("Validity and statuses", "CIP and the follow-up schedule").
// ============================================================================

import type { Outcome } from './validationReview.ts'

export const MS_DAY = 86_400_000

// --- Validity ------------------------------------------------------------------
export const MAX_VALIDITY_MONTHS = 24
/** Months a validation lasts unless the validator chooses otherwise. */
export const DEFAULT_VALIDITY: Record<Exclude<Outcome, 'not_validated'>, number> = { validated: 12, validated_with_qualifications: 6 }

export function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime())
  const day = out.getUTCDate()
  out.setUTCDate(1)
  out.setUTCMonth(out.getUTCMonth() + months)
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate()
  out.setUTCDate(Math.min(day, last))
  return out
}

export type ValidityChoice = { months: number; reason: string }

/**
 * Check the validity period the validator asked for (spec): 12 months validated, 6 with qualifications;
 * rung 5+ with no qualifications may choose 24 months (with a surveillance check at 12, missed = expires
 * at 12); a shorter period is always allowed for a named risk, never a longer one.
 */
export function validityProblems(outcome: Outcome, rung: number, choice: ValidityChoice | null): string[] {
  if (outcome === 'not_validated') return choice ? ['A "not validated" outcome has no validity period'] : []
  if (!choice) return []
  const problems: string[] = []
  const standard = DEFAULT_VALIDITY[outcome]
  if (!Number.isInteger(choice.months) || choice.months < 1) problems.push('Validity must be a whole number of months')
  else if (choice.months > standard) {
    if (!(outcome === 'validated' && rung >= 5 && choice.months === MAX_VALIDITY_MONTHS)) {
      problems.push(outcome === 'validated'
        ? 'Only a rung 5+ validation without qualifications may run for 24 months; otherwise the limit is 12'
        : 'A validation with qualifications lasts at most 6 months')
    }
  } else if (choice.months < standard && !choice.reason.trim()) problems.push('Name the risk behind a shorter validity period')
  return problems
}

export type Issued = { months: number; expiresAt: Date; surveillanceDueAt: Date | null }

export function issuedValidity(outcome: Exclude<Outcome, 'not_validated'>, issuedAt: Date, months?: number): Issued {
  const m = months ?? DEFAULT_VALIDITY[outcome]
  return { months: m, expiresAt: addMonths(issuedAt, m), surveillanceDueAt: m === MAX_VALIDITY_MONTHS ? addMonths(issuedAt, 12) : null }
}

// --- Statuses ----------------------------------------------------------------
export const STORED_STATUSES = ['current', 'suspended', 'withdrawn', 'superseded'] as const
export type StoredStatus = (typeof STORED_STATUSES)[number]
export const STATUSES = ['current', 'follow_up_overdue', 'suspended', 'expired', 'withdrawn', 'superseded'] as const
export type Status = (typeof STATUSES)[number]
export const STATUS_LABEL: Record<Status, string> = {
  current: 'Current', follow_up_overdue: 'Follow-up overdue', suspended: 'Suspended', expired: 'Expired', withdrawn: 'Withdrawn', superseded: 'Superseded',
}

export type ValidationDates = {
  status: StoredStatus
  expiresAt: Date
  surveillanceDueAt: Date | null
  surveillanceDoneAt: Date | null
}

/** A 24-month validation whose 12-month surveillance check was missed ends at 12 months. */
export function effectiveExpiry(v: ValidationDates): Date {
  return v.surveillanceDueAt && !v.surveillanceDoneAt && v.surveillanceDueAt < v.expiresAt ? v.surveillanceDueAt : v.expiresAt
}

/** What anyone is shown. Withdrawn / superseded / suspended are decisions and stick; the rest follows the calendar. */
export function effectiveStatus(v: ValidationDates, followUpOverdue: boolean, now = new Date()): Status {
  if (v.status !== 'current') return v.status
  if (now.getTime() >= effectiveExpiry(v).getTime()) return 'expired'
  return followUpOverdue ? 'follow_up_overdue' : 'current'
}

// --- Follow-up schedule --------------------------------------------------------
export const FOLLOW_UP_MODES = ['milestone', 'fixed_3', 'fixed_6', 'end_of_plan'] as const
export type FollowUpMode = (typeof FOLLOW_UP_MODES)[number]
export const FOLLOW_UP_LABEL: Record<FollowUpMode, string> = {
  milestone: 'Milestone-based (when the blocking or qualified items are done)', fixed_3: 'Every 3 months', fixed_6: 'Every 6 months', end_of_plan: 'End of the plan',
}

/**
 * A CIP action as the schedule sees it. Validation CIP actions carry `indicatorIds` and a status of
 * 'open' | 'done'; the organisation's general CIP (capacity_actions) carries one `questionId` and a
 * RiskStatus. Either counts as done once validated / done.
 */
export type CipAction = { questionId?: string | null; indicatorIds?: string[]; dueDate: string | null; status: string }
const isDone = (a: CipAction) => a.status === 'Completed-Validated' || a.status === 'done'
const touches = (a: CipAction, tracked: string[]) => (!!a.questionId && tracked.includes(a.questionId)) || (a.indicatorIds ?? []).some((i) => tracked.includes(i))
const dateOnly = (d: Date) => d.toISOString().slice(0, 10)

export type NextFollowUp = { dueOn: string | null; overdue: boolean; broughtForward: boolean }

/**
 * The next follow-up point. Fixed intervals count from issue; milestone uses the latest due date of the
 * actions on the tracked (qualified or blocking) indicators; end-of-plan the latest due date in the plan.
 * A CIP that is complete brings the check FORWARD to today; nothing here ever moves a point past the
 * validation's own expiry, so the CIP can never extend validity.
 */
export function nextFollowUp(i: {
  mode: FollowUpMode; issuedAt: Date; expiresAt: Date; completedDueOn: string[]; tracked: string[]; actions: CipAction[]; now?: Date
}): NextFollowUp {
  const now = i.now ?? new Date()
  const today = dateOnly(now)
  const cap = dateOnly(i.expiresAt)
  const done = new Set(i.completedDueOn)
  const mine = i.actions.filter((a) => touches(a, i.tracked))
  let due: string | null = null
  let forward = false
  if (i.mode === 'fixed_3' || i.mode === 'fixed_6') {
    const step = i.mode === 'fixed_3' ? 3 : 6
    for (let k = 1; k < 10; k++) {
      const p = addMonths(i.issuedAt, step * k)
      if (p >= i.expiresAt) break
      if (!done.has(dateOnly(p))) { due = dateOnly(p); break }
    }
  } else {
    const pool = i.mode === 'milestone' ? mine : i.actions
    const dates = pool.map((a) => a.dueDate).filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
    const point = dates.length ? dates[dates.length - 1] : null
    if (point && !done.has(point)) due = point
    if (i.mode === 'milestone' && pool.length && pool.every(isDone) && due !== null && today < due) { due = today; forward = true }
  }
  if (due !== null && due > cap) due = cap
  if (due !== null && done.has(due)) due = null
  return { dueOn: due, overdue: due !== null && due < today, broughtForward: forward }
}

// --- Material events -----------------------------------------------------------
export const MATERIAL_EVENTS = [
  { key: 'fraud', star: true, label: 'Fraud, theft, bribery or corruption involving funds, staff or board' },
  { key: 'criminal_investigation', star: true, label: 'Criminal investigation or charge against the organisation or a board member / senior manager in their role' },
  { key: 'audit_opinion', star: false, label: 'Qualified, adverse or disclaimer audit opinion, or going-concern warning' },
  { key: 'insolvency', star: false, label: 'Insolvency, inability to pay staff or creditors on time, or loss of a funder providing 25%+ of income' },
  { key: 'funder_action', star: false, label: 'A funder suspending, terminating or demanding repayment of a grant for cause' },
  { key: 'regulator_sanction', star: true, label: "Regulator's sanction, suspension or loss of a needed licence or registration" },
  { key: 'sanctions_list', star: false, label: 'Placement on a sanctions or debarment list' },
  { key: 'leadership_change', star: false, label: 'Change of CEO, CFO or board chair' },
  { key: 'board_resignations', star: false, label: 'Half or more of the board resigning within 12 months' },
  { key: 'structure_change', star: false, label: 'Merger, acquisition, split, change of legal form or control' },
  { key: 'restructuring', star: false, label: 'Restructuring that changes the activities, locations or programmes covered' },
  { key: 'records_loss', star: false, label: 'Loss of systems or records that prevents evidencing the controls relied on' },
  { key: 'safeguarding', star: true, label: 'Substantiated safeguarding / SEA case, or serious data-protection breach reported to a regulator' },
] as const
export type MaterialEventKey = (typeof MATERIAL_EVENTS)[number]['key']
export const MATERIAL_EVENT_KEYS = MATERIAL_EVENTS.map((e) => e.key) as [MaterialEventKey, ...MaterialEventKey[]]
export const isStarred = (key: string) => MATERIAL_EVENTS.find((e) => e.key === key)?.star === true

export function addWorkingDays(d: Date, days: number): Date {
  const out = new Date(d.getTime())
  let left = days
  while (left > 0) {
    out.setUTCDate(out.getUTCDate() + 1)
    const dow = out.getUTCDay()
    if (dow !== 0 && dow !== 6) left--
  }
  return out
}

/** The organisation must report within 30 days (5 working days for ★ events) of the event. */
export function reportingDeadline(occurredOn: Date, starred: boolean): Date {
  return starred ? addWorkingDays(occurredOn, 5) : new Date(occurredOn.getTime() + 30 * MS_DAY)
}

export const EVENT_DECISIONS = ['reinstate', 're_scope', 'withdraw'] as const
export type EventDecision = (typeof EVENT_DECISIONS)[number]

/** Status after the validator decides on a reported event. Other open events keep it suspended. */
export function statusAfterDecision(decision: EventDecision, otherOpenEvents: number): Exclude<StoredStatus, 'superseded'> {
  if (decision === 'withdraw') return 'withdrawn'
  return otherOpenEvents > 0 ? 'suspended' : 'current'
}

// --- Reminders -------------------------------------------------------------------
export const REMINDER_OFFSETS = [30, 7] as const
export type ReminderKind = 'follow_up' | 'expiry' | 'surveillance'

export function daysUntil(dueOn: Date | string, now = new Date()): number {
  const t = typeof dueOn === 'string' ? Date.parse(`${dueOn}T00:00:00Z`) : dueOn.getTime()
  const start = Date.parse(`${dateOnly(now)}T00:00:00Z`)
  return Math.round((t - start) / MS_DAY)
}

/**
 * The reminder (30 or 7 days before) to send now, if any: the closest offset reached, once. A job that
 * missed the 30-day mark sends only the 7-day one, never two at once, and nothing after the date.
 */
export function dueReminders(dueOn: Date | string, alreadySent: number[], now = new Date()): number[] {
  const d = daysUntil(dueOn, now)
  if (d < 0) return []
  const reached = REMINDER_OFFSETS.filter((o) => d <= o)
  const closest = reached.length ? Math.min(...reached) : null
  return closest !== null && !alreadySent.includes(closest) ? [closest] : []
}

// --- CIP actions (owner, due date, proof of done) -----------------------------------
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export const isIsoDate = (s: unknown): s is string => typeof s === 'string' && ISO_DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s

/** What stops a CIP action being saved. Owner and due date may be set later, but must be valid if given. */
export function cipActionProblems(a: { text: string; indicatorIds: string[]; owner?: string | null; dueDate?: string | null }): string[] {
  const problems: string[] = []
  if (!a.text.trim()) problems.push('Say what will be done')
  if (!a.indicatorIds.length) problems.push('Link the action to at least one indicator')
  if (a.dueDate != null && a.dueDate !== '' && !isIsoDate(a.dueDate)) problems.push('The due date must be a real date (YYYY-MM-DD)')
  if (a.owner != null && a.owner.length > 200) problems.push('The owner is too long')
  return problems
}

/** Marking an action done needs an owner, a due date and proof it was done (the spec's CIP rule 1). */
export function cipDoneProblems(a: { owner?: string | null; dueDate?: string | null; proof?: string | null }): string[] {
  const problems: string[] = []
  if (!a.owner?.trim()) problems.push('Name the owner before marking the action done')
  if (!a.dueDate || !isIsoDate(a.dueDate)) problems.push('Set the due date before marking the action done')
  if (!a.proof || a.proof.trim().length < 3) problems.push('Add proof that it was done (a document reference or link)')
  return problems
}

export function cipProgress(actions: Array<{ status: string }>): { done: number; total: number } {
  return { done: actions.filter((a) => a.status === 'done' || a.status === 'Completed-Validated').length, total: actions.length }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** "2 of 5 actions done, follow-up due 15 March" (the spec's wording for a consenting funder). */
export function progressLine(p: { done: number; total: number }, followUpDue: string | null, now = new Date()): string {
  const actions = p.total === 0 ? 'No improvement actions yet' : `${p.done} of ${p.total} action${p.total === 1 ? '' : 's'} done`
  if (!followUpDue) return `${actions}, no follow-up scheduled`
  const [y, m, d] = followUpDue.split('-').map(Number)
  return `${actions}, follow-up due ${d} ${MONTHS[m - 1]}${y !== now.getUTCFullYear() ? ` ${y}` : ''}`
}

// --- Checkpoints --------------------------------------------------------------------
export const CHECKPOINT_KINDS = ['surveillance', 'follow_up'] as const
export type CheckpointKind = (typeof CHECKPOINT_KINDS)[number]

/**
 * Keep exactly the right pending checkpoint: at most one pending point per kind, at the date the
 * schedule currently wants. Returns the pending dates to remove and the one to add (null = none).
 */
export function checkpointSyncPlan(existingPending: string[], wanted: string | null): { remove: string[]; add: string | null } {
  if (wanted === null) return { remove: [...existingPending], add: null }
  return { remove: existingPending.filter((d) => d !== wanted), add: existingPending.includes(wanted) ? null : wanted }
}

/**
 * Why the shown status changed, for the history the calendar produces (decisions carry their own reason).
 * `on` is the date it actually happened (the expiry, or the missed follow-up point).
 */
export function derivedStatusReason(to: Status, on?: string | null): string {
  switch (to) {
    case 'expired': return `The validity period ended${on ? ` on ${on}` : ''}`
    case 'follow_up_overdue': return `A follow-up point${on ? ` (${on})` : ''} passed without being recorded`
    case 'current': return 'Back to current: the follow-up was recorded'
    default: return ''
  }
}
