// 'Welcome to CRAFT': sent once when a person completes onboarding, in the CRAFT branded layout used by the
// invite and nudge emails, signed by Abiola & Pauline. Pure: no I/O, no env.
import { BRAND } from './data.ts'
import { firstNameOf } from './nudgeEmail.ts'
import { signatureHtml, signatureText } from './emailSignature.ts'

export const WELCOME_FALLBACK_ORG = 'your organisation'

export type WelcomeEmailInput = {
  name: string
  email: string
  orgName?: string | null
  appUrl: string
  now?: Date
}

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const STEPS = [
  'Take the CRAFT readiness assessment. It shows where your organisation stands on the Capital Readiness Ladder.',
  'Build your Data Room by uploading the evidence behind your answers.',
  'Review your Capacity Improvement Plan: the actions that move you up the ladder.',
]

export function renderWelcomeEmail(input: WelcomeEmailInput): { subject: string; html: string; text: string; ctaUrl: string } {
  const first = firstNameOf(input.name, input.email)
  const org = input.orgName?.trim() || WELCOME_FALLBACK_ORG
  const appUrl = input.appUrl.replace(/\/+$/, '')
  const ctaUrl = `${appUrl}/dashboard`
  const year = (input.now ?? new Date()).getUTCFullYear()
  const subject = `Welcome to CRAFT, ${first}`
  const intro = `Thank you for choosing CRAFT. We’re delighted to welcome you, and ${org}’s workspace is now set up and ready to use.`
  const help = 'If you have any questions, or would like help with any step, just reply to this email. We read every message and we’re glad to help.'
  const footer = `You’re receiving this because you set up a workspace on CRAFT. © ${year} ${BRAND.institute}.`

  const text = [
    `Hi ${first},`,
    '',
    intro,
    '',
    'Here’s a good place to start:',
    ...STEPS.map((s, i) => `${i + 1}. ${s}`),
    '',
    `Go to your dashboard: ${ctaUrl}`,
    '',
    help,
    '',
    ...signatureText(),
    '',
    '--',
    footer,
  ].join('\n')

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#0f172a;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <table role="presentation" width="100%" style="border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td style="background:linear-gradient(135deg,#064e3b,#0f172a);padding:28px 32px">
        <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:.5px">${esc(BRAND.product)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#fbbf24">${esc(BRAND.framework)} · ${esc(BRAND.institute)}</p>
      </td></tr>
      <tr><td style="padding:32px 32px 8px">
        <h1 style="margin:0 0 12px;font-size:22px;color:#064e3b">Hi ${esc(first)},</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569">${esc(intro)}</p>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#0f172a;font-weight:600">Here’s a good place to start:</p>
        <ol style="margin:0 0 8px;padding-left:20px;font-size:15px;line-height:1.7;color:#475569">${STEPS.map((s) => `<li style="margin-bottom:4px">${esc(s)}</li>`).join('')}</ol>
      </td></tr>
      <tr><td style="padding:16px 32px 8px;text-align:center">
        <a href="${esc(ctaUrl)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px">Go to your dashboard</a>
      </td></tr>
      <tr><td style="padding:16px 32px 20px">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569">${esc(help)}</p>
        ${signatureHtml(appUrl)}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #f1f5f9">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8">${esc(footer)}</p>
      </td></tr>
    </table>
  </div>
</body>
</html>`
  return { subject, html, text, ctaUrl }
}
