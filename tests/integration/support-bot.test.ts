import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { ADMIN, as, blobStores, createOrg, expectStatus, installFetchMock, rows, truncateAll } from './harness.ts'

const originalToken = process.env.GITHUB_TOKEN

describe('public support chat intake', () => {
  beforeEach(async () => {
    await truncateAll()
    process.env.GITHUB_TOKEN = 'test-token'
  })

  afterEach(() => {
    delete process.env.RESEND_API_KEY
    delete process.env.REMINDER_FROM_EMAIL
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = originalToken
  })

  it('queues encrypted confidential reports and sends only redacted text to the fixed Resend recipient', async () => {
    process.env.RESEND_API_KEY = 'test-provider'
    process.env.REMINDER_FROM_EMAIL = 'support@acme.example'
    const mock = installFetchMock()
    try {
      const body = {
        message: 'Security issue: ' + ['password', 'hidden'].join('=') + ' person@example.com',
        classification: 'question', contactEmail: 'reporter@example.com',
        escalationConsent: true,
      }
      const response = expectStatus(await as(null).post('/support-bot/escalate', body), 200)
      assert.equal(response.body.status, 'accepted')
      assert.equal(response.body.recipientType, 'confidential')
      const email = JSON.parse(String(mock.calls[0].init?.body))
      assert.equal(mock.calls[0].url, 'https://api.resend.com/emails')
      assert.deepEqual(email.to, ['craftframework@becomechange.institute'])
      assert.equal(email.reply_to, 'reporter@example.com')
      assert.match(email.subject, /PRIVATE \/ CONFIDENTIAL/)
      assert.ok(!email.text.includes('hidden'))
      assert.ok(!email.text.includes('person@example.com'))
      const [entry] = await rows('SELECT * FROM support_escalations')
      assert.match(entry.message, /^enc:/)
      assert.match(entry.contact_email, /^enc:/)
      assert.equal((await rows('SELECT count(*)::int AS n FROM support_issues'))[0].n, 0)
      const retries = await Promise.all([as(null).post('/support-bot/escalate', body), as(null).post('/support-bot/escalate', body)])
      assert.ok(retries.every(r => r.body.deduplicated))
      assert.equal(mock.calls.length, 1)
    } finally {
      mock.restore()
    }
  })

  it('distinguishes absent and failed providers and retries the durable queue with the same provider key', async () => {
    const body = {
      message: 'Something completely unrelated', classification: 'question',
      contactEmail: 'reporter@example.com', escalationConsent: true, reason: 'unresolved_question',
    }
    assert.equal(expectStatus(await as(null).post('/support-bot/escalate', body), 503).body.status, 'not_configured')
    process.env.RESEND_API_KEY = 'test-provider'
    process.env.REMINDER_FROM_EMAIL = 'support@acme.example'
    let fail = true
    const mock = installFetchMock(() => new Response('{}', { status: fail ? 503 : 200 }))
    try {
      assert.equal(expectStatus(await as(null).post('/support-bot/escalate', body), 502).body.status, 'failed')
      fail = false
      assert.equal(expectStatus(await as(null).post('/support-bot/escalate', body), 200).body.status, 'accepted')
      assert.equal(new Headers(mock.calls[0].init?.headers).get('Idempotency-Key'), new Headers(mock.calls[1].init?.headers).get('Idempotency-Key'))
      assert.equal((await rows('SELECT count(*)::int AS n FROM support_escalations'))[0].n, 1)
    } finally {
      mock.restore()
    }
  })

  it('rejects invalid contact, classification, consent and FAQ-resolved escalation', async () => {
    const body = {
      message: 'How do I install?', classification: 'question',
      contactEmail: 'reporter@example.com', escalationConsent: true, reason: 'unresolved_question',
    }
    for (const changes of [{}, { contactEmail: 'a@example.com\r\nBcc: victim@example.com' }, { classification: 'bug' }, { escalationConsent: false }, { message: '   ' }]) {
      expectStatus(await as(null).post('/support-bot/escalate', { ...body, ...changes }), 400)
    }
    expectStatus(await as(null).post('/support-bot/escalate', body, { headers: { origin: 'https://evil.example' } }), 403)
    assert.equal((await rows('SELECT count(*)::int AS n FROM support_escalations'))[0].n, 0)
  })

  it('keeps private reports from legacy workspace and GitHub intake out of public issues', async () => {
    const body = { description: 'A harassment report', category: 'bug', contactEmail: 'reporter@example.com', escalationConsent: true }
    expectStatus(await as(null).post('/support-bot/submit-issue', body), 503)
    expectStatus(await as(null).post('/support-bot/github-issue', body), 503)
    assert.equal((await rows('SELECT count(*)::int AS n FROM support_issues'))[0].n, 0)
    assert.equal((await rows('SELECT count(*)::int AS n FROM support_escalations'))[0].n, 1)
  })

  it('requires disclosure and routes conduct/security reports without creating a public issue', async () => {
    const missingDisclosure = await as(null).post('/support-bot/chat', { message: 'How do I install?' })
    assert.equal(missingDisclosure.status, 400)

    const fetchMock = installFetchMock()
    try {
      const response = expectStatus(await as(null).post('/support-bot/chat', {
        message: 'I need to report a security issue',
        publicIssueDisclosure: true,
      }), 200)
      assert.equal(response.body.type, 'private_report')
      assert.match(response.body.answer, /contact craftframework@becomechange\.institute/)
      assert.equal(fetchMock.calls.length, 0)
      assert.equal((await rows('SELECT count(*)::int AS n FROM support_issues'))[0].n, 0)
    } finally {
      fetchMock.restore()
    }
  })

  it('creates one PII-filtered public issue for an FAQ answer and returns a real tracking URL on retry', async () => {
    const previous = process.env.GITHUB_TOKEN
    process.env.GITHUB_TOKEN = 'test-token'
    const issueUrl = 'https://github.com/fabbiochucho/craftframework/issues/321'
    const fetchMock = installFetchMock(() => new Response(JSON.stringify({ html_url: issueUrl }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }))
    try {
      const body = {
        message: 'How do I install and run this locally? Email person@example.com; api_key=abc123',
        publicIssueDisclosure: true,
        context: 'confidential assessment data',
        workspaceId: 98765,
      }
      const first = expectStatus(await as(null).post('/support-bot/chat', body), 201).body
      assert.match(first.answer, /Getting Started/)
      assert.equal(first.issueUrl, issueUrl)
      assert.equal(first.issueCreated, true)

      const request = JSON.parse(String(fetchMock.calls[0].init?.body))
      assert.deepEqual(request.labels, ['community-question'])
      assert.ok(!request.body.includes('person@example.com'))
      assert.ok(!request.body.includes('abc123'))
      assert.ok(!request.body.includes('confidential assessment data'))
      assert.ok(!request.body.includes('98765'))
      assert.ok(!request.body.includes('@'))

      const retry = expectStatus(await as(null).post('/support-bot/chat', body), 200).body
      assert.equal(retry.issueUrl, issueUrl)
      assert.equal(retry.deduplicated, true)
      assert.equal(fetchMock.calls.length, 1)
      assert.equal((await rows('SELECT count(*)::int AS n FROM support_issues'))[0].n, 1)
      assert.equal((await rows('SELECT org_id, workspace_id, contact_email FROM support_issues'))[0].org_id, null)
      assert.equal((await rows('SELECT org_id, workspace_id, contact_email FROM support_issues'))[0].workspace_id, null)
      assert.equal((await rows('SELECT org_id, workspace_id, contact_email FROM support_issues'))[0].contact_email, '')
      assert.equal(blobStores().get('support-intake')?.size, 1)
    } finally {
      fetchMock.restore()
      if (previous === undefined) delete process.env.GITHUB_TOKEN
      else process.env.GITHUB_TOKEN = previous
    }
  })

  it('retries GitHub issue creation for a deduplicated intake whose first attempt failed', async () => {
    const issueUrl = 'https://github.com/fabbiochucho/craftframework/issues/654'
    let attempt = 0
    const fetchMock = installFetchMock(() => {
      attempt++
      return attempt === 1
        ? new Response('{}', { status: 503 })
        : new Response(JSON.stringify({ html_url: issueUrl }), { status: 201, headers: { 'Content-Type': 'application/json' } })
    })
    try {
      const request = { message: 'How do I use the toolkit?', publicIssueDisclosure: true }
      const initial = expectStatus(await as(null).post('/support-bot/chat', request), 201).body
      assert.equal(initial.issueCreated, false)
      const retry = expectStatus(await as(null).post('/support-bot/chat', request), 200).body
      assert.equal(retry.issueUrl, issueUrl)
      assert.equal(retry.deduplicated, true)
      assert.equal(fetchMock.calls.length, 2)
      assert.equal((await rows('SELECT github_issue_url FROM support_issues'))[0].github_issue_url, issueUrl)
    } finally {
      fetchMock.restore()
    }
  })

  it('shares disclosure, redaction and workspace deduplication across legacy intake and chat', async () => {
    const { wsId } = await createOrg()
    const mock = installFetchMock(() => new Response(JSON.stringify({ html_url: 'https://github.com/fabbiochucho/craftframework/issues/987' }), { status: 201 }))
    try {
      const body = { description: 'How do I install? person@example.com', workspaceId: wsId, contactEmail: ADMIN }
      expectStatus(await as(ADMIN).post('/support-bot/submit-issue', body), 400)
      const first = expectStatus(await as(ADMIN).post('/support-bot/submit-issue', { ...body, publicIssueDisclosure: true }), 201)
      const second = expectStatus(await as(ADMIN).post('/support-bot/chat', { ...body, message: body.description, publicIssueDisclosure: true }), 200)
      assert.equal(second.body.id, first.body.id)
      assert.equal(second.body.deduplicated, true)
      assert.equal(mock.calls.length, 1)
      const [entry] = await rows('SELECT * FROM support_issues')
      assert.equal(entry.workspace_id, wsId)
      assert.ok(entry.org_id)
      assert.match(entry.contact_email, /^enc:/)
      assert.ok(!entry.description.includes('person@example.com'))
      const outbound = String(mock.calls[0].init?.body)
      assert.ok(!outbound.includes(ADMIN))
      assert.ok(!outbound.includes('person@example.com'))
    } finally { mock.restore() }
  })

  it('scheduled escalation retry uses the durable encrypted queue and provider idempotency key', async () => {
    const body = { message: 'Something unrelated', classification: 'question', contactEmail: 'reporter@example.com', escalationConsent: true, reason: 'human_requested' }
    expectStatus(await as(null).post('/support-bot/escalate', body), 503)
    process.env.RESEND_API_KEY = 'test-provider'
    process.env.REMINDER_FROM_EMAIL = 'support@acme.example'
    const mock = installFetchMock()
    try {
      const worker = (await import(new URL('../../netlify/functions/support-escalation-retry.mts', import.meta.url).href)).default
      await worker()
      await worker()
      assert.equal(mock.calls.length, 1)
      assert.equal((await rows('SELECT status FROM support_escalations'))[0].status, 'accepted')
      assert.ok(new Headers(mock.calls[0].init?.headers).get('Idempotency-Key'))
    } finally { mock.restore() }
  })
})
