import type { Config } from '@netlify/functions'
import workspaceApi from './workspace-api.mts'

export default async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST, OPTIONS' } })
  }
  return workspaceApi(req)
}

export const config: Config = { path: '/api/support-bot/escalate' }
