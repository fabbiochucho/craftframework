import assert from 'node:assert/strict'
import { DISAGREEMENT, instrumentById, participation, perspectiveGaps, progress, roundInstruments, roundState, snapshot, validPerspectiveScores, validWindow } from './networkRounds.ts'

// Round windows are whole days, open through the closing day
const r = { opensOn: '2026-11-01', closesOn: '2026-11-30' }
assert.equal(roundState(r, '2026-10-31'), 'upcoming')
assert.equal(roundState(r, '2026-11-01'), 'open')
assert.equal(roundState(r, '2026-11-30'), 'open')
assert.equal(roundState(r, '2026-12-01'), 'closed')
assert.equal(roundState({ ...r, closedAt: '2026-11-10T00:00:00Z' }, '2026-11-15'), 'closed', 'a coordinator can close early')
assert.ok(validWindow('2026-11-01', '2026-11-01'))
assert.ok(!validWindow('2026-11-02', '2026-11-01'))
assert.ok(!validWindow('1 Nov', '2026-11-30'))

// Instruments are the CRAFT modules
const health = instrumentById('craft-health')!
assert.ok(health, 'the Organisational Effectiveness Index is available')
assert.ok(roundInstruments().some((i) => i.id === 'craft-health'))

// Progress and snapshot only count the instrument's own indicators
const ids = health.indicators.map((i) => i.id)
const scores: Record<string, number> = { [ids[0]]: 3, [ids[1]]: 0, 'Q-OTHER': 5 }
assert.deepEqual(progress(health, scores), { answered: 2, total: ids.length, complete: false })
assert.deepEqual(snapshot(health, scores), { [ids[0]]: 3, [ids[1]]: 0 })
const all = Object.fromEntries(ids.map((id) => [id, 2]))
assert.equal(progress(health, all).complete, true)

// Perspectives: whole numbers 0-5 on known dimensions
const d0 = health.dimensions[0].key, d1 = health.dimensions[1].key
assert.ok(validPerspectiveScores(health, { [d0]: 4 }))
assert.ok(!validPerspectiveScores(health, { [d0]: 6 }))
assert.ok(!validPerspectiveScores(health, { [d0]: 2.5 }))
assert.ok(!validPerspectiveScores(health, { nonsense: 3 }))
assert.ok(!validPerspectiveScores(health, {}))

// Disagreement between perspectives is flagged when the spread reaches the threshold
const gaps = perspectiveGaps(health, { board: { [d0]: 5, [d1]: 3 }, staff: { [d0]: 5 - DISAGREEMENT, [d1]: 3 }, community: { [d0]: 4 } })
const g0 = gaps.find((g) => g.dimension === d0)!, g1 = gaps.find((g) => g.dimension === d1)!
assert.equal(g0.spread, DISAGREEMENT)
assert.ok(g0.disagree)
assert.equal(g1.spread, 0)
assert.ok(!g1.disagree)
assert.equal(gaps.find((g) => g.dimension === health.dimensions[2].key)!.spread, null, 'one or no perspective: nothing to compare')

// Participation
assert.deepEqual(participation(['a', 'b', 'c', 'd'], new Set(['a', 'b']), new Set(['a'])), { total: 4, submitted: 1, inProgress: 1, notStarted: 2, rate: 25 })
assert.deepEqual(participation([], new Set(), new Set()), { total: 0, submitted: 0, inProgress: 0, notStarted: 0, rate: 0 })

console.log('networkRounds.test.ts ok')
