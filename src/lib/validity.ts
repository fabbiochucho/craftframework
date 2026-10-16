// ============================================================================
// CRAFT validator system — validity, statuses, material events and CIP
// follow-up (PR 5)
// ----------------------------------------------------------------------------
// Pure rules shared by /api/validation-lifecycle, the daily scheduled function
// and the pages. See docs/superpowers/specs/2026-10-16-validator-system.md
// ("Validity and statuses" and "CIP and the follow-up schedule").
//
// The one invariant everything here protects: the CIP can bring a check
// FORWARD but can never EXTEND validity. Expiry is computed from the issue date
// and the validity period only (computeExpiry); nothing about CIP actions is an
// input to it, and the only ways it ever moves afterwards are earlier.
// ============================================================================

import type { Outcome } from './validationReview.ts'

const DAY = 86_400_000

// --- validity ---------------------------------------------------------------
export const STANDARD_MONTHS: Record<Outcome, number> = { validated: 12, validated_with_qualifications: 6, not_validated: 0 }
export const EXTENDED_MONTHS = 24
export const SURVEILLANCE_MONTH = 12
export const EXTENDED_MIN_RUNG = 5

/** UTC calendar-month addition that clamps to the last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime())
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d
}

export type ValidityChoice = 'standard' | 'extended' | 'shorter'
export type ValidityPlan = { months: number; choice: ValidityChoice; surveillance: boolean; reason: string }

/**
 * The validity period a validator may issue.
 *  - validated 12 months; with qualifications 6; not validated none.
 *  - rung 5+ validated WITHOUT qualifications may choose 24 months, with a 12-month surveillance check.
 *  - a validator may always choose a SHORTER period, but must name the risk.
 * Anything else (longer than standard, 18 months, 24 at rung 4...) is refused.
 */
export function chooseValidity(i: { outcome: Outcome; rung: number | null; requestedMonths?: number | null; reason?: string | null }): { plan: ValidityPlan | null; problem: string | null } {
  const standard = STANDARD_MONTHS[i.outcome]
  if (i.outcome === 'not_validated') {
    if (i.requestedMonths != null) return { plan: null, problem: 'A "not validated" outcome has no validity period' }
    return { plan: { months: 0, choice: 'standard', surveillance: false, reason: '' }, problem: null }
  }
  const reason = (i.reason ?? '').trim()
  const requested = i.requestedMonths ?? standard
  if (!Number.isInteger(requested) || requested < 1) return { plan: null, problem: 'Validity must be a whole number of months' }
  if (requested === standard) return { plan: { months: standard, choice: 'standard', surveillance: false, reason: '' }, problem: null }
  if (requested < standard) {
    if (!reason) return { plan: null, problem: 'Name the risk that justifies a shorter validity period' }
    return { plan: { months: requested, choice: 'shorter', surveillance: false, reason }, problem: null }
  }
  if (requested === EXTENDED_MONTHS) {
    if (i.outcome !== 'validated') return { plan: null, problem: 'Only a validation without qualifications can run for 24 months' }
    if ((i.rung ?? 0) < EXTENDED_MIN_RUNG) return { plan: null, problem: `A 24-month validity needs rung ${EXTENDED_MIN_RUNG} or above` }
    return { plan: { months: EXTENDED_MONTHS, choice: 'extended', surveillance: true, reason }, problem: null }
  }
  return { plan: null, problem: `Validity can be ${standard} months, shorter for a named risk${i.outcome === 'validated' ? `, or ${EXTENDED_MONTHS} months at rung ${EXTENDED_MIN_RUNG}+ with no qualifications` : ''}` }
}

/** Expiry depends on the issue date and the validity period ONLY — never on the CIP. */
export function computeExpiry(issuedAt: Date, plan: Pick<ValidityPlan, 'months'>): Date {
  return addMonths(issuedAt, plan.months)
}

/** The surveillance point of a 24-month validity: month 12. */
export function surveillanceDue(issuedAt: Date): Date { return addMonths(issuedAt, SURVEILLANCE_MONTH) }

/**
 * Validity can only be shortened after issue (a named risk, a missed surveillance check, withdrawal).
 * Returns the new expiry, or null when `proposed` would not be earlier — it never extends.
 */
export function shortenedExpiry(current: Date, proposed: Date): Date | null {
  return proposed.getTime() < current.getTime() ? proposed : null
}

// --- statuses ---------------------------------------------------------------
export const VALIDATION_STATUSES = ['current', 'follow_up_overdue', 'suspended', 'expired', 'withdrawn', 'superseded'] as const
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number]
export const STATUS_LABEL: Record<ValidationStatus, string> = {
  current: 'Current', follow_up_overdue: 'Follow-up overdue', suspended: 'Suspended', expired: 'Expired', withdrawn: 'Withdrawn', superseded: 'Superseded',
}
/** Statuses that never change again except by adding history. */
export const TERMINAL_STATUSES: ValidationStatus[] = ['expired', 'withdrawn', 'superseded']

export type CheckpointKind = 'surveillance' | 'follow_up'
export type CheckpointState = 'pending' | 'done'
export type CheckpointLite = { kind: CheckpointKind; dueAt: Date; state: CheckpointState }

/**
 * The status a validation should have at `now`.
 *  - withdrawn / superseded / expired are final.
 *  - suspended holds until a validator resolves it, but a suspension can never carry a validation past its expiry.
 *  - a 24-month validity whose month-12 surveillance check was missed expires at month 12.
 *  - a missed follow-up point makes it "follow-up overdue"; completing it returns it to current.
 */
export function deriveStatus(i: { status: ValidationStatus; now: Date; expiresAt: Date | null; checkpoints: CheckpointLite[] }): { status: ValidationStatus; expiresAt: Date | null; reason: string } {
  const { status, now, checkpoints } = i
  let expiresAt = i.expiresAt
  if (status === 'withdrawn' || status === 'superseded' || status === 'expired') return { status, expiresAt, reason: '' }
  if (expiresAt === null) return { status, expiresAt, reason: '' } // not-validated outcomes carry no validity
  const missedSurveillance = checkpoints.filter((c) => c.kind === 'surveillance' && c.state === 'pending' && c.dueAt.getTime() < now.getTime())
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0]
  if (missedSurveillance) {
    const earlier = shortenedExpiry(expiresAt, missedSurveillance.dueAt)
    if (earlier) expiresAt = earlier
  }
  if (now.getTime() >= expiresAt.getTime()) {
    return { status: 'expired', expiresAt, reason: missedSurveillance ? 'The 12-month surveillance check was missed, so validity ended at month 12' : 'The validity period ended' }
  }
  if (status === 'suspended') return { status, expiresAt, reason: '' }
  const overdue = checkpoints.some((c) => c.kind === 'follow_up' && c.state === 'pending' && c.dueAt.getTime() < now.getTime())
  if (overdue) return { status: 'follow_up_overdue', expiresAt, reason: 'A follow-up check passed its due date' }
  return { status: 'current', expiresAt, reason: status === 'current' ? '' : 'The overdue follow-up was completed' }
}

/** Allowed manual moves (a status change by a person, not by the clock). */
export function mayMove(from: ValidationStatus, to: ValidationStatus): boolean {
  if (TERMINAL_STATUSES.includes(from)) return false
  if (to === 'suspended') return from === 'current' || from === 'follow_up_overdue'
  if (to === 'withdrawn') return true
  if (to === 'superseded') return true
  // Reinstating leaves "suspended"; the new status is then derived from the dates.
  if (from === 'suspended') return to === 'current' || to === 'follow_up_overdue'
  return false
}

// --- follow-up schedule -----------------------------------------------------
export const FOLLOW_UP_KINDS = ['milestone', 'fixed_3', 'fixed_6', 'end_of_plan'] as const
export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number]
export const DEFAULT_FOLLOW_UP: FollowUpKind = 'milestone'
export const FOLLOW_UP_LABEL: Record<FollowUpKind, string> = {
  milestone: 'Milestone-based (all qualified or blocking items done)', fixed_3: 'Every 3 months', fixed_6: 'Every 6 months', end_of_plan: 'End of plan (all actions done)',
}
/** A follow-up never falls inside this window before expiry, so it can always precede it. */
export const LAST_CHECK_BEFORE_EXPIRY_DAYS = 14
export const BRING_FORWARD_DAYS = 14

export type ActionLite = { dueDate: string | null; done: boolean; indicatorIds: string[] }
export type PlannedCheckpoint = { kind: CheckpointKind; dueAt: Date }

const isoDate = (s: string | null): Date | null => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? new Date(`${s}T00:00:00.000Z`) : null)

/** Clamp a check inside [issuedAt, expiresAt - 14 days]: a follow-up can never be scheduled at or after expiry. */
export function clampPoint(d: Date, issuedAt: Date, expiresAt: Date): Date {
  const latest = new Date(Math.max(issuedAt.getTime(), expiresAt.getTime() - LAST_CHECK_BEFORE_EXPIRY_DAYS * DAY))
  return new Date(Math.min(Math.max(d.getTime(), issuedAt.getTime()), latest.getTime()))
}

/** Actions whose indicators are in the follow-up scope (qualified or blocking). */
export const inFollowUpScope = (a: ActionLite, scope: string[]) => a.indicatorIds.some((x) => scope.includes(x))

/**
 * The checkpoints a schedule creates.
 *  - 24-month validity: always a surveillance check at month 12.
 *  - fixed_3 / fixed_6: a follow-up every N months strictly before expiry.
 *  - milestone: one follow-up at the latest due date of the qualified/blocking actions (mid-validity with none).
 *  - end_of_plan: one follow-up at the latest due date of ALL actions (mid-validity with none).
 * All dates are clamped before expiry; none can extend it.
 */
export function planCheckpoints(i: { issuedAt: Date; expiresAt: Date; months: number; surveillance: boolean; kind: FollowUpKind; actions: ActionLite[]; scope: string[] }): PlannedCheckpoint[] {
  const out: PlannedCheckpoint[] = []
  if (i.surveillance) out.push({ kind: 'surveillance', dueAt: surveillanceDue(i.issuedAt) })
  if (i.kind === 'fixed_3' || i.kind === 'fixed_6') {
    const step = i.kind === 'fixed_3' ? 3 : 6
    for (let m = step; m < i.months; m += step) out.push({ kind: 'follow_up', dueAt: addMonths(i.issuedAt, m) })
    return out
  }
  const mid = addMonths(i.issuedAt, Math.max(1, Math.floor(i.months / 2)))
  const pool = i.kind === 'milestone' ? i.actions.filter((a) => inFollowUpScope(a, i.scope)) : i.actions
  const dates = pool.map((a) => isoDate(a.dueDate)).filter((d): d is Date => !!d)
  const target = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : mid
  out.push({ kind: 'follow_up', dueAt: clampPoint(target, i.issuedAt, i.expiresAt) })
  return out
}

/** True when the plan's trigger is met: every action the schedule waits for is done. */
export function milestoneMet(kind: FollowUpKind, actions: ActionLite[], scope: string[]): boolean {
  if (kind !== 'milestone' && kind !== 'end_of_plan') return false
  const pool = kind === 'milestone' ? actions.filter((a) => inFollowUpScope(a, scope)) : actions
  return pool.length > 0 && pool.every((a) => a.done)
}

/**
 * The CIP can bring a pending check FORWARD, never push it back. When the milestone is met the check is due
 * within 14 days (or at its existing date if that is sooner). The result is never later than `current`.
 */
export function bringForward(current: Date, now: Date, met: boolean): Date {
  if (!met) return current
  const soon = new Date(now.getTime() + BRING_FORWARD_DAYS * DAY)
  return soon.getTime() < current.getTime() ? soon : current
}

/** Progress for the engaging funder, e.g. "2 of 5 actions done, follow-up due 15 March". */
export function progressSentence(done: number, total: number, nextDue: Date | null): string {
  const base = `${done} of ${total} action${total === 1 ? '' : 's'} done`
  if (!nextDue) return base
  return `${base}, follow-up due ${nextDue.getUTCDate()} ${nextDue.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })}`
}

// --- reminders --------------------------------------------------------------
export const REMINDER_DAYS = [30, 7] as const

/**
 * Which reminder (if any) a point needs today. Reminders go 30 and 7 days before the point. If the daily run
 * missed a day, only the tightest threshold now crossed is sent (never both at once), and the looser ones
 * count as satisfied. Points already past are never reminded.
 */
export function reminderDue(dueAt: Date, now: Date, sent: number[]): number | null {
  const left = (dueAt.getTime() - now.getTime()) / DAY
  if (left <= 0) return null
  const crossed = REMINDER_DAYS.filter((d) => left <= d)
  if (!crossed.length) return null
  const tightest = Math.min(...crossed)
  return sent.includes(tightest) ? null : tightest
}

// --- working days / material events -------------------------------------------
export const MATERIAL_EVENTS = [
  { key: 'fraud_corruption', starred: true, label: 'Fraud, theft, bribery or corruption involving funds, staff or board' },
  { key: 'criminal_investigation', starred: true, label: 'Criminal investigation or charge against the organisation or a board member / senior manager in their role' },
  { key: 'audit_opinion', starred: false, label: 'Qualified, adverse or disclaimer audit opinion, or going-concern warning' },
  { key: 'insolvency', starred: false, label: 'Insolvency, inability to pay staff or creditors on time, or loss of a funder providing 25%+ of income' },
  { key: 'funder_action', starred: false, label: 'A funder suspending, terminating or demanding repayment of a grant for cause' },
  { key: 'regulator_sanction', starred: true, label: "Regulator's sanction, suspension or loss of a needed licence or registration" },
  { key: 'sanctions_list', starred: false, label: 'Placement on a sanctions or debarment list' },
  { key: 'leadership_change', starred: false, label: 'Change of CEO, CFO or board chair' },
  { key: 'board_resignations', starred: false, label: 'Half or more of the board resigning within 12 months' },
  { key: 'corporate_change', starred: false, label: 'Merger, acquisition, split, change of legal form or control' },
  { key: 'restructuring', starred: false, label: 'Restructuring that changes the activities, locations or programmes covered' },
  { key: 'records_loss', starred: false, label: 'Loss of systems or records that prevents evidencing the controls relied on' },
  { key: 'safeguarding_data', starred: true, label: 'Substantiated safeguarding / SEA case, or serious data-protection breach reported to a regulator' },
] as const
export type MaterialEventKey = (typeof MATERIAL_EVENTS)[number]['key']
export const MATERIAL_EVENT_KEYS = MATERIAL_EVENTS.map((e) => e.key) as [MaterialEventKey, ...MaterialEventKey[]]
export const materialEvent = (key: string) => MATERIAL_EVENTS.find((e) => e.key === key) ?? null

export const REPORT_CALENDAR_DAYS = 30
export const REPORT_STARRED_WORKING_DAYS = 5

/** `n` working days (Monday to Friday) after `from`. No public-holiday calendar is applied. */
export function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from.getTime())
  let left = n
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const w = d.getUTCDay()
    if (w !== 0 && w !== 6) left -= 1
  }
  return d
}

/** When the organisation must have reported an event that happened on `occurredOn`. */
export function reportingDeadline(key: string, occurredOn: Date): Date | null {
  const ev = materialEvent(key)
  if (!ev) return null
  return ev.starred ? addWorkingDays(occurredOn, REPORT_STARRED_WORKING_DAYS) : new Date(occurredOn.getTime() + REPORT_CALENDAR_DAYS * DAY)
}

/** Reported after the deadline (compared by calendar day). Failing to report is grounds for withdrawal. */
export function reportedLate(key: string, occurredOn: Date, reportedAt: Date): boolean {
  const deadline = reportingDeadline(key, occurredOn)
  if (!deadline) return false
  const day = (d: Date) => Math.floor(d.getTime() / DAY)
  return day(reportedAt) > day(deadline)
}

export const EVENT_STATUSES = ['pending_review', 'reinstated', 're_scoped', 'withdrawn'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]
export const EVENT_DECISIONS = ['reinstate', 'rescope', 'withdraw'] as const
export type EventDecision = (typeof EVENT_DECISIONS)[number]

/** What the validator's decision on one event does to the validation, given the other open events. */
export function decideEvent(decision: EventDecision, otherPending: number): { eventStatus: EventStatus; keepSuspended: boolean; withdraw: boolean } {
  if (decision === 'withdraw') return { eventStatus: 'withdrawn', keepSuspended: false, withdraw: true }
  return { eventStatus: decision === 'reinstate' ? 'reinstated' : 're_scoped', keepSuspended: otherPending > 0, withdraw: false }
}

// --- verification id ----------------------------------------------------------
const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I, O, 0, 1: readable when typed from a PDF

/** Random, non-sequential: CRAFT-V- plus 8 base32 characters. `bytes` must come from a CSPRNG. */
export function verificationIdFrom(bytes: Uint8Array): string {
  if (bytes.length < 8) throw new Error('need 8 random bytes')
  let s = ''
  for (let i = 0; i < 8; i++) s += BASE32[bytes[i] % 32]
  return `CRAFT-V-${s}`
}
export const VERIFICATION_ID_PATTERN = /^CRAFT-V-[A-HJ-NP-Z2-9]{8}$/
