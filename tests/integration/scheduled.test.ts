// The daily scheduled function that processes due report schedules
// (netlify/functions/weekly-reports.mts), against a real Postgres. SendGrid is
// mocked via fetch; no real network call is ever made.
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import {
  ADMIN, OWNER, VIEWER, as, blobStores, createOrg, expectStatus, installFetchMock, rows, truncateAll,
} from './harness.ts'

const scheduledUrl = new URL('../../netlify/functions/weekly-reports.mts', import.meta.url).href
const runScheduled = async () => (await import(scheduledUrl)).default()

let wsId = 0
const placeholderKey = 'placeholder-not-a-real-key'

describe('scheduled report processing', () => {
  const saved = { key: process.env.SENDGRID_API_KEY, from: process.env.SENDGRID_FROM_EMAIL }
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })
  afterEach(() => {
    for (const [k, v] of [['SENDGRID_API_KEY', saved.key], ['SENDGRID_FROM_EMAIL', saved.from]] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })
  const schedule = async (extra: Record<string, unknown> = {}) => {
    const s = expectStatus(await as(ADMIN).post(`/workspaces/${wsId}/reports/schedules`, {
      reportType: 'cap_summary', cadence: 'weekly', recipients: ['board@acme.example'], ...extra,
    }), 201).body
    await rows("UPDATE report_schedules SET next_run_at = now() - interval '1 hour' WHERE id = $1", [s.id])
    return s.id as number
  }

  it('generates and stores a PDF for due schedules, mails it via the (mocked) provider and reschedules', async () => {
    process.env.SENDGRID_API_KEY = placeholderKey
    process.env.SENDGRID_FROM_EMAIL = 'reports@acme.example'
    const id = await schedule()
    const mock = installFetchMock()
    try {
      await runScheduled()
      assert.equal(mock.calls.length, 1)
      assert.equal(mock.calls[0].url, 'https://api.sendgrid.com/v3/mail/send')
      assert.equal((mock.calls[0].init?.headers as Record<string, string>).Authorization, ['Bear' + 'er', placeholderKey].join(' '))
      const sent = JSON.parse(String(mock.calls[0].init?.body))
      assert.deepEqual(sent.personalizations[0].to, [{ email: 'board@acme.example' }])
      assert.equal(Buffer.from(sent.attachments[0].content, 'base64').subarray(0, 5).toString(), '%PDF-')
    } finally { mock.restore() }

    const [report] = await rows('SELECT id, generated_by, report_type FROM reports')
    assert.equal(report.generated_by, 'system')
    const [version] = await rows('SELECT pdf_url, email_sent_to, sent_at FROM report_versions WHERE report_id = $1', [report.id])
    assert.ok(version.pdf_url && version.sent_at)
    assert.match(version.email_sent_to, /^enc:/)
    assert.ok(blobStores().get('reports')!.has(`reports/${(await rows('SELECT org_id FROM reports'))[0].org_id}/${wsId}/${report.id}/v1.pdf`))
    const dl = expectStatus(await as(VIEWER).get(`/workspaces/${wsId}/reports/${report.id}/pdf`), 200)
    assert.equal(Buffer.from(dl.raw).subarray(0, 5).toString(), '%PDF-')
    const [next] = await rows('SELECT next_run_at > now() AS future FROM report_schedules WHERE id = $1', [id])
    assert.equal(next.future, true, 'schedule moved into the future')
    assert.equal((await rows("SELECT count(*)::int AS n FROM ws_audit_log WHERE actor_id = 'system' AND details->>'scheduled' = 'true'"))[0].n, 1)

    await runScheduled() // nothing is due any more
    assert.equal((await rows('SELECT count(*)::int AS n FROM reports'))[0].n, 1)
  })

  it('still generates the report but does not call fetch when email is not configured', async () => {
    delete process.env.SENDGRID_API_KEY
    await schedule()
    const mock = installFetchMock()
    try { await runScheduled(); assert.equal(mock.calls.length, 0) } finally { mock.restore() }
    const [version] = await rows('SELECT pdf_url, email_sent_to, sent_at FROM report_versions')
    assert.ok(version.pdf_url)
    assert.equal(version.email_sent_to, null)
    assert.equal(version.sent_at, null)
  })

  it('skips paused and not-yet-due schedules', async () => {
    const paused = await schedule()
    expectStatus(await as(ADMIN).post(`/workspaces/${wsId}/reports/schedules/${paused}/pause`, { paused: true }), 200)
    expectStatus(await as(OWNER).post(`/workspaces/${wsId}/reports/schedules`, {
      reportType: 'esg_status', cadence: 'monthly', recipients: ['later@acme.example'],
    }), 201)
    await runScheduled()
    assert.equal((await rows('SELECT count(*)::int AS n FROM reports'))[0].n, 0)
  })

  it('claims overlapping invocations atomically and reuses the generated occurrence on safe retries', async () => {
    process.env.SENDGRID_API_KEY = placeholderKey
    process.env.SENDGRID_FROM_EMAIL = 'reports@acme.example'
    const id = await schedule()
    let rejected = true
    const mock = installFetchMock(() => new Response('', { status: rejected ? 429 : 202 }))
    try {
      await Promise.all([runScheduled(), runScheduled()])
      assert.equal(mock.calls.length, 1)
      assert.equal((await rows('SELECT count(*)::int AS n FROM reports'))[0].n, 1)
      assert.equal((await rows('SELECT next_run_at < now() AS due FROM report_schedules WHERE id=$1', [id]))[0].due, true)
      rejected = false
      await runScheduled()
      assert.equal(mock.calls.length, 2)
      assert.equal((await rows('SELECT count(*)::int AS n FROM reports'))[0].n, 1)
      assert.equal((await rows('SELECT count(*)::int AS n FROM report_versions'))[0].n, 1)
      assert.equal((await rows('SELECT next_run_at > now() AS future FROM report_schedules WHERE id=$1', [id]))[0].future, true)
    } finally { mock.restore() }
  })

  it('does not duplicate ambiguous SendGrid failures and leaves the occurrence due for reconciliation', async () => {
    process.env.SENDGRID_API_KEY = placeholderKey
    process.env.SENDGRID_FROM_EMAIL = 'reports@acme.example'
    const id = await schedule()
    const mock = installFetchMock(() => new Response('', { status: 503 }))
    try {
      await runScheduled()
      await runScheduled()
      assert.equal(mock.calls.length, 1)
      assert.equal((await rows('SELECT count(*)::int AS n FROM reports'))[0].n, 1)
      assert.equal((await rows('SELECT next_run_at < now() AS due FROM report_schedules WHERE id=$1', [id]))[0].due, true)
      const [version] = await rows('SELECT sent_at, email_sent_to FROM report_versions')
      assert.equal(version.sent_at, null)
      assert.equal(version.email_sent_to, null)
    } finally { mock.restore() }
  })
})
