// Self-check — run directly with `node src/lib/validationStatement.test.ts`.
import assert from 'node:assert/strict'
import { cleanPublicOptions, generateVerificationId, normaliseVerificationId, standardWording, VERIFICATION_ID_RE } from './validationStatement.ts'

// IDs: random, non-sequential, 8 base32 characters, no ambiguous letters.
const a = generateVerificationId(new Uint8Array([0, 1, 2, 3, 31, 32, 33, 255]))
assert.equal(a, 'CRAFT-V-0123Z01Z')
assert.match(a, VERIFICATION_ID_RE)
const seen = new Set(Array.from({ length: 500 }, () => generateVerificationId()))
assert.equal(seen.size, 500)
for (const id of seen) assert.match(id, VERIFICATION_ID_RE)
assert.ok(![...seen].some((id) => /[ILOU]/.test(id.slice(8))))

// Lookup is forgiving of case, spaces and look-alike letters, and strict otherwise.
assert.equal(normaliseVerificationId('  craft-v-0123z01z '), 'CRAFT-V-0123Z01Z')
assert.equal(normaliseVerificationId('CRAFT-V-O123ZOLZ'), 'CRAFT-V-0123Z01Z')
assert.equal(normaliseVerificationId('CRAFTV0123Z01Z'), 'CRAFT-V-0123Z01Z')
for (const bad of ['', 'CRAFT-V-123', 'CRAFT-V-0123Z01ZZ', 'ABC', null, 42, 'CRAFT-V-0123Z01U', '../../etc']) assert.equal(normaliseVerificationId(bad), null, String(bad))

// The standard wording is the spec's, word for word.
const w = standardWording({ type: 'independent_validation', frameworkName: 'CRAFT Capital Readiness Ladder', frameworkVersion: 'ICARF v4.0' })
assert.equal(w.means, "An accredited validator, independent of the organisation, has reviewed the organisation's self-assessment and supporting evidence against the CRAFT Capital Readiness Ladder (ICARF v4.0), using the method and scope stated above, and has concluded that the organisation met the requirements for the rung shown on the dates of the review. Any qualifications listed form part of this conclusion.")
assert.equal(w.doesNot, "It is not an audit or review of financial statements, and not a guarantee of the organisation's future performance, solvency, or use of funds. It does not cover matters outside the stated scope, and it reflects evidence available to the validator at the time; it may not reflect events after the review date. It is not an endorsement by DiBadili Institute or the engaging party, and it does not replace the due diligence of anyone deciding to fund, lend to, or partner with the organisation.")
assert.equal(w.changes, 'A validation is valid only while it shows as current on its verification page. It may be suspended after a material event, or withdrawn if new evidence shows it was wrong. Always check the verification page before relying on a copy.')
// A funder review replaces the first sentence and says the reviewers are not independent.
const f = standardWording({ type: 'funder_review', frameworkName: 'CRAFT Capital Readiness Ladder', frameworkVersion: 'ICARF v4.0', funderName: 'Savannah Capital' })
assert.match(f.means, /^Staff of Savannah Capital have reviewed the organisation's self-assessment and supporting evidence against the CRAFT Capital Readiness Ladder \(ICARF v4\.0\)\. The reviewers are employed by the funder and are not independent of it\./)
assert.ok(f.means.endsWith('not independent of it. Any qualifications listed form part of this conclusion.'))
assert.ok(!/accredited validator, independent/.test(f.means))
assert.equal(f.doesNot, w.doesNot)

// Organisation options: only what the spec lets it choose, https links only.
assert.deepEqual(cleanPublicOptions({ registrationNumber: ' RC 123 ', showRungHistory: true, showQualifications: 'yes', devmapperUrl: 'https://devmapper.example/org/1', extra: 'x' }),
  { registrationNumber: 'RC 123', showRungHistory: true, devmapperUrl: 'https://devmapper.example/org/1' })
assert.deepEqual(cleanPublicOptions({ devmapperUrl: 'javascript:alert(1)' }), {})
assert.deepEqual(cleanPublicOptions({ devmapperUrl: 'http://insecure.example' }), {})
assert.deepEqual(cleanPublicOptions(null), {})
console.log('validationStatement.test.ts ok')
