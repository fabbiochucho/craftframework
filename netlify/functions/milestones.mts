import type { Config } from '@netlify/functions'
import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, awardMilestones, awards, milestoneEvidence } from '../../db/schema.js'
import { canAccessOrg, mfaRequired, resolveCaller, unauthorized, type Caller } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { canApprove, nextStatuses, type Milestone, type MilestoneStatus } from '../../src/lib/milestones.js'

// /api/milestones — milestone register and verification packs for an award.
//   GET    ?awardId=                  organisation members or the award's funder: milestones and evidence
//   POST   { awardId, title, ... }    (member write) add a milestone
//   PUT    :id { fields }             (member write) edit while planned or returned
//   POST   :id/evidence               (member write) add an evidence item to the pack while planned or returned
//   POST   :id/approve                (member write) approve the pack: complete, and the approver added none of it
//   POST   :id/submit                 (member write) submit an approved milestone to the funder
//   POST   :id/decide { accept, note } (the award's funder) accept, or return with a note
// Rules live in src/lib/milestones.ts.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const text = (max: number) => z.string().trim().max(max)
const fields = { title: text(200).min(2), owner: text(200), indicator: text(500), baseline: text(200), target: text(200), verificationMeans: text(500), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }
const createSchema = z.object({ awardId: z.string().min(1).max(80), ...fields, owner: fields.owner.optional(), indicator: fields.indicator.optional(), baseline: fields.baseline.optional(), target: fields.target.optional(), verificationMeans: fields.verificationMeans.optional(), dueDate: fields.dueDate.optional() }).strict()
const editSchema = z.object(fields).partial().strict()
const evidenceSchema = z.object({ description: text(300).min(3), ref: text(500).min(3) }).strict()
const decideSchema = z.object({ accept: z.boolean(), note: text(1000) }).strict()

const isFunderOf = (caller: Caller, a: { funderEmail: string }) => !!a.funderEmail && a.funderEmail.toLowerCase() === caller.email.toLowerCase()
const asMilestone = (r: typeof awardMilestones.$inferSelect): Milestone => ({ ...r, status: r.status as MilestoneStatus })

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const url = new URL(req.url)
    const origin = req.headers.get('origin')
    if (req.method !== 'GET' && origin && origin !== url.origin) return json({ error: 'Forbidden' }, 403)
    const [id, action] = url.pathname.replace(/^\/api\/milestones\/?/, '').split('/')
    const audit = (orgId: string, act: string, target: string) => db.insert(auditLogs).values({ orgId, actor: caller.email, action: act, target, category: 'Assessment' })

    if (req.method === 'GET' && !id) {
      const [award] = await db.select().from(awards).where(eq(awards.id, url.searchParams.get('awardId') ?? ''))
      if (!award) return json({ error: 'Not found' }, 404)
      if (!(await canAccessOrg(caller, award.orgId, 'read')) && !isFunderOf(caller, award)) return json({ error: 'Forbidden' }, 403)
      const ms = await db.select().from(awardMilestones).where(eq(awardMilestones.awardId, award.id)).orderBy(asc(awardMilestones.dueDate), asc(awardMilestones.createdAt))
      const ev = ms.length ? await db.select().from(milestoneEvidence).where(inArray(milestoneEvidence.milestoneId, ms.map((m) => m.id))) : []
      return json({ milestones: ms, evidence: ev })
    }

    if (req.method === 'POST' && !id) {
      const p = createSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Give the milestone a title; check field lengths and dates.' }, 400)
      const [award] = await db.select().from(awards).where(eq(awards.id, p.data.awardId))
      if (!award) return json({ error: 'Not found' }, 404)
      if (!(await canAccessOrg(caller, award.orgId, 'write'))) return json({ error: 'Forbidden' }, 403)
      const row = { id: `ms_${randomUUID()}`, orgId: award.orgId, ...p.data, createdBy: caller.email }
      await db.insert(awardMilestones).values(row)
      await audit(award.orgId, `Milestone added: ${p.data.title}`, row.id)
      return json({ id: row.id }, 201)
    }

    const [row] = id ? await db.select().from(awardMilestones).where(eq(awardMilestones.id, id)) : []
    if (!row) return json({ error: 'Not found' }, 404)
    const [award] = await db.select().from(awards).where(eq(awards.id, row.awardId))
    const member = await canAccessOrg(caller, row.orgId, 'write')
    const editable = row.status === 'planned' || row.status === 'rejected'

    if (req.method === 'PUT' && !action) {
      if (!member) return json({ error: 'Forbidden' }, 403)
      if (!editable) return json({ error: 'Only a planned or returned milestone can change.' }, 409)
      const p = editSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Check field lengths and dates.' }, 400)
      await db.update(awardMilestones).set({ ...p.data, updatedAt: new Date() }).where(eq(awardMilestones.id, row.id))
      return json({ ok: true })
    }

    if (req.method === 'POST' && action === 'evidence') {
      if (!member) return json({ error: 'Forbidden' }, 403)
      if (!editable) return json({ error: 'The pack is closed once approved.' }, 409)
      const p = evidenceSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Describe the evidence and say where it is.' }, 400)
      const ev = { id: `mev_${randomUUID()}`, milestoneId: row.id, orgId: row.orgId, ...p.data, addedBy: caller.email }
      await db.insert(milestoneEvidence).values(ev)
      return json({ id: ev.id }, 201)
    }

    if (req.method === 'POST' && action === 'approve') {
      if (!member) return json({ error: 'Forbidden' }, 403)
      const ev = await db.select().from(milestoneEvidence).where(eq(milestoneEvidence.milestoneId, row.id))
      const ok = canApprove(asMilestone(row), ev, caller.email)
      if (!ok.ok) return json({ error: ok.reason }, ok.reason?.startsWith('Someone') ? 403 : 409)
      await db.update(awardMilestones).set({ status: 'approved', approvedBy: caller.email, updatedAt: new Date() }).where(eq(awardMilestones.id, row.id))
      await audit(row.orgId, `Milestone pack approved: ${row.title}`, row.id)
      return json({ ok: true })
    }

    if (req.method === 'POST' && action === 'submit') {
      if (!member) return json({ error: 'Forbidden' }, 403)
      if (!nextStatuses(row.status as MilestoneStatus).includes('submitted')) return json({ error: 'Approve the pack before submitting it.' }, 409)
      await db.update(awardMilestones).set({ status: 'submitted', updatedAt: new Date() }).where(and(eq(awardMilestones.id, row.id), eq(awardMilestones.status, 'approved')))
      await audit(row.orgId, `Milestone submitted to funder: ${row.title}`, row.id)
      return json({ ok: true })
    }

    if (req.method === 'POST' && action === 'decide') {
      if (!award || !isFunderOf(caller, award)) return json({ error: 'Only the award’s funder can accept or return a milestone.' }, 403)
      if (row.status !== 'submitted') return json({ error: 'Only a submitted milestone can be decided.' }, 409)
      const p = decideSchema.safeParse(await req.json().catch(() => null))
      if (!p.success || (!p.data.accept && p.data.note.length < 3)) return json({ error: 'Say why the milestone is returned.' }, 400)
      await db.update(awardMilestones).set({ status: p.data.accept ? 'accepted' : 'rejected', funderNote: p.data.note, updatedAt: new Date() }).where(eq(awardMilestones.id, row.id))
      await audit(row.orgId, `Milestone ${p.data.accept ? 'accepted' : 'returned'} by funder: ${row.title}`, row.id)
      return json({ ok: true })
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    logger.error('milestones', 'request failed', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
}

export const config: Config = { path: ['/api/milestones', '/api/milestones/*'] }

export default monitored(handleRequest)
