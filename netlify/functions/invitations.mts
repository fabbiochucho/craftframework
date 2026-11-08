import type { Config } from '@netlify/functions'
import { and, desc, eq, gt } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { invitations, users } from '../../db/schema.js'
import { resolveCaller, forbidden, unauthorized, mfaRequired } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { clientIp, overLimit } from '../lib/public-rate-limit.js'
import {
  acceptInvitation, audit, dispatchInvitationEmail, insertInvitation, invitationPurpose, inviteOrganization, MEMBER_INVITE_DAYS,
  memberInviteProblem, portfolioManagedBy, renderInvitationEmail,
} from '../lib/invitations.js'
import { parseOrgType } from '../../src/lib/orgType.js'

// No control characters (incl. newlines/tabs) in a name; the note may contain
// ordinary line breaks and tabs but no other control characters.
const NAME_CTRL = /[\u0000-\u001f\u007f-\u009f]/
const NOTE_CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/
export const inviteeNameSchema = z.string().trim().max(120).refine((v) => !NAME_CTRL.test(v), 'inviteeName must not contain control characters')
export const inviteMessageSchema = z.string().trim().max(4000).refine((v) => !NOTE_CTRL.test(v), 'message must not contain control characters')
const orgNameSchema = z.string().trim().min(2, 'Enter the organisation name').max(200).refine((v) => !NAME_CTRL.test(v), 'The organisation name must not contain control characters')
const createSchema = z.object({
  kind: z.enum(['member', 'organization']).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(320),
  inviteeName: inviteeNameSchema.nullish(),
  message: inviteMessageSchema.nullish(),
  // member
  orgId: z.string().trim().max(200).nullish(),
  role: z.string().trim().max(40).nullish(),
  portfolioId: z.string().trim().max(200).nullish(),
  scopeLabel: z.string().trim().max(300).nullish(),
  // organization
  orgName: orgNameSchema.nullish(),
  orgArchetype: z.string().trim().max(40).nullish(),
  orgSector: z.string().trim().max(80).nullish(),
  orgCountry: z.string().trim().max(8).nullish(),
  // Send the email now (the client used to call /api/send-invite separately). Organisation invitations
  // default to sending; send: false holds them as drafts to send later.
  send: z.boolean().optional(),
  // Super Admin: invite in someone else's name (they become the inviter; replies go to them).
  onBehalfOf: z.string().trim().toLowerCase().email().max(320).nullish(),
  // organization: 'independent_assessor' names the inviter the organisation's independent assessor.
  grantRole: z.enum(['independent_assessor']).nullish(),
})
const acceptSchema = z.object({ token: z.string().min(8).max(100), orgName: z.string().trim().max(200).optional() })

// /api/invitations — tokenised invitations by email (netlify/lib/invitations.ts).
//   GET  ?token=           the invitation behind an accept link (no session: the token is the capability)
//   GET  ?inviter=<me>     invitations I sent (Super Admin: anyone's, or all with no param)
//   POST                   create { kind: 'member' | 'organization', email, ... } (+ send: true to email it now)
//   POST /accept           { token, orgName? } accept as the signed-in invitee (email must match)
//   PATCH                  { token, status: 'revoked' } the invitee declines
// Token paths are unauthenticated, so they are capped per IP.
export const TOKEN_LIMIT_PER_MINUTE = 30
const tooMany = () => Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'retry-after': '60' } })
const bad = (error: string) => Response.json({ error }, { status: 400 })

const handleRequest = async (req: Request) => {
  try {
    const url = new URL(req.url)
    const sub = url.pathname.replace(/^\/api\/invitations\/?/, '')

    if (sub === 'accept') {
      if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
      if (await overLimit(`invitation-token:${clientIp(req)}`, TOKEN_LIMIT_PER_MINUTE)) return tooMany()
      const caller = await resolveCaller()
      if (!caller) return unauthorized()
      const mfaBlock = await mfaRequired(req, caller)
      if (mfaBlock) return mfaBlock
      const p = acceptSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return bad('token required')
      const out = await acceptInvitation(caller, p.data.token, p.data.orgName)
      return Response.json(out.body, { status: out.status })
    }
    if (sub) return new Response('Not Found', { status: 404 })

    if (req.method === 'GET') {
      const params = url.searchParams
      const token = params.get('token')
      const inviter = params.get('inviter')
      // A lookup by token is a capability check (the token itself is the secret,
      // needed by a not-yet-signed-in invitee following the accept link) — no
      // session required. Every other GET shape needs an authenticated caller.
      if (token) {
        if (await overLimit(`invitation-token:${clientIp(req)}`, TOKEN_LIMIT_PER_MINUTE)) return tooMany()
        const [row] = await db.select().from(invitations).where(eq(invitations.token, token))
        if (!row) return Response.json(null)
        const expired = row.expiresAt ? new Date(row.expiresAt).getTime() < Date.now() : false
        const status = expired && row.status === 'pending' ? 'expired' : row.status
        return Response.json({
          id: row.id,
          token: row.token,
          email: row.email,
          inviter: row.inviter ?? undefined,
          inviterName: row.inviterName ?? undefined,
          portfolioId: row.portfolioId ?? undefined,
          role: row.role,
          scopeLabel: row.scopeLabel,
          message: row.message ?? undefined,
          kind: row.kind,
          orgName: row.orgName ?? undefined,
          purpose: row.kind === 'organization' && status === 'pending' ? await invitationPurpose(row) : undefined,
          status,
        })
      }
      const caller = await resolveCaller()
      if (!caller) return unauthorized()
      const mfaBlock = await mfaRequired(req, caller)
      if (mfaBlock) return mfaBlock
      // ?preview=<id>: the email exactly as it will be sent, for review before sending.
      const preview = params.get('preview')
      if (preview) {
        const [row] = await db.select().from(invitations).where(eq(invitations.id, preview))
        if (!row) return Response.json({ error: 'Not found' }, { status: 404 })
        if (caller.role !== 'super_admin' && caller.email !== row.inviter && caller.email !== row.createdBy) return forbidden()
        const { subject, html, replyTo, to } = await renderInvitationEmail(row, caller.email)
        return Response.json({ subject, html, replyTo, to })
      }
      if (inviter) {
        const target = inviter.trim().toLowerCase()
        if (target !== caller.email && caller.role !== 'super_admin') return forbidden()
      } else if (caller.role !== 'super_admin') {
        return forbidden()
      }
      const rows = inviter
        ? await db.select().from(invitations).where(eq(invitations.inviter, inviter.trim().toLowerCase())).orderBy(desc(invitations.createdAt))
        : await db.select().from(invitations).orderBy(desc(invitations.createdAt))
      const now = Date.now()
      return Response.json(
        rows.map((r) => ({
          id: r.id,
          email: r.email,
          inviter: r.inviter ?? undefined,
          inviteeName: r.inviteeName ?? undefined,
          portfolioId: r.portfolioId ?? undefined,
          role: r.role,
          scopeLabel: r.scopeLabel,
          kind: r.kind,
          orgId: r.orgId ?? undefined,
          orgName: r.orgName ?? undefined,
          link: r.engagement ? 'engagement' : r.networkNodeId ? 'network' : r.portfolioId ? 'portfolio' : r.grantRole ? r.grantRole : undefined,
          sentAt: r.sentAt ?? undefined,
          sentBy: r.sentBy ?? undefined,
          deliveryStatus: r.deliveryStatus ?? undefined,
          deliveryAt: r.deliveryAt ?? undefined,
          respondedAt: r.respondedAt ?? undefined,
          createdBy: r.createdBy ?? undefined,
          message: r.message ?? undefined,
          acceptedOrgId: r.acceptedOrgId ?? undefined,
          createdAt: r.createdAt,
          status: r.status === 'pending' && r.expiresAt && new Date(r.expiresAt).getTime() < now ? 'expired' : r.status,
        })),
      )
    }

    // POST — create an invitation; with `send: true` the email goes out too.
    if (req.method === 'POST') {
      const caller = await resolveCaller()
      if (!caller) return unauthorized()
      const mfaBlock = await mfaRequired(req, caller)
      if (mfaBlock) return mfaBlock
      if (caller.readOnly) return forbidden()
      const parsed = createSchema.safeParse(await req.json().catch(() => null))
      if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Invalid invitation')
      const d = parsed.data

      if (d.kind === 'organization') {
        if (!d.orgName) return bad('Enter the organisation name')
        const orgType = parseOrgType({ archetype: d.orgArchetype, sector: d.orgSector, country: d.orgCountry })
        if (orgType === 'invalid') return bad('Choose the organisation type from the list')
        // Portfolio managers link the new organisation to their portfolio; otherwise only an
        // administrator (who then gets read-only access the organisation can revoke) may invite.
        // In someone else's name: Super Admin only. The person becomes the inviter (independent
        // assessors are given the independent assessor role so they can score once organisations accept).
        let onBehalfOf: { email: string; name: string } | null = null
        if (d.onBehalfOf && d.onBehalfOf !== caller.email) {
          if (caller.role !== 'super_admin') return forbidden()
          const [person] = await db.select().from(users).where(eq(users.email, d.onBehalfOf))
          onBehalfOf = { email: d.onBehalfOf, name: person?.name || d.onBehalfOf }
          if (d.grantRole === 'independent_assessor' && !person) {
            await db.insert(users).values({ id: `usr_${crypto.randomUUID()}`, email: d.onBehalfOf, role: 'independent', scopeLabel: 'Independent assessor', status: 'invited' })
              .onConflictDoNothing()
          }
        }
        const inviterEmail = onBehalfOf?.email ?? caller.email
        if (d.portfolioId) {
          if (!(await portfolioManagedBy(d.portfolioId, inviterEmail))) return forbidden()
        } else if (!onBehalfOf && !d.grantRole && !['admin', 'super_admin', 'portfolio'].includes(caller.role)) {
          return forbidden()
        }
        const { invitation, email } = await inviteOrganization(caller, {
          email: d.email, orgName: d.orgName, inviteeName: d.inviteeName, message: d.message, portfolioId: d.portfolioId ?? null, orgType,
          send: d.send !== false, onBehalfOf, grantRole: d.grantRole ?? null,
        })
        return Response.json({ ...invitation, email: email.body }, { status: 201 })
      }

      // Member invitation: join an organisation the caller may write, with a role no higher than theirs.
      const role = d.role || 'assessor'
      const orgId = d.orgId || caller.orgId
      const problem = await memberInviteProblem(caller, { orgId, role, portfolioId: d.portfolioId })
      if (problem === 'forbidden') return forbidden()
      if (problem) return bad(problem)
      const row = await insertInvitation({
        kind: 'member', email: d.email, inviter: caller.email, inviterName: caller.name, inviteeName: d.inviteeName || null,
        orgId, portfolioId: d.portfolioId ?? null, role, scopeLabel: d.scopeLabel ?? '', message: d.message || null, days: MEMBER_INVITE_DAYS,
      })
      await audit(caller.email, 'Invited member', `${row.id} · ${role}`, orgId)
      const email = d.send ? await dispatchInvitationEmail(row, caller.email) : null
      return Response.json(email ? { ...row, email: email.body } : row, { status: 201 })
    }

    // PATCH — the invitee declines ({ token, status: 'revoked' }). Accepting goes through POST /accept,
    // which needs the invitee's signed-in session. Token-as-capability: only a pending, unexpired
    // invitation holding exactly this token can change; anything else gets the same 404.
    if (req.method === 'PATCH') {
      if (await overLimit(`invitation-token:${clientIp(req)}`, TOKEN_LIMIT_PER_MINUTE)) return tooMany()
      const body = await req.json().catch(() => ({}))
      // { id, status: 'revoked' }: the inviter, whoever created it, or the Super Admin withdraws a pending invitation.
      if (body.id && !body.token) {
        const caller = await resolveCaller()
        if (!caller) return unauthorized()
        const mfaBlock = await mfaRequired(req, caller)
        if (mfaBlock) return mfaBlock
        if (body.status !== 'revoked') return bad('status must be revoked')
        const [inv] = await db.select().from(invitations).where(eq(invitations.id, String(body.id)))
        if (!inv || inv.status !== 'pending') return Response.json({ error: 'Invitation not found or no longer pending' }, { status: 404 })
        if (caller.readOnly || (caller.role !== 'super_admin' && caller.email !== inv.inviter && caller.email !== inv.createdBy)) return forbidden()
        await db.update(invitations).set({ status: 'revoked', respondedAt: new Date() }).where(and(eq(invitations.id, inv.id), eq(invitations.status, 'pending')))
        await audit(caller.email, 'Revoked invitation', `${inv.id} · ${inv.email}`)
        return Response.json({ id: inv.id, status: 'revoked' })
      }
      const token = String(body.token ?? '')
      const status = String(body.status ?? '')
      if (!token || !status) return bad('token and status required')
      if (status !== 'revoked') return bad('status must be revoked (accept with POST /api/invitations/accept)')
      const [row] = await db
        .update(invitations)
        .set({ status, respondedAt: new Date() })
        .where(and(eq(invitations.token, token), eq(invitations.status, 'pending'), gt(invitations.expiresAt, new Date())))
        .returning()
      if (!row) return Response.json({ error: 'Invitation not found or no longer pending' }, { status: 404 })
      return Response.json({ id: row.id, status: row.status })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    logger.error('/api/invitations', 'failed', err)
    return Response.json({ error: 'Invitation request failed' }, { status: 500 })
  }
}

export const config: Config = {
  path: ['/api/invitations', '/api/invitations/accept'],
}

export default monitored(handleRequest)
