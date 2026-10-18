// Shared builder for the v1 (102026) indices: one call per indicator keeps the content readable as a table.
import { MODULE_SCORE_PREFIX } from '../data.ts'
import type { ActionType, Applicability, CrosswalkRef, ModuleIndicator } from '../foundationModules.ts'

export const V1 = 'v1 (102026)'

/** Same thresholds as the Resilience index; CRAFT's own labels. */
export const V1_BANDS = (summaries: [string, string, string, string, string]) => [
  { min: 0, label: 'Fragile', summary: summaries[0], tone: 'rose' as const },
  { min: 1.75, label: 'Developing', summary: summaries[1], tone: 'amber' as const },
  { min: 2.75, label: 'Functional', summary: summaries[2], tone: 'yellow' as const },
  { min: 3.5, label: 'Strong', summary: summaries[3], tone: 'emerald' as const },
  { min: 4.4, label: 'Exemplary', summary: summaries[4], tone: 'emerald' as const },
]

/** "fw:REF fw:REF" → crosswalk refs. */
const refs = (s: string): CrosswalkRef[] => s.split(' ').map((t) => {
  const i = t.indexOf(':')
  return { framework: t.slice(0, i), ref: t.slice(i + 1) }
})

export function indicator(
  prefix: string, n: number, dimension: string, domain: string, question: string,
  soe: [string, string, string, string, string, string],
  evidence: string, recommendation: string, whyItMatters: string,
  actionType: ActionType, minWeeks: number, crosswalk: string, appliesWhen?: Applicability,
): ModuleIndicator {
  return {
    id: `${MODULE_SCORE_PREFIX}${prefix}-${String(n).padStart(2, '0')}`, dimension, domain, question,
    soe: { 0: soe[0], 1: soe[1], 2: soe[2], 3: soe[3], 4: soe[4], 5: soe[5] },
    evidence, recommendation, whyItMatters, version: V1, actionType, minWeeks, crosswalk: refs(crosswalk),
    ...(appliesWhen ? { appliesWhen } : {}),
  }
}

export const id = (prefix: string, n: number) => `${MODULE_SCORE_PREFIX}${prefix}-${String(n).padStart(2, '0')}`
