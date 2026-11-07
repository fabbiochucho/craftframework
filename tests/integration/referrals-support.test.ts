// Referrals and ambassador badges (/api/referrals), and Super Admin support mode: finding an organisation
// (/api/support/orgs), adding evidence on its behalf (labelled, emailed, logged) and answering its
// evidence requests with its own documents only.
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { as, installFetchMock, pdfFile, rows, truncateAll } from './harness.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const invitations = await load('invitations')
const referrals = await load('referrals')
const support = await load('support')
const directory = await load('directory')
const engagements = await load('engagements')
const requests = await load('evidence-requests')

const SUPER = 'fabbiochucho@gmail.com'
const REVIEWER = 'rev@portfolio.example'
const COORD = 'coord@network.example'
const ALICE = 'alice@org-a.example'
const BOB = 'bob@org-b.example'
const VAL = 'val@validators.example'
let ip = 0

async function call(handler: any, email: string | null, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': `198.51.100.${(ip = (ip % 250) + 1)}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}

/** REVIEWER invites `email` to portfolio pf_1; with `accept`, the invitee accepts. Returns the new org id. */
async function referViaPortfolio(email: string, accept: boolean) {
  const inv = await call(invitations, REVIEWER, 'POST', 'invitations', { kind: 'organization', email, orgName: `Org ${email}`, portfolioId: 'pf_1' })
  assert.equal(inv.status, 201, inv.text)
  if (!accept) return null
  const token = (await rows('SELECT token FROM invitations WHERE id=$1', [inv.body.id]))[0].token
  const ok = await call(invitations, email, 'POST', 'invitations/accept', { token, orgName: `Org ${email}` })
  assert.equal(ok.status, 200, ok.text)
  return ok.body.orgId as string
}

describe('referrals, badges and support mode', () => {
  let mock: ReturnType<typeof installFetchMock>
  beforeEach(async () => {
    await truncateAll()
    process.env.RESEND_API_KEY = 'test-key'
    process.env.INVITE_FROM_EMAIL = 'CRAFT <invites@mail.example.org>'
    process.env.REMINDER_FROM_EMAIL = 'CRAFT <notices@mail.example.org>'
    mock = installFetchMock(() => new Response('{"id":"x"}', { status: 200 }))
    await rows(`INSERT INTO portfolios(id,name,reviewer) VALUES('pf_1','East Africa NGOs','${REVIEWER}')`)
  })
  afterEach(() => {
    mock.restore()
    for (const k of ['RESEND_API_KEY', 'INVITE_FROM_EMAIL', 'REMINDER_FROM_EMAIL']) delete process.env[k]
  })
  const mails = () => mock.calls.filter((c) => c.url.includes('resend')).map((c) => JSON.parse(String(c.init!.body)))

  it('tracks each referral from invited to assessed and awards badges only for organisations that started', async () => {
    const a = await referViaPortfolio('a@one.example', true)
    const b = await referViaPortfolio('b@two.example', true)
    await referViaPortfolio('c@three.example', false)
    let mine = await call(referrals, REVIEWER, 'GET', 'referrals')
    assert.deepEqual(mine.body.funnel, { invited: 3, joined: 2, started: 0, assessed: 0 })
    assert.deepEqual(mine.body.badges, [], 'joining alone earns nothing')

    await rows(`INSERT INTO assessments(org_id, completed_at) VALUES($1, now())`, [a])
    await rows(`INSERT INTO assessments(org_id) VALUES($1)`, [b])
    mine = await call(referrals, REVIEWER, 'GET', 'referrals')
    assert.deepEqual(mine.body.funnel, { invited: 3, joined: 2, started: 2, assessed: 1 })
    const stages = Object.fromEntries(mine.body.referrals.map((r: any) => [r.contact, r.stage]))
    assert.deepEqual(stages, { 'a@one.example': 'assessed', 'b@two.example': 'started', 'c@three.example': 'invited' })
    assert.ok(!('orgId' in mine.body.referrals[0]), 'no organisation ids leak')
    const portfolio = mine.body.badges.find((x: any) => x.track === 'portfolio')
    assert.equal(portfolio.tier, 'connector')
    assert.deepEqual(portfolio.next, { tier: 'Bronze', needed: 1 })
    assert.ok(mine.body.badges.some((x: any) => x.track === 'all'))
    assert.ok(!mine.body.badges.some((x: any) => x.track === 'network'))

    // Badges for display: badges only, for anyone signed in.
    const shown = await call(referrals, COORD, 'GET', `referrals/badges?email=${encodeURIComponent(REVIEWER)}&email=${encodeURIComponent(COORD)}`)
    assert.deepEqual(Object.keys(shown.body).sort(), [COORD, REVIEWER].sort())
    assert.equal(shown.body[REVIEWER].length, 2)
    assert.deepEqual(shown.body[COORD], [])
    assert.equal((await call(referrals, null, 'GET', 'referrals/badges?email=x@y.example')).status, 401)

    // Platform overview: Super Admin only.
    assert.equal((await call(referrals, REVIEWER, 'GET', 'referrals/overview')).status, 403)
    const all = await call(referrals, SUPER, 'GET', 'referrals/overview')
    assert.deepEqual(all.body.funnel, { invited: 3, joined: 2, started: 2, assessed: 1 })
    assert.equal(all.body.ambassadors[0].inviter, REVIEWER)
  })

  it('support mode: the Super Admin finds an organisation and adds evidence, labelled, emailed and logged', async () => {
    await rows(`INSERT INTO ws_organizations(id,name,contact_email) VALUES(7,'NYNETHA','nynetha.ng@example.org')`)
    await rows(`INSERT INTO workspaces(id,org_id,workspace_name) VALUES(70,7,'Main')`)
    await rows(`INSERT INTO ws_org_members(user_id,org_id,role) VALUES('${ALICE}',7,'owner')`)
    assert.equal((await call(support, ALICE, 'GET', 'support/orgs?q=NYN')).status, 403, 'Super Admin only')
    const found = await call(support, SUPER, 'GET', 'support/orgs?q=nyn')
    assert.equal(found.status, 200, found.text)
    assert.deepEqual(found.body.workspaceOrganisations.map((o: any) => [o.name, o.workspaces.map((w: any) => w.id)]), [['NYNETHA', [70]]])

    const up = await as(SUPER).upload('/workspaces/70/evidence/upload', pdfFile('CAC certificate.pdf'), { documentType: 'certification' })
    assert.equal(up.status, 201, up.text)
    const [e] = await rows('SELECT added_by_support, uploaded_by FROM evidence_registry WHERE id=$1', [up.body.id])
    assert.deepEqual(e, { added_by_support: true, uploaded_by: SUPER })
    const notice = mails().find((m) => /support/i.test(m.subject))
    assert.ok(notice, 'the organisation is told')
    assert.deepEqual(notice.to.sort(), [ALICE, 'nynetha.ng@example.org'].sort())
    assert.match(notice.text, /CAC certificate\.pdf/)
    assert.equal(notice.reply_to, SUPER)
    const [log] = await rows(`SELECT details FROM ws_audit_log WHERE resource_type='evidence' AND resource_id=$1`, [String(up.body.id)])
    assert.equal(log.details.support, true, 'audit-logged as support')

    // A member's own upload is not labelled.
    const own = await as(ALICE).upload('/workspaces/70/evidence/upload', pdfFile('Policy.pdf'), { documentType: 'policy' })
    assert.equal((await rows('SELECT added_by_support FROM evidence_registry WHERE id=$1', [own.body.id]))[0].added_by_support, false)
  })

  it("support mode answers an evidence request with the organisation's own documents only", async () => {
    await rows(`INSERT INTO organizations(id,name,email) VALUES('org_a','Acme Cooperative','info@org-a.example'),('org_b','Beta','')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
    await rows(`INSERT INTO ws_organizations(id,name) VALUES(1,'Acme WS'),(2,'Beta WS')`)
    await rows(`INSERT INTO ws_org_members(user_id,org_id,role) VALUES('${ALICE}',1,'owner'),('${BOB}',2,'owner')`)
    const add = async (org: number, name: string) => (await rows(
      `INSERT INTO evidence_registry(org_id,workspace_id,document_name,document_type,uploaded_by,file_path,file_size_kb,mime_type) VALUES($1,1,$2,'evidence','x','k/'||$2,1,'application/pdf') RETURNING id`, [org, name]))[0].id as number
    const mine = await add(1, 'Acme accounts.pdf')
    const theirs = await add(2, 'Beta secret.pdf')
    await call(directory, VAL, 'PUT', 'directory/me/validator', { name: 'Valerie' })
    await rows(`UPDATE validator_profiles SET accreditation_status='accredited', accredited_until=now()+interval '1 year'`)
    const valId = (await rows('SELECT id FROM validator_profiles'))[0].id
    const eng = await call(engagements, ALICE, 'POST', 'engagements', { side: 'organization', type: 'independent_validation', validatorId: valId })
    await call(engagements, VAL, 'POST', `engagements/${eng.body.id}/respond`, { side: 'validator', decision: 'accept' })
    await call(engagements, VAL, 'POST', `engagements/${eng.body.id}/declaration`, { confirmed: true, signedName: 'Valerie' })
    const r = await call(requests, VAL, 'POST', 'evidence-requests', { engagementId: eng.body.id, title: 'Audited accounts', dueOn: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) })
    assert.equal(r.status, 201, r.text)

    const opts = await call(requests, SUPER, 'GET', `evidence-requests/options?engagementId=${eng.body.id}`)
    assert.deepEqual(opts.body.options.map((o: any) => o.id), [mine], "only the organisation's own documents")
    assert.equal((await call(requests, SUPER, 'POST', `evidence-requests/${r.body.id}/items`, { evidenceId: theirs })).status, 404)
    const before = mails().length
    assert.equal((await call(requests, SUPER, 'POST', `evidence-requests/${r.body.id}/items`, { evidenceId: mine })).status, 201)
    const submitted = await call(requests, SUPER, 'POST', `evidence-requests/${r.body.id}/submit`, {})
    assert.equal(submitted.body.status, 'submitted')
    const sent = mails().slice(before)
    assert.ok(sent.some((m) => /support/i.test(m.subject) && m.to.includes(ALICE)), 'the organisation is told what support did')
    assert.ok(sent.some((m) => m.to.includes(VAL)), 'the reviewer is told as usual')
    const log = (await rows(`SELECT action FROM audit_logs WHERE target=$1 ORDER BY id`, [r.body.id])).map((x: any) => x.action)
    assert.ok(log.some((a: string) => a.startsWith('CRAFT support: linked')) && log.some((a: string) => a.startsWith('CRAFT support: submitted')))
  })
})
