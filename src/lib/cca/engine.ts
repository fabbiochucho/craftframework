// CRAFT Capacity Assessment (CCA): the scoring and reporting engine shared by every CCA module (National, State,
// Local Government, Community, and the grant lifecycle: Pre-Award, During-Award, Post-Award).
// Spec: craft-internal docs/superpowers/specs/2026-11-05-universal-assessment-rigour.md §6 (parity checklist).
// Self-check: `node src/lib/cca/engine.test.ts`.
//
// How scoring works:
// - Every domain scores 1 to 4, whole numbers only. Level 1 is the starting point and needs no evidence.
// - Each higher level is a set of statements. A level is reached only when every statement in it, and in every level
//   below it, is met *and* backed by evidence that was seen. Anything not seen counts as not met.
// - The capacity-area and overall scores are averages of domain scores, read as a growth level.

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
export type GrowthLevel = (typeof GROWTH_LEVELS)[number]

/** Growth level from an average score: Nascent 1.00–2.00, Emerging >2.00–2.50, Expanding >2.50–3.50, Mature >3.50–4.00. */
export function growthLevel(avg: number): GrowthLevel {
  if (avg <= 2.0) return 'Nascent'
  if (avg <= 2.5) return 'Emerging'
  if (avg <= 3.5) return 'Expanding'
  return 'Mature'
}

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : 0)

export type AreaResult = { id: string; name: string; domains: { id: string; name: string; score: Score }[]; total: number; average: number; level: GrowthLevel }
export type Dashboard = { areas: AreaResult[]; total: number; average: number; level: GrowthLevel }

/** The dashboard: each capacity area's domain scores, total, average and growth level, plus the overall figures. */
export function dashboard(m: CcaModule, responses: Responses): Dashboard {
  const areas = m.areas.map((a) => {
    const domains = a.domains.map((d) => ({ id: d.id, name: d.name, score: domainScore(d, responses) }))
    const scores = domains.map((d) => d.score)
    const average = mean(scores)
    return { id: a.id, name: a.name, domains, total: scores.reduce<number>((x, y) => x + y, 0), average, level: growthLevel(average) }
  })
  const all = areas.flatMap((a) => a.domains.map((d) => d.score))
  const average = mean(all)
  return { areas, total: all.reduce<number>((x, y) => x + y, 0), average, level: growthLevel(average) }
}

// ---------------------------------------------------------------- Improvement plan (12 months)
export type PlanEntry = { domainId: string; costs?: number; timeline?: string; responsible?: string }
export type PlanRow = {
  areaId: string; domainId: string; domain: string; current: Score; envisioned: Score
  actions: string[]; cost: number; timeline: string; responsible: string
}

/**
 * The automatic improvement plan: every domain below 4 aims one level up within 12 months, with the unmet statements
 * of that level as the actions. The organisation adds cost, timeline and responsible person (entries).
 */
export function improvementPlan(m: CcaModule, responses: Responses, entries: PlanEntry[] = []): { rows: PlanRow[]; totalCost: number; byArea: Record<string, number> } {
  const byDomain = new Map(entries.map((e) => [e.domainId, e]))
  const rows: PlanRow[] = []
  for (const a of m.areas) for (const d of a.domains) {
    const current = domainScore(d, responses)
    if (current === 4) continue
    const e = byDomain.get(d.id)
    rows.push({
      areaId: a.id, domainId: d.id, domain: d.name, current, envisioned: (current + 1) as Score,
      actions: nextLevelGaps(d, responses).map((s) => s.text),
      cost: Math.max(0, e?.costs ?? 0), timeline: e?.timeline ?? '', responsible: e?.responsible ?? '',
    })
  }
  const byArea: Record<string, number> = {}
  for (const r of rows) byArea[r.areaId] = (byArea[r.areaId] ?? 0) + r.cost
  return { rows, totalCost: rows.reduce((t, r) => t + r.cost, 0), byArea }
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

/** The cascade: each capacity area's average, year by year, with the direction of travel. */
export function cascade(records: YearRecord[]): { areaId: string; name: string; series: { year: number; average: number }[]; trend: 'improving' | 'steady' | 'declining' }[] {
  const sorted = [...records].sort((a, b) => a.year - b.year)
  const areas = sorted[0]?.dashboard.areas ?? []
  return areas.map((a) => {
    const series = sorted.map((r) => ({ year: r.year, average: r.dashboard.areas.find((x) => x.id === a.id)?.average ?? 0 }))
    const delta = series.length > 1 ? series.at(-1)!.average - series[0].average : 0
    return { areaId: a.id, name: a.name, series, trend: delta > 0.1 ? 'improving' : delta < -0.1 ? 'declining' : 'steady' }
  })
}

// ---------------------------------------------------------------- Award readiness (Pre-Award)
export type Readiness = 'ready' | 'ready_with_conditions' | 'not_yet_ready'
export const READINESS_LABEL: Record<Readiness, string> = { ready: 'Ready', ready_with_conditions: 'Ready with conditions', not_yet_ready: 'Not yet ready' }

/**
 * Not yet ready: any critical domain at 1, or overall Nascent. Ready with conditions: any critical domain at 2, or any
 * domain at 1, or overall below Expanding. Ready otherwise. Conditions are the critical domains below 3 and every
 * domain at 1, each with its unmet statements.
 */
export function awardReadiness(m: CcaModule, responses: Responses): { rating: Readiness; conditions: { domainId: string; domain: string; score: Score; actions: string[] }[] } {
  const all = m.areas.flatMap((a) => a.domains)
  const scored = all.map((d) => ({ d, score: domainScore(d, responses) }))
  const avg = mean(scored.map((x) => x.score))
  const conditions = scored
    .filter(({ d, score }) => (d.critical && score < 3) || score === 1)
    .map(({ d, score }) => ({ domainId: d.id, domain: d.name, score, actions: nextLevelGaps(d, responses).map((s) => s.text) }))
  let rating: Readiness = 'ready'
  if (scored.some(({ d, score }) => d.critical && score === 1) || growthLevel(avg) === 'Nascent') rating = 'not_yet_ready'
  else if (conditions.length || avg <= 2.5) rating = 'ready_with_conditions'
  return { rating, conditions }
}

// ---------------------------------------------------------------- SWOT debrief
export type Swot = { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] }

/** A starting SWOT from the scores: domains at 4 are strengths, domains at 1 weaknesses. Facilitators add the rest. */
export function swotSeed(d: Dashboard): Swot {
  const domains = d.areas.flatMap((a) => a.domains)
  return { strengths: domains.filter((x) => x.score === 4).map((x) => x.name), weaknesses: domains.filter((x) => x.score === 1).map((x) => x.name), opportunities: [], threats: [] }
}
