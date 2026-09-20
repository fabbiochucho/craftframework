import type { Config } from '@netlify/functions'
import { desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { invitations } from '../../db/schema.js'
import { resolveCaller, forbidden, unauthorized } from '../lib/auth.js'

// /api/invitations — short-lived, tokenised invitations. A firm invites a client
// (or a co-assessor); a row is created here and the accept link carries the
// token. Validating the token (GET ?token=) drives the accept-invitation page.
export default async (req: Request) => {
  try {
    if (req.method === 'GET') {
      const params = new URL(req.url).searchParams
      const token = params.get('token')
      const inviter = params.get('inviter')
      // A lookup by token is a capability check (the token itself is the secret,
      // needed by a not-yet-signed-in invitee following the accept link) — no
      // session required. Every other GET shape needs an authenticated caller.
      if (token) {
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
    // body: { email, inviter?, inviterName?, portfolioId?, role?, scopeLabel?, message? }
    if (req.method === 'POST') {
      const caller = await resolveCaller()
      if (!caller) return unauthorized()
      const body = await req.json()
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!email) return Response.json({ error: 'email required' }, { status: 400 })
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
          portfolioId: body.portfolioId ?? null,
          role: body.role ?? 'assessor',
          scopeLabel: String(body.scopeLabel ?? ''),
          message: body.message ?? null,
          expiresAt,
        })
        .returning()
      return Response.json(row, { status: 201 })
    }

    // PATCH — update an invitation's status (accept / revoke). body: { token, status }
    if (req.method === 'PATCH') {
      const body = await req.json()
      const token = String(body.token ?? '')
      const status = String(body.status ?? '')
      if (!token || !status) return Response.json({ error: 'token and status required' }, { status: 400 })
      const [row] = await db
        .update(invitations)
        .set({ status, respondedAt: new Date() })
        .where(eq(invitations.token, token))
        .returning()
      return Response.json(row ?? null)
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    console.error('/api/invitations failed', err)
    return Response.json({ error: 'Invitation request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/invitations',
}
