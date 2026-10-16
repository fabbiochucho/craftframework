import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { pool, rows, truncateAll } from './harness.ts'
import { FRAMEWORKS } from '../../src/lib/validationReview.ts'
import { NO_CONFLICT_DECLARATION } from '../../src/lib/reviewPanel.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const directory = await load('directory')
const engagements = await load('engagements')
const reviews = await load('validation-reviews')
const lifecycle = await load('validations')
const quality = await load('validator-quality')
const panel = await load('review-panel')
const firmsApi = await load('firms')

const ALICE = 'alice@org-a.example' // organisation A admin
const BOB = 'bob@org-b.example'
const VAL = 'val@validators.example' // lead
const FUND = 'fund@capital.example' // owner of funder firm 1
const FUND2 = 'fund2@other.example' // owner of funder firm 2
const ADMIN = 'fabbiochucho@gmail.com'
const CONV = 'convenor@craft.example' // programme team
const CONV2 = 'convenor2@craft.example'
const R1 = 'r1@panel.example'
const R2 = 'r2@panel.example'
const R3 = 'r3@panel.example'
const R4 = 'r4@panel.example'
const R5 = 'r5@panel.example'
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
const q = (e: string | null, m: string, p: string, b?: unknown) => call(e, quality, m, `validator-quality${p}`, b)
const pan = (e: string | null, m: string, p: string, b?: unknown) => call(e, panel, m, `review-panel${p}`, b)

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



const today = () => new Date().toISOString().slice(0, 10)
const OK = { accept: true, declaration: NO_CONFLICT_DECLARATION }

describe('Independent Review Panel', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country,sector,email) VALUES('org_a','Acme Cooperative','Kenya','Agriculture','info@acme.example'),('org_b','Hidden Trust','Kenya','Health','info@hidden.example')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
    valId = await profile(VAL, 'Valerie Okafor')
    for (const r of [R1, R2, R3, R4, R5]) await profile(r, `Reviewer ${r.slice(0, 2)}`)
    await rows(`INSERT INTO training_staff(email, role, added_by) VALUES('${CONV}','programme_team','x'),('${CONV2}','programme_team','x')`)
    await rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('org_a','capital:scores','{}')`)
    funder1 = (await call(FUND, firmsApi, 'POST', 'firms', { name: 'Savannah Capital', kind: 'funding_partner', nature: 'DFI' })).body.id
    await call(FUND2, firmsApi, 'POST', 'firms', { name: 'Other Capital', kind: 'funding_partner', nature: 'Venture Capital' })
    for (const r of [R1, R2, R3, R4, R5]) assert.equal((await pan(ADMIN, 'POST', '/roster', { email: r, name: `Reviewer ${r.slice(0, 2)}`, kind: 'senior_validator' })).status, 201)
  })

  const raise = async (who: string, v: any, kind = 'validation_dispute', extra: object = {}) => {
    const r = await pan(who, 'POST', '/cases', { kind, validationId: v.id, summary: 'The rung does not reflect the evidence we provided.', ...extra })
    assert.equal(r.status, 201, r.text)
    return r.body.id as string
  }
  /** Invites a convenor and two reviewers and has them all accept: the panel is seated. */
  const seat = async (caseId: string, people: [string, string, string] = [CONV, R1, R2]) => {
    assert.equal((await pan(ADMIN, 'POST', `/cases/${caseId}/members`, { email: people[0], role: 'convenor' })).status, 201)
    assert.equal((await pan(ADMIN, 'POST', `/cases/${caseId}/members`, { email: people[1], role: 'reviewer' })).status, 201)
    assert.equal((await pan(ADMIN, 'POST', `/cases/${caseId}/members`, { email: people[2], role: 'reviewer' })).status, 201)
    for (const p of people) assert.equal((await pan(p, 'POST', `/cases/${caseId}/respond`, OK)).status, 200)
  }
  const vote = (who: string, caseId: string, o: object) => pan(who, 'PUT', `/cases/${caseId}/vote`, { reasons: 'The evidence supports this outcome.', ...o })

  it('lets only the parties raise a case, and only the programme team escalate a public concern', async () => {
    const v = await issue()
    // Strangers and funders without consent cannot.
    assert.equal((await pan(BOB, 'POST', '/cases', { kind: 'validation_dispute', validationId: v.id, summary: 'Not my validation at all.' })).status, 403)
    assert.equal((await pan(FUND, 'POST', '/cases', { kind: 'validator_complaint', validationId: v.id, summary: 'A complaint with no standing.' })).status, 403)
    assert.equal((await pan(null, 'POST', '/cases', { kind: 'validation_dispute', validationId: v.id, summary: 'Signed out should fail.' })).status, 401)
    assert.equal((await pan(ALICE, 'POST', '/cases', { kind: 'validation_dispute', validationId: v.id, summary: 'short' })).status, 400)
    // The validator does not complain about themselves; the organisation can.
    assert.equal((await pan(VAL, 'POST', '/cases', { kind: 'validator_complaint', validationId: v.id, summary: 'Complaining about myself here.' })).status, 403)
    const id = await raise(ALICE, v)
    const [c] = await rows('SELECT * FROM panel_cases WHERE id=$1', [id])
    assert.deepEqual([c.status, c.raised_side, c.subject_validator_email, c.org_id], ['open', 'organisation', VAL, 'org_a'])
    // A funder the organisation lets follow the validation may raise a complaint.
    await val(ALICE, 'PUT', `/${v.id}/funder-consent`, { funderFirmId: funder1, granted: true })
    assert.equal((await pan(FUND, 'POST', '/cases', { kind: 'validator_complaint', validationId: v.id, summary: 'The validator did not follow the method.' })).status, 201)
    assert.equal((await pan(FUND, 'POST', '/cases', { kind: 're_review_challenge', validationId: v.id, summary: 'Funders cannot challenge a re-review.' })).status, 403)
    // The validator may contest their own validation's fate, and a stranger cannot read a case.
    assert.equal((await pan(VAL, 'POST', '/cases', { kind: 'validation_dispute', validationId: v.id, summary: 'I dispute the withdrawal as unfair.' })).status, 201)
    assert.equal((await pan(BOB, 'GET', `/cases/${id}`)).status, 404)
    assert.equal((await pan(null, 'GET', `/cases/${id}`)).status, 401)
    await rows(`INSERT INTO validation_concerns(id, validation_id, category, message) VALUES('con_1', $1, 'conduct', 'The validator seemed biased.')`, [v.id])
    assert.equal((await pan(ALICE, 'POST', '/cases', { kind: 'validator_complaint', concernId: 'con_1', summary: 'Escalating the public concern.' })).status, 403)
    // A fourth open case from the same person is refused.
    for (let n = 0; n < 2; n++) await raise(ALICE, v, 'validator_complaint')
    assert.equal((await pan(ALICE, 'POST', '/cases', { kind: 'validator_complaint', validationId: v.id, summary: 'A fourth open case should fail.' })).status, 409)

    // A concern reported from the public page becomes a case only through the programme team.
    const esc = await pan(CONV, 'POST', '/cases', { kind: 'validator_complaint', concernId: 'con_1', summary: 'Escalating the public concern.' })
    assert.equal(esc.status, 201, esc.text)
    const [ec] = await rows('SELECT raised_by, raised_side FROM panel_cases WHERE id=$1', [esc.body.id])
    assert.deepEqual([ec.raised_by, ec.raised_side], ['public', 'programme'])
    assert.equal((await rows(`SELECT status FROM validation_concerns WHERE id='con_1'`))[0].status, 'in_review')
  })

  it('only lets the validator who was rated contest feedback', async () => {
    const v = await issue()
    await q(ALICE, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'organisation', stars: 1, comment: 'Unfair and untrue.' })
    const [r] = await rows('SELECT id FROM validation_ratings')
    assert.equal((await pan(ALICE, 'POST', '/cases', { kind: 'feedback_complaint', ratingId: r.id, summary: 'It is my own rating though.' })).status, 404)
    assert.equal((await pan(R1, 'POST', '/cases', { kind: 'feedback_complaint', ratingId: r.id, summary: 'Someone else rated, not me.' })).status, 404)
    const id = (await pan(VAL, 'POST', '/cases', { kind: 'feedback_complaint', ratingId: r.id, summary: 'This comment is false and defamatory.' })).body.id
    assert.ok(id)
    await seat(id)
    const [c] = await rows('SELECT status FROM panel_cases WHERE id=$1', [id])
    assert.equal(c.status, 'responses')
    await pan(VAL, 'POST', `/cases/${id}/submissions`, { text: 'The dates it cites are wrong; see the engagement record.', evidenceRef: 'engagement record' })
    await pan(ALICE, 'POST', `/cases/${id}/submissions`, { text: 'Our experience was as described.' })
    assert.equal((await pan(CONV, 'POST', `/cases/${id}/deliberate`)).status, 200)
    // Only keep/remove can be decided in a feedback complaint, and removal needs a ground.
    assert.equal((await vote(R1, id, { validation: 'suspended', feedback: 'remove', feedbackGround: 'false' })).status, 400)
    assert.equal((await vote(R1, id, { feedback: 'remove' })).status, 400)
    for (const who of [R1, CONV]) assert.equal((await vote(who, id, { feedback: 'remove', feedbackGround: 'false' })).status, 200)
    assert.equal((await vote(R2, id, { feedback: 'keep' })).status, 200)
    const done = await pan(CONV, 'POST', `/cases/${id}/decide`, { reasons: 'The comment makes a factual claim the record contradicts.' })
    assert.equal(done.status, 200, done.text)
    const [rating] = await rows('SELECT status, removal_ground, removed_by, removal_reason FROM validation_ratings')
    assert.deepEqual([rating.status, rating.removal_ground, rating.removed_by], ['removed', 'false', `panel:${id}`])
    assert.match(rating.removal_reason, /Independent Review Panel/)
    // Gone from the profile.
    assert.equal((await call(BOB, directory, 'GET', `directory/validators/${valId}`)).body.quality.summary.count, 0)
  })

  it('composes the panel from the roster and refuses anyone with a conflict', async () => {
    const v = await issue()
    const id = await raise(ALICE, v)
    // Only the programme team composes a panel.
    for (const who of [ALICE, VAL, R1, BOB]) assert.equal((await pan(who, 'POST', `/cases/${id}/members`, { email: R1, role: 'reviewer' })).status, who === BOB || who === R1 ? 404 : 403)
    // Convenor: a programme-team member, never a platform administrator or anyone else.
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: ADMIN, role: 'convenor' })).status, 400)
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: R1, role: 'convenor' })).status, 400)
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: CONV, role: 'convenor' })).status, 201)
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: CONV2, role: 'convenor' })).status, 409, 'one convenor')
    // Reviewers come from the roster.
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: 'stranger@x.example', role: 'reviewer' })).status, 400)
    await pan(ADMIN, 'DELETE', `/roster/${R3}`)
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: R3, role: 'reviewer' })).status, 400, 'stood down from the roster')
    // The validator, the organisation's staff and a party's team cannot sit; a platform administrator cannot be on the roster.
    assert.equal((await pan(ADMIN, 'POST', '/roster', { email: ADMIN, name: 'Admin', kind: 'external_auditor' })).status, 400)
    await pan(ADMIN, 'POST', '/roster', { email: VAL, name: 'Valerie', kind: 'senior_validator' })
    const self = await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: VAL, role: 'reviewer' })
    assert.equal(self.status, 409)
    assert.ok(self.body.reasons.some((x: string) => /party/.test(x)))
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('c','staff@org-a.example','org_a','member')`)
    await pan(ADMIN, 'POST', '/roster', { email: 'staff@org-a.example', name: 'Org staff', kind: 'external_auditor' })
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: 'staff@org-a.example', role: 'reviewer' })).status, 409, 'any member of the organisation is a party')
    await pan(ADMIN, 'POST', '/roster', { email: ALICE, name: 'Alice', kind: 'external_auditor' })
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: ALICE, role: 'reviewer' })).status, 409)
    // Same firm as the validator.
    const vf = (await call(VAL, firmsApi, 'POST', 'firms', { name: 'Okafor & Co', kind: 'validator_firm', nature: 'Audit firm' })).body.id
    await rows(`INSERT INTO firm_members(firm_id, email, role, status) VALUES($1,$2,'consultant','active')`, [vf, R1])
    const sameFirm = await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: R1, role: 'reviewer' })
    assert.equal(sameFirm.status, 409)
    assert.ok(sameFirm.body.reasons.some((x: string) => /same firm/.test(x)))
    // Worked with the organisation on an engagement in the last three years.
    await rows(`INSERT INTO engagement_members(id, engagement_id, email, role, status, org_approved, added_by) VALUES('em_x', $1, $2, 'member', 'named', true, 'x')`, [v.engagement_id, R2])
    const worked = await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: R2, role: 'reviewer' })
    assert.equal(worked.status, 409)
    assert.ok(worked.body.reasons.some((x: string) => /within the last 3 years/.test(x)))
    // …but not if it was longer ago and they are not on the engagement.
    await rows(`DELETE FROM engagement_members WHERE id='em_x'`)
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: R2, role: 'reviewer' })).status, 201)
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: R4, role: 'reviewer' })).status, 201)
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: R5, role: 'reviewer' })).status, 409, 'two reviewer seats')
    // Take an invitation back and the seat is free.
    assert.equal((await pan(ADMIN, 'DELETE', `/cases/${id}/members/${R4}`)).status, 200)
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: R5, role: 'reviewer' })).status, 201)
  })

  it('seats the panel only when all three have accepted with the declaration, and checks conflicts again then', async () => {
    const v = await issue()
    const id = await raise(ALICE, v)
    await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: CONV, role: 'convenor' })
    await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: R1, role: 'reviewer' })
    await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: R2, role: 'reviewer' })
    // An invited member reads the summary only, and cannot accept without the exact declaration.
    const before = await pan(R1, 'GET', `/cases/${id}`)
    assert.equal(before.status, 200)
    assert.equal(before.body.evidence, undefined)
    assert.deepEqual(before.body.submissions, [])
    assert.equal((await pan(R1, 'POST', `/cases/${id}/respond`, { accept: true })).status, 400)
    assert.equal((await pan(R1, 'POST', `/cases/${id}/respond`, { accept: true, declaration: 'sure' })).status, 400)
    // A non-member cannot respond.
    assert.equal((await pan(R3, 'POST', `/cases/${id}/respond`, OK)).status, 404)
    // Between invitation and acceptance R1 turns out to have worked with the organisation.
    await rows(`INSERT INTO engagement_members(id, engagement_id, email, role, status, org_approved, added_by) VALUES('em_y', $1, $2, 'member', 'named', true, 'x')`, [v.engagement_id, R1])
    assert.equal((await pan(R1, 'POST', `/cases/${id}/respond`, OK)).status, 409)
    await rows(`DELETE FROM engagement_members WHERE id='em_y'`)
    assert.equal((await pan(R1, 'POST', `/cases/${id}/respond`, OK)).status, 200)
    assert.equal((await pan(CONV, 'POST', `/cases/${id}/respond`, OK)).status, 200)
    assert.equal((await rows('SELECT status FROM panel_cases WHERE id=$1', [id]))[0].status, 'open', 'two of three is not a panel')
    // A decline frees the seat; a replacement is invited and the panel seats on the last acceptance.
    assert.equal((await pan(R2, 'POST', `/cases/${id}/respond`, { accept: false, reason: 'Not available' })).status, 200)
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: R3, role: 'reviewer' })).status, 201)
    assert.equal((await pan(R3, 'POST', `/cases/${id}/respond`, OK)).body.seated, true)
    const [c] = await rows('SELECT status, convened_at, respond_by, decide_by FROM panel_cases WHERE id=$1', [id])
    assert.equal(c.status, 'responses')
    const day = (d: Date | string) => new Date(d).toISOString().slice(0, 10)
    const start = new Date(day(c.convened_at)).getTime()
    const days = (d: Date | string) => Math.round((new Date(day(d)).getTime() - start) / 86_400_000)
    assert.equal(days(c.respond_by), 14)
    assert.equal(days(c.decide_by), 30)
    // Once seated the composition is closed.
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/members`, { email: R4, role: 'reviewer' })).status, 409)
    // Seated members read the frozen review; a party does not see votes; the stranger still sees nothing.
    const seated = await pan(R1, 'GET', `/cases/${id}`)
    assert.ok(seated.body.evidence.indicators.length > 0)
    assert.equal(seated.body.evidence.sha256.length, 64)
    assert.equal((await pan(ALICE, 'GET', `/cases/${id}`)).body.evidence, undefined)
    assert.equal((await pan(BOB, 'GET', `/cases/${id}`)).status, 404)
    // Parties are told, and the audit trail has it.
    assert.equal((await rows(`SELECT 1 FROM audit_logs WHERE target=$1 AND action LIKE 'review panel seated%'`, [id])).length, 1)
  })

  it('takes written responses from the parties only, then votes, and decides by majority with reasons', async () => {
    const v = await issue()
    const id = await raise(ALICE, v)
    assert.equal((await pan(ALICE, 'POST', `/cases/${id}/submissions`, { text: 'Too early to respond.' })).status, 409)
    await seat(id)
    // Platform administrators and panel members never write responses or vote.
    for (const who of [ADMIN, R1, CONV, BOB]) assert.equal((await pan(who, 'POST', `/cases/${id}/submissions`, { text: 'I am not a party here.' })).status, who === BOB ? 404 : 403)
    assert.equal((await pan(ADMIN, 'PUT', `/cases/${id}/vote`, { validation: 'suspended', reasons: 'Administrators have no vote.' })).status, 403)
    assert.equal((await pan(ALICE, 'POST', `/cases/${id}/submissions`, { text: 'We scored 4 throughout; see the board pack.', evidenceRef: 'Board pack Q3' })).status, 201)
    const subs = (await pan(VAL, 'GET', `/cases/${id}`)).body.submissions
    assert.deepEqual(subs.map((s: any) => [s.side, s.evidenceRef]), [['organisation', 'Board pack Q3']])
    // The convenor cannot open voting until both sides have been heard or the window closes.
    assert.equal((await pan(CONV, 'POST', `/cases/${id}/deliberate`)).status, 409)
    assert.equal((await pan(R1, 'POST', `/cases/${id}/deliberate`)).status, 403)
    assert.equal((await pan(VAL, 'POST', `/cases/${id}/submissions`, { text: 'The method was followed; the sample was representative.' })).status, 201)
    assert.equal((await pan(VAL, 'GET', `/cases/${id}`)).body.submissions.map((s: any) => s.side).join(), 'organisation,validator')
    assert.equal((await vote(R1, id, { validation: 'suspended' })).status, 409, 'voting is not open yet')
    assert.equal((await pan(CONV, 'POST', `/cases/${id}/deliberate`)).status, 200)
    // Voting: no majority yet; parties cannot vote; a complaint-only outcome cannot amend.
    assert.equal((await vote(ALICE, id, { validation: 'suspended' })).status, 403)
    assert.equal((await pan(CONV, 'POST', `/cases/${id}/decide`, { reasons: 'There is no vote yet so this must fail.' })).status, 409)
    assert.equal((await vote(R1, id, { validation: 'suspended' })).status, 200)
    assert.equal((await vote(R2, id, { validation: 'withdrawn' })).status, 200)
    assert.equal((await vote(CONV, id, { validation: 'stands' })).status, 200)
    assert.equal((await pan(CONV, 'POST', `/cases/${id}/decide`, { reasons: 'Three different votes are not a majority.' })).status, 409, 'three different answers')
    assert.equal((await pan(CONV, 'GET', `/cases/${id}`)).body.majority, null)
    assert.deepEqual((await pan(R1, 'GET', `/cases/${id}`)).body.me.vote, { validation: 'suspended', validator: 'none', feedback: 'none' })
    assert.equal((await pan(ALICE, 'GET', `/cases/${id}`)).body.me, null, 'a party never sees any vote')
    // R2 changes their vote: now two say "suspended".
    assert.equal((await vote(R2, id, { validation: 'suspended' })).status, 200)
    assert.equal((await pan(CONV, 'GET', `/cases/${id}`)).body.majority.validation, 'suspended')
    // Only the convenor decides, and with written reasons.
    assert.equal((await pan(R1, 'POST', `/cases/${id}/decide`, { reasons: 'A reviewer cannot record the decision.' })).status, 403)
    assert.equal((await pan(ADMIN, 'POST', `/cases/${id}/decide`, { reasons: 'An admin cannot record the decision.' })).status, 403)
    assert.equal((await pan(CONV, 'POST', `/cases/${id}/decide`, { reasons: 'too short' })).status, 400)
    const done = await pan(CONV, 'POST', `/cases/${id}/decide`, { reasons: 'The evidence shows a material gap that needs review before reliance.' })
    assert.equal(done.status, 200, done.text)
    assert.deepEqual(done.body.decision, { validation: 'suspended', validator: 'none', feedback: 'none' })
    // The decision was applied: status, history, audit.
    const [val0] = await rows('SELECT status, status_changed_by FROM validations WHERE id=$1', [v.id])
    assert.deepEqual([val0.status, val0.status_changed_by], ['suspended', `panel:${id}`])
    const hist = await rows(`SELECT from_status, to_status, actor FROM validation_status_history WHERE validation_id=$1 ORDER BY created_at DESC LIMIT 1`, [v.id])
    assert.deepEqual(hist[0], { from_status: 'current', to_status: 'suspended', actor: `panel:${id}` })
    const [c] = await rows('SELECT status, decision_reasons, appeal_by, decided_by, effects FROM panel_cases WHERE id=$1', [id])
    assert.equal(c.status, 'decided')
    assert.ok(c.appeal_by)
    assert.equal(c.decided_by, CONV)
    assert.ok(c.effects.length > 0)
    // Decided is final for votes and responses; the parties see the reasons and not who voted how.
    assert.equal((await vote(R1, id, { validation: 'stands' })).status, 409)
    assert.equal((await pan(ALICE, 'POST', `/cases/${id}/submissions`, { text: 'Late addition to the record.' })).status, 409)
    assert.equal((await pan(CONV, 'POST', `/cases/${id}/decide`, { reasons: 'Deciding a decided case again.' })).status, 409)
    const partyView = await pan(ALICE, 'GET', `/cases/${id}`)
    assert.match(partyView.body.decision.reasons, /material gap/)
    assert.ok(!JSON.stringify(partyView.body).includes('voteReasons'))
    assert.equal(partyView.body.me, null)
    // The database refuses a decided case with no written reasons.
    await assert.rejects(pool.query(`UPDATE panel_cases SET decision_reasons='' WHERE id=$1`, [id]))
  })

  it('applies a validator outcome: suspension ends their access, removal clears accreditation', async () => {
    const v = await issue()
    const id = await raise(ALICE, v, 'validator_complaint', { summary: 'The validator breached the independence declaration.' })
    await seat(id)
    await pan(ALICE, 'POST', `/cases/${id}/submissions`, { text: 'They had advised us on our self-assessment last year.' })
    await pan(VAL, 'POST', `/cases/${id}/submissions`, { text: 'That advice was before I was engaged and was disclosed.' })
    await pan(CONV, 'POST', `/cases/${id}/deliberate`)
    // A conduct complaint cannot amend a validation.
    assert.equal((await vote(R1, id, { validation: 'amended', validator: 'suspended' })).status, 400)
    for (const who of [R1, R2]) await vote(who, id, { validation: 'withdrawn', validator: 'suspended' })
    await vote(CONV, id, { validator: 'warned' })
    assert.equal((await pan(CONV, 'POST', `/cases/${id}/decide`, { reasons: 'The declaration was breached and the validation cannot be relied on.' })).status, 200)
    assert.equal((await rows('SELECT status FROM validations WHERE id=$1', [v.id]))[0].status, 'withdrawn')
    const [p] = await rows('SELECT accreditation_status, accreditation_reason, accreditation_changed_by FROM validator_profiles WHERE email=$1', [VAL])
    assert.equal(p.accreditation_status, 'suspended')
    assert.match(p.accreditation_reason, /Independent Review Panel/)
    assert.equal(p.accreditation_changed_by, `panel:${id}`)
    // A suspended validator cannot be engaged for an independent validation.
    const again = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: valId })
    assert.equal(again.status, 403)
  })

  it('lets one appeal go to a fresh panel, which can overturn the decision', async () => {
    const v = await issue()
    const id = await raise(ALICE, v)
    await seat(id)
    await pan(CONV, 'POST', `/cases/${id}/deliberate`).then(async (r) => { if (r.status !== 200) { await rows(`UPDATE panel_cases SET respond_by = current_date - 1 WHERE id=$1`, [id]); await pan(CONV, 'POST', `/cases/${id}/deliberate`) } })
    for (const who of [R1, R2]) await vote(who, id, { validation: 'suspended' })
    assert.equal((await pan(CONV, 'POST', `/cases/${id}/decide`, { reasons: 'On the evidence a suspension pending review is right.' })).status, 200)
    assert.equal((await rows('SELECT status FROM validations WHERE id=$1', [v.id]))[0].status, 'suspended')

    // Only parties appeal; a panel member cannot; reasons are needed.
    assert.equal((await pan(R1, 'POST', `/cases/${id}/appeal`, { reason: 'I sat on the panel myself.' })).status, 403)
    assert.equal((await pan(BOB, 'POST', `/cases/${id}/appeal`, { reason: 'Not my case at all really.' })).status, 404)
    assert.equal((await pan(VAL, 'POST', `/cases/${id}/appeal`, { reason: 'short' })).status, 400)
    const ap = await pan(VAL, 'POST', `/cases/${id}/appeal`, { reason: 'The suspension rested on a misreading of the sampling method.' })
    assert.equal(ap.status, 201, ap.text)
    const appealId = ap.body.id
    // One appeal only, and an appeal cannot itself be appealed.
    assert.equal((await pan(ALICE, 'POST', `/cases/${id}/appeal`, { reason: 'We also want to appeal this one.' })).status, 409)
    // A fresh panel: nobody from the original may sit, whatever their seat.
    for (const [who, role] of [[CONV, 'convenor'], [R1, 'reviewer'], [R2, 'reviewer']] as const) {
      const r = await pan(ADMIN, 'POST', `/cases/${appealId}/members`, { email: who, role })
      assert.equal(r.status, 409, `${who} sat before`)
      assert.ok(r.body.reasons.some((x: string) => /earlier panel/.test(x)))
    }
    await seat(appealId, [CONV2, R3, R4])
    await pan(ALICE, 'POST', `/cases/${appealId}/submissions`, { text: 'The first panel was right.' })
    await pan(VAL, 'POST', `/cases/${appealId}/submissions`, { text: 'The sampling method was documented in the review.' })
    assert.equal((await pan(CONV2, 'POST', `/cases/${appealId}/deliberate`)).status, 200)
    for (const who of [R3, R4]) await vote(who, appealId, { validation: 'stands' })
    assert.equal((await pan(CONV2, 'POST', `/cases/${appealId}/decide`, { reasons: 'The sampling was adequate; the validation stands.' })).status, 200)
    assert.equal((await rows('SELECT status FROM validations WHERE id=$1', [v.id]))[0].status, 'current', 'reinstated')
    assert.equal((await rows(`SELECT 1 FROM validation_status_history WHERE validation_id=$1 AND actor=$2 AND to_status='current'`, [v.id, `panel:${appealId}`])).length, 1)
    // The appeal is final.
    assert.equal((await pan(ALICE, 'POST', `/cases/${appealId}/appeal`, { reason: 'Appealing the appeal decision.' })).status, 409)
    assert.equal((await rows('SELECT appeal_by FROM panel_cases WHERE id=$1', [appealId]))[0].appeal_by, null)
  })

  it('does not accept an appeal after the 14 days', async () => {
    const v = await issue()
    const id = await raise(ALICE, v)
    await seat(id)
    await rows(`UPDATE panel_cases SET respond_by = current_date - 1 WHERE id=$1`, [id])
    await pan(CONV, 'POST', `/cases/${id}/deliberate`)
    for (const who of [R1, R2]) await vote(who, id, { validation: 'none' })
    await pan(CONV, 'POST', `/cases/${id}/decide`, { reasons: 'Nothing in the complaint is made out on the evidence.' })
    assert.equal((await pan(ALICE, 'GET', `/cases/${id}`)).body.decision.label, 'Dismissed')
    assert.equal((await rows('SELECT status FROM validations WHERE id=$1', [v.id]))[0].status, 'current', 'a dismissal changes nothing')
    await rows(`UPDATE panel_cases SET appeal_by = current_date - 1 WHERE id=$1`, [id])
    assert.equal((await pan(ALICE, 'POST', `/cases/${id}/appeal`, { reason: 'We want to appeal but are late.' })).status, 409)
  })

  it('resolves a contested material event: the panel reinstates the validation and closes the event', async () => {
    const v = await issue()
    const rep = await val(ALICE, 'POST', `/${v.id}/events`, { eventKey: 'leadership_change', occurredOn: today() })
    assert.equal(rep.status, 201, rep.text)
    assert.equal((await rows('SELECT status FROM validations WHERE id=$1', [v.id]))[0].status, 'suspended')
    const [ev] = await rows('SELECT id FROM validation_events')
    assert.equal((await pan(ALICE, 'POST', '/cases', { kind: 'contested_event', validationId: v.id, summary: 'The change was planned and is not material.' })).status, 400, 'needs the event')
    assert.equal((await pan(ALICE, 'POST', '/cases', { kind: 'contested_event', validationId: v.id, eventId: 'nope', summary: 'The change was planned and is not material.' })).status, 404)
    const id = await raise(ALICE, v, 'contested_event', { eventId: ev.id, summary: 'The change was planned, disclosed and is not material.' })
    await seat(id)
    await rows(`UPDATE panel_cases SET respond_by = current_date - 1 WHERE id=$1`, [id])
    await pan(CONV, 'POST', `/cases/${id}/deliberate`)
    for (const who of [R1, R2]) await vote(who, id, { validation: 'stands' })
    assert.equal((await pan(CONV, 'POST', `/cases/${id}/decide`, { reasons: 'The change of chair was planned and does not affect the controls relied on.' })).status, 200)
    assert.equal((await rows('SELECT status FROM validations WHERE id=$1', [v.id]))[0].status, 'current')
    const [e2] = await rows('SELECT status, decided_by FROM validation_events WHERE id=$1', [ev.id])
    assert.deepEqual([e2.status, e2.decided_by], ['reinstated', `panel:${id}`])
  })

  it('records an amendment without rewriting the frozen review', async () => {
    const v = await issue()
    const [before] = await rows('SELECT snapshot_sha256 FROM validation_reviews')
    const id = await raise(ALICE, v)
    await seat(id)
    await rows(`UPDATE panel_cases SET respond_by = current_date - 1 WHERE id=$1`, [id])
    await pan(CONV, 'POST', `/cases/${id}/deliberate`)
    for (const who of [R1, R2]) await vote(who, id, { validation: 'amended' })
    await pan(CONV, 'POST', `/cases/${id}/decide`, { reasons: 'One qualification was omitted and must be added in a corrected validation.' })
    assert.equal((await rows('SELECT status FROM validations WHERE id=$1', [v.id]))[0].status, 'current')
    assert.equal((await rows('SELECT snapshot_sha256 FROM validation_reviews'))[0].snapshot_sha256, before.snapshot_sha256)
    assert.equal((await rows(`SELECT 1 FROM validation_status_history WHERE validation_id=$1 AND reason LIKE 'Amended by the Independent Review Panel%'`, [v.id])).length, 1)
  })

  it('keeps the roster to the programme team', async () => {
    assert.equal((await pan(ALICE, 'GET', '/roster')).status, 403)
    assert.equal((await pan(R1, 'POST', '/roster', { email: R1, name: 'Me', kind: 'senior_validator' })).status, 403)
    assert.equal((await pan(CONV, 'GET', '/roster')).body.length, 5)
    // A Senior Validator must be currently accredited; an outside auditor need not have a profile.
    assert.equal((await pan(CONV, 'POST', '/roster', { email: 'nobody@x.example', name: 'Nobody', kind: 'senior_validator' })).status, 400)
    assert.equal((await pan(CONV, 'POST', '/roster', { email: 'auditor@x.example', name: 'An Auditor', kind: 'external_auditor' })).status, 201)
  })
})
