import type { Config } from '@netlify/functions'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { invitations } from '../../db/schema.js'
import { resolveCaller, unauthorized, forbidden, mfaRequired, isSuperAdmin } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { audit, dispatchInvitationEmail } from '../lib/invitations.js'

// /api/send-invite — (re)send the branded email for an invitation.
//
// The request names ONLY an invitation ({ invitationId }). The recipient is
// always the stored invitation email, and subject + HTML are rendered from the
// stored record (netlify/lib/invitations.ts), so this endpoint cannot be used to
// send arbitrary content to arbitrary addresses through the workspace's Resend
// account. The caller must be the invitation's inviter (or the super admin), the
// invitation must still be pending and unexpired, and sends are capped per
// caller and per invitation.
//
// RESEND_API_KEY and INVITE_FROM_EMAIL come from Netlify environment variables.
// When either is missing the function degrades gracefully: the invitation
// record already exists, only the transactional send is skipped.
export { SEND_LIMIT_PER_HOUR, SEND_LIMIT_PER_INVITATION } from '../lib/invitations.js'

const json = (body: unknown, status = 200, headers?: Record<string, string>) => Response.json(body, { status, headers })

const handleRequest = async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    // Strict body: exactly { invitationId: string }. Client-supplied to/subject/
    // html (or anything else) is rejected, never honoured.
    let body: unknown
    try { body = await req.json() } catch { body = null }
    const keys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : []
    const invitationId = keys.length === 1 && keys[0] === 'invitationId' ? (body as Record<string, unknown>).invitationId : undefined
    if (typeof invitationId !== 'string' || !invitationId || invitationId.length > 100) {
      return json({ error: 'Body must be exactly { invitationId }' }, 400)
    }
    const [inv] = await db.select().from(invitations).where(eq(invitations.id, invitationId))
    // Same answer for "missing" and "not yours" so ids can't be probed.
    if (!inv || ((inv.inviter ?? '').trim().toLowerCase() !== caller.email && !isSuperAdmin(caller.email))) {
      if (inv) await audit(caller.email, 'Invite email send', `${inv.id} · forbidden`)
      return forbidden()
    }
    const out = await dispatchInvitationEmail(inv, caller.email)
    return json(out.body, out.status, out.headers)
  } catch (err) {
    logger.error('/api/send-invite', 'failed', err)
    return json({ error: 'Send failed' }, 500)
  }
}

export const config: Config = {
  path: '/api/send-invite',
}

export default monitored(handleRequest)
