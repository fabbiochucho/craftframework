// CRAFT Capacity Assessment results in CRAFT networks: what a coordinator sees for a level and the levels below it.
// Same rules as network results (src/lib/networkResults.ts): accepted members only, each organisation once; a group
// under MIN_GROUP organisations is hidden unless every member in it chose named results; organisations are named only
// when they chose named results ("full" sharing). Each member counts once, with its latest completed whole-body
// assessment of the chosen module. Self-check: `node src/lib/cca/networkFeed.test.ts`.
import { rollup, type Dashboard, type GrowthLevel } from './engine.ts'
import { distinctAcceptedOrgs, everyoneNamed, MIN_GROUP, showable, subtree, type NetworkMember, type NetworkNode } from '../networks.ts'

export type MemberResult = { orgId: string; year: number; dashboard: Dashboard }
export type FeedGroup = {
  nodeId: string; name: string; members: number; withResults: number; shown: boolean
  areas: { id: string; name: string; percent: number; level: GrowthLevel }[] | null; percent: number | null; level: GrowthLevel | null
}
export type NetworkCcaFeed = { minGroup: number; overall: FeedGroup; children: FeedGroup[]; named: { orgId: string; name: string; nodeId: string; year: number; percent: number; level: GrowthLevel }[] }

function group(nodes: NetworkNode[], members: NetworkMember[], results: Map<string, MemberResult>, node: NetworkNode): FeedGroup {
  const scope = subtree(nodes, node.id)
  const orgs = distinctAcceptedOrgs(members, scope)
  const have = orgs.map((o) => results.get(o)).filter((r): r is MemberResult => !!r)
  const shown = showable(have.length, everyoneNamed(members, scope))
  const g = shown && have.length ? rollup(have.map((r) => ({ region: node.name, district: r.orgId, dashboard: r.dashboard }))).overall : null
  return {
    nodeId: node.id, name: node.name, members: orgs.length, withResults: have.length, shown: shown && !!g,
    areas: g ? g.areas.map((a) => ({ id: a.id, name: a.name, percent: a.percent, level: a.level })) : null,
    percent: g ? g.percent : null, level: g ? g.level : null,
  }
}

/** The coordinator's view of one level: that level overall, each level directly below it, and named members. */
export function networkCcaFeed(nodes: NetworkNode[], members: NetworkMember[], results: MemberResult[], nodeId: string, orgName: (id: string) => string): NetworkCcaFeed | null {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const byOrg = new Map(results.map((r) => [r.orgId, r]))
  const scope = subtree(nodes, nodeId)
  const named = new Map<string, NetworkMember>()
  for (const m of members) if (m.status === 'accepted' && m.sharing === 'full' && scope.has(m.nodeId) && !named.has(m.orgId)) named.set(m.orgId, m)
  return {
    minGroup: MIN_GROUP,
    overall: group(nodes, members, byOrg, node),
    children: nodes.filter((n) => n.parentId === nodeId && n.status !== 'archived').map((c) => group(nodes, members, byOrg, c)),
    named: [...named.values()].filter((m) => byOrg.has(m.orgId)).map((m) => {
      const r = byOrg.get(m.orgId)!
      return { orgId: m.orgId, name: orgName(m.orgId), nodeId: m.nodeId, year: r.year, percent: r.dashboard.percent, level: r.dashboard.level }
    }).sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/** Each organisation's latest completed whole-body assessment of a module (grant-stage and place assessments excluded). */
export function latestPerOrg<T extends { orgId: string; module: string; year: number; awardRef: string; region?: string; district?: string; status: string; completedAt: string | null }>(rows: T[], module: string): T[] {
  const best = new Map<string, T>()
  for (const r of rows) {
    if (r.module !== module || r.awardRef || r.region || r.district || r.status !== 'complete') continue
    const cur = best.get(r.orgId)
    if (!cur || r.year > cur.year || (r.year === cur.year && (r.completedAt ?? '') > (cur.completedAt ?? ''))) best.set(r.orgId, r)
  }
  return [...best.values()]
}
