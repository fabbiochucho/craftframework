import { createHash } from 'node:crypto'
import { and, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { rateLimits } from '../../db/schema.js'
import { isRateLimitedCount, rateLimitWindowStart } from './workspace.js'

/** Postgres-backed fixed-window limiter for unauthenticated endpoints (same table as workspace-api). True = over the limit. */
export async function overLimit(key: string, limit: number, now = Date.now()): Promise<boolean> {
  const windowStart = new Date(rateLimitWindowStart(now))
  const hashed = createHash('sha256').update(key).digest('hex')
  const [row] = await db.insert(rateLimits).values({ key: hashed, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } }).returning({ count: rateLimits.count })
  if (Math.random() < 0.01) await purgeExpiredRateLimits(now)
  return isRateLimitedCount(row.count, limit)
}

/** Deletes per-minute windows older than 2 minutes and long-lived counters past their expires_at. */
export async function purgeExpiredRateLimits(now = Date.now()): Promise<void> {
  await db.delete(rateLimits).where(or(
    and(isNull(rateLimits.expiresAt), lte(rateLimits.windowStart, new Date(now - 120_000))),
    and(isNotNull(rateLimits.expiresAt), lte(rateLimits.expiresAt, new Date(now))),
  ))
}

export const clientIp = (req: Request) => req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
