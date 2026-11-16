// Who plays which part in an organisation's finance workflow (Finance Triangulation):
//   - org_finance_officer / org_grant_manager: named by the organisation (finance_roles), or set on the account;
//   - independent_assessor: the organisation's independent assessor (an active grant).
// Named roles add to a person's normal access; they never replace it.
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { financeRoles } from '../../db/schema.js'
import type { Caller } from './auth.js'
import { isIndependentAssessorOf } from './independent-assessor.js'

export const NAMED_FINANCE_ROLES = ['org_finance_officer', 'org_grant_manager'] as const
export type NamedFinanceRole = (typeof NAMED_FINANCE_ROLES)[number]
const ACCOUNT_FINANCE_ROLES = new Set<string>([...NAMED_FINANCE_ROLES, 'independent_assessor'])

/** The caller's finance workflow role in `orgId`, or '' when they have none. */
export async function financeRoleOf(caller: Caller, orgId: string): Promise<string> {
  if (ACCOUNT_FINANCE_ROLES.has(caller.role) && caller.orgId === orgId) return caller.role
  if (await isIndependentAssessorOf(caller, orgId)) return 'independent_assessor'
  const [named] = await db.select({ role: financeRoles.role }).from(financeRoles)
    .where(and(eq(financeRoles.orgId, orgId), eq(financeRoles.email, caller.email)))
  return named?.role ?? ''
}

export async function namedFinanceRoles(orgId: string): Promise<Record<NamedFinanceRole, string>> {
  const rows = await db.select().from(financeRoles).where(eq(financeRoles.orgId, orgId))
  const by = Object.fromEntries(rows.map((r) => [r.role, r.email]))
  return { org_finance_officer: by.org_finance_officer ?? '', org_grant_manager: by.org_grant_manager ?? '' }
}
