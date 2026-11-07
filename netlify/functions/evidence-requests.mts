import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  evidenceRegistry, evidenceRequestItems, evidenceRequests, organizations, validationEngagements,
  type EvidenceRequestRow, type ValidationEngagementRow,
} from '../../db/schema.js'
import { canAccessOrg, forbidden, mfaRequired, resolveCaller, unauthorized, type Caller } from '../lib/auth.js'
import { evidenceOptions, evidenceSha256 } from '../lib/evidence-options.js'
import { decodeEvidence } from '../lib/evidence-storage.js'
import {
  audit, MAX_REQUESTS_PER_ENGAGEMENT, OPEN_STATUSES, sideOf, tellOrganisation, tellRequester,
} from '../lib/evidence-requests.js'
import { HttpError, requireOrgAccess } from '../lib/orgAccess.js'
import { logger, monitored } from '../lib/logger.js'

// /api/evidence-requests — the reviewing side of an ACTIVE engagement (validator team or funder) asks
// the organisation for evidence; the organisation links evidence-registry items and submits; the reviewer
// accepts or asks for more. Every step is audit-logged and emailed; overdue requests are reminded daily
// (netlify/lib/evidence-requests.ts, run by validation-reminders).
//
//   GET    ?engagementId=                    the engagement's requests (either side) + which side the caller is on
//   GET    ?mine=1                           requests waiting on my organisation, and submissions waiting on my review
//   GET    /options?engagementId=            organisation side: registry items it may link
//   POST   /                                 reviewer: { engagementId, title, indicatorId?, dueOn, note? }
//   POST   /:id/items                        organisation: { evidenceId } link a registry item
//   DELETE /:id/items/:evidenceId            organisation: remove it (before submitting)
//   POST   /:id/submit                       organisation: { note? } (needs at least one item)
//   POST   /:id/review                       reviewer: { decision: 'accept' | 'more', note? } (a note is required for 'more')
//   POST   /:id/cancel                       reviewer: withdraw an open request
//   GET    /:id/items/:evidenceId/download   reviewer: the submitted file (audit-logged)
//
// The reviewer can open ONLY files the organisation linked to one of its requests, only while the
// engagement is active. No other evidence is exposed.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string) => json({ error }, 400)
const notFound = () => json({ error: 'Not found' }, 404)
const conflict = (error: string) => json({ error }, 409)
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/
const text = (max: number) => z.string().trim().max(max).refine((v) => !CTRL.test(v), 'Remove control characters')
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a due date')
const createSchema = z.object({
  engagementId: z.string().min(1).max(200),
  title: text(200).pipe(z.string().min(3, 'Say what evidence you need')),
  indicatorId: text(80).optional(),
  dueOn: day,
  note: text(2000).optional(),
})
const itemSchema = z.object({ evidenceId: z.number().int().positive() })
const submitSchema = z.object({ note: text(2000).optional() })
const reviewSchema = z.object({ decision: z.enum(['accept', 'more']), note: text(2000).optional() })
const cancelSchema = z.object({ reason: text(1000).optional() })

const today = () => new Date().toISOString().slice(0, 10)

async function loadEngagement(id: string): Promise<ValidationEngagementRow | null> {
  const [e] = await db.select().from(validationEngagements).where(eq(validationEngagements.id, id))
  return e ?? null
}

async function view(rows: EvidenceRequestRow[]) {
  if (!rows.length) return []
  const items = await db.select().from(evidenceRequestItems).where(inArray(evidenceRequestItems.requestId, rows.map((r) => r.id)))
  const now = today()
  return rows.map((r) => ({
    id: r.id, engagementId: r.engagementId, title: r.title, indicatorId: r.indicatorId, note: r.note, dueOn: r.dueOn, status: r.status,
    overdue: (OPEN_STATUSES as readonly string[]).includes(r.status) && r.dueOn < now,
    requestedBy: r.requestedBy, createdAt: r.createdAt,
    submittedBy: r.submittedBy, submittedAt: r.submittedAt, submissionNote: r.submissionNote,
    reviewedBy: r.reviewedBy, reviewedAt: r.reviewedAt, reviewNote: r.reviewNote,
    items: items.filter((i) => i.requestId === r.id).sort((a, b) => +a.linkedAt - +b.linkedAt)
      .map((i) => ({ evidenceId: i.evidenceId, name: i.documentName, sha256: i.sha256, linkedBy: i.linkedBy, linkedAt: i.linkedAt })),
  }))
}

async function readBody(req: Request) {
  try { return await req.json() } catch { return null }
}

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (caller.readOnly) return forbidden()
    const url = new URL(req.url)
    const [id, sub, who, act] = url.pathname.replace(/^\/api\/evidence-requests\/?/, '').split('/').filter(Boolean)

    // ------------------------------------------------------------- lists ----
    if (!id && req.method === 'GET') {
      if (url.searchParams.get('mine')) return json(await mine(caller))
      const e = await loadEngagement(url.searchParams.get('engagementId') ?? '')
      if (!e) return notFound()
      const side = await sideOf(e, caller)
      if (!side) return notFound()
      const rows = await db.select().from(evidenceRequests).where(eq(evidenceRequests.engagementId, e.id)).orderBy(desc(evidenceRequests.createdAt))
      return json({ side, engagementStatus: e.status, requests: await view(rows) })
    }
    if (id === 'options' && req.method === 'GET') {
      const e = await loadEngagement(url.searchParams.get('engagementId') ?? '')
      if (!e || (await sideOf(e, caller)) !== 'organization') return notFound()
      return json({ options: await evidenceOptions(caller.email, caller.role === 'super_admin') })
    }

    // ------------------------------------------------------------ create ----
    if (!id && req.method === 'POST') {
      const p = createSchema.safeParse(await readBody(req))
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid request')
      const e = await loadEngagement(p.data.engagementId)
      if (!e) return notFound()
      if ((await sideOf(e, caller)) !== 'reviewer') return notFound()
      if (e.status !== 'active') return conflict('Evidence can be requested only while the engagement is active')
      if (p.data.dueOn < today()) return bad('The due date cannot be in the past')
      if (p.data.dueOn > new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)) return bad('Choose a due date within a year')
      const count = (await db.select({ id: evidenceRequests.id }).from(evidenceRequests).where(eq(evidenceRequests.engagementId, e.id))).length
      if (count >= MAX_REQUESTS_PER_ENGAGEMENT) return conflict(`An engagement can have at most ${MAX_REQUESTS_PER_ENGAGEMENT} evidence requests`)
      const [r] = await db.insert(evidenceRequests).values({
        id: `evr_${crypto.randomUUID()}`, engagementId: e.id, orgId: e.orgId, title: p.data.title, indicatorId: p.data.indicatorId || null,
        note: p.data.note ?? '', dueOn: p.data.dueOn, requestedBy: caller.email,
      }).returning()
      await audit(caller.email, `requested evidence: ${r.title} (due ${r.dueOn})`, r.id, r.orgId)
      await tellOrganisation(r, 'new')
      return json((await view([r]))[0], 201)
    }

    // ------------------------------------------------------- one request ----
    if (!id) return new Response('Method Not Allowed', { status: 405 })
    const [r] = await db.select().from(evidenceRequests).where(eq(evidenceRequests.id, id))
    if (!r) return notFound()
    const e = await loadEngagement(r.engagementId)
    if (!e) return notFound()
    const side = await sideOf(e, caller)
    if (!side) return notFound()
    const active = e.status === 'active'
    const open = (OPEN_STATUSES as readonly string[]).includes(r.status)

    if (sub === 'items' && !who && req.method === 'POST') {
      if (side !== 'organization') return forbidden()
      if (!active) return conflict('This engagement is no longer active')
      if (!open) return conflict('This request is not waiting for evidence')
      const p = itemSchema.safeParse(await readBody(req))
      if (!p.success) return bad('Choose an evidence item')
      const [ev] = await db.select().from(evidenceRegistry)
        .where(and(eq(evidenceRegistry.id, p.data.evidenceId), isNull(evidenceRegistry.archivedAt), ne(evidenceRegistry.status, 'rejected')))
      if (!ev) return notFound()
      // The evidence's own permissions apply: the caller must be an assessor or above in the workspace organisation holding it.
      try { await requireOrgAccess(caller, ev.orgId, 'assessor') } catch (err) {
        if (err instanceof HttpError) return err.status === 404 ? notFound() : forbidden()
        throw err
      }
      const inserted = await db.insert(evidenceRequestItems).values({
        id: `evri_${crypto.randomUUID()}`, requestId: r.id, evidenceId: ev.id, documentName: ev.documentName,
        sha256: await evidenceSha256(ev.filePath), linkedBy: caller.email,
      }).onConflictDoNothing().returning({ id: evidenceRequestItems.id })
      if (inserted.length) await audit(caller.email, `linked evidence #${ev.id} (${ev.documentName})`, r.id, r.orgId)
      return json((await view([r]))[0], inserted.length ? 201 : 200)
    }
    if (sub === 'items' && who && !act && req.method === 'DELETE') {
      if (side !== 'organization') return forbidden()
      if (!open) return conflict('Submitted evidence cannot be removed')
      const evidenceId = Number(who)
      if (!Number.isInteger(evidenceId)) return notFound()
      const gone = await db.delete(evidenceRequestItems).where(and(eq(evidenceRequestItems.requestId, r.id), eq(evidenceRequestItems.evidenceId, evidenceId))).returning()
      if (gone.length) await audit(caller.email, `removed evidence #${evidenceId}`, r.id, r.orgId)
      return json((await view([r]))[0])
    }
    if (sub === 'items' && who && act === 'download' && req.method === 'GET') {
      if (side !== 'reviewer') return forbidden()
      if (!active) return conflict('This engagement is no longer active')
      if (!['submitted', 'accepted', 'more_needed'].includes(r.status)) return notFound()
      const evidenceId = Number(who)
      if (!Number.isInteger(evidenceId)) return notFound()
      const [link] = await db.select().from(evidenceRequestItems).where(and(eq(evidenceRequestItems.requestId, r.id), eq(evidenceRequestItems.evidenceId, evidenceId)))
      if (!link) return notFound()
      const [ev] = await db.select().from(evidenceRegistry).where(and(eq(evidenceRegistry.id, evidenceId), isNull(evidenceRegistry.archivedAt)))
      if (!ev) return json({ error: 'The organisation has removed this document from its registry' }, 410)
      const data = await getStore('evidence').get(ev.filePath, { type: 'arrayBuffer' })
      if (!data) return notFound()
      await audit(caller.email, `opened evidence #${ev.id} (${ev.documentName})`, r.id, r.orgId)
      const safeName = ev.documentName.replace(/[^\w.\- ]+/g, '_').slice(0, 150) || 'evidence'
      return new Response(decodeEvidence(data), {
        headers: {
          'content-type': ev.mimeType || 'application/octet-stream',
          'content-disposition': `attachment; filename="${safeName}"`,
          'cache-control': 'private, no-store',
          'x-content-type-options': 'nosniff',
        },
      })
    }
    if (sub === 'submit' && req.method === 'POST') {
      if (side !== 'organization') return forbidden()
      if (!active) return conflict('This engagement is no longer active')
      if (!open) return conflict('This request is not waiting for evidence')
      const p = submitSchema.safeParse((await readBody(req)) ?? {})
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid note')
      const items = await db.select({ id: evidenceRequestItems.id }).from(evidenceRequestItems).where(eq(evidenceRequestItems.requestId, r.id))
      if (!items.length) return bad('Link at least one document before submitting')
      const [u] = await db.update(evidenceRequests).set({ status: 'submitted', submittedBy: caller.email, submittedAt: new Date(), submissionNote: p.data.note ?? '' })
        .where(and(eq(evidenceRequests.id, r.id), inArray(evidenceRequests.status, [...OPEN_STATUSES]))).returning()
      if (!u) return conflict('This request is not waiting for evidence')
      await audit(caller.email, `submitted evidence (${items.length} document${items.length === 1 ? '' : 's'})`, r.id, r.orgId)
      await tellRequester(u)
      return json((await view([u]))[0])
    }
    if (sub === 'review' && req.method === 'POST') {
      if (side !== 'reviewer') return forbidden()
      if (!active) return conflict('This engagement is no longer active')
      if (r.status !== 'submitted') return conflict('Only submitted evidence can be reviewed')
      const p = reviewSchema.safeParse(await readBody(req))
      if (!p.success) return bad('Choose accept or ask for more')
      if (p.data.decision === 'more' && !p.data.note) return bad('Say what more is needed')
      const status = p.data.decision === 'accept' ? 'accepted' : 'more_needed'
      const [u] = await db.update(evidenceRequests).set({ status, reviewedBy: caller.email, reviewedAt: new Date(), reviewNote: p.data.note ?? '' })
        .where(and(eq(evidenceRequests.id, r.id), eq(evidenceRequests.status, 'submitted'))).returning()
      if (!u) return conflict('Only submitted evidence can be reviewed')
      await audit(caller.email, status === 'accepted' ? 'accepted the evidence' : `asked for more: ${u.reviewNote}`, r.id, r.orgId)
      await tellOrganisation(u, status === 'accepted' ? 'accepted' : 'more_needed')
      return json((await view([u]))[0])
    }
    if (sub === 'cancel' && req.method === 'POST') {
      if (side !== 'reviewer') return forbidden()
      if (r.status === 'accepted' || r.status === 'cancelled') return conflict(`This request is already ${r.status}`)
      const p = cancelSchema.safeParse((await readBody(req)) ?? {})
      if (!p.success) return bad('Invalid reason')
      const [u] = await db.update(evidenceRequests).set({ status: 'cancelled', reviewedBy: caller.email, reviewedAt: new Date(), reviewNote: p.data.reason ?? '' })
        .where(eq(evidenceRequests.id, r.id)).returning()
      await audit(caller.email, `withdrew the request${p.data.reason ? `: ${p.data.reason}` : ''}`, r.id, r.orgId)
      await tellOrganisation(u, 'cancelled')
      return json((await view([u]))[0])
    }
    return notFound()
  } catch (err) {
    logger.error('/api/evidence-requests', 'failed', err)
    return json({ error: 'Evidence request failed' }, 500)
  }
}

/** Requests waiting on the caller's organisation, and submissions waiting on the caller's review. */
async function mine(caller: Caller) {
  const forOrg = await db.select({ r: evidenceRequests, engagementStatus: validationEngagements.status }).from(evidenceRequests)
    .innerJoin(validationEngagements, eq(validationEngagements.id, evidenceRequests.engagementId))
    .where(and(eq(evidenceRequests.orgId, caller.orgId), inArray(evidenceRequests.status, [...OPEN_STATUSES]), eq(validationEngagements.status, 'active')))
  const mayWrite = forOrg.length > 0 && (await canAccessOrg(caller, caller.orgId, 'write'))
  const toReview = await db.select({ r: evidenceRequests, orgName: organizations.name }).from(evidenceRequests)
    .innerJoin(organizations, eq(organizations.id, evidenceRequests.orgId))
    .where(and(eq(evidenceRequests.requestedBy, caller.email), eq(evidenceRequests.status, 'submitted')))
  return {
    forMyOrganisation: mayWrite ? await view(forOrg.map((x) => x.r)) : [],
    awaitingMyReview: (await view(toReview.map((x) => x.r))).map((v, i) => ({ ...v, organization: toReview[i].orgName })),
  }
}

export const config: Config = { path: ['/api/evidence-requests', '/api/evidence-requests/*'] }

export default monitored(handleRequest)
