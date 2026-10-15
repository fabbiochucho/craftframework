import type { Config } from '@netlify/functions'
import { retrySupportEscalations } from '../lib/support-escalation.js'

export default async () => {
  await retrySupportEscalations()
}

// Every 4 hours: failed escalations are retried about five times inside the 23-hour window that
// Resend's idempotency keys allow, at a sixth of the hourly function cost.
export const config: Config = { schedule: '0 */4 * * *' }
