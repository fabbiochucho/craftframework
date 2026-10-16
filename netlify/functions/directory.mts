import type { Config } from '@netlify/functions'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { legacyWorkspaceState } from '../../db/legacy-schema.js'
import {
  accessGrants, auditLogs, firmMembers, firms, organizations, orgDirectoryProfiles, orgListingProposals, validatorCredentials, validatorProfiles,
  type FirmRow, type ValidatorProfileRow,
} from '../../db/schema.js'
import { SPECIALIZED_READONLY_ROLES } from '../lib/access-policy.js'
import { canAccessOrg, forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { decryptField } from '../lib/crypto.js'
import { logger } from '../lib/logger.js'
import { badgesFor } from '../lib/training.js'
import { reconcileValidator } from '../lib/engagement-access.js'
import { currentRung } from '../../src/lib/capitalReadiness.js'
import {
  ADMIN_ACCREDITATION_ACTIONS, cleanList, credentialLabel, effectiveAccreditation, matchesQuery, validatorLevel,
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
//   PUT    me/organization            own organisation's opt-in listing (own staff only)
//   POST   proposals                  a consultant with an access grant PROPOSES a listing (not live)
//   GET    proposals                  proposals the caller made
//   POST   proposals/:id/approve|reject   the organisation's own staff decide
//   DELETE proposals/:id              the proposer withdraws a pending proposal
//   GET    search?type=&q=&country=   validators | firms | funders | organizations
//   GET    validators/:id | firms/:id | organizations/:id   brief profiles
//   PUT    admin/validators/:id       platform admin: suspend / reinstate only (reason required)
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
// A platform admin can only suspend or reinstate, with a reason. Accreditation is earned
// through the training programme (/api/training); `.strict()` rejects any attempt to send
// 'accredited', pilot flags or an accredited_until here.
const proposalSchema = z.object({ orgId: z.string().trim().min(1).max(200), summary: z.string().trim().min(1).max(1000) })
const approveSchema = z.object({ summary: z.string().trim().min(1).max(1000).optional() })
const rejectSchema = z.object({ reason: z.string().trim().max(1000).optional() })
const accreditationSchema = z.object({
  status: z.enum(ADMIN_ACCREDITATION_ACTIONS),
  reason: z.string().trim().min(1).max(1000),
}).strict()

// Who may look up opted-in organisations: funding partners, and registered validators
// (so a validator can request an engagement with an organisation that opted in).
async function mayBrowseOrganizations(email: string, isAdmin: boolean): Promise<boolean> {
  if (isAdmin || (await isFunderStaff(email))) return true
  const [v] = await db.select({ id: validatorProfiles.id }).from(validatorProfiles).where(eq(validatorProfiles.email, email))
  return !!v
}

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

type BadgeList = Array<{ key: string; name: string }>
function validatorCard(v: ValidatorProfileRow, firmList: Array<{ id: string; name: string }>, badges: BadgeList = []) {
  return {
    id: v.id, name: v.name, competencies: v.competencies, countries: v.countries, firms: firmList,
    accreditation: effectiveAccreditation(v), level: validatorLevel(v), accreditedUntil: v.accreditedUntil,
    // Training badges (learning and accuracy only): Ladder Climber, Evidence Hawk, Clear Conscience, Calibrated, Riverbend Solved.
    badges: badges.map((x) => ({ key: x.key, name: x.name })),
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
      const proposals = org ? await db.select().from(orgListingProposals)
        .where(and(eq(orgListingProposals.orgId, caller.orgId), eq(orgListingProposals.status, 'pending'))) : []
      return json({
        email: caller.email,
        isAdmin,
        isFunder: memberships.some((m) => m.firm.kind === 'funding_partner'),
        canBrowseOrganizations: await mayBrowseOrganizations(caller.email, isAdmin),
        validator: validator ? {
          ...validatorCard(validator, [], (await badgesFor([validator.email])).get(validator.email)), email: validator.email, bio: validator.bio, frameworks: validator.frameworks,
          languages: validator.languages, accreditationReason: validator.accreditationReason,
          credentials: credentials.map((cr) => ({ id: cr.id, body: cr.body, membershipNumber: cr.membershipNumber, status: credentialLabel(cr) })),
        } : null,
        firms: memberships.map((m) => ({ ...firmCard(m.firm, 0), role: m.role })),
        invitations,
        organization: org ? { name: org.name, id: listing?.id ?? null, listed: listing?.listed ?? false, summary: listing?.summary ?? '' } : null,
        // Pending listing proposals for the caller's own organisation (decided by its staff).
        proposals: proposals.map((p) => ({ id: p.id, proposedBy: p.proposedBy, summary: p.summary, createdAt: p.createdAt })),
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

    if (a === 'proposals') {
      if (req.method === 'GET' && !b) {
        const mine = await db.select({
          id: orgListingProposals.id, orgName: organizations.name, summary: orgListingProposals.summary, status: orgListingProposals.status,
          reason: orgListingProposals.reason, createdAt: orgListingProposals.createdAt,
        }).from(orgListingProposals).innerJoin(organizations, eq(organizations.id, orgListingProposals.orgId))
          .where(eq(orgListingProposals.proposedBy, caller.email))
        return json(mine)
      }
      if (req.method === 'POST' && !b) {
        const p = proposalSchema.safeParse(await readBody())
        if (!p.success) return bad('An organisation and a draft summary are required')
        const { orgId, summary } = p.data
        // An outside consultant only: the organisation's own staff list it directly, and a
        // time-limited validator / regulator grant is not a consultant relationship.
        if (orgId === caller.orgId) return bad('List your own organisation directly')
        if (SPECIALIZED_READONLY_ROLES.has(caller.role) || !(await canAccessOrg(caller, orgId, 'read'))) return forbidden()
        const [grant] = await db.select({ role: accessGrants.role }).from(accessGrants)
          .where(and(eq(accessGrants.orgId, orgId), eq(accessGrants.grantee, caller.email)))
        if (grant?.role && SPECIALIZED_READONLY_ROLES.has(grant.role)) return forbidden()
        const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId))
        if (!org) return notFound()
        const id = `olp_${crypto.randomUUID()}`
        // The partial unique index allows one pending proposal per organisation.
        const inserted = await db.insert(orgListingProposals).values({ id, orgId, proposedBy: caller.email, summary })
          .onConflictDoNothing().returning({ id: orgListingProposals.id })
        if (!inserted.length) return json({ error: 'This organisation already has a pending proposal' }, 409)
        await audit(caller.email, 'proposed directory listing', id, 'Directory', orgId)
        return json({ id }, 201)
      }
      if (b && ((req.method === 'POST' && (c === 'approve' || c === 'reject')) || (req.method === 'DELETE' && !c))) {
        const [prop] = await db.select().from(orgListingProposals).where(eq(orgListingProposals.id, b))
        // Proposals are visible only to the proposer and the organisation's own staff.
        const own = !!prop && prop.orgId === caller.orgId
        if (!prop || (!own && prop.proposedBy !== caller.email)) return notFound()
        if (req.method === 'DELETE') {
          if (prop.proposedBy !== caller.email) return forbidden()
          const done = await db.update(orgListingProposals).set({ status: 'withdrawn', decidedBy: caller.email, decidedAt: new Date() })
            .where(and(eq(orgListingProposals.id, b), eq(orgListingProposals.status, 'pending'))).returning({ id: orgListingProposals.id })
          if (!done.length) return json({ error: 'Proposal is no longer pending' }, 409)
          await audit(caller.email, 'withdrew directory listing proposal', b, 'Directory', prop.orgId)
          return json({ ok: true })
        }
        // Only the organisation's own staff (write access to their own tenant) decide.
        if (!own || !(await canAccessOrg(caller, prop.orgId, 'write'))) return forbidden()
        const decidedAt = new Date()
        if (c === 'approve') {
          const p = approveSchema.safeParse((await readBody()) ?? {})
          if (!p.success) return bad('Invalid summary')
          const summary = p.data.summary ?? prop.summary
          const done = await db.update(orgListingProposals).set({ status: 'approved', decidedBy: caller.email, decidedAt })
            .where(and(eq(orgListingProposals.id, b), eq(orgListingProposals.status, 'pending'))).returning({ id: orgListingProposals.id })
          if (!done.length) return json({ error: 'Proposal is no longer pending' }, 409)
          const fields = { listed: true, summary, updatedBy: caller.email, updatedAt: decidedAt }
          await db.insert(orgDirectoryProfiles).values({ id: `od_${crypto.randomUUID()}`, orgId: prop.orgId, ...fields })
            .onConflictDoUpdate({ target: orgDirectoryProfiles.orgId, set: fields })
          await audit(caller.email, `approved directory listing proposed by ${prop.proposedBy}`, b, 'Directory', prop.orgId)
          return json({ ok: true })
        }
        const p = rejectSchema.safeParse((await readBody()) ?? {})
        if (!p.success) return bad('Invalid reason')
        const reason = p.data.reason || null
        const done = await db.update(orgListingProposals).set({ status: 'rejected', decidedBy: caller.email, decidedAt, reason })
          .where(and(eq(orgListingProposals.id, b), eq(orgListingProposals.status, 'pending'))).returning({ id: orgListingProposals.id })
        if (!done.length) return json({ error: 'Proposal is no longer pending' }, 409)
        await audit(caller.email, `rejected directory listing proposed by ${prop.proposedBy}${reason ? ` (${reason})` : ''}`, b, 'Directory', prop.orgId)
        return json({ ok: true })
      }
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
        const hits = all
          .map((v) => ({ v, firmList: firmMap.get(v.email) ?? [] }))
          .filter(({ v, firmList }) => inCountry(v.countries) &&
            matchesQuery([v.name, v.bio, v.competencies, v.frameworks, v.countries, v.languages, firmList.map((f) => f.name)], q))
        const badgeMap = await badgesFor(hits.map(({ v }) => v.email))
        return json(hits.map(({ v, firmList }) => validatorCard(v, firmList, badgeMap.get(v.email))))
      }
      if (type === 'firms' || type === 'funders') {
        const all = await db.select().from(firms).where(eq(firms.kind, type === 'firms' ? 'validator_firm' : 'funding_partner'))
        const hits = all.filter((f) => inCountry(f.countries) && matchesQuery([f.name, f.nature, f.summary, f.competencies, f.countries, f.sectors], q))
        const sizes = await teamSizes(hits.map((f) => f.id))
        return json(hits.map((f) => firmCard(f, sizes.get(f.id) ?? 0)))
      }
      if (type === 'organizations') {
        if (!(await mayBrowseOrganizations(caller.email, isAdmin))) return forbidden()
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
        ...validatorCard(v, firmList, (await badgesFor([v.email])).get(v.email)), bio: v.bio, frameworks: v.frameworks, languages: v.languages,
        credentials: creds.map((cr) => ({ id: cr.id, body: cr.body, membershipNumber: cr.membershipNumber, status: credentialLabel(cr) })),
        ...(isAdmin ? { accreditationStatus: v.accreditationStatus, accreditationReason: v.accreditationReason } : {}),
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
      if (!(await mayBrowseOrganizations(caller.email, isAdmin))) return forbidden()
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
      if (!p.success) return bad('A status of suspended or registered (reinstate) and a reason are required; accreditation itself is earned through the training programme')
      const [cur] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.id, c))
      if (!cur) return notFound()
      // Reinstating restores what the validator already earned (their accredited_until, if any);
      // it never grants accreditation.
      const status = p.data.status === 'suspended' ? 'suspended' : cur.accreditedUntil ? 'accredited' : 'registered'
      const [row] = await db.update(validatorProfiles).set({
        accreditationStatus: status, accreditationReason: p.data.reason, accreditationChangedBy: caller.email, accreditationChangedAt: new Date(),
      }).where(eq(validatorProfiles.id, c)).returning()
      await audit(caller.email, `accreditation: ${p.data.status === 'suspended' ? 'suspended' : 'reinstated'} (${p.data.reason})`, c, 'Accreditation')
      // A validator who is no longer accredited loses access carried by independent-validation seats.
      await reconcileValidator(row.email)
      return json({ ok: true, accreditation: effectiveAccreditation(row) })
    }

    return req.method === 'GET' || req.method === 'PUT' || req.method === 'POST' || req.method === 'DELETE' ? notFound() : new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error('/api/directory', 'failed', err)
    return json({ error: 'Directory request failed' }, 500)
  }
}

export const config: Config = { path: ['/api/directory', '/api/directory/*'] }
