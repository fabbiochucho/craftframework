import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetchMock, rows, truncateAll } from './harness.ts'
import { FRAMEWORKS } from '../../src/lib/validationReview.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const directory = await load('directory')
const engagements = await load('engagements')
const reviews = await load('validation-reviews')
const lifecycle = await load('validations')
const reminders = await load('validation-reminders')

const ALICE = 'alice@org-a.example'
const BOB = 'bob@org-b.example'
const VAL = 'val@validators.example' // lead
const OTHER = 'other@validators.example' // accredited, never on the engagement
const ADMIN = 'fabbiochucho@gmail.com'

const IDS = FRAMEWORKS['capital-readiness'].indicators.map((i) => i.id)
const LOW = FRAMEWORKS['capital-readiness'].indicators.filter((i) => i.level > 3).map((i) => i.id)

async function call(email: string | null, handler: any, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
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

async function profile(email: string, name: string) {
  const r = await call(email, directory, 'PUT', 'directory/me/validator', { name })
  await rows("UPDATE validator_profiles SET accreditation_status='accredited', accredited_until = now() + interval '1 year' WHERE email=$1", [email])
  return r.body.id as string
}

let valId: string
let lastEngagement: string

// Runs a full engagement to a finalised review. scoreFor lets a test shape the rung.
async function issue(opts: { scoreFor?: (id: string) => number; outcome?: string; finalise?: Record<string, unknown>; qualify?: string[] } = {}) {
  const created = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: valId })
  assert.equal(created.status, 201, created.text)
  const id = created.body.id
  lastEngagement = id
  await eng(VAL, 'POST', `/${id}/respond`, { side: 'validator', decision: 'accept' })
  assert.equal((await eng(VAL, 'POST', `/${id}/declaration`, { confirmed: true, signedName: 'Valerie Okafor' })).status, 200)
  await rev(VAL, 'PUT', `/${id}/setup`, { method: 'combined', fieldworkStart: '2026-01-05', fieldworkEnd: '2026-01-09' })
  for (const ind of IDS) assert.equal((await rev(VAL, 'PUT', `/${id}/scores/${ind}`, { score: (opts.scoreFor ?? (() => 4))(ind), sufficiency: 'sufficient' })).status, 200)
  for (const q of opts.qualify ?? []) await rev(VAL, 'POST', `/${id}/qualifications`, { text: `Gap in ${q}`, indicatorIds: [q] })
  const res = await rev(VAL, 'POST', `/${id}/finalise`, { outcome: opts.outcome ?? 'validated', ...(opts.finalise ?? {}) })
  return res
}
const onlyValidation = async () => (await rows('SELECT * FROM validations ORDER BY created_at DESC'))[0]

describe('validation lifecycle', () => {
  const saved = { key: process.env.RESEND_API_KEY, from: process.env.REMINDER_FROM_EMAIL }
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country,sector,email) VALUES('org_a','Acme Cooperative','Kenya','Agriculture','info@acme.example'),('org_b','Hidden Trust','Kenya','Health','info@hidden.example')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
    valId = await profile(VAL, 'Valerie Okafor')
    await profile(OTHER, 'Olu Other')
    await rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('org_a','capital:scores','{}')`)
  })
  afterEach(() => {
    for (const [k, v] of [['RESEND_API_KEY', saved.key], ['REMINDER_FROM_EMAIL', saved.from]] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  it('issues the validity the rules allow: 12 months, 6 with qualifications, 24 only for rung 5+, shorter with a named risk', async () => {
    let r = await issue()
    assert.equal(r.status, 200, r.text)
    let v = await onlyValidation()
    assert.equal(v.validity_months, 12)
    assert.equal(v.validated_rung, 7)
    assert.equal(v.surveillance_due_at, null)
    assert.equal(Math.round((v.expires_at - v.issued_at) / 86_400_000 / 30.4), 12)

    await truncateAll(); await beforeEachSetup()
    r = await issue({ outcome: 'validated_with_qualifications', qualify: [IDS[1]] })
    assert.equal(r.status, 200, r.text)
    v = await onlyValidation()
    assert.equal(v.validity_months, 6)
    assert.deepEqual(v.tracked_indicators, [IDS[1]])
    // Longer than 6 months with qualifications: refused. Shorter needs a reason.
    await truncateAll(); await beforeEachSetup()
    r = await issue({ outcome: 'validated_with_qualifications', qualify: [IDS[1]], finalise: { validityMonths: 12 } })
    assert.equal(r.status, 400)
    assert.match(r.body.problems[0], /at most 6/)
    r = await rev(VAL, 'POST', `/${lastEngagement}/finalise`, { outcome: 'validated_with_qualifications', validityMonths: 3 })
    assert.match(r.body.problems[0], /Name the risk/)
    r = await rev(VAL, 'POST', `/${lastEngagement}/finalise`, { outcome: 'validated_with_qualifications', validityMonths: 3, validityReason: 'Licence renewal pending' })
    assert.equal(r.status, 200, r.text)
    assert.equal((await onlyValidation()).validity_months, 3)
  })

  const beforeEachSetup = async () => {
    await rows(`INSERT INTO organizations(id,name,country,sector,email) VALUES('org_a','Acme Cooperative','Kenya','Agriculture','info@acme.example'),('org_b','Hidden Trust','Kenya','Health','info@hidden.example')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
    valId = await profile(VAL, 'Valerie Okafor')
    await profile(OTHER, 'Olu Other')
    await rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('org_a','capital:scores','{}')`)
  }

  it('24 months needs rung 5+ without qualifications and brings a surveillance check at 12; a missed check expires it at 12', async () => {
    // Rung 3 only (levels above score 1): 24 months refused.
    let r = await issue({ scoreFor: (id) => (LOW.includes(id) ? 1 : 4), finalise: { validityMonths: 24 } })
    assert.equal(r.status, 400)
    assert.match(r.body.problems[0], /rung 5\+/)
    await truncateAll(); await beforeEachSetup()
    r = await issue({ finalise: { validityMonths: 24 } })
    assert.equal(r.status, 200, r.text)
    const v = await onlyValidation()
    assert.equal(v.validity_months, 24)
    assert.ok(v.surveillance_due_at)
    const id = v.id
    assert.equal((await val(ALICE, 'GET', `/${id}`)).body.status, 'current')
    // Surveillance date passes unrecorded: expires at 12 months.
    await rows("UPDATE validations SET surveillance_due_at = now() - interval '1 day'")
    let d = (await val(ALICE, 'GET', `/${id}`)).body
    assert.equal(d.status, 'expired')
    assert.ok(new Date(d.expiresAt) < new Date(), 'effective expiry is the surveillance date, not 24 months')
    // Recorded in time: stays current to 24 months.
    await rows("UPDATE validations SET surveillance_due_at = now() + interval '5 days'")
    assert.equal((await val(ALICE, 'POST', `/${id}/surveillance`)).status, 403, 'only the lead records it')
    assert.equal((await val(VAL, 'POST', `/${id}/surveillance`)).status, 200)
    d = (await val(ALICE, 'GET', `/${id}`)).body
    assert.equal(d.status, 'current')
    assert.ok(d.surveillance.doneAt)
    assert.equal((await val(VAL, 'POST', `/${id}/surveillance`)).status, 409)
    // A not-validated outcome issues no validation.
    await truncateAll(); await beforeEachSetup()
    r = await issue({ scoreFor: () => 1, outcome: 'not_validated' })
    assert.equal(r.status, 200, r.text)
    assert.equal((await rows('SELECT 1 FROM validations')).length, 0)
    assert.equal(r.body.validationId, null)
  })

  it('statuses follow the calendar; a newer validation supersedes the current one; others cannot see it', async () => {
    await issue()
    const first = await onlyValidation()
    assert.equal((await val(ALICE, 'GET', `/${first.id}`)).body.status, 'current')
    assert.equal((await val(BOB, 'GET', `/${first.id}`)).status, 404, 'other organisations see nothing')
    assert.equal((await val(OTHER, 'GET', `/${first.id}`)).status, 404, 'nor do validators not on the engagement')
    assert.deepEqual((await val(BOB, 'GET', '')).body, [])
    assert.equal((await val(ALICE, 'GET', '')).body.length, 1)
    assert.equal((await val(null, 'GET', '')).status, 401)
    // Overdue: fixed 3-month schedule on a validation issued 4 months ago.
    await val(ALICE, 'PUT', `/${first.id}/schedule`, { mode: 'fixed_3' })
    await rows("UPDATE validations SET issued_at = now() - interval '4 months', expires_at = now() + interval '8 months'")
    let d = (await val(ALICE, 'GET', `/${first.id}`)).body
    assert.equal(d.status, 'follow_up_overdue')
    assert.equal(d.followUp.overdue, true)
    // The lead records it; the overdue flag clears.
    assert.equal((await val(ALICE, 'POST', `/${first.id}/follow-ups`, { result: 'confirmed' })).status, 403)
    assert.equal((await val(VAL, 'POST', `/${first.id}/follow-ups`, { result: 'confirmed', note: 'Minutes now on file' })).status, 200)
    d = (await val(ALICE, 'GET', `/${first.id}`)).body
    assert.equal(d.status, 'current')
    assert.equal(d.followUp.history.length, 1)
    // Expiry (not "not validated").
    await rows("UPDATE validations SET expires_at = now() - interval '1 day'")
    assert.equal((await val(ALICE, 'GET', `/${first.id}`)).body.status, 'expired')
    assert.equal((await val(VAL, 'POST', `/${first.id}/follow-ups`, { result: 'confirmed' })).status, 409)
    await rows("UPDATE validations SET expires_at = now() + interval '8 months'")
    // Supersede.
    await issue()
    const rowsNow = await rows('SELECT id, status FROM validations ORDER BY created_at')
    assert.equal(rowsNow.length, 2)
    assert.equal(rowsNow[0].status, 'superseded')
    assert.equal(rowsNow[1].status, 'current')
    assert.equal((await val(ALICE, 'GET', `/${first.id}`)).body.status, 'superseded')
  })

  it('the CIP can bring a follow-up forward but never extends validity', async () => {
    await issue({ outcome: 'validated_with_qualifications', qualify: [IDS[1]] })
    const v = await onlyValidation()
    const before = (await val(ALICE, 'GET', `/${v.id}`)).body
    // Milestone action due after the validity ends: the point is capped at expiry.
    await rows(`INSERT INTO capacity_actions(org_id,risk_id,question_id,due_date,status) VALUES('org_a','R1','${IDS[1]}','2031-01-01','In-Progress')`)
    let d = (await val(ALICE, 'GET', `/${v.id}`)).body
    assert.equal(d.followUp.dueOn, new Date(v.expires_at).toISOString().slice(0, 10), 'capped at expiry')
    assert.equal(d.expiresAt, before.expiresAt, 'validity unchanged by the CIP')
    // Done with proof: the check is brought forward to today, validity still unchanged.
    await rows("UPDATE capacity_actions SET status='Completed-Validated'")
    d = (await val(ALICE, 'GET', `/${v.id}`)).body
    assert.equal(d.followUp.broughtForward, true)
    assert.equal(d.followUp.dueOn, new Date().toISOString().slice(0, 10))
    assert.equal(d.expiresAt, before.expiresAt)
    assert.equal((await val(VAL, 'POST', `/${v.id}/follow-ups`, { result: 'confirmed' })).status, 200)
    assert.equal((await val(ALICE, 'GET', `/${v.id}`)).body.followUp.dueOn, null)
  })

  it('material events: reporting suspends pending review; only the lead decides; deadlines and lateness are recorded', async () => {
    await issue()
    const v = await onlyValidation()
    const today = new Date().toISOString().slice(0, 10)
    assert.equal((await val(VAL, 'POST', `/${v.id}/events`, { eventKey: 'fraud', occurredOn: today })).status, 403, 'the validator does not report for the organisation')
    assert.equal((await val(BOB, 'POST', `/${v.id}/events`, { eventKey: 'fraud', occurredOn: today })).status, 404)
    assert.equal((await val(ALICE, 'POST', `/${v.id}/events`, { eventKey: 'nope', occurredOn: today })).status, 400)
    // A starred event reported in time.
    const rep = await val(ALICE, 'POST', `/${v.id}/events`, { eventKey: 'fraud', occurredOn: today, details: 'Cashier theft' })
    assert.equal(rep.status, 201, rep.text)
    assert.equal(rep.body.status, 'suspended')
    assert.equal(rep.body.events[0].starred, true)
    assert.equal(rep.body.events[0].late, false)
    // Not-yet-reported older event: late.
    const late = await val(ALICE, 'POST', `/${v.id}/events`, { eventKey: 'leadership_change', occurredOn: new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10) })
    assert.equal(late.body.events.find((e: any) => e.key === 'leadership_change').late, true, 'failing to report on time is recorded')
    const [fraud, lead] = [rep.body.events[0].id, late.body.events.find((e: any) => e.key === 'leadership_change').id]
    // The organisation responds; it cannot decide.
    assert.equal((await val(ALICE, 'PUT', `/${v.id}/events/${fraud}/respond`, { response: 'Police report filed' })).status, 200)
    assert.equal((await val(ALICE, 'POST', `/${v.id}/events/${fraud}/decision`, { decision: 'reinstate', note: 'ok' })).status, 403)
    assert.equal((await val(OTHER, 'POST', `/${v.id}/events/${fraud}/decision`, { decision: 'reinstate', note: 'ok' })).status, 404)
    // Reinstating one of two open events keeps it suspended; the last one reinstates it.
    let d = (await val(VAL, 'POST', `/${v.id}/events/${fraud}/decision`, { decision: 'reinstate', note: 'Controls checked' })).body
    assert.equal(d.status, 'suspended')
    d = (await val(VAL, 'POST', `/${v.id}/events/${lead}/decision`, { decision: 're_scope', note: 'New CEO; scope unchanged' })).body
    assert.equal(d.status, 'current')
    assert.equal((await val(VAL, 'POST', `/${v.id}/events/${lead}/decision`, { decision: 'reinstate', note: 'again' })).status, 409, 'already decided')
    // The CRAFT programme team can record an event; it suspends too, and the organisation can respond.
    const prog = await val(ADMIN, 'POST', `/${v.id}/events`, { eventKey: 'sanctions_list', occurredOn: today })
    assert.equal(prog.status, 201, prog.text)
    assert.equal(prog.body.status, 'suspended')
    assert.equal(prog.body.events.find((e: any) => e.key === 'sanctions_list').reportedBySide, 'programme')
    // Withdrawal is terminal.
    const ev = prog.body.events.find((e: any) => e.key === 'sanctions_list').id
    d = (await val(VAL, 'POST', `/${v.id}/events/${ev}/decision`, { decision: 'withdraw', note: 'Listed for sanctions' })).body
    assert.equal(d.status, 'withdrawn')
    assert.equal((await val(ALICE, 'POST', `/${v.id}/events`, { eventKey: 'fraud', occurredOn: today })).status, 409)
    assert.equal((await val(VAL, 'POST', `/${v.id}/withdraw`, { reason: 'again' })).status, 409)
    assert.ok(d.history.length > 5, 'full history is kept')
    assert.ok(d.history.some((h: any) => /suspended pending review/.test(h.action)))
  })

  it('the lead can withdraw with a reason or shorten validity (never lengthen); the organisation cannot', async () => {
    await issue()
    const v = await onlyValidation()
    assert.equal((await val(ALICE, 'POST', `/${v.id}/withdraw`, { reason: 'x' })).status, 403)
    assert.equal((await val(VAL, 'POST', `/${v.id}/withdraw`, {})).status, 400, 'a reason is required')
    const soon = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10)
    const far = new Date(Date.now() + 900 * 86_400_000).toISOString().slice(0, 10)
    assert.equal((await val(ALICE, 'PUT', `/${v.id}/shorten`, { expiresOn: soon, reason: 'x' })).status, 403)
    assert.equal((await val(VAL, 'PUT', `/${v.id}/shorten`, { expiresOn: far, reason: 'longer' })).status, 400)
    assert.equal((await val(VAL, 'PUT', `/${v.id}/shorten`, { expiresOn: soon, reason: 'Licence under review' })).status, 200)
    assert.equal((await val(ALICE, 'GET', `/${v.id}`)).body.expiresAt.slice(0, 10), soon)
    const w = await val(VAL, 'POST', `/${v.id}/withdraw`, { reason: 'Evidence found to be wrong' })
    assert.equal(w.body.status, 'withdrawn')
    assert.equal(w.body.statusReason, 'Evidence found to be wrong')
  })

  it('emails organisation and validator 30 and 7 days before expiry, once each, and only when the provider accepts', async () => {
    await issue()
    const v = await onlyValidation()
    process.env.RESEND_API_KEY = 'placeholder-not-a-real-key'
    process.env.REMINDER_FROM_EMAIL = 'alerts@craft.example'
    const run = async () => {
      const mock = installFetchMock()
      try { await reminders(); return mock.calls.map((c) => JSON.parse(String(c.init?.body))) } finally { mock.restore() }
    }
    // Not yet within 30 days: nothing.
    assert.deepEqual(await run(), [])
    // 20 days out: the 30-day reminder goes to the organisation and the validator.
    await rows("UPDATE validations SET expires_at = now() + interval '20 days'")
    let sent = await run()
    assert.deepEqual(sent.map((s) => s.to).sort(), [ALICE, 'info@acme.example', VAL].sort())
    assert.match(sent[0].subject, /expiry due/)
    assert.equal((await rows('SELECT offset_days FROM validation_notifications'))[0].offset_days, 30)
    // Idempotent: a second run the same day sends nothing.
    assert.deepEqual(await run(), [])
    // 5 days out: the 7-day one, once.
    await rows("UPDATE validations SET expires_at = now() + interval '5 days'")
    sent = await run()
    assert.equal(sent.length, 3)
    assert.deepEqual(await run(), [])
    assert.equal((await rows('SELECT DISTINCT offset_days FROM validation_notifications ORDER BY 1')).map((r: any) => r.offset_days).join(), '7,30')
    // A rejecting provider records nothing, so it is retried; an unconfigured one records nothing either.
    await rows('DELETE FROM validation_notifications')
    const failing = installFetchMock(() => new Response('no', { status: 500 }))
    try { const res = await reminders(); assert.equal(res.status, 502) } finally { failing.restore() }
    assert.equal((await rows('SELECT 1 FROM validation_notifications')).length, 0)
    delete process.env.RESEND_API_KEY
    await reminders()
    assert.equal((await rows('SELECT 1 FROM validation_notifications')).length, 0)
    // Withdrawn validations are never reminded about.
    await rows("UPDATE validations SET status='withdrawn'")
    process.env.RESEND_API_KEY = 'placeholder-not-a-real-key'
    assert.deepEqual(await run(), [])
    assert.ok(v.id)
  })
})
