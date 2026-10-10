import { createHash } from 'node:crypto'
import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { db, supportEscalations } from '../../db/index.js'
import { decryptField, encryptField } from './crypto.js'
import { HttpError } from './orgAccess.js'
import { classifySupportMessage, isPrivateReport, rankSupportFaq, redactSupportMessage } from './support-bot.js'
import { sendReminderEmail } from './reminder-email.js'

async function deliverEscalation(entry: typeof supportEscalations.$inferSelect) {
  return sendReminderEmail({
    to: ['craftframework@becomechange.institute'],
    reply_to: decryptField(entry.contactEmail),
    subject: entry.reason === 'private_report' ? '[PRIVATE / CONFIDENTIAL] CRAFT support report' : `[CRAFT support escalation] ${entry.category}`,
    text: `${entry.reason === 'private_report' ? 'Private / confidential — do not publish or forward publicly.' : 'Support escalation queue'}\nReason: ${entry.reason}\nCategory: ${entry.category}\n\n${decryptField(entry.message)}`,
  }, `support-escalation/${entry.key}`)
}

export async function retrySupportEscalations() {
  // Resend retains idempotency keys for 24 hours. Do not automatically resend
  // older ambiguous attempts; leave them for operator reconciliation.
  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000)
  const entries = await db.select().from(supportEscalations).where(and(
    inArray(supportEscalations.status, ['pending', 'failed', 'not_configured']),
    gte(supportEscalations.createdAt, cutoff),
  )).limit(100)
  for (const candidate of entries) {
    await db.transaction(async (tx) => {
      const digest = Buffer.from(candidate.key, 'hex')
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${digest.readInt32BE(0)}, ${digest.readInt32BE(4)})`)
      const [entry] = await tx.select().from(supportEscalations).where(eq(supportEscalations.id, candidate.id))
      if (!entry || entry.status === 'accepted') return
      const status = await deliverEscalation(entry)
      await tx.update(supportEscalations).set({ status }).where(eq(supportEscalations.id, entry.id))
    })
  }
}

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
    if (entry.createdAt.getTime() < Date.now() - 23 * 60 * 60 * 1000) return { status: 'needs_reconciliation', deduplicated: true }
    const status = await deliverEscalation(entry)
    await tx.update(supportEscalations).set({ status }).where(eq(supportEscalations.id, entry.id))
    return { status, deduplicated: false }
  })
  return Response.json({ ...result, recipientType, reason }, { status: result.status === 'failed' ? 502 : result.status === 'accepted' ? 200 : 503 })
}
