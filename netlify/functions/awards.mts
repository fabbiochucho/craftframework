import type { Config } from '@netlify/functions'
import { randomUUID } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, awardMeasures, awards, ccaAssessments, issueShares, orgIssues, organizations } from '../../db/schema.js'
import { canAccessOrg, mfaRequired, resolveCaller, unauthorized, type Caller } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import {
  awardStage, closingStatus, funderView, ISSUE_SOURCES, ISSUE_TYPES, latestRated, MEASURE_KINDS, repeatedTypes, trackRecord, type AwardStatus, type Issue,
} from '../../src/lib/awards.js'
import { FUNDING_MODALITIES } from '../../src/lib/data.js'
import { awardReadiness, dashboard, effectiveNotAssessed, READINESS_LABEL, type CcaModule } from '../../src/lib/cca/engine.js'

// /api/awards — grants and contracts, funder measures, the organisation's issue register and consented sharing.
//   GET    ?orgId=                         organisation members: awards, measures, issues, shares, track record
//   GET    funder                          the signed-in funder: its own awards (with measures and issues), and the
//                                          track records organisations have shared with it
//   POST   { orgId, title, … }             organisation (write): new award
//   PUT    :id { …fields, close? }         organisation (write): edit; close → "closed" or "closed with open matters"
//   POST   :id/measures { kind, description, liftedWhen }   organisation or the award's funder: record a measure
//   PUT    measures/:mid { lift: true }    organisation or the award's funder: lift it
//   POST   issues { orgId, awardId?, source, type, title, … } organisation, or the award's funder for its own award
//   PUT    issues/:iid { status?, orgResponse?, verified?, fixHeld?, dueDate? }
//          orgResponse: organisation only. verified: organisation (write) or the award's funder.
//   PUT    shares { orgId, viewerEmail, level }  / DELETE shares { orgId, viewerEmail }   organisation (write)

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string) => json({ error }, 400)
const forbid = () => json({ error: 'Forbidden' }, 403)
const email = z.string().trim().toLowerCase().max(254).regex(/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/)
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const awardFields = {
  title: z.string().trim().min(2).max(200), funderName: z.string().trim().max(200).optional(), funderEmail: z.union([email, z.literal('')]).optional(),
  agreementRef: z.string().trim().max(120).optional(), value: z.number().min(0).max(1e13).nullable().optional(), currency: z.string().trim().max(10).optional(),
  modality: z.union([z.enum(FUNDING_MODALITIES.map((m) => m.id) as [string, ...string[]]), z.literal('')]).optional(),
  startDate: day.nullable().optional(), endDate: day.nullable().optional(),
}
const createAward = z.object({ orgId: z.string().min(1).max(200), ...awardFields }).strict()
const editAward = z.object({ ...awardFields, title: awardFields.title.optional(), close: z.boolean().optional() }).strict()
const measure = z.object({ kind: z.enum(MEASURE_KINDS), description: z.string().trim().min(3).max(2000), liftedWhen: z.string().trim().max(2000).optional() }).strict()
const newIssue = z.object({
  orgId: z.string().min(1).max(200), awardId: z.string().max(80).nullable().optional(), source: z.enum(ISSUE_SOURCES), type: z.enum(ISSUE_TYPES),
  title: z.string().trim().min(3).max(200), description: z.string().trim().max(4000).optional(), dueDate: day.nullable().optional(), recurrenceOf: z.string().max(80).nullable().optional(),
}).strict()
const editIssue = z.object({
  status: z.enum(['open', 'closed']).optional(), orgResponse: z.string().trim().max(4000).optional(), verified: z.boolean().optional(),
  fixHeld: z.boolean().nullable().optional(), dueDate: day.nullable().optional(),
}).strict()
const share = z.object({ orgId: z.string().min(1).max(200), viewerEmail: email, level: z.enum(['summary', 'full']) }).strict()
const unshare = z.object({ orgId: z.string().min(1).max(200), viewerEmail: email }).strict()

const isFunderOf = (caller: Caller, a: { funderEmail: string } | undefined) => !!a?.funderEmail && a.funderEmail.toLowerCase() === caller.email.toLowerCase()
const toIssue = (r: typeof orgIssues.$inferSelect): Issue => ({
  id: r.id, orgId: r.orgId, awardId: r.awardId, source: r.source, type: r.type, title: r.title, verified: r.verified, orgResponse: r.orgResponse,
  status: r.status as Issue['status'], openedAt: r.openedAt.toISOString(), closedAt: r.closedAt?.toISOString() ?? null, fixHeld: r.fixHeld, recurrenceOf: r.recurrenceOf,
})
const audit = (orgId: string, actor: string, action: string, target: string) => db.insert(auditLogs).values({ orgId, actor, action, target, category: 'Assessment' })

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const url = new URL(req.url)
    const origin = req.headers.get('origin')
    if (req.method !== 'GET' && origin && origin !== url.origin) return forbid()
    const [a, b] = url.pathname.replace(/^\/api\/awards\/?/, '').split('/')
    const body = req.method === 'GET' ? null : await req.json().catch(() => null)

    if (req.method === 'GET' && !a) {
      const orgId = url.searchParams.get('orgId') ?? ''
      if (!(await canAccessOrg(caller, orgId, 'read'))) return forbid()
      const [aw, issues, shares] = await Promise.all([
        db.select().from(awards).where(eq(awards.orgId, orgId)),
        db.select().from(orgIssues).where(eq(orgIssues.orgId, orgId)),
        db.select().from(issueShares).where(eq(issueShares.orgId, orgId)),
      ])
      const measures = aw.length ? await db.select().from(awardMeasures).where(inArray(awardMeasures.awardId, aw.map((x) => x.id))) : []
      const list = issues.map(toIssue)
      return json({ awards: aw, measures, issues, shares, trackRecord: trackRecord(list), repeatedTypes: repeatedTypes(list) })
    }

    if (req.method === 'GET' && a === 'funder') {
      const me = caller.email.toLowerCase()
      const [mine, shared] = await Promise.all([
        db.select().from(awards).where(sql`lower(${awards.funderEmail}) = ${me}`),
        db.select().from(issueShares).where(eq(issueShares.viewerEmail, me)),
      ])
      const orgIds = [...new Set([...mine.map((x) => x.orgId), ...shared.map((s) => s.orgId)])]
      if (!orgIds.length) return json({ organisations: [] })
      const [issues, orgs, measures] = await Promise.all([
        db.select().from(orgIssues).where(inArray(orgIssues.orgId, orgIds)),
        db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, orgIds)),
        mine.length ? db.select().from(awardMeasures).where(inArray(awardMeasures.awardId, mine.map((x) => x.id))) : [],
      ])
      const allAwards = await db.select().from(awards).where(inArray(awards.orgId, orgIds))
      // Grant-stage assessments on the funder's own awards: the stage and the latest completed rating.
      const stageRows = mine.length ? await db.select().from(ccaAssessments).where(inArray(ccaAssessments.awardRef, mine.map((x) => x.id))) : []
      const modules = stageRows.length ? (await getStore('cca-private').get('modules', { type: 'json' }) as CcaModule[] | null) ?? [] : []
      const shares = shared.map((s) => ({ orgId: s.orgId, viewerEmail: s.viewerEmail, level: s.level as 'summary' | 'full' }))
      return json({
        organisations: orgIds.map((orgId) => {
          const v = funderView(me, orgId, allAwards.map((x) => ({ id: x.id, orgId: x.orgId, funderEmail: x.funderEmail, status: x.status })), issues.map(toIssue), shares)
          const own = mine.filter((x) => x.orgId === orgId)
          const withStage = own.map((x) => {
            const as = stageRows.filter((r) => r.awardRef === x.id).map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null }))
            return { ...x, stage: awardStage(x.status as AwardStatus, as), rating: ratingOf(latestRated(as), modules) }
          })
          return { orgId, name: orgs.find((o) => o.id === orgId)?.name ?? orgId, awards: withStage, measures: measures.filter((m) => own.some((x) => x.id === m.awardId)), ownAwardIssues: v.ownAwardIssues, shared: v.shared }
        }),
      })
    }

    if (req.method === 'POST' && !a) {
      const p = createAward.safeParse(body)
      if (!p.success) return bad('Give the award a title (2 to 200 characters) and check the funder email, dates and amount.')
      if (!(await canAccessOrg(caller, p.data.orgId, 'write'))) return forbid()
      const id = `aw_${randomUUID()}`
      const { value, ...rest } = p.data
      await db.insert(awards).values({ id, ...rest, value: value == null ? null : String(value), createdBy: caller.email })
      await audit(p.data.orgId, caller.email, `Added award "${p.data.title}"`, id)
      return json({ id }, 201)
    }

    if (a === 'shares' && (req.method === 'PUT' || req.method === 'DELETE')) {
      const p = (req.method === 'PUT' ? share : unshare).safeParse(body)
      if (!p.success) return bad('Give a valid email and a level (summary or full).')
      if (!(await canAccessOrg(caller, p.data.orgId, 'write'))) return forbid()
      if (req.method === 'PUT') {
        const level = (p.data as z.infer<typeof share>).level
        await db.insert(issueShares).values({ orgId: p.data.orgId, viewerEmail: p.data.viewerEmail, level, grantedBy: caller.email })
          .onConflictDoUpdate({ target: [issueShares.orgId, issueShares.viewerEmail], set: { level, grantedBy: caller.email, grantedAt: new Date() } })
        await audit(p.data.orgId, caller.email, `Shared issue track record (${level}) with ${p.data.viewerEmail}`, 'issue_shares')
      } else {
        await db.delete(issueShares).where(and(eq(issueShares.orgId, p.data.orgId), eq(issueShares.viewerEmail, p.data.viewerEmail)))
        await audit(p.data.orgId, caller.email, `Stopped sharing issue track record with ${p.data.viewerEmail}`, 'issue_shares')
      }
      return json({ ok: true })
    }

    if (req.method === 'POST' && a === 'issues') {
      const p = newIssue.safeParse(body)
      if (!p.success) return bad('Give the issue a title, a source and a type.')
      const [award] = p.data.awardId ? await db.select().from(awards).where(and(eq(awards.id, p.data.awardId), eq(awards.orgId, p.data.orgId))) : []
      if (p.data.awardId && !award) return bad('That award does not belong to this organisation.')
      if (!(await canAccessOrg(caller, p.data.orgId, 'write')) && !isFunderOf(caller, award)) return forbid()
      const id = `iss_${randomUUID()}`
      await db.insert(orgIssues).values({ id, ...p.data, awardId: p.data.awardId ?? null, description: p.data.description ?? '', createdBy: caller.email })
      await audit(p.data.orgId, caller.email, `Raised issue "${p.data.title}"`, id)
      return json({ id }, 201)
    }

    if (req.method === 'PUT' && a === 'issues' && b) {
      const [row] = await db.select().from(orgIssues).where(eq(orgIssues.id, b))
      if (!row) return json({ error: 'Not found' }, 404)
      const p = editIssue.safeParse(body)
      if (!p.success) return bad('Check the status, response and dates.')
      const [award] = row.awardId ? await db.select().from(awards).where(eq(awards.id, row.awardId)) : []
      const member = await canAccessOrg(caller, row.orgId, 'write')
      const funder = isFunderOf(caller, award)
      if (!member && !funder) return forbid()
      if (p.data.orgResponse !== undefined && !member) return json({ error: 'Only the organisation can write its response.' }, 403)
      const set: Partial<typeof orgIssues.$inferInsert> = {}
      if (p.data.status) { set.status = p.data.status; set.closedAt = p.data.status === 'closed' ? (row.closedAt ?? new Date()) : null }
      if (p.data.orgResponse !== undefined) set.orgResponse = p.data.orgResponse
      if (p.data.verified !== undefined) { set.verified = p.data.verified; set.verifiedBy = p.data.verified ? caller.email : null }
      if (p.data.fixHeld !== undefined) set.fixHeld = p.data.fixHeld
      if (p.data.dueDate !== undefined) set.dueDate = p.data.dueDate
      await db.update(orgIssues).set(set).where(eq(orgIssues.id, row.id))
      await audit(row.orgId, caller.email, `Updated issue (${Object.keys(p.data).join(', ')})`, row.id)
      return json({ ok: true })
    }

    if (req.method === 'PUT' && a === 'measures' && b) {
      const [m] = await db.select().from(awardMeasures).where(eq(awardMeasures.id, b))
      const [award] = m ? await db.select().from(awards).where(eq(awards.id, m.awardId)) : []
      if (!m || !award) return json({ error: 'Not found' }, 404)
      if (!(await canAccessOrg(caller, award.orgId, 'write')) && !isFunderOf(caller, award)) return forbid()
      if (body?.lift !== true) return bad('Send { lift: true } to lift the measure.')
      await db.update(awardMeasures).set({ status: 'lifted', liftedAt: new Date() }).where(eq(awardMeasures.id, m.id))
      await audit(award.orgId, caller.email, `Lifted measure: ${m.kind}`, m.id)
      return json({ ok: true })
    }

    // Award-scoped routes.
    const [award] = a ? await db.select().from(awards).where(eq(awards.id, a)) : []
    if (!award) return json({ error: 'Not found' }, 404)

    if (req.method === 'POST' && b === 'measures') {
      if (!(await canAccessOrg(caller, award.orgId, 'write')) && !isFunderOf(caller, award)) return forbid()
      const p = measure.safeParse(body)
      if (!p.success) return bad('Choose the kind of measure and describe it.')
      const id = `msr_${randomUUID()}`
      await db.insert(awardMeasures).values({ id, awardId: award.id, kind: p.data.kind, description: p.data.description, liftedWhen: p.data.liftedWhen ?? '', createdBy: caller.email })
      await audit(award.orgId, caller.email, `Recorded measure: ${p.data.kind}`, id)
      return json({ id }, 201)
    }

    if (req.method === 'PUT' && !b) {
      if (!(await canAccessOrg(caller, award.orgId, 'write'))) return forbid()
      const p = editAward.safeParse(body)
      if (!p.success) return bad('Check the award details.')
      const { close, value, ...rest } = p.data
      const set: Partial<typeof awards.$inferInsert> = { ...rest, ...(value !== undefined ? { value: value == null ? null : String(value) } : {}) }
      if (close) {
        const open = await db.select({ status: orgIssues.status }).from(orgIssues).where(eq(orgIssues.awardId, award.id))
        set.status = closingStatus(open as { status: 'open' | 'closed' }[])
        set.closedAt = new Date()
      }
      await db.update(awards).set(set).where(eq(awards.id, award.id))
      await audit(award.orgId, caller.email, close ? `Closed award (${set.status})` : 'Updated award', award.id)
      return json({ ok: true, status: set.status ?? award.status })
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    logger.error('awards', 'request failed', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
}

export const config: Config = { path: ['/api/awards', '/api/awards/*'] }

export default monitored(handleRequest)

/** An award's rating from its latest completed grant-stage assessment: growth level and percentage, plus readiness for a Pre-Award. */
function ratingOf(a: (Pick<typeof ccaAssessments.$inferSelect, 'module' | 'year' | 'responses' | 'notAssessed' | 'domainIds'> & { completedAt: string | null }) | null, modules: CcaModule[]) {
  const mod = a && modules.find((m) => m.id === a.module)
  if (!a || !mod) return null
  const d = dashboard(mod, a.responses, effectiveNotAssessed(mod, a.notAssessed, a.domainIds))
  return { module: a.module, year: a.year, completedAt: a.completedAt, level: d.level, percent: d.percent, readiness: a.module === 'pre_award' ? READINESS_LABEL[awardReadiness(mod, a.responses).rating] : null }
}
