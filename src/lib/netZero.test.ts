// Self-check: `node src/lib/netZero.test.ts` — net-zero target check against 1.5°C benchmarks.
import assert from 'node:assert/strict'
import { BENCHMARKS, checkTarget, NET_ZERO_QUESTION_IDS } from './netZero.ts'
import { ESG_QUESTIONS, RATED_QUESTION_IDS } from './esg.ts'
import { ESG_STAGES, NEW_ESG_IDS } from './esgMaturity.ts'

// Linear annual rate: 42% over 10 years is 4.2% a year, which meets the 1.5°C near-term benchmark
const ok = checkTarget({ baseYear: 2020, baseEmissions: 1000, targetYear: 2030, targetReductionPct: 42 })
assert.equal(ok.annualRatePct, 4.2)
assert.equal(ok.verdict, 'aligned')
// 20% over 10 years is well short
const weak = checkTarget({ baseYear: 2020, baseEmissions: 1000, targetYear: 2030, targetReductionPct: 20 })
assert.equal(weak.verdict, 'short')
assert.ok(weak.gapPct! > 20, 'says how far short it is by the target year')
// The implied 2030 cut is compared with the IPCC 43% (2019 base) global figure
assert.ok(ok.implied2030Pct !== null && Math.abs(ok.implied2030Pct - 42) < 0.01)
// A net-zero year after 2050 is flagged; a long-term cut below 90% is flagged
const late = checkTarget({ baseYear: 2022, baseEmissions: 500, targetYear: 2030, targetReductionPct: 40, netZeroYear: 2060, longTermReductionPct: 80 })
assert.ok(late.flags.some((f) => /2050/.test(f)))
assert.ok(late.flags.some((f) => /90%/.test(f)))
// Credits counted towards the target are flagged; residual emissions must be neutralised by removals
const credits = checkTarget({ baseYear: 2022, baseEmissions: 500, targetYear: 2030, targetReductionPct: 40, creditsCountedTowardsTarget: true })
assert.ok(credits.flags.some((f) => /credits/i.test(f)))
// Invalid input gives problems, not a verdict
const bad = checkTarget({ baseYear: 2030, baseEmissions: 0, targetYear: 2025, targetReductionPct: 140 })
assert.equal(bad.verdict, 'invalid')
assert.ok(bad.problems.length >= 3)
// Every benchmark is dated and sourced, and the SBTi version note is current
for (const b of Object.values(BENCHMARKS)) assert.ok(b.source.startsWith('https://') && b.asOf, b.label)
assert.match(BENCHMARKS.sbtiNearTerm.label, /V1/)
assert.match(BENCHMARKS.sbtiNearTerm.note, /V2\.0/)

// The ESG questions: four net-zero criteria, not rated (old ratings keep), placed in the maturity stages, shown as new
assert.equal(NET_ZERO_QUESTION_IDS.length, 4)
for (const id of NET_ZERO_QUESTION_IDS) {
  const q = ESG_QUESTIONS.find((x) => x.id === id)
  assert.ok(q, id)
  assert.equal(q!.pillar, 'Environmental')
  assert.ok(!RATED_QUESTION_IDS.includes(id), 'adding questions never changes an existing letter rating')
  assert.ok(ESG_STAGES.some((s) => s.criteria.includes(id)), `${id} sits in a maturity stage`)
  assert.ok(NEW_ESG_IDS.includes(id), `${id} triggers the new-questions notice`)
}
assert.ok(ESG_QUESTIONS.find((q) => q.id === 'ESG-Z4')!.question.match(/credits/i))
console.log('netZero: ok')
