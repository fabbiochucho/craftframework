// How well an organisation's answers cover a framework element or a standard, from the questions mapped to it.
import type { CatalogueEntry } from '../crosswalkExisting.ts'
import type { ModuleProfile } from '../foundationModules.ts'

export type Coverage = 'covered' | 'partial' | 'gap' | 'not-assessed' | 'not-applicable' | 'not-mapped'

export const COVERAGE_LABEL: Record<Coverage, string> = {
  covered: 'Covered', partial: 'Partial', gap: 'Gap', 'not-assessed': 'Not assessed',
  'not-applicable': 'Not applicable', 'not-mapped': 'Not covered by CRAFT',
}

export type MappedIndicator = { id: string; sourceName: string; question: string; score: number | null }

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * No mapped question → not-mapped; all mapped questions out of scope → not-applicable; none answered →
 * not-assessed; otherwise the mean of answered applicable scores: ≥ 3.5 covered, ≥ 2 partial, else gap.
 */
export function coverageOf(entries: CatalogueEntry[], scores: Record<string, number>, p: ModuleProfile) {
  const applicable = entries.filter((e) => e.applies(p))
  const indicators: MappedIndicator[] = applicable.map((e) => ({ id: e.id, sourceName: e.sourceName, question: e.question, score: e.id in scores ? scores[e.id] : null }))
  const answered = indicators.filter((i) => i.score !== null).map((i) => i.score as number)
  const mean = answered.length ? round2(answered.reduce((a, b) => a + b, 0) / answered.length) : null
  const coverage: Coverage = entries.length === 0 ? 'not-mapped'
    : applicable.length === 0 ? 'not-applicable'
      : mean === null ? 'not-assessed'
        : mean >= 3.5 ? 'covered' : mean >= 2 ? 'partial' : 'gap'
  return { coverage, mean, indicators }
}

export const emptyCounts = (): Record<Coverage, number> =>
  ({ covered: 0, partial: 0, gap: 0, 'not-assessed': 0, 'not-applicable': 0, 'not-mapped': 0 })
