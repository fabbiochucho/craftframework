import type { Config } from '@netlify/functions'
import { and, desc, eq, gt } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { invitations } from '../../db/schema.js'
import { resolveCaller, forbidden, unauthorized, mfaRequired } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { clientIp, overLimit } from '../lib/public-rate-limit.js'

// No control characters (incl. newlines/tabs) in a name; the note may contain
// ordinary line breaks and tabs but no other control characters.
const NAME_CTRL = /[\u0000-\u001f\u007f-\u009f]/
const NOTE_CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/
export const inviteeNameSchema = z.string().trim().max(120).refine((v) => !NAME_CTRL.test(v), 'inviteeName must not contain control characters')
export const inviteMessageSchema = z.string().trim().max(1000).refine((v) => !NOTE_CTRL.test(v), 'message must not contain control characters')
const createSchema = z.object({
  inviteeName: inviteeNameSchema.nullish(),
  message: inviteMessageSchema.nullish(),
})

// /api/invitations — short-lived, tokenised invitations. A firm invites a client
// (or a co-assessor); a row is created here and the accept link carries the
// token. Validating the token (GET ?token=) drives the accept-invitation page.
// Token paths are unauthenticated (the token is the capability), so cap them per IP.
export const TOKEN_LIMIT_PER_MINUTE = 30
const tooMany = () => Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'retry-after': '60' } })

const handleRequest = async (req: Request) => {
  try {
    if (req.method === 'GET') {
      const params = new URL(req.url).searchParams
      const token = params.get('token')
      const inviter = params.get('inviter')
      // A lookup by token is a capability check (the token itself is the secret,
      // needed by a not-yet-signed-in invitee following the accept link) — no
      // session required. Every other GET shape needs an authenticated caller.
      if (token) {
        if (await overLimit(`invitation-token:${clientIp(req)}`, TOKEN_LIMIT_PER_MINUTE)) return tooMany()
        const [row] = await db.select().from(invitations).where(eq(invitations.token, token))
        if (!row) return Response.json(null)
        const expired = row.expiresAt ? new Date(row.expiresAt).getTime() < Date.now() : false
        return Response.json({
          id: row.id,
          token: row.token,
          email: row.email,
          inviter: row.inviter ?? undefined,
          inviterName: row.inviterName ?? undefined,
          portfolioId: row.portfolioId ?? undefined,
          role: row.role,
          scopeLabel: row.scopeLabel,
          message: row.message ?? undefined,
          status: expired && row.status === 'pending' ? 'expired' : row.status,
        })
      }
      const caller = await resolveCaller()
      if (!caller) return unauthorized()
      const mfaBlock = await mfaRequired(req, caller)
      if (mfaBlock) return mfaBlock
      if (inviter) {
        const target = inviter.trim().toLowerCase()
        if (target !== caller.email && caller.role !== 'super_admin') return forbidden()
      } else if (caller.role !== 'super_admin') {
        return forbidden()
      }
      const rows = inviter
        ? await db.select().from(invitations).where(eq(invitations.inviter, inviter.trim().toLowerCase())).orderBy(desc(invitations.createdAt))
        : await db.select().from(invitations).orderBy(desc(invitations.createdAt))
      return Response.json(
        rows.map((r) => ({
          id: r.id,
          email: r.email,
          inviter: r.inviter ?? undefined,
          portfolioId: r.portfolioId ?? undefined,
          role: r.role,
          scopeLabel: r.scopeLabel,
          status: r.status,
        })),
      )
    }

    // POST — create an invitation. Returns the row (incl. token) so the caller
    // can build the accept link and dispatch the welcome email.
    // body: { email, inviteeName?, portfolioId?, role?, scopeLabel?, message? }
    if (req.method === 'POST') {
      const caller = await resolveCaller()
      if (!caller) return unauthorized()
      const mfaBlock = await mfaRequired(req, caller)
      if (mfaBlock) return mfaBlock
      const body = await req.json()
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!email) return Response.json({ error: 'email required' }, { status: 400 })
      const parsed = createSchema.safeParse(body)
      if (!parsed.success) {
        return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid invitation' }, { status: 400 })
      }
      const id = `inv_${crypto.randomUUID()}`
      const token = crypto.randomUUID().replace(/-/g, '')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      const [row] = await db
        .insert(invitations)
        .values({
          id,
          token,
          email,
          inviter: caller.email,
          inviterName: caller.name,
          inviteeName: parsed.data.inviteeName || null,
          portfolioId: body.portfolioId ?? null,
          role: body.role ?? 'assessor',
          scopeLabel: String(body.scopeLabel ?? ''),
          message: parsed.data.message || null,
          expiresAt,
        })
        .returning()
      return Response.json(row, { status: 201 })
    }

    // PATCH — respond to an invitation (accept / revoke). body: { token, status }
    // Token-as-capability: only a pending, unexpired invitation holding exactly
    // this token can change, and only to accepted/revoked. Anything else (unknown
    // token, already answered, expired) gets the same 404, so nothing is probed.
    if (req.method === 'PATCH') {
      if (await overLimit(`invitation-token:${clientIp(req)}`, TOKEN_LIMIT_PER_MINUTE)) return tooMany()
      const body = await req.json()
      const token = String(body.token ?? '')
      const status = String(body.status ?? '')
      if (!token || !status) return Response.json({ error: 'token and status required' }, { status: 400 })
      if (status !== 'accepted' && status !== 'revoked') {
        return Response.json({ error: 'status must be accepted or revoked' }, { status: 400 })
      }
      const [row] = await db
        .update(invitations)
        .set({ status, respondedAt: new Date() })
        .where(and(eq(invitations.token, token), eq(invitations.status, 'pending'), gt(invitations.expiresAt, new Date())))
        .returning()
      if (!row) return Response.json({ error: 'Invitation not found or no longer pending' }, { status: 404 })
      return Response.json({ id: row.id, status: row.status })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error("/api/invitations", "failed", err)
    return Response.json({ error: 'Invitation request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/invitations',
}

export default monitored(handleRequest)
