import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const api = (await import(new URL('../../netlify/functions/networks.mts', import.meta.url).href)).default

const SUPER = 'fabbiochucho@gmail.com'
const NG_COORD = 'coord@ngnetwork.example'
const LAGOS_COORD = 'lagos@ngnetwork.example'
const ADA = 'ada@riverbend.example' // runs self_ada_riverbend_example
const BEN = 'ben@kanotrust.example' // runs self_ben_kanotrust_example
const STRANGER = 'eve@elsewhere.example'
const ADA_ORG = 'self_ada_riverbend_example'
const BEN_ORG = 'self_ben_kanotrust_example'

async function call(email: string | null, method: string, path = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await api(new Request(`http://localhost/api/networks${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}

/** Africa → Nigeria → Lagos, Kano; coordinators at Nigeria and Lagos. */
async function setup() {
  const net = await call(SUPER, 'POST', '', { name: 'Pan-African CSO Network', description: 'Test', root: { level: 'continental', name: 'Africa', geoCode: 'AU' } })
  assert.equal(net.status, 201, net.text)
  const id = net.body.id
  const ng = await call(SUPER, 'POST', `/${id}/nodes`, { parentId: net.body.rootId, level: 'national', name: 'Nigeria', geoCode: 'NG' })
  assert.equal(ng.status, 201, ng.text)
  assert.equal((await call(SUPER, 'POST', `/${id}/admins`, { nodeId: ng.body.id, email: NG_COORD })).status, 201)
  const lagos = await call(NG_COORD, 'POST', `/${id}/nodes`, { parentId: ng.body.id, level: 'subnational', name: 'Lagos', geoCode: 'NG-LA' })
  assert.equal(lagos.status, 201, lagos.text)
  const kano = await call(NG_COORD, 'POST', `/${id}/nodes`, { parentId: ng.body.id, level: 'subnational', name: 'Kano', geoCode: 'NG-KN' })
  assert.equal((await call(NG_COORD, 'POST', `/${id}/admins`, { nodeId: lagos.body.id, email: LAGOS_COORD })).status, 201)
  return { id, root: net.body.rootId, ng: ng.body.id, lagos: lagos.body.id, kano: kano.body.id }
}

describe('networks: levels, coordinators and consenting members', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country,email) VALUES($1,'Riverbend Cooperative','Nigeria','contact@riverbend.example'),($2,'Kano Women Trust','Nigeria','')`, [ADA_ORG, BEN_ORG])
  })

  it('only the Super Admin creates networks, and sign-in is required', async () => {
    assert.equal((await call(null, 'GET')).status, 401)
    assert.equal((await call(STRANGER, 'POST', '', { name: 'Mine', root: { level: 'national', name: 'Ghana', geoCode: 'GH' } })).status, 403)
    assert.equal((await call(SUPER, 'POST', '', { name: 'Bad', root: { level: 'national', name: 'Ghana', geoCode: 'Ghana' } })).status, 400)
  })

  it('coordinators manage only their level and below; levels nest downwards', async () => {
    const t = await setup()
    // Lagos coordinator cannot add under Nigeria or touch Kano
    assert.equal((await call(LAGOS_COORD, 'POST', `/${t.id}/nodes`, { parentId: t.ng, level: 'subnational', name: 'Oyo', geoCode: 'NG-OY' })).status, 403)
    assert.equal((await call(LAGOS_COORD, 'POST', `/${t.id}/invitations`, { nodeId: t.kano, org: BEN_ORG })).status, 403)
    // A level can't sit above its parent
    assert.equal((await call(NG_COORD, 'POST', `/${t.id}/nodes`, { parentId: t.lagos, level: 'national', name: 'Wrong' })).status, 400)
    // Strangers can't see the network at all
    assert.equal((await call(STRANGER, 'GET', `/${t.id}`)).status, 404)
  })

  it('an organisation joins only by accepting, and "totals only" members are never named', async () => {
    const t = await setup()
    assert.equal((await call(LAGOS_COORD, 'POST', `/${t.id}/invitations`, { nodeId: t.lagos, org: 'contact@riverbend.example' })).status, 201)
    assert.equal((await call(NG_COORD, 'POST', `/${t.id}/invitations`, { nodeId: t.kano, org: BEN_ORG })).status, 201)
    assert.equal((await call(NG_COORD, 'POST', `/${t.id}/invitations`, { nodeId: t.kano, org: BEN_ORG })).status, 409, 'no double invitation')
    assert.equal((await call(NG_COORD, 'POST', `/${t.id}/invitations`, { nodeId: t.kano, org: 'nobody@nowhere.example' })).status, 404)

    // Invited, not yet a member: counted as invited, not as a member
    let coord = await call(NG_COORD, 'GET', `/${t.id}`)
    assert.equal(coord.status, 200, coord.text)
    assert.deepEqual(coord.body.members.counts, { invited: 2, accepted: 0, declined: 0 })

    // Ada sees her invitation and accepts with named results; Ben accepts with totals only
    const adaHome = await call(ADA, 'GET')
    assert.equal(adaHome.body.memberships.length, 1)
    const adaInv = adaHome.body.memberships[0]
    assert.equal(adaInv.status, 'invited')
    assert.equal((await call(BEN, 'POST', `/members/${adaInv.id}`, { action: 'accept', sharing: 'full' })).status, 403, 'only the organisation decides')
    assert.equal((await call(ADA, 'POST', `/members/${adaInv.id}`, { action: 'accept', sharing: 'full' })).status, 200)
    const benInv = (await call(BEN, 'GET')).body.memberships[0]
    assert.equal((await call(BEN, 'POST', `/members/${benInv.id}`, { action: 'accept' })).status, 200)

    coord = await call(NG_COORD, 'GET', `/${t.id}`)
    assert.deepEqual(coord.body.members.counts, { invited: 0, accepted: 2, declined: 0 })
    assert.deepEqual(coord.body.members.named.map((m: any) => m.name), ['Riverbend Cooperative'])
    assert.equal(coord.body.members.totalsOnly, 1)
    assert.ok(!coord.text.includes('Kano Women Trust'), 'a totals-only member is never named to coordinators')

    // The Lagos coordinator sees Lagos only
    const lagos = await call(LAGOS_COORD, 'GET', `/${t.id}`)
    assert.deepEqual(lagos.body.members.counts, { invited: 0, accepted: 1, declined: 0 })
    assert.equal(lagos.body.members.totalsOnly, 0)

    // Members see their own membership but no coordinator data
    const adaView = await call(ADA, 'GET', `/${t.id}`)
    assert.equal(adaView.status, 200)
    assert.equal(adaView.body.members, null)
    assert.deepEqual(adaView.body.admins, [])

    // Switching to totals only removes the name; leaving removes the member
    assert.equal((await call(ADA, 'POST', `/members/${adaInv.id}`, { action: 'sharing', sharing: 'aggregate' })).status, 200)
    assert.deepEqual((await call(NG_COORD, 'GET', `/${t.id}`)).body.members.named, [])
    assert.equal((await call(ADA, 'POST', `/members/${adaInv.id}`, { action: 'leave' })).status, 200)
    assert.equal((await call(NG_COORD, 'GET', `/${t.id}`)).body.members.counts.accepted, 1)

    const audit = await rows(`SELECT action FROM audit_logs WHERE category='Network' ORDER BY id`)
    assert.ok(audit.some((a: any) => a.action === 'Network invitation accepted'))
    assert.ok(audit.some((a: any) => a.action === 'Network sharing set to aggregate'))
  })
})
