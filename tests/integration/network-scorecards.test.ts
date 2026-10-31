import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { truncateAll } from './harness.ts'
import { allItemIds, templateById } from '../../src/lib/programmeScorecard.ts'

const networksApi = (await import(new URL('../../netlify/functions/networks.mts', import.meta.url).href)).default
const scorecardsApi = (await import(new URL('../../netlify/functions/network-scorecards.mts', import.meta.url).href)).default

const SUPER = 'fabbiochucho@gmail.com'
const NATIONAL = 'national@saca.example'
const LAGOS = 'lagos@saca.example'
const T = templateById('hiv-prevention-subnational')!
const FULL = Object.fromEntries(allItemIds(T).map((id) => [id, 2]))

async function call(api: any, base: string, email: string | null, method: string, path = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await api(new Request(`http://localhost${base}${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}
const net = (e: string | null, m: string, p = '', b?: unknown) => call(networksApi, '/api/networks', e, m, p, b)
const sc = (e: string | null, m: string, p = '', b?: unknown) => call(scorecardsApi, '/api/network-scorecards', e, m, p, b)
const day = (offset: number) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10)

describe('programme response scorecards', () => {
  beforeEach(async () => { await truncateAll() })

  it('units self-assess; the national level sees NACA-style summaries and change since the last scorecard', async () => {
    const n = await net(SUPER, 'POST', '', { name: 'Nigeria HIV prevention response', root: { level: 'national', name: 'Nigeria', geoCode: 'NG' } })
    const netId = n.body.id, root = n.body.rootId
    await net(SUPER, 'POST', `/${netId}/admins`, { nodeId: root, email: NATIONAL })
    const sw = (await net(NATIONAL, 'POST', `/${netId}/nodes`, { parentId: root, level: 'zonal', name: 'South West' })).body.id
    const nw = (await net(NATIONAL, 'POST', `/${netId}/nodes`, { parentId: root, level: 'zonal', name: 'North West' })).body.id
    const lagos = (await net(NATIONAL, 'POST', `/${netId}/nodes`, { parentId: sw, level: 'subnational', name: 'Lagos', geoCode: 'NG-LA' })).body.id
    const oyo = (await net(NATIONAL, 'POST', `/${netId}/nodes`, { parentId: sw, level: 'subnational', name: 'Oyo', geoCode: 'NG-OY' })).body.id
    const kano = (await net(NATIONAL, 'POST', `/${netId}/nodes`, { parentId: nw, level: 'subnational', name: 'Kano', geoCode: 'NG-KN' })).body.id
    await net(NATIONAL, 'POST', `/${netId}/admins`, { nodeId: lagos, email: LAGOS })

    assert.equal((await sc(LAGOS, 'POST', '', { networkId: netId, nodeId: root, unitLevel: 'subnational', template: T.id, name: 'PSAT 2026', opensOn: day(-1), closesOn: day(20) })).status, 403)
    assert.equal((await sc(NATIONAL, 'POST', '', { networkId: netId, nodeId: root, unitLevel: 'local', template: T.id, name: 'PSAT 2026', opensOn: day(-1), closesOn: day(20) })).status, 400, 'no local levels yet')
    const prev = (await sc(NATIONAL, 'POST', '', { networkId: netId, nodeId: root, unitLevel: 'subnational', template: T.id, name: 'PSAT 2025', opensOn: day(-40), closesOn: day(-2) })).body.id
    const cur = await sc(NATIONAL, 'POST', '', { networkId: netId, nodeId: root, unitLevel: 'subnational', template: T.id, name: 'PSAT 2026', opensOn: day(-1), closesOn: day(20) })
    assert.equal(cur.status, 201, cur.text)

    // Closed scorecards refuse entries
    assert.equal((await sc(NATIONAL, 'POST', `/${prev}/entries`, { nodeId: kano, scores: {} })).status, 409)

    // Lagos enters its own; can't enter for Kano; bad scores refused
    assert.equal((await sc(LAGOS, 'POST', `/${cur.body.id}/entries`, { nodeId: kano, scores: FULL })).status, 403)
    assert.equal((await sc(LAGOS, 'POST', `/${cur.body.id}/entries`, { nodeId: lagos, scores: { 'agyw.m1': 5 } })).status, 400)
    assert.equal((await sc(LAGOS, 'POST', `/${cur.body.id}/entries`, { nodeId: lagos, scores: FULL })).status, 200)
    assert.equal((await sc(NATIONAL, 'POST', `/${cur.body.id}/entries`, { nodeId: oyo, scores: {} })).status, 200)
    assert.equal((await sc(NATIONAL, 'POST', `/${cur.body.id}/entries`, { nodeId: kano, scores: { 'agyw.m1': 2, 'agyw.m2': 2, 'agyw.m3': 1 } })).status, 200)

    // Lagos sees only its own unit
    const mine = await sc(LAGOS, 'GET', `/${cur.body.id}`)
    assert.equal(mine.status, 200, mine.text)
    assert.equal(mine.body.overseeing, false)
    assert.deepEqual(mine.body.mine.map((u: any) => u.name), ['Lagos'])
    assert.ok(!('summaries' in mine.body))

    // National: counts per band, by zone, and lists, per area and component
    const all = await sc(NATIONAL, 'GET', `/${cur.body.id}`)
    const agywMgmt = all.body.summaries.find((s: any) => s.area === 'agyw').components.find((c: any) => c.component === 'management')
    assert.deepEqual(agywMgmt.counts, { immediate: 1, attention: 1, good: 1 })
    assert.deepEqual(agywMgmt.lists, { immediate: ['Oyo'], attention: ['Kano'], good: ['Lagos'] })
    assert.deepEqual(agywMgmt.byGroup.map((g: any) => g.group), ['North West', 'South West'])
    assert.equal(all.body.change.previous, 'PSAT 2025')
    assert.equal(all.body.capacityByUnit.length, 3)
    assert.equal((await sc('eve@elsewhere.example', 'GET', `/${cur.body.id}`)).status, 404)
  })
})
