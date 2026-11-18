import type { Config } from '@netlify/functions'
import { eq, inArray } from 'drizzle-orm'
import { checkProgress } from '../lib/progress.js'
import { db } from '../../db/index.js'
import { responses } from '../../db/schema.js'
import { canAccessOrg, filterAuthorizedOrgIds, resolveCaller, forbidden, unauthorized, mfaRequired } from '../lib/auth.js'
import { independentAssessorOf, isIndependentAssessorOf } from '../lib/independent-assessor.js'
import { logger, monitored } from '../lib/logger.js'

// /api/responses — per-organization assessment scores. The canonical store for
// what used to be the in-memory `scores: Record<orgId, Record<qId, number>>`.
// Every branch first resolves the caller from the verified Identity session and
// scopes the request to org ids that caller is actually allowed to touch, so the
// guessable `self_<email>` tenant id in the request can never reach another
// tenant's data.
// One side of a bulk upload: { qId: score } and { qId: note } into rows, with any problems named.
const QID = /^[A-Za-z0-9._-]{1,64}$/
function bulkPart(scores: unknown, notes: unknown): { rows: Map<string, { score?: number; note?: string }>; problems: string[] } {
  const rows = new Map<string, { score?: number; note?: string }>()
  const problems: string[] = []
  const row = (q: string) => rows.get(q) ?? rows.set(q, {}).get(q)!
  for (const [q, v] of Object.entries(scores && typeof scores === 'object' ? scores as Record<string, unknown> : {})) {
    if (!QID.test(q)) { problems.push(`${q.slice(0, 40)}: not a CRAFT question code`); continue }
    if (v === null || v === '') continue
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0 || n > 5) { problems.push(`${q}: the score must be a whole number from 0 to 5`); continue }
    row(q).score = n
  }
  for (const [q, v] of Object.entries(notes && typeof notes === 'object' ? notes as Record<string, unknown> : {})) {
    if (!QID.test(q)) { problems.push(`${q.slice(0, 40)}: not a CRAFT question code`); continue }
    const t = String(v ?? '').trim()
    if (t.length > 2000) { problems.push(`${q}: the note is longer than 2,000 characters`); continue }
    if (t) row(q).note = t
  }
  if (rows.size > 2000) problems.push('Too many rows in one upload (2,000 at most)')
  return { rows, problems }
}

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock

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
            if (r.selfAt) (scoresByOrg[r.orgId] ??= {})[r.questionId] = r.score
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
      let assessedOn: string | null = null
      for (const r of rows) {
        if (r.selfAt) scores[r.questionId] = r.score
        const d: Record<string, unknown> = {}
        if (r.assessorScore != null) d.assessorScore = r.assessorScore
        if (r.assessorNote) d.assessorNote = r.assessorNote
        if (r.assessorAt) {
          const day = r.assessorAt.toISOString().slice(0, 10)
          d.assessorAt = day
          if (!assessedOn || day > assessedOn) assessedOn = day
        }
        if (r.negotiatedScore != null) d.negotiatedScore = r.negotiatedScore
        if (r.notes != null) d.notes = r.notes
        if (r.evidenceUrl != null) d.evidenceUrl = r.evidenceUrl
        if (r.evidenceName != null) d.evidenceName = r.evidenceName
        if (r.updatedBy != null) d.updatedBy = r.updatedBy
        if (Object.keys(d).length) details[r.questionId] = d
      }
      // Who assessed independently and when: fills the NHOCAT report header.
      const assessor = assessedOn ? await independentAssessorOf(orgId) : null
      return Response.json({ orgId, scores, details, assessor, assessedOn })
    }

    // POST — upsert a single response. The self-score plus any Trust Delta
    // detail fields may be supplied; only the keys present in the body are
    // written, so a facilitated debrief can record a negotiated score and
    // consensus note without clobbering the original self-score (and vice versa).
    // body: { orgId, questionId, score?, assessorScore?, negotiatedScore?,
    //         notes?, evidenceUrl?, evidenceName?, updatedBy? }
    if (req.method === 'POST') {
      const body = await req.json()
      const { orgId, questionId } = body
      if (!orgId || !questionId) {
        return Response.json({ error: 'orgId and questionId required' }, { status: 400 })
      }
      const has = (k: string) => body[k] !== undefined && body[k] !== null
      const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null)
      if (has('assessorNote') && (typeof body.assessorNote !== 'string' || body.assessorNote.length > 2000)) {
        return Response.json({ error: 'The assessor note must be text of at most 2,000 characters' }, { status: 400 })
      }
      if (has('assessedOn') && !(/^\d{4}-\d{2}-\d{2}$/.test(String(body.assessedOn)) && !Number.isNaN(Date.parse(body.assessedOn)) && body.assessedOn <= new Date().toISOString().slice(0, 10))) {
        return Response.json({ error: 'assessedOn must be a date (YYYY-MM-DD) that is not in the future' }, { status: 400 })
      }
      const assessorWrite = has('assessorScore') || body.assessorNote !== undefined
      if (!(await canAccessOrg(caller, orgId))) {
        // An independent assessor (read-only grant) may record only the independent score and its note, as themselves.
        if (!(await isIndependentAssessorOf(caller, orgId))) return forbidden()
        if (!assessorWrite || ['score', 'negotiatedScore', 'notes', 'evidenceUrl', 'evidenceName'].some(has)) {
          return Response.json({ error: 'An independent assessor can record only the independent score' }, { status: 403 })
        }
        body.updatedBy = caller.email
      }
      const { updatedBy } = body

      const set: Record<string, unknown> = { updatedBy: updatedBy ?? null, updatedAt: new Date() }
      if (has('score')) { set.score = Number(body.score) || 0; set.selfAt = new Date() }
      if (has('assessorScore')) set.assessorScore = num(body.assessorScore)
      // '' clears the note. The assessment date is the day given, else today.
      if (body.assessorNote !== undefined) set.assessorNote = body.assessorNote ? String(body.assessorNote).trim() : null
      const assessorAt = assessorWrite ? (has('assessedOn') ? new Date(`${body.assessedOn}T12:00:00Z`) : new Date()) : null
      if (assessorAt) set.assessorAt = assessorAt
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
          selfAt: has('score') ? new Date() : null,
          assessorScore: has('assessorScore') ? num(body.assessorScore) : null,
          assessorNote: body.assessorNote ? String(body.assessorNote).trim() : null,
          assessorAt,
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
      // An organisation answering its own CRAFT-ONC may finish a step of its assessment.
      if (has('score') && String(questionId).startsWith('CRAFT-ONC-')) await checkProgress(orgId)
      return Response.json({ ok: true })
    }

    // PUT — bulk upsert (the Bulk Import and the offline Excel workbook).
    // body: { orgId, scores?: { qId: 0-5 }, notes?: { qId: text },                       the organisation's own answers
    //         assessor?: { scores?: { qId: 0-5 }, notes?: { qId: text }, assessedOn? } } the independent assessment
    // Own answers need write access to the organisation; the independent block needs the organisation's independent
    // assessor (or the Super Admin). The whole upload is checked first: one bad row and nothing is saved.
    if (req.method === 'PUT') {
      const body = await req.json().catch(() => ({}))
      const { orgId } = body
      const own = bulkPart(body.scores, body.notes)
      const ind = body.assessor ? bulkPart(body.assessor.scores, body.assessor.notes) : { rows: new Map(), problems: [] }
      if (!orgId || (!own.rows.size && !ind.rows.size)) return Response.json({ error: 'orgId and at least one answer required' }, { status: 400 })
      const problems = [...own.problems, ...ind.problems]
      const assessedOn = body.assessor?.assessedOn
      if (assessedOn !== undefined && !(typeof assessedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(assessedOn) && assessedOn <= new Date().toISOString().slice(0, 10))) problems.push('assessedOn must be a date (YYYY-MM-DD) that is not in the future')
      if (problems.length) return Response.json({ error: 'Nothing was saved: fix these rows and upload again.', problems: problems.slice(0, 50) }, { status: 400 })
      const writer = await canAccessOrg(caller, orgId)
      if (own.rows.size && !writer) return forbidden()
      if (ind.rows.size && !(caller.role === 'super_admin' || (await isIndependentAssessorOf(caller, orgId)))) return forbidden()
      const now = new Date()
      const assessorAt = assessedOn ? new Date(`${assessedOn}T12:00:00Z`) : now
      await db.transaction(async (tx) => {
        for (const [questionId, r] of own.rows) {
          const set: Record<string, unknown> = { updatedBy: caller.email, updatedAt: now }
          if (r.score !== undefined) { set.score = r.score; set.selfAt = now }
          if (r.note !== undefined) set.notes = r.note || null
          await tx.insert(responses).values({ orgId, questionId, score: r.score ?? 0, selfAt: r.score !== undefined ? now : null, notes: r.note || null, updatedBy: caller.email })
            .onConflictDoUpdate({ target: [responses.orgId, responses.questionId], set })
        }
        for (const [questionId, r] of ind.rows) {
          const set: Record<string, unknown> = { updatedBy: caller.email, updatedAt: now, assessorAt }
          if (r.score !== undefined) set.assessorScore = r.score
          if (r.note !== undefined) set.assessorNote = r.note || null
          await tx.insert(responses).values({ orgId, questionId, score: 0, assessorScore: r.score ?? null, assessorNote: r.note || null, assessorAt, updatedBy: caller.email })
            .onConflictDoUpdate({ target: [responses.orgId, responses.questionId], set })
        }
      })
      if ([...own.rows].some(([q, r]) => r.score !== undefined && q.startsWith('CRAFT-ONC-'))) await checkProgress(orgId)
      return Response.json({ ok: true, count: own.rows.size + ind.rows.size, own: own.rows.size, independent: ind.rows.size })
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

export default monitored(handleRequest)
