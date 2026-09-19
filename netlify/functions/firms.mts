import type { Config } from '@netlify/functions'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { firmMembers, firms } from '../../db/schema.js'

// /api/firms — first-class consulting firms and their seats. A firm lets several
// consultants share one client book (portfolios + access grants held by firm_id)
// instead of a single reviewer email. Each seat is independently revocable.
export default async (req: Request) => {
  try {
    if (req.method === 'GET') {
      const params = new URL(req.url).searchParams
      const email = params.get('email')
      const firmId = params.get('firmId')
      if (email) {
        // Firms this person is a member of, with the full member roster.
        const lower = email.trim().toLowerCase()
        const mine = await db.select().from(firmMembers).where(eq(firmMembers.email, lower))
        const firmIds = mine.map((m) => m.firmId)
        if (!firmIds.length) return Response.json([])
        const firmRows = await db.select().from(firms).where(inArray(firms.id, firmIds))
        const memberRows = await db.select().from(firmMembers).where(inArray(firmMembers.firmId, firmIds))
        return Response.json(
          firmRows.map((f) => ({
            id: f.id,
            name: f.name,
            createdBy: f.createdBy ?? undefined,
            members: memberRows
              .filter((m) => m.firmId === f.id)
              .map((m) => ({ email: m.email, role: m.role, status: m.status })),
          })),
        )
      }
      if (firmId) {
        const members = await db.select().from(firmMembers).where(eq(firmMembers.firmId, firmId))
        return Response.json(members.map((m) => ({ email: m.email, role: m.role, status: m.status })))
      }
      return Response.json([])
    }

    // POST — create a firm (with its creator as the owner seat).
    // body: { name, createdBy }
    if (req.method === 'POST') {
      const body = await req.json()
      const name = String(body.name ?? '').trim()
      const createdBy = body.createdBy ? String(body.createdBy).trim().toLowerCase() : null
      if (!name) return Response.json({ error: 'name required' }, { status: 400 })
      const id = `firm_${crypto.randomUUID()}`
      const [firm] = await db.insert(firms).values({ id, name, createdBy }).returning()
      if (createdBy) {
        await db
          .insert(firmMembers)
          .values({ firmId: id, email: createdBy, role: 'owner', status: 'active' })
          .onConflictDoNothing()
      }
      return Response.json(firm, { status: 201 })
    }

    // PUT — add or update a seat. body: { firmId, email, role?, status? }
    if (req.method === 'PUT') {
      const body = await req.json()
      const firmId = String(body.firmId ?? '').trim()
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!firmId || !email) return Response.json({ error: 'firmId and email required' }, { status: 400 })
      await db
        .insert(firmMembers)
        .values({ firmId, email, role: body.role ?? 'consultant', status: body.status ?? 'active' })
        .onConflictDoUpdate({
          target: [firmMembers.firmId, firmMembers.email],
          set: { role: body.role ?? 'consultant', status: body.status ?? 'active' },
        })
      return Response.json({ ok: true })
    }

    // DELETE — remove a seat. ?firmId=&email=
    if (req.method === 'DELETE') {
      const params = new URL(req.url).searchParams
      const firmId = params.get('firmId')
      const email = params.get('email')
      if (!firmId || !email) return Response.json({ error: 'firmId and email required' }, { status: 400 })
      await db
        .delete(firmMembers)
        .where(and(eq(firmMembers.firmId, firmId), eq(firmMembers.email, email.trim().toLowerCase())))
      return Response.json({ ok: true })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    console.error('/api/firms failed', err)
    return Response.json({ error: 'Firm request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/firms',
}
