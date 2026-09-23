import type { Config } from '@netlify/functions'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { accessGrants } from '../../db/schema.js'
import { resolveCaller, canAccessOrg, forbidden, unauthorized } from '../lib/auth.js'
import { logger } from '../lib/logger.js'

// /api/access-grants — the cross-tenant access model. An institution grants a
// firm/reviewer scoped, revocable access to its results. Isolation is preserved:
// a reviewer reads a client's rows only while an `active` grant exists, and the
// client can revoke at any time (a status flip). Sovereignty stays with the
// client.
export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()

    if (req.method === 'GET') {
      const params = new URL(req.url).searchParams
      const grantee = params.get('grantee')
      const orgId = params.get('orgId')
      let rows
      if (grantee) {
        const target = grantee.trim().toLowerCase()
        // A caller may see grants made TO them; seeing another grantee's grants
        // is an org-access or super-admin operation.
        if (target !== caller.email && caller.role !== 'super_admin') return forbidden()
        rows = await db.select().from(accessGrants).where(eq(accessGrants.grantee, target))
      } else if (orgId) {
        if (!(await canAccessOrg(caller, orgId))) return forbidden()
        rows = await db.select().from(accessGrants).where(eq(accessGrants.orgId, orgId))
      } else {
        if (caller.role !== 'super_admin') return forbidden()
        rows = await db.select().from(accessGrants)
      }
      return Response.json(
        rows.map((g) => ({
          id: g.id,
          orgId: g.orgId,
          grantee: g.grantee,
          grantedBy: g.grantedBy ?? undefined,
          firmId: g.firmId ?? undefined,
          level: g.level,
          status: g.status,
          portfolioId: g.portfolioId ?? undefined,
        })),
      )
    }

    // POST — create or update a grant.
    // body: { orgId, grantee, grantedBy?, firmId?, level?, status?, portfolioId? }
    if (req.method === 'POST') {
      const body = await req.json()
      const orgId = String(body.orgId ?? '').trim()
      const grantee = String(body.grantee ?? '').trim().toLowerCase()
      if (!orgId || !grantee) return Response.json({ error: 'orgId and grantee required' }, { status: 400 })
      if (!(await canAccessOrg(caller, orgId))) return forbidden()
      const id: string = String(body.id ?? '').trim() || `grant_${crypto.randomUUID()}`
      const status = String(body.status ?? 'pending')
      const [row] = await db
        .insert(accessGrants)
        .values({
          id,
          orgId,
          grantee,
          grantedBy: caller.email,
          firmId: body.firmId ?? null,
          level: body.level ?? 'read',
          status,
          portfolioId: body.portfolioId ?? null,
          respondedAt: status === 'active' || status === 'revoked' ? new Date() : null,
        })
        .onConflictDoUpdate({
          target: [accessGrants.orgId, accessGrants.grantee],
          set: {
            status,
            level: body.level ?? 'read',
            portfolioId: body.portfolioId ?? null,
            respondedAt: new Date(),
          },
        })
        .returning()
      return Response.json(row, { status: 201 })
    }

    // PATCH — flip a grant's status (accept / revoke).
    // body: { orgId, grantee, status }
    if (req.method === 'PATCH') {
      const body = await req.json()
      const orgId = String(body.orgId ?? '').trim()
      const grantee = String(body.grantee ?? '').trim().toLowerCase()
      const status = String(body.status ?? '')
      if (!orgId || !grantee || !status) {
        return Response.json({ error: 'orgId, grantee and status required' }, { status: 400 })
      }
      // Either side of the grant may flip its status: the org revoking, or the
      // grantee accepting/declining.
      if (!(await canAccessOrg(caller, orgId)) && grantee !== caller.email) return forbidden()
      const [row] = await db
        .update(accessGrants)
        .set({ status, respondedAt: new Date() })
        .where(and(eq(accessGrants.orgId, orgId), eq(accessGrants.grantee, grantee)))
        .returning()
      return Response.json(row ?? null)
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error("/api/access-grants", "failed", err)
    return Response.json({ error: 'Access grant request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/access-grants',
}
