import assert from 'node:assert/strict'
import { EMPTY_ONBOARDING_DRAFT, furthestStep, mergeDraft, restoreDraft, step1Complete, stepFromSearch } from './onboardingDraft.ts'

const filled = { orgName: 'Riverbend', archetype: 'Civil Society' as const }

// Furthest step: the larger of what was reached and the hint, clamped to the 3 steps, never past an incomplete step 1.
assert.equal(furthestStep(filled, 1), 1)
assert.equal(furthestStep(filled, 0, 2), 2)
assert.equal(furthestStep(filled, 1, 0), 1)
assert.equal(furthestStep(filled, 9), 2)
assert.equal(furthestStep(filled, -3, Number.NaN), 0)
assert.equal(furthestStep({ orgName: '  ', archetype: 'Public' }, 2), 0)
assert.equal(furthestStep({ orgName: 'X', archetype: '' }, 2), 0)
assert.equal(step1Complete(filled), true)
assert.equal(step1Complete({ orgName: '', archetype: 'Public' }), false)

// Restore: valid drafts round-trip; junk falls back to the defaults and never throws.
const saved = { orgName: 'Riverbend', archetype: 'Civil Society', country: 'KE', sector: 'Health', subsector: '', invites: ['a@b.org'], path: 'web', furthestStep: 1 }
assert.deepEqual(restoreDraft(saved), saved)
for (const junk of [null, undefined, 'x', 7, [], { archetype: 'Alien', path: 'fax', invites: 'no', furthestStep: 'high' }]) {
  const d = restoreDraft(junk)
  assert.equal(d.archetype, '')
  assert.equal(d.path, null)
  assert.deepEqual(d.invites, [''])
  assert.equal(d.furthestStep, 0)
}
assert.equal(restoreDraft({ ...saved, orgName: 'x'.repeat(500) }).orgName.length, 200)
assert.equal(restoreDraft({ ...saved, furthestStep: 2, archetype: '' }).furthestStep, 0)
assert.equal(restoreDraft({ ...saved, invites: Array(80).fill('a@b.org') }).invites.length, 50)
// The default is never shared or mutated.
restoreDraft(null).invites.push('x')
assert.deepEqual(EMPTY_ONBOARDING_DRAFT.invites, [''])

// Merge: a saved name wins; a blank one keeps the account's organisation name.
assert.equal(mergeDraft({ orgName: 'Account Org' }, restoreDraft(saved)).orgName, 'Riverbend')
assert.equal(mergeDraft({ orgName: 'Account Org' }, restoreDraft(null)).orgName, 'Account Org')

// ?step= hint on the resume link is 1-based.
assert.equal(stepFromSearch('2'), 1)
assert.equal(stepFromSearch('3'), 2)
for (const bad of [null, '0', '4', 'x', '1.5', undefined]) assert.equal(stepFromSearch(bad), 0)
console.log('onboardingDraft: ok')
