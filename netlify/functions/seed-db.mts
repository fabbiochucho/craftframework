import type { Config } from '@netlify/functions'
import { seedQuestions } from '../../src/lib/dbSeed.js'
import { resolveCaller, forbidden, unauthorized, mfaRequired } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'

// POST /api/seed — (re)sync the question bank into the database from the private
// bank (questions-private blob store). Idempotent; questions are upserted by id.
// Run it after uploading a changed bank. Restricted to the Super Admin —
// it's an operational/maintenance action, not something a regular caller needs.
const handleRequest = async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (caller.role !== 'super_admin') return forbidden()
    const seeded = await seedQuestions()
    if (!seeded) return Response.json({ error: 'The private question bank is not available; upload it from craft-internal' }, { status: 503 })
    return Response.json({ ok: true, questions: seeded })
  } catch (err) {
    logger.error("/api/seed", "POST failed", err)
    return Response.json({ error: 'Seeding failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/seed',
  method: 'POST',
}

export default monitored(handleRequest)
