import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'
import { instrumentById } from '../../src/lib/networkRounds.ts'

const networksApi = (await import(new URL('../../netlify/functions/networks.mts', import.meta.url).href)).default
const roundsApi = (await import(new URL('../../netlify/functions/network-rounds.mts', import.meta.url).href)).default
const resultsApi = (await import(new URL('../../netlify/functions/network-results.mts', import.meta.url).href)).default

const SUPER = 'fabbiochucho@gmail.com'
const COORD = 'coord@ngnetwork.example'
const HEALTH = instrumentById('craft-health')!
// Six member organisations: five in Lagos, one in Kano. Org 1 shares named results; the rest totals only.
const ORGS = [1, 2, 3, 4, 5, 6].map((i) => ({ email: `lead${i}@member${i}.example`, id: `self_lead${i}_member${i}_example`, name: `Member Org ${i}` }))

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
const rounds = (e: string | null, m: string, p = '', b?: unknown) => call(roundsApi, '/api/network-rounds', e, m, p, b)
const results = (e: string | null, p: string) => call(resultsApi, '/api/network-results', e, 'GET', p)
const day = (offset: number) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10)

describe('network results: scorecard, suppression and privacy', () => {
  beforeEach(async () => {
    await truncateAll()
    for (const o of ORGS) await rows(`INSERT INTO organizations(id,name,country) VALUES($1,$2,'Nigeria')`, [o.id, o.name])
  })

  it('coordinators get spreads and a heatmap, names only for "named results" members; members get only their benchmark', async () => {
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
    const roundId = (await rounds(COORD, 'POST', '', { networkId: netId, nodeId: root, name: 'Baseline', instrument: 'craft-health', opensOn: day(-1), closesOn: day(10) })).body.id

    // Each organisation answers at a different level and submits; four answer the value survey (below the threshold)
    for (const [i, o] of ORGS.entries()) {
      for (const ind of HEALTH.indicators) await rows(`INSERT INTO responses(org_id, question_id, score) VALUES($1,$2,$3)`, [o.id, ind.id, Math.min(5, i)])
      assert.equal((await rounds(o.email, 'POST', `/${roundId}/submit`, { orgId: o.id })).status, 200)
      if (i < 4) assert.equal((await rounds(o.email, 'POST', `/${roundId}/value`, { orgId: o.id, answers: { used: { training: 5, exchange: 4 }, recommend: 9 } })).status, 200)
    }
    assert.equal((await rounds(ORGS[0].email, 'POST', `/${roundId}/value`, { orgId: ORGS[0].id, answers: { used: { training: 9 }, recommend: 9 } })).status, 400)

    // Coordinator at national level
    const r = await results(COORD, `/${roundId}`)
    assert.equal(r.status, 200, r.text)
    assert.equal(r.body.capacity.n, 6)
    assert.equal(r.body.capacity.suppressed, false)
    assert.equal(r.body.capacity.composite.median, 2.5)
    assert.equal(r.body.value.suppressed, true, 'four survey answers are not enough to show')
    assert.deepEqual(r.body.heatmap.columns.map((c: any) => [c.name, c.n, c.shown]), [['Lagos', 5, true], ['Kano', 1, false]])
    assert.ok(r.body.heatmap.rows.every((row: any) => row.cells[1] === null), 'Kano (one member) never shown')
    assert.deepEqual(r.body.named.map((x: any) => x.name), ['Member Org 1'], 'only the member who chose named results is named')
    for (const o of ORGS.slice(1)) assert.ok(!r.text.includes(o.name), `${o.name} (totals only) never named`)
    assert.equal(r.body.use.find((u: any) => u.key === 'submitted').count, 6)
    assert.equal(r.body.scorecard.length, 3)

    // Drilling into Kano: one member, everything withheld
    const k = await results(COORD, `/${roundId}?nodeId=${kano}`)
    assert.equal(k.body.capacity.suppressed, true)
    assert.equal(k.body.capacity.composite, null)

    // A member sees only its own benchmark against the round group
    const me = await results(ORGS[2].email, `/${roundId}`)
    assert.equal(me.status, 200, me.text)
    assert.equal(me.body.role, 'member')
    assert.equal(me.body.mine.length, 1)
    assert.equal(me.body.mine[0].orgId, ORGS[2].id)
    assert.ok(me.body.mine[0].benchmark.every((d: any) => d.position === 'within'))
    assert.ok(!me.text.includes('Member Org 1') && !('named' in me.body), 'members never see others')

    // Kano's only member switches to named results: its column is now shown
    const kanoMember = (await net(ORGS[5].email, 'GET')).body.memberships[0]
    assert.equal((await net(ORGS[5].email, 'POST', `/members/${kanoMember.id}`, { action: 'sharing', sharing: 'full' })).status, 200)
    const k2 = await results(COORD, `/${roundId}?nodeId=${kano}`)
    assert.equal(k2.body.capacity.suppressed, false, 'a one-member group is shown when its member chose named results')

    // Strangers see nothing; a node outside the round is refused
    assert.equal((await results('eve@elsewhere.example', `/${roundId}`)).status, 404)
    const audit = await rows(`SELECT action FROM audit_logs WHERE action LIKE 'Viewed named network results%'`)
    assert.ok(audit.length >= 1, 'viewing named results is audit-logged')
  })
})
