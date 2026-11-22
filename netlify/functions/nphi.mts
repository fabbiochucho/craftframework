import type { Config } from '@netlify/functions'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { catalogueIndependence, catalogueIndependentScores, evidenceRegistry, governanceScores } from '../../db/schema.js'
import { canAccessOrg, forbidden, resolveCaller, unauthorized, type Caller } from '../lib/auth.js'
import { isIndependentAssessorOf } from '../lib/independent-assessor.js'
import { logger, monitored } from '../lib/logger.js'
import { assessmentWithCraftOrg, linkedTo, summarise } from '../lib/nphi.js'
import { catalogueByType } from '../../src/lib/assessment-catalogues.js'
import { activeItems } from '../../src/lib/health-security.js'
import { archiveAssessment } from '../lib/assessment-archive.js'

// /api/nphi — a public health institute's NPHI, JEE and SPAR assessments (kept in Org Workspaces), seen from its
// CRAFT organisation (netlify/lib/nphi.ts).
//   GET ?orgId=                 -> { orgs, assessments, canReview }   the organisation's readers, its independent assessor
//   GET ?assessment=            -> items with the institute's levels and the independent assessor's, and the caller's declaration
//   POST { assessment, declare: true, organisation }                 independent assessor: declare independence (once)
//   PUT  { assessment, item, score | notApplicable+note, note? }     independent assessor, after declaring: their level
// The independent assessor is the one the organisation invited (access grant), or the Super Admin.
const bad = (error: string, status = 400) => Response.json({ error }, { status })

async function canReview(caller: Caller, craftOrgId: string) {
  return (caller.role === 'super_admin' && !caller.readOnly) || isIndependentAssessorOf(caller, craftOrgId)
}
async function canSee(caller: Caller, craftOrgId: string) {
  return (await canAccessOrg(caller, craftOrgId, 'read')) || (await canReview(caller, craftOrgId))
}
async function declared(assessmentId: number, email: string) {
  return (await db.select().from(catalogueIndependence).where(and(eq(catalogueIndependence.assessmentId, assessmentId), eq(catalogueIndependence.assessor, email))))[0] ?? null
}

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const url = new URL(req.url)

    if (req.method === 'GET' && url.searchParams.has('orgId')) {
      const orgId = url.searchParams.get('orgId') ?? ''
      if (!(await canSee(caller, orgId))) return forbidden()
      return Response.json({ ...(await linkedTo(orgId)), canReview: await canReview(caller, orgId) })
    }

    const body = req.method === 'GET' ? {} : ((await req.json().catch(() => ({}))) as Record<string, unknown>)
    const id = Number(req.method === 'GET' ? url.searchParams.get('assessment') : body.assessment)
    if (!Number.isInteger(id) || id < 1) return bad('assessment required')
    const found = await assessmentWithCraftOrg(id)
    if (!found) return bad('Not found', 404)
    const { a, org, craftOrgId } = found
    const cat = catalogueByType(a.assessmentType)!
    const items = activeItems(cat, a.innovationSupport)

    if (req.method === 'GET') {
      if (!(await canSee(caller, craftOrgId))) return forbidden()
      const [own, ind] = await Promise.all([
        db.select().from(governanceScores).where(and(eq(governanceScores.orgId, a.orgId), eq(governanceScores.assessmentId, a.id))),
        db.select().from(catalogueIndependentScores).where(eq(catalogueIndependentScores.assessmentId, a.id)),
      ])
      const docIds = own.map((s) => s.evidenceId).filter((x): x is number => x !== null)
      const docs = docIds.length ? await db.select({ id: evidenceRegistry.id, name: evidenceRegistry.documentName }).from(evidenceRegistry).where(and(eq(evidenceRegistry.orgId, a.orgId), inArray(evidenceRegistry.id, docIds))) : []
      return Response.json({
        institute: org.name, craftOrgId, summary: await summarise(a),
        catalogue: { title: cat.title, version: cat.version, source: cat.source, levels: cat.levels, evidenceCap: cat.evidenceCap, disclaimer: cat.disclaimer,
          sections: cat.sections.filter((s) => a.innovationSupport || !s.extended), items },
        own: Object.fromEntries(own.map((s) => [s.domain, { score: s.notApplicable ? null : s.tierLevel, notApplicable: s.notApplicable, naReason: s.naReason, evidence: docs.find((d) => d.id === s.evidenceId)?.name ?? (s.evidenceUploaded ? 'ticked (no document)' : null) }])),
        independent: Object.fromEntries(ind.map((r) => [r.domain, { score: r.score, notApplicable: r.notApplicable, note: r.note, assessor: r.assessor, updatedAt: r.updatedAt }])),
        canReview: await canReview(caller, craftOrgId),
        declaration: await declared(a.id, caller.email),
      })
    }

    if (!(await canReview(caller, craftOrgId))) return forbidden()
    if (req.method === 'POST' && body.declare === true) {
      const organisation = String(body.organisation ?? '').trim().slice(0, 200)
      if (!organisation) return bad('Name the organisation you assess for (for example DiBadili Institute or Africa CDC)')
      await db.insert(catalogueIndependence).values({ assessmentId: a.id, assessor: caller.email, organisation }).onConflictDoNothing()
      return Response.json({ declaration: await declared(a.id, caller.email) })
    }
    if (req.method === 'PUT') {
      if (!(await declared(a.id, caller.email))) return bad('Declare your independence before scoring', 409)
      const item = items.find((i) => i.id === body.item)
      if (!item) return bad(`unknown ${cat.id} item`)
      const notApplicable = body.notApplicable === true
      const note = String(body.note ?? '').trim()
      if (note.length > 2000) return bad('note is longer than 2,000 characters')
      if (notApplicable && !note) return bad('Not applicable needs a reason')
      const score = notApplicable ? null : Number(body.score)
      if (!notApplicable && (!Number.isInteger(score) || score! < 1 || score! > 5)) return bad('score must be an integer 1-5')
      const values = { score, notApplicable, note, assessor: caller.email, updatedAt: new Date() }
      await db.transaction(async (tx) => {
        await tx.insert(catalogueIndependentScores).values({ assessmentId: a.id, domain: item.id, ...values })
          .onConflictDoUpdate({ target: [catalogueIndependentScores.assessmentId, catalogueIndependentScores.domain], set: values })
        await archiveAssessment(tx, { source: 'independent', orgId: craftOrgId, assessmentId: String(a.id), recordKey: item.id, period: a.reportingPeriod, actor: caller.email, snapshot: values, savedAt: values.updatedAt })
      })
      return Response.json({ ok: true, savedAt: values.updatedAt.toISOString(), summary: await summarise(a) })
    }
    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error('/api/nphi', 'failed', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const config: Config = { path: '/api/nphi' }

export default monitored(handleRequest)
