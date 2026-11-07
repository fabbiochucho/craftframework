// Inviting organisations on an independent assessor's behalf: Super Admin only; drafts are not emailed or
// acceptable until sent; sending starts the 14 days and says it was sent on the assessor's behalf; on
// acceptance the organisation names the assessor its independent assessor, who can then record ONLY
// independent scores and independent statement answers. Plus network drafts and the CSV sample.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetchMock, rows, truncateAll } from './harness.ts'
import { rowsFromCsv } from '../../src/lib/bulkInvite.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const invitations = await load('invitations')
const sendInvite = await load('send-invite')
const responsesApi = await load('responses')
const legacyState = await load('legacy-state')
const networks = await load('networks')

const SUPER = 'fabbiochucho@gmail.com'
const MARTIN = 'martinmaryconsult@gmail.com'
const COORD = 'nynetha.ng@gmail.com'
const COORD_ORG = 'self_nynetha_ng_gmail_com'
let ip = 0

async function call(handler: any, email: string | null, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': `198.51.100.${(ip = (ip % 250) + 1)}`, origin: 'http://localhost' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}

describe('independent assessor on-behalf invitations', () => {
  let mock: ReturnType<typeof installFetchMock>
  beforeEach(async () => {
    await truncateAll()
    process.env.RESEND_API_KEY = 'test-key'
    process.env.INVITE_FROM_EMAIL = 'CRAFT <invites@mail.example.org>'
    mock = installFetchMock(() => new Response('{"id":"x"}', { status: 200 }))
  })
  afterEach(() => {
    mock.restore()
    delete process.env.RESEND_API_KEY
    delete process.env.INVITE_FROM_EMAIL
  })
  const mails = () => mock.calls.filter((c) => c.url.includes('resend')).map((c) => JSON.parse(String(c.init!.body)))
  const draft = (by = SUPER) => call(invitations, by, 'POST', 'invitations', {
    kind: 'organization', email: COORD, orgName: 'NYNETHA', orgArchetype: 'Civil Society', orgSector: 'Network', orgCountry: 'NG',
    onBehalfOf: MARTIN, grantRole: 'independent_assessor', send: false, message: 'Dear National Coordinator,\n\nThank you for accepting to work with us.',
  })

  it('only the Super Admin invites on behalf; a draft is not emailed or acceptable until sent', async () => {
    assert.equal((await draft('someone@else.example')).status, 403)
    const d = await draft()
    assert.equal(d.status, 201, d.text)
    assert.equal(d.body.inviter, MARTIN)
    assert.equal(d.body.createdBy, SUPER)
    assert.equal(d.body.email.reason, 'draft')
    assert.equal(mails().length, 0, 'nothing emailed yet')
    const [u] = await rows('SELECT role, org_id FROM users WHERE email=$1', [MARTIN])
    assert.deepEqual(u, { role: 'independent', org_id: null }, 'Martin is set up as an independent assessor')
    const token = (await rows('SELECT token FROM invitations WHERE id=$1', [d.body.id]))[0].token
    assert.equal((await call(invitations, COORD, 'POST', 'invitations/accept', { token })).status, 404, 'not acceptable while a draft')

    // The Super Admin's draft list shows it unsent; sending starts the 14 days and says on whose behalf.
    const list = await call(invitations, SUPER, 'GET', 'invitations')
    assert.equal(list.body[0].sentAt, undefined)
    const sent = await call(sendInvite, SUPER, 'POST', 'send-invite', { invitationId: d.body.id })
    assert.equal(sent.body.dispatched, true, sent.text)
    const [row] = await rows('SELECT sent_at, sent_by, expires_at FROM invitations WHERE id=$1', [d.body.id])
    assert.ok(row.sent_at)
    assert.equal(row.sent_by, SUPER)
    const days = (new Date(row.expires_at).getTime() - Date.now()) / 864e5
    assert.ok(days > 13.9 && days < 14.1, `14 days from sending, got ${days}`)
    const email = mails()[0]
    assert.equal(email.to, COORD)
    assert.equal(email.reply_to, MARTIN, 'replies go to the assessor')
    assert.match(email.subject, new RegExp(MARTIN.replace(/[.]/g, '\\.')))
    assert.match(email.html, /behalf/)
    assert.match(email.html, /Thank you for accepting to work with us/)
    assert.match(email.html, /independent assessor/i)
    assert.match(email.html, /Civil Society · Network · Nigeria/)
  })

  it('accepting names the assessor; they can record only independent scores and statements', async () => {
    const d = await draft()
    await call(sendInvite, SUPER, 'POST', 'send-invite', { invitationId: d.body.id })
    const token = (await rows('SELECT token FROM invitations WHERE id=$1', [d.body.id]))[0].token
    const ok = await call(invitations, COORD, 'POST', 'invitations/accept', { token, orgName: 'NYNETHA' })
    assert.equal(ok.status, 200, ok.text)
    const [g] = await rows('SELECT grantee, role, level, status FROM access_grants WHERE org_id=$1', [COORD_ORG])
    assert.deepEqual(g, { grantee: MARTIN, role: 'independent_assessor', level: 'read', status: 'active' })

    const score = (body: object) => call(responsesApi, MARTIN, 'POST', 'responses', { orgId: COORD_ORG, questionId: 'GOV-01', ...body })
    assert.equal((await score({ assessorScore: 3, updatedBy: 'spoofed@x.example' })).status, 200)
    const [r] = await rows('SELECT score, assessor_score, updated_by FROM responses WHERE org_id=$1', [COORD_ORG])
    assert.deepEqual(r, { score: 0, assessor_score: 3, updated_by: MARTIN }, 'recorded as Martin, self-score untouched')
    assert.equal((await score({ score: 5 })).status, 403, "cannot change the organisation's own answer")
    assert.equal((await score({ assessorScore: 2, score: 5 })).status, 403)
    await call(responsesApi, COORD, 'POST', 'responses', { orgId: COORD_ORG, questionId: 'GOV-01', score: 2 })
    assert.equal((await rows('SELECT score, assessor_score FROM responses WHERE org_id=$1', [COORD_ORG]))[0].assessor_score, 3)

    const put = (key: string) => call(legacyState, MARTIN, 'PUT', 'legacy-state', { orgId: COORD_ORG, key, value: { x: 1 } })
    assert.equal((await put('craft:assessor-statements')).status, 200)
    assert.equal((await put('craft:statements')).status, 403, "not the organisation's own statements")
    assert.equal((await put('entity-profile')).status, 403)
    // Reading the organisation's assessment is allowed.
    assert.equal((await call(responsesApi, MARTIN, 'GET', `responses?orgId=${COORD_ORG}`)).status, 200)

    // Revoked: nothing more.
    await rows(`UPDATE access_grants SET status='revoked' WHERE org_id=$1`, [COORD_ORG])
    assert.equal((await score({ assessorScore: 4 })).status, 403)
    assert.equal((await put('craft:assessor-statements')).status, 403)
  })

  it('network invitations can be saved as drafts too', async () => {
    const n = await call(networks, SUPER, 'POST', 'networks', { name: 'NYNETHA Network', root: { level: 'national', name: 'Nigeria', geoCode: 'NG' } })
    const r = await call(networks, SUPER, 'POST', `networks/${n.body.id}/invitations`, { nodeId: n.body.rootId, org: 'member@cbo.example.org', orgName: 'Member CBO', inviteeName: 'Ada', send: false })
    assert.equal(r.status, 201, r.text)
    assert.equal(r.body.email.reason, 'draft')
    assert.equal(mails().length, 0)
    assert.equal((await rows('SELECT invitee_name, sent_at FROM invitations'))[0].invitee_name, 'Ada')
  })

  it('the sample CSV parses cleanly', () => {
    const text = readFileSync(new URL('../../public/templates/craft-organisation-invitations-sample.csv', import.meta.url), 'utf8')
    const out = rowsFromCsv(text)
    assert.ok(!('error' in out))
    const rs = (out as { rows: any[] }).rows
    assert.equal(rs.length, 4)
    assert.deepEqual(rs.map((r) => r.problem), [null, null, null, null])
    assert.deepEqual(rs.map((r) => [r.orgArchetype, r.orgSector, r.orgCountry]), [
      ['Civil Society', 'Cooperative', 'NG'], ['Civil Society', 'NGO', 'NG'], ['Civil Society', 'Faith-Based', 'NG'], ['Public', '', 'NG']])
    const bad = rowsFromCsv('organisation,email,type\nX Org,not-an-email,Banana\n') as { rows: any[] }
    assert.match(bad.rows[0].problem, /email|type/i)
    assert.ok('error' in rowsFromCsv('name only\nfoo'))
  })
})
