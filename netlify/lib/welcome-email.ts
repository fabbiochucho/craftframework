// Sends the 'Welcome to CRAFT' email once, the first time a person's onboarding is recorded as complete.
// The send is claimed atomically on onboarding_progress (welcome_email_sent_at), so repeated completions or
// concurrent requests never send twice. Failures are recorded, never thrown: onboarding must not break
// because of email.
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { auditLogs, onboardingProgress, organizations } from '../../db/schema.js'
import { renderWelcomeEmail } from '../../src/lib/welcomeEmail.js'
import { craftReplyTo } from '../../src/lib/emailSignature.js'
import { isSuperAdmin, type Caller } from './auth.js'
import { appUrl } from './onboarding-nudge.js'
import { sendReminderEmail, type EmailAcceptance } from './reminder-email.js'
import { logger } from './logger.js'

export async function sendWelcomeEmailOnce(caller: Caller): Promise<EmailAcceptance | 'skipped'> {
  // The platform Super Admin runs CRAFT; specialised read-only sessions never onboard.
  if (isSuperAdmin(caller.email) || caller.readOnly) return 'skipped'
  try {
    const claimed = await db.update(onboardingProgress).set({ welcomeEmailSentAt: new Date() })
      .where(and(eq(onboardingProgress.email, caller.email), isNotNull(onboardingProgress.completedAt), isNull(onboardingProgress.welcomeEmailSentAt)))
      .returning({ email: onboardingProgress.email })
    if (!claimed.length) return 'skipped'

    const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, caller.orgId)).limit(1)
    const email = renderWelcomeEmail({ name: caller.name, email: caller.email, orgName: org?.name, appUrl: appUrl() })
    const outcome = await sendReminderEmail(
      { to: caller.email, subject: email.subject, text: email.text, html: email.html, reply_to: craftReplyTo() },
      `welcome-${caller.email}`,
      'welcome',
    )
    await db.update(onboardingProgress).set({ welcomeEmailOutcome: outcome }).where(eq(onboardingProgress.email, caller.email))
    await db.insert(auditLogs).values({ actor: 'system', action: `welcome email ${outcome}`, target: caller.email, category: 'Email', orgId: caller.orgId })
    return outcome
  } catch (err) {
    logger.error('welcome-email', 'failed', err)
    return 'failed'
  }
}
