import type { Config } from '@netlify/functions'
import { db } from '../../db/index.js'
import { onboardingOptouts } from '../../db/schema.js'
import { logger } from '../lib/logger.js'
import { optOutSecret, verifyOptOutToken } from '../lib/onboarding-nudge.js'

// /api/onboarding-optout?t=<signed token> — the one-click 'stop these reminders' link in the nudge email.
// No sign-in: the HMAC-signed token (made only by the server, for one address) is the proof. A GET records
// the opt-out so the link works from any mail client in a single click; a mail scanner that opens it only
// ever stops reminders, which is the safe direction to fail in. A POST (RFC 8058 one-click) does the same.
const page = (title: string, body: string, status = 200) => new Response(
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>` +
  `<body style="margin:0;font-family:Inter,-apple-system,Segoe UI,sans-serif;background:#f8fafc;color:#1e293b"><main style="max-width:480px;margin:15vh auto;padding:0 24px"><h1 style="color:#064e3b;font-size:22px">${title}</h1><p style="line-height:1.6">${body}</p></main></body></html>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } },
)

export default async (req: Request) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
    const email = verifyOptOutToken(new URL(req.url).searchParams.get('t'), optOutSecret())
    if (!email) return page('This link is not valid', 'The link may be incomplete or have been changed. If you still receive these reminders, reply to one of the emails and the CRAFT team will stop them.', 400)
    await db.insert(onboardingOptouts).values({ email }).onConflictDoNothing()
    return page('Reminders stopped', 'You will not receive any more “finish setting up your workspace” emails from CRAFT. You can still sign in and finish setting up whenever you like.')
  } catch (err) {
    logger.error('/api/onboarding-optout', 'failed', err)
    return page('Something went wrong', 'We could not record your choice. Please try the link again, or reply to the email and we will do it for you.', 500)
  }
}

export const config: Config = { path: '/api/onboarding-optout' }
