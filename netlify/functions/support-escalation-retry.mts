import type { Config } from '@netlify/functions'
import { retrySupportEscalations } from '../lib/support-escalation.js'

export default async () => {
  await retrySupportEscalations()
}

export const config: Config = { schedule: '@hourly' }
