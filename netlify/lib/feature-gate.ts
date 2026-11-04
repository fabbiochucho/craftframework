import { and, eq, inArray } from 'drizzle-orm'
import { db, featureSwitches, networkAdmins, networkMembers, networkNodes, organizations } from '../../db/index.js'
import { isSuperAdmin, resolveCaller, type Caller } from './auth.js'
import { decide, FEATURES, featureForPath, type Decision, type Scope, type Switch, type Who } from '../../src/lib/features.js'

// Server side of the feature switches. Every function runs through `monitored()`, which calls `featureBlock()` for
// any API path a feature owns, so a switched-off feature is refused everywhere at once.

const TTL_MS = 60_000
let cache: { at: number; switches: Switch[] } | null = null

/** All switches, cached for a minute per function instance (a change reaches every instance within a minute). */
export async function loadSwitches(): Promise<Switch[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.switches
  const rows = await db.select().from(featureSwitches)
  const switches = rows.map((r) => ({ feature: r.feature, scope: r.scope as Scope, scopeId: r.scopeId, enabled: r.enabled, reason: r.reason, expiresAt: r.expiresAt?.toISOString() ?? null }))
  cache = { at: Date.now(), switches }
  return switches
}
export const clearSwitchCache = () => { cache = null }

/** The groups a person belongs to: their organisation's type and country, and the networks it (or they) belong to. */
export async function whoFor(email: string, orgId: string): Promise<Who> {
  const [org] = orgId ? await db.select({ archetype: organizations.archetype, country: organizations.country }).from(organizations).where(eq(organizations.id, orgId)) : []
  const nodeIds = [
    ...(orgId ? await db.select({ id: networkMembers.nodeId }).from(networkMembers).where(and(eq(networkMembers.orgId, orgId), eq(networkMembers.status, 'accepted'))) : []),
    ...(email ? await db.select({ id: networkAdmins.nodeId }).from(networkAdmins).where(eq(networkAdmins.email, email)) : []),
  ].map((r) => r.id)
  const nets = nodeIds.length ? await db.selectDistinct({ id: networkNodes.networkId }).from(networkNodes).where(inArray(networkNodes.id, nodeIds)) : []
  return { email, orgId, archetype: org?.archetype ?? '', country: org?.country ?? '', networkIds: nets.map((n) => n.id) }
}

/** Every feature's decision for one person. The Super Admin always has everything on, so nothing can lock them out. */
export async function effectiveFor(caller: Pick<Caller, 'email' | 'orgId' | 'role'>): Promise<Record<string, Decision>> {
  const switches = await loadSwitches()
  const out: Record<string, Decision> = {}
  if (isSuperAdmin(caller.email) && caller.role === 'super_admin') {
    for (const f of FEATURES) out[f.key] = { enabled: true, scope: 'default', scopeId: '', reason: '' }
    return out
  }
  const who = switches.length && (caller.email || caller.orgId) ? await whoFor(caller.email, caller.orgId) : { email: caller.email, orgId: caller.orgId, archetype: '', country: '', networkIds: [] }
  for (const f of FEATURES) out[f.key] = decide(f.key, who, switches)
  return out
}

/** A 403 when the request's API path belongs to a feature that is off for the caller; otherwise null. */
export async function featureBlock(req: Request): Promise<Response | null> {
  const feature = featureForPath(new URL(req.url).pathname, 'api')
  if (!feature) return null
  const switches = await loadSwitches()
  if (!switches.some((s) => s.feature === feature.key)) return null
  const caller = await resolveCaller()
  // Signed-out requests are left to the endpoint, except when the feature is off for everyone.
  if (!caller) {
    const d = decide(feature.key, { email: '', orgId: '', archetype: '', country: '', networkIds: [] }, switches)
    return d.enabled ? null : off(feature.label, d.reason)
  }
  if (isSuperAdmin(caller.email) && caller.role === 'super_admin') return null
  const d = decide(feature.key, await whoFor(caller.email, caller.orgId), switches)
  return d.enabled ? null : off(feature.label, d.reason)
}

const off = (label: string, reason: string) =>
  Response.json({ error: 'feature_off', message: `${label} is switched off${reason ? `: ${reason}` : '.'}` }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
