import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetchMock, pool, rows, truncateAll } from './harness.ts'
import { FRAMEWORKS } from '../../src/lib/validationReview.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const directory = await load('directory')
const engagements = await load('engagements')
const reviews = await load('validation-reviews')
const lifecycle = await load('validations')
const reminders = await load('validation-reminders')
const publicApi = await load('public-validation')
const firmsApi = await load('firms')

const ALICE = 'alice@org-a.example' // organisation A admin
const BOB = 'bob@org-b.example'
const VAL = 'val@validators.example' // lead
const FUND = 'fund@capital.example' // owner of funder firm 1
const FUND2 = 'fund2@other.example' // owner of funder firm 2 (no consent)
const ADMIN = 'fabbiochucho@gmail.com'
const IDS = FRAMEWORKS['capital-readiness'].indicators.map((i) => i.id)

async function call(email: string | null, handler: any, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await handler(new Request(`http://localhost${path.startsWith('/') ? path : `/api/${path}`}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}
const eng = (e: string | null, m: string, p: string, b?: unknown) => call(e, engagements, m, `engagements${p}`, b)
const rev = (e: string | null, m: string, p: string, b?: unknown) => call(e, reviews, m, `validation-reviews${p}`, b)
const val = (e: string | null, m: string, p: string, b?: unknown) => call(e, lifecycle, m, `validations${p}`, b)
const pub = (m: string, p: string) => call(null, publicApi, m, `/api/public/validation${p}`)
const today = () => new Date().toISOString().slice(0, 10)
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

async function profile(email: string, name: string) {
  const r = await call(email, directory, 'PUT', 'directory/me/validator', { name })
  await rows("UPDATE validator_profiles SET accreditation_status='accredited', accredited_until = now() + interval '1 year' WHERE email=$1", [email])
  return r.body.id as string
}

let valId: string
let funder1: string

async function startEngagement() {
  const created = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: valId })
  assert.equal(created.status, 201, created.text)
  const id = created.body.id
  await eng(VAL, 'POST', `/${id}/respond`, { side: 'validator', decision: 'accept' })
  assert.equal((await eng(VAL, 'POST', `/${id}/declaration`, { confirmed: true, signedName: 'Valerie Okafor' })).status, 200)
  await rev(VAL, 'PUT', `/${id}/setup`, { method: 'combined', fieldworkStart: '2026-01-05', fieldworkEnd: '2026-01-09' })
  for (const ind of IDS) await rev(VAL, 'PUT', `/${id}/scores/${ind}`, { score: 4, sufficiency: 'sufficient' })
  return id as string
}
async function issue(opts: { qualify?: string[]; outcome?: string; finalise?: Record<string, unknown> } = {}) {
  const id = await startEngagement()
  for (const q of opts.qualify ?? []) await rev(VAL, 'POST', `/${id}/qualifications`, { text: `Gap in ${q}`, indicatorIds: [q] })
  const res = await rev(VAL, 'POST', `/${id}/finalise`, { outcome: opts.outcome ?? 'validated', ...(opts.finalise ?? {}) })
  assert.equal(res.status, 200, res.text)
  return (await rows('SELECT * FROM validations ORDER BY created_at DESC'))[0]
}

describe('validation CIP follow-up, funder consent, debrief notice, history and checkpoints', () => {
  const saved = { key: process.env.RESEND_API_KEY, from: process.env.REMINDER_FROM_EMAIL }
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country,sector,email) VALUES('org_a','Acme Cooperative','Kenya','Agriculture','info@acme.example'),('org_b','Hidden Trust','Kenya','Health','info@hidden.example')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
    valId = await profile(VAL, 'Valerie Okafor')
    await rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('org_a','capital:scores','{}')`)
    funder1 = (await call(FUND, firmsApi, 'POST', 'firms', { name: 'Savannah Capital', kind: 'funding_partner', nature: 'DFI' })).body.id
    await call(FUND2, firmsApi, 'POST', 'firms', { name: 'Other Capital', kind: 'funding_partner', nature: 'Venture Capital' })
  })
  afterEach(() => {
    for (const [k, v] of [['RESEND_API_KEY', saved.key], ['REMINDER_FROM_EMAIL', saved.from]] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  it('turns each qualification into an improvement action, with a history row and a surveillance checkpoint at issue', async () => {
    const v = await issue({ outcome: 'validated_with_qualifications', qualify: [IDS[1], IDS[2]] })
    const actions = await rows('SELECT text, indicator_ids, owner, due_date, status, qualification_id FROM validation_cip_actions ORDER BY text')
    assert.equal(actions.length, 2)
    assert.deepEqual(actions.map((a: any) => a.indicator_ids), [[IDS[1]], [IDS[2]]])
    assert.ok(actions.every((a: any) => a.owner === null && a.due_date === null && a.status === 'open' && a.qualification_id))
    const hist = await rows('SELECT from_status, to_status, reason, actor FROM validation_status_history')
    assert.deepEqual(hist, [{ from_status: null, to_status: 'current', reason: 'Validation issued', actor: VAL }])
    // A 24-month validation gets its surveillance point at issue.
    await truncateAll(); await rows(`INSERT INTO organizations(id,name,country,email) VALUES('org_a','Acme Cooperative','Kenya','info@acme.example')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin')`)
    valId = await profile(VAL, 'Valerie Okafor')
    const long = await issue({ finalise: { validityMonths: 24 } })
    const cps = await rows("SELECT kind, state, due_on FROM validation_checkpoints WHERE validation_id=$1", [long.id])
    assert.deepEqual(cps.map((c: any) => [c.kind, c.state]), [['surveillance', 'pending']])
    assert.ok(v.id !== long.id)
  })

  it('lets only the organisation manage actions; done needs an owner, a due date and proof, and the database insists too', async () => {
    const v = await issue({ outcome: 'validated_with_qualifications', qualify: [IDS[1]] })
    const base = `/${v.id}/cip-actions`
    const detail = (await val(ALICE, 'GET', `/${v.id}`)).body
    const q = detail.cip.actions[0]
    assert.equal(q.fromQualification, true)
    // Nobody else can touch the plan: the validator, another organisation, a stranger.
    for (const [who, status] of [[VAL, 403], [BOB, 404], [FUND, 404]] as const) {
      assert.equal((await val(who, 'POST', base, { text: 'x', indicatorIds: [IDS[1]] })).status, status, who)
    }
    // Validation of input.
    assert.equal((await val(ALICE, 'POST', base, { text: 'Adopt a charter', indicatorIds: ['NOPE'] })).status, 400)
    assert.equal((await val(ALICE, 'POST', base, { text: 'Adopt a charter', indicatorIds: [IDS[3]], dueDate: '2026-02-30' })).status, 400)
    assert.equal((await val(ALICE, 'POST', base, { text: '', indicatorIds: [IDS[3]] })).status, 400)
    const added = await val(ALICE, 'POST', base, { text: 'Adopt a charter', indicatorIds: [IDS[3]], owner: 'CFO', dueDate: inDays(30) })
    assert.equal(added.status, 201, added.text)
    const manual = added.body.cip.actions.find((a: any) => a.text === 'Adopt a charter')
    // Done needs all three.
    let r = await val(ALICE, 'POST', `${base}/${q.id}/done`, { proof: 'Board minutes 2026-08-30' })
    assert.equal(r.status, 400)
    assert.ok(r.body.problems.some((p: string) => /owner/.test(p)) && r.body.problems.some((p: string) => /due date/.test(p)))
    r = await val(ALICE, 'POST', `${base}/${manual.id}/done`, { proof: 'x' })
    assert.equal(r.status, 400, 'a token is not proof')
    // Owner and due date can be supplied in the same call.
    r = await val(ALICE, 'POST', `${base}/${q.id}/done`, { proof: 'Board minutes 2026-08-30', owner: 'Board chair', dueDate: inDays(10) })
    assert.equal(r.status, 200, r.text)
    assert.deepEqual(r.body.reassess, [IDS[1]], 'the CIP page is told which indicators to re-assess')
    assert.equal(r.body.cip.progressLine.startsWith('1 of 2 actions done'), true)
    assert.equal((await val(ALICE, 'POST', `${base}/${q.id}/done`, { proof: 'again please' })).status, 409)
    assert.equal((await val(ALICE, 'PUT', `${base}/${q.id}`, { text: 'changed' })).status, 409, 'reopen before editing a done action')
    // The proof is kept for the validator to see, and the database refuses a "done" without proof.
    assert.equal((await val(VAL, 'GET', `/${v.id}`)).body.cip.actions.find((a: any) => a.id === q.id).proof, 'Board minutes 2026-08-30')
    await assert.rejects(pool.query("UPDATE validation_cip_actions SET proof='' WHERE id=$1", [q.id]), /done_complete/)
    await assert.rejects(pool.query("UPDATE validation_cip_actions SET status='done', owner=NULL WHERE id=$1", [manual.id]), /done_complete/)
    // Reopen clears the proof (and logs it); edits work again.
    assert.equal((await val(ALICE, 'POST', `${base}/${q.id}/reopen`)).status, 200)
    assert.equal((await val(ALICE, 'POST', `${base}/${q.id}/reopen`)).status, 409)
    assert.equal((await rows('SELECT proof, status FROM validation_cip_actions WHERE id=$1', [q.id]))[0].proof, '')
    assert.match((await rows("SELECT action FROM audit_logs WHERE action ~ 'reopened improvement'"))[0].action, /Board minutes/)
    assert.equal((await val(ALICE, 'PUT', `${base}/${q.id}`, { owner: 'CEO', dueDate: inDays(60) })).status, 200)
    // Only a manually added action can be removed.
    assert.equal((await val(ALICE, 'DELETE', `${base}/${q.id}`)).status, 409)
    assert.equal((await val(ALICE, 'DELETE', `${base}/${manual.id}`)).status, 200)
    assert.equal((await val(ALICE, 'GET', `/${v.id}`)).body.cip.actions.length, 1)
    // A withdrawn validation's plan is closed.
    await val(VAL, 'POST', `/${v.id}/withdraw`, { reason: 'Evidence found to be wrong' })
    assert.equal((await val(ALICE, 'POST', base, { text: 'More', indicatorIds: [IDS[1]] })).status, 409)
  })

  it('moves the follow-up checkpoint with the CIP: capped at expiry, brought forward when the actions are done, validity never extended', async () => {
    const v = await issue({ outcome: 'validated_with_qualifications', qualify: [IDS[1]] })
    const before = (await val(ALICE, 'GET', `/${v.id}`)).body
    const q = before.cip.actions[0]
    const expiry = new Date(before.expiresAt).toISOString().slice(0, 10)
    // A due date past the validity is capped at expiry, and the checkpoint follows.
    assert.equal((await val(ALICE, 'PUT', `/${v.id}/cip-actions/${q.id}`, { owner: 'CFO', dueDate: '2031-01-01' })).status, 200)
    let d = (await val(ALICE, 'GET', `/${v.id}`)).body
    assert.equal(d.followUp.dueOn, expiry)
    assert.deepEqual(d.checkpoints.filter((c: any) => c.kind === 'follow_up').map((c: any) => [c.dueOn, c.state]), [[expiry, 'pending']])
    assert.equal(d.expiresAt, before.expiresAt)
    // A nearer due date replaces the pending checkpoint (never two pending).
    await val(ALICE, 'PUT', `/${v.id}/cip-actions/${q.id}`, { dueDate: inDays(20) })
    d = (await val(ALICE, 'GET', `/${v.id}`)).body
    assert.deepEqual(d.checkpoints.filter((c: any) => c.kind === 'follow_up').map((c: any) => [c.dueOn, c.state]), [[inDays(20), 'pending']])
    // Done with proof: brought forward to today.
    await val(ALICE, 'POST', `/${v.id}/cip-actions/${q.id}/done`, { proof: 'Charter adopted, minutes 12' })
    d = (await val(ALICE, 'GET', `/${v.id}`)).body
    assert.equal(d.followUp.broughtForward, true)
    assert.deepEqual(d.checkpoints.filter((c: any) => c.kind === 'follow_up').map((c: any) => [c.dueOn, c.state]), [[today(), 'pending']])
    assert.equal(d.expiresAt, before.expiresAt, 'validity unchanged')
    // The lead records it: the checkpoint is done and no new one appears.
    assert.equal((await val(VAL, 'POST', `/${v.id}/follow-ups`, { result: 'confirmed', note: 'Charter seen' })).status, 200)
    d = (await val(ALICE, 'GET', `/${v.id}`)).body
    const fu = d.checkpoints.filter((c: any) => c.kind === 'follow_up')
    assert.deepEqual(fu.map((c: any) => [c.state, c.result, c.note]), [['done', 'confirmed', 'Charter seen']])
    assert.deepEqual(fu[0].indicatorIds, [IDS[1]], 'a follow-up re-checks only the tracked indicators')
    assert.equal(d.followUp.dueOn, null)
    // Reopening the action revives a pending point.
    await val(ALICE, 'POST', `/${v.id}/cip-actions/${q.id}/reopen`)
    await val(ALICE, 'PUT', `/${v.id}/cip-actions/${q.id}`, { dueDate: inDays(25) })
    d = (await val(ALICE, 'GET', `/${v.id}`)).body
    assert.deepEqual(d.checkpoints.filter((c: any) => c.kind === 'follow_up' && c.state === 'pending').map((c: any) => c.dueOn), [inDays(25)])
    // Changing the schedule re-plans the pending point: every 3 months counts from issue.
    assert.equal((await val(VAL, 'PUT', `/${v.id}/schedule`, { mode: 'fixed_3' })).status, 200)
    d = (await val(ALICE, 'GET', `/${v.id}`)).body
    assert.equal(d.checkpoints.filter((c: any) => c.kind === 'follow_up' && c.state === 'pending').length, 1)
    assert.equal(d.followUp.dueOn, d.checkpoints.find((c: any) => c.kind === 'follow_up' && c.state === 'pending').dueOn)
  })

  it('lets the organisation share progress with a funding partner: counts and dates only, revocable, and nobody else', async () => {
    const v = await issue({ outcome: 'validated_with_qualifications', qualify: [IDS[1], IDS[2]] })
    const [a1] = (await val(ALICE, 'GET', `/${v.id}`)).body.cip.actions
    await val(ALICE, 'PUT', `/${v.id}/cip-actions/${a1.id}`, { owner: 'CFO', dueDate: '2026-03-15' })
    await val(ALICE, 'POST', `/${v.id}/cip-actions/${a1.id}/done`, { proof: 'SECRET-PROOF-REF' })
    // Before consent the funder sees nothing at all.
    assert.equal((await val(FUND, 'GET', `/${v.id}`)).status, 404)
    assert.deepEqual((await val(FUND, 'GET', '/funder')).body, [])
    assert.deepEqual((await val(FUND, 'GET', '')).body, [])
    // Consent: organisation staff only, to a real funding partner.
    assert.equal((await val(VAL, 'PUT', `/${v.id}/funder-consent`, { funderFirmId: funder1, granted: true })).status, 403)
    assert.equal((await val(BOB, 'PUT', `/${v.id}/funder-consent`, { funderFirmId: funder1, granted: true })).status, 404)
    assert.equal((await val(FUND, 'PUT', `/${v.id}/funder-consent`, { funderFirmId: funder1, granted: true })).status, 404, 'a funder cannot grant itself access')
    assert.equal((await val(ALICE, 'PUT', `/${v.id}/funder-consent`, { funderFirmId: 'nope', granted: true })).status, 400)
    const granted = await val(ALICE, 'PUT', `/${v.id}/funder-consent`, { funderFirmId: funder1, granted: true })
    assert.equal(granted.status, 200, granted.text)
    assert.deepEqual(granted.body.funderConsents.map((c: any) => c.name), ['Savannah Capital'])
    // The consenting funder sees progress and schedule, as counts and dates.
    const list = await val(FUND, 'GET', '/funder')
    assert.equal(list.body.length, 1)
    const view = (await val(FUND, 'GET', `/${v.id}`)).body
    assert.equal(view.funderView, true)
    assert.deepEqual(view.progress, { done: 1, total: 2 })
    assert.match(view.progressLine, /^1 of 2 actions done, follow-up due /)
    assert.equal(view.can.funder, true)
    for (const secret of ['SECRET-PROOF-REF', 'CFO', 'Gap in', 'proof', 'owner', IDS[1], 'events', 'cip']) assert.ok(!JSON.stringify(view).includes(secret), `funder view leaked ${secret}`)
    assert.equal((await val(FUND, 'GET', '')).body.length, 1, 'it also appears in the funder\'s validations list')
    // The funder can do nothing else; another funder (no consent) sees nothing.
    for (const [m, p, b] of [['POST', `/${v.id}/cip-actions`, { text: 'x', indicatorIds: [IDS[1]] }], ['POST', `/${v.id}/events`, { eventKey: 'fraud', occurredOn: today() }], ['PUT', `/${v.id}/schedule`, { mode: 'fixed_3' }], ['POST', `/${v.id}/withdraw`, { reason: 'x' }]] as const) {
      assert.equal((await val(FUND, m, p, b)).status, 403, p)
    }
    assert.equal((await val(FUND2, 'GET', `/${v.id}`)).status, 404)
    assert.deepEqual((await val(FUND2, 'GET', '/funder')).body, [])
    // Staff of the consenting firm (not just its owner) see it; a revoked consent ends it at once, and can be given again.
    assert.equal((await val(ALICE, 'PUT', `/${v.id}/funder-consent`, { funderFirmId: funder1, granted: false })).status, 200)
    assert.equal((await val(FUND, 'GET', `/${v.id}`)).status, 404)
    assert.deepEqual((await val(FUND, 'GET', '/funder')).body, [])
    assert.equal((await val(ALICE, 'PUT', `/${v.id}/funder-consent`, { funderFirmId: funder1, granted: true })).status, 200)
    assert.equal((await val(FUND, 'GET', `/${v.id}`)).status, 200)
    assert.equal((await rows('SELECT 1 FROM validation_funder_consents')).length, 1, 'one row per validation and firm')
    const log = (await rows("SELECT action FROM audit_logs WHERE action ~ 'seeing the validation|access to the validation'")).map((r: any) => r.action)
    assert.equal(log.length, 3)
    // The organisation's CIP page endpoint lists the consent.
    const cip = (await val(ALICE, 'GET', '/cip')).body
    assert.equal(cip[0].funders[0].name, 'Savannah Capital')
    assert.equal(cip[0].canEdit, true)
    assert.deepEqual((await val(BOB, 'GET', '/cip')).body, [])
  })

  it('emails the organisation once when the debrief opens, and the daily run retries a notice that could not be sent', async () => {
    const id = await startEngagement()
    const sentTo = (calls: any[]) => calls.map((c) => JSON.parse(String(c.init?.body)).to).sort()
    // Provider not configured: the debrief still opens, nothing is marked as sent.
    assert.equal((await rev(VAL, 'POST', `/${id}/debrief/open`)).status, 200)
    assert.equal((await rows('SELECT debrief_notified_at FROM validation_reviews'))[0].debrief_notified_at, null)
    assert.match((await rows("SELECT action FROM audit_logs WHERE action ~ 'debrief opened'"))[0].action, /queued for retry/)
    // The daily run sends it once the provider is configured, and only once.
    process.env.RESEND_API_KEY = 'placeholder-not-a-real-key'
    process.env.REMINDER_FROM_EMAIL = 'alerts@craft.example'
    const failing = installFetchMock(() => new Response('no', { status: 500 }))
    try { await reminders() } finally { failing.restore() }
    assert.equal((await rows('SELECT debrief_notified_at FROM validation_reviews'))[0].debrief_notified_at, null, 'a rejected email is not marked as sent')
    const mock = installFetchMock()
    try {
      await reminders()
      assert.equal(mock.calls.length, 1)
      assert.deepEqual(sentTo(mock.calls)[0].sort(), [ALICE, 'info@acme.example'].sort())
      const mail = JSON.parse(String(mock.calls[0].init?.body))
      assert.match(mail.subject, /debrief for Acme Cooperative is open/)
      assert.match(mail.text, /respond to any indicator you dispute/)
      assert.ok(!/val@validators/.test(JSON.stringify(mail)), 'the validator\'s address is not in the notice')
      await reminders()
      assert.equal(mock.calls.length, 1, 'never repeated')
    } finally { mock.restore() }
    assert.ok((await rows('SELECT debrief_notified_at FROM validation_reviews'))[0].debrief_notified_at)
  })

  it('sends the debrief email straight away when the provider is configured', async () => {
    process.env.RESEND_API_KEY = 'placeholder-not-a-real-key'
    process.env.REMINDER_FROM_EMAIL = 'alerts@craft.example'
    const id = await startEngagement()
    const mock = installFetchMock()
    try {
      assert.equal((await rev(VAL, 'POST', `/${id}/debrief/open`)).status, 200)
      assert.equal(mock.calls.length, 1)
      assert.equal((await rev(VAL, 'POST', `/${id}/debrief/open`)).status, 409, 'cannot be opened twice, so cannot be re-sent')
      assert.equal(mock.calls.length, 1)
    } finally { mock.restore() }
    assert.ok((await rows('SELECT debrief_notified_at FROM validation_reviews'))[0].debrief_notified_at)
    assert.match((await rows("SELECT action FROM audit_logs WHERE action ~ 'debrief opened'"))[0].action, /notice sent/)
  })

  it('records every status change in order: issue, decisions, supersession and the calendar (once, on the day it happened)', async () => {
    const v = await issue()
    const url = `/${v.id}`
    await val(ALICE, 'POST', `${url}/events`, { eventKey: 'fraud', occurredOn: today() })
    const ev = (await val(ALICE, 'GET', url)).body.events[0]
    await val(VAL, 'POST', `${url}/events/${ev.id}/decision`, { decision: 'reinstate', note: 'Controls checked' })
    let h = (await val(ALICE, 'GET', url)).body.statusHistory
    assert.deepEqual(h.map((x: any) => [x.from, x.to]), [[null, 'current'], ['current', 'suspended'], ['suspended', 'current']])
    assert.match(h[1].reason, /Material event reported/)
    assert.equal(h[2].reason, 'Controls checked')
    // The calendar: a missed follow-up and then expiry are recorded by the daily run, once each.
    await val(ALICE, 'PUT', `${url}/schedule`, { mode: 'fixed_3' })
    await rows("UPDATE validations SET issued_at = now() - interval '4 months', expires_at = now() + interval '8 months'")
    await reminders()
    await reminders()
    h = (await val(ALICE, 'GET', url)).body.statusHistory
    assert.deepEqual(h.map((x: any) => x.to), ['current', 'suspended', 'current', 'follow_up_overdue'])
    assert.match(h[3].reason, /^A follow-up point \(\d{4}-\d{2}-\d{2}\) passed without being recorded$/)
    // Time passes: everything so far happened a month ago, then the validity ended two days ago.
    await rows("UPDATE validation_status_history SET created_at = created_at - interval '30 days'")
    await rows("UPDATE validations SET status_changed_at = status_changed_at - interval '30 days', expires_at = now() - interval '2 days'")
    await reminders()
    await reminders()
    h = (await val(ALICE, 'GET', url)).body.statusHistory
    assert.deepEqual(h.map((x: any) => x.to), ['current', 'suspended', 'current', 'follow_up_overdue', 'expired'])
    assert.match(h[4].reason, /^The validity period ended on \d{4}-\d{2}-\d{2}$/)
    assert.deepEqual(h.map((x: any) => x.from), [null, 'current', 'suspended', 'current', 'follow_up_overdue'], 'each row follows from the one before')
    // The public page's "last changed" is the expiry date itself, not the day the job noticed.
    const vid = (await rows('SELECT verification_id FROM validations'))[0].verification_id
    const page = (await pub('GET', `/${vid}`)).body
    assert.equal(page.status, 'expired')
    assert.equal(page.lastChangedAt.slice(0, 10), h[4].reason.slice(-10))
    // Supersession is recorded on the old validation.
    await rows("UPDATE validations SET status='current', expires_at = now() + interval '8 months'")
    await issue()
    const old = (await rows("SELECT id FROM validations WHERE status='superseded'"))[0]
    const oldHist = await rows('SELECT from_status, to_status, reason FROM validation_status_history WHERE validation_id=$1 ORDER BY created_at DESC LIMIT 1', [old.id])
    assert.deepEqual(oldHist, [{ from_status: 'current', to_status: 'superseded', reason: 'Superseded by a newer validation' }])
    // Withdrawal.
    const second = (await rows("SELECT id FROM validations WHERE status='current'"))[0]
    await val(VAL, 'POST', `/${second.id}/withdraw`, { reason: 'Evidence found to be wrong' })
    const wh = (await val(ALICE, 'GET', `/${second.id}`)).body.statusHistory
    assert.deepEqual(wh.map((x: any) => x.to), ['current', 'withdrawn'])
    assert.equal(wh[1].reason, 'Evidence found to be wrong')
  })

  it('keeps checkpoints right for validations that predate them: the daily run creates them, and the migration backfill is complete and repeatable', async () => {
    const v = await issue({ outcome: 'validated_with_qualifications', qualify: [IDS[1]] })
    await val(ALICE, 'PUT', `/${v.id}/schedule`, { mode: 'fixed_3' })
    // Simulate a validation issued before this release: no history, no checkpoints, a follow-up in the old table, surveillance columns set.
    await rows('DELETE FROM validation_status_history')
    await rows('DELETE FROM validation_checkpoints')
    await rows("UPDATE validations SET status='suspended', status_reason='Material event reported: x', status_changed_by='org@x.example', status_changed_at = now()")
    await rows("UPDATE validations SET surveillance_due_at = now() + interval '3 months', surveillance_done_at = NULL")
    await rows(`INSERT INTO validation_follow_ups(id,validation_id,due_on,result,note,completed_by) VALUES('fu1','${v.id}','2026-03-01','concerns','Old note','old@lead.example')`)
    // Run the migration's backfill statements (everything after the table definitions).
    const sql = readFileSync(new URL('../../netlify/database/migrations/20261016190000_validation_cip_followups/migration.sql', import.meta.url), 'utf8')
    const backfill = sql.slice(sql.indexOf('-- Backfill from what')).split(/;\s*\n/).filter((x) => /INSERT INTO/.test(x))
    assert.equal(backfill.length, 4)
    for (let pass = 0; pass < 2; pass++) for (const st of backfill) await pool.query(st) // second pass: repeatable, no duplicates
    const hist = await rows('SELECT from_status, to_status FROM validation_status_history ORDER BY created_at')
    assert.deepEqual(hist.map((h: any) => [h.from_status, h.to_status]), [[null, 'current'], ['current', 'suspended']])
    const cps = await rows('SELECT kind, state, result, note FROM validation_checkpoints ORDER BY kind')
    assert.deepEqual(cps.map((c: any) => [c.kind, c.state, c.result]), [['follow_up', 'done', 'concerns'], ['surveillance', 'pending', null]])
    // The daily run adds the schedule's next pending follow-up point for a live validation.
    await rows("UPDATE validations SET status='current'")
    await reminders()
    const pending = await rows("SELECT kind, due_on FROM validation_checkpoints WHERE state='pending' ORDER BY kind")
    assert.deepEqual(pending.map((p: any) => p.kind), ['follow_up', 'surveillance'])
    assert.equal((await rows("SELECT count(*)::int AS n FROM validation_checkpoints WHERE kind='follow_up' AND state='pending'"))[0].n, 1)
    await reminders()
    assert.equal((await rows("SELECT count(*)::int AS n FROM validation_checkpoints WHERE kind='follow_up' AND state='pending'"))[0].n, 1, 'idempotent')
    await assert.rejects(pool.query("UPDATE validation_checkpoints SET state='done' WHERE kind='surveillance'"), /done_complete/)
    // A live validation with no history at all starts it with its issue, not with a misleading "back to current".
    await rows('DELETE FROM validation_status_history')
    await reminders()
    const started = await rows('SELECT from_status, to_status, reason FROM validation_status_history ORDER BY created_at')
    assert.deepEqual(started, [{ from_status: null, to_status: 'current', reason: 'Validation issued' }])
  })

  it('shows the lead and funders-by-consent only what they should, and keeps the admin out of the plan', async () => {
    const v = await issue({ outcome: 'validated_with_qualifications', qualify: [IDS[1]] })
    const admin = await val(ADMIN, 'GET', `/${v.id}`)
    assert.equal(admin.status, 200)
    assert.equal((await val(ADMIN, 'POST', `/${v.id}/cip-actions`, { text: 'x', indicatorIds: [IDS[1]] })).status, 403, 'the platform admin does not edit an organisation\'s plan')
    assert.equal((await val(VAL, 'GET', `/${v.id}`)).body.cip.actions.length, 1, 'the lead can read the plan')
    assert.equal((await val(VAL, 'GET', `/${v.id}`)).body.funderConsents, undefined, 'consents are the organisation\'s own business')
  })
})
