import type { Config } from '@netlify/functions'
import { randomUUID } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, screenings } from '../../db/schema.js'
import { canAccessOrg, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { loadLists } from '../lib/official-lists.js'
import { providerName, providerReady, screen } from '../lib/screening-provider.js'
import { cleanSubjects, MANUAL_LISTS, REVIEWS, screeningState, SUBJECT_TYPES, summarise, SYSTEM_REVIEWER } from '../../src/lib/screening.js'

// /api/screening — exclusion, debarment and sanctions screening for an organisation, its leaders and partners.
//   GET  ?orgId=                 organisation (read): results, state, which lists are loaded and when
//   POST { orgId, awardId?, subjects: [{ name, type, country?, birthYear?, registrationNumber? }] }   (write) up to 20 names
//        Free official lists by default. Clear cases are settled by the automatic rules (recorded with the rule);
//        ambiguous name-only matches wait for a person.
//   POST manual { orgId, awardId?, subjectName, subjectType, list, result: clear | found, note }   (write)
//        records a person's check of a debarment list that has no free download (World Bank, AfDB, ADB)
//   PUT  :id { review: confirmed_match | false_positive, note }   (write) a person's decision; also overturns an automatic one

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const subject = z.object({
  name: z.string().max(200), type: z.enum(SUBJECT_TYPES), country: z.string().max(3).optional(),
  birthYear: z.number().int().min(1900).max(2100).optional(), registrationNumber: z.string().max(60).optional(),
}).strict()
const runSchema = z.object({ orgId: z.string().min(1).max(200), awardId: z.string().max(80).nullable().optional(), subjects: z.array(subject).min(1).max(20) }).strict()
const manualSchema = z.object({
  orgId: z.string().min(1).max(200), awardId: z.string().max(80).nullable().optional(), subjectName: z.string().trim().min(2).max(200),
  subjectType: z.enum(SUBJECT_TYPES), list: z.enum(MANUAL_LISTS.map((l) => l.id) as [string, ...string[]]), result: z.enum(['clear', 'found']), note: z.string().trim().min(3).max(2000),
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
    const audit = (orgId: string, action: string, target: string) => db.insert(auditLogs).values({ orgId, actor: caller.email, action, target, category: 'Compliance' })

    if (req.method === 'GET' && !id) {
      const orgId = url.searchParams.get('orgId') ?? ''
      if (!(await canAccessOrg(caller, orgId, 'read'))) return json({ error: 'Forbidden' }, 403)
      const [rows, lists] = await Promise.all([db.select().from(screenings).where(eq(screenings.orgId, orgId)).orderBy(desc(screenings.checkedAt)), loadLists()])
      return json({ provider: providerName(), ready: await providerReady(), lists: lists.status, state: screeningState(rows), results: rows })
    }

    if (req.method === 'POST' && id === 'manual') {
      const p = manualSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Say which list you checked, what you found, and give a note (at least 3 characters).' }, 400)
      if (!(await canAccessOrg(caller, p.data.orgId, 'write'))) return json({ error: 'Forbidden' }, 403)
      const found = p.data.result === 'found'
      const row = {
        id: `scr_${randomUUID()}`, orgId: p.data.orgId, awardId: p.data.awardId ?? null, subjectName: p.data.subjectName, subjectType: p.data.subjectType,
        provider: `manual:${p.data.list}`, status: found ? 'possible_match' : 'clear', matches: [], checkedBy: caller.email,
        ...(found ? { review: 'confirmed_match', reviewNote: p.data.note, reviewedBy: caller.email, reviewedAt: new Date() } : { reviewNote: p.data.note }),
      }
      await db.insert(screenings).values(row)
      await audit(p.data.orgId, `Checked ${p.data.list} list for "${p.data.subjectName}": ${p.data.result}`, row.id)
      return json({ id: row.id }, 201)
    }

    if (req.method === 'POST' && !id) {
      const p = runSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Give between 1 and 20 names, each marked as an organisation or a person.' }, 400)
      if (!(await canAccessOrg(caller, p.data.orgId, 'write'))) return json({ error: 'Forbidden' }, 403)
      const subjects = cleanSubjects(p.data.subjects)
      if (!subjects.length) return json({ error: 'Give at least one name of 2 to 200 characters.' }, 400)
      const r = await screen(subjects)
      if (!r.ok && r.error === 'not_ready') return json({ error: 'The sanctions lists are still being downloaded. Try again in a few minutes.', ready: false }, 503)
      const now = new Date()
      const rows = subjects.map((s, i) => {
        if (!r.ok) return { id: `scr_${randomUUID()}`, orgId: p.data.orgId, awardId: p.data.awardId ?? null, subjectName: s.name, subjectType: s.type, country: s.country ?? '', provider: providerName(), status: 'error', matches: [], checkedBy: caller.email, checkedAt: now }
        const sum = summarise(r.results[i])
        return {
          id: `scr_${randomUUID()}`, orgId: p.data.orgId, awardId: p.data.awardId ?? null, subjectName: s.name, subjectType: s.type, country: s.country ?? '', provider: providerName(),
          status: sum.status, matches: r.results[i], checkedBy: caller.email, checkedAt: now,
          ...(sum.review ? { review: sum.review, reviewNote: sum.note, reviewedBy: SYSTEM_REVIEWER, reviewedAt: now } : {}),
        }
      })
      await db.insert(screenings).values(rows)
      const n = (pred: (x: (typeof rows)[number]) => boolean) => rows.filter(pred).length
      await audit(p.data.orgId, `Screened ${rows.length} name(s): ${n((x) => 'review' in x && x.review === 'confirmed_match')} confirmed automatically, ${n((x) => 'review' in x && x.review === 'false_positive')} dismissed automatically, ${n((x) => x.status === 'possible_match' && !('review' in x))} for a person to review`, 'screenings')
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
      const overturned = row.reviewedBy === SYSTEM_REVIEWER && row.review && row.review !== p.data.review
      await audit(row.orgId, `${overturned ? 'Overturned automatic decision; ' : ''}reviewed screening match for "${row.subjectName}": ${p.data.review}`, id)
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
