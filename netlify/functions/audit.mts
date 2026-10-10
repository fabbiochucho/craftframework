import type { Config } from '@netlify/functions'
import { desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { auditLogs } from '../../db/schema.js'
import { canAccessOrg, resolveCaller, forbidden, unauthorized } from '../lib/auth.js'
import { logger } from '../lib/logger.js'

function stamp(d: Date | null): string {
  const t = d ?? new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`
}

// /api/audit — append-only workspace activity log. Reads and writes are scoped to
// the verified caller: an org-scoped request must name a tenant the caller may
// access, and only the platform Super Admin can read the unscoped, cross-tenant
// global log.
export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()

    if (req.method === 'GET') {
      const orgId = new URL(req.url).searchParams.get('orgId')
      if (orgId && !(await canAccessOrg(caller, orgId, 'read'))) return forbidden()
      if (!orgId && caller.role !== 'super_admin') return forbidden()
      const rows = orgId
        ? await db.select().from(auditLogs).where(eq(auditLogs.orgId, orgId)).orderBy(desc(auditLogs.id))
        : await db.select().from(auditLogs).orderBy(desc(auditLogs.id))
      return Response.json(
        rows.map((r) => ({
          id: `A-${r.id}`,
          timestamp: stamp(r.createdAt),
          actor: r.actor,
          action: r.action,
          target: r.target,
          category: r.category,
        })),
      )
    }

    // POST — append an entry. body: { orgId?, actor, action, target, category }
    // The actor is stamped from the verified caller (never the request body), and
    // an org-scoped entry must name a tenant the caller may access.
    if (req.method === 'POST') {
      const { orgId, action, target, category } = await req.json()
      if (!action) return Response.json({ error: 'action required' }, { status: 400 })
      if (orgId && !(await canAccessOrg(caller, orgId))) return forbidden()
      const [row] = await db
        .insert(auditLogs)
        .values({
          orgId: orgId ?? null,
          actor: caller.email,
          action,
          target: target ?? '',
          category: category ?? 'Config',
        })
        .returning()
      return Response.json(
        {
          id: `A-${row.id}`,
          timestamp: stamp(row.createdAt),
          actor: row.actor,
          action: row.action,
          target: row.target,
          category: row.category,
        },
        { status: 201 },
      )
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error("/api/audit", "failed", err)
    return Response.json({ error: 'Audit request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/audit',
}
