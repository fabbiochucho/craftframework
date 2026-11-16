import type { Config } from '@netlify/functions'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { firmMembers, firms, funderProgrammes } from '../../db/schema.js'
import { forbidden, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'

// /api/funder-programmes — a funding partner's grants, report types and funding streams, entered by its own staff
// (or the Super Admin), so the organisations it funds can pick them in Finance Triangulation.
//   GET            -> { programmes } every funder with at least one grant and one report type (shown to any
//                     signed-in organisation; the card that edits them says so)
//   GET ?mine=1    -> { programmes } the funders the caller belongs to (Super Admin: all), even when empty
//   PUT { firmId, grants, reportTypes, streams } (lists of names) -> save; funder staff or Super Admin only
const MAX_ITEMS = 50
const MAX_LEN = 150
const slug = (s: string, i: number) => `${s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item'}-${i + 1}`
const names = (v: unknown): string[] | null => {
  if (!Array.isArray(v)) return null
  const out = [...new Set(v.map((x) => String(x ?? '').trim()).filter(Boolean))]
  return out.length <= MAX_ITEMS && out.every((x) => x.length <= MAX_LEN) ? out : null
}
const asItems = (xs: string[]) => xs.map((name, i) => ({ id: slug(name, i), name }))

async function view(firmIds?: string[]) {
  const fs = await db.select({ id: firms.id, name: firms.name }).from(firms)
    .where(firmIds ? and(eq(firms.kind, 'funding_partner'), inArray(firms.id, firmIds.length ? firmIds : [''])) : eq(firms.kind, 'funding_partner'))
  const ps = fs.length ? await db.select().from(funderProgrammes).where(inArray(funderProgrammes.firmId, fs.map((f) => f.id))) : []
  return fs.map((f) => {
    const p = ps.find((x) => x.firmId === f.id)
    return { id: f.id, name: f.name, grants: p?.grants ?? [], reportTypes: p?.reportTypes ?? [], streams: p?.streams ?? [] }
  }).sort((a, b) => a.name.localeCompare(b.name))
}

async function memberFirmIds(email: string) {
  return (await db.select({ id: firmMembers.firmId }).from(firmMembers)
    .where(and(eq(firmMembers.email, email), eq(firmMembers.status, 'active')))).map((r) => r.id)
}

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    if (req.method === 'GET') {
      if (new URL(req.url).searchParams.get('mine')) {
        return Response.json({ programmes: await view(caller.role === 'super_admin' ? undefined : await memberFirmIds(caller.email)) })
      }
      return Response.json({ programmes: (await view()).filter((p) => p.grants.length && p.reportTypes.length) })
    }
    if (req.method === 'PUT') {
      if (caller.readOnly) return forbidden()
      const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
      const firmId = String(b.firmId ?? '')
      const grants = names(b.grants), reportTypes = names(b.reportTypes), streams = names(b.streams ?? [])
      if (!grants || !reportTypes || !streams) return Response.json({ error: `Each list takes up to ${MAX_ITEMS} names of up to ${MAX_LEN} characters` }, { status: 400 })
      const [firm] = await db.select().from(firms).where(and(eq(firms.id, firmId), eq(firms.kind, 'funding_partner')))
      if (!firm) return Response.json({ error: 'Funding partner not found' }, { status: 404 })
      if (caller.role !== 'super_admin' && !(await memberFirmIds(caller.email)).includes(firmId)) return forbidden()
      const value = { grants: asItems(grants), reportTypes: asItems(reportTypes), streams: asItems(streams), updatedBy: caller.email, updatedAt: new Date() }
      await db.insert(funderProgrammes).values({ firmId, ...value }).onConflictDoUpdate({ target: funderProgrammes.firmId, set: value })
      return Response.json({ programmes: await view([firmId]) })
    }
    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error('/api/funder-programmes', 'failed', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const config: Config = { path: '/api/funder-programmes' }

export default monitored(handleRequest)
