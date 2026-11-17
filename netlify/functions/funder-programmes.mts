import type { Config } from '@netlify/functions'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { awards, firmMembers, firms, funderProgrammes, grantBeneficiaries, organizations } from '../../db/schema.js'
import { publicBaseUrl } from '../lib/public-validation.js'
import { sendReminderEmail } from '../lib/reminder-email.js'
import { cleanSupportTypes } from '../../src/lib/supportTypes.js'
import { forbidden, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'

// /api/funder-programmes — a funding partner's grants, report types and funding streams, entered by its own staff
// (or the Super Admin), so the organisations it funds can pick them in Finance Triangulation.
//   GET            -> { programmes } every funder with at least one grant and one report type (shown to any
//                     signed-in organisation; the card that edits them says so)
//   GET ?mine=1    -> { programmes } the funders the caller belongs to (Super Admin: all), even when empty
//   PUT { firmId, grants, reportTypes, streams } (lists of names) -> save; funder staff or Super Admin only
//   GET ?beneficiaries=<firmId>        -> { beneficiaries: [{ grantId, email }] }  (funder staff or Super Admin)
//   POST { firmId, grantId, email }    -> name an organisation (by its contact email) as a beneficiary; it is told
//   DELETE { firmId, grantId, email }  -> remove it
//   GET ?offered=1                     -> { offered: [...] } grants that name the caller's organisation and that it has
//                                         not yet added to its awards (the organisation adds one through /api/awards)
// Naming an organisation shares nothing about it with the funder: the reply is the same whether or not it is on CRAFT.
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

const isEmail = (s: string) => s.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(s)
const canManage = async (caller: { role: string; email: string }, firmId: string) => caller.role === 'super_admin' || (await memberFirmIds(caller.email)).includes(firmId)

/** Grants that name the caller (or their organisation's contact email) as beneficiary, minus those already in its awards. */
async function offeredTo(caller: { email: string; orgId: string }) {
  const [org] = await db.select({ email: organizations.email }).from(organizations).where(eq(organizations.id, caller.orgId))
  const emails = [...new Set([caller.email, (org?.email ?? '').toLowerCase()].filter(Boolean))]
  const named = await db.select().from(grantBeneficiaries).where(inArray(grantBeneficiaries.email, emails))
  if (!named.length) return []
  const have = await db.select({ f: awards.funderFirmId, g: awards.funderGrantId }).from(awards).where(eq(awards.orgId, caller.orgId))
  const progs = await view([...new Set(named.map((n) => n.firmId))])
  return named.filter((n) => !have.some((h) => h.f === n.firmId && h.g === n.grantId)).flatMap((n) => {
    const p = progs.find((x) => x.id === n.firmId)
    const g = p?.grants.find((x) => x.id === n.grantId)
    return p && g ? [{ firmId: p.id, funder: p.name, grantId: g.id, grant: g.name, types: g.types ?? [] }] : []
  })
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
      const qs = new URL(req.url).searchParams
      if (qs.get('offered')) return Response.json({ offered: await offeredTo(caller) })
      const benOf = qs.get('beneficiaries')
      if (benOf) {
        if (!(await canManage(caller, benOf))) return forbidden()
        const rows = await db.select({ grantId: grantBeneficiaries.grantId, email: grantBeneficiaries.email }).from(grantBeneficiaries).where(eq(grantBeneficiaries.firmId, benOf))
        return Response.json({ beneficiaries: rows })
      }
      if (qs.get('mine')) {
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
      // Optional { [grant name]: support type ids } — what kind of support each grant is.
      const typesByName = (b.grantTypes && typeof b.grantTypes === 'object' ? b.grantTypes : {}) as Record<string, unknown>
      const value = { grants: asItems(grants).map((g) => ({ ...g, types: cleanSupportTypes(typesByName[g.name]) })), reportTypes: asItems(reportTypes), streams: asItems(streams), updatedBy: caller.email, updatedAt: new Date() }
      await db.insert(funderProgrammes).values({ firmId, ...value }).onConflictDoUpdate({ target: funderProgrammes.firmId, set: value })
      return Response.json({ programmes: await view([firmId]) })
    }
    if (req.method === 'POST' || req.method === 'DELETE') {
      if (caller.readOnly) return forbidden()
      const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
      const firmId = String(b.firmId ?? ''), grantId = String(b.grantId ?? ''), email = String(b.email ?? '').trim().toLowerCase()
      if (!isEmail(email)) return Response.json({ error: "Enter the organisation's contact email" }, { status: 400 })
      if (!(await canManage(caller, firmId))) return forbidden()
      const [p] = await view([firmId])
      const grant = p?.grants.find((g) => g.id === grantId)
      if (!grant) return Response.json({ error: 'Choose one of your grants' }, { status: 400 })
      if (req.method === 'DELETE') {
        await db.delete(grantBeneficiaries).where(and(eq(grantBeneficiaries.firmId, firmId), eq(grantBeneficiaries.grantId, grantId), eq(grantBeneficiaries.email, email)))
        return Response.json({ ok: true })
      }
      const [added] = await db.insert(grantBeneficiaries).values({ firmId, grantId, email, addedBy: caller.email }).onConflictDoNothing().returning()
      // Told once; also lands in their CRAFT inbox. Nothing about the organisation is returned to the funder.
      if (added) {
        await sendReminderEmail({
          to: email, subject: `${p.name} lists your organisation as a beneficiary of ${grant.name}`,
          text: `${p.name} has listed your organisation on CRAFT as a beneficiary of its grant "${grant.name}".\n\nIf this is right, add it to your awards so your assessments and finance reports can be linked to it: sign in at ${publicBaseUrl()}/awards and choose "Add to my awards". If it is not right, you can ignore this message.\n\nThis shares nothing about your organisation with ${p.name}.`,
        }, `beneficiary-${firmId}-${grantId}-${email}`, 'grant_beneficiary')
      }
      return Response.json({ ok: true })
    }
    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error('/api/funder-programmes', 'failed', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const config: Config = { path: '/api/funder-programmes' }

export default monitored(handleRequest)
