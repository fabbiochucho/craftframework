// One CRAFT index for one organisation: band, dimension scores, weakest answers, lenses and the plan actions it created.
import type { TimelineSettings } from '../cipTimeline.ts'
import { answeredIn, applicableDimensions, applicableIndicators, bandFor, compositeScore, dimensionScore, evaluateLens, priorityGaps,
  type BandResult, type FoundationModule, type LensResult, type ModuleProfile } from '../foundationModules.ts'
import { derivePlan } from '../moduleFindings.ts'
import type { DerivedFinding } from '../data.ts'

export interface IndexReport {
  title: string
  version: string | null
  question: string
  band: BandResult | null
  /** Null until a question is answered, so an untouched index never reads as 0. */
  composite: number | null
  answered: number
  total: number
  dimensions: { name: string; score: number | null }[]
  weakest: { id: string; question: string; score: number }[]
  lenses: LensResult[]
  /** Only the v1 (102026) indices create Capacity Improvement Plan actions. */
  feedsPlan: boolean
  actions: DerivedFinding[]
}

export function buildIndexReport(m: FoundationModule, scores: Record<string, number>, p: ModuleProfile, timeline: TimelineSettings | number): IndexReport {
  const ids = new Set(m.indicators.map((i) => i.id))
  return {
    title: m.title,
    version: m.version ?? null,
    question: m.question,
    band: bandFor(m, scores, p),
    composite: answeredIn(m, scores, p) > 0 ? compositeScore(m, scores, p) : null,
    answered: answeredIn(m, scores, p),
    total: applicableIndicators(m, p).length,
    dimensions: applicableDimensions(m, p).map((d) => ({ name: d.name, score: dimensionScore(m, d.key, scores, p) })),
    weakest: priorityGaps(m, scores, p).slice(0, 5).map((i) => ({ id: i.id, question: i.question, score: scores[i.id] })),
    lenses: m.lenses.map((l) => evaluateLens(m, l, scores, p)),
    feedsPlan: m.version === 'v1 (102026)',
    // Taken from the whole plan so due dates match the CIP and its CSV exactly.
    actions: derivePlan(scores, p, timeline).filter((a) => ids.has(a.id)),
  }
}
