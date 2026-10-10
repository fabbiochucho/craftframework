export type EmailAcceptance = 'accepted' | 'failed' | 'not_configured'

export async function sendReminderEmail(
  email: { to: string | string[]; subject: string; text: string; reply_to?: string },
  idempotencyKey?: string,
): Promise<EmailAcceptance> {
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
