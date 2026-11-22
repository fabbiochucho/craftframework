// A public health institute's NPHI / JEE / SPAR assessments (Org Workspaces) joined to its CRAFT organisation:
// its dashboard and progress steps see them, its invited independent assessor scores each item beside the
// institute after declaring independence, and a funder sees the results of an assessment linked to its grant.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { ADMIN, ASSESSOR, OWNER, VIEWER, as, createOrg, expectStatus, rows, truncateAll } from './harness.ts'
import { stepsFor } from '../../netlify/lib/progress.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const nphi = await load('nphi')
const links = await load('assessment-links')
const awardsApi = await load('awards')
const archive = await load('assessment-archive')
const OPERATOR = 'fabbiochucho@gmail.com'
const CRAFT_ORG = 'self_owner_acme_example' // the owner's own CRAFT organisation
const REVIEWER = 'reviewer@africacdc.example'
const FUNDER = 'staff@funder.example'

async function call(handler: any, email: string, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = { email }
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  return { status: res.status, body: await res.json().catch(() => null) }
}
const ok = async (r: Promise<{ status: number; body: any }>, status = 200) => { const x = await r; assert.equal(x.status, status, JSON.stringify(x.body)); return x.body }

describe('NPHI assessments from the CRAFT organisation', () => {
  let wsId = 0, id = 0
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id, name, email, created_by) VALUES($1, 'NCDC', $2, $2)`, [CRAFT_ORG, OWNER])
    await rows(`INSERT INTO access_grants(id, org_id, grantee, role, status, level) VALUES('g1', $1, $2, 'independent_assessor', 'active', 'read')`, [CRAFT_ORG, REVIEWER])
    const org = await createOrg('NCDC')
    wsId = org.wsId
    expectStatus(await as(ADMIN).put(`/orgs/${org.orgId}`, { type: 'nphi' }), 200)
    expectStatus(await as(OPERATOR).post(`/admin/type-verifications/${org.orgId}`, { decision: 'verified', note: 'Act checked' }), 200)
    id = expectStatus(await as(ASSESSOR).post(`/workspaces/${wsId}/assessments`, { assessmentType: 'NPHI', reportingPeriod: '2026' }), 201).body.id
    expectStatus(await as(ASSESSOR).put(`/workspaces/${wsId}/assessments/${id}/scores/attributes/A1`, { score: 4 }), 200)
  })

  it('shows on the dashboard, takes independent scores after a declaration, and reaches the funder', async () => {
    // Created by the owner, the institute is joined to the owner's CRAFT organisation.
    const view = (await ok(call(nphi, OWNER, 'GET', `nphi?orgId=${CRAFT_ORG}`), 200))
    assert.equal(view.orgs[0].name, 'NCDC')
    assert.equal(view.orgs[0].workspaceId, wsId)
    assert.deepEqual(view.assessments.map((a: any) => [a.type, a.status]), [['NPHI', 'draft']])
    assert.equal(view.canReview, false)
    assert.equal((await call(nphi, 'stranger@x.example', 'GET', `nphi?orgId=${CRAFT_ORG}`)).status, 403)
    const step = (await stepsFor(CRAFT_ORG)).find((s) => s.id === 'ws-NPHI')!
    assert.match(step.title, /NPHI development assessment .*% answered/)
    assert.equal(step.done, false)

    // The independent assessor: invited by the organisation, declares independence, then scores beside the institute.
    assert.equal((await ok(call(nphi, REVIEWER, 'GET', `nphi?orgId=${CRAFT_ORG}`), 200)).canReview, true)
    const score = (email: string, body: object) => call(nphi, email, 'PUT', 'nphi', { assessment: id, ...body })
    assert.equal((await score(OWNER, { item: 'A1', score: 2 })).status, 403, 'the institute cannot enter the independent score')
    assert.equal((await score(REVIEWER, { item: 'A1', score: 2 })).status, 409, 'declaration first')
    assert.equal((await call(nphi, REVIEWER, 'POST', 'nphi', { assessment: id, declare: true })).status, 400, 'names who they assess for')
    await ok(call(nphi, REVIEWER, 'POST', 'nphi', { assessment: id, declare: true, organisation: 'Africa CDC' }), 200)
    assert.equal((await score(REVIEWER, { item: 'A1', score: 6 })).status, 400)
    assert.equal((await score(REVIEWER, { item: 'COE1', score: 3 })).status, 400, 'not in this assessment')
    assert.equal((await score(REVIEWER, { item: 'A2', notApplicable: true })).status, 400, 'not applicable needs a reason')
    await ok(score(REVIEWER, { item: 'A1', score: 2, note: 'Act seen; no budget line' }))
    const detail = (await ok(call(nphi, REVIEWER, 'GET', `nphi?assessment=${id}`), 200))
    assert.equal(detail.own.A1.score, 4)
    assert.equal(detail.independent.A1.score, 2)
    assert.equal(detail.declaration.organisation, 'Africa CDC')
    const history = await ok(call(archive, REVIEWER, 'GET', 'assessment-archive?source=independent'))
    assert.equal(history.revisions.length, 1)
    assert.equal(history.revisions[0].period, '2026')
    assert.equal(history.revisions[0].snapshot.score, 2)
    assert.equal(history.revisions[0].actor, REVIEWER)
    assert.ok((await rows("SELECT snapshot FROM assessment_revisions WHERE source='independent'"))[0].snapshot.startsWith('enc:'))
    // The institute sees the independent level in Org Workspaces too.
    const a = expectStatus(await as(VIEWER).get(`/workspaces/${wsId}/assessments/${id}`), 200).body
    assert.equal(a.independent[0].score, 2)
    assert.equal(expectStatus(await as(VIEWER).get(`/workspaces/${wsId}/assessments/${id}/scorecard`), 200).body.independent.answered, 1)

    // The organisation links the assessment to a grant; that grant's funder sees the results.
    const award = (await ok(call(awardsApi, OWNER, 'POST', 'awards', { orgId: CRAFT_ORG, title: 'Health security 2026', funderName: 'Funder', funderEmail: FUNDER }), 201))
    const awardId = award.id ?? award.award?.id
    assert.equal((await call(links, OWNER, 'PUT', 'assessment-links', { orgId: CRAFT_ORG, assessment: 'ws:999999', awardId })).status, 400)
    await ok(call(links, OWNER, 'PUT', 'assessment-links', { orgId: CRAFT_ORG, assessment: `ws:${id}`, awardId }), 200)
    const funded = (await ok(call(awardsApi, FUNDER, 'GET', 'awards/funder'), 200)).organisations[0].awards[0].results
    assert.equal(funded.length, 1)
    assert.equal(funded[0].label, 'NPHI development assessment (Africa CDC framework) v1 (2026)')
    assert.match(funded[0].summary, /draft · institute .* · independent assessor/)
    await rows("UPDATE access_grants SET status='revoked' WHERE id='g1'")
    assert.deepEqual((await ok(call(archive, REVIEWER, 'GET', 'assessment-archive?source=independent'))).revisions, [])
  })
})
