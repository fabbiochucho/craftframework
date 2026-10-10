import assert from 'node:assert/strict'
import { REPORT_TYPES, reportSlug, selectedMembership } from './workspaceApi.ts'

const memberships = [{ id: 1, role: 'viewer' }, { id: 2, role: 'owner' }]
assert.equal(selectedMembership(memberships, '2'), memberships[1])
assert.equal(selectedMembership(memberships, '999'), memberships[0])
assert.equal(selectedMembership(memberships, null), memberships[0])
assert.equal(selectedMembership([], '2'), null)
for (const type of REPORT_TYPES) {
  assert.ok(!reportSlug(type).includes('_'))
  assert.equal(reportSlug(type).replace(/-/g, '_'), type)
}
console.log('workspaceApi.test.ts: all assertions passed')
