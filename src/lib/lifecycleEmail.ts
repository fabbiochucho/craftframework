// Copy and layout for the lifecycle emails: the 2-week nudge, the 1-month feedback request (active and inactive),
// milestone celebrations (progress and quiet) and check-ins. One content model per email renders to both the HTML
// (CRAFT branded layout, as the welcome and nudge emails) and the plain text, so the two cannot drift. Pure.
import { BRAND } from './data.ts'
import { firstNameOf } from './nudgeEmail.ts'
import { signatureHtml, signatureText } from './emailSignature.ts'
import {
  milestoneAsksFeedback, milestoneLabel, milestoneSubject, type LifecycleKind, type OrgProgress,
} from './lifecycle.ts'

export const LIFECYCLE_FALLBACK_ORG = 'your organisation'

export type EmailVariant = 'active' | 'inactive' | 'progress' | 'quiet' | 'default'

/** Every link in the email, already absolute (the engine makes them signed first-party redirects). */
export type LifecycleLinks = {
  /** The main button: assessment, survey, dashboard … depending on the email. */
  cta: string
  /** Second button on the progress milestone: the member badge. */
  badge?: string
  /** 'Tell us in two minutes' on anniversaries. */
  survey?: string
  unsubscribe: string
  preferences: string
}

export type LifecycleEmailInput = {
  kind: LifecycleKind
  variant: EmailVariant
  name: string
  email: string
  orgName?: string | null
  appUrl: string
  links: LifecycleLinks
  /** Milestone only: 3, 6, 12, 18 … */
  months?: number
  progress?: OrgProgress
  now?: Date
}
export type LifecycleEmail = { subject: string; html: string; text: string }

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

type Block =
  | { t: 'p'; text: string }
  | { t: 'list'; items: string[] }
  | { t: 'button'; label: string; url: string }
  | { t: 'inline'; before: string; label: string; url: string }

/** Only lines with a real, non-zero value: nothing like “0 documents”. */
export function progressLines(p: OrgProgress): string[] {
  const lines: string[] = []
  if (p.assessmentsCompleted > 0) lines.push(`${plural(p.assessmentsCompleted, 'readiness assessment', 'readiness assessments')} completed`)
  if ((p.currentRung ?? 0) > 0) {
    lines.push(p.startRung !== null && p.startRung > 0 && p.startRung < p.currentRung!
      ? `Capital Readiness Ladder: from rung ${p.startRung} to rung ${p.currentRung}`
      : `Capital Readiness Ladder: currently at rung ${p.currentRung}`)
  }
  if (p.actionsCompleted > 0) lines.push(`${plural(p.actionsCompleted, 'improvement action', 'improvement actions')} completed`)
  if (p.documents > 0) lines.push(`${plural(p.documents, 'document', 'documents')} in your Data Room`)
  if ((p.validatedRung ?? 0) > 0) lines.push(`Independently validated at rung ${p.validatedRung}`)
  return lines
}

function content(i: LifecycleEmailInput, first: string, org: string): { subject: string; blocks: Block[] } {
  const orgPossessive = `${org}'s`
  const l = i.links
  switch (i.kind) {
    case 'nudge_2w':
      return {
        subject: `Ready to take your CRAFT readiness assessment, ${first}?`,
        blocks: [
          { t: 'p', text: `It's been two weeks since you set up ${orgPossessive} workspace on CRAFT. The next step is the readiness assessment: it shows where ${org} stands on the Capital Readiness Ladder and what to work on first.` },
          { t: 'p', text: "You don't have to finish it in one sitting. Your answers save as you go." },
          { t: 'button', label: 'Start the assessment', url: l.cta },
          { t: 'p', text: "If something is in the way, just reply and tell us. We're happy to walk you through it." },
        ],
      }
    case 'feedback_1m':
      return i.variant === 'inactive'
        ? {
          subject: `One month in: can we help, ${first}?`,
          blocks: [
            { t: 'p', text: `It's been a month since you set up ${orgPossessive} workspace on CRAFT, and it looks like you haven't had a chance to get started yet. That's completely fine, and we'd love to help.` },
            { t: 'p', text: "Is something in the way? Tell us in our two-minute survey, ask for a short call, or simply reply to this email, and we'll walk you through your first steps." },
            { t: 'button', label: 'Tell us how we can help', url: l.cta },
          ],
        }
        : {
          subject: `One month with CRAFT: how's it going, ${first}?`,
          blocks: [
            { t: 'p', text: `It's been a month since ${org} joined CRAFT. Thank you for being with us.` },
            { t: 'p', text: "We'd love to hear how it's going. Our two-minute survey helps us make CRAFT better for organisations like yours." },
            { t: 'button', label: 'Share your feedback', url: l.cta },
            { t: 'p', text: "And if anything is stuck or unclear, just reply to this email and we'll help." },
          ],
        }
    case 'milestone': {
      const months = i.months ?? 3
      const label = milestoneLabel(months)
      const lines = i.variant === 'progress' && i.progress ? progressLines(i.progress) : []
      if (lines.length) {
        const blocks: Block[] = [
          { t: 'p', text: `Today marks ${label} since ${org} joined CRAFT. Thank you for being part of the CRAFT community.` },
          { t: 'p', text: `Here's what ${org} has achieved so far:` },
          { t: 'list', items: lines },
          { t: 'button', label: 'See your progress', url: l.cta },
        ]
        if (l.badge) blocks.push({ t: 'button', label: 'Download your CRAFT member badge', url: l.badge })
        blocks.push({ t: 'p', text: "Here's to the next milestone. If there's anything we can do to help, just reply." })
        if (l.survey && milestoneAsksFeedback(months)) blocks.push({ t: 'inline', before: 'How are we doing?', label: 'Tell us in two minutes', url: l.survey })
        return { subject: milestoneSubject(months, first), blocks }
      }
      return {
        subject: milestoneSubject(months, first),
        blocks: [
          { t: 'p', text: `Today marks ${label} since ${org} joined CRAFT. Thank you for being with us.` },
          { t: 'p', text: "Whenever you're ready to pick things up again, your workspace is exactly as you left it." },
          { t: 'button', label: 'Continue on CRAFT', url: l.cta },
          { t: 'p', text: "If something has been in the way, we'd really like to know. Just reply with a line or two." },
        ],
      }
    }
    case 'checkin':
      return {
        subject: 'Checking in from CRAFT',
        blocks: [
          { t: 'p', text: `We noticed it's been a little while since you last visited CRAFT, so we wanted to check in. How are things going at ${org}?` },
          { t: 'p', text: "If CRAFT isn't working the way you hoped, or something is in the way, we'd really like to know. Just reply with a line or two. We read every message." },
          { t: 'button', label: 'Pick up where you left off', url: l.cta },
        ],
      }
  }
}

export function renderLifecycleEmail(input: LifecycleEmailInput): LifecycleEmail {
  const first = firstNameOf(input.name, input.email)
  const org = input.orgName?.trim() || LIFECYCLE_FALLBACK_ORG
  const appUrl = input.appUrl.replace(/\/+$/, '')
  const year = (input.now ?? new Date()).getUTCFullYear()
  const { subject, blocks } = content(input, first, org)
  const footerText = `You're receiving this because you have a workspace on CRAFT. Unsubscribe from these emails: ${input.links.unsubscribe} · Email preferences: ${input.links.preferences} · © ${year} ${BRAND.institute}.`

  const text = [
    `Hi ${first},`, '',
    ...blocks.flatMap((b): string[] =>
      b.t === 'p' ? [b.text, '']
        : b.t === 'list' ? [...b.items.map((x) => `- ${x}`), '']
          : b.t === 'button' ? [`${b.label}: ${b.url}`, '']
            : [`${b.before} ${b.label}: ${b.url}`, '']),
    ...signatureText(), '', '--', footerText,
  ].join('\n')

  const htmlBlocks = blocks.map((b) =>
    b.t === 'p' ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569">${esc(b.text)}</p>`
      : b.t === 'list' ? `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#0f172a">${b.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
        : b.t === 'button' ? `<p style="margin:8px 0 20px;text-align:center"><a href="${esc(b.url)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px">${esc(b.label)}</a></p>`
          : `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569">${esc(b.before)} <a href="${esc(b.url)}" style="color:#059669;font-weight:600">${esc(b.label)}</a></p>`).join('\n        ')

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
        ${htmlBlocks}
      </td></tr>
      <tr><td style="padding:8px 32px 20px">
        ${signatureHtml(appUrl, { typedNames: true })}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #f1f5f9">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8">You're receiving this because you have a workspace on CRAFT. <a href="${esc(input.links.unsubscribe)}" style="color:#059669">Unsubscribe from these emails</a> · <a href="${esc(input.links.preferences)}" style="color:#059669">Email preferences</a> · © ${year} ${esc(BRAND.institute)}.</p>
      </td></tr>
    </table>
  </div>
</body>
</html>`
  return { subject, html, text }
}

// --- the catalogue of variants, for the Super Admin preview ---------------------------------------------------
export type LifecycleVariantInfo = { id: string; label: string; kind: LifecycleKind; variant: EmailVariant; months?: number }

export const LIFECYCLE_VARIANTS: LifecycleVariantInfo[] = [
  { id: 'nudge_2w', label: '2-week nudge', kind: 'nudge_2w', variant: 'default' },
  { id: 'feedback_1m_active', label: '1-month feedback: active', kind: 'feedback_1m', variant: 'active' },
  { id: 'feedback_1m_inactive', label: '1-month feedback: inactive', kind: 'feedback_1m', variant: 'inactive' },
  ...[3, 6, 12, 18].flatMap((months): LifecycleVariantInfo[] => [
    { id: `milestone_${months}_progress`, label: `${milestoneLabel(months)}: progress`, kind: 'milestone', variant: 'progress', months },
    { id: `milestone_${months}_quiet`, label: `${milestoneLabel(months)}: quiet`, kind: 'milestone', variant: 'quiet', months },
  ]),
  { id: 'checkin', label: 'Check-in', kind: 'checkin', variant: 'default' },
]

export const SAMPLE_PROGRESS: OrgProgress = { assessmentsCompleted: 2, startRung: 2, currentRung: 4, actionsCompleted: 7, documents: 18, validatedRung: 3 }

/** Renders one catalogue entry with made-up people and numbers. Links are placeholders: nothing in a preview is a real signed link. */
export function renderSample(id: string, appUrl: string, now = new Date()): LifecycleEmail | null {
  const info = LIFECYCLE_VARIANTS.find((v) => v.id === id)
  if (!info) return null
  const base = appUrl.replace(/\/+$/, '')
  return renderLifecycleEmail({
    kind: info.kind, variant: info.variant, name: 'Amina Okoro', email: 'amina@riverbend.example', orgName: 'Riverbend Cooperative',
    appUrl: base, now, months: info.months, progress: info.variant === 'progress' ? SAMPLE_PROGRESS : undefined,
    links: {
      cta: `${base}/preview/button`, badge: info.variant === 'progress' ? `${base}/preview/badge` : undefined,
      survey: info.variant === 'progress' ? `${base}/preview/survey` : undefined,
      unsubscribe: `${base}/preview/unsubscribe`, preferences: `${base}/preview/preferences`,
    },
  })
}
