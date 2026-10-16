import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'
import { canonicalJson, FRAMEWORKS } from '../../src/lib/validationReview.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const directory = await load('directory')
const engagements = await load('engagements')
const reviews = await load('validation-reviews')
const legacyState = await load('legacy-state')

const ALICE = 'alice@org-a.example'
const BOB = 'bob@org-b.example'
const VAL = 'val@validators.example' // accredited, lead
const VAL2 = 'val2@validators.example' // accredited, second team member
const OTHER = 'other@validators.example' // accredited, never named

const IDS = FRAMEWORKS['capital-readiness'].indicators.map((i) => i.id)
const LEVEL1 = FRAMEWORKS['capital-readiness'].indicators.filter((i) => i.level === 1).map((i) => i.id)

async function call(email: string | null, method: string, path: string, body?: unknown, handler: any = reviews) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}
const rev = (email: string | null, method: string, path: string, body?: unknown) => call(email, method, `validation-reviews${path}`, body)
const eng = (email: string | null, method: string, path: string, body?: unknown) => call(email, method, `engagements${path}`, body, engagements)
const readOrg = (email: string) => {
  ;(globalThis as any).__craftTestIdentity = { email }
  return legacyState(new Request('http://localhost/api/legacy-state?orgId=org_a&key=capital:scores')).then((r: Response) => r.status)
}
const putSelf = (scores: Record<string, number>) => rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('org_a','capital:scores',$1) ON CONFLICT (org_id,key) DO UPDATE SET value=EXCLUDED.value`, [JSON.stringify(scores)])

async function profile(email: string, name: string) {
  const r = await call(email, 'PUT', 'directory/me/validator', { name }, directory)
  await rows("UPDATE validator_profiles SET accreditation_status='accredited', accredited_until = now() + interval '1 year' WHERE email=$1", [email])
  return r.body.id as string
}

let engId: string
const scoreAll = async (value: number, ids = IDS, email = VAL) => {
  for (const id of ids) {
    const r = await rev(email, 'PUT', `/${engId}/scores/${id}`, { score: value, sufficiency: 'sufficient', comment: `c ${id}`, evidenceRef: `doc ${id}` })
    assert.equal(r.status, 200, r.text)
  }
}
const setup = () => rev(VAL, 'PUT', `/${engId}/setup`, { method: 'combined', fieldworkStart: '2026-01-05', fieldworkEnd: '2026-01-09' })

describe('validation review, outcome and freeze', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country,sector) VALUES('org_a','Acme Cooperative','Kenya','Agriculture'),('org_b','Hidden Trust','Kenya','Health')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
    const valId = await profile(VAL, 'Valerie Okafor')
    await profile(VAL2, 'Victor Mensah')
    await profile(OTHER, 'Olu Other')
    await putSelf(Object.fromEntries(IDS.map((i) => [i, 4])))
    const created = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: valId })
    engId = created.body.id
    await eng(VAL, 'POST', `/${engId}/respond`, { side: 'validator', decision: 'accept' })
  })
  const open = async () => { assert.equal((await eng(VAL, 'POST', `/${engId}/declaration`, { confirmed: true, signedName: 'Valerie Okafor' })).status, 200) }

  it('refuses reviewers without an active grant: no declaration, expired grant, not named, other organisations', async () => {
    // Named lead who has not signed yet: nothing opens.
    assert.equal((await rev(VAL, 'PUT', `/${engId}/scores/${IDS[0]}`, { score: 3, sufficiency: 'sufficient' })).status, 403)
    assert.equal((await rev(VAL, 'GET', `/${engId}`)).body.status, 'not_started')
    await open()
    assert.equal((await rev(VAL, 'PUT', `/${engId}/scores/${IDS[0]}`, { score: 3, sufficiency: 'sufficient' })).status, 200)
    // Not named on the engagement, and another organisation's staff: invisible.
    assert.equal((await rev(OTHER, 'GET', `/${engId}`)).status, 404)
    assert.equal((await rev(OTHER, 'PUT', `/${engId}/scores/${IDS[0]}`, { score: 5, sufficiency: 'sufficient' })).status, 404)
    assert.equal((await rev(BOB, 'GET', `/${engId}`)).status, 404)
    assert.equal((await rev(null, 'GET', `/${engId}`)).status, 401)
    // Expired grant: refused, even for the lead.
    await rows("UPDATE validation_engagements SET expires_at = now() - interval '1 minute'")
    await rows("UPDATE access_grants SET expires_at = now() - interval '1 minute' WHERE role='craft_validator'")
    assert.equal((await rev(VAL, 'PUT', `/${engId}/scores/${IDS[0]}`, { score: 4, sufficiency: 'sufficient' })).status, 403)
    assert.equal((await rev(VAL, 'GET', `/${engId}`)).body.rows, undefined, 'no self scores once the grant ends')
    // The organisation cannot score or open the debrief either.
    assert.equal((await rev(ALICE, 'PUT', `/${engId}/scores/${IDS[0]}`, { score: 5, sufficiency: 'sufficient' })).status, 403)
    assert.equal((await rev(ALICE, 'POST', `/${engId}/debrief/open`)).status, 403)
  })

  it('shows the live Trust Delta, hides the work from the organisation until the debrief, and audit-logs score changes', async () => {
    await open()
    assert.equal((await setup()).status, 200)
    await scoreAll(2, LEVEL1)
    const live = (await rev(VAL, 'GET', `/${engId}`)).body
    assert.equal(live.status, 'draft')
    assert.equal(live.rows.length, IDS.length)
    const first = live.rows.find((r: any) => r.id === LEVEL1[0])
    assert.deepEqual([first.self, first.validator, first.delta, first.optimismBias], [4, 2, 2, 40])
    assert.equal(live.rungs.self, 7, 'self-scores imply rung 7')
    assert.equal(live.rungs.validator, 0, 'validator scores so far imply no rung')
    assert.ok(live.problems.some((p: string) => /not yet scored/.test(p)))
    // The organisation sees no validator scores or comments yet.
    const orgView = await rev(ALICE, 'GET', `/${engId}`)
    assert.equal(orgView.body.status, 'in_progress')
    assert.ok(!orgView.text.includes('doc CRL'))
    assert.equal(orgView.body.rows, undefined)
    // Re-scoring is audit-logged old -> new.
    await rev(VAL, 'PUT', `/${engId}/scores/${LEVEL1[0]}`, { score: 3, sufficiency: 'partial' })
    const log = await rows("SELECT action FROM audit_logs WHERE category='Validation' AND action ~ 'scored' ORDER BY id")
    assert.match(log[log.length - 1].action, /2 → 3 \(partial\)/)
  })

  it('runs the debrief: only the organisation responds, only the lead negotiates, negotiated scores count', async () => {
    await open()
    await setup()
    await scoreAll(2)
    assert.equal((await rev(ALICE, 'PUT', `/${engId}/debrief/${IDS[0]}`, { response: 'We disagree' })).status, 409, 'debrief not open yet')
    assert.equal((await rev(VAL, 'POST', `/${engId}/debrief/open`)).status, 200)
    assert.equal((await rev(VAL, 'POST', `/${engId}/debrief/open`)).status, 409)
    assert.equal((await rev(VAL, 'PUT', `/${engId}/debrief/${IDS[0]}`, { response: 'self reply' })).status, 403, 'the validator cannot answer for the organisation')
    assert.equal((await rev(BOB, 'PUT', `/${engId}/debrief/${IDS[0]}`, { response: 'x' })).status, 404)
    assert.equal((await rev(ALICE, 'PUT', `/${engId}/debrief/${IDS[0]}`, { response: 'We have the minutes' })).status, 200)
    const orgView = (await rev(ALICE, 'GET', `/${engId}`)).body
    assert.equal(orgView.status, 'debrief')
    assert.equal(orgView.rows[0].validator, 2)
    assert.equal(orgView.rows[0].orgResponse, 'We have the minutes')
    assert.equal((await rev(ALICE, 'PUT', `/${engId}/negotiated/${IDS[0]}`, { score: 5 })).status, 403, 'the organisation cannot set the score')
    // Negotiate every indicator to 4: the validated rung comes from the negotiated scores.
    for (const id of IDS) assert.equal((await rev(VAL, 'PUT', `/${engId}/negotiated/${id}`, { score: 4 })).status, 200)
    const lead = (await rev(VAL, 'GET', `/${engId}`)).body
    assert.equal(lead.rungs.validator, 7)
    assert.equal((await rev(VAL, 'PUT', `/${engId}/negotiated/${IDS[0]}`, { score: null })).status, 200)
    assert.equal((await rev(VAL, 'GET', `/${engId}`)).body.rungs.validator, 0)
  })

  it('refuses to finalise until the review is complete and consistent, and only the lead may', async () => {
    await open()
    // A second team member (approved by the organisation) can score but not finalise.
    assert.equal((await eng(VAL, 'POST', `/${engId}/members`, { email: VAL2 })).status, 200)
    await eng(ALICE, 'POST', `/${engId}/members/${VAL2}/approve`)
    await eng(VAL2, 'POST', `/${engId}/declaration`, { confirmed: true, signedName: 'Victor Mensah' })
    assert.equal((await rev(VAL2, 'PUT', `/${engId}/scores/${IDS[0]}`, { score: 4, sufficiency: 'sufficient' })).status, 200)
    assert.equal((await rev(VAL2, 'PUT', `/${engId}/setup`, { method: 'combined', fieldworkStart: '2026-01-05', fieldworkEnd: '2026-01-09' })).status, 403)
    assert.equal((await rev(VAL2, 'POST', `/${engId}/finalise`, { outcome: 'not_validated' })).status, 403)
    // Lead: incomplete review.
    let r = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated' })
    assert.equal(r.status, 400)
    assert.ok(r.body.problems.some((p: string) => /not yet scored/.test(p)) && r.body.problems.some((p: string) => /method/.test(p)))
    await setup()
    await scoreAll(4)
    // Qualifications must be linked and match the outcome.
    assert.equal((await rev(VAL, 'POST', `/${engId}/qualifications`, { text: 'x', indicatorIds: ['NOPE'] })).status, 400)
    r = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated_with_qualifications' })
    assert.ok(r.body.problems.some((p: string) => /at least one qualification/.test(p)))
    const q = await rev(VAL, 'POST', `/${engId}/qualifications`, { text: 'Minutes missing', indicatorIds: [IDS[0]] })
    assert.equal(q.status, 201)
    r = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated' })
    assert.ok(r.body.problems.some((p: string) => /plain/.test(p)))
    assert.equal((await rev(VAL, 'DELETE', `/${engId}/qualifications/${q.body.id}`)).status, 200)
    assert.equal((await rev(ALICE, 'POST', `/${engId}/finalise`, { outcome: 'validated' })).status, 403)
    assert.equal((await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated', summary: '' })).status, 200)
    // A scope with no supported rung cannot be "validated".
  })

  it('freezes: a snapshot with a verifiable hash, later self-score changes never alter it, nothing can be edited, access is revoked', async () => {
    await open()
    await setup()
    await scoreAll(4)
    await rev(VAL, 'POST', `/${engId}/qualifications`, { text: 'Board minutes incomplete', indicatorIds: [IDS[1]] })
    const done = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated_with_qualifications', summary: 'Solid with gaps' })
    assert.equal(done.status, 200, done.text)
    assert.equal(done.body.validatedRung, 7)
    const [row] = await rows('SELECT status, outcome, validated_rung, snapshot, snapshot_sha256 FROM validation_reviews')
    assert.equal(row.status, 'finalised')
    assert.equal(createHash('sha256').update(canonicalJson(row.snapshot)).digest('hex'), row.snapshot_sha256, 'the stored hash verifies the stored snapshot')
    assert.equal(done.body.sha256, row.snapshot_sha256)
    const snap = row.snapshot
    assert.equal(snap.framework.version, 'ICARF v4.0')
    assert.equal(snap.method, 'combined')
    assert.deepEqual(snap.fieldwork, { start: '2026-01-05', end: '2026-01-09' })
    assert.equal(snap.team[0].name, 'Valerie Okafor')
    assert.match(snap.team[0].declaration.version, /^independence-/)
    assert.equal(snap.qualifications[0].indicatorIds[0], IDS[1])
    assert.equal(snap.engagement.statement, 'Validated by Valerie Okafor, engaged by Acme Cooperative')
    assert.ok(!JSON.stringify(snap).includes('@'), 'no email addresses in the snapshot')
    assert.equal((await rows('SELECT status FROM validation_engagements'))[0].status, 'finalised')
    // Access ended with the freeze.
    assert.equal(await readOrg(VAL), 403)
    assert.equal((await rows("SELECT status FROM access_grants WHERE role='craft_validator'"))[0].status, 'revoked')
    // The organisation's later self-score changes never touch the frozen result.
    await putSelf(Object.fromEntries(IDS.map((i) => [i, 0])))
    const before = (await rows('SELECT snapshot_sha256 FROM validation_reviews'))[0].snapshot_sha256
    const view = await rev(ALICE, 'GET', `/${engId}`)
    assert.equal(view.body.status, 'finalised')
    assert.equal(view.body.snapshot.indicators[0].self, 4, 'frozen self-score, not today\'s')
    assert.equal((await rev(VAL, 'GET', `/${engId}`)).body.sha256, before)
    // Nothing is editable any more.
    for (const [m, p, b] of [
      ['PUT', `/${engId}/scores/${IDS[0]}`, { score: 1, sufficiency: 'sufficient' }], ['PUT', `/${engId}/setup`, { method: 'interviews', fieldworkStart: '2026-01-01', fieldworkEnd: '2026-01-02' }],
      ['POST', `/${engId}/qualifications`, { text: 'x', indicatorIds: [IDS[0]] }], ['POST', `/${engId}/finalise`, { outcome: 'not_validated' }],
      ['PUT', `/${engId}/debrief/${IDS[0]}`, { response: 'late' }],
    ] as const) assert.ok([403, 409].includes((await rev(m === 'PUT' && p.includes('debrief') ? ALICE : VAL, m, p, b)).status), p)
    assert.equal((await rows('SELECT snapshot_sha256 FROM validation_reviews'))[0].snapshot_sha256, before)
    assert.equal((await eng(ALICE, 'POST', `/${engId}/cancel`, {})).status, 409, 'a finalised engagement cannot be cancelled')
    assert.ok((await rows("SELECT 1 FROM audit_logs WHERE category='Validation' AND action ~ 'finalised review'")).length === 1)
  })

  it('cannot validate a rung the scores do not support; not validated is always available', async () => {
    await open()
    await setup()
    await scoreAll(1)
    const r = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated' })
    assert.equal(r.status, 400)
    assert.ok(r.body.problems.some((p: string) => /Not validated/.test(p)))
    const nv = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'not_validated', summary: 'Evidence insufficient' })
    assert.equal(nv.status, 200)
    assert.equal(nv.body.validatedRung, null)
  })

  it('scores only indicators in the engagement scope', async () => {
    const valId = (await rows('SELECT id FROM validator_profiles WHERE email=$1', [VAL]))[0].id
    const scoped = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: valId, scope: { kind: 'levels', levels: [1] } })
    engId = scoped.body.id
    await eng(VAL, 'POST', `/${engId}/respond`, { side: 'validator', decision: 'accept' })
    await open()
    const lvl2 = IDS.find((i) => !LEVEL1.includes(i))!
    assert.equal((await rev(VAL, 'PUT', `/${engId}/scores/${lvl2}`, { score: 4, sufficiency: 'sufficient' })).status, 400)
    const view = (await rev(VAL, 'GET', `/${engId}`)).body
    assert.equal(view.rows.length, LEVEL1.length)
  })
})
