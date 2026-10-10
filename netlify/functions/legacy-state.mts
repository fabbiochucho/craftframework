import type { Config } from '@netlify/functions'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { legacyWorkspaceState } from '../../db/legacy-schema.js'
import { resolveCaller, canAccessOrg, forbidden, unauthorized } from '../lib/auth.js'
import { encryptField, decryptField } from '../lib/crypto.js'
import { logger } from '../lib/logger.js'

const keySchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9:_-]+$/)
const bodySchema = z.object({
  orgId: z.string().min(1).max(200),
  key: keySchema,
  value: z.unknown().refine(value => value !== undefined),
})

export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    if (req.method === 'GET') {
      const params = new URL(req.url).searchParams
      const orgId = params.get('orgId')
      const key = keySchema.safeParse(params.get('key'))
      if (!orgId || !key.success) return Response.json({ error: 'Invalid scope' }, { status: 400 })
      if (!(await canAccessOrg(caller, orgId, 'read'))) return forbidden()
      const [row] = await db.select().from(legacyWorkspaceState)
        .where(and(eq(legacyWorkspaceState.orgId, orgId), eq(legacyWorkspaceState.key, key.data))).limit(1)
      return Response.json({ value: row ? JSON.parse(decryptField(row.value)) : null }, {
        headers: { 'Cache-Control': 'private, no-store' },
      })
    }
    if (req.method === 'PUT') {
      const origin = req.headers.get('origin')
      if (origin && origin !== new URL(req.url).origin) return forbidden()
      if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        return Response.json({ error: 'JSON required' }, { status: 415 })
      }
      const text = await req.text()
      if (text.length > 200_000) return Response.json({ error: 'State too large' }, { status: 413 })
      const parsed = bodySchema.safeParse(JSON.parse(text))
      if (!parsed.success) return Response.json({ error: 'Invalid state' }, { status: 400 })
      const { orgId, key, value } = parsed.data
      if (!(await canAccessOrg(caller, orgId, 'write'))) return forbidden()
      const record = { orgId, key, value: encryptField(JSON.stringify(value)), updatedAt: new Date() }
      await db.insert(legacyWorkspaceState).values(record).onConflictDoUpdate({
        target: [legacyWorkspaceState.orgId, legacyWorkspaceState.key],
        set: { value: record.value, updatedAt: record.updatedAt },
      })
      return Response.json({ ok: true })
    }
    return new Response('Method Not Allowed', { status: 405 })
  } catch (error) {
    logger.error('/api/legacy-state', 'failed', error)
    return Response.json({ error: 'State request failed' }, { status: 500 })
  }
}

export const config: Config = { path: '/api/legacy-state' }
