// Gaps in the v1 (102026) CRAFT indices become Capacity Improvement Plan actions, alongside the core bank's.
// Index ids keep their `CRAFT-` prefix, so they never collide with core question ids or touch the core score.
// Self-check: `node src/lib/moduleFindings.test.ts`.
import { dueMonthFor, quarterLabel, severityFromScore, type DerivedFinding } from './data.ts'
import { applicableIndicators, FOUNDATION_MODULES, type ActionType, type ModuleProfile } from './foundationModules.ts'

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

export function deriveModuleFindings(
  scores: Record<string, number>, p: ModuleProfile, planMonths: number, threshold = 2,
): DerivedFinding[] {
  const sevOrder: Record<DerivedFinding['severity'], number> = { Critical: 0, High: 1, Moderate: 2 }
  const perSeverity: Record<DerivedFinding['severity'], number> = { Critical: 0, High: 0, Moderate: 0 }
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
