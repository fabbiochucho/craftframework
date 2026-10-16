import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const directory = await load('directory')
const firmsApi = await load('firms')
const engagements = await load('engagements')
const legacyState = await load('legacy-state')

const ALICE = 'alice@org-a.example' // organisation A staff
const BOB = 'bob@org-b.example' // organisation B staff
const VAL = 'val@validators.example' // accredited validator, owner of the firm
const VAL2 = 'val2@validators.example' // accredited firm member, never named
const NOVICE = 'novice@validators.example' // registered, not accredited, firm member
const FUND = 'fund@capital.example'
const ADMIN = 'fabbiochucho@gmail.com'

async function call(email: string | null, method: string, path: string, body?: unknown, handler = engagements) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}
const eng = (email: string | null, method: string, path: string, body?: unknown) => call(email, method, `engagements${path}`, body)
const readOrg = (email: string, org = 'org_a') => {
  ;(globalThis as any).__craftTestIdentity = { email }
  return legacyState(new Request(`http://localhost/api/legacy-state?orgId=${org}&key=capital:scores`)).then((r: Response) => r.status)
}
const grants = () => rows("SELECT grantee, role, level, status, expires_at FROM access_grants WHERE role='craft_validator' ORDER BY grantee")

async function profile(email: string, name: string, accredited: boolean) {
  const r = await call(email, 'PUT', 'directory/me/validator', { name, competencies: ['Audit'] }, directory)
  assert.equal(r.status, 200, r.text)
  if (accredited) await rows("UPDATE validator_profiles SET accreditation_status='accredited', accredited_until = now() + interval '1 year' WHERE email=$1", [email])
  return r.body.id as string
}

let valId: string
let firmId: string
let funderId: string
let orgProfile: string

describe('validator engagements', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country,sector) VALUES('org_a','Acme Cooperative','Kenya','Agriculture'),('org_b','Hidden Trust','Kenya','Health')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
    await rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('org_a','capital:scores','{}'),('org_b','capital:scores','{}')`)
    valId = await profile(VAL, 'Valerie Okafor', true)
    await profile(VAL2, 'Victor Mensah', true)
    await profile(NOVICE, 'Nina Novice', false)
    const f = await call(VAL, 'POST', 'firms', { name: 'Okafor & Co', kind: 'validator_firm', nature: 'Audit firm' }, firmsApi)
    firmId = f.body.id
    for (const m of [VAL2, NOVICE]) {
      await call(VAL, 'PUT', 'firms', { firmId, email: m }, firmsApi)
      await call(m, 'PUT', 'firms', { firmId, email: m, status: 'active' }, firmsApi)
    }
    const fu = await call(FUND, 'POST', 'firms', { name: 'Savannah Capital', kind: 'funding_partner', nature: 'DFI' }, firmsApi)
    funderId = fu.body.id
    await call(ALICE, 'PUT', 'directory/me/organization', { listed: true, summary: 'Co-op' }, directory)
    orgProfile = (await rows("SELECT id FROM org_directory_profiles WHERE org_id='org_a'"))[0].id
  })

  const sign = (email: string, id: string) => eng(email, 'POST', `/${id}/declaration`, { confirmed: true, signedName: 'Signed Name' })
  async function orgInvitesValidator() {
    const r = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: valId, scope: { kind: 'levels', levels: [1, 2] } })
    assert.equal(r.status, 201, r.text)
    return r.body.id as string
  }

  it('opens access only after every party accepts, the organisation consents and the member signs', async () => {
    // Validator requests; the organisation has not consented yet.
    const created = await eng(VAL, 'POST', '', { side: 'validator', type: 'independent_validation', organizationProfileId: orgProfile })
    assert.equal(created.status, 201, created.text)
    const id = created.body.id
    assert.equal(await readOrg(VAL), 403, 'nothing before consent')
    assert.equal((await sign(VAL, id)).status, 200)
    assert.equal(await readOrg(VAL), 403, 'declaration alone opens nothing without org consent')
    assert.equal((await grants()).length, 0)
    // Only the organisation's staff consent; the validator cannot consent for the organisation.
    assert.equal((await eng(VAL, 'POST', `/${id}/respond`, { side: 'organization', decision: 'accept' })).status, 403)
    assert.equal((await eng(BOB, 'POST', `/${id}/respond`, { side: 'organization', decision: 'accept' })).status, 404)
    assert.equal((await eng(ALICE, 'POST', `/${id}/respond`, { side: 'organization', decision: 'accept' })).status, 200)
    assert.equal(await readOrg(VAL), 200, 'org consent + signed declaration opens read access')
    const [g] = await grants()
    assert.deepEqual([g.grantee, g.level, g.status], [VAL, 'read', 'active'])
    assert.ok(g.expires_at && g.expires_at.getTime() > Date.now(), 'expiry is mandatory')
    // Read-only: never writes.
    ;(globalThis as any).__craftTestIdentity = { email: VAL }
    const put = await legacyState(new Request('http://localhost/api/legacy-state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orgId: 'org_a', key: 'capital:scores', value: {} }) }))
    assert.equal(put.status, 403)
    const actions = (await rows("SELECT actor, action FROM audit_logs WHERE category='Engagement' ORDER BY id")).map((r: any) => r.action)
    assert.ok(actions.some((a: string) => /created/.test(a)) && actions.some((a: string) => /signed declaration/.test(a)) && actions.some((a: string) => /accepted/.test(a)) && actions.some((a: string) => /granted read-only/.test(a)), actions.join(' | '))
    const [decl] = await rows('SELECT version, signed_name, text FROM engagement_declarations')
    assert.match(decl.version, /^independence-/)
    assert.match(decl.text, /no ownership, employment or advisory ties/)
  })

  it('declaration first is not enough: the order does not matter but both are needed', async () => {
    const id = await orgInvitesValidator() // org already consented by creating
    assert.equal(await readOrg(VAL), 403, 'validator has not accepted or signed')
    assert.equal((await eng(VAL, 'POST', `/${id}/respond`, { side: 'validator', decision: 'accept' })).status, 200)
    assert.equal(await readOrg(VAL), 403, 'accepted but declaration unsigned')
    assert.equal((await sign(VAL, id)).status, 200)
    assert.equal(await readOrg(VAL), 200)
  })

  it('refuses a firm member who is not named on the engagement, and a person with an expired grant', async () => {
    const r = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorFirmId: firmId })
    const id = r.body.id
    assert.equal((await eng(VAL, 'POST', `/${id}/respond`, { side: 'validator', decision: 'accept' })).status, 200)
    assert.equal((await eng(VAL, 'POST', `/${id}/members`, { email: VAL, role: 'lead' })).status, 200)
    assert.equal((await sign(VAL, id)).status, 200)
    assert.equal(await readOrg(VAL), 403, 'the organisation has not yet approved this named member')
    assert.equal((await eng(ALICE, 'POST', `/${id}/members/${VAL}/approve`)).status, 200)
    assert.equal(await readOrg(VAL), 200)
    // VAL2 is in the firm but not named: firm membership alone grants nothing.
    assert.equal(await readOrg(VAL2), 403)
    assert.equal((await sign(VAL2, id)).status, 403, 'an unnamed member cannot sign in')
    // Someone outside the firm cannot be named.
    assert.equal((await eng(VAL, 'POST', `/${id}/members`, { email: 'stranger@x.example' })).status, 400)
    // Expiry: once the window ends the access is refused and the engagement flips to expired.
    await rows("UPDATE validation_engagements SET expires_at = now() - interval '1 minute'")
    await rows("UPDATE access_grants SET expires_at = now() - interval '1 minute'")
    assert.equal(await readOrg(VAL), 403)
    assert.equal((await eng(ALICE, 'GET', `/${id}`)).body.status, 'expired')
    assert.equal((await grants())[0].status, 'revoked')
    // Members added after the organisation consented need its approval before anything opens.
    const r2 = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorFirmId: firmId })
    await eng(VAL, 'POST', `/${r2.body.id}/respond`, { side: 'validator', decision: 'accept' })
    await eng(VAL, 'POST', `/${r2.body.id}/members`, { email: VAL2 })
    await sign(VAL2, r2.body.id)
    assert.equal(await readOrg(VAL2), 403, 'awaiting the organisation\'s approval of this member')
    assert.equal((await eng(VAL, 'POST', `/${r2.body.id}/members/${VAL2}/approve`)).status, 403, 'the firm cannot approve its own member')
    assert.equal((await eng(ALICE, 'POST', `/${r2.body.id}/members/${VAL2}/approve`)).status, 200)
    assert.equal(await readOrg(VAL2), 200)
  })

  it('funder staff can only create a funder review; the funder is told of a decline, not why', async () => {
    const bad = await eng(FUND, 'POST', '', { side: 'funder', type: 'independent_validation', funderFirmId: funderId, organizationProfileId: orgProfile })
    assert.equal(bad.status, 403)
    assert.equal((await rows('SELECT 1 FROM validation_engagements')).length, 0)
    // A person who is not on the funder's staff cannot act for it.
    assert.equal((await eng(BOB, 'POST', '', { side: 'funder', type: 'funder_review', funderFirmId: funderId, organizationProfileId: orgProfile })).status, 403)
    const ok = await eng(FUND, 'POST', '', { side: 'funder', type: 'funder_review', funderFirmId: funderId, organizationProfileId: orgProfile, requiresRereview: true })
    assert.equal(ok.status, 201, ok.text)
    const id = ok.body.id
    assert.equal(ok.body.type, undefined)
    const detail = await eng(FUND, 'GET', `/${id}`)
    assert.equal(detail.body.type, 'funder_review')
    assert.equal(detail.body.label.statement, 'Reviewed by Savannah Capital')
    // Cannot be forced into an independent validation by the database either.
    await assert.rejects(rows("UPDATE validation_engagements SET type='independent_validation'"))
    assert.equal((await eng(ALICE, 'POST', `/${id}/respond`, { side: 'organization', decision: 'decline', reason: 'Too soon after our audit' })).status, 200)
    const forFunder = await eng(FUND, 'GET', `/${id}`)
    assert.equal(forFunder.body.status, 'declined')
    assert.equal(forFunder.body.declined.side, 'organization')
    assert.equal(forFunder.body.declined.reason, null)
    assert.ok(!forFunder.text.includes('Too soon'), 'reason never reaches the funder')
    assert.equal((await eng(ALICE, 'GET', `/${id}`)).body.declined.reason, 'Too soon after our audit')
    assert.equal(await readOrg(FUND), 403)
  })

  it('a funder review opens for named funder staff once the organisation consents and they sign', async () => {
    const id = (await eng(FUND, 'POST', '', { side: 'funder', type: 'funder_review', funderFirmId: funderId, organizationProfileId: orgProfile })).body.id
    assert.equal((await eng(FUND, 'POST', `/${id}/members`, { email: 'outsider@x.example' })).status, 400, 'funder review teams are the funder\'s own staff')
    assert.equal((await eng(FUND, 'POST', `/${id}/members`, { email: FUND, role: 'lead' })).status, 200)
    await sign(FUND, id)
    await eng(ALICE, 'POST', `/${id}/respond`, { side: 'organization', decision: 'accept' })
    assert.equal(await readOrg(FUND), 200)
    assert.equal((await rows("SELECT type FROM validation_engagements"))[0].type, 'funder_review')
  })

  it('a non-accredited validator cannot join an independent validation', async () => {
    const noviceId = (await rows('SELECT id FROM validator_profiles WHERE email=$1', [NOVICE]))[0].id
    assert.equal((await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: noviceId })).status, 403)
    assert.equal((await eng(NOVICE, 'POST', '', { side: 'validator', type: 'independent_validation', organizationProfileId: orgProfile })).status, 403)
    // Via a firm: the firm is engaged but the registered member cannot be named.
    const id = (await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorFirmId: firmId })).body.id
    await eng(VAL, 'POST', `/${id}/respond`, { side: 'validator', decision: 'accept' })
    assert.equal((await eng(VAL, 'POST', `/${id}/members`, { email: NOVICE })).status, 403)
    assert.equal((await eng(ALICE, 'POST', `/${id}/members`, { email: NOVICE })).status, 403)
    // Neither is the legacy pilot switch, nor a lapsed accreditation (accredited_until in the past).
    await rows("UPDATE validator_profiles SET pilot_accredited=true WHERE email=$1", [NOVICE])
    assert.equal((await eng(VAL, 'POST', `/${id}/members`, { email: NOVICE })).status, 403)
    await rows("UPDATE validator_profiles SET accreditation_status='accredited', accredited_until = now() - interval '1 day' WHERE email=$1", [NOVICE])
    assert.equal((await eng(VAL, 'POST', `/${id}/members`, { email: NOVICE })).status, 403, 'lapsed is not accredited')
    // Suspension after joining removes access.
    await eng(VAL, 'POST', `/${id}/members`, { email: VAL })
    await eng(ALICE, 'POST', `/${id}/members/${VAL}/approve`)
    await sign(VAL, id)
    assert.equal(await readOrg(VAL), 200)
    const vid = (await rows('SELECT id FROM validator_profiles WHERE email=$1', [VAL]))[0].id
    assert.equal((await call(ADMIN, 'PUT', `directory/admin/validators/${vid}`, { status: 'suspended', reason: 'Complaint upheld' }, directory)).status, 200)
    assert.equal(await readOrg(VAL), 403)
    const detail = await eng(ALICE, 'GET', `/${id}`)
    assert.match(detail.body.label.statement, /^Review by Valerie Okafor/)
  })

  it('access ends when a validator\'s accreditation lapses', async () => {
    const id = await orgInvitesValidator()
    await eng(VAL, 'POST', `/${id}/respond`, { side: 'validator', decision: 'accept' })
    await sign(VAL, id)
    assert.equal(await readOrg(VAL), 200)
    await rows("UPDATE validator_profiles SET accredited_until = now() - interval '1 day' WHERE email=$1", [VAL])
    await eng(ALICE, 'GET', '') // any engagement request re-checks active validator grants
    assert.equal(await readOrg(VAL), 403)
    assert.equal((await grants())[0].status, 'revoked')
  })

  it('organisations cannot see other organisations\' engagements', async () => {
    const id = await orgInvitesValidator()
    assert.equal((await eng(BOB, 'GET', `/${id}`)).status, 404)
    assert.deepEqual((await eng(BOB, 'GET', '')).body, [])
    for (const [m, p, b] of [['POST', `/${id}/cancel`, {}], ['POST', `/${id}/respond`, { side: 'organization', decision: 'decline' }], ['POST', `/${id}/members`, { email: VAL2 }]] as const) {
      assert.equal((await eng(BOB, m, p, b)).status, 404, p)
    }
    assert.equal((await eng(ALICE, 'GET', '')).body.length, 1)
    assert.equal((await eng(VAL, 'GET', '')).body.length, 1)
    assert.equal((await eng(null, 'GET', '')).status, 401)
    assert.ok(!JSON.stringify((await eng(VAL, 'GET', '')).body).includes('org_a'), 'internal org ids never exposed')
    // An unrelated validator or funder sees nothing either.
    assert.deepEqual((await eng(VAL2, 'GET', '')).body, [])
    assert.deepEqual((await eng(FUND, 'GET', '')).body, [])
  })

  it('cancelling revokes every grant, and a person can be re-engaged afterwards', async () => {
    const id = await orgInvitesValidator()
    await eng(VAL, 'POST', `/${id}/respond`, { side: 'validator', decision: 'accept' })
    await sign(VAL, id)
    assert.equal(await readOrg(VAL), 200)
    assert.equal((await eng(BOB, 'POST', `/${id}/cancel`, {})).status, 404)
    assert.equal((await eng(VAL2, 'POST', `/${id}/cancel`, {})).status, 404)
    assert.equal((await eng(ALICE, 'POST', `/${id}/cancel`, { reason: 'Changed plans' })).status, 200)
    assert.equal(await readOrg(VAL), 403)
    assert.equal((await grants())[0].status, 'revoked')
    assert.equal((await eng(ALICE, 'POST', `/${id}/cancel`, {})).status, 409)
    assert.match((await rows("SELECT action FROM audit_logs WHERE action ~ 'revoked validator access'"))[0].action, /val@validators/)
    // Re-engagement reuses the single (org, grantee) row; nothing opens until the new declaration.
    const id2 = await orgInvitesValidator()
    await eng(VAL, 'POST', `/${id2}/respond`, { side: 'validator', decision: 'accept' })
    assert.equal(await readOrg(VAL), 403)
    await sign(VAL, id2)
    assert.equal(await readOrg(VAL), 200)
    assert.equal((await grants()).length, 1)
    // Two engagements at once: cancelling one keeps the access the other still entitles.
    const id3 = await orgInvitesValidator()
    await eng(VAL, 'POST', `/${id3}/respond`, { side: 'validator', decision: 'accept' })
    await sign(VAL, id3)
    await eng(ALICE, 'POST', `/${id2}/cancel`, {})
    assert.equal(await readOrg(VAL), 200)
    await eng(ALICE, 'POST', `/${id3}/cancel`, {})
    assert.equal(await readOrg(VAL), 403)
  })

  it('a person with an existing access relationship to the organisation cannot validate it', async () => {
    await rows("INSERT INTO access_grants(id,org_id,grantee,level,status) VALUES('g1','org_a',$1,'write','active')", [VAL])
    assert.equal((await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: valId })).status, 409)
    assert.equal((await eng(VAL, 'POST', '', { side: 'validator', type: 'independent_validation', organizationProfileId: orgProfile })).status, 409)
    const row = (await rows("SELECT level, role, status FROM access_grants WHERE id='g1'"))[0]
    assert.deepEqual(row, { level: 'write', role: null, status: 'active' }, 'the existing grant is untouched')
    // The organisation's own staff are never validators of it.
    const aliceProfile = await profile(ALICE, 'Alice A', true)
    assert.equal((await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: aliceProfile })).status, 409)
  })

  it('requires a signed declaration with a funder disclosure when engaged or paid by a funder', async () => {
    const id = await orgInvitesValidator()
    await eng(VAL, 'POST', `/${id}/respond`, { side: 'validator', decision: 'accept' })
    assert.equal((await eng(VAL, 'POST', `/${id}/declaration`, { confirmed: false, signedName: 'V' })).status, 400)
    assert.equal((await eng(VAL, 'POST', `/${id}/declaration`, { confirmed: true, signedName: 'V', fundedDisclosure: true })).status, 400)
    assert.equal((await eng(ALICE, 'POST', `/${id}/declaration`, { confirmed: true, signedName: 'A' })).status, 403, 'only a named member signs')
    assert.equal((await eng(VAL, 'POST', `/${id}/declaration`, { confirmed: true, signedName: 'Valerie', fundedDisclosure: true, disclosure: 'Paid by Savannah Capital' })).status, 200)
    assert.equal((await eng(VAL, 'POST', `/${id}/declaration`, { confirmed: true, signedName: 'Valerie' })).status, 409, 'signed once per version')
    assert.equal((await rows('SELECT disclosure FROM engagement_declarations'))[0].disclosure, 'Paid by Savannah Capital')
  })
})
