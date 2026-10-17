// Rules for 'finish setting up' nudge emails: the 7-day limit, who is never emailed, and the signed
// one-click opt-out token. Pure (the HMAC secret is passed in), so it is unit-testable without a database.
import { createHmac, timingSafeEqual } from 'node:crypto'

export const NUDGE_INTERVAL_MS = 7 * 86_400_000
// A claim that never got an outcome (the function died mid-send) stops counting after this long.
export const PENDING_STALE_MS = 10 * 60_000

export type NudgeBlock = 'completed' | 'opted_out' | 'not_started' | 'too_soon'

export type NudgeCheck = {
  started: boolean
  completed: boolean
  optedOut: boolean
  /** Sent-at of the latest nudge that was accepted (or is still being sent), if any. */
  lastNudgeAt: Date | null
  now: Date
}

// Why this person must not be emailed right now, or null when they may be. Order matters: a person who
// finished or opted out is never emailed, whatever else is true.
export function nudgeBlock(c: NudgeCheck): NudgeBlock | null {
  if (c.completed) return 'completed'
  if (c.optedOut) return 'opted_out'
  if (!c.started) return 'not_started'
  if (c.lastNudgeAt && c.now.getTime() - c.lastNudgeAt.getTime() < NUDGE_INTERVAL_MS) return 'too_soon'
  return null
}

export function nextNudgeAllowedAt(lastNudgeAt: Date): Date {
  return new Date(lastNudgeAt.getTime() + NUDGE_INTERVAL_MS)
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url')
const mac = (email: string, secret: string) => createHmac('sha256', secret).update(`craft-onboarding-optout-v1:${email}`).digest('base64url')

// token = base64url(email) "." HMAC-SHA256(email). No expiry: a person can always stop the reminders.
export function signOptOutToken(email: string, secret: string): string {
  const e = email.trim().toLowerCase()
  return `${b64(e)}.${mac(e, secret)}`
}

// The email the token was signed for, or null if it is malformed or was not signed with this secret.
export function verifyOptOutToken(token: string | null | undefined, secret: string): string | null {
  if (!secret || typeof token !== 'string' || token.length > 1000) return null
  const [payload, sig, extra] = token.split('.')
  if (!payload || !sig || extra !== undefined) return null
  let email: string
  try { email = Buffer.from(payload, 'base64url').toString('utf8') } catch { return null }
  if (!email || email !== email.trim().toLowerCase()) return null
  const expected = Buffer.from(mac(email, secret))
  const given = Buffer.from(sig)
  return given.length === expected.length && timingSafeEqual(given, expected) ? email : null
}

export const optOutSecret = (): string => process.env.ONBOARDING_OPTOUT_SECRET ?? ''

// Absolute site URL used in emails. APP_URL is the documented setting; Netlify's URL is the fallback.
export const appUrl = (): string => (process.env.APP_URL || process.env.URL || '').replace(/\/+$/, '')
