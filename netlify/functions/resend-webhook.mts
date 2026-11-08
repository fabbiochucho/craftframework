import type { Config } from '@netlify/functions'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { invitations } from '../../db/schema.js'
import { audit } from '../lib/invitations.js'
import { logger, monitored } from '../lib/logger.js'

// /api/resend-webhook — Resend reports what happened to an invitation email (sent, delivered, delayed,
// bounced, complained). Signed with Svix: HMAC-SHA256 over "id.timestamp.body" with the endpoint's
// RESEND_WEBHOOK_SECRET ("whsec_..."). Opens and clicks are deliberately not tracked.

const STATUS: Record<string, string> = {
  'email.sent': 'sent', 'email.delivered': 'delivered', 'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced', 'email.complained': 'complained',
}
const TOLERANCE_S = 300

/** True when `signatures` ("v1,<b64> v1,<b64>") holds a valid signature for this message. */
export function verifySvix(secret: string, id: string, timestamp: string, body: string, signatures: string, nowS = Date.now() / 1000): boolean {
  if (!secret || !id || !timestamp || !signatures) return false
  if (Math.abs(nowS - Number(timestamp)) > TOLERANCE_S) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest()
  return signatures.split(' ').some((s) => {
    const given = Buffer.from(s.split(',')[1] ?? '', 'base64')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

const handleRequest = async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const body = await req.text()
  const h = (k: string) => req.headers.get(k) ?? ''
  if (!verifySvix(process.env.RESEND_WEBHOOK_SECRET ?? '', h('svix-id'), h('svix-timestamp'), body, h('svix-signature'))) {
    return new Response('Invalid signature', { status: 401 })
  }
  const event = JSON.parse(body) as { type?: string; created_at?: string; data?: { email_id?: string } }
  const status = STATUS[event.type ?? '']
  const emailId = event.data?.email_id
  if (!status || !emailId) return Response.json({ ignored: true })
  const [inv] = await db.select().from(invitations).where(eq(invitations.emailId, emailId))
  // Other CRAFT emails share the Resend account; only invitations are tracked.
  if (!inv) return Response.json({ ignored: true })
  // 'sent' never overwrites a later status that arrived first.
  if (status !== 'sent' || !inv.deliveryStatus || inv.deliveryStatus === 'sent') {
    await db.update(invitations).set({ deliveryStatus: status, deliveryAt: new Date(event.created_at ?? Date.now()) }).where(eq(invitations.id, inv.id))
  }
  await audit('resend', `Invitation email ${status}`, `${inv.id} · ${inv.email}`)
  if (status === 'bounced' || status === 'complained') logger.warn('resend-webhook', `invitation email ${status}`, { invitationId: inv.id })
  return Response.json({ ok: true })
}

export const config: Config = { path: '/api/resend-webhook' }

export default monitored(handleRequest)
