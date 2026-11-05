import type { Config } from '@netlify/functions'
import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, deskReviewItems, fieldworkEntries, organizations } from '../../db/schema.js'
import { canAccessOrg, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { MASTER_COMPLIANCE_MATRIX } from '../../src/lib/dataroom.js'

// /api/desk-review — the evidence request list and fieldwork log behind the Capacity Assessment desk review.
//   GET    ?orgId=                    organisation members (read): profile, items and fieldwork
//   PUT    items/:requirementId       (write) set one document's record (rules below)
//   POST   fieldwork                  (write) record an interview, walkthrough, sample test or site visit
// Rules: "uploaded" needs where the document is; "not_available" needs a reason; "verified" and "flagged" are made by
// someone other than the person who provided the document (flagging needs a note). Fieldwork entries are append-only.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const KNOWN = new Set(MASTER_COMPLIANCE_MATRIX.map((r) => r.id))
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const itemSchema = z.object({
  orgId: z.string().min(1).max(200),
  status: z.enum(['missing', 'uploaded', 'verified', 'flagged', 'not_available']),
  evidenceRef: z.string().trim().max(500).optional(),
  approvedOn: day.nullable().optional(),
  evidenceOfUse: z.string().trim().max(1000).optional(),
  notAvailableReason: z.string().trim().max(500).optional(),
  custodian: z.string().trim().max(200).optional(),
  dueDate: day.nullable().optional(),
  assessorNote: z.string().trim().max(1000).optional(),
}).strict()
const fieldworkSchema = z.object({
  orgId: z.string().min(1).max(200),
  kind: z.enum(['interview', 'walkthrough', 'sample_test', 'site_visit']),
  heldOn: day,
  people: z.string().trim().max(500).optional(),
  requirementId: z.string().max(80).optional(),
  domainRef: z.string().max(80).optional(),
  summary: z.string().trim().min(3).max(2000),
  result: z.string().trim().max(1000).optional(),
}).strict()

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const url = new URL(req.url)
    const origin = req.headers.get('origin')
    if (req.method !== 'GET' && origin && origin !== url.origin) return json({ error: 'Forbidden' }, 403)
    const [sub, id] = url.pathname.replace(/^\/api\/desk-review\/?/, '').split('/')

    if (req.method === 'GET' && !sub) {
      const orgId = url.searchParams.get('orgId') ?? ''
      if (!(await canAccessOrg(caller, orgId, 'read'))) return json({ error: 'Forbidden' }, 403)
      const [org] = await db.select({ archetype: organizations.archetype, sector: organizations.sector, subsector: organizations.subsector, country: organizations.country })
        .from(organizations).where(eq(organizations.id, orgId))
      const items = await db.select().from(deskReviewItems).where(eq(deskReviewItems.orgId, orgId))
      const fieldwork = await db.select().from(fieldworkEntries).where(eq(fieldworkEntries.orgId, orgId)).orderBy(desc(fieldworkEntries.heldOn))
      return json({ profile: org ?? null, items, fieldwork })
    }

    if (req.method === 'PUT' && sub === 'items' && id) {
      if (!KNOWN.has(id)) return json({ error: 'Unknown document.' }, 404)
      const p = itemSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Check the dates and lengths of the fields.' }, 400)
      const d = p.data
      if (!(await canAccessOrg(caller, d.orgId, 'write'))) return json({ error: 'Forbidden' }, 403)
      const [prev] = await db.select().from(deskReviewItems).where(and(eq(deskReviewItems.orgId, d.orgId), eq(deskReviewItems.requirementId, id)))
      if (d.status === 'uploaded' && !(d.evidenceRef ?? prev?.evidenceRef)) return json({ error: 'Say where the document is: a link or where it is held.' }, 400)
      if (d.status === 'not_available' && (d.notAvailableReason ?? '').length < 3) return json({ error: 'Give the reason the document does not exist.' }, 400)
      if (d.status === 'verified' || d.status === 'flagged') {
        if (!prev || prev.status === 'missing' || prev.status === 'not_available') return json({ error: 'There is nothing to review yet.' }, 409)
        if (prev.providedBy === caller.email) return json({ error: 'Someone other than the person who provided the document must review it.' }, 403)
        if (d.status === 'flagged' && (d.assessorNote ?? '').length < 3) return json({ error: 'Say what needs correcting.' }, 400)
      }
      const reviewing = d.status === 'verified' || d.status === 'flagged'
      const values = {
        orgId: d.orgId, requirementId: id, status: d.status,
        ...(d.evidenceRef !== undefined ? { evidenceRef: d.evidenceRef } : {}),
        ...(d.approvedOn !== undefined ? { approvedOn: d.approvedOn } : {}),
        ...(d.evidenceOfUse !== undefined ? { evidenceOfUse: d.evidenceOfUse } : {}),
        ...(d.notAvailableReason !== undefined ? { notAvailableReason: d.notAvailableReason } : {}),
        ...(d.custodian !== undefined ? { custodian: d.custodian } : {}),
        ...(d.dueDate !== undefined ? { dueDate: d.dueDate } : {}),
        ...(d.assessorNote !== undefined ? { assessorNote: d.assessorNote } : {}),
        ...(d.status === 'uploaded' || d.status === 'not_available' ? { providedBy: caller.email, verifiedBy: null } : {}),
        ...(reviewing ? { verifiedBy: caller.email } : {}),
        updatedAt: new Date(),
      }
      await db.insert(deskReviewItems).values(values).onConflictDoUpdate({ target: [deskReviewItems.orgId, deskReviewItems.requirementId], set: values })
      if (d.status !== prev?.status) {
        await db.insert(auditLogs).values({ orgId: d.orgId, actor: caller.email, action: `Desk review: ${id} set to ${d.status}`, target: id, category: 'Assessment' })
      }
      return json({ ok: true })
    }

    if (req.method === 'POST' && sub === 'fieldwork') {
      const p = fieldworkSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Give the type, date and a summary of what was done.' }, 400)
      if (!(await canAccessOrg(caller, p.data.orgId, 'write'))) return json({ error: 'Forbidden' }, 403)
      if (p.data.requirementId && !KNOWN.has(p.data.requirementId)) return json({ error: 'Unknown document.' }, 400)
      const entry = { id: `fw_${randomUUID()}`, ...p.data, people: p.data.people ?? '', result: p.data.result ?? '', recordedBy: caller.email }
      await db.insert(fieldworkEntries).values(entry)
      await db.insert(auditLogs).values({ orgId: p.data.orgId, actor: caller.email, action: `Fieldwork recorded (${p.data.kind}, ${p.data.heldOn})`, target: entry.id, category: 'Assessment' })
      return json({ id: entry.id }, 201)
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    logger.error('desk-review', 'request failed', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
}

export const config: Config = { path: ['/api/desk-review', '/api/desk-review/*'] }

export default monitored(handleRequest)
