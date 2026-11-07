// The Super Admin can delete networks (and any level below the top), institutions, portfolios and people
// (assessors, independent assessors), including a person's sign-in account; deletes are confirmed and
// complete, and others cannot do the same.
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const networks = await load('networks')
const usersApi = await load('users')
const orgsApi = await load('organizations')
const portfoliosApi = await load('portfolios')

const SUPER = 'fabbiochucho@gmail.com'
const OWNER = 'owner@network.example'
const ADA = 'ada@riverbend.example'
const ADA_ORG = 'self_ada_riverbend_example'

async function call(handler: any, email: string | null, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}
const net = (email: string, method: string, path = '', body?: unknown) => call(networks, email, method, `networks${path}`, body)

/** A network set up by OWNER: Nigeria → Lagos → Ikeja, with ADA's organisation a member at Ikeja. */
async function setup(joined: boolean) {
  const n = await net(OWNER, 'POST', '', { name: 'Nigeria CSO Network', root: { level: 'national', name: 'Nigeria', geoCode: 'NG' } })
  assert.equal(n.status, 201, n.text)
  const lagos = await net(OWNER, 'POST', `/${n.body.id}/nodes`, { parentId: n.body.rootId, level: 'subnational', name: 'Lagos', geoCode: 'NG-LA' })
  const ikeja = await net(OWNER, 'POST', `/${n.body.id}/nodes`, { parentId: lagos.body.id, level: 'local', name: 'Ikeja', geoCode: '' })
  assert.equal(ikeja.status, 201, ikeja.text)
  await rows(`INSERT INTO network_members(id,node_id,org_id,status,invited_by) VALUES($5,$1,$2,$3,$4)`, [ikeja.body.id, ADA_ORG, joined ? 'accepted' : 'invited', OWNER, `nm_${n.body.id}`])
  await rows(`INSERT INTO network_admins(node_id,email,role,added_by) VALUES($1,'lagos@x.example','coordinator',$2)`, [lagos.body.id, OWNER])
  await rows(`INSERT INTO invitations(id,token,email,kind,network_node_id,role,scope_label,status,expires_at) VALUES($2,$3,'new@x.example','organization',$1,'admin','x','pending',now()+interval '7 days')`, [ikeja.body.id, `inv_${n.body.id}`, `tok_${n.body.id}`])
  return { id: n.body.id as string, root: n.body.rootId as string, lagos: lagos.body.id as string, ikeja: ikeja.body.id as string }
}
const count = async (table: string, where = 'true', params: unknown[] = []) => Number((await rows(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, params))[0].n)

describe('Super Admin deletes', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,email,created_by) VALUES($1,'Riverbend Cooperative',$2,$2)`, [ADA_ORG, ADA])
  })
  afterEach(() => { delete (globalThis as any).__craftTestIdentityUsers })

  it('deletes any level below the top, with everything under it', async () => {
    const n = await setup(true)
    assert.equal((await net(OWNER, 'DELETE', `/${n.id}/nodes/${n.lagos}`, { confirmName: 'Lagos' })).status, 403, 'Super Admin only')
    assert.equal((await net(SUPER, 'DELETE', `/${n.id}/nodes/${n.root}`, { confirmName: 'Nigeria' })).status, 400, 'the top level is the network')
    assert.equal((await net(SUPER, 'DELETE', `/${n.id}/nodes/${n.lagos}`, { confirmName: 'Lagso' })).status, 400, 'typed confirmation')
    const ok = await net(SUPER, 'DELETE', `/${n.id}/nodes/${n.lagos}`, { confirmName: 'lagos' })
    assert.equal(ok.status, 200, ok.text)
    assert.equal(ok.body.deleted, 2, 'Lagos and Ikeja')
    assert.equal(await count('network_nodes', 'network_id=$1', [n.id]), 1, 'only the top level remains')
    assert.equal(await count('network_members'), 0)
    assert.equal(await count('network_admins', "email='lagos@x.example'"), 0)
    assert.equal((await rows(`SELECT status FROM invitations WHERE id=$1`, [`inv_${n.id}`]))[0].status, 'revoked')
    assert.equal(await count('organizations', 'id=$1', [ADA_ORG]), 1, "organisations keep their own workspace")
  })

  it('deletes a whole network: the Super Admin always, the creator only before anyone joined', async () => {
    const joined = await setup(true)
    const view = await net(OWNER, 'GET', `/${joined.id}`)
    assert.equal(view.body.network.canDelete, false)
    assert.equal((await net(OWNER, 'DELETE', `/${joined.id}`, { confirmName: 'Nigeria CSO Network' })).status, 409, 'an organisation joined')
    assert.equal((await net(ADA, 'DELETE', `/${joined.id}`, { confirmName: 'Nigeria CSO Network' })).status, 403)
    assert.equal((await net(SUPER, 'GET', `/${joined.id}`)).body.network.canDelete, true)
    assert.equal((await net(SUPER, 'DELETE', `/${joined.id}`, { confirmName: 'wrong' })).status, 400)
    assert.equal((await net(SUPER, 'DELETE', `/${joined.id}`, { confirmName: 'Nigeria CSO Network' })).status, 200)
    for (const t of ['networks', 'network_nodes', 'network_members', 'network_admins']) assert.equal(await count(t), 0, t)

    const fresh = await setup(false)
    assert.equal((await net(OWNER, 'GET', `/${fresh.id}`)).body.network.canDelete, true)
    assert.equal((await net(OWNER, 'DELETE', `/${fresh.id}`, { confirmName: 'Nigeria CSO Network' })).status, 200, 'the creator, while nobody has joined')
    assert.equal(await count('networks'), 0)
  })

  it('deletes institutions and portfolios completely', async () => {
    await rows(`INSERT INTO portfolios(id,name,created_by) VALUES('pf1','Cohort',$1)`, [SUPER])
    await rows(`INSERT INTO portfolio_orgs(portfolio_id,org_id) VALUES('pf1',$1)`, [ADA_ORG])
    await rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES($1,'capital:scores','{}')`, [ADA_ORG])
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('u1','staff@riverbend.example',$1,'assessor')`, [ADA_ORG])
    assert.equal((await call(portfoliosApi, SUPER, 'DELETE', 'portfolios?id=pf1')).status, 200)
    assert.equal(await count('portfolios'), 0)
    assert.equal(await count('organizations'), 1, 'institutions in a portfolio are kept')
    assert.equal((await call(orgsApi, 'stranger@x.example', 'DELETE', `organizations?id=${ADA_ORG}`)).status, 403)
    assert.equal((await call(orgsApi, SUPER, 'DELETE', `organizations?id=${ADA_ORG}`)).status, 200)
    for (const [t, w] of [['organizations', `id='${ADA_ORG}'`], ['legacy_workspace_state', `org_id='${ADA_ORG}'`], ['users', `org_id='${ADA_ORG}'`]]) assert.equal(await count(t, w), 0, t)
    assert.ok(await count('audit_logs', "action='Deleted institution'"))
  })

  it('deletes assessors and independent assessors, including their sign-in account', async () => {
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a1','assessor@riverbend.example',$1,'assessor'),('i1','consultant@lfa.example',$1,'independent')`, [ADA_ORG])
    ;(globalThis as any).__craftTestIdentityUsers = [
      { id: 'id-a', email: 'assessor@riverbend.example', name: 'A' },
      { id: 'id-i', email: 'consultant@lfa.example', name: 'I' },
      { id: 'id-r', email: 'registered.only@x.example', name: 'R' },
    ]
    assert.equal((await call(usersApi, ADA, 'DELETE', 'users?email=consultant@lfa.example&account=1')).status, 403, 'Super Admin only')
    assert.equal((await call(usersApi, SUPER, 'DELETE', `users?email=${SUPER}&account=1`)).status, 400, 'never the Super Admin')
    for (const email of ['assessor@riverbend.example', 'consultant@lfa.example', 'registered.only@x.example']) {
      const r = await call(usersApi, SUPER, 'DELETE', `users?email=${encodeURIComponent(email)}&account=1`)
      assert.equal(r.status, 200, r.text)
      assert.equal(r.body.accountDeleted, true, email)
    }
    assert.equal(await count('users'), 0)
    assert.deepEqual((globalThis as any).__craftTestIdentityUsers, [], 'sign-in accounts gone, so nobody comes back in the directory')
    const list = await call(usersApi, SUPER, 'GET', 'users')
    assert.deepEqual(list.body, [])
  })
})
