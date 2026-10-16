// ============================================================================
// CRAFT validator system — training and accreditation rules (PR 4)
// ----------------------------------------------------------------------------
// Pure rules shared by /api/training and the /training pages: exam scoring and
// retake windows, the scenario-case and capstone pass rules, the one-year
// accreditation clock and annual renewal, calibration, streaks and badges.
// Accreditation is earned ONLY by passing all three assessment parts (spec:
// "Accreditation (earned, no panel)"). Nothing here rewards volume, rungs,
// speed or fees. Source of the numbers:
// docs/superpowers/specs/2026-10-16-validator-training-content.md
// ============================================================================

const DAY_MS = 86_400_000

// --- exam (part 1) ----------------------------------------------------------
export const EXAM = { questions: 40, minutes: 60, passPct: 80, retakeDays: 14, maxAttemptsPerYear: 3, graceSeconds: 60 } as const

// 80% of the questions actually drawn (32/40 for a full exam; fewer when the bank is small).
export function examPassMark(total: number): number {
  return Math.ceil((total * EXAM.passPct) / 100 - 1e-9)
}

export function examDeadline(startedAt: Date): Date {
  return new Date(startedAt.getTime() + EXAM.minutes * 60_000)
}

// Whether an answer submitted at `now` still counts (a short grace for network delay).
export function examOnTime(startedAt: Date, now: Date): boolean {
  return now.getTime() <= examDeadline(startedAt).getTime() + EXAM.graceSeconds * 1000
}

export type DrawnQuestion = { id: string; correctIndex: number }
export function scoreExam(drawn: DrawnQuestion[], answers: Record<string, unknown>) {
  const total = drawn.length
  const score = drawn.filter((q) => answers[q.id] === q.correctIndex).length
  const passMark = examPassMark(total)
  return { score, total, passMark, pct: total ? Math.round((score / total) * 100) : 0, passed: total > 0 && score >= passMark }
}

// Random draw of up to 40 distinct questions. If the bank is smaller, everything is drawn.
export function drawExamQuestions<T>(bank: T[], rand: () => number = Math.random, size: number = EXAM.questions): { drawn: T[]; short: boolean } {
  const pool = [...bank]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return { drawn: pool.slice(0, size), short: pool.length < size }
}

// Retake after 14 days from the previous attempt; at most 3 attempts in any rolling year.
export function examEligibility(startedAts: Date[], now: Date): { allowed: boolean; reason?: 'retake_window' | 'yearly_cap'; nextAt?: Date; attemptsThisYear: number } {
  const yearAgo = now.getTime() - 365 * DAY_MS
  const recent = startedAts.map((d) => d.getTime()).filter((t) => t > yearAgo).sort((a, b) => a - b)
  const last = recent.length ? recent[recent.length - 1] : null
  const windowEnd = last === null ? 0 : last + EXAM.retakeDays * DAY_MS
  const capEnd = recent.length >= EXAM.maxAttemptsPerYear ? recent[recent.length - EXAM.maxAttemptsPerYear] + 365 * DAY_MS : 0
  const attemptsThisYear = recent.length
  if (capEnd > now.getTime()) return { allowed: false, reason: 'yearly_cap', nextAt: new Date(Math.max(capEnd, windowEnd)), attemptsThisYear }
  if (windowEnd > now.getTime()) return { allowed: false, reason: 'retake_window', nextAt: new Date(windowEnd), attemptsThisYear }
  return { allowed: true, attemptsThisYear }
}

// --- scenario cases (part 2) ------------------------------------------------
export const CASES = { requiredMarkers: 2, passPct: 70, maxAttempts: 2, minWords: 50, maxWords: 500 } as const

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

// Two different markers each give a percentage; the case result is their mean.
export function caseResult(percents: number[]): { status: 'pending' | 'passed' | 'failed'; percent: number | null } {
  if (percents.length < CASES.requiredMarkers) return { status: 'pending', percent: null }
  const percent = Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10
  return { status: percent >= CASES.passPct ? 'passed' : 'failed', percent }
}

// One resubmission per case: attempt numbers 1 and 2.
export function canSubmitCase(attemptsMade: number, hasPassed: boolean, hasPending: boolean): boolean {
  return !hasPassed && !hasPending && attemptsMade < CASES.maxAttempts
}

// --- capstone (part 3) ------------------------------------------------------
export const CAPSTONE = { passPct: 70, maxAttempts: 2 } as const
export const RUBRIC_LEVELS = { 0: 'Missing', 1: 'Partial', 2: 'Meets', 3: 'Exceeds' } as const
export type RubricCriterion = { key: string; name: string; weight: string; mustMeet: boolean; meets: string }

// 70% overall AND at least "Meets" (2) on every must-meet criterion (Outcome, Independence).
export function capstoneResult(rubric: RubricCriterion[], scores: Record<string, number>) {
  const valid = rubric.every((c) => Number.isInteger(scores[c.key]) && scores[c.key] >= 0 && scores[c.key] <= 3)
  const total = rubric.reduce((a, c) => a + (scores[c.key] ?? 0), 0)
  const max = rubric.length * 3
  const pct = max ? Math.round((total / max) * 1000) / 10 : 0
  const failedMustMeet = rubric.filter((c) => c.mustMeet && (scores[c.key] ?? 0) < 2).map((c) => c.key)
  const overallPass = max > 0 && total / max >= CAPSTONE.passPct / 100 - 1e-9
  return { valid, total, max, pct, overallPass, failedMustMeet, passed: valid && overallPass && failedMustMeet.length === 0 }
}

// Accreditation needs all three parts; a high score in one cannot make up for a fail in another.
export function allPartsPassed(p: { exam: boolean; cases: boolean[]; capstone: boolean }): boolean {
  return p.exam && p.cases.length > 0 && p.cases.every(Boolean) && p.capstone
}

// --- accreditation clock ----------------------------------------------------
export const ACCREDITATION_YEARS = 1
export const RENEWAL_OPENS_DAYS = 60
export const CPD_HOURS_PER_YEAR = 8

export function addYears(d: Date, years = ACCREDITATION_YEARS): Date {
  const out = new Date(d.getTime())
  out.setUTCFullYear(out.getUTCFullYear() + years)
  return out
}

// Passing all three parts: exactly one year from now.
export const accreditedUntilOnPass = (now: Date): Date => addYears(now)

// Renewal extends the current expiry by a year; a lapsed accreditation restarts from today.
export function renewedUntil(current: Date | null, now: Date): Date {
  return addYears(current && current.getTime() > now.getTime() ? current : now)
}

// The yearly items must be completed on or after the start of the accreditation year.
export const renewalWindowStart = (until: Date): Date => addYears(until, -ACCREDITATION_YEARS)
export const renewalOpensAt = (until: Date): Date => new Date(until.getTime() - RENEWAL_OPENS_DAYS * DAY_MS)

export type AccreditationState = 'registered' | 'accredited' | 'lapsed' | 'suspended'
// Suspension always wins. Otherwise accreditation exists only through `accredited_until`.
export function accreditationState(v: { accreditationStatus: string; accreditedUntil: Date | string | null }, now = new Date()): AccreditationState {
  if (v.accreditationStatus === 'suspended') return 'suspended'
  if (!v.accreditedUntil) return 'registered'
  return new Date(v.accreditedUntil).getTime() > now.getTime() ? 'accredited' : 'lapsed'
}

export type RenewalInput = {
  videos: Array<{ moduleId: string; title: string; done: boolean }>
  cpdHours: number
  drillPct: number | null
  declared: boolean
}
export const DRILL = { size: 10, withinPoints: 1, passPct: 80, calibratedPct: 90 } as const

export function renewalChecklist(i: RenewalInput) {
  const videosLeft = i.videos.filter((v) => !v.done)
  const items = [
    { key: 'videos', label: 'Re-watch the current training videos', done: videosLeft.length === 0, detail: `${i.videos.length - videosLeft.length} of ${i.videos.length} done` },
    { key: 'cpd', label: `${CPD_HOURS_PER_YEAR} hours of continuing development`, done: i.cpdHours >= CPD_HOURS_PER_YEAR, detail: `${i.cpdHours} of ${CPD_HOURS_PER_YEAR} hours logged` },
    { key: 'calibration', label: `Annual calibration drill (${DRILL.passPct}% within ${DRILL.withinPoints} point)`, done: (i.drillPct ?? -1) >= DRILL.passPct, detail: i.drillPct === null ? 'not taken' : `best ${i.drillPct}%` },
    { key: 'declaration', label: 'Updated independence declaration and client list', done: i.declared, detail: i.declared ? 'signed' : 'not signed' },
  ]
  return { items, ready: items.every((x) => x.done), videosLeft: videosLeft.map((v) => v.moduleId) }
}

// --- calibration ------------------------------------------------------------
export function calibrationScore(pairs: Array<{ ref: number; given: number }>) {
  const within = pairs.filter((p) => Math.abs(p.ref - p.given) <= DRILL.withinPoints).length
  return { within, total: pairs.length, pct: pairs.length ? Math.round((within / pairs.length) * 100) : 0 }
}

// --- progress, XP, streaks ---------------------------------------------------
export const STEPS = ['watch', 'try', 'decide', 'check', 'reflect'] as const
export type Step = (typeof STEPS)[number]
export const XP: Record<Step, number> = { watch: 10, try: 20, decide: 15, check: 20, reflect: 10 }
export const CHECK_PASS_PCT = 80

export function checkPassed(correct: number, total: number): boolean {
  return total > 0 && correct / total >= CHECK_PASS_PCT / 100 - 1e-9
}

export const dayKey = (d: Date): string => d.toISOString().slice(0, 10)

// Consecutive learning days ending today or yesterday (a nudge, never a requirement).
export function streakDays(days: string[], today: Date): number {
  const set = new Set(days)
  let cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  if (!set.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY_MS)
  let n = 0
  while (set.has(dayKey(cursor))) {
    n++
    cursor = new Date(cursor.getTime() - DAY_MS)
  }
  return n
}

// --- Module 3 knowledge-check exemption --------------------------------------
export const EXEMPT_BODIES = ['ICAN', 'ANAN', 'ACCA', 'CIA'] as const
// Returns the matching body, or null. Verified or self-declared both count; callers must say which.
export function exemptBody(bodies: string[]): string | null {
  for (const b of bodies) {
    const tokens = b.toUpperCase().split(/[^A-Z]+/).filter(Boolean)
    const hit = EXEMPT_BODIES.find((e) => tokens.includes(e))
    if (hit) return hit
  }
  return null
}

// --- badges -------------------------------------------------------------------
// Learning and accuracy only. Never the number of validations, rungs, speed or fees.
export const BADGE_KEYS = ['ladder-climber', 'evidence-hawk', 'clear-conscience', 'calibrated', 'riverbend-solved'] as const
export type BadgeKey = (typeof BADGE_KEYS)[number]
export type BadgeFacts = {
  completedModules: string[]
  rungChallengeDone: boolean
  evidenceSortPerfect: boolean
  conflictSpotterPerfect: boolean
  bestCalibrationPct: number | null
  capstonePassed: boolean
  capstoneScores: Record<string, number> | null
}
export function earnedBadges(f: BadgeFacts): BadgeKey[] {
  const out: BadgeKey[] = []
  if (f.completedModules.includes('m1') && f.completedModules.includes('m2') && f.rungChallengeDone) out.push('ladder-climber')
  if (f.evidenceSortPerfect && f.capstonePassed && (f.capstoneScores?.evidence ?? 0) >= 2) out.push('evidence-hawk')
  if (f.conflictSpotterPerfect) out.push('clear-conscience')
  if ((f.bestCalibrationPct ?? 0) >= DRILL.calibratedPct) out.push('calibrated')
  if (f.capstonePassed && (f.capstoneScores?.outcome ?? 0) >= 3) out.push('riverbend-solved')
  return out
}

// --- YouTube slot -------------------------------------------------------------
// Unlisted videos from youtube.com/@DiBadiliTV are pasted as ordinary YouTube links.
// Returns the video id, or null when the URL is not a YouTube watch / share / embed link.
export function youtubeEmbedId(url: string | null | undefined): string | null {
  if (!url) return null
  let u: URL
  try { u = new URL(url.trim()) } catch { return null }
  if (u.protocol !== 'https:') return null
  const host = u.hostname.replace(/^www\.|^m\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v')
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)
      id = m ? m[1] : null
    }
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null
}
