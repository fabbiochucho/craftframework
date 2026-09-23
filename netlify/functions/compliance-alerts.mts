import type { Config } from '@netlify/functions'
import { and, eq, lte, ne } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { complianceItems, organizations } from '../../db/schema.js'
import { logger } from '../lib/logger.js'

// ============================================================================
// CRAFT v4.0 — Scheduled compliance alerts (Global Fund PR reporting cycles)
// ----------------------------------------------------------------------------
// Runs daily. Scans the compliance calendar for reporting/regulatory deadlines
// falling inside the 90-day horizon and fans out reminder emails at the 90-day,
// 30-day and overdue thresholds via Resend. Wired as a scheduled function — see
// `config.schedule` below — which mirrors the `[[scheduled_functions]]` block
// documented in netlify.toml.
//
// Persistence: the calendar lives in the Netlify Database (compliance_items).
// This function reads it through Drizzle and joins organizations to resolve the
// recipient email. With no RESEND_API_KEY configured it logs what it WOULD send,
// so the cron wiring is verifiable in preview deploys.
// ============================================================================

const MS_DAY = 86_400_000

interface ComplianceItem {
  id: string
  organization_id: string
  type: string
  title: string
  due_date: string // ISO yyyy-mm-dd
  recipient_email: string
}

type Tier = '90-day' | '30-day' | 'overdue'

function tierFor(daysUntil: number): Tier | null {
  if (daysUntil < 0) return 'overdue'
  if (daysUntil <= 30) return '30-day'
  if (daysUntil <= 90) return '90-day'
  return null
}

function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Read every non-submitted obligation due within the 90-day horizon, joining the
// owning organization to resolve a notification recipient.
//
//   SELECT * FROM compliance_items
//   WHERE status <> 'submitted'
//     AND next_due_date <= CURRENT_DATE + INTERVAL '90 days'
//
async function queryUpcomingComplianceItems(today: Date): Promise<ComplianceItem[]> {
  const horizon = toISO(new Date(today.getTime() + 90 * MS_DAY))
  try {
    const rows = await db
      .select({
        id: complianceItems.id,
        orgId: complianceItems.orgId,
        type: complianceItems.type,
        name: complianceItems.name,
        dueDate: complianceItems.nextDueDate,
        owner: complianceItems.owner,
        orgEmail: organizations.email,
      })
      .from(complianceItems)
      .leftJoin(organizations, eq(complianceItems.orgId, organizations.id))
      .where(and(ne(complianceItems.status, 'submitted'), lte(complianceItems.nextDueDate, horizon)))
    return rows.map((r) => ({
      id: r.id,
      organization_id: r.orgId,
      type: r.type,
      title: r.name,
      due_date: r.dueDate,
      recipient_email: r.orgEmail || r.owner || 'compliance@becomechange.institute',
    }))
  } catch (err) {
    logger.error("compliance-alerts", "query failed", err)
    return []
  }
}

async function sendResendEmail(item: ComplianceItem, tier: Tier): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const subjectTier = tier === 'overdue' ? 'OVERDUE' : tier === '30-day' ? 'Urgent (30 days)' : 'Upcoming (90 days)'
  const subject = `[${subjectTier}] ${item.type} due ${item.due_date}: ${item.title}`

  // No key configured (e.g. preview build) — log instead of failing the run.
  if (!apiKey) {
    console.log(`[compliance-alerts] would email ${item.recipient_email} — ${subject}`)
    return
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: 'CRAFT Compliance <compliance@becomechange.institute>',
      to: item.recipient_email,
      subject,
      text:
        `This is an automated CRAFT reminder for a Global Fund reporting obligation.\n\n` +
        `Obligation: ${item.type} — ${item.title}\nDue: ${item.due_date}\nStatus: ${tier}\n\n` +
        `Please prepare and submit the report through your CRAFT secure workspace.`,
    }),
  }).catch(err => logger.error("compliance-alerts", "Resend error", err))
}

export default async (req: Request) => {
  // Scheduled invocations receive the next run time in the body.
  const next_run = await req.json().then((b: { next_run?: string }) => b?.next_run).catch(() => undefined)
  const today = new Date()

  const items = await queryUpcomingComplianceItems(today)
  let sent = 0
  for (const item of items) {
    const daysUntil = Math.floor((Date.parse(item.due_date) - today.getTime()) / MS_DAY)
    const tier = tierFor(daysUntil)
    // Any obligation entering the 90/30/overdue window triggers a reminder.
    if (tier) {
      await sendResendEmail(item, tier)
      sent += 1
    }
  }

  console.log(`[compliance-alerts] processed ${items.length} items, sent ${sent} alerts. Next run: ${next_run ?? 'n/a'}`)
  return new Response(JSON.stringify({ processed: items.length, sent }), {
    headers: { 'content-type': 'application/json' },
  })
}

export const config: Config = {
  schedule: '@daily',
}
