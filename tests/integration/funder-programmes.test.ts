// A funding partner's staff enter its own grants and report types; organisations then see them for Finance
// Triangulation. Only the funder's active staff (or the Super Admin) may change them.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const api = (await import(new URL('../../netlify/functions/funder-programmes.mts', import.meta.url).href)).default
const STAFF = 'a@giz.example'
const ORG_USER = 'coordinator@younite.example'
const SUPER = 'fabbiochucho@gmail.com'

async function call(email: string, method: string, body?: unknown, qs = '') {
  ;(globalThis as any).__craftTestIdentity = { email }
  const res: Response = await api(new Request(`http://localhost/api/funder-programmes${qs}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  return { status: res.status, body: await res.json().catch(() => null) }
}
const save = (who: string, extra: object = {}) => call(who, 'PUT', { firmId: 'firm_giz', grants: ['Youth TB Response', 'Youth TB Response'], reportTypes: ['Quarterly financial report'], ...extra })

describe('funder programmes', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO firms(id, name, kind, created_by) VALUES('firm_giz', 'GIZ', 'funding_partner', $1)`, [SUPER])
    await rows(`INSERT INTO firm_members(firm_id, email, role, status) VALUES('firm_giz', $1, 'owner', 'active')`, [STAFF])
  })

  it('lets funder staff and the Super Admin set grants; organisations see only completed programmes', async () => {
    assert.equal((await call(STAFF, 'GET', undefined, '?mine=1')).body.programmes[0].name, 'GIZ', 'staff see their funder, even empty')
    assert.deepEqual((await call(ORG_USER, 'GET', undefined, '?mine=1')).body.programmes, [])
    assert.deepEqual((await call(ORG_USER, 'GET')).body.programmes, [], 'nothing listed before grants are entered')

    assert.equal((await save(ORG_USER)).status, 403, 'an organisation cannot set a funder\'s grants')
    assert.equal((await save(STAFF, { grants: ['x'.repeat(151)] })).status, 400)
    const ok = await save(STAFF)
    assert.equal(ok.status, 200)
    assert.deepEqual(ok.body.programmes[0].grants.map((g: any) => g.name), ['Youth TB Response'], 'duplicates dropped')

    const listed = (await call(ORG_USER, 'GET')).body.programmes
    assert.deepEqual(listed.map((p: any) => [p.id, p.name, p.reportTypes[0].name]), [['firm_giz', 'GIZ', 'Quarterly financial report']])

    assert.equal((await save(SUPER, { streams: ['Core'] })).status, 200, 'the Super Admin may fill it in for them')
    await rows(`UPDATE firm_members SET status='removed'`)
    assert.equal((await save(STAFF)).status, 403, 'former staff cannot change it')
  })

  it('lets a funder name beneficiary organisations, who are told and can add the grant to their awards', async () => {
    delete process.env.RESEND_API_KEY
    const ORG = 'self_coordinator_younite_example'
    await rows(`INSERT INTO organizations(id, name, email, created_by) VALUES($1, 'YOUNITE', $2, $2)`, [ORG, ORG_USER])
    await save(STAFF, { grantTypes: { 'Youth TB Response': ['technical_assistance', 'bogus', 'project_grant'] } })
    const ben = (who: string, method: string, body: object) => call(who, method, { firmId: 'firm_giz', grantId: 'youth-tb-response-1', ...body })
    assert.equal((await ben(ORG_USER, 'POST', { email: ORG_USER })).status, 403, 'only the funder names beneficiaries')
    assert.equal((await ben(STAFF, 'POST', { email: 'not-an-email' })).status, 400)
    assert.equal((await ben(STAFF, 'POST', { grantId: 'other', email: ORG_USER })).status, 400, 'only its own grants')
    assert.equal((await ben(STAFF, 'POST', { email: ORG_USER.toUpperCase() })).status, 200)
    assert.equal((await ben(STAFF, 'POST', { email: 'nobody@unknown.example' })).status, 200, 'same answer whether or not the organisation is on CRAFT')
    assert.equal((await ben(STAFF, 'POST', { email: ORG_USER })).status, 200, 'naming twice is harmless')
    assert.equal((await rows(`SELECT count(*)::int AS n FROM inbox_messages WHERE recipient=$1`, [ORG_USER]))[0].n, 1, 'told once')
    assert.deepEqual((await call(STAFF, 'GET', undefined, '?beneficiaries=firm_giz')).body.beneficiaries.map((b: any) => b.email).sort(), ['coordinator@younite.example', 'nobody@unknown.example'])
    assert.equal((await call(ORG_USER, 'GET', undefined, '?beneficiaries=firm_giz')).status, 403)

    const offered = (await call(ORG_USER, 'GET', undefined, '?offered=1')).body.offered
    assert.deepEqual(offered, [{ firmId: 'firm_giz', funder: 'GIZ', grantId: 'youth-tb-response-1', grant: 'Youth TB Response', types: ['project_grant', 'technical_assistance'] }], 'support types kept, unknown ones dropped')
    await rows(`INSERT INTO awards(id, org_id, title, funder_name, funder_firm_id, funder_grant_id, created_by) VALUES('aw1', $1, 'Youth TB Response', 'GIZ', 'firm_giz', 'youth-tb-response-1', $2)`, [ORG, ORG_USER])
    assert.deepEqual((await call(ORG_USER, 'GET', undefined, '?offered=1')).body.offered, [], 'gone once added to its awards')
    assert.equal((await ben(STAFF, 'DELETE', { email: 'nobody@unknown.example' })).status, 200)
  })
})
