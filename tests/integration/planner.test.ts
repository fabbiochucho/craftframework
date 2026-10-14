// Planner workstreams, dependencies and budgets, against Postgres.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { ASSESSOR, VIEWER, as, createOrg, expectStatus, truncateAll } from './harness.ts'

let wsId = 0
const P = () => `/workspaces/${wsId}`

describe('planner workstreams, dependencies and budgets', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  it('validates dependencies and budgets and analyses the roadmap', async () => {
    const gen = expectStatus(await as(ASSESSOR).post(`${P()}/esg-planner/sec-ng`, { organisationName: 'Acme Plc', entityType: 'public_company', readiness: 'early', horizon: '12m', startDate: '2026-11-01' }), 201).body
    const [a, b, c] = gen.rows.slice(0, 3).map((r: any) => r.planId as number)
    const put = (id: number, body: object) => as(ASSESSOR).put(`${P()}/esg-plans/${id}`, body)

    expectStatus(await put(a, { workstream: 'Governance', budgetEstimate: 1000, budgetActual: 1500, budgetCurrency: 'ngn', status: 'completed', timelineStart: '2027-01-01', timelineEnd: '2027-12-31' }), 200)
    expectStatus(await put(b, { workstream: 'Data', budgetEstimate: 2000, budgetCurrency: 'NGN', dependsOn: [a], status: 'in_progress', timelineStart: '2028-01-01', timelineEnd: '2028-12-31' }), 200)
    expectStatus(await put(c, { workstream: 'Data', dependsOn: [b], timelineStart: '2029-01-01', timelineEnd: '2029-12-31' }), 200)

    const cycle = await put(a, { dependsOn: [c] })
    assert.equal(cycle.status, 400)
    assert.match(cycle.body.error, /dependency cycle/)
    assert.equal((await put(a, { dependsOn: [a] })).status, 400, 'self-dependency')
    assert.equal((await put(a, { dependsOn: [999999] })).status, 400, 'unknown plan')
    assert.equal((await put(a, { budgetEstimate: -5 })).status, 400)
    assert.equal((await put(a, { budgetCurrency: 'NAIRA' })).status, 400)

    const rm = expectStatus(await as(VIEWER).get(`${P()}/esg-roadmap`), 200).body
    const data = rm.analysis.workstreams.find((w: any) => w.name === 'Data')
    assert.equal(data.tasks, 2)
    assert.equal(data.budgetEstimate, 2000)
    assert.deepEqual(rm.analysis.totals, [{ currency: 'NGN', estimate: 3000, actual: 1500, variance: -1500 }])
    assert.deepEqual(rm.analysis.criticalPath.taskIds, [a, b, c])
    assert.deepEqual(rm.analysis.blocked, [], 'b is in progress and its prerequisite a is complete')
    assert.equal(rm.items.find((i: any) => i.planId === a).budgetActual, 1500)
  })
})
