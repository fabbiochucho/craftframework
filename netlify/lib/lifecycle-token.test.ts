// Self-check — run directly with `node netlify/lib/lifecycle-token.test.ts`.
import assert from 'node:assert/strict'
import { epochSeconds, signLifecycleToken, verifyLifecycleToken } from './lifecycle-token.ts'

const secret = 'unit-test-secret-not-a-credential'
const now = new Date('2026-10-21T09:00:00Z')

const t = signLifecycleToken({ p: 'unsub', e: 'amina@riverbend.example', c: 'checkins', i: 'lce_1' }, secret)
assert.deepEqual(verifyLifecycleToken(t, 'unsub', secret, now), { p: 'unsub', e: 'amina@riverbend.example', c: 'checkins', i: 'lce_1' })
// Wrong purpose, wrong secret, tampered payload or signature, junk: all rejected.
assert.equal(verifyLifecycleToken(t, 'prefs', secret, now), null, 'a token is only good for its purpose')
assert.equal(verifyLifecycleToken(t, 'unsub', 'another-secret', now), null)
assert.equal(verifyLifecycleToken(t, 'unsub', '', now), null, 'no secret configured: nothing verifies')
const [body, sig] = t.split('.')
const forged = Buffer.from(JSON.stringify({ p: 'unsub', e: 'someone-else@x.example', c: 'checkins' })).toString('base64url')
assert.equal(verifyLifecycleToken(`${forged}.${sig}`, 'unsub', secret, now), null, 'payload swapped')
assert.equal(verifyLifecycleToken(`${body}.${sig.slice(0, -2)}AA`, 'unsub', secret, now), null, 'signature altered')
for (const junk of [null, undefined, '', 'a', 'a.b', 'a.b.c', `${t}.x`, 'x'.repeat(3000)]) assert.equal(verifyLifecycleToken(junk as string, 'unsub', secret, now), null)

// Expiry: a survey link works for 60 days from the send, not a second longer.
const sent = new Date('2026-08-01T09:00:00Z')
const survey = signLifecycleToken({ p: 'survey', e: 'a@x.example', o: 'feedback_1m', n: epochSeconds(sent), x: epochSeconds(sent) + 60 * 86_400 }, secret)
assert.ok(verifyLifecycleToken(survey, 'survey', secret, new Date('2026-09-29T08:59:59Z')))
assert.equal(verifyLifecycleToken(survey, 'survey', secret, new Date('2026-09-30T09:00:00Z')), null)
assert.equal(verifyLifecycleToken(survey, 'survey', secret, new Date('2027-01-01T00:00:00Z')), null)
// Tokens without an expiry (unsubscribe, preferences) keep working.
assert.ok(verifyLifecycleToken(t, 'unsub', secret, new Date('2040-01-01T00:00:00Z')))
console.log('lifecycle-token.test.ts ok')
