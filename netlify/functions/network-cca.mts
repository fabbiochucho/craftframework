import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { ccaAssessments, networkNodes, organizations } from '../../db/schema.js'
import { mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { audit, coordinatorScope, load } from '../lib/network-access.js'
import { distinctAcceptedOrgs, subtree, type NetworkMember } from '../../src/lib/networks.js'
import { dashboard, effectiveNotAssessed, type CcaModule } from '../../src/lib/cca/engine.js'
import { latestPerOrg, networkCcaFeed } from '../../src/lib/cca/networkFeed.js'

// /api/network-cca?nodeId=&module=  Capacity Assessment results across a network level, for its coordinators and
// viewers (and those above). Same rules as network results: accepted members only, groups under MIN_GROUP hidden
// unless everyone in them chose named results, organisations named only when they chose named results.
// Rules: src/lib/cca/networkFeed.ts.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
    const url = new URL(req.url)
    const nodeId = url.searchParams.get('nodeId') ?? ''
    const moduleId = url.searchParams.get('module') || 'community'
    const [node] = nodeId ? await db.select().from(networkNodes).where(eq(networkNodes.id, nodeId)) : []
    const loaded = node ? await load(node.networkId) : null
    if (!loaded) return json({ error: 'Not found' }, 404)
    const { nodes, admins, members } = loaded
    if (!coordinatorScope(caller, nodes, admins).has(nodeId)) return json({ error: 'Not found' }, 404)

    const modules = (await getStore('cca-private').get('modules', { type: 'json' }) as CcaModule[] | null) ?? []
    const mod = modules.find((m) => m.id === moduleId)
    if (!mod) return json({ error: 'That module is not available.' }, 404)

    const orgIds = distinctAcceptedOrgs(members as NetworkMember[], subtree(nodes, nodeId))
    const rows = orgIds.length
      ? await db.select().from(ccaAssessments).where(and(inArray(ccaAssessments.orgId, orgIds), eq(ccaAssessments.module, moduleId), eq(ccaAssessments.status, 'complete')))
      : []
    const latest = latestPerOrg(rows.map((r) => ({ ...r, completedAt: r.completedAt?.toISOString() ?? null })), moduleId)
    const results = latest.map((r) => ({ orgId: r.orgId, year: r.year, dashboard: dashboard(mod, r.responses, effectiveNotAssessed(mod, r.notAssessed, r.domainIds)) }))
    const names = orgIds.length ? await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, orgIds)) : []
    const feed = networkCcaFeed(nodes, members as NetworkMember[], results, nodeId, (id) => names.find((n) => n.id === id)?.name ?? id)
    await audit(caller.email, `Viewed Capacity Assessment results for ${node!.name} (${moduleId})`, nodeId)
    return json({ module: { id: mod.id, name: mod.name }, ...feed })
  } catch (err) {
    logger.error('network-cca', 'request failed', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
}

export const config: Config = { path: '/api/network-cca' }

export default monitored(handleRequest)
