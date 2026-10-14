// Multi-factor sign-in: TOTP (RFC 6238, SHA-1, 30-second steps, 6 digits — what authenticator
// apps expect), one-time recovery codes, and the signed MFA session cookie that proves a code was
// entered. Self-check: `node netlify/lib/mfa.test.ts`.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = ''
  for (const b of buf) {
    value = (value << 8) | b; bits += 8
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}
export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, '')
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of clean) {
    const i = B32.indexOf(ch)
    if (i < 0) throw new Error('invalid base32')
    value = (value << 5) | i; bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}

export const generateSecret = () => base32Encode(randomBytes(20))
export const STEP_SECONDS = 30

export function totp(secret: string, step: number, digits = 6): string {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(step))
  const h = createHmac('sha1', base32Decode(secret)).update(msg).digest()
  const o = h[h.length - 1] & 0xf
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 10 ** digits).padStart(digits, '0')
}

/** The time step a code matches (allowing one step of clock drift either way), or null.
 * Codes at or before `lastStep` are refused so a code cannot be replayed. */
export function verifyTotp(secret: string, code: string, nowMs: number, lastStep = -1): number | null {
  const c = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(c)) return null
  const cur = Math.floor(nowMs / 1000 / STEP_SECONDS)
  for (const s of [cur, cur - 1, cur + 1]) {
    if (s <= lastStep) continue
    const expected = Buffer.from(totp(secret, s)), given = Buffer.from(c)
    if (timingSafeEqual(expected, given)) return s
  }
  return null
}

export const otpauthUri = (issuer: string, account: string, secret: string) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`

// Recovery codes: ten single-use codes shown once; only their hashes are stored.
export function generateRecoveryCodes(n = 10): string[] {
  return Array.from({ length: n }, () => { const s = base32Encode(randomBytes(5)).slice(0, 8).toLowerCase(); return `${s.slice(0, 4)}-${s.slice(4)}` })
}
export const hashRecoveryCode = (code: string) => createHash('sha256').update(`craft-mfa-recovery:${code.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}`).digest('hex')

// Stable lookup key for a user's MFA record (not keyed, so it survives encryption-key rotation).
export const mfaUserKey = (email: string) => createHash('sha256').update(`craft-mfa:${email.trim().toLowerCase()}`).digest('hex')

// --- MFA session cookie --------------------------------------------------------------------------
export const MFA_COOKIE = 'craft_mfa'
export const MFA_SESSION_HOURS = 12
const b64u = (s: string | Buffer) => Buffer.from(s).toString('base64url')

export function signMfaSession(email: string, expiresAtMs: number, key: Buffer): string {
  const payload = b64u(`${email.trim().toLowerCase()}|${expiresAtMs}`)
  return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`
}
export function verifyMfaSession(token: string | undefined | null, email: string, nowMs: number, key: Buffer): boolean {
  if (!token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const expected = createHmac('sha256', key).update(payload).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false
  const [who, exp] = Buffer.from(payload, 'base64url').toString().split('|')
  return who === email.trim().toLowerCase() && Number(exp) > nowMs
}

let devKey: Buffer | null = null
/** Signing key: MFA_SESSION_SECRET, else derived from FIELD_ENCRYPTION_KEY; random per process only outside production. */
export function mfaSessionKey(): Buffer {
  if (process.env.MFA_SESSION_SECRET) return createHash('sha256').update(process.env.MFA_SESSION_SECRET).digest()
  if (process.env.FIELD_ENCRYPTION_KEY) return createHmac('sha256', process.env.FIELD_ENCRYPTION_KEY).update('craft-mfa-session').digest()
  if (process.env.NODE_ENV === 'production') throw new Error('MFA_SESSION_SECRET or FIELD_ENCRYPTION_KEY is required in production')
  return (devKey ??= randomBytes(32))
}

export function readCookie(header: string | null, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}
export const mfaCookieHeader = (token: string, maxAgeSec: number) =>
  `${MFA_COOKIE}=${encodeURIComponent(token)}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`
