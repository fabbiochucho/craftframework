import type { Config } from '@netlify/functions'
import { seedQuestions } from '../../src/lib/dbSeed.js'

// POST /api/seed — (re)seed the question bank into the database. Idempotent;
// questions are upserted by id. The bank also seeds lazily on the first GET
// /api/questions, so calling this is optional.
export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const seeded = await seedQuestions()
    return Response.json({ ok: true, questions: seeded })
  } catch (err) {
    console.error('POST /api/seed failed', err)
    return Response.json({ error: 'Seeding failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/seed',
  method: 'POST',
}
