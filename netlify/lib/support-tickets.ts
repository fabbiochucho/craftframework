import { db, supportTicketEvents, supportTickets } from '../../db/index.js'
import { encryptField } from './crypto.js'
import { defaultDue, type TicketCategory, type TicketPriority, type TicketSource } from '../../src/lib/supportTickets.js'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type NewTicket = {
  subject: string; body: string; source: TicketSource; sourceRef?: string
  contactName?: string; contactEmail?: string; organisation?: string
  category?: TicketCategory; priority?: TicketPriority; createdBy?: string
}

/** Opens a ticket in the support tracker with its "created" event. A repeat of the same source reference is ignored
 *  (returns null), so intake points can call this on every retry. Sensitive fields are encrypted at rest. */
export async function openTicket(exec: typeof db | Tx, t: NewTicket): Promise<number | null> {
  const now = new Date()
  const priority = t.priority ?? 'normal'
  const [row] = await exec.insert(supportTickets).values({
    subject: encryptField(t.subject.trim().slice(0, 200) || 'Support request'),
    body: encryptField(t.body),
    source: t.source, sourceRef: t.sourceRef ?? '',
    contactName: encryptField(t.contactName?.trim() ?? ''), contactEmail: encryptField(t.contactEmail?.trim() ?? ''),
    organisation: t.organisation?.trim().slice(0, 200) ?? '',
    category: t.category ?? 'question', priority, status: 'new',
    dueAt: defaultDue(priority, now), createdBy: t.createdBy ?? 'system', createdAt: now, updatedAt: now,
  }).onConflictDoNothing().returning({ id: supportTickets.id })
  if (!row) return null
  await exec.insert(supportTicketEvents).values({ ticketId: row.id, kind: 'created', actor: t.createdBy ?? 'system', body: '' })
  return row.id
}
