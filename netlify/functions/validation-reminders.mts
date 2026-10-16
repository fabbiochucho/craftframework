import type { Config } from '@netlify/functions'
import { logger } from '../lib/logger.js'
import { sweepEngagements } from '../lib/engagement-access.js'
import { sendDueReminders } from '../lib/validation-lifecycle.js'

// ============================================================================
// Validator system PR 5 — daily reminders (spec: "Emails to organisation and validator 30 and 7 days
// before each point and before expiry"). Mirrors compliance-alerts.mts: with no RESEND_API_KEY it logs
// instead of sending, and a reminder is recorded only once the provider accepted it, so it is retried
// the next day and never sent twice. Also runs the engagement expiry sweep.
// ============================================================================

export default async () => {
  await sweepEngagements()
  const result = await sendDueReminders()
  logger.info('validation-reminders', `checked ${result.checked}, sent ${result.sent}, failed ${result.failed}, not configured ${result.notConfigured}`)
  return new Response(JSON.stringify(result), { status: result.failed ? 502 : 200, headers: { 'content-type': 'application/json' } })
}

export const config: Config = { schedule: '@daily' }
