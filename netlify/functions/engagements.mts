import type { Config } from '@netlify/functions'
import { and, eq, inArray, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  auditLogs, engagementDeclarations, engagementMembers, firmMembers, firms, organizations, orgDirectoryProfiles,
  validationEngagements, validatorProfiles, type EngagementMemberRow, type ValidationEngagementRow,
} from '../../db/schema.js'
import { canAccessOrg, forbidden, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { accessConflict, accreditationOf, reconcileEngagement, sweepEngagements } from '../lib/engagement-access.js'
import { logger } from '../lib/logger.js'
import {
  DEFAULT_ACCESS_DAYS, ENGAGEMENT_TYPES, engagementLabel, engagementStatusFrom, grantExpiry, INVITE_VALID_DAYS, MAX_ACCESS_DAYS,
  mayCreateType, mayJoinTeam, parseScope, declarationFor, type EngagementType, type PartyStatus, type Side,
} from '../../src/lib/engagements.js'
import { effectiveAccreditation } from '../../src/lib/validatorDirectory.js'

// /api/engagements — validator system PR 2 (spec: "Engagements, teams and access").
// Signed-in, MFA-gated, never writable by a read-only (regulator) session.
//
//   GET    /                          engagements the caller is party to
//   POST   /                          create (organisation | validator | funder side)
//   GET    /:id                       detail (404 unless the caller is a party)
//   POST   /:id/respond               {side, decision, reason?} each required party; the organisation consents
//   POST   /:id/members               {email, role?} name a team member
//   DELETE /:id/members/:email        remove a member (or leave)
//   POST   /:id/members/:email/approve   the organisation approves a member added after it consented
//   POST   /:id/declaration           a named member signs the versioned declaration
//   POST   /:id/cancel                {reason?} ends the engagement and revokes every grant
//
// Access to the organisation's data is never decided here: members get a
// time-limited read-only access_grants row (netlify/lib/engagement-access.ts).

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string) => json({ error }, 400)
const notFound = () => json({ error: 'Not found' }, 404)
const conflict = (error: string) => json({ error }, 409)
const audit = (actor: string, action: string, target: string, orgId: string) =>
  db.insert(auditLogs).values({ actor, action, target, category: 'Engagement', orgId })

const emailSchema = z.string().trim().toLowerCase().email().max(200)
const createSchema = z.object({
  side: z.enum(['organization', 'validator', 'funder']),
  type: z.enum(ENGAGEMENT_TYPES),
  framework: z.string().trim().min(1).max(60).optional(),
  scope: z.unknown().optional(),
  accessDays: z.number().int().min(1).max(MAX_ACCESS_DAYS).optional(),
  requiresRereview: z.boolean().optional(),
  organizationProfileId: z.string().max(200).optional(),
  validatorId: z.string().max(200).optional(),
  validatorFirmId: z.string().max(200).optional(),
  funderFirmId: z.string().max(200).optional(),
})
const respondSchema = z.object({ side: z.enum(['organization', 'validator', 'funder']), decision: z.enum(['accept', 'decline']), reason: z.string().trim().max(1000).optional() })
const memberSchema = z.object({ email: emailSchema, role: z.enum(['lead', 'member']).optional() })
const declarationSchema = z.object({
  confirmed: z.literal(true),
  fundedDisclosure: z.boolean().optional(),
  disclosure: z.string().trim().max(2000).optional(),
  signedName: z.string().trim().min(1).max(200),
})
const cancelSchema = z.object({ reason: z.string().trim().max(1000).optional() })

type Firms = Map<string, { role: string; kind: string | null; name: string }>
async function myFirms(email: string): Promise<Firms> {
  const rows = await db.select({ id: firms.id, name: firms.name, kind: firms.kind, role: firmMembers.role }).from(firmMembers)
    .innerJoin(firms, eq(firms.id, firmMembers.firmId))
    .where(and(eq(firmMembers.email, email), eq(firmMembers.status, 'active')))
  return new Map(rows.map((r) => [r.id, { role: r.role, kind: r.kind, name: r.name }]))
}
async function isActiveMemberOf(firmId: string, email: string): Promise<boolean> {
  const [r] = await db.select({ e: firmMembers.email }).from(firmMembers)
    .where(and(eq(firmMembers.firmId, firmId), eq(firmMembers.email, email), eq(firmMembers.status, 'active')))
  return !!r
}

// Which sides of an engagement the caller acts for.
type Standing = { org: boolean; validatorManager: boolean; validatorSide: boolean; funder: boolean; member: EngagementMemberRow | null; creator: boolean }
async function standing(e: ValidationEngagementRow, caller: { email: string; orgId: string; readOnly?: boolean }, firmMap: Firms, members: EngagementMemberRow[]): Promise<Standing> {
  const org = caller.orgId === e.orgId && (await canAccessOrg(caller as never, e.orgId, 'write'))
  const vFirm = e.validatorFirmId ? firmMap.get(e.validatorFirmId) : undefined
  const member = members.find((m) => m.email === caller.email && m.status === 'named') ?? null
  const validatorManager = (!!vFirm && vFirm.role === 'owner') || (!e.validatorFirmId && e.validatorEmail === caller.email) ||
    (!!vFirm && !!member && member.role === 'lead')
  return {
    org, validatorManager, member, creator: e.createdBy === caller.email,
    validatorSide: !!vFirm || e.validatorEmail === caller.email,
    funder: !!e.funderFirmId && firmMap.has(e.funderFirmId),
  }
}
const anyStanding = (s: Standing) => s.org || s.validatorSide || s.funder || !!s.member || s.creator

async function load(id: string) {
  const [e] = await db.select().from(validationEngagements).where(eq(validationEngagements.id, id))
  if (!e) return null
  const members = await db.select().from(engagementMembers).where(eq(engagementMembers.engagementId, id))
  return { e, members }
}

async function view(e: ValidationEngagementRow, members: EngagementMemberRow[], s: Standing, firmMap: Firms) {
  const [org] = await db.select({ name: organizations.name, country: organizations.country }).from(organizations).where(eq(organizations.id, e.orgId))
  const firmIds = [e.validatorFirmId, e.funderFirmId].filter((x): x is string => !!x)
  const firmRows = firmIds.length ? await db.select({ id: firms.id, name: firms.name }).from(firms).where(inArray(firms.id, firmIds)) : []
  const firmName = (id: string | null) => firmRows.find((f) => f.id === id)?.name ?? null
  const emails = [...members.map((m) => m.email), ...(e.validatorEmail ? [e.validatorEmail] : [])]
  const profiles = emails.length ? await db.select().from(validatorProfiles).where(inArray(validatorProfiles.email, emails)) : []
  const decls = members.length ? await db.select().from(engagementDeclarations).where(eq(engagementDeclarations.engagementId, e.id)) : []
  const type = e.type as EngagementType
  const declaration = declarationFor(type)
  const memberViews = members.filter((m) => m.status === 'named').map((m) => {
    const p = profiles.find((x) => x.email === m.email)
    return {
      email: m.email, name: p?.name ?? m.email, role: m.role, orgApproved: m.orgApproved,
      accreditation: p ? effectiveAccreditation(p) : 'none',
      declared: decls.some((d) => d.memberEmail === m.email && d.version === declaration.version),
      access: !!m.grantId && e.status === 'active' && m.orgApproved,
    }
  })
  const leadProfile = profiles.find((p) => p.email === e.validatorEmail)
  const engagedBy = e.createdBySide === 'organization' ? (org?.name ?? 'the organisation')
    : e.createdBySide === 'funder' ? (firmName(e.funderFirmId) ?? 'the funding partner') : (firmName(e.validatorFirmId) ?? leadProfile?.name ?? 'the validator')
  const mine = s.member
  const decideSide = (side: Side) => e.status === 'proposed' && (side === 'organization' ? s.org && e.orgStatus === 'pending'
    : side === 'validator' ? s.validatorManager && e.validatorStatus === 'pending' : s.funder && e.funderStatus === 'pending')
  const side: Side | null = e.declinedSide as Side | null
  const reasonVisible = s.org || (side === 'validator' && s.validatorSide) || (side === 'funder' && s.funder)
  return {
    id: e.id, type, framework: e.framework, scope: e.scope, status: e.status, organization: org?.name ?? '', country: org?.country ?? '',
    createdBySide: e.createdBySide, requiresRereview: e.requiresRereview, accessDays: e.accessDays,
    inviteExpiresAt: e.inviteExpiresAt, activatedAt: e.activatedAt, expiresAt: e.expiresAt, createdAt: e.createdAt,
    parties: {
      organization: e.orgStatus, validator: e.validatorStatus, funder: e.funderStatus,
      validatorName: firmName(e.validatorFirmId) ?? leadProfile?.name ?? null, funderName: firmName(e.funderFirmId),
    },
    // A decline is shown to everyone, but the organisation's reason only to the organisation.
    declined: e.status === 'declined' ? { side: e.declinedSide, reason: reasonVisible ? e.declineReason : null } : null,
    cancelled: e.status === 'cancelled' ? { at: e.cancelledAt, reason: s.org || s.validatorSide || s.funder ? e.cancelReason : null } : null,
    label: engagementLabel({
      type, funderName: firmName(e.funderFirmId), engagedBy,
      members: memberViews.filter((m) => m.role === 'lead' || type === 'independent_validation').map((m) => ({ name: m.name, accreditation: m.accreditation })),
    }),
    members: memberViews,
    declaration: { ...declaration, signed: !!mine && memberViews.find((m) => m.email === mine.email)?.declared === true, mine: !!mine },
    can: {
      respondAs: (['organization', 'validator', 'funder'] as Side[]).filter(decideSide),
      manageTeam: ['proposed', 'active'].includes(e.status) && (s.org || s.validatorManager || s.funder),
      approveMembers: ['proposed', 'active'].includes(e.status) && s.org,
      cancel: ['proposed', 'active'].includes(e.status) && (s.org || s.validatorManager || s.funder || s.creator),
    },
    myFirms: [...firmMap].map(([id, f]) => ({ id, name: f.name, kind: f.kind })),
  }
}

async function activateIfReady(e: ValidationEngagementRow, actor: string): Promise<ValidationEngagementRow> {
  const next = engagementStatusFrom({ org: e.orgStatus as PartyStatus, validator: e.validatorStatus as PartyStatus, funder: e.funderStatus as PartyStatus }, e.status as 'proposed')
  if (next === e.status) return e
  const now = new Date()
  const set = next === 'active' ? { status: next, activatedAt: now, expiresAt: grantExpiry(now, e.accessDays), updatedAt: now } : { status: next, updatedAt: now }
  const [row] = await db.update(validationEngagements).set(set).where(eq(validationEngagements.id, e.id)).returning()
  await audit(actor, `engagement ${next}`, e.id, e.orgId)
  return row
}

export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    // Specialised read-only sessions (regulators, validators acting through a grant) never use this API.
    if (caller.readOnly) return forbidden()
    await sweepEngagements()
    const url = new URL(req.url)
    const [id, sub, who, act] = url.pathname.replace(/^\/api\/engagements\/?/, '').split('/').filter(Boolean)
    const readBody = async () => { try { return await req.json() } catch { return null } }
    const firmMap = await myFirms(caller.email)

    if (!id) {
      if (req.method === 'GET') {
        const myMemberRows = await db.select({ engagementId: engagementMembers.engagementId }).from(engagementMembers)
          .where(and(eq(engagementMembers.email, caller.email), eq(engagementMembers.status, 'named')))
        const firmIds = [...firmMap.keys()]
        const rows = await db.select().from(validationEngagements).where(or(
          eq(validationEngagements.orgId, caller.orgId), eq(validationEngagements.createdBy, caller.email), eq(validationEngagements.validatorEmail, caller.email),
          myMemberRows.length ? inArray(validationEngagements.id, myMemberRows.map((m) => m.engagementId)) : undefined,
          firmIds.length ? inArray(validationEngagements.validatorFirmId, firmIds) : undefined,
          firmIds.length ? inArray(validationEngagements.funderFirmId, firmIds) : undefined,
        ))
        const out = []
        for (const e of rows) {
          const members = await db.select().from(engagementMembers).where(eq(engagementMembers.engagementId, e.id))
          const s = await standing(e, caller, firmMap, members)
          if (anyStanding(s)) out.push(await view(e, members, s, firmMap))
        }
        return json(out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)))
      }
      if (req.method === 'POST') return await create(caller, firmMap, readBody)
      return new Response('Method Not Allowed', { status: 405 })
    }

    const found = await load(id)
    if (!found) return notFound()
    let { e } = found
    const { members } = found
    const s = await standing(e, caller, firmMap, members)
    // Engagements of other organisations are invisible, not merely forbidden.
    if (!anyStanding(s)) return notFound()
    const reply = async () => {
      const again = await load(id)
      return json(await view(again!.e, again!.members, await standing(again!.e, caller, firmMap, again!.members), firmMap))
    }

    if (req.method === 'GET' && !sub) return reply()

    if (req.method === 'POST' && sub === 'respond' && !who) {
      const p = respondSchema.safeParse(await readBody())
      if (!p.success) return bad('A side and a decision are required')
      const { side, decision, reason } = p.data
      if (e.status !== 'proposed') return conflict('This engagement is no longer awaiting answers')
      const allowed = side === 'organization' ? s.org && e.orgStatus === 'pending'
        : side === 'validator' ? s.validatorManager && e.validatorStatus === 'pending' : s.funder && e.funderStatus === 'pending'
      if (!allowed) return forbidden()
      if (side === 'validator' && decision === 'accept' && !e.validatorFirmId && e.validatorEmail &&
        !mayJoinTeam(e.type as EngagementType, await accreditationOf(e.validatorEmail))) return forbidden()
      const now = new Date()
      const set: Partial<typeof validationEngagements.$inferInsert> = { updatedAt: now }
      const status: PartyStatus = decision === 'accept' ? 'accepted' : 'declined'
      if (side === 'organization') Object.assign(set, { orgStatus: status, ...(decision === 'accept' ? { orgConsentedBy: caller.email, orgConsentedAt: now } : {}) })
      if (side === 'validator') set.validatorStatus = status
      if (side === 'funder') set.funderStatus = status
      if (decision === 'decline') Object.assign(set, { declinedSide: side, declinedBy: caller.email, declineReason: reason || null })
      ;[e] = await db.update(validationEngagements).set(set).where(eq(validationEngagements.id, id)).returning()
      await audit(caller.email, `${side} ${decision === 'accept' ? 'accepted' : 'declined'} engagement${decision === 'decline' && reason ? ` (${reason})` : ''}`, id, e.orgId)
      // The organisation's consent covers the team named so far.
      if (side === 'organization' && decision === 'accept') {
        await db.update(engagementMembers).set({ orgApproved: true }).where(and(eq(engagementMembers.engagementId, id), eq(engagementMembers.status, 'named')))
      }
      e = await activateIfReady(e, caller.email)
      await reconcileEngagement(id)
      return reply()
    }

    if (req.method === 'POST' && sub === 'members' && !who) {
      const p = memberSchema.safeParse(await readBody())
      if (!p.success) return bad('A valid email is required')
      if (!['proposed', 'active'].includes(e.status)) return conflict('This engagement is closed')
      if (!(s.org || s.validatorManager || s.funder)) return forbidden()
      const result = await addMember(e, members, p.data.email, p.data.role ?? 'member', caller.email, s.org)
      if (result) return result
      await reconcileEngagement(id)
      return reply()
    }

    if (sub === 'members' && who) {
      const target = decodeURIComponent(who).trim().toLowerCase()
      const m = members.find((x) => x.email === target && x.status === 'named')
      if (!m) return notFound()
      if (!['proposed', 'active'].includes(e.status)) return conflict('This engagement is closed')
      if (req.method === 'POST' && act === 'approve') {
        if (!s.org) return forbidden()
        await db.update(engagementMembers).set({ orgApproved: true }).where(eq(engagementMembers.id, m.id))
        await audit(caller.email, `approved team member ${target}`, id, e.orgId)
        await reconcileEngagement(id)
        return reply()
      }
      if (req.method === 'DELETE' && !act) {
        const self = target === caller.email
        if (!self && !(s.org || s.validatorManager || s.funder)) return forbidden()
        await db.update(engagementMembers).set({ status: self ? 'declined' : 'removed', grantId: null, grantedAt: null }).where(eq(engagementMembers.id, m.id))
        await audit(caller.email, self ? 'left the engagement team' : `removed team member ${target}`, id, e.orgId)
        await reconcileEngagement(id)
        return reply()
      }
    }

    if (req.method === 'POST' && sub === 'declaration' && !who) {
      if (!s.member) return forbidden()
      if (!['proposed', 'active'].includes(e.status)) return conflict('This engagement is closed')
      const p = declarationSchema.safeParse(await readBody())
      if (!p.success) return bad('Confirm every statement and type your full name to sign')
      if (p.data.fundedDisclosure && !p.data.disclosure) return bad('Describe who engaged or paid you')
      const type = e.type as EngagementType
      if (!mayJoinTeam(type, await accreditationOf(caller.email))) return forbidden()
      const tie = await accessConflict(e.orgId, caller.email)
      if (tie) return conflict(`${tie}, so you cannot declare independence for this engagement`)
      const d = declarationFor(type)
      const text = [d.title, ...d.statements.map((x, i) => `${i + 1}. ${x}`), `Funder disclosure: ${d.fundedPrompt}`].join('\n')
      const inserted = await db.insert(engagementDeclarations).values({
        id: `decl_${crypto.randomUUID()}`, engagementId: id, memberEmail: caller.email, version: d.version, text,
        fundedDisclosure: !!p.data.fundedDisclosure, disclosure: p.data.disclosure ?? '', signedName: p.data.signedName,
      }).onConflictDoNothing().returning({ id: engagementDeclarations.id })
      if (!inserted.length) return conflict('You have already signed this declaration')
      await audit(caller.email, `signed declaration ${d.version}${p.data.fundedDisclosure ? ' with funder disclosure' : ''}`, id, e.orgId)
      await reconcileEngagement(id)
      return reply()
    }

    if (req.method === 'POST' && sub === 'cancel' && !who) {
      const p = cancelSchema.safeParse((await readBody()) ?? {})
      if (!p.success) return bad('Invalid reason')
      if (!['proposed', 'active'].includes(e.status)) return conflict('This engagement is already closed')
      if (!(s.org || s.validatorManager || s.funder || s.creator)) return forbidden()
      const now = new Date()
      await db.update(validationEngagements).set({ status: 'cancelled', cancelledAt: now, cancelledBy: caller.email, cancelReason: p.data.reason || null, updatedAt: now })
        .where(eq(validationEngagements.id, id))
      await audit(caller.email, `cancelled engagement${p.data.reason ? ` (${p.data.reason})` : ''}`, id, e.orgId)
      await reconcileEngagement(id)
      return reply()
    }

    return notFound()
  } catch (err) {
    logger.error('/api/engagements', 'failed', err)
    return json({ error: 'Engagement request failed' }, 500)
  }
}

// Adds (or re-adds) a named member after checking they may sit on this team.
// Returns an error Response, or null when added.
async function addMember(e: ValidationEngagementRow, members: EngagementMemberRow[], email: string, role: 'lead' | 'member', actor: string, byOrg: boolean): Promise<Response | null> {
  const type = e.type as EngagementType
  if (members.filter((m) => m.status === 'named').length >= 20 && !members.some((m) => m.email === email)) return bad('Too many team members')
  if (type === 'independent_validation') {
    const [profile] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.email, email))
    if (!profile) return bad('They need a validator profile first')
    if (!mayJoinTeam(type, effectiveAccreditation(profile))) return json({ error: 'Only currently accredited validators can join an independent validation; other work is labelled "Review by [name]"' }, 403)
    if (e.validatorFirmId && !(await isActiveMemberOf(e.validatorFirmId, email))) return bad('They are not an active member of the validator firm')
  } else if (!e.funderFirmId || !(await isActiveMemberOf(e.funderFirmId, email))) {
    return bad('A funder review team is made of the funding partner\'s own staff')
  }
  const tie = await accessConflict(e.orgId, email)
  if (tie) return conflict(`${tie}, so they cannot be on this team`)
  const row = { id: `em_${crypto.randomUUID()}`, engagementId: e.id, email, role, status: 'named', orgApproved: byOrg, addedBy: actor }
  await db.insert(engagementMembers).values(row).onConflictDoUpdate({
    target: [engagementMembers.engagementId, engagementMembers.email],
    set: { role, status: 'named', orgApproved: byOrg, addedBy: actor, grantId: null, grantedAt: null },
  })
  await audit(actor, `named team member ${email}${byOrg ? '' : ' (awaiting the organisation\'s approval)'}`, e.id, e.orgId)
  return null
}

async function create(caller: { email: string; orgId: string; name: string }, firmMap: Firms, readBody: () => Promise<unknown>) {
  const p = createSchema.safeParse(await readBody())
  if (!p.success) return bad('Invalid engagement')
  const d = p.data
  if (!mayCreateType(d.side, d.type)) return json({ error: 'A funding partner can only create a funder review, never an independent validation' }, 403)
  const scope = parseScope(d.scope)
  if (!scope) return bad('Invalid scope')
  const now = new Date()
  const base = {
    id: `eng_${crypto.randomUUID()}`, framework: d.framework ?? 'capital-readiness', scope, type: d.type, createdBy: caller.email, createdBySide: d.side,
    requiresRereview: !!d.requiresRereview, accessDays: d.accessDays ?? DEFAULT_ACCESS_DAYS,
    inviteExpiresAt: new Date(now.getTime() + INVITE_VALID_DAYS * 86_400_000),
  }
  let orgId: string
  let shape: Partial<typeof validationEngagements.$inferInsert>
  const leads: Array<{ email: string; approved: boolean }> = []

  const orgFromProfile = async () => {
    if (!d.organizationProfileId) return null
    const [o] = await db.select({ orgId: orgDirectoryProfiles.orgId }).from(orgDirectoryProfiles)
      .where(and(eq(orgDirectoryProfiles.id, d.organizationProfileId), eq(orgDirectoryProfiles.listed, true)))
    return o?.orgId ?? null
  }

  if (d.side === 'organization') {
    orgId = caller.orgId
    if (!(await canAccessOrg(caller as never, orgId, 'write'))) return forbidden()
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId))
    if (!org) return bad('Set up your organisation profile first')
    if (d.type === 'independent_validation') {
      if (d.validatorId) {
        const [v] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.id, d.validatorId))
        if (!v) return bad('Validator not found')
        if (!mayJoinTeam(d.type, effectiveAccreditation(v))) return json({ error: 'Only a currently accredited validator can perform an independent validation' }, 403)
        const tie = await accessConflict(orgId, v.email)
        if (tie) return conflict(`${tie}, so they cannot validate it`)
        shape = { validatorEmail: v.email, validatorStatus: 'pending', funderStatus: 'not_required' }
        leads.push({ email: v.email, approved: true })
      } else if (d.validatorFirmId) {
        const [f] = await db.select({ id: firms.id }).from(firms).where(and(eq(firms.id, d.validatorFirmId), eq(firms.kind, 'validator_firm')))
        if (!f) return bad('Validator firm not found')
        shape = { validatorFirmId: f.id, validatorStatus: 'pending', funderStatus: 'not_required' }
      } else return bad('Choose a validator or validator firm')
    } else {
      if (!d.funderFirmId) return bad('Choose a funding partner')
      const [f] = await db.select({ id: firms.id }).from(firms).where(and(eq(firms.id, d.funderFirmId), eq(firms.kind, 'funding_partner')))
      if (!f) return bad('Funding partner not found')
      shape = { funderFirmId: f.id, funderStatus: 'pending', validatorStatus: 'not_required' }
    }
    Object.assign(shape, { orgStatus: 'accepted', orgConsentedBy: caller.email, orgConsentedAt: now })
  } else if (d.side === 'funder') {
    if (!d.funderFirmId || firmMap.get(d.funderFirmId)?.kind !== 'funding_partner') return forbidden()
    const target = await orgFromProfile()
    if (!target) return bad('Choose an organisation from the directory')
    orgId = target
    shape = { funderFirmId: d.funderFirmId, funderStatus: 'accepted', validatorStatus: 'not_required', orgStatus: 'pending' }
  } else {
    const [me] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.email, caller.email))
    if (!me) return bad('Create your validator profile first')
    if (!mayJoinTeam(d.type, effectiveAccreditation(me))) return json({ error: 'Only a currently accredited validator can perform an independent validation' }, 403)
    if (d.validatorFirmId && firmMap.get(d.validatorFirmId)?.kind !== 'validator_firm') return forbidden()
    const target = await orgFromProfile()
    if (!target) return bad('Choose an organisation from the directory')
    orgId = target
    const tie = await accessConflict(orgId, caller.email)
    if (tie) return conflict(`${tie}, so you cannot validate it`)
    shape = { validatorFirmId: d.validatorFirmId ?? null, validatorEmail: d.validatorFirmId ? null : caller.email, validatorStatus: 'accepted', funderStatus: 'not_required', orgStatus: 'pending' }
    leads.push({ email: caller.email, approved: false })
  }

  const [row] = await db.insert(validationEngagements).values({ ...base, orgId, ...shape } as typeof validationEngagements.$inferInsert).returning()
  for (const l of leads) {
    await db.insert(engagementMembers).values({ id: `em_${crypto.randomUUID()}`, engagementId: row.id, email: l.email, role: 'lead', status: 'named', orgApproved: l.approved, addedBy: caller.email })
  }
  await audit(caller.email, `created ${d.type.replace('_', ' ')} engagement (${d.side} side)`, row.id, orgId)
  return json({ id: row.id }, 201)
}

export const config: Config = { path: ['/api/engagements', '/api/engagements/*'] }
