import type { Config } from '@netlify/functions'
import { logger, monitored } from '../lib/logger.js'

// Daily: start the background refresh of the official sanctions lists (the downloads take longer than a scheduled
// function may run).
const handleRequest = async () => {
  const base = process.env.URL
  if (!base) return
  try {
    await fetch(`${base}/.netlify/functions/screening-lists-refresh-background`, { method: 'POST', signal: AbortSignal.timeout(10_000) })
  } catch (err) {
    logger.error('screening-lists', 'could not start the background refresh', err)
  }
}

export const config: Config = { schedule: '@daily' }

export default monitored(handleRequest)
