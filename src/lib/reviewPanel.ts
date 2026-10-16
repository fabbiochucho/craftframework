// Validator system PR 7b — the Independent Review Panel (spec: "Independent Review Panel (disputes and
// complaints only)"). Pure rules, no I/O: what cases exist, who may sit, how a majority decides, the clocks.
// The server (netlify/functions/review-panel.mts) loads facts and enforces every rule here.

export const CASE_KINDS = ['validation_dispute', 'validator_complaint', 'contested_event', 're_review_challenge', 'feedback_complaint'] as const
export type CaseKind = (typeof CASE_KINDS)[number]
export const CASE_KIND_LABEL: Record<CaseKind, string> = {
  validation_dispute: 'Dispute about a validation’s result',
  validator_complaint: 'Complaint about a validator’s conduct',
  contested_event: 'Contested material event or suspension',
  re_review_challenge: 'Challenge to a re-review outcome',
  feedback_complaint: 'Complaint about feedback given to a validator',
}

export const RAISED_SIDES = ['organisation', 'funder', 'validator', 'programme'] as const
export type RaisedSide = (typeof RAISED_SIDES)[number]

/** open: no panel yet · responses: panel seated, both sides write · deliberating: members vote · decided: final. */
export const CASE_STATUSES = ['open', 'responses', 'deliberating', 'decided'] as const
export type CaseStatus = (typeof CASE_STATUSES)[number]
export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  open: 'Waiting for a panel', responses: 'Written responses', deliberating: 'Panel deliberating', decided: 'Decided',
}

export const PANEL_ROLES = ['convenor', 'reviewer'] as const
export type PanelRole = (typeof PANEL_ROLES)[number]
export const MEMBER_STATUSES = ['invited', 'accepted', 'declined'] as const
export const ROSTER_KINDS = ['senior_validator', 'external_auditor'] as const
export type RosterKind = (typeof ROSTER_KINDS)[number]
export const ROSTER_KIND_LABEL: Record<RosterKind, string> = { senior_validator: 'Senior Validator', external_auditor: 'Outside chartered accountant / auditor' }

// ---- Outcomes ----------------------------------------------------------------------------------------------
// A decision is the three parts below. "Dismissed" is not a field: it is a decision with nothing to act on.

export const VALIDATION_OUTCOMES = ['none', 'stands', 'amended', 'suspended', 'withdrawn'] as const
export type ValidationOutcome = (typeof VALIDATION_OUTCOMES)[number]
export const VALIDATION_OUTCOME_LABEL: Record<ValidationOutcome, string> = {
  none: 'No finding about the validation', stands: 'The validation stands (reinstated if suspended)', amended: 'The validation is amended (recorded; re-issue needed)',
  suspended: 'The validation is suspended', withdrawn: 'The validation is withdrawn',
}
export const VALIDATOR_OUTCOMES = ['none', 'warned', 'retrain', 'suspended', 'removed'] as const
export type ValidatorOutcome = (typeof VALIDATOR_OUTCOMES)[number]
export const VALIDATOR_OUTCOME_LABEL: Record<ValidatorOutcome, string> = {
  none: 'No action against the validator', warned: 'Validator warned', retrain: 'Validator must retrain (accreditation lapses until renewed)',
  suspended: 'Validator suspended', removed: 'Validator removed',
}
export const FEEDBACK_OUTCOMES = ['none', 'keep', 'remove'] as const
export type FeedbackOutcome = (typeof FEEDBACK_OUTCOMES)[number]
export const FEEDBACK_GROUNDS = ['false', 'abusive', 'personal_data', 'not_a_party'] as const
export type FeedbackGround = (typeof FEEDBACK_GROUNDS)[number]

export type Decision = { validation: ValidationOutcome; validator: ValidatorOutcome; feedback: FeedbackOutcome; feedbackGround?: FeedbackGround }

/** Dismissed: nothing is changed against anyone (the validation stands or no finding, no action, feedback kept). */
export function isDismissal(d: Decision): boolean {
  return (d.validation === 'none' || d.validation === 'stands') && d.validator === 'none' && (d.feedback === 'none' || d.feedback === 'keep')
}
export function decisionLabel(d: Decision): string {
  if (isDismissal(d)) return d.validation === 'stands' ? 'Dismissed — the validation stands' : 'Dismissed'
  const parts: string[] = []
  if (d.validation !== 'none') parts.push(VALIDATION_OUTCOME_LABEL[d.validation])
  if (d.validator !== 'none') parts.push(VALIDATOR_OUTCOME_LABEL[d.validator])
  if (d.feedback === 'remove') parts.push('Feedback removed')
  return parts.join('; ')
}

/** Which parts of a decision a case kind can speak to. Anything else must be 'none'. */
export function decisionProblems(kind: CaseKind, d: Decision): string[] {
  const out: string[] = []
  if (!VALIDATION_OUTCOMES.includes(d.validation) || !VALIDATOR_OUTCOMES.includes(d.validator) || !FEEDBACK_OUTCOMES.includes(d.feedback)) return ['Choose a valid outcome']
  if (kind === 'feedback_complaint') {
    if (d.validation !== 'none' || d.validator !== 'none') out.push('A complaint about feedback can only keep or remove that feedback')
    if (d.feedback === 'none') out.push('Choose whether the feedback is kept or removed')
    if (d.feedback === 'remove' && !(d.feedbackGround && FEEDBACK_GROUNDS.includes(d.feedbackGround))) out.push('Give the ground for removing the feedback')
  } else {
    if (d.feedback !== 'none') out.push('This kind of case does not decide feedback')
    if (kind === 'validator_complaint' && d.validation === 'amended') out.push('A complaint about conduct cannot amend a validation')
  }
  return out
}

export const decisionKey = (d: Decision) => `${d.validation}|${d.validator}|${d.feedback}|${d.feedback === 'remove' ? d.feedbackGround ?? '' : ''}`

/** The decision that at least 2 of the 3 panel members voted for, or null (no majority yet). */
export function majority(votes: Decision[], size = 3): Decision | null {
  const need = Math.floor(size / 2) + 1
  const counts = new Map<string, { n: number; d: Decision }>()
  for (const v of votes) {
    const k = decisionKey(v)
    counts.set(k, { n: (counts.get(k)?.n ?? 0) + 1, d: v })
  }
  for (const { n, d } of counts.values()) if (n >= need) return d
  return null
}

// ---- Clocks ----------------------------------------------------------------------------------------------------
export const RESPONSE_DAYS = 14
export const DECISION_DAYS = 30
export const APPEAL_DAYS = 14
export const CONFLICT_YEARS = 3
const DAY = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)

export function caseClock(convenedAt: Date) {
  return { respondBy: iso(addDays(convenedAt, RESPONSE_DAYS)), decideBy: iso(addDays(convenedAt, DECISION_DAYS)) }
}
export const appealDeadline = (decidedAt: Date) => iso(addDays(decidedAt, APPEAL_DAYS))
/** True while the decision is still within its 30 days (or already decided). */
export const isOverdue = (c: { status: string; decideBy: string | null }, now = new Date()) => c.status !== 'decided' && !!c.decideBy && c.decideBy < iso(now)
export const appealOpen = (c: { status: string; appealBy: string | null; hasAppeal: boolean; isAppeal: boolean }, now = new Date()) =>
  c.status === 'decided' && !c.hasAppeal && !c.isAppeal && !!c.appealBy && c.appealBy >= iso(now)
/** Both sides have had time, or the response window has passed. */
export function mayDeliberate(i: { status: string; respondBy: string | null; sidesHeard: number }, now = new Date()): boolean {
  return i.status === 'responses' && (i.sidesHeard >= 2 || (!!i.respondBy && i.respondBy < iso(now)))
}

// ---- Who may sit -------------------------------------------------------------------------------------------------
export type ConflictFacts = {
  reviewer: string
  isPlatformAdmin: boolean
  /** Emails of the people in the case: the validator concerned, the raiser, the organisation's staff, the funder's staff. */
  parties: string[]
  reviewerFirmIds: string[]
  /** Firms of the validator concerned and of the funding partner involved. */
  partyFirmIds: string[]
  /** A named member of an engagement with the organisation, or with the validator concerned, within CONFLICT_YEARS. */
  workedWithPartyRecently: boolean
  /** Members of earlier panels in the same case chain: a fresh appeal panel shares none. */
  earlierPanelMembers: string[]
}

export function conflictReasons(f: ConflictFacts): string[] {
  const out: string[] = []
  const me = f.reviewer.toLowerCase()
  if (f.isPlatformAdmin) out.push('Platform administrators do not sit on a panel')
  if (f.parties.some((p) => p.toLowerCase() === me)) out.push('They are a party to the case')
  if (f.reviewerFirmIds.some((id) => f.partyFirmIds.includes(id))) out.push('They are in the same firm as the validator concerned (or the funder involved)')
  if (f.workedWithPartyRecently) out.push(`They worked for or with a party within the last ${CONFLICT_YEARS} years`)
  if (f.earlierPanelMembers.some((p) => p.toLowerCase() === me)) out.push('They sat on an earlier panel in this case; an appeal has a fresh panel')
  return out
}

export type SeatMember = { role: string; status: string }
/** One convenor and two reviewers, all accepted. */
export function panelSeated(members: SeatMember[]): boolean {
  const ok = members.filter((m) => m.status === 'accepted')
  return ok.filter((m) => m.role === 'convenor').length === 1 && ok.filter((m) => m.role === 'reviewer').length === 2
}
/** Seats still open (declined seats are free again). */
export function seatsFree(members: SeatMember[], role: PanelRole): number {
  const taken = members.filter((m) => m.role === role && m.status !== 'declined').length
  return Math.max(0, (role === 'convenor' ? 1 : 2) - taken)
}

/** Which side of a case a person is on, for labelling written responses. */
export const SIDES = ['organisation', 'validator', 'funder', 'other'] as const
export type Side = (typeof SIDES)[number]

/** The exact statement a panel member signs to accept a seat. Stored with their acceptance. */
export const NO_CONFLICT_DECLARATION = 'I confirm I have no conflict of interest in this case: I am not a party to it, I am not in the same firm as the validator concerned, and I have not worked for or with any party within the last three years.'
