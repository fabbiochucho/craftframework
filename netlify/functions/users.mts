import type { Config } from '@netlify/functions'
import { asc, eq, sql } from 'drizzle-orm'
import { admin } from '@netlify/identity'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'
import type { UserRow } from '../../db/schema.js'
import { isSuperAdmin } from '../lib/auth.js'

// The platform `super_admin` (Super Admin) tier is reserved for the single
// allowlisted operator. Nobody else can be persisted with it: a request
// assigning `super_admin` to any other email is clamped to `admin` (the highest
// assignable role), so the directory can never mint a second Super Admin. The
// ordinary `admin` (Administrator) tier is freely assignable to anyone.
function clampRole(email: string, requested: string): string {
  const role = requested.trim() || 'assessor'
  if (role === 'super_admin' && !isSuperAdmin(email)) return 'admin'
  return role
}

// Pull EVERY registered Netlify Identity account, not just the ones we've written
// a directory row for. A person exists in Identity the moment they sign up (and
// confirm their email), but our `users` table only gains a row once they sign in
// (see IdentityBridge.recordSignIn) or an admin assigns them. That gap means a
// self-registrant who hasn't yet signed into the app is invisible to the Super
// Admin — so the admin can't place them. Merging the Identity roster in closes
// the gap: registration alone is enough to appear in the directory.
//
// Server-only (needs the operator token, injected by the Netlify runtime). It is
// paginated, so we page until a short/empty page. Any failure — Identity not
// enabled, no operator token (e.g. under `netlify dev`), transient error — is
// swallowed so the directory still returns the database rows.
async function listIdentityUsers(): Promise<Array<{ id: string; email: string; name: string }>> {
  const out: Array<{ id: string; email: string; name: string }> = []
  const perPage = 200
  try {
    for (let page = 1; page <= 50; page++) {
      const batch = await admin.listUsers({ page, perPage })
      for (const u of batch) {
        if (u.email) out.push({ id: u.id, email: u.email, name: u.name ?? '' })
      }
      if (batch.length < perPage) break
    }
  } catch (err) {
    console.warn('/api/users: could not list Identity accounts, returning directory only', err)
  }
  return out
}

// A UserDirectoryRow-shaped stand-in for a registered Identity account that has
// no database row yet: unassigned (no org, no scope) and never seen in-app. When
// the admin assigns it, upsertUser writes a real row keyed on the email.
function unassignedRowFor(u: { id: string; email: string; name: string }): UserRow {
  return {
    id: u.id,
    email: u.email.trim().toLowerCase(),
    name: u.name,
    title: '',
    orgId: null,
    role: 'assessor',
    scopeId: null,
    scopeLabel: '',
    portfolioId: null,
    status: 'active',
    invitedAt: null,
    createdAt: null,
    lastSeenAt: null,
  }
}

// /api/users — the user directory. This is the backend "who is who" table that
// maps a person (by email) to the organisation they belong to and the role
// (view level) they hold. Sign-in consults it so that a user's org_id and role
// are ASSIGNED here, not derived from their email address. The Super Admin
// portal writes to it to onboard staff and consultants onto a shared tenant.
export default async (req: Request) => {
  try {
    if (req.method === 'GET') {
      const email = new URL(req.url).searchParams.get('email')
      if (email) {
        // Directory lookup used by sign-in: resolve one person to their row.
        const [row] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.trim().toLowerCase()))
          .limit(1)
        return Response.json(row ?? null)
      }
      // No email → the full directory for the admin management screen. Union the
      // database rows (which carry each admin's role/org assignments) with every
      // registered Identity account, so a person who signed up but hasn't signed
      // into the app yet still shows up as an assignable, unassigned entry. The
      // database row always wins on a shared email — an admin's assignment is
      // never masked by the Identity placeholder.
      const rows = await db.select().from(users).orderBy(asc(users.email))
      const known = new Set(rows.map(r => r.email.toLowerCase()))
      const identityUsers = await listIdentityUsers()
      const extras = identityUsers
        .filter(u => !known.has(u.email.trim().toLowerCase()))
        .map(unassignedRowFor)
      return Response.json([...rows, ...extras])
    }

    // POST — upsert one person (create or edit). Keyed on the unique email so
    // re-inviting the same address updates the existing row rather than
    // duplicating it. Only the supplied keys are written.
    if (req.method === 'POST') {
      const body = await req.json()
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!email) return Response.json({ error: 'email required' }, { status: 400 })

      // Sign-in "touch": every time a person authenticates the IdentityBridge
      // records it here so the Super Admin directory lists EVERYONE who has ever
      // signed in — not only staff an admin has explicitly assigned. This must
      // never overwrite an admin's assignment, so on an existing row it updates
      // only last_seen_at (and backfills a blank name); a brand-new signer is
      // inserted as an unassigned, active person the admin can then place.
      if (body.touch) {
        const now = new Date()
        const id: string = body.id?.trim() || `usr_${crypto.randomUUID()}`
        const [row] = await db
          .insert(users)
          .values({
            id,
            email,
            name: String(body.name ?? '').trim(),
            role: clampRole(email, String(body.role ?? 'assessor')),
            status: 'active',
            lastSeenAt: now,
          })
          .onConflictDoUpdate({
            target: users.email,
            set: {
              lastSeenAt: now,
              // Only fill in a name the admin hasn't set; never clobber it.
              name: sql`case when ${users.name} = '' then ${String(body.name ?? '').trim()} else ${users.name} end`,
            },
          })
          .returning()
        return Response.json(row, { status: 201 })
      }

      const id: string = body.id?.trim() || `usr_${crypto.randomUUID()}`
      const role = clampRole(email, String(body.role ?? 'assessor'))
      const status = String(body.status ?? 'active').trim() || 'active'

      const [row] = await db
        .insert(users)
        .values({
          id,
          email,
          name: String(body.name ?? '').trim(),
          title: String(body.title ?? '').trim(),
          orgId: body.orgId ?? null,
          role,
          scopeId: body.scopeId ?? null,
          scopeLabel: String(body.scopeLabel ?? '').trim(),
          portfolioId: body.portfolioId ?? null,
          status,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            name: String(body.name ?? '').trim(),
            title: String(body.title ?? '').trim(),
            orgId: body.orgId ?? null,
            role,
            scopeId: body.scopeId ?? null,
            scopeLabel: String(body.scopeLabel ?? '').trim(),
            portfolioId: body.portfolioId ?? null,
            status,
          },
        })
        .returning()
      return Response.json(row, { status: 201 })
    }

    // DELETE — revoke a person's directory entry (by email or id).
    if (req.method === 'DELETE') {
      const url = new URL(req.url)
      const email = url.searchParams.get('email')
      const id = url.searchParams.get('id')
      if (!email && !id) return Response.json({ error: 'email or id required' }, { status: 400 })
      await db
        .delete(users)
        .where(email ? eq(users.email, email.trim().toLowerCase()) : eq(users.id, id!))
      return Response.json({ ok: true })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    console.error('/api/users failed', err)
    return Response.json({ error: 'User request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/users',
}
