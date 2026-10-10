import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { as, blobStores, expectStatus, installFetchMock, rows, truncateAll } from './harness.ts'

const originalToken = process.env.GITHUB_TOKEN

describe('public support chat intake', () => {
  beforeEach(async () => {
    await truncateAll()
    process.env.GITHUB_TOKEN = 'test-token'
  })

  afterEach(() => {
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = originalToken
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
})
