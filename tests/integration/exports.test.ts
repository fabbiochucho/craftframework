// XLSX and PDF exports for the scorecard, planner, roadmap and ESG report QA, against Postgres.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { ASSESSOR, VIEWER, as, createOrg, expectStatus, truncateAll } from './harness.ts'
import { readZipEntries } from '../../netlify/lib/evidence-content.ts'

let wsId = 0
const P = () => `/workspaces/${wsId}`
const xlsx = (res: any) => {
  assert.equal(res.status, 200, res.text)
  assert.match(res.headers.get('content-type'), /spreadsheetml/)
  return readZipEntries(Buffer.from(res.raw), () => true)
}
const pdf = (res: any) => {
  assert.equal(res.status, 200, res.text)
  assert.equal(res.headers.get('content-type'), 'application/pdf')
  assert.equal(Buffer.from(res.raw).subarray(0, 5).toString(), '%PDF-')
}

describe('XLSX and PDF exports', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  it('exports the planner, roadmap, CRAFT scorecard and QA period', async () => {
    const gen = expectStatus(await as(ASSESSOR).post(`${P()}/esg-planner/sec-ng`, { organisationName: 'Acme Plc', entityType: 'public_company', readiness: 'early', horizon: '12m', startDate: '2026-11-01' }), 201).body
    expectStatus(await as(ASSESSOR).put(`${P()}/esg-plans/${gen.rows[0].planId}`, { workstream: 'Governance', budgetEstimate: 1000, budgetCurrency: 'NGN' }), 200)

    const plan = xlsx(await as(VIEWER).get(`${P()}/esg-planner/sec-ng/export?format=xlsx`))
    assert.match(plan.get('xl/workbook.xml')!, /name="Plan".*name="Milestones"/)
    assert.match(plan.get('xl/worksheets/sheet2.xml')!, /Governance/)
    pdf(await as(VIEWER).get(`${P()}/esg-planner/sec-ng/export?format=pdf`))

    const roadmap = xlsx(await as(VIEWER).get(`${P()}/esg-roadmap/export?format=xlsx`))
    assert.match(roadmap.get('xl/workbook.xml')!, /name="Workstreams"/)
    pdf(await as(VIEWER).get(`${P()}/esg-roadmap/export?format=pdf`))
    assert.equal((await as(VIEWER).get(`${P()}/esg-roadmap/export?format=docx`)).status, 400)

    const a = expectStatus(await as(ASSESSOR).post(`${P()}/assessments`, { assessmentType: 'CRAFT', reportingPeriod: 'FY2026' }), 201).body.id
    expectStatus(await as(ASSESSOR).put(`${P()}/assessments/${a}/scores/leadership/LDR-1`, { score: 4, evidenceUploaded: true }), 200)
    const sc = xlsx(await as(VIEWER).get(`${P()}/assessments/${a}/scorecard/export?format=xlsx`))
    assert.match(sc.get('xl/workbook.xml')!, /name="Pillars".*name="Recommendations"/)
    pdf(await as(VIEWER).get(`${P()}/assessments/${a}/scorecard/export?format=pdf`))

    const g = expectStatus(await as(ASSESSOR).post(`${P()}/assessments`, { assessmentType: 'G2G' }), 201).body.id
    xlsx(await as(VIEWER).get(`${P()}/assessments/${g}/scorecard/export?format=xlsx`))

    const profile = { jurisdiction: 'NG', category: 'ng_pie', adoptingVoluntarily: false, financialActivities: false, secScope: true, mofiScope: false, mofiOverlay: false }
    const q = expectStatus(await as(ASSESSOR).post(`${P()}/qa/periods`, { label: 'FY2028', periodStart: '2028-01-01', periodEnd: '2028-12-31', profile }), 201).body.id
    const qa = xlsx(await as(VIEWER).get(`${P()}/qa/periods/${q}/export?format=xlsx`))
    assert.match(qa.get('xl/worksheets/sheet2.xml')!, /GQ-01/)
    pdf(await as(VIEWER).get(`${P()}/qa/periods/${q}/export?format=pdf`))
    assert.equal((await as(VIEWER).get(`${P()}/qa/periods/${q}/export?format=csv`)).status, 200, 'CSV still works')
  })
})
