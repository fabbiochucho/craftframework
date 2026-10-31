// Learning between members and what follows from results: the exchange log, pairing suggestions, the network's
// capacity-building plan, and progress between rounds (including a careful contribution view for exchanges).
// Self-check: `node src/lib/networkExchange.test.ts`.
import { bandFor, dimensionScore, type FoundationModule } from './foundationModules.ts'
import { MIN_GROUP } from './networks.ts'
import { stats, type Capacity, type Submission } from './networkResults.ts'

export const EXCHANGE_TYPES = ['peer-learning', 'exchange-visit', 'study-tour', 'conference', 'mentoring', 'twinning', 'community-of-practice', 'joint-training'] as const
export type ExchangeType = (typeof EXCHANGE_TYPES)[number]
export const EXCHANGE_LABEL: Record<ExchangeType, string> = {
  'peer-learning': 'Peer learning session', 'exchange-visit': 'Exchange visit', 'study-tour': 'Study tour', conference: 'Conference or forum',
  mentoring: 'Mentoring pair', twinning: 'Twinning partnership', 'community-of-practice': 'Community of practice', 'joint-training': 'Joint training',
}

/** A dimension below this median (0-5) counts as a gap for planning; at or above STRONG a member can mentor others. */
export const GAP_BELOW = 2.75
export const STRONG_FROM = 3.75

// ---- Pairing: strong members with weak ones, per area, among members who share named results ----
export function pairings(m: FoundationModule, named: Array<Submission & { name: string }>, maxPerArea = 3) {
  return m.dimensions.map((d) => {
    const scored = named.map((s) => ({ orgId: s.orgId, name: s.name, score: dimensionScore(m, d.key, s.scores) })).filter((x): x is { orgId: string; name: string; score: number } => x.score != null)
    const strong = scored.filter((x) => x.score >= STRONG_FROM).sort((a, b) => b.score - a.score)
    const weak = scored.filter((x) => x.score < GAP_BELOW).sort((a, b) => a.score - b.score)
    const pairs = weak.slice(0, maxPerArea).map((w, i) => ({ learner: w, mentor: strong[i % Math.max(1, strong.length)] })).filter((p) => p.mentor)
    return { key: d.key, name: d.name, pairs }
  }).filter((a) => a.pairs.length > 0)
}

// ---- The network's capacity-building plan ----
const SUPPORT_BY_SHARE = (share: number) =>
  share >= 0.5 ? 'Run a network-wide training with follow-up coaching, and share templates members can adapt.'
    : share >= 0.25 ? 'Run a peer learning session or study tour hosted by members who are strong in this area.'
      : 'Pair the members who need it with a mentor from the network.'

/** For each area: how many members are below the gap line, and what kind of collective support fits that share. */
export function capacityPlan(m: FoundationModule, cap: Capacity, subs: Submission[], exchangesByArea: Record<string, number>) {
  if (cap.suppressed) return null
  return m.dimensions.map((d) => {
    const scores = subs.map((s) => dimensionScore(m, d.key, s.scores)).filter((v): v is number => v != null)
    const below = scores.filter((v) => v < GAP_BELOW).length
    const share = scores.length ? below / scores.length : 0
    return { key: d.key, name: d.name, median: cap.dimensions.find((x) => x.key === d.key)?.stats?.median ?? null, membersBelow: below, share: Math.round(share * 100),
      support: below === 0 ? null : SUPPORT_BY_SHARE(share), exchangesHeld: exchangesByArea[d.key] ?? 0 }
  }).filter((a) => a.membersBelow > 0).sort((a, b) => b.membersBelow - a.membersBelow)
}

// ---- Progress between two rounds of the same instrument ----
/** Compares the members present in both rounds (the cohort); members new in the later round are counted separately. */
export function progressBetween(m: FoundationModule, earlier: Submission[], later: Submission[]) {
  const before = new Map(earlier.map((s) => [s.orgId, s.scores]))
  const cohort = later.filter((s) => before.has(s.orgId))
  const newMembers = later.length - cohort.length
  if (cohort.length < MIN_GROUP) return { cohort: cohort.length, newMembers, suppressed: true as const, areas: null, movedUp: null, movedDown: null }
  const areas = m.dimensions.map((d) => {
    const changes = cohort.map((s) => {
      const a = dimensionScore(m, d.key, before.get(s.orgId)!), b = dimensionScore(m, d.key, s.scores)
      return a == null || b == null ? null : b - a
    }).filter((x): x is number => x != null)
    const st = stats(changes)
    return { key: d.key, name: d.name, medianChange: st?.median ?? null, improved: changes.filter((c) => c > 0).length, declined: changes.filter((c) => c < 0).length }
  })
  let up = 0, down = 0
  for (const s of cohort) {
    const a = bandFor(m, before.get(s.orgId)!), b = bandFor(m, s.scores)
    if (!a || !b) continue
    const ia = m.bands.indexOf(a.band), ib = m.bands.indexOf(b.band)
    if (ib > ia) up++
    else if (ib < ia) down++
  }
  return { cohort: cohort.length, newMembers, suppressed: false as const, areas, movedUp: up, movedDown: down }
}

/**
 * Contribution view for one area: median change for cohort members who took part in an exchange on that area,
 * against those who didn't. Shown only when both groups have MIN_GROUP members. It is a comparison, never proof
 * that the exchange caused the change.
 */
export function exchangeContribution(m: FoundationModule, areaKey: string, earlier: Submission[], later: Submission[], participants: Set<string>) {
  const before = new Map(earlier.map((s) => [s.orgId, s.scores]))
  const change = (s: Submission) => {
    const a = dimensionScore(m, areaKey, before.get(s.orgId)!), b = dimensionScore(m, areaKey, s.scores)
    return a == null || b == null ? null : b - a
  }
  const cohort = later.filter((s) => before.has(s.orgId))
  const took = cohort.filter((s) => participants.has(s.orgId)).map(change).filter((x): x is number => x != null)
  const didnt = cohort.filter((s) => !participants.has(s.orgId)).map(change).filter((x): x is number => x != null)
  if (took.length < MIN_GROUP || didnt.length < MIN_GROUP) return { shown: false as const, took: took.length, didnt: didnt.length }
  return { shown: true as const, took: took.length, didnt: didnt.length, tookMedian: stats(took)!.median, didntMedian: stats(didnt)!.median }
}

// ---- CSV export: aggregates per level and area; named rows only for members who chose named results ----
const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  // Neutralise spreadsheet formulas and quote anything with separators
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n'
