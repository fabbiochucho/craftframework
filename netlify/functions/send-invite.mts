import type { Config } from '@netlify/functions'
import { resolveCaller, unauthorized } from '../lib/auth.js'

// /api/send-invite — dispatch the branded welcome email for an invitation.
//
// The API key is NEVER hardcoded: it is read from a Netlify environment variable
// (RESEND_API_KEY) that the workspace owner sets in the Netlify UI. When no
// provider is configured the function degrades gracefully — the invitation and
// access-grant records are already persisted by /api/invitations, so the flow
// still works; only the transactional send is skipped. This keeps the invite
// loop functional in preview/local environments without a mail provider.
//
// The client passes the already-rendered subject + html (from
// buildWelcomeEmailHtml) so this function stays light and never imports the
// front-end data module.
export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    // Requires a signed-in caller so this can't be used as an open relay to spam
    // arbitrary addresses through this workspace's Resend account.
    const caller = await resolveCaller()
    if (!caller) return unauthorized()

    const body = await req.json()
    const to = String(body.to ?? '').trim()
    const subject = String(body.subject ?? 'Your invitation')
    const html = String(body.html ?? '')
    if (!to || !html) return Response.json({ error: 'to and html required' }, { status: 400 })

    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.INVITE_FROM_EMAIL || 'CRAFT <onboarding@resend.dev>'
    if (!apiKey) {
      // No provider configured — report (without leaking anything sensitive) that
      // the email was not dispatched. The invitation itself is still valid.
      return Response.json({ dispatched: false, reason: 'no_mail_provider_configured' })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      // Surface a non-sensitive status only; never echo the provider response
      // body or the key.
      console.error('/api/send-invite provider error', res.status)
      return Response.json({ dispatched: false, reason: 'provider_error' }, { status: 502 })
    }
    return Response.json({ dispatched: true })
  } catch (err) {
    console.error('/api/send-invite failed', err)
    return Response.json({ error: 'Send failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/send-invite',
}
