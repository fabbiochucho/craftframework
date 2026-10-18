// Gaps in the v1 (102026) CRAFT indices become Capacity Improvement Plan actions, alongside the core bank's.
// Index ids keep their `CRAFT-` prefix, so they never collide with core question ids or touch the core score.
// Self-check: `node src/lib/moduleFindings.test.ts`.
import { deriveFindings, dueMonthFor, quarterLabel, severityFromScore, type DerivedFinding } from './data.ts'
import { applicableIndicators, FOUNDATION_MODULES, type ActionType, type ModuleProfile } from './foundationModules.ts'
import { esgMaturity } from './esgMaturity.ts'

const V1 = 'v1 (102026)'

/** Who usually owns closing a gap of this kind. */
export const OWNER_BY_ACTION: Record<ActionType, string> = {
  policy: 'Board Secretary',
  process: 'Head of Operations',
  system: 'Head of Finance / ICT',
  people: 'Head of Human Resources',
  practice: 'Head of Operations',
  assurance: 'Internal Audit',
}

type Severity = DerivedFinding['severity']
const sevOrder: Record<Severity, number> = { Critical: 0, High: 1, Moderate: 2 }

/** `startAt` continues the schedule after actions already placed (e.g. the core plan's), so they don't bunch. */
export function deriveModuleFindings(
  scores: Record<string, number>, p: ModuleProfile, planMonths: number, threshold = 2,
  startAt: Record<Severity, number> = { Critical: 0, High: 0, Moderate: 0 },
): DerivedFinding[] {
  const perSeverity = { ...startAt }
  const out: DerivedFinding[] = []
  for (const m of FOUNDATION_MODULES.filter((x) => x.version === V1)) {
    for (const i of applicableIndicators(m, p)) {
      if (!(i.id in scores) || scores[i.id] > threshold) continue
      const score = scores[i.id]
      const severity = severityFromScore(score)
      const dueMonth = dueMonthFor(severity, perSeverity[severity]++, planMonths)
      out.push({
        id: i.id, qId: i.id, topic: m.title,
        domain: m.dimensions.find((d) => d.key === i.dimension)?.name ?? i.dimension,
        tier: 0, severity, score, question: i.question, description: i.question,
        mitigation: i.recommendation, owner: OWNER_BY_ACTION[i.actionType ?? 'process'],
        dueMonth, dueDate: quarterLabel(dueMonth),
      })
    }
  }
  return out.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || a.dueMonth - b.dueMonth)
}

/** Unmet ESG criteria up to the next maturity stage become plan actions; later stages wait, so the plan stays achievable. */
export function deriveEsgFindings(
  esg: Record<string, number>, planMonths: number, startAt: Record<Severity, number> = { Critical: 0, High: 0, Moderate: 0 },
): DerivedFinding[] {
  const perSeverity = { ...startAt }
  const { missing, next } = esgMaturity(esg, {})
  return missing.filter((q) => q.id in esg && esg[q.id] <= 2).map((q) => {
    const score = esg[q.id]
    const severity = severityFromScore(score)
    const dueMonth = dueMonthFor(severity, perSeverity[severity]++, planMonths)
    return {
      id: q.id, qId: q.id, topic: `ESG maturity: towards ${next?.name ?? 'the next stage'}`, domain: q.domain, tier: 0, severity, score,
      question: q.question, description: q.question, mitigation: q.recommendation,
      owner: q.pillar === 'Governance' ? 'Board Secretary' : 'Sustainability lead', dueMonth, dueDate: quarterLabel(dueMonth),
    }
  })
}

/** The whole Capacity Improvement Plan: core, index and ESG-maturity gaps on one schedule, sorted by severity then due month. */
export function derivePlan(scores: Record<string, number>, p: ModuleProfile, planMonths: number, threshold = 2, esg: Record<string, number> = {}): DerivedFinding[] {
  const core = deriveFindings(scores, threshold, planMonths)
  const startAt: Record<Severity, number> = { Critical: 0, High: 0, Moderate: 0 }
  for (const f of core) startAt[f.severity]++
  const modules = deriveModuleFindings(scores, p, planMonths, threshold, startAt)
  for (const f of modules) startAt[f.severity]++
  return [...core, ...modules, ...deriveEsgFindings(esg, planMonths, startAt)]
    .sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || a.dueMonth - b.dueMonth || a.tier - b.tier)
}
