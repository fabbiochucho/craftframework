// Self-check — run directly with `node src/lib/validatorQuality.test.ts`.
import assert from 'node:assert/strict'
import {
  FLAG_THRESHOLDS, isConfirmedStatus, isStars, outOfLine, positionsByValidator, reReviewFlags, reviewMetrics, summariseRatings, validatorStats,
} from './validatorQuality.ts'

// Ratings: 1-5 whole stars only; removed ratings never count.
assert.ok([1, 2, 3, 4, 5].every(isStars))
assert.ok(![0, 6, 2.5, '3', null, NaN].some(isStars))
assert.deepEqual(summariseRatings([]), { count: 0, average: null, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })
const s = summariseRatings([{ stars: 5, status: 'published' }, { stars: 4, status: 'published' }, { stars: 4, status: 'published' }, { stars: 1, status: 'removed' }])
assert.equal(s.count, 3)
assert.equal(s.average, 4.3)
assert.deepEqual(s.distribution, { 1: 0, 2: 0, 3: 0, 4: 2, 5: 1 })

// Metrics come from the frozen snapshot: mean absolute gap and the rung difference.
const snap = { selfRung: 5, impliedRung: 3, validatedRung: 3, indicators: [{ self: 4, final: 2 }, { self: 3, final: 3 }, { self: null, final: 1 }, { self: 5, final: 4 }] }
const m = reviewMetrics('validated', snap)
assert.equal(m.gap, 1) // (2 + 0 + 1) / 3
assert.equal(m.rungDelta, -2)
assert.deepEqual(reviewMetrics('not_validated', null), { outcome: 'not_validated', selfRung: null, validatedRung: null, impliedRung: null, gap: null, rungDelta: null, indices: 0, indexGap: null })

// Statistics.
const st = validatorStats([m, reviewMetrics('not_validated', { selfRung: 2, impliedRung: 1, indicators: [] }), reviewMetrics('validated_with_qualifications', { selfRung: 3, impliedRung: 3, validatedRung: 3, indicators: [{ self: 2, final: 2 }] })], { withdrawn: 1, concerns: 2 })
assert.equal(st.reviews, 3)
assert.equal(st.validated, 1)
assert.equal(st.withQualifications, 1)
assert.equal(st.notValidated, 1)
assert.equal(st.approvalRate, 0.67)
assert.equal(st.meanGap, 0.5)
assert.equal(st.meanRungDelta, -1)
assert.equal(st.withdrawn, 1)
assert.equal(st.concerns, 2)
assert.equal(validatorStats([]).approvalRate, null)

// Flags: each rule on its own, and nothing for an ordinary mid-career validation.
const base = { selfRung: 3, impliedRung: 3, validatedRung: 3, gap: 0.4, rungDelta: 0, outcome: 'validated' }
const none = { reasons: [] }
assert.deepEqual(reReviewFlags({ position: 4, metrics: base, peer: none }), [])
assert.deepEqual(reReviewFlags({ position: 1, metrics: base, peer: none }).map((f) => f.key), ['first_validations'])
assert.deepEqual(reReviewFlags({ position: 3, metrics: base, peer: none }).map((f) => f.key), ['first_validations'])
assert.deepEqual(reReviewFlags({ position: 4, metrics: { ...base, validatedRung: 5 }, peer: none }), [])
assert.deepEqual(reReviewFlags({ position: 4, metrics: { ...base, validatedRung: 6 }, peer: none }).map((f) => f.key), ['high_rung'])
assert.deepEqual(reReviewFlags({ position: 4, metrics: { ...base, validatedRung: 7 }, peer: none }).map((f) => f.key), ['high_rung'])
assert.deepEqual(reReviewFlags({ position: 4, metrics: { ...base, gap: 0.99 }, peer: none }), [])
assert.deepEqual(reReviewFlags({ position: 4, metrics: { ...base, gap: 1 }, peer: none }).map((f) => f.key), ['large_gap'])
assert.deepEqual(reReviewFlags({ position: 4, metrics: { ...base, rungDelta: 1 }, peer: none }), [])
assert.deepEqual(reReviewFlags({ position: 4, metrics: { ...base, rungDelta: 2 }, peer: none }).map((f) => f.key), ['rung_jump'])
assert.deepEqual(reReviewFlags({ position: 4, metrics: { ...base, rungDelta: -2 }, peer: none }).map((f) => f.key), ['rung_jump'])
assert.deepEqual(reReviewFlags({ position: 4, metrics: base, peer: { reasons: ['x'] } }).map((f) => f.key), ['out_of_line'])
assert.equal(reReviewFlags({ position: 1, metrics: { ...base, validatedRung: 7, gap: 2, rungDelta: 3 }, peer: { reasons: ['x'] } }).length, 5)
assert.equal(reReviewFlags({ position: 0, metrics: base, peer: none }).length, 0, 'a missing position is not "first"')
assert.equal(FLAG_THRESHOLDS.firstValidations, 3)

// Peer comparison needs enough evidence on both sides, then flags only real outliers.
const stats = (reviews: number, approvalRate: number, meanRungDelta: number) => ({ reviews, validated: 0, withQualifications: 0, notValidated: 0, approvalRate, meanGap: 0, meanRungDelta, withdrawn: 0, concerns: 0 })
const peers = [stats(10, 0.7, 0), stats(8, 0.75, 0.1), stats(9, 0.65, -0.1), stats(12, 0.72, 0), stats(7, 0.68, 0.1)]
assert.deepEqual(outOfLine(stats(10, 0.7, 0), peers).reasons, [])
assert.equal(outOfLine(stats(10, 1, 0), peers).reasons.length, 1, 'a 100% approval rate is far from a ~70% peer group')
assert.equal(outOfLine(stats(10, 0.7, 2), peers).reasons.length, 1, 'an average rung difference of +2 is out of line')
assert.deepEqual(outOfLine(stats(4, 1, 3), peers).reasons, [], 'too few of their own reviews to judge')
assert.deepEqual(outOfLine(stats(10, 1, 3), peers.slice(0, 2)).reasons, [], 'too few peers to compare with')
assert.deepEqual(outOfLine(stats(10, 1, 3), [stats(2, 0.1, 0), ...peers.slice(0, 2)]).reasons, [], 'peers with few reviews do not count')
assert.deepEqual(outOfLine(stats(10, 0.5, 0), [stats(9, 0.5, 0), stats(9, 0.5, 0), stats(9, 0.5, 0)]).reasons, [], 'identical peers have no spread to compare with')

// Position among the same validator's validations, oldest first.
const pos = positionsByValidator([
  { id: 'c', validator: 'a@x', finalisedAt: '2026-03-01' }, { id: 'a', validator: 'a@x', finalisedAt: '2026-01-01' },
  { id: 'b', validator: 'b@x', finalisedAt: '2026-02-01' }, { id: 'd', validator: 'a@x', finalisedAt: new Date('2026-02-01') },
])
assert.equal(pos.get('a'), 1)
assert.equal(pos.get('d'), 2)
assert.equal(pos.get('c'), 3)
assert.equal(pos.get('b'), 1)

// Only a standing validation is a confirmed rung.
assert.ok(isConfirmedStatus('current') && isConfirmedStatus('follow_up_overdue'))
assert.ok(!['expired', 'suspended', 'withdrawn', 'superseded'].some(isConfirmedStatus))

console.log('validatorQuality: ok')
