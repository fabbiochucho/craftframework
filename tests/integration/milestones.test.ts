import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const api = (await import(new URL('../../netlify/functions/milestones.mts', import.meta.url).href)).default

const ALICE = 'alice@org-a.example' // org_a member who builds the pack
const CAROL = 'carol@org-a.example' // org_a member who approves it
const FUNDER = 'grants@funder.example'
const BOB = 'bob@org-b.example'

async function call(email: string | null, method: string, path = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email, name: email } : null
  const res: Response = await api(new Request(`http://localhost/api/milestones${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  const text = await res.text()
  let parsed: any = null
  try { parsed = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: parsed }
}

describe('milestone register API', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country) VALUES('org_a','Riverbend','Kenya'),('org_b','Hidden Trust','Kenya')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('c','${CAROL}','org_a','admin'),('b','${BOB}','org_b','admin')`)
    await rows(`INSERT INTO awards(id,org_id,title,funder_email,created_by) VALUES('aw_1','org_a','Clinic grant','${FUNDER}','${ALICE}')`)
  })

  it('builds a pack, approves it with separation of duties, submits it, and lets only the funder decide', async () => {
    assert.equal((await call(BOB, 'POST', '', { awardId: 'aw_1', title: 'Clinic opened' })).status, 403)
    const id = (await call(ALICE, 'POST', '', { awardId: 'aw_1', title: 'Clinic opened', owner: 'Programme lead', indicator: 'Clinics operating', baseline: '0', target: '3', dueDate: '2026-12-01' })).body.id
    assert.equal((await call(CAROL, 'POST', `/${id}/approve`)).status, 409, 'incomplete: no means of verification, no evidence')
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { verificationMeans: 'Licence and first-month register' })).status, 200)
    assert.equal((await call(ALICE, 'POST', `/${id}/evidence`, { description: 'Operating licence', ref: 'https://drive.example/licence' })).status, 201)
    assert.equal((await call(ALICE, 'POST', `/${id}/approve`)).status, 403, 'the person who added the evidence cannot approve')
    assert.equal((await call(ALICE, 'POST', `/${id}/submit`)).status, 409, 'approve first')
    assert.equal((await call(CAROL, 'POST', `/${id}/approve`)).status, 200)
    assert.equal((await call(ALICE, 'POST', `/${id}/evidence`, { description: 'Late item', ref: 'x x x' })).status, 409, 'pack closed once approved')
    assert.equal((await call(ALICE, 'POST', `/${id}/submit`)).status, 200)

    assert.equal((await call(ALICE, 'POST', `/${id}/decide`, { accept: true, note: '' })).status, 403, 'only the funder decides')
    assert.equal((await call(FUNDER, 'POST', `/${id}/decide`, { accept: false, note: '' })).status, 400, 'returning needs a reason')
    assert.equal((await call(FUNDER, 'POST', `/${id}/decide`, { accept: false, note: 'Register covers two weeks, not a month.' })).status, 200)
    assert.equal((await call(ALICE, 'POST', `/${id}/evidence`, { description: 'Full month register', ref: 'https://drive.example/register' })).status, 201, 'returned: pack reopens')
    assert.equal((await call(CAROL, 'POST', `/${id}/approve`)).status, 200)
    assert.equal((await call(ALICE, 'POST', `/${id}/submit`)).status, 200)
    assert.equal((await call(FUNDER, 'POST', `/${id}/decide`, { accept: true, note: 'Verified.' })).status, 200)

    const view = (await call(FUNDER, 'GET', '?awardId=aw_1')).body
    assert.deepEqual([view.milestones[0].status, view.milestones[0].approvedBy, view.evidence.length], ['accepted', CAROL, 2])
    assert.equal((await call(BOB, 'GET', '?awardId=aw_1')).status, 403)
    const audit = (await rows(`SELECT action FROM audit_logs WHERE org_id='org_a' ORDER BY id`)).map((a) => a.action)
    assert.ok(audit.includes('Milestone returned by funder: Clinic opened') && audit.includes('Milestone accepted by funder: Clinic opened'))
  })
})
