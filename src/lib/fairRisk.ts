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
  /** Loss exceedance curve: the chance a year's loss is greater than each amount. */
  exceedance: Array<{ loss: number; probability: number }>
}

export const RUNS = 10_000
const MAX_EVENTS_PER_YEAR = 1000

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

// Marsaglia and Tsang; shape >= 1 here (PERT shapes are always at least 1).
function gamma(shape: number, rng: () => number): number {
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number, v: number
    do { x = normal(rng); v = 1 + c * x } while (v <= 0)
    v = v * v * v
    const u = rng()
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

/** A draw from the PERT distribution over a range (λ = 4). */
export function pert(r: Range, rng: () => number): number {
  if (r.max <= r.min) return r.min
  const span = r.max - r.min
  const alpha = 1 + (4 * (r.likely - r.min)) / span
  const beta = 1 + (4 * (r.max - r.likely)) / span
  const x = gamma(alpha, rng)
  const y = gamma(beta, rng)
  return r.min + (x / (x + y)) * span
}

/** A draw from the Poisson distribution with mean lambda. */
export function poisson(lambda: number, rng: () => number): number {
  if (!(lambda > 0)) return 0
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal(rng)))
  const limit = Math.exp(-lambda)
  let k = 0
  let p = rng()
  while (p > limit) { k++; p *= rng() }
  return k
}

const pct = (sorted: number[], q: number) => sorted[Math.floor(q * (sorted.length - 1))]

export function simulate(s: Scenario, opts: { seed?: number; runs?: number } = {}): SimResult {
  const runs = opts.runs ?? RUNS
  const rng = mulberry32(opts.seed ?? 1)
  const losses = new Array<number>(runs)
  for (let i = 0; i < runs; i++) {
    const lef = pert(s.tef, rng) * Math.min(1, Math.max(0, pert(s.vulnerability, rng)))
    const events = Math.min(MAX_EVENTS_PER_YEAR, poisson(lef, rng))
    let year = 0
    for (let e = 0; e < events; e++) for (const f of LOSS_FORMS) year += pert(s.losses[f.key], rng)
    losses[i] = year
  }
  const sorted = [...losses].sort((x, y) => x - y)
  const mean = losses.reduce((t, x) => t + x, 0) / runs
  const top = pct(sorted, 0.99) || sorted[sorted.length - 1]
  const points = 20
  const exceedance = Array.from({ length: points }, (_, k) => {
    const loss = Math.round((top * k) / (points - 1))
    return { loss, probability: Math.round((sorted.filter((x) => x > loss).length / runs) * 10000) / 10000 }
  })
  return { runs, mean: Math.round(mean), p10: Math.round(pct(sorted, 0.1)), p50: Math.round(pct(sorted, 0.5)), p90: Math.round(pct(sorted, 0.9)), exceedance }
}

export type GapCost = { scenarioId: string; open: SimResult; fixed: SimResult; reduction: number; cost: number; ratio: number | null }

/** Likely annual loss with the gap open versus after the fix, against the fix's cost. Same seed, so only the fix differs. */
export function costOfGap(s: Scenario, opts: { seed?: number; runs?: number } = {}): GapCost | null {
  if (!s.fix) return null
  const fixed: Scenario = {
    ...s, tef: s.fix.tef ?? s.tef, vulnerability: s.fix.vulnerability ?? s.vulnerability, losses: { ...s.losses, ...s.fix.losses },
  }
  const open = simulate(s, opts)
  const after = simulate(fixed, opts)
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
  if (r.max > maxAllowed) out.push(`${label}: cannot be above ${maxAllowed}`)
  return out
}

/** Everything wrong with a scenario's ranges, as plain sentences. Empty = ready to run. */
export function rangeProblems(s: Scenario): string[] {
  const out = [
    ...problemsOf('Threat event frequency', s.tef),
    ...problemsOf('Vulnerability', s.vulnerability, 1),
    ...LOSS_FORMS.flatMap((f) => problemsOf(f.label, s.losses?.[f.key])),
  ]
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
export function fairKeyReadable(i: { key: string; ownOrg: boolean; superAdmin: boolean; consent: boolean }): boolean {
  if (!i.key.startsWith('fair:') || i.key === 'fair:consent') return true
  return i.ownOrg || i.consent
}

export const FAIR_WORDING = 'A loss-quantification method aligned with Open FAIR. Results are estimates shown as ranges, based on the assumptions entered; they are not part of a CRAFT validation.'
