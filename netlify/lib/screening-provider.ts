// Screening provider: OpenSanctions /match (https://api.opensanctions.org). Switched off until OPENSANCTIONS_API_KEY
// is set. OPENSANCTIONS_COLLECTION picks the collection (default "default": sanctions, debarments and more).
// Only names, the type (organisation or person) and an optional country are sent.
import type { ProviderMatch, Subject } from '../../src/lib/screening.js'

export const PROVIDER = 'opensanctions'
export const providerConfigured = () => !!process.env.OPENSANCTIONS_API_KEY

type Result = { id?: string; caption?: string; score?: number; datasets?: string[] }

export async function screen(subjects: Subject[]): Promise<{ ok: true; results: ProviderMatch[][] } | { ok: false; error: 'not_configured' | 'error' }> {
  const key = process.env.OPENSANCTIONS_API_KEY
  if (!key) return { ok: false, error: 'not_configured' }
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
    const body = await res.json() as { responses?: Record<string, { results?: Result[] }> }
    return {
      ok: true,
      results: subjects.map((_, i) => (body.responses?.[`q${i}`]?.results ?? []).map((r) => ({
        id: String(r.id ?? ''), caption: String(r.caption ?? ''), score: Number(r.score ?? 0), datasets: Array.isArray(r.datasets) ? r.datasets.map(String) : [],
      }))),
    }
  } catch {
    return { ok: false, error: 'error' }
  }
}
