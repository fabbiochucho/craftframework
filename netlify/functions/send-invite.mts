import type { Config } from '@netlify/functions'
import { createHash } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { auditLogs, invitations, rateLimits } from '../../db/schema.js'
import { resolveCaller, unauthorized, forbidden, mfaRequired, isSuperAdmin } from '../lib/auth.js'
import { logger } from '../lib/logger.js'
import { buildWelcomeEmailHtml } from '../../src/lib/inviteEmail.js'
import type { ViewLevel } from '../../src/lib/data.js'

// /api/send-invite — dispatch the branded welcome email for an invitation.
//
// The request names ONLY an invitation ({ invitationId }). The recipient is
// always the stored invitation email, and subject + HTML are rendered here from
// the stored record, so this endpoint cannot be used to send arbitrary content
// to arbitrary addresses through the workspace's Resend account. The caller
// must be the invitation's inviter (or the super admin), the invitation must
// still be pending and unexpired, and sends are capped per caller and per
// invitation.
//
// RESEND_API_KEY and INVITE_FROM_EMAIL come from Netlify environment variables.
// When either is missing the function degrades gracefully: the invitation and
// access-grant records already exist, only the transactional send is skipped.

export const SEND_LIMIT_PER_HOUR = 20
export const SEND_LIMIT_PER_INVITATION = 3
const HOUR_MS = 3_600_000
// The per-invitation cap outlives any invitation (they expire well within this).
const CAP_TTL_MS = 90 * 24 * HOUR_MS

const json = (body: unknown, status = 200, headers?: Record<string, string>) => Response.json(body, { status, headers })

// Fixed one-hour window on the shared rate_limits table. True = over the limit.
async function overHourlyLimit(email: string, now = Date.now()): Promise<boolean> {
  const windowStart = new Date(Math.floor(now / HOUR_MS) * HOUR_MS)
  const key = createHash('sha256').update(`send-invite:${email}`).digest('hex')
  const [row] = await db.insert(rateLimits).values({ key, windowStart, count: 1, expiresAt: new Date(windowStart.getTime() + HOUR_MS) })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count })
  return row.count > SEND_LIMIT_PER_HOUR
}

async function audit(actor: string, invitationId: string, outcome: string) {
  try {
    await db.insert(auditLogs).values({ actor, action: 'Invite email send', target: `${invitationId} · ${outcome}`, category: 'Auth' })
  } catch (err) {
    logger.error('/api/send-invite', 'audit failed', err)
  }
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock

    // Strict body: exactly { invitationId: string }. Client-supplied to/subject/
    // html (or anything else) is rejected, never honoured.
    let body: unknown
    try { body = await req.json() } catch { body = null }
    const keys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : []
    const invitationId = keys.length === 1 && keys[0] === 'invitationId' ? (body as Record<string, unknown>).invitationId : undefined
    if (typeof invitationId !== 'string' || !invitationId || invitationId.length > 100) {
      return json({ error: 'Body must be exactly { invitationId }' }, 400)
    }

    const [inv] = await db.select().from(invitations).where(eq(invitations.id, invitationId))
    // Same answer for "missing" and "not yours" so ids can't be probed.
    if (!inv || ((inv.inviter ?? '').trim().toLowerCase() !== caller.email && !isSuperAdmin(caller.email))) {
      if (inv) await audit(caller.email, inv.id, 'forbidden')
      return forbidden()
    }
    if (inv.status !== 'pending') {
      await audit(caller.email, inv.id, `refused_${inv.status}`)
      return json({ error: `Invitation is ${inv.status}` }, 409)
    }
    if (!inv.expiresAt || new Date(inv.expiresAt).getTime() < Date.now()) {
      await audit(caller.email, inv.id, 'refused_expired')
      return json({ error: 'Invitation has expired' }, 409)
    }

    if (await overHourlyLimit(caller.email)) {
      await audit(caller.email, inv.id, 'rate_limited')
      return json({ error: `Too many invitation emails. Limit is ${SEND_LIMIT_PER_HOUR} per hour; try again later.` }, 429, { 'retry-after': '3600' })
    }

    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.INVITE_FROM_EMAIL
    // Never substitute Resend's development-only sender (same rule as reminder-email.ts).
    if (!apiKey || !from || /@resend\.dev\b/i.test(from)) {
      await audit(caller.email, inv.id, 'not_configured')
      return json({ dispatched: false, reason: 'no_mail_provider_configured' })
    }

    // Reserve a send slot atomically; the cap holds under concurrent requests.
    // send_count lives in the rate_limits table keyed by invitation (no schema change).
    const capKey = createHash('sha256').update(`send-invite-inv:${inv.id}`).digest('hex')
    const [slot] = await db.insert(rateLimits).values({ key: capKey, windowStart: new Date(0), count: 1, expiresAt: new Date(Date.now() + CAP_TTL_MS) })
      .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
      .returning({ count: rateLimits.count })
    if (slot.count > SEND_LIMIT_PER_INVITATION) {
      await audit(caller.email, inv.id, 'invitation_cap')
      return json({ error: `This invitation has already been sent ${SEND_LIMIT_PER_INVITATION} times.` }, 429)
    }

    const { subject, html } = buildWelcomeEmailHtml({
      name: inv.inviteeName ?? '',
      email: inv.email,
      role: inv.role as ViewLevel,
      scopeLabel: inv.scopeLabel,
      inviterName: inv.inviterName || inv.inviter || 'A CRAFT administrator',
      inviterEmail: inv.inviter ?? '',
      message: inv.message ?? undefined,
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        // Dedupes a retried first send; later (re)sends are distinct emails.
        ...(slot.count === 1 ? { 'Idempotency-Key': `invite-${inv.id}` } : {}),
      },
      body: JSON.stringify({ from, to: inv.email, subject, html }),
    })
    if (!res.ok) {
      // Non-sensitive status only; never echo the provider body or key.
      logger.error('/api/send-invite', 'provider error', undefined, { status: res.status })
      await audit(caller.email, inv.id, `provider_error_${res.status}`)
      return json({ dispatched: false, reason: 'provider_error' }, 502)
    }
    await audit(caller.email, inv.id, 'sent')
    return json({ dispatched: true })
  } catch (err) {
    logger.error('/api/send-invite', 'failed', err)
    return json({ error: 'Send failed' }, 500)
  }
}

export const config: Config = {
  path: '/api/send-invite',
}
