// Alignment with an external framework, element by element, from every CRAFT question mapped to it.
import { frameworkById, type ExternalFramework } from '../crosswalk.ts'
import { indicatorsFor } from '../crosswalkExisting.ts'
import type { ModuleProfile } from '../foundationModules.ts'
import { coverageOf, emptyCounts, type Coverage, type MappedIndicator } from './coverage.ts'
import { ATTRIBUTION_NOTICE } from './legal.ts'

export interface AlignmentReport {
  title: string
  framework: ExternalFramework
  elements: { id: string; label: string; coverage: Coverage; mean: number | null; answered: number; applicable: number; indicators: MappedIndicator[] }[]
  counts: Record<Coverage, number>
  footer: string
}

/** Frameworks with fewer mapped questions than this are not offered: element-by-element results would overstate the mapping. */
export const MIN_MAPPED_FOR_ALIGNMENT = 5
export const alignmentAvailable = (frameworkId: string): boolean => indicatorsFor(frameworkId).length >= MIN_MAPPED_FOR_ALIGNMENT

export function buildAlignmentReport(frameworkId: string, scores: Record<string, number>, p: ModuleProfile, lenses: string[] = []): AlignmentReport {
  const framework = frameworkById(frameworkId)
  if (!framework) throw new Error(`Unknown framework: ${frameworkId}`)
  const counts = emptyCounts()
  const elements = framework.elements.map((el) => {
    const c = coverageOf(indicatorsFor(frameworkId, el.id), scores, p, lenses)
    counts[c.coverage]++
    return { id: el.id, label: el.label, ...c }
  })
  return { title: `Alignment with ${framework.name} (CRAFT mapping)`, framework, elements, counts, footer: ATTRIBUTION_NOTICE }
}
