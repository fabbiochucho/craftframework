// Team moderators: a funder / validator team's owners and the Super Admin change who moderates it, and a
// team always keeps one. An organisation always keeps an active Administrator (its moderator), except
// when the Super Admin overrides.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const firmsApi = await load('firms')
const usersApi = await load('users')
const SUPER = 'fabbiochucho@gmail.com'
const OWNER = 'lead@giz.example', STAFF = 'staff@giz.example', OUT = 'out@else.example'
const ADMIN = 'admin@org.example', MEMBER = 'member@org.example'

async function call(api: any, email: string, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = { email }
  const res: Response = await api(new Request(`http://localhost/api/${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}
const seat = (by: string, email: string, role: string) => call(firmsApi, by, 'PUT', 'firms', { firmId: 'f1', email, role })

describe('team moderators', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO firms(id,name,kind) VALUES('f1','GIZ','funding_partner')`)
    await rows(`INSERT INTO firm_members(firm_id,email,role,status) VALUES('f1','${OWNER}','owner','active'),('f1','${STAFF}','consultant','active')`)
    await rows(`INSERT INTO organizations(id,name) VALUES('org1','Net')`)
    await rows(`INSERT INTO users(id,email,org_id,role,status) VALUES('a','${ADMIN}','org1','admin','active'),('m','${MEMBER}','org1','assessor','active')`)
  })

  it('a funder or validator team: its moderator hands over, the last moderator stays, outsiders cannot, the Super Admin can', async () => {
    assert.equal((await seat(OWNER, OWNER, 'consultant')).status, 409, 'the only moderator cannot step down')
    assert.equal((await seat(OWNER, STAFF, 'boss')).status, 400, 'only owner or consultant')
    assert.equal((await seat(OUT, STAFF, 'owner')).status, 403)
    assert.equal((await seat(OWNER, STAFF, 'owner')).status, 200, 'make a colleague moderator')
    assert.equal((await seat(OWNER, OWNER, 'consultant')).status, 200, 'then step down')
    assert.equal((await call(firmsApi, STAFF, 'DELETE', `firms?firmId=f1&email=${encodeURIComponent(STAFF)}`)).status, 409, 'the last moderator cannot leave')
    assert.equal((await seat(SUPER, OWNER, 'owner')).status, 200, 'the Super Admin can assign a moderator')
    const seats = await rows(`SELECT email, role, status FROM firm_members ORDER BY email`)
    assert.deepEqual(seats.map((s: any) => [s.email, s.role, s.status]), [[OWNER, 'owner', 'active'], [STAFF, 'owner', 'active']])
    const all = await call(firmsApi, SUPER, 'GET', 'firms?all=1')
    assert.equal(all.body.length, 1)
    assert.equal((await call(firmsApi, OWNER, 'GET', 'firms?all=1')).status, 403)
  })

  it('an organisation keeps an Administrator: hand over first; the Super Admin may override', async () => {
    const assign = (by: string, email: string, role: string) => call(usersApi, by, 'POST', 'users', { email, orgId: 'org1', role, status: 'active' })
    assert.equal((await assign(ADMIN, ADMIN, 'assessor')).status, 409, 'the only Administrator cannot step down')
    assert.equal((await call(usersApi, ADMIN, 'DELETE', `users?email=${encodeURIComponent(ADMIN)}`)).status, 409)
    assert.equal((await assign(ADMIN, MEMBER, 'admin')).status, 201, 'make a colleague Administrator')
    assert.equal((await assign(ADMIN, ADMIN, 'assessor')).status, 201, 'then step down')
    assert.equal((await assign(SUPER, MEMBER, 'assessor')).status, 201, 'the Super Admin may override')
  })
})
