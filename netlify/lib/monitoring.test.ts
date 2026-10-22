// Self-check — run directly with `node netlify/lib/monitoring.test.ts`.
import assert from 'node:assert/strict'
import { flushMonitoring, monitored, reportError, useTransportForTests } from './monitoring.ts'
import { logger } from './logger.ts'

type Envelope = [unknown, Array<[{ type: string }, any]>]
const sent: Envelope[] = []
const events = () => sent.flatMap(([, items]) => items.filter(([h]) => h.type === 'event').map(([, body]) => body))
useTransportForTests(() => ({ send: async (envelope: Envelope) => { sent.push(envelope); return {} }, flush: async () => true }) as never)
const quiet = <T>(fn: () => T): T => { const e = console.error; console.error = () => {}; try { return fn() } finally { console.error = e } }

// Without a DSN everything is a no-op: nothing is initialised or sent, and nothing throws.
delete process.env.SENTRY_DSN
quiet(() => logger.error('t', 'broke', new Error('boom')))
reportError('t', new Error('boom'))
await flushMonitoring()
assert.equal(await monitored(async () => 'ok')(), 'ok')
await assert.rejects(monitored(async () => { throw new Error('x') })(), /x/, 'the handler still fails the way it did')
assert.equal(sent.length, 0, 'no DSN: nothing reaches the transport')

// With a DSN: unexpected errors are reported once, expected 4xx ones never are.
process.env.SENTRY_DSN = 'https://public@o1.ingest.de.sentry.io/1'
process.env.CONTEXT = 'deploy-preview'
quiet(() => logger.error('/api/x', 'failed', new Error('db down for owner@acme.example')))
await flushMonitoring()
assert.equal(events().length, 1)
const [event] = events()
assert.equal(event.environment, 'deploy-preview')
assert.equal(event.tags.scope, '/api/x')
assert.ok(!JSON.stringify(event).includes('owner@acme.example'), 'emails are scrubbed before sending')
assert.equal(event.user, undefined)

sent.length = 0
for (const status of [400, 401, 403, 404, 429]) quiet(() => logger.error('/api/x', 'client error', Object.assign(new Error('nope'), { status })))
await flushMonitoring()
assert.equal(events().length, 0, 'expected 4xx are not reported')

// An exception escaping a wrapped handler is reported once and re-thrown unchanged.
await assert.rejects(monitored(async () => { throw new TypeError('escaped') })(), TypeError)
assert.equal(events().length, 1)

// A broken transport never affects the handler.
useTransportForTests(() => ({ send: async () => { throw new Error('network down') }, flush: async () => true }) as never)
assert.equal(await monitored(async () => { quiet(() => logger.error('/api/x', 'failed', new Error('e'))); return 'still fine' })(), 'still fine')
console.log('monitoring.test.ts: all assertions passed')
