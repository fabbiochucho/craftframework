// The free official sanctions lists (UN, US OFAC, EU, UK), downloaded by CRAFT, parsed into one compact index per list
// and kept in the private blob store "screening-lists". Names being screened never leave CRAFT.
import { getStore } from '@netlify/blobs'
import { LIST_SOURCES, parseEu, parseOfac, parseUk, parseUn, SOURCE_URLS, type ListEntry, type ListSource } from '../../src/lib/sanctionsLists.js'

export const LISTS_STORE = 'screening-lists'
type Stored = { fetchedAt: string; count: number; entries: ListEntry[] }

async function download(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000), headers: { 'User-Agent': 'CRAFT sanctions screening (craftframework.becomechange.institute)' } })
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  return res.text()
}

/** Download, parse and store one list. Throws if the download fails or the result looks wrong (an empty or tiny list). */
export async function refreshSource(source: ListSource): Promise<number> {
  const texts = await Promise.all(SOURCE_URLS[source].map(download))
  const entries = source === 'un' ? parseUn(texts[0]) : source === 'ofac' ? parseOfac(texts[0], texts[1], texts[2]) : source === 'eu' ? parseEu(texts[0]) : parseUk(texts[0])
  // A list that suddenly shrinks to almost nothing is a broken download or a format change: keep the previous copy.
  if (entries.length < 100) throw new Error(`${source}: only ${entries.length} entries parsed; keeping the previous copy`)
  await getStore(LISTS_STORE).setJSON(source, { fetchedAt: new Date().toISOString(), count: entries.length, entries } satisfies Stored)
  cache = null
  return entries.length
}

let cache: { at: number; entries: ListEntry[]; status: ListStatus[] } | null = null
export type ListStatus = { source: ListSource; fetchedAt: string | null; count: number }

/** Every stored list, cached in memory for an hour per function instance. */
export async function loadLists(): Promise<{ entries: ListEntry[]; status: ListStatus[] }> {
  if (cache && Date.now() - cache.at < 3_600_000) return cache
  const store = getStore(LISTS_STORE)
  const stored = await Promise.all(LIST_SOURCES.map(async (s) => [s, await store.get(s, { type: 'json' }) as Stored | null] as const))
  const loaded = {
    at: Date.now(),
    entries: stored.flatMap(([, v]) => v?.entries ?? []),
    status: stored.map(([source, v]) => ({ source, fetchedAt: v?.fetchedAt ?? null, count: v?.count ?? 0 })),
  }
  // Never cache "nothing downloaded yet": the lists may arrive any minute.
  if (loaded.entries.length) cache = loaded
  return loaded
}
