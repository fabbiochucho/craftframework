import type { Config } from '@netlify/functions'
import { logger } from '../lib/logger.js'
import { backfillValidations, sendDueReminders, sendPendingDebriefNotices, sweepValidations } from '../lib/validation-lifecycle.js'

// ============================================================================
// CRAFT validator system — daily lifecycle run (PR 5)
// ----------------------------------------------------------------------------
// Runs daily, like compliance-alerts.mts:
//   1. gives any review finalised before the lifecycle shipped its validation record,
//   2. moves statuses with the clock (follow-up overdue, expired; a missed month-12
//      surveillance check expires a 24-month validation at 12),
//   3. emails the organisation and the validator 30 and 7 days before each verification
//      point and before expiry (once per point and threshold),
//   4. emails the organisation that a debrief is open, for any not yet notified.
// With no RESEND_API_KEY configured it logs what it WOULD send. Idempotent: running it twice
// the same day changes and sends nothing more.
// ============================================================================

export default async (req: Request) => {
  const next_run = await req.json().then((b: { next_run?: string }) => b?.next_run).catch(() => undefined)
  const now = new Date()
  try {
    const backfilled = await backfillValidations()
    const sweep = await sweepValidations(now)
    const reminders = await sendDueReminders(now)
    const debriefs = await sendPendingDebriefNotices()
    console.log(`[validation-reminders] backfilled ${backfilled}, checked ${sweep.checked}, changed ${sweep.changed}, reminders sent ${reminders.sent}, debrief notices ${debriefs}. Next run: ${next_run ?? 'n/a'}`)
    return new Response(JSON.stringify({ backfilled, ...sweep, reminders, debriefNotices: debriefs }), {
      status: reminders.failed ? 502 : 200, headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    logger.error('validation-reminders', 'daily run failed', err)
    return new Response(JSON.stringify({ error: 'Daily validation run failed' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const config: Config = { schedule: '@daily' }
