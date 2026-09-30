# Netlify → Vercel Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the CRAFT app off Netlify entirely (build, functions, edge functions, scheduled functions, database, identity, blob storage) onto Vercel + Supabase Auth + Neon, then point `craftframework.becomechange.institute` at the new host and retire the Netlify site.

**Architecture:** CRAFT is a Vite + TanStack Router SPA (client-rendered, `dist/client` is the static output) backed by 20 Netlify Functions, 2 Netlify Edge Functions, 2 Netlify Scheduled Functions, Netlify DB (managed Neon Postgres via Drizzle), Netlify Identity (GoTrue auth), and Netlify Blobs (file storage). Every one of those platform services has a direct Vercel/Supabase/Neon equivalent except Identity, which becomes Supabase Auth (itself GoTrue-based, so the JWT claim shape — `app_metadata.role`, `app_metadata.organization_id` — carries over almost unchanged). The migration is staged so each task leaves the app deployable and testable on its own; the actual DNS cutover is the last, easily-reversible step.

**Tech Stack:** Vite, React 19, TanStack Router, Drizzle ORM, Neon Postgres (`@neondatabase/serverless`, `drizzle-orm/neon-http`), Supabase Auth (`@supabase/supabase-js`), Vercel Functions (Edge runtime), Vercel Cron, Vercel Blob.

**Spec:** This conversation's requirements (no separate spec doc): replace every Netlify platform dependency with a Vercel/Supabase/Neon equivalent, preserve all existing data and RBAC behavior, then cut the subdomain over.

## Global Constraints

- Never break the live `craftframework.becomechange.institute` / `craftframework.netlify.app` sites while work is in progress — every task lands on a branch and is verified on a Vercel preview deployment before merging.
- Preserve the existing Postgres data. Do not run destructive migrations against the production database; verify against a preview/branch database first if Neon branching is available.
- Preserve the RBAC claim shape (`role`, `organization_id`, `access_expires_at` in `app_metadata`) so `netlify/edge-functions/auth.ts`'s logic (now ported) keeps working with zero behavior change for the 6 specialized read-only roles and the `independent_assessor` gate on `/verify/*`.
- `SUPER_ADMIN_EMAILS` allowlist (`fabbiochucho@gmail.com`) must be preserved exactly — it is the sole source of the `super_admin` tier.
- No new abstractions beyond what each task needs — most functions need zero logic changes, only the Netlify-specific import/export wrapper changes.

## Review Focus

- **Stale/expired specialized-role grants after the auth swap** — `access_expires_at` must still be enforced server-side (edge middleware) after moving off GoTrue; a caller with an expired grant must get 403, not fall through as authenticated. Covered in Task 4.
- **Self-registrant org isolation (`self_<email>` tenant id)** — a newly signed-up user with no directory row must still resolve to their own isolated tenant, not `null`/undefined org, after the auth rewrite. Covered in Task 3.
- **Existing sessions during cutover** — users signed in via Netlify Identity at the moment of cutover will hold a GoTrue JWT that Supabase cannot verify; they must be cleanly signed out and prompted to log in again, not shown a broken/half-authenticated state. Covered in Task 6.
- **Blob key collisions / tenant isolation on Vercel Blob** — Vercel Blob has one flat namespace per project (unlike Netlify's per-store isolation via `getStore({name})`); the org-slug-prefixed key path must still make cross-tenant reads impossible. Covered in Task 7.
- **Cron endpoints callable by anyone** — Netlify Scheduled Functions are not publicly routable, but a ported Vercel Cron target is just a normal API route unless explicitly gated; it must reject requests without the Vercel cron secret. Covered in Task 9.

---

## Prerequisites (manual, do before Task 1)

These are account/dashboard steps, not code — do them once, up front:

1. **Get the live Neon connection string.** In the Netlify dashboard, open the site → **Storage → Database**, or run `netlify env:get NETLIFY_DATABASE_URL` (Netlify DB is Neon under the hood) to get the connection string for the *existing* production data. Save it somewhere safe — this lets the new code point at the exact same live database with zero data migration.
2. **Create a Supabase project** (free tier is fine) for Auth only. Note the Project URL, `anon` public key, and `service_role` key.
3. **Create a Vercel account/project** and connect it to `github.com/fabbiochucho/craftframework` (import the repo, don't deploy yet — deployment happens in Task 10).
4. **Create a Vercel Blob store** for the project (Vercel dashboard → Storage → Blob → Create Store), note the `BLOB_READ_WRITE_TOKEN`.

---

### Task 1: Decouple the database from Netlify DB

**Files:**
- Modify: `db/index.ts`
- Modify: `package.json`
- Create: `scripts/verify-db.mjs`
- Create: `.env.example`

**Interfaces:**
- Produces: `db` (Drizzle client, same `schema` typed export) — every function in `netlify/functions/*.mts` and `netlify/lib/auth.ts` imports this unchanged.

- [ ] **Step 1: Add the Neon serverless driver, remove the Netlify DB package**

```bash
npm install @neondatabase/serverless
npm uninstall @netlify/database
```

- [ ] **Step 2: Rewrite `db/index.ts`**

```typescript
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema.js'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })

export * from './schema.js'
```

- [ ] **Step 3: Add `.env.example` documenting the new required var**

```
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
```

- [ ] **Step 4: Write the verification script**

```javascript
// scripts/verify-db.mjs
import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = neon(url)
const rows = await sql`select 1 as ok`
if (rows[0]?.ok !== 1) {
  console.error('Unexpected result from database:', rows)
  process.exit(1)
}
console.log('DB connection OK')
```

- [ ] **Step 5: Run it against the connection string from Prerequisites step 1**

Run: `DATABASE_URL="<connection string from prerequisites>" node scripts/verify-db.mjs`
Expected: `DB connection OK`

- [ ] **Step 6: Commit**

```bash
git add db/index.ts package.json package-lock.json scripts/verify-db.mjs .env.example
git commit -m "db: swap Netlify DB adapter for direct Neon connection"
```

---

### Task 2: Mirror the GoTrue claim shape in Supabase custom claims

**Files:**
- Create: `supabase/migrations/0001_custom_access_token_hook.sql`

**Interfaces:**
- Produces: every Supabase-issued JWT carries `app_metadata.role`, `app_metadata.organization_id`, and (when set) `app_metadata.access_expires_at` — the exact shape `netlify/edge-functions/auth.ts` already reads, so Task 4 only swaps the token *source*, not the claim-reading logic.

Supabase already stores `role` / `organization_id` / `access_expires_at` in a user's `raw_app_meta_data` the same way GoTrue's `app_metadata` works (Supabase Auth is a GoTrue fork) — no rewrite of `roleOf()`/`orgOf()`/expiry logic is needed, only where the JWT comes from.

- [ ] **Step 1: Write the migration that ensures `app_metadata` always round-trips onto the access token**

```sql
-- supabase/migrations/0001_custom_access_token_hook.sql
-- Supabase already includes app_metadata in the access token JWT by default;
-- this migration only documents the columns admin writes touch so a reviewer
-- doesn't have to reverse-engineer it. No hook is required because
-- auth.users.raw_app_meta_data -> JWT app_metadata is Supabase's built-in
-- behavior, matching GoTrue's on Netlify.
comment on column auth.users.raw_app_meta_data is
  'CRAFT RBAC claims live here: role, organization_id, access_expires_at (epoch seconds). Written via supabase-js admin.updateUserById(id, { app_metadata }).';
```

- [ ] **Step 2: Apply it**

Run: `npx supabase db push` (with the Supabase CLI logged into the project from Prerequisites step 2)
Expected: migration applies with no errors

- [ ] **Step 3: Manually verify the claim shape**

In the Supabase dashboard, create a test user, then in SQL editor run:
```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role": "assessor", "organization_id": "org_test"}'::jsonb where email = 'test@example.com';
```
Sign in as that user via the Supabase Auth REST API (`POST /auth/v1/token?grant_type=password`) and decode the returned `access_token` JWT at jwt.io — confirm `app_metadata.role` and `app_metadata.organization_id` are present.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_custom_access_token_hook.sql
git commit -m "auth: document RBAC claim shape for Supabase Auth"
```

---

### Task 3: Port server-side auth resolution off `@netlify/identity`

**Files:**
- Create: `api/_lib/auth.ts` (replaces `netlify/lib/auth.ts`)
- Create: `api/_lib/auth.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `db` from `db/index.ts` (Task 1), `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` env vars.
- Produces: `resolveCaller(req: Request): Promise<Caller | null>`, `canAccessOrg(caller, orgId): Promise<boolean>`, `filterAuthorizedOrgIds(caller, ids): Promise<string[]>`, `isSuperAdmin(email): boolean`, `effectiveRole(email, assigned?): string`, `tenantOrgId(email): string`, `unauthorized()`, `forbidden()` — identical names/signatures to the current `netlify/lib/auth.ts` except `resolveCaller` now takes the incoming `Request` (Netlify's `getUser()` read an implicit context; Supabase verification needs the bearer token explicitly).

- [ ] **Step 1: Add the Supabase client, remove `@netlify/identity`**

```bash
npm install @supabase/supabase-js
npm uninstall @netlify/identity
```

- [ ] **Step 2: Write `api/_lib/auth.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { accessGrants, organizations, users } from '../../db/schema.js'

const SUPER_ADMIN_EMAILS = ['fabbiochucho@gmail.com']

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export function isSuperAdmin(email: string): boolean {
  const n = email.trim().toLowerCase()
  return SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === n)
}

export function effectiveRole(email: string, assigned?: string | null): string {
  if (isSuperAdmin(email)) return 'super_admin'
  const role = assigned || 'assessor'
  return role === 'super_admin' ? 'admin' : role
}

export function tenantOrgId(email: string): string {
  return `self_${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
}

export type Caller = { email: string; name: string; orgId: string; role: string }

function bearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization')
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null
}

export async function resolveCaller(req: Request): Promise<Caller | null> {
  const token = bearerToken(req)
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user?.email) return null
  const email = data.user.email.trim().toLowerCase()
  const name = ((data.user.user_metadata?.full_name as string) || email).trim()
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (row && row.orgId) {
    return { email, name, orgId: row.orgId, role: effectiveRole(email, row.role) }
  }
  return { email, name, orgId: tenantOrgId(email), role: effectiveRole(email) }
}

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

export async function canAccessOrg(caller: Caller, orgId: string): Promise<boolean> {
  if (!orgId) return false
  if (caller.role === 'super_admin' || orgId === caller.orgId) return true
  return (await filterAuthorizedOrgIds(caller, [orgId])).length > 0
}

export const unauthorized = () => Response.json({ error: 'Unauthorized' }, { status: 401 })
export const forbidden = () => Response.json({ error: 'Forbidden' }, { status: 403 })
```

- [ ] **Step 3: Write the failing test for the pure logic (role clamping + tenant id — the parts that don't need a live DB/Supabase call)**

```typescript
// api/_lib/auth.test.ts
import { describe, it, expect } from 'vitest'
import { isSuperAdmin, effectiveRole, tenantOrgId } from './auth.js'

describe('isSuperAdmin', () => {
  it('matches the allowlisted email case-insensitively', () => {
    expect(isSuperAdmin('Fabbiochucho@Gmail.com')).toBe(true)
    expect(isSuperAdmin('someone@else.com')).toBe(false)
  })
})

describe('effectiveRole', () => {
  it('always resolves the allowlisted email to super_admin', () => {
    expect(effectiveRole('fabbiochucho@gmail.com', 'assessor')).toBe('super_admin')
  })
  it('clamps a non-allowlisted super_admin assignment down to admin', () => {
    expect(effectiveRole('someone@else.com', 'super_admin')).toBe('admin')
  })
  it('defaults to assessor when no role is assigned', () => {
    expect(effectiveRole('someone@else.com', null)).toBe('assessor')
  })
})

describe('tenantOrgId', () => {
  it('derives a deterministic, slug-safe id from the email', () => {
    expect(tenantOrgId('Jane.Doe+test@Example.com')).toBe('self_jane_doe_test_example_com')
  })
})
```

- [ ] **Step 4: Add vitest and run the test to see it fail (module doesn't exist yet if done out of order; run after Step 2 to confirm it passes instead)**

```bash
npm install -D vitest
```

Run: `npx vitest run api/_lib/auth.test.ts`
Expected: 4 passing tests (this test targets pure functions only — `resolveCaller` needs a running Supabase project + DB and is verified manually in Step 5, not unit tested).

- [ ] **Step 5: Manual verification of `resolveCaller`**

Deploy is not ready yet (Task 10), so verify locally: sign in a test Supabase user via the Auth REST API to get an access token, then in a throwaway Node script call `resolveCaller(new Request('http://x', { headers: { authorization: 'Bearer <token>' } }))` with `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL` set, and confirm it returns the expected `Caller` object (or `null` for a garbage token).

- [ ] **Step 6: Commit**

```bash
git add api/_lib/auth.ts api/_lib/auth.test.ts package.json package-lock.json
git commit -m "auth: replace @netlify/identity resolveCaller with Supabase JWT verification"
```

---

### Task 4: Port edge auth + lang-detect into one Vercel Middleware

**Files:**
- Create: `middleware.ts` (Vercel only runs one middleware file at the project root; the two Netlify edge functions merge into one with a combined matcher)
- Create: `middleware.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `@vercel/functions`'s `geolocation()` (replaces Netlify's `context.geo`).
- Produces: sets `x-craft-org` / `x-craft-role` request headers (read by `presigned-url.mts`/`data-room-upload.mts` in Task 7) and the `craft_lang_hint` cookie; 403s exactly like the current edge function.

- [ ] **Step 1: Install `@vercel/functions`**

```bash
npm install @vercel/functions
```

- [ ] **Step 2: Write `middleware.ts`, combining `auth.ts` + `lang-detect.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { geolocation } from '@vercel/functions'

const SPECIALIZED_READONLY_ROLES = new Set([
  'cbn_examiner', 'frcn_auditor', 'sec_analyst',
  'sharia_board_member', 'rating_agency_analyst', 'eu_csd_assessor',
])

const COUNTRY_LANG: Record<string, string> = {
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', CI: 'fr', SN: 'fr', ML: 'fr', BF: 'fr',
  NE: 'fr', GN: 'fr', TG: 'fr', BJ: 'fr', CM: 'fr', CD: 'fr', CG: 'fr', GA: 'fr',
  TD: 'fr', MG: 'fr', RW: 'fr', BI: 'fr', DJ: 'fr', HT: 'fr',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', CL: 'es', EC: 'es', GT: 'es',
  CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es', CR: 'es',
  PA: 'es', UY: 'es', VE: 'es',
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt', TL: 'pt',
  KE: 'sw', TZ: 'sw', UG: 'sw',
  SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar', DZ: 'ar', TN: 'ar', LY: 'ar', SD: 'ar',
  JO: 'ar', IQ: 'ar', KW: 'ar', QA: 'ar', BH: 'ar', OM: 'ar', YE: 'ar', LB: 'ar',
  SY: 'ar', PS: 'ar',
}

interface JwtClaims {
  app_metadata?: { organization_id?: string; role?: string; roles?: string[]; access_expires_at?: number }
  user_metadata?: { organization_id?: string; role?: string }
  [key: string]: unknown
}

export function decodeJwt(token: string): JwtClaims | null {
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

export function roleOf(claims: JwtClaims): string | undefined {
  return claims.app_metadata?.role || claims.app_metadata?.roles?.[0] || claims.user_metadata?.role || undefined
}

export function orgOf(claims: JwtClaims): string | undefined {
  return claims.app_metadata?.organization_id || claims.user_metadata?.organization_id
}

function readToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  // Supabase's default cookie name for the access token; the client sets this.
  return req.cookies.get('sb-access-token')?.value || null
}

const WORKSPACE_PATHS = ['/dashboard', '/data-room', '/assessment', '/verify', '/compliance', '/regulatory-compliance', '/issb-disclosures', '/finance-triangulation', '/vaults']
const LANG_HINT_PATHS = new Set(['/', '/demo', '/methodology', '/institute', '/open-source', '/contact', '/pre-assessment', '/terms', '/auth'])

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (LANG_HINT_PATHS.has(pathname)) {
    const res = NextResponse.next()
    const country = geolocation(req).country
    const lang = country ? COUNTRY_LANG[country] : undefined
    if (lang && !req.cookies.get('craft_lang_hint')) {
      res.cookies.set('craft_lang_hint', lang, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })
    }
    return res
  }

  if (!WORKSPACE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const token = readToken(req)
  const claims = token ? decodeJwt(token) : null
  const role = claims ? roleOf(claims) : undefined
  const organizationId = claims ? orgOf(claims) : undefined

  if (role && SPECIALIZED_READONLY_ROLES.has(role)) {
    const expiresAt = claims?.app_metadata?.access_expires_at
    const nowSec = Math.floor(Date.now() / 1000)
    if (typeof expiresAt === 'number' && nowSec > expiresAt) {
      return new Response('Forbidden: time-bound access grant has expired.', { status: 403 })
    }
    const method = req.method.toUpperCase()
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      return new Response('Forbidden: specialized ecosystem roles are read-only.', { status: 403 })
    }
  }

  if (pathname.startsWith('/verify') && role && role !== 'independent_assessor') {
    return new Response('Forbidden: independent assessor role required.', { status: 403 })
  }

  const res = NextResponse.next()
  if (organizationId) res.headers.set('x-craft-org', organizationId)
  if (role) res.headers.set('x-craft-role', role)
  return res
}

export const config = {
  matcher: ['/', '/demo', '/methodology', '/institute', '/open-source', '/contact', '/pre-assessment', '/terms', '/auth',
    '/dashboard/:path*', '/data-room/:path*', '/assessment/:path*', '/verify/:path*',
    '/compliance/:path*', '/regulatory-compliance/:path*', '/issb-disclosures/:path*',
    '/finance-triangulation/:path*', '/vaults/:path*'],
}
```

> Note: Vercel Middleware for a non-Next.js Vite project still uses the `next/server` types package (it ships the runtime primitives Vercel's Edge Middleware uses regardless of framework) — confirm this resolves in Task 10's build; if it doesn't, fall back to plain `Request`/`Response` with Vercel's `@vercel/edge` package's `next()` helper instead of `NextResponse`.

- [ ] **Step 3: Write the failing test for the pure claim-decoding logic**

```typescript
// middleware.test.ts
import { describe, it, expect } from 'vitest'
import { decodeJwt, roleOf, orgOf } from './middleware.js'

function fakeJwt(payload: object): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${b64}.signature`
}

describe('decodeJwt / roleOf / orgOf', () => {
  it('extracts role and organization_id from app_metadata', () => {
    const token = fakeJwt({ app_metadata: { role: 'cbn_examiner', organization_id: 'org_1' } })
    const claims = decodeJwt(token)
    expect(roleOf(claims!)).toBe('cbn_examiner')
    expect(orgOf(claims!)).toBe('org_1')
  })
  it('returns null for a malformed token', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull()
  })
})
```

- [ ] **Step 4: Run it**

Run: `npx vitest run middleware.test.ts`
Expected: 2 passing tests

- [ ] **Step 5: Commit**

```bash
git add middleware.ts middleware.test.ts package.json package-lock.json
git commit -m "auth: port Netlify edge auth + lang-detect into Vercel Middleware"
```

---

### Task 5: Port Netlify Identity Admin API calls to Supabase Admin API

**Files:**
- Modify: `netlify/functions/issue-access-grant.mts` → moved to `api/issue-access-grant.ts` in Task 8, but rewritten here first in place so the diff is reviewable on its own
- Modify: `netlify/functions/users.mts` (same note)

**Interfaces:**
- Consumes: `supabaseAdmin` client pattern from Task 3 (`@supabase/supabase-js` with the service role key).
- Produces: same JSON response shapes as today — no client-visible change.

- [ ] **Step 1: Replace `stampIdentityMetadata` in `issue-access-grant.mts`**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function stampIdentityMetadata(grantee: string, role: string, expiresAtSec: number): Promise<boolean> {
  try {
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
    if (listErr) throw listErr
    const user = list.users.find((u) => u.email?.toLowerCase() === grantee)
    if (!user) {
      console.warn(`[issue-access-grant] no Supabase user for ${grantee}`)
      return false
    }
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata ?? {}), role, access_expires_at: expiresAtSec },
    })
    if (updateErr) throw updateErr
    return true
  } catch (err) {
    console.error('[issue-access-grant] Supabase stamp failed', err)
    return false
  }
}
```

(Everything else in this file — the handler body, validation, `accessGrants` insert — is unchanged; only this one function and its imports change. Also update the import at the top of the file from `import type { Config } from '@netlify/functions'` — leave that for Task 8's codemod, since this task is scoped to the identity-admin logic only.)

- [ ] **Step 2: Replace `listIdentityUsers` in `users.mts`**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function listIdentityUsers(): Promise<Array<{ id: string; email: string; name: string }>> {
  const out: Array<{ id: string; email: string; name: string }> = []
  try {
    let page = 1
    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      for (const u of data.users) {
        if (u.email) out.push({ id: u.id, email: u.email, name: (u.user_metadata?.full_name as string) ?? '' })
      }
      if (data.users.length < 200) break
      page++
    }
  } catch (err) {
    console.warn('/api/users: could not list Supabase accounts, returning directory only', err)
  }
  return out
}
```

Also remove the now-unused `import { admin } from '@netlify/identity'` line and the `isSuperAdmin` import path stays the same (now from `../_lib/auth.js` after Task 8 moves it — for now it still points at `../lib/auth.js`, updated in Task 8's codemod).

- [ ] **Step 3: Manual verification**

With `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` set locally, run a throwaway script calling `listIdentityUsers()` against a Supabase project with at least one test user, confirm it returns that user. Same for `stampIdentityMetadata` — call it, then check in the Supabase dashboard (Authentication → Users → the test user → raw `app_metadata`) that `role` and `access_expires_at` were written.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/issue-access-grant.mts netlify/functions/users.mts
git commit -m "auth: replace Netlify Identity Admin API calls with Supabase Admin API"
```

---

### Task 6: Port client-side auth (`IdentityBridge.tsx`, `AuthPage.tsx`) to Supabase

**Files:**
- Modify: `src/components/IdentityBridge.tsx`
- Modify: `src/pages/AuthPage.tsx`
- Create: `src/lib/supabase.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `supabase` client exported from `src/lib/supabase.ts`, used by both files above and by any future client code needing auth.

- [ ] **Step 1: Create the Supabase client**

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

- [ ] **Step 2: Rewrite `IdentityBridge.tsx`'s auth wiring**

Replace the `@netlify/identity` import and the `handleAuthCallback().then(...)` / `getUser().then(sync)` / `onAuthChange(...)` block with:

```typescript
import { supabase } from '../lib/supabase'
// ... existing imports minus '@netlify/identity'

// inside the component, replacing the three calls at the bottom of the effect:
supabase.auth.getSession().then(({ data }) => {
  sync(data.session?.user ?? null)
  if (active) setAuthReady(true)
})
const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => sync(session?.user ?? null))

return () => {
  active = false
  sub.subscription.unsubscribe()
}
```

`sync(user)` currently reads `user.email`, `user.userMetadata?.full_name`, `user.userMetadata?.requested_role`. A Supabase `User` object exposes the same data at `user.email` and `user.user_metadata?.full_name` / `user.user_metadata?.requested_role` (note: `user_metadata`, not `userMetadata` — update those two field accesses inside `sync`). Supabase's client handles the email-confirmation-link URL automatically (`detectSessionInUrl: true` is the default), so the manual `handleAuthCallback()` step is no longer needed — the `getSession()`/`onAuthStateChange` pair above already covers it, including the initial `/dashboard` redirect, which now happens by checking `data.session` in the `getSession().then(...)` callback:

```typescript
supabase.auth.getSession().then(({ data }) => {
  sync(data.session?.user ?? null)
  if (data.session?.user) navigate({ to: '/dashboard' })
  if (active) setAuthReady(true)
})
```

- [ ] **Step 3: Rewrite `AuthPage.tsx`'s `signup`/`login` calls**

Replace:
```typescript
import { signup, login } from '@netlify/identity'
```
with:
```typescript
import { supabase } from '../lib/supabase'
```

Replace the `signup(trimmedEmail, password, {...})` call with:
```typescript
const { data, error } = await supabase.auth.signUp({
  email: trimmedEmail,
  password,
  options: { data: { full_name: fullName, requested_role: requestedRole } },
})
if (error) throw error
const user = data.user
```

Replace `await login(trimmedEmail, password)` with:
```typescript
const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
if (error) throw error
```

- [ ] **Step 4: Install the client library, add env vars**

```bash
npm install @supabase/supabase-js
```

Add to `.env.example`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 5: Manual verification (run dev server locally)**

Run: `npm run dev`, then in the browser: register a new account, confirm the email-confirmation flow lands back on `/dashboard`, sign out, sign back in with the password. Confirm `recordSignIn`/`fetchUserByEmail` calls (unchanged, still hit `/api/users`) still fire in the network tab.

- [ ] **Step 6: Commit**

```bash
git add src/components/IdentityBridge.tsx src/pages/AuthPage.tsx src/lib/supabase.ts package.json package-lock.json .env.example
git commit -m "auth: replace @netlify/identity client SDK with Supabase Auth"
```

---

### Task 7: Replace Netlify Blobs with Vercel Blob

**Files:**
- Create: `api/presigned-url.ts` (replaces `netlify/functions/presigned-url.mts`)
- Create: `api/data-room-upload.ts` (replaces `netlify/functions/data-room-upload.mts`)
- Delete: `netlify/functions/presigned-url.mts`, `netlify/functions/data-room-upload.mts`
- Modify: `package.json`

These two land directly in `api/` rather than being edited in place under `netlify/functions/` and moved later — Task 8's codemod skips them entirely (see its `SKIP` set) since they're already in their final location by the time it runs.

**Interfaces:**
- Produces: same `{ key, uploadUrl, ... }` / `{ key, status, size }` response shapes as today.

Vercel Blob has one flat namespace per project (no per-store isolation like `getStore({name})`), so tenant isolation now comes entirely from the key path already embedding the org slug first (`${orgSlug}/${category}/${stamp}-${fileName}`) — keep that convention exactly, just drop the `data-room-${slug}` store-name wrapper and prefix it into the blob pathname instead.

- [ ] **Step 1: Install `@vercel/blob`, remove `@netlify/blobs`**

```bash
npm install @vercel/blob
npm uninstall @netlify/blobs
```

- [ ] **Step 2: Write `api/presigned-url.ts`**

```typescript
import { put } from '@vercel/blob'

export const config = { runtime: 'edge' }

interface PresignRequest {
  fileName: string
  contentType?: string
  category?: string
  organizationId?: string
}

function slug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'evidence'
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let body: PresignRequest
  try {
    body = (await req.json()) as PresignRequest
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.fileName) return Response.json({ error: 'fileName is required' }, { status: 400 })

  const orgId = req.headers.get('x-craft-org') || body.organizationId || 'unscoped'
  const category = slug(body.category || 'general')
  const stamp = Date.now()
  const key = `data-room/${slug(orgId)}/${category}/${stamp}-${slug(body.fileName)}`

  await put(`${key}.meta.json`, JSON.stringify({
    fileName: body.fileName,
    category: body.category ?? 'general',
    organizationId: orgId,
    status: 'pending',
    reservedAt: new Date(stamp).toISOString(),
  }), { access: 'public', contentType: 'application/json' }).catch((err) => console.error('[presigned-url] blob reserve failed', err))

  return Response.json({
    key,
    organizationId: orgId,
    uploadUrl: `/api/data-room-upload?key=${encodeURIComponent(key)}`,
    contentType: body.contentType ?? 'application/octet-stream',
    expiresInSeconds: 600,
  })
}
```

- [ ] **Step 3: Write `api/data-room-upload.ts`**

```typescript
import { put, head } from '@vercel/blob'

export const config = { runtime: 'edge' }

export default async (req: Request) => {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const key = new URL(req.url).searchParams.get('key')
  if (!key) return Response.json({ error: 'key query parameter is required' }, { status: 400 })

  const metaBlob = await head(`${key}.meta.json`).catch(() => null)
  if (!metaBlob) return Response.json({ error: 'Unknown or expired upload key' }, { status: 404 })
  const meta = await fetch(metaBlob.url).then((r) => r.json()).catch(() => null) as
    | { fileName?: string; category?: string; organizationId?: string }
    | null
  if (!meta) return Response.json({ error: 'Unknown or expired upload key' }, { status: 404 })

  try {
    const buf = await req.arrayBuffer()
    if (!buf.byteLength) return Response.json({ error: 'Empty upload body' }, { status: 400 })
    const contentType = req.headers.get('content-type') || 'application/octet-stream'

    await put(key, buf, { access: 'public', contentType })
    await put(`${key}.meta.json`, JSON.stringify({
      ...meta,
      status: 'uploaded',
      contentType,
      size: buf.byteLength,
      uploadedAt: new Date().toISOString(),
    }), { access: 'public', contentType: 'application/json' })

    return Response.json({ key, status: 'uploaded', size: buf.byteLength }, { status: 201 })
  } catch (err) {
    console.error('[data-room-upload] failed', err)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Delete the originals**

```bash
rm netlify/functions/presigned-url.mts netlify/functions/data-room-upload.mts
```

- [ ] **Step 5: Manual verification**

With `BLOB_READ_WRITE_TOKEN` set locally (from Prerequisites step 4), `curl -X POST localhost:3000/api/presigned-url -d '{"fileName":"test.pdf"}'`, then `curl -X PUT "localhost:3000/api/data-room-upload?key=<key from response>" --data-binary @some-file.pdf`, confirm `{"status":"uploaded",...}` and that the file is visible in the Vercel Blob dashboard under the expected `data-room/<org>/...` path.

- [ ] **Step 6: Commit**

```bash
git add api/presigned-url.ts api/data-room-upload.ts package.json package-lock.json
git add -u netlify/functions/
git commit -m "storage: replace Netlify Blobs with Vercel Blob"
```

---

### Task 8: Codemod — move all remaining functions from `netlify/functions` to `api/`

**Files:**
- Create: `scripts/migrate-functions.mjs`
- Create (by running the script): `api/access-grants.ts`, `api/audit.ts`, `api/capacity-actions.ts`, `api/compliance.ts`, `api/financial-triangulation.ts`, `api/firms.ts`, `api/invitations.ts`, `api/issue-access-grant.ts`, `api/organizations.ts`, `api/portfolios.ts`, `api/questions.ts`, `api/response-notes.ts`, `api/responses.ts`, `api/section11.ts`, `api/seed-db.ts`, `api/send-invite.ts`, `api/users.ts`
- Delete: the 17 `netlify/functions/*.mts` files listed above once their `api/*.ts` counterpart is verified working (`presigned-url.mts`/`data-room-upload.mts` were already moved in Task 7; `compliance-alerts.mts`/`universal-obligations-alerts.mts` move separately in Task 9)
- Delete: `netlify/lib/auth.ts` (superseded by `api/_lib/auth.ts` from Task 3)

**Interfaces:**
- Consumes: `db` (Task 1), `resolveCaller`/`canAccessOrg`/etc. from `api/_lib/auth.js` (Task 3).
- Produces: identical `/api/*` route behavior — every route's request/response contract is unchanged; only the file location, import depth, and the Netlify `Config` export are touched.

All 17 remaining functions share the exact same mechanical transform: Netlify's `netlify/functions/<name>.mts` → Vercel's `api/<name>.ts`; strip the `import type { Config } from '@netlify/functions'` and the trailing `export const config: Config = { path: ... }` block (Vercel infers the route from the file's location under `api/`, matching the `path` value already); switch to Vercel's Edge runtime (works because the only I/O is `fetch`-based: Neon's `neon-http` driver and Supabase's client are both `fetch`-based, so nothing here needs the Node runtime); fix relative import depth (`../../db/index.js` → `../db/index.js`, `../lib/auth.js` → `./_lib/auth.js`, since `api/` sits one directory shallower than `netlify/functions/`). None of these 17 take a second `Context` parameter (only `presigned-url.mts`/`data-room-upload.mts` did, and those are already hand-ported in Task 7). Business logic is untouched in every file — a hand-written diff per file would be identical in shape 17 times over, so a script does it instead of 17 near-duplicate task write-ups.

- [ ] **Step 1: Write the codemod script**

```javascript
// scripts/migrate-functions.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const SRC_DIR = 'netlify/functions'
const DEST_DIR = 'api'
// Already hand-ported: presigned-url/data-room-upload in Task 7 (needed a real
// Netlify Blobs -> Vercel Blob rewrite), the two cron functions in Task 9
// (needed the CRON_SECRET check and a nested api/cron/ destination).
const SKIP = new Set([
  'presigned-url.mts', 'data-room-upload.mts',
  'compliance-alerts.mts', 'universal-obligations-alerts.mts',
])

mkdirSync(DEST_DIR, { recursive: true })

const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.mts') && !SKIP.has(f))

for (const file of files) {
  const src = readFileSync(join(SRC_DIR, file), 'utf8')
  let out = src
    .replace(/^import type \{ ?Config ?(, ?Context)? ?\} from '@netlify\/functions'\n/m, "")
    .replace(/^import type \{ ?Context ?\} from '@netlify\/functions'\n/m, "")
    .replace(/export const config: Config = \{[\s\S]*?\n\}\n?/m, '')
    .replace(/from '\.\.\/\.\.\/db\//g, "from '../db/")
    .replace(/from '\.\.\/lib\/auth\.js'/g, "from './_lib/auth.js'")
  out = `export const config = { runtime: 'edge' }\n\n` + out.trimEnd() + '\n'

  const destName = file.replace(/\.mts$/, '.ts')
  writeFileSync(join(DEST_DIR, destName), out)
  console.log(`Migrated ${file} -> api/${destName}`)
}

console.log(`\nDone. Review each file in ${DEST_DIR}/ before deleting the originals.`)
```

- [ ] **Step 2: Run it**

Run: `node scripts/migrate-functions.mjs`
Expected: `Migrated <name>.mts -> api/<name>.ts` printed 17 times

- [ ] **Step 3: Confirm none of the migrated files were left referencing a second function parameter**

Run: `grep -n "async (req: Request, " api/*.ts`
Expected: no matches (Vercel Edge Functions only pass `(req: Request)`; none of these 17 files ever destructured a second parameter, unlike `presigned-url.mts`/`data-room-upload.mts` which needed the hand-rewrite in Task 7)

- [ ] **Step 4: Move `netlify/lib/auth.ts`'s remaining callers**

Confirm every generated file under `api/` that imports auth helpers now points at `./_lib/auth.js` (the regex in Step 1 handles this); `grep -rn "netlify/lib/auth\|'../lib/auth" api/` should return nothing.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: builds successfully (the `api/` directory isn't part of the Vite client build — this just confirms nothing else in the repo imports the moved files by their old path)

Run: `grep -rn "netlify/functions" src/ db/` (excluding the plan doc and `netlify.toml` itself)
Expected: no matches — nothing in the app source references the old function paths directly (they're all called by URL, e.g. `/api/organizations`, which is unchanged)

- [ ] **Step 6: Delete the old Netlify function files and `netlify/lib/auth.ts`**

```bash
rm netlify/functions/access-grants.mts netlify/functions/audit.mts netlify/functions/capacity-actions.mts \
   netlify/functions/compliance.mts netlify/functions/financial-triangulation.mts netlify/functions/firms.mts \
   netlify/functions/invitations.mts netlify/functions/issue-access-grant.mts netlify/functions/organizations.mts \
   netlify/functions/portfolios.mts netlify/functions/questions.mts netlify/functions/response-notes.mts \
   netlify/functions/responses.mts netlify/functions/section11.mts netlify/functions/seed-db.mts \
   netlify/functions/send-invite.mts netlify/functions/users.mts netlify/lib/auth.ts
rmdir netlify/lib 2>/dev/null || true
```

- [ ] **Step 7: Commit**

```bash
git add api/ scripts/migrate-functions.mjs
git add -u netlify/
git commit -m "functions: migrate all Netlify Functions to Vercel Edge Functions under api/"
```

---

### Task 9: Port scheduled functions to Vercel Cron

**Files:**
- Create: `api/cron/compliance-alerts.ts` (from `netlify/functions/compliance-alerts.mts`)
- Create: `api/cron/universal-obligations-alerts.ts` (from `netlify/functions/universal-obligations-alerts.mts`)
- Create: `vercel.json`
- Delete: `netlify/functions/compliance-alerts.mts`, `netlify/functions/universal-obligations-alerts.mts`

**Interfaces:**
- Produces: `GET /api/cron/compliance-alerts` and `GET /api/cron/universal-obligations-alerts`, both gated on Vercel's `CRON_SECRET` convention (Vercel calls cron endpoints with an `Authorization: Bearer $CRON_SECRET` header automatically when `CRON_SECRET` is set as a project env var).

- [ ] **Step 1: Write `api/cron/compliance-alerts.ts`**

Identical business logic to the current `compliance-alerts.mts`; only the import path, the added `CRON_SECRET` check, and the dropped `Config` export change.

```typescript
import { and, eq, lte, ne } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { complianceItems, organizations } from '../../db/schema.js'

export const config = { runtime: 'edge' }

const MS_DAY = 86_400_000

interface ComplianceItem {
  id: string
  organization_id: string
  type: string
  title: string
  due_date: string
  recipient_email: string
}

type Tier = '90-day' | '30-day' | 'overdue'

function tierFor(daysUntil: number): Tier | null {
  if (daysUntil < 0) return 'overdue'
  if (daysUntil <= 30) return '30-day'
  if (daysUntil <= 90) return '90-day'
  return null
}

function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

async function queryUpcomingComplianceItems(today: Date): Promise<ComplianceItem[]> {
  const horizon = toISO(new Date(today.getTime() + 90 * MS_DAY))
  try {
    const rows = await db
      .select({
        id: complianceItems.id,
        orgId: complianceItems.orgId,
        type: complianceItems.type,
        name: complianceItems.name,
        dueDate: complianceItems.nextDueDate,
        owner: complianceItems.owner,
        orgEmail: organizations.email,
      })
      .from(complianceItems)
      .leftJoin(organizations, eq(complianceItems.orgId, organizations.id))
      .where(and(ne(complianceItems.status, 'submitted'), lte(complianceItems.nextDueDate, horizon)))
    return rows.map((r) => ({
      id: r.id,
      organization_id: r.orgId,
      type: r.type,
      title: r.name,
      due_date: r.dueDate,
      recipient_email: r.orgEmail || r.owner || 'compliance@becomechange.institute',
    }))
  } catch (err) {
    console.error('[compliance-alerts] query failed', err)
    return []
  }
}

async function sendResendEmail(item: ComplianceItem, tier: Tier): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const subjectTier = tier === 'overdue' ? 'OVERDUE' : tier === '30-day' ? 'Urgent (30 days)' : 'Upcoming (90 days)'
  const subject = `[${subjectTier}] ${item.type} due ${item.due_date}: ${item.title}`

  if (!apiKey) {
    console.log(`[compliance-alerts] would email ${item.recipient_email} — ${subject}`)
    return
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: 'CRAFT Compliance <compliance@becomechange.institute>',
      to: item.recipient_email,
      subject,
      text:
        `This is an automated CRAFT reminder for a Global Fund reporting obligation.\n\n` +
        `Obligation: ${item.type} — ${item.title}\nDue: ${item.due_date}\nStatus: ${tier}\n\n` +
        `Please prepare and submit the report through your CRAFT secure workspace.`,
    }),
  }).catch(err => console.error('[compliance-alerts] Resend error', err))
}

export default async function handler(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const today = new Date()
  const items = await queryUpcomingComplianceItems(today)
  let sent = 0
  for (const item of items) {
    const daysUntil = Math.floor((Date.parse(item.due_date) - today.getTime()) / MS_DAY)
    const tier = tierFor(daysUntil)
    if (tier) {
      await sendResendEmail(item, tier)
      sent += 1
    }
  }

  console.log(`[compliance-alerts] processed ${items.length} items, sent ${sent} alerts.`)
  return Response.json({ processed: items.length, sent })
}
```

- [ ] **Step 2: Write `api/cron/universal-obligations-alerts.ts`**

Identical business logic to the current `universal-obligations-alerts.mts`; same `CRON_SECRET` check added, no `db` dependency in this one.

```typescript
export const config = { runtime: 'edge' }

const MS_DAY = 86_400_000

type Tier = '90-day' | '30-day' | 'overdue'

interface RegulatoryObligation {
  code: string
  authority: string
  title: string
  citation: string
  cadence: 'annual' | 'quarterly' | 'monthly' | 'event-driven'
  anchor?: { month?: number; day: number }
  note?: string
}

const REGULATORY_CALENDAR: RegulatoryObligation[] = [
  { code: 'CBN-MPR', authority: 'CBN', title: 'Monthly prudential returns', citation: 'CBN Prudential Guidelines', cadence: 'monthly', anchor: { day: 10 } },
  { code: 'CBN-QPR', authority: 'CBN', title: 'Quarterly prudential returns', citation: 'CBN Prudential Guidelines', cadence: 'quarterly', anchor: { day: 15 } },
  { code: 'FRCN-LEVY', authority: 'FRCN', title: 'Annual FRCN dues / levy', citation: 'FRC of Nigeria Act 2011', cadence: 'annual', anchor: { month: 6, day: 30 } },
  { code: 'NG-AUDIT-ROT', authority: 'FRCN', title: 'Statutory audit firm rotation review (10-year max)', citation: 'NCCG 2018 §Audit', cadence: 'annual', anchor: { month: 12, day: 31 }, note: 'External audit firm tenure must not exceed 10 years.' },
  { code: 'SEC-NG-FILING', authority: 'SEC Nigeria', title: 'Annual issuer disclosure filing', citation: 'ISA 2007', cadence: 'annual', anchor: { month: 3, day: 31 } },
  { code: 'US-SOX-CERT', authority: 'SEC', title: 'SOX §302/§404 certification (10-K)', citation: 'Sarbanes-Oxley Act 2002', cadence: 'annual', anchor: { month: 3, day: 1 } },
  { code: 'EU-CSRD', authority: 'European Commission', title: 'CSRD / ESRS sustainability report', citation: 'Directive (EU) 2022/2464', cadence: 'annual', anchor: { month: 4, day: 30 } },
  { code: 'EU-BASEL-REP', authority: 'EBA', title: 'Basel III COREP/FINREP reporting', citation: 'CRR / Basel III', cadence: 'quarterly', anchor: { day: 12 } },
  { code: 'GCC-ZAKAT', authority: 'ZATCA', title: 'Zakat calculation & remittance', citation: 'GCC Zakat regulations', cadence: 'annual', anchor: { month: 4, day: 30 } },
  { code: 'OHADA-FILING', authority: 'OHADA', title: 'OHADA annual financial statement filing', citation: 'AUDCIF SYSCOHADA', cadence: 'annual', anchor: { month: 7, day: 31 } },
  { code: 'GDPR-BREACH', authority: 'EDPB / NDPC', title: 'Personal-data breach reporting window', citation: 'GDPR Art.33 / NDPA 2023', cadence: 'event-driven', note: '72-hour breach-notification window once an incident is detected.' },
]

function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function tierFor(daysUntil: number): Tier | null {
  if (daysUntil < 0 && daysUntil >= -30) return 'overdue'
  if (daysUntil >= 0 && daysUntil <= 30) return '30-day'
  if (daysUntil > 30 && daysUntil <= 90) return '90-day'
  return null
}

function nextOccurrence(ob: RegulatoryObligation, today: Date): string | null {
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()
  if (ob.cadence === 'annual' && ob.anchor?.month) {
    let next = new Date(y, ob.anchor.month - 1, ob.anchor.day)
    if (next.getTime() < new Date(y, m, d).getTime()) next = new Date(y + 1, ob.anchor.month - 1, ob.anchor.day)
    return toISO(next)
  }
  if (ob.cadence === 'quarterly' && ob.anchor) {
    const quarterEndMonths = [2, 5, 8, 11]
    for (const qm of quarterEndMonths) {
      const cand = new Date(y, qm, ob.anchor.day)
      if (cand.getTime() >= new Date(y, m, d).getTime()) return toISO(cand)
    }
    return toISO(new Date(y + 1, 2, ob.anchor.day))
  }
  if (ob.cadence === 'monthly' && ob.anchor) {
    let cand = new Date(y, m, ob.anchor.day)
    if (cand.getTime() < new Date(y, m, d).getTime()) cand = new Date(y, m + 1, ob.anchor.day)
    return toISO(cand)
  }
  return null
}

async function sendResendEmail(ob: RegulatoryObligation, dueISO: string, tier: Tier): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const cco = process.env.CCO_EMAIL || 'compliance@becomechange.institute'
  const cfo = process.env.CFO_EMAIL || 'finance@becomechange.institute'
  const subjectTier = tier === 'overdue' ? 'OVERDUE' : tier === '30-day' ? 'Urgent (30 days)' : 'Upcoming (90 days)'
  const subject = `[${subjectTier}] ${ob.authority} — ${ob.title} due ${dueISO}`

  if (!apiKey) {
    console.log(`[universal-obligations-alerts] would email ${cco}, ${cfo} — ${subject}`)
    return
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: 'CRAFT Regulatory <compliance@becomechange.institute>',
      to: [cco, cfo],
      subject,
      text:
        `Automated CRAFT global regulatory reminder.\n\n` +
        `Obligation: ${ob.title}\nAuthority: ${ob.authority}\nCitation: ${ob.citation}\n` +
        `Due: ${dueISO}\nStatus: ${tier}\n` +
        (ob.note ? `Note: ${ob.note}\n` : '') +
        `\nAction the filing through your CRAFT secure workspace.`,
    }),
  }).catch(err => console.error('[universal-obligations-alerts] Resend error', err))
}

export default async function handler(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const today = new Date()
  let sent = 0
  let evaluated = 0

  for (const ob of REGULATORY_CALENDAR) {
    if (ob.cadence === 'event-driven') continue
    const dueISO = nextOccurrence(ob, today)
    if (!dueISO) continue
    evaluated += 1
    const daysUntil = Math.floor((Date.parse(dueISO) - today.getTime()) / MS_DAY)
    const tier = tierFor(daysUntil)
    if (tier) {
      await sendResendEmail(ob, dueISO, tier)
      sent += 1
    }
  }

  console.log(`[universal-obligations-alerts] evaluated ${evaluated} obligations, sent ${sent} alerts.`)
  return Response.json({ evaluated, sent })
}
```

- [ ] **Step 3: Add the cron schedule to `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/compliance-alerts", "schedule": "0 6 * * *" },
    { "path": "/api/cron/universal-obligations-alerts", "schedule": "0 6 * * *" }
  ]
}
```

(Netlify's `@daily` maps to a fixed UTC time on Vercel's cron syntax — `0 6 * * *` runs once a day at 06:00 UTC; adjust the hour if the alerts need to land at a specific local time.)

- [ ] **Step 4: Delete the originals**

```bash
rm netlify/functions/compliance-alerts.mts netlify/functions/universal-obligations-alerts.mts
```

- [ ] **Step 5: Manual verification (after Task 10's deploy exists)**

`curl -H "Authorization: Bearer $CRON_SECRET" https://<preview-url>/api/cron/compliance-alerts` and confirm a 200 with the same log/email-dispatch behavior as today (check Vercel function logs for the "would send" lines when `RESEND_API_KEY` isn't set in preview). Also confirm `curl https://<preview-url>/api/cron/compliance-alerts` **without** the header returns 401.

- [ ] **Step 6: Commit**

```bash
git add api/cron/ vercel.json
git add -u netlify/functions/
git commit -m "cron: migrate scheduled functions to Vercel Cron"
```

---

### Task 10: Deploy to Vercel and smoke-test the preview

**Files:**
- Modify: `netlify.toml` → delete (no longer needed)
- Create/modify: `vercel.json` (extend the one from Task 9 with build settings)
- Create: `scripts/smoke-test.mjs`

- [ ] **Step 1: Extend `vercel.json` with build config**

```json
{
  "buildCommand": "vite build",
  "outputDirectory": "dist/client",
  "crons": [
    { "path": "/api/cron/compliance-alerts", "schedule": "0 6 * * *" },
    { "path": "/api/cron/universal-obligations-alerts", "schedule": "0 6 * * *" }
  ]
}
```

- [ ] **Step 2: Delete `netlify.toml`**

```bash
rm netlify.toml
```

- [ ] **Step 3: In the Vercel dashboard, set all required environment variables on the project**

`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `BLOB_READ_WRITE_TOKEN` (Vercel sets this automatically once the Blob store from Prerequisites step 4 is linked), `CRON_SECRET` (generate one: `openssl rand -hex 32`), `RESEND_API_KEY`, `INVITE_FROM_EMAIL`, `CCO_EMAIL`, `CFO_EMAIL` — copy the last four from the current Netlify site's environment variables (Netlify dashboard → Site configuration → Environment variables).

- [ ] **Step 4: Push the branch and let Vercel build a preview deployment**

```bash
git push -u origin <branch-name>
```

Wait for the Vercel preview URL to appear (in the GitHub PR checks or the Vercel dashboard).

- [ ] **Step 5: Write and run the smoke test against the preview URL**

```javascript
// scripts/smoke-test.mjs
const base = process.argv[2]
if (!base) {
  console.error('Usage: node scripts/smoke-test.mjs <preview-url>')
  process.exit(1)
}

const checks = [
  { path: '/', expect: 200 },
  { path: '/api/questions', expect: 200 },
  { path: '/api/organizations', expect: 401 }, // no auth header -> resolveCaller returns null
  { path: '/api/cron/compliance-alerts', expect: 401 }, // no CRON_SECRET header
]

let failed = false
for (const { path, expect } of checks) {
  const res = await fetch(`${base}${path}`)
  const ok = res.status === expect
  console.log(`${ok ? 'PASS' : 'FAIL'} ${path} -> ${res.status} (expected ${expect})`)
  if (!ok) failed = true
}
process.exit(failed ? 1 : 0)
```

Run: `node scripts/smoke-test.mjs https://<preview-url>`
Expected: 4 `PASS` lines

- [ ] **Step 6: Manual verification of the full auth + workspace flow on the preview URL**

Register a new account, confirm the email, sign in, create an organization, run through one assessment tier, upload a Data Room document, confirm it appears with `status: uploaded`. Sign in as the Super Admin email and confirm the Admin page loads the user directory (proves the Supabase `listIdentityUsers` port from Task 5 works end to end).

- [ ] **Step 7: Commit**

```bash
git add vercel.json scripts/smoke-test.mjs
git rm netlify.toml
git commit -m "deploy: switch build/deploy config from Netlify to Vercel"
```

---

### Task 11: DNS cutover and Netlify decommission

**Files:** none (infrastructure-only task)

- [ ] **Step 1: Merge the migration branch and promote the Vercel deployment to production**

In the Vercel dashboard, promote the latest build on `main` to Production (or deploy `main` directly if Vercel auto-deploys on merge).

- [ ] **Step 2: Add the custom domain in Vercel**

Vercel project → **Settings → Domains** → add `craftframework.becomechange.institute`. Vercel will show the exact DNS target (typically a CNAME to `cname.vercel-dns.com`).

- [ ] **Step 3: Update DNS**

In your DNS provider for `becomechange.institute`, change the existing `craftframework` CNAME record from `craftframework.netlify.app` to the target Vercel gave in Step 2.

- [ ] **Step 4: Verify propagation and certificate issuance**

Run: `nslookup craftframework.becomechange.institute` — expect it to resolve to Vercel's infrastructure, not Netlify's.
Run: `curl -I https://craftframework.becomechange.institute` — expect `200` with no certificate error (Vercel auto-issues a certificate once DNS verifies, usually within minutes).

- [ ] **Step 5: Re-run the smoke test and manual flow from Task 10 against the live domain**

```bash
node scripts/smoke-test.mjs https://craftframework.becomechange.institute
```

Then repeat Task 10 Step 6's manual walkthrough on the real domain.

- [ ] **Step 6: Decommission Netlify**

Once the live domain has run cleanly on Vercel for a few days: in the Netlify dashboard, remove the `craftframework.becomechange.institute` custom domain from the Netlify site (so Netlify stops trying to renew a certificate for a hostname it no longer serves), then delete or archive the Netlify site itself. Cancel the Netlify DB / any paid add-ons tied to it once you've confirmed the Neon connection from Task 1 is independent of Netlify's management of that database (Prerequisites step 1 already got you a direct connection string — confirm in the Neon/Netlify dashboard that the database is not scheduled for deletion when the Netlify site is removed; if Netlify DB only "unlinks" rather than deletes, this is safe, but verify before deleting the Netlify site).
