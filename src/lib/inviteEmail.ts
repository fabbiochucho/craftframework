// Server-safe invitation email builder. Pure functions with no browser APIs: imported by the
// Settings preview (client) AND by netlify/lib/invitations.ts, which renders the real email
// server-side from the stored invitation record. Every interpolated field is HTML-escaped.
//
// Structure (both the HTML and the plain-text part):
//   1. Who invited you, and why (inviter name + email, their note, what accepting does)
//   2. What you can do on CRAFT, tailored to the invitation (an institution vs a team role)
//   3. Why institutions use CRAFT (positioning, trust and data sovereignty)
//   4. The accept button + raw link, then "explore first" links (Readiness Check, demo, methodology)
// Marketing copy states only what the platform itself states on its public pages; no statistics.
import { BRAND, getViewLevel, type ViewLevel } from './data'

export interface WelcomeEmailInput {
  name: string
  email: string
  role: ViewLevel
  scopeLabel: string
  inviterName: string
  inviterEmail: string
  message?: string
  /** The tokenised accept link (/accept/<token>). Omitted only in the Settings preview. */
  acceptUrl?: string
  /** 'organization' = bring your institution onto CRAFT in its own workspace. Default 'member'. */
  kind?: 'member' | 'organization'
  /** organization: the institution name the inviter typed. */
  orgName?: string
  /** organization: the type the inviter chose, e.g. "Civil Society · NGO · Nigeria". */
  orgType?: string
  /** organization: what accepting sets up, e.g. "Adds you to the portfolio ...". */
  purpose?: string
  /** Days until the link expires (shown in the email). Default 7. */
  expiresInDays?: number
  /** Public site base URL for the "explore first" links. */
  siteUrl?: string
}

const DEFAULT_SITE = 'https://craftframework.becomechange.institute'
const isOrgInvite = (input: WelcomeEmailInput) => input.kind === 'organization'

type Feature = { title: string; text: string }

/** What the invitee will be able to do, by invitation type. */
export function inviteFeatures(input: Pick<WelcomeEmailInput, 'kind' | 'role'>): Feature[] {
  if (input.kind === 'organization') {
    return [
      { title: 'Readiness assessment', text: 'Diagnose your institution across 5 tiers and 20 domains on a 0–5 maturity scale, backed by evidence.' },
      { title: 'Level A–E rating', text: 'See where you stand. Execution counts: policies on paper alone never inflate the score.' },
      { title: 'Capacity Improvement Plan', text: 'Turn every gap into a costed, owned and time-bound action on your own timeline.' },
      { title: 'Secure Data Room', text: 'Keep your policies, statements and certificates in one place, ready to share with funders and validators.' },
      { title: 'Independent validation', text: 'When you are ready, ask an accredited validator to confirm your results for funders and partners.' },
    ]
  }
  switch (input.role) {
    case 'independent':
      return [
        { title: 'Independent scoring', text: "Score the institution on a separate track, recorded apart from its self-assessment." },
        { title: 'Trust Delta', text: 'Compare your scores with the self-assessment and see exactly where they differ.' },
        { title: 'Evidence review', text: 'Check the evidence behind each answer in the institution’s secure Data Room.' },
      ]
    case 'portfolio':
      return [
        { title: 'Portfolio view', text: 'Compare readiness across every institution in your portfolio at a glance.' },
        { title: 'Risk and progress', text: 'See which institutions need support first and follow their improvement plans.' },
        { title: 'Isolated by design', text: 'You see only the institutions in your portfolio; everything else stays private.' },
      ]
    case 'admin':
      return [
        { title: 'Team and access', text: 'Invite colleagues, assign roles and control who sees what.' },
        { title: 'Assessments and plans', text: 'Run readiness assessments and track the Capacity Improvement Plan.' },
        { title: 'Reports', text: 'Produce funder-ready reports from your own results and evidence.' },
      ]
    default:
      return [
        { title: 'Assessment wizard', text: 'Answer guided questions for your institution, one domain at a time.' },
        { title: 'Evidence vault', text: 'Upload the documents that support your answers.' },
        { title: 'Improvement plan', text: 'Follow and update the actions that close each gap.' },
      ]
  }
}

/** Why institutions use CRAFT. Only what the platform states publicly. */
export const INVITE_PITCH: Feature[] = [
  { title: 'Built for funding readiness', text: 'Prepare for direct G2G, DFI and donor partnerships with the evidence funders ask for.' },
  { title: 'Your data stays yours', text: 'Every institution has its own isolated workspace. You decide who sees your results, and you can revoke access at any time.' },
  { title: 'A free digital public good', text: `${BRAND.product} is open source, built by the ${BRAND.institute} for public bodies, civil society and the private sector across Africa.` },
]

function exploreLinks(site: string) {
  const base = site.replace(/\/+$/, '')
  return [
    { label: 'Take the 2-minute Readiness Check', url: `${base}/pre-assessment` },
    { label: 'Explore the live demo', url: `${base}/demo` },
    { label: 'Read the methodology', url: `${base}/methodology` },
  ]
}

function inviterLine(input: WelcomeEmailInput): string {
  return input.inviterEmail && input.inviterEmail !== input.inviterName ? `${input.inviterName} (${input.inviterEmail})` : input.inviterName
}

export function buildWelcomeEmail(input: WelcomeEmailInput): { subject: string; body: string } {
  const level = getViewLevel(input.role)
  const org = isOrgInvite(input)
  const subject = org
    ? `${input.inviterName} invited ${input.orgName || 'your institution'} to ${BRAND.product}`
    : `${input.inviterName} invited you to ${BRAND.product}: ${level.label}`
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  const days = input.expiresInDays ?? 7
  const messageBlock = input.message?.trim() ? `\nA note from ${input.inviterName}:\n"${input.message.trim()}"\n` : ''
  const features = inviteFeatures(input).map((f) => `• ${f.title}: ${f.text}`).join('\n')
  const pitch = INVITE_PITCH.map((f) => `• ${f.title}: ${f.text}`).join('\n')
  const explore = exploreLinks(input.siteUrl ?? DEFAULT_SITE).map((l) => `• ${l.label}: ${l.url}`).join('\n')
  const intro = org
    ? `${inviterLine(input)} has invited ${input.orgName || 'your institution'} to ${BRAND.product} (${BRAND.expansion}).`
    : `${inviterLine(input)} has invited you to join ${input.scopeLabel || 'their organisation'} on ${BRAND.product} (${BRAND.expansion}).`
  const body = `Dear ${input.name || 'Colleague'},

${intro}
${messageBlock}
YOUR INVITATION
${divider}
Invited by: ${inviterLine(input)}
${org ? `Institution: ${input.orgName || '-'}${input.orgType ? `
Organisation type: ${input.orgType}` : ''}
What accepting does: ${input.purpose || "Creates your institution's own CRAFT workspace"}` : `Role: ${level.label}
Scope: ${input.scopeLabel}`}
${divider}

WHAT YOU CAN DO ON ${BRAND.product}
${features}

WHY INSTITUTIONS USE ${BRAND.product}
${pitch}

ACCEPT YOUR INVITATION
${input.acceptUrl ?? '[ ACCEPT INVITATION & CREATE ACCOUNT ]'}
Create your account (or sign in) with ${input.email}. This invitation expires in ${days} days.

EXPLORE FIRST
${explore}

Questions? Reply to this email or write to ${BRAND.contactEmail}.

The ${BRAND.institute} Team
"${BRAND.instituteMeaning}."

${divider}
You received this because ${input.inviterName} entered your email address on ${BRAND.product}. If you were not expecting it, you can ignore this email: nothing happens unless you accept.
${BRAND.footer}`
  return { subject, body }
}

// Branded, self-contained HTML version. Inline styles and a table layout that renders in email
// clients, in the CRAFT / DiBadili palette.
export function buildWelcomeEmailHtml(input: WelcomeEmailInput): { subject: string; html: string } {
  const level = getViewLevel(input.role)
  const { subject } = buildWelcomeEmail(input)
  const org = isOrgInvite(input)
  const days = input.expiresInDays ?? 7
  const name = esc(input.name || 'Colleague')
  const inviter = esc(input.inviterName)
  const inviterEmail = input.inviterEmail && input.inviterEmail !== input.inviterName
    ? ` <span style="color:#64748b;font-weight:400">(${esc(input.inviterEmail)})</span>` : ''
  const intro = org
    ? `<strong>${inviter}</strong>${inviterEmail} has invited <strong>${esc(input.orgName || 'your institution')}</strong> to ${esc(BRAND.product)}. Accepting creates your institution's own secure workspace: you keep full ownership of your data and decide who sees it.`
    : `<strong>${inviter}</strong>${inviterEmail} has invited you to join <strong>${esc(input.scopeLabel || 'their organisation')}</strong> on ${esc(BRAND.product)} as <strong>${esc(level.label)}</strong>.`
  const row = (label: string, value: string, first = false) =>
    `<tr><td style="padding:10px 16px;font-size:13px;color:#64748b;vertical-align:top${first ? '' : ';border-top:1px solid #e2e8f0'}">${label}</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#0f172a;text-align:right${first ? '' : ';border-top:1px solid #e2e8f0'}">${esc(value)}</td></tr>`
  const details = org
    ? row('Invited by', input.inviterName, true) + row('Institution', input.orgName || '-') + (input.orgType ? row('Organisation type', input.orgType) : '') + row('What accepting does', input.purpose || 'Creates your own CRAFT workspace')
    : row('Invited by', input.inviterName, true) + row('Access level', level.label) + row('Scope', input.scopeLabel)
  const messageBlock = input.message?.trim()
    ? `<tr><td style="padding:0 32px 8px"><div style="border-left:3px solid #34d399;background:#f0fdf4;padding:12px 16px;border-radius:8px;color:#334155;font-size:14px;font-style:italic">${inviter} wrote: “${esc(input.message.trim())}”</div></td></tr>`
    : ''
  const list = (items: Feature[], dot: string) => items.map((f) =>
    `<tr><td style="padding:6px 0;vertical-align:top;width:18px;color:${dot};font-size:14px">●</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#334155"><strong style="color:#0f172a">${esc(f.title)}.</strong> ${esc(f.text)}</td></tr>`).join('')
  const section = (title: string, items: Feature[], dot: string, bg = '#ffffff') =>
    `<tr><td style="padding:20px 32px 4px;background:${bg}"><p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#047857">${title}</p><table role="presentation" width="100%" style="border-collapse:collapse">${list(items, dot)}</table></td></tr>`
  const explore = exploreLinks(input.siteUrl ?? DEFAULT_SITE)
    .map((l) => `<a href="${esc(l.url)}" style="color:#047857;font-weight:600;text-decoration:none">${esc(l.label)} →</a>`).join('<br>')
  const acceptHref = esc(input.acceptUrl ?? BRAND.instituteUrl)
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#0f172a;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b">
  <div style="display:none;max-height:0;overflow:hidden">${esc(subject)}. ${esc(BRAND.tagline)}</div>
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <table role="presentation" width="100%" style="border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(2,44,34,.35)">
      <tr><td style="background:linear-gradient(135deg,#064e3b,#0f172a);padding:28px 32px">
        <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:.5px">${esc(BRAND.product)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#fbbf24">${esc(BRAND.framework)} · ${esc(BRAND.institute)}</p>
        <p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:#d1fae5">${esc(BRAND.tagline)}</p>
      </td></tr>
      <tr><td style="padding:32px 32px 8px">
        <h1 style="margin:0 0 8px;font-size:22px;color:#064e3b">Hello ${name},</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#475569">${intro}</p>
      </td></tr>
      <tr><td style="padding:16px 32px 8px">
        <table role="presentation" width="100%" style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
          ${details}
        </table>
      </td></tr>
      ${messageBlock}
      <tr><td style="padding:16px 32px 8px;text-align:center">
        <a href="${acceptHref}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 30px;border-radius:10px">${org ? 'Accept &amp; set up our workspace' : 'Accept invitation'}</a>
        <p style="margin:10px 0 0;font-size:12px;color:#94a3b8">Create your account or sign in with <strong>${esc(input.email)}</strong>. Expires in ${days} days.</p>
      </td></tr>
      ${section(`What you can do on ${esc(BRAND.product)}`, inviteFeatures(input), '#10b981')}
      ${section(`Why institutions use ${esc(BRAND.product)}`, INVITE_PITCH, '#f59e0b', '#f8fafc')}
      <tr><td style="padding:20px 32px 8px">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#047857">Explore first</p>
        <p style="margin:0;font-size:14px;line-height:1.9">${explore}</p>
      </td></tr>
      <tr><td style="padding:16px 32px 8px;text-align:center">
        <a href="${acceptHref}" style="display:inline-block;border:1px solid #059669;color:#047857;text-decoration:none;font-weight:600;font-size:14px;padding:10px 24px;border-radius:10px">Accept your invitation</a>
        ${input.acceptUrl ? `<p style="margin:10px 0 0;font-size:11px;color:#94a3b8">If the button does not work, paste this link into your browser:<br><span style="color:#475569;word-break:break-all">${esc(input.acceptUrl)}</span></p>` : ''}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #f1f5f9">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8">You received this because ${inviter} entered your email address on ${esc(BRAND.product)}. Not expecting it? Ignore this email: nothing happens unless you accept.<br>Questions? Write to <a href="mailto:${esc(BRAND.contactEmail)}" style="color:#059669">${esc(BRAND.contactEmail)}</a>.<br>“${esc(BRAND.instituteMeaning)}.” · ${esc(BRAND.footer)}</p>
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
