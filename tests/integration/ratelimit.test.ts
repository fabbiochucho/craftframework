// The rate limiter is a shared Postgres counter, not per-instance memory.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { beforeEach, describe, it } from 'node:test'
import { OWNER, as, call, createOrg, expectStatus, loadHandler, rows, truncateAll } from './harness.ts'

const hashed = (key: string) => createHash('sha256').update(key).digest('hex')

// Avoid straddling a one-minute window boundary mid-test.
async function awaitSafeWindow() {
  const msIntoWindow = Date.now() % 60_000
  if (msIntoWindow > 55_000) await new Promise((r) => setTimeout(r, 60_000 - msIntoWindow + 50))
}

describe('database-backed rate limiting', () => {
  beforeEach(async () => {
    await truncateAll()
    await awaitSafeWindow()
  })

  it('counts requests in the rate_limits table, keyed by a hash (no raw ip/email at rest)', async () => {
    await createOrg()
    for (let i = 0; i < 3; i++) await as(OWNER).get('/orgs')
    const all = await rows('SELECT key, count FROM rate_limits')
    assert.ok(all.every((r) => /^[0-9a-f]{64}$/.test(r.key)))
    assert.ok(!JSON.stringify(all).includes(OWNER))
    const [mine] = await rows('SELECT count FROM rate_limits WHERE key = $1', [hashed(`u:${OWNER}`)])
    assert.ok(mine.count >= 3)
  })

  it('returns 429 + Retry-After for an IP across separate handler instances', async () => {
    const ip = '198.51.100.23'
    const handlers = await Promise.all(['a', 'b', 'c'].map((i) => loadHandler(`rl-${i}`)))
    assert.equal(new Set(handlers).size, 3, 'three distinct handler module instances')
    let last = { status: 0 } as Awaited<ReturnType<typeof call>>
    let firstLimited = -1
    for (let i = 1; i <= 101; i++) {
      // Each request goes to a different instance; invalid body -> 400 once admitted.
      last = await call(null, 'POST', '/support-bot/submit-issue', { json: {}, ip, instance: `rl-${'abc'[i % 3]}` })
      if (last.status === 429 && firstLimited < 0) firstLimited = i
      if (i <= 100) assert.equal(last.status, 400, `request ${i} should be admitted`)
    }
    assert.equal(last.status, 429)
    assert.equal(firstLimited, 101)
    assert.deepEqual(last.body, { error: 'Too many requests' })
    const retry = Number(last.headers.get('retry-after'))
    assert.ok(Number.isInteger(retry) && retry >= 1 && retry <= 60, `Retry-After=${last.headers.get('retry-after')}`)
    // A brand-new instance (cold start) is still limited because state lives in Postgres.
    const cold = await call(null, 'POST', '/support-bot/submit-issue', { json: {}, ip, instance: 'rl-cold' })
    assert.equal(cold.status, 429)
    // A different client IP has its own budget.
    assert.equal((await call(null, 'POST', '/support-bot/submit-issue', { json: {}, ip: '198.51.100.24', instance: 'rl-cold' })).status, 400)
    assert.equal((await rows('SELECT count FROM rate_limits WHERE key = $1', [hashed(`pub:${ip}`)]))[0].count >= 101, true)
  })

  it('limits authenticated callers per user (1000/min) across instances', async () => {
    await createOrg()
    const { windowStart } = (await rows("SELECT date_trunc('minute', now()) AS \"windowStart\""))[0]
    await rows('INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, $3) ON CONFLICT (key, window_start) DO UPDATE SET count = $3',
      [hashed(`u:${OWNER}`), windowStart, 1000])
    const res = await as(OWNER).get('/orgs', { instance: 'rl-user-1' })
    assert.equal(res.status, 429)
    assert.ok(Number(res.headers.get('retry-after')) >= 1)
    expectStatus(await as('another@acme.example').get('/orgs', { instance: 'rl-user-2' }), 200)
  })

  it('applies a tighter atomic public-chat limit across function instances', async () => {
    const ip = '198.51.100.31'
    for (let i = 1; i <= 21; i++) {
      const res = await call(null, 'POST', '/support-bot/chat', {
        json: { message: 'How do I get started?', publicIssueDisclosure: true },
        ip,
        instance: `chat-rl-${i % 2}`,
      })
      assert.equal(res.status, i === 1 ? 201 : i <= 20 ? 200 : 429, `chat request ${i}`)
    }
    const limited = await call(null, 'POST', '/support-bot/chat', {
      json: { message: 'How do I get started?', publicIssueDisclosure: true },
      ip,
      instance: 'chat-rl-cold',
    })
    assert.equal(limited.status, 429)
    assert.ok(Number(limited.headers.get('retry-after')) >= 1)
  })
})
