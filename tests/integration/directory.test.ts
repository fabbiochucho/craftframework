import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const directory = (await import(new URL('../../netlify/functions/directory.mts', import.meta.url).href)).default
const firmsApi = (await import(new URL('../../netlify/functions/firms.mts', import.meta.url).href)).default

const ALICE = 'alice@org-a.example' // organisation A (opts in)
const BOB = 'bob@org-b.example' // organisation B (never opts in)
const VAL = 'val@validators.example'
const FUND = 'fund@capital.example'
const ADMIN = 'fabbiochucho@gmail.com' // the platform admin allowlist

async function call(email: string | null, method: string, path: string, body?: unknown, handler = directory) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}

async function makeValidator(email = VAL, name = 'Valerie Okafor') {
  const res = await call(email, 'PUT', 'directory/me/validator', { name, competencies: ['Audit'], countries: ['Kenya'] })
  assert.equal(res.status, 200, res.text)
  return res.body.id as string
}

async function makeFunder() {
  const res = await call(FUND, 'POST', 'firms', { name: 'Savannah Capital', kind: 'funding_partner', nature: 'DFI', countries: ['Kenya'] }, firmsApi)
  assert.equal(res.status, 201, res.text)
  return res.body.id as string
}

describe('validator directory', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country,sector) VALUES('org_a','Acme Cooperative','Kenya','Agriculture'),('org_b','Hidden Trust','Kenya','Health')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
  })

  it('refuses unauthenticated requests', async () => {
    for (const [m, p] of [['GET', 'directory/me'], ['GET', 'directory/search?type=validators'], ['PUT', 'directory/me/validator'],
      ['PUT', 'directory/me/organization'], ['PUT', 'directory/admin/validators/x'], ['GET', 'directory/validators/x']]) {
      assert.equal((await call(null, m, p, m === 'GET' ? undefined : {})).status, 401, `${m} ${p}`)
    }
    assert.equal((await call(null, 'PATCH', 'firms', { firmId: 'x' }, firmsApi)).status, 401)
  })

  it('only the owner edits a profile', async () => {
    const valId = await makeValidator()
    // Another user's PUT edits their own (new) profile, never Val's.
    const bobId = await makeValidator(BOB, 'Bob')
    assert.notEqual(bobId, valId)
    assert.equal((await call(ALICE, 'GET', `directory/validators/${valId}`)).body.name, 'Valerie Okafor')
    // Credentials: only the owner removes theirs.
    const cred = await call(VAL, 'POST', 'directory/me/credentials', { body: 'ICAN', membershipNumber: '12345' })
    assert.equal(cred.status, 201)
    assert.equal((await call(BOB, 'DELETE', `directory/me/credentials/${cred.body.id}`)).status, 404)
    assert.equal((await call(VAL, 'DELETE', `directory/me/credentials/${cred.body.id}`)).status, 200)
    // Firm profiles: only the firm owner, not another user and not the platform admin.
    const firm = await call(VAL, 'POST', 'firms', { name: 'Okafor & Co', kind: 'validator_firm', nature: 'Audit firm' }, firmsApi)
    assert.equal(firm.status, 201)
    const edit = { firmId: firm.body.id, nature: 'Consulting firm', summary: 'Updated' }
    assert.equal((await call(BOB, 'PATCH', 'firms', edit, firmsApi)).status, 403)
    assert.equal((await call(ADMIN, 'PATCH', 'firms', edit, firmsApi)).status, 403)
    assert.equal((await call(VAL, 'PATCH', 'firms', edit, firmsApi)).status, 200)
    assert.equal((await call(VAL, 'PATCH', 'firms', { ...edit, nature: 'DFI' }, firmsApi)).status, 400, 'funder type is not a firm nature')
    const [row] = await rows('SELECT nature, summary FROM firms')
    assert.deepEqual(row, { nature: 'Consulting firm', summary: 'Updated' })
    // The firm profile shows team members by name only.
    const pub = await call(ALICE, 'GET', `directory/firms/${firm.body.id}`)
    assert.deepEqual(pub.body.team, [{ id: valId, name: 'Valerie Okafor' }])
    assert.ok(!pub.text.includes(VAL), 'no email on a brief profile')
    // A team member added by the owner is only listed once they accept.
    const add = await call(VAL, 'PUT', 'firms', { firmId: firm.body.id, email: BOB }, firmsApi)
    assert.equal(add.body.status, 'invited')
    assert.equal((await call(ALICE, 'GET', `directory/firms/${firm.body.id}`)).body.team.length, 1)
    assert.equal((await call(ALICE, 'PUT', 'firms', { firmId: firm.body.id, email: BOB, status: 'active' }, firmsApi)).status, 403)
    assert.equal((await call(BOB, 'PUT', 'firms', { firmId: firm.body.id, email: BOB, status: 'active' }, firmsApi)).status, 200)
    assert.equal((await call(ALICE, 'GET', `directory/firms/${firm.body.id}`)).body.team.length, 2)
    // Only the organisation itself changes its listing.
    assert.equal((await call(BOB, 'PUT', 'directory/me/organization', { listed: true })).status, 200)
    assert.equal((await rows("SELECT org_id FROM org_directory_profiles"))[0].org_id, 'org_b')
  })

  it('only a platform admin verifies credentials, suspends or reinstates', async () => {
    const valId = await makeValidator()
    const cred = (await call(VAL, 'POST', 'directory/me/credentials', { body: 'ACCA', membershipNumber: 'A-1' })).body.id
    for (const user of [VAL, ALICE]) {
      assert.equal((await call(user, 'PUT', `directory/admin/credentials/${cred}`, { verified: true })).status, 403)
      assert.equal((await call(user, 'PUT', `directory/admin/validators/${valId}`, { status: 'suspended', reason: 'self' })).status, 403)
    }
    let profile = await call(ALICE, 'GET', `directory/validators/${valId}`)
    assert.equal(profile.body.credentials[0].status, 'self-declared')
    assert.equal(profile.body.accreditation, 'registered')
    assert.equal(profile.body.accreditationReason, undefined, 'reason is admin-only')

    assert.equal((await call(ADMIN, 'PUT', `directory/admin/credentials/${cred}`, { verified: true })).status, 200)
    profile = await call(ALICE, 'GET', `directory/validators/${valId}`)
    assert.equal(profile.body.credentials[0].status, 'verified')

    // The admin can only suspend or reinstate: no manual or pilot accreditation, by any field.
    for (const body of [{ status: 'accredited', reason: 'Pilot cohort' }, { pilotAccredited: true, reason: 'Pilot cohort' },
      { status: 'suspended', accreditedUntil: '2099-01-01', reason: 'x' }, { accreditedUntil: '2099-01-01', reason: 'x' }]) {
      assert.equal((await call(ADMIN, 'PUT', `directory/admin/validators/${valId}`, body)).status, 400, JSON.stringify(body))
    }
    assert.equal((await call(ADMIN, 'PUT', `directory/admin/validators/${valId}`, { status: 'registered', reason: 'Reinstating' })).body.accreditation, 'registered', 'reinstating never grants accreditation')
    assert.equal((await rows('SELECT accredited_until FROM validator_profiles'))[0].accredited_until, null)
    assert.equal((await call(ALICE, 'GET', `directory/validators/${valId}`)).body.level, 'Associate')

    assert.equal((await call(ADMIN, 'PUT', `directory/admin/validators/${valId}`, { status: 'suspended' })).status, 400, 'reason required')
    assert.equal((await call(ADMIN, 'PUT', `directory/admin/validators/${valId}`, { status: 'suspended', reason: 'Complaint upheld' })).status, 200)
    assert.equal((await call(ALICE, 'GET', `directory/validators/${valId}`)).body.accreditation, 'suspended')
    assert.equal((await call(ADMIN, 'GET', `directory/validators/${valId}`)).body.accreditationReason, 'Complaint upheld')
    const log = await rows("SELECT actor, action FROM audit_logs WHERE category='Accreditation' ORDER BY id")
    assert.equal(log.length, 3)
    assert.ok(log.every((l: any) => l.actor === ADMIN))
    assert.match(log[2].action, /suspended.*Complaint upheld/)
    // Re-declaring a membership never inherits a verification.
    await call(VAL, 'DELETE', `directory/me/credentials/${cred}`)
    await call(VAL, 'POST', 'directory/me/credentials', { body: 'ACCA', membershipNumber: 'A-2' })
    assert.equal((await call(VAL, 'GET', 'directory/me')).body.validator.credentials[0].status, 'self-declared')
  })

  it('a non-opted-in organisation never appears in search', async () => {
    await makeFunder()
    await makeValidator()
    assert.equal((await call(ALICE, 'PUT', 'directory/me/organization', { listed: true, summary: 'Smallholder co-op' })).status, 200)
    assert.equal((await call(BOB, 'PUT', 'directory/me/organization', { listed: false })).status, 200)

    const found = await call(FUND, 'GET', 'directory/search?type=organizations')
    assert.equal(found.status, 200)
    assert.deepEqual(found.body.map((o: any) => o.name), ['Acme Cooperative'])
    assert.ok(!found.text.includes('org_a') && !found.text.includes('org_b'), 'internal org ids are never exposed')
    assert.equal((await call(FUND, 'GET', 'directory/search?type=organizations&q=hidden')).body.length, 0)
    assert.equal((await call(FUND, 'GET', `directory/organizations/${found.body[0].id}`)).status, 200)
    const hiddenId = (await rows("SELECT id FROM org_directory_profiles WHERE org_id='org_b'"))[0].id
    assert.equal((await call(FUND, 'GET', `directory/organizations/${hiddenId}`)).status, 404)

    // Opting out removes it again.
    await call(ALICE, 'PUT', 'directory/me/organization', { listed: false })
    assert.equal((await call(FUND, 'GET', 'directory/search?type=organizations')).body.length, 0)

    // Organisations search validators and funders, but not other organisations.
    assert.equal((await call(ALICE, 'GET', 'directory/search?type=organizations')).status, 403)
    assert.equal((await call(ALICE, 'GET', `directory/organizations/${found.body[0].id}`)).status, 403)
    assert.equal((await call(ALICE, 'GET', 'directory/search?type=funders&country=kenya')).body[0].nature, 'DFI')
    const vals = await call(FUND, 'GET', 'directory/search?type=validators&q=audit')
    assert.deepEqual(vals.body.map((v: any) => v.name), ['Valerie Okafor'])
    assert.ok(!vals.text.includes(VAL))
  })

  describe('organisation listing proposals', () => {
    const CONSULT = 'consult@advisors.example'
    const insertGrant = (grantee: string, orgId: string, extra = "'read', NULL, NULL, 'active'") =>
      rows(`INSERT INTO access_grants(id,org_id,grantee,level,role,expires_at,status) VALUES('g_${grantee}_${orgId}','${orgId}','${grantee}',${extra})`)
    const searchable = async () => (await call(FUND, 'GET', 'directory/search?type=organizations')).body.map((o: any) => o.name)

    it('a consultant without a grant cannot propose', async () => {
      await makeFunder()
      const res = await call(CONSULT, 'POST', 'directory/proposals', { orgId: 'org_a', summary: 'Smallholder co-op' })
      assert.equal(res.status, 403)
      // A grant to a different organisation does not help, nor does a pending or revoked one.
      await insertGrant(CONSULT, 'org_b')
      assert.equal((await call(CONSULT, 'POST', 'directory/proposals', { orgId: 'org_a', summary: 'x' })).status, 403)
      await insertGrant(CONSULT, 'org_a', "'read', NULL, NULL, 'revoked'")
      assert.equal((await call(CONSULT, 'POST', 'directory/proposals', { orgId: 'org_a', summary: 'x' })).status, 403)
      assert.equal((await rows('SELECT 1 FROM org_listing_proposals')).length, 0)
    })

    it('a proposal does not go live until the organisation approves, and one is pending at a time', async () => {
      await makeFunder()
      await insertGrant(CONSULT, 'org_a')
      const res = await call(CONSULT, 'POST', 'directory/proposals', { orgId: 'org_a', summary: 'Draft by consultant' })
      assert.equal(res.status, 201, res.text)
      assert.deepEqual(await searchable(), [], 'proposed, so not searchable')
      assert.equal((await rows('SELECT 1 FROM org_directory_profiles WHERE listed')).length, 0)
      assert.equal((await call(CONSULT, 'POST', 'directory/proposals', { orgId: 'org_a', summary: 'Second' })).status, 409)

      // The consultant cannot approve their own proposal; nor can other organisations' staff.
      const id = res.body.id
      assert.equal((await call(CONSULT, 'POST', `directory/proposals/${id}/approve`, {})).status, 403)
      assert.equal((await call(BOB, 'POST', `directory/proposals/${id}/approve`, {})).status, 404)
      assert.equal((await call(BOB, 'POST', `directory/proposals/${id}/reject`, {})).status, 404)
      assert.deepEqual(await searchable(), [])

      // The organisation sees it on its profile and approves, editing the summary.
      const mine = await call(ALICE, 'GET', 'directory/me')
      assert.equal(mine.body.proposals.length, 1)
      assert.equal((await call(BOB, 'GET', 'directory/me')).body.proposals.length, 0)
      assert.equal((await call(ALICE, 'POST', `directory/proposals/${id}/approve`, { summary: 'Edited by Acme' })).status, 200)
      assert.deepEqual(await searchable(), ['Acme Cooperative'])
      assert.equal((await rows('SELECT summary FROM org_directory_profiles'))[0].summary, 'Edited by Acme')
      assert.equal((await call(ALICE, 'POST', `directory/proposals/${id}/approve`, {})).status, 409, 'already decided')
      // A new proposal is possible once the first is decided.
      assert.equal((await call(CONSULT, 'POST', 'directory/proposals', { orgId: 'org_a', summary: 'Again' })).status, 201)
      const log = await rows("SELECT actor, action, org_id FROM audit_logs WHERE category='Directory' AND action ~ 'listing' ORDER BY id")
      assert.deepEqual(log.map((l: any) => l.actor), [CONSULT, ALICE, CONSULT])
      assert.match(log[0].action, /proposed/)
      assert.match(log[1].action, /approved/)
      assert.ok(log.every((l: any) => l.org_id === 'org_a'))
    })

    it('a rejected proposal never lists the organisation', async () => {
      await makeFunder()
      await insertGrant(CONSULT, 'org_a')
      const { body } = await call(CONSULT, 'POST', 'directory/proposals', { orgId: 'org_a', summary: 'Draft' })
      assert.equal((await call(ALICE, 'POST', `directory/proposals/${body.id}/reject`, { reason: 'Not ready' })).status, 200)
      assert.deepEqual(await searchable(), [])
      assert.equal((await rows('SELECT 1 FROM org_directory_profiles WHERE listed')).length, 0)
      assert.equal((await call(ALICE, 'POST', `directory/proposals/${body.id}/approve`, {})).status, 409, 'a rejected proposal cannot be approved later')
      assert.deepEqual(await searchable(), [])
      const outgoing = await call(CONSULT, 'GET', 'directory/proposals')
      assert.deepEqual(outgoing.body.map((p: any) => [p.status, p.reason]), [['rejected', 'Not ready']])
      assert.equal((await call(ALICE, 'GET', 'directory/me')).body.proposals.length, 0)
      const log = await rows("SELECT action FROM audit_logs WHERE action ~ 'rejected'")
      assert.match(log[0].action, /Not ready/)
    })

    it('a time-limited specialised grant and the org itself cannot propose; the proposer can withdraw', async () => {
      await insertGrant('validator@v.example', 'org_a', "'read', 'frcn_auditor', now() + interval '30 days', 'active'")
      assert.equal((await call('validator@v.example', 'POST', 'directory/proposals', { orgId: 'org_a', summary: 'x' })).status, 403)
      assert.equal((await call(ALICE, 'POST', 'directory/proposals', { orgId: 'org_a', summary: 'x' })).status, 400, 'own staff list directly')
      await insertGrant(CONSULT, 'org_a')
      const { body } = await call(CONSULT, 'POST', 'directory/proposals', { orgId: 'org_a', summary: 'x' })
      assert.equal((await call(ALICE, 'DELETE', `directory/proposals/${body.id}`)).status, 403, 'only the proposer withdraws')
      assert.equal((await call(CONSULT, 'DELETE', `directory/proposals/${body.id}`)).status, 200)
      assert.equal((await call(CONSULT, 'POST', 'directory/proposals', { orgId: 'org_a', summary: 'y' })).status, 201)
    })
  })
})
