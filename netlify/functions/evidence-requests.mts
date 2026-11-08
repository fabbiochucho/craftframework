import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { and, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  evidenceRegistry, evidenceRequestItems, evidenceRequests, organizations, validationEngagements,
  type EvidenceRequestRow, type ValidationEngagementRow,
} from '../../db/schema.js'
import { canAccessOrg, forbidden, mfaRequired, resolveCaller, unauthorized, type Caller } from '../lib/auth.js'
import { evidenceOptions, evidenceSha256 } from '../lib/evidence-options.js'
import { decodeEvidence } from '../lib/evidence-storage.js'
import { watermarkedPdf } from '../lib/evidence-watermark.js'
import {
  assessorSideOf, audit, isSupport, MAX_REQUESTS_PER_ENGAGEMENT, OPEN_STATUSES, requestIsLive, requestLink, sideOf, tellOrganisation, tellRequester,
} from '../lib/evidence-requests.js'
import { assessedOrgIds, hasAssessorGrant } from '../lib/independent-assessor.js'
import { tellSupportAction, wsOrgIdsForLegacyOrg } from '../lib/support.js'
import { orgContactsFor } from '../lib/validation-lifecycle.js'
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
//   GET    ?assessor=1[&for=email]           requests from independent assessors (no engagement) that I ask or answer;
//                                            Super Admin with for=: everything that assessor asked
//   GET    /assessor-orgs[?assessor=email]   organisations the assessor (me, or for the Super Admin the named one) holds a grant on
//   POST   /                                 reviewer: { engagementId, title, indicatorId?, dueOn, note? }
//                                            assessor: { orgId, title, ... } on an organisation they hold an independent-assessor
//                                            grant on; Super Admin: { orgId, onBehalfOf: assessor email, ... }
//   POST   /:id/items                        organisation: { evidenceId } link a registry item
//   DELETE /:id/items/:evidenceId            organisation: remove it (before submitting)
//   POST   /:id/submit                       organisation: { note? } (needs at least one item)
//   POST   /:id/review                       reviewer: { decision: 'accept' | 'more', note? } (a note is required for 'more')
//   POST   /:id/cancel                       reviewer: withdraw an open request
//   GET    /:id/items/:evidenceId/download   reviewer in an engagement: the submitted file (audit-logged)
//   GET    /:id/items/:evidenceId/view       reviewer: view-only PDF stamped with the viewer and time (audit-logged);
//                                            the only way an independent assessor sees a file: never the original
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
  engagementId: z.string().min(1).max(200).optional(),
  orgId: z.string().min(1).max(200).optional(),
  onBehalfOf: z.string().trim().toLowerCase().email().max(254).optional(),
  title: text(200).pipe(z.string().min(3, 'Say what evidence you need')),
  indicatorId: text(80).optional(),
  dueOn: day,
  note: text(2000).optional(),
}).refine((v) => !!v.engagementId !== !!v.orgId, 'Choose an engagement or an organisation')
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
    id: r.id, engagementId: r.engagementId, orgId: r.orgId, title: r.title, indicatorId: r.indicatorId, note: r.note, dueOn: r.dueOn, status: r.status,
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
      if (url.searchParams.get('assessor')) return json(await assessorRequests(caller, url.searchParams.get('for')))
      const e = await loadEngagement(url.searchParams.get('engagementId') ?? '')
      if (!e) return notFound()
      const side = await sideOf(e, caller)
      if (!side) return notFound()
      const rows = await db.select().from(evidenceRequests).where(eq(evidenceRequests.engagementId, e.id)).orderBy(desc(evidenceRequests.createdAt))
      return json({ side, engagementStatus: e.status, requests: await view(rows) })
    }
    if (id === 'assessor-orgs' && req.method === 'GET') {
      const asked = url.searchParams.get('assessor')?.trim().toLowerCase()
      if (asked && caller.role !== 'super_admin') return forbidden()
      const ids = await assessedOrgIds(asked || caller.email)
      const rows = ids.length ? await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, ids)) : []
      return json({ organisations: rows.sort((a, b) => a.name.localeCompare(b.name)) })
    }
    if (id === 'options' && req.method === 'GET') {
      let scope: { orgId: string } | null = null
      const engagementId = url.searchParams.get('engagementId')
      if (engagementId) {
        const e = await loadEngagement(engagementId)
        if (e && (await sideOf(e, caller)) === 'organization') scope = e
      } else {
        const orgId = url.searchParams.get('orgId') ?? ''
        if (orgId && (await assessorSideOf({ orgId, requestedBy: '' }, caller)) === 'organization') scope = { orgId }
      }
      if (!scope) return notFound()
      if (isSupport(scope, caller)) {
        // Support mode: only the organisation's own documents (its people's workspace organisations).
        const own = new Set(await wsOrgIdsForLegacyOrg(scope.orgId))
        const all = await evidenceOptions(caller.email, true)
        const ids = new Set((await db.select({ id: evidenceRegistry.id, orgId: evidenceRegistry.orgId }).from(evidenceRegistry)
          .where(inArray(evidenceRegistry.id, all.length ? all.map((o) => o.id) : [0]))).filter((x) => own.has(x.orgId)).map((x) => x.id))
        return json({ options: all.filter((o) => ids.has(o.id)), support: true })
      }
      return json({ options: await evidenceOptions(caller.email, caller.role === 'super_admin') })
    }

    // ------------------------------------------------------------ create ----
    if (!id && req.method === 'POST') {
      const p = createSchema.safeParse(await readBody(req))
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid request')
      if (p.data.dueOn < today()) return bad('The due date cannot be in the past')
      if (p.data.dueOn > new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)) return bad('Choose a due date within a year')
      if (p.data.orgId) return createForAssessor(caller, { ...p.data, orgId: p.data.orgId })
      const e = await loadEngagement(p.data.engagementId ?? '')
      if (!e) return notFound()
      if ((await sideOf(e, caller)) !== 'reviewer') return notFound()
      if (e.status !== 'active') return conflict('Evidence can be requested only while the engagement is active')
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
    const e = r.engagementId ? await loadEngagement(r.engagementId) : null
    if (r.engagementId && !e) return notFound()
    const side = e ? await sideOf(e, caller) : await assessorSideOf(r, caller)
    if (!side) return notFound()
    const active = await requestIsLive(r, e?.status)
    const inactive = e ? 'This engagement is no longer active' : 'The independent assessor no longer has access to this organisation'
    const open = (OPEN_STATUSES as readonly string[]).includes(r.status)

    if (sub === 'items' && !who && req.method === 'POST') {
      if (side !== 'organization') return forbidden()
      if (!active) return conflict(inactive)
      if (!open) return conflict('This request is not waiting for evidence')
      const p = itemSchema.safeParse(await readBody(req))
      if (!p.success) return bad('Choose an evidence item')
      const [ev] = await db.select().from(evidenceRegistry)
        .where(and(eq(evidenceRegistry.id, p.data.evidenceId), isNull(evidenceRegistry.archivedAt), ne(evidenceRegistry.status, 'rejected')))
      if (!ev) return notFound()
      if (isSupport(r, caller) && !(await wsOrgIdsForLegacyOrg(r.orgId)).includes(ev.orgId)) return notFound()
      // The evidence's own permissions apply: the caller must be an assessor or above in the workspace organisation holding it.
      try { await requireOrgAccess(caller, ev.orgId, 'assessor') } catch (err) {
        if (err instanceof HttpError) return err.status === 404 ? notFound() : forbidden()
        throw err
      }
      const inserted = await db.insert(evidenceRequestItems).values({
        id: `evri_${crypto.randomUUID()}`, requestId: r.id, evidenceId: ev.id, documentName: ev.documentName,
        sha256: await evidenceSha256(ev.filePath), linkedBy: caller.email,
      }).onConflictDoNothing().returning({ id: evidenceRequestItems.id })
      if (inserted.length) {
        const support = isSupport(r, caller)
        await audit(caller.email, `${support ? 'CRAFT support: ' : ''}linked evidence #${ev.id} (${ev.documentName})`, r.id, r.orgId)
        if (support) await tellSupportAction(await orgContactsFor(r.orgId), `Linked "${ev.documentName}" to the evidence request "${r.title}".`, requestLink(r), caller.email)
      }
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
    if (sub === 'items' && who && (act === 'download' || act === 'view') && req.method === 'GET') {
      if (side !== 'reviewer') return forbidden()
      if (act === 'download' && !r.engagementId) return json({ error: 'Evidence for an independent assessment can be viewed on CRAFT, not downloaded' }, 403)
      if (!active) return conflict(inactive)
      if (!['submitted', 'accepted', 'more_needed'].includes(r.status)) return notFound()
      const evidenceId = Number(who)
      if (!Number.isInteger(evidenceId)) return notFound()
      const [link] = await db.select().from(evidenceRequestItems).where(and(eq(evidenceRequestItems.requestId, r.id), eq(evidenceRequestItems.evidenceId, evidenceId)))
      if (!link) return notFound()
      const [ev] = await db.select().from(evidenceRegistry).where(and(eq(evidenceRegistry.id, evidenceId), isNull(evidenceRegistry.archivedAt)))
      if (!ev) return json({ error: 'The organisation has removed this document from its registry' }, 410)
      const data = await getStore('evidence').get(ev.filePath, { type: 'arrayBuffer' })
      if (!data) return notFound()
      if (act === 'view') {
        const out = await watermarkedPdf(decodeEvidence(data), caller.email)
        await audit(caller.email, `viewed evidence #${ev.id} (${ev.documentName})${out.ok ? '' : ' - could not be shown'}`, r.id, r.orgId)
        const headers = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' }
        if (!out.ok) return new Response(out.reason, { status: 415, headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' } })
        return new Response(Buffer.from(out.pdf), { headers: { ...headers, 'content-type': 'application/pdf', 'content-disposition': 'inline; filename="view-only.pdf"' } })
      }
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
      if (!active) return conflict(inactive)
      if (!open) return conflict('This request is not waiting for evidence')
      const p = submitSchema.safeParse((await readBody(req)) ?? {})
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid note')
      const items = await db.select({ id: evidenceRequestItems.id }).from(evidenceRequestItems).where(eq(evidenceRequestItems.requestId, r.id))
      if (!items.length) return bad('Link at least one document before submitting')
      const [u] = await db.update(evidenceRequests).set({ status: 'submitted', submittedBy: caller.email, submittedAt: new Date(), submissionNote: p.data.note ?? '' })
        .where(and(eq(evidenceRequests.id, r.id), inArray(evidenceRequests.status, [...OPEN_STATUSES]))).returning()
      if (!u) return conflict('This request is not waiting for evidence')
      const support = isSupport(r, caller)
      await audit(caller.email, `${support ? 'CRAFT support: ' : ''}submitted evidence (${items.length} document${items.length === 1 ? '' : 's'})`, r.id, r.orgId)
      if (support) await tellSupportAction(await orgContactsFor(r.orgId), `Submitted the evidence request "${r.title}" for you (${items.length} document${items.length === 1 ? '' : 's'}).`, requestLink(r), caller.email)
      await tellRequester(u)
      return json((await view([u]))[0])
    }
    if (sub === 'review' && req.method === 'POST') {
      if (side !== 'reviewer') return forbidden()
      if (!active) return conflict(inactive)
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
    .leftJoin(validationEngagements, eq(validationEngagements.id, evidenceRequests.engagementId))
    .where(and(eq(evidenceRequests.orgId, caller.orgId), inArray(evidenceRequests.status, [...OPEN_STATUSES]),
      or(eq(validationEngagements.status, 'active'), isNull(evidenceRequests.engagementId))))
  const mayWrite = forOrg.length > 0 && (await canAccessOrg(caller, caller.orgId, 'write'))
  const toReview = await db.select({ r: evidenceRequests, orgName: organizations.name }).from(evidenceRequests)
    .innerJoin(organizations, eq(organizations.id, evidenceRequests.orgId))
    .where(and(eq(evidenceRequests.requestedBy, caller.email), eq(evidenceRequests.status, 'submitted')))
  return {
    forMyOrganisation: mayWrite ? await view(forOrg.map((x) => x.r)) : [],
    awaitingMyReview: (await view(toReview.map((x) => x.r))).map((v, i) => ({ ...v, organization: toReview[i].orgName })),
  }
}

/** An independent assessor (or the Super Admin on their behalf) asks an organisation they hold a grant on. */
async function createForAssessor(caller: Caller, d: z.infer<typeof createSchema> & { orgId: string }) {
  if (d.onBehalfOf && (caller.role !== 'super_admin' || caller.readOnly)) return forbidden()
  const assessor = d.onBehalfOf ?? caller.email
  if (!(await hasAssessorGrant(assessor, d.orgId))) {
    return d.onBehalfOf ? conflict(`${assessor} is not the independent assessor of this organisation`) : notFound()
  }
  const count = (await db.select({ id: evidenceRequests.id }).from(evidenceRequests)
    .where(and(eq(evidenceRequests.orgId, d.orgId), eq(evidenceRequests.requestedBy, assessor), isNull(evidenceRequests.engagementId)))).length
  if (count >= MAX_REQUESTS_PER_ENGAGEMENT) return conflict(`An assessor can have at most ${MAX_REQUESTS_PER_ENGAGEMENT} evidence requests per organisation`)
  const [r] = await db.insert(evidenceRequests).values({
    id: `evr_${crypto.randomUUID()}`, engagementId: null, orgId: d.orgId, title: d.title, indicatorId: d.indicatorId || null,
    note: d.note ?? '', dueOn: d.dueOn, requestedBy: assessor,
  }).returning()
  const behalf = assessor !== caller.email ? `on behalf of ${assessor}: ` : ''
  await audit(caller.email, `${behalf}requested evidence as independent assessor: ${r.title} (due ${r.dueOn})`, r.id, r.orgId)
  await tellOrganisation(r, 'new', caller.email)
  return json((await view([r]))[0], 201)
}

/** Requests from independent assessors: ones I asked, ones my organisation must answer; Super Admin: one assessor's. */
async function assessorRequests(caller: Caller, forAssessor: string | null) {
  const asSuper = !!forAssessor && caller.role === 'super_admin'
  const mayAnswer = !asSuper && (await canAccessOrg(caller, caller.orgId, 'write'))
  const who = asSuper ? forAssessor!.trim().toLowerCase() : caller.email
  const rows = await db.select({ r: evidenceRequests, orgName: organizations.name }).from(evidenceRequests)
    .leftJoin(organizations, eq(organizations.id, evidenceRequests.orgId))
    .where(and(isNull(evidenceRequests.engagementId),
      mayAnswer ? or(eq(evidenceRequests.requestedBy, who), eq(evidenceRequests.orgId, caller.orgId)) : eq(evidenceRequests.requestedBy, who)))
    .orderBy(desc(evidenceRequests.createdAt))
  const views = await view(rows.map((x) => x.r))
  return {
    requests: await Promise.all(views.map(async (v, i) => ({
      ...v, organization: rows[i].orgName ?? rows[i].r.orgId,
      side: asSuper ? 'observer' : rows[i].r.requestedBy === caller.email ? 'reviewer' : 'organization',
      active: await hasAssessorGrant(rows[i].r.requestedBy, rows[i].r.orgId),
    }))),
  }
}

export const config: Config = { path: ['/api/evidence-requests', '/api/evidence-requests/*'] }

export default monitored(handleRequest)
