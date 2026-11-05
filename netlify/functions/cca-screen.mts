import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, ccaScreens } from '../../db/schema.js'
import { canAccessOrg, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { OUTCOME_LABEL, scoreScreen, screenProblems, validAnswer, type QuickScreen } from '../../src/lib/cca/quickScreen.js'
const CCA_STORE = 'cca-private' // same private store as the module content (cca.mts)

// /api/cca-screen — the quick pre-award screen.
//   GET    content                    signed-in: the questions (private, blob store cca-private, key screen)
//   GET    ?orgId=                    organisation members (read): its screens
//   POST   { orgId, awardRef }        (write) start a screen for an award (one per award)
//   PUT    :id { answers?, notes? }   (write) while draft; answers merge and must fit the questions
//   POST   :id/complete               (write) every question answered; the score and outcome are kept

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const createSchema = z.object({ orgId: z.string().min(1).max(200), awardRef: z.string().trim().min(1).max(120) }).strict()
const putSchema = z.object({ answers: z.record(z.string().max(80), z.string().max(80)).optional(), notes: z.string().max(4000).optional() }).strict()

async function content(): Promise<QuickScreen | null> {
  const s = await getStore(CCA_STORE).get('screen', { type: 'json' }) as QuickScreen | null
  return s && !screenProblems(s).length ? s : null
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
    const [idOrSub, action] = url.pathname.replace(/^\/api\/cca-screen\/?/, '').split('/')

    if (req.method === 'GET' && idOrSub === 'content') {
      const s = await content()
      return s ? json({ screen: s }) : json({ error: 'The quick screen has not been published yet.' }, 503)
    }

    if (req.method === 'GET' && !idOrSub) {
      const orgId = url.searchParams.get('orgId') ?? ''
      if (!(await canAccessOrg(caller, orgId, 'read'))) return json({ error: 'Forbidden' }, 403)
      return json({ screens: await db.select().from(ccaScreens).where(eq(ccaScreens.orgId, orgId)).orderBy(desc(ccaScreens.createdAt)) })
    }

    if (req.method === 'POST' && !idOrSub) {
      const p = createSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Name the grant or contract this screen is for.' }, 400)
      if (!(await canAccessOrg(caller, p.data.orgId, 'write'))) return json({ error: 'Forbidden' }, 403)
      const id = `scr_${randomUUID()}`
      const inserted = await db.insert(ccaScreens).values({ id, orgId: p.data.orgId, awardRef: p.data.awardRef, createdBy: caller.email })
        .onConflictDoNothing().returning({ id: ccaScreens.id })
      if (!inserted.length) return json({ error: 'There is already a quick screen for this award.' }, 409)
      await db.insert(auditLogs).values({ orgId: p.data.orgId, actor: caller.email, action: `Started quick pre-award screen (${p.data.awardRef})`, target: id, category: 'Assessment' })
      return json({ id }, 201)
    }

    const [row] = idOrSub ? await db.select().from(ccaScreens).where(eq(ccaScreens.id, idOrSub)) : []
    if (!row) return json({ error: 'Not found' }, 404)
    if (!(await canAccessOrg(caller, row.orgId, req.method === 'GET' ? 'read' : 'write'))) return json({ error: 'Forbidden' }, 403)
    if (req.method === 'GET' && !action) return json({ screen: row })
    if (row.status === 'complete') return json({ error: 'This screen is complete and can no longer change.' }, 409)
    const s = await content()
    if (!s) return json({ error: 'The quick screen has not been published yet.' }, 503)
    const questions = new Map(s.sections.flatMap((x) => x.questions).map((q) => [q.id, q]))

    if (req.method === 'PUT' && !action) {
      const p = putSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Some answers could not be saved.' }, 400)
      const answers = p.data.answers ?? {}
      if (Object.entries(answers).some(([id, a]) => !questions.has(id) || !validAnswer(questions.get(id)!, a))) return json({ error: 'Some answers do not match the questions.' }, 400)
      await db.update(ccaScreens).set({
        ...(p.data.answers ? { answers: { ...row.answers, ...answers } } : {}), ...(p.data.notes !== undefined ? { notes: p.data.notes } : {}), updatedAt: new Date(),
      }).where(and(eq(ccaScreens.id, row.id), eq(ccaScreens.status, 'draft')))
      return json({ ok: true })
    }

    if (req.method === 'POST' && action === 'complete') {
      const r = scoreScreen(s, row.answers)
      if (r.unanswered) return json({ error: `Answer every question first (${r.unanswered} left).` }, 400)
      await db.transaction(async (tx) => {
        await tx.update(ccaScreens).set({ status: 'complete', score: r.score, maxScore: r.max, outcome: r.outcome, completedAt: new Date(), updatedAt: new Date() }).where(eq(ccaScreens.id, row.id))
        await tx.insert(auditLogs).values({ orgId: row.orgId, actor: caller.email, action: `Completed quick pre-award screen (${row.awardRef}): ${r.percent}%, ${OUTCOME_LABEL[r.outcome]}`, target: row.id, category: 'Assessment' })
      })
      return json({ ok: true, result: r })
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    logger.error('cca-screen', 'request failed', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
}

export const config: Config = { path: ['/api/cca-screen', '/api/cca-screen/*'] }

export default monitored(handleRequest)
