import type { Config } from '@netlify/functions'
import { and, eq, inArray, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, networkAdmins, networkMembers, networkNodes, networks, organizations } from '../../db/schema.js'
import { canAccessOrg, filterAuthorizedOrgIds, forbidden, mfaRequired, resolveCaller, unauthorized, type Caller } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import {
  NETWORK_LEVELS, SHARING, adminScope, canNest, memberView, validGeoCode,
  type NetworkAdmin, type NetworkLevel, type NetworkMember, type NetworkNode,
} from '../../src/lib/networks.js'

// /api/networks — civil society networks: levels, coordinators and member organisations (src/lib/networks.ts).
//   GET                                   my networks, my organisations' invitations and memberships
//   POST   { name, description, root }    Super Admin: create a network with its top level
//   GET    :id                            the tree; coordinators see members in their scope (named only if "full")
//   POST   :id/nodes { parentId, level, name, geoCode }       coordinator of the parent level
//   POST   :id/admins { nodeId, email, role }                 coordinator of that level (or above)
//   DELETE :id/admins { nodeId, email }
//   POST   :id/invitations { nodeId, org }                    invite an organisation by CRAFT id or contact email
//   POST   members/:memberId { action, sharing? }             the organisation: accept | decline | leave | sharing

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string) => json({ error }, 400)
const notFound = () => json({ error: 'Not found' }, 404)
const newId = (p: string) => `${p}_${crypto.randomUUID()}`
const geo = z.string().trim().toUpperCase().max(12).default('')
const level = z.enum(NETWORK_LEVELS)

const createSchema = z.object({
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).default(''),
  root: z.object({ level, name: z.string().trim().min(2).max(160), geoCode: geo }).strict(),
}).strict()
const nodeSchema = z.object({ parentId: z.string().max(80), level, name: z.string().trim().min(2).max(160), geoCode: geo }).strict()
const adminSchema = z.object({ nodeId: z.string().max(80), email: z.string().trim().toLowerCase().email().max(200), role: z.enum(['coordinator', 'viewer']).default('coordinator') }).strict()
const adminDeleteSchema = z.object({ nodeId: z.string().max(80), email: z.string().trim().toLowerCase().email().max(200) }).strict()
const inviteSchema = z.object({ nodeId: z.string().max(80), org: z.string().trim().min(2).max(200) }).strict()
const decideSchema = z.object({ action: z.enum(['accept', 'decline', 'leave', 'sharing']), sharing: z.enum(SHARING).optional() }).strict()

const isSuper = (c: Caller) => c.role === 'super_admin' && !c.readOnly
const audit = (actor: string, action: string, target: string, orgId?: string) =>
  db.insert(auditLogs).values({ actor, action, target, category: 'Network', orgId: orgId ?? null })

async function load(networkId: string) {
  const [net] = await db.select().from(networks).where(eq(networks.id, networkId))
  if (!net) return null
  const nodes = (await db.select().from(networkNodes).where(eq(networkNodes.networkId, networkId))) as NetworkNode[]
  const ids = nodes.map((n) => n.id)
  const admins = ids.length ? await db.select().from(networkAdmins).where(inArray(networkAdmins.nodeId, ids)) : []
  const members = ids.length ? await db.select().from(networkMembers).where(inArray(networkMembers.nodeId, ids)) : []
  return { net, nodes, admins: admins as (NetworkAdmin & { addedBy: string })[], members: members as (NetworkMember & { invitedAt: Date })[] }
}

/** Nodes the caller coordinates (all nodes for the Super Admin). */
function coordinatorScope(c: Caller, nodes: NetworkNode[], admins: NetworkAdmin[], role?: NetworkAdmin['role']) {
  return isSuper(c) ? new Set(nodes.map((n) => n.id)) : adminScope(nodes, admins, c.email, role)
}

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const url = new URL(req.url)
    const sub = url.pathname.replace(/^\/api\/networks\/?/, '').split('/').filter(Boolean)
    if (req.method !== 'GET') {
      if (caller.readOnly) return forbidden()
      const origin = req.headers.get('origin')
      if (origin && origin !== url.origin) return forbidden()
    }
    const body = req.method === 'GET' ? null : await req.json().catch(() => null)

    // ---- My networks, invitations and memberships ----
    if (req.method === 'GET' && sub.length === 0) {
      const adminRows = await db.select({ nodeId: networkAdmins.nodeId, role: networkAdmins.role }).from(networkAdmins).where(eq(networkAdmins.email, caller.email))
      const adminNodes = adminRows.length ? await db.select({ id: networkNodes.id, networkId: networkNodes.networkId }).from(networkNodes).where(inArray(networkNodes.id, adminRows.map((a) => a.nodeId))) : []
      // ponytail: scans every membership row to find the caller's organisations; index by org once networks are large
      const memberRows = await db.select().from(networkMembers).where(inArray(networkMembers.status, ['invited', 'accepted']))
      const myOrgIds = new Set(await filterAuthorizedOrgIds(caller, [...new Set(memberRows.map((m) => m.orgId))], 'write'))
      const mine = memberRows.filter((m) => myOrgIds.has(m.orgId))
      const mineNodes = mine.length ? await db.select().from(networkNodes).where(inArray(networkNodes.id, mine.map((m) => m.nodeId))) : []
      const netIds = new Set([...adminNodes.map((n) => n.networkId), ...mineNodes.map((n) => n.networkId)])
      const nets = isSuper(caller) ? await db.select().from(networks) : netIds.size ? await db.select().from(networks).where(inArray(networks.id, [...netIds])) : []
      const orgs = mine.length ? await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, [...new Set(mine.map((m) => m.orgId))])) : []
      const nodeById = new Map(mineNodes.map((n) => [n.id, n]))
      const netById = new Map(nets.map((n) => [n.id, n]))
      return json({
        canCreate: isSuper(caller),
        networks: nets.map((n) => ({ id: n.id, name: n.name, description: n.description, status: n.status, coordinating: adminNodes.some((a) => a.networkId === n.id) || isSuper(caller) })),
        memberships: mine.map((m) => {
          const node = nodeById.get(m.nodeId)
          return { id: m.id, status: m.status, sharing: m.sharing, orgId: m.orgId, orgName: orgs.find((o) => o.id === m.orgId)?.name ?? m.orgId,
            nodeName: node?.name ?? '', level: node?.level ?? '', networkId: node?.networkId ?? '', networkName: netById.get(node?.networkId ?? '')?.name ?? '' }
        }),
      })
    }

    // ---- Create a network (Super Admin) ----
    if (req.method === 'POST' && sub.length === 0) {
      if (!isSuper(caller)) return forbidden()
      const p = createSchema.safeParse(body)
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid network')
      if (!validGeoCode(p.data.root.level, p.data.root.geoCode)) return bad('That geography code does not fit the level')
      const id = newId('net'), rootId = newId('nnd')
      await db.insert(networks).values({ id, name: p.data.name, description: p.data.description, createdBy: caller.email })
      await db.insert(networkNodes).values({ id: rootId, networkId: id, parentId: null, level: p.data.root.level, name: p.data.root.name, geoCode: p.data.root.geoCode })
      await audit(caller.email, 'Created network', id)
      return json({ id, rootId }, 201)
    }

    // ---- An organisation decides on an invitation, changes sharing or leaves ----
    if (req.method === 'POST' && sub[0] === 'members' && sub.length === 2) {
      const p = decideSchema.safeParse(body)
      if (!p.success) return bad('Choose accept, decline, leave or sharing')
      const [m] = await db.select().from(networkMembers).where(eq(networkMembers.id, sub[1]))
      if (!m) return notFound()
      if (!(await canAccessOrg(caller, m.orgId, 'write'))) return forbidden()
      const { action } = p.data
      const sharing = p.data.sharing ?? m.sharing
      const allowed = (action === 'accept' || action === 'decline') ? m.status === 'invited' : m.status === 'accepted'
      if (!allowed) return json({ error: 'That is not possible for this membership now' }, 409)
      const status = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : action === 'leave' ? 'left' : m.status
      await db.update(networkMembers).set({ status, sharing, decidedBy: caller.email, decidedAt: new Date() }).where(eq(networkMembers.id, m.id))
      await audit(caller.email, action === 'sharing' ? `Network sharing set to ${sharing}` : `Network invitation ${status}`, m.id, m.orgId)
      return json({ status, sharing })
    }

    // ---- Everything else is about one network ----
    const loaded = sub[0] ? await load(sub[0]) : null
    if (!loaded) return notFound()
    const { net, nodes, admins, members } = loaded
    const coordScope = coordinatorScope(caller, nodes, admins, 'coordinator')
    const viewScope = coordinatorScope(caller, nodes, admins)

    if (req.method === 'GET' && sub.length === 1) {
      const myOrgIds = new Set(await filterAuthorizedOrgIds(caller, [...new Set(members.map((m) => m.orgId))], 'read'))
      const ownRows = members.filter((m) => myOrgIds.has(m.orgId) && m.status !== 'declined')
      if (viewScope.size === 0 && ownRows.length === 0) return notFound()
      const orgIds = [...new Set(members.filter((m) => viewScope.has(m.nodeId) && m.status === 'accepted' && m.sharing === 'full').map((m) => m.orgId))]
      const orgs = orgIds.length ? await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, orgIds)) : []
      const view = memberView(members, viewScope, (id) => orgs.find((o) => o.id === id)?.name ?? id)
      // Per-level counts so the tree can show where members are, without naming "totals only" members
      const perNode = Object.fromEntries(nodes.map((n) => [n.id, members.filter((m) => m.nodeId === n.id && m.status === 'accepted').length]))
      return json({
        network: { id: net.id, name: net.name, description: net.description, status: net.status },
        nodes: nodes.map((n) => ({ id: n.id, parentId: n.parentId, level: n.level, name: n.name, geoCode: n.geoCode, members: viewScope.has(n.id) ? perNode[n.id] : undefined })),
        coordinates: [...coordScope], views: [...viewScope],
        admins: admins.filter((a) => viewScope.has(a.nodeId)).map((a) => ({ nodeId: a.nodeId, email: a.email, role: a.role })),
        members: viewScope.size ? view : null,
        pending: members.filter((m) => coordScope.has(m.nodeId) && m.status === 'invited').length,
        mine: ownRows.map((m) => ({ id: m.id, nodeId: m.nodeId, orgId: m.orgId, status: m.status, sharing: m.sharing })),
      })
    }

    if (req.method === 'POST' && sub[1] === 'nodes' && sub.length === 2) {
      const p = nodeSchema.safeParse(body)
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid level')
      const parent = nodes.find((n) => n.id === p.data.parentId)
      if (!parent) return bad('Unknown parent level')
      if (!coordScope.has(parent.id)) return forbidden()
      if (!canNest(parent.level, p.data.level as NetworkLevel)) return bad('A level must sit below its parent')
      if (!validGeoCode(p.data.level as NetworkLevel, p.data.geoCode)) return bad('That geography code does not fit the level')
      const id = newId('nnd')
      await db.insert(networkNodes).values({ id, networkId: net.id, parentId: parent.id, level: p.data.level, name: p.data.name, geoCode: p.data.geoCode })
      await audit(caller.email, `Added network level ${p.data.name}`, id)
      return json({ id }, 201)
    }

    if (sub[1] === 'admins' && sub.length === 2 && (req.method === 'POST' || req.method === 'DELETE')) {
      const p = (req.method === 'POST' ? adminSchema : adminDeleteSchema).safeParse(body)
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid coordinator')
      if (!coordScope.has(p.data.nodeId)) return forbidden()
      if (req.method === 'DELETE') {
        await db.delete(networkAdmins).where(and(eq(networkAdmins.nodeId, p.data.nodeId), eq(networkAdmins.email, p.data.email)))
        await audit(caller.email, `Removed network coordinator ${p.data.email}`, p.data.nodeId)
        return json({ ok: true })
      }
      const role = (p.data as { role?: 'coordinator' | 'viewer' }).role ?? 'coordinator'
      await db.insert(networkAdmins).values({ nodeId: p.data.nodeId, email: p.data.email, role, addedBy: caller.email })
        .onConflictDoUpdate({ target: [networkAdmins.nodeId, networkAdmins.email], set: { role } })
      await audit(caller.email, `Added network ${role} ${p.data.email}`, p.data.nodeId)
      return json({ ok: true }, 201)
    }

    if (req.method === 'POST' && sub[1] === 'invitations' && sub.length === 2) {
      const p = inviteSchema.safeParse(body)
      if (!p.success) return bad('Choose a level and an organisation')
      if (!coordScope.has(p.data.nodeId)) return forbidden()
      const key = p.data.org
      const [org] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations)
        .where(or(eq(organizations.id, key), eq(organizations.email, key.toLowerCase()))).limit(1)
      if (!org) return json({ error: 'No CRAFT organisation has that ID or contact email. Ask them to register first.' }, 404)
      const existing = members.find((m) => m.nodeId === p.data.nodeId && m.orgId === org.id)
      if (existing && (existing.status === 'invited' || existing.status === 'accepted')) return json({ error: `${org.name} is already invited or a member here` }, 409)
      if (existing) {
        await db.update(networkMembers).set({ status: 'invited', invitedBy: caller.email, invitedAt: new Date(), decidedBy: null, decidedAt: null }).where(eq(networkMembers.id, existing.id))
      } else {
        await db.insert(networkMembers).values({ id: newId('nmb'), nodeId: p.data.nodeId, orgId: org.id, invitedBy: caller.email })
      }
      await audit(caller.email, `Invited ${org.name} to network`, p.data.nodeId, org.id)
      return json({ ok: true, orgName: org.name }, 201)
    }

    return notFound()
  } catch (err) {
    logger.error('networks', 'request failed', err)
    return json({ error: 'Request failed' }, 500)
  }
}

export const config: Config = { path: ['/api/networks', '/api/networks/*'] }

export default monitored(handleRequest)
