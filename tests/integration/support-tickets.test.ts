import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { as, expectStatus, installFetchMock, migrationsDir, rows, truncateAll } from './harness.ts'

const tickets = (await import(new URL('../../netlify/functions/support-tickets.mts', import.meta.url).href)).default
const { contactSubmitted } = await import(new URL('../../netlify/functions/contact-form.mts', import.meta.url).href)

const SUPER = 'fabbiochucho@gmail.com'
const ADMIN = 'admin@acme.example' // an ordinary Administrator, not the Super Admin

async function call(email: string | null, method: string, p = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email, name: email } : null
  const res: Response = await tickets(new Request(`http://localhost/api/support-tickets${p}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let parsed: any = null
  try { parsed = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: parsed, text } as any
}

describe('internal support tracker', () => {
  beforeEach(async () => {
    await truncateAll()
    process.env.RESEND_API_KEY = 're_test_not_a_credential'
    process.env.COMPLIANCE_FROM_EMAIL = 'CRAFT <craft@mail.craft.example>'
  })
  afterEach(() => {
    delete process.env.RESEND_API_KEY
    delete process.env.COMPLIANCE_FROM_EMAIL
    delete process.env.GITHUB_TOKEN
  })

  it('is Super Admin only, for reading too', async () => {
    assert.equal((await call(null, 'GET')).status, 401)
    await rows(`INSERT INTO users(id,email,name,role) VALUES('u1','${ADMIN}','Ad Min','admin')`)
    assert.equal((await call(ADMIN, 'GET')).status, 403)
    assert.equal((await call(ADMIN, 'POST', '', { subject: 'x', body: '', source: 'email' })).status, 403)
    assert.equal((await call(SUPER, 'GET')).status, 200)
  })

  it('collects the support chat, bot escalations, private reports and the contact form, encrypted at rest', async () => {
    process.env.GITHUB_TOKEN = 'test-token'
    const mock = installFetchMock((c) => new Response(JSON.stringify(c.url.includes('github') ? { html_url: 'https://github.com/x/1' } : {}), { status: 201 }))
    try {
      expectStatus(await as(null).post('/support-bot/chat', { message: 'The export button does nothing', publicIssueDisclosure: true, contactEmail: 'chat@example.com' }), 201)
      await as(null).post('/support-bot/escalate', { message: 'Security issue in sign-in', classification: 'question', contactEmail: 'reporter@example.com', escalationConsent: true })
    } finally { mock.restore() }
    await contactSubmitted({ 'form-name': 'contact', name: 'Jane Doe', email: 'jane@ngo.example', organization: 'Riverbend', message: 'Can we pilot CRAFT?\nWe are 40 CBOs.' })
    await contactSubmitted({ 'form-name': 'contact', name: 'Bot', email: 'bot@spam.example', message: 'spam', 'bot-field': 'x' })

    const list = (await call(SUPER, 'GET')).body
    const bySource = Object.fromEntries(list.tickets.map((t: any) => [t.source, t]))
    assert.deepEqual(Object.keys(bySource).sort(), ['chat', 'contact_form', 'private_report'])
    assert.equal(bySource.contact_form.subject, 'Can we pilot CRAFT?')
    assert.equal(bySource.contact_form.contactName, 'Jane Doe')
    assert.equal(bySource.contact_form.organisation, 'Riverbend')
    assert.equal(bySource.private_report.priority, 'high')
    assert.equal(bySource.chat.contactEmail, 'chat@example.com')
    assert.equal(list.counts.new, 3)

    const raw = await rows('SELECT subject, body, contact_name, contact_email FROM support_tickets')
    for (const r of raw) for (const v of Object.values(r) as string[]) if (v) assert.match(v, /^enc:/, 'stored encrypted')
  })

  it('logs a request by hand, tracks changes, notes and email replies on the timeline', async () => {
    const { id } = (await call(SUPER, 'POST', '', { subject: 'Board asked for a demo', body: 'Call on Tuesday', source: 'phone', priority: 'urgent', contactName: 'Musa' })).body
    assert.ok(id)
    assert.equal((await call(SUPER, 'POST', '', { subject: 'x', source: 'chat' })).status, 400, 'automatic sources cannot be logged by hand')

    // No contact email yet: the reply is refused, nothing is sent.
    assert.equal((await call(SUPER, 'POST', `/${id}/reply`, { body: 'Hello' })).status, 400)

    expectStatus(await call(SUPER, 'POST', `/${id}/notes`, { body: 'Prefers mornings' }) , 201)
    expectStatus(await call(SUPER, 'PATCH', `/${id}`, { contactEmail: 'musa@board.example', category: 'account' }) , 200)

    const mail = installFetchMock(() => new Response('{}', { status: 200 }))
    try {
      expectStatus(await call(SUPER, 'POST', `/${id}/reply`, { body: 'Tuesday 10am works.' }) , 201)
    } finally { mail.restore() }
    const sent = JSON.parse(String(mail.calls[0].init?.body))
    assert.deepEqual(sent.to, ['musa@board.example'])
    assert.equal(sent.reply_to, 'craftframework@becomechange.institute')
    assert.match(sent.subject, new RegExp(`Board asked for a demo \\[CRAFT support #${id}\\]`))

    let t = (await call(SUPER, 'GET', `/${id}`)).body
    assert.equal(t.ticket.status, 'waiting')
    assert.equal(t.ticket.category, 'account')
    assert.deepEqual(t.events.map((e: any) => e.kind), ['created', 'note', 'change', 'reply'])
    assert.equal(t.events[1].body, 'Prefers mornings')
    assert.match(t.events[2].body, /Category: question → account/)
    assert.equal(t.events[3].emailStatus, 'accepted')

    // Email not configured: the reply is kept on the timeline as not sent, and the status does not move.
    delete process.env.RESEND_API_KEY
    await call(SUPER, 'PATCH', `/${id}`, { status: 'open' })
    assert.equal((await call(SUPER, 'POST', `/${id}/reply`, { body: 'Second try' })).status, 502)
    t = (await call(SUPER, 'GET', `/${id}`)).body
    assert.equal(t.ticket.status, 'open')
    assert.equal(t.events.at(-1).emailStatus, 'not_configured')

    await call(SUPER, 'PATCH', `/${id}`, { status: 'resolved' })
    t = (await call(SUPER, 'GET', `/${id}`)).body
    assert.ok(t.ticket.resolvedAt)
    assert.equal((await call(SUPER, 'GET', '?status=active')).body.tickets.length, 0)
    assert.equal((await call(SUPER, 'GET', '?status=resolved&q=board')).body.tickets.length, 1)

    const audit = await rows(`SELECT action FROM audit_logs WHERE target = 'support ticket #${id}' ORDER BY id`)
    assert.ok(audit.length >= 4)
    assert.ok(audit.every((a) => !a.action.includes('musa@')), 'no contact details in the audit log')
  })

  it('the migration brings in earlier support-chat issues and escalations once', async () => {
    await rows(`INSERT INTO support_issues(category, description, contact_email, status) VALUES('bug','Old export bug','a@x.example','responded'),('documentation','Docs typo','','closed')`)
    await rows(`INSERT INTO support_escalations(key, message, contact_email, category, reason) VALUES('k1','enc-or-plain','r@x.example','question','private_report')`)
    const sql = readFileSync(path.join(migrationsDir, '20261104120000_support_tracker', 'migration.sql'), 'utf8')
    const inserts = sql.split('--> statement-breakpoint').filter((s) => s.includes('INSERT INTO'))
    for (let run = 0; run < 2; run++) for (const s of inserts) await rows(s)
    const got = await rows('SELECT source, source_ref, category, status, priority FROM support_tickets ORDER BY id')
    assert.deepEqual(got.map((r) => [r.source, r.category, r.status, r.priority]), [
      ['chat', 'bug', 'waiting', 'normal'], ['chat', 'other', 'closed', 'normal'], ['private_report', 'question', 'open', 'high'],
    ])
  })
})
