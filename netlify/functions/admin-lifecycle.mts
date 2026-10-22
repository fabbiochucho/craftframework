import type { Config } from '@netlify/functions'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, surveyResponses } from '../../db/schema.js'
import { forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { isPaused, lifecycleConfig, setPaused } from '../lib/lifecycle.js'
import { history, overview, schedule, surveyResults } from '../lib/lifecycle-admin.js'
import { logger } from '../lib/logger.js'
import { LIFECYCLE_VARIANTS, renderSample } from '../../src/lib/lifecycleEmail.js'
import { SEND_WEEKDAYS } from '../../src/lib/lifecycle.js'

// /api/admin-lifecycle — Super Admin controls for the lifecycle emails (the server allowlist, never a client field,
// with the same multi-factor rule as /api/admin-analytics).
//   GET  /                      status: paused?, configuration, counts per kind, survey response rate, engagement
//   GET  schedule               what falls due in the next 30 days, per kind
//   GET  history[?email=]       what was sent when and the outcome (one person, or the latest 100)
//   GET  preview?id=            any template and variant rendered with sample data
//   GET  survey                 NPS, trend, ease, 'used most', improvements and call requests
//   PUT  pause                  { paused: boolean }
//   PUT  survey/<id>/handled    { handled: boolean }  mark a call request handled
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    if (!isSuperAdmin(caller.email) || caller.role !== 'super_admin' || caller.readOnly) return forbidden()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const url = new URL(req.url)
    const sub = url.pathname.replace(/^\/api\/admin-lifecycle\/?/, '')
    const now = new Date()

    if (req.method === 'GET') {
      if (sub === '') {
        const cfg = lifecycleConfig()
        return json({ paused: await isPaused(), configured: cfg.configured, missing: cfg.missing, sendWeekdays: SEND_WEEKDAYS, ...(await overview(now)) })
      }
      if (sub === 'schedule') return json({ generatedAt: now.toISOString(), horizonDays: 30, kinds: await schedule(now) })
      if (sub === 'history') {
        const email = url.searchParams.get('email')?.trim().toLowerCase() || null
        return json({ email, rows: await history(email) })
      }
      if (sub === 'preview') {
        const mail = renderSample(url.searchParams.get('id') ?? '', lifecycleConfig().appUrl || 'https://craft.example', now)
        return mail ? json(mail) : json({ error: 'Unknown template' }, 404)
      }
      if (sub === 'variants') return json({ variants: LIFECYCLE_VARIANTS })
      if (sub === 'survey') return json(await surveyResults(now))
      return json({ error: 'Not found' }, 404)
    }

    if (req.method === 'PUT') {
      const origin = req.headers.get('origin')
      if (origin && origin !== url.origin) return forbidden()
      if (sub === 'pause') {
        const parsed = z.object({ paused: z.boolean() }).strict().safeParse(await req.json().catch(() => null))
        if (!parsed.success) return json({ error: 'Invalid request body' }, 400)
        await setPaused(parsed.data.paused, caller.email)
        await db.insert(auditLogs).values({ actor: caller.email, action: parsed.data.paused ? 'Paused all lifecycle emails' : 'Resumed lifecycle emails', target: 'lifecycle emails', category: 'Email' })
        return json({ paused: parsed.data.paused })
      }
      const handled = /^survey\/([A-Za-z0-9_-]+)\/handled$/.exec(sub)
      if (handled) {
        const parsed = z.object({ handled: z.boolean() }).strict().safeParse(await req.json().catch(() => null))
        if (!parsed.success) return json({ error: 'Invalid request body' }, 400)
        const [row] = await db.update(surveyResponses)
          .set(parsed.data.handled ? { callHandledAt: now, callHandledBy: caller.email } : { callHandledAt: null, callHandledBy: null })
          .where(eq(surveyResponses.id, handled[1])).returning({ id: surveyResponses.id })
        return row ? json({ id: row.id, handled: parsed.data.handled }) : json({ error: 'Not found' }, 404)
      }
      return json({ error: 'Not found' }, 404)
    }
    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error('/api/admin-lifecycle', 'failed', err)
    return json({ error: 'Request failed' }, 500)
  }
}

export const config: Config = { path: ['/api/admin-lifecycle', '/api/admin-lifecycle/*'] }
