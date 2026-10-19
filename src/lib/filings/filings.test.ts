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
// Kenya
const ke = (re: RegExp) => FILINGS.find((f) => f.jurisdiction === 'KE' && re.test(f.name))!
assert.equal(nextDue(ke(/PAYE/), ctx), '2026-11-09')
assert.equal(nextDue(ke(/VAT/), ctx), '2026-10-20')
assert.equal(nextDue(ke(/Withholding/), ctx), null, 'within five working days of each deduction')
assert.ok(ke(/SHIF/) && ke(/Housing Levy/) && ke(/NSSF/))
assert.equal(nextDue(ke(/Instalment tax/), ctx), '2026-12-20', 'the 20th of months 4, 6, 9 and 12 of the accounting year')
assert.equal(nextDue(ke(/Instalment tax/), { today, yearEnd: '06-30' }), '2026-10-20', 'July start: months 4, 6, 9, 12 are October, December, March, June')
assert.equal(nextDue(ke(/Instalment tax/), { today: '2026-10-21', yearEnd: '06-30' }), '2026-12-20')
assert.ok(ke(/annual return/i).notes!.match(/28|42/), 'the conflicting deadline is stated')
// South Africa
const za = (re: RegExp) => FILINGS.find((f) => f.jurisdiction === 'ZA' && re.test(f.name))!
assert.equal(nextDue(za(/EMP201/), ctx), '2026-11-07')
assert.equal(nextDue(za(/IRP6/), ctx), '2026-12-31', 'year-end provisional payment')
assert.equal(nextDue(za(/EMP501/), ctx), '2026-10-31')
assert.equal(nextDue(za(/ITR14/), ctx), '2026-12-31', '12 months after the December 2025 year end')
console.log('filings: ok')

// Coverage: every jurisdiction in the laws register either has filings or a stated reason why not
import { FILING_GAPS, FILING_JURISDICTIONS } from './index.ts'
import { LAW_JURISDICTIONS } from '../laws/types.ts'
for (const j of LAW_JURISDICTIONS) {
  assert.ok(FILING_JURISDICTIONS.includes(j) !== Boolean(FILING_GAPS[j]), `${j}: filings or a gap note, not both`)
}
assert.match(FILING_GAPS.EU, /national/i, 'EU filings are made in each member state')
const gb = (re: RegExp) => FILINGS.find((f) => f.jurisdiction === 'UK' && re.test(f.name))!
assert.equal(nextDue(gb(/confirmation statement/i), ctx), null)
assert.equal(nextDue(gb(/PAYE/), ctx), '2026-10-22')
assert.equal(nextDue(FILINGS.find((f) => f.id === 'us-941')!, ctx), '2026-10-31')
