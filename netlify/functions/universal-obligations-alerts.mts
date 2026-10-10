import type { Config } from '@netlify/functions'
import { logger } from '../lib/logger.js'

// ============================================================================
// CRAFT v4.0 — Global Regulatory Obligations cron (Feature 7)
// ----------------------------------------------------------------------------
// Runs daily. Tracks high-stakes GLOBAL statutory & regulatory deadlines from a
// hardcoded catalog (empirical fidelity — exact instruments and cadences) and
// fans out 90-day / 30-day / Overdue reminders to the Chief Compliance Officer
// (CCO) and CFO via Resend.
//
// Unlike compliance-alerts.mts (which reads the per-tenant compliance_items
// table for Global Fund PR cycles), this job derives its dates from the fixed
// regulatory calendar below, so it needs no database. With no RESEND_API_KEY it
// logs what it WOULD send, keeping the cron wiring verifiable in preview deploys.
// ============================================================================

const MS_DAY = 86_400_000

type Tier = '90-day' | '30-day' | 'overdue'

// A recurring statutory obligation with a rule to compute its next occurrence.
interface RegulatoryObligation {
  code: string
  authority: string
  title: string
  citation: string
  cadence: 'annual' | 'quarterly' | 'monthly' | 'event-driven'
  // For annual: [month(1-12), day]. For quarterly/monthly: day-of-period.
  anchor?: { month?: number; day: number }
  // Event-driven windows (e.g. breach reporting) are informational only.
  note?: string
}

// --- The global regulatory calendar (illustrative anchor dates) --------------
const REGULATORY_CALENDAR: RegulatoryObligation[] = [
  // Nigeria — CBN / SEC / FRCN
  { code: 'CBN-MPR', authority: 'CBN', title: 'Monthly prudential returns', citation: 'CBN Prudential Guidelines', cadence: 'monthly', anchor: { day: 10 } },
  { code: 'CBN-QPR', authority: 'CBN', title: 'Quarterly prudential returns', citation: 'CBN Prudential Guidelines', cadence: 'quarterly', anchor: { day: 15 } },
  { code: 'FRCN-LEVY', authority: 'FRCN', title: 'Annual FRCN dues / levy', citation: 'FRC of Nigeria Act 2011', cadence: 'annual', anchor: { month: 6, day: 30 } },
  { code: 'NG-AUDIT-ROT', authority: 'FRCN', title: 'Statutory audit firm rotation review (10-year max)', citation: 'NCCG 2018 §Audit', cadence: 'annual', anchor: { month: 12, day: 31 }, note: 'External audit firm tenure must not exceed 10 years.' },
  { code: 'SEC-NG-FILING', authority: 'SEC Nigeria', title: 'Annual issuer disclosure filing', citation: 'ISA 2007', cadence: 'annual', anchor: { month: 3, day: 31 } },

  // United States — SOX / SEC
  { code: 'US-SOX-CERT', authority: 'SEC', title: 'SOX §302/§404 certification (10-K)', citation: 'Sarbanes-Oxley Act 2002', cadence: 'annual', anchor: { month: 3, day: 1 } },

  // European Union — CSRD / DORA / Basel
  { code: 'EU-CSRD', authority: 'European Commission', title: 'CSRD / ESRS sustainability report', citation: 'Directive (EU) 2022/2464', cadence: 'annual', anchor: { month: 4, day: 30 } },
  { code: 'EU-BASEL-REP', authority: 'EBA', title: 'Basel III COREP/FINREP reporting', citation: 'CRR / Basel III', cadence: 'quarterly', anchor: { day: 12 } },

  // GCC — Zakat
  { code: 'GCC-ZAKAT', authority: 'ZATCA', title: 'Zakat calculation & remittance', citation: 'GCC Zakat regulations', cadence: 'annual', anchor: { month: 4, day: 30 } },

  // OHADA — annual filings
  { code: 'OHADA-FILING', authority: 'OHADA', title: 'OHADA annual financial statement filing', citation: 'AUDCIF SYSCOHADA', cadence: 'annual', anchor: { month: 7, day: 31 } },

  // Data protection — 72h breach windows (event-driven, informational)
  { code: 'GDPR-BREACH', authority: 'EDPB / NDPC', title: 'Personal-data breach reporting window', citation: 'GDPR Art.33 / NDPA 2023', cadence: 'event-driven', note: '72-hour breach-notification window once an incident is detected.' },
]

function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function tierFor(daysUntil: number): Tier | null {
  if (daysUntil < 0 && daysUntil >= -30) return 'overdue' // only alert recently-overdue items
  if (daysUntil >= 0 && daysUntil <= 30) return '30-day'
  if (daysUntil > 30 && daysUntil <= 90) return '90-day'
  return null
}

// Compute the next occurrence date (ISO) for an obligation relative to `today`.
function nextOccurrence(ob: RegulatoryObligation, today: Date): string | null {
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()
  if (ob.cadence === 'annual' && ob.anchor?.month) {
    let next = new Date(y, ob.anchor.month - 1, ob.anchor.day)
    if (next.getTime() < new Date(y, m, d).getTime()) next = new Date(y + 1, ob.anchor.month - 1, ob.anchor.day)
    return toISO(next)
  }
  if (ob.cadence === 'quarterly' && ob.anchor) {
    // Next quarter-end month (Mar/Jun/Sep/Dec) + anchor day.
    const quarterEndMonths = [2, 5, 8, 11]
    for (const qm of quarterEndMonths) {
      const cand = new Date(y, qm, ob.anchor.day)
      if (cand.getTime() >= new Date(y, m, d).getTime()) return toISO(cand)
    }
    return toISO(new Date(y + 1, 2, ob.anchor.day))
  }
  if (ob.cadence === 'monthly' && ob.anchor) {
    let cand = new Date(y, m, ob.anchor.day)
    if (cand.getTime() < new Date(y, m, d).getTime()) cand = new Date(y, m + 1, ob.anchor.day)
    return toISO(cand)
  }
  return null // event-driven — no fixed date
}

async function sendResendEmail(ob: RegulatoryObligation, dueISO: string, tier: Tier): Promise<'accepted' | 'failed' | 'not_configured'> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL || process.env.INVITE_FROM_EMAIL
  const cco = process.env.CCO_EMAIL || 'compliance@becomechange.institute'
  const cfo = process.env.CFO_EMAIL || 'finance@becomechange.institute'
  const subjectTier = tier === 'overdue' ? 'OVERDUE' : tier === '30-day' ? 'Urgent (30 days)' : 'Upcoming (90 days)'
  const subject = `[${subjectTier}] ${ob.authority} — ${ob.title} due ${dueISO}`

  if (!apiKey || !from || /@resend\.dev\b/i.test(from)) {
    console.log(`[universal-obligations-alerts] would email ${cco}, ${cfo} — ${subject}`)
    return 'not_configured'
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [cco, cfo],
      subject,
      text:
        `Automated CRAFT global regulatory reminder.\n\n` +
        `Obligation: ${ob.title}\nAuthority: ${ob.authority}\nCitation: ${ob.citation}\n` +
        `Due: ${dueISO}\nStatus: ${tier}\n` +
        (ob.note ? `Note: ${ob.note}\n` : '') +
        `\nAction the filing through your CRAFT secure workspace.`,
    }),
  }).catch(err => logger.error("universal-obligations-alerts", "Resend error", err))
  if (!response?.ok) logger.warn('universal-obligations-alerts', `Provider rejected reminder (${response?.status ?? 'network error'})`)
  return response?.ok ? 'accepted' : 'failed'
}

export default async (req: Request) => {
  const next_run = await req.json().then((b: { next_run?: string }) => b?.next_run).catch(() => undefined)
  const today = new Date()
  let sent = 0
  let failed = 0
  let notConfigured = 0
  let evaluated = 0

  for (const ob of REGULATORY_CALENDAR) {
    if (ob.cadence === 'event-driven') continue
    const dueISO = nextOccurrence(ob, today)
    if (!dueISO) continue
    evaluated += 1
    const daysUntil = Math.floor((Date.parse(dueISO) - today.getTime()) / MS_DAY)
    const tier = tierFor(daysUntil)
    if (tier) {
      const result = await sendResendEmail(ob, dueISO, tier)
      if (result === 'accepted') sent += 1
      else if (result === 'failed') failed += 1
      else notConfigured += 1
    }
  }

  console.log(`[universal-obligations-alerts] evaluated ${evaluated} obligations, sent ${sent} alerts. Next run: ${next_run ?? 'n/a'}`)
  return new Response(JSON.stringify({ evaluated, sent, failed, notConfigured }), {
    status: failed ? 502 : 200,
    headers: { 'content-type': 'application/json' },
  })
}

export const config: Config = {
  schedule: '@daily',
}
