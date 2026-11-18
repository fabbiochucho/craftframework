// Bulk upload (offline Excel workbook / CSV import): own answers need write access to the organisation; independent
// scores need its independent assessor or the Super Admin; one bad row and nothing is saved; uploaded own answers
// count as the organisation's own (self_at), independent ones never do.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const api = (await import(new URL('../../netlify/functions/responses.mts', import.meta.url).href)).default
const ORG = 'self_owner_x_example'
const OWNER = 'owner@x.example'
const ASSESSOR = 'assessor@y.example'
const SUPER = 'fabbiochucho@gmail.com'
const FUNDER = 'staff@funder.example'

async function call(email: string, method: string, body?: unknown, qs = '') {
  ;(globalThis as any).__craftTestIdentity = { email }
  const res: Response = await api(new Request(`http://localhost/api/responses${qs}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  return { status: res.status, body: await res.json().catch(() => null) }
}

describe('bulk upload', () => {
  beforeEach(async () => {
    delete process.env.RESEND_API_KEY
    await truncateAll()
    await rows(`INSERT INTO organizations(id, name, email, created_by) VALUES($1, 'Owner Org', $2, $2)`, [ORG, OWNER])
    await rows(`INSERT INTO access_grants(id, org_id, grantee, role, status, level) VALUES('g1', $1, $2, 'independent_assessor', 'active', 'read')`, [ORG, ASSESSOR])
  })

  it('saves own answers and independent scores for the right people only, all or nothing', async () => {
    const own = { orgId: ORG, scores: { 'CRAFT-ONC-01': 3, 'GOV-01': 0 }, notes: { 'CRAFT-ONC-01': 'Minutes seen' } }
    assert.equal((await call(ASSESSOR, 'PUT', own)).status, 403, 'the assessor cannot upload the organisation\'s own answers')
    assert.equal((await call(FUNDER, 'PUT', own)).status, 403, 'a funder without write access cannot either')
    assert.equal((await call(OWNER, 'PUT', { orgId: ORG, scores: { 'CRAFT-ONC-01': 6, 'GOV-01': 2 } })).status, 400)
    assert.equal((await rows('SELECT count(*)::int AS n FROM responses'))[0].n, 0, 'one bad row: nothing saved')
    const saved = await call(OWNER, 'PUT', own)
    assert.equal(saved.status, 200)
    assert.equal(saved.body.own, 2)

    const ind = { orgId: ORG, assessor: { scores: { 'CRAFT-ONC-01': 1, 'CRAFT-ONC-02': 2 }, notes: { 'CRAFT-ONC-02': 'No roles document' }, assessedOn: '2026-11-17' } }
    assert.equal((await call(OWNER, 'PUT', ind)).status, 403, 'the organisation cannot upload independent scores')
    assert.equal((await call(ASSESSOR, 'PUT', ind)).status, 200)
    assert.equal((await call(SUPER, 'PUT', { ...ind, assessor: { scores: { 'CRAFT-ONC-03': 4 }, assessedOn: '2026-11-17' } })).status, 200, 'the Super Admin may upload for the assessor')

    const view = (await call(OWNER, 'GET', undefined, `?orgId=${ORG}`)).body
    assert.deepEqual(view.scores, { 'CRAFT-ONC-01': 3, 'GOV-01': 0 }, 'own answers kept; assessor-only rows are not own answers')
    assert.equal(view.details['CRAFT-ONC-01'].assessorScore, 1)
    assert.equal(view.details['CRAFT-ONC-02'].assessorNote, 'No roles document')
    assert.equal(view.assessedOn, '2026-11-17')
    assert.equal((await rows(`SELECT notes FROM responses WHERE question_id='CRAFT-ONC-01'`))[0].notes, 'Minutes seen')
  })
})
