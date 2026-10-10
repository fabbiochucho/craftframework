import type { Config } from '@netlify/functions'
import { db } from '../../db/index.js'
import { accessGrants } from '../../db/schema.js'
import { resolveCaller, canAccessOrg, forbidden, unauthorized } from '../lib/auth.js'
import { logger } from '../lib/logger.js'

// /api/issue-access-grant — issues a TIME-BOUND, READ-ONLY specialized ecosystem
// grant (Feature 5) to a regulator / auditor / institutional investor, and closes
// the loop the edge auth relies on:
//
//   1. Persists the grant (role + expires_at) to access_grants.
//   2. Best-effort: stamps the grantee's Netlify Identity app_metadata with
//      `role` and `access_expires_at` so the JWT the edge function reads at the
//      network edge actually carries the claim it enforces. Without an Identity
//      admin token configured it logs what it WOULD stamp (mirroring the
//      log-only pattern used by the scheduled functions in preview deploys).
//
// The edge function (netlify/edge-functions/auth.ts) then enforces read-only +
// expiry for any request carrying one of these roles.

const SPECIALIZED_ROLES = new Set([
  'cbn_examiner',
  'frcn_auditor',
  'sec_analyst',
  'sharia_board_member',
  'rating_agency_analyst',
  'eu_csd_assessor',
])

async function stampIdentityMetadata(grantee: string, role: string, expiresAtSec: number): Promise<boolean> {
  const adminToken = process.env.NETLIFY_IDENTITY_ADMIN_TOKEN
  const identityUrl = process.env.NETLIFY_IDENTITY_URL // e.g. https://<site>.netlify.app/.netlify/identity
  if (!adminToken || !identityUrl) {
    logger.warn('issue-access-grant', 'Identity admin stamping is not configured')
    return false
  }
  try {
    // Look up the user by email, then patch app_metadata.
    const listRes = await fetch(`${identityUrl}/admin/users?email=${encodeURIComponent(grantee)}`, {
      signal: AbortSignal.timeout(10_000),
      headers: { authorization: `Bearer ${adminToken}` },
    })
    if (!listRes.ok) return false
    const list = await listRes.json().catch(() => null)
    const user = list?.users?.find((candidate: { email?: string }) => candidate.email?.trim().toLowerCase() === grantee)
    if (!user?.id) {
      console.warn(`[issue-access-grant] no Identity user for ${grantee}`)
      return false
    }
    const updateRes = await fetch(`${identityUrl}/admin/users/${user.id}`, {
      method: 'PUT',
      signal: AbortSignal.timeout(10_000),
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        app_metadata: { ...(user.app_metadata ?? {}), role, access_expires_at: expiresAtSec },
      }),
    })
    return updateRes.ok
  } catch (err) {
    logger.error("issue-access-grant", "Identity stamp failed", err)
    return false
  }
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()

    const body = await req.json()
    const orgId = String(body.orgId ?? '').trim()
    const grantee = String(body.grantee ?? '').trim().toLowerCase()
    const role = String(body.role ?? '').trim()
    // Access window in days (default 30).
    const days = Number.isFinite(Number(body.days)) && Number(body.days) > 0 ? Number(body.days) : 30
    if (days > 365) return Response.json({ error: 'Access window must not exceed 365 days' }, { status: 400 })

    if (!orgId || !grantee || !role || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(grantee)) {
      return Response.json({ error: 'orgId, grantee and role required' }, { status: 400 })
    }
    // Only someone with access to the org can grant an outsider a window into it.
    if (!(await canAccessOrg(caller, orgId))) return forbidden()
    if (!SPECIALIZED_ROLES.has(role)) {
      return Response.json({ error: `role must be one of: ${[...SPECIALIZED_ROLES].join(', ')}` }, { status: 400 })
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + days * 86_400_000)
    const expiresAtSec = Math.floor(expiresAt.getTime() / 1000)

    const [row] = await db
      .insert(accessGrants)
      .values({
        id: `grant_${crypto.randomUUID()}`,
        orgId,
        grantee,
        grantedBy: caller.email,
        level: 'read', // specialized ecosystem grants are always read-only
        role,
        status: 'active',
        expiresAt,
        respondedAt: now,
      })
      .onConflictDoUpdate({
        target: [accessGrants.orgId, accessGrants.grantee],
        set: { role, level: 'read', status: 'active', expiresAt, respondedAt: now, grantedBy: caller.email },
      })
      .returning()

    const stamped = await stampIdentityMetadata(grantee, role, expiresAtSec)

    return Response.json(
      {
        grant: { id: row.id, orgId: row.orgId, grantee: row.grantee, role: row.role, level: row.level, expiresAt: row.expiresAt },
        identityStamped: stamped,
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201 },
    )
  } catch (err) {
    logger.error("/api/issue-access-grant", "failed", err)
    return Response.json({ error: 'Failed to issue access grant' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/issue-access-grant',
}
