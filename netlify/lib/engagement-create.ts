// Creating a validation engagement, shared by /api/engagements (an organisation
// picked from the directory) and invitation acceptance (an organisation invited
// by email: the engagement is proposed once its workspace exists). Every rule
// lives here so both paths check exactly the same things.
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, engagementMembers, firmMembers, firms, organizations, orgDirectoryProfiles, validationEngagements, validatorProfiles } from '../../db/schema.js'
import { canAccessOrg } from './auth.js'
import { accessConflict, specialismsMissing } from './engagement-access.js'
import { missingSpecialismMessage } from '../../src/lib/specialisms.js'
import { isPrimaryFramework } from '../../src/lib/validationReview.js'
import { DEFAULT_ACCESS_DAYS, ENGAGEMENT_TYPES, INVITE_VALID_DAYS, MAX_ACCESS_DAYS, mayCreateType, mayJoinTeam, parseScope } from '../../src/lib/engagements.js'
import { effectiveAccreditation } from '../../src/lib/validatorDirectory.js'

export const createSchema = z.object({
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
export type CreateInput = z.infer<typeof createSchema>

export type Firms = Map<string, { role: string; kind: string | null; name: string }>
export async function myFirms(email: string): Promise<Firms> {
  const rows = await db.select({ id: firms.id, name: firms.name, kind: firms.kind, role: firmMembers.role }).from(firmMembers)
    .innerJoin(firms, eq(firms.id, firmMembers.firmId))
    .where(and(eq(firmMembers.email, email), eq(firmMembers.status, 'active')))
  return new Map(rows.map((r) => [r.id, { role: r.role, kind: r.kind, name: r.name }]))
}

type Caller = { email: string; orgId: string; name: string }
export type CreateResult = { status: number; body: Record<string, unknown> }
const fail = (status: number, error: string): CreateResult => ({ status, body: { error } })

/**
 * Validate and (unless `dryRun`) insert an engagement.
 * - `targetOrgId`: the organisation for a validator / funder side, instead of a directory profile
 *   (used when an organisation invited by email accepts).
 * - `dryRun`: check everything that does not need the organisation (used before inviting by email).
 */
export async function createEngagement(caller: Caller, firmMap: Firms, d: CreateInput, opts: { targetOrgId?: string; dryRun?: boolean } = {}): Promise<CreateResult> {
  if (!mayCreateType(d.side, d.type)) return fail(403, 'A funding partner can only create a funder review, never an independent validation')
  const scope = parseScope(d.scope)
  if (!scope) return fail(400, 'Invalid scope')
  // Indices are validated alongside the ladder (scope.indices), never as the engagement's framework, so the specialism check always applies.
  if (d.framework && !isPrimaryFramework(d.framework)) return fail(400, 'Choose the ladder as the framework; add CRAFT indices to the scope')
  const now = new Date()
  const base = {
    id: `eng_${crypto.randomUUID()}`, framework: d.framework ?? 'capital-readiness', scope, type: d.type, createdBy: caller.email, createdBySide: d.side,
    requiresRereview: !!d.requiresRereview, accessDays: d.accessDays ?? DEFAULT_ACCESS_DAYS,
    inviteExpiresAt: new Date(now.getTime() + INVITE_VALID_DAYS * 86_400_000),
  }
  let orgId: string
  let shape: Partial<typeof validationEngagements.$inferInsert>
  const leads: Array<{ email: string; approved: boolean }> = []

  const targetOrg = async () => {
    if (opts.targetOrgId) return opts.targetOrgId
    if (!d.organizationProfileId) return null
    const [o] = await db.select({ orgId: orgDirectoryProfiles.orgId }).from(orgDirectoryProfiles)
      .where(and(eq(orgDirectoryProfiles.id, d.organizationProfileId), eq(orgDirectoryProfiles.listed, true)))
    return o?.orgId ?? null
  }

  if (d.side === 'organization') {
    if (opts.dryRun || opts.targetOrgId) return fail(400, 'An organisation creates its own engagements')
    orgId = caller.orgId
    if (!(await canAccessOrg(caller as never, orgId, 'write'))) return fail(403, 'Forbidden')
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId))
    if (!org) return fail(400, 'Set up your organisation profile first')
    if (d.type === 'independent_validation') {
      if (d.validatorId) {
        const [v] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.id, d.validatorId))
        if (!v) return fail(400, 'Validator not found')
        if (!mayJoinTeam(d.type, effectiveAccreditation(v))) return fail(403, 'Only a currently accredited validator can perform an independent validation')
        const missing = await specialismsMissing(v.email, scope)
        if (missing.length) return fail(403, missingSpecialismMessage(missing))
        const tie = await accessConflict(orgId, v.email)
        if (tie) return fail(409, `${tie}, so they cannot validate it`)
        shape = { validatorEmail: v.email, validatorStatus: 'pending', funderStatus: 'not_required' }
        leads.push({ email: v.email, approved: true })
      } else if (d.validatorFirmId) {
        const [f] = await db.select({ id: firms.id }).from(firms).where(and(eq(firms.id, d.validatorFirmId), eq(firms.kind, 'validator_firm')))
        if (!f) return fail(400, 'Validator firm not found')
        shape = { validatorFirmId: f.id, validatorStatus: 'pending', funderStatus: 'not_required' }
      } else return fail(400, 'Choose a validator or validator firm')
    } else {
      if (!d.funderFirmId) return fail(400, 'Choose a funding partner')
      const [f] = await db.select({ id: firms.id }).from(firms).where(and(eq(firms.id, d.funderFirmId), eq(firms.kind, 'funding_partner')))
      if (!f) return fail(400, 'Funding partner not found')
      shape = { funderFirmId: f.id, funderStatus: 'pending', validatorStatus: 'not_required' }
    }
    Object.assign(shape, { orgStatus: 'accepted', orgConsentedBy: caller.email, orgConsentedAt: now })
  } else if (d.side === 'funder') {
    if (!d.funderFirmId || firmMap.get(d.funderFirmId)?.kind !== 'funding_partner') return fail(403, 'Forbidden')
    if (opts.dryRun) return { status: 200, body: { ok: true } }
    const target = await targetOrg()
    if (!target) return fail(400, 'Choose an organisation from the directory')
    orgId = target
    shape = { funderFirmId: d.funderFirmId, funderStatus: 'accepted', validatorStatus: 'not_required', orgStatus: 'pending' }
  } else {
    const [me] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.email, caller.email))
    if (!me) return fail(400, 'Create your validator profile first')
    if (!mayJoinTeam(d.type, effectiveAccreditation(me))) return fail(403, 'Only a currently accredited validator can perform an independent validation')
    if (d.type === 'independent_validation') {
      const missing = await specialismsMissing(caller.email, scope)
      if (missing.length) return fail(403, missingSpecialismMessage(missing))
    }
    if (d.validatorFirmId && firmMap.get(d.validatorFirmId)?.kind !== 'validator_firm') return fail(403, 'Forbidden')
    if (opts.dryRun) return { status: 200, body: { ok: true } }
    const target = await targetOrg()
    if (!target) return fail(400, 'Choose an organisation from the directory')
    orgId = target
    const tie = await accessConflict(orgId, caller.email)
    if (tie) return fail(409, `${tie}, so you cannot validate it`)
    shape = { validatorFirmId: d.validatorFirmId ?? null, validatorEmail: d.validatorFirmId ? null : caller.email, validatorStatus: 'accepted', funderStatus: 'not_required', orgStatus: 'pending' }
    leads.push({ email: caller.email, approved: false })
  }

  const [row] = await db.insert(validationEngagements).values({ ...base, orgId, ...shape } as typeof validationEngagements.$inferInsert).returning()
  for (const l of leads) {
    await db.insert(engagementMembers).values({ id: `em_${crypto.randomUUID()}`, engagementId: row.id, email: l.email, role: 'lead', status: 'named', orgApproved: l.approved, addedBy: caller.email })
  }
  await db.insert(auditLogs).values({ actor: caller.email, action: `created ${d.type.replace('_', ' ')} engagement (${d.side} side)`, target: row.id, category: 'Engagement', orgId })
  return { status: 201, body: { id: row.id } }
}
