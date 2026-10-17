// Server-safe welcome/invitation email builder. Pure functions with no browser
// APIs: imported by the Settings preview (client) AND by netlify/functions/
// send-invite.mts, which renders the real email server-side from the stored
// invitation record. Every interpolated field is HTML-escaped.
import { BRAND, getViewLevel, type ViewLevel } from './data'

// The platform is invitation-only: every invited user receives a branded
// DiBadili Institute welcome email. This builds the exact body shown in the
// "Preview Email" modal and that a real mail service would deliver.
export interface WelcomeEmailInput {
  name: string
  email: string
  role: ViewLevel
  scopeLabel: string
  inviterName: string
  inviterEmail: string
  message?: string
}

export function buildWelcomeEmail(input: WelcomeEmailInput): { subject: string; body: string } {
  const level = getViewLevel(input.role)
  const subject = `Welcome to ${BRAND.product}: you're invited to join the ${BRAND.institute}`
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  const messageBlock = input.message?.trim()
    ? `\nMessage from ${input.inviterName}:\n"${input.message.trim()}"\n`
    : ''
  const body = `Dear ${input.name || 'Colleague'},

You have been invited to join the ${BRAND.product} (${BRAND.expansion}) platform by the ${BRAND.institute}.

INVITATION DETAILS:
${divider}
Role: ${level.label}
Scope: ${input.scopeLabel}
Invited by: ${input.inviterName} (${input.inviterEmail})
${divider}
${messageBlock}
YOUR NEXT STEPS:
1. Click the button below to create your account
2. Complete your profile setup
3. Begin your institutional assessment

[ ACCEPT INVITATION & CREATE ACCOUNT ]

This invitation will expire in 7 days.

ABOUT ${BRAND.product}:
${BRAND.product} is built by the ${BRAND.institute} to help government entities and NGOs
achieve institutional sovereignty and fiduciary trust for direct G2G, DFI and donor partnerships.

If you have questions, reach the ${BRAND.institute} at ${BRAND.contactEmail}.

Welcome to the ${BRAND.product} community.

Best regards,
The ${BRAND.institute} Team
"${BRAND.instituteMeaning}."

${divider}
This is an automated message from the ${BRAND.product} platform.
${BRAND.footer.split('.')[0]}. All rights reserved.`
  return { subject, body }
}

// Branded, self-contained HTML rendering of the welcome email - the actual
// template artifact a transactional mail service (e.g. an identity-signup
// function or SendGrid/Postmark) would deliver. Uses inline styles and a
// table-free, email-client-safe layout in the CRAFT / DiBadili palette. The
// same {{handlebars}}-style tokens map onto the plain-text version above.
export function buildWelcomeEmailHtml(input: WelcomeEmailInput): { subject: string; html: string } {
  const level = getViewLevel(input.role)
  const { subject } = buildWelcomeEmail(input)
  const name = esc(input.name || 'Colleague')
  const messageBlock = input.message?.trim()
    ? `<tr><td style="padding:0 32px 8px"><div style="border-left:3px solid #34d399;background:#f0fdf4;padding:12px 16px;border-radius:8px;color:#334155;font-size:14px;font-style:italic">${esc(input.inviterName)} wrote: “${esc(input.message.trim())}”</div></td></tr>`
    : ''
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0f172a;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <table role="presentation" width="100%" style="border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(2,44,34,.35)">
      <tr><td style="background:linear-gradient(135deg,#064e3b,#0f172a);padding:28px 32px">
        <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:.5px">${esc(BRAND.product)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#fbbf24">${esc(BRAND.framework)} · ${esc(BRAND.institute)}</p>
      </td></tr>
      <tr><td style="padding:32px 32px 8px">
        <h1 style="margin:0 0 8px;font-size:22px;color:#064e3b">Welcome, ${name}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#475569">You have been invited to join the <strong>${esc(BRAND.product)}</strong> (${esc(BRAND.expansion)}) platform by the ${esc(BRAND.institute)}.</p>
      </td></tr>
      <tr><td style="padding:16px 32px 8px">
        <table role="presentation" width="100%" style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
          <tr><td style="padding:12px 16px;font-size:13px;color:#64748b">Access level</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0f172a;text-align:right">${esc(level.label)}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0">Scope</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0f172a;text-align:right;border-top:1px solid #e2e8f0">${esc(input.scopeLabel)}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0">Invited by</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0f172a;text-align:right;border-top:1px solid #e2e8f0">${esc(input.inviterName)}</td></tr>
        </table>
      </td></tr>
      ${messageBlock}
      <tr><td style="padding:16px 32px 8px;text-align:center">
        <a href="${esc(BRAND.instituteUrl)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px">Accept Invitation &amp; Create Account</a>
        <p style="margin:12px 0 0;font-size:12px;color:#94a3b8">This invitation expires in 7 days.</p>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #f1f5f9">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8">Questions? Reach the ${esc(BRAND.institute)} at <a href="mailto:${esc(BRAND.contactEmail)}" style="color:#059669">${esc(BRAND.contactEmail)}</a>.<br>“${esc(BRAND.instituteMeaning)}.” · ${esc(BRAND.footer.split('.')[0])}.</p>
      </td></tr>
    </table>
  </div>
</body>
</html>`
  return { subject, html }
}

// Minimal HTML-entity escaper so invitee/inviter input is safe inside the
// template markup (the preview renders it via an iframe srcDoc).
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
