// Awards (grants and contracts), funder measures, and the organisation-level issue register with its consented track
// record (spec §6a–6c). Pure rules shared by /api/awards and the Awards page. Self-check: `node src/lib/awards.test.ts`.

export const AWARD_STATUSES = ['active', 'closed', 'closed_with_open_matters'] as const
export type AwardStatus = (typeof AWARD_STATUSES)[number]
export const AWARD_STATUS_LABEL: Record<AwardStatus, string> = { active: 'Active', closed: 'Closed', closed_with_open_matters: 'Closed with open matters' }

export const MEASURE_KINDS = ['special_condition', 'reimbursement_only', 'enhanced_monitoring', 'withheld_disbursement', 'suspension'] as const
export type MeasureKind = (typeof MEASURE_KINDS)[number]
export const MEASURE_LABEL: Record<MeasureKind, string> = {
  special_condition: 'Special condition', reimbursement_only: 'Switched to reimbursement only', enhanced_monitoring: 'Enhanced monitoring',
  withheld_disbursement: 'Disbursement withheld', suspension: 'Suspension',
}

export const ISSUE_SOURCES = ['pre_award_condition', 'during_award', 'audit', 'funder_visit', 'complaint', 'incident', 'post_close', 'other'] as const
export type IssueSource = (typeof ISSUE_SOURCES)[number]
export const SOURCE_LABEL: Record<IssueSource, string> = {
  pre_award_condition: 'Pre-Award condition', during_award: 'During-Award review', audit: 'Audit', funder_visit: 'Funder visit',
  complaint: 'Complaint or whistleblowing', incident: 'Incident', post_close: 'After close-out', other: 'Other',
}
export const ISSUE_TYPES = ['financial', 'procurement', 'programme', 'reporting', 'governance', 'safeguarding', 'compliance', 'other'] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

export type Issue = {
  id: string; orgId: string; awardId: string | null; source: string; type: string; title: string
  verified: boolean; orgResponse: string; status: 'open' | 'closed'; openedAt: string; closedAt: string | null
  fixHeld: boolean | null; recurrenceOf: string | null
}
export type Award = { id: string; orgId: string; funderEmail: string; status: string }

/** Closing an award: "closed with open matters" when any issue on it is still open. */
export const closingStatus = (awardIssues: Pick<Issue, 'status'>[]): AwardStatus =>
  awardIssues.some((i) => i.status === 'open') ? 'closed_with_open_matters' : 'closed'

const DAY = 86_400_000
const days = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY))

export type TrackRecord = {
  verifiedIssues: number; open: number; closed: number; byType: Record<string, number>
  averageDaysToFix: number | null; fixesHeld: number; fixesFailed: number; recurrences: number; awards: number
}

/** The track record summary: verified issues only; no other funder's details, titles or responses. */
export function trackRecord(issues: Issue[]): TrackRecord {
  const v = issues.filter((i) => i.verified)
  const closed = v.filter((i) => i.status === 'closed' && i.closedAt)
  const byType: Record<string, number> = {}
  for (const i of v) byType[i.type] = (byType[i.type] ?? 0) + 1
  return {
    verifiedIssues: v.length, open: v.filter((i) => i.status === 'open').length, closed: closed.length, byType,
    averageDaysToFix: closed.length ? Math.round(closed.reduce((t, i) => t + days(i.openedAt, i.closedAt!), 0) / closed.length) : null,
    fixesHeld: v.filter((i) => i.fixHeld === true).length, fixesFailed: v.filter((i) => i.fixHeld === false).length,
    recurrences: v.filter((i) => i.recurrenceOf).length, awards: new Set(v.map((i) => i.awardId).filter(Boolean)).size,
  }
}

export type ShareLevel = 'summary' | 'full'
export type Share = { orgId: string; viewerEmail: string; level: ShareLevel }

/**
 * What a viewer outside the organisation may see:
 * - the funder of an award sees every issue on that award;
 * - a viewer the organisation shared "full" with sees verified issues (with the organisation's responses);
 * - a "summary" share gives the track record only.
 */
export function funderView(viewerEmail: string, orgId: string, awards: Award[], issues: Issue[], shares: Share[]): { ownAwardIssues: Issue[]; shared: { level: ShareLevel; trackRecord: TrackRecord; issues: Issue[] } | null } {
  const email = viewerEmail.trim().toLowerCase()
  const mine = new Set(awards.filter((a) => a.orgId === orgId && a.funderEmail.toLowerCase() === email).map((a) => a.id))
  const orgIssues = issues.filter((i) => i.orgId === orgId)
  const share = shares.find((s) => s.orgId === orgId && s.viewerEmail.toLowerCase() === email)
  return {
    ownAwardIssues: orgIssues.filter((i) => i.awardId && mine.has(i.awardId)),
    shared: share ? { level: share.level, trackRecord: trackRecord(orgIssues), issues: share.level === 'full' ? orgIssues.filter((i) => i.verified) : [] } : null,
  }
}

/** Pre-Award evidence from history: issue types that recurred across different awards weigh more. */
export function repeatedTypes(issues: Issue[]): string[] {
  const awardsByType = new Map<string, Set<string>>()
  for (const i of issues) if (i.verified && i.awardId) awardsByType.set(i.type, (awardsByType.get(i.type) ?? new Set()).add(i.awardId))
  return [...awardsByType].filter(([, a]) => a.size >= 2).map(([t]) => t).sort()
}

// ---------------------------------------------------------------- Lifecycle stage for the funder's portfolio
export const STAGE_LABEL = { pre_award: 'Pre-award', during_award: 'During award', post_award: 'Post-award' } as const
export type Stage = keyof typeof STAGE_LABEL
type StageAssessment = { module: string; year: number; status: string; completedAt: string | null; createdAt: string }

/**
 * Where an award is in its lifecycle. A closed award is post-award. An active award is at the stage of its most recent
 * grant-stage assessment (started or completed), or during award when none has started.
 */
export function awardStage(status: AwardStatus, assessments: StageAssessment[]): Stage {
  if (status !== 'active') return 'post_award'
  const graded = assessments.filter((a) => a.module in STAGE_LABEL).sort((x, y) => y.createdAt.localeCompare(x.createdAt))
  return (graded[0]?.module as Stage | undefined) ?? 'during_award'
}

/** The latest completed grant-stage assessment, which carries the award's rating. */
export function latestRated<T extends StageAssessment>(assessments: T[]): T | null {
  return assessments.filter((a) => a.module in STAGE_LABEL && a.status === 'complete' && a.completedAt).sort((x, y) => y.completedAt!.localeCompare(x.completedAt!))[0] ?? null
}
