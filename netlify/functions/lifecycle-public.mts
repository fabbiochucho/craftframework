import type { Config } from '@netlify/functions'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { lifecycleEmails, lifecyclePreferences } from '../../db/schema.js'
import { renderBadgeSvg, badgeFileName } from '../../src/lib/memberBadge.js'
import { parseSurveyAnswer, EDIT_WINDOW_MS } from '../../src/lib/survey.js'
import { firstNameOf } from '../../src/lib/nudgeEmail.js'
import { forbidden, resolveCaller, unauthorized } from '../lib/auth.js'
import { badgeToken, orgBadgeData, preferencesUrl, surveyToken } from '../lib/lifecycle.js'
import { verifyLifecycleToken } from '../lib/lifecycle-token.js'
import { logger } from '../lib/logger.js'
import { optOutSecret } from '../lib/onboarding-nudge.js'
import { editableUntil, getResponse, notifyCallRequest, personContext, saveResponse } from '../lib/survey.js'
import { surveyOccurrence, type LifecycleKind } from '../../src/lib/lifecycle.js'
import { appUrl } from '../lib/onboarding-nudge.js'

// /api/lifecycle/* — the person-facing side of the lifecycle emails. No sign-in: every link is an HMAC-signed token
// made by the server (see netlify/lib/lifecycle-token.ts), so the token is the proof of who is asking.
//   GET  go?t=                    first-party click redirect behind every email button (records the click)
//   GET|POST unsubscribe?t=       one-click 'unsubscribe from these' for the email's category
//   GET|PUT preferences[?t=]      the two categories; by token, or for the signed-in caller without one
//   GET|PUT survey?t=             the in-app feedback survey (one response per token, editable for 24 hours)
//   GET  badge[?t=]               the member badge SVG (token, or the signed-in caller's own organisation)
//   GET  badge-info[?t=]          the badge's data, plus a signed public link when signed in
const noStore = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore })
const page = (title: string, body: string, status = 200) => new Response(
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>` +
  `<body style="margin:0;font-family:Inter,-apple-system,Segoe UI,sans-serif;background:#f8fafc;color:#1e293b"><main style="max-width:480px;margin:15vh auto;padding:0 24px"><h1 style="color:#064e3b;font-size:22px">${title}</h1><p style="line-height:1.6">${body}</p></main></body></html>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8', ...noStore } },
)
const sameOrigin = (req: Request) => { const o = req.headers.get('origin'); return !o || o === new URL(req.url).origin }

const prefsBody = z.object({ checkins: z.boolean(), celebrations: z.boolean() }).strict()

async function preferencesFor(email: string) {
  const [p] = await db.select().from(lifecyclePreferences).where(eq(lifecyclePreferences.email, email)).limit(1)
  return { email, checkins: !p?.checkinsOptedOutAt, celebrations: !p?.celebrationsOptedOutAt }
}

// Who is asking about preferences or the badge: the token's person, or the verified signed-in caller. Never a body field.
async function identify(req: Request, purpose: 'prefs' | 'badge') {
  const t = new URL(req.url).searchParams.get('t')
  if (t) {
    const p = verifyLifecycleToken(t, purpose, optOutSecret())
    return p ? { via: 'token' as const, payload: p } : { via: 'invalid' as const }
  }
  const caller = await resolveCaller()
  return caller ? { via: 'session' as const, caller } : { via: 'none' as const }
}

export default async (req: Request) => {
  try {
    const url = new URL(req.url)
    const sub = url.pathname.replace(/^\/api\/lifecycle\/?/, '')
    const secret = optOutSecret()
    const now = new Date()

    // --- click redirect -----------------------------------------------------------------------------------------
    if (sub === 'go' && req.method === 'GET') {
      const p = verifyLifecycleToken(url.searchParams.get('t'), 'go', secret)
      const to = (path: string) => new Response(null, { status: 302, headers: { Location: path, ...noStore } })
      if (!p?.i) return to('/')
      const [row] = await db.update(lifecycleEmails).set({ clickedAt: sql`coalesce(${lifecycleEmails.clickedAt}, now())` }).where(eq(lifecycleEmails.id, p.i)).returning()
      // Destinations are fixed server-side keys, never a URL from the link, so this cannot be used as an open redirect.
      if (!row) return to('/dashboard')
      if (p.d === 'assessment') return to('/assessment')
      if (p.d === 'survey' && row.sentAt) return to(`/feedback/${surveyToken(secret, row.email, surveyOccurrence(row.kind as LifecycleKind, row.occurrence), row.id, row.sentAt)}`)
      if (p.d === 'badge') return to(`/badge?t=${badgeToken(secret, row.orgId, row.email)}`)
      return to('/dashboard')
    }

    // --- unsubscribe ---------------------------------------------------------------------------------------------
    if (sub === 'unsubscribe' && (req.method === 'GET' || req.method === 'POST')) {
      const p = verifyLifecycleToken(url.searchParams.get('t'), 'unsub', secret)
      if (!p?.e || (p.c !== 'checkins' && p.c !== 'celebrations')) {
        return page('This link is not valid', 'The link may be incomplete or have been changed. Reply to the email and the CRAFT team will stop them for you.', 400)
      }
      const column = p.c === 'checkins' ? { checkinsOptedOutAt: now } : { celebrationsOptedOutAt: now }
      await db.insert(lifecyclePreferences).values({ email: p.e, ...column, updatedAt: now })
        .onConflictDoUpdate({ target: lifecyclePreferences.email, set: { ...column, updatedAt: now } })
      if (p.i) await db.update(lifecycleEmails).set({ unsubscribedAt: sql`coalesce(${lifecycleEmails.unsubscribedAt}, now())` }).where(eq(lifecycleEmails.id, p.i))
      const what = p.c === 'checkins' ? 'check-in and feedback' : 'celebration'
      const prefs = appUrl() ? preferencesUrl(appUrl(), secret, p.e) : '/email-preferences'
      return page('You’re unsubscribed', `You will not receive any more ${what} emails from CRAFT. Welcome, security, invitation and validation emails are not affected. <a href="${prefs}" style="color:#059669">Change your email preferences</a>.`)
    }

    // --- preferences ---------------------------------------------------------------------------------------------
    if (sub === 'preferences' && (req.method === 'GET' || req.method === 'PUT')) {
      const who = await identify(req, 'prefs')
      if (who.via === 'invalid') return json({ error: 'This link is not valid.' }, 403)
      if (who.via === 'none') return unauthorized()
      const email = who.via === 'token' ? who.payload.e! : who.caller.email
      if (req.method === 'GET') return json(await preferencesFor(email))
      if (!sameOrigin(req)) return forbidden()
      const parsed = prefsBody.safeParse(await req.json().catch(() => null))
      if (!parsed.success) return json({ error: 'Invalid request body' }, 400)
      const current = await db.select().from(lifecyclePreferences).where(eq(lifecyclePreferences.email, email)).limit(1)
      const stamp = (receiving: boolean, was: Date | null | undefined) => (receiving ? null : was ?? now)
      const set = {
        checkinsOptedOutAt: stamp(parsed.data.checkins, current[0]?.checkinsOptedOutAt),
        celebrationsOptedOutAt: stamp(parsed.data.celebrations, current[0]?.celebrationsOptedOutAt), updatedAt: now,
      }
      await db.insert(lifecyclePreferences).values({ email, ...set }).onConflictDoUpdate({ target: lifecyclePreferences.email, set })
      return json(await preferencesFor(email))
    }

    // --- survey --------------------------------------------------------------------------------------------------
    if (sub === 'survey' && (req.method === 'GET' || req.method === 'PUT')) {
      const p = verifyLifecycleToken(url.searchParams.get('t'), 'survey', secret, now)
      if (!p?.e || !p.o) return json({ error: 'This survey link is not valid or has expired. Reply to the email and we will send a new one.' }, 403)
      const existing = await getResponse(p.e, p.o)
      const open = !existing || now.getTime() < existing.createdAt.getTime() + EDIT_WINDOW_MS
      if (req.method === 'GET') {
        const ctx = await personContext(p.e)
        return json({
          firstName: firstNameOf(ctx.name, p.e), orgName: ctx.orgName || null,
          state: !existing ? 'open' : open ? 'editable' : 'closed',
          editableUntil: existing && open ? editableUntil(existing).toISOString() : null,
          answer: existing && open ? { nps: existing.nps, ease: existing.ease, usedMost: existing.usedMost, improve: existing.improve, wantsCall: existing.wantsCall, callTimes: existing.callTimes } : null,
        })
      }
      if (!sameOrigin(req)) return forbidden()
      if (!open) return json({ error: 'Thank you, we already have your answers. They can only be changed for 24 hours after sending.' }, 409)
      const parsed = parseSurveyAnswer(await req.json().catch(() => null))
      if (!parsed.ok) return json({ error: parsed.error }, 400)
      const row = await saveResponse(p.e, p.o, p.i, parsed.answer, now)
      const notified = await notifyCallRequest(row).catch((err) => { logger.error('/api/lifecycle', 'call request email failed', err); return false })
      return json({ ok: true, editableUntil: editableUntil(row).toISOString(), callRequested: row.wantsCall, callNotified: notified })
    }

    // --- badge ---------------------------------------------------------------------------------------------------
    if ((sub === 'badge' || sub === 'badge-info') && req.method === 'GET') {
      const who = await identify(req, 'badge')
      if (who.via === 'invalid') return json({ error: 'This badge link is not valid.' }, 403)
      if (who.via === 'none') return unauthorized()
      const orgId = who.via === 'token' ? who.payload.g! : who.caller.orgId
      const email = who.via === 'token' ? who.payload.e! : who.caller.email
      const data = await orgBadgeData(orgId, email, now)
      if (!data) return json({ error: 'Your badge is available once you have finished setting up your workspace.' }, 404)
      const svg = renderBadgeSvg(data)
      if (sub === 'badge') {
        return new Response(svg, { headers: {
          'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'private, max-age=300',
          ...(url.searchParams.get('download') ? { 'content-disposition': `attachment; filename="${badgeFileName(data.orgName, data.year)}.svg"` } : {}),
        } })
      }
      return json({
        ...data, fileName: badgeFileName(data.orgName, data.year), svg,
        // A signed public link the organisation can share or embed: anyone with it sees the badge, nothing else.
        shareToken: secret ? badgeToken(secret, orgId, email) : null,
      })
    }

    return req.method === 'GET' || req.method === 'POST' || req.method === 'PUT' ? json({ error: 'Not found' }, 404) : new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error('/api/lifecycle', 'failed', err)
    return json({ error: 'Request failed' }, 500)
  }
}

export const config: Config = { path: ['/api/lifecycle/*'] }
