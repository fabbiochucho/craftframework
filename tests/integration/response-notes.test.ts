// Notes on an answer: private to their author unless shared. A shared note is seen by the organisation's team and by
// its independent assessor; a private one never leaves its author; nobody else outside the organisation sees any.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const notes = (await import(new URL('../../netlify/functions/response-notes.mts', import.meta.url).href)).default
const ORG = 'self_owner_x_example'
const OWNER = 'owner@x.example'
const ASSESSOR = 'martin@assessor.example'

async function call(email: string, method: string, qs = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = { email }
  const res: Response = await notes(new Request(`http://localhost/api/response-notes${qs}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  return { status: res.status, body: await res.json().catch(() => null) }
}

describe('notes on answers', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id, name, email, created_by) VALUES($1, 'Owner Org', $2, $2)`, [ORG, OWNER])
    await rows(`INSERT INTO access_grants(id, org_id, grantee, role, status, level) VALUES('g1', $1, $2, 'independent_assessor', 'active', 'read')`, [ORG, ASSESSOR])
  })

  it('shows shared notes to the independent assessor, and private ones to their author only', async () => {
    assert.equal((await call(OWNER, 'POST', '', { orgId: ORG, questionId: 'GOV-01', body: 'No board charter exists yet, so scored 0', visibility: 'shared' })).status, 201)
    assert.equal((await call(OWNER, 'POST', '', { orgId: ORG, questionId: 'GOV-01', body: 'Draft idea only', visibility: 'private' })).status, 201)
    assert.deepEqual((await call(OWNER, 'GET', `?orgId=${ORG}`)).body.map((n: any) => n.body), ['No board charter exists yet, so scored 0', 'Draft idea only'])
    assert.deepEqual((await call(ASSESSOR, 'GET', `?orgId=${ORG}`)).body.map((n: any) => n.body), ['No board charter exists yet, so scored 0'])
    assert.equal((await call('stranger@y.example', 'GET', `?orgId=${ORG}`)).status, 403)
  })
})
