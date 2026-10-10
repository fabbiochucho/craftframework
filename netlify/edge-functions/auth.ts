import type { Context, Config } from '@netlify/edge-functions'

// ============================================================================
// CRAFT v4.0 — Edge auth & multi-tenant isolation
// ----------------------------------------------------------------------------
// Runs at the network edge ahead of the origin for the secure workspace routes.
// It decodes the Netlify GoTrue JWT (when present) for advisory route gating,
// strips unverified isolation headers,
// and gates the independent-assurance surface (/verify/*) to assessors only.
//
// Design note: CRAFT is a client-rendered SPA with a public demo mode, so this
// function NEVER hard-blocks a route simply because a JWT is absent — the client
// owns the sign-in redirect. It only returns 403 when a token IS present but
// carries the wrong role for a restricted route. That keeps the live app and the
// `?demo=` flow working while still enforcing role isolation for real sessions.
// ============================================================================

interface JwtClaims {
  email?: string
  app_metadata?: {
    organization_id?: string
    roles?: string[]
    role?: string
    // Epoch seconds after which a time-bound specialized grant expires.
    access_expires_at?: number
  }
  user_metadata?: { organization_id?: string; role?: string }
  [key: string]: unknown
}

// ----------------------------------------------------------------------------
// Specialized ecosystem RBAC (Feature 5) — time-bound, READ-ONLY roles granted
// to Regulators, Auditors and Institutional Investors so they can inspect the
// Section 11 Vault without ever mutating the workspace. Any of these roles is:
//   • read-only  → non-GET/HEAD requests to workspace routes are 403'd
//   • time-bound → the grant expires at app_metadata.access_expires_at (epoch s)
// ----------------------------------------------------------------------------
const SPECIALIZED_READONLY_ROLES = new Set([
  'cbn_examiner',
  'frcn_auditor',
  'sec_analyst',
  'sharia_board_member',
  'rating_agency_analyst',
  'eu_csd_assessor',
])

// Decode a JWT payload WITHOUT verifying the signature. Signature verification
// belongs at the origin / GoTrue; the edge only needs the claims for routing.
function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))
    return JSON.parse(json) as JwtClaims
  } catch {
    return null
  }
}

function readToken(req: Request, context: Context): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  // Netlify Identity widget stores the GoTrue JWT in this cookie.
  return context.cookies.get('nf_jwt') || context.cookies.get('netlify-gotrue-jwt') || null
}

function roleOf(claims: JwtClaims): string | undefined {
  return (
    claims.app_metadata?.role ||
    claims.app_metadata?.roles?.[0] ||
    undefined
  )
}

export default async (req: Request, context: Context) => {
  const { pathname } = new URL(req.url)
  const token = readToken(req, context)
  const claims = token ? decodeJwt(token) : null

  const role = claims ? roleOf(claims) : undefined
  // Specialized ecosystem roles (regulators / auditors / investors): enforce
  // the time-bound + read-only guarantees before letting them reach the origin.
  if (role && SPECIALIZED_READONLY_ROLES.has(role)) {
    const expiresAt = claims?.app_metadata?.access_expires_at
    const nowSec = Math.floor(Date.now() / 1000)
    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || nowSec >= expiresAt) {
      return new Response('Forbidden: time-bound access grant has expired.', {
        status: 403,
        headers: { 'content-type': 'text/plain' },
      })
    }
    const method = req.method.toUpperCase()
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      return new Response('Forbidden: specialized ecosystem roles are read-only.', {
        status: 403,
        headers: { 'content-type': 'text/plain' },
      })
    }
  }

  // Gate the independent-assurance surface: only an independent assessor may
  // reach /verify/*. Enforced only for authenticated callers (see design note).
  if (pathname.startsWith('/verify') && role && role !== 'independent_assessor') {
    return new Response('Forbidden: independent assessor role required.', {
      status: 403,
      headers: { 'content-type': 'text/plain' },
    })
  }

  // The origin resolves verified identity and current grants from the database.
  const res = await context.next()
  // Unverified JWT claims must not be presented as trusted isolation headers.
  res.headers.delete('x-craft-org')
  res.headers.delete('x-craft-role')
  return res
}

export const config: Config = {
  path: ['/dashboard/*', '/data-room/*', '/data-room', '/assessment/*', '/verify', '/verify/*', '/compliance', '/compliance/*', '/regulatory-compliance', '/issb-disclosures', '/finance-triangulation', '/vaults'],
}
