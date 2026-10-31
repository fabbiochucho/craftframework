import assert from 'node:assert/strict'
import { benchmark, capacity, heatmap, scorecardLines, stats, topGaps, useFunnel, validValueAnswers, valueSummary, type Submission } from './networkResults.ts'
import { instrumentById } from './networkRounds.ts'
import type { NetworkNode } from './networks.ts'

const m = instrumentById('craft-health')!
const dims = m.dimensions.map((d) => d.key)
/** An organisation scoring `v` everywhere, except `low` in the first domain. */
const org = (orgId: string, v: number, low = v): Submission => ({
  orgId, scores: Object.fromEntries(m.indicators.map((i) => [i.id, i.dimension === dims[0] ? low : v])),
})

// Quartiles
assert.deepEqual(stats([1, 2, 3, 4, 5]), { n: 5, median: 3, q1: 2, q3: 4, min: 1, max: 5 })
assert.deepEqual(stats([4, 1, 3, 2]), { n: 4, median: 2.5, q1: 1.75, q3: 3.25, min: 1, max: 4 })
assert.equal(stats([]), null)

// Suppression under 5
const four = capacity(m, [org('a', 3), org('b', 3), org('c', 3), org('d', 3)])
assert.equal(four.suppressed, true)
assert.equal(four.composite, null)
assert.equal(four.bands, null)
assert.ok(four.dimensions.every((d) => d.stats === null), 'no domain stats leak from a small group')

// Five or more: a spread, bands and gaps
const five = capacity(m, [org('a', 4, 1), org('b', 4, 1), org('c', 3, 2), org('d', 2, 2), org('e', 5, 1)])
assert.equal(five.suppressed, false)
assert.equal(five.n, 5)
assert.equal(five.bands!.reduce((s, b) => s + b.count, 0), 5, 'every member falls in one band')
assert.equal(topGaps(five, 1)[0].key, dims[0], 'the deliberately weak domain is the top gap')
assert.equal(five.dimensions.find((d) => d.key === dims[0])!.stats!.median, 1)

// Benchmark: suppressed groups give nothing; positions against the quartiles
assert.equal(benchmark(m, org('x', 3).scores, four), null)
const b = benchmark(m, org('x', 3, 5).scores, five)!
assert.equal(b.find((x) => x.key === dims[0])!.position, 'above')
assert.equal(b.find((x) => x.key === dims[1])!.position, 'within')
assert.equal(benchmark(m, org('y', 0).scores, five)!.find((x) => x.key === dims[1])!.position, 'below')

// Heatmap: child levels as columns; small children withheld
const nodes: NetworkNode[] = [
  { id: 'ng', networkId: 'n', parentId: null, level: 'national', name: 'Nigeria', geoCode: 'NG' },
  { id: 'la', networkId: 'n', parentId: 'ng', level: 'subnational', name: 'Lagos', geoCode: 'NG-LA' },
  { id: 'kn', networkId: 'n', parentId: 'ng', level: 'subnational', name: 'Kano', geoCode: 'NG-KN' },
]
const where: Record<string, string> = { a: 'la', b: 'la', c: 'la', d: 'la', e: 'la', f: 'kn' }
const subs = [org('a', 4), org('b', 4), org('c', 4), org('d', 4), org('e', 4), org('f', 1)]
const hm = heatmap(m, nodes, 'ng', (scope) => subs.filter((s) => scope.has(where[s.orgId])))
assert.deepEqual(hm.columns.map((c) => [c.name, c.n, c.shown]), [['Lagos', 5, true], ['Kano', 1, false]])
assert.equal(hm.rows[0].cells[0], 4)
assert.deepEqual(hm.columns.map((c) => c.median), [4, null], 'overall median per child, withheld under five')
assert.equal(hm.rows[0].cells[1], null, 'Kano has one member: withheld')

// Value survey
assert.ok(validValueAnswers({ used: { training: 5, exchange: 3 }, recommend: 9 }))
assert.ok(!validValueAnswers({ used: { training: 6 }, recommend: 9 }))
assert.ok(!validValueAnswers({ used: { cooking: 3 }, recommend: 9 }))
assert.ok(!validValueAnswers({ used: {}, recommend: 11 }))
assert.equal(valueSummary([{ used: {}, recommend: 9 }]).suppressed, true)
const vs = valueSummary([
  { used: { training: 5, exchange: 4 }, recommend: 10 }, { used: { training: 2 }, recommend: 9 }, { used: { exchange: 5 }, recommend: 7 },
  { used: {}, recommend: 3 }, { used: { training: 4 }, recommend: 9 },
])
assert.equal(vs.suppressed, false)
const training = vs.services!.find((s) => s.key === 'training')!
assert.deepEqual([training.usedBy, training.usedPct, training.helpfulPct], [3, 60, 67])
assert.equal(vs.recommend!.netScore, 40, '3 promoters, 1 detractor of 5')

// Use funnel
const funnel = useFunnel({ invited: 10, accepted: 8, submitted: 6, withPlan: 4, actionsDone: 2, reassessed: 1, validated: 1 })
assert.deepEqual(funnel.map((f) => f.pct), [80, 75, 50, 25, 13, 13])
assert.deepEqual(useFunnel({ invited: 0, accepted: 0, submitted: 0, withPlan: 0, actionsDone: 0, reassessed: 0, validated: 0 }).map((f) => f.pct), [0, 0, 0, 0, 0, 0])

// Plain sentences
const lines = scorecardLines(five, vs, funnel, m)
assert.equal(lines.length, 3)
assert.match(lines[0], /weakest areas/)
assert.match(lines[2], /25%/)
assert.match(scorecardLines(four, valueSummary([]), funnel, m)[0], /hidden/)

console.log('networkResults.test.ts ok')
