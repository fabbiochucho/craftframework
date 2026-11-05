import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { blobStores, rows, truncateAll } from './harness.ts'

const api = (await import(new URL('../../netlify/functions/cca-screen.mts', import.meta.url).href)).default

const ALICE = 'alice@org-a.example' // admin of org_a
const BOB = 'bob@org-b.example' // admin of org_b

async function call(email: string | null, method: string, path = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email, name: email } : null
  const res: Response = await api(new Request(`http://localhost/api/cca-screen${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  const text = await res.text()
  let parsed: any = null
  try { parsed = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: parsed }
}

// Placeholder questions with the real structure (the real ones are private).
const SCREEN = { name: 'Quick screen', sections: [
  { id: 'pol', name: 'Policies', questions: [1, 2, 3, 4, 5, 6].map((i) => ({ id: `p${i}`, kind: 'yes_no', text: `Policy ${i}` })) },
  { id: 'size', name: 'Size', questions: [{ id: 's1', kind: 'choice', text: 'Income', options: [{ value: 'lt', label: 'Small', points: 1 }, { value: 'gt', label: 'Large', points: 4 }] }] },
] }

describe('quick pre-award screen API', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country) VALUES('org_a','Riverbend','Kenya'),('org_b','Hidden Trust','Kenya')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
  })

  it('screens an applicant: start, answer, complete with a kept outcome; other organisations are refused', async () => {
    assert.equal((await call(ALICE, 'GET', '/content')).status, 503, 'not published yet')
    blobStores().set('cca-private', new Map([['screen', { bytes: Buffer.from(JSON.stringify(SCREEN)) }]]))
    assert.equal((await call(null, 'GET', '/content')).status, 401)
    assert.equal((await call(ALICE, 'GET', '/content')).body.screen.sections.length, 2)

    assert.equal((await call(BOB, 'POST', '', { orgId: 'org_a', awardRef: 'aw_1' })).status, 403)
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a' })).status, 400, 'names the award')
    const id = (await call(ALICE, 'POST', '', { orgId: 'org_a', awardRef: 'aw_1' })).body.id
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a', awardRef: 'aw_1' })).status, 409, 'one per award')

    assert.equal((await call(ALICE, 'PUT', `/${id}`, { answers: { p1: 'maybe' } })).status, 400, 'answers must fit the question')
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { answers: { zz: 'yes' } })).status, 400, 'unknown question')
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { answers: { p1: 'yes', p2: 'yes', p3: 'yes', p4: 'yes' } })).status, 200)
    assert.equal((await call(ALICE, 'POST', `/${id}/complete`)).status, 400, 'every question answered first')
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { answers: { p5: 'no', p6: 'yes', s1: 'gt' }, notes: 'Board chair interviewed' })).status, 200)
    assert.equal((await call(BOB, 'POST', `/${id}/complete`)).status, 403)
    const done = await call(ALICE, 'POST', `/${id}/complete`)
    assert.deepEqual([done.status, done.body.result.score, done.body.result.max, done.body.result.outcome], [200, 9, 10, 'minimal_support'])
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { answers: { p5: 'yes' } })).status, 409, 'complete is final')

    const [saved] = (await call(ALICE, 'GET', '?orgId=org_a')).body.screens
    assert.deepEqual([saved.status, saved.score, saved.maxScore, saved.outcome, saved.notes], ['complete', 9, 10, 'minimal_support', 'Board chair interviewed'])
    assert.equal((await call(BOB, 'GET', '?orgId=org_a')).status, 403)
    const audit = (await rows(`SELECT action FROM audit_logs WHERE org_id='org_a' ORDER BY id`)).map((a) => a.action)
    assert.deepEqual(audit, ['Started quick pre-award screen (aw_1)', 'Completed quick pre-award screen (aw_1): 90%, Eligible, with minimal support'])
  })
})
