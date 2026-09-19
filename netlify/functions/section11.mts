import type { Config } from '@netlify/functions'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { section11Disclosures } from '../../db/schema.js'

// /api/section11 — persisted verification state for the Section 11 Vault
// (Integrated Reporting & Statutory Disclosures). Replaces the previous demo-only
// seed: sub-folder statuses now survive reloads, per organization.
//
//   GET  /api/section11?orgId=...            → [{ folderKey, status, updatedAt }]
//   PUT  /api/section11  { orgId, folderKey, status, updatedBy? }  → upsert one
export default async (req: Request) => {
  try {
    if (req.method === 'GET') {
      const orgId = new URL(req.url).searchParams.get('orgId')
      if (!orgId) return Response.json({ error: 'orgId required' }, { status: 400 })
      const rows = await db
        .select()
        .from(section11Disclosures)
        .where(eq(section11Disclosures.orgId, orgId))
      return Response.json(
        rows.map((r) => ({
          folderKey: r.folderKey,
          status: r.status,
          updatedBy: r.updatedBy ?? undefined,
          updatedAt: r.updatedAt,
        })),
      )
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await req.json()
      const orgId = String(body.orgId ?? '').trim()
      const folderKey = String(body.folderKey ?? '').trim()
      const status = String(body.status ?? '').trim()
      if (!orgId || !folderKey || !status) {
        return Response.json({ error: 'orgId, folderKey and status required' }, { status: 400 })
      }
      const [row] = await db
        .insert(section11Disclosures)
        .values({
          id: `s11_${orgId}_${folderKey}`,
          orgId,
          folderKey,
          status,
          updatedBy: body.updatedBy ? String(body.updatedBy) : null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [section11Disclosures.orgId, section11Disclosures.folderKey],
          set: { status, updatedBy: body.updatedBy ? String(body.updatedBy) : null, updatedAt: new Date() },
        })
        .returning()
      return Response.json(row, { status: 200 })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    console.error('/api/section11 failed', err)
    return Response.json({ error: 'Section 11 request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/section11',
}
