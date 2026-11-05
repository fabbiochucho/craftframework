import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const api = (await import(new URL('../../netlify/functions/desk-review.mts', import.meta.url).href)).default

const ALICE = 'alice@org-a.example' // admin of org_a
const CAROL = 'carol@org-a.example' // a second member of org_a
const BOB = 'bob@org-b.example' // admin of org_b

async function call(email: string | null, method: string, path = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email, name: email } : null
  const res: Response = await api(new Request(`http://localhost/api/desk-review${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  const text = await res.text()
  let parsed: any = null
  try { parsed = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: parsed }
}

describe('desk review API', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country,archetype,sector) VALUES('org_a','Youth Network','Nigeria','Civil Society','Network'),('org_b','Hidden Trust','Kenya','Civil Society','NGO')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('c','${CAROL}','org_a','admin'),('b','${BOB}','org_b','admin')`)
  })

  it('records documents, gaps and reviews with separation of duties, plus a fieldwork log', async () => {
    const put = (who: string, id: string, body: object) => call(who, 'PUT', `/items/${id}`, { orgId: 'org_a', ...body })
    assert.equal((await put(BOB, 'NET-01', { status: 'uploaded', evidenceRef: 'x' })).status, 403, 'other organisations are refused')
    assert.equal((await put(ALICE, 'NOPE-1', { status: 'uploaded', evidenceRef: 'x' })).status, 404)
    assert.equal((await put(ALICE, 'NET-01', { status: 'uploaded' })).status, 400, 'say where the document is')
    assert.equal((await put(ALICE, 'NET-01', { status: 'uploaded', evidenceRef: 'https://drive.example/membership', approvedOn: '2026-10-20', evidenceOfUse: 'Applied in the 2026 membership drive', custodian: 'Programme officer', dueDate: '2026-11-20' })).status, 200)
    assert.equal((await put(ALICE, 'NET-01', { status: 'verified' })).status, 403, 'cannot verify own document')
    assert.equal((await put(CAROL, 'NET-01', { status: 'flagged' })).status, 400, 'flagging needs a note')
    assert.equal((await put(CAROL, 'NET-01', { status: 'flagged', assessorNote: 'Approved after the review was announced; show earlier use.' })).status, 200)

    assert.equal((await put(ALICE, 'NET-03', { status: 'not_available', notAvailableReason: '' })).status, 400, 'a reason is required')
    assert.equal((await put(ALICE, 'NET-03', { status: 'not_available', notAvailableReason: 'Chapters coordinate informally; no written guidelines yet.' })).status, 200)
    assert.equal((await put(CAROL, 'NET-03', { status: 'verified' })).status, 409, 'nothing to review for a document that does not exist')

    assert.equal((await call(ALICE, 'POST', '/fieldwork', { orgId: 'org_a', kind: 'interview', heldOn: '2026-11-05', people: 'National coordinator', requirementId: 'NET-03', summary: 'Confirmed chapters meet quarterly by phone.' })).status, 201)
    assert.equal((await call(ALICE, 'POST', '/fieldwork', { orgId: 'org_a', kind: 'chat', heldOn: '2026-11-05', summary: 'x x x' })).status, 400)

    const got = (await call(ALICE, 'GET', '?orgId=org_a')).body
    assert.deepEqual([got.profile.archetype, got.profile.sector], ['Civil Society', 'Network'])
    const by = Object.fromEntries(got.items.map((i: any) => [i.requirementId, i]))
    assert.deepEqual([by['NET-01'].status, by['NET-01'].verifiedBy, by['NET-01'].custodian, by['NET-01'].approvedOn], ['flagged', CAROL, 'Programme officer', '2026-10-20'])
    assert.deepEqual([by['NET-03'].status, by['NET-03'].providedBy], ['not_available', ALICE])
    assert.equal(got.fieldwork.length, 1)
    assert.equal((await call(BOB, 'GET', '?orgId=org_a')).status, 403)
    const audit = (await rows(`SELECT action FROM audit_logs WHERE org_id='org_a' ORDER BY id`)).map((a) => a.action)
    assert.ok(audit.includes('Desk review: NET-01 set to flagged') && audit.some((a) => a.startsWith('Fieldwork recorded (interview')))
  })
})
