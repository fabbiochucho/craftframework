// Independent assessor across several organisations. An organisation gives a named person an
// `independent_assessor` access grant (level 'read'), normally by accepting an invitation sent by or on
// behalf of that person. The grant is read-only everywhere, with exactly two narrow write paths:
//   - the independent score column on assessment responses (responses.assessor_score), and
//   - the independent statement answers (legacy state key 'craft:assessor-statements').
// The organisation's own answers, profile, plans and evidence stay unchanged. Revocable like any grant.
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { accessGrants } from '../../db/schema.js'
import { grantAllows } from './access-policy.js'
import type { Caller } from './auth.js'

export const INDEPENDENT_ASSESSOR_ROLE = 'independent_assessor'
/** Saved-state keys an independent assessor may write in an organisation they assess. */
export const INDEPENDENT_STATE_KEYS = new Set(['craft:assessor-statements'])

/** True when `caller` holds an active independent-assessor grant on `orgId`. */
export async function isIndependentAssessorOf(caller: Caller, orgId: string): Promise<boolean> {
  if (!orgId || caller.readOnly) return false
  const [g] = await db.select().from(accessGrants)
    .where(and(eq(accessGrants.orgId, orgId), eq(accessGrants.grantee, caller.email), eq(accessGrants.role, INDEPENDENT_ASSESSOR_ROLE)))
  return !!g && grantAllows(g, 'read')
}
