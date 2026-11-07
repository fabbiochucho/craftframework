// Evidence requests inside an engagement: only the reviewing side asks, only the organisation links
// its own registry items and submits, the reviewer opens only what was submitted to its request,
// accepts or asks for more; emails at each step, audit log, and daily overdue reminders.
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { getStore } from '@netlify/blobs'
import { installFetchMock, rows, truncateAll } from './harness.ts'
import { encodeEvidence } from '../../netlify/lib/evidence-storage.ts'
import { sendEvidenceRequestReminders } from '../../netlify/lib/evidence-requests.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const directory = await load('directory')
const engagements = await load('engagements')
const requests = await load('evidence-requests')

const ALICE = 'alice@org-a.example' // organisation A admin, workspace assessor
const BOB = 'bob@org-b.example' // another organisation
const VAL = 'val@validators.example' // the engagement's validator
const STRANGER = 'eve@validators.example' // accredited, not on this engagement

async function call(email: string | null, method: string, path: string, body?: unknown, handler: any = requests) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const buf = Buffer.from(await res.arrayBuffer())
  let json: any = null
  try { json = JSON.parse(buf.toString('utf8')) } catch { /* not json */ }
  return { status: res.status, body: json, text: buf.toString('utf8'), bytes: buf, headers: res.headers }
}
const req = (email: string | null, method: string, path: string, body?: unknown) => call(email, method, `evidence-requests${path}`, body)
const eng = (email: string | null, method: string, path: string, body?: unknown) => call(email, method, `engagements${path}`, body, engagements)
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
const BYTES = Buffer.from('%PDF-1.4 audited accounts 2025')

let engId: string
let evA: number
let evOther: number

describe('evidence requests', () => {
  let mock: ReturnType<typeof installFetchMock>
  beforeEach(async () => {
    await truncateAll()
    process.env.RESEND_API_KEY = 'test-key'
    process.env.REMINDER_FROM_EMAIL = 'CRAFT <notices@mail.example.org>'
    mock = installFetchMock(() => new Response('{"id":"x"}', { status: 200 }))
    await rows(`INSERT INTO organizations(id,name,country,email) VALUES('org_a','Acme Cooperative','Kenya','finance@org-a.example'),('org_b','Beta Trust','Kenya','')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
    for (const [email, name] of [[VAL, 'Valerie Okafor'], [STRANGER, 'Eve Stranger']]) {
      await call(email, 'PUT', 'directory/me/validator', { name }, directory)
      await rows("UPDATE validator_profiles SET accreditation_status='accredited', accredited_until = now() + interval '1 year' WHERE email=$1", [email])
    }
    const valId = (await rows('SELECT id FROM validator_profiles WHERE email=$1', [VAL]))[0].id
    const created = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: valId })
    assert.equal(created.status, 201, created.text)
    engId = created.body.id
    await eng(VAL, 'POST', `/${engId}/respond`, { side: 'validator', decision: 'accept' })
    assert.equal((await eng(VAL, 'POST', `/${engId}/declaration`, { confirmed: true, signedName: 'Valerie Okafor' })).status, 200)
    assert.equal((await rows('SELECT status FROM validation_engagements WHERE id=$1', [engId]))[0].status, 'active')
    // Organisation A's workspace evidence registry, and another organisation's item.
    await rows(`INSERT INTO ws_organizations(id,name) VALUES(1,'Acme WS'),(2,'Beta WS')`)
    await rows(`INSERT INTO ws_org_members(user_id,org_id,role) VALUES('${ALICE}',1,'assessor'),('${BOB}',2,'owner')`)
    const add = async (org: number, name: string, path: string) => (await rows(
      `INSERT INTO evidence_registry(org_id,workspace_id,document_name,document_type,uploaded_by,file_path,file_size_kb,mime_type) VALUES($1,1,$2,'evidence','x',$3,1,'application/pdf') RETURNING id`, [org, name, path]))[0].id as number
    evA = await add(1, 'Audited accounts 2025.pdf', 'k/accounts')
    evOther = await add(2, 'Beta secret.pdf', 'k/other')
    await getStore('evidence').set('k/accounts', encodeEvidence(BYTES.buffer.slice(BYTES.byteOffset, BYTES.byteOffset + BYTES.byteLength) as ArrayBuffer))
  })
  afterEach(() => {
    mock.restore()
    delete process.env.RESEND_API_KEY
    delete process.env.REMINDER_FROM_EMAIL
  })
  const mails = () => mock.calls.filter((c) => c.url.includes('resend')).map((c) => JSON.parse(String(c.init!.body)))
  const ask = (email = VAL, extra: object = {}) => req(email, 'POST', '', { engagementId: engId, title: 'Audited accounts 2025', indicatorId: 'L1-FIN', dueOn: inDays(14), note: 'Signed by the auditor', ...extra })

  it('only the reviewing side asks, while the engagement is active, for a due date in the next year', async () => {
    assert.equal((await ask(ALICE)).status, 404, 'the organisation does not request from itself')
    assert.equal((await ask(STRANGER)).status, 404, 'a validator not on the engagement')
    assert.equal((await ask(BOB)).status, 404)
    assert.equal((await ask(VAL, { dueOn: inDays(-1) })).status, 400)
    assert.equal((await ask(VAL, { dueOn: inDays(400) })).status, 400)
    assert.equal((await ask(VAL, { title: 'x' })).status, 400)
    const ok = await ask()
    assert.equal(ok.status, 201, ok.text)
    assert.equal(ok.body.status, 'open')
    const sent = mails()
    assert.equal(sent.length, 1)
    assert.ok(sent[0].to.includes('finance@org-a.example') && sent[0].to.includes(ALICE), 'organisation contact and admins')
    assert.match(sent[0].text, /Audited accounts 2025/)
    assert.match(sent[0].text, new RegExp(`/engagements/${engId}`))
    // Both sides see it, nobody else does.
    assert.equal((await req(ALICE, 'GET', `?engagementId=${engId}`)).body.side, 'organization')
    assert.equal((await req(VAL, 'GET', `?engagementId=${engId}`)).body.requests.length, 1)
    assert.equal((await req(BOB, 'GET', `?engagementId=${engId}`)).status, 404)
    // Not while the engagement is closed.
    await eng(ALICE, 'POST', `/${engId}/cancel`, { reason: 'done' })
    assert.equal((await ask()).status, 409)
  })

  it('organisation links its own evidence and submits; the reviewer opens only that, then asks for more and accepts', async () => {
    const id = (await ask()).body.id
    assert.equal((await req(ALICE, 'POST', `/${id}/submit`, {})).status, 400, 'nothing linked yet')
    assert.equal((await req(VAL, 'POST', `/${id}/items`, { evidenceId: evA })).status, 403, 'the reviewer cannot link')
    assert.equal((await req(ALICE, 'POST', `/${id}/items`, { evidenceId: evOther })).status, 404, "another organisation's evidence is invisible")
    const opts = await req(ALICE, 'GET', `/options?engagementId=${engId}`)
    assert.deepEqual(opts.body.options.map((o: any) => o.id), [evA])
    assert.equal((await req(VAL, 'GET', `/options?engagementId=${engId}`)).status, 404)
    const linked = await req(ALICE, 'POST', `/${id}/items`, { evidenceId: evA })
    assert.equal(linked.status, 201, linked.text)
    assert.equal(linked.body.items[0].name, 'Audited accounts 2025.pdf')
    assert.ok(linked.body.items[0].sha256)
    assert.equal((await req(VAL, 'GET', `/${id}/items/${evA}/download`)).status, 404, 'not before it is submitted')

    const submitted = await req(ALICE, 'POST', `/${id}/submit`, { note: 'Signed copy attached' })
    assert.equal(submitted.status, 200, submitted.text)
    assert.equal(submitted.body.status, 'submitted')
    assert.deepEqual(mails().at(-1).to, [VAL], 'the requester is told')
    assert.equal((await req(ALICE, 'DELETE', `/${id}/items/${evA}`)).status, 409, 'submitted evidence stays')

    const file = await req(VAL, 'GET', `/${id}/items/${evA}/download`)
    assert.equal(file.status, 200)
    assert.deepEqual(file.bytes, BYTES)
    assert.match(file.headers.get('content-disposition') ?? '', /attachment/)
    assert.equal((await req(ALICE, 'GET', `/${id}/items/${evA}/download`)).status, 403, 'the download is for the reviewer')
    assert.equal((await req(VAL, 'GET', `/${id}/items/${evOther}/download`)).status, 404, 'only items linked to this request')
    assert.equal((await req(STRANGER, 'GET', `/${id}/items/${evA}/download`)).status, 404)

    assert.equal((await req(ALICE, 'POST', `/${id}/review`, { decision: 'accept' })).status, 403)
    assert.equal((await req(VAL, 'POST', `/${id}/review`, { decision: 'more' })).status, 400, 'say what more is needed')
    const more = await req(VAL, 'POST', `/${id}/review`, { decision: 'more', note: 'Include the management letter' })
    assert.equal(more.body.status, 'more_needed')
    assert.match(mails().at(-1).text, /Include the management letter/)
    assert.equal((await req(ALICE, 'POST', `/${id}/submit`, { note: 'Letter added' })).body.status, 'submitted')
    const accepted = await req(VAL, 'POST', `/${id}/review`, { decision: 'accept', note: 'Thank you' })
    assert.equal(accepted.body.status, 'accepted')
    assert.equal((await req(VAL, 'POST', `/${id}/review`, { decision: 'accept' })).status, 409)

    const log = (await rows(`SELECT action FROM audit_logs WHERE category='Evidence request' AND target=$1 ORDER BY id`, [id])).map((r: any) => r.action)
    assert.ok(log[0].startsWith('requested evidence'))
    assert.ok(log.some((a: string) => a.startsWith('opened evidence')), 'every file view is logged')
    assert.ok(log.includes('accepted the evidence'))
  })

  it('lists what waits on me, and withdraws a request', async () => {
    const id = (await ask()).body.id
    const forOrg = await req(ALICE, 'GET', '?mine=1')
    assert.deepEqual(forOrg.body.forMyOrganisation.map((r: any) => r.id), [id])
    await req(ALICE, 'POST', `/${id}/items`, { evidenceId: evA })
    await req(ALICE, 'POST', `/${id}/submit`, {})
    const forVal = await req(VAL, 'GET', '?mine=1')
    assert.deepEqual(forVal.body.awaitingMyReview.map((r: any) => [r.id, r.organization]), [[id, 'Acme Cooperative']])
    const second = (await ask(VAL, { title: 'Board minutes' })).body.id
    assert.equal((await req(ALICE, 'POST', `/${second}/cancel`, {})).status, 403)
    assert.equal((await req(VAL, 'POST', `/${second}/cancel`, { reason: 'Not needed' })).body.status, 'cancelled')
    assert.equal((await req(ALICE, 'POST', `/${second}/items`, { evidenceId: evA })).status, 409)
  })

  it('reminds the organisation about overdue requests every few days, at most five times', async () => {
    const id = (await ask()).body.id
    await rows(`UPDATE evidence_requests SET due_on = current_date - 2 WHERE id=$1`, [id])
    const before = mails().length
    const first = await sendEvidenceRequestReminders()
    assert.deepEqual(first, { checked: 1, sent: 1, failed: 0 })
    const after = mails().slice(before)
    assert.ok(after.some((m) => m.to.includes('finance@org-a.example') && /overdue/i.test(m.subject)), 'the organisation is reminded')
    assert.ok(after.some((m) => m.to.includes(VAL)), 'the requester is told once')
    assert.deepEqual(await sendEvidenceRequestReminders(), { checked: 0, sent: 0, failed: 0 }, 'not again the same day')
    await rows(`UPDATE evidence_requests SET reminded_at = now() - interval '4 days', reminder_count = 5 WHERE id=$1`, [id])
    assert.equal((await sendEvidenceRequestReminders()).checked, 0, 'capped')
    await rows(`UPDATE evidence_requests SET reminder_count = 1 WHERE id=$1`, [id])
    assert.equal((await sendEvidenceRequestReminders()).sent, 1)
    // A submitted request is not overdue any more.
    await req(ALICE, 'POST', `/${id}/items`, { evidenceId: evA })
    await req(ALICE, 'POST', `/${id}/submit`, {})
    await rows(`UPDATE evidence_requests SET reminded_at = now() - interval '4 days' WHERE id=$1`, [id])
    assert.equal((await sendEvidenceRequestReminders()).checked, 0)
  })
})
