import type { Config } from '@netlify/functions'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, organizations } from '../../db/schema.js'
import { canAccessOrg, forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { SPECIALIZED_READONLY_ROLES } from '../lib/access-policy.js'
import { latestBenchmarks, refreshBenchmarks } from '../lib/benchmarks.js'
import { logger, monitored } from '../lib/logger.js'
import { SIZE_BANDS } from '../../src/lib/benchmarks.js'

// /api/benchmarks           GET   public: the latest published aggregates (src/lib/benchmarks.ts)
// /api/benchmarks/consent   GET   an organisation's choice; PUT   the organisation itself opts in or out
// /api/benchmarks/refresh   POST  super admin: recompute now instead of waiting for the nightly run
const consentSchema = z.object({
  orgId: z.string().min(1).max(200),
  optIn: z.boolean(),
  sizeBand: z.enum(SIZE_BANDS.map((b) => b.id) as [string, ...string[]]).nullable().optional(),
}).strict()

const handleRequest = async (req: Request) => {
  try {
    const sub = new URL(req.url).pathname.replace(/^\/api\/benchmarks\/?/, '')
    if (!sub && req.method === 'GET') {
      const data = await latestBenchmarks()
      return Response.json(data ?? { computedAt: null, modules: [] }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
    }
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock

    if (sub === 'refresh' && req.method === 'POST') {
      if (!isSuperAdmin(caller.email)) return forbidden()
      const data = await refreshBenchmarks()
      return Response.json({ ok: true, computedAt: data.computedAt, modules: data.modules.length })
    }

    if (sub === 'consent' && req.method === 'GET') {
      const orgId = new URL(req.url).searchParams.get('orgId') ?? ''
      if (!(await canAccessOrg(caller, orgId, 'read'))) return forbidden()
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
      if (!org) return Response.json({ error: 'Not found' }, { status: 404 })
      return Response.json({ optedIn: !!org.benchmarkOptInAt, optedInAt: org.benchmarkOptInAt, sizeBand: org.sizeBand, canChange: ownOrg(caller, orgId) })
    }

    if (sub === 'consent' && req.method === 'PUT') {
      const p = consentSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return Response.json({ error: 'Choose whether to take part, and a size band if you give one.' }, { status: 400 })
      // Only the organisation itself decides; reviewers, funders and assessors cannot opt it in.
      if (!ownOrg(caller, p.data.orgId) || !(await canAccessOrg(caller, p.data.orgId, 'write'))) return forbidden()
      const now = new Date()
      await db.transaction(async (tx) => {
        await tx.update(organizations).set({
          benchmarkOptInAt: p.data.optIn ? now : null, benchmarkOptInBy: p.data.optIn ? caller.email : null,
          ...(p.data.sizeBand !== undefined ? { sizeBand: p.data.sizeBand } : {}),
        }).where(eq(organizations.id, p.data.orgId))
        await tx.insert(auditLogs).values({ orgId: p.data.orgId, actor: caller.email, action: p.data.optIn ? 'Joined the public CRAFT benchmarks (anonymous aggregates)' : 'Left the public CRAFT benchmarks', target: p.data.orgId, category: 'Config' })
      })
      return Response.json({ ok: true, optedIn: p.data.optIn })
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    logger.error('benchmarks', 'request failed', error)
    return Response.json({ error: 'Benchmarks are unavailable.' }, { status: 500 })
  }
}

const ownOrg = (caller: { orgId?: string | null; readOnly?: boolean; role: string }, orgId: string) =>
  caller.orgId === orgId && !caller.readOnly && !SPECIALIZED_READONLY_ROLES.has(caller.role)

export const config: Config = { path: ['/api/benchmarks', '/api/benchmarks/*'] }
export default monitored(handleRequest)
