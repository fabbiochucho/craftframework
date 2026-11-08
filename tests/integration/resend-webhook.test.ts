// Resend's delivery webhook: a signed event updates the invitation's delivery status; unsigned ones are refused.
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const mod = await import(new URL('../../netlify/functions/resend-webhook.mts', import.meta.url).href)
const SECRET = 'whsec_' + Buffer.from('test-secret-key').toString('base64')

function post(event: unknown, sign = true) {
  const body = JSON.stringify(event)
  const id = 'msg_1', ts = String(Math.floor(Date.now() / 1000))
  const sig = createHmac('sha256', Buffer.from('test-secret-key')).update(`${id}.${ts}.${body}`).digest('base64')
  return mod.default(new Request('http://localhost/api/resend-webhook', {
    method: 'POST', body, headers: { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': sign ? `v1,${sig}` : 'v1,bad' },
  }))
}

describe('resend webhook', () => {
  beforeEach(async () => {
    await truncateAll()
    process.env.RESEND_WEBHOOK_SECRET = SECRET
    await rows(`INSERT INTO invitations(id,token,email,kind,email_id,delivery_status) VALUES('inv_1','t1','a@b.example','organization','em_1','sent')`)
  })

  it('records delivered and bounced, refuses bad signatures, ignores other emails, and a late "sent" never overwrites', async () => {
    assert.equal((await post({ type: 'email.delivered', data: { email_id: 'em_1' } }, false)).status, 401)
    assert.equal((await post({ type: 'email.delivered', created_at: '2026-11-08T10:00:00Z', data: { email_id: 'em_1' } })).status, 200)
    assert.equal((await rows(`SELECT delivery_status FROM invitations WHERE id='inv_1'`))[0].delivery_status, 'delivered')
    await post({ type: 'email.sent', data: { email_id: 'em_1' } })
    assert.equal((await rows(`SELECT delivery_status FROM invitations WHERE id='inv_1'`))[0].delivery_status, 'delivered')
    await post({ type: 'email.bounced', data: { email_id: 'em_1' } })
    assert.equal((await rows(`SELECT delivery_status FROM invitations WHERE id='inv_1'`))[0].delivery_status, 'bounced')
    assert.deepEqual(await (await post({ type: 'email.delivered', data: { email_id: 'other' } })).json(), { ignored: true })
    assert.deepEqual(await (await post({ type: 'email.opened', data: { email_id: 'em_1' } })).json(), { ignored: true }, 'opens are not tracked')
    assert.ok((await rows(`SELECT 1 FROM audit_logs WHERE action='Invitation email bounced'`)).length)
  })
})
