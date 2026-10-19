// ============================================================================
// Quantified risk: a loss-quantification method aligned with Open FAIR (indices spec §8)
// ----------------------------------------------------------------------------
// Pure and seeded. A scenario's inputs are ranges; a Monte Carlo run draws them
// from PERT distributions, draws the number of loss events from a Poisson
// distribution (threat event frequency × vulnerability), and sums the six loss
// forms for each event. Results are always ranges with their assumptions.
// Not part of a validation. Self-check: `node src/lib/fairRisk.test.ts`.
// ============================================================================

export type Confidence = 'low' | 'medium' | 'high'
export type Range = { min: number; likely: number; max: number; confidence?: Confidence }

export const LOSS_FORMS = [
  { key: 'productivity', label: 'Productivity', hint: 'Work that stops or slows: lost output, idle staff, delayed programmes.' },
  { key: 'response', label: 'Response', hint: 'Handling the event: investigation, legal advice, communications, staff time.' },
  { key: 'replacement', label: 'Replacement', hint: 'Replacing or repairing what was lost: funds, assets, data, people.' },
  { key: 'fines', label: 'Fines and penalties', hint: 'Regulatory fines, funder disallowances and repayments, judgments.' },
  { key: 'competitive', label: 'Competitive advantage', hint: 'Lost bids, partnerships or market position.' },
  { key: 'reputation', label: 'Reputation', hint: 'Funding and income lost because others trust you less.' },
] as const
export type LossForm = (typeof LOSS_FORMS)[number]['key']

export type ScenarioFix = {
  /** The Capacity Improvement Plan action that closes the gap. */
  actionId?: string
  /** Estimated cost of the action, in the same currency as the losses. */
  cost: number
  /** What the fix changes; anything not given stays as in the open-gap case. */
  tef?: Range
  vulnerability?: Range
  losses?: Partial<Record<LossForm, Range>>
}

export type Scenario = {
  id: string
  name: string
  /** What is at risk, what acts against it, and what happens. */
  asset: string
  threat: string
  effect: string
  /** Fiduciary Controls & Risk Management or Resilience indicators this scenario relates to. */
  indicatorIds: string[]
  /** Threat event frequency: attempts or occurrences a year. */
  tef: Range
  /** Probability (0-1) that a threat event becomes a loss event. */
  vulnerability: Range
  losses: Record<LossForm, Range>
  fix?: ScenarioFix
  currency?: string
  notes?: string
}

export type SimResult = {
  runs: number
  mean: number
  p10: number
  p50: number
  p90: number
  /** 1-in-20 and 1-in-100-year losses, and the chance of any loss in a year (rare losses read 0 at p10-p90). */
  p95: number
  p99: number
  pAny: number
  /** Loss exceedance curve: the chance a year's loss is greater than each amount. */
  exceedance: Array<{ loss: number; probability: number }>
}

export const RUNS = 10_000
/** Loss events a year (frequency × vulnerability) are capped so a run always finishes quickly. */
export const MAX_LOSS_EVENTS = 100
const MAX_AMOUNT = 1e12

/** Small, fast seeded generator (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normal(rng: () => number): number {
  const u = Math.max(rng(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

// PERT (λ = 4) by inverse CDF from a precomputed table: one uniform per draw, so the same uniform always maps to the
// same point of the distribution. That is what makes "with and without the fix" comparable draw for draw.
const TABLE = 1024
const samplers = new Map<string, (u: number) => number>()
function pertSampler(r: Range): (u: number) => number {
  const key = `${r.min}|${r.likely}|${r.max}`
  const hit = samplers.get(key)
  if (hit) return hit
  let fn: (u: number) => number
  if (!(r.max > r.min)) fn = () => r.min
  else {
    const span = r.max - r.min
    const likely = Math.min(r.max, Math.max(r.min, r.likely))
    const a = 1 + (4 * (likely - r.min)) / span
    const b = 1 + (4 * (r.max - likely)) / span
    const cdf = new Float64Array(TABLE + 1)
    for (let k = 0; k < TABLE; k++) {
      const x = (k + 0.5) / TABLE
      cdf[k + 1] = cdf[k] + x ** (a - 1) * (1 - x) ** (b - 1)
    }
    const total = cdf[TABLE]
    fn = (u) => {
      const t = u * total
      let lo = 0, hi = TABLE
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cdf[mid] < t) lo = mid; else hi = mid }
      const within = cdf[hi] > cdf[lo] ? (t - cdf[lo]) / (cdf[hi] - cdf[lo]) : 0
      return r.min + ((lo + within) / TABLE) * span
    }
  }
  if (samplers.size > 500) samplers.clear()
  samplers.set(key, fn)
  return fn
}

/** A draw from the PERT distribution over a range (λ = 4). */
export function pert(r: Range, rng: () => number): number {
  return pertSampler(r)(rng())
}

/** A draw from the Poisson distribution with mean lambda. */
export function poisson(lambda: number, rng: () => number): number {
  if (!(lambda > 0)) return 0
  if (lambda > MAX_LOSS_EVENTS) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal(rng)))
  return poissonFromUniform(lambda, rng())
}

// Inverse CDF from one uniform (lambda ≤ MAX_LOSS_EVENTS, so exp(-lambda) never underflows).
function poissonFromUniform(lambda: number, u: number): number {
  if (!(lambda > 0)) return 0
  let p = Math.exp(-lambda), cdf = p, k = 0
  while (u > cdf && k < 10 * MAX_LOSS_EVENTS) { k++; p *= lambda / k; cdf += p }
  return k
}

// A uniform for (seed, run, purpose, index): independent of every other draw, so changing one input moves only its own draws.
function uniform(...parts: number[]): number {
  let h = 2166136261
  for (const x of parts) { h ^= x >>> 0; h = Math.imul(h, 16777619); h ^= h >>> 13 }
  return mulberry32(h)()
}

const pct = (sorted: number[], q: number) => sorted[Math.floor(q * (sorted.length - 1))]

export function simulate(s: Scenario, opts: { seed?: number; runs?: number; grid?: number[] } = {}): SimResult {
  const runs = opts.runs ?? RUNS
  const seed = opts.seed ?? 1
  const tef = pertSampler(s.tef), vuln = pertSampler(s.vulnerability)
  const forms = LOSS_FORMS.map((f) => pertSampler(s.losses[f.key]))
  const losses = new Array<number>(runs)
  for (let i = 0; i < runs; i++) {
    const lef = Math.min(MAX_LOSS_EVENTS, tef(uniform(seed, i, 1)) * Math.min(1, Math.max(0, vuln(uniform(seed, i, 2)))))
    const events = poissonFromUniform(lef, uniform(seed, i, 3))
    let year = 0
    for (let e = 0; e < events; e++) for (let j = 0; j < forms.length; j++) year += forms[j](uniform(seed, i, 4, e, j))
    losses[i] = year
  }
  const sorted = [...losses].sort((x, y) => x - y)
  const mean = losses.reduce((t, x) => t + x, 0) / runs
  const top = pct(sorted, 0.99) || sorted[sorted.length - 1]
  const points = 20
  const grid = opts.grid ?? Array.from({ length: points }, (_, k) => Math.round((top * k) / (points - 1)))
  const exceedance = grid.map((loss) => ({ loss, probability: Math.round((sorted.filter((x) => x > loss).length / runs) * 10000) / 10000 }))
  return {
    runs, mean: Math.round(mean), p10: Math.round(pct(sorted, 0.1)), p50: Math.round(pct(sorted, 0.5)), p90: Math.round(pct(sorted, 0.9)),
    p95: Math.round(pct(sorted, 0.95)), p99: Math.round(pct(sorted, 0.99)), pAny: Math.round((losses.filter((x) => x > 0).length / runs) * 10000) / 10000,
    exceedance,
  }
}

export type GapCost = { scenarioId: string; open: SimResult; fixed: SimResult; reduction: number; cost: number; ratio: number | null }

/**
 * Likely annual loss with the gap open versus after the fix, against the fix's cost. Every draw has its own seeded
 * uniform, so the two runs differ only where the fix changes an input; both curves share the open run's loss grid.
 */
export function costOfGap(s: Scenario, opts: { seed?: number; runs?: number } = {}): GapCost | null {
  if (!s.fix) return null
  const fixed: Scenario = {
    ...s, tef: s.fix.tef ?? s.tef, vulnerability: s.fix.vulnerability ?? s.vulnerability, losses: { ...s.losses, ...s.fix.losses },
  }
  const open = simulate(s, opts)
  const after = simulate(fixed, { ...opts, grid: open.exceedance.map((p) => p.loss) })
  const reduction = Math.round(open.mean - after.mean)
  return { scenarioId: s.id, open, fixed: after, reduction, cost: s.fix.cost, ratio: s.fix.cost > 0 ? Math.round((reduction / s.fix.cost) * 100) / 100 : null }
}

/** Fixes ranked by loss avoided per unit of cost; a fix with no cost given ranks last. */
export function rankByCostOfGap(scenarios: Scenario[], opts: { seed?: number; runs?: number } = {}): GapCost[] {
  return scenarios.map((s) => costOfGap(s, opts)).filter((g): g is GapCost => !!g)
    .sort((a, b) => (b.ratio ?? -Infinity) - (a.ratio ?? -Infinity) || b.reduction - a.reduction)
}

function problemsOf(label: string, r: Range | undefined, maxAllowed = Infinity): string[] {
  if (!r) return [`${label}: enter a range`]
  if (![r.min, r.likely, r.max].every((x) => typeof x === 'number' && Number.isFinite(x))) return [`${label}: enter numbers`]
  const out: string[] = []
  if (r.min < 0) out.push(`${label}: cannot be negative`)
  if (!(r.min <= r.likely && r.likely <= r.max)) out.push(`${label}: minimum ≤ most likely ≤ maximum`)
  if (r.max > maxAllowed) out.push(`${label}: cannot be above ${maxAllowed.toLocaleString()}`)
  return out
}

/** Everything wrong with a scenario's ranges, as plain sentences. Empty = ready to run. */
export function rangeProblems(s: Scenario): string[] {
  const out = [
    ...problemsOf('Threat event frequency', s.tef),
    ...problemsOf('Vulnerability', s.vulnerability, 1),
    ...LOSS_FORMS.flatMap((f) => problemsOf(f.label, s.losses?.[f.key], MAX_AMOUNT)),
  ]
  if (s.tef && s.vulnerability && s.tef.max * Math.min(1, s.vulnerability.max) > MAX_LOSS_EVENTS) {
    out.push(`At most ${MAX_LOSS_EVENTS} loss events a year (frequency maximum × vulnerability maximum); split very frequent, small losses into one yearly event`)
  }
  if (s.fix) {
    if (!(s.fix.cost >= 0)) out.push('Fix: enter its cost')
    if (s.fix.tef) out.push(...problemsOf('Fix: threat event frequency', s.fix.tef))
    if (s.fix.vulnerability) out.push(...problemsOf('Fix: vulnerability', s.fix.vulnerability, 1))
    for (const f of LOSS_FORMS) if (s.fix.losses?.[f.key]) out.push(...problemsOf(`Fix: ${f.label}`, s.fix.losses[f.key]))
  }
  return out
}

/**
 * Who may read a saved state key. Financial inputs (`fair:*`) are restricted like evidence: the organisation's own
 * users, and others (funders, portfolio reviewers) only once the organisation has consented. Platform admins get
 * no bypass. Whether consent is given (`fair:consent`) is readable, so a reviewer can be told why figures are hidden.
 */
export function fairKeyReadable(i: { key: string; ownOrg: boolean; consent: boolean; /** Recorded for audit; gives no bypass. */ superAdmin?: boolean }): boolean {
  if (!i.key.startsWith('fair:') || i.key === 'fair:consent') return true
  return i.ownOrg || i.consent
}

export const FAIR_WORDING = 'A loss-quantification method aligned with Open FAIR. Results are estimates shown as ranges, based on the assumptions entered; they are not part of a CRAFT validation.'

const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d)
function range(x: unknown, d: Range): Range {
  const r = (x && typeof x === 'object' ? x : {}) as Partial<Range>
  const out: Range = { min: num(r.min, d.min), likely: num(r.likely, d.likely), max: num(r.max, d.max) }
  if (r.confidence === 'low' || r.confidence === 'medium' || r.confidence === 'high') out.confidence = r.confidence
  return out
}
const ZERO: Range = { min: 0, likely: 0, max: 0 }
const str = (x: unknown, d = '') => (typeof x === 'string' ? x : d)

/** A saved scenario from any client version, repaired to a full scenario; null when it is not one at all. */
export function normaliseScenario(x: unknown): Scenario | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null
  const o = x as Record<string, any>
  const losses = Object.fromEntries(LOSS_FORMS.map((f) => [f.key, range(o.losses?.[f.key], ZERO)])) as Record<LossForm, Range>
  const s: Scenario = {
    id: str(o.id) || `sc_${Math.random().toString(36).slice(2, 10)}`, name: str(o.name, 'Untitled scenario'),
    asset: str(o.asset), threat: str(o.threat), effect: str(o.effect),
    indicatorIds: Array.isArray(o.indicatorIds) ? o.indicatorIds.filter((i: unknown): i is string => typeof i === 'string') : [],
    tef: range(o.tef, { min: 1, likely: 1, max: 2 }), vulnerability: range(o.vulnerability, { min: 0.1, likely: 0.2, max: 0.4 }), losses,
  }
  if (typeof o.currency === 'string') s.currency = o.currency.slice(0, 6)
  if (typeof o.notes === 'string') s.notes = o.notes.slice(0, 2000)
  if (o.fix && typeof o.fix === 'object') {
    s.fix = { cost: Math.max(0, num(o.fix.cost, 0)) }
    if (typeof o.fix.actionId === 'string') s.fix.actionId = o.fix.actionId
    if (o.fix.tef) s.fix.tef = range(o.fix.tef, s.tef)
    if (o.fix.vulnerability) s.fix.vulnerability = range(o.fix.vulnerability, s.vulnerability)
    if (o.fix.losses && typeof o.fix.losses === 'object') {
      s.fix.losses = Object.fromEntries(LOSS_FORMS.filter((f) => o.fix.losses[f.key]).map((f) => [f.key, range(o.fix.losses[f.key], ZERO)]))
    }
  }
  return s
}
