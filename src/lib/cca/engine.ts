// CRAFT Capacity Assessment (CCA): the scoring and reporting engine shared by every CCA module (National, State,
// Local Government, Community, and the grant lifecycle: Pre-Award, During-Award, Post-Award).
// Spec: craft-internal docs/superpowers/specs/2026-11-05-universal-assessment-rigour.md §6 (parity checklist).
// Self-check: `node src/lib/cca/engine.test.ts`.
//
// How scoring works:
// - Every domain scores 1 to 4, whole numbers only. Level 1 is the starting point and needs no evidence.
// - Each higher level is a set of statements. A level is reached only when every statement in it, and in every level
//   below it, is met *and* backed by evidence that was seen. Anything not seen counts as not met.
// - A capacity area's score is the average of its assessed domains; the overall score is the average of the area
//   scores, so every area counts equally. A domain marked "not assessed" (with a reason) is left out of both.
// - Growth levels read the average as a share of the maximum (4): Nascent up to 25%, Emerging up to 50%, Expanding
//   up to 75%, Mature above 75%.

export type Statement = { id: string; text: string }
export type Domain = {
  id: string
  name: string
  /** What level 1 looks like (the starting point; no evidence needed). */
  level1: string
  /** Statements for levels 2, 3 and 4. All must be met, with evidence, to reach that level. */
  levels: { 2: Statement[]; 3: Statement[]; 4: Statement[] }
  /** Critical domains gate award readiness (see awardReadiness). */
  critical?: boolean
}
export type CapacityArea = { id: string; name: string; domains: Domain[] }
export type CcaModule = { id: string; name: string; audience: string; areas: CapacityArea[] }

/** One statement's response: met, and what evidence was seen. Met without evidence does not count. */
export type StatementResponse = { met: boolean; evidence: string }
export type Responses = Record<string, StatementResponse>
/** Domains deliberately left out of this assessment: domain id -> the reason. Not allowed in grant-stage modules. */
export type NotAssessed = Record<string, string>

export const ADDED_LATER = 'Added to the module after this assessment was completed'

/**
 * The domains to leave out when scoring a stored assessment: those marked not assessed, plus, for a completed
 * assessment, any domain added to the module after it was completed (domainIds is the list it covered). New content
 * therefore never lowers a past result.
 */
export function effectiveNotAssessed(m: CcaModule, notAssessed: NotAssessed = {}, domainIds?: string[] | null): NotAssessed {
  if (!domainIds?.length) return notAssessed
  const covered = new Set(domainIds)
  const later = m.areas.flatMap((a) => a.domains).filter((d) => !covered.has(d.id)).map((d) => [d.id, ADDED_LATER])
  return { ...Object.fromEntries(later), ...notAssessed }
}

export const LEVELS = [1, 2, 3, 4] as const
export type Score = (typeof LEVELS)[number]

const evidenced = (r: StatementResponse | undefined) => !!r?.met && r.evidence.trim().length > 0

/** The domain's score: the highest level whose statements, and all below, are met and evidenced. */
export function domainScore(d: Domain, responses: Responses): Score {
  let score: Score = 1
  for (const level of [2, 3, 4] as const) {
    if (!d.levels[level].every((s) => evidenced(responses[s.id]))) break
    score = level
  }
  return score
}

/** Statements standing between the domain and the next level (empty at 4). */
export function nextLevelGaps(d: Domain, responses: Responses): Statement[] {
  const s = domainScore(d, responses)
  if (s === 4) return []
  return d.levels[(s + 1) as 2 | 3 | 4].filter((x) => !evidenced(responses[x.id]))
}

export const GROWTH_LEVELS = ['Nascent', 'Emerging', 'Expanding', 'Mature'] as const
export type GrowthLevel = (typeof GROWTH_LEVELS)[number] | 'Not assessed'

/**
 * Growth level from an average score (1–4), as a share of the maximum: Nascent up to 25% (1.00), Emerging >25–50%
 * (to 2.00), Expanding >50–75% (to 3.00), Mature above 75%. Nothing scored (0) is Not assessed.
 */
export function growthLevel(avg: number): GrowthLevel {
  if (avg <= 0) return 'Not assessed'
  if (avg <= 1) return 'Nascent'
  if (avg <= 2) return 'Emerging'
  if (avg <= 3) return 'Expanding'
  return 'Mature'
}

/** The average as a percentage of the maximum score (4). */
export const percentOfMax = (avg: number) => Math.round((avg / 4) * 100)

const rawMean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const round2 = (x: number) => Math.round(x * 100) / 100

export type DomainResult = { id: string; name: string; score: Score; assessed: boolean }
export type AreaResult = { id: string; name: string; domains: DomainResult[]; total: number; average: number; percent: number; level: GrowthLevel }
export type Dashboard = { areas: AreaResult[]; total: number; average: number; percent: number; level: GrowthLevel }

/**
 * The dashboard: each capacity area's domain scores, total, average and growth level, plus the overall figures. Levels
 * are read from the unrounded averages, so rounding for display never moves a result across a band.
 */
export function dashboard(m: CcaModule, responses: Responses, notAssessed: NotAssessed = {}): Dashboard {
  const raw = m.areas.map((a) => {
    const domains = a.domains.map((d) => ({ id: d.id, name: d.name, score: domainScore(d, responses), assessed: !notAssessed[d.id] }))
    const scores = domains.filter((d) => d.assessed).map((d) => d.score)
    return { a, domains, scores, avg: rawMean(scores) }
  })
  const areas = raw.map(({ a, domains, scores, avg }) => ({
    id: a.id, name: a.name, domains, total: scores.reduce<number>((x, y) => x + y, 0), average: round2(avg), percent: percentOfMax(avg), level: growthLevel(avg),
  }))
  const avg = rawMean(raw.filter((r) => r.scores.length).map((r) => r.avg))
  return { areas, total: areas.reduce((t, a) => t + a.total, 0), average: round2(avg), percent: percentOfMax(avg), level: growthLevel(avg) }
}

// ---------------------------------------------------------------- Improvement plan (12 months)
/** What capacity improvement costs, by kind. Training is per participant, multiplied by the number of participants. */
export const COST_LINES = [
  { id: 'technicalAssistance', label: 'Technical assistance' },
  { id: 'trainingPerParticipant', label: 'Training, per participant' },
  { id: 'printing', label: 'Printing guidelines, policies and tools' },
  { id: 'exchangeVisits', label: 'Exchange and learning visits' },
  { id: 'eLearning', label: 'E-learning' },
] as const
export type CostLine = (typeof COST_LINES)[number]['id']
export type CostLines = Partial<Record<CostLine, number>> & { participants?: number }

/** costs: a single figure (plans saved before cost lines existed); lines replace it when present. */
export type PlanEntry = { domainId: string; costs?: number; lines?: CostLines; timeline?: string; responsible?: string }
export type PlanRow = {
  areaId: string; domainId: string; domain: string; current: Score; envisioned: Score
  actions: string[]; lines: Record<CostLine, number>; cost: number; timeline: string; responsible: string
}

const pos = (x: number | undefined) => (Number.isFinite(x) && x! > 0 ? x! : 0)

/** One entry's cost by line (training already multiplied by participants) and its total. */
export function entryCost(e: PlanEntry | undefined): { lines: Record<CostLine, number>; total: number } {
  const l = e?.lines
  const lines = Object.fromEntries(COST_LINES.map((c) => [c.id, 0])) as Record<CostLine, number>
  if (!l) return { lines, total: pos(e?.costs) }
  for (const c of COST_LINES) lines[c.id] = pos(l[c.id])
  lines.trainingPerParticipant *= Math.max(1, Math.floor(pos(l.participants)))
  return { lines, total: COST_LINES.reduce((t, c) => t + lines[c.id], 0) }
}

/**
 * The automatic improvement plan: every domain below 4 aims one level up within 12 months, with the unmet statements
 * of that level as the actions. The organisation adds cost, timeline and responsible person (entries).
 */
export function improvementPlan(m: CcaModule, responses: Responses, entries: PlanEntry[] = [], notAssessed: NotAssessed = {}): {
  rows: PlanRow[]; totalCost: number; byArea: Record<string, number>; byLine: Record<CostLine, number>; toAssess: { domainId: string; domain: string; reason: string }[]
} {
  const byDomain = new Map(entries.map((e) => [e.domainId, e]))
  const rows: PlanRow[] = []
  const toAssess: { domainId: string; domain: string; reason: string }[] = []
  for (const a of m.areas) for (const d of a.domains) {
    if (notAssessed[d.id]) { toAssess.push({ domainId: d.id, domain: d.name, reason: notAssessed[d.id] }); continue }
    const current = domainScore(d, responses)
    if (current === 4) continue
    const e = byDomain.get(d.id)
    const c = entryCost(e)
    rows.push({
      areaId: a.id, domainId: d.id, domain: d.name, current, envisioned: (current + 1) as Score,
      actions: nextLevelGaps(d, responses).map((s) => s.text),
      lines: c.lines, cost: c.total, timeline: e?.timeline ?? '', responsible: e?.responsible ?? '',
    })
  }
  const byArea: Record<string, number> = {}
  const byLine = Object.fromEntries(COST_LINES.map((c) => [c.id, 0])) as Record<CostLine, number>
  for (const r of rows) {
    byArea[r.areaId] = (byArea[r.areaId] ?? 0) + r.cost
    for (const c of COST_LINES) byLine[c.id] += r.lines[c.id]
  }
  return { rows, totalCost: rows.reduce((t, r) => t + r.cost, 0), byArea, byLine, toAssess }
}

/** At the next assessment: which envisioned scores were reached. */
export function planReview(previous: PlanRow[], now: Dashboard): { domainId: string; envisioned: Score; reached: Score; met: boolean }[] {
  const scores = new Map(now.areas.flatMap((a) => a.domains.map((d) => [d.id, d.score] as const)))
  return previous.map((r) => {
    const reached = scores.get(r.domainId) ?? 1
    return { domainId: r.domainId, envisioned: r.envisioned, reached, met: reached >= r.envisioned }
  })
}

// ---------------------------------------------------------------- Facilitated scoring
/** Approach I: anonymous votes. The spread of votes for display. */
export function voteSpread(votes: Score[]): Record<Score, number> {
  const out = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<Score, number>
  for (const v of votes) out[v]++
  return out
}

/**
 * Approach I resolution: start from the highest score anyone voted for; if the evidence does not support it, move to
 * the next score voted for, most votes first, then lower; stop at the first score the evidence supports. The evidence
 * (the engine's domain score) always has the last word: the result is never above it.
 */
export function resolveVotes(votes: Score[], evidencedScore: Score): Score {
  const spread = voteSpread(votes)
  const voted = (LEVELS.filter((l) => spread[l] > 0) as Score[])
  const highest = Math.max(...voted, 1) as Score
  if (highest <= evidencedScore) return highest
  const candidates = voted.filter((l) => l <= evidencedScore).sort((a, b) => spread[b] - spread[a] || b - a)
  return candidates[0] ?? evidencedScore
}

// ---------------------------------------------------------------- Multi-year tracking and reports
export type YearRecord = { year: number; dashboard: Dashboard }
export type ReportKind = 'yearly' | 'mid_term' | 'five_year'

/** Yearly needs one assessment; mid-term needs three consecutive years; five-year needs five. */
export function availableReports(records: YearRecord[]): ReportKind[] {
  const years = new Set(records.map((r) => r.year))
  if (!years.size) return []
  // Consecutive years ending with the latest assessment.
  let run = 0
  for (let y = Math.max(...years); years.has(y); y--) run++
  const out: ReportKind[] = ['yearly']
  if (run >= 3) out.push('mid_term')
  if (run >= 5) out.push('five_year')
  return out
}

/** The cascade: each capacity area's average, year by year (years it was not assessed are left out), with the direction of travel. */
export function cascade(records: YearRecord[]): { areaId: string; name: string; series: { year: number; average: number }[]; trend: 'improving' | 'steady' | 'declining' }[] {
  const sorted = [...records].sort((a, b) => a.year - b.year)
  const areas = sorted[0]?.dashboard.areas ?? []
  return areas.map((a) => {
    const series = sorted.flatMap((r) => {
      const x = r.dashboard.areas.find((y) => y.id === a.id)
      return x && x.level !== 'Not assessed' ? [{ year: r.year, average: x.average }] : []
    })
    const delta = series.length > 1 ? series.at(-1)!.average - series[0].average : 0
    return { areaId: a.id, name: a.name, series, trend: delta > 0.1 ? 'improving' : delta < -0.1 ? 'declining' : 'steady' }
  })
}

// ---------------------------------------------------------------- Award readiness (Pre-Award)
export type Readiness = 'ready' | 'ready_with_conditions' | 'not_yet_ready'
export const READINESS_LABEL: Record<Readiness, string> = { ready: 'Ready', ready_with_conditions: 'Ready with conditions', not_yet_ready: 'Not yet ready' }

/**
 * Not yet ready: any critical domain at 1, or overall Nascent. Ready with conditions: any critical domain at 2, or any
 * domain at 1, or overall below Expanding (Emerging). Every domain counts: grant-stage modules cannot skip domains. Ready otherwise. Conditions are the critical domains below 3 and every
 * domain at 1, each with its unmet statements.
 */
export function awardReadiness(m: CcaModule, responses: Responses): { rating: Readiness; conditions: { domainId: string; domain: string; score: Score; actions: string[] }[] } {
  const all = m.areas.flatMap((a) => a.domains)
  const scored = all.map((d) => ({ d, score: domainScore(d, responses) }))
  const level = dashboard(m, responses).level
  const conditions = scored
    .filter(({ d, score }) => (d.critical && score < 3) || score === 1)
    .map(({ d, score }) => ({ domainId: d.id, domain: d.name, score, actions: nextLevelGaps(d, responses).map((s) => s.text) }))
  let rating: Readiness = 'ready'
  if (scored.some(({ d, score }) => d.critical && score === 1) || level === 'Nascent') rating = 'not_yet_ready'
  else if (conditions.length || level === 'Emerging') rating = 'ready_with_conditions'
  return { rating, conditions }
}

// ---------------------------------------------------------------- SWOT debrief
export type Swot = { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] }

/** A starting SWOT from the scores: domains at 4 are strengths, domains at 1 weaknesses. Facilitators add the rest. */
export function swotSeed(d: Dashboard): Swot {
  const domains = d.areas.flatMap((a) => a.domains).filter((x) => x.assessed)
  return { strengths: domains.filter((x) => x.score === 4).map((x) => x.name), weaknesses: domains.filter((x) => x.score === 1).map((x) => x.name), opportunities: [], threats: [] }
}
