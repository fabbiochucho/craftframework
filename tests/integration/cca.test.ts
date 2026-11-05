import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { blobStores, rows, truncateAll } from './harness.ts'
import { dashboard } from '../../src/lib/cca/engine.ts'

const cca = (await import(new URL('../../netlify/functions/cca.mts', import.meta.url).href)).default

const ALICE = 'alice@org-a.example' // admin of org_a
const BOB = 'bob@org-b.example' // admin of org_b

async function call(email: string | null, method: string, path = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email, name: email } : null
  const res: Response = await cca(new Request(`http://localhost/api/cca${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  const text = await res.text()
  let parsed: any = null
  try { parsed = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: parsed }
}

const st = (id: string) => [{ id, text: `Statement ${id}` }]
const dom = (id: string, critical = false) => ({ id, name: id, level1: 'Nothing yet.', critical, levels: { 2: st(`${id}.2`), 3: st(`${id}.3`), 4: st(`${id}.4`) } })
const MODULES = [
  { id: 'community', name: 'Community', audience: 'CSOs', areas: [{ id: 'gov', name: 'Governance', domains: [dom('g1'), dom('g2'), dom('g3')] }] },
  { id: 'pre_award', name: 'Pre-Award', audience: 'Applicants', areas: [{ id: 'fin', name: 'Finance', domains: [dom('f1', true), dom('f2'), dom('f3')] }] },
]
const publish = () => blobStores().set('cca-private', new Map([['modules', { bytes: Buffer.from(JSON.stringify(MODULES)) }]]))
const ok = { met: true, evidence: 'Seen: signed minutes, 12 March' }

describe('CRAFT Capacity Assessment API', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country) VALUES('org_a','Riverbend','Kenya'),('org_b','Hidden Trust','Kenya')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
  })

  it('serves module content only to signed-in users, and says when it is not published', async () => {
    assert.equal((await call(null, 'GET', '/modules')).status, 401)
    assert.equal((await call(ALICE, 'GET', '/modules')).status, 503)
    publish()
    const r = await call(ALICE, 'GET', '/modules')
    assert.equal(r.status, 200)
    assert.deepEqual(r.body.modules.map((m: any) => m.id), ['community', 'pre_award'])
  })

  it('runs an assessment: start, save evidence, complete, then locked; other organisations are refused', async () => {
    publish()
    assert.equal((await call(BOB, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).status, 403)
    const created = await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })
    assert.equal(created.status, 201)
    const id = created.body.id
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).status, 409, 'one per module and year')
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'pre_award', year: 2026 })).status, 400, 'grant stages name the award')
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'pre_award', year: 2026, awardRef: 'Health grant 2026' })).status, 201)

    // Responses merge across saves.
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.2': ok }, assessor: 'Amina', orgLead: 'Musa' })).status, 200)
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.3': ok, 'g2.2': { met: true, evidence: '' } }, votes: { g1: [3, 3, 4] } })).status, 200)
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.2': { met: true, evidence: 'x'.repeat(1001) } } })).status, 400)
    assert.equal((await call(BOB, 'GET', `/${id}`)).status, 403)
    const got = (await call(ALICE, 'GET', `/${id}`)).body.assessment
    assert.deepEqual(Object.keys(got.responses).sort(), ['g1.2', 'g1.3', 'g2.2'])
    assert.deepEqual(got.votes.g1, [3, 3, 4])
    // The engine scores from the saved responses: g1 reaches 3; g2 stays at 1 (met without evidence does not count).
    const d = dashboard(MODULES[0] as any, got.responses)
    assert.deepEqual(d.areas[0].domains.map((x) => x.score), [3, 1, 1])

    // A domain can be left out with a reason, except in grant-stage modules.
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { notAssessed: { g3: '' } })).status, 400, 'needs a reason')
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { notAssessed: { g3: 'No volunteers this year' } })).status, 200)
    const pre = (await call(ALICE, 'GET', '?orgId=org_a')).body.assessments.find((a: any) => a.module === 'pre_award')
    assert.equal((await call(ALICE, 'PUT', `/${pre.id}`, { notAssessed: { g3: 'Not relevant' } })).status, 400, 'grant stages assess every domain')
    const saved = (await call(ALICE, 'GET', `/${id}`)).body.assessment
    assert.deepEqual(saved.notAssessed, { g3: 'No volunteers this year' })
    assert.deepEqual(dashboard(MODULES[0] as any, saved.responses, saved.notAssessed).areas[0].average, 2, 'g3 left out: (3 + 1) / 2')

    assert.equal((await call(ALICE, 'POST', `/${id}/complete`)).status, 200)
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { responses: { 'g2.2': ok } })).status, 409, 'complete is final')
    const list = (await call(ALICE, 'GET', '?orgId=org_a')).body.assessments
    assert.deepEqual(list.map((a: any) => [a.module, a.status]), [['community', 'complete'], ['pre_award', 'draft']])
    assert.equal((await call(BOB, 'GET', '?orgId=org_a')).status, 403)
    const audit = await rows(`SELECT action FROM audit_logs WHERE org_id='org_a' ORDER BY id`)
    assert.deepEqual(audit.map((a) => a.action.split(' (')[0]), ['Started capacity assessment', 'Started capacity assessment', 'Completed capacity assessment'])
  })
})
