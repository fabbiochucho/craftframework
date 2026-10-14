// Self-check — run directly with `node src/lib/nphi-registry.test.ts`.
import assert from 'node:assert/strict'
import { NPHI_REGISTRY, nphiForEmail } from './nphi-registry.ts'
import { AFRICA_COUNTRIES } from './africa-countries.ts'

for (const n of NPHI_REGISTRY) {
  assert.ok(AFRICA_COUNTRIES.some((c) => c.iso2 === n.country), n.country)
  for (const d of n.domains) {
    assert.match(d, /^[a-z0-9.-]+\.[a-z]{2,}$/)
    assert.ok(!/^(gov|go|gouv|co|ac|org)\.[a-z]{2}$/.test(d), `${d} is too generic`)
  }
}
assert.equal(new Set(NPHI_REGISTRY.flatMap((n) => n.domains)).size, NPHI_REGISTRY.flatMap((n) => n.domains).length)

assert.equal(nphiForEmail('Jane.Doe@NCDC.gov.ng')?.country, 'NG')
assert.equal(nphiForEmail('a@lab.nicd.ac.za')?.matchedDomain, 'nicd.ac.za', 'subdomains match')
assert.equal(nphiForEmail('a@znphi.gov.zm')?.country, 'ZM')
assert.equal(nphiForEmail('a@fakencdc.gov.ng'), null, 'look-alike domains do not match')
assert.equal(nphiForEmail('a@ncdc.gov.ng.evil.com'), null)
assert.equal(nphiForEmail('a@gmail.com'), null)
assert.equal(nphiForEmail('not-an-email'), null)
console.log('nphi-registry.test.ts: all assertions passed')
