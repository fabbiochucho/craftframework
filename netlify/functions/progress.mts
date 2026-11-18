import type { Config } from '@netlify/functions'
import { db } from '../../db/index.js'
import { orgProgress } from '../../db/schema.js'
import { canAccessOrg, forbidden, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { checkProgress, stepsFor } from '../lib/progress.js'

// /api/progress — an organisation's assessment steps.
//   GET ?orgId=                      -> { steps }  anyone who can read the organisation
//   POST { orgId, wizardDone: true } -> the organisation says its 5-tier wizard is fully answered (its writers only);
//                                       may send the step message (netlify/lib/progress.ts)
const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    if (req.method === 'GET') {
      const orgId = new URL(req.url).searchParams.get('orgId') ?? ''
      if (!(await canAccessOrg(caller, orgId, 'read'))) return forbidden()
      return Response.json({ steps: await stepsFor(orgId) })
    }
    if (req.method === 'POST') {
      const b = (await req.json().catch(() => ({}))) as { orgId?: unknown; wizardDone?: unknown }
      const orgId = String(b.orgId ?? '')
      if (b.wizardDone !== true) return Response.json({ error: 'Nothing to record' }, { status: 400 })
      if (caller.readOnly || !(await canAccessOrg(caller, orgId, 'write'))) return forbidden()
      await db.insert(orgProgress).values({ orgId, wizardDoneAt: new Date() })
        .onConflictDoUpdate({ target: orgProgress.orgId, set: { wizardDoneAt: new Date(), updatedAt: new Date() } })
      await checkProgress(orgId)
      return Response.json({ ok: true })
    }
    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error('/api/progress', 'failed', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const config: Config = { path: '/api/progress' }

export default monitored(handleRequest)
