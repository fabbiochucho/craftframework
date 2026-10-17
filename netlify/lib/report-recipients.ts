import { createHash } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { rateLimits, wsOrgMembers } from '../../db/schema.js'
import { decryptField } from './crypto.js'

// Report emails (one-off and scheduled) may only go to members of the report's
// organisation or the platform support inbox, so the report endpoints cannot be
// used to mail arbitrary third parties through CRAFT's sender address.

export const REPORT_RECIPIENTS_PER_HOUR = 30
export const REPORT_SENDS_PER_ORG_PER_HOUR = 10
const HOUR_MS = 3_600_000

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

/** Lower-cased emails of every member of the organisation (ws_org_members rows are all active). */
export async function orgMemberEmails(orgId: number): Promise<Set<string>> {
  const members = await db.select({ userId: wsOrgMembers.userId }).from(wsOrgMembers).where(eq(wsOrgMembers.orgId, orgId))
  return new Set(members.map((m) => normalizeEmail(decryptField(m.userId))))
}

/** Splits addresses into allowed (org member or the support inbox) and rejected, preserving input order and de-duplicating. */
export function partitionRecipients(emails: string[], members: Set<string>, supportEmail: string): { allowed: string[]; rejected: string[] } {
  const support = normalizeEmail(supportEmail)
  const allowed: string[] = []
  const rejected: string[] = []
  const seen = new Set<string>()
  for (const email of emails) {
    const key = normalizeEmail(email)
    if (seen.has(key)) continue
    seen.add(key)
    ;(members.has(key) || key === support ? allowed : rejected).push(email.trim())
  }
  return { allowed, rejected }
}

/** Adds `amount` to a fixed one-hour counter on rate_limits; true when that pushes it past `limit`. */
export async function overHourlyBudget(key: string, amount: number, limit: number, now = Date.now()): Promise<boolean> {
  const windowStart = new Date(Math.floor(now / HOUR_MS) * HOUR_MS)
  const hashed = createHash('sha256').update(key).digest('hex')
  const [row] = await db.insert(rateLimits).values({ key: hashed, windowStart, count: amount, expiresAt: new Date(windowStart.getTime() + HOUR_MS) })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + ${amount}` } })
    .returning({ count: rateLimits.count })
  return row.count > limit
}
