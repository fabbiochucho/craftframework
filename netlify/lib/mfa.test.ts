// Self-check — run directly with `node netlify/lib/mfa.test.ts`.
import assert from 'node:assert/strict'
import { base32Decode, base32Encode, generateRecoveryCodes, generateSecret, hashRecoveryCode, otpauthUri, signMfaSession, totp, verifyMfaSession, verifyTotp } from './mfa.ts'

// RFC 6238 appendix B test vectors (SHA-1 secret "12345678901234567890"), last 6 digits.
const rfc = base32Encode(Buffer.from('12345678901234567890'))
assert.equal(rfc, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
for (const [t, code] of [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037']] as const) {
  assert.equal(totp(rfc, Math.floor(t / 30)), code, `t=${t}`)
}
assert.deepEqual(base32Decode(base32Encode(Buffer.from([0, 1, 254, 255]))), Buffer.from([0, 1, 254, 255]))
assert.equal(base32Decode(generateSecret()).length, 20)

// Verification: drift of one step either way; replay refused; malformed codes refused.
const now = 1_790_000_000_000, step = Math.floor(now / 30_000)
assert.equal(verifyTotp(rfc, totp(rfc, step), now), step)
assert.equal(verifyTotp(rfc, totp(rfc, step - 1), now), step - 1)
assert.equal(verifyTotp(rfc, totp(rfc, step + 1), now), step + 1)
assert.equal(verifyTotp(rfc, totp(rfc, step - 2), now), null)
assert.equal(verifyTotp(rfc, totp(rfc, step), now, step), null, 'replay of the same step')
assert.equal(verifyTotp(rfc, 'abcdef', now), null)
assert.match(otpauthUri('CRAFT', 'a@b.org', rfc), /^otpauth:\/\/totp\/CRAFT%3Aa%40b\.org\?secret=GEZD.*&issuer=CRAFT/)

// Recovery codes: ten distinct, hashed independently of case and dashes.
const codes = generateRecoveryCodes()
assert.equal(new Set(codes).size, 10)
assert.match(codes[0], /^[a-z2-7]{4}-[a-z2-7]{4}$/)
assert.equal(hashRecoveryCode(codes[0].toUpperCase().replace('-', '')), hashRecoveryCode(codes[0]))

// Session cookie: bound to the user and expiry, tamper-evident.
const key = Buffer.alloc(32, 7)
const tok = signMfaSession('A@B.org', now + 1000, key)
assert.ok(verifyMfaSession(tok, 'a@b.org', now, key))
assert.ok(!verifyMfaSession(tok, 'c@b.org', now, key), 'other user')
assert.ok(!verifyMfaSession(tok, 'a@b.org', now + 2000, key), 'expired')
assert.ok(!verifyMfaSession(tok, 'a@b.org', now, Buffer.alloc(32, 8)), 'other key')
assert.ok(!verifyMfaSession(`${tok.split('.')[0]}x.${tok.split('.')[1]}`, 'a@b.org', now, key), 'tampered payload')
assert.ok(!verifyMfaSession('garbage', 'a@b.org', now, key))
console.log('mfa.test.ts: all assertions passed')
