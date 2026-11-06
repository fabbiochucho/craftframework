import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { blobStores, rows, truncateAll } from './harness.ts'

const networksApi = (await import(new URL('../../netlify/functions/networks.mts', import.meta.url).href)).default
const feedApi = (await import(new URL('../../netlify/functions/network-cca.mts', import.meta.url).href)).default

const SUPER = 'fabbiochucho@gmail.com'
const COORD = 'coord@ngnetwork.example'
// Six member organisations: five in Lagos, one in Kano. Org 1 shares named results; the rest totals only.
const ORGS = [1, 2, 3, 4, 5, 6].map((i) => ({ email: `lead${i}@member${i}.example`, id: `self_lead${i}_member${i}_example`, name: `Member Org ${i}` }))

async function call(api: any, base: string, email: string | null, method: string, path = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await api(new Request(`http://localhost${base}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}
const net = (e: string | null, m: string, p = '', b?: unknown) => call(networksApi, '/api/networks', e, m, p, b)
const feed = (e: string | null, q: string) => call(feedApi, '/api/network-cca', e, 'GET', q)

const st = (id: string) => [{ id, text: id }]
const dom = (id: string) => ({ id, name: id, level1: 'x', levels: { 2: st(`${id}.2`), 3: st(`${id}.3`), 4: st(`${id}.4`) } })
const MODULES = [{ id: 'community', name: 'Community', audience: 'x', areas: [{ id: 'gov', name: 'Governance', domains: [dom('g1'), dom('g2'), dom('g3')] }] }]
const seen = { met: true, evidence: 'seen' }

describe('Capacity Assessment results in networks', () => {
  beforeEach(async () => {
    await truncateAll()
    for (const o of ORGS) await rows(`INSERT INTO organizations(id,name,country) VALUES($1,$2,'Nigeria')`, [o.id, o.name])
    blobStores().set('cca-private', new Map([['modules', { bytes: Buffer.from(JSON.stringify(MODULES)) }]]))
  })

  it('coordinators see totals by level, small groups hidden, names only for "named results" members', async () => {
    const n = await net(SUPER, 'POST', '', { name: 'Nigeria CSO Network', root: { level: 'national', name: 'Nigeria', geoCode: 'NG' } })
    const netId = n.body.id, root = n.body.rootId
    await net(SUPER, 'POST', `/${netId}/admins`, { nodeId: root, email: COORD })
    const lagos = (await net(COORD, 'POST', `/${netId}/nodes`, { parentId: root, level: 'subnational', name: 'Lagos', geoCode: 'NG-LA' })).body.id
    const kano = (await net(COORD, 'POST', `/${netId}/nodes`, { parentId: root, level: 'subnational', name: 'Kano', geoCode: 'NG-KN' })).body.id
    for (const [i, o] of ORGS.entries()) {
      await net(COORD, 'POST', `/${netId}/invitations`, { nodeId: i < 5 ? lagos : kano, org: o.id })
      const inv = (await net(o.email, 'GET')).body.memberships[0]
      assert.equal((await net(o.email, 'POST', `/members/${inv.id}`, { action: 'accept', sharing: i === 0 ? 'full' : 'aggregate' })).status, 200)
    }
    // Each organisation completed a community assessment; org 1 reached level 3 in every domain, the others level 2.
    for (const [i, o] of ORGS.entries()) {
      const resp = Object.fromEntries(['g1', 'g2', 'g3'].flatMap((d) => (i === 0 ? [`${d}.2`, `${d}.3`] : [`${d}.2`]).map((k) => [k, seen])))
      await rows(`INSERT INTO cca_assessments(id,org_id,module,year,status,responses,created_by,completed_at) VALUES($1,$2,'community',2026,'complete',$3,$4,now())`, [`cca_${i}`, o.id, JSON.stringify(resp), o.email])
    }
    // A draft and a grant-stage assessment never count.
    await rows(`INSERT INTO cca_assessments(id,org_id,module,year,status,responses,created_by) VALUES('cca_draft',$1,'community',2027,'draft','{}',$2)`, [ORGS[1].id, ORGS[1].email])

    const r = await feed(COORD, `?nodeId=${root}&module=community`)
    assert.equal(r.status, 200, r.text)
    assert.deepEqual([r.body.overall.members, r.body.overall.withResults, r.body.overall.shown], [6, 6, true])
    const byName = Object.fromEntries(r.body.children.map((c: any) => [c.name, c]))
    assert.deepEqual([byName.Lagos.shown, byName.Lagos.areas[0].percent], [true, 55], 'Lagos: (3+2+2+2+2)/5 = 2.2 = 55%')
    assert.deepEqual([byName.Kano.withResults, byName.Kano.shown, byName.Kano.areas], [1, false, null], 'one member, totals only: hidden')
    assert.deepEqual(r.body.named.map((x: any) => [x.name, x.percent]), [['Member Org 1', 75]])

    // Members who are not coordinators, and strangers, see nothing; an unknown module is refused.
    assert.equal((await feed(ORGS[0].email, `?nodeId=${root}`)).status, 404)
    assert.equal((await feed(null, `?nodeId=${root}`)).status, 401)
    assert.equal((await feed(COORD, `?nodeId=${root}&module=pre_award`)).status, 404)
  })
})
