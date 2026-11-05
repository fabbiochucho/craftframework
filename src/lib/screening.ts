// Exclusion, debarment and sanctions screening. Names are checked against public lists through a screening provider
// (OpenSanctions by default: World Bank, AfDB, ADB, IDB and EBRD debarments, US SAM exclusions, UN, US, EU and UK
// sanctions). Possible matches are flagged for a person to confirm; nothing is decided automatically.
// Self-check: `node src/lib/screening.test.ts`.

export const SUBJECT_TYPES = ['organisation', 'person'] as const
export type SubjectType = (typeof SUBJECT_TYPES)[number]
export type Subject = { name: string; type: SubjectType; country?: string }
export type ProviderMatch = { id: string; caption: string; score: number; datasets: string[] }
export type ScreeningStatus = 'clear' | 'possible_match' | 'error' | 'not_configured'
export const REVIEWS = ['confirmed_match', 'false_positive'] as const
export type Review = (typeof REVIEWS)[number]

// Readable names for the lists most relevant to grants and contracts; anything else shows its dataset id.
export const LIST_NAMES: Record<string, string> = {
  worldbank_debarred: 'World Bank debarred firms and individuals', afdb_sanctions: 'African Development Bank debarment', adb_sanctions: 'Asian Development Bank sanctions',
  iadb_sanctions: 'Inter-American Development Bank sanctions', ebrd_ineligible: 'EBRD ineligible entities', us_sam_exclusions: 'US SAM.gov exclusions',
  un_sc_sanctions: 'UN Security Council sanctions', us_ofac_sdn: 'US OFAC SDN list', eu_fsf: 'EU financial sanctions', gb_hmt_sanctions: 'UK financial sanctions',
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
    out.push({ name, type: s.type, ...(s.country?.trim() ? { country: s.country.trim().toLowerCase().slice(0, 2) } : {}) })
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
