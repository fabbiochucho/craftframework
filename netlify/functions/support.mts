import type { Config } from '@netlify/functions'
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { evidenceRegistry, evidenceRequests, organizations, validationEngagements, workspaces, wsOrganizations } from '../../db/schema.js'
import { forbidden, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { decryptField } from '../lib/crypto.js'
import { logger, monitored } from '../lib/logger.js'

// /api/support/orgs?q=  — Super Admin support mode: find an organisation to help. Returns workspace
// organisations (with their workspaces, so the Evidence registry can be opened) and CRAFT organisations
// (with their active engagements and open evidence requests). Anything the Super Admin then adds is
// labelled "CRAFT support", emailed to the organisation and audit-logged (netlify/lib/support.ts).
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const safeDecrypt = (v: string) => { try { return decryptField(v) } catch { return '' } }

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (caller.role !== 'super_admin' || caller.readOnly) return forbidden()
    if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })
    const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 100)
    if (q.length < 2) return json({ workspaceOrganisations: [], organisations: [] })
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`

    const wsOrgs = await db.select().from(wsOrganizations).where(ilike(wsOrganizations.name, like)).limit(20)
    const wsIds = wsOrgs.map((o) => o.id)
    const [wss, evidence] = wsIds.length ? await Promise.all([
      db.select().from(workspaces).where(and(inArray(workspaces.orgId, wsIds), eq(workspaces.status, 'active'))),
      db.select({ orgId: evidenceRegistry.orgId }).from(evidenceRegistry).where(inArray(evidenceRegistry.orgId, wsIds)),
    ]) : [[], []]

    const orgs = await db.select({ id: organizations.id, name: organizations.name, email: organizations.email, country: organizations.country })
      .from(organizations).where(or(ilike(organizations.name, like), ilike(organizations.email, like))).orderBy(desc(organizations.createdAt)).limit(20)
    const orgIds = orgs.map((o) => o.id)
    const [engs, reqs] = orgIds.length ? await Promise.all([
      db.select({ id: validationEngagements.id, orgId: validationEngagements.orgId, type: validationEngagements.type, status: validationEngagements.status })
        .from(validationEngagements).where(and(inArray(validationEngagements.orgId, orgIds), eq(validationEngagements.status, 'active'))),
      db.select({ orgId: evidenceRequests.orgId, status: evidenceRequests.status }).from(evidenceRequests)
        .where(and(inArray(evidenceRequests.orgId, orgIds), inArray(evidenceRequests.status, ['open', 'more_needed']))),
    ]) : [[], []]

    return json({
      workspaceOrganisations: wsOrgs.map((o) => ({
        id: o.id, name: o.name, country: o.country, contactEmail: safeDecrypt(o.contactEmail),
        documents: evidence.filter((e) => e.orgId === o.id).length,
        workspaces: wss.filter((w) => w.orgId === o.id).map((w) => ({ id: w.id, name: w.workspaceName })),
      })),
      organisations: orgs.map((o) => ({
        ...o,
        openEvidenceRequests: reqs.filter((r) => r.orgId === o.id).length,
        engagements: engs.filter((e) => e.orgId === o.id).map((e) => ({ id: e.id, type: e.type })),
      })),
    })
  } catch (err) {
    logger.error('/api/support', 'failed', err)
    return json({ error: 'Support lookup failed' }, 500)
  }
}

export const config: Config = { path: '/api/support/orgs' }

export default monitored(handleRequest)
