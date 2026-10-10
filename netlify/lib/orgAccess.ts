// Org-level authorization for the workspace platform (RLS at the API layer).
// The org id from a URL is never trusted on its own: access is granted only
// when the verified caller has a membership row for that org with at least the
// required role. The platform Super Admin may act as owner everywhere.
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { wsOrgMembers, workspaces } from '../../db/schema.js'
import type { Caller } from './auth.js'
import { hasMinRole, type OrgRole } from './workspace.js'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function requireOrgAccess(caller: Caller, orgId: number, minRole: OrgRole): Promise<OrgRole> {
  if (!Number.isInteger(orgId) || orgId <= 0) throw new HttpError(404, 'Not found')
  let role: string | null = null
  if (caller.role === 'super_admin') role = 'owner'
  else {
    const [m] = await db
      .select({ role: wsOrgMembers.role })
      .from(wsOrgMembers)
      .where(and(eq(wsOrgMembers.orgId, orgId), eq(wsOrgMembers.userId, caller.email)))
      .limit(1)
    role = m?.role ?? null
  }
  // Non-members get 404 (not 403) so ids in other orgs cannot be probed.
  if (!role) throw new HttpError(404, 'Not found')
  if (!hasMinRole(role, minRole)) throw new HttpError(403, 'Insufficient role')
  return role as OrgRole
}

// Resolve a workspace id from the URL to its owning org, then enforce access.
export async function requireWorkspaceAccess(caller: Caller, workspaceId: number, minRole: OrgRole) {
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) throw new HttpError(404, 'Not found')
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
  if (!ws) throw new HttpError(404, 'Not found')
  const role = await requireOrgAccess(caller, ws.orgId, minRole)
  return { workspace: ws, orgId: ws.orgId, role }
}
