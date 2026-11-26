// Public CRAFT benchmarks: how organisations that chose to take part score on the capacity assessment, by country,
// sector, organisation type and size. Aggregates only, computed nightly (netlify/functions/benchmarks-refresh.mts):
//   • only organisations that opted in, and only their latest completed assessment per module
//   • one dimension at a time (no cross-filters), so groups cannot be intersected to single anyone out
//   • a group under MIN_GROUP organisations is folded into "Other", which itself is shown only at MIN_GROUP or more
//   • counts are shown as bands and only medians and quartiles are published (no means, minimums or maximums)
//   • self-assessed and independently validated organisations are reported side by side, never blended into one claim
//   • overall scores only: the module content (area and domain names) is private, so no per-area breakdown is published
// Self-check: `node src/lib/benchmarks.test.ts`.
import { MIN_GROUP } from './networks.ts'
import { stats } from './networkResults.ts'

export const SIZE_BANDS = [
  { id: 'micro', label: '1–9 staff' },
  { id: 'small', label: '10–49 staff' },
  { id: 'medium', label: '50–249 staff' },
  { id: 'large', label: '250+ staff' },
] as const
export type SizeBand = (typeof SIZE_BANDS)[number]['id']
export const DIMENSIONS = [
  { id: 'country', label: 'Country' },
  { id: 'sector', label: 'Sector' },
  { id: 'archetype', label: 'Organisation type' },
  { id: 'size', label: 'Size' },
] as const
export type Dimension = (typeof DIMENSIONS)[number]['id']

/** One opted-in organisation's latest completed assessment in one module. Never leaves the server. */
export interface BenchmarkInput {
  module: string
  country: string
  sector: string
  archetype: string
  size: string
  validated: boolean
  average: number
}

export interface GroupStats {
  organisations: string
  median: number
  q1: number
  q3: number
  selfAssessed: { organisations: string; median: number } | null
  validated: { organisations: string; median: number } | null
}
export interface BenchmarkModule {
  id: string
  name: string
  overall: GroupStats | null
  dimensions: Record<Dimension, Array<{ value: string; stats: GroupStats }>>
}
export interface BenchmarkData { computedAt: string; minGroup: number; scale: string; modules: BenchmarkModule[] }

/** A count as a band, so neighbouring groups cannot be subtracted to reveal one organisation. */
export function band(n: number): string {
  if (n < MIN_GROUP) return `fewer than ${MIN_GROUP}`
  for (const [lo, hi] of [[5, 9], [10, 19], [20, 49], [50, 99]]) if (n >= lo && n <= hi) return `${lo}–${hi}`
  return '100+'
}

function group(rows: BenchmarkInput[]): GroupStats | null {
  if (rows.length < MIN_GROUP) return null
  const all = stats(rows.map((r) => r.average))!
  const part = (subset: BenchmarkInput[]) => subset.length >= MIN_GROUP ? { organisations: band(subset.length), median: stats(subset.map((r) => r.average))!.median } : null
  return {
    organisations: band(rows.length), median: all.median, q1: all.q1, q3: all.q3,
    selfAssessed: part(rows.filter((r) => !r.validated)), validated: part(rows.filter((r) => r.validated)),
  }
}

function byDimension(rows: BenchmarkInput[], dim: Dimension): Array<{ value: string; stats: GroupStats }> {
  const key = (r: BenchmarkInput) => (dim === 'size' ? r.size : r[dim]) || 'Not stated'
  const groups = new Map<string, BenchmarkInput[]>()
  for (const r of rows) groups.set(key(r), [...(groups.get(key(r)) ?? []), r])
  const shown: Array<{ value: string; stats: GroupStats }> = []
  const other: BenchmarkInput[] = []
  for (const [value, members] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const s = value === 'Not stated' ? null : group(members)
    if (s) shown.push({ value, stats: s })
    else other.push(...members)
  }
  const rest = group(other)
  if (rest) shown.push({ value: 'Other', stats: rest })
  return shown
}

export function computeBenchmarks(
  rows: BenchmarkInput[], modules: Array<{ id: string; name: string }>, now = new Date(),
): BenchmarkData {
  return {
    computedAt: now.toISOString(), minGroup: MIN_GROUP, scale: 'Capacity score, 1 (nascent) to 4 (mature)',
    modules: modules.map((m) => {
      const mine = rows.filter((r) => r.module === m.id)
      return {
        id: m.id, name: m.name, overall: group(mine),
        dimensions: Object.fromEntries(DIMENSIONS.map((d) => [d.id, byDimension(mine, d.id)])) as BenchmarkModule['dimensions'],
      }
    }).filter((m) => m.overall),
  }
}

/** The published statistics as CSV (one row per group), for download. */
export function benchmarksCsv(data: BenchmarkData): string {
  const q = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const lines = [['module', 'dimension', 'group', 'organisations', 'median', 'q1', 'q3', 'self_assessed_median', 'validated_median'].join(',')]
  for (const m of data.modules) {
    const rows: Array<[string, string, GroupStats]> = [['All', 'All', m.overall!], ...DIMENSIONS.flatMap((d) => m.dimensions[d.id].map((g) => [d.label, g.value, g.stats] as [string, string, GroupStats]))]
    for (const [dim, value, s] of rows) lines.push([m.name, dim, value, s.organisations, s.median, s.q1, s.q3, s.selfAssessed?.median ?? '', s.validated?.median ?? ''].map(q).join(','))
  }
  return lines.join('\n') + '\n'
}
