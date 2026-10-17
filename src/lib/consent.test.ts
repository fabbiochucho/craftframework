// Self-check — run directly with `node src/lib/consent.test.ts`.
import assert from 'node:assert/strict'
import { CONSENT_POLICY_VERSION, acceptAll, evaluate, makeRecord, parseRecord, readSignals, rejectAll } from './consent.ts'

const none = { dnt: false, gpc: false }
const at = new Date('2026-10-17T10:00:00Z')

// First visit: ask, track nothing
let s = evaluate(null, none)
assert.deepEqual([s.needsAnswer, s.analytics, s.replay], [true, false, false])

// Accept / reject / choose
s = evaluate(acceptAll(at), none)
assert.deepEqual([s.needsAnswer, s.analytics, s.replay], [false, true, true])
s = evaluate(rejectAll(at), none)
assert.deepEqual([s.needsAnswer, s.analytics, s.replay], [false, false, false])
s = evaluate(makeRecord(true, false, at), none)
assert.deepEqual([s.analytics, s.replay], [true, false])
// Replay cannot exist without analytics
assert.equal(makeRecord(false, true, at).replay, false)
assert.equal(evaluate({ analytics: false, replay: true, timestamp: at.toISOString(), policyVersion: CONSENT_POLICY_VERSION }, none).replay, false)

// Records carry a timestamp and the policy version
const rec = acceptAll(at)
assert.equal(rec.timestamp, '2026-10-17T10:00:00.000Z')
assert.equal(rec.policyVersion, CONSENT_POLICY_VERSION)

// A new policy version re-asks and stops tracking until answered
s = evaluate({ ...rec, policyVersion: 'older' }, none)
assert.deepEqual([s.needsAnswer, s.analytics, s.replay], [true, false, false])

// Do Not Track and Global Privacy Control override even an accepted record, and never prompt
for (const sig of [{ dnt: true, gpc: false }, { dnt: false, gpc: true }]) {
  s = evaluate(acceptAll(at), sig)
  assert.deepEqual([s.needsAnswer, s.analytics, s.replay, s.signal], [false, false, false, true])
  s = evaluate(null, sig)
  assert.deepEqual([s.needsAnswer, s.analytics], [false, false])
}
assert.deepEqual(readSignals({ doNotTrack: '1' }), { dnt: true, gpc: false })
assert.deepEqual(readSignals({ doNotTrack: '0', globalPrivacyControl: true }), { dnt: false, gpc: true })
assert.deepEqual(readSignals({ doNotTrack: null }, { doNotTrack: 'yes' }), { dnt: true, gpc: false })
assert.deepEqual(readSignals(undefined), { dnt: false, gpc: false })

// Stored values are validated
assert.equal(parseRecord(null), null)
assert.equal(parseRecord('not json'), null)
assert.equal(parseRecord(JSON.stringify({ analytics: 'yes', replay: false })), null)
assert.equal(parseRecord(JSON.stringify({ analytics: true, replay: true, policyVersion: 'x', timestamp: 'never' })), null)
assert.deepEqual(parseRecord(JSON.stringify(rec)), rec)

console.log('consent.test.ts: all assertions passed')
