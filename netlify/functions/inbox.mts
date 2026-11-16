import type { Config } from '@netlify/functions'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { inboxMessages } from '../../db/schema.js'
import { resolveCaller, unauthorized } from '../lib/auth.js'
import { contactsOf } from '../lib/inbox-contacts.js'
import { logger, monitored } from '../lib/logger.js'
import { sendReminderEmail } from '../lib/reminder-email.js'

// /api/inbox — the signed-in person's in-app inbox: copies of the notification emails CRAFT sent them,
// and messages from people they work with. Only ever scoped to the verified caller's own address.
//   GET                         -> { messages (newest 100), unread }
//   GET ?contacts=1             -> { contacts } the people the caller may message (see inbox-contacts.ts)
//   POST { id? }                -> mark one message (or, without an id, all of them) as read
//   POST { to, subject, body }  -> send a message to a contact (also emailed to them)
const SENDS_PER_HOUR = 30
const bad = (error: string, status = 400) => Response.json({ error }, { status })

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mine = eq(inboxMessages.recipient, caller.email)
    if (req.method === 'GET') {
      if (new URL(req.url).searchParams.get('contacts')) return Response.json({ contacts: await contactsOf(caller) })
      // ponytail: newest 100 only, no paging; add a cursor if inboxes grow past that.
      const messages = await db.select().from(inboxMessages).where(mine).orderBy(desc(inboxMessages.createdAt), desc(inboxMessages.id)).limit(100)
      return Response.json({ messages, unread: messages.filter((m) => !m.readAt).length })
    }
    if (req.method === 'POST') {
      const input = (await req.json().catch(() => ({}))) as { id?: unknown; to?: unknown; subject?: unknown; body?: unknown }
      if (input.to !== undefined) {
        if (caller.readOnly) return bad('Forbidden', 403)
        const to = String(input.to).trim().toLowerCase()
        const subject = typeof input.subject === 'string' ? input.subject.trim() : ''
        const body = typeof input.body === 'string' ? input.body.trim() : ''
        if (!subject || subject.length > 200) return bad('Give the message a subject of at most 200 characters')
        if (!body || body.length > 5000) return bad('Write a message of at most 5,000 characters')
        // The Super Admin runs the platform and may write to anyone; everyone else only to people they work with.
        if (caller.role !== 'super_admin' && !(await contactsOf(caller)).some((c) => c.email === to)) {
          return bad('You can only message people you already work with on CRAFT', 403)
        }
        const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(inboxMessages)
          .where(and(eq(inboxMessages.sender, caller.email), gt(inboxMessages.createdAt, new Date(Date.now() - 3_600_000))))
        if (n >= SENDS_PER_HOUR) return bad('You have sent a lot of messages in the last hour. Try again later.', 429)
        await db.insert(inboxMessages).values({ recipient: to, kind: 'message', subject, body, sender: caller.email })
        // The email is only a pointer to the inbox (no second inbox copy); replies go to the sender.
        const emailed = await sendReminderEmail({
          to, subject: `CRAFT message from ${caller.name}: ${subject}`, reply_to: caller.email,
          text: `${caller.name} (${caller.email}) sent you a message on CRAFT:\n\n${body}\n\nReply in your CRAFT inbox, or by replying to this email.`,
        }, undefined, 'message', false)
        return Response.json({ ok: true, emailed: emailed === 'accepted' })
      }
      const id = Number(input.id)
      await db.update(inboxMessages).set({ readAt: new Date() })
        .where(and(mine, isNull(inboxMessages.readAt), ...(Number.isInteger(id) ? [eq(inboxMessages.id, id)] : [])))
      return Response.json({ ok: true })
    }
    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error('/api/inbox', 'failed', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const config: Config = { path: '/api/inbox' }

export default monitored(handleRequest)
