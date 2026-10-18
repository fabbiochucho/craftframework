// Jurisdiction alignment: for each law that applies where the organisation is, how far its CRAFT answers show readiness.
import type { ModuleProfile } from '../foundationModules.ts'
import { coverageOf, lensNote, type Coverage, type MappedIndicator } from '../reports/coverage.ts'
import { ATTRIBUTION_NOTICE } from '../reports/legal.ts'
import { questionsForLaw } from './mapping.ts'
import { LAW_DATA_VERSION, LAW_REGISTER } from './register.ts'
import { jurisdictionName, LAW_AREAS, LAW_JURISDICTIONS, type LawArea, type LawEntry } from './types.ts'

export const LAW_FOOTER = 'This report is information to support readiness, not legal advice. Laws change; check the cited source and take local legal advice before relying on it.'

export interface LawRow { entry: LawEntry; coverage: Coverage | 'no-law'; mean: number | null; answered: number; applicable: number; indicators: MappedIndicator[] }
export interface JurisdictionSection { id: string; name: string; reviewed: boolean; areas: { area: LawArea; label: string; laws: LawRow[] }[] }
export interface JurisdictionReport { title: string; version: string; sections: JurisdictionSection[]; lensNote: string; footer: string }

/** The organisation's home country first, then its other listed jurisdictions; ids outside the register are dropped. */
export function reportJurisdictions(country: string, listed: string[]): string[] {
  return [...new Set([country, ...listed])].filter((j) => LAW_JURISDICTIONS.includes(j))
}

export function buildJurisdictionReport(jurisdictions: string[], scores: Record<string, number>, p: ModuleProfile, lenses: string[] = [], entries: LawEntry[] = LAW_REGISTER): JurisdictionReport {
  const sections = jurisdictions.map((id): JurisdictionSection => {
    const laws = entries.filter((e) => e.jurisdiction === id && e.review === 'approved')
    const areas = (Object.keys(LAW_AREAS) as LawArea[]).map((area) => ({
      area, label: LAW_AREAS[area],
      laws: laws.filter((e) => e.area === area).map((entry): LawRow => entry.noLaw
        ? { entry, coverage: 'no-law', mean: null, answered: 0, applicable: 0, indicators: [] }
        : { entry, ...coverageOf(questionsForLaw(entry), scores, p, lenses) }),
    })).filter((a) => a.laws.length > 0)
    return { id, name: jurisdictionName(id), reviewed: laws.length > 0, areas }
  })
  return { title: 'Jurisdiction alignment (CRAFT readiness)', version: LAW_DATA_VERSION, sections, lensNote: lensNote(lenses), footer: `${LAW_FOOTER} ${ATTRIBUTION_NOTICE}` }
}
