import type { Config } from '@netlify/functions'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { accessGrants, firmMembers, portfolioOrgs, portfolios } from '../../db/schema.js'
import { type Caller, resolveCaller, forbidden, unauthorized } from '../lib/auth.js'
import { logger } from '../lib/logger.js'

// Whether the caller owns/administers this portfolio: its reviewer or creator of
// record, any member of its owning firm, or the platform Super Admin.
async function canManagePortfolio(caller: Caller, id: string): Promise<boolean> {
  if (caller.role === 'super_admin') return true
  const [p] = await db.select().from(portfolios).where(eq(portfolios.id, id)).limit(1)
  if (!p) return false
  if ((p.reviewer ?? '').toLowerCase() === caller.email) return true
  if ((p.createdBy ?? '').toLowerCase() === caller.email) return true
  if (p.firmId) {
    const [m] = await db
      .select({ email: firmMembers.email })
      .from(firmMembers)
      .where(and(eq(firmMembers.firmId, p.firmId), eq(firmMembers.email, caller.email)))
      .limit(1)
    if (m) return true
  }
  return false
}

// /api/portfolios — persistent portfolios (named groupings of institutions a
// Portfolio Reviewer or firm administers). Membership lives in portfolio_orgs.
// Replaces the previously in-memory `portfolios` state so a reviewer's book of
// clients survives reloads. The caller is resolved from the verified Identity
// session, so a reviewer only ever sees and manages their own book.
export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()

    if (req.method === 'GET') {
      // A non-admin may only read their own portfolios: the reviewer scope is
      // forced to the verified caller, never a supplied query param. The platform
      // Super Admin may pass a reviewer to inspect, or omit it for the global list.
      const reviewer =
        caller.role === 'super_admin' ? new URL(req.url).searchParams.get('reviewer') : caller.email

      // Resolve the set of portfolios visible to a reviewer: those they own
      // directly plus those owned by any firm they belong to (Phase 5).
      let rows
      if (reviewer) {
        const lower = reviewer.trim().toLowerCase()
        const firmRows = await db
          .select({ firmId: firmMembers.firmId })
          .from(firmMembers)
          .where(eq(firmMembers.email, lower))
        const firmIds = firmRows.map((r) => r.firmId)
        const owned = await db.select().from(portfolios).where(eq(portfolios.reviewer, lower))
        const viaFirm = firmIds.length
          ? await db.select().from(portfolios).where(inArray(portfolios.firmId, firmIds))
          : []
        const byId = new Map<string, (typeof owned)[number]>()
        for (const p of [...owned, ...viaFirm]) byId.set(p.id, p)
        rows = [...byId.values()]
      } else {
        rows = await db.select().from(portfolios).orderBy(desc(portfolios.createdAt))
      }

      // Attach each portfolio's org membership.
      const ids = rows.map((p) => p.id)
      const memberships = ids.length
        ? await db.select().from(portfolioOrgs).where(inArray(portfolioOrgs.portfolioId, ids))
        : []
      const orgIdsByPf: Record<string, string[]> = {}
      for (const m of memberships) (orgIdsByPf[m.portfolioId] ??= []).push(m.orgId)

      return Response.json(
        rows.map((p) => ({
          id: p.id,
          name: p.name,
          reviewer: p.reviewer ?? undefined,
          firmId: p.firmId ?? undefined,
          status: p.status ?? 'active',
          orgIds: orgIdsByPf[p.id] ?? [],
        })),
      )
    }

    // POST — upsert a portfolio and replace its membership rows.
    // body: { id?, name, reviewer?, firmId?, createdBy?, orgIds: string[] }
    if (req.method === 'POST') {
      const body = await req.json()
      const id: string = String(body.id ?? '').trim() || `pf_${crypto.randomUUID()}`
      const orgIds: string[] = Array.isArray(body.orgIds) ? body.orgIds.filter(Boolean) : []
      const name = String(body.name ?? '').trim()

      const [existing] = await db.select().from(portfolios).where(eq(portfolios.id, id)).limit(1)

      if (existing) {
        if (await canManagePortfolio(caller, id)) {
          // Owner update: rename and replace membership.
          await db
            .update(portfolios)
            .set({ name, firmId: body.firmId ?? existing.firmId, lastUpdated: new Date() })
            .where(eq(portfolios.id, id))
          await db.delete(portfolioOrgs).where(eq(portfolioOrgs.portfolioId, id))
          if (orgIds.length) {
            await db
              .insert(portfolioOrgs)
              .values(orgIds.map((orgId) => ({ portfolioId: id, orgId })))
              .onConflictDoNothing()
          }
          return Response.json({ id, name, reviewer: existing.reviewer ?? undefined, orgIds }, { status: 201 })
        }
        // Non-owner: the only permitted write is an invitee attaching THEIR OWN
        // tenant to a portfolio they hold an active grant into (the accept-invite
        // flow). Only their own tenant is added; the portfolio's name, owner and
        // existing members are left untouched, so this can't rewrite a book.
        const [grant] = await db
          .select({ id: accessGrants.id })
          .from(accessGrants)
          .where(
            and(
              eq(accessGrants.grantee, caller.email),
              eq(accessGrants.portfolioId, id),
              eq(accessGrants.status, 'active'),
            ),
          )
          .limit(1)
        if (!grant) return forbidden()
        await db.insert(portfolioOrgs).values({ portfolioId: id, orgId: caller.orgId }).onConflictDoNothing()
        return Response.json(
          { id, name: existing.name, reviewer: existing.reviewer ?? undefined, orgIds: [caller.orgId] },
          { status: 201 },
        )
      }

      // New portfolio: the caller owns what they create, so the reviewer/creator
      // of record is stamped from the verified session, never the request body.
      await db
        .insert(portfolios)
        .values({ id, name, reviewer: caller.email, firmId: body.firmId ?? null, createdBy: caller.email })
        .onConflictDoNothing()
      if (orgIds.length) {
        await db
          .insert(portfolioOrgs)
          .values(orgIds.map((orgId) => ({ portfolioId: id, orgId })))
          .onConflictDoNothing()
      }

      return Response.json({ id, name, reviewer: caller.email, orgIds }, { status: 201 })
    }

    // PATCH — rename and/or archive/restore a portfolio WITHOUT disturbing its
    // membership (unlike POST, which replaces the portfolio_orgs rows). Only the
    // keys present in the body are written.
    if (req.method === 'PATCH') {
      const body = await req.json()
      const id: string = String(body.id ?? '').trim()
      if (!id) return Response.json({ error: 'id required' }, { status: 400 })
      if (!(await canManagePortfolio(caller, id))) return forbidden()
      const set: Record<string, unknown> = { lastUpdated: new Date() }
      if (typeof body.name === 'string' && body.name.trim()) set.name = body.name.trim()
      if (body.status === 'active' || body.status === 'archived') set.status = body.status
      const [row] = await db.update(portfolios).set(set).where(eq(portfolios.id, id)).returning()
      return Response.json(row ?? null)
    }

    // DELETE — remove a portfolio. Its portfolio_orgs membership rows cascade at
    // the database level (FK ON DELETE CASCADE); the institutions themselves are
    // untouched, since they can belong to more than one portfolio.
    if (req.method === 'DELETE') {
      const id = new URL(req.url).searchParams.get('id')
      if (!id) return Response.json({ error: 'id required' }, { status: 400 })
      if (!(await canManagePortfolio(caller, id))) return forbidden()
      await db.delete(portfolios).where(eq(portfolios.id, id))
      return Response.json({ ok: true })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error("/api/portfolios", "failed", err)
    return Response.json({ error: 'Portfolio request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/portfolios',
}
