// Independent assessor across several organisations. An organisation gives a named person an
// `independent_assessor` access grant (level 'read'), normally by accepting an invitation sent by or on
// behalf of that person. The grant is read-only everywhere, with exactly two narrow write paths:
//   - the independent score column on assessment responses (responses.assessor_score), and
//   - the independent statement answers (legacy state key 'craft:assessor-statements').
// The organisation's own answers, profile, plans and evidence stay unchanged. Revocable like any grant.
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { accessGrants, users } from '../../db/schema.js'
import { grantAllows } from './access-policy.js'
import type { Caller } from './auth.js'

export const INDEPENDENT_ASSESSOR_ROLE = 'independent_assessor'
/** Saved-state keys an independent assessor may write in an organisation they assess. */
export const INDEPENDENT_STATE_KEYS = new Set(['craft:assessor-statements'])

/** True when `caller` holds an active independent-assessor grant on `orgId`. */
export async function isIndependentAssessorOf(caller: Caller, orgId: string): Promise<boolean> {
  return !caller.readOnly && hasAssessorGrant(caller.email, orgId)
}

/** True when `email` holds an active independent-assessor grant on `orgId`. */
export async function hasAssessorGrant(email: string, orgId: string): Promise<boolean> {
  if (!orgId || !email) return false
  const [g] = await db.select().from(accessGrants)
    .where(and(eq(accessGrants.orgId, orgId), eq(accessGrants.grantee, email.toLowerCase()), eq(accessGrants.role, INDEPENDENT_ASSESSOR_ROLE)))
  return !!g && grantAllows(g, 'read')
}

/** The organisation's independent assessor (the first active grant), with their name when CRAFT knows it. */
export async function independentAssessorOf(orgId: string): Promise<{ email: string; name: string } | null> {
  const grants = await db.select().from(accessGrants)
    .where(and(eq(accessGrants.orgId, orgId), eq(accessGrants.role, INDEPENDENT_ASSESSOR_ROLE)))
  const g = grants.find((x) => grantAllows(x, 'read'))
  if (!g) return null
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.email, g.grantee)).limit(1)
  return { email: g.grantee, name: g.reportName?.trim() || u?.name?.trim() || '' }
}

/** Organisations where `email` holds an active independent-assessor grant. */
export async function assessedOrgIds(email: string): Promise<string[]> {
  const rows = await db.select().from(accessGrants)
    .where(and(eq(accessGrants.grantee, email.toLowerCase()), eq(accessGrants.role, INDEPENDENT_ASSESSOR_ROLE)))
  return [...new Set(rows.filter((g) => grantAllows(g, 'read')).map((g) => g.orgId))]
}
