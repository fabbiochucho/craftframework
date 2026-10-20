// Net-zero target check (ESG). Compares an organisation's stated reduction target with dated 1.5°C benchmarks.
// Indicative only: it is not an SBTi validation. Self-check: `node src/lib/netZero.test.ts`.

export const NET_ZERO_QUESTION_IDS = ['ESG-Z1', 'ESG-Z2', 'ESG-Z3', 'ESG-Z4'] as const

export const BENCHMARKS = {
  sbtiNearTerm: {
    label: 'SBTi near-term 1.5°C absolute contraction (Corporate Net-Zero Standard V1.x)',
    annualRatePct: 4.2,
    note: 'Minimum linear annual reduction for Scope 1 and 2 under V1.3.1, usable until 31 January 2028. Corporate Net-Zero Standard V2.0 (June 2026) introduces new target types and rolling base years; new targets must use it from February 2028.',
    source: 'https://sciencebasedtargets.org/news/the-sbti-releases-corporate-net-zero-standard-v2-0-to-accelerate-corporate-climate-action',
    asOf: '2026-10-19',
  },
  ipcc2030: {
    label: 'IPCC AR6 global 1.5°C pathway',
    reductionBy2030Pct: 43,
    note: 'Global greenhouse gas emissions 43% (range 34-60%) below 2019 levels by 2030 in 1.5°C pathways with no or limited overshoot; net zero CO2 in the early 2050s.',
    source: 'https://www.carbonbrief.org/analysis-what-the-new-ipcc-report-says-about-how-to-limit-warming-to-1-5c-or-2c/',
    asOf: '2026-10-19',
  },
  longTerm: {
    label: 'Deep reduction before neutralising residual emissions',
    reductionPct: 90,
    netZeroYear: 2050,
    note: 'SBTi V1 required at least a 90% cut by 2050 (for most sectors), with only residual emissions neutralised by permanent removals; V2.0 makes long-term targets recommended rather than required. Carbon credits never substitute for an organisation\'s own reductions.',
    source: 'https://watershed.com/blog/sbti-cnzs-2',
    asOf: '2026-10-19',
  },
} as const

export type TargetInput = {
  baseYear: number
  /** Scope 1 and 2 emissions in the base year, tCO2e. */
  baseEmissions: number
  targetYear: number
  /** Percentage cut from the base year by the target year. */
  targetReductionPct: number
  netZeroYear?: number
  longTermReductionPct?: number
  creditsCountedTowardsTarget?: boolean
}

export type TargetCheck = {
  verdict: 'aligned' | 'short' | 'invalid'
  problems: string[]
  /** Linear percentage points a year implied by the target. */
  annualRatePct: number | null
  /** How far short of the benchmark cut the target is, by its target year (percentage points). */
  gapPct: number | null
  /** Cut implied by 2030 on the same linear path, for comparison with the IPCC 2030 figure. */
  implied2030Pct: number | null
  flags: string[]
}

/** What the net-zero card saves (tenant key esg:netzero): any field may be missing while the user is typing. */
export type SavedTarget = Partial<Record<keyof TargetInput, number | boolean>>
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
export function targetFromSaved(s: SavedTarget | null | undefined): TargetInput {
  const v = s && typeof s === 'object' ? s : {}
  return {
    baseYear: num(v.baseYear) ?? 0, baseEmissions: num(v.baseEmissions) ?? 0, targetYear: num(v.targetYear) ?? 0, targetReductionPct: num(v.targetReductionPct) ?? 0,
    netZeroYear: num(v.netZeroYear), longTermReductionPct: num(v.longTermReductionPct), creditsCountedTowardsTarget: v.creditsCountedTowardsTarget === true,
  }
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

export function checkTarget(i: TargetInput): TargetCheck {
  const problems: string[] = []
  if (!(i.baseEmissions > 0)) problems.push('Enter base-year emissions above zero')
  if (!(i.targetYear > i.baseYear)) problems.push('The target year must be after the base year')
  if (!(i.targetReductionPct > 0 && i.targetReductionPct <= 100)) problems.push('The reduction must be between 0 and 100%')
  if (i.longTermReductionPct !== undefined && !(i.longTermReductionPct > 0 && i.longTermReductionPct <= 100)) problems.push('The long-term reduction must be between 0 and 100%')
  if (problems.length) return { verdict: 'invalid', problems, annualRatePct: null, gapPct: null, implied2030Pct: null, flags: [] }

  const years = i.targetYear - i.baseYear
  const annualRatePct = round(i.targetReductionPct / years)
  const benchmarkCut = Math.min(100, BENCHMARKS.sbtiNearTerm.annualRatePct * years)
  const gapPct = round(Math.max(0, benchmarkCut - i.targetReductionPct))
  const implied2030Pct = 2030 > i.baseYear ? round(Math.min(100, annualRatePct * (2030 - i.baseYear))) : null
  const flags: string[] = []
  if (implied2030Pct !== null && implied2030Pct < BENCHMARKS.ipcc2030.reductionBy2030Pct) {
    flags.push(`On this path the cut by 2030 is ${implied2030Pct}%, below the ${BENCHMARKS.ipcc2030.reductionBy2030Pct}% global 1.5°C figure (note the base years differ).`)
  }
  if (i.netZeroYear !== undefined && i.netZeroYear > BENCHMARKS.longTerm.netZeroYear) flags.push(`A net-zero year after ${BENCHMARKS.longTerm.netZeroYear} is later than 1.5°C pathways need.`)
  if (i.longTermReductionPct !== undefined && i.longTermReductionPct < BENCHMARKS.longTerm.reductionPct) {
    flags.push(`A long-term cut below ${BENCHMARKS.longTerm.reductionPct}% leaves more than residual emissions to neutralise.`)
  }
  if (i.creditsCountedTowardsTarget) flags.push('Carbon credits are counted towards the target: report them separately and never instead of your own reductions.')
  return { verdict: gapPct > 0 ? 'short' : 'aligned', problems, annualRatePct, gapPct: gapPct > 0 ? gapPct : null, implied2030Pct, flags }
}
