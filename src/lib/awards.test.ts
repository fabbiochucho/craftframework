// Self-check — run directly with `node src/lib/awards.test.ts`.
import assert from 'node:assert/strict'
import { closingStatus, funderView, repeatedTypes, trackRecord, type Award, type Issue } from './awards.ts'

const issue = (id: string, o: Partial<Issue> = {}): Issue => ({
  id, orgId: 'org_a', awardId: 'aw1', source: 'audit', type: 'financial', title: `Issue ${id}`, verified: true, orgResponse: 'We fixed it',
  status: 'closed', openedAt: '2026-01-01', closedAt: '2026-01-31', fixHeld: true, recurrenceOf: null, ...o,
})
const issues = [
  issue('i1'),
  issue('i2', { awardId: 'aw2', closedAt: '2026-01-11', fixHeld: false }),
  issue('i3', { awardId: 'aw2', type: 'procurement', status: 'open', closedAt: null, fixHeld: null, recurrenceOf: 'i1' }),
  issue('i4', { verified: false, title: 'Unverified allegation' }),
  issue('i5', { orgId: 'org_b', awardId: 'aw9' }),
]

assert.equal(closingStatus([{ status: 'closed' }]), 'closed')
assert.equal(closingStatus([{ status: 'closed' }, { status: 'open' }]), 'closed_with_open_matters')

const tr = trackRecord(issues.filter((i) => i.orgId === 'org_a'))
assert.deepEqual(
  [tr.verifiedIssues, tr.open, tr.closed, tr.byType, tr.averageDaysToFix, tr.fixesHeld, tr.fixesFailed, tr.recurrences, tr.awards],
  [3, 1, 2, { financial: 2, procurement: 1 }, 20, 1, 1, 1, 2],
  'verified issues only; average of 30 and 10 days',
)

const awards: Award[] = [
  { id: 'aw1', orgId: 'org_a', funderEmail: 'grants@funder-one.example', status: 'active' },
  { id: 'aw2', orgId: 'org_a', funderEmail: 'grants@funder-two.example', status: 'active' },
]
// A funder sees every issue on its own award (including unverified ones), nothing else unless shared.
const one = funderView('Grants@Funder-One.example', 'org_a', awards, issues, [])
assert.deepEqual(one.ownAwardIssues.map((i) => i.id), ['i1', 'i4'])
assert.equal(one.shared, null)
// Summary share: track record only, no issue details.
const sum = funderView('grants@funder-one.example', 'org_a', awards, issues, [{ orgId: 'org_a', viewerEmail: 'grants@funder-one.example', level: 'summary' }])
assert.deepEqual([sum.shared?.level, sum.shared?.issues.length, sum.shared?.trackRecord.verifiedIssues], ['summary', 0, 3])
// Full share: verified issues only, never allegations.
const full = funderView('new@funder-three.example', 'org_a', awards, issues, [{ orgId: 'org_a', viewerEmail: 'new@funder-three.example', level: 'full' }])
assert.deepEqual(full.shared?.issues.map((i) => i.id), ['i1', 'i2', 'i3'])
assert.deepEqual(full.ownAwardIssues, [])
// Another organisation's share or awards never leak.
assert.equal(funderView('new@funder-three.example', 'org_b', awards, issues, [{ orgId: 'org_a', viewerEmail: 'new@funder-three.example', level: 'full' }]).shared, null)

assert.deepEqual(repeatedTypes(issues.filter((i) => i.orgId === 'org_a')), ['financial'], 'financial issues on two different awards')

console.log('awards.test.ts: all assertions passed')
