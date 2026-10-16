import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { beforeEach, describe, it } from 'node:test'
import { extractText, getDocumentProxy } from 'unpdf'
import { rows, truncateAll } from './harness.ts'
import { FRAMEWORKS } from '../../src/lib/validationReview.ts'
import { VERIFICATION_ID_RE } from '../../src/lib/validationStatement.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const directory = await load('directory')
const engagements = await load('engagements')
const reviews = await load('validation-reviews')
const lifecycle = await load('validations')
const publicApi = await load('public-validation')
const firmsApi = await load('firms')

const ALICE = 'alice@org-a.example'
const VAL = 'val@validators.example'
const FUND = 'fund@capital.example'
const ADMIN = 'fabbiochucho@gmail.com'
const IDS = FRAMEWORKS['capital-readiness'].indicators.map((i) => i.id)

async function call(email: string | null, handler: any, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await handler(new Request(`http://localhost${path.startsWith('/') ? path : `/api/${path}`}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const bytes = new Uint8Array(await res.arrayBuffer())
  const text = new TextDecoder().decode(bytes)
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text, bytes, headers: res.headers }
}
const eng = (e: string | null, m: string, p: string, b?: unknown) => call(e, engagements, m, `engagements${p}`, b)
const rev = (e: string | null, m: string, p: string, b?: unknown) => call(e, reviews, m, `validation-reviews${p}`, b)
const val = (e: string | null, m: string, p: string, b?: unknown) => call(e, lifecycle, m, `validations${p}`, b)
const pub = (m: string, p: string, b?: unknown) => call(null, publicApi, m, `/api/public/validation${p}`, b)

async function profile(email: string, name: string) {
  const r = await call(email, directory, 'PUT', 'directory/me/validator', { name })
  await rows("UPDATE validator_profiles SET accreditation_status='accredited', accredited_until = now() + interval '1 year' WHERE email=$1", [email])
  return r.body.id as string
}

async function finalise(engagementId: string, opts: { qualify?: string[]; outcome?: string } = {}) {
  await rev(VAL, 'PUT', `/${engagementId}/setup`, { method: 'combined', fieldworkStart: '2026-01-05', fieldworkEnd: '2026-01-09' })
  for (const ind of IDS) await rev(VAL, 'PUT', `/${engagementId}/scores/${ind}`, { score: 4, sufficiency: 'sufficient', comment: 'PRIVATE-COMMENT', evidenceRef: 'PRIVATE-EVIDENCE-REF' })
  for (const q of opts.qualify ?? []) await rev(VAL, 'POST', `/${engagementId}/qualifications`, { text: 'Board minutes incomplete', indicatorIds: [q] })
  const res = await rev(VAL, 'POST', `/${engagementId}/finalise`, { outcome: opts.outcome ?? 'validated' })
  assert.equal(res.status, 200, res.text)
}

let valId: string
async function issue(opts: { qualify?: string[]; outcome?: string } = {}) {
  const created = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: valId })
  const id = created.body.id
  await eng(VAL, 'POST', `/${id}/respond`, { side: 'validator', decision: 'accept' })
  assert.equal((await eng(VAL, 'POST', `/${id}/declaration`, { confirmed: true, signedName: 'Valerie Okafor', fundedDisclosure: true, disclosure: 'Paid by Savannah Capital' })).status, 200)
  await finalise(id, opts)
  return (await rows('SELECT * FROM validations ORDER BY created_at DESC'))[0]
}

describe('public verification', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country,sector,email) VALUES('org_a','Acme Cooperative','Kenya','Agriculture','info@acme.example')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin')`)
    valId = await profile(VAL, 'Valerie Okafor')
    await call(VAL, directory, 'POST', 'directory/me/credentials', { body: 'ICAN', membershipNumber: 'ICAN-4411' })
    await rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('org_a','capital:scores','{}')`)
  })

  it('shows the mandatory facts to anyone with the random ID, and nothing private', async () => {
    const v = await issue()
    assert.match(v.verification_id, VERIFICATION_ID_RE)
    const r = await pub('GET', `/${v.verification_id}`)
    assert.equal(r.status, 200, r.text)
    const p = r.body
    assert.equal(p.verificationId, v.verification_id)
    assert.deepEqual([p.status, p.statusLabel], ['current', 'Current'])
    assert.ok(p.lastChangedAt)
    assert.deepEqual([p.organization.name, p.organization.country, p.organization.registrationNumber], ['Acme Cooperative', 'Kenya', null])
    assert.equal(p.framework.version, 'ICARF v4.0')
    assert.equal(p.scope, 'Whole ladder')
    assert.deepEqual([p.label, p.outcomeLabel, p.validatedRung, p.rungName], ['Independent validation', 'Validated', 7, 'Capital Market Readiness'])
    assert.equal(p.statement, 'Validated by Valerie Okafor, engaged by Acme Cooperative')
    assert.equal(p.validators[0].name, 'Valerie Okafor')
    assert.deepEqual(p.validators[0].credentials, [{ body: 'ICAN', number: 'ICAN-4411', status: 'self-declared' }])
    assert.equal(p.validators[0].accreditation, 'accredited')
    assert.equal(p.validatorType, 'Independent consultant')
    assert.equal(p.engagedBy, 'Acme Cooperative')
    assert.match(p.independence.statement, /no ownership, employment or advisory ties/)
    assert.equal(p.independence.disclosure, 'Valerie Okafor: Paid by Savannah Capital')
    assert.equal(p.method, 'Combined')
    assert.deepEqual(p.fieldwork, { start: '2026-01-05', end: '2026-01-09' })
    assert.ok(p.issuedAt && p.expiresAt && p.validityMonths === 12)
    assert.match(p.wording.means, /^An accredited validator, independent of the organisation/)
    assert.match(p.wording.changes, /Always check the verification page/)
    assert.match(p.pdf.sha256, /^[0-9a-f]{64}$/)
    // Never: indicator scores, evidence, validator comments, contact details, internal ids.
    for (const secret of ['PRIVATE-COMMENT', 'PRIVATE-EVIDENCE-REF', 'CRL-1A', '@', 'org_a', 'enc:', 'score']) {
      assert.ok(!r.text.includes(secret) || secret === 'score' && !/"score"/.test(r.text), `public JSON leaked ${secret}`)
    }
    // Optional items are absent until the organisation opts in.
    for (const k of ['rungHistory', 'qualifications', 'devmapperUrl']) assert.equal(p[k], undefined, k)
    assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow')
    // Lookup is forgiving of case; unknown or malformed IDs get the same 404; there is no list.
    assert.equal((await pub('GET', `/${v.verification_id.toLowerCase()}`)).status, 200)
    for (const bad of ['/CRAFT-V-ZZZZZZZZ', '/nonsense', '/..%2F..%2Fetc', '/CRAFT-V-']) assert.equal((await pub('GET', bad)).status, 404, bad)
    assert.equal((await pub('GET', '')).status, 404)
    assert.equal((await pub('GET', '/')).status, 404)
  })

  it('reflects status changes on the page, and only the organisation opts items in', async () => {
    const v = await issue({ qualify: [IDS[1]], outcome: 'validated_with_qualifications' })
    const url = `/${v.verification_id}`
    assert.equal((await pub('GET', url)).body.qualifications, undefined, 'qualifications are the organisation\'s choice')
    assert.equal((await val(VAL, 'PUT', `/${v.id}/public`, { showQualifications: true })).status, 403, 'the validator cannot publish for the organisation')
    assert.equal((await val(ALICE, 'PUT', `/${v.id}/public`, { registrationNumber: 'RC 12345', showQualifications: true, showRungHistory: true, devmapperUrl: 'https://devmapper.example/acme', junk: 'x' })).status, 200)
    assert.equal((await val(ALICE, 'PUT', `/${v.id}/public`, { registrationNumber: 'RC 12345', showQualifications: true, showRungHistory: true, devmapperUrl: 'javascript:alert(1)' })).status, 200)
    let p = (await pub('GET', url)).body
    assert.equal(p.organization.registrationNumber, 'RC 12345')
    assert.deepEqual(p.qualifications, ['Board minutes incomplete'])
    assert.equal(p.devmapperUrl, undefined, 'a non-https link is dropped')
    assert.equal(p.rungHistory.length, 1)
    assert.ok(!JSON.stringify(p).includes(IDS[1]), 'qualification text only, never indicator ids')
    // Suspended, then withdrawn, then expired are all visible on the page.
    const today = new Date().toISOString().slice(0, 10)
    await val(ALICE, 'POST', `/${v.id}/events`, { eventKey: 'fraud', occurredOn: today })
    p = (await pub('GET', url)).body
    assert.equal(p.status, 'suspended')
    await val(VAL, 'POST', `/${v.id}/withdraw`, { reason: 'Evidence found to be wrong' })
    p = (await pub('GET', url)).body
    assert.deepEqual([p.status, p.statusLabel], ['withdrawn', 'Withdrawn'])
    assert.ok(!JSON.stringify(p).includes('Evidence found'), 'the withdrawal reason is not public')
    await rows("UPDATE validations SET status='current', status_changed_at = NULL, expires_at = now() - interval '2 days'")
    p = (await pub('GET', url)).body
    assert.equal(p.status, 'expired')
    assert.ok(new Date(p.lastChangedAt) < new Date(), 'last change is the expiry date')
    // Another organisation's staff cannot set options.
    await rows(`INSERT INTO organizations(id,name,country) VALUES('org_b','Hidden Trust','Kenya')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('b','bob@org-b.example','org_b','admin')`)
    assert.equal((await val('bob@org-b.example', 'PUT', `/${v.id}/public`, { showQualifications: true })).status, 404)
  })

  it('issues one statement PDF: valid, stable, carrying the ID, wording and a QR; its SHA-256 matches the page', async () => {
    const v = await issue()
    const page = (await pub('GET', `/${v.verification_id}`)).body
    const first = await pub('GET', `/${v.verification_id}/statement.pdf`)
    assert.equal(first.status, 200)
    assert.equal(first.headers.get('content-type'), 'application/pdf')
    assert.equal(new TextDecoder().decode(first.bytes.subarray(0, 5)), '%PDF-')
    assert.equal(createHash('sha256').update(first.bytes).digest('hex'), page.pdf.sha256, 'the page shows the hash of the issued PDF')
    // Issued once: later requests return the same bytes (a regenerated PDF would differ).
    const second = await pub('GET', `/${v.verification_id}/statement.pdf`)
    assert.equal(createHash('sha256').update(second.bytes).digest('hex'), page.pdf.sha256)
    assert.equal((await rows('SELECT count(*)::int AS n FROM validation_statements'))[0].n, 1)
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(first.bytes)), { mergePages: true })
    for (const needle of [v.verification_id, 'Acme Cooperative', 'Validated by Valerie Okafor, engaged by Acme Cooperative', 'ICARF v4.0',
      'What this validation means', 'It is not an audit or review of financial statements', 'Always check the verification page', `/validation/${v.verification_id}`]) {
      assert.ok(text.includes(needle), `PDF is missing: ${needle}`)
    }
    assert.ok(!text.includes('PRIVATE-COMMENT') && !text.includes('@'))
    // The QR is drawn as filled squares: a real symbol has many.
    assert.ok(first.bytes.length > 3000)
  })

  it('a funder review says the reviewers are not independent', async () => {
    const f = await call(FUND, firmsApi, 'POST', 'firms', { name: 'Savannah Capital', kind: 'funding_partner', nature: 'DFI' })
    await call(ALICE, directory, 'PUT', 'directory/me/organization', { listed: true, summary: 'Co-op' })
    const profileId = (await rows("SELECT id FROM org_directory_profiles WHERE org_id='org_a'"))[0].id
    const created = await eng(FUND, 'POST', '', { side: 'funder', type: 'funder_review', funderFirmId: f.body.id, organizationProfileId: profileId })
    const id = created.body.id
    await eng(FUND, 'POST', `/${id}/members`, { email: FUND, role: 'lead' })
    await eng(ALICE, 'POST', `/${id}/respond`, { side: 'organization', decision: 'accept' })
    await eng(FUND, 'POST', `/${id}/declaration`, { confirmed: true, signedName: 'Fund Staff' })
    await rev(FUND, 'PUT', `/${id}/setup`, { method: 'document_review', fieldworkStart: '2026-01-05', fieldworkEnd: '2026-01-09' })
    for (const ind of IDS) await rev(FUND, 'PUT', `/${id}/scores/${ind}`, { score: 4, sufficiency: 'sufficient' })
    assert.equal((await rev(FUND, 'POST', `/${id}/finalise`, { outcome: 'validated' })).status, 200)
    const v = (await rows('SELECT verification_id FROM validations'))[0]
    const p = (await pub('GET', `/${v.verification_id}`)).body
    assert.equal(p.label, 'Funder review')
    assert.equal(p.statement, 'Reviewed by Savannah Capital')
    assert.match(p.wording.means, /^Staff of Savannah Capital have reviewed the organisation's self-assessment/)
    assert.match(p.wording.means, /not independent of it/)
    assert.match(p.independence.statement, /not independent of it/)
    assert.match(p.validatorType, /^Funding partner/)
  })

  it('takes concerns from anyone without sign-in, rate-limited, honeypot-guarded, visible only to the platform admin', async () => {
    const v = await issue()
    const url = `/${v.verification_id}/concern`
    assert.equal((await pub('POST', url, { category: 'bogus', message: 'this is a long enough message' })).status, 400)
    assert.equal((await pub('POST', url, { category: 'inaccurate', message: 'short' })).status, 400)
    assert.equal((await pub('POST', '/CRAFT-V-ZZZZZZZZ/concern', { category: 'inaccurate', message: 'this is a long enough message' })).status, 404)
    assert.equal((await pub('POST', url, { category: 'inaccurate', message: 'bot message here', website: 'http://spam.example' })).status, 201)
    assert.equal((await rows('SELECT 1 FROM validation_concerns')).length, 0, 'honeypot stores nothing')
    assert.equal((await pub('POST', url, { category: 'conduct', message: 'The validator knew the board chair personally.', name: 'A. Citizen', email: 'citizen@example.com' })).status, 201)
    const [c] = await rows('SELECT * FROM validation_concerns')
    assert.equal(c.category, 'conduct')
    assert.equal(c.status, 'new')
    assert.equal((await rows("SELECT 1 FROM audit_logs WHERE action ~ 'concern raised'")).length, 1)
    // The reporter's details never appear on the public page.
    const page = await pub('GET', `/${v.verification_id}`)
    assert.ok(!page.text.includes('citizen@example.com') && !page.text.includes('board chair'))
    // Rate limit: five attempts a minute from one connection (malformed ones count). That was attempt 4.
    assert.equal((await pub('POST', url, { category: 'other', message: 'Another concern, long enough.' })).status, 201)
    assert.equal((await pub('POST', url, { category: 'other', message: 'And yet another one, long enough.' })).status, 429)
    // Only the platform admin reads them.
    assert.equal((await val(ALICE, 'GET', '/concerns')).status, 403)
    assert.equal((await val(VAL, 'GET', '/concerns')).status, 403)
    const list = await val(ADMIN, 'GET', '/concerns')
    assert.equal(list.status, 200)
    assert.equal(list.body.length, 2)
    assert.equal((await val(ADMIN, 'PUT', `/concerns/${c.id}`, { status: 'in_review' })).status, 200)
    assert.equal((await val(ALICE, 'PUT', `/concerns/${c.id}`, { status: 'closed' })).status, 403)
  })

  it('slows ID guessing and gives rows issued before this release their ID on first need', async () => {
    const v = await issue()
    for (let i = 0; i < 60; i++) assert.notEqual((await pub('GET', '/CRAFT-V-ZZZZZZZZ')).status, 429)
    assert.equal((await pub('GET', '/CRAFT-V-ZZZZZZZZ')).status, 429)
    assert.equal((await pub('GET', `/${v.verification_id}`)).status, 429, 'the limit is per connection, not per ID')
    await rows('DELETE FROM rate_limits')
    await rows('UPDATE validations SET verification_id = NULL')
    await rows('DELETE FROM validation_statements')
    const detail = await val(ALICE, 'GET', `/${v.id}`)
    assert.match(detail.body.verificationId, VERIFICATION_ID_RE)
    assert.equal((await pub('GET', `/${detail.body.verificationId}`)).status, 200)
    assert.equal(detail.body.pdfSha256, (await pub('GET', `/${detail.body.verificationId}`)).body.pdf.sha256)
    assert.equal((await val(ALICE, 'GET', `/${v.id}`)).body.verificationId, detail.body.verificationId, 'stable once allocated')
  })
})
