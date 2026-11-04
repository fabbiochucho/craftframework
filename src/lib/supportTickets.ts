// Internal support tracker (Admin → Support): the fixed lists and the rules shared by the API and the admin screen.
// Self-check: `node src/lib/supportTickets.test.ts`.

export const TICKET_STATUSES = ['new', 'open', 'waiting', 'resolved', 'closed'] as const
export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export const TICKET_CATEGORIES = ['question', 'bug', 'feature', 'account', 'data', 'complaint', 'other'] as const
export const TICKET_SOURCES = ['chat', 'escalation', 'private_report', 'contact_form', 'email', 'phone', 'whatsapp', 'meeting', 'other'] as const
/** Sources an admin can pick when logging a request by hand; the others arrive automatically. */
export const MANUAL_SOURCES = ['email', 'phone', 'whatsapp', 'meeting', 'other'] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]
export type TicketCategory = (typeof TICKET_CATEGORIES)[number]
export type TicketSource = (typeof TICKET_SOURCES)[number]

export const STATUS_LABEL: Record<TicketStatus, string> = { new: 'New', open: 'Open', waiting: 'Waiting on them', resolved: 'Resolved', closed: 'Closed' }
export const SOURCE_LABEL: Record<TicketSource, string> = {
  chat: 'Support chat', escalation: 'Bot escalation', private_report: 'Private report', contact_form: 'Contact form',
  email: 'Email', phone: 'Phone', whatsapp: 'WhatsApp', meeting: 'Meeting', other: 'Other',
}

const DAY = 24 * 60 * 60 * 1000
/** Days to respond, by priority; sets the due date when a ticket is created. */
export const RESPONSE_DAYS: Record<TicketPriority, number> = { urgent: 1, high: 2, normal: 5, low: 10 }
export const defaultDue = (priority: TicketPriority, from: Date) => new Date(from.getTime() + RESPONSE_DAYS[priority] * DAY)

export const isDone = (status: string) => status === 'resolved' || status === 'closed'
/** Overdue only while it is still ours to act on: not done, and not waiting on the other person. */
export const isOverdue = (t: { status: string; dueAt: string | Date | null }, now: Date) =>
  !isDone(t.status) && t.status !== 'waiting' && t.dueAt != null && new Date(t.dueAt).getTime() < now.getTime()

export type TicketSummary = {
  id: number; subject: string; source: string; contactName: string; contactEmail: string; organisation: string
  category: string; priority: string; status: string; dueAt: string | null; createdAt: string; updatedAt: string
}

/** Text search across the decrypted fields (they are encrypted at rest, so this runs after decryption). */
export function matchesSearch(t: Pick<TicketSummary, 'id' | 'subject' | 'contactName' | 'contactEmail' | 'organisation'>, q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  if (/^#?\d+$/.test(needle)) return String(t.id) === needle.replace('#', '')
  return [t.subject, t.contactName, t.contactEmail, t.organisation].some((f) => f.toLowerCase().includes(needle))
}

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
/** Inbox order: overdue first, then priority, then oldest due date; finished tickets last, newest first. */
export function inboxOrder(now: Date) {
  return (a: TicketSummary, b: TicketSummary) => {
    const doneA = isDone(a.status), doneB = isDone(b.status)
    if (doneA !== doneB) return doneA ? 1 : -1
    if (doneA) return b.updatedAt.localeCompare(a.updatedAt)
    const overA = isOverdue(a, now), overB = isOverdue(b, now)
    if (overA !== overB) return overA ? -1 : 1
    const p = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
    if (p) return p
    return (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9')
  }
}

/** One-line description of a field change, for the ticket timeline. */
export function describeChanges(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const label = (k: string, v: unknown) => {
    if (v == null || v === '') return '(none)'
    if (k === 'status') return STATUS_LABEL[v as TicketStatus] ?? String(v)
    if (k === 'dueAt') return new Date(v as string).toISOString().slice(0, 10)
    return String(v)
  }
  const names: Record<string, string> = { status: 'Status', priority: 'Priority', category: 'Category', dueAt: 'Due', subject: 'Subject', organisation: 'Organisation', contactName: 'Contact name', contactEmail: 'Contact email' }
  return Object.keys(after)
    .filter((k) => label(k, before[k]) !== label(k, after[k]))
    .map((k) => `${names[k] ?? k}: ${label(k, before[k])} → ${label(k, after[k])}`)
    .join('; ')
}
