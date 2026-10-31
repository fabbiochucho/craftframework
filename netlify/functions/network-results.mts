import type { Config } from '@netlify/functions'
import { and, eq, gt, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { capacityActions, networkExchanges, networkRoundSubmissions, networkRounds, networkValueResponses, organizations, validations } from '../../db/schema.js'
import { filterAuthorizedOrgIds, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { audit, coordinatorScope, load } from '../lib/network-access.js'
import { MIN_GROUP, distinctAcceptedOrgs, subtree } from '../../src/lib/networks.js'
import { instrumentById } from '../../src/lib/networkRounds.js'
import { bandFor, compositeScore } from '../../src/lib/foundationModules.js'
import {
  benchmark, capacity, heatmap, scorecardLines, topGaps, useFunnel, valueSummary, type Submission, type ValueAnswers,
} from '../../src/lib/networkResults.js'
import { capacityPlan, exchangeContribution, pairings, progressBetween, toCsv } from '../../src/lib/networkExchange.js'

// /api/network-results/:roundId?nodeId=  the Network Value Scorecard for one level of a round (src/lib/networkResults.ts)
//   coordinators and viewers of that level: capacity spread, heatmap of the levels below, top gaps, value added, use,
//     and named results only for members who chose "named results"
//   members: where their own organisation sits against its round group (never other members' data)
//   GET :roundId/plan?nodeId=        coordinators: the network's capacity-building plan and pairing suggestions
//   GET :roundId/progress?baseline=  coordinators: change since an earlier round of the same assessment (cohort only)
//   GET :roundId/export.csv?nodeId=  coordinators: aggregates per level and area; named rows only for named-results members
// Every aggregate under MIN_GROUP members is withheld.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const notFound = () => json({ error: 'Not found' }, 404)

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
    const url = new URL(req.url)
    const [roundId, extra] = url.pathname.replace(/^\/api\/network-results\/?/, '').split('/').filter(Boolean)
    const [round] = roundId ? await db.select().from(networkRounds).where(eq(networkRounds.id, roundId)) : []
    if (!round) return notFound()
    const loaded = await load(round.networkId)
    const m = instrumentById(round.instrument)
    if (!loaded || !m) return notFound()
    const { nodes, admins, members } = loaded
    const roundScope = subtree(nodes, round.nodeId)
    const nodeId = url.searchParams.get('nodeId') || round.nodeId
    if (!roundScope.has(nodeId)) return notFound()
    const view = coordinatorScope(caller, nodes, admins)

    const subRows = await db.select().from(networkRoundSubmissions).where(eq(networkRoundSubmissions.roundId, round.id))
    // Only accepted members count; an organisation that left after submitting drops out of results.
    const subsIn = (scope: Set<string>): Submission[] => {
      const orgs = new Set(distinctAcceptedOrgs(members, scope))
      return subRows.filter((s) => orgs.has(s.orgId)).map((s) => ({ orgId: s.orgId, scores: s.scores }))
    }

    // ---- Members: their own benchmark only ----
    if (!view.has(nodeId)) {
      const mine = await filterAuthorizedOrgIds(caller, distinctAcceptedOrgs(members, roundScope), 'read')
      if (!mine.length) return notFound()
      const group = capacity(m, subsIn(roundScope))
      const out = mine.map((orgId) => {
        const own = subRows.find((s) => s.orgId === orgId)
        return { orgId, submitted: !!own, groupSize: group.n, benchmark: own ? benchmark(m, own.scores, group) : null,
          composite: own ? compositeScore(m, own.scores) : null, band: own ? bandFor(m, own.scores)?.band.label ?? null : null }
      })
      return json({ role: 'member', round: { id: round.id, name: round.name, instrumentTitle: m.title }, minGroup: MIN_GROUP, mine: out })
    }

    // ---- Coordinators and viewers ----
    const scope = subtree(nodes, nodeId)
    const subs = subsIn(scope)
    const cap = capacity(m, subs)
    const fullSharers = new Set(members.filter((x) => scope.has(x.nodeId) && x.status === 'accepted' && x.sharing === 'full').map((x) => x.orgId))
    const nameOf = async (ids: string[]) => ids.length ? await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, ids)) : []
    const exchanges = (await db.select().from(networkExchanges).where(and(eq(networkExchanges.networkId, round.networkId), eq(networkExchanges.instrument, m.id))))
      .filter((e) => scope.has(e.nodeId) || subtree(nodes, e.nodeId).has(nodeId))

    if (extra === 'plan') {
      const byArea: Record<string, number> = {}
      for (const e of exchanges) for (const a of e.areas) byArea[a] = (byArea[a] ?? 0) + 1
      const namedSubs = subs.filter((x) => fullSharers.has(x.orgId))
      const names = await nameOf(namedSubs.map((x) => x.orgId))
      return json({ minGroup: MIN_GROUP, plan: capacityPlan(m, cap, subs, byArea),
        pairings: pairings(m, namedSubs.map((x) => ({ ...x, name: names.find((n) => n.id === x.orgId)?.name ?? x.orgId }))) })
    }

    if (extra === 'progress') {
      const baselineId = url.searchParams.get('baseline') ?? ''
      const earlierRounds = (await db.select().from(networkRounds).where(and(eq(networkRounds.networkId, round.networkId), eq(networkRounds.instrument, m.id))))
        .filter((r) => r.id !== round.id && r.opensOn <= round.opensOn)
      const base = earlierRounds.find((r) => r.id === baselineId) ?? earlierRounds.sort((a, b) => b.opensOn.localeCompare(a.opensOn))[0]
      if (!base) return json({ minGroup: MIN_GROUP, baselines: [], progress: null, contribution: [] })
      const baseRows = await db.select().from(networkRoundSubmissions).where(eq(networkRoundSubmissions.roundId, base.id))
      const accepted = new Set(distinctAcceptedOrgs(members, scope))
      const earlier = baseRows.filter((x) => accepted.has(x.orgId)).map((x) => ({ orgId: x.orgId, scores: x.scores }))
      const contribution = m.dimensions.map((d) => {
        const took = new Set(exchanges.filter((e) => e.areas.includes(d.key)).flatMap((e) => e.orgIds))
        return { key: d.key, name: d.name, ...exchangeContribution(m, d.key, earlier, subs, took) }
      })
      return json({ minGroup: MIN_GROUP, baseline: { id: base.id, name: base.name },
        baselines: earlierRounds.map((r) => ({ id: r.id, name: r.name, opensOn: r.opensOn })),
        progress: progressBetween(m, earlier, subs), contribution })
    }

    if (extra === 'export.csv') {
      const levelRows = [nodes.find((n) => n.id === nodeId)!, ...nodes.filter((n) => n.parentId === nodeId)]
      const rows: unknown[][] = [['Level', 'Level type', 'Area', 'Members submitted', 'Median', 'Lower quartile', 'Upper quartile']]
      for (const lv of levelRows) {
        const c = capacity(m, subsIn(subtree(nodes, lv.id)))
        for (const d of c.dimensions) rows.push([lv.name, lv.level, d.name, c.n, d.stats?.median ?? (c.suppressed ? 'hidden (fewer than 5)' : ''), d.stats?.q1 ?? '', d.stats?.q3 ?? ''])
      }
      const namedSubs = subs.filter((x) => fullSharers.has(x.orgId))
      if (namedSubs.length) {
        const names = await nameOf(namedSubs.map((x) => x.orgId))
        rows.push([], ['Members sharing named results', '', 'Overall score (0-5)', 'Band'])
        for (const x of namedSubs) rows.push([names.find((n) => n.id === x.orgId)?.name ?? x.orgId, '', compositeScore(m, x.scores), bandFor(m, x.scores)?.band.label ?? ''])
      }
      await audit(caller.email, 'Exported network results (CSV)', round.id)
      return new Response(toCsv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="network-results-${round.id}.csv"`, 'Cache-Control': 'private, no-store' } })
    }
    const accepted = distinctAcceptedOrgs(members, scope)
    const valueRows = accepted.length ? await db.select({ orgId: networkValueResponses.orgId, answers: networkValueResponses.answers }).from(networkValueResponses)
      .where(and(eq(networkValueResponses.roundId, round.id), inArray(networkValueResponses.orgId, accepted))) : []
    const value = valueSummary(valueRows.map((v) => v.answers as ValueAnswers))

    // Use: from joining to validation, counted over accepted members at this level
    const invited = new Set(members.filter((x) => scope.has(x.nodeId)).map((x) => x.orgId)).size
    const roundIds = (await db.select({ id: networkRounds.id }).from(networkRounds).where(eq(networkRounds.networkId, round.networkId))).map((r) => r.id)
    const allSubs = accepted.length && roundIds.length ? await db.select({ orgId: networkRoundSubmissions.orgId, roundId: networkRoundSubmissions.roundId })
      .from(networkRoundSubmissions).where(and(inArray(networkRoundSubmissions.roundId, roundIds), inArray(networkRoundSubmissions.orgId, accepted))) : []
    const roundsPerOrg = new Map<string, number>()
    for (const s of allSubs) roundsPerOrg.set(s.orgId, (roundsPerOrg.get(s.orgId) ?? 0) + 1)
    const actions = accepted.length ? await db.select({ orgId: capacityActions.orgId, status: capacityActions.status }).from(capacityActions).where(inArray(capacityActions.orgId, accepted)) : []
    const valid = accepted.length ? await db.select({ orgId: validations.orgId }).from(validations).where(and(inArray(validations.orgId, accepted), gt(validations.expiresAt, new Date()))) : []
    const use = useFunnel({
      invited, accepted: accepted.length, submitted: subs.length,
      withPlan: new Set(actions.map((a) => a.orgId)).size,
      actionsDone: new Set(actions.filter((a) => a.status === 'Completed-Validated').map((a) => a.orgId)).size,
      reassessed: [...roundsPerOrg.values()].filter((n) => n >= 2).length,
      validated: new Set(valid.map((v) => v.orgId)).size,
    })

    // Named results: only members who chose "named results", at this level and below
    const fullOrgIds = [...fullSharers]
    const names = await nameOf(fullOrgIds)
    const named = subs.filter((s) => fullOrgIds.includes(s.orgId)).map((s) => ({
      orgId: s.orgId, name: names.find((n) => n.id === s.orgId)?.name ?? s.orgId, composite: compositeScore(m, s.scores), band: bandFor(m, s.scores)?.band.label ?? null,
    })).sort((a, b) => a.composite - b.composite)
    if (named.length) await audit(caller.email, `Viewed named network results (${named.length})`, round.id)

    const node = nodes.find((n) => n.id === nodeId)!
    return json({
      role: 'coordinator', minGroup: MIN_GROUP,
      round: { id: round.id, name: round.name, instrumentTitle: m.title, nodeId: round.nodeId },
      node: { id: node.id, name: node.name, level: node.level },
      levels: nodes.filter((n) => roundScope.has(n.id) && view.has(n.id)).map((n) => ({ id: n.id, name: n.name, level: n.level, parentId: n.parentId })),
      scorecard: scorecardLines(cap, value, use, m),
      capacity: cap, gaps: cap.suppressed ? [] : topGaps(cap), heatmap: heatmap(m, nodes, nodeId, subsIn),
      value, use, named,
    })
  } catch (err) {
    logger.error('network-results', 'request failed', err)
    return json({ error: 'Request failed' }, 500)
  }
}

export const config: Config = { path: ['/api/network-results', '/api/network-results/*'] }

export default monitored(handleRequest)
