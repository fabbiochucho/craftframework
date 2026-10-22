import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetchMock, rows, truncateAll, type FetchCall } from './harness.ts'
import { signLifecycleToken, epochSeconds } from '../../netlify/lib/lifecycle-token.ts'
import { badgeToken, goUrl, preferencesUrl, runLifecycle, surveyToken, unsubscribeUrl } from '../../netlify/lib/lifecycle.ts'

const publicApi = (await import(new URL('../../netlify/functions/lifecycle-public.mts', import.meta.url).href)).default
const adminApi = (await import(new URL('../../netlify/functions/admin-lifecycle.mts', import.meta.url).href)).default
const scheduled = (await import(new URL('../../netlify/functions/lifecycle-emails.mts', import.meta.url).href)).default

const SUPER = 'fabbiochucho@gmail.com'
const SECRET = 'integration-test-secret-not-a-credential'
const BASE = 'https://craft.example'
const REPLY_TO = 'craftframework@becomechange.institute'
const DAY = 86_400_000
// 2026-10-20 is a Tuesday.
const TUE = new Date('2026-10-20T09:00:00Z')
const daysAgo = (n: number, from = TUE) => new Date(from.getTime() - n * DAY)
const iso = (d: Date) => d.toISOString()

async function call(handler: (r: Request) => Promise<Response>, email: string | null, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email, name: email } : null
  const res: Response = await handler(new Request(`http://localhost${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* html or empty */ }
  return { status: res.status, body: json, text, headers: res.headers }
}

// An organisation, its person (optionally missing: they have left) and when they finished onboarding.
async function seed(o: { key: string; name?: string; email?: string; completedDaysAgo: number; role?: string; user?: boolean; lastSeenDaysAgo?: number | null; org?: boolean; status?: string; orgId?: string }) {
  const orgId = o.orgId ?? `self_${o.key}`
  const email = o.email ?? `${o.key}@${o.key}.example`
  if (o.org !== false) await rows(`INSERT INTO organizations(id,name,country,status) VALUES($1,$2,'Kenya',$3) ON CONFLICT (id) DO NOTHING`, [orgId, o.name ?? `${o.key} Trust`, o.status ?? 'active'])
  if (o.user !== false) {
    await rows(`INSERT INTO users(id,email,name,org_id,role,status,last_seen_at) VALUES($1,$2,$3,$4,$5,'active',$6)`,
      [`u_${o.key}`, email, `${o.key[0].toUpperCase()}${o.key.slice(1)} Person`, orgId, o.role ?? 'assessor', o.lastSeenDaysAgo === null ? null : iso(daysAgo(o.lastSeenDaysAgo ?? o.completedDaysAgo - 1 >= 0 ? (o.lastSeenDaysAgo ?? 0) : 0))])
  }
  const completed = daysAgo(o.completedDaysAgo)
  await rows(`INSERT INTO onboarding_progress(email,step,step_name,started_at,last_activity_at,completed_at) VALUES($1,3,'Team & Import',$2,$2,$3)`, [email, iso(new Date(completed.getTime() - 3_600_000)), iso(completed)])
  return { orgId, email }
}

describe('lifecycle emails', () => {
  let mail: ReturnType<typeof installFetchMock>
  const emailCalls = (): FetchCall[] => mail.calls.filter((c) => new URL(c.url).host === 'api.resend.com')
  const bodies = () => emailCalls().map((c) => JSON.parse(String(c.init?.body)))
  const sentTo = () => bodies().map((b) => b.to).sort()
  const run = (now = TUE) => runLifecycle(now)
  let respond: (c: FetchCall) => Response

  beforeEach(async () => {
    await truncateAll()
    process.env.RESEND_API_KEY = 're_test_not_a_credential'
    process.env.COMPLIANCE_FROM_EMAIL = 'CRAFT <craft@mail.craft.example>'
    process.env.ONBOARDING_OPTOUT_SECRET = SECRET
    process.env.APP_URL = BASE
    delete process.env.CRAFT_REPLY_TO
    respond = () => new Response('{}', { status: 200 })
    mail = installFetchMock((c) => respond(c))
  })
  afterEach(() => mail.restore())

  describe('the daily run', () => {
    it('sends the 2-week nudge on a send day, once, with the right headers and signed links', async () => {
      const { email } = await seed({ key: 'amina', name: 'Riverbend Cooperative', completedDaysAgo: 14 })
      const summary = await run()
      assert.equal(summary.sent, 1)
      assert.equal(emailCalls().length, 1)
      const b = bodies()[0]
      assert.equal(b.to, email)
      assert.equal(b.subject, 'Ready to take your CRAFT readiness assessment, Amina?')
      assert.equal(b.reply_to, REPLY_TO)
      assert.match(b.headers['List-Unsubscribe'], /^<https:\/\/craft\.example\/api\/lifecycle\/unsubscribe\?t=/)
      assert.equal(b.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
      assert.match(b.html, /Riverbend Cooperative/)
      assert.match(b.text, /Start the assessment: https:\/\/craft\.example\/api\/lifecycle\/go\?t=/)
      assert.match(b.text, /Email preferences: https:\/\/craft\.example\/email-preferences\?t=/)
      assert.ok(!/<img[^>]+(?:width|height)=["']1["']/.test(b.html), 'no tracking pixel')
      const [{ idempotency_key, outcome, kind, occurrence }] = await rows('SELECT * FROM lifecycle_emails')
      assert.equal(idempotency_key, 'lifecycle-u_amina-nudge_2w-1')
      assert.deepEqual([outcome, kind, occurrence], ['accepted', 'nudge_2w', 1])
      assert.equal((emailCalls()[0].init?.headers as Record<string, string>)['Idempotency-Key'], 'lifecycle-u_amina-nudge_2w-1')
      assert.deepEqual((await rows("SELECT kind, outcome FROM email_log WHERE kind LIKE 'lifecycle%'")), [{ kind: 'lifecycle_nudge_2w', outcome: 'accepted' }])
    })

    it('is idempotent: running the scheduler twice (or concurrently) sends nothing new', async () => {
      await seed({ key: 'amina', completedDaysAgo: 14 })
      await seed({ key: 'ben', completedDaysAgo: 30, lastSeenDaysAgo: 1 })
      await Promise.all([run(), run()])
      assert.equal(emailCalls().length, 2)
      await run()
      await run(new Date(TUE.getTime() + DAY))
      assert.equal(emailCalls().length, 2)
      assert.equal((await rows('SELECT count(*)::int AS n FROM lifecycle_emails'))[0].n, 2)
    })

    it('sends only on Tuesday, Wednesday and Thursday, and catches up whatever fell due in between', async () => {
      await seed({ key: 'amina', completedDaysAgo: 14 })
      for (const d of [19, 18, 17, 24, 25]) { // Mon, Sun, Sat... and Sat/Sun later: never a send day
        const summary = await run(new Date(`2026-10-${d}T09:00:00Z`))
        assert.equal(summary.reason, 'not_a_send_day')
      }
      // Fri 23 Oct is not a send day either; the nudge fell due on Tue 20 but we start the week afterwards.
      assert.equal((await run(new Date('2026-10-23T09:00:00Z'))).reason, 'not_a_send_day')
      assert.equal(emailCalls().length, 0)
      const summary = await run(new Date('2026-10-27T09:00:00Z'))
      assert.equal(summary.sent, 1, 'delayed, not skipped')
    })

    it('never emails the Super Admin, demo sessions, opted-out people, deleted people or archived organisations', async () => {
      await seed({ key: 'ok', completedDaysAgo: 14 })
      await seed({ key: 'sa', email: SUPER, completedDaysAgo: 14 })
      await seed({ key: 'demo', email: 'a.okeke@craft.demo', completedDaysAgo: 14 })
      await seed({ key: 'optout', completedDaysAgo: 14 })
      await rows(`INSERT INTO lifecycle_preferences(email, checkins_opted_out_at) VALUES('optout@optout.example', now())`)
      await seed({ key: 'gone', completedDaysAgo: 14, user: false })
      await seed({ key: 'archived', completedDaysAgo: 14, status: 'archived' })
      await run()
      assert.deepEqual(sentTo(), ['ok@ok.example'])
    })

    it('skips the nudge once the organisation has started its readiness assessment, and records why', async () => {
      const { orgId } = await seed({ key: 'amina', completedDaysAgo: 14 })
      await rows(`INSERT INTO responses(org_id, question_id, score) VALUES($1,'GOV-01',3)`, [orgId])
      await run()
      assert.equal(emailCalls().length, 0)
      const [row] = await rows('SELECT outcome, skip_reason FROM lifecycle_emails')
      assert.deepEqual(row, { outcome: 'skipped', skip_reason: 'assessment_started' })
    })

    it('1-month: ACTIVE and INACTIVE variants', async () => {
      await seed({ key: 'active', completedDaysAgo: 30, lastSeenDaysAgo: 2 })
      await seed({ key: 'idle', completedDaysAgo: 30, lastSeenDaysAgo: 30 })
      // Set both people's nudge as already sent long ago so only the 1-month email is due.
      for (const k of ['active', 'idle']) await rows(`INSERT INTO lifecycle_emails(id,idempotency_key,user_id,email,org_id,kind,occurrence,outcome,sent_at) VALUES($1,$2,$3,$4,$5,'nudge_2w',1,'accepted',$6)`,
        [`x_${k}`, `lifecycle-u_${k}-nudge_2w-1`, `u_${k}`, `${k}@${k}.example`, `self_${k}`, iso(daysAgo(16))])
      await run()
      const by = Object.fromEntries(bodies().map((b) => [b.to, b]))
      assert.equal(by['active@active.example'].subject, "One month with CRAFT: how's it going, Active?")
      assert.equal(by['idle@idle.example'].subject, 'One month in: can we help, Idle?')
      assert.match(by['idle@idle.example'].text, /Tell us how we can help: https:\/\/craft\.example\/api\/lifecycle\/go\?t=/)
    })

    it('milestones: the progress variant shows real numbers, the quiet one does not; one celebration per organisation', async () => {
      const a = await seed({ key: 'busy', completedDaysAgo: 92, lastSeenDaysAgo: 1, name: 'Busy Trust' })
      await seed({ key: 'quiet', completedDaysAgo: 92, lastSeenDaysAgo: 80 })
      // A second person of the same organisation also finished onboarding the same day.
      await rows(`INSERT INTO users(id,email,name,org_id,role,status,last_seen_at) VALUES('u_busy2','busy2@busy.example','Second Person','${a.orgId}','assessor','active', now())`)
      await rows(`INSERT INTO onboarding_progress(email,step,step_name,completed_at) VALUES('busy2@busy.example',3,'Team & Import',$1)`, [iso(daysAgo(92))])
      await rows(`INSERT INTO assessments(org_id,status,completed_at) VALUES($1,'verified',now())`, [a.orgId])
      await rows(`INSERT INTO capacity_actions(org_id,risk_id,status) VALUES($1,'FIN-01','Completed-Validated'),($1,'FIN-02','Completed-Validated'),($1,'FIN-03','In-Progress')`, [a.orgId])
      await rows(`INSERT INTO audit_logs(actor,action,target,org_id) SELECT 'x','Added Data Room evidence','doc',$1 FROM generate_series(1,3)`, [a.orgId])
      // Every earlier email already went out, so the three-month one is the only thing due for either person.
      for (const k of ['busy', 'quiet', 'busy2']) for (const [kind, n] of [['nudge_2w', 1], ['feedback_1m', 1]] as const) {
        const orgEmail = k === 'busy2' ? 'busy2@busy.example' : `${k}@${k}.example`
        await rows(`INSERT INTO lifecycle_emails(id,idempotency_key,user_id,email,org_id,kind,occurrence,outcome,sent_at) VALUES($1,$2,$3,$4,$5,$6,$7,'skipped',$8)`,
          [`s_${k}_${kind}`, `lifecycle-u_${k}-${kind}-${n}`, `u_${k}`, orgEmail, k === 'busy2' ? a.orgId : `self_${k}`, kind, n, iso(daysAgo(60))])
      }
      await run()
      assert.deepEqual(sentTo(), ['busy@busy.example', 'quiet@quiet.example'], 'one celebration for the organisation with two people')
      const busy = bodies().find((b) => b.to === 'busy@busy.example')
      assert.equal(busy.subject, 'Three months on CRAFT, Busy!')
      assert.match(busy.text, /- 1 readiness assessment completed/)
      assert.match(busy.text, /- 2 improvement actions completed/)
      assert.match(busy.text, /- 3 documents in your Data Room/)
      assert.match(busy.text, /Download your CRAFT member badge: /)
      assert.ok(!/How are we doing/.test(busy.text), 'no survey line at three months')
      const quiet = bodies().find((b) => b.to === 'quiet@quiet.example')
      assert.match(quiet.text, /exactly as you left it/)
      assert.ok(!/achieved so far/.test(quiet.text))
      assert.equal((await rows("SELECT count(*)::int AS n FROM lifecycle_emails WHERE kind='milestone' AND org_id=$1 AND outcome='accepted'", [a.orgId]))[0].n, 1)
      assert.equal((await rows("SELECT skip_reason FROM lifecycle_emails WHERE email='busy2@busy.example' AND kind='milestone'"))[0].skip_reason, 'org_celebrated', 'the colleague is not emailed and the reason is recorded')
    })

    it('when the person who onboarded has left, the organisation\'s admin gets the celebration (and nothing else)', async () => {
      // With no users row the organisation is the person's own tenant, which is where their invited colleagues point.
      const { orgId } = await seed({ key: 'left', completedDaysAgo: 92, user: false, orgId: 'self_left_left_example' })
      await rows(`INSERT INTO users(id,email,name,org_id,role,status) VALUES('u_boss','boss@left.example','Boss Person','${orgId}','admin','active')`)
      await run()
      assert.deepEqual(sentTo(), ['boss@left.example'])
      assert.equal(bodies()[0].subject, 'Three months on CRAFT, Boss!')
    })

    it('the 14-day cap holds a due email back; a milestone beats a check-in', async () => {
      await seed({ key: 'amina', completedDaysAgo: 14 })
      await rows(`INSERT INTO lifecycle_emails(id,idempotency_key,user_id,email,org_id,kind,occurrence,outcome,sent_at) VALUES('c1','lifecycle-u_amina-checkin-1','u_amina','amina@amina.example','self_amina','checkin',1,'accepted',$1)`, [iso(daysAgo(13))])
      await run()
      assert.equal(emailCalls().length, 0, 'sent 13 days ago: wait')
      await run(new Date(TUE.getTime() + 7 * DAY))
      assert.equal(emailCalls().length, 1, 'once 14 days have passed it goes')
      // Collision: away 30+ days AND the three-month milestone is due: the milestone goes, the check-in follows two weeks later.
      await truncateAll()
      await seed({ key: 'bola', completedDaysAgo: 92, lastSeenDaysAgo: 40 })
      for (const [kind, n] of [['nudge_2w', 1], ['feedback_1m', 1]] as const) await rows(`INSERT INTO lifecycle_emails(id,idempotency_key,user_id,email,org_id,kind,occurrence,outcome,sent_at) VALUES($1,$2,'u_bola','bola@bola.example','self_bola',$3,$4,'accepted',$5)`, [`b_${kind}`, `lifecycle-u_bola-${kind}-1`, kind, n, iso(daysAgo(70))])
      mail.calls.length = 0
      await run()
      assert.equal(bodies()[0].subject, 'Three months on CRAFT, Bola!')
      await run(new Date(TUE.getTime() + 14 * DAY))
      assert.equal(bodies()[1].subject, 'Checking in from CRAFT')
    })

    it('check-ins: 30+ days away, at most one every 90 days', async () => {
      await seed({ key: 'dele', completedDaysAgo: 40, lastSeenDaysAgo: 31 })
      for (const [kind, n] of [['nudge_2w', 1], ['feedback_1m', 1]] as const) await rows(`INSERT INTO lifecycle_emails(id,idempotency_key,user_id,email,org_id,kind,occurrence,outcome,sent_at) VALUES($1,$2,'u_dele','dele@dele.example','self_dele',$3,$4,'accepted',$5)`, [`d_${kind}`, `lifecycle-u_dele-${kind}-1`, kind, n, iso(daysAgo(30))])
      await seed({ key: 'recent', completedDaysAgo: 40, lastSeenDaysAgo: 5 })
      await rows(`UPDATE lifecycle_emails SET kind=kind`)
      for (const [kind, n] of [['nudge_2w', 1], ['feedback_1m', 1]] as const) await rows(`INSERT INTO lifecycle_emails(id,idempotency_key,user_id,email,org_id,kind,occurrence,outcome,sent_at) VALUES($1,$2,'u_recent','recent@recent.example','self_recent',$3,$4,'accepted',$5)`, [`r_${kind}`, `lifecycle-u_recent-${kind}-1`, kind, n, iso(daysAgo(30))])
      await run()
      assert.deepEqual(sentTo(), ['dele@dele.example'], 'only the person who has been away')
      assert.equal(bodies()[0].subject, 'Checking in from CRAFT')
      await run(new Date(TUE.getTime() + 28 * DAY))
      assert.deepEqual(sentTo().filter((e) => e === 'dele@dele.example'), ['dele@dele.example'], 'not again inside 90 days')
      assert.ok(sentTo().includes('recent@recent.example'), 'but the person who has since gone quiet is checked on')
    })

    it('one failed send does not stop the run; the outcome is recorded and the send is retried on a later send day', async () => {
      await seed({ key: 'amina', completedDaysAgo: 14 })
      await seed({ key: 'ben', completedDaysAgo: 14 })
      respond = (c) => new Response('{}', { status: JSON.parse(String(c.init?.body)).to === 'amina@amina.example' ? 500 : 200 })
      const summary = await run()
      assert.deepEqual([summary.sent, summary.failed], [1, 1])
      assert.deepEqual(await rows('SELECT email, outcome, attempts FROM lifecycle_emails ORDER BY email'), [
        { email: 'amina@amina.example', outcome: 'failed', attempts: 1 }, { email: 'ben@ben.example', outcome: 'accepted', attempts: 1 },
      ])
      respond = () => new Response('{}', { status: 200 })
      await run(new Date(TUE.getTime() + DAY))
      assert.deepEqual(await rows('SELECT email, outcome, attempts FROM lifecycle_emails ORDER BY email'), [
        { email: 'amina@amina.example', outcome: 'accepted', attempts: 2 }, { email: 'ben@ben.example', outcome: 'accepted', attempts: 1 },
      ])
      assert.equal(emailCalls().length, 3)
      assert.notEqual((emailCalls()[2].init?.headers as any)['Idempotency-Key'], (emailCalls()[0].init?.headers as any)['Idempotency-Key'], 'a retry uses its own key')
    })

    it('the pause switch stops everything, and resuming restarts it', async () => {
      await seed({ key: 'amina', completedDaysAgo: 14 })
      assert.equal((await call(adminApi, SUPER, 'PUT', '/api/admin-lifecycle/pause', { paused: true })).body.paused, true)
      assert.equal((await run()).reason, 'paused')
      assert.equal((await scheduled(new Request('http://localhost/', { method: 'POST', body: '{}' }))).status, 200)
      assert.equal(emailCalls().length, 0)
      assert.equal((await rows('SELECT count(*)::int AS n FROM lifecycle_emails'))[0].n, 0, 'nothing claimed')
      await call(adminApi, SUPER, 'PUT', '/api/admin-lifecycle/pause', { paused: false })
      assert.equal((await run()).sent, 1)
    })

    it('claims and records nothing when email is not configured', async () => {
      await seed({ key: 'amina', completedDaysAgo: 14 })
      delete process.env.RESEND_API_KEY
      const summary = await run()
      assert.equal(summary.reason, 'not_configured')
      assert.equal((await rows('SELECT count(*)::int AS n FROM lifecycle_emails'))[0].n, 0)
      process.env.RESEND_API_KEY = 're_test_not_a_credential'
      assert.equal((await run()).sent, 1)
    })
  })

  describe('preferences, unsubscribe and click links', () => {
    const q = (url: string) => url.replace(BASE, '')
    it('the unsubscribe link switches off only its own category, without sign-in, and needs a valid signature', async () => {
      const { email } = await seed({ key: 'amina', completedDaysAgo: 14 })
      await run()
      const [{ id }] = await rows('SELECT id FROM lifecycle_emails')
      const link = unsubscribeUrl(BASE, SECRET, email, 'nudge_2w', id)
      // Opening the link only asks: link scanners that pre-open links must not unsubscribe anyone.
      const ask = await call(publicApi, null, 'GET', q(link))
      assert.equal(ask.status, 200)
      assert.match(ask.text, /<form method="post"/)
      assert.equal((await rows('SELECT * FROM lifecycle_preferences')).length, 0, 'nothing changes on GET')
      const res = await call(publicApi, null, 'POST', q(link))
      assert.equal(res.status, 200)
      assert.match(res.text, /unsubscribed/i)
      assert.deepEqual((await rows('SELECT checkins_opted_out_at IS NOT NULL AS c, celebrations_opted_out_at IS NOT NULL AS e FROM lifecycle_preferences'))[0], { c: true, e: false })
      assert.ok((await rows('SELECT unsubscribed_at FROM lifecycle_emails'))[0].unsubscribed_at)
      assert.equal((await call(publicApi, null, 'POST', q(link))).status, 200, 'RFC 8058 one-click POST, repeatable')
      // Tampered or foreign tokens do nothing.
      assert.equal((await call(publicApi, null, 'GET', q(link).slice(0, -3) + 'AAA')).status, 400)
      const other = signLifecycleToken({ p: 'prefs', e: email }, SECRET)
      assert.equal((await call(publicApi, null, 'GET', `/api/lifecycle/unsubscribe?t=${other}`)).status, 400, 'a preferences token is not an unsubscribe token')
      // And they now receive nothing from that category.
      await run(new Date(TUE.getTime() + 28 * DAY))
      assert.equal(emailCalls().length, 1)
    })

    it('the preferences page changes both categories without signing in, and for the signed-in person without a token', async () => {
      const { email } = await seed({ key: 'amina', completedDaysAgo: 5 })
      const t = preferencesUrl(BASE, SECRET, email).split('?t=')[1]
      assert.deepEqual((await call(publicApi, null, 'GET', `/api/lifecycle/preferences?t=${t}`)).body, { email, checkins: true, celebrations: true })
      const put = await call(publicApi, null, 'PUT', `/api/lifecycle/preferences?t=${t}`, { checkins: false, celebrations: true })
      assert.deepEqual(put.body, { email, checkins: false, celebrations: true })
      assert.deepEqual((await call(publicApi, null, 'PUT', `/api/lifecycle/preferences?t=${t}`, { checkins: true, celebrations: false })).body, { email, checkins: true, celebrations: false })
      assert.equal((await call(publicApi, null, 'PUT', `/api/lifecycle/preferences?t=${t}x`, { checkins: true, celebrations: true })).status, 403)
      assert.equal((await call(publicApi, null, 'GET', '/api/lifecycle/preferences')).status, 401, 'no token, no session')
      assert.deepEqual((await call(publicApi, email, 'GET', '/api/lifecycle/preferences')).body, { email, checkins: true, celebrations: false })
      assert.equal((await call(publicApi, email, 'PUT', '/api/lifecycle/preferences', { checkins: false, celebrations: false })).body.checkins, false)
      assert.equal((await call(publicApi, email, 'PUT', '/api/lifecycle/preferences', { checkins: 'no' })).status, 400)
    })

    it('button links redirect through the server, record the click, and cannot be pointed elsewhere', async () => {
      const { email } = await seed({ key: 'amina', completedDaysAgo: 14 })
      await run()
      const [{ id }] = await rows('SELECT id FROM lifecycle_emails')
      const go = async (dest: any) => call(publicApi, null, 'GET', goUrl(BASE, SECRET, id, dest).replace(BASE, ''))
      const a = await go('assessment')
      assert.equal(a.status, 302)
      assert.equal(a.headers.get('location'), '/assessment')
      assert.ok((await rows('SELECT clicked_at FROM lifecycle_emails'))[0].clicked_at)
      assert.equal((await go('dashboard')).headers.get('location'), '/dashboard')
      assert.match((await go('survey')).headers.get('location')!, /^\/feedback\/.+\..+$/)
      assert.match((await go('badge')).headers.get('location')!, /^\/badge\?t=.+\..+$/)
      const evil = signLifecycleToken({ p: 'go', i: id, d: 'https://evil.example' }, SECRET)
      assert.equal((await call(publicApi, null, 'GET', `/api/lifecycle/go?t=${evil}`)).headers.get('location'), '/dashboard', 'unknown destinations fall back to a fixed page')
      assert.equal((await call(publicApi, null, 'GET', '/api/lifecycle/go?t=junk')).headers.get('location'), '/')
      void email
    })
  })

  describe('the survey', () => {
    const sentAt = new Date()
    const answer = { nps: 9, ease: 4, usedMost: ['Reports', 'Data Room'], improve: 'Faster uploads please', wantsCall: false, callTimes: '' }
    const token = (email = 'amina@amina.example', o = 'feedback_1m', at = sentAt) => surveyToken(SECRET, email, o, 'lce_1', at)
    const survey = (t: string) => `/api/lifecycle/survey?t=${t}`

    it('works once per link: open, submit, editable for 24 hours, then closed', async () => {
      await seed({ key: 'amina', name: 'Riverbend Cooperative', completedDaysAgo: 30 })
      const t = token()
      const open = await call(publicApi, null, 'GET', survey(t))
      assert.deepEqual([open.status, open.body.state, open.body.firstName, open.body.orgName], [200, 'open', 'Amina', 'Riverbend Cooperative'])
      const sent = await call(publicApi, null, 'PUT', survey(t), answer)
      assert.equal(sent.status, 200)
      assert.equal(sent.body.callRequested, false)
      const editable = await call(publicApi, null, 'GET', survey(t))
      assert.equal(editable.body.state, 'editable')
      assert.deepEqual(editable.body.answer, answer)
      await call(publicApi, null, 'PUT', survey(t), { ...answer, nps: 3 })
      assert.deepEqual(await rows('SELECT email, occurrence, nps FROM survey_responses'), [{ email: 'amina@amina.example', occurrence: 'feedback_1m', nps: 3 }], 'edited in place, still one response')
      await rows(`UPDATE survey_responses SET created_at = now() - interval '25 hours'`)
      assert.equal((await call(publicApi, null, 'GET', survey(t))).body.state, 'closed')
      const late = await call(publicApi, null, 'PUT', survey(t), { ...answer, nps: 10 })
      assert.equal(late.status, 409)
      assert.equal((await rows('SELECT nps FROM survey_responses'))[0].nps, 3)
    })

    it('rejects tampered, expired and invalid input', async () => {
      const t = token()
      assert.equal((await call(publicApi, null, 'GET', survey(t.slice(0, -2) + 'zz'))).status, 403)
      assert.equal((await call(publicApi, null, 'PUT', survey(t.slice(0, -2) + 'zz'), answer)).status, 403)
      const forged = signLifecycleToken({ p: 'survey', e: 'victim@x.example', o: 'feedback_1m', x: epochSeconds(new Date(Date.now() + DAY)) }, 'a-different-secret')
      assert.equal((await call(publicApi, null, 'PUT', survey(forged), answer)).status, 403)
      const old = token('amina@amina.example', 'feedback_1m', new Date(Date.now() - 61 * DAY))
      assert.equal((await call(publicApi, null, 'GET', survey(old))).status, 403, 'expires after 60 days')
      assert.equal((await call(publicApi, null, 'PUT', survey(old), answer)).status, 403)
      const almost = token('amina@amina.example', 'feedback_1m', new Date(Date.now() - 59 * DAY))
      assert.equal((await call(publicApi, null, 'GET', survey(almost))).status, 200)
      for (const bad of [{ ...answer, nps: 11 }, { ...answer, ease: 0 }, { ...answer, usedMost: ['Nope'] }, { ...answer, improve: 'x'.repeat(1001) }, { ...answer, wantsCall: undefined }]) {
        assert.equal((await call(publicApi, null, 'PUT', survey(t), bad)).status, 400, JSON.stringify(bad).slice(0, 60))
      }
      assert.equal((await rows('SELECT count(*)::int AS n FROM survey_responses'))[0].n, 0)
      assert.equal((await call(publicApi, null, 'GET', survey(signLifecycleToken({ p: 'prefs', e: 'amina@amina.example' }, SECRET)))).status, 403, 'a preferences token is no survey token')
    })

    it('a "Yes" to the call emails CRAFT once, with name, email, organisation and times; nothing else leaves the database', async () => {
      await seed({ key: 'amina', name: 'Riverbend Cooperative', completedDaysAgo: 30 })
      const t = token()
      await call(publicApi, null, 'PUT', survey(t), answer)
      assert.equal(emailCalls().length, 0, 'a No sends nothing')
      const yes = await call(publicApi, null, 'PUT', survey(t), { ...answer, wantsCall: true, callTimes: 'Tuesday mornings, WAT' })
      assert.equal(yes.body.callNotified, true)
      assert.equal(emailCalls().length, 1)
      const b = bodies()[0]
      assert.equal(b.to, REPLY_TO)
      assert.equal(b.reply_to, 'amina@amina.example')
      for (const s of ['Amina Person', 'amina@amina.example', 'Riverbend Cooperative', 'Tuesday mornings, WAT']) assert.ok(b.text.includes(s), s)
      assert.ok(!b.text.includes('Faster uploads'), 'the free-text answer stays in the database')
      await call(publicApi, null, 'PUT', survey(t), { ...answer, wantsCall: true, callTimes: 'Thursdays' })
      assert.equal(emailCalls().length, 1, 'edits do not notify again')
    })

    it('a failed notification is retried when the person edits their answer inside the window', async () => {
      await seed({ key: 'amina', completedDaysAgo: 30 })
      respond = () => new Response('{}', { status: 500 })
      const t = token()
      const first = await call(publicApi, null, 'PUT', survey(t), { ...answer, wantsCall: true })
      assert.equal(first.status, 200)
      assert.equal(first.body.callNotified, false)
      respond = () => new Response('{}', { status: 200 })
      assert.equal((await call(publicApi, null, 'PUT', survey(t), { ...answer, wantsCall: true })).body.callNotified, true)
    })
  })

  describe('Super Admin controls and analytics', () => {
    const ADMIN_USER = 'admin@acme.example'
    it('only the Super Admin sees status, schedule, history, previews and survey results', async () => {
      await rows(`INSERT INTO users(id,email,name,role) VALUES('ua',$1,'Ad Min','admin')`, [ADMIN_USER])
      for (const path of ['', '/schedule', '/history', '/preview?id=nudge_2w', '/survey']) {
        assert.equal((await call(adminApi, null, 'GET', `/api/admin-lifecycle${path}`)).status, 401, path)
        assert.equal((await call(adminApi, ADMIN_USER, 'GET', `/api/admin-lifecycle${path}`)).status, 403, path)
        assert.equal((await call(adminApi, SUPER, 'GET', `/api/admin-lifecycle${path}`)).status, 200, path)
      }
      assert.equal((await call(adminApi, ADMIN_USER, 'PUT', '/api/admin-lifecycle/pause', { paused: true })).status, 403)
      assert.equal((await call(adminApi, ADMIN_USER, 'PUT', '/api/admin-lifecycle/survey/x/handled', { handled: true })).status, 403)
      assert.equal((await rows('SELECT count(*)::int AS n FROM lifecycle_settings'))[0].n, 0)
    })

    it('previews every template and variant with sample data', async () => {
      const variants = (await call(adminApi, SUPER, 'GET', '/api/admin-lifecycle/variants')).body.variants
      assert.equal(variants.length, 12)
      for (const v of variants) {
        const p = await call(adminApi, SUPER, 'GET', `/api/admin-lifecycle/preview?id=${v.id}`)
        assert.equal(p.status, 200, v.id)
        assert.ok(p.body.subject && p.body.html && p.body.text)
        assert.ok(!/\{[^}]*\}/.test(p.body.text), v.id)
      }
      assert.equal((await call(adminApi, SUPER, 'GET', '/api/admin-lifecycle/preview?id=nope')).status, 404)
    })

    it('shows what is due in the next 30 days, per-person history and counts per kind', async () => {
      await seed({ key: 'amina', completedDaysAgo: 5 })        // nudge due in 9 days, feedback in 25
      await seed({ key: 'ben', completedDaysAgo: 14 })          // nudge due today
      const sched = (await call(adminApi, SUPER, 'GET', '/api/admin-lifecycle/schedule')).body
      const byKind = Object.fromEntries(sched.kinds.map((k: any) => [k.kind, k]))
      assert.equal(byKind.nudge_2w.count, 2)
      assert.equal(byKind.feedback_1m.count, 2, 'ben is due in 16 days, amina in 25')
      assert.deepEqual(byKind.nudge_2w.rows.map((r: any) => r.email).sort(), ['amina@amina.example', 'ben@ben.example'])
      for (const r of byKind.nudge_2w.rows) assert.ok([2, 3, 4].includes(new Date(r.plannedSend).getUTCDay()), 'planned for a send day')
      await run()
      const hist = (await call(adminApi, SUPER, 'GET', '/api/admin-lifecycle/history?email=ben@ben.example')).body.rows
      assert.deepEqual(hist.map((r: any) => [r.kind, r.outcome]), [['nudge_2w', 'accepted']])
      await call(publicApi, null, 'POST', unsubscribeUrl(BASE, SECRET, 'ben@ben.example', 'nudge_2w', hist[0].id).replace(BASE, ''))
      const status = (await call(adminApi, SUPER, 'GET', '/api/admin-lifecycle')).body
      const nudge = status.perKind.find((k: any) => k.kind === 'nudge_2w')
      assert.deepEqual([nudge.sent, nudge.failed, nudge.unsubscribed], [1, 0, 1])
      assert.deepEqual(status.optedOut, { checkins: 1, celebrations: 0 })
      assert.equal(status.paused, false)
    })

    it('measures survey response rate, clicks and sign-ins within 7 days without any tracking pixel', async () => {
      await seed({ key: 'amina', completedDaysAgo: 30, lastSeenDaysAgo: 1 })
      const sentOn = daysAgo(10)
      await rows(`INSERT INTO lifecycle_emails(id,idempotency_key,user_id,email,org_id,kind,occurrence,variant,outcome,sent_at,clicked_at) VALUES('e1','lifecycle-u_amina-feedback_1m-1','u_amina','amina@amina.example','self_amina','feedback_1m',1,'active','accepted',$1,$1),
        ('e2','lifecycle-u_amina-nudge_2w-1','u_amina','amina@amina.example','self_amina','nudge_2w',1,'default','accepted',$2,NULL)`, [iso(sentOn), iso(daysAgo(20))])
      await rows(`INSERT INTO daily_active(day, email) VALUES($1,'amina@amina.example')`, [iso(new Date(sentOn.getTime() + 2 * DAY)).slice(0, 10)])
      await call(publicApi, null, 'PUT', `/api/lifecycle/survey?t=${surveyToken(SECRET, 'amina@amina.example', 'feedback_1m', 'e1', sentOn)}`, { nps: 10, ease: 5, usedMost: [], improve: '', wantsCall: false, callTimes: '' })
      await rows(`UPDATE survey_responses SET lifecycle_email_id='e1'`)
      const s = (await call(adminApi, SUPER, 'GET', '/api/admin-lifecycle')).body
      assert.deepEqual(s.survey, { emailsWithSurvey: 1, responses: 1, responseRatePct: 100 })
      assert.deepEqual([s.engagement.emailsInWindow, s.engagement.clickedPct, s.engagement.signedInWithin7DaysPct], [2, 50, 50])
    })

    it('shows NPS and its trend, ease, what is used most, suggestions and call requests, and lets the Super Admin mark one handled', async () => {
      const answers: Array<[string, any]> = [
        ['a', { nps: 10, ease: 5, usedMost: ['Reports'], improve: 'More templates', wantsCall: true, callTimes: 'Mon' }],
        ['b', { nps: 9, ease: 4, usedMost: ['Reports', 'Data Room'], improve: '', wantsCall: false, callTimes: '' }],
        ['c', { nps: 8, ease: 3, usedMost: [], improve: 'Simpler wording', wantsCall: false, callTimes: '' }],
        ['d', { nps: 2, ease: 2, usedMost: ['Other'], improve: '', wantsCall: false, callTimes: '' }],
      ]
      for (const [k, a] of answers) {
        await seed({ key: k, completedDaysAgo: 30 })
        await call(publicApi, null, 'PUT', `/api/lifecycle/survey?t=${surveyToken(SECRET, `${k}@${k}.example`, 'feedback_1m', `e_${k}`, new Date())}`, a)
      }
      const r = (await call(adminApi, SUPER, 'GET', '/api/admin-lifecycle/survey')).body
      assert.deepEqual(r.nps, { responses: 4, promoters: 2, passives: 1, detractors: 1, score: 25 })
      assert.equal(r.trend.length, 1)
      assert.equal(r.easeAverage, 3.5)
      assert.deepEqual(r.usedMost.filter((u: any) => u.count).map((u: any) => [u.label, u.count]), [['Reports', 2], ['Data Room', 1], ['Other', 1]])
      assert.deepEqual(r.improvements.map((i: any) => i.text).sort(), ['More templates', 'Simpler wording'])
      assert.equal(r.callRequests.length, 1)
      assert.equal(r.callRequests[0].times, 'Mon')
      assert.equal(r.callRequests[0].handledAt, null)
      const mark = await call(adminApi, SUPER, 'PUT', `/api/admin-lifecycle/survey/${r.callRequests[0].id}/handled`, { handled: true })
      assert.equal(mark.status, 200)
      assert.equal((await call(adminApi, SUPER, 'GET', '/api/admin-lifecycle/survey')).body.callRequests[0].handledBy, SUPER)
      await call(adminApi, SUPER, 'PUT', `/api/admin-lifecycle/survey/${r.callRequests[0].id}/handled`, { handled: false })
      assert.equal((await call(adminApi, SUPER, 'GET', '/api/admin-lifecycle/survey')).body.callRequests[0].handledAt, null)
      assert.equal((await call(adminApi, SUPER, 'PUT', '/api/admin-lifecycle/survey/nope/handled', { handled: true })).status, 404)
    })
  })

  describe('the member badge', () => {
    it('a signed public link and the signed-in page both give an SVG with the organisation and the year', async () => {
      const { orgId, email } = await seed({ key: 'amina', name: 'Riverbend Cooperative', completedDaysAgo: 40 })
      const t = badgeToken(SECRET, orgId, email)
      const svg = await call(publicApi, null, 'GET', `/api/lifecycle/badge?t=${t}`)
      assert.equal(svg.status, 200)
      assert.match(svg.headers.get('content-type')!, /image\/svg\+xml/)
      assert.match(svg.text, /Riverbend Cooperative/)
      assert.match(svg.text, /Member since 2026/)
      assert.match((await call(publicApi, null, 'GET', `/api/lifecycle/badge?t=${t}&download=1`)).headers.get('content-disposition')!, /attachment; filename="craft-member-since-2026-riverbend-cooperative\.svg"/)
      assert.equal((await call(publicApi, null, 'GET', `/api/lifecycle/badge?t=${t.slice(0, -2)}zz`)).status, 403)
      assert.equal((await call(publicApi, null, 'GET', '/api/lifecycle/badge')).status, 401)
      const mine = await call(publicApi, email, 'GET', '/api/lifecycle/badge-info')
      assert.deepEqual([mine.status, mine.body.orgName, mine.body.year], [200, 'Riverbend Cooperative', 2026])
      assert.ok(mine.body.shareToken && mine.body.svg.includes('Riverbend Cooperative'))
      await rows(`INSERT INTO users(id,email,org_id) VALUES('nobody','nobody@x.example','self_nobody')`)
      assert.equal((await call(publicApi, 'nobody@x.example', 'GET', '/api/lifecycle/badge-info')).status, 404, 'no badge before onboarding is finished')
    })
  })
})
