// Validator system PR 7 — trust and quality. Pure logic (no I/O): ratings, validator statistics, re-review flags
// and the DevMapper summary shape. The server loads rows and calls these; every threshold lives here so the
// rules are testable and the wording shown to people matches what is computed.

export const RATING_PARTIES = ['organisation', 'funder'] as const
export type RatingParty = (typeof RATING_PARTIES)[number]
export const PARTY_LABEL: Record<RatingParty, string> = { organisation: 'The organisation', funder: 'The funding partner' }

export const RATING_STATUSES = ['published', 'removed'] as const
export type RatingStatus = (typeof RATING_STATUSES)[number]

export const REMOVAL_GROUNDS = ['false', 'abusive', 'personal_data', 'not_a_party'] as const
export type RemovalGround = (typeof REMOVAL_GROUNDS)[number]
export const REMOVAL_GROUND_LABEL: Record<RemovalGround, string> = {
  false: 'Demonstrably false', abusive: 'Abusive or discriminatory', personal_data: 'Exposes personal data', not_a_party: 'Not from a party to the engagement',
}

export function isStars(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
}

export type RatingSummary = { count: number; average: number | null; distribution: Record<1 | 2 | 3 | 4 | 5, number> }

/** Only published ratings count; the average is rounded to one decimal. */
export function summariseRatings(ratings: { stars: number; status: string }[]): RatingSummary {
  const distribution: RatingSummary['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let total = 0
  let count = 0
  for (const r of ratings) {
    if (r.status !== 'published' || !isStars(r.stars)) continue
    distribution[r.stars] += 1
    total += r.stars
    count += 1
  }
  return { count, average: count ? Math.round((total / count) * 10) / 10 : null, distribution }
}

// ---- What a frozen review says about itself -------------------------------------------------------------------

export type SnapshotIndicator = { self: number | null; final: number | null; framework?: string }
export type SnapshotLike = { selfRung?: unknown; validatedRung?: unknown; impliedRung?: unknown; indicators?: unknown; indices?: unknown }

export type ReviewMetrics = {
  outcome: string
  selfRung: number | null
  validatedRung: number | null
  /** Rung the validator's final scores imply, even when the outcome is "not validated". */
  impliedRung: number | null
  /** Mean absolute difference between self and final score over the indicators that have both (0-5 scale). */
  gap: number | null
  /** impliedRung − selfRung; negative when the validator placed the organisation below its own view. */
  rungDelta: number | null
  /** CRAFT indices validated alongside the ladder (schema 2), counted separately from rung validations. */
  indices?: number
  /** Mean absolute self-vs-final difference over index indicators only. */
  indexGap?: number | null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function reviewMetrics(outcome: string, snapshot: SnapshotLike | null | undefined): ReviewMetrics {
  const selfRung = num(snapshot?.selfRung)
  const impliedRung = num(snapshot?.impliedRung)
  const validatedRung = num(snapshot?.validatedRung)
  const list = Array.isArray(snapshot?.indicators) ? (snapshot!.indicators as SnapshotIndicator[]) : []
  // Schema 1 snapshots carry no framework: every indicator is the ladder's.
  const isLadder = (i: SnapshotIndicator) => !i?.framework || i.framework === 'capital-readiness'
  const gapOf = (xs: SnapshotIndicator[]) => {
    const diffs = xs.flatMap((i) => (typeof i?.self === 'number' && typeof i?.final === 'number' ? [Math.abs(i.self - i.final)] : []))
    return diffs.length ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 100) / 100 : null
  }
  return {
    outcome, selfRung, validatedRung, impliedRung, gap: gapOf(list.filter(isLadder)), rungDelta: selfRung !== null && impliedRung !== null ? impliedRung - selfRung : null,
    indices: Array.isArray(snapshot?.indices) ? snapshot!.indices.length : 0, indexGap: gapOf(list.filter((i) => !isLadder(i))),
  }
}

// ---- Validator statistics --------------------------------------------------------------------------------------

export type ValidatorStats = {
  reviews: number
  validated: number
  withQualifications: number
  notValidated: number
  /** Share of finalised reviews that were not "not validated" (0-1), or null with no reviews. */
  approvalRate: number | null
  meanGap: number | null
  meanRungDelta: number | null
  withdrawn: number
  concerns: number
  /** Validations that included at least one CRAFT index, and the mean index gap across them. */
  indexValidations?: number
  meanIndexGap?: number | null
}

const mean = (xs: number[]): number | null => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null)

export function validatorStats(reviews: ReviewMetrics[], extra: { withdrawn?: number; concerns?: number } = {}): ValidatorStats {
  const count = (outcome: string) => reviews.filter((r) => r.outcome === outcome).length
  const validated = count('validated')
  const withQualifications = count('validated_with_qualifications')
  const notValidated = count('not_validated')
  return {
    reviews: reviews.length, validated, withQualifications, notValidated,
    approvalRate: reviews.length ? Math.round(((validated + withQualifications) / reviews.length) * 100) / 100 : null,
    meanGap: mean(reviews.flatMap((r) => (r.gap === null ? [] : [r.gap]))),
    meanRungDelta: mean(reviews.flatMap((r) => (r.rungDelta === null ? [] : [r.rungDelta]))),
    withdrawn: extra.withdrawn ?? 0, concerns: extra.concerns ?? 0,
    indexValidations: reviews.filter((r) => (r.indices ?? 0) > 0).length,
    meanIndexGap: mean(reviews.flatMap((r) => (r.indexGap === null || r.indexGap === undefined ? [] : [r.indexGap]))),
  }
}

// ---- Re-review flags -------------------------------------------------------------------------------------------
// Flags are advice to the CRAFT programme team and the engaging funder. They never open or change anything.

export const FLAG_THRESHOLDS = {
  /** A validator's first N finalised validations are always flagged. */
  firstValidations: 3,
  /** Rung 6-7 is what funders rely on most. */
  highRung: 6,
  /** Mean absolute self-vs-validator indicator gap (points on the 0-5 scale). */
  largeGap: 1,
  /** Rung difference between the organisation's self view and the validator's. */
  rungJump: 2,
  /** Peer comparison needs this many reviews for the validator and this many peers. */
  peerMinReviews: 5,
  peerMinValidators: 3,
  /** How many standard deviations from the peer mean counts as out of line. */
  peerDeviations: 2,
} as const

export const FLAG_KEYS = ['first_validations', 'high_rung', 'large_gap', 'rung_jump', 'out_of_line'] as const
export type FlagKey = (typeof FLAG_KEYS)[number]
export const FLAG_LABEL: Record<FlagKey, string> = {
  first_validations: 'One of the validator’s first three validations',
  high_rung: 'Validated at rung 6 or 7',
  large_gap: 'Large gap between self-assessed and validator scores',
  rung_jump: 'Validator’s rung is 2 or more rungs from the self-assessed rung',
  out_of_line: 'Validator’s statistics are out of line with their peers',
}

export type PeerComparison = { reasons: string[] }

/**
 * Compares one validator with the others. Only validators with enough reviews take part; below the minimums
 * nothing is flagged (too little evidence either way). Compared: approval rate and mean rung difference.
 */
export function outOfLine(own: ValidatorStats, peers: ValidatorStats[], t = FLAG_THRESHOLDS): PeerComparison {
  const eligible = peers.filter((p) => p.reviews >= t.peerMinReviews)
  if (own.reviews < t.peerMinReviews || eligible.length < t.peerMinValidators) return { reasons: [] }
  const reasons: string[] = []
  const check = (label: string, value: number | null, series: (number | null)[]) => {
    const xs = series.filter((x): x is number => x !== null)
    if (value === null || xs.length < t.peerMinValidators) return
    const m = xs.reduce((a, b) => a + b, 0) / xs.length
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
    if (sd === 0) return
    const z = (value - m) / sd
    if (Math.abs(z) >= t.peerDeviations) reasons.push(`${label} ${value} against a peer average of ${Math.round(m * 100) / 100}`)
  }
  check('Approval rate', own.approvalRate, eligible.map((p) => p.approvalRate))
  check('Average rung difference', own.meanRungDelta, eligible.map((p) => p.meanRungDelta))
  return { reasons }
}

export type FlagInput = {
  /** 1 for the validator's first finalised validation, 2 for the second, and so on. */
  position: number
  metrics: ReviewMetrics
  peer: PeerComparison
}

export type Flag = { key: FlagKey; label: string; detail?: string }

export function reReviewFlags(i: FlagInput, t = FLAG_THRESHOLDS): Flag[] {
  const out: Flag[] = []
  if (i.position >= 1 && i.position <= t.firstValidations) out.push({ key: 'first_validations', label: FLAG_LABEL.first_validations, detail: `Validation number ${i.position} by this validator` })
  if (i.metrics.validatedRung !== null && i.metrics.validatedRung >= t.highRung) out.push({ key: 'high_rung', label: FLAG_LABEL.high_rung, detail: `Rung ${i.metrics.validatedRung}` })
  if (i.metrics.gap !== null && i.metrics.gap >= t.largeGap) out.push({ key: 'large_gap', label: FLAG_LABEL.large_gap, detail: `Average gap ${i.metrics.gap} points` })
  if (i.metrics.rungDelta !== null && Math.abs(i.metrics.rungDelta) >= t.rungJump) {
    out.push({ key: 'rung_jump', label: FLAG_LABEL.rung_jump, detail: `Self-assessed rung ${i.metrics.selfRung}, validator rung ${i.metrics.impliedRung}` })
  }
  if (i.peer.reasons.length) out.push({ key: 'out_of_line', label: FLAG_LABEL.out_of_line, detail: i.peer.reasons.join('; ') })
  return out
}

/** 1-based position of each item among the same validator's validations, oldest finalised first. */
export function positionsByValidator<T extends { id: string; validator: string; finalisedAt: Date | string }>(items: T[]): Map<string, number> {
  const seen = new Map<string, number>()
  const out = new Map<string, number>()
  for (const item of [...items].sort((a, b) => +new Date(a.finalisedAt) - +new Date(b.finalisedAt) || a.id.localeCompare(b.id))) {
    const n = (seen.get(item.validator) ?? 0) + 1
    seen.set(item.validator, n)
    out.set(item.id, n)
  }
  return out
}

// ---- DevMapper summary -----------------------------------------------------------------------------------------

export type DevMapperValidation = {
  /** "Independent validation" or "Funder review": a funder's own review is never called validated. */
  label: 'Independent validation' | 'Funder review'
  /** Null when the scope skipped level 1: such a validation confirms levels (below), never a rung. */
  validatedRung: number | null
  rungName: string
  confirmedLevels: Array<{ level: number; name: string; achieved: boolean }> | null
  outcome: string
  status: string
  validatorOrganisation: string | null
  validatorType: 'firm' | 'individual'
  engagedBy: string
  finalisedOn: string
  expiresOn: string
  nextVerificationPoint: { kind: string; on: string } | null
  verificationId: string | null
}

export type DevMapperSummary = {
  organisationId: string
  framework: string
  /** The organisation's own current rung, labelled self-assessment. */
  selfAssessed: { label: 'Self-assessed'; rung: number | null; rungName: string | null }
  /** The latest validation that is currently valid (current or follow-up overdue), if any. */
  validation: DevMapperValidation | null
}

/** Statuses that still count as the organisation's confirmed rung. Expired, suspended, withdrawn and superseded do not. */
export const CONFIRMED_STATUSES = ['current', 'follow_up_overdue'] as const

export function isConfirmedStatus(status: string): boolean {
  return (CONFIRMED_STATUSES as readonly string[]).includes(status)
}

// ---- Re-review ---------------------------------------------------------------------------------------------
// The programme team opens one (a funder required it, a flag suggested it, or its own choice) and assigns a
// Senior Validator from a different firm with no ties to the parties. A challenge goes to the Review Panel.

export const REREVIEW_REASONS = ['funder_required', 'flagged', 'programme'] as const
export type RereviewReason = (typeof REREVIEW_REASONS)[number]
export const REREVIEW_REASON_LABEL: Record<RereviewReason, string> = {
  funder_required: 'Required by the funding partner', flagged: 'Flagged for a second look', programme: 'Opened by the CRAFT programme team',
}
export const REREVIEW_OUTCOMES = ['stands', 'amended', 'withdrawn'] as const
export type RereviewOutcome = (typeof REREVIEW_OUTCOMES)[number]
export const REREVIEW_OUTCOME_LABEL: Record<RereviewOutcome, string> = {
  stands: 'The validation stands', amended: 'The validation is amended (recorded; the validator issues a corrected one)', withdrawn: 'The validation is withdrawn',
}
export const REREVIEW_DECLARATION = 'I confirm I have no conflict of interest in this re-review: I am not a party to it, I am not in the same firm as the validator or the funder involved, and I have not worked for or with any party within the last three years.'
