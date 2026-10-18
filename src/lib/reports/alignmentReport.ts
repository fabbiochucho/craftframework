// Alignment with an external framework, element by element, from every CRAFT question mapped to it.
import { frameworkById, TNFD_STATUS_NOTE, type ExternalFramework } from '../crosswalk.ts'
import { indicatorsFor } from '../crosswalkExisting.ts'
import type { ModuleProfile } from '../foundationModules.ts'
import { coverageOf, emptyCounts, lensNote, type Coverage, type MappedIndicator } from './coverage.ts'
import { ATTRIBUTION_NOTICE } from './legal.ts'

export interface AlignmentReport {
  title: string
  framework: ExternalFramework
  elements: { id: string; label: string; coverage: Coverage; mean: number | null; answered: number; applicable: number; indicators: MappedIndicator[]; rationale: string[] }[]
  counts: Record<Coverage, number>
  lensNote: string
  /** Status caveat for frameworks in transition (TNFD). */
  statusNote?: string
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
    const entries = indicatorsFor(frameworkId, el.id)
    const c = coverageOf(entries, scores, p, lenses)
    counts[c.coverage]++
    return { id: el.id, label: el.label, ...c, rationale: [...new Set(entries.map((e) => e.rationale[`${frameworkId}:${el.id}`]))] }
  })
  return { title: `Alignment with ${framework.name} (CRAFT mapping)`, framework, elements, counts, lensNote: lensNote(lenses), ...(frameworkId === 'tnfd' ? { statusNote: TNFD_STATUS_NOTE } : {}), footer: ATTRIBUTION_NOTICE }
}
