// Evidence requests inside an engagement: who stands on which side, the emails, and the daily overdue
// reminders. The HTTP surface is netlify/functions/evidence-requests.mts.
import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  auditLogs, engagementMembers, evidenceRequests, firmMembers, organizations, validationEngagements,
  type EvidenceRequestRow, type ValidationEngagementRow,
} from '../../db/schema.js'
import { canAccessOrg, type Caller } from './auth.js'
import { logger } from './logger.js'
import { publicBaseUrl } from './public-validation.js'
import { notify, orgContactsFor } from './validation-lifecycle.js'

export const OPEN_STATUSES = ['open', 'more_needed'] as const
export const REMINDER_EVERY_DAYS = 3
export const MAX_REMINDERS = 5
export const MAX_REQUESTS_PER_ENGAGEMENT = 100

export const engagementLink = (engagementId: string) => `${publicBaseUrl()}/engagements/${encodeURIComponent(engagementId)}`

/** 'organization' (staff who may write the organisation), 'reviewer' (validator team or funder), or null. */
export async function sideOf(e: ValidationEngagementRow, caller: Caller): Promise<'organization' | 'reviewer' | null> {
  if (caller.orgId === e.orgId && (await canAccessOrg(caller, e.orgId, 'write'))) return 'organization'
  if (e.validatorEmail && e.validatorEmail === caller.email) return 'reviewer'
  const [member] = await db.select({ id: engagementMembers.id }).from(engagementMembers).where(and(
    eq(engagementMembers.engagementId, e.id), eq(engagementMembers.email, caller.email), eq(engagementMembers.status, 'named'), eq(engagementMembers.orgApproved, true),
  ))
  if (member) return 'reviewer'
  const firmIds = [e.validatorFirmId, e.funderFirmId].filter((x): x is string => !!x)
  if (firmIds.length) {
    const rows = await db.select({ firmId: firmMembers.firmId, role: firmMembers.role }).from(firmMembers)
      .where(and(inArray(firmMembers.firmId, firmIds), eq(firmMembers.email, caller.email), eq(firmMembers.status, 'active')))
    // The validator firm's owner manages its engagements; any active member of the funding partner reviews.
    if (rows.some((r) => (r.firmId === e.validatorFirmId && r.role === 'owner') || r.firmId === e.funderFirmId)) return 'reviewer'
  }
  return null
}

export async function audit(actor: string, action: string, requestId: string, orgId: string) {
  try {
    await db.insert(auditLogs).values({ actor, action, target: requestId, category: 'Evidence request', orgId })
  } catch (err) {
    logger.error('evidence-requests', 'audit failed', err)
  }
}

const orgName = async (orgId: string) => (await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)))[0]?.name ?? 'your organisation'

/** Tell the organisation about a new request, or that more is needed. Best effort. */
export async function tellOrganisation(r: EvidenceRequestRow, what: 'new' | 'more_needed' | 'cancelled' | 'accepted') {
  const name = await orgName(r.orgId)
  const subject = {
    new: `CRAFT: evidence requested from ${name}: ${r.title}`,
    more_needed: `CRAFT: more evidence needed: ${r.title}`,
    cancelled: `CRAFT: evidence request withdrawn: ${r.title}`,
    accepted: `CRAFT: evidence accepted: ${r.title}`,
  }[what]
  const body = {
    new: `${r.requestedBy} asked ${name} for evidence as part of an engagement on CRAFT.\n\nWhat is needed: ${r.title}${r.indicatorId ? `\nIndicator: ${r.indicatorId}` : ''}\nDue: ${r.dueOn}${r.note ? `\nNote: ${r.note}` : ''}\n\nUpload the document to your Evidence registry (or pick one already there), link it to the request and mark it submitted:\n${engagementLink(r.engagementId)}`,
    more_needed: `The reviewer looked at what you submitted for "${r.title}" and needs more.\n\nTheir note: ${r.reviewNote}\nDue: ${r.dueOn}\n\nAdd to the request and submit it again:\n${engagementLink(r.engagementId)}`,
    cancelled: `The request for "${r.title}" was withdrawn. Nothing more is needed for it.\n\n${engagementLink(r.engagementId)}`,
    accepted: `The reviewer accepted the evidence you submitted for "${r.title}".${r.reviewNote ? `\n\nTheir note: ${r.reviewNote}` : ''}\n\n${engagementLink(r.engagementId)}`,
  }[what]
  return notify(await orgContactsFor(r.orgId), subject, body)
}

/** Tell the requester the organisation submitted. Best effort. */
export async function tellRequester(r: EvidenceRequestRow) {
  const name = await orgName(r.orgId)
  return notify([r.requestedBy], `CRAFT: ${name} submitted evidence: ${r.title}`,
    `${name} submitted evidence for "${r.title}".${r.submissionNote ? `\n\nTheir note: ${r.submissionNote}` : ''}\n\nReview it and accept it or ask for more:\n${engagementLink(r.engagementId)}`)
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Daily: remind the organisation about overdue requests (every REMINDER_EVERY_DAYS days, at most
 * MAX_REMINDERS times) and tell the requester once when a request first goes overdue. A reminder is
 * recorded only after the provider accepted it, so a failure is retried the next day.
 */
export async function sendEvidenceRequestReminders(now = new Date()): Promise<{ checked: number; sent: number; failed: number }> {
  const cutoff = new Date(now.getTime() - REMINDER_EVERY_DAYS * 86_400_000)
  const due = await db.select({ r: evidenceRequests }).from(evidenceRequests)
    .innerJoin(validationEngagements, eq(validationEngagements.id, evidenceRequests.engagementId))
    .where(and(
      inArray(evidenceRequests.status, [...OPEN_STATUSES]), lt(evidenceRequests.dueOn, isoDay(now)),
      lt(evidenceRequests.reminderCount, MAX_REMINDERS), or(isNull(evidenceRequests.remindedAt), lt(evidenceRequests.remindedAt, cutoff)),
      eq(validationEngagements.status, 'active'),
    ))
  let sent = 0
  let failed = 0
  for (const { r } of due) {
    const name = await orgName(r.orgId)
    const outcome = await notify(await orgContactsFor(r.orgId), `CRAFT: evidence overdue: ${r.title}`,
      `The evidence "${r.title}" requested from ${name} was due on ${r.dueOn} and has not been submitted yet.\n\nLink a document from your Evidence registry and mark the request submitted:\n${engagementLink(r.engagementId)}\n\nIf you cannot provide it, reply to the reviewer (${r.requestedBy}) to agree a new date.`)
    if (outcome === 'accepted' || outcome === 'skipped') {
      if (r.reminderCount === 0) await notify([r.requestedBy], `CRAFT: evidence overdue: ${r.title}`, `${name} has not yet submitted "${r.title}", due on ${r.dueOn}. They have been reminded.\n\n${engagementLink(r.engagementId)}`)
      await db.update(evidenceRequests).set({ remindedAt: now, reminderCount: r.reminderCount + 1 }).where(eq(evidenceRequests.id, r.id))
      await audit('system', `overdue reminder ${r.reminderCount + 1}`, r.id, r.orgId)
      sent += 1
    } else {
      failed += 1
    }
  }
  return { checked: due.length, sent, failed }
}
