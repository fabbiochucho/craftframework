import type { Config } from '@netlify/functions'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { networkExchanges, organizations } from '../../db/schema.js'
import { canAccessOrg, filterAuthorizedOrgIds, forbidden, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { audit, coordinatorScope, load } from '../lib/network-access.js'
import { distinctAcceptedOrgs, subtree } from '../../src/lib/networks.js'
import { instrumentById } from '../../src/lib/networkRounds.js'
import { EXCHANGE_TYPES } from '../../src/lib/networkExchange.js'

// /api/network-exchanges — the exchange log (src/lib/networkExchange.ts).
//   GET    ?networkId=        coordinators/viewers: exchanges at their levels; members: the ones their organisation took part in
//   POST   { networkId, nodeId, type, title, heldOn, location, instrument, areas, orgIds, people, followUp }   coordinator
//   POST   :id/attend { orgId }  a member adds its own organisation (so totals-only members can count themselves in)
//   DELETE :id                coordinator of that level
// Participants must be accepted members at that level or below. Organisations are named back to coordinators only if
// they chose named results; the rest are counted.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string) => json({ error }, 400)
const notFound = () => json({ error: 'Not found' }, 404)

const createSchema = z.object({
  networkId: z.string().max(80), nodeId: z.string().max(80), type: z.enum(EXCHANGE_TYPES), title: z.string().trim().min(3).max(200),
  heldOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), location: z.string().trim().max(200).default(''), instrument: z.string().max(60),
  areas: z.array(z.string().max(60)).max(20).default([]), orgIds: z.array(z.string().max(120)).max(500).default([]),
  people: z.number().int().min(0).max(100000).default(0), followUp: z.string().trim().max(2000).default(''),
}).strict()

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const url = new URL(req.url)
    const sub = url.pathname.replace(/^\/api\/network-exchanges\/?/, '').split('/').filter(Boolean)
    if (req.method !== 'GET') {
      if (caller.readOnly) return forbidden()
      const origin = req.headers.get('origin')
      if (origin && origin !== url.origin) return forbidden()
    }

    if (req.method === 'GET' && sub.length === 0) {
      const loaded = await load(url.searchParams.get('networkId') ?? '')
      if (!loaded) return notFound()
      const view = coordinatorScope(caller, loaded.nodes, loaded.admins)
      const rows = await db.select().from(networkExchanges).where(eq(networkExchanges.networkId, loaded.net.id))
      const myOrgs = new Set(await filterAuthorizedOrgIds(caller, distinctAcceptedOrgs(loaded.members, new Set(loaded.nodes.map((n) => n.id))), 'read'))
      const myNodes = new Set(loaded.members.filter((m) => m.status === 'accepted' && myOrgs.has(m.orgId)).map((m) => m.nodeId))
      const atMyLevels = (nodeId: string) => [...myNodes].some((n) => subtree(loaded.nodes, nodeId).has(n))
      const visible = rows.filter((r) => view.has(r.nodeId) || atMyLevels(r.nodeId) || r.orgIds.some((o) => myOrgs.has(o)))
      if (!visible.length && !view.size && !myOrgs.size) return notFound()
      const fullSharers = new Set(loaded.members.filter((m) => m.status === 'accepted' && m.sharing === 'full').map((m) => m.orgId))
      const nameIds = [...new Set(visible.flatMap((r) => r.orgIds).filter((o) => fullSharers.has(o) || myOrgs.has(o)))]
      const names = nameIds.length ? await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, nameIds)) : []
      return json({
        types: EXCHANGE_TYPES,
        exchanges: visible.sort((a, b) => b.heldOn.localeCompare(a.heldOn)).map((r) => {
          const shown = r.orgIds.filter((o) => (view.has(r.nodeId) && fullSharers.has(o)) || myOrgs.has(o))
          return { id: r.id, nodeId: r.nodeId, type: r.type, title: r.title, heldOn: r.heldOn, location: r.location, instrument: r.instrument,
            areas: r.areas, people: r.people, followUp: r.followUp, organisations: r.orgIds.length,
            named: shown.map((o) => names.find((n) => n.id === o)?.name ?? o),
            canAttend: [...myOrgs].filter((o) => !r.orgIds.includes(o) && distinctAcceptedOrgs(loaded.members, subtree(loaded.nodes, r.nodeId)).includes(o)), canDelete: coordinatorScope(caller, loaded.nodes, loaded.admins, 'coordinator').has(r.nodeId) }
        }),
      })
    }

    if (req.method === 'POST' && sub.length === 0) {
      const p = createSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid exchange')
      const loaded = await load(p.data.networkId)
      if (!loaded) return notFound()
      if (!coordinatorScope(caller, loaded.nodes, loaded.admins, 'coordinator').has(p.data.nodeId)) return forbidden()
      if (loaded.net.status === 'archived' && !(caller.role === 'super_admin' && !caller.readOnly)) return json({ error: 'This network has been archived by CRAFT and can no longer be changed' }, 409)
      const m = instrumentById(p.data.instrument)
      if (!m) return bad('Unknown assessment')
      if (p.data.areas.some((a) => !m.dimensions.some((d) => d.key === a))) return bad('Unknown area for that assessment')
      const eligible = new Set(distinctAcceptedOrgs(loaded.members, subtree(loaded.nodes, p.data.nodeId)))
      if (p.data.orgIds.some((o) => !eligible.has(o))) return bad('Participants must be accepted members at this level or below')
      const id = `nex_${crypto.randomUUID()}`
      await db.insert(networkExchanges).values({ id, ...p.data, orgIds: [...new Set(p.data.orgIds)], createdBy: caller.email })
      await audit(caller.email, `Logged ${p.data.type} "${p.data.title}"`, id)
      return json({ id }, 201)
    }

    if (req.method === 'POST' && sub.length === 2 && sub[1] === 'attend') {
      const b = await req.json().catch(() => null) as { orgId?: unknown } | null
      const orgId = typeof b?.orgId === 'string' ? b.orgId : ''
      const [row] = await db.select().from(networkExchanges).where(eq(networkExchanges.id, sub[0]))
      if (!row) return notFound()
      const loaded = await load(row.networkId)
      if (!loaded) return notFound()
      if (!distinctAcceptedOrgs(loaded.members, subtree(loaded.nodes, row.nodeId)).includes(orgId)) return json({ error: 'Only accepted members at this level can add themselves' }, 409)
      if (!(await canAccessOrg(caller, orgId, 'write'))) return forbidden()
      if (!row.orgIds.includes(orgId)) await db.update(networkExchanges).set({ orgIds: [...row.orgIds, orgId] }).where(eq(networkExchanges.id, row.id))
      await audit(caller.email, `Recorded taking part in "${row.title}"`, row.id, orgId)
      return json({ ok: true })
    }

    if (req.method === 'DELETE' && sub.length === 1) {
      const [row] = await db.select().from(networkExchanges).where(eq(networkExchanges.id, sub[0]))
      if (!row) return notFound()
      const loaded = await load(row.networkId)
      if (!loaded || !coordinatorScope(caller, loaded.nodes, loaded.admins, 'coordinator').has(row.nodeId)) return forbidden()
      await db.delete(networkExchanges).where(and(eq(networkExchanges.id, row.id), eq(networkExchanges.networkId, row.networkId)))
      await audit(caller.email, `Removed exchange "${row.title}"`, row.id)
      return json({ ok: true })
    }
    return notFound()
  } catch (err) {
    logger.error('network-exchanges', 'request failed', err)
    return json({ error: 'Request failed' }, 500)
  }
}

export const config: Config = { path: ['/api/network-exchanges', '/api/network-exchanges/*'] }

export default monitored(handleRequest)
