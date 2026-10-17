// Re-review (spec: "Re-review"): a Senior Validator from a different firm, with no ties to the parties, records
// stands, amended or withdrawn. Opened by the programme team, or required by a following funding partner.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'
import { FRAMEWORKS } from '../../src/lib/validationReview.ts'
import { REREVIEW_DECLARATION } from '../../src/lib/validatorQuality.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const directory = await load('directory')
const engagements = await load('engagements')
const reviews = await load('validation-reviews')
const lifecycle = await load('validations')
const quality = await load('validator-quality')
const panel = await load('review-panel')
const reReviews = await load('re-reviews')
const firmsApi = await load('firms')

const ALICE = 'alice@org-a.example' // organisation A admin
const BOB = 'bob@org-b.example'
const VAL = 'val@validators.example' // lead
const FUND = 'fund@capital.example' // owner of funder firm 1
const ADMIN = 'fabbiochucho@gmail.com'
const CONV = 'convenor@craft.example' // programme team
const R1 = 'r1@panel.example'
const R2 = 'r2@panel.example'
const R3 = 'r3@panel.example'
const R4 = 'r4@panel.example'
const R5 = 'r5@panel.example'
const IDS = FRAMEWORKS['capital-readiness'].indicators.map((i) => i.id)

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
const pan = (e: string | null, m: string, p: string, b?: unknown) => call(e, panel, m, `review-panel${p}`, b)
const rr = (e: string | null, m: string, p: string, b?: unknown) => call(e, reReviews, m, `re-reviews${p}`, b)

async function profile(email: string, name: string) {
  const r = await call(email, directory, 'PUT', 'directory/me/validator', { name })
  await rows("UPDATE validator_profiles SET accreditation_status='accredited', accredited_until = now() + interval '1 year' WHERE email=$1", [email])
  return r.body.id as string
}

let valId: string
let funder1: string

async function issue() {
  const created = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: valId })
  assert.equal(created.status, 201, created.text)
  const id = created.body.id
  await eng(VAL, 'POST', `/${id}/respond`, { side: 'validator', decision: 'accept' })
  assert.equal((await eng(VAL, 'POST', `/${id}/declaration`, { confirmed: true, signedName: 'Valerie Okafor' })).status, 200)
  await rev(VAL, 'PUT', `/${id}/setup`, { method: 'combined', fieldworkStart: '2026-01-05', fieldworkEnd: '2026-01-09' })
  for (const ind of IDS) await rev(VAL, 'PUT', `/${id}/scores/${ind}`, { score: 4, sufficiency: 'sufficient' })
  const res = await rev(VAL, 'POST', `/${id}/finalise`, { outcome: 'validated' })
  assert.equal(res.status, 200, res.text)
  return (await rows('SELECT * FROM validations ORDER BY created_at DESC'))[0]
}

const decide = (who: string, id: string, outcome: string, extra: object = {}) =>
  rr(who, 'POST', `/${id}/decide`, { outcome, reasons: 'The frozen evidence does not support the rung recorded.', declaration: REREVIEW_DECLARATION, ...extra })

describe('Re-review', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country,sector,email) VALUES('org_a','Acme Cooperative','Kenya','Agriculture','info@acme.example'),('org_b','Hidden Trust','Kenya','Health','info@hidden.example')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
    valId = await profile(VAL, 'Valerie Okafor')
    for (const r of [R1, R2, R3, R4]) await profile(r, `Reviewer ${r.slice(0, 2)}`)
    await rows(`INSERT INTO training_staff(email, role, added_by) VALUES('${CONV}','programme_team','x')`)
    await rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('org_a','capital:scores','{}')`)
    funder1 = (await call(FUND, firmsApi, 'POST', 'firms', { name: 'Savannah Capital', kind: 'funding_partner', nature: 'DFI' })).body.id
    for (const r of [R1, R2, R3, R4]) assert.equal((await pan(ADMIN, 'POST', '/roster', { email: r, name: `Reviewer ${r.slice(0, 2)}`, kind: 'senior_validator' })).status, 201)
    assert.equal((await pan(ADMIN, 'POST', '/roster', { email: R5, name: 'Outside auditor', kind: 'external_auditor' })).status, 201)
  })

  it('is opened by the programme team only, with an eligible Senior Validator from a different firm', async () => {
    const v = await issue()
    const open = (who: string | null, reviewerEmail: string, reason = 'flagged') => rr(who, 'POST', '', { validationId: v.id, reason, reviewerEmail })
    assert.equal((await open(ALICE, R2)).status, 403)
    assert.equal((await open(VAL, R2)).status, 403)
    assert.equal((await open(null, R2)).status, 401)
    assert.match((await open(CONV, 'nobody@x.example')).body.error, /Senior Validator/)
    assert.match((await open(CONV, R5)).body.error, /Senior Validator/, 'an outside auditor sits on panels but does not re-review')
    await pan(ADMIN, 'POST', '/roster', { email: VAL, name: 'Valerie Okafor', kind: 'senior_validator' })
    assert.equal((await open(CONV, VAL)).status, 400, 'the validator concerned is a party')
    const vf = (await call(VAL, firmsApi, 'POST', 'firms', { name: 'Okafor & Co', kind: 'validator_firm', nature: 'Audit firm' })).body.id
    await rows(`INSERT INTO firm_members(firm_id, email, role, status) VALUES($1,$2,'consultant','active')`, [vf, R1])
    const sameFirm = await open(CONV, R1)
    assert.equal(sameFirm.status, 400)
    assert.ok(sameFirm.body.reasons.some((x: string) => /same firm/.test(x)), sameFirm.text)
    await rows("UPDATE validator_profiles SET accredited_until = now() - interval '1 day' WHERE email=$1", [R3])
    assert.match((await open(CONV, R3)).body.error, /accredited/)
    assert.match((await open(CONV, R2, 'funder_required')).body.error, /funding partner did not/)

    const ok = await open(CONV, R2)
    assert.equal(ok.status, 201, ok.text)
    assert.equal((await open(ADMIN, R4)).status, 409, 'one at a time')
    const id = ok.body.id

    // Parties see the status; only the re-reviewer and the programme team read the frozen review.
    const mine = await rr(ALICE, 'GET', '')
    assert.deepEqual(mine.body.map((x: any) => [x.id, x.status, x.reviewer]), [[id, 'assigned', 'Reviewer r2']])
    assert.equal((await rr(ALICE, 'GET', `/${id}`)).body.review, undefined)
    const forReviewer = await rr(R2, 'GET', `/${id}`)
    assert.ok(forReviewer.body.review?.snapshot, forReviewer.text)
    assert.equal(forReviewer.body.mine, true)
    assert.equal((await rr(BOB, 'GET', `/${id}`)).status, 404)
    assert.deepEqual((await rr(BOB, 'GET', '')).body, [])
    // The flag queue shows the re-review in progress.
    const flagged = (await call(ADMIN, quality, 'GET', 'validator-quality/flags')).body.find((f: any) => f.validationId === v.id)
    assert.deepEqual(flagged.reReview, { id, status: 'assigned', outcome: null })
  })

  it('records the outcome: withdrawn changes the validation, and the decision is final', async () => {
    const v = await issue()
    const id = (await rr(CONV, 'POST', '', { validationId: v.id, reason: 'programme', reviewerEmail: R2 })).body.id
    assert.equal((await decide(ALICE, id, 'withdrawn')).status, 403)
    assert.equal((await decide(R2, id, 'withdrawn', { declaration: 'yes' })).status, 400)
    assert.equal((await decide(R2, id, 'withdrawn', { reasons: 'too short' })).status, 400)
    assert.equal((await decide(R2, id, 'suspended')).status, 400, 'a re-review has three outcomes')
    const res = await decide(R2, id, 'withdrawn')
    assert.equal(res.status, 200, res.text)
    const [after] = await rows('SELECT status, status_changed_by FROM validations WHERE id=$1', [v.id])
    assert.deepEqual([after.status, after.status_changed_by], ['withdrawn', `rereview:${id}`])
    assert.equal((await rows(`SELECT 1 FROM validation_status_history WHERE validation_id=$1 AND to_status='withdrawn'`, [v.id])).length, 1)
    const [row] = await rows('SELECT status, outcome FROM validation_rereviews WHERE id=$1', [id])
    assert.deepEqual([row.status, row.outcome], ['decided', 'withdrawn'])
    assert.equal((await decide(R2, id, 'stands')).status, 409)
    assert.equal((await rr(CONV, 'POST', '', { validationId: v.id, reason: 'programme', reviewerEmail: R3 })).status, 409, 'nothing left to re-review')
    const seen = (await rr(ALICE, 'GET', `/${id}`)).body
    assert.equal(seen.outcome, 'withdrawn')
    assert.match(seen.reasons, /frozen evidence/)
  })

  it('records an amendment without rewriting the frozen review, and can be reassigned while open', async () => {
    const v = await issue()
    const id = (await rr(CONV, 'POST', '', { validationId: v.id, reason: 'programme', reviewerEmail: R2 })).body.id
    assert.equal((await rr(R2, 'PUT', `/${id}/reviewer`, { reviewerEmail: R3 })).status, 403)
    assert.equal((await rr(CONV, 'PUT', `/${id}/reviewer`, { reviewerEmail: R3 })).status, 200)
    assert.equal((await decide(R2, id, 'amended')).status, 404, 'the previous reviewer no longer has it')
    assert.equal((await decide(R3, id, 'amended')).status, 200)
    const [after] = await rows('SELECT status FROM validations WHERE id=$1', [v.id])
    assert.equal(after.status, 'current')
    assert.equal((await rows(`SELECT 1 FROM validation_status_history WHERE validation_id=$1 AND reason LIKE 'Amended by re-review%'`, [v.id])).length, 1)
    assert.equal((await rr(CONV, 'PUT', `/${id}/reviewer`, { reviewerEmail: R2 })).status, 409, 'decided')

    const v2 = await issue()
    const id2 = (await rr(CONV, 'POST', '', { validationId: v2.id, reason: 'programme', reviewerEmail: R2 })).body.id
    const stands = await decide(R2, id2, 'stands')
    assert.ok(stands.body.effects.includes('Validation stands'), stands.text)
  })

  it('can be required by a funding partner that follows the validation; the programme team assigns it', async () => {
    const v = await issue()
    assert.equal((await rr(FUND, 'POST', '/request', { validationId: v.id })).status, 404, 'not following it')
    assert.equal((await val(ALICE, 'PUT', `/${v.id}/funder-consent`, { funderFirmId: funder1, granted: true })).status, 200)
    const req = await rr(FUND, 'POST', '/request', { validationId: v.id, note: 'Our investment committee needs a second look.' })
    assert.equal(req.status, 201, req.text)
    assert.equal((await rr(FUND, 'POST', '/request', { validationId: v.id })).status, 409)
    assert.equal((await rr(CONV, 'POST', '', { validationId: v.id, reason: 'programme', reviewerEmail: R2 })).status, 409, 'pick up the request instead')
    const list = (await rr(FUND, 'GET', '')).body
    assert.deepEqual(list.map((x: any) => [x.status, x.reason, x.reviewer]), [['requested', 'funder_required', null]])
    assert.equal((await decide(R2, req.body.id, 'stands')).status, 404)

    // The requesting funder's own firm is a party.
    await rows(`INSERT INTO firm_members(firm_id, email, role, status) VALUES($1,$2,'consultant','active')`, [funder1, R4])
    assert.equal((await rr(CONV, 'PUT', `/${req.body.id}/reviewer`, { reviewerEmail: R4 })).status, 400)
    assert.equal((await rr(CONV, 'PUT', `/${req.body.id}/reviewer`, { reviewerEmail: R2 })).status, 200)
    const [row] = await rows('SELECT status, opened_by, requested_by FROM validation_rereviews WHERE id=$1', [req.body.id])
    assert.deepEqual([row.status, row.opened_by, row.requested_by], ['assigned', CONV, FUND])
    assert.equal((await decide(R2, req.body.id, 'stands')).status, 200)
    // Once the organisation stops sharing, the funder no longer sees it.
    await val(ALICE, 'PUT', `/${v.id}/funder-consent`, { funderFirmId: funder1, granted: false })
    assert.deepEqual((await rr(FUND, 'GET', '')).body, [])
  })
})
