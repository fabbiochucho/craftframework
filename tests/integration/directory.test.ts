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

  it('only a platform admin verifies credentials or suspends; nobody grants accreditation by hand', async () => {
    const valId = await makeValidator()
    const cred = (await call(VAL, 'POST', 'directory/me/credentials', { body: 'ACCA', membershipNumber: 'A-1' })).body.id
    for (const user of [VAL, ALICE]) {
      assert.equal((await call(user, 'PUT', `directory/admin/credentials/${cred}`, { verified: true })).status, 403)
      assert.equal((await call(user, 'PUT', `directory/admin/validators/${valId}`, { action: 'reinstate', reason: 'self' })).status, 403)
    }
    let profile = await call(ALICE, 'GET', `directory/validators/${valId}`)
    assert.equal(profile.body.credentials[0].status, 'self-declared')
    assert.equal(profile.body.accreditation, 'registered')
    assert.equal(profile.body.statusReason, undefined, 'reason is admin-only')

    assert.equal((await call(ADMIN, 'PUT', `directory/admin/credentials/${cred}`, { verified: true })).status, 200)
    assert.equal((await call(ADMIN, 'PUT', `directory/admin/validators/${valId}`, { status: 'accredited', reason: 'Trusted' })).status, 400, 'no manual accreditation')
    assert.equal((await call(ADMIN, 'PUT', `directory/admin/validators/${valId}`, { pilotAccredited: true, reason: 'Pilot' })).status, 400, 'no pilot switch')
    profile = await call(ALICE, 'GET', `directory/validators/${valId}`)
    assert.equal(profile.body.credentials[0].status, 'verified')
    assert.equal(profile.body.credentials[0].membershipNumber, 'A-1', 'membership numbers are public')
    assert.equal(profile.body.accreditation, 'registered', 'no badge until the training is done')
    assert.equal(profile.body.level, 'Associate')

    assert.equal((await call(ADMIN, 'PUT', `directory/admin/validators/${valId}`, { action: 'suspend' })).status, 400, 'reason required')
    assert.equal((await call(ADMIN, 'PUT', `directory/admin/validators/${valId}`, { action: 'suspend', reason: 'Complaint upheld' })).status, 200)
    assert.equal((await call(ALICE, 'GET', `directory/validators/${valId}`)).body.accreditation, 'suspended')
    assert.equal((await call(ADMIN, 'GET', `directory/validators/${valId}`)).body.statusReason, 'Complaint upheld')
    const log = await rows("SELECT actor, action FROM audit_logs WHERE category='Accreditation' ORDER BY id")
    assert.equal(log.length, 2)
    assert.ok(log.every((l: any) => l.actor === ADMIN))
    assert.match(log[1].action, /suspended.*Complaint upheld/)
    const found = (await call(ALICE, 'GET', 'directory/search?type=validators')).body.find((r: any) => r.id === valId)
    assert.equal(found?.accreditation, 'suspended', 'suspended validators stay searchable, with a badge')
    assert.equal((await call(ADMIN, 'PUT', `directory/admin/validators/${valId}`, { action: 'reinstate', reason: 'Panel: complaint dismissed on appeal' })).status, 200)
    assert.equal((await call(ALICE, 'GET', `directory/validators/${valId}`)).body.accreditation, 'registered', 'reinstating does not grant accreditation')
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
})
