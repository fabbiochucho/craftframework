import type { Config } from '@netlify/functions'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, firmMembers, firms } from '../../db/schema.js'
import { cleanList, FIRM_KINDS, natureOptions, type FirmKind } from '../../src/lib/validatorDirectory.js'
import { resolveCaller, forbidden, unauthorized, mfaRequired } from '../lib/auth.js'
import { logger } from '../lib/logger.js'

async function isFirmMember(email: string, firmId: string): Promise<boolean> {
  const [row] = await db
    .select({ email: firmMembers.email })
    .from(firmMembers)
    .where(and(eq(firmMembers.firmId, firmId), eq(firmMembers.email, email)))
    .limit(1)
  return !!row
}

async function isFirmOwner(email: string, firmId: string): Promise<boolean> {
  const [row] = await db
    .select({ role: firmMembers.role })
    .from(firmMembers)
    .where(and(eq(firmMembers.firmId, firmId), eq(firmMembers.email, email)))
    .limit(1)
  return row?.role === 'owner'
}

// Directory profile fields for a validator firm or funding partner. Returns the
// columns to write, or null when the nature/type is not one of the kind's options.
const profileSchema = z.object({
  nature: z.string().max(80).optional(),
  summary: z.string().max(2000).optional(),
  competencies: z.unknown().optional(),
  countries: z.unknown().optional(),
  sectors: z.unknown().optional(),
  ticketSize: z.string().max(80).nullable().optional(),
})
function profileFields(body: unknown, kind: FirmKind) {
  const p = profileSchema.safeParse(body)
  if (!p.success || !p.data.nature || !natureOptions(kind).includes(p.data.nature)) return null
  return {
    nature: p.data.nature,
    summary: (p.data.summary ?? '').trim(),
    competencies: cleanList(p.data.competencies),
    countries: cleanList(p.data.countries),
    sectors: kind === 'funding_partner' ? cleanList(p.data.sectors) : [],
    ticketSize: kind === 'funding_partner' ? p.data.ticketSize?.trim() || null : null,
  }
}

const audit = (actor: string, action: string, target: string) =>
  db.insert(auditLogs).values({ actor, action, target, category: 'Directory' })

// /api/firms — first-class consulting firms and their seats. A firm lets several
// consultants share one client book (portfolios + access grants held by firm_id)
// instead of a single reviewer email. Each seat is independently revocable.
export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (caller.readOnly && req.method !== 'GET') return forbidden()

    if (req.method === 'GET') {
      const params = new URL(req.url).searchParams
      const email = params.get('email')
      const firmId = params.get('firmId')
      if (email) {
        const lower = email.trim().toLowerCase()
        // A caller may list their own firm memberships; another person's is a
        // super-admin-only lookup.
        if (lower !== caller.email && caller.role !== 'super_admin') return forbidden()
        // Firms this person is a member of, with the full member roster.
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
            kind: f.kind, nature: f.nature, summary: f.summary, competencies: f.competencies,
            countries: f.countries, sectors: f.sectors, ticketSize: f.ticketSize,
            members: memberRows
              .filter((m) => m.firmId === f.id)
              .map((m) => ({ email: m.email, role: m.role, status: m.status })),
          })),
        )
      }
      if (firmId) {
        if (!(await isFirmMember(caller.email, firmId)) && caller.role !== 'super_admin') return forbidden()
        const members = await db.select().from(firmMembers).where(eq(firmMembers.firmId, firmId))
        return Response.json(members.map((m) => ({ email: m.email, role: m.role, status: m.status })))
      }
      return Response.json([])
    }

    // POST — create a firm (with its creator as the owner seat). The creator is
    // always the verified caller, never a client-supplied email.
    // body: { name, kind?, nature?, ...profile } — a `kind` makes it a validator
    // firm or funding partner listed in the directory.
    if (req.method === 'POST') {
      const body = await req.json()
      const name = String(body.name ?? '').trim().slice(0, 200)
      const createdBy = caller.email
      if (!name) return Response.json({ error: 'name required' }, { status: 400 })
      const kind = body.kind == null ? null : FIRM_KINDS.find((k) => k === body.kind)
      if (kind === undefined) return Response.json({ error: 'invalid kind' }, { status: 400 })
      const profile = kind ? profileFields(body, kind) : {}
      if (!profile) return Response.json({ error: 'invalid profile' }, { status: 400 })
      const id = `firm_${crypto.randomUUID()}`
      const [firm] = await db.insert(firms).values({ id, name, createdBy, kind, ...profile }).returning()
      if (kind) await audit(createdBy, `created ${kind.replace('_', ' ')} profile`, id)
      await db
        .insert(firmMembers)
        .values({ firmId: id, email: createdBy, role: 'owner', status: 'active' })
        .onConflictDoNothing()
      return Response.json(firm, { status: 201 })
    }

    // PATCH — edit a directory profile. Only the firm's owner (not even a
    // platform admin). body: { firmId, name?, nature, ...profile }
    if (req.method === 'PATCH') {
      const body = await req.json()
      const firmId = String(body.firmId ?? '')
      const [firm] = await db.select().from(firms).where(eq(firms.id, firmId)).limit(1)
      if (!firm?.kind) return Response.json({ error: 'Not found' }, { status: 404 })
      if (!(await isFirmOwner(caller.email, firmId))) return forbidden()
      const profile = profileFields(body, firm.kind as FirmKind)
      if (!profile) return Response.json({ error: 'invalid profile' }, { status: 400 })
      const name = String(body.name ?? firm.name).trim().slice(0, 200) || firm.name
      await db.update(firms).set({ name, ...profile }).where(eq(firms.id, firmId))
      await audit(caller.email, `edited ${firm.kind.replace('_', ' ')} profile`, firmId)
      return Response.json({ ok: true })
    }

    // PUT — add or update a seat. Only an existing owner of the firm may do
    // this. body: { firmId, email, role?, status? }
    // Directory firms (validator firm / funding partner) list their team
    // publicly, so a person added by the owner stays 'invited' until they
    // accept by PUTting their own seat with status 'active'.
    if (req.method === 'PUT') {
      const body = await req.json()
      const firmId = String(body.firmId ?? '').trim()
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!firmId || !email) return Response.json({ error: 'firmId and email required' }, { status: 400 })
      const [firm] = await db.select({ kind: firms.kind }).from(firms).where(eq(firms.id, firmId)).limit(1)
      const [seat] = await db.select().from(firmMembers).where(and(eq(firmMembers.firmId, firmId), eq(firmMembers.email, email))).limit(1)
      if (firm?.kind && email === caller.email && seat?.status === 'invited' && body.status === 'active') {
        await db.update(firmMembers).set({ status: 'active' }).where(and(eq(firmMembers.firmId, firmId), eq(firmMembers.email, email)))
        await audit(caller.email, 'accepted firm seat', firmId)
        return Response.json({ ok: true })
      }
      if (!(await isFirmOwner(caller.email, firmId)) && caller.role !== 'super_admin') return forbidden()
      const role = body.role ?? 'consultant'
      let status = body.status ?? 'active'
      if (firm?.kind && email !== caller.email && status === 'active' && seat?.status !== 'active') status = 'invited'
      await db
        .insert(firmMembers)
        .values({ firmId, email, role, status })
        .onConflictDoUpdate({ target: [firmMembers.firmId, firmMembers.email], set: { role, status } })
      await audit(caller.email, `set firm seat ${email} (${role}, ${status})`, firmId)
      return Response.json({ ok: true, status })
    }

    // DELETE — remove a seat. An owner may remove anyone; a member may remove
    // themselves (leave the firm). ?firmId=&email=
    if (req.method === 'DELETE') {
      const params = new URL(req.url).searchParams
      const firmId = params.get('firmId')
      const email = params.get('email')
      if (!firmId || !email) return Response.json({ error: 'firmId and email required' }, { status: 400 })
      const target = email.trim().toLowerCase()
      const selfLeaving = target === caller.email
      if (!selfLeaving && !(await isFirmOwner(caller.email, firmId)) && caller.role !== 'super_admin') return forbidden()
      await db
        .delete(firmMembers)
        .where(and(eq(firmMembers.firmId, firmId), eq(firmMembers.email, email.trim().toLowerCase())))
      await audit(caller.email, `removed firm seat ${target}`, firmId)
      return Response.json({ ok: true })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error("/api/firms", "failed", err)
    return Response.json({ error: 'Firm request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/firms',
}
