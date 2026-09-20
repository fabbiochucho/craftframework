import type { Config } from '@netlify/functions'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { financialTriangulations } from '../../db/schema.js'
import { resolveCaller, canAccessOrg, forbidden, unauthorized } from '../lib/auth.js'

function cleanNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
}

export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()

    const url = new URL(req.url)

    if (req.method === 'GET') {
      const orgId = url.searchParams.get('orgId')
      const contextKey = url.searchParams.get('contextKey')
      if (!orgId || !contextKey) return Response.json({ error: 'orgId and contextKey required' }, { status: 400 })
      if (!(await canAccessOrg(caller, orgId))) return forbidden()

      const [row] = await db
        .select()
        .from(financialTriangulations)
        .where(and(eq(financialTriangulations.orgId, orgId), eq(financialTriangulations.contextKey, contextKey)))
        .limit(1)

      return Response.json(row ?? null)
    }

    if (req.method === 'POST') {
      const body = await req.json()
      if (!body?.orgId || !body?.contextKey) {
        return Response.json({ error: 'orgId and contextKey required' }, { status: 400 })
      }
      if (!(await canAccessOrg(caller, String(body.orgId)))) return forbidden()

      const value = {
        id: body.id || `tri_${crypto.randomUUID()}`,
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
        lockedBy: body.lockedBy ?? null,
        lockedAt: body.lockedAt ?? null,
        history: Array.isArray(body.history) ? body.history : [],
        updatedAt: new Date(),
      }

      const [row] = await db
        .insert(financialTriangulations)
        .values(value)
        .onConflictDoUpdate({
          target: [financialTriangulations.orgId, financialTriangulations.contextKey],
          set: value,
        })
        .returning()

      return Response.json(row, { status: 201 })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    console.error('/api/financial-triangulation failed', err)
    return Response.json({ error: 'Financial triangulation request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/financial-triangulation',
}
