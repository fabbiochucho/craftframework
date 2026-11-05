import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { randomUUID } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, ccaAssessments } from '../../db/schema.js'
import { canAccessOrg, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { CCA_MODULE_IDS, contentProblems, isAwardModule } from '../../src/lib/cca/modules.js'
import type { CcaModule } from '../../src/lib/cca/engine.js'

// /api/cca — CRAFT Capacity Assessment.
//   GET    modules                    signed-in: the module content (private, from blob store cca-private)
//   GET    ?orgId=                    organisation members (read): its assessments
//   POST   { orgId, module, year, awardRef? }          (write) start an assessment
//   PUT    :id { responses?, votes?, swot?, plan?, notAssessed?, assessor?, orgLead? }   (write) while draft
//   POST   :id/complete               (write) complete it; a completed assessment cannot change
// Scores are computed from the responses by src/lib/cca/engine.ts, so they always follow the evidence.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
export const CCA_STORE = 'cca-private'

const response = z.object({ met: z.boolean(), evidence: z.string().max(1000) }).strict()
const putSchema = z.object({
  responses: z.record(z.string().max(80), response).optional(),
  votes: z.record(z.string().max(80), z.array(z.number().int().min(1).max(4)).max(60)).optional(),
  swot: z.object({ strengths: z.array(z.string().max(300)).max(30), weaknesses: z.array(z.string().max(300)).max(30), opportunities: z.array(z.string().max(300)).max(30), threats: z.array(z.string().max(300)).max(30) }).strict().optional(),
  plan: z.array(z.object({ domainId: z.string().max(80), costs: z.number().min(0).max(1e12).optional(), timeline: z.string().max(200).optional(), responsible: z.string().max(200).optional() }).strict()).max(300).optional(),
  // Replaces the whole map: domain id -> why it was left out.
  notAssessed: z.record(z.string().max(80), z.string().trim().min(3).max(300)).optional(),
  assessor: z.string().max(200).optional(),
  orgLead: z.string().max(200).optional(),
}).strict()
const createSchema = z.object({
  orgId: z.string().min(1).max(200), module: z.enum(CCA_MODULE_IDS as [string, ...string[]]),
  year: z.number().int().min(2000).max(2100), awardRef: z.string().trim().max(120).optional(),
}).strict()

async function content(): Promise<CcaModule[] | null> {
  const m = await getStore(CCA_STORE).get('modules', { type: 'json' }) as CcaModule[] | null
  return m && !contentProblems(m).length ? m : null
}

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const url = new URL(req.url)
    const origin = req.headers.get('origin')
    if (req.method !== 'GET' && origin && origin !== url.origin) return json({ error: 'Forbidden' }, 403)
    const [idOrSub, action] = url.pathname.replace(/^\/api\/cca\/?/, '').split('/')

    if (req.method === 'GET' && idOrSub === 'modules') {
      const m = await content()
      return m ? json({ modules: m }) : json({ error: 'The capacity assessment content has not been published yet.' }, 503)
    }

    if (req.method === 'GET' && !idOrSub) {
      const orgId = url.searchParams.get('orgId') ?? ''
      if (!(await canAccessOrg(caller, orgId, 'read'))) return json({ error: 'Forbidden' }, 403)
      const rows = await db.select().from(ccaAssessments).where(eq(ccaAssessments.orgId, orgId)).orderBy(asc(ccaAssessments.module), asc(ccaAssessments.year))
      return json({ assessments: rows })
    }

    if (req.method === 'POST' && !idOrSub) {
      const p = createSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Choose a module and a year.' }, 400)
      if (!(await canAccessOrg(caller, p.data.orgId, 'write'))) return json({ error: 'Forbidden' }, 403)
      const awardRef = isAwardModule(p.data.module) ? (p.data.awardRef ?? '') : ''
      if (isAwardModule(p.data.module) && !awardRef) return json({ error: 'Name the grant or contract this assessment is for.' }, 400)
      const id = `cca_${randomUUID()}`
      const inserted = await db.insert(ccaAssessments).values({ id, orgId: p.data.orgId, module: p.data.module, year: p.data.year, awardRef, createdBy: caller.email })
        .onConflictDoNothing().returning({ id: ccaAssessments.id })
      if (!inserted.length) return json({ error: 'There is already an assessment for this module and year.' }, 409)
      await db.insert(auditLogs).values({ orgId: p.data.orgId, actor: caller.email, action: `Started capacity assessment (${p.data.module} ${p.data.year}${awardRef ? `, ${awardRef}` : ''})`, target: id, category: 'Assessment' })
      return json({ id }, 201)
    }

    const [row] = idOrSub ? await db.select().from(ccaAssessments).where(eq(ccaAssessments.id, idOrSub)) : []
    if (!row) return json({ error: 'Not found' }, 404)
    if (!(await canAccessOrg(caller, row.orgId, req.method === 'GET' ? 'read' : 'write'))) return json({ error: 'Forbidden' }, 403)

    if (req.method === 'GET' && !action) return json({ assessment: row })
    if (row.status === 'complete') return json({ error: 'This assessment is complete and can no longer change.' }, 409)

    if (req.method === 'PUT' && !action) {
      const p = putSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Some of the answers could not be saved. Check the evidence notes are under 1,000 characters and every domain marked not assessed has a reason.' }, 400)
      const d = p.data
      if (d.notAssessed && Object.keys(d.notAssessed).length && isAwardModule(row.module)) return json({ error: 'Every domain must be assessed for a grant or contract.' }, 400)
      await db.update(ccaAssessments).set({
        ...(d.responses ? { responses: { ...row.responses, ...d.responses } } : {}),
        ...(d.votes ? { votes: { ...row.votes, ...d.votes } } : {}),
        ...(d.swot ? { swot: d.swot } : {}), ...(d.plan ? { plan: d.plan } : {}), ...(d.notAssessed ? { notAssessed: d.notAssessed } : {}),
        ...(d.assessor !== undefined ? { assessor: d.assessor } : {}), ...(d.orgLead !== undefined ? { orgLead: d.orgLead } : {}),
        updatedAt: new Date(),
      }).where(and(eq(ccaAssessments.id, row.id), eq(ccaAssessments.status, 'draft')))
      return json({ ok: true })
    }

    if (req.method === 'POST' && action === 'complete') {
      // Record the domains this assessment covered, so domains added to the module later never lower its result.
      const mod = (await content())?.find((m) => m.id === row.module)
      const domainIds = mod ? mod.areas.flatMap((a) => a.domains.map((d) => d.id)) : null
      await db.transaction(async (tx) => {
        await tx.update(ccaAssessments).set({ status: 'complete', domainIds, completedAt: new Date(), updatedAt: new Date() }).where(eq(ccaAssessments.id, row.id))
        await tx.insert(auditLogs).values({ orgId: row.orgId, actor: caller.email, action: `Completed capacity assessment (${row.module} ${row.year})`, target: row.id, category: 'Assessment' })
      })
      return json({ ok: true })
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    logger.error('cca', 'request failed', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
}

export const config: Config = { path: ['/api/cca', '/api/cca/*'] }

export default monitored(handleRequest)
