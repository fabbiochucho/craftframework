import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { pool, rows, truncateAll } from './harness.ts'
import { FRAMEWORKS } from '../../src/lib/validationReview.ts'
import { devMapperSummary } from '../../netlify/lib/validator-quality.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const directory = await load('directory')
const engagements = await load('engagements')
const reviews = await load('validation-reviews')
const lifecycle = await load('validations')
const quality = await load('validator-quality')
const firmsApi = await load('firms')

const ALICE = 'alice@org-a.example' // organisation A admin
const BOB = 'bob@org-b.example'
const VAL = 'val@validators.example' // lead
const FUND = 'fund@capital.example' // owner of funder firm 1
const FUND2 = 'fund2@other.example' // owner of funder firm 2
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
const q = (e: string | null, m: string, p: string, b?: unknown) => call(e, quality, m, `validator-quality${p}`, b)

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


const setSelf = (score: number) => rows(`UPDATE legacy_workspace_state SET value=$1 WHERE org_id='org_a' AND key='capital:scores'`, [JSON.stringify(Object.fromEntries(IDS.map((i) => [i, score])))])

describe('validator ratings, statistics, re-review flags and the DevMapper summary', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country,sector,email) VALUES('org_a','Acme Cooperative','Kenya','Agriculture','info@acme.example'),('org_b','Hidden Trust','Kenya','Health','info@hidden.example')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
    valId = await profile(VAL, 'Valerie Okafor')
    await rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('org_a','capital:scores','{}')`)
    funder1 = (await call(FUND, firmsApi, 'POST', 'firms', { name: 'Savannah Capital', kind: 'funding_partner', nature: 'DFI' })).body.id
    await call(FUND2, firmsApi, 'POST', 'firms', { name: 'Other Capital', kind: 'funding_partner', nature: 'Venture Capital' })
  })

  it('lets the organisation rate a finalised independent validation once, and nobody else', async () => {
    const v = await issue()
    const mine = await q(ALICE, 'GET', '/ratings/mine')
    assert.deepEqual(mine.body.map((m: any) => [m.engagementId, m.party, m.validator, m.rating]), [[v.engagement_id, 'organisation', 'Valerie Okafor', null]])
    assert.equal((await q(ALICE, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'organisation', stars: 0 })).status, 400)
    assert.equal((await q(ALICE, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'organisation', stars: 6 })).status, 400)
    assert.equal((await q(ALICE, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'organisation', stars: 4.5 })).status, 400)
    // Not a party / wrong party / the validator themselves / signed out.
    assert.equal((await q(BOB, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'organisation', stars: 5 })).status, 403)
    assert.equal((await q(ALICE, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'funder', stars: 5 })).status, 403)
    assert.equal((await q(VAL, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'organisation', stars: 5 })).status, 403)
    assert.equal((await q(FUND, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'funder', stars: 5 })).status, 403)
    assert.equal((await q(null, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'organisation', stars: 5 })).status, 401)
    assert.equal((await rows('SELECT 1 FROM validation_ratings')).length, 0)

    const ok = await q(ALICE, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'organisation', stars: 5, comment: 'Thorough and fair.' })
    assert.equal(ok.status, 201, ok.text)
    const again = await q(ALICE, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'organisation', stars: 1, comment: 'Changed my mind' })
    assert.equal(again.status, 409)
    const [r] = await rows('SELECT stars, comment, validator_email, party, rater_email FROM validation_ratings')
    assert.deepEqual([r.stars, r.comment, r.validator_email, r.party, r.rater_email], [5, 'Thorough and fair.', VAL, 'organisation', ALICE])
    assert.equal((await rows(`SELECT 1 FROM audit_logs WHERE action LIKE 'rated validator 5/5%'`)).length, 1)
    assert.equal((await q(ALICE, 'GET', '/ratings/mine')).body[0].rating.stars, 5)
  })

  it('does not allow rating before the engagement is finalised, or a funder review', async () => {
    const id = await startEngagement()
    assert.equal((await q(ALICE, 'GET', '/ratings/mine')).body.length, 0)
    assert.equal((await q(ALICE, 'POST', '/ratings', { engagementId: id, party: 'organisation', stars: 5 })).status, 403)
    // A funder's own review has no validator to rate.
    await rows(`INSERT INTO validation_engagements(id, org_id, type, created_by, created_side, funder_firm_id, org_status, validator_status, funder_status, status, invite_expires_at)
      VALUES('eng_fr','org_a','funder_review','${FUND}','funder','${funder1}','accepted','not_required','accepted','finalised', now())`.replace('created_side', 'created_by_side'))
    assert.equal((await q(ALICE, 'POST', '/ratings', { engagementId: 'eng_fr', party: 'organisation', stars: 5 })).status, 403)
    assert.equal((await q(FUND, 'POST', '/ratings', { engagementId: 'eng_fr', party: 'funder', stars: 5 })).status, 403)
    assert.equal((await rows('SELECT 1 FROM validation_ratings')).length, 0)
  })

  it('does not let a funding partner rate: it is not a party to an independent validation', async () => {
    // Independent validations are never funder-engaged (a database rule), so only the organisation can rate.
    const v = await issue()
    assert.equal((await q(FUND, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'funder', stars: 3 })).status, 403)
    assert.equal((await q(FUND, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'organisation', stars: 3 })).status, 403)
    assert.deepEqual((await q(FUND, 'GET', '/ratings/mine')).body, [])
    assert.equal((await rows('SELECT 1 FROM validation_ratings')).length, 0)
  })

  it('shows feedback on the validator profile without naming who gave it, and lets the validator reply', async () => {
    const v = await issue()
    await q(ALICE, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'organisation', stars: 4, comment: 'Clear and professional.' })
    const [r] = await rows('SELECT id FROM validation_ratings')
    // Only the rated validator may reply.
    assert.equal((await q(ALICE, 'PUT', `/ratings/${r.id}/reply`, { reply: 'Thanks' })).status, 404)
    assert.equal((await q(FUND, 'PUT', `/ratings/${r.id}/reply`, { reply: 'Thanks' })).status, 404)
    assert.equal((await q(VAL, 'PUT', `/ratings/${r.id}/reply`, { reply: '   ' })).status, 400)
    assert.equal((await q(VAL, 'PUT', `/ratings/${r.id}/reply`, { reply: 'Thank you, glad it helped.' })).status, 200)

    const prof = await call(BOB, directory, 'GET', `directory/validators/${valId}`)
    assert.equal(prof.status, 200)
    assert.equal(prof.body.quality.reviews, 1)
    assert.equal(prof.body.quality.summary.count, 1)
    assert.equal(prof.body.quality.summary.average, 4)
    assert.deepEqual(prof.body.quality.ratings.map((x: any) => [x.party, x.stars, x.comment, x.reply, x.country]), [['organisation', 4, 'Clear and professional.', 'Thank you, glad it helped.', 'Kenya']])
    const flat = JSON.stringify(prof.body.quality)
    for (const secret of [ALICE, 'Acme Cooperative', 'org_a', 'rater']) assert.ok(!flat.includes(secret), `leaked ${secret}`)
    const me = await q(VAL, 'GET', '/me')
    assert.equal(me.body.stats.reviews, 1)
    assert.equal(me.body.summary.count, 1)
    assert.equal((await q(ALICE, 'GET', '/me')).status, 404)
  })

  it('lets only the platform admin remove abusive feedback, with a recorded ground, and keeps the record', async () => {
    const v = await issue()
    await q(ALICE, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'organisation', stars: 1, comment: 'Abusive text' })
    const [r] = await rows('SELECT id FROM validation_ratings')
    for (const who of [ALICE, VAL, FUND, BOB]) assert.equal((await q(who, 'POST', `/ratings/${r.id}/remove`, { ground: 'abusive', reason: 'Not ok' })).status, 403)
    assert.equal((await q(ADMIN, 'POST', `/ratings/${r.id}/remove`, { ground: 'abusive' })).status, 400)
    assert.equal((await q(ADMIN, 'POST', `/ratings/${r.id}/remove`, { ground: 'abusive', reason: 'x' })).status, 400)
    assert.equal((await q(ADMIN, 'POST', `/ratings/${r.id}/remove`, { ground: 'nonsense', reason: 'Not ok at all' })).status, 400)
    assert.equal((await q(ADMIN, 'POST', `/ratings/${r.id}/remove`, { ground: 'abusive', reason: 'Contains abuse aimed at a named person' })).status, 200)
    assert.equal((await q(ADMIN, 'POST', `/ratings/${r.id}/remove`, { ground: 'abusive', reason: 'Again' })).status, 409)
    const [row] = await rows('SELECT status, removed_by, removal_ground, removal_reason FROM validation_ratings')
    assert.deepEqual([row.status, row.removed_by, row.removal_ground], ['removed', ADMIN, 'abusive'])
    const prof = await call(BOB, directory, 'GET', `directory/validators/${valId}`)
    assert.equal(prof.body.quality.summary.count, 0)
    assert.equal(prof.body.quality.summary.average, null)
    assert.deepEqual(prof.body.quality.ratings, [])
    // The validator cannot reply to feedback that has been removed, and the party cannot rate again.
    assert.equal((await q(VAL, 'PUT', `/ratings/${r.id}/reply`, { reply: 'Hello' })).status, 409)
    assert.equal((await q(ALICE, 'POST', '/ratings', { engagementId: v.engagement_id, party: 'organisation', stars: 5 })).status, 409)
    assert.equal((await q(ADMIN, 'POST', `/ratings/${r.id}/restore`, { reason: 'Removed in error' })).status, 200)
    assert.equal((await call(BOB, directory, 'GET', `directory/validators/${valId}`)).body.quality.summary.count, 1)
    assert.equal((await rows(`SELECT 1 FROM audit_logs WHERE action LIKE 'removed feedback (abusive)%' OR action LIKE 'restored feedback%'`)).length, 2)
    // The database itself refuses a removal with no reason.
    await assert.rejects(pool.query(`UPDATE validation_ratings SET status='removed' WHERE id=$1`, [r.id]))
  })

  it('flags validations for re-review without changing anything', async () => {
    await setSelf(1)
    const v = await issue()
    const before = await rows('SELECT status, expires_at, validated_rung FROM validations')
    const flags = await q(ADMIN, 'GET', '/flags')
    assert.equal(flags.status, 200)
    assert.equal(flags.body.length, 1)
    assert.equal(flags.body[0].validationId, v.id)
    assert.equal(flags.body[0].organization, 'Acme Cooperative')
    const keys = flags.body[0].flags.map((f: any) => f.key).sort()
    assert.deepEqual(keys, ['first_validations', 'high_rung', 'large_gap', 'rung_jump'].sort())
    // Advice only: nothing was opened or changed.
    assert.deepEqual(await rows('SELECT status, expires_at, validated_rung FROM validations'), before)
    assert.equal((await rows('SELECT 1 FROM validation_engagements WHERE requires_rereview')).length, 0)
    // Organisation staff and strangers cannot read flags; funding-partner staff only see validations they were allowed to follow.
    assert.equal((await q(ALICE, 'GET', '/flags')).status, 403)
    assert.equal((await q(VAL, 'GET', '/flags')).status, 403)
    assert.equal((await q(FUND, 'GET', '/flags')).body.length, 0)
    // The organisation lets Savannah Capital follow this validation: now it sees the flags, and the other funder still does not.
    assert.equal((await val(ALICE, 'PUT', `/${v.id}/funder-consent`, { funderFirmId: funder1, granted: true })).status, 200)
    assert.equal((await q(FUND, 'GET', '/flags')).body.length, 1)
    assert.equal((await q(FUND2, 'GET', '/flags')).body.length, 0)
    assert.equal((await val(ALICE, 'PUT', `/${v.id}/funder-consent`, { funderFirmId: funder1, granted: false })).status, 200)
    assert.equal((await q(FUND, 'GET', '/flags')).body.length, 0)
    assert.equal((await val(ALICE, 'PUT', `/${v.id}/funder-consent`, { funderFirmId: funder1, granted: true })).status, 200)
    // A withdrawn validation no longer needs a second look.
    await rows(`UPDATE validations SET status='withdrawn' WHERE id=$1`, [v.id])
    assert.equal((await q(ADMIN, 'GET', '/flags')).body.length, 0)
  })

  it('does not flag an ordinary validation once the validator is past their first three', async () => {
    await rows(`UPDATE legacy_workspace_state SET value=$1 WHERE org_id='org_a'`, [JSON.stringify(Object.fromEntries(IDS.map((i) => [i, 4])))])
    for (let n = 0; n < 4; n++) await issue({ qualify: [IDS[0]], outcome: 'validated_with_qualifications' })
    const flags = (await q(ADMIN, 'GET', '/flags')).body as any[]
    // Qualified validations are not "withdrawn/superseded" only for the latest; older ones were superseded.
    assert.equal(flags.length, 1)
    assert.ok(!flags[0].flags.some((f: any) => f.key === 'first_validations'), 'the fourth validation is not one of the first three')
  })

  it('reports statistics to the platform admin only', async () => {
    await setSelf(1)
    await issue()
    assert.equal((await q(ALICE, 'GET', '/stats')).status, 403)
    assert.equal((await q(VAL, 'GET', '/stats')).status, 403)
    const stats = await q(ADMIN, 'GET', '/stats')
    assert.equal(stats.status, 200)
    assert.equal(stats.body.length, 1)
    assert.equal(stats.body[0].name, 'Valerie Okafor')
    assert.equal(stats.body[0].stats.reviews, 1)
    assert.equal(stats.body[0].stats.validated, 1)
    assert.ok(stats.body[0].stats.meanGap > 1)
  })

  it('gives DevMapper the self-assessed rung and the latest validation that currently stands', async () => {
    const none = await devMapperSummary('org_a')
    assert.deepEqual(none, { organisationId: 'org_a', framework: 'capital-readiness', selfAssessed: { label: 'Self-assessed', rung: null, rungName: null }, validation: null })
    assert.equal(await devMapperSummary('org_a', 'unknown-framework'), null)

    await setSelf(2)
    const before = await devMapperSummary('org_a')
    assert.equal(before!.selfAssessed.label, 'Self-assessed')
    assert.equal(typeof before!.selfAssessed.rung, 'number')
    assert.equal(before!.validation, null)

    await setSelf(4)
    const v = await issue({ qualify: [IDS[1]], outcome: 'validated_with_qualifications', finalise: { followUpMode: 'fixed_3' } })
    const s = await devMapperSummary('org_a')
    assert.ok(s!.validation)
    const sv = s!.validation!
    assert.equal(sv.label, 'Independent validation')
    assert.equal(sv.validatedRung, v.validated_rung)
    assert.equal(sv.outcome, 'validated_with_qualifications')
    assert.equal(sv.status, 'current')
    assert.equal(sv.validatorType, 'individual')
    assert.equal(sv.engagedBy, 'Acme Cooperative')
    assert.equal(sv.verificationId, v.verification_id)
    assert.match(sv.finalisedOn, /^\d{4}-\d{2}-\d{2}$/)
    assert.match(sv.expiresOn, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(sv.nextVerificationPoint!.kind, 'follow_up')
    assert.match(sv.nextVerificationPoint!.on, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(sv.rungName.length > 0)
    // With nothing scheduled (milestone mode and no dated action) there is no next point to show.
    await rows(`UPDATE validation_checkpoints SET state='done', done_at=now(), done_by='x', result='confirmed' WHERE validation_id=$1`, [v.id])
    await rows(`UPDATE validations SET follow_up_mode='end_of_plan' WHERE id=$1`, [v.id])
    assert.equal((await devMapperSummary('org_a'))!.validation!.nextVerificationPoint, null)
    // The summary carries nothing private.
    const flat = JSON.stringify(s)
    for (const secret of [ALICE, VAL, 'info@acme.example']) assert.ok(!flat.includes(secret), `leaked ${secret}`)

    // Suspended, expired and withdrawn validations are not a confirmed rung.
    await rows(`UPDATE validations SET status='suspended' WHERE id=$1`, [v.id])
    assert.equal((await devMapperSummary('org_a'))!.validation, null)
    await rows(`UPDATE validations SET status='current', expires_at = now() - interval '1 day', surveillance_due_at = NULL WHERE id=$1`, [v.id])
    assert.equal((await devMapperSummary('org_a'))!.validation, null)
    await rows(`UPDATE validations SET status='withdrawn', expires_at = now() + interval '3 months' WHERE id=$1`, [v.id])
    assert.equal((await devMapperSummary('org_a'))!.validation, null)
    // Another organisation's summary never shows it.
    assert.equal((await devMapperSummary('org_b'))!.validation, null)
  })

  it('labels a funder review as such and never as validated', async () => {
    await issue()
    await rows(`UPDATE validation_engagements SET type='funder_review', funder_firm_id=$1, funder_status='accepted', validator_status='not_required' WHERE id=(SELECT engagement_id FROM validations)`, [funder1])
    const s = await devMapperSummary('org_a')
    assert.equal(s!.validation!.label, 'Funder review')
  })
})
