import type { Config } from '@netlify/functions'
import { and, eq, gt, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, onboardingNudges } from '../../db/schema.js'
import { forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { buildAnalytics, onboardingPeople, type OnboardingPerson } from '../lib/admin-analytics.js'
import { logger, monitored } from '../lib/logger.js'
import {
  appUrl, nextNudgeAllowedAt, nudgeBlock, optOutSecret, PENDING_STALE_MS, signOptOutToken, type NudgeBlock,
} from '../lib/onboarding-nudge.js'
import { sendReminderEmail } from '../lib/reminder-email.js'
import { parseRange } from '../../src/lib/adminAnalytics.js'
import { NUDGE_NOTE_MAX, renderNudgeEmail } from '../../src/lib/nudgeEmail.js'

// /api/admin-analytics — the Super Admin analytics dashboard and the resume-onboarding emails. Super Admin only
// (the server allowlist, never a client field), with the same multi-factor rule as the other admin endpoints.
//   GET  ?range=7|30|90|all        every dashboard section, from CRAFT's own database
//   POST nudges/preview            { emails, note? }  the email each person would get, and whether they may be emailed
//   POST nudges/send               { emails, note? }  send it to those who may be emailed

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const MAX_RECIPIENTS = 25
const bodySchema = z.object({
  emails: z.array(z.string().trim().toLowerCase().email().max(320)).min(1).max(MAX_RECIPIENTS),
  // eslint-disable-next-line no-control-regex
  note: z.string().max(NUDGE_NOTE_MAX).transform((s) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim()).optional(),
}).strict()

const REASON_TEXT: Record<NudgeBlock, string> = {
  completed: 'Already finished onboarding',
  opted_out: 'Asked not to get these reminders',
  not_started: 'Has not started onboarding',
  too_soon: 'Emailed within the last 7 days',
}

function configuration() {
  const missing = [!optOutSecret() && 'ONBOARDING_OPTOUT_SECRET', !appUrl() && 'APP_URL'].filter((x): x is string => !!x)
  return { configured: missing.length === 0, missing }
}

function render(person: OnboardingPerson, note: string | undefined, replyTo: string) {
  const secret = optOutSecret()
  const optOutUrl = `${appUrl() || 'https://example.invalid'}/api/onboarding-optout?t=${secret ? signOptOutToken(person.email, secret) : 'unavailable'}`
  const mail = renderNudgeEmail({
    name: person.name, email: person.email, orgName: person.orgName, startedAt: person.startedAtDate, step: person.step,
    note, appUrl: appUrl() || 'https://example.invalid', optOutUrl,
  })
  return { ...mail, optOutUrl, replyTo }
}

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    if (!isSuperAdmin(caller.email) || caller.role !== 'super_admin' || caller.readOnly) return forbidden()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock

    const url = new URL(req.url)
    const sub = url.pathname.replace(/^\/api\/admin-analytics\/?/, '')

    if (req.method === 'GET' && sub === '') {
      return json(await buildAnalytics(parseRange(url.searchParams.get('range'))))
    }

    if (req.method === 'POST' && (sub === 'nudges/preview' || sub === 'nudges/send')) {
      const origin = req.headers.get('origin')
      if (origin && origin !== url.origin) return forbidden()
      const parsed = bodySchema.safeParse(await req.json().catch(() => null))
      if (!parsed.success) return json({ error: 'Choose between 1 and 25 people, and keep any note under 600 characters.' }, 400)
      const emails = [...new Set(parsed.data.emails)]
      const note = parsed.data.note || undefined
      const now = new Date()
      const config = configuration()

      if (sub === 'nudges/preview') {
        const people = new Map((await onboardingPeople(now, emails)).map((p) => [p.email, p]))
        return json({
          ...config, subject: 'Finish setting up your CRAFT workspace', replyTo: caller.email,
          previews: emails.map((email) => {
            const p = people.get(email)
            if (!p) return { email, eligible: false, reason: 'not_started', reasonText: REASON_TEXT.not_started }
            const block = nudgeBlock({ started: true, completed: p.completed, optedOut: p.optedOut, lastNudgeAt: p.lastNudgeAtDate, now })
            const mail = render(p, note, caller.email)
            return {
              email, name: p.name, orgName: p.orgName, step: p.step, stepName: p.stepName,
              eligible: block === null, reason: block, reasonText: block ? REASON_TEXT[block] : null,
              nextAllowedAt: block === 'too_soon' && p.lastNudgeAtDate ? nextNudgeAllowedAt(p.lastNudgeAtDate).toISOString() : null,
              subject: mail.subject, html: mail.html, text: mail.text,
            }
          }),
        })
      }

      // Send. Nothing is claimed or recorded when the deployment is not set up to send.
      if (!config.configured) return json({ error: 'not_configured', missing: config.missing }, 503)
      const results: Array<{ email: string; outcome: string; reason?: string; reasonText?: string }> = []
      for (const email of emails) {
        // One send at a time per address: the lock makes "check the last nudge, then record this one" atomic.
        const claim = await db.transaction(async (tx): Promise<{ refused: NudgeBlock } | { refused?: undefined; id: string; person: OnboardingPerson }> => {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'onboarding-nudge:' + email}))`, 'objects')
          const [p] = await onboardingPeople(now, [email])
          if (!p) return { refused: 'not_started' as NudgeBlock }
          const recent = await tx.select({ sentAt: onboardingNudges.sentAt }).from(onboardingNudges).where(and(
            eq(onboardingNudges.email, email),
            or(eq(onboardingNudges.outcome, 'accepted'), and(eq(onboardingNudges.outcome, 'pending'), gt(onboardingNudges.sentAt, new Date(now.getTime() - PENDING_STALE_MS)))),
          ))
          const lastNudgeAt = recent.reduce<Date | null>((a, r) => (!a || r.sentAt > a ? r.sentAt : a), null)
          const block = nudgeBlock({ started: true, completed: p.completed, optedOut: p.optedOut, lastNudgeAt, now })
          if (block) return { refused: block }
          const id = `nud_${crypto.randomUUID()}`
          await tx.insert(onboardingNudges).values({
            id, email, sentBy: caller.email, sentAt: now, step: p.step, stepName: p.stepName, hasNote: !!note, outcome: 'pending',
          })
          return { id, person: p }
        })
        if (claim.refused) {
          results.push({ email, outcome: 'refused', reason: claim.refused, reasonText: REASON_TEXT[claim.refused] })
          continue
        }
        const mail = render(claim.person, note, caller.email)
        const outcome = await sendReminderEmail({
          to: email, subject: mail.subject, text: mail.text, html: mail.html, reply_to: caller.email,
          headers: { 'List-Unsubscribe': `<${mail.optOutUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        }, `onboarding-nudge/${claim.id}`, 'onboarding_nudge')
        await db.update(onboardingNudges).set({ outcome }).where(eq(onboardingNudges.id, claim.id))
        await db.insert(auditLogs).values({
          actor: caller.email, action: `Sent resume-onboarding email (${outcome}, was at step ${claim.person.step} of 3)`, target: email, category: 'Onboarding',
        })
        results.push({ email, outcome })
      }
      return json({ results })
    }

    return req.method === 'GET' || req.method === 'POST' ? json({ error: 'Not found' }, 404) : new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error('/api/admin-analytics', 'failed', err)
    return json({ error: 'Analytics request failed' }, 500)
  }
}

export const config: Config = { path: ['/api/admin-analytics', '/api/admin-analytics/*'] }

export default monitored(handleRequest)
