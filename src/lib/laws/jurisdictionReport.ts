// Jurisdiction alignment: for each law that applies where the organisation is, how far its CRAFT answers show readiness.
import type { ModuleProfile } from '../foundationModules.ts'
import { COVERAGE_LABEL, coverageOf, lensNote, type Coverage, type MappedIndicator } from '../reports/coverage.ts'
import { ATTRIBUTION_NOTICE } from '../reports/legal.ts'
import { questionsForLaw } from './mapping.ts'
import { LAW_DATA_VERSION, LAW_REGISTER } from './register.ts'
import { isAfricanJurisdiction, jurisdictionName, LAW_AREAS, LAW_JURISDICTIONS, type LawArea, type LawEntry } from './types.ts'
import { instrumentOf, ratificationStatus } from './data/continental.ts'

export const LAW_FOOTER = 'This report is information to support readiness, not legal advice. Laws change; check the cited source and take local legal advice before relying on it.'

export interface LawRow {
  entry: LawEntry; coverage: Coverage | 'no-law'; mean: number | null; answered: number; applicable: number; indicators: MappedIndicator[]
  /** Source last checked over 12 months ago. */ recheckDue: boolean
  /** Continental instruments: whether each of the organisation's African countries has ratified it. */
  ratification?: Array<{ jurisdiction: string; name: string; ratified: boolean }>
}
export interface JurisdictionSection { id: string; name: string; reviewed: boolean; /** Entries still awaiting review, never shown. */ pendingCount: number; areas: { area: LawArea; label: string; laws: LawRow[] }[] }
export interface JurisdictionReport { title: string; version: string; sections: JurisdictionSection[]; lensNote: string; footer: string }

/**
 * The organisation's home country first, then its other listed jurisdictions; ids outside the register are dropped.
 * An organisation in any African country also gets the continental (AU) instruments.
 */
export function reportJurisdictions(country: string, listed: string[]): string[] {
  const own = [...new Set([country, ...listed])].filter((j) => LAW_JURISDICTIONS.includes(j))
  return own.some(isAfricanJurisdiction) ? [...own, 'AU'] : own
}

/** True when the entry's source was last checked more than 12 months before `today` (YYYY-MM-DD). */
export function isRecheckDue(e: LawEntry, today: string): boolean {
  return e.source.checked < `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`
}

/** Entries count as approved when the data file says so or a Super Admin approved their jurisdiction in the app. */
/** Jurisdictions approved for this register version; an approval for an earlier version needs re-approval. */
export function currentApprovals(records: Array<{ jurisdiction: string; registerVersion: string }>, version: string = LAW_DATA_VERSION): string[] {
  return records.filter((r) => r.registerVersion === version).map((r) => r.jurisdiction)
}

export function applyApprovals(entries: LawEntry[], approvedJurisdictions: string[]): LawEntry[] {
  if (approvedJurisdictions.length === 0) return entries
  return entries.map((e) => (e.review !== 'approved' && approvedJurisdictions.includes(e.jurisdiction) ? { ...e, review: 'approved' as const } : e))
}

export function buildJurisdictionReport(
  jurisdictions: string[], scores: Record<string, number>, p: ModuleProfile, lenses: string[] = [], entries: LawEntry[] = LAW_REGISTER,
  approvedJurisdictions: string[] = [], today: string = new Date().toISOString().slice(0, 10),
): JurisdictionReport {
  const effective = applyApprovals(entries, approvedJurisdictions)
  const african = jurisdictions.filter(isAfricanJurisdiction)
  const ratificationOf = (e: LawEntry) => {
    const k = instrumentOf(e)
    return k ? { ratification: african.map((j) => ({ jurisdiction: j, name: jurisdictionName(j), ratified: ratificationStatus(k, j) === true })) } : {}
  }
  const sections = jurisdictions.map((id): JurisdictionSection => {
    const all = effective.filter((e) => e.jurisdiction === id)
    const laws = all.filter((e) => e.review === 'approved')
    const areas = (Object.keys(LAW_AREAS) as LawArea[]).map((area) => ({
      area, label: LAW_AREAS[area],
      laws: laws.filter((e) => e.area === area).map((entry): LawRow => entry.noLaw
        ? { entry, coverage: 'no-law', mean: null, answered: 0, applicable: 0, indicators: [], recheckDue: isRecheckDue(entry, today) }
        : { entry, ...coverageOf(questionsForLaw(entry), scores, p, lenses), recheckDue: isRecheckDue(entry, today), ...ratificationOf(entry) }),
    })).filter((a) => a.laws.length > 0)
    return { id, name: jurisdictionName(id), reviewed: laws.length > 0, pendingCount: all.length - laws.length, areas }
  })
  return { title: 'Jurisdiction alignment (CRAFT readiness)', version: LAW_DATA_VERSION, sections, lensNote: lensNote(lenses), footer: `${LAW_FOOTER} ${ATTRIBUTION_NOTICE}` }
}

const awaiting = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'} still awaiting review`

/** CSV rows (unescaped): one per law, plus a row for each jurisdiction not yet or only partly reviewed. */
export function jurisdictionCsvRows(r: JurisdictionReport): (string | number)[][] {
  return r.sections.flatMap((s) => [
    ...(!s.reviewed ? [[s.name, '', 'Not yet reviewed', '', '', '', '', '', '', '', '']]
      : s.pendingCount > 0 ? [[s.name, '', `Partly reviewed: ${awaiting(s.pendingCount)}`, '', '', '', '', '', '', '', '']] : []),
    ...s.areas.flatMap((a) => a.laws.map((l) => [s.name, LAW_AREAS[a.area], l.entry.title, l.entry.citation, l.entry.regulator ?? '',
      l.coverage === 'no-law' ? 'No national law' : COVERAGE_LABEL[l.coverage], l.answered, l.applicable, l.entry.source.kind, l.entry.source.url, l.entry.source.checked])),
  ])
}
