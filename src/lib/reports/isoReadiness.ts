// ISO certification readiness: for each standard the organisation is working towards, the related CRAFT questions,
// how well they are covered and where the gaps are. CRAFT is not a certification body (see ISO_STATEMENT).
import { frameworkById, type FrameworkKind } from '../crosswalk.ts'
import { indicatorsFor } from '../crosswalkExisting.ts'
import type { ModuleProfile } from '../foundationModules.ts'
import { coverageOf, type Coverage, type MappedIndicator } from './coverage.ts'
import { ATTRIBUTION_NOTICE, ISO_STATEMENT } from './legal.ts'

export interface IsoReadiness {
  standards: { id: string; name: string; kind: FrameworkKind; readiness: Coverage; related: MappedIndicator[]; gaps: MappedIndicator[] }[]
  statement: string
  footer: string
}

export function buildIsoReadiness(standardIds: string[], scores: Record<string, number>, p: ModuleProfile): IsoReadiness {
  const standards = standardIds.flatMap((sid) => {
    const f = frameworkById(sid)
    if (!f) return []
    const c = coverageOf(indicatorsFor(sid), scores, p)
    return [{
      id: f.id, name: f.name, kind: f.kind, readiness: c.coverage, related: c.indicators,
      gaps: c.indicators.filter((i) => i.score !== null && i.score < 3).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)),
    }]
  })
  return { standards, statement: ISO_STATEMENT, footer: ATTRIBUTION_NOTICE }
}
