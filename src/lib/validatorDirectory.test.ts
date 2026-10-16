// Self-check — run directly with `node src/lib/validatorDirectory.test.ts`.
import assert from 'node:assert/strict'
import { cleanList, credentialLabel, effectiveAccreditation, matchesQuery, natureOptions, validatorLevel, FUNDER_TYPES } from './validatorDirectory.ts'

assert.equal(effectiveAccreditation({ accreditationStatus: 'registered', pilotAccredited: false }), 'registered')
assert.equal(effectiveAccreditation({ accreditationStatus: 'registered', pilotAccredited: true }), 'pilot-accredited')
assert.equal(effectiveAccreditation({ accreditationStatus: 'accredited', pilotAccredited: true }), 'accredited')
assert.equal(effectiveAccreditation({ accreditationStatus: 'suspended', pilotAccredited: true }), 'suspended', 'suspension beats the pilot switch')
assert.equal(validatorLevel({ accreditationStatus: 'registered', pilotAccredited: false }), 'Associate')
assert.equal(validatorLevel({ accreditationStatus: 'registered', pilotAccredited: true }), 'Validator')
assert.equal(validatorLevel({ accreditationStatus: 'suspended', pilotAccredited: true }), 'Associate')

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
