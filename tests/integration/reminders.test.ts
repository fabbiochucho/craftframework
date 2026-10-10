import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetchMock, rows, truncateAll } from './harness.ts'

const compliance = (await import(new URL('../../netlify/functions/compliance-alerts.mts', import.meta.url).href)).default
const universal = (await import(new URL('../../netlify/functions/universal-obligations-alerts.mts', import.meta.url).href)).default
const request = () => new Request('http://localhost/scheduled', { method: 'POST', body: '{}' })

describe('scheduled reminder delivery reporting', () => {
  beforeEach(async () => {
    await truncateAll()
    delete process.env.RESEND_API_KEY
    delete process.env.REMINDER_FROM_EMAIL
    delete process.env.INVITE_FROM_EMAIL
    await rows("INSERT INTO organizations(id,name,email) VALUES('alerts','Alerts','recipient@example.com')")
    await rows("INSERT INTO compliance_items(id,org_id,type,name,next_due_date) VALUES('alert','alerts','report','Due report',current_date::text)")
  })
  afterEach(() => {
    delete process.env.RESEND_API_KEY
    delete process.env.REMINDER_FROM_EMAIL
  })

  it('does not count preview skips or provider rejections as sent and accepts configured sends', async () => {
    const mock = installFetchMock(() => Response.json({ error: 'sender not verified' }, { status: 403 }))
    try {
      const skipped = await (await compliance(request())).json()
      assert.equal(skipped.sent, 0)
      assert.equal(skipped.notConfigured, 1)
      assert.equal(mock.calls.length, 0)
      process.env.RESEND_API_KEY = 'test-provider'
      process.env.REMINDER_FROM_EMAIL = 'Compliance <alerts@example.com>'
      const rejected = await compliance(request())
      assert.equal(rejected.status, 502)
      const failed = await rejected.json()
      assert.equal(failed.sent, 0)
      assert.equal(failed.failed, 1)
      assert.equal(JSON.parse(String(mock.calls[0].init?.body)).from, process.env.REMINDER_FROM_EMAIL)
      const globalRejected = await universal(request())
      assert.equal(globalRejected.status, 502)
      assert.equal((await globalRejected.json()).sent, 0)
    } finally { mock.restore() }
    const accepted = installFetchMock()
    try {
      const result = await (await compliance(request())).json()
      assert.equal(result.sent, 1)
      assert.equal(result.failed, 0)
    } finally { accepted.restore() }
  })
})
