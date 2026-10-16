import type { Config } from '@netlify/functions'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { legacyWorkspaceState } from '../../db/legacy-schema.js'
import {
  auditLogs, firmMembers, firms, organizations, orgDirectoryProfiles, validatorCredentials, validatorProfiles,
  type FirmRow, type ValidatorProfileRow,
} from '../../db/schema.js'
import { canAccessOrg, forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { decryptField } from '../lib/crypto.js'
import { logger } from '../lib/logger.js'
import { currentRung } from '../../src/lib/capitalReadiness.js'
import {
  ACCREDITATION_STATUSES, cleanList, credentialLabel, effectiveAccreditation, matchesQuery, validatorLevel,
} from '../../src/lib/validatorDirectory.js'

// /api/directory — the validator system's three-way directory (spec PR 1).
// Signed-in only. Organisations find validators and funding partners; funding
// partners (active staff of a funding_partner firm) also find opted-in
// organisations. Brief profiles never carry scores, evidence or contact
// details: people are addressed by a random profile id, never their email.
//
//   GET    me                         own validator profile, firms, org listing
//   PUT    me/validator               create / edit own validator profile
//   POST   me/credentials             add a professional membership (self-declared)
//   DELETE me/credentials/:id         remove one of own memberships
//   PUT    me/organization            own organisation's opt-in listing
//   GET    search?type=&q=&country=   validators | firms | funders | organizations
//   GET    validators/:id | firms/:id | organizations/:id   brief profiles
//   PUT    admin/validators/:id       platform admin: accreditation (reason required)
//   PUT    admin/credentials/:id      platform admin: verify / unverify a membership

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const notFound = () => json({ error: 'Not found' }, 404)
const bad = (error: string) => json({ error }, 400)
const audit = (actor: string, action: string, target: string, category = 'Directory', orgId: string | null = null) =>
  db.insert(auditLogs).values({ actor, action, target, category, orgId })

const validatorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  bio: z.string().max(4000).optional(),
  competencies: z.unknown().optional(),
  frameworks: z.unknown().optional(),
  countries: z.unknown().optional(),
  languages: z.unknown().optional(),
})
const credentialSchema = z.object({ body: z.string().trim().min(1).max(120), membershipNumber: z.string().trim().min(1).max(120) })
const orgListingSchema = z.object({ listed: z.boolean(), summary: z.string().max(1000).optional() })
const accreditationSchema = z.object({
  status: z.enum(ACCREDITATION_STATUSES).optional(),
  pilotAccredited: z.boolean().optional(),
  reason: z.string().trim().min(1).max(1000),
})

async function isFunderStaff(email: string): Promise<boolean> {
  const [row] = await db.select({ id: firms.id }).from(firmMembers)
    .innerJoin(firms, eq(firms.id, firmMembers.firmId))
    .where(and(eq(firmMembers.email, email), eq(firmMembers.status, 'active'), eq(firms.kind, 'funding_partner')))
    .limit(1)
  return !!row
}

// Active validator-firm memberships for these emails: email -> [{id, name}].
async function validatorFirmsByEmail(emails: string[]): Promise<Map<string, Array<{ id: string; name: string }>>> {
  const out = new Map<string, Array<{ id: string; name: string }>>()
  if (!emails.length) return out
  const rows = await db.select({ email: firmMembers.email, id: firms.id, name: firms.name }).from(firmMembers)
    .innerJoin(firms, eq(firms.id, firmMembers.firmId))
    .where(and(inArray(firmMembers.email, emails), eq(firmMembers.status, 'active'), eq(firms.kind, 'validator_firm')))
  for (const r of rows) out.set(r.email, [...(out.get(r.email) ?? []), { id: r.id, name: r.name }])
  return out
}

function validatorCard(v: ValidatorProfileRow, firmList: Array<{ id: string; name: string }>) {
  return {
    id: v.id, name: v.name, competencies: v.competencies, countries: v.countries, firms: firmList,
    accreditation: effectiveAccreditation(v), level: validatorLevel(v),
  }
}

function firmCard(f: FirmRow, teamSize: number) {
  return {
    id: f.id, kind: f.kind, name: f.name, nature: f.nature, summary: f.summary, competencies: f.competencies,
    countries: f.countries, sectors: f.sectors, ticketSize: f.ticketSize, teamSize,
  }
}

async function teamSizes(firmIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!firmIds.length) return out
  const rows = await db.select({ firmId: firmMembers.firmId }).from(firmMembers)
    .where(and(inArray(firmMembers.firmId, firmIds), eq(firmMembers.status, 'active')))
  for (const r of rows) out.set(r.firmId, (out.get(r.firmId) ?? 0) + 1)
  return out
}

// Listed organisations with their brief public fields and current ladder rung.
async function listedOrganizations(id?: string) {
  const rows = await db.select({
    id: orgDirectoryProfiles.id, orgId: orgDirectoryProfiles.orgId, summary: orgDirectoryProfiles.summary,
    name: organizations.name, country: organizations.country, sector: organizations.sector,
  }).from(orgDirectoryProfiles)
    .innerJoin(organizations, eq(organizations.id, orgDirectoryProfiles.orgId))
    .where(and(eq(orgDirectoryProfiles.listed, true), eq(organizations.status, 'active'), id ? eq(orgDirectoryProfiles.id, id) : undefined))
  const orgIds = rows.map((r) => r.orgId)
  const state = orgIds.length ? await db.select().from(legacyWorkspaceState)
    .where(and(inArray(legacyWorkspaceState.orgId, orgIds), eq(legacyWorkspaceState.key, 'capital:scores'))) : []
  const rung = new Map<string, number>()
  for (const s of state) {
    try { rung.set(s.orgId, currentRung(JSON.parse(decryptField(s.value)) ?? {})) } catch { /* unreadable: no rung */ }
  }
  return rows.map(({ orgId, ...r }) => ({ ...r, sector: r.sector ?? '', currentRung: rung.get(orgId) ?? null }))
}

export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const url = new URL(req.url)
    const [a, b, c] = url.pathname.replace(/^\/api\/directory\/?/, '').split('/').filter(Boolean)
    const route = `${req.method} ${a ?? ''}${b ? `/${b}` : ''}`
    const isAdmin = isSuperAdmin(caller.email) && !caller.readOnly
    // Specialised read-only (regulator) sessions never write here.
    if (req.method !== 'GET' && caller.readOnly) return forbidden()
    const readBody = async () => { try { return await req.json() } catch { return null } }

    if (route === 'GET me') {
      const [validator] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.email, caller.email))
      const credentials = validator ? await db.select().from(validatorCredentials).where(eq(validatorCredentials.validatorId, validator.id)) : []
      const memberships = await db.select({ firm: firms, role: firmMembers.role }).from(firmMembers)
        .innerJoin(firms, eq(firms.id, firmMembers.firmId))
        .where(and(eq(firmMembers.email, caller.email), eq(firmMembers.status, 'active'), isNotNull(firms.kind)))
      const invitations = await db.select({ id: firms.id, name: firms.name, kind: firms.kind }).from(firmMembers)
        .innerJoin(firms, eq(firms.id, firmMembers.firmId))
        .where(and(eq(firmMembers.email, caller.email), eq(firmMembers.status, 'invited'), isNotNull(firms.kind)))
      const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, caller.orgId))
      const [listing] = await db.select().from(orgDirectoryProfiles).where(eq(orgDirectoryProfiles.orgId, caller.orgId))
      return json({
        email: caller.email,
        isAdmin,
        isFunder: memberships.some((m) => m.firm.kind === 'funding_partner'),
        validator: validator ? {
          ...validatorCard(validator, []), email: validator.email, bio: validator.bio, frameworks: validator.frameworks,
          languages: validator.languages, accreditationReason: validator.accreditationReason,
          credentials: credentials.map((cr) => ({ id: cr.id, body: cr.body, membershipNumber: cr.membershipNumber, status: credentialLabel(cr) })),
        } : null,
        firms: memberships.map((m) => ({ ...firmCard(m.firm, 0), role: m.role })),
        invitations,
        organization: org ? { name: org.name, id: listing?.id ?? null, listed: listing?.listed ?? false, summary: listing?.summary ?? '' } : null,
      })
    }

    if (route === 'PUT me/validator') {
      const p = validatorSchema.safeParse(await readBody())
      if (!p.success) return bad('Invalid profile')
      const fields = {
        name: p.data.name, bio: (p.data.bio ?? '').trim(), competencies: cleanList(p.data.competencies),
        frameworks: cleanList(p.data.frameworks), countries: cleanList(p.data.countries), languages: cleanList(p.data.languages),
        updatedAt: new Date(),
      }
      const [row] = await db.insert(validatorProfiles).values({ id: `vp_${crypto.randomUUID()}`, email: caller.email, ...fields })
        .onConflictDoUpdate({ target: validatorProfiles.email, set: fields }).returning()
      await audit(caller.email, 'saved validator profile', row.id)
      return json({ id: row.id })
    }

    if (a === 'me' && b === 'credentials' && (req.method === 'POST' || req.method === 'DELETE')) {
      const [own] = await db.select({ id: validatorProfiles.id }).from(validatorProfiles).where(eq(validatorProfiles.email, caller.email))
      if (!own) return bad('Create your validator profile first')
      if (req.method === 'POST') {
        const p = credentialSchema.safeParse(await readBody())
        if (!p.success) return bad('Body and membership number are required')
        const existing = await db.select({ id: validatorCredentials.id }).from(validatorCredentials).where(eq(validatorCredentials.validatorId, own.id))
        if (existing.length >= 20) return bad('Too many memberships')
        const id = `cred_${crypto.randomUUID()}`
        await db.insert(validatorCredentials).values({ id, validatorId: own.id, ...p.data })
        await audit(caller.email, `declared membership ${p.data.body}`, id)
        return json({ id }, 201)
      }
      if (!c) return bad('id required')
      const deleted = await db.delete(validatorCredentials)
        .where(and(eq(validatorCredentials.id, c), eq(validatorCredentials.validatorId, own.id))).returning({ id: validatorCredentials.id })
      if (!deleted.length) return notFound()
      await audit(caller.email, 'removed membership', c)
      return json({ ok: true })
    }

    if (route === 'PUT me/organization') {
      const p = orgListingSchema.safeParse(await readBody())
      if (!p.success) return bad('Invalid listing')
      const orgId = caller.orgId
      if (!(await canAccessOrg(caller, orgId, 'write'))) return forbidden()
      const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId))
      if (!org) return bad('Set up your organisation profile first')
      const fields = { listed: p.data.listed, summary: (p.data.summary ?? '').trim(), updatedBy: caller.email, updatedAt: new Date() }
      await db.insert(orgDirectoryProfiles).values({ id: `od_${crypto.randomUUID()}`, orgId, ...fields })
        .onConflictDoUpdate({ target: orgDirectoryProfiles.orgId, set: fields })
      await audit(caller.email, p.data.listed ? 'listed organisation in directory' : 'unlisted organisation from directory', orgId, 'Directory', orgId)
      return json({ ok: true })
    }

    if (route === 'GET search') {
      const type = url.searchParams.get('type') ?? 'validators'
      const q = (url.searchParams.get('q') ?? '').slice(0, 200)
      const country = (url.searchParams.get('country') ?? '').trim().toLowerCase()
      const inCountry = (list: string[] | null | undefined) => !country || (list ?? []).some((x) => x.toLowerCase() === country)
      // ponytail: whole-table scan + in-memory filter; move to SQL (ILIKE / jsonb ?) past a few thousand profiles.
      if (type === 'validators') {
        const all = await db.select().from(validatorProfiles)
        const firmMap = await validatorFirmsByEmail(all.map((v) => v.email))
        return json(all
          .map((v) => ({ v, firmList: firmMap.get(v.email) ?? [] }))
          .filter(({ v, firmList }) => inCountry(v.countries) &&
            matchesQuery([v.name, v.bio, v.competencies, v.frameworks, v.countries, v.languages, firmList.map((f) => f.name)], q))
          .map(({ v, firmList }) => validatorCard(v, firmList)))
      }
      if (type === 'firms' || type === 'funders') {
        const all = await db.select().from(firms).where(eq(firms.kind, type === 'firms' ? 'validator_firm' : 'funding_partner'))
        const hits = all.filter((f) => inCountry(f.countries) && matchesQuery([f.name, f.nature, f.summary, f.competencies, f.countries, f.sectors], q))
        const sizes = await teamSizes(hits.map((f) => f.id))
        return json(hits.map((f) => firmCard(f, sizes.get(f.id) ?? 0)))
      }
      if (type === 'organizations') {
        if (!isAdmin && !(await isFunderStaff(caller.email))) return forbidden()
        const all = await listedOrganizations()
        return json(all.filter((o) => (!country || o.country.toLowerCase() === country) && matchesQuery([o.name, o.country, o.sector, o.summary], q)))
      }
      return bad('Unknown type')
    }

    if (req.method === 'GET' && a === 'validators' && b && !c) {
      const [v] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.id, b))
      if (!v) return notFound()
      const creds = await db.select().from(validatorCredentials).where(eq(validatorCredentials.validatorId, v.id))
      const firmList = (await validatorFirmsByEmail([v.email])).get(v.email) ?? []
      return json({
        ...validatorCard(v, firmList), bio: v.bio, frameworks: v.frameworks, languages: v.languages,
        credentials: creds.map((cr) => ({ id: cr.id, body: cr.body, membershipNumber: cr.membershipNumber, status: credentialLabel(cr) })),
        ...(isAdmin ? { accreditationStatus: v.accreditationStatus, pilotAccredited: v.pilotAccredited, accreditationReason: v.accreditationReason } : {}),
      })
    }

    if (req.method === 'GET' && a === 'firms' && b && !c) {
      const [f] = await db.select().from(firms).where(and(eq(firms.id, b), isNotNull(firms.kind)))
      if (!f) return notFound()
      const members = await db.select({ email: firmMembers.email }).from(firmMembers)
        .where(and(eq(firmMembers.firmId, f.id), eq(firmMembers.status, 'active')))
      // Validator firms show team members who have a validator profile (by name);
      // funding partners show only a staff count.
      const team = f.kind === 'validator_firm' && members.length
        ? (await db.select({ id: validatorProfiles.id, name: validatorProfiles.name }).from(validatorProfiles)
          .where(inArray(validatorProfiles.email, members.map((m) => m.email))))
        : []
      return json({ ...firmCard(f, members.length), team })
    }

    if (req.method === 'GET' && a === 'organizations' && b && !c) {
      if (!isAdmin && !(await isFunderStaff(caller.email))) return forbidden()
      const [o] = await listedOrganizations(b)
      return o ? json(o) : notFound()
    }

    if (route === 'PUT admin/validators' || route === 'PUT admin/credentials') {
      if (!isAdmin) return forbidden()
      if (!c) return bad('id required')
      if (b === 'credentials') {
        const p = z.object({ verified: z.boolean() }).safeParse(await readBody())
        if (!p.success) return bad('verified required')
        const updated = await db.update(validatorCredentials)
          .set(p.data.verified ? { verifiedBy: caller.email, verifiedAt: new Date() } : { verifiedBy: null, verifiedAt: null })
          .where(eq(validatorCredentials.id, c)).returning({ id: validatorCredentials.id })
        if (!updated.length) return notFound()
        await audit(caller.email, p.data.verified ? 'verified membership' : 'marked membership self-declared', c, 'Accreditation')
        return json({ ok: true })
      }
      const p = accreditationSchema.safeParse(await readBody())
      if (!p.success || (p.data.status === undefined && p.data.pilotAccredited === undefined)) return bad('A change and a reason are required')
      const set = {
        ...(p.data.status ? { accreditationStatus: p.data.status } : {}),
        ...(p.data.pilotAccredited !== undefined ? { pilotAccredited: p.data.pilotAccredited } : {}),
        accreditationReason: p.data.reason, accreditationChangedBy: caller.email, accreditationChangedAt: new Date(),
      }
      const updated = await db.update(validatorProfiles).set(set).where(eq(validatorProfiles.id, c)).returning()
      if (!updated.length) return notFound()
      const change = [p.data.status && `status ${p.data.status}`, p.data.pilotAccredited !== undefined && `pilot-accredited ${p.data.pilotAccredited ? 'on' : 'off'}`].filter(Boolean).join(', ')
      await audit(caller.email, `accreditation: ${change} (${p.data.reason})`, c, 'Accreditation')
      return json({ ok: true, accreditation: effectiveAccreditation(updated[0]) })
    }

    return req.method === 'GET' || req.method === 'PUT' || req.method === 'POST' || req.method === 'DELETE' ? notFound() : new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error('/api/directory', 'failed', err)
    return json({ error: 'Directory request failed' }, 500)
  }
}

export const config: Config = { path: ['/api/directory', '/api/directory/*'] }
