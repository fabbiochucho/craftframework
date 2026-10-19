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
  const s = { ...DEFAULT_TIMELINE, ...settings }
  const factor = paceFactor(inputs, s)
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
    let duration = Math.max(Math.round(BASE_WEEKS[type] * Math.min(1, factor)), min, 1)
    if (embed && (type === 'people' || type === 'practice')) {
      duration = Math.ceil(duration * 1.25)
      flags.push('Adds embedding time because change readiness is below 2.5')
    }
    let [winStart, winEnd] = WINDOWS[a.severity].map((w) => Math.round(w * factor))
    const fixed = s.fixedDates[a.id]
    if (fixed) {
      const deadline = Math.max(0, weeksUntil(start, fixed.date))
      winEnd = Math.min(winEnd, deadline)
      winStart = Math.min(winStart, Math.max(0, deadline - duration))
      flags.push(`Due before ${fixed.label} (${fixed.date})`)
    }
    // Prerequisites in the same domain finish first
    const need = PREREQ[type]
    let earliest = winStart
    if (need) {
      for (const p of ordered) {
        if (p.domain === a.domain && (p.actionType ?? 'process') === need) earliest = Math.max(earliest, schedule(p).dueWeek)
      }
    }
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
      flags.push(`Override: due week ${dueWeek} (${ov.reason})${dueWeek > ov.dueWeek ? `; kept to the minimum of ${min} weeks` : ''}`)
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
  const cannotFit = targetWeeks === null ? [] : actions.filter((x) => x.dueWeek > targetWeeks).map((x) => x.id)
  const warnings: string[] = []
  if (s.pace === 'accelerated') warnings.push('Accelerated pace: windows are 40% shorter. Check owners can carry the extra load.')
  if (cannotFit.length) warnings.push(`${cannotFit.length} action(s) cannot finish by the target date at their minimum duration.`)
  return { actions, planWeeks, planMonths: weeksToMonths(planWeeks), cannotFit, warnings }
}
