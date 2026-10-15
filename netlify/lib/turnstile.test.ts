import assert from 'node:assert/strict'
import { verifyTurnstile } from './turnstile.ts'

const reply = (status: number, json: unknown) => (async () => new Response(JSON.stringify(json), { status })) as typeof fetch
assert.equal(await verifyTurnstile('tok', 's', undefined, reply(200, { success: true })), 'pass')
assert.equal(await verifyTurnstile('tok', 's', undefined, reply(200, { success: false })), 'fail')
assert.equal(await verifyTurnstile('', 's', undefined, reply(200, { success: true })), 'fail')
assert.equal(await verifyTurnstile(undefined, 's', undefined, reply(200, { success: true })), 'fail')
assert.equal(await verifyTurnstile('tok', 's', undefined, reply(500, {})), 'unavailable')
assert.equal(await verifyTurnstile('tok', 's', undefined, (async () => { throw new Error('down') }) as typeof fetch), 'unavailable')
console.log('turnstile.test.ts: all assertions passed')
