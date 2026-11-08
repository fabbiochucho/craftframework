// Self-check — run directly with `node src/lib/dataroom.test.ts`.
import assert from 'node:assert/strict'
import { approvedForReview, computeProgress, countryCode, documentsForDomain, generateChecklist, MASTER_COMPLIANCE_MATRIX, requestListCsv } from './dataroom.ts'

// Ids are unique.
const ids = MASTER_COMPLIANCE_MATRIX.map((r) => r.id)
assert.equal(new Set(ids).size, ids.length)

// Desk review documents reach every archetype; network documents only networks, coalitions and unions.
const has = (a: Parameters<typeof generateChecklist>[0], sector: string, id: string) => generateChecklist(a, 'NG', sector).some((r) => r.id === id)
assert.ok(has('Public', 'Ministry', 'UNI-ORG-02') && has('Private', 'Fintech', 'UNI-FIN-04') && has('Civil Society', 'NGO', 'UNI-GOV-02'))
assert.ok(has('Civil Society', 'NGO', 'CS-HR-02') && !has('Private', 'Fintech', 'CS-HR-02'), 'child protection: civil society')
assert.ok(has('Civil Society', 'Network', 'NET-01') && has('Civil Society', 'Coalition', 'NET-06') && !has('Civil Society', 'NGO', 'NET-01'))

// "Does not exist" is counted separately from missing and from provided.
const reqs = generateChecklist('Civil Society', 'NG', 'Network')
const p = computeProgress(reqs, { 'NET-01': { requirementId: 'NET-01', documentName: 'x', status: 'not_available', notAvailableReason: 'No policy yet' }, 'UNI-ORG-02': { requirementId: 'UNI-ORG-02', documentName: 'x', status: 'uploaded' } })
assert.deepEqual([p.notAvailable, p.provided, p.missing], [1, 1, reqs.length - 2])

// Approved shortly before the review: possibly written for it.
assert.equal(approvedForReview('2026-10-01', '2026-11-06'), true)
assert.equal(approvedForReview('2025-01-01', '2026-11-06'), false)
assert.equal(approvedForReview(undefined, '2026-11-06'), false)

// Documents feed Capacity Assessment domains (government ids carry a level prefix).
assert.ok(documentsForDomain(reqs, 'community', 'com-gov-1').some((r) => r.id === 'UNI-GOV-02'))
assert.ok(documentsForDomain(generateChecklist('Public', 'NG', 'Ministry'), 'state', 'sta-plan-1').some((r) => r.id === 'UNI-ORG-02'))

// Request list: header plus one row per document; quotes escaped.
const csv = requestListCsv(reqs, { 'NET-01': { requirementId: 'NET-01', documentName: 'x', status: 'not_available', notAvailableReason: 'Says "none"' } }).split('\r\n')
assert.equal(csv.length, reqs.length + 1)
assert.ok(csv.some((l) => l.includes('"Says ""none"""') && l.includes('Does not exist')))

assert.deepEqual([countryCode('Nigeria'), countryCode('KE'), countryCode('Atlantis')], ['NG', 'KE', ''])
console.log('dataroom.test.ts: all assertions passed')

// Healthcare documents apply in every country, to health providers, health technology and health research only.
import { LADDER_INDICATORS } from './capitalReadiness.ts'
const hcIds = (r: ReturnType<typeof generateChecklist>) => r.map((x) => x.id)
for (const c of ['NG', 'KE', 'SN', 'ZA', 'CV']) {
  assert.ok(hcIds(generateChecklist('Civil Society', c, 'NGO', 'Health')).includes('HC-PAYER-CS'), `health NGO in ${c}`)
  assert.ok(hcIds(generateChecklist('Private', c, 'Healthtech', 'Diagnostics & Devices')).includes('HC-FACILITY-PS'), `diagnostics firm in ${c}`)
}
assert.ok(!hcIds(generateChecklist('Civil Society', 'NG', 'NGO', 'Education')).some((i) => i.startsWith('HC-')), 'not for an education NGO')
assert.ok(!hcIds(generateChecklist('Private', 'NG', 'Healthtech', 'Health Insurance / HMO')).includes('HC-FACILITY-PS'), 'an insurer has no facility licence')
assert.ok(hcIds(generateChecklist('Private', 'GH', 'Fintech', '')).includes('INV-MODEL'), 'investment readiness for any sector')
assert.deepEqual(['CRL-3D', 'CRL-5D', 'CRL-5E'].map((id) => LADDER_INDICATORS.find((q) => q.id === id)?.level), [3, 5, 5])
console.log('dataroom.test.ts: healthcare and investment readiness passed')
