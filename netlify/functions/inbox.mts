import type { Config } from '@netlify/functions'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { inboxMessages } from '../../db/schema.js'
import { resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'

// /api/inbox — the signed-in person's copies of the notification emails CRAFT sent them.
// Only ever scoped to the verified caller's own address; there is no way to read another inbox.
//   GET           -> { messages (newest 100), unread }
//   POST { id? }  -> mark one message (or, without an id, all of them) as read
const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mine = eq(inboxMessages.recipient, caller.email)
    if (req.method === 'GET') {
      // ponytail: newest 100 only, no paging; add a cursor if inboxes grow past that.
      const messages = await db.select().from(inboxMessages).where(mine).orderBy(desc(inboxMessages.createdAt), desc(inboxMessages.id)).limit(100)
      return Response.json({ messages, unread: messages.filter((m) => !m.readAt).length })
    }
    if (req.method === 'POST') {
      const id = Number(((await req.json().catch(() => ({}))) as { id?: unknown }).id)
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
