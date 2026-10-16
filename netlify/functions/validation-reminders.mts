import type { Config } from '@netlify/functions'
import { logger } from '../lib/logger.js'
import { sweepEngagements } from '../lib/engagement-access.js'
import { runLifecycleMaintenance, sendDueReminders } from '../lib/validation-lifecycle.js'

// ============================================================================
// Validator system PR 5 — daily reminders (spec: "Emails to organisation and validator 30 and 7 days
// before each point and before expiry"). Mirrors compliance-alerts.mts: with no RESEND_API_KEY it logs
// instead of sending, and a reminder is recorded only once the provider accepted it, so it is retried
// the next day and never sent twice. Also runs the engagement expiry sweep.
// ============================================================================

export default async () => {
  await sweepEngagements()
  // Checkpoints and the status history first (so the reminders see the right points), then the emails.
  const maintenance = await runLifecycleMaintenance()
  const result = await sendDueReminders()
  logger.info('validation-reminders', `checked ${result.checked}, sent ${result.sent}, failed ${result.failed}, not configured ${result.notConfigured}; checkpoints synced ${maintenance.checkpoints}, status moves ${maintenance.statusMoves}, debrief notices ${maintenance.debriefNotices}`)
  return new Response(JSON.stringify({ ...result, ...maintenance }), { status: result.failed ? 502 : 200, headers: { 'content-type': 'application/json' } })
}

export const config: Config = { schedule: '@daily' }
