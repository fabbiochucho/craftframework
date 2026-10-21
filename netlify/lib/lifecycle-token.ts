// Signed links for the lifecycle emails: one-click unsubscribe, the email preferences page, the first-party click
// redirect, the in-app survey and the member badge. Same scheme as the onboarding opt-out token
// (src: onboarding-nudge.ts: HMAC-SHA256 with ONBOARDING_OPTOUT_SECRET, base64url, constant-time compare), with a
// JSON payload and an optional expiry. Pure: the secret and the clock are passed in.
import { createHmac, timingSafeEqual } from 'node:crypto'

export type TokenPurpose = 'unsub' | 'prefs' | 'go' | 'survey' | 'badge'
// Short keys keep links short. p = purpose, e = email, c = category, i = lifecycle email id, d = destination,
// o = survey occurrence, g = org id, n = issued-at (epoch seconds), x = expiry (epoch seconds).
export type TokenPayload = { p: TokenPurpose; e?: string; c?: string; i?: string; d?: string; o?: string; g?: string; n?: number; x?: number }

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url')
const mac = (body: string, secret: string) => createHmac('sha256', secret).update(`craft-lifecycle-v1:${body}`).digest('base64url')

export function signLifecycleToken(payload: TokenPayload, secret: string): string {
  const body = b64(JSON.stringify(payload))
  return `${body}.${mac(body, secret)}`
}

/** The payload if the token was signed with this secret, is for `purpose` and has not expired; otherwise null. */
export function verifyLifecycleToken(token: string | null | undefined, purpose: TokenPurpose, secret: string, now = new Date()): TokenPayload | null {
  if (!secret || typeof token !== 'string' || token.length > 2000) return null
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra !== undefined) return null
  const expected = Buffer.from(mac(body, secret))
  const given = Buffer.from(sig)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  let payload: TokenPayload
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) } catch { return null }
  if (!payload || typeof payload !== 'object' || payload.p !== purpose) return null
  if (payload.x !== undefined && (typeof payload.x !== 'number' || payload.x * 1000 <= now.getTime())) return null
  return payload
}

export const epochSeconds = (d: Date): number => Math.floor(d.getTime() / 1000)
