import type { Config } from '@netlify/functions'
import { getUser } from '@netlify/identity'
import { and, asc, eq, or } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { responseNotes, users } from '../../db/schema.js'
import { logger } from '../lib/logger.js'

// ============================================================================
// /api/response-notes — threaded, multi-author rationale on assessment answers.
// ----------------------------------------------------------------------------
// This endpoint NEVER trusts the client about who is asking. The caller's
// identity, organization and role are derived from the VERIFIED Netlify Identity
// session (the signed `nf_jwt` cookie), then three boundaries are enforced on
// every request:
//
//   1. Organization — a caller may only read/write notes for their own tenant.
//   2. Author ownership — a note's author is the verified caller, never the body.
//   3. Read filtering — a read returns the caller's own notes plus notes that
//      were explicitly shared. Belonging to the same org is not enough. Admins
//      are the one explicit, server-enforced exception and see all org notes.
// ============================================================================

const SUPER_ADMIN_EMAILS = ['fabbiochucho@gmail.com']

function isSuperAdmin(email: string): boolean {
  const n = email.trim().toLowerCase()
  return SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === n)
}

// Mirror of src/lib/api.ts `tenantOrgId` + the IdentityBridge fallback, so the
// org we scope to on the server matches the one the client signed in with when a
// self-registrant has no assigned directory row.
function tenantOrgId(email: string): string {
  return `self_${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
}

function stamp(d: Date | null): string {
  const t = d ?? new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`
}

type Caller = { email: string; name: string; orgId: string; role: string }

// Resolve the verified caller. Returns null when there is no valid Identity
// session — the client helper then degrades to an empty thread. Org + role are
// read from the user directory (assigned by an admin), exactly as sign-in does;
// a self-registrant with no row falls back to their isolated per-email tenant.
async function resolveCaller(): Promise<Caller | null> {
  const user = await getUser()
  if (!user?.email) return null
  const email = user.email.trim().toLowerCase()
  const name = ((user.userMetadata?.full_name as string) || user.name || email).trim()
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (row && row.orgId) {
    return { email, name, orgId: row.orgId, role: row.role || 'assessor' }
  }
  return { email, name, orgId: tenantOrgId(email), role: isSuperAdmin(email) ? 'super_admin' : 'assessor' }
}

function serialize(r: typeof responseNotes.$inferSelect) {
  return {
    id: r.id,
    questionId: r.questionId,
    authorEmail: r.authorEmail,
    authorName: r.authorName,
    authorRole: r.authorRole,
    body: r.body,
    visibility: r.visibility,
    createdAt: stamp(r.createdAt),
  }
}

export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (req.method === 'GET') {
      const params = new URL(req.url).searchParams
      const orgId = params.get('orgId')
      const questionId = params.get('questionId')
      if (!orgId) return Response.json({ error: 'orgId required' }, { status: 400 })
      // Boundary 1: only your own tenant. This also makes the guessable
      // `self_<email>` org ids harmless — org identity comes from the token.
      if (orgId !== caller.orgId) return Response.json({ error: 'Forbidden' }, { status: 403 })

      const scope = questionId
        ? and(eq(responseNotes.orgId, orgId), eq(responseNotes.questionId, questionId))
        : eq(responseNotes.orgId, orgId)
      // Boundary 3: own notes + shared notes; the platform Super Admin sees
      // everything in the org.
      const where =
        caller.role === 'super_admin'
          ? scope
          : and(scope, or(eq(responseNotes.authorEmail, caller.email), eq(responseNotes.visibility, 'shared')))

      const rows = await db.select().from(responseNotes).where(where).orderBy(asc(responseNotes.id))
      return Response.json(rows.map(serialize))
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const orgId = String(body.orgId ?? '')
      const questionId = String(body.questionId ?? '')
      const text = String(body.body ?? '').trim()
      const visibility = body.visibility === 'shared' ? 'shared' : 'private'
      if (!orgId || !questionId) return Response.json({ error: 'orgId and questionId required' }, { status: 400 })
      if (!text) return Response.json({ error: 'body required' }, { status: 400 })
      // Boundary 1 on write too.
      if (orgId !== caller.orgId) return Response.json({ error: 'Forbidden' }, { status: 403 })

      // Boundary 2: the author is ALWAYS the verified caller, never the request,
      // so no one can post a note under someone else's name.
      const [row] = await db
        .insert(responseNotes)
        .values({
          orgId,
          questionId,
          authorEmail: caller.email,
          authorName: caller.name,
          authorRole: caller.role,
          body: text,
          visibility,
        })
        .returning()
      return Response.json(serialize(row), { status: 201 })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error("/api/response-notes", "failed", err)
    return Response.json({ error: 'Response notes request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/response-notes',
}
