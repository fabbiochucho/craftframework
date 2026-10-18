// The laws register: the laws in sixteen areas that apply in each jurisdiction CRAFT serves.
// Information to support readiness, not legal advice. Spec: docs/superpowers/specs/2026-10-18-laws-register-design.md
import { AFRICA_COUNTRIES } from '../africa-countries.ts'

export type LawArea = 'company' | 'data' | 'integrity' | 'procurement' | 'governance' | 'labour' | 'eia' | 'sustainability' | 'financial' | 'capital' | 'tax' | 'competition' | 'consumer' | 'sanctions' | 'forex' | 'licensing'
export type SourceKind = 'official' | 'secondary'
export type ReviewStatus = 'pending' | 'approved'
export type CraftDuty = 'registration' | 'cross-border' | 'local-representative' | 'breach-notice' | 'wording' | 'other'

export interface LawEntry {
  id: string
  jurisdiction: string
  area: LawArea
  title: string
  citation: string
  regulator: string | null
  summary: string
  source: { url: string; kind: SourceKind; checked: string }
  /** True when the jurisdiction has no national law in this area; the summary says what applies instead. */
  noLaw?: boolean
  extraQuestions?: string[]
  craftNotes?: { duty: CraftDuty; note: string; status: 'done' | 'needed' | 'n/a' }[]
  reformNote?: string
  review: ReviewStatus
}

export const LAW_AREAS: Record<LawArea, string> = {
  company: 'Company and non-profit law', data: 'Data protection and privacy', integrity: 'Anti-corruption and anti-money-laundering',
  procurement: 'Public procurement', governance: 'Corporate governance codes and regulations', labour: 'Labour and employment', eia: 'Environmental impact assessment',
  sustainability: 'Environment, climate and sustainability', financial: 'Financial reporting and financial regulation',
  capital: 'Capital markets and securities',
  tax: 'Tax', competition: 'Competition', consumer: 'Consumer protection', sanctions: 'Sanctions and export controls',
  forex: 'Foreign exchange', licensing: 'Investment and sector licensing',
}

const OTHER: Record<string, string> = { EU: 'European Union', UK: 'United Kingdom', US: 'United States' }
export const LAW_JURISDICTIONS: string[] = [...AFRICA_COUNTRIES.map((c) => c.iso2), ...Object.keys(OTHER)]
export const jurisdictionName = (id: string): string => OTHER[id] ?? AFRICA_COUNTRIES.find((c) => c.iso2 === id)?.name ?? id
