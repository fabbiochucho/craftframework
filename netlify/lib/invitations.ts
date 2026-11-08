// Invitations by email. Two kinds:
//   member        join an existing organisation (org_id) with a role. Used by team
//                 invites (Settings) and platform-wide invites (Super Admin portal).
//   organization  bring an institution onto CRAFT in its OWN workspace, then apply
//                 one link: a portfolio (read-only access for the inviter), a
//                 proposed engagement (validator / funder) or a network level.
// Nothing is linked until the invitee accepts, signed in as the invited email,
// so an invitation can never move someone into an organisation without consent.
import { createHash } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  accessGrants, auditLogs, firmMembers, invitations, networkMembers, networkNodes, networks, organizations, portfolioOrgs, portfolios,
  rateLimits, users,
} from '../../db/schema.js'
import { canAccessOrg, isSuperAdmin, tenantOrgId, type Caller } from './auth.js'
import { createEngagement, createSchema, myFirms } from './engagement-create.js'
import { logger } from './logger.js'
import { publicBaseUrl } from './public-validation.js'
import { sendReminderEmail } from './reminder-email.js'
import { buildWelcomeEmail, buildWelcomeEmailHtml } from '../../src/lib/inviteEmail.js'
import { getViewLevel, type ViewLevel } from '../../src/lib/data.js'
import { countryNameOf, describeOrgType, type OrgType } from '../../src/lib/orgType.js'
import { legacyWorkspaceState } from '../../db/legacy-schema.js'
import { encryptField } from './crypto.js'
import { INDEPENDENT_ASSESSOR_ROLE } from './independent-assessor.js'

export type InvitationRow = typeof invitations.$inferSelect
export const MEMBER_INVITE_DAYS = 7
export const ORG_INVITE_DAYS = 14
export const ASSIGNABLE_ROLES = ['assessor', 'independent', 'portfolio', 'admin'] as const
const RANK: Record<string, number> = { assessor: 1, independent: 1, portfolio: 2, admin: 3, super_admin: 4 }

const DAY_MS = 86_400_000
export const acceptLink = (token: string) => `${publicBaseUrl()}/accept/${token}`
const newToken = () => crypto.randomUUID().replace(/-/g, '')

export async function audit(actor: string, action: string, target: string, orgId?: string | null, category = 'Auth') {
  try {
    await db.insert(auditLogs).values({ actor, action, target, category, orgId: orgId ?? null })
  } catch (err) {
    logger.error('invitations', 'audit failed', err)
  }
}

/** The portfolio, if `email` may manage it: its reviewer, its creator, or an active member of its firm. */
export async function portfolioManagedBy(portfolioId: string, email: string): Promise<{ id: string; name: string } | null> {
  const [p] = await db.select().from(portfolios).where(eq(portfolios.id, portfolioId))
  if (!p || p.status === 'archived') return null
  if (isSuperAdmin(email) || p.reviewer === email || p.createdBy === email) return { id: p.id, name: p.name }
  if (p.firmId) {
    const [m] = await db.select({ e: firmMembers.email }).from(firmMembers)
      .where(and(eq(firmMembers.firmId, p.firmId), eq(firmMembers.email, email), eq(firmMembers.status, 'active')))
    if (m) return { id: p.id, name: p.name }
  }
  return null
}

/** Why `caller` may not invite someone into `orgId` as `role`, or null when allowed. */
export async function memberInviteProblem(caller: Caller, input: { orgId: string; role: string; portfolioId?: string | null }): Promise<string | null> {
  if (caller.readOnly) return 'forbidden'
  if (!(ASSIGNABLE_ROLES as readonly string[]).includes(input.role)) return 'Choose a role'
  if (caller.role !== 'super_admin' && (RANK[input.role] ?? 9) > (RANK[caller.role] ?? 1)) return 'You cannot give someone a higher role than your own'
  if (!(await canAccessOrg(caller, input.orgId, 'write'))) return 'forbidden'
  if (input.role === 'portfolio') {
    if (!input.portfolioId) return 'Choose the portfolio in scope'
    if (!(await portfolioManagedBy(input.portfolioId, caller.email))) return 'forbidden'
  }
  return null
}

export async function insertInvitation(values: Omit<typeof invitations.$inferInsert, 'id' | 'token' | 'expiresAt'> & { days: number }): Promise<InvitationRow> {
  const { days, ...rest } = values
  const [row] = await db.insert(invitations).values({
    ...rest, id: `inv_${crypto.randomUUID()}`, token: newToken(), email: rest.email.trim().toLowerCase(),
    expiresAt: new Date(Date.now() + days * DAY_MS),
  }).returning()
  return row
}

/** What accepting an organisation invitation sets up, in plain words (shown in the email and on the accept page). */
export async function invitationPurpose(inv: InvitationRow): Promise<string> {
  const who = inv.inviterName || inv.inviter || 'The inviter'
  if (inv.engagement) {
    const type = (inv.engagement as { type?: string }).type
    return type === 'funder_review'
      ? `Proposes a funder review by ${who}. Once your workspace is set up you decide whether to consent.`
      : `Proposes an independent validation by ${who}. Once your workspace is set up you decide whether to consent.`
  }
  if (inv.networkNodeId) {
    const [n] = await db.select({ node: networkNodes.name, network: networks.name }).from(networkNodes)
      .innerJoin(networks, eq(networks.id, networkNodes.networkId)).where(eq(networkNodes.id, inv.networkNodeId))
    return `Invites you to join ${n ? `${n.network} (${n.node})` : 'a CRAFT network'}. You choose what to share before joining.`
  }
  if (inv.grantRole === INDEPENDENT_ASSESSOR_ROLE) {
    return `Names ${who} as your organisation's independent assessor: ${who} can see your assessment and record independent scores alongside yours, which you compare on the Trust Delta screen. ${who} cannot change your answers, and you can revoke this at any time.`
  }
  if (inv.portfolioId) {
    const [p] = await db.select({ name: portfolios.name }).from(portfolios).where(eq(portfolios.id, inv.portfolioId))
    return `Adds you to the portfolio "${p?.name ?? 'portfolio'}" and gives ${who} read-only access to your results. You can revoke it at any time.`
  }
  return `Gives ${who} read-only access to your results. You can revoke it at any time.`
}

// ---------------------------------------------------------------- sending ----

export const SEND_LIMIT_PER_HOUR = 20
export const SEND_LIMIT_PER_INVITATION = 3
const HOUR_MS = 3_600_000
const CAP_TTL_MS = 90 * 24 * HOUR_MS // the per-invitation cap outlives any invitation
export type Outcome = { status: number; body: Record<string, unknown>; headers?: Record<string, string> }

async function overHourlyLimit(email: string, now = Date.now()): Promise<boolean> {
  const windowStart = new Date(Math.floor(now / HOUR_MS) * HOUR_MS)
  const key = createHash('sha256').update(`send-invite:${email}`).digest('hex')
  const [row] = await db.insert(rateLimits).values({ key, windowStart, count: 1, expiresAt: new Date(windowStart.getTime() + HOUR_MS) })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count })
  return row.count > SEND_LIMIT_PER_HOUR
}

const sendAudit = (actor: string, invitationId: string, outcome: string) => audit(actor, 'Invite email send', `${invitationId} · ${outcome}`)

/** The email exactly as it will be sent: subject, HTML, text and reply-to. Shared by sending and the draft preview. */
export async function renderInvitationEmail(inv: InvitationRow, actor: string) {
  const kind = inv.kind === 'organization' ? 'organization' : 'member'
  const input = {
    name: inv.inviteeName ?? '',
    email: inv.email,
    role: inv.role as ViewLevel,
    scopeLabel: inv.scopeLabel,
    inviterName: inv.inviterName || inv.inviter || 'A CRAFT administrator',
    inviterEmail: inv.inviter ?? '',
    message: inv.message ?? undefined,
    acceptUrl: acceptLink(inv.token),
    kind,
    orgName: inv.orgName ?? undefined,
    orgType: describeOrgType({ archetype: inv.orgArchetype, sector: inv.orgSector, country: inv.orgCountry }) || undefined,
    purpose: kind === 'organization' ? await invitationPurpose(inv) : undefined,
    expiresInDays: kind === 'organization' ? ORG_INVITE_DAYS : MEMBER_INVITE_DAYS,
    siteUrl: publicBaseUrl(),
    // Sent by someone else (e.g. the CRAFT team) on the inviter's behalf.
    sentOnBehalf: !!inv.inviter && actor !== inv.inviter,
  } as const
  // Replies reach the person who sent the invitation.
  const replyTo = inv.inviter && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inv.inviter) ? inv.inviter : undefined
  const { subject, html } = buildWelcomeEmailHtml(input)
  const { body: text } = buildWelcomeEmail(input)
  return { subject, html, text, replyTo, to: inv.email }
}

/**
 * Send (or resend) the invitation email. The recipient is always the stored invitation email and the
 * content is rendered here from the stored record. Capped per sender per hour and per invitation.
 * The caller has already checked that `actor` may send this invitation.
 */
export async function dispatchInvitationEmail(inv: InvitationRow, actor: string): Promise<Outcome> {
  // A draft's validity starts when it is first sent.
  const days = inv.kind === 'organization' ? ORG_INVITE_DAYS : MEMBER_INVITE_DAYS
  // (Only while the draft itself is still within its hold; an expired draft stays expired.)
  if (!inv.sentAt && inv.status === 'pending' && inv.expiresAt && new Date(inv.expiresAt).getTime() > Date.now()) {
    const [fresh] = await db.update(invitations).set({ expiresAt: new Date(Date.now() + days * DAY_MS) }).where(eq(invitations.id, inv.id)).returning()
    inv = fresh ?? inv
  }
  if (inv.status !== 'pending') {
    await sendAudit(actor, inv.id, `refused_${inv.status}`)
    return { status: 409, body: { error: `Invitation is ${inv.status}` } }
  }
  if (!inv.expiresAt || new Date(inv.expiresAt).getTime() < Date.now()) {
    await sendAudit(actor, inv.id, 'refused_expired')
    return { status: 409, body: { error: 'Invitation has expired' } }
  }
  if (await overHourlyLimit(actor)) {
    await sendAudit(actor, inv.id, 'rate_limited')
    return { status: 429, body: { error: `Too many invitation emails. Limit is ${SEND_LIMIT_PER_HOUR} per hour; try again later.` }, headers: { 'retry-after': '3600' } }
  }
  // Someone chose to send it: from now on it is no longer a draft (the link may also be shared directly).
  if (!inv.sentAt) await db.update(invitations).set({ sentAt: new Date(), sentBy: actor }).where(eq(invitations.id, inv.id))
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.INVITE_FROM_EMAIL
  // Never substitute Resend's development-only sender (same rule as reminder-email.ts).
  if (!apiKey || !from || /@resend\.dev\b/i.test(from)) {
    await sendAudit(actor, inv.id, 'not_configured')
    return { status: 200, body: { dispatched: false, reason: 'no_mail_provider_configured' } }
  }
  // Reserve a send slot atomically; the cap holds under concurrent requests.
  const capKey = createHash('sha256').update(`send-invite-inv:${inv.id}`).digest('hex')
  const [slot] = await db.insert(rateLimits).values({ key: capKey, windowStart: new Date(0), count: 1, expiresAt: new Date(Date.now() + CAP_TTL_MS) })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count })
  if (slot.count > SEND_LIMIT_PER_INVITATION) {
    await sendAudit(actor, inv.id, 'invitation_cap')
    return { status: 429, body: { error: `This invitation has already been sent ${SEND_LIMIT_PER_INVITATION} times.` } }
  }
  const { subject, html, text, replyTo } = await renderInvitationEmail(inv, actor)
  let res: Response
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        // Dedupes a retried first send; later (re)sends are distinct emails.
        ...(slot.count === 1 ? { 'Idempotency-Key': `invite-${inv.id}` } : {}),
      },
      body: JSON.stringify({ from, to: inv.email, subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    })
  } catch (err) {
    logger.error('invitations', 'provider unreachable', err)
    await sendAudit(actor, inv.id, 'provider_unreachable')
    return { status: 502, body: { dispatched: false, reason: 'provider_error' } }
  }
  if (!res.ok) {
    // Non-sensitive status only; never echo the provider body or key.
    logger.error('invitations', 'provider error', undefined, { status: res.status })
    await sendAudit(actor, inv.id, `provider_error_${res.status}`)
    return { status: 502, body: { dispatched: false, reason: 'provider_error' } }
  }
  // Resend's message id lets its webhook (/api/resend-webhook) report delivery against this invitation.
  const emailId = String(((await res.json().catch(() => null)) as { id?: unknown } | null)?.id ?? '') || null
  await db.update(invitations).set({ emailId, deliveryStatus: 'sent', deliveryAt: new Date() }).where(eq(invitations.id, inv.id))
  await sendAudit(actor, inv.id, inv.inviter && actor !== inv.inviter ? `sent on behalf of ${inv.inviter}` : 'sent')
  return { status: 200, body: { dispatched: true } }
}

/** Create an organisation invitation and send it. `link` is at most one of portfolio / engagement / network. */
export async function inviteOrganization(caller: Caller, input: {
  email: string; orgName: string; inviteeName?: string | null; message?: string | null
  portfolioId?: string | null; engagement?: Record<string, unknown> | null; networkNodeId?: string | null
  orgType?: OrgType | null
  /** Hold as a draft (default: send now). */
  send?: boolean
  /** Super Admin: create it in someone else's name (they are the inviter; replies go to them). */
  onBehalfOf?: { email: string; name: string } | null
  /** Access the organisation gives the inviter on acceptance ('independent_assessor'); default read-only. */
  grantRole?: string | null
}): Promise<{ invitation: InvitationRow; email: Outcome }> {
  const inviter = input.onBehalfOf ?? { email: caller.email, name: caller.name }
  const send = input.send !== false
  const invitation = await insertInvitation({
    kind: 'organization', email: input.email, orgName: input.orgName.trim(), inviter: inviter.email, inviterName: inviter.name,
    createdBy: caller.email, grantRole: input.grantRole ?? null,
    inviteeName: input.inviteeName || null, message: input.message || null, role: 'admin', scopeLabel: input.orgName.trim(),
    portfolioId: input.portfolioId ?? null, engagement: input.engagement ?? null, networkNodeId: input.networkNodeId ?? null,
    orgArchetype: input.orgType?.archetype ?? null, orgSector: input.orgType?.sector ?? null, orgCountry: input.orgType?.country ?? null,
    // A draft is held (its 14 days start when it is sent); 90 days to decide.
    days: send ? ORG_INVITE_DAYS : 90,
  })
  const what = input.engagement ? 'engagement' : input.networkNodeId ? 'network' : input.portfolioId ? 'portfolio' : input.grantRole ?? 'access'
  await audit(caller.email, `${send ? 'Invited' : 'Drafted invitation for'} organisation by email${input.onBehalfOf ? ` on behalf of ${inviter.email}` : ''}`, `${invitation.id} · ${what}`)
  if (!send) return { invitation, email: { status: 200, body: { dispatched: false, reason: 'draft' } } }
  return { invitation, email: await dispatchInvitationEmail(invitation, caller.email) }
}

// -------------------------------------------------------------- accepting ----

export type AcceptResult = { status: number; body: Record<string, unknown> }
const gone = (): AcceptResult => ({ status: 404, body: { error: 'Invitation not found or no longer pending' } })

async function inviterOrgId(inviter: string): Promise<string> {
  const [row] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.email, inviter))
  return row?.orgId ?? tenantOrgId(inviter)
}

/** Best-effort note to the inviter that their invitation was accepted. */
async function tellInviter(inv: InvitationRow, caller: Caller, orgName: string) {
  if (!inv.inviter) return
  const what = inv.kind === 'organization' ? `${orgName} is now on CRAFT` : `${caller.email} joined ${orgName}`
  try {
    await sendReminderEmail({
      to: inv.inviter,
      subject: `CRAFT: your invitation was accepted`,
      text: `${what}.\n\nSign in to CRAFT to continue: ${publicBaseUrl()}`,
    }, `invite-accepted-${inv.id}`, 'invitation_accepted')
  } catch (err) {
    logger.error('invitations', 'accept notice failed', err)
  }
}

/**
 * Accept a pending, unexpired invitation as the signed-in invitee. The session email must be the
 * invited email. Applies the invitation's effect server-side.
 */
export async function acceptInvitation(caller: Caller, token: string, orgNameInput?: string): Promise<AcceptResult> {
  const [inv] = await db.select().from(invitations).where(eq(invitations.token, token))
  if (!inv || inv.status !== 'pending' || !inv.sentAt || !inv.expiresAt || new Date(inv.expiresAt).getTime() < Date.now()) return gone()
  if (inv.email.trim().toLowerCase() !== caller.email) {
    return { status: 403, body: { error: 'This invitation was sent to a different email address. Sign in with that address to accept it.' } }
  }
  if (caller.readOnly) return { status: 403, body: { error: 'Forbidden' } }

  // Claim it first, so a double submit cannot apply it twice.
  const [claimed] = await db.update(invitations).set({ status: 'accepted', respondedAt: new Date() })
    .where(and(eq(invitations.id, inv.id), eq(invitations.status, 'pending'))).returning()
  if (!claimed) return gone()

  if (inv.kind !== 'organization') {
    const orgId = inv.orgId ?? (inv.inviter ? await inviterOrgId(inv.inviter) : caller.orgId)
    const role = (ASSIGNABLE_ROLES as readonly string[]).includes(inv.role) ? inv.role : 'assessor'
    await db.insert(users).values({
      id: `usr_${crypto.randomUUID()}`, email: caller.email, name: inv.inviteeName ?? '', orgId, role,
      scopeId: inv.portfolioId ?? null, scopeLabel: inv.scopeLabel, portfolioId: inv.portfolioId ?? null, status: 'active',
    }).onConflictDoUpdate({
      target: users.email,
      set: { orgId, role, scopeId: inv.portfolioId ?? null, scopeLabel: inv.scopeLabel, portfolioId: inv.portfolioId ?? null, status: 'active' },
    })
    await db.update(invitations).set({ acceptedOrgId: orgId }).where(eq(invitations.id, inv.id))
    const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId))
    await audit(caller.email, 'Accepted invitation', `${inv.id} · ${getViewLevel(role as ViewLevel).short}`, orgId)
    await tellInviter(inv, caller, org?.name ?? 'the organisation')
    return { status: 200, body: { kind: 'member', orgId, next: role === 'portfolio' ? '/admin/portfolio' : '/dashboard' } }
  }

  // Organisation invitation: the institution is the invitee's own workspace. Only its owner (their
  // self-registered tenant) or an administrator of the organisation they already belong to may accept.
  const orgId = caller.orgId
  const ownTenant = orgId === tenantOrgId(caller.email)
  if (!ownTenant && caller.role !== 'admin' && caller.role !== 'super_admin') {
    await db.update(invitations).set({ status: 'pending', respondedAt: null }).where(eq(invitations.id, inv.id))
    return { status: 403, body: { error: "You belong to an organisation you don't administer. Ask its administrator to accept this invitation." } }
  }
  const orgName = (orgNameInput ?? '').trim().slice(0, 200) || inv.orgName || 'My Institution'
  await db.insert(organizations).values({
    id: orgId, name: orgName, email: caller.email, createdBy: caller.email,
    archetype: inv.orgArchetype, sector: inv.orgSector, country: countryNameOf(inv.orgCountry),
  }).onConflictDoNothing()
  // Prefill the workspace profile with the type the inviter chose (never overwrites one already set).
  // Onboarding still runs, so the organisation confirms or corrects it.
  if (inv.orgArchetype) {
    const profile = {
      archetype: inv.orgArchetype, sector: inv.orgSector ?? '', subsector: '', country: inv.orgCountry ?? '',
      jurisdictions: inv.orgCountry ? [inv.orgCountry] : [], regSector: '',
    }
    await db.insert(legacyWorkspaceState).values({ orgId, key: 'entity-profile', value: encryptField(JSON.stringify(profile)) }).onConflictDoNothing()
  }
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId))
  const body: Record<string, unknown> = { kind: 'organization', orgId, next: '/onboarding' }

  if (inv.engagement && inv.inviter) {
    const parsed = createSchema.safeParse(inv.engagement)
    const [inviterRow] = await db.select({ orgId: users.orgId, name: users.name }).from(users).where(eq(users.email, inv.inviter))
    const inviter = { email: inv.inviter, orgId: inviterRow?.orgId ?? tenantOrgId(inv.inviter), name: inviterRow?.name || inv.inviterName || inv.inviter }
    const result = parsed.success
      ? await createEngagement(inviter, await myFirms(inv.inviter), parsed.data, { targetOrgId: orgId })
      : { status: 400, body: { error: 'Invalid engagement' } }
    if (result.status === 201) {
      body.engagementId = result.body.id
      body.next = '/engagements'
    } else {
      body.warning = `Your workspace is ready, but the proposed engagement could not be created: ${String(result.body.error ?? 'unknown reason')}. Ask the inviter to send it again from Engagements.`
      await audit(caller.email, 'Invited engagement not created', `${inv.id} · ${String(result.body.error ?? '')}`, orgId, 'Engagement')
    }
  } else if (inv.networkNodeId && inv.inviter) {
    const [existing] = await db.select().from(networkMembers).where(and(eq(networkMembers.nodeId, inv.networkNodeId), eq(networkMembers.orgId, orgId)))
    if (!existing) {
      await db.insert(networkMembers).values({ id: `nmb_${crypto.randomUUID()}`, nodeId: inv.networkNodeId, orgId, invitedBy: inv.inviter })
    } else if (existing.status !== 'accepted' && existing.status !== 'invited') {
      await db.update(networkMembers).set({ status: 'invited', invitedBy: inv.inviter, invitedAt: new Date(), decidedBy: null, decidedAt: null })
        .where(eq(networkMembers.id, existing.id))
    }
    body.next = '/networks'
  } else if (inv.inviter) {
    // Portfolio, a plain admin invitation or an independent assessor: the inviter gets read-only access
    // the organisation can revoke (an independent assessor also records their own independent scores).
    const portfolio = inv.portfolioId ? await portfolioManagedBy(inv.portfolioId, inv.inviter) : null
    const role = inv.grantRole === INDEPENDENT_ASSESSOR_ROLE ? INDEPENDENT_ASSESSOR_ROLE : null
    await db.insert(accessGrants).values({
      id: `grant_${crypto.randomUUID()}`, orgId, grantee: inv.inviter, grantedBy: caller.email, level: 'read', status: 'active',
      role, portfolioId: portfolio?.id ?? null, respondedAt: new Date(),
    }).onConflictDoUpdate({
      target: [accessGrants.orgId, accessGrants.grantee],
      set: { status: 'active', level: 'read', role, grantedBy: caller.email, portfolioId: portfolio?.id ?? null, respondedAt: new Date() },
    })
    if (portfolio) await db.insert(portfolioOrgs).values({ portfolioId: portfolio.id, orgId }).onConflictDoNothing()
  }

  await db.update(invitations).set({ acceptedOrgId: orgId }).where(eq(invitations.id, inv.id))
  await audit(caller.email, 'Accepted organisation invitation', inv.id, orgId)
  await tellInviter(inv, caller, org?.name ?? orgName)
  return { status: 200, body }
}
