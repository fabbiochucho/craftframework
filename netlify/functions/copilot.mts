import type { Config } from '@netlify/functions'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { actionTemplates, auditLogs, copilotRequests, organizations } from '../../db/schema.js'
import { canAccessOrg, forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { decryptField, encryptField } from '../lib/crypto.js'
import { draftFromTemplates, COPILOT_MODEL } from '../lib/copilot-model.js'
import { logger, monitored } from '../lib/logger.js'
import { retrieve, TEMPLATE_KINDS, WATERMARK, type ActionTemplate } from '../../src/lib/copilot.js'

// /api/copilot — the Gap-to-Action Copilot (src/lib/copilot.ts).
//   POST /draft                      an organisation asks for a starting point for a low-scoring domain
//   GET  /requests?orgId=            the organisation's drafts and expert answers
//   Curators (the super admin and COPILOT_CURATORS, comma-separated emails), who also answer as experts:
//   GET/POST /templates, PUT /templates/:id, POST /templates/:id/approve|retire, GET /queue, POST /queue/:id/answer
// Drafting is OFF until COPILOT_ENABLED=true, which is set only after levels 1-2 of evals/copilot pass.
const DAILY_LIMIT = 20
// Approval needs a second person, so at least two curators must exist before any template can be used.
const isCurator = (email: string) => isSuperAdmin(email) ||
  (process.env.COPILOT_CURATORS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase())
const list = z.array(z.string().trim().min(1).max(100)).max(50)
const templateSchema = z.object({
  title: z.string().trim().min(3).max(200), kind: z.enum(TEMPLATE_KINDS.map((k) => k.id) as [string, ...string[]]),
  domains: list, keywords: list, archetypes: list, countries: list,
  body: z.string().trim().min(50).max(60000), source: z.string().trim().min(3).max(500), licence: z.string().trim().max(200).optional(),
}).strict()
const draftSchema = z.object({
  orgId: z.string().min(1).max(200), module: z.string().min(1).max(80),
  domainId: z.string().min(1).max(80), domainName: z.string().trim().min(1).max(200), note: z.string().trim().max(1000).optional(),
}).strict()

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const asTemplate = (r: typeof actionTemplates.$inferSelect): ActionTemplate => ({ ...r, kind: r.kind as ActionTemplate['kind'], status: r.status as ActionTemplate['status'] })
const requestView = (r: typeof copilotRequests.$inferSelect) => ({
  id: r.id, module: r.module, domainId: r.domainId, domainName: r.domainName, status: r.status, createdAt: r.createdAt,
  note: decryptField(r.note), draft: decryptField(r.draft), answer: decryptField(r.answer), answeredAt: r.answeredAt,
  watermark: r.status === 'drafted' ? WATERMARK : null,
})

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const url = new URL(req.url)
    const [section, id, action] = url.pathname.replace(/^\/api\/copilot\/?/, '').split('/').filter(Boolean)
    const body = async () => req.json().catch(() => null)

    if (section === 'draft' && req.method === 'POST') {
      if (process.env.COPILOT_ENABLED !== 'true') return json({ error: 'The drafting assistant is not switched on yet.' }, 503)
      const p = draftSchema.safeParse(await body())
      if (!p.success) return json({ error: 'Choose the capacity area to draft for.' }, 400)
      const d = p.data
      if (!(await canAccessOrg(caller, d.orgId, 'write'))) return forbidden()
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(copilotRequests)
        .where(and(eq(copilotRequests.orgId, d.orgId), gte(copilotRequests.createdAt, new Date(Date.now() - 86_400_000))))
      if (n >= DAILY_LIMIT) return json({ error: `Your organisation has used today's ${DAILY_LIMIT} requests. Try again tomorrow.` }, 429)
      const [org] = await db.select({ archetype: organizations.archetype, country: organizations.country }).from(organizations).where(eq(organizations.id, d.orgId))
      const gap = { domainId: d.domainId, domainName: d.domainName, archetype: org?.archetype ?? '', country: org?.country ?? '' }
      const approved = (await db.select().from(actionTemplates).where(eq(actionTemplates.status, 'approved'))).map(asTemplate)
      const matched = retrieve(approved, gap)
      const result = matched.length ? await draftFromTemplates(matched, gap, d.note ?? '') : { covered: false as const }
      const [row] = await db.insert(copilotRequests).values({
        orgId: d.orgId, askedBy: caller.email, module: d.module, domainId: d.domainId, domainName: d.domainName, note: encryptField(d.note ?? ''),
        status: result.covered ? 'drafted' : 'routed', templateIds: matched.map((t) => t.id), draft: result.covered ? encryptField(result.text) : '',
      }).returning()
      await db.insert(auditLogs).values({ orgId: d.orgId, actor: caller.email, action: result.covered ? `Copilot drafted a starting point for ${d.domainName} (${COPILOT_MODEL})` : `Copilot routed ${d.domainName} to an expert`, target: String(row.id), category: 'Assessment' })
      if (!result.covered) return json({ routed: true, id: row.id, message: 'No approved template covers this yet, so a CRAFT expert will answer. You will find the answer here.' })
      return json({ routed: false, id: row.id, draft: result.text, citations: result.citations, watermark: WATERMARK })
    }

    if (section === 'requests' && req.method === 'GET') {
      const orgId = url.searchParams.get('orgId') ?? ''
      if (!(await canAccessOrg(caller, orgId, 'read'))) return forbidden()
      const rows = await db.select().from(copilotRequests).where(eq(copilotRequests.orgId, orgId)).orderBy(desc(copilotRequests.id)).limit(50)
      return json({ enabled: process.env.COPILOT_ENABLED === 'true', requests: rows.map(requestView) })
    }

    // Curators and experts.
    if (!isCurator(caller.email)) return forbidden()

    if (section === 'templates' && req.method === 'GET' && !id) {
      return json(await db.select().from(actionTemplates).orderBy(desc(actionTemplates.id)))
    }
    if (section === 'templates' && req.method === 'POST' && !id) {
      const p = templateSchema.safeParse(await body())
      if (!p.success) return json({ error: 'Give a title, a kind, the template text (at least 50 characters) and its source.', details: p.error.flatten() }, 400)
      const [row] = await db.insert(actionTemplates).values({ ...p.data, licence: p.data.licence ?? '', createdBy: caller.email }).returning()
      return json(row, 201)
    }
    const templateId = Number(id)
    if (section === 'templates' && Number.isInteger(templateId)) {
      const [current] = await db.select().from(actionTemplates).where(eq(actionTemplates.id, templateId))
      if (!current) return json({ error: 'Not found' }, 404)
      if (req.method === 'PUT' && !action) {
        const p = templateSchema.safeParse(await body())
        if (!p.success) return json({ error: 'Check the template fields.', details: p.error.flatten() }, 400)
        // Any edit sends the template back for approval, by someone other than the editor.
        const [row] = await db.update(actionTemplates).set({ ...p.data, licence: p.data.licence ?? '', status: 'draft', createdBy: caller.email, approvedBy: null, approvedAt: null, updatedAt: new Date() }).where(eq(actionTemplates.id, templateId)).returning()
        return json(row)
      }
      if (req.method === 'POST' && action === 'approve') {
        if (current.createdBy === caller.email) return json({ error: 'A second person must approve a template: you wrote or last edited this one.' }, 409)
        const [row] = await db.update(actionTemplates).set({ status: 'approved', approvedBy: caller.email, approvedAt: new Date() }).where(eq(actionTemplates.id, templateId)).returning()
        await db.insert(auditLogs).values({ actor: caller.email, action: `Approved Copilot template "${current.title}"`, target: String(templateId), category: 'Config' })
        return json(row)
      }
      if (req.method === 'POST' && action === 'retire') {
        const [row] = await db.update(actionTemplates).set({ status: 'retired', updatedAt: new Date() }).where(eq(actionTemplates.id, templateId)).returning()
        return json(row)
      }
    }
    if (section === 'queue' && req.method === 'GET') {
      const rows = await db.select().from(copilotRequests).where(eq(copilotRequests.status, 'routed')).orderBy(copilotRequests.id).limit(100)
      return json(rows.map((r) => ({ ...requestView(r), orgId: r.orgId })))
    }
    if (section === 'queue' && req.method === 'POST' && action === 'answer') {
      const p = z.object({ answer: z.string().trim().min(10).max(20000) }).strict().safeParse(await body())
      if (!p.success) return json({ error: 'Write an answer of at least 10 characters.' }, 400)
      const [row] = await db.update(copilotRequests).set({ status: 'answered', answer: encryptField(p.data.answer), answeredBy: caller.email, answeredAt: new Date() })
        .where(and(eq(copilotRequests.id, Number(id)), eq(copilotRequests.status, 'routed'))).returning()
      if (!row) return json({ error: 'This question is already answered or does not exist.' }, 409)
      return json(requestView(row))
    }
    return json({ error: 'Not found' }, 404)
  } catch (error) {
    logger.error('copilot', 'request failed', error)
    return json({ error: 'The drafting assistant is unavailable right now.' }, 500)
  }
}

export const config: Config = { path: ['/api/copilot', '/api/copilot/*'] }
export default monitored(handleRequest)
