import assert from 'node:assert/strict'
import { activitySummary, buildFunnel, dailySeries, median, parseRange, rangeStart, sortStalled, type StalledPerson } from './adminAnalytics.ts'

// Funnel drop-off maths.
const f = buildFunnel([
  { key: 'a', label: 'Signed up', count: 200 }, { key: 'b', label: 'Onboarded', count: 150 },
  { key: 'c', label: 'Started', count: 60 }, { key: 'd', label: 'Completed', count: 0 }, { key: 'e', label: 'Evidence', count: 0 },
])
assert.deepEqual(f.map((r) => r.count), [200, 150, 60, 0, 0])
assert.deepEqual(f.map((r) => r.dropOffPct), [0, 25, 60, 100, 0])
assert.deepEqual(f.map((r) => r.ofFirstPct), [100, 75, 30, 0, 0])
// A later stage cannot exceed an earlier one; an empty funnel does not divide by zero.
assert.deepEqual(buildFunnel([{ key: 'a', label: 'A', count: 10 }, { key: 'b', label: 'B', count: 12 }]).map((r) => r.count), [10, 10])
assert.deepEqual(buildFunnel([{ key: 'a', label: 'A', count: 0 }, { key: 'b', label: 'B', count: 0 }]).map((r) => [r.dropOffPct, r.ofFirstPct]), [[0, 0], [0, 0]])
assert.equal(buildFunnel([{ key: 'a', label: 'A', count: 3 }, { key: 'b', label: 'B', count: 1 }])[1].dropOffPct, 66.7)

// Independent milestones are not clamped and never show a negative drop-off.
assert.deepEqual(buildFunnel([{ key: 'a', label: 'A', count: 10 }, { key: 'b', label: 'B', count: 4 }, { key: 'c', label: 'C', count: 7 }], { clamp: false }).map((r) => [r.count, r.dropOffPct]), [[10, 0], [4, 60], [7, 0]])

// Median.
assert.equal(median([]), null)
assert.equal(median([5]), 5)
assert.equal(median([9, 1, 5]), 5)
assert.equal(median([4, 1, 3, 2]), 2.5)

// Ranges.
assert.equal(parseRange('7'), '7')
assert.equal(parseRange('bogus'), '30')
const now = new Date('2026-10-17T12:00:00Z')
assert.equal(rangeStart('all', now), null)
assert.equal(rangeStart('7', now)?.toISOString(), '2026-10-10T12:00:00.000Z')

// Activity: DAU/WAU/MAU and returning vs one-off.
const rows = [
  { email: 'a', day: '2026-10-17' }, { email: 'a', day: '2026-10-12' }, { email: 'b', day: '2026-10-16' },
  { email: 'c', day: '2026-10-01' }, { email: 'd', day: '2026-08-01' },
]
const s = activitySummary(rows.filter((r) => r.day >= '2026-09-17'), now)
assert.deepEqual(s, { dau: 1, wau: 2, mau: 3, returning: 1, oneOff: 2 })
assert.equal(dailySeries(rows, 3, now).map((d) => d.active).join(), '0,1,1')

// Sorting is stable on email and handles numbers and text.
const p = (email: string, daysStalled: number, orgName = ''): StalledPerson => ({ email, name: email, orgName, step: 1, stepName: 'Workspace', startedAt: '', lastActivityAt: '', daysStalled, nudgesSent: 0, lastNudgeAt: null })
const people = [p('b@x', 2), p('a@x', 10), p('c@x', 2)]
assert.deepEqual(sortStalled(people, 'daysStalled', 'desc').map((x) => x.email), ['a@x', 'b@x', 'c@x'])
assert.deepEqual(sortStalled(people, 'daysStalled', 'asc').map((x) => x.email), ['b@x', 'c@x', 'a@x'])
assert.deepEqual(sortStalled([p('z@x', 1, 'beta'), p('y@x', 1, 'Alpha')], 'orgName', 'asc').map((x) => x.email), ['y@x', 'z@x'])
console.log('adminAnalytics.test.ts: all assertions passed')
