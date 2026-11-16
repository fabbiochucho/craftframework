// In-app inbox: every notification email leaves a copy for its recipient, readable only by them.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'
import { sendReminderEmail } from '../../netlify/lib/reminder-email.ts'

const inbox = (await import(new URL('../../netlify/functions/inbox.mts', import.meta.url).href)).default
const ANN = 'ann@x.example'
const BOB = 'bob@x.example'

async function call(email: string | null, method: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await inbox(new Request('http://localhost/api/inbox', {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function contacts(email: string) {
  ;(globalThis as any).__craftTestIdentity = { email }
  const res: Response = await inbox(new Request('http://localhost/api/inbox?contacts=1'))
  return (await res.json()).contacts
}

describe('inbox', () => {
  beforeEach(async () => { await truncateAll() })

  it('keeps a copy for each recipient even when no email provider is configured, and only they can read it', async () => {
    delete process.env.RESEND_API_KEY
    assert.equal(await sendReminderEmail({ to: [ANN, ' Bob@X.example '], subject: 'Evidence due', text: 'Please upload by Friday.' }, undefined, 'evidence_reminder'), 'not_configured')
    await sendReminderEmail({ to: ANN, subject: 'Second', text: 'Two' })

    assert.equal((await call(null, 'GET')).status, 401)
    const ann = await call(ANN, 'GET')
    assert.equal(ann.body.unread, 2)
    assert.deepEqual(ann.body.messages.map((m: any) => m.subject).sort(), ['Evidence due', 'Second'])
    const bob = await call(BOB, 'GET')
    assert.deepEqual(bob.body.messages.map((m: any) => [m.subject, m.body, m.kind]), [['Evidence due', 'Please upload by Friday.', 'evidence_reminder']])

    // Bob cannot mark Ann's message read; Ann can mark one, then all.
    const annFirst = ann.body.messages[0].id
    await call(BOB, 'POST', { id: annFirst })
    assert.equal((await call(ANN, 'GET')).body.unread, 2)
    await call(ANN, 'POST', { id: annFirst })
    assert.equal((await call(ANN, 'GET')).body.unread, 1)
    await call(ANN, 'POST', {})
    assert.equal((await call(ANN, 'GET')).body.unread, 0)
    assert.equal((await rows('SELECT count(*)::int AS n FROM inbox_messages WHERE read_at IS NULL'))[0].n, 1, "Bob's stays unread")
  })

  it('lets people message only those they already work with', async () => {
    delete process.env.RESEND_API_KEY
    const ANN_ORG = 'self_ann_x_example'
    await rows(`INSERT INTO organizations(id, name, email, created_by) VALUES($1, 'Ann Org', $2, $2)`, [ANN_ORG, ANN])
    await rows(`INSERT INTO access_grants(id, org_id, grantee, role, status) VALUES('g1', $1, $2, 'independent_assessor', 'active')`, [ANN_ORG, BOB])
    const send = (from: string, to: string, extra: object = {}) => call(from, 'POST', { to, subject: 'Evidence', body: 'Can you upload the constitution?', ...extra })

    // Bob holds access to Ann's organisation, so each can see and write to the other; a stranger cannot.
    assert.deepEqual((await contacts(BOB)).map((c: any) => c.email), [ANN])
    assert.deepEqual((await contacts(ANN)).map((c: any) => c.email), [BOB])
    assert.deepEqual(await contacts('stranger@x.example'), [])
    assert.equal((await send('stranger@x.example', ANN)).status, 403)
    assert.equal((await send(BOB, 'stranger@x.example')).status, 403)
    assert.equal((await send(BOB, ANN, { subject: '' })).status, 400)
    assert.equal((await send(BOB, ANN, { body: 'x'.repeat(5001) })).status, 400)

    assert.equal((await send(BOB, ANN)).status, 200)
    const got = (await call(ANN, 'GET')).body.messages
    assert.deepEqual(got.map((m: any) => [m.sender, m.subject, m.kind]), [[BOB, 'Evidence', 'message']], 'one copy, from Bob, no duplicate from the email')
    assert.equal((await call(BOB, 'GET')).body.messages.length, 0)

    // Revoking the access ends the conversation.
    await rows(`UPDATE access_grants SET status='revoked' WHERE id='g1'`)
    assert.equal((await send(BOB, ANN)).status, 403)
  })
})
