// Suggested Capacity Improvement Plan timeline (spec §6). Pure: no React, no I/O.
export type Severity = 'Critical' | 'High' | 'Moderate' | 'Low'
export type ActionType = 'policy' | 'system' | 'process' | 'people' | 'practice' | 'assurance'
export type Pace = 'standard' | 'accelerated' | 'target' | 'extended'
export type OrgSize = 'small' | 'medium' | 'large'

export interface TimelineInput {
  id: string
  severity: Severity
  owner: string
  domain: string
  score: number
  tier: number
  actionType?: ActionType
  minWeeks?: number
}

export interface TimelineSettings {
  pace: Pace
  targetMonths?: number
  startDate?: string // YYYY-MM-DD; today when unset
  orgSize: OrgSize
  overrides: Record<string, { dueWeek: number; reason: string }>
  fixedDates: Record<string, { date: string; label: string }>
  changeReadiness?: number
}

export interface ScheduledAction {
  id: string
  startWeek: number
  dueWeek: number
  durationWeeks: number
  phase: 1 | 2 | 3
  flags: string[]
}

export interface TimelineResult {
  actions: ScheduledAction[]
  planWeeks: number
  planMonths: number
  cannotFit: string[]
  warnings: string[]
}

export const DEFAULT_TIMELINE: TimelineSettings = { pace: 'standard', orgSize: 'medium', overrides: {}, fixedDates: {} }

const PACES: Pace[] = ['standard', 'accelerated', 'target', 'extended']
const SIZES: OrgSize[] = ['small', 'medium', 'large']
const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

/** Saved settings from any client version, made safe to schedule with. */
export function normaliseTimeline(raw: Partial<TimelineSettings> | null | undefined): TimelineSettings {
  const r = (isRecord(raw) ? raw : {}) as Partial<TimelineSettings>
  const out: TimelineSettings = {
    pace: PACES.includes(r.pace as Pace) ? r.pace! : 'standard',
    orgSize: SIZES.includes(r.orgSize as OrgSize) ? r.orgSize! : 'medium',
    overrides: {}, fixedDates: {},
  }
  if (typeof r.targetMonths === 'number' && Number.isFinite(r.targetMonths) && r.targetMonths > 0) out.targetMonths = r.targetMonths
  if (typeof r.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate)) out.startDate = r.startDate
  if (typeof r.changeReadiness === 'number' && Number.isFinite(r.changeReadiness)) out.changeReadiness = r.changeReadiness
  if (isRecord(r.overrides)) for (const [k, v] of Object.entries(r.overrides)) {
    if (isRecord(v) && typeof v.dueWeek === 'number' && v.dueWeek > 0 && typeof v.reason === 'string') out.overrides[k] = { dueWeek: Math.round(v.dueWeek), reason: v.reason }
  }
  if (isRecord(r.fixedDates)) for (const [k, v] of Object.entries(r.fixedDates)) {
    if (isRecord(v) && typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && typeof v.label === 'string') out.fixedDates[k] = { date: v.date, label: v.label }
  }
  return out
}

export const PACE_LABEL: Record<Pace, string> = {
  standard: 'Standard', accelerated: 'Accelerated', target: 'Target date', extended: 'Extended',
}

const WINDOWS: Record<Severity, [number, number]> = { Critical: [0, 13], High: [4, 26], Moderate: [13, 52], Low: [26, 78] }
const SEVERITY_RANK: Record<Severity, number> = { Critical: 0, High: 1, Moderate: 2, Low: 3 }
const BASE_WEEKS: Record<ActionType, number> = { policy: 6, system: 10, process: 8, people: 8, practice: 12, assurance: 8 }
const CAPACITY: Record<OrgSize, number> = { small: 2, medium: 3, large: 5 }
const PREREQ: Partial<Record<ActionType, ActionType>> = { people: 'policy', practice: 'system' }

export const weeksToMonths = (w: number) => Math.ceil((w * 12) / 52)
const monthsToWeeks = (m: number) => Math.round((m * 52) / 12)
const DAY = 86_400_000
export function weekToDate(startDate: string, week: number): string {
  return new Date(Date.parse(`${startDate}T00:00:00Z`) + week * 7 * DAY).toISOString().slice(0, 10)
}
const weeksUntil = (startDate: string, date: string) => Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / (7 * DAY))

function paceFactor(inputs: TimelineInput[], s: TimelineSettings): number {
  if (s.pace === 'accelerated') return 0.6
  if (s.pace === 'extended') return 1.5
  if (s.pace === 'target' && s.targetMonths && inputs.length) {
    const latest = Math.max(...inputs.map((i) => WINDOWS[i.severity][1]))
    return monthsToWeeks(s.targetMonths) / latest
  }
  return 1
}

export function suggestTimeline(inputs: TimelineInput[], settings: TimelineSettings): TimelineResult {
  const s = normaliseTimeline(settings)
  const factor = paceFactor(inputs, s)
  // Durations are never more than 40% shorter; a Target date stretches window ends, never starts.
  const durationFactor = Math.max(0.6, Math.min(1, factor))
  const startFactor = s.pace === 'target' ? Math.min(1, factor) : factor
  const missed: string[] = []
  const start = s.startDate ?? new Date().toISOString().slice(0, 10)
  const cap = CAPACITY[s.orgSize]
  const embed = s.changeReadiness !== undefined && s.changeReadiness < 2.5
  const ordered = inputs
    .map((input, n) => ({ input, n }))
    .sort((a, b) => SEVERITY_RANK[a.input.severity] - SEVERITY_RANK[b.input.severity] || a.input.tier - b.input.tier || a.n - b.n)
    .map((x) => x.input)

  const busy = new Map<string, Array<[number, number]>>() // owner -> [start, end)
  const done = new Map<string, ScheduledAction>()

  const schedule = (a: TimelineInput): ScheduledAction => {
    const hit = done.get(a.id)
    if (hit) return hit
    const type = a.actionType ?? 'process'
    const flags: string[] = []
    const min = a.minWeeks ?? 0
    let duration = Math.max(Math.round(BASE_WEEKS[type] * durationFactor), min, 1)
    if (embed && (type === 'people' || type === 'practice')) {
      duration = Math.ceil(duration * 1.25)
      flags.push('Adds embedding time because change readiness is below 2.5')
    }
    let winStart = Math.round(WINDOWS[a.severity][0] * startFactor)
    let winEnd = Math.round(WINDOWS[a.severity][1] * factor)
    const fixed = s.fixedDates[a.id]
    const deadline = fixed ? weeksUntil(start, fixed.date) : null
    if (deadline !== null) {
      winEnd = Math.min(winEnd, Math.max(0, deadline))
      winStart = Math.min(winStart, Math.max(0, deadline - duration))
    }
    // Prerequisites in the same domain finish first
    const need = PREREQ[type]
    let earliest = winStart
    let waitsFor: string | null = null
    if (need) {
      for (const p of ordered) {
        if (p.domain !== a.domain || (p.actionType ?? 'process') !== need) continue
        const due = schedule(p).dueWeek
        if (due > earliest) { earliest = due; waitsFor = p.id }
      }
    }
    if (waitsFor) flags.push(`Waits for ${waitsFor} (${need} first) until week ${earliest}`)
    // ponytail: counts any overlap in the range, not peak concurrency; slightly conservative
    const slots = busy.get(a.owner) ?? []
    let startWeek = earliest
    for (;;) {
      const clash = slots.filter(([b, e]) => b < startWeek + duration && e > startWeek)
      if (clash.length < cap) break
      startWeek = Math.min(...clash.map(([, e]) => e))
    }
    if (startWeek > earliest) flags.push(`Moved later: ${a.owner} is at capacity (${cap} actions at once)`)
    let dueWeek = startWeek + duration
    if (min > 0 && dueWeek > winEnd && duration === min) flags.push(`Needs a minimum of ${min} weeks, beyond its ${winEnd}-week window`)
    const ov = s.overrides[a.id]
    if (ov) {
      dueWeek = Math.max(ov.dueWeek, startWeek + Math.max(min, 1))
      flags.push(`Override: due week ${dueWeek} (${ov.reason})${dueWeek > ov.dueWeek ? `; kept to the minimum of ${Math.max(min, 1)} weeks` : ''}`)
    }
    if (fixed && deadline !== null) {
      if (dueWeek <= deadline) flags.push(`Due before ${fixed.label} (${fixed.date})`)
      else { flags.push(`Cannot meet ${fixed.label} (${fixed.date}): due week ${dueWeek}`); missed.push(a.id) }
    }
    slots.push([startWeek, dueWeek])
    busy.set(a.owner, slots)
    const phase: 1 | 2 | 3 = a.severity === 'Critical' || dueWeek <= 13 ? 1 : ['policy', 'system', 'process'].includes(type) ? 2 : 3
    const out = { id: a.id, startWeek, dueWeek, durationWeeks: dueWeek - startWeek, phase, flags }
    done.set(a.id, out)
    return out
  }

  const actions = ordered.map(schedule)
  const planWeeks = actions.reduce((m, x) => Math.max(m, x.dueWeek), 0)
  const targetWeeks = s.pace === 'target' && s.targetMonths ? monthsToWeeks(s.targetMonths) : null
  const cannotFit = [...new Set([...(targetWeeks === null ? [] : actions.filter((x) => x.dueWeek > targetWeeks).map((x) => x.id)), ...missed])]
  const warnings: string[] = []
  if (s.pace === 'accelerated') warnings.push('Accelerated pace: windows are 40% shorter. Check owners can carry the extra load.')
  if (cannotFit.length) warnings.push(`${cannotFit.length} action(s) cannot finish by the target or fixed date.`)
  return { actions, planWeeks, planMonths: weeksToMonths(planWeeks), cannotFit, warnings }
}
