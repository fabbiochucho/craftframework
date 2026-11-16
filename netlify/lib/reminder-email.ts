export type EmailAcceptance = 'accepted' | 'failed' | 'not_configured'

export type ReminderEmail = {
  to: string | string[]
  subject: string
  text: string
  html?: string
  reply_to?: string
  headers?: Record<string, string>
}

// Records the outcome (type + result only, never the recipient or content) for the Super Admin operations view.
// Best effort: a logging failure must never change whether the email is reported as sent.
async function recordOutcome(kind: string, outcome: EmailAcceptance): Promise<void> {
  try {
    const [{ db }, { emailLog }] = await Promise.all([import('../../db/index.js'), import('../../db/schema.js')])
    await db.insert(emailLog).values({ kind, outcome })
  } catch {
    /* no database in this context (e.g. a unit test), or the insert failed */
  }
}

/**
 * Keep a copy of a notification in each recipient's in-app inbox, whether or not the email provider took it
 * (that is the point: the message can still be read on the platform). Best effort, like recordOutcome.
 */
export async function recordInbox(to: string | string[], subject: string, text: string, kind = 'other'): Promise<void> {
  try {
    const [{ db }, { inboxMessages }] = await Promise.all([import('../../db/index.js'), import('../../db/schema.js')])
    const recipients = [...new Set([to].flat().map((e) => e.trim().toLowerCase()).filter(Boolean))]
    if (recipients.length) await db.insert(inboxMessages).values(recipients.map((recipient) => ({ recipient, kind, subject, body: text })))
  } catch {
    /* no database in this context, or the insert failed */
  }
}

export async function sendReminderEmail(
  email: ReminderEmail,
  idempotencyKey?: string,
  kind = 'other',
): Promise<EmailAcceptance> {
  const result = await deliver(email, idempotencyKey)
  await recordOutcome(kind, result)
  await recordInbox(email.to, email.subject, email.text, kind)
  return result
}

async function deliver(email: ReminderEmail, idempotencyKey?: string): Promise<EmailAcceptance> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.COMPLIANCE_FROM_EMAIL || process.env.REMINDER_FROM_EMAIL || process.env.INVITE_FROM_EMAIL
  // Production domains must be verified with the provider by the operator.
  // Never silently substitute Resend's development-only sender.
  if (!apiKey || !from || /@resend\.dev\b/i.test(from)) return 'not_configured'
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: 'Bearer ' + apiKey, 'content-type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({ from, ...email }),
    })
    return response.ok ? 'accepted' : 'failed'
  } catch {
    return 'failed'
  }
}
