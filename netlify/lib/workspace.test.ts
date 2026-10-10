// Self-check — run directly with `node netlify/lib/workspace.test.ts`.
import assert from 'node:assert/strict'
import {
  buildScorecard, canAssignRole, capCloseBlockers, csvEscape, effectiveCapStatus, evidenceExpiryState,
  hasMinRole, isVerifiedOrgEmailDomain, rateLimited, severityFromTier, summarizeCaps, tierFromScore,
} from './workspace.ts'

assert.ok(hasMinRole('owner', 'admin'))
assert.ok(hasMinRole('assessor', 'assessor'))
assert.ok(!hasMinRole('viewer', 'assessor'))
assert.ok(!hasMinRole(undefined, 'viewer'))
assert.ok(!hasMinRole('superuser', 'viewer'))

assert.ok(canAssignRole('owner', 'owner'))
assert.ok(canAssignRole('admin', 'assessor'))
assert.ok(!canAssignRole('admin', 'owner'))
assert.ok(!canAssignRole('assessor', 'viewer'))
assert.ok(!canAssignRole('owner', 'bogus'))

assert.ok(isVerifiedOrgEmailDomain('a@ministry.go.ke'))
assert.ok(!isVerifiedOrgEmailDomain('a@gmail.com'))
assert.ok(!isVerifiedOrgEmailDomain('not-an-email'))

assert.equal(tierFromScore(0), 1)
assert.equal(tierFromScore(7), 5)
assert.equal(tierFromScore(2.6), 3)
assert.equal(severityFromTier(1), 'critical')
assert.equal(severityFromTier(2), 'high')
assert.equal(severityFromTier(4), null)

const sc = buildScorecard(
  [
    { pillar: 'Governance', domain: 'A', tierLevel: 2 },
    { pillar: 'Governance', domain: 'B', tierLevel: 4 },
    { pillar: 'Fiduciary', domain: 'C', tierLevel: 5 },
  ],
  [{ severity: 'high', status: 'open' }, { severity: 'high', status: 'resolved' }],
)
assert.equal(sc.pillars.Governance.avgTier, 3)
assert.equal(sc.findingsBySeverity.high, 1)
assert.equal(sc.risk, 'Moderate')

const now = new Date('2026-10-10T00:00:00Z')
assert.equal(effectiveCapStatus('open', '2026-10-01', now), 'overdue')
assert.equal(effectiveCapStatus('completed', '2026-10-01', now), 'completed')
assert.equal(effectiveCapStatus('open', '2026-10-20', now), 'open')

assert.equal(capCloseBlockers([]).length, 1)
assert.equal(capCloseBlockers([{ status: 'done', evidenceUploadedAt: new Date(), verifiedBy: 'x' }]).length, 0)
assert.equal(capCloseBlockers([{ status: 'done', evidenceUploadedAt: new Date(), verifiedBy: null }]).length, 1)

const sum = summarizeCaps(
  [
    { status: 'open', severity: 'high', dueDate: '2026-10-01', createdAt: now, completionDate: null },
    { status: 'completed', severity: 'low', dueDate: null, createdAt: now, completionDate: new Date('2026-10-12T00:00:00Z') },
  ],
  now,
)
assert.equal(sum.overdue, 1)
assert.equal(sum.percentComplete, 50)
assert.equal(sum.avgDaysToClose, 2)

assert.equal(evidenceExpiryState('2026-10-01', now), 'expired')
assert.equal(evidenceExpiryState('2026-10-25', now), 'expiring')
assert.equal(evidenceExpiryState('2027-01-01', now), 'valid')
assert.equal(evidenceExpiryState(null, now), 'none')

assert.equal(csvEscape('=cmd()'), "'=cmd()")
assert.equal(csvEscape('a,b'), '"a,b"')

assert.ok(!rateLimited('t', 2, 0))
assert.ok(!rateLimited('t', 2, 1))
assert.ok(rateLimited('t', 2, 2))
assert.ok(!rateLimited('t', 2, 70_000))

console.log('workspace.test.ts: all assertions passed')
