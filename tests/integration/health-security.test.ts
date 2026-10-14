// Health-security assessments (NPHI, JEE, SPAR, subnational JEE, AAR) through the real API, against Postgres.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { ADMIN, ASSESSOR, OWNER, VIEWER, as, createOrg, expectStatus, truncateAll } from './harness.ts'

let orgId = 0, wsId = 0
const P = () => `/workspaces/${wsId}`
const create = (assessmentType: string, extra: object = {}) => as(ASSESSOR).post(`${P()}/assessments`, { assessmentType, ...extra })
const score = (id: number, section: string, item: string, body: object) => as(ASSESSOR).put(`${P()}/assessments/${id}/scores/${encodeURIComponent(section)}/${encodeURIComponent(item)}`, body)

describe('health-security assessments', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ orgId, wsId } = await createOrg())
  })

  it('are available only to NPHIs, and score with the WHO and Africa CDC methods', async () => {
    assert.deepEqual(expectStatus(await as(VIEWER).get(`${P()}/health-security/catalogue`), 200).body.available, [])
    const denied = await create('SPAR')
    assert.equal(denied.status, 403)
    assert.match(denied.body.error, /national public health institute/)
    assert.equal((await as(ASSESSOR).put(`/orgs/${orgId}`, { type: 'nphi' })).status, 403, 'only admins change the organisation type')
    expectStatus(await as(ADMIN).put(`/orgs/${orgId}`, { type: 'nphi' }), 200)
    assert.equal((await as(OWNER).put(`/orgs/${orgId}`, { type: 'martian' })).status, 400)

    // SPAR: indicator % = level × 20, capacity mean, overall mean of capacities; SDG 3.d.1.
    const spar = expectStatus(await create('SPAR', { reportingPeriod: '2026' }), 201).body.id
    assert.equal((await score(spar, 'C1', 'C2.1', { score: 3 })).status, 400, 'item must belong to its capacity')
    assert.equal((await score(spar, 'C1', 'C1.1', { score: 6 })).status, 400)
    expectStatus(await score(spar, 'C1', 'C1.1', { score: 3 }), 200)
    expectStatus(await score(spar, 'C1', 'C1.2', { score: 4 }), 200)
    expectStatus(await score(spar, 'C3', 'C3.1', { score: 5 }), 200)
    const sc = expectStatus(await as(VIEWER).get(`${P()}/assessments/${spar}/scorecard`), 200).body
    assert.equal(sc.sections.find((s: any) => s.id === 'C1').percent, 70)
    assert.equal(sc.overall, 85)
    assert.equal(sc.sdg.value, 85)

    // NPHI with the Centre of Excellence scope; evidence cap of 2.
    const plain = expectStatus(await create('NPHI'), 201).body.id
    assert.equal((await score(plain, 'coe', 'COE1', { score: 4, evidenceUploaded: true })).status, 400, 'CoE items need that scope')
    const nphi = expectStatus(await create('NPHI', { extendedScope: true }), 201).body.id
    expectStatus(await score(nphi, 'coe', 'COE1', { score: 4, evidenceUploaded: true }), 200)
    expectStatus(await score(nphi, 'establishment', 'E9', { score: 5 }), 200)
    expectStatus(await score(nphi, 'attributes', 'A6', { notApplicable: true, naReason: 'Network model' }), 200)
    const ns = expectStatus(await as(VIEWER).get(`${P()}/assessments/${nphi}/scorecard`), 200).body
    assert.equal(ns.items.find((i: any) => i.id === 'E9').effective, 2, 'unevidenced score capped at 2')
    assert.ok(ns.priorities.some((p: any) => p.id === 'E9'))

    // JEE, then the crosswalk joins the three.
    const jee = expectStatus(await create('JEE'), 201).body.id
    expectStatus(await score(jee, 'prevent', 'P1', { score: 2 }), 200)
    const ov = expectStatus(await as(VIEWER).get(`${P()}/health-security/overview`), 200).body
    assert.deepEqual(ov.summary.map((s: any) => s.type).sort(), ['JEE', 'NPHI', 'SPAR'])
    const legal = ov.crosswalk.find((r: any) => r.spar === 'C1')
    assert.equal(legal.sparPercent, 70)
    assert.equal(legal.jeePercent, 40)

    // After-action reviews take findings, not scores.
    const aar = expectStatus(await create('AAR', { reportingPeriod: 'Cholera response 2026' }), 201).body.id
    assert.equal((await score(aar, 'detect', 'D2', { score: 3 })).status, 400)
    expectStatus(await as(ASSESSOR).post(`${P()}/assessments/${aar}/findings`, { domain: 'D2', severity: 'high', description: 'Alerts took 9 days to verify' }), 201)
  })

  it('lets subnational governments self-assess with the subnational JEE only', async () => {
    expectStatus(await as(OWNER).put(`/orgs/${orgId}`, { type: 'subnational' }), 200)
    assert.deepEqual(expectStatus(await as(VIEWER).get(`${P()}/health-security/catalogue`), 200).body.available, ['JEE_SUB', 'AAR', 'SIMEX'])
    assert.equal((await create('SPAR')).status, 403)
    assert.equal((await create('NPHI')).status, 403)
    const s = expectStatus(await create('JEE_SUB', { reportingPeriod: 'Kano State 2026' }), 201).body.id
    expectStatus(await score(s, 'other', 'PoE', { notApplicable: true, naReason: 'Points of entry are managed nationally' }), 200)
    expectStatus(await score(s, 'sub', 'S1', { score: 3, evidenceUploaded: true }), 200)
    const sc = expectStatus(await as(VIEWER).get(`${P()}/assessments/${s}/scorecard`), 200).body
    assert.equal(sc.sections.find((x: any) => x.id === 'sub').percent, 60)
    assert.equal(sc.sections.find((x: any) => x.id === 'other').total, 2, 'PoE excluded as not applicable')
  })
})
