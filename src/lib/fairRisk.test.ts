// Self-check: `node src/lib/fairRisk.test.ts` — quantified risk aligned with Open FAIR (indices spec §8).
import assert from 'node:assert/strict'
import {
  costOfGap, fairKeyReadable, LOSS_FORMS, mulberry32, pert, poisson, rangeProblems, rankByCostOfGap, simulate, type Scenario,
} from './fairRisk.ts'

// Seeded: the same seed gives the same draws
const a = mulberry32(42), b = mulberry32(42)
assert.equal(a(), b())

// PERT stays within its range and centres near (min + 4·likely + max) / 6
const rng = mulberry32(1)
const xs = Array.from({ length: 20000 }, () => pert({ min: 10, likely: 20, max: 60 }, rng))
assert.ok(xs.every((x) => x >= 10 && x <= 60))
const avg = xs.reduce((s, x) => s + x, 0) / xs.length
assert.ok(Math.abs(avg - 25) < 0.6, `PERT mean ${avg} ≈ 25`)
assert.equal(pert({ min: 5, likely: 5, max: 5 }, rng), 5, 'a point estimate is returned as is')

// Poisson mean matches lambda
const ps = Array.from({ length: 20000 }, () => poisson(2.5, rng))
assert.ok(Math.abs(ps.reduce((s, x) => s + x, 0) / ps.length - 2.5) < 0.06)
assert.equal(poisson(0, rng), 0)

const zero = { min: 0, likely: 0, max: 0 }
const scenario: Scenario = {
  id: 's1', name: 'Payroll fraud', asset: 'Payroll', threat: 'Insider', effect: 'Ghost workers', indicatorIds: ['CRAFT-FCR-02'],
  tef: { min: 1, likely: 2, max: 4 }, vulnerability: { min: 0.2, likely: 0.4, max: 0.6 },
  losses: { productivity: zero, response: { min: 1000, likely: 2000, max: 5000 }, replacement: { min: 5000, likely: 10000, max: 30000 }, fines: zero, competitive: zero, reputation: zero },
  fix: { actionId: 'CRAFT-FCR-02', cost: 4000, vulnerability: { min: 0.02, likely: 0.05, max: 0.1 } },
}
assert.deepEqual(LOSS_FORMS.map((f) => f.key), ['productivity', 'response', 'replacement', 'fines', 'competitive', 'reputation'])

// Simulation: 10,000 seeded runs, ordered percentiles, a falling exceedance curve, reproducible
const r = simulate(scenario, { seed: 7 })
assert.equal(r.runs, 10000)
assert.ok(r.p10 <= r.p50 && r.p50 <= r.p90)
assert.deepEqual(r, simulate(scenario, { seed: 7 }), 'same seed, same result')
// Expected annual loss ≈ TEF·vuln·magnitude ≈ 2.17 × 0.4 × (2333 + 12500) ≈ 12,900
assert.ok(r.mean > 9000 && r.mean < 17000, `mean ${r.mean}`)
for (let i = 1; i < r.exceedance.length; i++) assert.ok(r.exceedance[i].probability <= r.exceedance[i - 1].probability)
assert.ok(r.exceedance[0].probability > 0 && r.exceedance[0].probability <= 1)

// Cost of the gap: the fix lowers the likely annual loss; compared with the action's cost
const g = costOfGap(scenario, { seed: 7 })!
assert.ok(g.fixed.mean < g.open.mean)
assert.equal(g.reduction, Math.round(g.open.mean - g.fixed.mean))
assert.equal(g.cost, 4000)
assert.ok(g.ratio! > 1, 'a cheap fix to a costly gap pays back')
assert.equal(costOfGap({ ...scenario, fix: undefined }, { seed: 7 }), null)

// Ranking: biggest return on cost first; actions with no cost go last
const cheap = { ...scenario, id: 'c', fix: { ...scenario.fix!, cost: 1000 } }
const dear = { ...scenario, id: 'd', fix: { ...scenario.fix!, cost: 100000 } }
assert.deepEqual(rankByCostOfGap([dear, cheap], { seed: 7 }).map((x) => x.scenarioId), ['c', 'd'])

// Range validation
assert.deepEqual(rangeProblems(scenario), [])
assert.ok(rangeProblems({ ...scenario, tef: { min: 3, likely: 2, max: 4 } }).some((p) => /Threat event frequency/.test(p)))
assert.ok(rangeProblems({ ...scenario, vulnerability: { min: 0.2, likely: 0.5, max: 1.5 } }).some((p) => /Vulnerability/.test(p)))
assert.ok(rangeProblems({ ...scenario, losses: { ...scenario.losses, fines: { min: -1, likely: 0, max: 0 } } }).some((p) => /Fines/.test(p)))

// Access: financial inputs are the organisation's; others read them only with consent; nobody else writes
assert.equal(fairKeyReadable({ key: 'fair:scenarios', ownOrg: true, superAdmin: false, consent: false }), true)
assert.equal(fairKeyReadable({ key: 'fair:scenarios', ownOrg: false, superAdmin: false, consent: false }), false)
assert.equal(fairKeyReadable({ key: 'fair:scenarios', ownOrg: false, superAdmin: false, consent: true }), true)
assert.equal(fairKeyReadable({ key: 'fair:consent', ownOrg: false, superAdmin: false, consent: false }), true, 'whether consent is given is itself readable')
assert.equal(fairKeyReadable({ key: 'capital:scores', ownOrg: false, superAdmin: false, consent: false }), true, 'other keys are unaffected')
console.log('fairRisk: ok')
