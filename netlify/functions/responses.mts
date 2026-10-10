import type { Config } from '@netlify/functions'
import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { responses } from '../../db/schema.js'
import { canAccessOrg, filterAuthorizedOrgIds, resolveCaller, forbidden, unauthorized } from '../lib/auth.js'
import { logger } from '../lib/logger.js'

// /api/responses — per-organization assessment scores. The canonical store for
// what used to be the in-memory `scores: Record<orgId, Record<qId, number>>`.
// Every branch first resolves the caller from the verified Identity session and
// scopes the request to org ids that caller is actually allowed to touch, so the
// guessable `self_<email>` tenant id in the request can never reach another
// tenant's data.
export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()

    if (req.method === 'GET') {
      const params = new URL(req.url).searchParams
      const orgId = params.get('orgId')
      // Batch read — a Portfolio Reviewer loads scores for every institution in
      // their portfolio in a single round-trip. Returns { scoresByOrg }, gated so
      // a reviewer only ever sees orgs they hold live access to. Authorization is
      // keyed off the VERIFIED caller, not a client-supplied `requester`.
      const orgIdsParam = params.get('orgIds')
      if (orgIdsParam) {
        const requestedIds = orgIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
        const ids = await filterAuthorizedOrgIds(caller, requestedIds)
        const scoresByOrg: Record<string, Record<string, number>> = {}
        if (ids.length) {
          const rows = await db.select().from(responses).where(inArray(responses.orgId, ids))
          for (const r of rows) {
            ;(scoresByOrg[r.orgId] ??= {})[r.questionId] = r.score
          }
        }
        return Response.json({ scoresByOrg })
      }
      if (!orgId) return Response.json({ error: 'orgId required' }, { status: 400 })
      if (!(await canAccessOrg(caller, orgId, 'read'))) return forbidden()
      const rows = await db.select().from(responses).where(eq(responses.orgId, orgId))
      const scores: Record<string, number> = {}
      // `details` surfaces the Trust Delta columns (assessor / negotiated scores,
      // consensus notes, evidence) alongside the flat self-score map. Only
      // populated keys are emitted so the payload stays lean.
      const details: Record<string, Record<string, unknown>> = {}
      for (const r of rows) {
        scores[r.questionId] = r.score
        const d: Record<string, unknown> = {}
        if (r.assessorScore != null) d.assessorScore = r.assessorScore
        if (r.negotiatedScore != null) d.negotiatedScore = r.negotiatedScore
        if (r.notes != null) d.notes = r.notes
        if (r.evidenceUrl != null) d.evidenceUrl = r.evidenceUrl
        if (r.evidenceName != null) d.evidenceName = r.evidenceName
        if (r.updatedBy != null) d.updatedBy = r.updatedBy
        if (Object.keys(d).length) details[r.questionId] = d
      }
      return Response.json({ orgId, scores, details })
    }

    // POST — upsert a single response. The self-score plus any Trust Delta
    // detail fields may be supplied; only the keys present in the body are
    // written, so a facilitated debrief can record a negotiated score and
    // consensus note without clobbering the original self-score (and vice versa).
    // body: { orgId, questionId, score?, assessorScore?, negotiatedScore?,
    //         notes?, evidenceUrl?, evidenceName?, updatedBy? }
    if (req.method === 'POST') {
      const body = await req.json()
      const { orgId, questionId, updatedBy } = body
      if (!orgId || !questionId) {
        return Response.json({ error: 'orgId and questionId required' }, { status: 400 })
      }
      if (!(await canAccessOrg(caller, orgId))) return forbidden()
      const has = (k: string) => body[k] !== undefined && body[k] !== null
      const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null)

      const set: Record<string, unknown> = { updatedBy: updatedBy ?? null, updatedAt: new Date() }
      if (has('score')) set.score = Number(body.score) || 0
      if (has('assessorScore')) set.assessorScore = num(body.assessorScore)
      if (has('negotiatedScore')) set.negotiatedScore = num(body.negotiatedScore)
      if (has('notes')) set.notes = body.notes
      if (has('evidenceUrl')) set.evidenceUrl = body.evidenceUrl
      if (has('evidenceName')) set.evidenceName = body.evidenceName

      await db
        .insert(responses)
        .values({
          orgId,
          questionId,
          score: Number(body.score) || 0,
          assessorScore: has('assessorScore') ? num(body.assessorScore) : null,
          negotiatedScore: has('negotiatedScore') ? num(body.negotiatedScore) : null,
          notes: has('notes') ? body.notes : null,
          evidenceUrl: has('evidenceUrl') ? body.evidenceUrl : null,
          evidenceName: has('evidenceName') ? body.evidenceName : null,
          updatedBy: updatedBy ?? null,
        })
        .onConflictDoUpdate({
          target: [responses.orgId, responses.questionId],
          set,
        })
      return Response.json({ ok: true })
    }

    // PUT — bulk upsert. body: { orgId, scores: { qId: score } }
    if (req.method === 'PUT') {
      const { orgId, scores } = await req.json()
      if (!orgId || !scores) {
        return Response.json({ error: 'orgId and scores required' }, { status: 400 })
      }
      if (!(await canAccessOrg(caller, orgId))) return forbidden()
      const entries = Object.entries(scores as Record<string, number>)
      if (entries.length) {
        await db
          .insert(responses)
          .values(entries.map(([questionId, score]) => ({ orgId, questionId, score: Number(score) || 0 })))
          .onConflictDoUpdate({
            target: [responses.orgId, responses.questionId],
            set: { score: sql`excluded.score`, updatedAt: new Date() },
          })
      }
      return Response.json({ ok: true, count: entries.length })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error("/api/responses", "failed", err)
    return Response.json({ error: 'Response request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/responses',
}
