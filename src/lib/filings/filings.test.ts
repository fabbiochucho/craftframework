// Self-check: `node src/lib/filings/filings.test.ts` — recurring statutory filings by country.
import assert from 'node:assert/strict'
import { FILINGS, filingsFor, nextDue, toObligation, type EntityKind } from './index.ts'

const ng = FILINGS.filter((f) => f.jurisdiction === 'NG')
const has = (re: RegExp) => ng.find((f) => re.test(f.name))
// Nigeria: the filings the owner listed, confirmed against the law
assert.ok(has(/CAC annual return/i), 'CAC annual return for companies')
assert.ok(has(/incorporated trustees/i), 'NGO (incorporated trustees) returns')
assert.ok(has(/company income tax/i))
assert.ok(has(/VAT/))
assert.ok(has(/PAYE/))
assert.ok(has(/withholding/i))
assert.ok(has(/pension/i))
for (const f of FILINGS) {
  assert.ok(f.legalBasis.length > 5, `${f.id} names its legal basis`)
  assert.ok(f.source.url.startsWith('https://') && /^\d{4}-\d{2}-\d{2}$/.test(f.source.checked), `${f.id} source`)
  assert.ok(f.appliesTo.length > 0, `${f.id} says who files`)
}
assert.equal(new Set(FILINGS.map((f) => f.id)).size, FILINGS.length, 'unique ids')

// Who files what
const company: EntityKind[] = ['company', 'employer', 'vat-registered']
const ngo: EntityKind[] = ['ngo', 'employer']
assert.ok(filingsFor('NG', company).some((f) => /CAC annual return/i.test(f.name)))
assert.ok(!filingsFor('NG', company).some((f) => /incorporated trustees/i.test(f.name)))
assert.ok(filingsFor('NG', ngo).some((f) => /incorporated trustees/i.test(f.name)))
assert.ok(!filingsFor('NG', ngo).some((f) => /VAT return/i.test(f.name)), 'an NGO not registered for VAT does not get VAT returns')
assert.deepEqual(filingsFor('ZZ', company), [])

// Due dates (today 2026-10-19; financial year ending 31 December)
const today = '2026-10-19'
const ctx = { today, yearEnd: '12-31' }
assert.equal(nextDue(has(/VAT return/)!, ctx), '2026-10-21', 'VAT by the 21st of the following month')
assert.equal(nextDue(has(/PAYE remittance/)!, ctx), '2026-11-10', 'the 10th has passed this month, so next month')
assert.equal(nextDue(has(/company income tax/i)!, ctx), '2027-06-30', 'six months after the 31 December year end')
assert.equal(nextDue(has(/company income tax/i)!, { today, yearEnd: '06-30' }), '2026-12-31')
assert.equal(nextDue(has(/annual PAYE|employer.*annual/i)!, ctx), '2027-01-31')
assert.equal(nextDue(has(/incorporated trustees/i)!, ctx), '2027-01-15', 'returns twice a year: 15 July and 15 January')
assert.equal(nextDue(has(/pension/i)!, ctx), null, 'tied to each payday, so no fixed date')

// Into the obligations register
const ob = toObligation(has(/VAT return/)!, ctx, 'Finance Manager')
assert.equal(ob.type, 'regulatory_filing'); assert.equal(ob.frequency, 'monthly'); assert.equal(ob.nextDueDate, '2026-10-21'); assert.equal(ob.country, 'NG')
assert.match(ob.notes ?? '', /Nigeria Tax Administration Act/)
console.log('filings: ok')
