// Error monitoring on the real workspace-api handler: an unexpected failure is reported exactly once (to a mock
// Sentry transport, never the network) and the response is the normal 500 body; expected 4xx never reports.
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { OWNER, VIEWER, as, call, createOrg, expectStatus, pool, truncateAll } from './harness.ts'
import { useTransportForTests } from '../../netlify/lib/monitoring.ts'

type Envelope = [unknown, Array<[{ type: string }, any]>]
const sent: Envelope[] = []
const events = () => sent.flatMap(([, items]) => items.filter(([h]) => h.type === 'event').map(([, body]) => body))

describe('Sentry error monitoring in the functions', () => {
  before(() => {
    process.env.SENTRY_DSN = 'https://public@o1.ingest.de.sentry.io/1'
    useTransportForTests(() => ({ send: async (e: Envelope) => { sent.push(e); return {} }, flush: async () => true }) as never)
  })
  after(() => {
    delete process.env.SENTRY_DSN
    useTransportForTests(undefined)
  })
  beforeEach(async () => {
    await truncateAll()
    sent.length = 0
  })

  it('reports an unexpected failure once, scrubbed, and still returns the normal 500 body', async () => {
    const realQuery = pool.query.bind(pool)
    ;(pool as any).query = async () => { throw new Error('duplicate key value violates unique constraint\nKey (email)=(secret.person@acme.example) already exists. owner@acme.example') }
    const log = console.error
    console.error = () => {}
    let res
    try { res = await as(OWNER).get('/orgs') } finally { (pool as any).query = realQuery; console.error = log }
    assert.equal(res.status, 500)
    assert.deepEqual(res.body, { error: 'Request failed' })
    const reported = events()
    assert.equal(reported.length, 1, 'reported exactly once')
    const text = JSON.stringify(reported[0])
    assert.ok(!text.includes('secret.person@acme.example') && !text.includes('owner@acme.example'), 'no email reaches Sentry')
    assert.equal(reported[0].tags.scope, '/api/workspace-api')
    assert.equal(reported[0].user, undefined)
    assert.equal(reported[0].request, undefined, 'no request data is attached')
  })

  it('does not report expected 404 / 403 / 429 responses', async () => {
    const { orgId } = await createOrg()
    expectStatus(await as(OWNER).get('/orgs/987654'), 404)
    expectStatus(await as(VIEWER).post(`/orgs/${orgId}/members`, { email: 'x@acme.example', role: 'viewer' }), 403)
    let limited = 0
    for (let i = 0; i < 25; i++) if ((await call(null, 'POST', '/support-bot/submit-issue', { json: {}, ip: '198.51.100.77' })).status === 429) limited++
    assert.ok(limited > 0, 'the rate limiter answered 429')
    assert.equal(events().length, 0, 'expected client errors are not reported')
  })
})
