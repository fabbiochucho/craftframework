import type { Config } from '@netlify/functions'
import { and, desc, eq, lt } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { accessGrants, assessmentRevisions, engagementMembers, validationEngagements, validationFunderConsents, firmMembers, firms } from '../../db/schema.js'
import { canAccessOrg, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { grantAllows } from '../lib/access-policy.js'
import { decryptField } from '../lib/crypto.js'
import { HttpError, requireOrgAccess } from '../lib/orgAccess.js'
import { logger, monitored } from '../lib/logger.js'
import { legacyWorkspaceState } from '../../db/legacy-schema.js'
import { SPECIALIZED_READONLY_ROLES } from '../lib/access-policy.js'
import { fairKeyReadable } from '../../src/lib/fairRisk.js'

const query = z.object({
  source: z.enum(['capacity', 'review', 'workspace', 'independent', 'legacy', 'scores', 'funder']).optional(),
  assessmentId: z.string().min(1).max(200).optional(),
  before: z.coerce.number().int().positive().optional(),
  period: z.string().max(100).optional(),
})

const PAGE = 50

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const block = await mfaRequired(req, caller)
    if (block) return block
    if (req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 })
    const p = query.safeParse(Object.fromEntries(new URL(req.url).searchParams))
    if (!p.success) return Response.json({ error: 'Invalid archive filters' }, { status: 400 })
    const page = (before?: number) => db.select().from(assessmentRevisions).where(and(
      eq(assessmentRevisions.actor, caller.email),
      p.data.source ? eq(assessmentRevisions.source, p.data.source) : undefined,
      p.data.assessmentId ? eq(assessmentRevisions.assessmentId, p.data.assessmentId) : undefined,
      before ? lt(assessmentRevisions.id, before) : undefined,
      p.data.period ? eq(assessmentRevisions.period, p.data.period) : undefined,
    )).orderBy(desc(assessmentRevisions.id)).limit(PAGE)
    const permissions = new Map<string, boolean>()
    const revisions = []
    // Rows the caller can no longer open are skipped, so keep reading until a page is full (bounded).
    let cursor = p.data.before
    let more = true
    for (let batch = 0; batch < 10 && more && revisions.length < PAGE; batch++) {
      const records = await page(cursor)
      more = records.length === PAGE
      cursor = records.at(-1)?.id
      for (const r of records) {
        const key = `${r.source}|${r.orgId}|${r.assessmentId}|${r.recordKey}`
        if (!permissions.has(key)) {
          let allowed = false
          if (r.source === 'workspace') {
            try { await requireOrgAccess(caller, Number(r.orgId), 'viewer'); allowed = true } catch (error) {
              if (!(error instanceof HttpError)) throw error
            }
          } else if (r.source === 'review') {
            const [e] = await db.select().from(validationEngagements).where(eq(validationEngagements.id, r.assessmentId))
            const [member] = await db.select().from(engagementMembers).where(and(eq(engagementMembers.engagementId, r.assessmentId), eq(engagementMembers.email, caller.email), eq(engagementMembers.status, 'named')))
            if (e && caller.orgId === e.orgId) allowed = await canAccessOrg(caller, e.orgId, 'read')
            else if (e && member) {
              const [grant] = member.grantId ? await db.select().from(accessGrants).where(and(eq(accessGrants.id, member.grantId), eq(accessGrants.orgId, e.orgId), eq(accessGrants.grantee, caller.email))) : []
              allowed = e.status === 'finalised' || !!grant && grantAllows(grant, 'read')
            }
          } else if (r.source === 'funder') {
            const mine = await db.select({ id: firms.id }).from(firms).innerJoin(firmMembers, eq(firmMembers.firmId, firms.id))
              .where(and(eq(firmMembers.email, caller.email), eq(firmMembers.status, 'active'), eq(firms.kind, 'funding_partner')))
            for (const firm of mine) {
              if (firm.id !== r.recordKey) continue
              const [consent] = await db.select().from(validationFunderConsents).where(and(eq(validationFunderConsents.validationId, r.assessmentId), eq(validationFunderConsents.funderFirmId, firm.id)))
              if (consent && !consent.revokedAt) allowed = true
            }
          } else {
            allowed = await canAccessOrg(caller, r.orgId, 'read')
            if (allowed && r.source === 'legacy' && r.recordKey.startsWith('fair:')) {
              const ownOrg = caller.orgId === r.orgId && !caller.readOnly && !SPECIALIZED_READONLY_ROLES.has(caller.role)
              if (!ownOrg) {
                const [c] = await db.select().from(legacyWorkspaceState).where(and(eq(legacyWorkspaceState.orgId, r.orgId), eq(legacyWorkspaceState.key, 'fair:consent')))
                allowed = fairKeyReadable({ key: r.recordKey, ownOrg: false, superAdmin: caller.role === 'super_admin', consent: !!c && JSON.parse(decryptField(c.value)) === true })
              }
            }
          }
          permissions.set(key, allowed)
        }
        if (permissions.get(key)) revisions.push({ ...r, snapshot: JSON.parse(decryptField(r.snapshot)) })
        if (revisions.length === PAGE) { more ||= r !== records.at(-1); cursor = r.id; break }
      }
    }
    return Response.json({ revisions, next: more ? cursor ?? null : null }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    logger.error('assessment-archive', 'request failed', error)
    return Response.json({ error: 'Assessment archive could not be loaded.' }, { status: 500 })
  }
}

export const config: Config = { path: '/api/assessment-archive' }
export default monitored(handleRequest)
