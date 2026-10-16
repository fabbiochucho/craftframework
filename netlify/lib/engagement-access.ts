// ============================================================================
// Validator engagement access — the ONLY place craft_validator grants are made.
// ----------------------------------------------------------------------------
// A person sees an organisation's data only if the organisation accepted the
// engagement, they are a named team member the organisation approved, they
// signed the current declaration, (for an independent validation) they are
// currently accredited, and their grant is active and unexpired. Firm
// membership alone grants nothing.
//
// access_grants has ONE row per (org, grantee) (access_grants_org_grantee_unique),
// so the grant is DERIVED from every engagement the person is on for that
// organisation: reconcileGrant() recomputes it after any change. The row carries
// the latest expiry of the engagements still entitling the person and is
// revoked when none does (cancel, expiry, removal, loss of accreditation), so
// a person re-engaged later, or on two engagements at once, is handled.
// ============================================================================

import { and, eq, gt, lte } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  accessGrants, auditLogs, engagementDeclarations, engagementMembers, organizations, users, validationEngagements, validatorProfiles,
} from '../../db/schema.js'
import { declarationFor, GRANT_ROLE, type EngagementType } from '../../src/lib/engagements.js'
import { effectiveAccreditation } from '../../src/lib/validatorDirectory.js'

const audit = (actor: string, action: string, target: string, orgId: string) =>
  db.insert(auditLogs).values({ actor, action, target, category: 'Engagement', orgId })

export async function accreditationOf(email: string): Promise<string | null> {
  const [v] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.email, email))
  return v ? effectiveAccreditation(v) : null
}

// A reason this person must not be a validator for the organisation, or null.
// Staff, the creator / reviewer of record and anyone holding an ordinary access
// relationship have an ownership, employment or advisory tie.
export async function accessConflict(orgId: string, email: string, now = new Date()): Promise<string | null> {
  const [staff] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email), eq(users.orgId, orgId)))
  if (staff) return 'They work for this organisation'
  const [org] = await db.select({ createdBy: organizations.createdBy, reviewer: organizations.reviewer }).from(organizations).where(eq(organizations.id, orgId))
  if ((org?.createdBy ?? '').toLowerCase() === email || (org?.reviewer ?? '').toLowerCase() === email) return 'They administer this organisation'
  const [grant] = await db.select().from(accessGrants).where(and(eq(accessGrants.orgId, orgId), eq(accessGrants.grantee, email)))
  if (grant && grant.role !== GRANT_ROLE && (grant.status === 'active' || grant.status === 'pending') &&
    !(grant.expiresAt && grant.expiresAt.getTime() <= now.getTime())) return 'They already hold an access grant to this organisation'
  return null
}

// Recompute the (org, email) grant from engagement state. Returns whether access is now open.
export async function reconcileGrant(orgId: string, email: string, now = new Date()): Promise<boolean> {
  const candidates = await db.select({ m: engagementMembers, e: validationEngagements })
    .from(engagementMembers)
    .innerJoin(validationEngagements, eq(validationEngagements.id, engagementMembers.engagementId))
    .where(and(
      eq(validationEngagements.orgId, orgId), eq(engagementMembers.email, email), eq(engagementMembers.status, 'named'),
      eq(engagementMembers.orgApproved, true), eq(validationEngagements.status, 'active'),
      eq(validationEngagements.orgStatus, 'accepted'), gt(validationEngagements.expiresAt, now),
    ))
  const accreditation = candidates.some((c) => c.e.type === 'independent_validation') ? await accreditationOf(email) : null
  const eligible: typeof candidates = []
  for (const c of candidates) {
    if (c.e.type === 'independent_validation' && accreditation !== 'accredited') continue
    const [signed] = await db.select({ id: engagementDeclarations.id }).from(engagementDeclarations).where(and(
      eq(engagementDeclarations.engagementId, c.e.id), eq(engagementDeclarations.memberEmail, email),
      eq(engagementDeclarations.version, declarationFor(c.e.type as EngagementType).version)))
    if (signed) eligible.push(c)
  }
  const [existing] = await db.select().from(accessGrants).where(and(eq(accessGrants.orgId, orgId), eq(accessGrants.grantee, email)))
  const conflict = eligible.length ? await accessConflict(orgId, email, now) : null
  if (eligible.length && !conflict) {
    const expiresAt = new Date(Math.max(...eligible.map((c) => c.e.expiresAt!.getTime())))
    const open = existing && existing.role === GRANT_ROLE && existing.status === 'active' && existing.expiresAt?.getTime() === expiresAt.getTime()
    const [row] = await db.insert(accessGrants).values({
      id: `grant_${crypto.randomUUID()}`, orgId, grantee: email, grantedBy: eligible[0].e.orgConsentedBy ?? eligible[0].e.createdBy,
      level: 'read', role: GRANT_ROLE, status: 'active', expiresAt, respondedAt: now,
    }).onConflictDoUpdate({
      target: [accessGrants.orgId, accessGrants.grantee],
      set: { level: 'read', role: GRANT_ROLE, status: 'active', expiresAt, respondedAt: now },
    }).returning()
    for (const c of eligible) {
      await db.update(engagementMembers).set({ grantId: row.id, grantedAt: c.m.grantedAt ?? now }).where(eq(engagementMembers.id, c.m.id))
    }
    if (!open) await audit('system', `granted read-only validator access to ${email} until ${expiresAt.toISOString()}`, row.id, orgId)
    return true
  }
  if (existing && existing.role === GRANT_ROLE && existing.status === 'active') {
    await db.update(accessGrants).set({ status: 'revoked', respondedAt: now }).where(eq(accessGrants.id, existing.id))
    await audit('system', `revoked validator access for ${email}`, existing.id, orgId)
  }
  return false
}

export async function reconcileEngagement(engagementId: string, now = new Date()): Promise<void> {
  const [e] = await db.select({ orgId: validationEngagements.orgId }).from(validationEngagements).where(eq(validationEngagements.id, engagementId))
  if (!e) return
  const members = await db.select({ email: engagementMembers.email }).from(engagementMembers).where(eq(engagementMembers.engagementId, engagementId))
  for (const m of members) await reconcileGrant(e.orgId, m.email, now)
}

// Expire engagements past their window (and stale unanswered invitations), then
// revoke the access they carried. Idempotent; the grant rows also expire on
// their own through expires_at, this keeps status and audit trail honest.
export async function sweepEngagements(now = new Date()): Promise<void> {
  const expired = await db.update(validationEngagements).set({ status: 'expired', updatedAt: now })
    .where(and(eq(validationEngagements.status, 'active'), lte(validationEngagements.expiresAt, now)))
    .returning({ id: validationEngagements.id, orgId: validationEngagements.orgId })
  await db.update(validationEngagements).set({ status: 'expired', updatedAt: now })
    .where(and(eq(validationEngagements.status, 'proposed'), lte(validationEngagements.inviteExpiresAt, now)))
  for (const e of expired) {
    await audit('system', 'engagement expired', e.id, e.orgId)
    await reconcileEngagement(e.id, now)
  }
  // Grants of engagements that lapsed earlier but whose status flip raced a sweep.
  const stale = await db.select({ id: accessGrants.id, orgId: accessGrants.orgId, grantee: accessGrants.grantee }).from(accessGrants)
    .where(and(eq(accessGrants.role, GRANT_ROLE), eq(accessGrants.status, 'active'), lte(accessGrants.expiresAt, now)))
  for (const g of stale) await reconcileGrant(g.orgId, g.grantee, now)
}

// A validator who is no longer accredited loses the access their independent-validation seats carried.
export async function reconcileValidator(email: string): Promise<void> {
  const rows = await db.select({ orgId: validationEngagements.orgId }).from(engagementMembers)
    .innerJoin(validationEngagements, eq(validationEngagements.id, engagementMembers.engagementId))
    .where(and(eq(engagementMembers.email, email), eq(engagementMembers.status, 'named')))
  for (const orgId of new Set(rows.map((r) => r.orgId))) await reconcileGrant(orgId, email)
}
