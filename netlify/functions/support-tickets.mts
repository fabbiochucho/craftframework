import type { Config } from '@netlify/functions'
import { randomUUID } from 'node:crypto'
import { asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, supportTicketEvents, supportTickets } from '../../db/schema.js'
import { forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { decryptField, encryptField } from '../lib/crypto.js'
import { logger, monitored } from '../lib/logger.js'
import { sendReminderEmail } from '../lib/reminder-email.js'
import { openTicket } from '../lib/support-tickets.js'
import {
  describeChanges, inboxOrder, isDone, isOverdue, matchesSearch, MANUAL_SOURCES, TICKET_CATEGORIES, TICKET_PRIORITIES,
  TICKET_STATUSES, type TicketSummary,
} from '../../src/lib/supportTickets.js'

// /api/support-tickets — the internal support tracker (Admin → Support). Super Admin with MFA only, for reading too:
// tickets hold people's messages and contact details.
//   GET                       inbox: ?status=active|<status>|all &source= &q=   (+ counts)
//   GET    :id                one ticket with its full message and timeline
//   POST                      log a request by hand { subject, body, source, contactName?, contactEmail?, organisation?, category?, priority? }
//   PATCH  :id                { status?, priority?, category?, dueAt?, subject?, organisation?, contactName?, contactEmail? }
//   POST   :id/notes          { body }   internal note, never sent
//   POST   :id/reply          { body, status? }   emails the contact (Resend) and records the reply

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const REPLY_TO = 'craftframework@becomechange.institute'
const email = z.string().trim().max(254).regex(/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/)
const createSchema = z.object({
  subject: z.string().trim().min(2).max(200), body: z.string().trim().max(10_000).default(''),
  source: z.enum(MANUAL_SOURCES), contactName: z.string().trim().max(200).optional(),
  contactEmail: z.union([email, z.literal('')]).optional(), organisation: z.string().trim().max(200).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(), priority: z.enum(TICKET_PRIORITIES).optional(),
}).strict()
const patchSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(), priority: z.enum(TICKET_PRIORITIES).optional(), category: z.enum(TICKET_CATEGORIES).optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(), subject: z.string().trim().min(2).max(200).optional(),
  organisation: z.string().trim().max(200).optional(), contactName: z.string().trim().max(200).optional(),
  contactEmail: z.union([email, z.literal('')]).optional(),
}).strict()
const noteSchema = z.object({ body: z.string().trim().min(1).max(10_000) }).strict()
const replySchema = z.object({ body: z.string().trim().min(1).max(10_000), status: z.enum(TICKET_STATUSES).optional() }).strict()

type Row = typeof supportTickets.$inferSelect
const summary = (r: Row): TicketSummary => ({
  id: r.id, subject: decryptField(r.subject), source: r.source, contactName: decryptField(r.contactName),
  contactEmail: decryptField(r.contactEmail), organisation: r.organisation, category: r.category, priority: r.priority,
  status: r.status, dueAt: r.dueAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
})
const audit = (actor: string, action: string, id: number) => ({ actor, action, target: `support ticket #${id}`, category: 'Support' })

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    if (!isSuperAdmin(caller.email) || caller.role !== 'super_admin' || caller.readOnly) return forbidden()
    const url = new URL(req.url)
    const origin = req.headers.get('origin')
    if (req.method !== 'GET' && origin && origin !== url.origin) return forbidden()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock

    const [idText, action] = url.pathname.replace(/^\/api\/support-tickets\/?/, '').split('/')
    const now = new Date()

    if (req.method === 'GET' && !idText) {
      // ponytail: fields are encrypted, so filtering happens after decrypting the latest 2,000 tickets; move to a
      // search index if the tracker ever outgrows that.
      const all = (await db.select().from(supportTickets).orderBy(desc(supportTickets.id)).limit(2000)).map(summary)
      const status = url.searchParams.get('status') ?? 'active'
      const source = url.searchParams.get('source') ?? ''
      const q = url.searchParams.get('q') ?? ''
      const tickets = all
        .filter((t) => status === 'all' || (status === 'active' ? !isDone(t.status) : status === 'overdue' ? isOverdue(t, now) : t.status === status))
        .filter((t) => !source || t.source === source)
        .filter((t) => matchesSearch(t, q))
        .sort(inboxOrder(now))
      const counts: Record<string, number> = { overdue: all.filter((t) => isOverdue(t, now)).length }
      for (const s of TICKET_STATUSES) counts[s] = all.filter((t) => t.status === s).length
      return json({ tickets, counts })
    }

    if (req.method === 'POST' && !idText) {
      const p = createSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Give the request a subject (2 to 200 characters), a source and a valid email if any.' }, 400)
      const id = await db.transaction(async (tx) => {
        const created = await openTicket(tx, { ...p.data, createdBy: caller.email })
        if (created) await tx.insert(auditLogs).values(audit(caller.email, 'Logged a support request', created))
        return created
      })
      return json({ id }, 201)
    }

    const id = Number(idText)
    if (!Number.isInteger(id) || id <= 0) return json({ error: 'Not found' }, 404)
    const [row] = await db.select().from(supportTickets).where(eq(supportTickets.id, id))
    if (!row) return json({ error: 'Not found' }, 404)

    if (req.method === 'GET' && !action) {
      const events = await db.select().from(supportTicketEvents).where(eq(supportTicketEvents.ticketId, id)).orderBy(asc(supportTicketEvents.id))
      return json({
        ticket: { ...summary(row), body: decryptField(row.body), sourceRef: row.sourceRef, createdBy: row.createdBy, resolvedAt: row.resolvedAt?.toISOString() ?? null },
        events: events.map((e) => ({ id: e.id, kind: e.kind, body: decryptField(e.body), actor: e.actor, emailStatus: e.emailStatus, createdAt: e.createdAt.toISOString() })),
      })
    }

    if (req.method === 'PATCH' && !action) {
      const p = patchSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Check the status, priority, category, due date and email.' }, 400)
      const before = summary(row)
      const after = { ...p.data }
      const change = describeChanges(before, after)
      if (!change) return json({ ok: true })
      const set: Partial<typeof supportTickets.$inferInsert> = { updatedAt: now }
      if (after.status) {
        set.status = after.status
        set.resolvedAt = isDone(after.status) ? (row.resolvedAt ?? now) : null
      }
      if (after.priority) set.priority = after.priority
      if (after.category) set.category = after.category
      if (after.dueAt !== undefined) set.dueAt = after.dueAt ? new Date(after.dueAt) : null
      if (after.subject) set.subject = encryptField(after.subject)
      if (after.organisation !== undefined) set.organisation = after.organisation
      if (after.contactName !== undefined) set.contactName = encryptField(after.contactName)
      if (after.contactEmail !== undefined) set.contactEmail = encryptField(after.contactEmail)
      // The timeline names which fields changed; contact details and subject are left out of the audit log.
      await db.transaction(async (tx) => {
        await tx.update(supportTickets).set(set).where(eq(supportTickets.id, id))
        await tx.insert(supportTicketEvents).values({ ticketId: id, kind: 'change', actor: caller.email, body: encryptField(change) })
        await tx.insert(auditLogs).values(audit(caller.email, `Updated support ticket (${Object.keys(after).join(', ')})`, id))
      })
      return json({ ok: true })
    }

    if (req.method === 'POST' && action === 'notes') {
      const p = noteSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Write a note (up to 10,000 characters).' }, 400)
      await db.transaction(async (tx) => {
        await tx.insert(supportTicketEvents).values({ ticketId: id, kind: 'note', actor: caller.email, body: encryptField(p.data.body) })
        await tx.update(supportTickets).set({ updatedAt: now, ...(row.status === 'new' ? { status: 'open' } : {}) }).where(eq(supportTickets.id, id))
      })
      return json({ ok: true }, 201)
    }

    if (req.method === 'POST' && action === 'reply') {
      const p = replySchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Write a reply (up to 10,000 characters).' }, 400)
      const to = decryptField(row.contactEmail)
      if (!to) return json({ error: 'This ticket has no contact email. Add one first, or reply another way and log it as a note.' }, 400)
      const emailStatus = await sendReminderEmail({
        to: [to], reply_to: REPLY_TO, subject: `Re: ${decryptField(row.subject)} [CRAFT support #${id}]`,
        text: `${p.data.body}\n\n—\nCRAFT support, DiBadili Institute\nReply to this email to continue. Reference: #${id}`,
      }, `support-reply/${randomUUID()}`, 'support_reply')
      const sent = emailStatus === 'accepted'
      await db.transaction(async (tx) => {
        await tx.insert(supportTicketEvents).values({ ticketId: id, kind: 'reply', actor: caller.email, body: encryptField(p.data.body), emailStatus })
        await tx.update(supportTickets).set({ updatedAt: now, ...(sent ? { status: p.data.status ?? 'waiting', ...(isDone(p.data.status ?? '') ? { resolvedAt: row.resolvedAt ?? now } : {}) } : {}) }).where(eq(supportTickets.id, id))
        await tx.insert(auditLogs).values(audit(caller.email, sent ? 'Replied to support ticket' : `Support reply not sent (${emailStatus})`, id))
      })
      return sent ? json({ ok: true, emailStatus }, 201) : json({ error: emailStatus === 'not_configured' ? 'Email is not configured, so the reply was saved but not sent.' : 'The email provider refused the reply; it was saved but not sent. Try again.', emailStatus }, 502)
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    logger.error('support-tickets', 'request failed', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
}

export const config: Config = { path: ['/api/support-tickets', '/api/support-tickets/*'] }

export default monitored(handleRequest)
