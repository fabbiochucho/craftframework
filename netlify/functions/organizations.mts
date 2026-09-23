import type { Config } from '@netlify/functions'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  organizations, responses, capacityActions, complianceItems, auditLogs,
  accessGrants, users,
} from '../../db/schema.js'
import { canAccessOrg, resolveCaller, forbidden, unauthorized } from '../lib/auth.js'
import { logger } from '../lib/logger.js'

const orgFieldsSchema = z.object({
  id: z.string().trim().max(200).optional(),
  name: z.string().trim().max(300).optional(),
  country: z.string().trim().max(100).optional(),
  targetDonor: z.string().trim().max(300).optional(),
  email: z.string().trim().email().max(320).or(z.literal('')).optional(),
  reviewer: z.string().trim().email().max(320).or(z.literal('')).nullable().optional(),
  archetype: z.string().max(200).nullable().optional(),
  sector: z.string().max(200).nullable().optional(),
  subsector: z.string().max(200).nullable().optional(),
})

// /api/organizations — institutions (tenants) a reviewer/admin administers. The
// caller is resolved from the verified Identity session; the `createdBy` used to
// scope lists and stamp new rows comes from that session, never the client, and
// every mutation of an existing institution is gated by tenant access.
export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()

    if (req.method === 'GET') {
      // Non-admins may only ever list their own administered institutions, so the
      // scope is forced to the verified caller regardless of any supplied param.
      // Only the platform Super Admin may inspect another creator's institutions.
      const createdBy = caller.role === 'super_admin' ? new URL(req.url).searchParams.get('createdBy') : caller.email
      const rows = createdBy
        ? await db
            .select()
            .from(organizations)
            .where(eq(organizations.createdBy, createdBy))
            .orderBy(desc(organizations.createdAt))
        : await db.select().from(organizations).orderBy(desc(organizations.createdAt))
      return Response.json(rows)
    }

    if (req.method === 'POST') {
      const parsed = orgFieldsSchema.safeParse(await req.json())
      if (!parsed.success) return Response.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })
      const body = parsed.data
      const id: string = body.id || `org_${crypto.randomUUID()}`
      // Updating an existing institution requires access to it; creating a new one
      // is open to any signed-in caller but is always stamped to them.
      const [existing] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, id)).limit(1)
      if (existing && !(await canAccessOrg(caller, id))) return forbidden()
      const [row] = await db
        .insert(organizations)
        .values({
          id,
          name: String(body.name ?? '').trim(),
          country: String(body.country ?? '').trim(),
          targetDonor: String(body.targetDonor ?? '').trim(),
          email: String(body.email ?? '').trim(),
          reviewer: body.reviewer ?? null,
          createdBy: caller.email,
          archetype: body.archetype ?? null,
          sector: body.sector ?? null,
          subsector: body.subsector ?? null,
        })
        .onConflictDoUpdate({
          target: organizations.id,
          set: { name: String(body.name ?? '').trim(), lastUpdated: new Date() },
        })
        .returning()
      return Response.json(row, { status: 201 })
    }

    // PUT — edit an existing institution's profile fields. Only the keys present
    // in the body are written, so a partial edit never blanks other columns.
    if (req.method === 'PUT') {
      const parsed = orgFieldsSchema.safeParse(await req.json())
      if (!parsed.success) return Response.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })
      const body = parsed.data
      const id: string = body.id ?? ''
      if (!id) return Response.json({ error: 'id required' }, { status: 400 })
      if (!(await canAccessOrg(caller, id))) return forbidden()
      const has = (k: keyof typeof body) => body[k] !== undefined && body[k] !== null
      const set: Record<string, unknown> = { lastUpdated: new Date() }
      if (has('name')) set.name = String(body.name).trim()
      if (has('country')) set.country = String(body.country).trim()
      if (has('targetDonor')) set.targetDonor = String(body.targetDonor).trim()
      if (has('email')) set.email = String(body.email).trim()
      if (has('reviewer')) set.reviewer = body.reviewer
      if (has('archetype')) set.archetype = body.archetype
      if (has('sector')) set.sector = body.sector
      if (has('subsector')) set.subsector = body.subsector
      const [row] = await db
        .update(organizations)
        .set(set)
        .where(eq(organizations.id, id))
        .returning()
      return Response.json(row ?? null)
    }

    // PATCH — soft-archive or restore an institution (status only). Keeps the
    // record and all its data; it is simply hidden from the working surfaces.
    if (req.method === 'PATCH') {
      const body = await req.json()
      const id: string = String(body.id ?? '').trim()
      const status: string = String(body.status ?? '').trim()
      if (!id || (status !== 'active' && status !== 'archived')) {
        return Response.json({ error: 'id and status (active|archived) required' }, { status: 400 })
      }
      if (!(await canAccessOrg(caller, id))) return forbidden()
      const [row] = await db
        .update(organizations)
        .set({ status, lastUpdated: new Date() })
        .where(eq(organizations.id, id))
        .returning()
      return Response.json(row ?? null)
    }

    // DELETE — permanently remove an institution and CASCADE across every record
    // scoped to it. The join table (portfolio_orgs) and assessments cascade at
    // the database level via foreign keys; the remaining org-scoped tables carry
    // a plain text org_id (no FK), so they are cleaned up explicitly here. This
    // is the hard-delete the Super Admin / Portfolio Reviewer triggers, applying
    // uniformly across all user types' data for that institution.
    if (req.method === 'DELETE') {
      const id = new URL(req.url).searchParams.get('id')
      if (!id) return Response.json({ error: 'id required' }, { status: 400 })
      if (!(await canAccessOrg(caller, id))) return forbidden()
      await db.delete(responses).where(eq(responses.orgId, id))
      await db.delete(capacityActions).where(eq(capacityActions.orgId, id))
      await db.delete(complianceItems).where(eq(complianceItems.orgId, id))
      await db.delete(auditLogs).where(eq(auditLogs.orgId, id))
      await db.delete(accessGrants).where(eq(accessGrants.orgId, id))
      await db.delete(users).where(eq(users.orgId, id))
      await db.delete(organizations).where(eq(organizations.id, id))
      return Response.json({ ok: true })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error("/api/organizations", "failed", err)
    return Response.json({ error: 'Organization request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/organizations',
}
