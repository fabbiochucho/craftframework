// An award can name a funder's own grant on CRAFT, and each assessment can be linked to one of the organisation's
// awards. Only the organisation sets links; its independent assessor can read them but not change them.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const links = await load('assessment-links')
const awardsApi = await load('awards')
const ORG = 'self_owner_x_example'
const OWNER = 'owner@x.example'
const ASSESSOR = 'assessor@y.example'

async function call(handler: any, email: string, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = { email }
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  return { status: res.status, body: await res.json().catch(() => null) }
}

describe('assessment links to grants', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id, name, email, created_by) VALUES($1, 'Owner Org', $2, $2)`, [ORG, OWNER])
    await rows(`INSERT INTO access_grants(id, org_id, grantee, role, status, level) VALUES('g1', $1, $2, 'independent_assessor', 'active', 'read')`, [ORG, ASSESSOR])
    await rows(`INSERT INTO firms(id, name, kind) VALUES('firm_giz', 'GIZ', 'funding_partner')`)
    await rows(`INSERT INTO funder_programmes(firm_id, grants, report_types, updated_by) VALUES('firm_giz', '[{"id":"youth-tb-1","name":"Youth TB"}]', '[{"id":"q-1","name":"Quarterly"}]', 'a@giz.example')`)
  })

  it('ties an award to a funder grant and assessments to the award', async () => {
    const award = (body: object) => call(awardsApi, OWNER, 'POST', 'awards', { orgId: ORG, title: 'Youth TB 2026', funderName: 'GIZ', ...body })
    assert.equal((await award({ funderFirmId: 'firm_giz', funderGrantId: 'nope' })).status, 400, 'the grant must be one the funder listed')
    assert.equal((await award({ funderFirmId: 'firm_giz' })).status, 400, 'funder and grant go together')
    const made = await award({ funderFirmId: 'firm_giz', funderGrantId: 'youth-tb-1' })
    assert.equal(made.status, 201)
    const awardId = made.body.id
    assert.equal((await rows('SELECT funder_grant_id FROM awards'))[0].funder_grant_id, 'youth-tb-1')

    const put = (who: string, assessment: string, id = awardId) => call(links, who, 'PUT', 'assessment-links', { orgId: ORG, assessment, awardId: id })
    assert.equal((await put(OWNER, 'craft-onc')).status, 200)
    assert.equal((await put(OWNER, 'wizard')).status, 200)
    assert.equal((await put(OWNER, 'cca:missing')).status, 400, 'only this organisation\'s own capacity assessments')
    assert.equal((await put(OWNER, 'craft-onc', 'aw_other')).status, 400, 'only this organisation\'s own awards')
    assert.equal((await put(ASSESSOR, 'wizard', '')).status, 403, 'the assessor cannot change links')
    assert.deepEqual((await call(links, ASSESSOR, 'GET', `assessment-links?orgId=${ORG}`)).body.links, { 'craft-onc': awardId, wizard: awardId })
    assert.equal((await put(OWNER, 'wizard', '')).status, 200)
    assert.deepEqual(Object.keys((await call(links, OWNER, 'GET', `assessment-links?orgId=${ORG}`)).body.links), ['craft-onc'])
    assert.equal((await call(links, 'stranger@z.example', 'GET', `assessment-links?orgId=${ORG}`)).status, 403)
  })
})
