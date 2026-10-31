import assert from 'node:assert/strict'
import { capacityPlan, exchangeContribution, pairings, progressBetween, toCsv } from './networkExchange.ts'
import { capacity, type Submission } from './networkResults.ts'
import { instrumentById } from './networkRounds.ts'

const m = instrumentById('craft-health')!
const [d0, d1] = m.dimensions.map((d) => d.key)
const org = (orgId: string, v: number, first = v): Submission => ({ orgId, scores: Object.fromEntries(m.indicators.map((i) => [i.id, i.dimension === d0 ? first : v])) })

// Pairing: strong mentors with weak learners per area
const named = [{ ...org('a', 3, 5), name: 'A' }, { ...org('b', 3, 1), name: 'B' }, { ...org('c', 3, 2), name: 'C' }]
const pairs = pairings(m, named)
const p0 = pairs.find((p) => p.key === d0)!
assert.deepEqual(p0.pairs.map((p) => [p.learner.name, p.mentor.name]), [['B', 'A'], ['C', 'A']])
assert.ok(!pairs.some((p) => p.key === d1), 'no pairs where nobody is strong or weak')

// Capacity plan: share below the gap line decides the kind of support
const subs = [org('a', 4, 1), org('b', 4, 1), org('c', 4, 1), org('d', 4, 4), org('e', 4, 4)]
const plan = capacityPlan(m, capacity(m, subs), subs, { [d0]: 2 })!
assert.equal(plan.length, 1)
assert.equal(plan[0].key, d0)
assert.equal(plan[0].membersBelow, 3)
assert.equal(plan[0].share, 60)
assert.match(plan[0].support!, /network-wide training/)
assert.equal(plan[0].exchangesHeld, 2)
assert.equal(capacityPlan(m, capacity(m, subs.slice(0, 3)), subs.slice(0, 3), {}), null, 'suppressed group: no plan')

// Progress: cohort only, new members counted separately, suppressed under five
const before = [org('a', 2), org('b', 2), org('c', 2), org('d', 2), org('e', 2)]
const after = [org('a', 3), org('b', 3), org('c', 2), org('d', 4), org('e', 1), org('f', 5)]
const pr = progressBetween(m, before, after)
assert.equal(pr.cohort, 5)
assert.equal(pr.newMembers, 1)
assert.equal(pr.suppressed, false)
assert.equal(pr.areas!.find((a) => a.key === d1)!.medianChange, 1)
assert.equal(pr.areas!.find((a) => a.key === d1)!.improved, 3)
assert.equal(pr.areas!.find((a) => a.key === d1)!.declined, 1)
assert.ok(pr.movedUp! >= 2 && pr.movedDown! >= 1)
assert.equal(progressBetween(m, before.slice(0, 4), after).suppressed, true)

// Contribution: needs five on each side
const ten = (v: number) => Array.from({ length: 10 }, (_, i) => org(`o${i}`, v))
const later = ten(2).map((s, i) => (i < 5 ? org(s.orgId, 2, 4) : org(s.orgId, 2, 2.5)))
const took = new Set(['o0', 'o1', 'o2', 'o3', 'o4'])
const c = exchangeContribution(m, d0, ten(2), later, took)
assert.equal(c.shown, true)
if (c.shown) { assert.equal(c.tookMedian, 2); assert.equal(c.didntMedian, 0.5) }
assert.equal(exchangeContribution(m, d0, ten(2), later, new Set(['o0'])).shown, false)

// CSV: quoting and formula neutralising
assert.equal(toCsv([['a', 'b,c', 'say "hi"'], ['=SUM(A1)', 3, null]]), 'a,"b,c","say ""hi"""\n\'=SUM(A1),3,\n')

console.log('networkExchange.test.ts ok')
