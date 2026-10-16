// Self-check — run directly with `node src/lib/engagements.test.ts`.
import assert from 'node:assert/strict'
import { DECLARATIONS, engagementLabel, engagementStatusFrom, grantExpiry, mayCreateType, mayJoinTeam, parseScope, scopeText } from './engagements.ts'

assert.deepEqual(parseScope(undefined), { kind: 'whole' })
assert.deepEqual(parseScope({ kind: 'levels', levels: [3, 1, 3] }), { kind: 'levels', levels: [1, 3] }, 'duplicates collapse')
assert.equal(parseScope({ kind: 'levels', levels: [1, 'x'] }), null)
assert.deepEqual(parseScope({ kind: 'levels', levels: [3, 1] }), { kind: 'levels', levels: [1, 3] })
assert.equal(parseScope({ kind: 'levels', levels: [] }), null)
assert.equal(parseScope({ kind: 'levels', levels: [0] }), null)
assert.equal(parseScope({ kind: 'nope' }), null)
assert.equal(scopeText({ kind: 'levels', levels: [1, 3] }), 'Levels 1, 3')

const p = (org: any, validator: any, funder: any) => ({ org, validator, funder })
assert.equal(engagementStatusFrom(p('accepted', 'pending', 'not_required')), 'proposed')
assert.equal(engagementStatusFrom(p('accepted', 'accepted', 'not_required')), 'active')
assert.equal(engagementStatusFrom(p('pending', 'not_required', 'accepted')), 'proposed', 'org must always consent')
assert.equal(engagementStatusFrom(p('declined', 'accepted', 'not_required')), 'declined')
assert.equal(engagementStatusFrom(p('accepted', 'accepted', 'not_required'), 'cancelled'), 'cancelled', 'terminal states stick')

assert.equal(mayJoinTeam('independent_validation', 'accredited'), true)
for (const a of ['registered', 'pilot-accredited', 'suspended']) assert.equal(mayJoinTeam('independent_validation', a), false, a)
assert.equal(mayJoinTeam('funder_review', null), true)
assert.equal(mayCreateType('funder', 'independent_validation'), false)
assert.equal(mayCreateType('funder', 'funder_review'), true)
assert.equal(mayCreateType('organization', 'independent_validation'), true)

const t0 = new Date('2026-01-01T00:00:00Z')
assert.equal(grantExpiry(t0, 90).toISOString(), '2026-04-01T00:00:00.000Z')
assert.equal(grantExpiry(t0, 9999).getTime() - t0.getTime(), 365 * 86_400_000, 'capped at a year')
assert.equal(grantExpiry(t0, 0).getTime() - t0.getTime(), 90 * 86_400_000, 'a missing window falls back to the default, never open-ended')

const ok = { name: 'Val', accreditation: 'accredited' }
assert.equal(engagementLabel({ type: 'independent_validation', engagedBy: 'Acme', members: [ok] }).statement, 'Validated by Val, engaged by Acme')
assert.equal(engagementLabel({ type: 'independent_validation', engagedBy: 'Acme', members: [ok, { name: 'Ann', accreditation: 'suspended' }] }).statement, 'Review by Ann')
assert.equal(engagementLabel({ type: 'funder_review', funderName: 'Savannah', engagedBy: 'Savannah', members: [] }).statement, 'Reviewed by Savannah')
assert.notEqual(DECLARATIONS.independent_validation.version, DECLARATIONS.funder_review.version)
console.log('engagements.test.ts ok')
