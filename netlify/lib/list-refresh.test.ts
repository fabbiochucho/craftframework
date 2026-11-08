// Self-check — run directly with `node netlify/lib/list-refresh.test.ts`.
import assert from 'node:assert/strict'
import { RETRY_DELAYS_MS, refreshDueLists } from './list-refresh.ts'

const NOW = Date.parse('2026-11-08T00:00:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()

async function run(ages: Record<string, number | null>, failures: Record<string, number>) {
  const calls: string[] = []; const sleeps: number[] = []; const logs: string[] = []
  const left = { ...failures }
  const out = await refreshDueLists(Object.keys(ages), {
    fetchedAt: async (s) => (ages[s] == null ? null : hoursAgo(ages[s]!)),
    refresh: async (s) => { calls.push(s); if ((left[s] ?? 0) > 0) { left[s]--; throw new Error(`${s} returned 500`) } return 1000 },
    log: { info: (m) => logs.push(`info ${m}`), warn: (m) => logs.push(`warn ${m}`), error: (m) => logs.push(`error ${m}`) },
    sleep: async (ms) => { sleeps.push(ms) },
    now: () => NOW,
  })
  return { out, calls, sleeps, logs }
}

{ // fresh lists are skipped; a brief outage recovers on the retry, a few minutes later
  const r = await run({ un: 1, eu: 24 }, { eu: 1 })
  assert.deepEqual(r.calls, ['eu', 'eu'])
  assert.deepEqual(r.sleeps, [RETRY_DELAYS_MS[0]])
  assert.ok(RETRY_DELAYS_MS.every((ms) => ms >= 2 * 60_000), 'retries are minutes apart')
  assert.deepEqual(r.out, { refreshed: ['eu'], failed: [] })
  assert.ok(!r.logs.some((l) => l.startsWith('warn') || l.startsWith('error')))
}
{ // still down with a recent copy: three attempts, then only a warning
  const r = await run({ eu: 24, uk: 24 }, { eu: 9 })
  assert.deepEqual(r.calls, ['eu', 'uk', 'eu', 'eu'], 'only the failed list is retried')
  assert.equal(r.sleeps.length, 2)
  assert.deepEqual(r.out.failed, ['eu'])
  assert.equal(r.logs.filter((l) => l.startsWith('warn')).length, 1)
  assert.ok(!r.logs.some((l) => l.startsWith('error')))
}
{ // still down and the copy is three days old (or missing): an error, so Sentry alerts
  const r = await run({ eu: 80, ofac: null }, { eu: 9, ofac: 9 })
  assert.equal(r.logs.filter((l) => l.startsWith('error')).length, 2)
  assert.match(r.logs.find((l) => l.includes('ofac'))!, /no previous copy/)
}
console.log('list-refresh ok')
