import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { trainingBaselineAttempts } from '../../db/schema.js'
import { forbidden, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { TRAINING_KEY_STORE, isProgrammeTeam } from '../lib/training.js'
import { askQuestions, learnerView, scoreAttempt, summarise, type BaselineBank, type BaselineKind } from '../../src/lib/trainingBaseline.js'

// /api/training-baseline — pre- and post-tests for the explainer training videos. Practice only: separate from the
// certification exam, never counted towards accreditation. Signed-in only. The bank (questions with answers) is
// private: built in craft-internal/training and uploaded to the training-private blob store as `baseline-bank`.
//   GET                          my results per module (first pre-test, latest post-test)
//   GET  questions/:module/:kind the questions, without answers
//   POST { moduleId, kind, answers }  scored here; the pre-test can be taken once, the post-test retaken
//   GET  summary                 programme team: per-module averages and change, no names

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string) => json({ error }, 400)
const attemptSchema = z.object({
  moduleId: z.string().max(20),
  kind: z.enum(['pre', 'post']),
  answers: z.array(z.number()).min(1).max(20),
}).strict()

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const email = caller.email
    const bank = await getStore(TRAINING_KEY_STORE).get('baseline-bank', { type: 'json' }) as BaselineBank | null
    if (!bank) return json({ error: 'Pre- and post-tests are not set up yet' }, 503)
    const modules = Object.keys(bank)
    const sub = new URL(req.url).pathname.replace(/^\/api\/training-baseline\/?/, '').split('/').filter(Boolean)

    if (req.method === 'GET' && sub.length === 0) {
      const mine = await db.select().from(trainingBaselineAttempts).where(eq(trainingBaselineAttempts.email, email))
      return json({ modules: learnerView(modules, mine) })
    }
    if (req.method === 'GET' && sub[0] === 'questions' && sub.length === 3) {
      const questions = askQuestions(bank, sub[1], sub[2] as BaselineKind)
      return questions && (sub[2] === 'pre' || sub[2] === 'post') ? json({ questions }) : json({ error: 'Not found' }, 404)
    }
    if (req.method === 'GET' && sub[0] === 'summary' && sub.length === 1) {
      if (!(await isProgrammeTeam(email))) return forbidden()
      return json({ modules: summarise(modules, await db.select().from(trainingBaselineAttempts)) })
    }
    if (req.method === 'POST' && sub.length === 0) {
      if (caller.readOnly) return forbidden()
      const p = attemptSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid attempt')
      const { moduleId, kind, answers } = p.data
      if (!Object.hasOwn(bank, moduleId)) return bad('Unknown module')
      const result = scoreAttempt(bank, moduleId, kind, answers)
      if (!result) return bad('Answer every question with one of its options')
      // the first pre-test is the baseline: a unique index allows one per learner and module
      const saved = await db.insert(trainingBaselineAttempts).values({
        id: `tba_${crypto.randomUUID()}`, email, moduleId, kind, score: result.score, total: result.total, answers,
      }).onConflictDoNothing().returning({ id: trainingBaselineAttempts.id })
      if (!saved.length) return json({ error: 'You have already taken this pre-test' }, 409)
      return json(result)
    }
    return json({ error: 'Not found' }, 404)
  } catch (err) {
    logger.error('training-baseline', 'request failed', err)
    return json({ error: 'Request failed' }, 500)
  }
}

export const config: Config = { path: ['/api/training-baseline', '/api/training-baseline/*'] }

export default monitored(handleRequest)
