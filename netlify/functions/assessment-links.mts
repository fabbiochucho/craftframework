import type { Config } from '@netlify/functions'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { assessmentLinks, awards, ccaAssessments } from '../../db/schema.js'
import { canAccessOrg, forbidden, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { assessmentWithCraftOrg } from '../lib/nphi.js'

// /api/assessment-links — which of the organisation's awards (grants) each of its assessments is for.
// Assessments: 'craft-onc', 'wizard' (the 5-tier Assessment Wizard), 'cca:<assessment id>', and 'ws:<id>' for an
// NPHI, JEE or SPAR assessment of an institute joined to this organisation (netlify/lib/nphi.ts).
// The grant's funder sees the linked results on its awards (/api/awards/funder).
//   GET ?orgId=                         -> { links: { [assessment]: awardId } }   (anyone who can read the organisation)
//   PUT { orgId, assessment, awardId }  -> link ('' unlinks)                       (the organisation's writers only)
const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    if (req.method === 'GET') {
      const orgId = new URL(req.url).searchParams.get('orgId') ?? ''
      if (!(await canAccessOrg(caller, orgId, 'read'))) return forbidden()
      const rows = await db.select().from(assessmentLinks).where(eq(assessmentLinks.orgId, orgId))
      return Response.json({ links: Object.fromEntries(rows.map((r) => [r.assessment, r.awardId])) })
    }
    if (req.method === 'PUT') {
      const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
      const orgId = String(b.orgId ?? ''), assessment = String(b.assessment ?? ''), awardId = String(b.awardId ?? '')
      if (caller.readOnly || !(await canAccessOrg(caller, orgId, 'write'))) return forbidden()
      const cca = /^cca:(.+)$/.exec(assessment)?.[1]
      const ws = /^ws:(\d+)$/.exec(assessment)?.[1]
      const known = assessment === 'craft-onc' || assessment === 'wizard'
        || (!!ws && (await assessmentWithCraftOrg(Number(ws)))?.craftOrgId === orgId)
        || (!!cca && !!(await db.select({ id: ccaAssessments.id }).from(ccaAssessments).where(and(eq(ccaAssessments.id, cca), eq(ccaAssessments.orgId, orgId))))[0])
      if (!known) return Response.json({ error: 'Unknown assessment' }, { status: 400 })
      if (!awardId) {
        await db.delete(assessmentLinks).where(and(eq(assessmentLinks.orgId, orgId), eq(assessmentLinks.assessment, assessment)))
        return Response.json({ ok: true })
      }
      const [award] = await db.select({ id: awards.id }).from(awards).where(and(eq(awards.id, awardId), eq(awards.orgId, orgId)))
      if (!award) return Response.json({ error: 'That award is not one of this organisation\'s' }, { status: 400 })
      await db.insert(assessmentLinks).values({ orgId, assessment, awardId, linkedBy: caller.email })
        .onConflictDoUpdate({ target: [assessmentLinks.orgId, assessmentLinks.assessment], set: { awardId, linkedBy: caller.email, linkedAt: new Date() } })
      return Response.json({ ok: true })
    }
    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error('/api/assessment-links', 'failed', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const config: Config = { path: '/api/assessment-links' }

export default monitored(handleRequest)
