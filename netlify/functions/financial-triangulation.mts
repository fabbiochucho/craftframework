import type { Config } from '@netlify/functions'
import { eq, and, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { financeRoles, financialTriangulations } from '../../db/schema.js'
import { resolveCaller, canAccessOrg, forbidden, unauthorized, mfaRequired } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { financeMutationError } from '../lib/finance-policy.js'
import { financeRoleOf, namedFinanceRoles, NAMED_FINANCE_ROLES } from '../lib/finance-roles.js'

function cleanNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
}

// This endpoint reconciles real financial figures — validate shape and enum
// fields explicitly rather than trusting whatever the client sends.
const postSchema = z.object({
  id: z.string().max(200).optional(),
  orgId: z.string().min(1).max(200),
  contextKey: z.string().min(1).max(200),
  donorId: z.string().max(200).optional(),
  grantId: z.string().max(200).optional(),
  reportTypeId: z.string().max(200).optional(),
  streamId: z.string().max(200).optional(),
  periodId: z.string().max(200).optional(),
  openingBalance: z.number().finite().optional(),
  incomeReceived: z.number().finite().optional(),
  expenditures: z.number().finite().optional(),
  adjustments: z.number().finite().optional(),
  actualBankBalance: z.number().finite().optional(),
  financeOfficerNotes: z.string().max(10_000).optional(),
  grantManagerCommentary: z.string().max(10_000).optional(),
  assessorNotes: z.string().max(10_000).optional(),
  verificationStatus: z.enum(['verified', 'qualified', 'rejected']).optional(),
  status: z.enum(['draft', 'pending_review', 'pending_assessor', 'locked']).optional(),
  lockedBy: z.string().max(320).nullable().optional(),
  lockedAt: z.string().nullable().optional(),
  history: z.array(z.unknown()).optional(),
})

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock

    const url = new URL(req.url)

    // GET ?roles=1&orgId=  -> { myRole, named: { org_finance_officer, org_grant_manager } }
    if (req.method === 'GET' && url.searchParams.get('roles')) {
      const orgId = url.searchParams.get('orgId') ?? ''
      const myRole = await financeRoleOf(caller, orgId)
      if (!myRole && !(await canAccessOrg(caller, orgId, 'read'))) return forbidden()
      return Response.json({ myRole, named: await namedFinanceRoles(orgId) })
    }

    // PUT { orgId, role, email } -> name (or, with email '', clear) the organisation's finance officer or grant manager.
    // Only someone who can write to the organisation; the two must be different people (one prepares, one reviews).
    if (req.method === 'PUT') {
      const b = (await req.json().catch(() => ({}))) as { orgId?: unknown; role?: unknown; email?: unknown }
      const orgId = String(b.orgId ?? '')
      const role = String(b.role ?? '')
      const email = String(b.email ?? '').trim().toLowerCase()
      if (!orgId || !(NAMED_FINANCE_ROLES as readonly string[]).includes(role)) return Response.json({ error: 'orgId and a finance role are required' }, { status: 400 })
      if (email && (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return Response.json({ error: 'Enter a valid email address' }, { status: 400 })
      if (caller.readOnly || !(await canAccessOrg(caller, orgId, 'write'))) return forbidden()
      const other = (await namedFinanceRoles(orgId))[role === 'org_finance_officer' ? 'org_grant_manager' : 'org_finance_officer']
      if (email && email === other) return Response.json({ error: 'The finance officer and the grant manager must be different people' }, { status: 400 })
      if (!email) await db.delete(financeRoles).where(and(eq(financeRoles.orgId, orgId), eq(financeRoles.role, role)))
      else await db.insert(financeRoles).values({ orgId, role, email, assignedBy: caller.email })
        .onConflictDoUpdate({ target: [financeRoles.orgId, financeRoles.role], set: { email, assignedBy: caller.email, assignedAt: new Date() } })
      return Response.json({ named: await namedFinanceRoles(orgId) })
    }

    if (req.method === 'GET') {
      const orgId = url.searchParams.get('orgId')
      const contextKey = url.searchParams.get('contextKey')
      if (!orgId || !contextKey) return Response.json({ error: 'orgId and contextKey required' }, { status: 400 })
      if (!(await financeRoleOf(caller, orgId)) && !(await canAccessOrg(caller, orgId, 'read'))) return forbidden()

      const [row] = await db
        .select()
        .from(financialTriangulations)
        .where(and(eq(financialTriangulations.orgId, orgId), eq(financialTriangulations.contextKey, contextKey)))
        .limit(1)

      return Response.json(row ?? null)
    }

    if (req.method === 'POST') {
      const parsed = postSchema.safeParse(await req.json())
      if (!parsed.success) {
        return Response.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })
      }
      const body = parsed.data
      // The workflow role decides what may change (finance-policy.ts); without one, nothing may.
      const workflowRole = await financeRoleOf(caller, body.orgId)
      if (!workflowRole || (workflowRole !== 'independent_assessor' && !(await canAccessOrg(caller, body.orgId)))) return forbidden()

      return await db.transaction(async (tx) => {
      // Serialize both first creation and transitions for this reporting context.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${body.orgId}), hashtext(${body.contextKey}))`, 'objects')
      const [existing] = await tx.select().from(financialTriangulations).where(and(
        eq(financialTriangulations.orgId, body.orgId), eq(financialTriangulations.contextKey, body.contextKey),
      )).limit(1)
      const error = financeMutationError(workflowRole, existing ?? null, body)
      if (error) return Response.json({ error }, { status: 403 })
      const value = {
        ...existing,
        id: existing?.id || `tri_${crypto.randomUUID()}`,
        orgId: body.orgId,
        contextKey: body.contextKey,
        donorId: body.donorId ?? '',
        grantId: body.grantId ?? '',
        reportTypeId: body.reportTypeId ?? '',
        streamId: body.streamId ?? '',
        periodId: body.periodId ?? '',
        openingBalance: cleanNumber(body.openingBalance),
        incomeReceived: cleanNumber(body.incomeReceived),
        expenditures: cleanNumber(body.expenditures),
        adjustments: cleanNumber(body.adjustments),
        actualBankBalance: cleanNumber(body.actualBankBalance),
        financeOfficerNotes: body.financeOfficerNotes ?? '',
        grantManagerCommentary: body.grantManagerCommentary ?? '',
        assessorNotes: body.assessorNotes ?? '',
        verificationStatus: body.verificationStatus ?? 'verified',
        status: body.status ?? 'draft',
        lockedBy: body.status === 'locked' ? caller.email : null,
        lockedAt: body.status === 'locked' ? new Date().toISOString() : null,
        history: [...(existing?.history ?? []), `${new Date().toISOString()} - ${caller.email} (${workflowRole}) saved ${body.status ?? existing?.status ?? 'draft'}`],
        updatedAt: new Date(),
      }

      // Partial role-specific requests preserve the other participants' fields.
      for (const key of Object.keys(value) as (keyof typeof value)[]) {
        if (existing && !(key in body) && !['lockedBy', 'lockedAt', 'history', 'updatedAt'].includes(key)) {
          Object.assign(value, { [key]: existing[key] })
        }
      }
      const [row] = await tx
        .insert(financialTriangulations)
        .values(value)
        .onConflictDoUpdate({
          target: [financialTriangulations.orgId, financialTriangulations.contextKey],
          set: value,
        })
        .returning()

      return Response.json(row, { status: 201 })
      })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error("/api/financial-triangulation", "failed", err)
    return Response.json({ error: 'Financial triangulation request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/financial-triangulation',
}

export default monitored(handleRequest)
