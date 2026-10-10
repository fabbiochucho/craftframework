import { createHash } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { db, supportEscalations } from '../../db/index.js'
import { encryptField } from './crypto.js'
import { HttpError } from './orgAccess.js'
import { classifySupportMessage, isPrivateReport, rankSupportFaq, redactSupportMessage } from './support-bot.js'

export async function escalateSupport(body: Record<string, unknown>): Promise<Response> {
  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 5000) {
    throw new HttpError(400, 'message required (maximum 5000 characters)')
  }
  if (body.escalationConsent !== true) throw new HttpError(400, 'Escalation consent required')
  const contactEmail = typeof body.contactEmail === 'string' ? body.contactEmail.trim() : ''
  if (contactEmail.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(contactEmail)) {
    throw new HttpError(400, 'Valid contactEmail required')
  }
  const classification = classifySupportMessage(body.message)
  if (body.classification !== classification.type) throw new HttpError(400, 'Invalid classification')
  const privateReport = isPrivateReport(body.message) || body.privacyLevel === 'private'
  const reason = privateReport ? 'private_report' : body.reason
  if (!privateReport && reason !== 'unresolved_question' && reason !== 'human_requested') {
    throw new HttpError(400, 'Invalid escalation reason')
  }
  if (reason === 'unresolved_question' && (classification.type !== 'question' || rankSupportFaq(body.message))) {
    throw new HttpError(400, 'Question already has an FAQ answer; request human support explicitly')
  }
  const message = redactSupportMessage(body.message)
  const key = createHash('sha256').update(JSON.stringify([message, contactEmail.toLowerCase(), classification.type, reason])).digest('hex')
  const digest = Buffer.from(key, 'hex')
  const recipientType = privateReport ? 'confidential' : 'support_queue'
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${digest.readInt32BE(0)}, ${digest.readInt32BE(4)})`)
    let [entry] = await tx.select().from(supportEscalations).where(eq(supportEscalations.key, key))
    if (!entry) {
      ;[entry] = await tx.insert(supportEscalations).values({
        key, message: encryptField(message), contactEmail: encryptField(contactEmail),
        category: classification.type, reason: String(reason),
      }).returning()
    }
    if (entry.status === 'accepted') return { status: 'accepted', deduplicated: true }
    if (!process.env.RESEND_API_KEY) return { status: 'not_configured', deduplicated: false }
    let status = 'failed'
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          authorization: 'Bearer ' + process.env.RESEND_API_KEY,
          'content-type': 'application/json',
          'Idempotency-Key': `support-escalation/${key}`,
        },
        body: JSON.stringify({
          from: process.env.INVITE_FROM_EMAIL || 'CRAFT <onboarding@resend.dev>',
          to: ['craftframework@becomechange.institute'],
          reply_to: contactEmail,
          subject: privateReport ? '[PRIVATE / CONFIDENTIAL] CRAFT support report' : `[CRAFT support escalation] ${classification.type}`,
          text: `${privateReport ? 'Private / confidential — do not publish or forward publicly.' : 'Support escalation queue'}\nReason: ${reason}\nCategory: ${classification.type}\n\n${message}`,
        }),
      })
      if (response.ok) status = 'accepted'
    } catch {
      // Keep provider failures retryable without logging report content.
    }
    await tx.update(supportEscalations).set({ status }).where(eq(supportEscalations.id, entry.id))
    return { status, deduplicated: false }
  })
  return Response.json({ ...result, recipientType, reason }, { status: result.status === 'failed' ? 502 : 200 })
}
