// Shared by /api/networks and /api/network-rounds: loading a network and working out who may do what in it.
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { auditLogs, networkAdmins, networkMembers, networkNodes, networks } from '../../db/schema.js'
import type { Caller } from './auth.js'
import { adminScope, type NetworkAdmin, type NetworkMember, type NetworkNode } from '../../src/lib/networks.js'

export const isSuper = (c: Caller) => c.role === 'super_admin' && !c.readOnly
export const audit = (actor: string, action: string, target: string, orgId?: string) =>
  db.insert(auditLogs).values({ actor, action, target, category: 'Network', orgId: orgId ?? null })

export async function load(networkId: string) {
  const [net] = await db.select().from(networks).where(eq(networks.id, networkId))
  if (!net) return null
  const nodes = (await db.select().from(networkNodes).where(eq(networkNodes.networkId, networkId))) as NetworkNode[]
  const ids = nodes.map((n) => n.id)
  const admins = ids.length ? await db.select().from(networkAdmins).where(inArray(networkAdmins.nodeId, ids)) : []
  const members = ids.length ? await db.select().from(networkMembers).where(inArray(networkMembers.nodeId, ids)) : []
  return { net, nodes, admins: admins as (NetworkAdmin & { addedBy: string })[], members: members as (NetworkMember & { invitedAt: Date })[] }
}

/** Nodes the caller coordinates (all nodes for the Super Admin). */
export function coordinatorScope(c: Caller, nodes: NetworkNode[], admins: NetworkAdmin[], role?: NetworkAdmin['role']) {
  return isSuper(c) ? new Set(nodes.map((n) => n.id)) : adminScope(nodes, admins, c.email, role)
}

