// The lifecycle email programme's rules: what is due when, the send window, the frequency cap and which email wins
// a collision. Pure (no I/O, no env), so the whole schedule is unit-testable; netlify/lib/lifecycle.ts feeds it
// from the database and sends what it decides.
//
// Everything is relative to a person's onboarding completed_at. Days are UTC calendar days throughout, so a
// 14-day cap measured from 09:00:05 one Tuesday still lets the 09:00:00 run two Tuesdays later through.

export type LifecycleKind = 'nudge_2w' | 'feedback_1m' | 'milestone' | 'checkin'
export type LifecycleCategory = 'checkins' | 'celebrations'

export const LIFECYCLE_KINDS: LifecycleKind[] = ['nudge_2w', 'feedback_1m', 'milestone', 'checkin']
export const KIND_LABEL: Record<LifecycleKind, string> = {
  nudge_2w: '2-week nudge', feedback_1m: '1-month feedback', milestone: 'Milestone celebration', checkin: 'Check-in',
}
// What a person can switch off. Welcome, invites, security and validation notices are transactional and not covered.
export const CATEGORY_LABEL: Record<LifecycleCategory, string> = { checkins: 'Check-ins and feedback', celebrations: 'Celebrations' }
export const CATEGORY_HELP: Record<LifecycleCategory, string> = {
  checkins: 'The two-week “ready for your assessment?” nudge, the one-month feedback request and occasional check-ins when you have been away.',
  celebrations: 'Three-month, six-month and anniversary messages marking how long your organisation has been on CRAFT.',
}
export const categoryOf = (kind: LifecycleKind): LifecycleCategory => (kind === 'milestone' ? 'celebrations' : 'checkins')

export const NUDGE_DAY = 14
export const FEEDBACK_DAY = 30
/** At most one lifecycle email per person in this many days. */
export const CAP_DAYS = 14
/** A check-in needs this many days without a sign-in … */
export const INACTIVE_DAYS = 30
/** … and at most one is sent in this many days. */
export const CHECKIN_GAP_DAYS = 90
/** The two-week and one-month emails say “it has been two weeks / a month”; later than this they would be wrong. */
export const STALE_AFTER_DAYS = 28
/** Survey links stop working this long after the email was sent. */
export const SURVEY_TTL_DAYS = 60
/** A failed send is tried again on later send days, this many attempts in all. */
export const MAX_ATTEMPTS = 3
/** Tuesday, Wednesday, Thursday (Date#getUTCDay). */
export const SEND_WEEKDAYS = [2, 3, 4]

export const MS_DAY = 86_400_000
/** Whole days since the Unix epoch, UTC. */
export const utcDay = (d: Date): number => Math.floor(d.getTime() / MS_DAY)
/** UTC calendar days from `a` to `b` (negative when b is earlier). */
export const daysBetweenUtc = (a: Date, b: Date): number => utcDay(b) - utcDay(a)

export const isSendDay = (d: Date): boolean => SEND_WEEKDAYS.includes(d.getUTCDay())

/** Adds calendar months in UTC, clamping to the end of a shorter month (31 Aug + 6 months = 28/29 Feb). */
export function addMonthsUtc(d: Date, months: number): Date {
  const out = new Date(d.getTime())
  const day = out.getUTCDate()
  out.setUTCDate(1)
  out.setUTCMonth(out.getUTCMonth() + months)
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate()
  out.setUTCDate(Math.min(day, last))
  return out
}

// --- milestones: 3, 6, 12 months, then every 6 months -------------------------------------------------------
export const isMilestoneMonths = (m: number): boolean => Number.isInteger(m) && (m === 3 || m === 6 || (m >= 12 && m % 6 === 0))
/** The nth milestone in months (0 -> 3, 1 -> 6, 2 -> 12, 3 -> 18, …). */
export const milestoneMonthsAt = (index: number): number => (index === 0 ? 3 : index === 1 ? 6 : 12 + (index - 2) * 6)

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
const word = (n: number): string => WORDS[n] ?? String(n)
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** 'three months', 'six months', 'one year', 'one and a half years', 'two years', 'two and a half years', … */
export function milestoneLabel(months: number): string {
  if (months < 12) return `${word(months)} months`
  const years = Math.floor(months / 12)
  if (months % 12 === 0) return years === 1 ? 'one year' : `${word(years)} years`
  return `${word(years)} and a half years`
}

/** 'Three months on CRAFT, Amina!', 'Happy one-year CRAFT anniversary, Amina!', 'One and a half years on CRAFT, Amina!' */
export function milestoneSubject(months: number, first: string): string {
  if (months < 12) return `${capital(milestoneLabel(months))} on CRAFT, ${first}!`
  if (months % 12 === 0) return `Happy ${word(months / 12)}-year CRAFT anniversary, ${first}!`
  return `${capital(milestoneLabel(months))} on CRAFT, ${first}!`
}
/** The 12-month milestone and every anniversary after it (whole years) also invite feedback. */
export const milestoneAsksFeedback = (months: number): boolean => months >= 12 && months % 12 === 0

// --- what falls due when --------------------------------------------------------------------------------------
export type DueItem = { kind: LifecycleKind; occurrence: number; dueAt: Date }

export function dueAtFor(kind: 'nudge_2w' | 'feedback_1m' | 'milestone', completedAt: Date, occurrence = 1): Date {
  if (kind === 'nudge_2w') return new Date(completedAt.getTime() + NUDGE_DAY * MS_DAY)
  if (kind === 'feedback_1m') return new Date(completedAt.getTime() + FEEDBACK_DAY * MS_DAY)
  return addMonthsUtc(completedAt, occurrence)
}

/** Scheduled (non check-in) items whose due time lies in [from, to). `occurrence` is 1 for the one-offs and the month count for milestones. */
export function scheduledItems(completedAt: Date, from: Date, to: Date): DueItem[] {
  const out: DueItem[] = []
  const within = (d: Date) => d.getTime() >= from.getTime() && d.getTime() < to.getTime()
  const nudge = dueAtFor('nudge_2w', completedAt)
  if (within(nudge)) out.push({ kind: 'nudge_2w', occurrence: 1, dueAt: nudge })
  const feedback = dueAtFor('feedback_1m', completedAt)
  if (within(feedback)) out.push({ kind: 'feedback_1m', occurrence: 1, dueAt: feedback })
  for (let i = 0; ; i++) {
    const months = milestoneMonthsAt(i)
    const due = dueAtFor('milestone', completedAt, months)
    if (due.getTime() >= to.getTime()) break
    if (within(due)) out.push({ kind: 'milestone', occurrence: months, dueAt: due })
  }
  return out.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
}

/** Everything scheduled that has fallen due by `now`. */
export const dueItems = (completedAt: Date, now: Date): DueItem[] => scheduledItems(completedAt, new Date(0), new Date(now.getTime() + 1))

// --- planning one person's next email -------------------------------------------------------------------------
export type SentOutcome = 'pending' | 'accepted' | 'failed' | 'not_configured' | 'skipped'
export type SentRow = { kind: LifecycleKind; occurrence: number; at: Date | null; outcome: SentOutcome; attempts: number }

export type PlanInput = {
  completedAt: Date
  lastSeenAt: Date | null
  now: Date
  optedOut: Record<LifecycleCategory, boolean>
  startedAssessment: boolean
  history: SentRow[]
}
export type SkipReason = 'assessment_started' | 'expired' | 'superseded'
export type PlanResult = {
  send: { kind: LifecycleKind; occurrence: number } | null
  /** Items that are due but will never be sent; the engine records them so they are not looked at again. */
  skips: Array<{ kind: LifecycleKind; occurrence: number; reason: SkipReason }>
  /** Why something that is due was held back. */
  waiting: 'cap' | null
}

const PRIORITY: Record<LifecycleKind, number> = { milestone: 0, feedback_1m: 1, nudge_2w: 2, checkin: 3 }
const retryable = (r: SentRow) => r.outcome === 'failed' && r.attempts < MAX_ATTEMPTS
/** A row that has used up its occurrence: sent, being sent, recorded as skipped, or failed too often. */
const consumes = (r: SentRow) => !retryable(r)
/** Rows that count towards the cap and the check-in gap: delivered, or being sent right now. */
const counts = (r: SentRow) => (r.outcome === 'accepted' || r.outcome === 'pending') && r.at !== null

export function planForPerson(i: PlanInput): PlanResult {
  const skips: PlanResult['skips'] = []
  const used = new Set(i.history.filter(consumes).map((r) => `${r.kind}:${r.occurrence}`))
  const open = (kind: LifecycleKind, occurrence: number) => !used.has(`${kind}:${occurrence}`)
  const candidates: Array<{ kind: LifecycleKind; occurrence: number }> = []

  // Milestones: if several are due at once (a long pause, or an organisation that was already old when this
  // started), only the latest is sent; the earlier ones are recorded as superseded rather than sent in a row.
  const milestones = dueItems(i.completedAt, i.now).filter((d) => d.kind === 'milestone' && open('milestone', d.occurrence))
  if (!i.optedOut.celebrations && milestones.length) {
    const latest = milestones[milestones.length - 1]
    for (const m of milestones.slice(0, -1)) skips.push({ kind: 'milestone', occurrence: m.occurrence, reason: 'superseded' })
    candidates.push({ kind: 'milestone', occurrence: latest.occurrence })
  }
  if (!i.optedOut.checkins) {
    for (const d of dueItems(i.completedAt, i.now)) {
      if ((d.kind !== 'nudge_2w' && d.kind !== 'feedback_1m') || !open(d.kind, d.occurrence)) continue
      if (daysBetweenUtc(d.dueAt, i.now) > STALE_AFTER_DAYS) skips.push({ kind: d.kind, occurrence: d.occurrence, reason: 'expired' })
      else if (d.kind === 'nudge_2w' && i.startedAssessment) skips.push({ kind: d.kind, occurrence: d.occurrence, reason: 'assessment_started' })
      else candidates.push({ kind: d.kind, occurrence: d.occurrence })
    }
    // Check-in: away 30+ days, and none counted in the last 90.
    const lastCheckin = i.history.filter((r) => r.kind === 'checkin' && counts(r)).reduce<Date | null>((a, r) => (!a || r.at! > a ? r.at : a), null)
    const away = daysBetweenUtc(i.lastSeenAt && i.lastSeenAt > i.completedAt ? i.lastSeenAt : i.completedAt, i.now) >= INACTIVE_DAYS
    if (away && (!lastCheckin || daysBetweenUtc(lastCheckin, i.now) >= CHECKIN_GAP_DAYS)) {
      const checkins = i.history.filter((r) => r.kind === 'checkin')
      const again = checkins.find(retryable)
      candidates.push({ kind: 'checkin', occurrence: again?.occurrence ?? Math.max(0, ...checkins.map((r) => r.occurrence)) + 1 })
    }
  }
  const next = candidates.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.occurrence - b.occurrence)[0]
  if (!next) return { send: null, skips, waiting: null }
  const lastSent = i.history.filter(counts).reduce<Date | null>((a, r) => (!a || r.at! > a ? r.at : a), null)
  if (lastSent && daysBetweenUtc(lastSent, i.now) < CAP_DAYS) return { send: null, skips, waiting: 'cap' }
  return { send: next, skips, waiting: null }
}

// --- variants -------------------------------------------------------------------------------------------------
/** 1-month email: ACTIVE when the person signed in on a later day than onboarding, or the organisation has done anything since. */
export function isActive(completedAt: Date, lastSeenAt: Date | null, orgActivity: boolean): boolean {
  return orgActivity || (lastSeenAt !== null && daysBetweenUtc(completedAt, lastSeenAt) > 0)
}

export type OrgProgress = {
  assessmentsCompleted: number
  /** First rung recorded for the organisation, and where it is now (0-7). Null when never measured. */
  startRung: number | null
  currentRung: number | null
  actionsCompleted: number
  documents: number
  /** The rung of a current independent validation, if the organisation has one. */
  validatedRung: number | null
}
export const EMPTY_PROGRESS: OrgProgress = { assessmentsCompleted: 0, startRung: null, currentRung: null, actionsCompleted: 0, documents: 0, validatedRung: null }

/** Milestone emails show real numbers only when there is at least one non-zero thing to show. */
export function hasProgress(p: OrgProgress): boolean {
  return p.assessmentsCompleted > 0 || (p.currentRung ?? 0) > 0 || p.actionsCompleted > 0 || p.documents > 0 || (p.validatedRung ?? 0) > 0
}

/** The first Tuesday/Wednesday/Thursday on or after `d` (UTC), at the same time of day. */
export function nextSendDay(d: Date): Date {
  const out = new Date(d.getTime())
  while (!isSendDay(out)) out.setTime(out.getTime() + MS_DAY)
  return out
}

/** Accounts that are never emailed: the throwaway demo sessions. */
export const isDemoEmail = (email: string): boolean => /@craft\.demo$/i.test(email) || /\.demo$/i.test(email.split('@')[1] ?? '') || /^demo[._+-]?@/i.test(email)

/** The survey a lifecycle email links to: one per kind/occurrence, so a person can answer each separately. */
export const surveyOccurrence = (kind: LifecycleKind, occurrence: number): string => (kind === 'milestone' ? `milestone_${occurrence}` : kind)
/** Which emails carry a survey link: the 1-month email always, milestones on anniversaries. */
export const emailHasSurvey = (kind: LifecycleKind, occurrence: number, variant: string): boolean =>
  kind === 'feedback_1m' || (kind === 'milestone' && variant === 'progress' && milestoneAsksFeedback(occurrence))
