// Network results from submitted round snapshots: the Network Value Scorecard's three parts, reported side by side.
//   Capacity     how strong members are: a spread per domain (median, quartiles, members per band), never one average
//   Value added  what members say the network gave them (member value survey)
//   Use          whether assessment turns into action (invited → assessed → improving → validated)
// Any group under MIN_GROUP organisations is suppressed so no member can be identified, unless every member in it chose
// named results (then nobody is identified against their wishes).
// Self-check: `node src/lib/networkResults.test.ts`.
import { bandFor, compositeScore, dimensionScore, type FoundationModule } from './foundationModules.ts'
import { MIN_GROUP, showable, subtree, type NetworkNode } from './networks.ts'

export interface Submission { orgId: string; scores: Record<string, number> }
export interface Stats { n: number; median: number; q1: number; q3: number; min: number; max: number }

const r2 = (x: number) => Math.round(x * 100) / 100

/** Quartiles by linear interpolation (the spreadsheet QUARTILE.INC method). */
export function stats(values: number[]): Stats | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const at = (p: number) => {
    const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i)
    return r2(s[lo] + (s[hi] - s[lo]) * (i - lo))
  }
  return { n: s.length, median: at(0.5), q1: at(0.25), q3: at(0.75), min: s[0], max: s[s.length - 1] }
}

export interface Capacity {
  n: number
  suppressed: boolean
  composite: Stats | null
  bands: Array<{ label: string; tone: string; count: number }> | null
  dimensions: Array<{ key: string; name: string; stats: Stats | null }>
}

/** A group's capacity. Below MIN_GROUP everything but the count is withheld. */
export function capacity(m: FoundationModule, subs: Submission[], allNamed = false): Capacity {
  const n = subs.length
  const suppressed = !showable(n, allNamed)
  const dims = m.dimensions.map((d) => ({
    key: d.key, name: d.name,
    stats: suppressed ? null : stats(subs.map((s) => dimensionScore(m, d.key, s.scores)).filter((v): v is number => v != null)),
  }))
  if (suppressed) return { n, suppressed, composite: null, bands: null, dimensions: dims }
  const bandCounts = m.bands.map((b) => ({ label: b.label, tone: b.tone, count: 0 }))
  for (const s of subs) {
    const b = bandFor(m, s.scores)
    if (b) bandCounts[m.bands.indexOf(b.band)].count++
  }
  return { n, suppressed, composite: stats(subs.map((s) => compositeScore(m, s.scores))), bands: bandCounts, dimensions: dims }
}

/** The domains where the group is weakest (lowest median), for the network's capacity-building plan. */
export function topGaps(c: Capacity, k = 3) {
  return c.dimensions.filter((d) => d.stats).sort((a, b) => a.stats!.median - b.stats!.median).slice(0, k).map((d) => ({ key: d.key, name: d.name, median: d.stats!.median }))
}

/** Domains (rows) × the child levels of a node (columns): each cell is a median, or null when under MIN_GROUP. */
export function heatmap(m: FoundationModule, nodes: NetworkNode[], nodeId: string, subsByNode: (scope: Set<string>) => Submission[], allNamed: (scope: Set<string>) => boolean = () => false) {
  const children = nodes.filter((n) => n.parentId === nodeId)
  const cols = children.map((c) => {
    const scope = subtree(nodes, c.id)
    const subs = subsByNode(scope)
    const named = allNamed(scope)
    return { nodeId: c.id, name: c.name, geoCode: c.geoCode, n: subs.length, cap: showable(subs.length, named) ? capacity(m, subs, named) : null }
  })
  return {
    columns: cols.map((c) => ({ nodeId: c.nodeId, name: c.name, geoCode: c.geoCode, n: c.n, shown: c.cap != null, median: c.cap?.composite?.median ?? null })),
    rows: m.dimensions.map((d) => ({ key: d.key, name: d.name, cells: cols.map((c) => c.cap?.dimensions.find((x) => x.key === d.key)?.stats?.median ?? null) })),
  }
}

/** Where one organisation sits against its group, per domain. Needs a shown (unsuppressed) group. */
export function benchmark(m: FoundationModule, own: Record<string, number>, group: Capacity) {
  if (group.suppressed) return null
  return m.dimensions.map((d) => {
    const s = group.dimensions.find((x) => x.key === d.key)?.stats
    const mine = dimensionScore(m, d.key, own)
    const position = mine == null || !s ? null : mine < s.q1 ? 'below' : mine > s.q3 ? 'above' : 'within'
    return { key: d.key, name: d.name, mine, median: s?.median ?? null, q1: s?.q1 ?? null, q3: s?.q3 ?? null, position }
  })
}

// ---- Value added: the member value survey ----
export const NETWORK_SERVICES = ['training', 'mentoring', 'exchange', 'information', 'referrals', 'joint-funding', 'advocacy', 'representation'] as const
export type NetworkService = (typeof NETWORK_SERVICES)[number]
export const SERVICE_LABEL: Record<NetworkService, string> = {
  training: 'Training and workshops', mentoring: 'Mentoring or coaching', exchange: 'Peer exchange, study tours and conferences',
  information: 'Information and updates', referrals: 'Referrals and introductions to funders or partners', 'joint-funding': 'Joint proposals and funding',
  advocacy: 'Joint advocacy', representation: 'Representation with government',
}
/** usefulness 1 (not useful) to 5 (very useful); absent = not used. recommend 0-10. */
export interface ValueAnswers { used: Partial<Record<NetworkService, number>>; recommend: number }

export function validValueAnswers(a: unknown): a is ValueAnswers {
  if (!a || typeof a !== 'object') return false
  const v = a as ValueAnswers
  if (!Number.isInteger(v.recommend) || v.recommend < 0 || v.recommend > 10) return false
  if (!v.used || typeof v.used !== 'object') return false
  return Object.entries(v.used).every(([k, x]) => (NETWORK_SERVICES as readonly string[]).includes(k) && Number.isInteger(x) && (x as number) >= 1 && (x as number) <= 5)
}

export function valueSummary(answers: ValueAnswers[], allNamed = false) {
  const n = answers.length
  if (!showable(n, allNamed)) return { n, suppressed: true as const, services: null, recommend: null }
  const services = NETWORK_SERVICES.map((s) => {
    const scores = answers.map((a) => a.used[s]).filter((x): x is number => x != null)
    return { key: s, label: SERVICE_LABEL[s], usedBy: scores.length, usedPct: Math.round((scores.length / n) * 100),
      helpfulPct: scores.length ? Math.round((scores.filter((x) => x >= 4).length / scores.length) * 100) : null }
  })
  const rec = answers.map((a) => a.recommend)
  const promoters = rec.filter((x) => x >= 9).length, detractors = rec.filter((x) => x <= 6).length
  return { n, suppressed: false as const, services, recommend: { average: r2(rec.reduce((a, b) => a + b, 0) / n), netScore: Math.round(((promoters - detractors) / n) * 100) } }
}

// ---- Use: from assessment to action ----
export interface UseCounts { invited: number; accepted: number; submitted: number; withPlan: number; actionsDone: number; reassessed: number; validated: number }
export function useFunnel(c: UseCounts) {
  const pct = (x: number) => (c.accepted ? Math.round((x / c.accepted) * 100) : 0)
  return [
    { key: 'accepted', label: 'Joined (accepted the invitation)', count: c.accepted, pct: c.invited ? Math.round((c.accepted / c.invited) * 100) : 0 },
    { key: 'submitted', label: 'Assessed in this round', count: c.submitted, pct: pct(c.submitted) },
    { key: 'withPlan', label: 'Have an improvement plan', count: c.withPlan, pct: pct(c.withPlan) },
    { key: 'actionsDone', label: 'Completed at least one improvement action', count: c.actionsDone, pct: pct(c.actionsDone) },
    { key: 'reassessed', label: 'Assessed in two or more rounds', count: c.reassessed, pct: pct(c.reassessed) },
    { key: 'validated', label: 'Hold an independent validation', count: c.validated, pct: pct(c.validated) },
  ]
}

/** One plain sentence per scorecard part, for the top of a level's page. */
export function scorecardLines(cap: Capacity, value: ReturnType<typeof valueSummary>, use: ReturnType<typeof useFunnel>, m: FoundationModule) {
  const capLine = cap.suppressed ? `Capacity: fewer than ${MIN_GROUP} members have submitted, so results are hidden.`
    : (() => {
      const top = [...(cap.bands ?? [])].sort((a, b) => b.count - a.count)[0]
      const gaps = topGaps(cap, 2).map((g) => g.name).join(' and ')
      return `Capacity: most members are ${top?.label ?? '—'} on the ${m.title}; weakest areas: ${gaps || '—'}.`
    })()
  const best = value.suppressed ? null : [...(value.services ?? [])].filter((s) => s.usedBy > 0).sort((a, b) => (b.helpfulPct ?? 0) - (a.helpfulPct ?? 0))[0]
  const valueLine = value.suppressed ? `Value added: fewer than ${MIN_GROUP} members answered the value survey.`
    : `Value added: ${best ? `${best.helpfulPct}% of members who used ${best.label.toLowerCase()} found it helpful` : 'no services used yet'}; would-recommend score ${value.recommend!.average}/10.`
  const done = use.find((u) => u.key === 'actionsDone')!
  return [capLine, valueLine, `Use: ${done.pct}% of members have completed at least one improvement action.`]
}

// ---- Network profile: three figures side by side, and an optional combined figure that says how it is made ----
/**
 * secretariat and members are 0-5 scores, useRate a percentage. The combined figure is the plain average of the three
 * on a 0-100 scale, shown only when all three exist, and always labelled with that formula.
 */
export function networkProfile(secretariat: number | null, membersMedian: number | null, useRate: number | null) {
  const parts = [
    { key: 'secretariat', label: "Secretariat's Network Capacity Index score", value: secretariat == null ? null : Math.round((secretariat / 5) * 100) },
    { key: 'members', label: "Members' median overall score (latest round)", value: membersMedian == null ? null : Math.round((membersMedian / 5) * 100) },
    { key: 'use', label: 'Members who completed at least one improvement action', value: useRate },
  ]
  const all = parts.every((x) => x.value != null)
  return {
    parts,
    combined: all ? Math.round(parts.reduce((a, x) => a + (x.value as number), 0) / 3) : null,
    formula: 'Combined figure = average of the three, each on a 0-100 scale (scores out of 5 are multiplied by 20). Shown only when all three are available.',
  }
}
