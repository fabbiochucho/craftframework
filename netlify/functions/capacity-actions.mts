import type { Config } from '@netlify/functions'
import { desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { capacityActions } from '../../db/schema.js'
import { canAccessOrg, resolveCaller, forbidden, unauthorized } from '../lib/auth.js'
import { logger } from '../lib/logger.js'

// /api/capacity-actions — the Capacity Improvement Plan (CIP). Tracks the status
// of remediation actions per organization. Replaces the in-memory
// `cipStatuses: Record<riskId, RiskStatus>` map. Every request is scoped to the
// verified caller's accessible tenants.
export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()

    if (req.method === 'GET') {
      const orgId = new URL(req.url).searchParams.get('orgId')
      if (!orgId) return Response.json({ error: 'orgId required' }, { status: 400 })
      if (!(await canAccessOrg(caller, orgId))) return forbidden()
      const rows = await db
        .select()
        .from(capacityActions)
        .where(eq(capacityActions.orgId, orgId))
        .orderBy(desc(capacityActions.id))
      const statuses: Record<string, string> = {}
      for (const r of rows) statuses[r.riskId] = r.status
      return Response.json({ orgId, rows, statuses })
    }

    // PUT — upsert an action's status.
    // body: { orgId, riskId, status, domain?, gapDescription?, capacityAction?, owner?, dueDate? }
    if (req.method === 'PUT') {
      const body = await req.json()
      const { orgId, riskId, status } = body
      if (!orgId || !riskId || !status) {
        return Response.json({ error: 'orgId, riskId and status required' }, { status: 400 })
      }
      if (!(await canAccessOrg(caller, orgId))) return forbidden()
      await db
        .insert(capacityActions)
        .values({
          orgId,
          riskId,
          status,
          domain: body.domain ?? null,
          questionId: body.questionId ?? null,
          gapDescription: body.gapDescription ?? null,
          capacityAction: body.capacityAction ?? null,
          owner: body.owner ?? null,
          dueDate: body.dueDate ?? null,
          evidenceLink: body.evidenceLink ?? null,
        })
        .onConflictDoUpdate({
          target: [capacityActions.orgId, capacityActions.riskId],
          set: { status },
        })
      return Response.json({ ok: true })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error("/api/capacity-actions", "failed", err)
    return Response.json({ error: 'Capacity action request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/capacity-actions',
}
