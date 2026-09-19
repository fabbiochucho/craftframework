// ============================================================================
// Server-side identity & multi-tenant authorization
// ----------------------------------------------------------------------------
// Shared helper that lets every data function enforce tenant isolation the same
// way `netlify/functions/response-notes.mts` already does: the caller is derived
// from the VERIFIED Netlify Identity session (the signed `nf_jwt` cookie), never
// from a client-supplied field. Their organization and role come from the users
// directory (assigned by an admin), falling back to the isolated per-email tenant
// for a self-registrant.
//
// Because a self-registrant's org id is deterministic (`self_<email>`), it is
// guessable — so the org id in a request can never be trusted on its own. These
// helpers turn that guessable id into something harmless: access is decided from
// the token plus the server-side access model (own tenant, admin, an active
// access grant, or being the org's reviewer / creator of record).
// ============================================================================

import { getUser } from '@netlify/identity'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { accessGrants, organizations, users } from '../../db/schema.js'

const SUPER_ADMIN_EMAILS = ['fabbiochucho@gmail.com']

export function isSuperAdmin(email: string): boolean {
  const n = email.trim().toLowerCase()
  return SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === n)
}

// The effective role for a caller. The allowlist is the SOLE source of platform
// `super_admin` (Super Admin) rights: a listed operator is always `super_admin`;
// for any other email a `super_admin` assignment is clamped to `admin` (the
// highest assignable tier), so a stale or malicious directory row can never
// grant a second account platform-wide access. The ordinary `admin`
// (Administrator) tier is a normal, scoped role that anyone may hold.
export function effectiveRole(email: string, assigned?: string | null): string {
  if (isSuperAdmin(email)) return 'super_admin'
  const role = assigned || 'assessor'
  return role === 'super_admin' ? 'admin' : role
}

// Mirror of src/lib/api.ts `tenantOrgId` + the IdentityBridge fallback, so the
// org we scope to on the server matches the one the client signed in with when a
// self-registrant has no assigned directory row.
export function tenantOrgId(email: string): string {
  return `self_${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
}

export type Caller = { email: string; name: string; orgId: string; role: string }

// Resolve the verified caller from the Identity session. Returns null when there
// is no valid session — callers should answer 401 (reads in the client helpers
// then degrade to a safe empty fallback). Org + role are read from the user
// directory exactly as sign-in does; a self-registrant with no row falls back to
// their isolated per-email tenant.
export async function resolveCaller(): Promise<Caller | null> {
  const user = await getUser()
  if (!user?.email) return null
  const email = user.email.trim().toLowerCase()
  const name = ((user.userMetadata?.full_name as string) || user.name || email).trim()
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (row && row.orgId) {
    // The super-admin allowlist is the sole authority on the `super_admin` tier:
    // a listed operator always resolves to `super_admin`; everyone else is
    // clamped so a directory row can neither revoke the Super Admin nor mint a
    // second one. The ordinary `admin` tier resolves through unchanged.
    return { email, name, orgId: row.orgId, role: effectiveRole(email, row.role) }
  }
  return { email, name, orgId: tenantOrgId(email), role: effectiveRole(email) }
}

// Of the requested org ids, return the subset this caller may read/write. The
// platform Super Admin sees everything. Otherwise a caller (including an
// ordinary Administrator) may touch: their own tenant, any org with an `active`
// access grant to them, and any org where they are the reviewer or creator of
// record (backward compatibility for a reviewer's own administered
// institutions — the same rule the batch score read has always used).
export async function filterAuthorizedOrgIds(caller: Caller, ids: string[]): Promise<string[]> {
  if (!ids.length) return []
  if (caller.role === 'super_admin') return ids
  const email = caller.email
  const [grantRows, orgRows] = await Promise.all([
    db
      .select({ orgId: accessGrants.orgId })
      .from(accessGrants)
      .where(and(inArray(accessGrants.orgId, ids), eq(accessGrants.status, 'active'), eq(accessGrants.grantee, email))),
    db
      .select({ id: organizations.id, createdBy: organizations.createdBy, reviewer: organizations.reviewer })
      .from(organizations)
      .where(inArray(organizations.id, ids)),
  ])
  const allowed = new Set<string>(grantRows.map((r) => r.orgId))
  allowed.add(caller.orgId)
  for (const o of orgRows) {
    if ((o.createdBy ?? '').toLowerCase() === email || (o.reviewer ?? '').toLowerCase() === email) allowed.add(o.id)
  }
  return ids.filter((id) => allowed.has(id))
}

// Whether the caller may read/write a single org's tenant-scoped data.
export async function canAccessOrg(caller: Caller, orgId: string): Promise<boolean> {
  if (!orgId) return false
  if (caller.role === 'super_admin' || orgId === caller.orgId) return true
  return (await filterAuthorizedOrgIds(caller, [orgId])).length > 0
}

export const unauthorized = () => Response.json({ error: 'Unauthorized' }, { status: 401 })
export const forbidden = () => Response.json({ error: 'Forbidden' }, { status: 403 })
