import type { Config } from '@netlify/functions'
import { forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'

// POST /api/monitoring-test — Super Admin only. Sends one deliberate, clearly labelled error through the same
// path as a real function failure (logger.error -> Sentry), so the owner can confirm monitoring end to end.
// Reports { sent: false } when no SENTRY_DSN is configured. Nothing is read or changed.
const handleRequest = async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const caller = await resolveCaller()
  if (!caller) return unauthorized()
  if (!isSuperAdmin(caller.email)) return forbidden()
  const mfaBlock = await mfaRequired(req, caller)
  if (mfaBlock) return mfaBlock
  logger.error('/api/monitoring-test', 'deliberate test error', new Error('Sentry server test error (deliberate, sent by a Super Admin)'))
  return Response.json({ sent: Boolean(process.env.SENTRY_DSN) }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export const config: Config = {
  path: '/api/monitoring-test',
  method: 'POST',
}

export default monitored(handleRequest)
