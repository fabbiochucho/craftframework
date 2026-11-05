import type { Config } from '@netlify/functions'
import { randomUUID } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, screenings } from '../../db/schema.js'
import { canAccessOrg, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { PROVIDER, providerConfigured, screen } from '../lib/screening-provider.js'
import { classify, cleanSubjects, REVIEWS, screeningState, SUBJECT_TYPES } from '../../src/lib/screening.js'

// /api/screening — exclusion, debarment and sanctions screening for an organisation, its leaders and partners.
//   GET  ?orgId=                                    organisation (read): results, state, whether screening is switched on
//   POST { orgId, awardId?, subjects: [{ name, type, country? }] }   organisation (write): run, up to 20 names
//   PUT  :id { review: confirmed_match | false_positive, note }     organisation (write): a person's decision on a match
// Nothing is decided automatically: possible matches wait for a person's review.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const runSchema = z.object({
  orgId: z.string().min(1).max(200), awardId: z.string().max(80).nullable().optional(),
  subjects: z.array(z.object({ name: z.string().max(200), type: z.enum(SUBJECT_TYPES), country: z.string().max(3).optional() }).strict()).min(1).max(20),
}).strict()
const reviewSchema = z.object({ review: z.enum(REVIEWS), note: z.string().trim().min(3).max(2000) }).strict()

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const url = new URL(req.url)
    const origin = req.headers.get('origin')
    if (req.method !== 'GET' && origin && origin !== url.origin) return json({ error: 'Forbidden' }, 403)
    const id = url.pathname.replace(/^\/api\/screening\/?/, '')

    if (req.method === 'GET' && !id) {
      const orgId = url.searchParams.get('orgId') ?? ''
      if (!(await canAccessOrg(caller, orgId, 'read'))) return json({ error: 'Forbidden' }, 403)
      const rows = await db.select().from(screenings).where(eq(screenings.orgId, orgId)).orderBy(desc(screenings.checkedAt))
      return json({ configured: providerConfigured(), state: screeningState(rows), results: rows })
    }

    if (req.method === 'POST' && !id) {
      const p = runSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Give between 1 and 20 names, each marked as an organisation or a person.' }, 400)
      if (!(await canAccessOrg(caller, p.data.orgId, 'write'))) return json({ error: 'Forbidden' }, 403)
      const subjects = cleanSubjects(p.data.subjects)
      if (!subjects.length) return json({ error: 'Give at least one name of 2 to 200 characters.' }, 400)
      const r = await screen(subjects)
      if (!r.ok && r.error === 'not_configured') return json({ error: 'Screening is not switched on yet: the screening provider has not been set up.', configured: false }, 503)
      const now = new Date()
      const rows = subjects.map((s, i) => {
        const c = r.ok ? classify(r.results[i]) : { status: 'error' as const, flagged: [] }
        return { id: `scr_${randomUUID()}`, orgId: p.data.orgId, awardId: p.data.awardId ?? null, subjectName: s.name, subjectType: s.type, country: s.country ?? '', provider: PROVIDER, status: c.status, matches: c.flagged, checkedBy: caller.email, checkedAt: now }
      })
      await db.insert(screenings).values(rows)
      const flagged = rows.filter((x) => x.status === 'possible_match').length
      await db.insert(auditLogs).values({ orgId: p.data.orgId, actor: caller.email, action: `Screened ${rows.length} name(s): ${flagged} possible match(es)`, target: 'screenings', category: 'Compliance' })
      return json({ results: rows }, r.ok ? 201 : 502)
    }

    if (req.method === 'PUT' && id) {
      const [row] = await db.select().from(screenings).where(eq(screenings.id, id))
      if (!row) return json({ error: 'Not found' }, 404)
      if (!(await canAccessOrg(caller, row.orgId, 'write'))) return json({ error: 'Forbidden' }, 403)
      if (row.status !== 'possible_match') return json({ error: 'Only a possible match needs a review.' }, 400)
      const p = reviewSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Choose confirmed match or false positive, and say why (at least 3 characters).' }, 400)
      await db.update(screenings).set({ review: p.data.review, reviewNote: p.data.note, reviewedBy: caller.email, reviewedAt: new Date() }).where(eq(screenings.id, id))
      await db.insert(auditLogs).values({ orgId: row.orgId, actor: caller.email, action: `Reviewed screening match for "${row.subjectName}": ${p.data.review}`, target: id, category: 'Compliance' })
      return json({ ok: true })
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    logger.error('screening', 'request failed', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
}

export const config: Config = { path: ['/api/screening', '/api/screening/*'] }

export default monitored(handleRequest)
