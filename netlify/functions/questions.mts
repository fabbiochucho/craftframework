import type { Config } from '@netlify/functions'
import { asc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { questions } from '../../db/schema.js'
import { ensureQuestionsSeeded, rowToQuestion } from '../../src/lib/dbSeed.js'
import { logger, monitored } from '../lib/logger.js'
import { mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'

// GET /api/questions — the full assessment question bank, for signed-in users only (the text is private;
// the public code and the demo use the structure-only index plus a sample). Lazily seeds a fresh database
// from the private bank on first call.
const handleRequest = async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    await ensureQuestionsSeeded()
    const rows = await db
      .select()
      .from(questions)
      .orderBy(asc(questions.tier), asc(questions.domain), asc(questions.id))
    return Response.json(rows.map(rowToQuestion))
  } catch (err) {
    logger.error("/api/questions", "GET failed", err)
    return Response.json({ error: 'Failed to load questions' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/questions',
  method: 'GET',
}

export default monitored(handleRequest)
