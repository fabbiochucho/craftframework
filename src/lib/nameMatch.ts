// Name matching for screening, and the automatic review rules that settle clear cases without a person.
// Self-check: `node src/lib/sanctionsLists.test.ts` (covers both files).
import type { ListEntry } from './sanctionsLists.ts'

// Legal-form words that say nothing about identity.
const NOISE = new Set(['ltd', 'limited', 'llc', 'inc', 'incorporated', 'plc', 'co', 'company', 'corp', 'corporation', 'sa', 'sarl', 'gmbh', 'ag', 'bv', 'nv', 'pty', 'the', 'and', 'of', 'mr', 'mrs', 'ms', 'dr', 'alhaji', 'chief'])

export function tokens(name: string): string[] {
  return [...new Set(name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter((t) => t.length > 1 && !NOISE.has(t)))]
}
export const normalised = (name: string) => tokens(name).sort().join(' ')

/** Similarity of two names, 0–1: shared distinctive words over all distinctive words (word order ignored). */
export function nameScore(a: string, b: string): number {
  const x = tokens(a), y = new Set(tokens(b))
  if (!x.length || !y.size) return 0
  const shared = x.filter((t) => y.has(t)).length
  return Math.round((shared / (x.length + y.size - shared)) * 100) / 100
}

export type Candidate = { entry: ListEntry; score: number; matchedName: string }

/** The list entries whose best name scores at least `threshold` against the subject's name. */
export function findCandidates(name: string, entries: ListEntry[], threshold = 0.7): Candidate[] {
  const out: Candidate[] = []
  const first = new Set(tokens(name))
  for (const entry of entries) {
    let best = 0, matchedName = ''
    for (const n of entry.names) {
      if (!tokens(n).some((t) => first.has(t))) continue // cheap prefilter: must share a word
      const s = nameScore(name, n)
      if (s > best) { best = s; matchedName = n }
    }
    if (best >= threshold) out.push({ entry, score: best, matchedName })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 10)
}

export type SubjectFacts = { name: string; type: 'person' | 'organisation'; country?: string; birthYear?: number; registrationNumber?: string }
export type AutoDecision = { decision: 'false_positive' | 'confirmed_match' | 'needs_review'; rule: string }

const countryName = (code?: string) => {
  if (!code) return ''
  try { return (new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? '').toLowerCase() } catch { return code.toLowerCase() }
}
const idNorm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * Settles a candidate without a person when the facts are clear. Recorded with the rule; a person can overturn it.
 * - Dismiss: different type (person vs organisation); both countries known and different; birth years more than a year apart.
 * - Confirm: an identifier (registration, passport or national ID) matches exactly; or the exact same name, same type,
 *   and the same country or birth year.
 * - Otherwise a person decides.
 */
export function autoReview(subject: SubjectFacts, c: Candidate): AutoDecision {
  const e = c.entry
  if (e.type !== subject.type) return { decision: 'false_positive', rule: `Listed as ${e.type === 'person' ? 'a person' : 'an organisation'}, not ${subject.type === 'person' ? 'a person' : 'an organisation'}` }
  const sc = countryName(subject.country)
  const countryKnown = !!sc && e.countries.length > 0
  const sameCountry = countryKnown && e.countries.some((x) => x.includes(sc) || sc.includes(x))
  if (countryKnown && !sameCountry) return { decision: 'false_positive', rule: `Different country (listed: ${e.countries.slice(0, 3).join(', ')})` }
  const yearKnown = subject.birthYear != null && e.birthYears.length > 0
  const sameYear = yearKnown && e.birthYears.some((y) => Math.abs(y - subject.birthYear!) <= 1)
  if (yearKnown && !sameYear) return { decision: 'false_positive', rule: `Different birth year (listed: ${e.birthYears.join(', ')})` }
  if (subject.registrationNumber && e.ids.some((i) => idNorm(i) && idNorm(i) === idNorm(subject.registrationNumber!))) return { decision: 'confirmed_match', rule: 'Identifier matches exactly' }
  if (normalised(c.matchedName) === normalised(subject.name) && (sameCountry || sameYear)) return { decision: 'confirmed_match', rule: `Exact name, same type and same ${sameCountry ? 'country' : 'birth year'}` }
  return { decision: 'needs_review', rule: 'Similar name; facts do not settle it' }
}
