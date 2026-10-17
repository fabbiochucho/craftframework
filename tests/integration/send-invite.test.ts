import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetchMock, rows, truncateAll } from './harness.ts'

const handler = (await import(new URL('../../netlify/functions/send-invite.mts', import.meta.url).href)).default
const { buildWelcomeEmailHtml } = await import(new URL('../../src/lib/inviteEmail.ts', import.meta.url).href)

const INVITER = 'inviter@acme.example'
const OTHER = 'other@acme.example'
const SUPER = 'fabbiochucho@gmail.com'

async function send(user: string | null, body: unknown) {
  ;(globalThis as any).__craftTestIdentity = user ? { email: user, name: user } : null
  return handler(new Request('http://localhost/api/send-invite', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })) as Promise<Response>
}

async function invite(id: string, over: Record<string, string | null> = {}) {
  const v = { status: 'pending', inviter: INVITER, message: null, ...over }
  await rows(
    `INSERT INTO invitations (id, token, email, inviter, inviter_name, role, scope_label, message, status, expires_at)
     VALUES ($1, $2, 'invitee@example.org', $3, 'Ines Inviter', 'assessor', 'Acme Org', $4, $5, now() + interval '7 days')`,
    [id, `tok-${id}`, v.inviter, v.message, v.status])
}

describe('/api/send-invite', () => {
  let mock: ReturnType<typeof installFetchMock>
  beforeEach(async () => {
    await truncateAll()
    process.env.RESEND_API_KEY = 'test-key'
    process.env.INVITE_FROM_EMAIL = 'CRAFT <invites@mail.example.org>'
    mock = installFetchMock()
  })
  afterEach(() => {
    mock.restore()
    delete process.env.RESEND_API_KEY
    delete process.env.INVITE_FROM_EMAIL
  })

  it('requires a signed-in caller who is the inviter (or super admin)', async () => {
    await invite('inv_1')
    assert.equal((await send(null, { invitationId: 'inv_1' })).status, 401)
    assert.equal((await send(OTHER, { invitationId: 'inv_1' })).status, 403)
    assert.equal((await send(OTHER, { invitationId: 'inv_missing' })).status, 403)
    assert.equal(mock.calls.length, 0)
    assert.equal((await send(INVITER.toUpperCase(), { invitationId: 'inv_1' })).status, 200)
    assert.equal((await send(SUPER, { invitationId: 'inv_1' })).status, 200)
  })

  it('rejects client-supplied to/subject/html and renders server-side to the stored recipient', async () => {
    await invite('inv_2')
    for (const body of [
      { to: 'victim@example.com', subject: 'x', html: '<b>phish</b>' },
      { invitationId: 'inv_2', to: 'victim@example.com' },
      { invitationId: 'inv_2', html: '<b>phish</b>' },
      { invitationId: 7 }, [], null, {},
    ]) assert.equal((await send(INVITER, body)).status, 400, JSON.stringify(body))
    assert.equal(mock.calls.length, 0)
    const ok = await send(INVITER, { invitationId: 'inv_2' })
    assert.deepEqual(await ok.json(), { dispatched: true })
    const sent = JSON.parse(String(mock.calls[0].init!.body))
    assert.equal(sent.to, 'invitee@example.org')
    assert.equal(sent.from, 'CRAFT <invites@mail.example.org>')
    assert.match(sent.html, /Acme Org/)
    assert.equal((mock.calls[0].init!.headers as any)['Idempotency-Key'], 'invite-inv_2')
  })

  it('refuses revoked, accepted and expired invitations', async () => {
    await invite('inv_r', { status: 'revoked' })
    await invite('inv_a', { status: 'accepted' })
    await invite('inv_e')
    await rows("UPDATE invitations SET expires_at = now() - interval '1 minute' WHERE id = 'inv_e'")
    for (const id of ['inv_r', 'inv_a', 'inv_e']) assert.equal((await send(INVITER, { invitationId: id })).status, 409, id)
    assert.equal(mock.calls.length, 0)
  })

  it('caps sends per invitation at 3 and per caller at 20/hour with 429', async () => {
    await invite('inv_c')
    for (let i = 0; i < 3; i++) assert.equal((await send(INVITER, { invitationId: 'inv_c' })).status, 200)
    const capped = await send(INVITER, { invitationId: 'inv_c' })
    assert.equal(capped.status, 429)
    assert.match((await capped.json()).error, /3 times/)
    assert.equal(mock.calls.length, 3)
    assert.equal((mock.calls[1].init!.headers as any)['Idempotency-Key'], undefined)

    // Hourly budget: 3 used above (+1 capped attempt counted); fill the rest across invitations.
    let limited = 0
    for (let i = 0; i < 20; i++) {
      await invite(`inv_h${i}`)
      const r = await send(INVITER, { invitationId: `inv_h${i}` })
      if (r.status === 429) { limited++; assert.match((await r.json()).error, /per hour/) }
    }
    assert.ok(limited >= 1, 'hourly limit reached')
    assert.ok(mock.calls.length <= 20)
  })

  it('reports not configured without sending, and never falls back to resend.dev', async () => {
    await invite('inv_n')
    delete process.env.INVITE_FROM_EMAIL
    assert.deepEqual(await (await send(INVITER, { invitationId: 'inv_n' })).json(), { dispatched: false, reason: 'no_mail_provider_configured' })
    process.env.INVITE_FROM_EMAIL = 'CRAFT <onboarding@resend.dev>'
    assert.equal((await (await send(INVITER, { invitationId: 'inv_n' })).json()).dispatched, false)
    assert.equal(mock.calls.length, 0)
  })

  it('audit-logs each outcome without the email body', async () => {
    await invite('inv_l')
    await send(INVITER, { invitationId: 'inv_l' })
    await send(OTHER, { invitationId: 'inv_l' })
    const log = await rows("SELECT actor, target FROM audit_logs WHERE action = 'Invite email send' ORDER BY id")
    assert.deepEqual(log, [{ actor: INVITER, target: 'inv_l · sent' }, { actor: OTHER, target: 'inv_l · forbidden' }])
  })

  it('escapes HTML in every interpolated field', async () => {
    const evil = '<script>alert(1)</script>"\'&'
    await invite('inv_x', { message: evil })
    await rows("UPDATE invitations SET scope_label = $1, inviter_name = $1 WHERE id = 'inv_x'", [evil])
    await send(INVITER, { invitationId: 'inv_x' })
    const { html } = JSON.parse(String(mock.calls[0].init!.body))
    assert.ok(!html.includes('<script>'))
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;&quot;&#39;&amp;/)
    const direct = buildWelcomeEmailHtml({ name: evil, email: 'a@b.c', role: 'assessor', scopeLabel: evil, inviterName: evil, inviterEmail: 'x', message: evil })
    assert.ok(!direct.html.includes('<script>'))
  })
})
