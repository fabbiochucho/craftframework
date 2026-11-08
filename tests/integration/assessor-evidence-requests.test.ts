// Evidence requests from an organisation's independent assessor (no engagement): only the assessor, or the
// Super Admin in the assessor's name, asks; the organisation links its own registry items and submits; the
// assessor opens only what was submitted and reviews it. Everything stops when the grant is revoked.
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { getStore } from '@netlify/blobs'
import { PDFDocument } from 'pdf-lib'
import { installFetchMock, rows, truncateAll } from './harness.ts'
import { encodeEvidence } from '../../netlify/lib/evidence-storage.ts'
import { sendEvidenceRequestReminders } from '../../netlify/lib/evidence-requests.ts'

const requests = (await import(new URL('../../netlify/functions/evidence-requests.mts', import.meta.url).href)).default

const SUPER = 'fabbiochucho@gmail.com'
const MARTIN = 'martinmaryconsult@gmail.com' // independent assessor of org_a only
const ALICE = 'alice@org-a.example' // organisation A admin
const BOB = 'bob@org-b.example' // organisation B admin, not assessed by Martin
const src = await PDFDocument.create(); src.addPage([400, 600])
const BYTES = Buffer.from(await src.save())

async function req(email: string | null, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await requests(new Request(`http://localhost/api/evidence-requests${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const buf = Buffer.from(await res.arrayBuffer())
  let json: any = null
  try { json = JSON.parse(buf.toString('utf8')) } catch { /* not json */ }
  return { status: res.status, body: json, text: buf.toString('utf8'), bytes: buf, headers: res.headers }
}
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
const ask = (email: string, extra: object = {}) => req(email, 'POST', '', { orgId: 'org_a', title: 'Board minutes 2025', dueOn: inDays(14), ...extra })

describe('evidence requests from an independent assessor', () => {
  let mock: ReturnType<typeof installFetchMock>
  let evA: number
  beforeEach(async () => {
    await truncateAll()
    process.env.RESEND_API_KEY = 'test-key'
    process.env.REMINDER_FROM_EMAIL = 'CRAFT <notices@mail.example.org>'
    mock = installFetchMock(() => new Response('{"id":"x"}', { status: 200 }))
    await rows(`INSERT INTO organizations(id,name,country,email) VALUES('org_a','NYNETHA','Nigeria','contact@org-a.example'),('org_b','Beta Trust','Kenya','')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
    await rows(`INSERT INTO access_grants(id,org_id,grantee,role,level,status) VALUES('g1','org_a','${MARTIN}','independent_assessor','read','active')`)
    await rows(`INSERT INTO ws_organizations(id,name) VALUES(1,'NYNETHA WS')`)
    await rows(`INSERT INTO ws_org_members(user_id,org_id,role) VALUES('${ALICE}',1,'assessor')`)
    evA = (await rows(`INSERT INTO evidence_registry(org_id,workspace_id,document_name,document_type,uploaded_by,file_path,file_size_kb,mime_type)
      VALUES(1,1,'Board minutes 2025.pdf','evidence','x','k/minutes',1,'application/pdf') RETURNING id`))[0].id
    await getStore('evidence').set('k/minutes', encodeEvidence(BYTES.buffer.slice(BYTES.byteOffset, BYTES.byteOffset + BYTES.byteLength) as ArrayBuffer))
  })
  afterEach(() => {
    mock.restore()
    delete process.env.RESEND_API_KEY
    delete process.env.REMINDER_FROM_EMAIL
  })
  const mails = () => mock.calls.filter((c) => c.url.includes('resend')).map((c) => JSON.parse(String(c.init!.body)))

  it('only the assessor, or the Super Admin in their name, asks an organisation they hold a grant on', async () => {
    assert.equal((await ask(ALICE)).status, 404, 'the organisation does not ask itself')
    assert.equal((await ask(BOB)).status, 404)
    assert.equal((await ask(MARTIN, { orgId: 'org_b' })).status, 404, 'no grant on org_b')
    assert.equal((await ask(ALICE, { onBehalfOf: MARTIN })).status, 403, 'only the Super Admin acts on behalf')
    assert.equal((await ask(SUPER, { orgId: 'org_b', onBehalfOf: MARTIN })).status, 409, 'not the assessor of org_b')
    assert.equal((await ask(MARTIN, { engagementId: 'e1' })).status, 400, 'engagement or organisation, not both')
    const orgs = await req(SUPER, 'GET', `/assessor-orgs?assessor=${MARTIN}`)
    assert.deepEqual(orgs.body.organisations, [{ id: 'org_a', name: 'NYNETHA' }])
    assert.equal((await req(ALICE, 'GET', `/assessor-orgs?assessor=${MARTIN}`)).status, 403)

    const sent = await ask(SUPER, { onBehalfOf: MARTIN, note: 'Last two years' })
    assert.equal(sent.status, 201, sent.text)
    assert.equal(sent.body.engagementId, null)
    assert.equal(sent.body.requestedBy, MARTIN)
    const mail = mails().at(-1)
    assert.ok(mail.to.includes('contact@org-a.example') && mail.to.includes(ALICE) && !mail.to.includes(MARTIN))
    assert.equal(mail.reply_to, MARTIN, 'replies go to the assessor')
    assert.match(mail.text, /independent assessor/)
    assert.match(mail.text, new RegExp(`sent on their behalf by ${SUPER}`))
    assert.match(mail.text, /engagements#assessor-evidence/)
    const [log] = await rows(`SELECT actor, action FROM audit_logs WHERE target=$1`, [sent.body.id])
    assert.equal(log.actor, SUPER)
    assert.match(log.action, new RegExp(`on behalf of ${MARTIN}`))
    assert.equal((await ask(MARTIN)).status, 201, 'the assessor asks directly')
  })

  it('the organisation links its own evidence and submits; the assessor opens and reviews it', async () => {
    const r = (await ask(MARTIN)).body
    const forAlice = await req(ALICE, 'GET', '?assessor=1')
    assert.equal(forAlice.body.requests.length, 1)
    assert.equal(forAlice.body.requests[0].side, 'organization')
    assert.equal(forAlice.body.requests[0].organization, 'NYNETHA')
    assert.equal((await req(BOB, 'GET', '?assessor=1')).body.requests.length, 0, 'other organisations see nothing')
    assert.equal((await req(ALICE, 'GET', '?mine=1')).body.forMyOrganisation.length, 1, 'shows in Evidence waiting')
    const opts = await req(ALICE, 'GET', '/options?orgId=org_a')
    assert.ok(opts.body.options.some((o: any) => o.id === evA))
    assert.equal((await req(MARTIN, 'GET', '/options?orgId=org_a')).status, 404, 'the assessor never lists the registry')

    assert.equal((await req(MARTIN, 'POST', `/${r.id}/items`, { evidenceId: evA })).status, 403, 'the assessor cannot link')
    assert.equal((await req(ALICE, 'POST', `/${r.id}/items`, { evidenceId: evA })).status, 201)
    assert.equal((await req(MARTIN, 'GET', `/${r.id}/items/${evA}/view`)).status, 404, 'nothing to view before submission')
    assert.equal((await req(ALICE, 'POST', `/${r.id}/submit`, { note: 'Signed copy' })).status, 200)
    assert.ok(mails().some((m) => m.to.includes(MARTIN) && /submitted evidence/.test(m.subject)))
    assert.equal((await req(MARTIN, 'GET', '?assessor=1')).body.requests[0].side, 'reviewer')
    const dl = await req(MARTIN, 'GET', `/${r.id}/items/${evA}/download`)
    assert.equal(dl.status, 403, 'an independent assessor never downloads the original')
    const seen = await req(MARTIN, 'GET', `/${r.id}/items/${evA}/view`)
    assert.equal(seen.status, 200)
    assert.match(seen.headers.get('content-type') ?? '', /application\/pdf/)
    assert.match(seen.headers.get('content-disposition') ?? '', /^inline/)
    assert.notDeepEqual(seen.bytes, BYTES, 'a stamped copy, not the original')
    assert.equal((await PDFDocument.load(seen.bytes)).getPageCount(), 1)
    const [viewed] = await rows(`SELECT actor FROM audit_logs WHERE target=$1 AND action LIKE 'viewed evidence%'`, [r.id])
    assert.equal(viewed.actor, MARTIN)
    assert.equal((await req(BOB, 'GET', `/${r.id}/items/${evA}/view`)).status, 404)
    assert.equal((await req(ALICE, 'GET', `/${r.id}/items/${evA}/view`)).status, 403, 'the organisation has its own registry')
    // A Word file cannot be viewed: the assessor is told to ask for a PDF.
    await getStore('evidence').set('k/minutes', encodeEvidence(Uint8Array.from(Buffer.from('PK\x03\x04 word', 'latin1')).buffer as ArrayBuffer))
    const word = await req(MARTIN, 'GET', `/${r.id}/items/${evA}/view`)
    assert.equal(word.status, 415)
    assert.match(word.text, /PDF/)
    assert.equal((await req(ALICE, 'POST', `/${r.id}/review`, { decision: 'accept' })).status, 403)
    assert.equal((await req(MARTIN, 'POST', `/${r.id}/review`, { decision: 'accept', note: 'Thank you' })).status, 200)
    const forSuper = await req(SUPER, 'GET', `?assessor=1&for=${MARTIN}`)
    assert.equal(forSuper.body.requests[0].status, 'accepted')
    assert.equal(forSuper.body.requests[0].side, 'observer')
  })

  it('download needs the organisation to allow it: ask with a reason, allow, withdraw, decline', async () => {
    const r = (await ask(MARTIN)).body
    assert.equal((await req(ALICE, 'POST', `/${r.id}/items`, { evidenceId: evA })).status, 201)
    assert.equal((await req(ALICE, 'POST', `/${r.id}/submit`, {})).status, 200)
    const item = async () => (await req(MARTIN, 'GET', '?assessor=1')).body.requests[0].items[0]
    assert.equal((await item()).downloadAccess, 'view_only', 'assessor requests are view only by default')
    const dl = () => req(MARTIN, 'GET', `/${r.id}/items/${evA}/download`)
    assert.equal((await dl()).status, 403)

    // Only the reviewer asks, with a reason; only the organisation decides.
    assert.equal((await req(ALICE, 'POST', `/${r.id}/items/${evA}/download-request`, { reason: 'I need the original file' })).status, 403)
    assert.equal((await req(MARTIN, 'POST', `/${r.id}/items/${evA}/download-request`, { reason: 'short' })).status, 400)
    assert.equal((await req(MARTIN, 'POST', `/${r.id}/items/${evA}/download-access`, { allow: true })).status, 403, 'the assessor cannot allow themselves')
    const asked = await req(MARTIN, 'POST', `/${r.id}/items/${evA}/download-request`, { reason: 'Need to check the signatures at full resolution' })
    assert.equal(asked.status, 200, asked.text)
    assert.equal((await item()).downloadAccess, 'requested')
    const toOrg = mails().find((m) => /permission asked to download/.test(m.subject))
    assert.ok(toOrg && toOrg.to.includes(ALICE) && toOrg.reply_to === MARTIN && /signatures at full resolution/.test(toOrg.text))
    assert.equal((await req(MARTIN, 'POST', `/${r.id}/items/${evA}/download-request`, { reason: 'Need to check the signatures again' })).status, 409, 'asked once')
    assert.equal((await dl()).status, 403, 'still waiting')

    // The organisation allows: the original downloads, and the assessor is told.
    assert.equal((await req(ALICE, 'POST', `/${r.id}/items/${evA}/download-access`, { allow: true })).status, 200)
    assert.ok(mails().some((m) => m.to.includes(MARTIN) && /allowed you to download/.test(m.subject)))
    const file = await dl()
    assert.equal(file.status, 200)
    assert.deepEqual(file.bytes, BYTES, 'the original file')

    // The organisation withdraws it; then declines a new request.
    assert.equal((await req(ALICE, 'POST', `/${r.id}/items/${evA}/download-access`, { allow: false })).status, 200)
    assert.equal((await item()).downloadAccess, 'view_only')
    assert.equal((await dl()).status, 403)
    await req(MARTIN, 'POST', `/${r.id}/items/${evA}/download-request`, { reason: 'Need it again for the final report' })
    assert.equal((await req(ALICE, 'POST', `/${r.id}/items/${evA}/download-access`, { allow: false })).status, 200)
    assert.equal((await item()).downloadAccess, 'declined')
    assert.ok(mails().some((m) => m.to.includes(MARTIN) && /declined downloading/.test(m.subject)))
    assert.equal((await dl()).status, 403)
    assert.equal((await req(MARTIN, 'GET', `/${r.id}/items/${evA}/view`)).status, 200, 'viewing still works')
    const log = (await rows(`SELECT action FROM audit_logs WHERE target=$1 ORDER BY id`, [r.id])).map((x: any) => x.action).join('\n')
    for (const w of ['view only', 'asked to download', 'allowed downloading', 'opened evidence', 'made view only', 'declined the download request']) assert.match(log, new RegExp(w))
  })

  it('the organisation can allow download when linking', async () => {
    const r = (await ask(MARTIN)).body
    await req(ALICE, 'POST', `/${r.id}/items`, { evidenceId: evA, allowDownload: true })
    await req(ALICE, 'POST', `/${r.id}/submit`, {})
    assert.equal((await req(MARTIN, 'GET', `/${r.id}/items/${evA}/download`)).status, 200)
  })

  it('stops when the assessor grant is revoked, including reminders', async () => {
    const r = (await ask(MARTIN, { dueOn: inDays(0) })).body
    await rows(`UPDATE evidence_requests SET due_on = current_date - 2 WHERE id=$1`, [r.id])
    const first = await sendEvidenceRequestReminders()
    assert.equal(first.sent, 1, 'overdue reminder while the grant is active')
    assert.equal(mails().find((m) => /overdue/.test(m.subject) && m.to.includes(ALICE))?.reply_to, MARTIN)
    await rows(`UPDATE access_grants SET status='revoked' WHERE id='g1'`)
    assert.equal((await req(ALICE, 'POST', `/${r.id}/items`, { evidenceId: evA })).status, 409)
    assert.equal((await ask(MARTIN)).status, 404)
    await rows(`UPDATE evidence_requests SET reminded_at = now() - interval '10 days' WHERE id=$1`, [r.id])
    assert.equal((await sendEvidenceRequestReminders()).sent, 0, 'no reminders once access is revoked')
  })
})
