// Inviting by email (netlify/lib/invitations.ts): member invites scoped to organisations the
// inviter administers, organisation invites that link a portfolio / engagement / network only once
// the invitee accepts signed in as the invited email, the accept link in the email, and the two
// tenant-isolation fixes that came with it (users assignment, self_ id squatting).
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetchMock, rows, truncateAll } from './harness.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const invitations = await load('invitations')
const engagements = await load('engagements')
const networks = await load('networks')
const usersApi = await load('users')
const orgsApi = await load('organizations')
const directory = await load('directory')

const ADMIN_A = 'admin@org-a.example' // administrator of org_a
const STAFF_A = 'staff@org-a.example' // assessor at org_a
const ADMIN_B = 'admin@org-b.example' // administrator of org_b
const REVIEWER = 'rev@portfolio.example' // owns portfolio pf_1
const VAL = 'val@validators.example' // accredited validator
const NEWCO = 'ceo@newco.example' // not on CRAFT yet
const NEWCO_ORG = 'self_ceo_newco_example'
const SUPER = 'fabbiochucho@gmail.com'
let ipSeq = 0

async function call(handler: (r: Request) => Promise<Response>, email: string | null, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': `198.51.100.${(ipSeq = (ipSeq % 250) + 1)}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}
const invite = (email: string, body: unknown) => call(invitations, email, 'POST', 'invitations', body)
const accept = (email: string, token: string, orgName?: string) => call(invitations, email, 'POST', 'invitations/accept', { token, orgName })
const tokenOf = async (id: string) => (await rows('SELECT token FROM invitations WHERE id = $1', [id]))[0].token as string

describe('invitations by email', () => {
  let mock: ReturnType<typeof installFetchMock>
  beforeEach(async () => {
    await truncateAll()
    process.env.RESEND_API_KEY = 'test-key'
    process.env.INVITE_FROM_EMAIL = 'CRAFT <invites@mail.example.org>'
    mock = installFetchMock()
    await rows(`INSERT INTO organizations(id,name,country,email) VALUES('org_a','Acme Cooperative','Kenya','info@org-a.example'),('org_b','Beta Trust','Kenya','')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('ua','${ADMIN_A}','org_a','admin'),('us','${STAFF_A}','org_a','assessor'),('ub','${ADMIN_B}','org_b','admin')`)
    await rows(`INSERT INTO portfolios(id,name,reviewer) VALUES('pf_1','East Africa NGOs','${REVIEWER}')`)
  })
  afterEach(() => {
    mock.restore()
    delete process.env.RESEND_API_KEY
    delete process.env.INVITE_FROM_EMAIL
  })

  it('member invites stay inside organisations the inviter administers and never raise a role', async () => {
    assert.equal((await invite(STAFF_A, { email: 'x@new.example', role: 'admin' })).status, 400, 'an assessor cannot invite an admin')
    assert.equal((await invite(ADMIN_A, { email: 'x@new.example', role: 'assessor', orgId: 'org_b' })).status, 403, 'not into another tenant')
    assert.equal((await invite(ADMIN_A, { email: 'x@new.example', role: 'super_admin' })).status, 400)
    assert.equal((await invite(ADMIN_A, { email: 'x@new.example', role: 'portfolio', portfolioId: 'pf_1' })).status, 403, 'a portfolio they do not manage')
    const ok = await invite(ADMIN_A, { email: 'Ada@New.example', inviteeName: 'Ada', role: 'assessor', send: true })
    assert.equal(ok.status, 201, ok.text)
    assert.equal(ok.body.orgId, 'org_a')
    assert.equal(ok.body.email.dispatched, true)
    // Nobody is assigned anywhere until they accept.
    assert.equal((await rows(`SELECT 1 FROM users WHERE email='ada@new.example'`)).length, 0)
    // The Super Admin invites platform-wide: any organisation, any assignable role.
    assert.equal((await invite(SUPER, { email: 'boss@org-b.example', role: 'admin', orgId: 'org_b' })).status, 201)
  })

  it('the email carries the real accept link, and only the invited, signed-in email can accept', async () => {
    const inv = await invite(ADMIN_A, { email: 'ada@new.example', role: 'assessor', send: true })
    const token = await tokenOf(inv.body.id)
    const sent = JSON.parse(String(mock.calls[0].init!.body))
    assert.ok(sent.html.includes(`/accept/${token}`), 'button links to the accept page')
    assert.ok(sent.text.includes(`/accept/${token}`), 'plain-text part has the link too')
    assert.equal((await accept(ADMIN_B, token)).status, 403, 'a different account')
    assert.equal((await call(invitations, null, 'POST', 'invitations/accept', { token })).status, 401)
    const ok = await accept('ada@new.example', token)
    assert.equal(ok.status, 200, ok.text)
    assert.equal(ok.body.orgId, 'org_a')
    const [u] = await rows(`SELECT org_id, role, status FROM users WHERE email='ada@new.example'`)
    assert.deepEqual(u, { org_id: 'org_a', role: 'assessor', status: 'active' })
    assert.equal((await accept('ada@new.example', token)).status, 404, 'only once')
    assert.ok((await rows(`SELECT 1 FROM audit_logs WHERE action='Accepted invitation' AND org_id='org_a'`)).length)
  })

  it('a portfolio manager invites an organisation; accepting creates its own workspace and links the portfolio', async () => {
    assert.equal((await invite(ADMIN_B, { kind: 'organization', email: NEWCO, orgName: 'NewCo', portfolioId: 'pf_1' })).status, 403, 'not their portfolio')
    assert.equal((await invite(STAFF_A, { kind: 'organization', email: NEWCO, orgName: 'NewCo' })).status, 403, 'an assessor without a portfolio')
    const badType = await invite(REVIEWER, { kind: 'organization', email: NEWCO, orgName: 'NewCo', portfolioId: 'pf_1', orgArchetype: 'Private', orgSector: 'NGO' })
    assert.equal(badType.status, 400, 'a sector from another archetype is refused')
    const inv = await invite(REVIEWER, {
      kind: 'organization', email: NEWCO, orgName: 'NewCo Health', portfolioId: 'pf_1',
      orgArchetype: 'Civil Society', orgSector: 'NGO', orgCountry: 'NG',
    })
    assert.equal(inv.status, 201, inv.text)
    assert.equal(inv.body.email.dispatched, true, 'organisation invites are emailed straight away')
    const sent = JSON.parse(String(mock.calls[0].init!.body))
    assert.match(sent.html, /NewCo Health/)
    assert.match(sent.html, /East Africa NGOs/)
    assert.match(sent.html, /Civil Society · NGO · Nigeria/, 'the organisation type chosen in the wizard')
    const token = await tokenOf(inv.body.id)
    const looked = await call(invitations, null, 'GET', `invitations?token=${token}`)
    assert.equal(looked.body.kind, 'organization')
    assert.match(looked.body.purpose, /read-only access/)

    const ok = await accept(NEWCO, token, 'NewCo Health Ltd')
    assert.equal(ok.status, 200, ok.text)
    assert.equal(ok.body.orgId, NEWCO_ORG)
    const [org] = await rows(`SELECT name, created_by, archetype, sector, country FROM organizations WHERE id=$1`, [NEWCO_ORG])
    assert.deepEqual(org, { name: 'NewCo Health Ltd', created_by: NEWCO, archetype: 'Civil Society', sector: 'NGO', country: 'Nigeria' })
    assert.equal((await rows(`SELECT 1 FROM legacy_workspace_state WHERE org_id=$1 AND key='entity-profile'`, [NEWCO_ORG])).length, 1, 'profile prefilled')
    const [grant] = await rows(`SELECT grantee, level, status, portfolio_id FROM access_grants WHERE org_id=$1`, [NEWCO_ORG])
    assert.deepEqual(grant, { grantee: REVIEWER, level: 'read', status: 'active', portfolio_id: 'pf_1' })
    assert.equal((await rows(`SELECT 1 FROM portfolio_orgs WHERE portfolio_id='pf_1' AND org_id=$1`, [NEWCO_ORG])).length, 1)
    // The reviewer now lists it by name.
    const mine = await call(orgsApi, REVIEWER, 'GET', 'organizations')
    assert.ok(mine.body.some((o: any) => o.id === NEWCO_ORG && o.name === 'NewCo Health Ltd'))
  })

  it("a staff member of an organisation they don't administer cannot accept an organisation invitation for it", async () => {
    const inv = await invite(REVIEWER, { kind: 'organization', email: STAFF_A, orgName: 'Acme', portfolioId: 'pf_1' })
    const token = await tokenOf(inv.body.id)
    assert.equal((await accept(STAFF_A, token)).status, 403)
    assert.equal((await rows(`SELECT status FROM invitations WHERE id=$1`, [inv.body.id]))[0].status, 'pending', 'still pending for the right person')
    assert.equal((await rows(`SELECT 1 FROM access_grants WHERE org_id='org_a'`)).length, 0)
  })

  it('a validator invites an organisation by email; the engagement is proposed when it accepts', async () => {
    const prof = await call(directory, VAL, 'PUT', 'directory/me/validator', { name: 'Valerie Okafor', competencies: ['Audit'] })
    assert.equal(prof.status, 200, prof.text)
    const body = { side: 'validator', type: 'independent_validation', inviteEmail: NEWCO, inviteOrgName: 'NewCo' }
    const notYet = await call(engagements, VAL, 'POST', 'engagements', body)
    assert.equal(notYet.status, 403, 'checks run before inviting: not accredited yet')
    assert.equal((await rows('SELECT 1 FROM invitations')).length, 0)
    await rows(`UPDATE validator_profiles SET accreditation_status='accredited', accredited_until=now()+interval '1 year' WHERE email=$1`, [VAL])
    const sent = await call(engagements, VAL, 'POST', 'engagements', body)
    assert.equal(sent.status, 201, sent.text)
    assert.equal(sent.body.invited, true)
    assert.equal((await rows('SELECT 1 FROM validation_engagements')).length, 0, 'nothing proposed before the workspace exists')

    const ok = await accept(NEWCO, await tokenOf(sent.body.invitationId), 'NewCo')
    assert.equal(ok.status, 200, ok.text)
    assert.ok(ok.body.engagementId)
    assert.equal(ok.body.next, '/engagements')
    const [e] = await rows(`SELECT org_id, status, org_status, validator_status, created_by_side, validator_email FROM validation_engagements`)
    assert.deepEqual(e, { org_id: NEWCO_ORG, status: 'proposed', org_status: 'pending', validator_status: 'accepted', created_by_side: 'validator', validator_email: VAL })
    const seen = await call(engagements, NEWCO, 'GET', 'engagements')
    assert.equal(seen.body.length, 1)
    assert.deepEqual(seen.body[0].can.respondAs, ['organization'], 'the organisation still has to consent')
  })

  it('a network coordinator invites an organisation that is not on CRAFT by email', async () => {
    const net = await call(networks, SUPER, 'POST', 'networks', { name: 'CSO Network', root: { level: 'national', name: 'Nigeria', geoCode: 'NG' } })
    assert.equal(net.status, 201, net.text)
    const id = net.body.id
    const nodeId = net.body.rootId
    const needName = await call(networks, SUPER, 'POST', `networks/${id}/invitations`, { nodeId, org: NEWCO })
    assert.equal(needName.status, 404)
    assert.equal(needName.body.needsOrgName, true)
    const sent = await call(networks, SUPER, 'POST', `networks/${id}/invitations`, { nodeId, org: NEWCO, orgName: 'NewCo' })
    assert.equal(sent.status, 201, sent.text)
    assert.equal(sent.body.invitedByEmail, true)
    const ok = await accept(NEWCO, await tokenOf(sent.body.invitationId), 'NewCo')
    assert.equal(ok.status, 200, ok.text)
    assert.equal(ok.body.next, '/networks')
    const [m] = await rows(`SELECT org_id, status, invited_by FROM network_members WHERE node_id=$1`, [nodeId])
    assert.deepEqual(m, { org_id: NEWCO_ORG, status: 'invited', invited_by: SUPER }, 'the organisation still accepts the membership itself')
  })

  it('an ordinary administrator cannot move anyone (themselves included) into another organisation', async () => {
    const self = await call(usersApi, ADMIN_A, 'POST', 'users', { email: ADMIN_A, orgId: 'org_b', role: 'admin' })
    assert.equal(self.status, 403)
    const poach = await call(usersApi, ADMIN_A, 'POST', 'users', { email: ADMIN_B, orgId: 'org_a', role: 'assessor' })
    assert.equal(poach.status, 403, 'cannot take a person away from another organisation')
    assert.equal((await call(usersApi, ADMIN_A, 'DELETE', `users?email=${encodeURIComponent(ADMIN_B)}`)).status, 403)
    const list = await call(usersApi, ADMIN_A, 'GET', 'users')
    assert.deepEqual(list.body.map((u: any) => u.email).sort(), [ADMIN_A, STAFF_A])
    const fine = await call(usersApi, ADMIN_A, 'POST', 'users', { email: 'new@org-a.example', orgId: 'org_a', role: 'assessor' })
    assert.equal(fine.status, 201, fine.text)
    assert.equal((await rows(`SELECT org_id FROM users WHERE email=$1`, [ADMIN_A]))[0].org_id, 'org_a')
  })

  it("nobody can pre-claim another person's self-registered workspace id", async () => {
    const squat = await call(orgsApi, ADMIN_B, 'POST', 'organizations', { id: NEWCO_ORG, name: 'Mine now' })
    assert.equal(squat.status, 403)
    const own = await call(orgsApi, NEWCO, 'POST', 'organizations', { id: NEWCO_ORG, name: 'NewCo' })
    assert.equal(own.status, 201, own.text)
  })

  it('the inviter or the Super Admin can revoke a pending invitation; others cannot, and it can no longer be accepted', async () => {
    const inv = await invite(ADMIN_A, { kind: 'organization', email: NEWCO, orgName: 'NewCo', send: false })
    assert.equal(inv.status, 201, inv.text)
    const revoke = (email: string) => call(invitations, email, 'PATCH', 'invitations', { id: inv.body.id, status: 'revoked' })
    assert.equal((await revoke(ADMIN_B)).status, 403, 'not their invitation')
    assert.equal((await revoke(ADMIN_A)).status, 200)
    assert.equal((await revoke(SUPER)).status, 404, 'no longer pending')
    assert.notEqual((await accept(NEWCO, await tokenOf(inv.body.id))).status, 200)
  })

  it('a draft can be previewed exactly as it will be sent, by its creator only', async () => {
    const inv = await invite(ADMIN_A, { kind: 'organization', email: NEWCO, orgName: 'NewCo', send: false })
    const preview = (email: string) => call(invitations, email, 'GET', `invitations?preview=${inv.body.id}`)
    const own = await preview(ADMIN_A)
    assert.equal(own.status, 200, own.text)
    assert.match(own.body.subject, /NewCo/)
    assert.equal(own.body.to, NEWCO)
    assert.equal((await preview(ADMIN_B)).status, 403)
  })
})
