import assert from 'node:assert/strict'
import { NUDGE_INTERVAL_MS, nextNudgeAllowedAt, nudgeBlock, signOptOutToken, verifyOptOutToken } from './onboarding-nudge.ts'

const now = new Date('2026-10-17T12:00:00Z')
const ok = { started: true, completed: false, optedOut: false, lastNudgeAt: null, now }

// The 7-day limit: refused up to the last millisecond of the window, allowed from exactly 7 days.
assert.equal(nudgeBlock(ok), null)
assert.equal(nudgeBlock({ ...ok, lastNudgeAt: new Date(now.getTime() - 86_400_000) }), 'too_soon')
assert.equal(nudgeBlock({ ...ok, lastNudgeAt: new Date(now.getTime() - NUDGE_INTERVAL_MS + 1) }), 'too_soon')
assert.equal(nudgeBlock({ ...ok, lastNudgeAt: new Date(now.getTime() - NUDGE_INTERVAL_MS) }), null)
assert.equal(nextNudgeAllowedAt(new Date('2026-10-10T12:00:00Z')).toISOString(), '2026-10-17T12:00:00.000Z')
// Completed and opted-out people are never emailed, even when nothing else blocks.
assert.equal(nudgeBlock({ ...ok, completed: true }), 'completed')
assert.equal(nudgeBlock({ ...ok, optedOut: true }), 'opted_out')
assert.equal(nudgeBlock({ ...ok, completed: true, optedOut: true, lastNudgeAt: now }), 'completed')
assert.equal(nudgeBlock({ ...ok, started: false }), 'not_started')

// Opt-out tokens.
const secret = 'unit-test-secret-not-a-real-credential'
const token = signOptOutToken('Ada@Example.org', secret)
assert.equal(verifyOptOutToken(token, secret), 'ada@example.org')
assert.equal(verifyOptOutToken(token, secret + 'x'), null)
assert.equal(verifyOptOutToken(token, ''), null)
const [payload, sig] = token.split('.')
const forged = Buffer.from('eve@example.org').toString('base64url')
assert.equal(verifyOptOutToken(`${forged}.${sig}`, secret), null) // another address, same signature
assert.equal(verifyOptOutToken(`${payload}.${sig.slice(0, -1)}A`, secret), null)
assert.equal(verifyOptOutToken(`${payload}.`, secret), null)
assert.equal(verifyOptOutToken(payload, secret), null)
assert.equal(verifyOptOutToken(`${token}.extra`, secret), null)
assert.equal(verifyOptOutToken(null, secret), null)
assert.equal(verifyOptOutToken('', secret), null)
console.log('onboarding-nudge.test.ts: all assertions passed')
