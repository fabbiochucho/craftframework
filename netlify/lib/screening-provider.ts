// Screening providers.
// - Default, free: the official UN, US OFAC, EU and UK lists, downloaded by CRAFT and matched inside CRAFT (names never
//   leave CRAFT). Each candidate gets the automatic review rules (src/lib/nameMatch.ts).
// - Optional, paid: OpenSanctions /match, used only when OPENSANCTIONS_API_KEY is set (its terms treat compliance
//   screening as commercial use). Its results go to a person to review.
import { autoReview, findCandidates } from '../../src/lib/nameMatch.js'
import { SOURCE_DATASET } from '../../src/lib/sanctionsLists.js'
import type { ReviewedMatch, Subject } from '../../src/lib/screening.js'
import { loadLists } from './official-lists.js'

export const providerName = () => (process.env.OPENSANCTIONS_API_KEY ? 'opensanctions' : 'official-lists')
/** Screening works out of the box with the free lists; this only says whether the lists have been downloaded yet. */
export async function providerReady(): Promise<boolean> {
  if (process.env.OPENSANCTIONS_API_KEY) return true
  return (await loadLists()).entries.length > 0
}

type Outcome = { ok: true; results: ReviewedMatch[][] } | { ok: false; error: 'not_ready' | 'error' }

export async function screen(subjects: Subject[]): Promise<Outcome> {
  if (process.env.OPENSANCTIONS_API_KEY) return openSanctions(subjects, process.env.OPENSANCTIONS_API_KEY)
  const { entries } = await loadLists()
  if (!entries.length) return { ok: false, error: 'not_ready' }
  return {
    ok: true,
    results: subjects.map((s) => findCandidates(s.name, entries).map((c) => {
      const r = autoReview(s, c)
      return {
        id: `${c.entry.source}:${c.entry.id}`, caption: c.entry.names[0], matchedName: c.matchedName, score: c.score, datasets: [SOURCE_DATASET[c.entry.source]],
        type: c.entry.type, countries: c.entry.countries.slice(0, 5), birthYears: c.entry.birthYears.slice(0, 5), decision: r.decision, rule: r.rule,
      }
    })),
  }
}

type OsResult = { id?: string; caption?: string; score?: number; datasets?: string[] }

async function openSanctions(subjects: Subject[], key: string): Promise<Outcome> {
  const collection = process.env.OPENSANCTIONS_COLLECTION || 'default'
  const queries = Object.fromEntries(subjects.map((s, i) => [`q${i}`, {
    schema: s.type === 'person' ? 'Person' : 'Organization',
    properties: { name: [s.name], ...(s.country ? { country: [s.country] } : {}) },
  }]))
  try {
    const res = await fetch(`https://api.opensanctions.org/match/${encodeURIComponent(collection)}`, {
      method: 'POST', signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
    })
    if (!res.ok) return { ok: false, error: 'error' }
    const body = await res.json() as { responses?: Record<string, { results?: OsResult[] }> }
    return {
      ok: true,
      results: subjects.map((_, i) => (body.responses?.[`q${i}`]?.results ?? []).map((r) => ({
        id: String(r.id ?? ''), caption: String(r.caption ?? ''), score: Number(r.score ?? 0), datasets: Array.isArray(r.datasets) ? r.datasets.map(String) : [],
        decision: 'needs_review' as const, rule: 'Checked by OpenSanctions; a person decides',
      })).filter((m) => m.score >= 0.7)),
    }
  } catch {
    return { ok: false, error: 'error' }
  }
}
