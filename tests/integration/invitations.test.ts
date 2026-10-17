// /api/invitations: invitee name + personal note are stored and rendered (escaped)
// by the server-side welcome email; bad input is rejected; the unauthenticated
// token routes only act on a pending, unexpired token and are rate limited.
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetchMock, rows, truncateAll } from './harness.ts'

const invitations = (await import(new URL('../../netlify/functions/invitations.mts', import.meta.url).href)).default
const sendInvite = (await import(new URL('../../netlify/functions/send-invite.mts', import.meta.url).href)).default

const INVITER = 'inviter@acme.example'
let ipSeq = 0

async function create(body: unknown) {
  ;(globalThis as any).__craftTestIdentity = { email: INVITER, name: 'Ines Inviter' }
  return invitations(new Request('http://localhost/api/invitations', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })) as Promise<Response>
}
async function send(body: unknown) {
  ;(globalThis as any).__craftTestIdentity = { email: INVITER, name: 'Ines Inviter' }
  return sendInvite(new Request('http://localhost/api/send-invite', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })) as Promise<Response>
}
const tokenCall = (method: 'GET' | 'PATCH', arg: string | { token: string; status: string }, ip = `203.0.113.${(ipSeq += 1)}`) => {
  ;(globalThis as any).__craftTestIdentity = null
  const headers = { 'x-nf-client-connection-ip': ip, 'content-type': 'application/json' }
  return method === 'GET'
    ? invitations(new Request(`http://localhost/api/invitations?token=${encodeURIComponent(arg as string)}`, { headers })) as Promise<Response>
    : invitations(new Request('http://localhost/api/invitations', { method, headers, body: JSON.stringify(arg) })) as Promise<Response>
}

describe('/api/invitations name and note', () => {
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

  it('stores the trimmed name and note and renders them, escaped, in the sent email', async () => {
    const res = await create({
      email: 'New@Example.org', inviteeName: '  <b>Amina</b> O\'Neil  ', message: '  Join us & <script>alert(1)</script>\nSee you soon  ',
      role: 'assessor', scopeLabel: 'Acme Org',
    })
    assert.equal(res.status, 201)
    const inv = await res.json()
    const [row] = await rows('SELECT invitee_name, message FROM invitations WHERE id = $1', [inv.id])
    assert.equal(row.invitee_name, "<b>Amina</b> O'Neil")
    assert.equal(row.message, 'Join us & <script>alert(1)</script>\nSee you soon')

    assert.equal((await send({ invitationId: inv.id })).status, 200)
    const { html, to } = JSON.parse(String(mock.calls[0].init!.body))
    assert.equal(to, 'new@example.org')
    assert.match(html, /Welcome, &lt;b&gt;Amina&lt;\/b&gt; O&#39;Neil/)
    assert.match(html, /Join us &amp; &lt;script&gt;alert\(1\)&lt;\/script&gt;/)
    assert.ok(!html.includes('<script>') && !html.includes('<b>Amina'))
  })

  it('greets "Colleague" and omits the note block only when they are empty', async () => {
    const inv = await (await create({ email: 'a@example.org', inviteeName: '   ', message: '' })).json()
    const [row] = await rows('SELECT invitee_name, message FROM invitations WHERE id = $1', [inv.id])
    assert.equal(row.invitee_name, null)
    assert.equal(row.message, null)
    await send({ invitationId: inv.id })
    const { html } = JSON.parse(String(mock.calls[0].init!.body))
    assert.match(html, /Welcome, Colleague/)
    assert.ok(!html.includes('wrote:'))
  })

  it('rejects over-long or control-character name/note', async () => {
    const base = { email: 'a@example.org' }
    for (const bad of [
      { inviteeName: 'x'.repeat(121) }, { inviteeName: 'Line\nBreak' }, { inviteeName: 'Tab\there' }, { inviteeName: 'nul\u0000' },
      { inviteeName: 42 }, { message: 'y'.repeat(1001) }, { message: 'bell\u0007' }, { message: 'esc\u001b[31m' }, { message: { a: 1 } },
    ]) assert.equal((await create({ ...base, ...bad })).status, 400, JSON.stringify(bad).slice(0, 40))
    assert.equal((await rows('SELECT count(*)::int AS n FROM invitations'))[0].n, 0)
    // Limits are inclusive; ordinary line breaks in the note are fine.
    assert.equal((await create({ ...base, inviteeName: 'x'.repeat(120), message: `${'y'.repeat(998)}\r\n` })).status, 201)
  })

  it('/api/send-invite never takes name or note from the client', async () => {
    const inv = await (await create({ email: 'a@example.org', inviteeName: 'Real Name', message: 'Real note' })).json()
    for (const body of [
      { invitationId: inv.id, inviteeName: 'Spoof' }, { invitationId: inv.id, message: 'Spoof' }, { invitationId: inv.id, name: 'Spoof' },
    ]) assert.equal((await send(body)).status, 400, JSON.stringify(body))
    assert.equal(mock.calls.length, 0)
    await send({ invitationId: inv.id })
    const { html } = JSON.parse(String(mock.calls[0].init!.body))
    assert.match(html, /Welcome, Real Name/)
    assert.match(html, /Real note/)
    assert.ok(!html.includes('Spoof'))
  })
})

describe('/api/invitations token routes', () => {
  beforeEach(truncateAll)
  const seed = (id: string, status = 'pending', interval = '7 days') => rows(
    `INSERT INTO invitations (id, token, email, inviter, role, scope_label, status, expires_at)
     VALUES ($1, $2, 'x@example.org', $3, 'assessor', 'Acme', $4, now() + $5::interval)`, [id, `tok-${id}`, INVITER, status, interval])
  const statusOf = async (id: string) => (await rows('SELECT status FROM invitations WHERE id = $1', [id]))[0].status

  it('PATCH changes only a pending, unexpired invitation, only to accepted/revoked', async () => {
    await seed('inv_p')
    assert.equal((await tokenCall('PATCH', { token: 'tok-inv_p', status: 'pending' })).status, 400)
    assert.equal((await tokenCall('PATCH', { token: 'tok-inv_p', status: 'anything' })).status, 400)
    assert.equal((await tokenCall('PATCH', { token: 'tok-nope', status: 'accepted' })).status, 404)
    assert.equal(await statusOf('inv_p'), 'pending')
    const ok = await tokenCall('PATCH', { token: 'tok-inv_p', status: 'accepted' })
    assert.equal(ok.status, 200)
    assert.deepEqual(await ok.json(), { id: 'inv_p', status: 'accepted' })
    // A second answer cannot flip it back, revoke it, or reopen it.
    for (const status of ['revoked', 'accepted']) assert.equal((await tokenCall('PATCH', { token: 'tok-inv_p', status })).status, 404)
    assert.equal(await statusOf('inv_p'), 'accepted')

    await seed('inv_r', 'revoked')
    await seed('inv_e', 'pending', '-1 minute')
    for (const id of ['inv_r', 'inv_e']) assert.equal((await tokenCall('PATCH', { token: `tok-${id}`, status: 'accepted' })).status, 404, id)
    assert.equal(await statusOf('inv_r'), 'revoked')
    assert.equal(await statusOf('inv_e'), 'pending')
  })

  it('PATCH touches only the invitation owning the token and cannot be used by id or email', async () => {
    await seed('inv_a')
    await seed('inv_b')
    assert.equal((await tokenCall('PATCH', { token: 'tok-inv_a', status: 'revoked', id: 'inv_b', email: 'x@example.org' } as any)).status, 200)
    assert.equal(await statusOf('inv_a'), 'revoked')
    assert.equal(await statusOf('inv_b'), 'pending')
    assert.equal((await tokenCall('PATCH', { token: 'inv_b', status: 'revoked' })).status, 404)
    assert.equal((await tokenCall('PATCH', { token: '', status: 'revoked' })).status, 400)
  })

  it('rate limits token lookups and PATCH per IP (429)', async () => {
    await seed('inv_l')
    const ip = '198.51.100.77'
    const msIntoWindow = Date.now() % 60_000
    if (msIntoWindow > 55_000) await new Promise((r) => setTimeout(r, 60_000 - msIntoWindow + 50))
    let limited = 0
    for (let i = 0; i < 40; i++) {
      const res = i % 2 ? await tokenCall('GET', 'tok-guess', ip) : await tokenCall('PATCH', { token: 'tok-guess', status: 'revoked' }, ip)
      if (res.status === 429) limited += 1
    }
    assert.ok(limited >= 9, `expected 429s after 30 requests, got ${limited}`)
    assert.equal((await tokenCall('GET', 'tok-inv_l', '198.51.100.78')).status, 200, 'another IP is unaffected')
  })
})
