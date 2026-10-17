import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetchMock, rows, truncateAll, type FetchCall } from './harness.ts'
import { safeNextPath } from '../../src/lib/safeNext.ts'
import { signOptOutToken } from '../../netlify/lib/onboarding-nudge.ts'

const analytics = (await import(new URL('../../netlify/functions/admin-analytics.mts', import.meta.url).href)).default
const progressApi = (await import(new URL('../../netlify/functions/onboarding-progress.mts', import.meta.url).href)).default
const optoutApi = (await import(new URL('../../netlify/functions/onboarding-optout.mts', import.meta.url).href)).default
const directory = (await import(new URL('../../netlify/functions/directory.mts', import.meta.url).href)).default
const usersApi = (await import(new URL('../../netlify/functions/users.mts', import.meta.url).href)).default

const SUPER = 'fabbiochucho@gmail.com'
const ADMIN = 'admin@acme.example' // an ordinary Administrator: not the Super Admin
const ASSESSOR = 'assessor@acme.example'
const AMINA = 'amina@riverbend.example' // started, not finished
const BEN = 'ben@done.example' // finished (progress)
const CARA = 'cara@legacy.example' // finished before progress tracking (saved entity profile)
const DEV = 'dev@optout.example' // asked to stop
const SECRET = 'integration-test-secret-not-a-credential'

async function call(email: string | null, handler: (r: Request) => Promise<Response>, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email, name: email } : null
  const res: Response = await handler(new Request(`http://localhost${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* html */ }
  return { status: res.status, body: json, text }
}
const get = (email: string | null, range = '30') => call(email, analytics, 'GET', `/api/admin-analytics?range=${range}`)
const preview = (email: string | null, emails: string[], note?: string) => call(email, analytics, 'POST', '/api/admin-analytics/nudges/preview', { emails, note })
const send = (email: string | null, emails: string[], note?: string) => call(email, analytics, 'POST', '/api/admin-analytics/nudges/send', { emails, note })

describe('admin analytics and resume-onboarding emails', () => {
  let mail: ReturnType<typeof installFetchMock>
  const emailCalls = (): FetchCall[] => mail.calls.filter((c) => new URL(c.url).host === 'api.resend.com')

  beforeEach(async () => {
    await truncateAll()
    process.env.RESEND_API_KEY = 're_test_not_a_credential'
    process.env.COMPLIANCE_FROM_EMAIL = 'CRAFT <craft@mail.craft.example>'
    process.env.ONBOARDING_OPTOUT_SECRET = SECRET
    process.env.APP_URL = 'https://craft.example'
    mail = installFetchMock(() => new Response('{}', { status: 200 }))
    await rows(`INSERT INTO organizations(id,name,country) VALUES('self_amina','Riverbend Cooperative','Kenya'),('self_ben','Done Trust','Uganda')`)
    await rows(`INSERT INTO users(id,email,name,org_id,role,created_at,last_seen_at) VALUES
      ('u1','${AMINA}','Amina Okoro','self_amina','assessor',now() - interval '10 days', now() - interval '3 days'),
      ('u2','${BEN}','Ben Done','self_ben','assessor',now() - interval '12 days', now()),
      ('u3','${CARA}','Cara Legacy',NULL,'assessor',now() - interval '20 days', now() - interval '2 days'),
      ('u4','${DEV}','Dev Optout',NULL,'assessor',now() - interval '9 days', now() - interval '9 days'),
      ('u5','${ADMIN}','Ad Min',NULL,'admin',now(), now())`)
    await rows(`INSERT INTO onboarding_progress(email,step,step_name,started_at,last_activity_at,completed_at) VALUES
      ('${AMINA}',2,'Donor Alignment', now() - interval '10 days', now() - interval '6 days', NULL),
      ('${BEN}',3,'Team & Import', now() - interval '12 days', now() - interval '12 days' + interval '2 hours', now() - interval '12 days' + interval '2 hours'),
      ('${CARA}',1,'Workspace', now() - interval '20 days', now() - interval '19 days', NULL),
      ('${DEV}',1,'Workspace', now() - interval '9 days', now() - interval '9 days', NULL)`)
    // Cara finished before progress tracking existed: her saved entity profile says so.
    await rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('self_cara_legacy_example','entity-profile','{"archetype":"ngo","onboardingComplete":true}')`)
    await rows(`INSERT INTO onboarding_optouts(email) VALUES('${DEV}')`)
  })
  afterEach(() => mail.restore())

  it('only the Super Admin can read analytics or use the nudge endpoints', async () => {
    assert.equal((await get(null)).status, 401)
    for (const who of [ASSESSOR, ADMIN]) {
      assert.equal((await get(who)).status, 403, who)
      assert.equal((await preview(who, [AMINA])).status, 403, who)
      assert.equal((await send(who, [AMINA])).status, 403, who)
    }
    assert.equal((await preview(null, [AMINA])).status, 401)
    assert.equal((await send(null, [AMINA])).status, 401)
    assert.equal(emailCalls().length, 0)
    assert.equal((await rows('SELECT * FROM onboarding_nudges')).length, 0)
    const ok = await get(SUPER)
    assert.equal(ok.status, 200)
    for (const k of ['onboarding', 'orgFunnel', 'validators', 'activity', 'directory', 'support', 'operations']) assert.ok(k in ok.body, k)
  })

  it('requires multi-factor sign-in like the other admin endpoints', async () => {
    const { mfaUserKey } = await import('../../netlify/lib/mfa.ts')
    await rows(`INSERT INTO user_mfa(user_key, enabled) VALUES($1, true)`, [mfaUserKey(SUPER)])
    const res = await get(SUPER)
    assert.equal(res.status, 401)
    assert.equal(res.body.error, 'mfa_required')
  })

  it('reports onboarding progress and lists people who started but did not finish', async () => {
    const { onboarding } = (await get(SUPER, 'all')).body
    assert.equal(onboarding.signedUp, 5)
    assert.equal(onboarding.started, 4)
    assert.deepEqual(onboarding.reachedStep.map((s: any) => s.count), [4, 2, 1])
    assert.equal(onboarding.completed, 2) // Ben (progress) and Cara (saved entity profile)
    assert.equal(Math.round(onboarding.medianHoursToComplete), 2)
    const stalled = onboarding.stalled.map((p: any) => p.email).sort()
    assert.deepEqual(stalled, [AMINA, DEV].sort())
    const amina = onboarding.stalled.find((p: any) => p.email === AMINA)
    assert.equal(amina.orgName, 'Riverbend Cooperative')
    assert.equal(amina.stepName, 'Donor Alignment')
    assert.equal(amina.daysStalled, 6)
    assert.equal(amina.nudgesSent, 0)
    assert.equal(onboarding.stalled.find((p: any) => p.email === DEV).optedOut, true)
    // Date range: Cara started 20 days ago, so a 7-day window leaves only people who started more recently (none).
    assert.equal((await get(SUPER, '7')).body.onboarding.started, 0)
    assert.equal((await get(SUPER, '90')).body.onboarding.started, 4)
  })

  it('never emails people who completed onboarding or opted out, and previews say why', async () => {
    const p = await preview(SUPER, [AMINA, BEN, CARA, DEV, 'nobody@x.example'], 'Call me.')
    assert.equal(p.status, 200)
    const by = Object.fromEntries(p.body.previews.map((x: any) => [x.email, x]))
    assert.equal(by[AMINA].eligible, true)
    assert.match(by[AMINA].html, /Riverbend Cooperative/)
    assert.match(by[AMINA].text, /step 2 of 3: Donor Alignment/)
    assert.match(by[AMINA].text, /Call me\./)
    assert.equal(p.body.replyTo, SUPER)
    assert.deepEqual([BEN, CARA, DEV, 'nobody@x.example'].map((e) => by[e].reason), ['completed', 'completed', 'opted_out', 'not_started'])
    const res = await send(SUPER, [BEN, CARA, DEV, 'nobody@x.example'])
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.results.map((r: any) => r.outcome), ['refused', 'refused', 'refused', 'refused'])
    assert.equal(emailCalls().length, 0)
    assert.equal((await rows('SELECT * FROM onboarding_nudges')).length, 0)
  })

  it('sends one nudge with reply-to, HTML, an idempotency key and an opt-out link; records and audits it', async () => {
    const res = await send(SUPER, [AMINA], 'Happy to help.')
    assert.deepEqual(res.body.results, [{ email: AMINA, outcome: 'accepted' }])
    assert.equal(emailCalls().length, 1)
    const sent = emailCalls()[0]
    const body = JSON.parse(String(sent.init?.body))
    assert.equal(body.to, AMINA)
    assert.equal(body.reply_to, SUPER)
    assert.equal(body.subject, 'Finish setting up your CRAFT workspace')
    assert.match(body.html, /<a href="https:\/\/craft\.example\/auth\?next=\/onboarding%3Fstep%3D2"/)
    assert.match(body.text, /https:\/\/craft\.example\/auth\?next=\/onboarding%3Fstep%3D2/)
    assert.match(body.text, /Happy to help\./)
    const token = signOptOutToken(AMINA, SECRET)
    assert.ok(body.text.includes(`https://craft.example/api/onboarding-optout?t=${token}`))
    assert.ok(String((sent.init?.headers as Record<string, string>)['Idempotency-Key']).startsWith('onboarding-nudge/nud_'))
    assert.match(body.headers['List-Unsubscribe'], /onboarding-optout\?t=/)
    const [nudge] = await rows('SELECT * FROM onboarding_nudges')
    assert.deepEqual([nudge.email, nudge.sent_by, nudge.step, nudge.step_name, nudge.has_note, nudge.outcome], [AMINA, SUPER, 2, 'Donor Alignment', true, 'accepted'])
    const [log] = await rows(`SELECT * FROM audit_logs WHERE category='Onboarding'`)
    assert.equal(log.actor, SUPER)
    assert.equal(log.target, AMINA)
    assert.match(log.action, /accepted.*step 2 of 3/)
    assert.deepEqual((await rows(`SELECT kind, outcome FROM email_log`)), [{ kind: 'onboarding_nudge', outcome: 'accepted' }])
    // The table now shows the nudge.
    const row = (await get(SUPER, 'all')).body.onboarding.stalled.find((x: any) => x.email === AMINA)
    assert.equal(row.nudgesSent, 1)
    assert.ok(row.nextNudgeAllowedAt)
  })

  it('refuses a second nudge within 7 days, allows it after, and does not count a failed send', async () => {
    assert.equal((await send(SUPER, [AMINA])).body.results[0].outcome, 'accepted')
    const second = await send(SUPER, [AMINA])
    assert.equal(second.body.results[0].outcome, 'refused')
    assert.equal(second.body.results[0].reason, 'too_soon')
    assert.equal(emailCalls().length, 1)
    assert.equal((await preview(SUPER, [AMINA])).body.previews[0].eligible, false)
    // Two concurrent sends for someone else still produce one email.
    await rows(`UPDATE onboarding_nudges SET sent_at = now() - interval '6 days 23 hours'`)
    assert.equal((await send(SUPER, [AMINA])).body.results[0].reason, 'too_soon')
    await rows(`UPDATE onboarding_nudges SET sent_at = now() - interval '7 days 1 minute'`)
    assert.equal((await send(SUPER, [AMINA])).body.results[0].outcome, 'accepted')
    assert.equal(emailCalls().length, 2)
    // A failed delivery is recorded but does not block a retry.
    await rows('DELETE FROM onboarding_nudges')
    mail.restore()
    mail = installFetchMock(() => new Response('{}', { status: 500 }))
    assert.equal((await send(SUPER, [AMINA])).body.results[0].outcome, 'failed')
    assert.equal((await rows('SELECT outcome FROM onboarding_nudges'))[0].outcome, 'failed')
    mail.restore()
    mail = installFetchMock(() => new Response('{}', { status: 200 }))
    assert.equal((await send(SUPER, [AMINA])).body.results[0].outcome, 'accepted')
    assert.deepEqual((await rows('SELECT outcome FROM onboarding_nudges ORDER BY sent_at')).map((r) => r.outcome).sort(), ['accepted', 'failed'])
  })

  it('concurrent sends to the same person produce one email', async () => {
    const [a, b] = await Promise.all([send(SUPER, [AMINA]), send(SUPER, [AMINA])])
    const outcomes = [a.body.results[0].outcome, b.body.results[0].outcome].sort()
    assert.deepEqual(outcomes, ['accepted', 'refused'])
    assert.equal(emailCalls().length, 1)
  })

  it('does not send, claim or record anything when the deployment is not configured', async () => {
    delete process.env.ONBOARDING_OPTOUT_SECRET
    const res = await send(SUPER, [AMINA])
    assert.equal(res.status, 503)
    assert.deepEqual(res.body.missing, ['ONBOARDING_OPTOUT_SECRET'])
    assert.equal((await preview(SUPER, [AMINA])).body.configured, false)
    assert.equal(emailCalls().length, 0)
    assert.equal((await rows('SELECT * FROM onboarding_nudges')).length, 0)
  })

  it('validates recipients and the note', async () => {
    assert.equal((await send(SUPER, [])).status, 400)
    assert.equal((await send(SUPER, ['not-an-email'])).status, 400)
    assert.equal((await send(SUPER, Array.from({ length: 26 }, (_, i) => `p${i}@x.example`))).status, 400)
    assert.equal((await send(SUPER, [AMINA], 'x'.repeat(601))).status, 400)
  })

  it('the opt-out link works without signing in, rejects a tampered token, and stops further nudges', async () => {
    const t = signOptOutToken(AMINA, SECRET)
    const bad = await call(null, optoutApi, 'GET', `/api/onboarding-optout?t=${t.slice(0, -2)}xx`)
    assert.equal(bad.status, 400)
    const other = await call(null, optoutApi, 'GET', `/api/onboarding-optout?t=${Buffer.from('eve@x.example').toString('base64url')}.${t.split('.')[1]}`)
    assert.equal(other.status, 400)
    assert.equal((await call(null, optoutApi, 'GET', '/api/onboarding-optout')).status, 400)
    assert.equal((await rows(`SELECT * FROM onboarding_optouts WHERE email <> '${DEV}'`)).length, 0)
    const ok = await call(null, optoutApi, 'GET', `/api/onboarding-optout?t=${t}`)
    assert.equal(ok.status, 200)
    assert.match(ok.text, /Reminders stopped/)
    assert.equal((await rows(`SELECT * FROM onboarding_optouts WHERE email='${AMINA}'`)).length, 1)
    assert.equal((await call(null, optoutApi, 'POST', `/api/onboarding-optout?t=${t}`)).status, 200) // idempotent / one-click POST
    assert.equal((await send(SUPER, [AMINA])).body.results[0].reason, 'opted_out')
    assert.equal(emailCalls().length, 0)
  })

  it('tracks onboarding progress per signed-in person and keeps the furthest step', async () => {
    assert.equal((await call(null, progressApi, 'PUT', '/api/onboarding-progress', { step: 1 })).status, 401)
    assert.equal((await call(ASSESSOR, progressApi, 'PUT', '/api/onboarding-progress', { step: 4 })).status, 400)
    assert.equal((await call(ASSESSOR, progressApi, 'PUT', '/api/onboarding-progress', { step: 1, email: 'x@y.z' })).status, 400)
    assert.equal((await call(ASSESSOR, progressApi, 'PUT', '/api/onboarding-progress', { step: 1 })).status, 200)
    assert.equal((await call(ASSESSOR, progressApi, 'PUT', '/api/onboarding-progress', { step: 3 })).status, 200)
    assert.equal((await call(ASSESSOR, progressApi, 'PUT', '/api/onboarding-progress', { step: 2 })).status, 200) // Back
    let [p] = await rows(`SELECT * FROM onboarding_progress WHERE email='${ASSESSOR}'`)
    assert.deepEqual([p.step, p.step_name, p.completed_at], [3, 'Team & Import', null])
    assert.equal((await call(ASSESSOR, progressApi, 'PUT', '/api/onboarding-progress', { step: 3, completed: true })).status, 200)
    ;[p] = await rows(`SELECT * FROM onboarding_progress WHERE email='${ASSESSOR}'`)
    assert.ok(p.completed_at)
    assert.equal((await rows('SELECT * FROM onboarding_progress WHERE email <> $1', [ASSESSOR])).length, 4)
  })

  it('builds the organisation funnel with drop-off', async () => {
    await rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('self_ben','capital:scores','{"x":1}')`)
    await rows(`INSERT INTO audit_logs(org_id,actor,action,target,category) VALUES('self_ben','ben','Added Data Room evidence','Policy','Config')`)
    // Ben finished onboarding (progress) and started an assessment and uploaded evidence; Cara finished onboarding (saved profile).
    const { orgFunnel } = (await get(SUPER, 'all')).body
    const counts = Object.fromEntries(orgFunnel.map((r: any) => [r.key, r.count]))
    assert.equal(counts.signed_up, 5)
    assert.equal(counts.onboarded, 2)
    assert.equal(counts.assessment_started, 1)
    assert.equal(counts.assessment_completed, 0)
    assert.equal(counts.evidence, 0) // strict funnel: evidence without a completed assessment does not count
    const onboarded = orgFunnel.find((r: any) => r.key === 'onboarded')
    assert.equal(onboarded.dropOffPct, 60)
    assert.equal(orgFunnel.find((r: any) => r.key === 'assessment_started').dropOffPct, 50)
  })

  it('counts validator training funnel and hardest exam questions', async () => {
    await rows(`INSERT INTO validator_profiles(id,email,name) VALUES('v1','v1@val.example','V One'),('v2','v2@val.example','V Two')`)
    await rows(`INSERT INTO training_modules(id,position,title) VALUES('m1',1,'Ladder')`)
    for (const s of ['watch', 'try', 'decide', 'check', 'reflect']) await rows(`INSERT INTO training_progress(email,module_id,step) VALUES('v1@val.example','m1','${s}')`)
    await rows(`INSERT INTO training_questions(id,module_id,prompt,options,correct_index,for_exam) VALUES('qa','m1','Easy?','["a","b"]',0,true),('qb','m1','Hard?','["a","b"]',1,true)`)
    for (let i = 0; i < 3; i++) {
      await rows(`INSERT INTO training_exam_attempts(id,email,deadline,submitted_at,question_ids,answers,status,score,total,passed) VALUES($1,'v1@val.example',now(),now(),'["qa","qb"]','{"qa":0,"qb":0}','submitted',1,2,$2)`, [`att${i}`, i === 0])
    }
    const { validators } = (await get(SUPER, 'all')).body
    const by = Object.fromEntries(validators.funnel.map((r: any) => [r.key, r.count]))
    assert.deepEqual([by.profile, by.training, by.module_m1, by.exam, by.accredited], [2, 1, 1, 1, 0])
    assert.deepEqual(validators.exam, { attempts: 3, passed: 1, passRatePct: 33.3 })
    assert.deepEqual(validators.hardestQuestions.map((q: any) => [q.id, q.pctCorrect]), [['qb', 0], ['qa', 100]])
  })

  it('logs directory searches and profile views without any user id, and sign-ins as daily activity', async () => {
    const d = (email: string, path: string) => call(email, directory, 'GET', `/api/directory/${path}`)
    await call('val@validators.example', directory, 'PUT', '/api/directory/me/validator', { name: 'Valerie Okafor' })
    const [{ id: valId }] = await rows('SELECT id FROM validator_profiles')
    assert.equal((await d(ASSESSOR, 'search?type=validators&q=zzz-nobody')).status, 200)
    await d(ASSESSOR, 'search?type=validators&q=  ZZZ-Nobody ')
    await d(ASSESSOR, 'search?type=validators&q=valerie')
    await d(ASSESSOR, 'search?type=validators') // no query: not logged
    await d(ASSESSOR, `validators/${valId}`)
    await d('val@validators.example', `validators/${valId}`) // own profile: not counted
    for (const t of ['directory_search_log', 'directory_profile_views']) {
      const cols = (await rows(`SELECT column_name FROM information_schema.columns WHERE table_name='${t}'`)).map((c) => c.column_name)
      assert.ok(!cols.some((c: string) => /user|email|actor|ip/.test(c)), `${t} has no person column`)
    }
    const { directory: dir } = (await get(SUPER, 'all')).body
    assert.equal(dir.totalSearches, 3)
    assert.deepEqual(dir.noResultQueries, [{ type: 'validators', query: 'zzz-nobody', count: 2 }])
    assert.deepEqual(dir.mostViewed, [{ kind: 'validator', name: 'Valerie Okafor', views: 1 }])
    // Sign-in "touch" writes one daily-active row per person per day.
    await call(AMINA, usersApi, 'POST', '/api/users', { email: AMINA, name: 'Amina', touch: true })
    await call(AMINA, usersApi, 'POST', '/api/users', { email: AMINA, name: 'Amina', touch: true })
    assert.equal((await rows(`SELECT * FROM daily_active WHERE email='${AMINA}'`)).length, 1)
    const { activity } = (await get(SUPER, 'all')).body
    assert.ok(activity.mau >= 2)
    assert.ok(activity.byCountry.some((c: any) => c.label === 'Kenya'))
  })

  it('summarises support, listing proposals and operations without message bodies', async () => {
    await rows(`INSERT INTO support_escalations(key,message,contact_email,category,reason,status) VALUES('k1','SECRET-BODY','a@b.c','bug','user_request','failed'),('k2','SECRET-BODY','a@b.c','bug','user_request','accepted')`)
    await rows(`INSERT INTO org_listing_proposals(id,org_id,proposed_by,status) VALUES('p1','self_ben','x','approved'),('p2','self_amina','x','rejected')`)
    await rows(`INSERT INTO email_log(kind,outcome) VALUES('validation_reminder','accepted'),('validation_reminder','failed')`)
    const res = await get(SUPER, 'all')
    assert.ok(!res.text.includes('SECRET-BODY'))
    assert.deepEqual(res.body.support.unresolvedEscalations.map((e: any) => [e.category, e.status]), [['bug', 'failed']])
    assert.deepEqual(res.body.support.escalationsByCategory, [{ label: 'bug', count: 2 }])
    assert.deepEqual(res.body.directory.proposals.slice(0, 2), [{ status: 'approved', count: 1 }, { status: 'rejected', count: 1 }])
    assert.deepEqual(res.body.operations.emailsByType, [{ kind: 'validation_reminder', sent: 1, failed: 1, notConfigured: 0 }])
  })

  it('the ?next= redirect target must be a same-site path', () => {
    assert.equal(safeNextPath('/onboarding'), '/onboarding')
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)']) assert.equal(safeNextPath(bad), null)
  })
})
