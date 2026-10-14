// 54-country jurisdiction packs and the regulatory source register, against Postgres.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { ASSESSOR, VIEWER, as, createOrg, expectStatus, truncateAll } from './harness.ts'

let wsId = 0
const P = () => `/workspaces/${wsId}`
const flags = { adoptingVoluntarily: false, financialActivities: false, secScope: false, mofiScope: false, mofiOverlay: false }

describe('54-country packs and regulatory sources', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  it('offers every African country and applies exchange disclosure rules to listed issuers', async () => {
    const cat = expectStatus(await as(VIEWER).get(`${P()}/qa/catalogue`), 200).body
    assert.equal(cat.jurisdictions.length, 55)
    assert.match(cat.version, /CRAFT-QA 1\.3/)
    const id = expectStatus(await as(ASSESSOR).post(`${P()}/qa/periods`, { label: 'FY2027', periodStart: '2027-01-01', periodEnd: '2027-12-31', profile: { jurisdiction: 'BW', category: 'bw_listed', ...flags } }), 201).body.id
    const period = expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${id}`), 200).body
    assert.ok(JSON.stringify(period).includes('JUR-02'))
  })

  it('tracks re-verification per workspace', async () => {
    const before = expectStatus(await as(VIEWER).get(`${P()}/regulatory-sources`), 200).body
    assert.equal(before.sources.length, 108)
    assert.equal(before.sources.find((s: any) => s.key === 'afr:BW').status, 'unverified')
    assert.equal((await as(VIEWER).post(`${P()}/regulatory-sources/checks`, { sourceKey: 'afr:BW', outcome: 'confirmed' })).status, 403)
    assert.equal((await as(ASSESSOR).post(`${P()}/regulatory-sources/checks`, { sourceKey: 'afr:XX', outcome: 'confirmed' })).status, 400)
    assert.equal((await as(ASSESSOR).post(`${P()}/regulatory-sources/checks`, { sourceKey: 'afr:BW', outcome: 'changed' })).status, 400, 'a change needs a note')
    expectStatus(await as(ASSESSOR).post(`${P()}/regulatory-sources/checks`, { sourceKey: 'afr:BW', outcome: 'confirmed', note: 'NBFIRA site checked' }), 201)
    const after = expectStatus(await as(VIEWER).get(`${P()}/regulatory-sources`), 200).body
    const bw = after.sources.find((s: any) => s.key === 'afr:BW')
    assert.equal(bw.status, 'verified')
    assert.equal(bw.latestCheck.note, 'NBFIRA site checked')
  })
})
