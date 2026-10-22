import { monitored } from '../lib/logger.js'
import type { Config } from '@netlify/functions'
import workspaceApi from './workspace-api.mts'

const handleRequest = async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST, OPTIONS' } })
  }
  return workspaceApi(req)
}

export const config: Config = { path: '/api/support-bot/escalate' }

export default monitored(handleRequest)
