import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'
import { instrumentById } from '../../src/lib/networkRounds.ts'

const networksApi = (await import(new URL('../../netlify/functions/networks.mts', import.meta.url).href)).default
const roundsApi = (await import(new URL('../../netlify/functions/network-rounds.mts', import.meta.url).href)).default

const SUPER = 'fabbiochucho@gmail.com'
const COORD = 'coord@ngnetwork.example'
const ADA = 'ada@riverbend.example'
const BEN = 'ben@kanotrust.example'
const ADA_ORG = 'self_ada_riverbend_example'
const BEN_ORG = 'self_ben_kanotrust_example'
const HEALTH = instrumentById('craft-health')!
const IDS = HEALTH.indicators.map((i) => i.id)

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
const net = (email: string | null, method: string, path = '', body?: unknown) => call(networksApi, '/api/networks', email, method, path, body)
const rounds = (email: string | null, method: string, path = '', body?: unknown) => call(roundsApi, '/api/network-rounds', email, method, path, body)
const day = (offset: number) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10)

/** Nigeria network with Ada and Ben as accepted members, Nigeria coordinator COORD. */
async function setup() {
  const n = await net(SUPER, 'POST', '', { name: 'Nigeria CSO Network', root: { level: 'national', name: 'Nigeria', geoCode: 'NG' } })
  const id = n.body.id, root = n.body.rootId
  await net(SUPER, 'POST', `/${id}/admins`, { nodeId: root, email: COORD })
  const lagos = (await net(COORD, 'POST', `/${id}/nodes`, { parentId: root, level: 'subnational', name: 'Lagos', geoCode: 'NG-LA' })).body.id
  await net(COORD, 'POST', `/${id}/invitations`, { nodeId: lagos, org: ADA_ORG })
  await net(COORD, 'POST', `/${id}/invitations`, { nodeId: root, org: BEN_ORG })
  for (const who of [ADA, BEN]) {
    const inv = (await net(who, 'GET')).body.memberships[0]
    assert.equal((await net(who, 'POST', `/members/${inv.id}`, { action: 'accept' })).status, 200)
  }
  return { id, root, lagos }
}

describe('network rounds: submission snapshots, perspectives, participation', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country,email) VALUES($1,'Riverbend Cooperative','Nigeria','ada@riverbend.example'),($2,'Kano Women Trust','Nigeria','')`, [ADA_ORG, BEN_ORG])
  })

  it('a coordinator opens a round; members submit a frozen snapshot of the instrument only', async () => {
    const t = await setup()
    assert.equal((await rounds(ADA, 'POST', '', { networkId: t.id, nodeId: t.root, name: 'Baseline', instrument: 'craft-health', opensOn: day(-1), closesOn: day(30) })).status, 403, 'members cannot open rounds')
    assert.equal((await rounds(COORD, 'POST', '', { networkId: t.id, nodeId: t.root, name: 'Baseline', instrument: 'nope', opensOn: day(-1), closesOn: day(30) })).status, 400)
    const r = await rounds(COORD, 'POST', '', { networkId: t.id, nodeId: t.root, name: 'Baseline 2026', instrument: 'craft-health', opensOn: day(-1), closesOn: day(30), perspectives: true })
    assert.equal(r.status, 201, r.text)
    const roundId = r.body.id

    // Nothing answered: can't submit
    assert.equal((await rounds(ADA, 'POST', `/${roundId}/submit`, { orgId: ADA_ORG })).status, 409)
    await rows(`INSERT INTO responses(org_id, question_id, score) VALUES($1,$2,3),($1,$3,4),($1,'Q-NOT-IN-INSTRUMENT',5)`, [ADA_ORG, IDS[0], IDS[1]])
    assert.equal((await rounds(BEN, 'POST', `/${roundId}/submit`, { orgId: ADA_ORG })).status, 403, 'only the organisation submits')
    const s = await rounds(ADA, 'POST', `/${roundId}/submit`, { orgId: ADA_ORG })
    assert.equal(s.status, 200, s.text)
    const [saved] = await rows(`SELECT scores FROM network_round_submissions WHERE round_id=$1`, [roundId])
    assert.deepEqual(saved.scores, { [IDS[0]]: 3, [IDS[1]]: 4 }, 'only the instrument\'s indicators are frozen')

    // Perspectives: per domain, whole numbers 0-5; gaps come back to the member
    const d0 = HEALTH.dimensions[0].key
    assert.equal((await rounds(ADA, 'POST', `/${roundId}/perspectives`, { orgId: ADA_ORG, perspective: 'board', scores: { [d0]: 7 } })).status, 400)
    assert.equal((await rounds(ADA, 'POST', `/${roundId}/perspectives`, { orgId: ADA_ORG, perspective: 'board', scores: { [d0]: 5 } })).status, 200)
    assert.equal((await rounds(ADA, 'POST', `/${roundId}/perspectives`, { orgId: ADA_ORG, perspective: 'staff', scores: { [d0]: 2 } })).status, 200)
    const mine = await rounds(ADA, 'GET', `/${roundId}`)
    assert.equal(mine.status, 200, mine.text)
    assert.equal(mine.body.participation, null, 'members do not see participation')
    const gap = mine.body.mine[0].gaps.find((g: any) => g.dimension === d0)
    assert.equal(gap.spread, 3)
    assert.ok(gap.disagree)

    // Coordinator: counts only, per level, no names
    const c = await rounds(COORD, 'GET', `/${roundId}`)
    assert.deepEqual(c.body.participation.total, { total: 2, submitted: 1, inProgress: 0, notStarted: 1, rate: 50 })
    assert.equal(c.body.participation.byNode.find((n: any) => n.name === 'Lagos').submitted, 1)
    assert.ok(!c.text.includes('Kano Women Trust') && !c.text.includes('Riverbend'), 'no organisation names in coordinator participation')

    // Reminders: once a day, only while open
    const rem = await rounds(COORD, 'POST', `/${roundId}/remind`)
    assert.equal(rem.status, 200, rem.text)
    assert.equal(rem.body.waiting, 1)
    assert.equal((await rounds(COORD, 'POST', `/${roundId}/remind`)).status, 429)

    // Closing stops submissions
    assert.equal((await rounds(COORD, 'POST', `/${roundId}/close`)).status, 200)
    assert.equal((await rounds(ADA, 'POST', `/${roundId}/submit`, { orgId: ADA_ORG })).status, 409)
  })

  it('upcoming rounds refuse submissions; outsiders cannot see rounds', async () => {
    const t = await setup()
    const r = await rounds(COORD, 'POST', '', { networkId: t.id, nodeId: t.root, name: 'Midline', instrument: 'craft-health', opensOn: day(5), closesOn: day(30) })
    await rows(`INSERT INTO responses(org_id, question_id, score) VALUES($1,$2,3)`, [BEN_ORG, IDS[0]])
    const s = await rounds(BEN, 'POST', `/${r.body.id}/submit`, { orgId: BEN_ORG })
    assert.equal(s.status, 409)
    assert.match(s.body.error, /not opened/)
    assert.equal((await rounds('eve@elsewhere.example', 'GET', `/${r.body.id}`)).status, 404)
  })
})
