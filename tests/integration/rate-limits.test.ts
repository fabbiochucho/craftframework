// The per-minute limiters' cleanup must not wipe long-lived counters (hourly budgets, per-invitation caps).
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const { purgeExpiredRateLimits, overLimit } = await import(new URL('../../netlify/lib/public-rate-limit.ts', import.meta.url).href)
const { overHourlyBudget } = await import(new URL('../../netlify/lib/report-recipients.ts', import.meta.url).href)

const HOUR = 3_600_000
const count = async () => Number((await rows('SELECT count(*)::int AS n FROM rate_limits'))[0].n)

describe('rate limit cleanup', () => {
  beforeEach(() => truncateAll())

  it('keeps an hourly budget for its whole hour while purging stale per-minute windows', async () => {
    const top = Math.floor(Date.now() / HOUR) * HOUR
    const now = top + 50 * 60_000 // 50 minutes into the hour: the hourly row's window_start is far older than 2 min
    for (let i = 0; i < 3; i++) assert.equal(await overHourlyBudget('report-email-org:1', 1, 3, now), false)
    await overLimit('minute-key', 100, now - 10 * 60_000) // a per-minute window from 10 minutes ago
    assert.equal(await count(), 2)

    await purgeExpiredRateLimits(now)
    assert.equal(await count(), 1, 'the stale per-minute window is gone')
    assert.equal(await overHourlyBudget('report-email-org:1', 1, 3, now), true, 'the hourly budget still counts: the 4th unit is over')

    await purgeExpiredRateLimits(top + HOUR + 1)
    assert.equal(await count(), 0, 'and it is purged once its hour has passed')
  })

  it('keeps a per-invitation cap (window_start 1970) until its own expiry', async () => {
    await rows(`INSERT INTO rate_limits(key, window_start, count, expires_at) VALUES('cap', to_timestamp(0), 2, now() + interval '90 days')`)
    await purgeExpiredRateLimits(Date.now())
    assert.equal(await count(), 1)
    await purgeExpiredRateLimits(Date.now() + 91 * 24 * HOUR)
    assert.equal(await count(), 0)
  })
})
