// Exclusion, debarment and sanctions screening. Names are checked against public lists through a screening provider
// (by default the free official UN, US OFAC, EU and UK lists, matched inside CRAFT; OpenSanctions optionally, if a paid
// key is configured). Clear cases are settled by written automatic rules (recorded with the rule, and a person can
// overturn them); ambiguous name-only matches go to a person.
// Self-check: `node src/lib/screening.test.ts`.

export const SUBJECT_TYPES = ['organisation', 'person'] as const
export type SubjectType = (typeof SUBJECT_TYPES)[number]
export type Subject = { name: string; type: SubjectType; country?: string; birthYear?: number; registrationNumber?: string }
export type ProviderMatch = { id: string; caption: string; score: number; datasets: string[] }
export type ScreeningStatus = 'clear' | 'possible_match' | 'error' | 'not_configured'
export const REVIEWS = ['confirmed_match', 'false_positive'] as const
export type Review = (typeof REVIEWS)[number]

// Readable names for the lists most relevant to grants and contracts; anything else shows its dataset id.
export const LIST_NAMES: Record<string, string> = {
  worldbank_debarred: 'World Bank debarred firms and individuals', afdb_sanctions: 'African Development Bank debarment', adb_sanctions: 'Asian Development Bank sanctions',
  iadb_sanctions: 'Inter-American Development Bank sanctions', ebrd_ineligible: 'EBRD ineligible entities', us_sam_exclusions: 'US SAM.gov exclusions',
  un_sc_sanctions: 'UN Security Council sanctions', us_ofac_sdn: 'US OFAC SDN list', eu_fsf: 'EU financial sanctions', gb_hmt_sanctions: 'UK financial sanctions', gb_sanctions_list: 'UK Sanctions List',
}
export const listName = (id: string) => LIST_NAMES[id] ?? id

/** Matches at or above this score are flagged as possible matches for review (provider scores are 0–1). */
export const DEFAULT_THRESHOLD = 0.7

export function classify(matches: ProviderMatch[], threshold = DEFAULT_THRESHOLD): { status: 'clear' | 'possible_match'; flagged: ProviderMatch[] } {
  const flagged = matches.filter((m) => m.score >= threshold).sort((a, b) => b.score - a.score)
  return { status: flagged.length ? 'possible_match' : 'clear', flagged }
}

/** Clean subjects: trimmed names of 2–200 characters, at most 20 per run, no duplicates. */
export function cleanSubjects(input: Subject[]): Subject[] {
  const seen = new Set<string>()
  const out: Subject[] = []
  for (const s of input) {
    const name = s.name.trim().replace(/\s+/g, ' ')
    const key = `${s.type}:${name.toLowerCase()}`
    if (name.length < 2 || name.length > 200 || seen.has(key) || !SUBJECT_TYPES.includes(s.type)) continue
    seen.add(key)
    out.push({
      name, type: s.type, ...(s.country?.trim() ? { country: s.country.trim().toLowerCase().slice(0, 2) } : {}),
      ...(s.birthYear && s.birthYear > 1900 && s.birthYear < 2100 ? { birthYear: Math.trunc(s.birthYear) } : {}),
      ...(s.registrationNumber?.trim() ? { registrationNumber: s.registrationNumber.trim().slice(0, 60) } : {}),
    })
  }
  return out.slice(0, 20)
}

/** The screening state of an organisation for Pre-Award: any confirmed match blocks; unreviewed matches need review. */
export function screeningState(rows: { status: string; review: string }[]): 'confirmed_match' | 'needs_review' | 'clear' | 'not_screened' {
  if (!rows.length) return 'not_screened'
  if (rows.some((r) => r.review === 'confirmed_match')) return 'confirmed_match'
  if (rows.some((r) => r.status === 'possible_match' && !r.review)) return 'needs_review'
  if (rows.every((r) => r.status === 'clear' || r.review === 'false_positive')) return 'clear'
  return 'not_screened'
}

// ---------------------------------------------------------------- Free official lists and automatic review
export type ReviewedMatch = ProviderMatch & { matchedName?: string; type?: string; countries?: string[]; birthYears?: number[]; decision?: 'false_positive' | 'confirmed_match' | 'needs_review'; rule?: string }

/**
 * The outcome for one name after the automatic rules: any automatically confirmed match → confirmed; all matches
 * dismissed → clear (recorded as false positives); otherwise a person must review.
 */
export function summarise(matches: ReviewedMatch[]): { status: 'clear' | 'possible_match'; review: '' | 'confirmed_match' | 'false_positive'; note: string } {
  if (!matches.length) return { status: 'clear', review: '', note: '' }
  const confirmed = matches.find((m) => m.decision === 'confirmed_match')
  if (confirmed) return { status: 'possible_match', review: 'confirmed_match', note: `${confirmed.matchedName ?? confirmed.caption}: ${confirmed.rule}` }
  if (matches.every((m) => m.decision === 'false_positive')) return { status: 'possible_match', review: 'false_positive', note: matches.map((m) => `${m.matchedName ?? m.caption}: ${m.rule}`).join('; ') }
  return { status: 'possible_match', review: '', note: '' }
}
export const SYSTEM_REVIEWER = 'system: automatic rules'

/** Debarment lists with no free download or open API: a person checks the official search, and CRAFT records it. */
export const MANUAL_LISTS = [
  { id: 'worldbank', name: 'World Bank debarred firms and individuals', url: 'https://www.worldbank.org/en/projects-operations/procurement/debarred-firms' },
  { id: 'afdb', name: 'African Development Bank debarment list', url: 'https://www.afdb.org/en/projects-and-operations/procurement/debarment-and-sanctions-procedures' },
  { id: 'adb', name: 'Asian Development Bank sanctions list', url: 'https://www.adb.org/who-we-are/integrity/sanctions-list' },
] as const
export type ManualListId = (typeof MANUAL_LISTS)[number]['id']

/** Investigation aids for a reviewer who wants to dig further. Not lists: a hit here is never a finding on its own. */
export const INVESTIGATION_AIDS = [
  { name: 'OCCRP Aleph', url: (q: string) => `https://aleph.occrp.org/search?q=${encodeURIComponent(q)}` },
  { name: 'OpenCorporates', url: (q: string) => `https://opencorporates.com/companies?q=${encodeURIComponent(q)}` },
  { name: 'ICIJ Offshore Leaks', url: (q: string) => `https://offshoreleaks.icij.org/search?q=${encodeURIComponent(q)}` },
] as const
