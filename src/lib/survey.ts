// The in-app feedback survey: its questions, validation of an answer, and the NPS maths. Pure.

export const USED_MOST_OPTIONS = [
  'Readiness assessment', 'Data Room', 'Capacity Improvement Plan', 'Validator directory', 'Validator training', 'Reports', 'Other',
] as const
export const IMPROVE_MAX = 1000
export const CALL_TIMES_MAX = 300
/** A response can be changed for this long after it was first submitted. */
export const EDIT_WINDOW_MS = 24 * 3_600_000

export type SurveyAnswer = {
  nps: number
  ease: number
  usedMost: string[]
  improve: string
  wantsCall: boolean
  callTimes: string
}

// eslint-disable-next-line no-control-regex
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim()

/** Validates untrusted input. Returns the cleaned answer, or the first problem in plain words. */
export function parseSurveyAnswer(input: unknown): { ok: true; answer: SurveyAnswer } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Please answer the questions.' }
  const v = input as Record<string, unknown>
  if (typeof v.nps !== 'number' || !Number.isInteger(v.nps) || v.nps < 0 || v.nps > 10) return { ok: false, error: 'Please choose a number from 0 to 10 for how likely you are to recommend CRAFT.' }
  if (typeof v.ease !== 'number' || !Number.isInteger(v.ease) || v.ease < 1 || v.ease > 5) return { ok: false, error: 'Please choose from 1 to 5 for how easy CRAFT has been to use.' }
  const used = v.usedMost === undefined ? [] : v.usedMost
  if (!Array.isArray(used) || used.some((u) => typeof u !== 'string' || !(USED_MOST_OPTIONS as readonly string[]).includes(u))) return { ok: false, error: 'Please choose from the listed options for what you have used most.' }
  const improve = v.improve === undefined || v.improve === null ? '' : v.improve
  if (typeof improve !== 'string') return { ok: false, error: 'Please enter text for what we should improve.' }
  if (clean(improve).length > IMPROVE_MAX) return { ok: false, error: `Please keep your suggestion under ${IMPROVE_MAX} characters.` }
  if (typeof v.wantsCall !== 'boolean') return { ok: false, error: 'Please tell us whether you would like a 20-minute call.' }
  const times = v.callTimes === undefined || v.callTimes === null ? '' : v.callTimes
  if (typeof times !== 'string' || clean(times).length > CALL_TIMES_MAX) return { ok: false, error: `Please keep your preferred times under ${CALL_TIMES_MAX} characters.` }
  return {
    ok: true,
    answer: {
      nps: v.nps, ease: v.ease, usedMost: [...new Set(used as string[])], improve: clean(improve),
      wantsCall: v.wantsCall, callTimes: v.wantsCall ? clean(times) : '',
    },
  }
}

export type NpsBand = 'promoter' | 'passive' | 'detractor'
export const npsBand = (score: number): NpsBand => (score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor')

export type NpsSummary = { responses: number; promoters: number; passives: number; detractors: number; score: number | null }
/** NPS = % promoters (9-10) minus % detractors (0-6), rounded to a whole number. Null with no responses. */
export function npsSummary(scores: number[]): NpsSummary {
  const promoters = scores.filter((s) => npsBand(s) === 'promoter').length
  const detractors = scores.filter((s) => npsBand(s) === 'detractor').length
  const passives = scores.length - promoters - detractors
  return { responses: scores.length, promoters, passives, detractors, score: scores.length ? Math.round(((promoters - detractors) / scores.length) * 100) : null }
}

/** NPS per calendar month (YYYY-MM, UTC), oldest first. */
export function npsTrend(rows: Array<{ at: Date; nps: number }>): Array<NpsSummary & { month: string }> {
  const byMonth = new Map<string, number[]>()
  for (const r of rows) {
    const month = r.at.toISOString().slice(0, 7)
    byMonth.set(month, [...(byMonth.get(month) ?? []), r.nps])
  }
  return [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([month, scores]) => ({ month, ...npsSummary(scores) }))
}

export const average = (values: number[]): number | null => (values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null)
