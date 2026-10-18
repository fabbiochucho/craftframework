// One CRAFT index for one organisation: band, dimension scores, weakest answers, lenses and the plan actions it created.
import { answeredIn, applicableDimensions, applicableIndicators, bandFor, compositeScore, dimensionScore, evaluateLens, priorityGaps,
  type BandResult, type FoundationModule, type LensResult, type ModuleProfile } from '../foundationModules.ts'
import { deriveModuleFindings } from '../moduleFindings.ts'
import type { DerivedFinding } from '../data.ts'

export interface IndexReport {
  title: string
  version: string | null
  question: string
  band: BandResult | null
  composite: number
  answered: number
  total: number
  dimensions: { name: string; score: number | null }[]
  weakest: { id: string; question: string; score: number }[]
  lenses: LensResult[]
  actions: DerivedFinding[]
}

export function buildIndexReport(m: FoundationModule, scores: Record<string, number>, p: ModuleProfile, planMonths: number): IndexReport {
  const ids = new Set(m.indicators.map((i) => i.id))
  return {
    title: m.title,
    version: m.version ?? null,
    question: m.question,
    band: bandFor(m, scores, p),
    composite: compositeScore(m, scores, p),
    answered: answeredIn(m, scores, p),
    total: applicableIndicators(m, p).length,
    dimensions: applicableDimensions(m, p).map((d) => ({ name: d.name, score: dimensionScore(m, d.key, scores, p) })),
    weakest: priorityGaps(m, scores, p).slice(0, 5).map((i) => ({ id: i.id, question: i.question, score: scores[i.id] })),
    lenses: m.lenses.map((l) => evaluateLens(m, l, scores, p)),
    actions: deriveModuleFindings(scores, p, planMonths).filter((a) => ids.has(a.id)),
  }
}
