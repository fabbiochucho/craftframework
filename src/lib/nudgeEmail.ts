// 'Finish setting up your CRAFT workspace': the resume-onboarding email, in the CRAFT branded layout used by
// buildWelcomeEmailHtml (dark-green header, emerald button, DiBadili footer). Pure: no I/O, no env.
import { BRAND } from './data.ts'
import { ONBOARDING_STEPS } from './onboardingProgress.ts'

export const NUDGE_SUBJECT = 'Finish setting up your CRAFT workspace'
export const NUDGE_FALLBACK_ORG = 'your organisation'
export const NUDGE_NOTE_MAX = 600

export type NudgeEmailInput = {
  name: string
  email: string
  orgName?: string | null
  startedAt: Date
  /** 1-based step the person stopped at (an unfinished step). */
  step: number
  note?: string | null
  appUrl: string
  optOutUrl: string
  now?: Date
}

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function firstNameOf(name: string, email: string): string {
  const fromName = name.trim().split(/\s+/)[0]
  if (fromName && !fromName.includes('@')) return fromName
  const local = email.split('@')[0].split(/[._+-]+/)[0] || 'there'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export function renderNudgeEmail(input: NudgeEmailInput): { subject: string; html: string; text: string; ctaUrl: string } {
  const step = Math.min(Math.max(Math.trunc(input.step) || 1, 1), ONBOARDING_STEPS.length)
  const stepName = ONBOARDING_STEPS[step - 1]
  const remaining = ONBOARDING_STEPS.slice(step - 1)
  const org = input.orgName?.trim() || NUDGE_FALLBACK_ORG
  const orgPossessive = `${org}’s`
  const first = firstNameOf(input.name, input.email)
  const started = formatDate(input.startedAt)
  const year = (input.now ?? new Date()).getUTCFullYear()
  const note = input.note?.trim().slice(0, NUDGE_NOTE_MAX) || ''
  // Lands on the furthest step reached (the wizard also restores the saved draft, so this is a hint).
  const ctaUrl = `${input.appUrl.replace(/\/+$/, '')}/auth?next=/onboarding%3Fstep%3D${step}`
  const stoppedAt = `You stopped at step ${step} of ${ONBOARDING_STEPS.length}: ${stepName}.`
  const closing = 'Once your workspace is ready, you can take the CRAFT readiness assessment, build your Data Room, and see where your organisation stands on the Capital Readiness Ladder.'
  const footer = `You’re receiving this because you started registering on CRAFT. Don’t want these reminders? Stop them here: ${input.optOutUrl}. © ${year} ${BRAND.institute}.`

  const text = [
    `Hi ${first},`,
    '',
    `You started setting up ${orgPossessive} workspace on CRAFT on ${started}, but didn’t get to the end. ${stoppedAt}`,
    '',
    'Everything you entered has been saved. What’s left:',
    ...remaining.map((s) => `- ${s}`),
    '',
    `Continue where you left off: ${ctaUrl}`,
    '',
    closing,
    ...(note ? ['', note] : []),
    '',
    'Questions, or stuck on a step? Just reply to this email and the CRAFT team will help you.',
    '',
    'The CRAFT team',
    BRAND.institute,
    '',
    '--',
    footer,
  ].join('\n')

  const noteBlock = note
    ? `<tr><td style="padding:0 32px 8px"><div style="border-left:3px solid #34d399;background:#f0fdf4;padding:12px 16px;border-radius:8px;color:#334155;font-size:14px;white-space:pre-wrap">${esc(note)}<br><span style="font-size:12px;color:#64748b">— A note from the CRAFT team</span></div></td></tr>`
    : ''
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(NUDGE_SUBJECT)}</title></head>
<body style="margin:0;background:#0f172a;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <table role="presentation" width="100%" style="border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td style="background:linear-gradient(135deg,#064e3b,#0f172a);padding:28px 32px">
        <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:.5px">${esc(BRAND.product)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#fbbf24">${esc(BRAND.framework)} · ${esc(BRAND.institute)}</p>
      </td></tr>
      <tr><td style="padding:32px 32px 8px">
        <h1 style="margin:0 0 12px;font-size:22px;color:#064e3b">Hi ${esc(first)},</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569">You started setting up <strong>${esc(orgPossessive)}</strong> workspace on CRAFT on ${esc(started)}, but didn’t get to the end. ${esc(stoppedAt)}</p>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#475569">Everything you entered has been saved. What’s left:</p>
        <ul style="margin:0 0 8px;padding-left:20px;font-size:15px;line-height:1.7;color:#0f172a">${remaining.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </td></tr>
      <tr><td style="padding:16px 32px 8px;text-align:center">
        <a href="${esc(ctaUrl)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px">Continue where you left off</a>
      </td></tr>
      <tr><td style="padding:16px 32px 8px">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#475569">${esc(closing)}</p>
      </td></tr>
      ${noteBlock}
      <tr><td style="padding:8px 32px 16px">
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569">Questions, or stuck on a step? Just reply to this email and the CRAFT team will help you.</p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#0f172a">The CRAFT team<br>${esc(BRAND.institute)}</p>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #f1f5f9">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8">You’re receiving this because you started registering on CRAFT. Don’t want these reminders? <a href="${esc(input.optOutUrl)}" style="color:#059669">Stop them here</a>. © ${year} ${esc(BRAND.institute)}.</p>
      </td></tr>
    </table>
  </div>
</body>
</html>`
  return { subject: NUDGE_SUBJECT, html, text, ctaUrl }
}
