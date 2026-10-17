// Pure maths for the Super Admin analytics dashboard (funnels, drop-off, medians, activity). No I/O.

export type FunnelStage = { key: string; label: string; count: number }
export type FunnelRow = FunnelStage & {
  /** Share of the previous stage that did not reach this one (0 for the first stage). */
  dropOffPct: number
  /** Share of the first stage that reached this one. */
  ofFirstPct: number
}

const pct = (n: number) => Math.round(n * 1000) / 10

// Turns ordered stage counts into rows with drop-off between steps. A stage can never exceed the one
// before it (each later stage is a subset of the earlier one), so the counts are clamped before the maths.
// With `clamp: false` the stages are independent milestones (e.g. the validator exam, cases and capstone, which
// can be done in any order), so a stage may exceed the one before it and its drop-off then reads as 0.
export function buildFunnel(stages: FunnelStage[], { clamp = true }: { clamp?: boolean } = {}): FunnelRow[] {
  let previous = Infinity
  const first = stages[0] ? Math.max(0, stages[0].count) : 0
  return stages.map((stage, i) => {
    const count = Math.max(0, clamp ? Math.min(stage.count, previous) : stage.count)
    const prior = i === 0 ? count : previous
    const row: FunnelRow = {
      ...stage, count,
      dropOffPct: i === 0 || prior === 0 ? 0 : Math.max(0, pct((prior - count) / prior)),
      ofFirstPct: first === 0 ? 0 : pct(count / first),
    }
    previous = count
    return row
  })
}

export function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export const MS_DAY = 86_400_000

export type RangeKey = '7' | '30' | '90' | 'all'
export const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: '7', label: 'Last 7 days' }, { key: '30', label: 'Last 30 days' }, { key: '90', label: 'Last 90 days' }, { key: 'all', label: 'All time' },
]

export function parseRange(raw: string | null | undefined): RangeKey {
  return raw === '7' || raw === '30' || raw === '90' || raw === 'all' ? raw : '30'
}

// Start of the window, or null for all time.
export function rangeStart(range: RangeKey, now: Date): Date | null {
  return range === 'all' ? null : new Date(now.getTime() - Number(range) * MS_DAY)
}

export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / MS_DAY))
}

export type ActivityRow = { email: string; day: string }

// Active users from per-day sign-in rows: daily (the latest day with data), weekly (7 days to `now`),
// monthly (30 days to `now`), and how many of the people seen in the window came back on more than one day.
export function activitySummary(rows: ActivityRow[], now: Date) {
  const today = now.toISOString().slice(0, 10)
  const since = (days: number) => new Date(now.getTime() - (days - 1) * MS_DAY).toISOString().slice(0, 10)
  const distinct = (from: string) => new Set(rows.filter((r) => r.day >= from && r.day <= today).map((r) => r.email)).size
  const daysByPerson = new Map<string, Set<string>>()
  for (const r of rows) daysByPerson.set(r.email, (daysByPerson.get(r.email) ?? new Set()).add(r.day))
  let returning = 0
  for (const days of daysByPerson.values()) if (days.size > 1) returning++
  return { dau: distinct(today), wau: distinct(since(7)), mau: distinct(since(30)), returning, oneOff: daysByPerson.size - returning }
}

// Per-day active counts for a chart, oldest first, with empty days filled in.
export function dailySeries(rows: ActivityRow[], days: number, now: Date): Array<{ day: string; active: number }> {
  const byDay = new Map<string, Set<string>>()
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? new Set()).add(r.email))
  const out: Array<{ day: string; active: number }> = []
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now.getTime() - i * MS_DAY).toISOString().slice(0, 10)
    out.push({ day, active: byDay.get(day)?.size ?? 0 })
  }
  return out
}

export type StalledPerson = {
  email: string; name: string; orgName: string; step: number; stepName: string
  startedAt: string; lastActivityAt: string; daysStalled: number; nudgesSent: number; lastNudgeAt: string | null
}
export type StalledSortKey = 'name' | 'orgName' | 'step' | 'startedAt' | 'lastActivityAt' | 'daysStalled' | 'nudgesSent'

export function sortStalled(rows: StalledPerson[], key: StalledSortKey, dir: 'asc' | 'desc'): StalledPerson[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = a[key], y = b[key]
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: 'base' })
    return c * sign || a.email.localeCompare(b.email)
  })
}
