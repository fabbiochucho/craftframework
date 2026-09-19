import type { Config } from '@netlify/functions'
import { asc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { questions } from '../../db/schema.js'
import { ensureQuestionsSeeded, rowToQuestion } from '../../src/lib/dbSeed.js'

// GET /api/questions — the assessment question bank, served from the database.
// Lazily seeds the bank from the canonical code definition on first call so a
// fresh database is populated automatically.
export default async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })
  try {
    await ensureQuestionsSeeded()
    const rows = await db
      .select()
      .from(questions)
      .orderBy(asc(questions.tier), asc(questions.domain), asc(questions.id))
    return Response.json(rows.map(rowToQuestion))
  } catch (err) {
    console.error('GET /api/questions failed', err)
    return Response.json({ error: 'Failed to load questions' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/questions',
  method: 'GET',
}
