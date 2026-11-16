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
})
