// PDF report generation/storage/download, report schedules and the email route
// (SendGrid is never contacted: SENDGRID_* is unset or fetch is mocked).
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import {
  ADMIN, ASSESSOR, OUTSIDER, OWNER, VIEWER, as, blobStores, createCap, createOrg, expectStatus, installFetchMock, rows, truncateAll,
} from './harness.ts'

let orgId = 0, wsId = 0
const pdfHeader = (res: { raw: ArrayBuffer }) => Buffer.from(res.raw).subarray(0, 5).toString('latin1')

describe('PDF reports', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ orgId, wsId } = await createOrg())
    await createCap(wsId)
  })

  it('generates a PDF for every report type, stores it, populates pdf_url and serves it', async () => {
    for (const slug of ['governance-scorecard', 'esg-status', 'cap-summary', 'audit-trail']) {
      const who = slug === 'audit-trail' ? ADMIN : ASSESSOR
      const created = expectStatus(await as(who).post(`/workspaces/${wsId}/reports/${slug}`, {}), 201, slug)
      const report = created.body
      assert.equal(report.reportType, slug.replace(/-/g, '_'))
      assert.equal(report.versions.length, 1)
      assert.equal(report.versions[0].pdfUrl, `/api/workspaces/${wsId}/reports/${report.id}/pdf?version=1`)

      const [row] = await rows('SELECT pdf_url, version_num FROM report_versions WHERE report_id = $1', [report.id])
      assert.ok(row.pdf_url, 'pdf_url populated in the database')
      const stored = blobStores().get('reports')!.get(`reports/${orgId}/${wsId}/${report.id}/v1.pdf`)
      assert.ok(stored, 'PDF stored in the reports blob store')
      assert.equal(stored.bytes.subarray(0, 5).toString(), '%PDF-')

      const dl = expectStatus(await as(VIEWER).get(`/workspaces/${wsId}/reports/${report.id}/pdf`), 200)
      assert.equal(pdfHeader(dl), '%PDF-')
      assert.equal(dl.headers.get('content-type'), 'application/pdf')
      assert.match(dl.headers.get('content-disposition') ?? '', /attachment; filename="report-\d+-v1\.pdf"/)
      assert.equal(dl.headers.get('cache-control'), 'no-store')
      assert.deepEqual(Buffer.from(dl.raw), stored.bytes)
    }
    // The audit-trail report is admin-only.
    assert.equal((await as(ASSESSOR).post(`/workspaces/${wsId}/reports/audit-trail`, {})).status, 403)
  })

  it('enforces org access on the PDF download route and handles missing versions', async () => {
    const id = expectStatus(await as(ASSESSOR).post(`/workspaces/${wsId}/reports/cap-summary`, {}), 201).body.id
    assert.equal((await as(null).get(`/workspaces/${wsId}/reports/${id}/pdf`)).status, 401)
    assert.equal((await as(OUTSIDER).get(`/workspaces/${wsId}/reports/${id}/pdf`)).status, 404)
    const other = await createOrg('Other Org', 'owner@other-org.example', {})
    assert.equal((await as('owner@other-org.example').get(`/workspaces/${other.wsId}/reports/${id}/pdf`)).status, 404)
    assert.equal((await as(VIEWER).get(`/workspaces/${wsId}/reports/${id}/pdf?version=7`)).status, 404)
    assert.equal((await as(VIEWER).get(`/workspaces/${wsId}/reports/999999/pdf`)).status, 404)
    blobStores().get('reports')!.clear()
    assert.equal((await as(VIEWER).get(`/workspaces/${wsId}/reports/${id}/pdf`)).status, 404, 'blob missing')
  })
})

describe('report schedules', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ orgId, wsId } = await createOrg())
  })
  const base = () => `/workspaces/${wsId}/reports/schedules`

  it('requires an admin for list/create/pause/delete and validates input', async () => {
    const body = { reportType: 'cap_summary', cadence: 'monthly', recipients: ['board@acme.example'] }
    for (const user of [VIEWER, ASSESSOR]) {
      assert.equal((await as(user).get(base())).status, 403)
      assert.equal((await as(user).post(base(), body)).status, 403)
    }
    assert.equal((await as(OUTSIDER).get(base())).status, 404)
    assert.equal((await as(null).get(base())).status, 401)

    for (const bad of [
      { ...body, reportType: 'nope' }, { ...body, cadence: 'hourly' }, { ...body, recipients: [] }, { ...body, recipients: ['not-an-email'] },
      { ...body, recipients: Array.from({ length: 11 }, (_, i) => `u${i}@acme.example`) }, { ...body, format: 'docx' },
    ]) assert.equal((await as(ADMIN).post(base(), bad)).status, 400, JSON.stringify(bad).slice(0, 80))

    const created = expectStatus(await as(ADMIN).post(base(), body), 201).body
    assert.equal(created.paused, false)
    assert.ok(new Date(created.nextRunAt) > new Date())
    assert.equal(created.createdBy, ADMIN)
    const listed = expectStatus(await as(OWNER).get(base()), 200).body
    assert.deepEqual(listed.map((s: any) => s.recipients), [['board@acme.example']])

    assert.equal((await as(ASSESSOR).post(`${base()}/${created.id}/pause`, { paused: true })).status, 403)
    assert.equal((await as(ADMIN).post(`${base()}/${created.id}/pause`, { paused: 'yes' })).status, 400)
    assert.equal(expectStatus(await as(ADMIN).post(`${base()}/${created.id}/pause`, { paused: true }), 200).body.paused, true)
    assert.equal((await rows('SELECT paused FROM report_schedules'))[0].paused, true)

    // Another org's admin cannot touch this schedule.
    const other = await createOrg('Other Org', 'owner@other-org.example', {})
    assert.equal((await as('owner@other-org.example').del(`/workspaces/${other.wsId}/reports/schedules/${created.id}`)).status, 404)
    assert.equal((await as('owner@other-org.example').post(`/workspaces/${other.wsId}/reports/schedules/${created.id}/pause`, { paused: false })).status, 404)
    assert.equal((await rows('SELECT count(*)::int AS n FROM report_schedules'))[0].n, 1)

    expectStatus(await as(ADMIN).del(`${base()}/${created.id}`), 200)
    assert.equal((await rows('SELECT count(*)::int AS n FROM report_schedules'))[0].n, 0)
    assert.equal((await as(ADMIN).del(`${base()}/${created.id}`)).status, 404)
    for (const action of ['create', 'update', 'delete']) {
      assert.ok((await rows("SELECT 1 FROM ws_audit_log WHERE resource_type = 'report_schedule' AND action = $1", [action])).length >= 1, action)
    }
  })
})

describe('report email', () => {
  let reportId = 0
  const saved = { key: process.env.SENDGRID_API_KEY, from: process.env.SENDGRID_FROM_EMAIL }
  beforeEach(async () => {
    await truncateAll()
    ;({ orgId, wsId } = await createOrg())
    reportId = expectStatus(await as(ASSESSOR).post(`/workspaces/${wsId}/reports/cap-summary`, {}), 201).body.id
  })
  afterEach(() => {
    for (const [k, v] of [['SENDGRID_API_KEY', saved.key], ['SENDGRID_FROM_EMAIL', saved.from]] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })
  const send = (recipients?: unknown) => as(ADMIN).post(`/workspaces/${wsId}/reports/${reportId}/email`, recipients ? { recipients } : {})

  it('returns 503 "Email not configured" when SENDGRID_API_KEY is unset and never calls fetch', async () => {
    delete process.env.SENDGRID_API_KEY
    process.env.SENDGRID_FROM_EMAIL = 'reports@acme.example'
    const mock = installFetchMock()
    try {
      const res = await send(['board@acme.example'])
      assert.equal(res.status, 503)
      assert.deepEqual(res.body, { error: 'Email not configured' })
      assert.equal(mock.calls.length, 0)
      assert.equal((await rows('SELECT count(*)::int AS n FROM report_versions'))[0].n, 1, 'no email version recorded')
    } finally { mock.restore() }
  })

  it('requires an admin and an existing report even when email is unconfigured', async () => {
    assert.equal((await as(ASSESSOR).post(`/workspaces/${wsId}/reports/${reportId}/email`, {})).status, 403)
    assert.equal((await as(ADMIN).post(`/workspaces/${wsId}/reports/999999/email`, {})).status, 404)
  })

  it('sends the PDF through a mocked SendGrid when configured and records the delivery', async () => {
    process.env.SENDGRID_API_KEY = 'placeholder-not-a-real-key'
    process.env.SENDGRID_FROM_EMAIL = 'reports@acme.example'
    const mock = installFetchMock()
    try {
      assert.equal((await send(['nope'])).status, 400)
      const res = expectStatus(await send(['board@acme.example']), 200)
      assert.equal(res.body.delivered, true)
      assert.equal(res.body.versionNum, 2)
      assert.equal(mock.calls.length, 1)
      assert.equal(mock.calls[0].url, 'https://api.sendgrid.com/v3/mail/send')
      const sent = JSON.parse(String(mock.calls[0].init?.body))
      assert.equal((mock.calls[0].init?.headers as Record<string, string>).Authorization, ['Bear' + 'er', 'placeholder-not-a-real-key'].join(' '))
      assert.deepEqual(sent.personalizations[0].to, [{ email: 'board@acme.example' }])
      assert.equal(sent.attachments[0].type, 'application/pdf')
      assert.equal(Buffer.from(sent.attachments[0].content, 'base64').subarray(0, 5).toString(), '%PDF-')
      const [row] = await rows('SELECT email_sent_to, sent_at FROM report_versions WHERE version_num = 2')
      assert.match(row.email_sent_to, /^enc:/)
      assert.ok(row.sent_at)
    } finally { mock.restore() }
  })

  it('records delivered=false when the (mocked) provider rejects the message', async () => {
    process.env.SENDGRID_API_KEY = 'placeholder-not-a-real-key'
    process.env.SENDGRID_FROM_EMAIL = 'reports@acme.example'
    const mock = installFetchMock(() => new Response('{}', { status: 500 }))
    try {
      const res = expectStatus(await send(['board@acme.example']), 200)
      assert.equal(res.body.delivered, false)
      assert.equal(res.body.sentAt, null)
    } finally { mock.restore() }
  })
})
