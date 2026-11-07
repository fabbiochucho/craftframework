import type { Config } from '@netlify/functions'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { invitations } from '../../db/schema.js'
import { forbidden, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { orgProgress } from '../lib/lifecycle.js'
import { logger, monitored } from '../lib/logger.js'
import { badgesFor, funnel, type ReferralLink, type ReferralStage } from '../../src/lib/ambassadors.js'

// /api/referrals — organisations people brought to CRAFT by email invitation, and ambassador badges.
//   GET  /                     my referrals (invited → joined → started → assessed) and my badges
//   GET  /badges?email=&email= badges of up to 50 people, for showing next to their names (badges only)
//   GET  /overview             Super Admin: funnel, by link, and the ambassador table
// A referred organisation's progress is shown only as a coarse stage, never its scores or contents.
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

type Referral = {
  invitationId: string; inviter: string; orgName: string; contact: string; link: ReferralLink; sentAt: Date | null
  status: 'pending' | 'accepted' | 'expired' | 'revoked'; stage: ReferralStage; orgId: string | null
}

async function loadReferrals(inviters?: string[]): Promise<Referral[]> {
  if (inviters && !inviters.length) return []
  const rows = await db.select().from(invitations)
    .where(and(eq(invitations.kind, 'organization'), inviters ? inArray(invitations.inviter, inviters) : undefined))
    .orderBy(desc(invitations.createdAt))
  const accepted = [...new Set(rows.filter((r) => r.status === 'accepted' && r.acceptedOrgId).map((r) => r.acceptedOrgId!))]
  const progress = await orgProgress(accepted, new Date())
  const now = Date.now()
  return rows.map((r) => {
    const p = r.acceptedOrgId ? progress.get(r.acceptedOrgId) : undefined
    const status = r.status === 'pending' && r.expiresAt && new Date(r.expiresAt).getTime() < now ? 'expired' : r.status as Referral['status']
    const stage: ReferralStage = status !== 'accepted' ? 'invited'
      : p && p.progress.assessmentsCompleted > 0 ? 'assessed' : p?.startedAssessment ? 'started' : 'joined'
    return {
      invitationId: r.id, inviter: r.inviter ?? '', orgName: r.orgName ?? '', contact: r.email,
      link: r.networkNodeId ? 'network' : r.portfolioId ? 'portfolio' : r.engagement ? 'engagement' : 'other',
      sentAt: r.createdAt, status, stage, orgId: status === 'accepted' ? r.acceptedOrgId : null,
    }
  })
}

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })
    const url = new URL(req.url)
    const sub = url.pathname.replace(/^\/api\/referrals\/?/, '')

    if (!sub) {
      const mine = await loadReferrals([caller.email])
      return json({
        referrals: mine.map(({ inviter: _i, orgId: _o, ...r }) => r),
        badges: badgesFor(mine),
        funnel: funnel(mine.map((r) => r.stage)),
      })
    }
    if (sub === 'badges') {
      const emails = [...new Set(url.searchParams.getAll('email').map((e) => e.trim().toLowerCase()).filter((e) => /@/.test(e)))].slice(0, 50)
      const all = await loadReferrals(emails)
      return json(Object.fromEntries(emails.map((e) => [e, badgesFor(all.filter((r) => r.inviter === e))])))
    }
    if (sub === 'overview') {
      if (caller.role !== 'super_admin') return forbidden()
      const all = await loadReferrals()
      const byInviter = new Map<string, Referral[]>()
      for (const r of all) byInviter.set(r.inviter, [...(byInviter.get(r.inviter) ?? []), r])
      const links: ReferralLink[] = ['portfolio', 'network', 'engagement', 'other']
      return json({
        funnel: funnel(all.map((r) => r.stage)),
        byLink: Object.fromEntries(links.map((l) => [l, funnel(all.filter((r) => r.link === l).map((r) => r.stage))])),
        ambassadors: [...byInviter].map(([inviter, rs]) => ({ inviter, ...funnel(rs.map((r) => r.stage)), badges: badgesFor(rs) }))
          .sort((a, b) => b.started - a.started || b.invited - a.invited),
      })
    }
    return json({ error: 'Not found' }, 404)
  } catch (err) {
    logger.error('/api/referrals', 'failed', err)
    return json({ error: 'Referrals request failed' }, 500)
  }
}

export const config: Config = { path: ['/api/referrals', '/api/referrals/*'] }

export default monitored(handleRequest)
