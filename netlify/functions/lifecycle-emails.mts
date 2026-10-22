import type { Config } from '@netlify/functions'
import { logger } from '../lib/logger.js'
import { runLifecycle } from '../lib/lifecycle.js'

// ============================================================================
// Lifecycle emails: 2-week nudge, 1-month feedback, milestone celebrations and check-ins
// ----------------------------------------------------------------------------
// Runs every day at 09:00 UTC (10:00 in Lagos) but only SENDS on Tuesday, Wednesday and Thursday; on a send day it
// sends everything that fell due since the last one, so nothing is skipped, only delayed. The rules (day 14, day 30,
// months 3/6/12 then every 6, one email per person per 14 days, check-ins after 30 days away at most every 90) live
// in src/lib/lifecycle.ts. The Super Admin's pause switch (lifecycle_settings) is checked on every run, and with
// email not configured nothing is claimed or recorded. One failed send never fails the run.
// ============================================================================
export default async (req: Request) => {
  const next_run = await req.json().then((b: { next_run?: string }) => b?.next_run).catch(() => undefined)
  try {
    const summary = await runLifecycle()
    logger.info('lifecycle-emails', 'run complete', { ...summary, next_run })
    return Response.json(summary)
  } catch (err) {
    // Even a failed run answers 200: a retry of the whole function is not safer than waiting for tomorrow.
    logger.error('lifecycle-emails', 'run failed', err)
    return Response.json({ ran: false, error: 'run failed' })
  }
}

export const config: Config = { schedule: '0 9 * * *' }
