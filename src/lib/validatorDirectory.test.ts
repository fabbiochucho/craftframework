// Self-check — run directly with `node src/lib/validatorDirectory.test.ts`.
import assert from 'node:assert/strict'
import { cleanList, credentialLabel, effectiveAccreditation, matchesQuery, natureOptions, validatorLevel, FUNDER_TYPES } from './validatorDirectory.ts'

const now = new Date('2026-10-16T00:00:00Z')
const future = '2027-10-16T00:00:00Z', past = '2026-10-15T00:00:00Z'
assert.equal(effectiveAccreditation({ status: 'active', accreditedUntil: null }, now), 'registered', 'no badge until the training is done')
assert.equal(effectiveAccreditation({ status: 'active', accreditedUntil: future }, now), 'accredited')
assert.equal(effectiveAccreditation({ status: 'active', accreditedUntil: past }, now), 'lapsed', 'annual renewal missed')
assert.equal(effectiveAccreditation({ status: 'suspended', accreditedUntil: future }, now), 'suspended', 'suspension beats accreditation')
assert.equal(validatorLevel({ status: 'active', accreditedUntil: null }, now), 'Associate')
assert.equal(validatorLevel({ status: 'active', accreditedUntil: future }, now), 'Validator')
assert.equal(validatorLevel({ status: 'active', accreditedUntil: past }, now), 'Associate')
assert.equal(validatorLevel({ status: 'suspended', accreditedUntil: future }, now), 'Associate')

assert.equal(credentialLabel({ verifiedAt: null }), 'self-declared')
assert.equal(credentialLabel({ verifiedAt: new Date() }), 'verified')

assert.deepEqual(cleanList([' ACCA ', 'acca', 42, '', 'ICAN']), ['ACCA', 'ICAN'])
assert.deepEqual(cleanList('nope'), [])
assert.equal(cleanList(Array.from({ length: 50 }, (_, i) => `x${i}`), 5).length, 5)
assert.equal(cleanList(['a'.repeat(200)])[0].length, 80)

assert.ok(matchesQuery(['Jane Doe', ['Audit', 'Kenya']], 'jane kenya'))
assert.ok(!matchesQuery(['Jane Doe', ['Audit']], 'jane nigeria'))
assert.ok(matchesQuery([null, undefined], '  '))

assert.equal(natureOptions('funding_partner'), FUNDER_TYPES)
assert.ok(natureOptions('validator_firm').includes('NGO/CSO'))
console.log('validatorDirectory.test.ts: all assertions passed')
