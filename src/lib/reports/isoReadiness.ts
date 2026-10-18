// ISO certification readiness: for each standard the organisation is working towards, the related CRAFT questions,
// how well they are covered and where the gaps are. CRAFT is not a certification body (see ISO_STATEMENT).
import { frameworkById, type FrameworkKind } from '../crosswalk.ts'
import { indicatorsFor } from '../crosswalkExisting.ts'
import type { ModuleProfile } from '../foundationModules.ts'
import { coverageOf, lensNote, type Coverage, type MappedIndicator } from './coverage.ts'
import { ATTRIBUTION_NOTICE, ISO_STATEMENT } from './legal.ts'

export interface IsoReadiness {
  standards: { id: string; name: string; kind: FrameworkKind; note: string; readiness: Coverage; answered: number; applicable: number; related: MappedIndicator[]; gaps: MappedIndicator[] }[]
  statement: string
  lensNote: string
  footer: string
}

const KIND_NOTE: Partial<Record<FrameworkKind, string>> = {
  certifiable: 'Certifiable: certification is granted only by accredited certification bodies.',
  verified: 'Verified, not certified: statements are verified by accredited verification bodies.',
  guidance: 'Guidance standard: not certifiable; shown for reference.',
}

export function buildIsoReadiness(standardIds: string[], scores: Record<string, number>, p: ModuleProfile, lenses: string[] = []): IsoReadiness {
  const standards = standardIds.flatMap((sid) => {
    const f = frameworkById(sid)
    if (!f || f.owner !== 'ISO') return []
    const c = coverageOf(indicatorsFor(sid), scores, p, lenses)
    return [{
      id: f.id, name: f.name, kind: f.kind, note: KIND_NOTE[f.kind] ?? '', readiness: c.coverage, answered: c.answered, applicable: c.applicable, related: c.indicators,
      gaps: c.indicators.filter((i) => i.score !== null && i.score < 3).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)),
    }]
  })
  return { standards, statement: ISO_STATEMENT, lensNote: lensNote(lenses), footer: ATTRIBUTION_NOTICE }
}
