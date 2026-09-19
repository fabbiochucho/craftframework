import type { Config } from '@netlify/functions'
import { asc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { complianceItems } from '../../db/schema.js'
import { canAccessOrg, resolveCaller, forbidden, unauthorized } from '../lib/auth.js'

// /api/compliance — the unified Obligations & Reporting Calendar. Queried by the
// daily compliance-alerts scheduled function for 90/30/overdue warnings. Every
// request is scoped to the verified caller's accessible tenants.
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
        .from(complianceItems)
        .where(eq(complianceItems.orgId, orgId))
        .orderBy(asc(complianceItems.nextDueDate))
      return Response.json(rows)
    }

    // POST — create one or many obligations. body: an obligation, or { items: [] }
    if (req.method === 'POST') {
      const body = await req.json()
      const incoming = Array.isArray(body?.items) ? body.items : [body]
      const values = incoming
        .filter((o: any) => o && o.orgId && o.name && o.nextDueDate)
        .map((o: any) => ({
          id: o.id || `ob_${crypto.randomUUID()}`,
          orgId: o.orgId,
          name: o.name,
          stream: o.stream ?? 'reporting',
          type: o.type ?? 'donor_financial',
          donorOrAuthority: o.donorOrAuthority ?? '',
          frequency: o.frequency ?? 'annual',
          nextDueDate: o.nextDueDate,
          country: o.country ?? '',
          sector: o.sector ?? '',
          owner: o.owner ?? 'Unassigned',
          status: o.status ?? 'pending',
          notes: o.notes ?? null,
        }))
      if (!values.length) return Response.json({ error: 'No valid items' }, { status: 400 })
      // Every obligation must belong to a tenant the caller may write.
      const orgIds = [...new Set(values.map((v) => v.orgId as string))]
      for (const id of orgIds) {
        if (!(await canAccessOrg(caller, id))) return forbidden()
      }
      const rows = await db
        .insert(complianceItems)
        .values(values)
        .onConflictDoUpdate({
          target: complianceItems.id,
          set: { status: values[0].status, nextDueDate: values[0].nextDueDate },
        })
        .returning()
      return Response.json(rows, { status: 201 })
    }

    // PATCH — update an obligation. body: { id, status?, nextDueDate? }
    if (req.method === 'PATCH') {
      const { id, status, nextDueDate } = await req.json()
      if (!id) return Response.json({ error: 'id required' }, { status: 400 })
      // The body carries no orgId, so resolve the row's tenant and authorize it.
      const [existing] = await db
        .select({ orgId: complianceItems.orgId })
        .from(complianceItems)
        .where(eq(complianceItems.id, id))
        .limit(1)
      if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })
      if (!(await canAccessOrg(caller, existing.orgId))) return forbidden()
      const set: Record<string, unknown> = {}
      if (status !== undefined) set.status = status
      if (nextDueDate !== undefined) set.nextDueDate = nextDueDate
      await db.update(complianceItems).set(set).where(eq(complianceItems.id, id))
      return Response.json({ ok: true })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    console.error('/api/compliance failed', err)
    return Response.json({ error: 'Compliance request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/compliance',
}
