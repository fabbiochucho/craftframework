import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'
import { instrumentById } from '../../src/lib/networkRounds.ts'

const networksApi = (await import(new URL('../../netlify/functions/networks.mts', import.meta.url).href)).default
const roundsApi = (await import(new URL('../../netlify/functions/network-rounds.mts', import.meta.url).href)).default
const resultsApi = (await import(new URL('../../netlify/functions/network-results.mts', import.meta.url).href)).default
const exchangesApi = (await import(new URL('../../netlify/functions/network-exchanges.mts', import.meta.url).href)).default

const SUPER = 'fabbiochucho@gmail.com'
const COORD = 'coord@ngnetwork.example'
const HEALTH = instrumentById('craft-health')!
const D0 = HEALTH.dimensions[0].key
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
const exch = (e: string | null, m: string, p = '', b?: unknown) => call(exchangesApi, '/api/network-exchanges', e, m, p, b)
const day = (offset: number) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10)

async function answer(orgId: string, v: (dim: string) => number) {
  await rows(`DELETE FROM responses WHERE org_id=$1`, [orgId])
  for (const ind of HEALTH.indicators) await rows(`INSERT INTO responses(org_id, question_id, score) VALUES($1,$2,$3)`, [orgId, ind.id, v(ind.dimension)])
}

describe('network exchange log, plan, progress and export', () => {
  beforeEach(async () => {
    await truncateAll()
    for (const o of ORGS) await rows(`INSERT INTO organizations(id,name,country) VALUES($1,$2,'Nigeria')`, [o.id, o.name])
  })

  it('logs exchanges privately, builds a plan, tracks progress between rounds and exports aggregates', async () => {
    const n = await net(SUPER, 'POST', '', { name: 'Nigeria CSO Network', root: { level: 'national', name: 'Nigeria', geoCode: 'NG' } })
    const netId = n.body.id, root = n.body.rootId
    await net(SUPER, 'POST', `/${netId}/admins`, { nodeId: root, email: COORD })
    for (const [i, o] of ORGS.entries()) {
      await net(COORD, 'POST', `/${netId}/invitations`, { nodeId: root, org: o.id })
      const inv = (await net(o.email, 'GET')).body.memberships[0]
      await net(o.email, 'POST', `/members/${inv.id}`, { action: 'accept', sharing: i < 2 ? 'full' : 'aggregate' })
    }

    // Baseline: everyone weak in the first area; org 1 strong overall
    const r1 = (await rounds(COORD, 'POST', '', { networkId: netId, nodeId: root, name: 'Baseline', instrument: 'craft-health', opensOn: day(-30), closesOn: day(10) })).body.id
    for (const [i, o] of ORGS.entries()) {
      await answer(o.id, (dim) => (dim === D0 ? (i === 0 ? 5 : 1) : 3))
      assert.equal((await rounds(o.email, 'POST', `/${r1}/submit`, { orgId: o.id })).status, 200)
    }

    // Exchange: coordinator logs it with the named member; totals-only members add themselves
    assert.equal((await exch(COORD, 'POST', '', { networkId: netId, nodeId: root, type: 'study-tour', title: 'Lagos governance study tour', heldOn: day(-5), instrument: 'craft-health', areas: ['nope'], orgIds: [] })).status, 400)
    assert.equal((await exch(COORD, 'POST', '', { networkId: netId, nodeId: root, type: 'study-tour', title: 'Lagos governance study tour', heldOn: day(-5), instrument: 'craft-health', areas: [D0], orgIds: ['self_stranger'] })).status, 400)
    const ex = await exch(COORD, 'POST', '', { networkId: netId, nodeId: root, type: 'study-tour', title: 'Lagos governance study tour', heldOn: day(-5), instrument: 'craft-health', areas: [D0], orgIds: [ORGS[1].id], people: 12 })
    assert.equal(ex.status, 201, ex.text)
    assert.equal((await exch(ORGS[0].email, 'POST', '', { networkId: netId, nodeId: root, type: 'mentoring', title: 'Mentoring pair', heldOn: day(0), instrument: 'craft-health' })).status, 403)
    for (const o of ORGS.slice(2, 6)) assert.equal((await exch(o.email, 'POST', `/${ex.body.id}/attend`, { orgId: o.id })).status, 200)
    assert.equal((await exch(ORGS[2].email, 'POST', `/${ex.body.id}/attend`, { orgId: ORGS[3].id })).status, 403, 'only for your own organisation')
    const list = await exch(COORD, 'GET', `?networkId=${netId}`)
    assert.equal(list.body.exchanges[0].organisations, 5)
    assert.deepEqual(list.body.exchanges[0].named, ['Member Org 2'], 'totals-only participants are counted, not named')

    // Plan: the first area is the gap for five of six; pairing only among named-results members
    const plan = await results(COORD, `/${r1}/plan`)
    assert.equal(plan.status, 200, plan.text)
    const gap = plan.body.plan.find((a: any) => a.key === D0)
    assert.equal(gap.membersBelow, 5)
    assert.equal(gap.exchangesHeld, 1)
    const pair = plan.body.pairings.find((p: any) => p.key === D0)
    assert.deepEqual(pair.pairs.map((p: any) => [p.learner.name, p.mentor.name]), [['Member Org 2', 'Member Org 1']])

    // Second round: the five study-tour members improve in the first area
    await rows(`UPDATE network_rounds SET closed_at = now() WHERE id=$1`, [r1])
    const r2 = (await rounds(COORD, 'POST', '', { networkId: netId, nodeId: root, name: 'Midline', instrument: 'craft-health', opensOn: day(0), closesOn: day(30) })).body.id
    for (const [i, o] of ORGS.entries()) {
      await answer(o.id, (dim) => (dim === D0 ? (i === 0 ? 5 : 3) : 3))
      assert.equal((await rounds(o.email, 'POST', `/${r2}/submit`, { orgId: o.id })).status, 200)
    }
    const prog = await results(COORD, `/${r2}/progress`)
    assert.equal(prog.status, 200, prog.text)
    assert.equal(prog.body.baseline.name, 'Baseline')
    assert.equal(prog.body.progress.cohort, 6)
    assert.equal(prog.body.progress.areas.find((a: any) => a.key === D0).medianChange, 2)
    const contrib = prog.body.contribution.find((c: any) => c.key === D0)
    assert.equal(contrib.shown, false, 'one non-participant: comparison withheld')

    // Export: aggregates, named rows only for named-results members, formula-safe
    const csv = await results(COORD, `/${r2}/export.csv`)
    assert.equal(csv.status, 200)
    assert.match(csv.text, /^Level,Level type,Area,Members submitted,Median/)
    assert.ok(csv.text.includes('Member Org 1') && csv.text.includes('Member Org 2'))
    for (const o of ORGS.slice(2)) assert.ok(!csv.text.includes(o.name), `${o.name} not in export`)

    // Members cannot reach coordinator outputs
    assert.equal((await results(ORGS[3].email, `/${r2}/export.csv`)).body.role, 'member')
  })
})
