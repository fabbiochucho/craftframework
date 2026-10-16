import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetchMock, rows, truncateAll } from './harness.ts'
import { FRAMEWORKS } from '../../src/lib/validationReview.ts'
import { VERIFICATION_ID_PATTERN } from '../../src/lib/validity.ts'
import { decryptField } from '../../netlify/lib/crypto.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const directory = await load('directory')
const firmsApi = await load('firms')
const engagements = await load('engagements')
const reviews = await load('validation-reviews')
const lifecycle = await load('validation-lifecycle')
const daily = await load('validation-reminders')
const lib = await import(new URL('../../netlify/lib/validation-lifecycle.ts', import.meta.url).href)

const ALICE = 'alice@org-a.example'
const BOB = 'bob@org-b.example'
const VAL = 'val@validators.example' // accredited, lead
const VAL2 = 'val2@validators.example' // accredited, non-lead team member
const OTHER = 'other@validators.example' // accredited, never named
const FUND = 'fund@capital.example'
const STAFF = 'programme@craft.example'
const IDS = FRAMEWORKS['capital-readiness'].indicators.map((i) => i.id)
const L1 = FRAMEWORKS['capital-readiness'].indicators.filter((i) => i.level === 1).map((i) => i.id)
const DAY = 86_400_000

async function call(email: string | null, method: string, path: string, body?: unknown, handler: any = lifecycle) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}
const lc = (email: string | null, method: string, path: string, body?: unknown) => call(email, method, `validation-lifecycle${path}`, body)
const rev = (email: string | null, method: string, path: string, body?: unknown) => call(email, method, `validation-reviews${path}`, body, reviews)
const eng = (email: string | null, method: string, path: string, body?: unknown) => call(email, method, `engagements${path}`, body, engagements)
const selfScores = async () => JSON.parse(decryptField((await rows("SELECT value FROM legacy_workspace_state WHERE org_id='org_a' AND key='capital:scores'"))[0].value))
const putSelf = (scores: Record<string, number>) => rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('org_a','capital:scores',$1) ON CONFLICT (org_id,key) DO UPDATE SET value=EXCLUDED.value`, [JSON.stringify(scores)])
const val = async () => (await rows('SELECT * FROM validations ORDER BY created_at'))[0]

async function profile(email: string, name: string) {
  const r = await call(email, 'PUT', 'directory/me/validator', { name }, directory)
  await rows("UPDATE validator_profiles SET accreditation_status='accredited', accredited_until = now() + interval '1 year' WHERE email=$1", [email])
  return r.body.id as string
}

let valId: string
let engId: string

// A review ready to finalise by VAL (all 4s, so the validated rung is 7).
async function readyReview(opts: { qualify?: boolean; team2?: boolean } = {}) {
  const created = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: valId })
  const id = created.body.id as string
  await eng(VAL, 'POST', `/${id}/respond`, { side: 'validator', decision: 'accept' })
  assert.equal((await eng(VAL, 'POST', `/${id}/declaration`, { confirmed: true, signedName: 'Valerie Okafor' })).status, 200)
  if (opts.team2) {
    await eng(VAL, 'POST', `/${id}/members`, { email: VAL2 })
    await eng(ALICE, 'POST', `/${id}/members/${VAL2}/approve`)
    await eng(VAL2, 'POST', `/${id}/declaration`, { confirmed: true, signedName: 'Victor Mensah' })
  }
  assert.equal((await rev(VAL, 'PUT', `/${id}/setup`, { method: 'combined', fieldworkStart: '2026-01-05', fieldworkEnd: '2026-01-09' })).status, 200)
  for (const ind of IDS) assert.equal((await rev(VAL, 'PUT', `/${id}/scores/${ind}`, { score: 4, sufficiency: 'sufficient' })).status, 200)
  if (opts.qualify) assert.equal((await rev(VAL, 'POST', `/${id}/qualifications`, { text: 'Board minutes incomplete', indicatorIds: [L1[0], L1[1]] })).status, 201)
  return id
}
async function finalised(opts: { qualify?: boolean; body?: object; team2?: boolean } = {}) {
  engId = await readyReview(opts)
  const r = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: opts.qualify ? 'validated_with_qualifications' : 'validated', ...opts.body })
  assert.equal(r.status, 200, r.text)
  return r.body
}

describe('validator lifecycle: validity, statuses, material events and CIP follow-up', () => {
  beforeEach(async () => {
    await truncateAll()
    delete process.env.RESEND_API_KEY
    delete process.env.REMINDER_FROM_EMAIL
    await rows(`INSERT INTO organizations(id,name,country,sector,email) VALUES('org_a','Acme Cooperative','Kenya','Agriculture','info@org-a.example'),('org_b','Hidden Trust','Kenya','Health','info@org-b.example')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
    valId = await profile(VAL, 'Valerie Okafor')
    await profile(VAL2, 'Victor Mensah')
    await profile(OTHER, 'Olu Other')
    await putSelf(Object.fromEntries(IDS.map((i) => [i, 4])))
  })
  afterEach(() => { delete process.env.RESEND_API_KEY; delete process.env.REMINDER_FROM_EMAIL })

  it('issues the validation at finalise: random verification id, 12 months, history, seeded CIP; refuses invalid validity without finalising', async () => {
    engId = await readyReview()
    // Rules are enforced server-side and a refusal finalises nothing.
    for (const [body, pattern] of [
      [{ validityMonths: 18 }, /Validity can be/], [{ validityMonths: 9 }, /Name the risk/], [{ validityMonths: 30 }, /ensure|must|at most|Too big|Invalid/i],
    ] as const) {
      const r = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated', ...body })
      assert.equal(r.status, 400)
      if (body.validityMonths !== 30) assert.match(JSON.stringify(r.body.problems), pattern)
    }
    assert.equal((await rows('SELECT status FROM validation_reviews'))[0].status, 'draft')
    assert.equal((await rows('SELECT count(*)::int AS n FROM validations'))[0].n, 0)
    const ok = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated' })
    assert.equal(ok.status, 200, ok.text)
    assert.match(ok.body.verificationId, VERIFICATION_ID_PATTERN)
    const v = await val()
    assert.equal(v.validity_months, 12)
    assert.equal(v.status, 'current')
    assert.equal(new Date(v.expires_at).toISOString().slice(0, 10), new Date(Date.UTC(new Date(v.issued_at).getUTCFullYear() + 1, new Date(v.issued_at).getUTCMonth(), new Date(v.issued_at).getUTCDate())).toISOString().slice(0, 10))
    assert.equal(v.follow_up_kind, 'milestone')
    assert.equal(v.validated_rung, 7)
    const hist = await rows('SELECT to_status, reason FROM validation_status_history')
    assert.deepEqual(hist.map((h: any) => [h.to_status, h.reason]), [['current', 'Issued']])
    // The frozen snapshot is unaffected by anything the lifecycle does.
    assert.ok(!JSON.stringify((await rows('SELECT snapshot FROM validation_reviews'))[0].snapshot).includes(v.verification_id))
  })

  it('qualified = 6 months with a CIP action per qualification; 24 months only at rung 5+ without qualifications; shorter needs a named risk', async () => {
    await finalised({ qualify: true })
    const q = await val()
    assert.equal(q.validity_months, 6)
    const actions = await rows('SELECT text, indicator_ids, owner, due_date, qualification_id FROM validation_cip_actions')
    assert.equal(actions.length, 1)
    assert.deepEqual(actions[0].indicator_ids, [L1[0], L1[1]])
    assert.equal(actions[0].owner, null, 'the organisation names the owner')
    assert.deepEqual((await rows('SELECT follow_up_indicators FROM validations'))[0].follow_up_indicators.sort(), [L1[0], L1[1]].sort(), 'follow-ups re-check the qualified indicators')

    // 24 months is refused for a qualified outcome.
    engId = await readyReview({ qualify: true })
    const r = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated_with_qualifications', validityMonths: 24 })
    assert.equal(r.status, 400)
    assert.match(JSON.stringify(r.body.problems), /without qualifications/)
  })

  it('24 months with a month-12 surveillance check; missing it expires the validation at 12', async () => {
    await finalised({ body: { validityMonths: 24 } })
    const v = await val()
    assert.equal(v.validity_months, 24)
    assert.equal(v.surveillance, true)
    const cps = await rows("SELECT kind, due_at FROM validation_checkpoints WHERE kind='surveillance'")
    assert.equal(cps.length, 1)
    const month12 = new Date(cps[0].due_at)
    assert.equal(new Date(v.expires_at).getUTCFullYear() - month12.getUTCFullYear(), 1)
    // 13 months in: the surveillance check was missed.
    const sweepAt = new Date(month12.getTime() + 30 * DAY)
    const r = await lib.sweepValidations(sweepAt)
    assert.equal(r.changed, 1)
    const after = await val()
    assert.equal(after.status, 'expired')
    assert.equal(new Date(after.expires_at).getTime(), month12.getTime(), 'expires at 12, not 24')
    const hist = await rows('SELECT to_status, reason FROM validation_status_history ORDER BY created_at')
    assert.match(hist[hist.length - 1].reason, /surveillance/)
  })

  it('shorter validity for a named risk is accepted; shortening later works, extending never does', async () => {
    await finalised({ body: { validityMonths: 9, validityReason: 'Audit result still pending' } })
    const v = await val()
    assert.equal(v.validity_months, 9)
    assert.equal(v.validity_choice, 'shorter')
    const before = new Date(v.expires_at).getTime()
    // Only the lead validator may shorten; never extend.
    assert.equal((await lc(ALICE, 'POST', `/${engId}/shorten`, { months: 3, reason: 'x y z' })).status, 403)
    assert.equal((await lc(VAL, 'POST', `/${engId}/shorten`, { months: 12, reason: 'Longer please' })).status, 400, 'cannot extend 9 -> 12')
    assert.equal((await lc(VAL, 'POST', `/${engId}/shorten`, { months: 9, reason: 'Same' })).status, 400, 'equal is not a shortening')
    assert.equal(new Date((await val()).expires_at).getTime(), before)
    assert.equal((await lc(VAL, 'POST', `/${engId}/shorten`, { months: 4, reason: 'Funder suspended the grant' })).status, 200)
    assert.ok(new Date((await val()).expires_at).getTime() < before)
  })

  it('the CIP can bring a follow-up forward but never extends validity', async () => {
    await finalised({ qualify: true })
    const action = (await rows('SELECT id FROM validation_cip_actions'))[0].id
    const expiry0 = new Date((await val()).expires_at).getTime()
    // An action due years after expiry cannot push the follow-up (or validity) past expiry.
    assert.equal((await lc(ALICE, 'PUT', `/${engId}/cip/${action}`, { owner: 'Head of Finance', dueDate: '2035-01-01' })).status, 200)
    let cp = (await rows("SELECT due_at FROM validation_checkpoints WHERE kind='follow_up'"))[0]
    assert.ok(new Date(cp.due_at).getTime() < expiry0, 'the follow-up is clamped before expiry')
    assert.equal(new Date((await val()).expires_at).getTime(), expiry0)
    // Doing the work with evidence brings the check forward (within 14 days) — and validity stays put.
    assert.equal((await lc(ALICE, 'POST', `/${engId}/cip/${action}/done`, { proof: 'Minutes 2026-03-01, evidence EV-12' })).status, 200)
    cp = (await rows("SELECT due_at FROM validation_checkpoints WHERE kind='follow_up'"))[0]
    assert.ok(new Date(cp.due_at).getTime() <= Date.now() + 15 * DAY)
    assert.equal(new Date((await val()).expires_at).getTime(), expiry0, 'validity is untouched by the CIP')
    // Once the organisation has agreed the schedule, a later edit cannot push a brought-forward check back out.
    assert.equal((await lc(ALICE, 'POST', `/${engId}/schedule/agree`)).status, 200)
    const added = await lc(ALICE, 'POST', `/${engId}/cip`, { text: 'More work', owner: 'CFO', dueDate: '2026-12-01', indicatorIds: [L1[0]] })
    assert.equal(added.status, 201)
    const cp2 = (await rows("SELECT due_at FROM validation_checkpoints WHERE kind='follow_up'"))[0]
    assert.ok(new Date(cp2.due_at).getTime() <= new Date(cp.due_at).getTime(), 'an agreed check only ever moves earlier')
    assert.equal(new Date((await val()).expires_at).getTime(), expiry0)
  })

  it('CIP actions need an owner, due date and proof; done updates the self-assessment only for linked indicators; the frozen result is untouched', async () => {
    await finalised({ qualify: true })
    const [{ id: action }] = await rows('SELECT id FROM validation_cip_actions')
    const frozen = (await rows('SELECT snapshot_sha256 FROM validation_reviews'))[0].snapshot_sha256
    await putSelf(Object.fromEntries(IDS.map((i) => [i, 2])))
    // Not done without owner and due date, nor without proof, nor by anyone but the organisation.
    assert.equal((await lc(ALICE, 'POST', `/${engId}/cip/${action}/done`, { proof: 'Minutes filed' })).status, 400, 'no owner / due date yet')
    await lc(ALICE, 'PUT', `/${engId}/cip/${action}`, { owner: 'Board Secretary', dueDate: '2026-12-01' })
    assert.equal((await lc(ALICE, 'POST', `/${engId}/cip/${action}/done`, { proof: '' })).status, 400, 'proof required')
    assert.equal((await lc(VAL, 'POST', `/${engId}/cip/${action}/done`, { proof: 'I say so' })).status, 403, 'the validator cannot mark the organisation\'s work done')
    assert.equal((await lc(BOB, 'POST', `/${engId}/cip/${action}/done`, { proof: 'x y z' })).status, 404)
    assert.equal((await lc(ALICE, 'POST', `/${engId}/cip/${action}/done`, { proof: 'Minutes filed', selfScores: { [IDS[10]]: 5 } })).status, 400, 'not a linked indicator')
    assert.equal((await lc(ALICE, 'POST', `/${engId}/cip/${action}/done`, { proof: 'Minutes filed', selfScores: { [L1[0]]: 4 } })).status, 200)
    const s = await selfScores()
    assert.equal(s[L1[0]], 4, 'self-assessment updated')
    assert.equal(s[IDS[10]], 2, 'unlinked indicators untouched')
    assert.equal((await rows('SELECT snapshot_sha256 FROM validation_reviews'))[0].snapshot_sha256, frozen)
    const done = (await rows('SELECT status, proof, done_by FROM validation_cip_actions'))[0]
    assert.deepEqual([done.status, done.proof, done.done_by], ['done', 'Minutes filed', ALICE])
    assert.equal((await lc(ALICE, 'PUT', `/${engId}/cip/${action}`, { text: 'rewrite history' })).status, 409, 'a completed action is fixed')
    assert.equal((await lc(ALICE, 'DELETE', `/${engId}/cip/${action}`)).status, 409)
    assert.ok((await rows("SELECT 1 FROM audit_logs WHERE category='Validation' AND action ~ 'done with evidence'")).length === 1)
  })

  it('the follow-up schedule is proposed by one side and agreed by the other; strangers and non-leads are refused', async () => {
    await finalised({ qualify: true, team2: true })
    let v = (await lc(ALICE, 'GET', `/${engId}`)).body
    assert.equal(v.followUp.kind, 'milestone')
    assert.deepEqual([v.followUp.validatorOk, v.followUp.orgOk], [true, false], 'chosen at finalise by the validator; the organisation still has to agree')
    assert.equal((await lc(ALICE, 'POST', `/${engId}/schedule/agree`)).status, 200)
    v = (await lc(ALICE, 'GET', `/${engId}`)).body
    assert.deepEqual([v.followUp.validatorOk, v.followUp.orgOk], [true, true])
    // The organisation proposes fixed 3-month checks: the validator must now agree.
    assert.equal((await lc(ALICE, 'PUT', `/${engId}/schedule`, { kind: 'fixed_3' })).status, 200)
    v = (await lc(VAL, 'GET', `/${engId}`)).body
    assert.deepEqual([v.followUp.kind, v.followUp.validatorOk, v.followUp.orgOk], ['fixed_3', false, true])
    assert.equal((await lc(VAL2, 'POST', `/${engId}/schedule/agree`)).status, 403, 'a non-lead team member cannot agree')
    assert.equal((await lc(OTHER, 'PUT', `/${engId}/schedule`, { kind: 'fixed_6' })).status, 404)
    assert.equal((await lc(BOB, 'PUT', `/${engId}/schedule`, { kind: 'fixed_6' })).status, 404)
    assert.equal((await lc(ALICE, 'PUT', `/${engId}/schedule`, { kind: 'whenever' })).status, 400)
    assert.equal((await lc(VAL, 'POST', `/${engId}/schedule/agree`)).status, 200)
    // 6-month validity + every 3 months: no room for a point before expiry other than month 3.
    const pts = await rows("SELECT due_at FROM validation_checkpoints WHERE kind='follow_up' ORDER BY due_at")
    assert.equal(pts.length, 1)
    assert.ok(new Date(pts[0].due_at).getTime() < new Date((await val()).expires_at).getTime())
  })

  it('refuses everyone outside the engagement and read-only sessions; only parties see the lifecycle', async () => {
    await finalised({ qualify: true })
    assert.equal((await lc(null, 'GET', `/${engId}`)).status, 401)
    assert.equal((await lc(BOB, 'GET', `/${engId}`)).status, 404, 'another organisation')
    assert.equal((await lc(OTHER, 'GET', `/${engId}`)).status, 404, 'an accredited validator who is not on the engagement')
    assert.equal((await lc(ALICE, 'GET', `/${engId}`)).status, 200)
    assert.equal((await lc(VAL, 'GET', `/${engId}`)).status, 200)
    assert.equal((await lc(BOB, 'GET', '/org/org_a')).status, 403)
    assert.equal((await lc(ALICE, 'GET', '/org/org_a')).body.validations.length, 1)
    assert.equal((await lc(VAL2, 'POST', `/${engId}/withdraw`, { reason: 'not on the team' })).status, 404)
    assert.equal((await lc(OTHER, 'POST', `/${engId}/events`, { eventType: 'fraud_corruption', occurredOn: '2026-10-01', description: 'x' })).status, 404)
    assert.equal((await lc(BOB, 'POST', `/${engId}/shorten`, { months: 1, reason: 'abc' })).status, 404)
  })

  describe('material events', () => {
    const report = (email: string, over: object = {}) =>
      lc(email, 'POST', `/${engId}/events`, { eventType: 'leadership_change', occurredOn: new Date(Date.now() - 2 * DAY).toISOString().slice(0, 10), description: 'CEO resigned', ...over })

    it('reporting suspends pending review; the validator reinstates; history and audit record each step', async () => {
      await finalised({ qualify: true })
      const mock = installFetchMock()
      process.env.RESEND_API_KEY = 'test'
      process.env.REMINDER_FROM_EMAIL = 'CRAFT <alerts@example.com>'
      try {
        assert.equal((await report(VAL)).status, 403, 'the validator cannot report on the organisation\'s behalf')
        assert.equal((await report(ALICE, { eventType: 'made_up' })).status, 400)
        assert.equal((await report(ALICE, { occurredOn: '2999-01-01' })).status, 400)
        const r = await report(ALICE)
        assert.equal(r.status, 201, r.text)
        assert.equal(r.body.status, 'suspended')
        assert.equal(r.body.late, false)
        assert.equal((await val()).status, 'suspended')
        assert.ok(mock.calls.some((c) => JSON.parse(String(c.init?.body)).to === VAL), 'the validator is told')
        const evId = (await rows('SELECT id FROM material_events'))[0].id
        // Only the lead validator decides.
        assert.equal((await lc(ALICE, 'POST', `/${engId}/events/${evId}/resolve`, { decision: 'reinstate', note: 'We say it is fine' })).status, 403)
        assert.equal((await lc(VAL, 'POST', `/${engId}/events/${evId}/resolve`, { decision: 'reinstate' })).status, 400, 'reasons are required')
        const ok = await lc(VAL, 'POST', `/${engId}/events/${evId}/resolve`, { decision: 'reinstate', note: 'Orderly handover, controls unaffected' })
        assert.equal(ok.status, 200, ok.text)
        assert.equal(ok.body.status, 'current')
        assert.equal((await lc(VAL, 'POST', `/${engId}/events/${evId}/resolve`, { decision: 'withdraw', note: 'again' })).status, 409, 'already decided')
        const hist = (await rows('SELECT to_status, reason FROM validation_status_history ORDER BY created_at')).map((h: any) => h.to_status)
        assert.deepEqual(hist, ['current', 'suspended', 'current'])
        assert.ok((await rows("SELECT 1 FROM audit_logs WHERE category='Validation' AND action ~ 'reported a material event'")).length === 1)
      } finally { mock.restore() }
    })

    it('starred events must be reported within 5 working days, others within 30 days; late reports are flagged', async () => {
      await finalised({ qualify: true })
      const old = new Date(Date.now() - 40 * DAY).toISOString().slice(0, 10)
      const late = await report(ALICE, { occurredOn: old })
      assert.equal(late.body.late, true, '40 days > 30')
      const star = await report(ALICE, { eventType: 'fraud_corruption', occurredOn: new Date(Date.now() - 12 * DAY).toISOString().slice(0, 10) })
      assert.equal(star.body.late, true, '12 days > 5 working days for a starred event')
      const ok = await report(ALICE, { eventType: 'restructuring', occurredOn: new Date(Date.now() - 12 * DAY).toISOString().slice(0, 10) })
      assert.equal(ok.body.late, false, 'the same age is on time for a non-starred event')
      const evs = await rows('SELECT event_type, starred, late FROM material_events ORDER BY reported_at')
      assert.deepEqual(evs.map((e: any) => [e.event_type, e.starred, e.late]), [['leadership_change', false, true], ['fraud_corruption', true, true], ['restructuring', false, false]])
    })

    it('re-scope keeps it current with a scope note; withdraw ends it with the reason; other open events keep it suspended', async () => {
      await finalised({ qualify: true })
      await report(ALICE, { eventType: 'restructuring' })
      await report(ALICE, { eventType: 'leadership_change' })
      const [a, b] = (await rows('SELECT id FROM material_events ORDER BY reported_at')).map((r: any) => r.id)
      assert.equal((await lc(VAL, 'POST', `/${engId}/events/${a}/resolve`, { decision: 'rescope', note: 'Programme closed' })).status, 400, 'a scope note is required')
      const first = await lc(VAL, 'POST', `/${engId}/events/${a}/resolve`, { decision: 'rescope', note: 'Programme closed', scopeNote: 'Excludes the Nairobi programme' })
      assert.equal(first.body.status, 'suspended', 'a second event is still open')
      const second = await lc(VAL, 'POST', `/${engId}/events/${b}/resolve`, { decision: 'reinstate', note: 'Fine' })
      assert.equal(second.body.status, 'current')
      assert.match((await val()).scope_note, /Nairobi/)
      await report(ALICE, { eventType: 'sanctions_list' })
      const c = (await rows("SELECT id FROM material_events WHERE status='pending_review'"))[0].id
      assert.equal((await lc(VAL, 'POST', `/${engId}/events/${c}/resolve`, { decision: 'withdraw', note: 'Listed on a debarment list' })).body.status, 'withdrawn')
      const v = await val()
      assert.equal(v.status, 'withdrawn')
      assert.equal(v.withdrawn_reason, 'Listed on a debarment list')
      // Withdrawn is final: no more events, no more decisions, no sweep revival.
      assert.equal((await report(ALICE)).status, 409)
      assert.equal((await lib.sweepValidations(new Date())).changed, 0)
      assert.equal((await val()).status, 'withdrawn')
    })

    it('the CRAFT programme team can record an event; the organisation is notified, can respond and can contest', async () => {
      await finalised({ qualify: true })
      await rows("INSERT INTO training_staff(email, role, added_by) VALUES($1, 'programme_team', 'seed')", [STAFF])
      const mock = installFetchMock()
      process.env.RESEND_API_KEY = 'test'
      process.env.REMINDER_FROM_EMAIL = 'CRAFT <alerts@example.com>'
      try {
        assert.equal((await report(OTHER)).status, 404, 'a validator outside the engagement cannot record events')
        const r = await report(STAFF, { eventType: 'regulator_sanction', description: 'Regulator notice published' })
        assert.equal(r.status, 201, r.text)
        const tos = mock.calls.map((c) => JSON.parse(String(c.init?.body)).to)
        assert.ok(tos.includes('info@org-a.example') && tos.includes(VAL), 'both the organisation and the validator are told')
      } finally { mock.restore() }
      const ev = (await rows('SELECT id, reported_by_side, late FROM material_events'))[0]
      assert.deepEqual([ev.reported_by_side, ev.late], ['programme_team', false])
      assert.equal((await lc(ALICE, 'POST', `/${engId}/events/${ev.id}/respond`, { response: 'Notice was withdrawn on 2 October' })).status, 200)
      const seen = (await lc(ALICE, 'GET', `/${engId}`)).body.events[0]
      assert.equal(seen.orgResponse, 'Notice was withdrawn on 2 October')
      assert.equal((await lc(VAL, 'POST', `/${engId}/events/${ev.id}/contest`, { reason: 'x y z' })).status, 403)
      assert.equal((await lc(ALICE, 'POST', `/${engId}/events/${ev.id}/contest`, { reason: 'The sanction was lifted' })).body.referredTo, 'review_panel')
      assert.equal((await lc(ALICE, 'POST', `/${engId}/events/${ev.id}/contest`, { reason: 'again again' })).status, 409)
      // The programme team sees events and status but not the organisation's plan.
      const staffView = (await lc(STAFF, 'GET', `/${engId}`)).body
      assert.ok(staffView.events.length === 1 && staffView.actions === undefined)
    })

    it('a validator can withdraw with a reason; the organisation cannot', async () => {
      await finalised()
      assert.equal((await lc(ALICE, 'POST', `/${engId}/withdraw`, { reason: 'We changed our mind' })).status, 403)
      assert.equal((await lc(VAL, 'POST', `/${engId}/withdraw`, {})).status, 400)
      assert.equal((await lc(VAL, 'POST', `/${engId}/withdraw`, { reason: 'New evidence shows the payroll controls were not operating' })).status, 200)
      assert.equal((await val()).status, 'withdrawn')
      assert.equal((await lc(VAL, 'POST', `/${engId}/withdraw`, { reason: 'twice over' })).status, 409)
    })
  })

  it('statuses move with the clock: follow-up overdue, back to current when done, then expired', async () => {
    await finalised({ qualify: true })
    const [{ id: action }] = await rows('SELECT id FROM validation_cip_actions')
    await lc(ALICE, 'PUT', `/${engId}/cip/${action}`, { owner: 'CFO', dueDate: '2026-12-01' })
    const cp = (await rows("SELECT id, due_at FROM validation_checkpoints WHERE kind='follow_up'"))[0]
    const due = new Date(cp.due_at)
    assert.equal((await lib.sweepValidations(new Date(due.getTime() - DAY))).changed, 0)
    assert.equal((await lib.sweepValidations(new Date(due.getTime() + DAY))).changed, 1)
    assert.equal((await val()).status, 'follow_up_overdue')
    assert.equal((await lib.sweepValidations(new Date(due.getTime() + 2 * DAY))).changed, 0, 'idempotent')
    // Only the lead validator records the check; a failure needs a note.
    assert.equal((await lc(ALICE, 'POST', `/${engId}/checkpoints/${cp.id}/complete`, { result: 'confirmed' })).status, 403)
    assert.equal((await lc(VAL, 'POST', `/${engId}/checkpoints/${cp.id}/complete`, { result: 'not_confirmed' })).status, 400)
    const done = await lc(VAL, 'POST', `/${engId}/checkpoints/${cp.id}/complete`, { result: 'confirmed', note: 'Minutes now complete' })
    assert.equal(done.status, 200)
    // The completion happened (late, via the API) and the status is recomputed from the real clock.
    assert.equal((await val()).status, 'current')
    // At expiry: expired, not follow-up overdue.
    const expiry = new Date((await val()).expires_at)
    await rows("UPDATE validation_checkpoints SET state='pending', result=NULL, done_at=NULL WHERE id=$1", [cp.id])
    await lib.sweepValidations(new Date(expiry.getTime() + DAY))
    assert.equal((await val()).status, 'expired')
    const hist = (await rows('SELECT to_status FROM validation_status_history ORDER BY created_at')).map((h: any) => h.to_status)
    assert.deepEqual(hist, ['current', 'follow_up_overdue', 'current', 'expired'])
    // Expired is final: its plan is read-only and the CIP cannot revive it.
    assert.equal((await lc(ALICE, 'POST', `/${engId}/cip`, { text: 'Late fix', indicatorIds: [] })).status, 409)
    assert.equal((await lc(VAL, 'POST', `/${engId}/shorten`, { months: 1, reason: 'abc' })).status, 409)
    await lib.sweepValidations(new Date(expiry.getTime() + 400 * DAY))
    assert.equal((await val()).status, 'expired')
  })

  it('a newer validation supersedes the one in force; a not-validated outcome supersedes nothing and carries no expiry', async () => {
    await finalised()
    const firstEng = engId
    // Second engagement for the same organisation: the first engagement\'s grant is long revoked.
    engId = await readyReview()
    assert.equal((await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated' })).status, 200)
    const all = await rows('SELECT engagement_id, status, superseded_by, id FROM validations ORDER BY created_at')
    assert.equal(all.length, 2)
    assert.equal(all[0].status, 'superseded')
    assert.equal(all[0].superseded_by, all[1].id)
    assert.equal(all[1].status, 'current')
    assert.equal((await lc(ALICE, 'GET', `/${firstEng}`)).body.status, 'superseded')
    // A "not validated" result: no expiry, nothing superseded.
    engId = await readyReview()
    for (const ind of IDS) await rev(VAL, 'PUT', `/${engId}/scores/${ind}`, { score: 1, sufficiency: 'insufficient' })
    const nv = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'not_validated', summary: 'Evidence insufficient' })
    assert.equal(nv.status, 200, nv.text)
    const rowsNow = await rows('SELECT outcome, status, expires_at, validity_months FROM validations ORDER BY created_at')
    assert.deepEqual([rowsNow[2].outcome, rowsNow[2].expires_at, rowsNow[2].validity_months], ['not_validated', null, 0])
    assert.equal(rowsNow[1].status, 'current', 'a failed re-review does not supersede the earlier result')
    assert.equal((await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'not_validated', validityMonths: 12 })).status, 409)
  })

  it('gives reviews finalised before this PR their validation on first look', async () => {
    await finalised()
    const v0 = await val()
    await rows('DELETE FROM validations')
    assert.equal((await rows('SELECT count(*)::int AS n FROM validations'))[0].n, 0)
    const got = await lc(ALICE, 'GET', `/${engId}`)
    assert.equal(got.status, 200)
    assert.match(got.body.verificationId, VERIFICATION_ID_PATTERN)
    assert.equal(got.body.validityMonths, 12)
    assert.notEqual(got.body.verificationId, v0.verification_id)
    assert.equal(await lib.backfillValidations(), 0, 'idempotent')
  })

  it('a funder reviewer sees schedule and status, and CIP progress only with the organisation\'s consent', async () => {
    const fu = await call(FUND, 'POST', 'firms', { name: 'Savannah Capital', kind: 'funding_partner', nature: 'DFI' }, firmsApi)
    await call(ALICE, 'PUT', 'directory/me/organization', { listed: true, summary: 'Co-op' }, directory)
    const orgProfile = (await rows("SELECT id FROM org_directory_profiles WHERE org_id='org_a'"))[0].id
    const id = (await eng(FUND, 'POST', '', { side: 'funder', type: 'funder_review', funderFirmId: fu.body.id, organizationProfileId: orgProfile })).body.id
    await eng(FUND, 'POST', `/${id}/members`, { email: FUND, role: 'lead' })
    await eng(FUND, 'POST', `/${id}/declaration`, { confirmed: true, signedName: 'Fund Officer' })
    await eng(ALICE, 'POST', `/${id}/respond`, { side: 'organization', decision: 'accept' })
    await rev(FUND, 'PUT', `/${id}/setup`, { method: 'document_review', fieldworkStart: '2026-01-05', fieldworkEnd: '2026-01-09' })
    for (const ind of IDS) await rev(FUND, 'PUT', `/${id}/scores/${ind}`, { score: 4, sufficiency: 'sufficient' })
    await rev(FUND, 'POST', `/${id}/qualifications`, { text: 'Gaps in minutes', indicatorIds: [L1[0]] })
    assert.equal((await rev(FUND, 'POST', `/${id}/finalise`, { outcome: 'validated_with_qualifications' })).status, 200)
    engId = id
    const action = (await rows('SELECT id FROM validation_cip_actions'))[0].id
    await lc(ALICE, 'PUT', `/${id}/cip/${action}`, { owner: 'CFO', dueDate: '2026-12-01' })
    // No consent yet: status and schedule, no plan.
    let seen = (await lc(FUND, 'GET', `/${id}`)).body
    assert.equal(seen.status, 'current')
    assert.equal(seen.viewer.funder, true)
    assert.equal(seen.cip, null)
    assert.equal(seen.actions, undefined)
    assert.ok(!JSON.stringify(seen).includes('CFO') && !JSON.stringify(seen).includes('Gaps in minutes'))
    // The funder cannot grant itself consent, nor edit the plan.
    assert.equal((await lc(FUND, 'PUT', `/${id}/consent`, { funder: true })).status, 403)
    assert.equal((await lc(FUND, 'POST', `/${id}/cip`, { text: 'Funder\'s own action', indicatorIds: [] })).status, 403)
    assert.equal((await lc(BOB, 'PUT', `/${id}/consent`, { funder: true })).status, 404)
    assert.equal((await lc(ALICE, 'PUT', `/${id}/consent`, { funder: true })).status, 200)
    seen = (await lc(FUND, 'GET', `/${id}`)).body
    assert.match(seen.cip.progress.sentence, /^0 of 1 action done, follow-up due \d+ \w+$/)
    assert.equal(seen.actions, undefined, 'progress only, never the plan itself')
    assert.equal((await lc(ALICE, 'PUT', `/${id}/consent`, { funder: false })).status, 200)
    assert.equal((await lc(FUND, 'GET', `/${id}`)).body.cip, null, 'consent can be withdrawn')
  })

  describe('daily run', () => {
    const configure = () => { process.env.RESEND_API_KEY = 'test'; process.env.REMINDER_FROM_EMAIL = 'CRAFT <alerts@example.com>' }
    it('emails the organisation and the validator 30 and 7 days before a point and expiry, once each', async () => {
      await finalised({ qualify: true })
      configure()
      const mock = installFetchMock()
      try {
        const v = await val()
        const expiry = new Date(v.expires_at)
        const cp = (await rows("SELECT id, due_at FROM validation_checkpoints WHERE kind='follow_up'"))[0]
        const cpDue = new Date(cp.due_at)
        // Far from everything: nothing to send.
        let r = await lib.sendDueReminders(new Date(v.issued_at))
        const farOut = r.sent
        // 30 days before the follow-up point (the earlier of the two points).
        const t30 = new Date(cpDue.getTime() - 30 * DAY)
        r = await lib.sendDueReminders(t30)
        assert.ok(r.sent >= 1)
        const to30 = mock.calls.map((c) => JSON.parse(String(c.init?.body)))
        assert.ok(to30.some((m) => m.to === 'info@org-a.example') && to30.some((m) => m.to === VAL), 'organisation and validator')
        assert.ok(to30.every((m) => /CRAFT-V-/.test(m.subject)))
        const after30 = mock.calls.length
        assert.equal((await lib.sendDueReminders(t30)).sent, 0, 'same day again: nothing more')
        assert.equal(mock.calls.length, after30)
        // 7 days before.
        assert.equal((await lib.sendDueReminders(new Date(cpDue.getTime() - 7 * DAY))).sent >= 1, true)
        assert.equal(mock.calls.length, after30 + 2)
        // Expiry has its own pair.
        const before = mock.calls.length
        await lib.sendDueReminders(new Date(expiry.getTime() - 30 * DAY))
        assert.ok(mock.calls.length > before)
        void farOut
        const sent = await rows('SELECT point, days_before FROM validation_reminders ORDER BY point, days_before')
        assert.ok(sent.some((s: any) => s.point === 'expiry' && s.days_before === 30))
        assert.ok(sent.some((s: any) => s.point === cp.id && s.days_before === 7))
      } finally { mock.restore() }
    })

    it('a missed day sends only the tightest reminder; a provider rejection is retried the next day', async () => {
      await finalised({ qualify: true })
      configure()
      const cp = (await rows("SELECT due_at FROM validation_checkpoints WHERE kind='follow_up'"))[0]
      const due = new Date(cp.due_at)
      const reject = installFetchMock(() => Response.json({ error: 'nope' }, { status: 403 }))
      try {
        const failed = await lib.sendDueReminders(new Date(due.getTime() - 5 * DAY))
        assert.equal(failed.failed >= 1, true)
        assert.equal((await rows('SELECT count(*)::int AS n FROM validation_reminders'))[0].n, 0, 'nothing recorded as sent')
      } finally { reject.restore() }
      const ok = installFetchMock()
      try {
        const sent = await lib.sendDueReminders(new Date(due.getTime() - 4 * DAY))
        assert.ok(sent.sent >= 1)
        const days = (await rows('SELECT days_before FROM validation_reminders WHERE point <> $1', ['expiry'])).map((r: any) => r.days_before).sort((a: number, b: number) => a - b)
        assert.deepEqual(days, [7, 30], 'one 7-day email; the 30-day one counts as satisfied')
        assert.equal(ok.calls.filter((c) => /follow-up/.test(JSON.parse(String(c.init?.body)).subject)).length, 2, 'one email each, not two')
      } finally { ok.restore() }
    })

    it('with no provider configured it logs and records nothing; withdrawn and not-validated results are never reminded', async () => {
      await finalised()
      const v = await val()
      const none = await lib.sendDueReminders(new Date(new Date(v.expires_at).getTime() - 7 * DAY))
      assert.equal(none.sent, 0)
      assert.equal((await rows('SELECT count(*)::int AS n FROM validation_reminders'))[0].n, 0)
      configure()
      const mock = installFetchMock()
      try {
        await lc(VAL, 'POST', `/${engId}/withdraw`, { reason: 'New evidence' })
        const afterWithdraw = mock.calls.length
        assert.equal((await lib.sendDueReminders(new Date(new Date(v.expires_at).getTime() - 7 * DAY))).considered, 0)
        assert.equal(mock.calls.length, afterWithdraw)
      } finally { mock.restore() }
    })

    it('the scheduled function sweeps statuses, issues reminders and tells the organisation a debrief is open', async () => {
      // A review in debrief that has not been announced yet.
      const created = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: valId })
      engId = created.body.id
      await eng(VAL, 'POST', `/${engId}/respond`, { side: 'validator', decision: 'accept' })
      await eng(VAL, 'POST', `/${engId}/declaration`, { confirmed: true, signedName: 'Valerie Okafor' })
      configure()
      const quiet = installFetchMock(() => Response.json({ error: 'down' }, { status: 500 }))
      try { assert.equal((await rev(VAL, 'POST', `/${engId}/debrief/open`)).status, 200) } finally { quiet.restore() }
      assert.equal((await rows('SELECT debrief_notified_at FROM validation_reviews'))[0].debrief_notified_at, null, 'a failed send is retried by the daily run')
      const mock = installFetchMock()
      try {
        const res: Response = await daily(new Request('http://localhost/scheduled', { method: 'POST', body: '{}' }))
        assert.equal(res.status, 200)
        const body = await res.json()
        assert.equal(body.debriefNotices, 1)
        assert.deepEqual(mock.calls.map((c) => JSON.parse(String(c.init?.body)).to), ['info@org-a.example'])
        assert.notEqual((await rows('SELECT debrief_notified_at FROM validation_reviews'))[0].debrief_notified_at, null)
        const again = await (await daily(new Request('http://localhost/scheduled', { method: 'POST', body: '{}' }))).json()
        assert.equal(again.debriefNotices, 0, 'announced once')
      } finally { mock.restore() }
    })
  })
})
