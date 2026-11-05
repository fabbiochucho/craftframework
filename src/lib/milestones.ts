// Milestone register and verification pack for an award (funding modality: milestone or results-based payments).
// Each milestone has an owner, indicator, baseline, target and agreed means of verification. Its verification pack is
// an index of evidence items, each tied to that milestone. Before submission, someone other than the people who
// added the evidence approves the pack; the funder then accepts or rejects it.
// Self-check: `node src/lib/milestones.test.ts`.

export const MILESTONE_STATUSES = ['planned', 'approved', 'submitted', 'accepted', 'rejected'] as const
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]
export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  planned: 'Planned', approved: 'Approved internally', submitted: 'Submitted to funder', accepted: 'Accepted by funder', rejected: 'Returned by funder',
}

export type Milestone = {
  id: string; title: string; owner: string; indicator: string; baseline: string; target: string; verificationMeans: string
  dueDate: string | null; status: MilestoneStatus; approvedBy: string | null
}
export type EvidenceItem = { id: string; milestoneId: string; description: string; ref: string; addedBy: string }

/** What is missing before a milestone's pack can be approved (empty = ready). */
export function packGaps(m: Milestone, evidence: EvidenceItem[]): string[] {
  const gaps: string[] = []
  for (const [field, label] of [['owner', 'owner'], ['indicator', 'indicator'], ['baseline', 'baseline'], ['target', 'target'], ['verificationMeans', 'means of verification']] as const) {
    if (!m[field].trim()) gaps.push(`No ${label}`)
  }
  const own = evidence.filter((e) => e.milestoneId === m.id)
  if (!own.length) gaps.push('No evidence in the verification pack')
  if (own.some((e) => !e.ref.trim() || !e.description.trim())) gaps.push('An evidence item has no description or location')
  return gaps
}

/** Whether a person may approve the pack: it is complete and they added none of its evidence. */
export function canApprove(m: Milestone, evidence: EvidenceItem[], approver: string): { ok: boolean; reason?: string } {
  if (m.status !== 'planned' && m.status !== 'rejected') return { ok: false, reason: 'Only a planned or returned milestone can be approved.' }
  const gaps = packGaps(m, evidence)
  if (gaps.length) return { ok: false, reason: gaps.join('; ') }
  const adders = new Set(evidence.filter((e) => e.milestoneId === m.id).map((e) => e.addedBy.toLowerCase()))
  if (adders.has(approver.toLowerCase())) return { ok: false, reason: 'Someone who did not add the evidence must approve it.' }
  return { ok: true }
}

/** Allowed status changes: plan → approve → submit → funder accepts or returns; a returned milestone is reworked. */
export function nextStatuses(s: MilestoneStatus): MilestoneStatus[] {
  return { planned: ['approved'], approved: ['submitted', 'planned'], submitted: ['accepted', 'rejected'], accepted: [], rejected: ['approved'] }[s] as MilestoneStatus[]
}

/** The register summary: counts by status and overdue milestones (due date passed, not yet accepted). */
export function registerSummary(ms: Milestone[], today: string): { byStatus: Record<MilestoneStatus, number>; overdue: string[] } {
  const byStatus = Object.fromEntries(MILESTONE_STATUSES.map((s) => [s, 0])) as Record<MilestoneStatus, number>
  for (const m of ms) byStatus[m.status]++
  return { byStatus, overdue: ms.filter((m) => m.dueDate && m.dueDate < today && m.status !== 'accepted').map((m) => m.id) }
}
