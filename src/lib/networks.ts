// Civil society networks: a tree of levels (global → organisation) with member organisations and coordinators.
// Pure rules shared by the API and the pages. Self-check: `node src/lib/networks.test.ts`.

export const NETWORK_LEVELS = ['global', 'continental', 'subregional', 'national', 'subnational', 'local'] as const
export type NetworkLevel = (typeof NETWORK_LEVELS)[number]

export const LEVEL_LABEL: Record<NetworkLevel, string> = {
  global: 'Global', continental: 'Continental (e.g. Africa)', subregional: 'Sub-regional (e.g. ECOWAS, EAC)',
  national: 'National', subnational: 'State or province', local: 'Local (district, LGA or county)',
}

export const SHARING = ['aggregate', 'full'] as const
export type Sharing = (typeof SHARING)[number]
export const SHARING_LABEL: Record<Sharing, string> = {
  aggregate: 'Totals only: counted in network results, never named',
  full: 'Named results: coordinators at my level and above see my scores',
}

export const MEMBER_STATUSES = ['invited', 'accepted', 'declined', 'left'] as const
export type MemberStatus = (typeof MEMBER_STATUSES)[number]

/** Groups smaller than this are never shown as results, so no single organisation can be identified. */
export const MIN_GROUP = 5

export interface NetworkNode { id: string; networkId: string; parentId: string | null; level: NetworkLevel; name: string; geoCode: string }
export interface NetworkAdmin { nodeId: string; email: string; role: 'coordinator' | 'viewer' }
export interface NetworkMember { id: string; nodeId: string; orgId: string; status: MemberStatus; sharing: Sharing }

const rank = (l: NetworkLevel) => NETWORK_LEVELS.indexOf(l)

/** A child sits strictly below its parent (levels may be skipped: a national network can go straight to local). */
export function canNest(parent: NetworkLevel, child: NetworkLevel): boolean {
  return rank(child) > rank(parent)
}

/** Geography codes: ISO 3166-1 alpha-2 (national), ISO 3166-2 (subnational, e.g. NG-LA), or a short region code. */
export function validGeoCode(level: NetworkLevel, code: string): boolean {
  if (code === '') return true
  if (level === 'national') return /^[A-Z]{2}$/.test(code)
  if (level === 'subnational') return /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(code)
  return /^[A-Z0-9-]{2,12}$/.test(code)
}

/** The node and everything below it. */
export function subtree(nodes: NetworkNode[], rootId: string): Set<string> {
  const out = new Set<string>([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const n of nodes) if (n.parentId && out.has(n.parentId) && !out.has(n.id)) { out.add(n.id); grew = true }
  }
  return out
}

/** Path from the root down to this node (inclusive). */
export function ancestry(nodes: NetworkNode[], nodeId: string): NetworkNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const path: NetworkNode[] = []
  for (let n = byId.get(nodeId); n; n = n.parentId ? byId.get(n.parentId) : undefined) {
    path.unshift(n)
    if (path.length > NETWORK_LEVELS.length + 1) break // defensive: never loop on bad data
  }
  return path
}

/** Every node this person coordinates or views: the nodes they were added to and everything below them. */
export function adminScope(nodes: NetworkNode[], admins: NetworkAdmin[], email: string, role?: NetworkAdmin['role']): Set<string> {
  const out = new Set<string>()
  for (const a of admins) {
    if (a.email !== email.toLowerCase() || (role && a.role !== role)) continue
    for (const id of subtree(nodes, a.nodeId)) out.add(id)
  }
  return out
}

/**
 * What a coordinator sees of the members in their scope: named rows only for accepted members who chose "full";
 * everyone else is a count. Counts per status are always safe (they say nothing about results).
 */
export function memberView(members: NetworkMember[], scope: Set<string>, orgName: (id: string) => string) {
  const inScope = members.filter((m) => scope.has(m.nodeId))
  const accepted = inScope.filter((m) => m.status === 'accepted')
  return {
    counts: { invited: inScope.filter((m) => m.status === 'invited').length, accepted: accepted.length, declined: inScope.filter((m) => m.status === 'declined').length },
    named: accepted.filter((m) => m.sharing === 'full').map((m) => ({ memberId: m.id, nodeId: m.nodeId, orgId: m.orgId, name: orgName(m.orgId) })),
    totalsOnly: accepted.filter((m) => m.sharing === 'aggregate').length,
  }
}

/** Accepted members counted once each, even if an organisation belongs at two levels of the same network. */
export function distinctAcceptedOrgs(members: NetworkMember[], scope: Set<string>): string[] {
  return [...new Set(members.filter((m) => m.status === 'accepted' && scope.has(m.nodeId)).map((m) => m.orgId))]
}

/** Whether a group is big enough to show results for. */
export const showable = (n: number) => n >= MIN_GROUP
