import type { Config } from '@netlify/functions'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { networkRoundSubmissions, networkRounds, programmeScorecardEntries, programmeScorecards } from '../../db/schema.js'
import { forbidden, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { audit, coordinatorScope, load } from '../lib/network-access.js'
import { NETWORK_LEVELS, distinctAcceptedOrgs, subtree, type NetworkNode } from '../../src/lib/networks.js'
import { instrumentById, roundState, validWindow } from '../../src/lib/networkRounds.js'
import { capacity } from '../../src/lib/networkResults.js'
import { COMPONENTS, TEMPLATES, changeSince, scoreUnit, summarise, templateById, validEntry, type UnitResult } from '../../src/lib/programmeScorecard.js'

// /api/network-scorecards — Programme Response Scorecards (src/lib/programmeScorecard.ts).
//   GET    ?networkId=      templates, and scorecards I coordinate or whose units I coordinate
//   POST   { networkId, nodeId, unitLevel, template, name, opensOn, closesOn }   coordinator of nodeId
//   GET    :id              coordinators of the scorecard's level: every unit's results, NACA-style summaries, change
//                           since the previous scorecard, and member capacity per unit; unit coordinators: their units
//   POST   :id/entries { nodeId, scores }   a coordinator of that unit, while the scorecard is open
// Units are places or coordinating bodies (e.g. states), not member organisations, so they are named.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string) => json({ error }, 400)
const notFound = () => json({ error: 'Not found' }, 404)
const today = () => new Date().toISOString().slice(0, 10)

const createSchema = z.object({
  networkId: z.string().max(80), nodeId: z.string().max(80), unitLevel: z.enum(NETWORK_LEVELS), template: z.string().max(60),
  name: z.string().trim().min(3).max(160), opensOn: z.string().max(10), closesOn: z.string().max(10),
}).strict()
const entrySchema = z.object({ nodeId: z.string().max(80), scores: z.record(z.string(), z.number()) }).strict()

const unitsOf = (nodes: NetworkNode[], rootId: string, level: string) => nodes.filter((n) => n.level === level && subtree(nodes, rootId).has(n.id))

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const url = new URL(req.url)
    const sub = url.pathname.replace(/^\/api\/network-scorecards\/?/, '').split('/').filter(Boolean)
    if (req.method !== 'GET') {
      if (caller.readOnly) return forbidden()
      const origin = req.headers.get('origin')
      if (origin && origin !== url.origin) return forbidden()
    }
    const body = req.method === 'GET' ? null : await req.json().catch(() => null)

    if (sub.length === 0) {
      if (req.method === 'POST') {
        const p = createSchema.safeParse(body)
        if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid scorecard')
        const loaded = await load(p.data.networkId)
        if (!loaded) return notFound()
        if (!coordinatorScope(caller, loaded.nodes, loaded.admins, 'coordinator').has(p.data.nodeId)) return forbidden()
        if (!templateById(p.data.template)) return bad('Unknown template')
        if (!validWindow(p.data.opensOn, p.data.closesOn)) return bad('Give an opening and closing date, opening first')
        if (!unitsOf(loaded.nodes, p.data.nodeId, p.data.unitLevel).length) return bad('There are no levels of that kind under this level yet. Add them first.')
        const id = `psc_${crypto.randomUUID()}`
        await db.insert(programmeScorecards).values({ id, ...p.data, createdBy: caller.email })
        await audit(caller.email, `Opened programme scorecard ${p.data.name}`, id)
        return json({ id }, 201)
      }
      const loaded = await load(url.searchParams.get('networkId') ?? '')
      if (!loaded) return notFound()
      const view = coordinatorScope(caller, loaded.nodes, loaded.admins)
      const rows = await db.select().from(programmeScorecards).where(eq(programmeScorecards.networkId, loaded.net.id))
      const visible = rows.filter((r) => view.has(r.nodeId) || unitsOf(loaded.nodes, r.nodeId, r.unitLevel).some((u) => view.has(u.id)))
      return json({
        templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, source: t.source, areas: t.areas.map((a) => a.name) })),
        canCreate: coordinatorScope(caller, loaded.nodes, loaded.admins, 'coordinator').size > 0,
        scorecards: visible.map((r) => ({ id: r.id, name: r.name, template: r.template, nodeId: r.nodeId, unitLevel: r.unitLevel, opensOn: r.opensOn, closesOn: r.closesOn,
          state: roundState({ opensOn: r.opensOn, closesOn: r.closesOn }, today()), overseeing: view.has(r.nodeId) })),
      })
    }

    const [sc] = await db.select().from(programmeScorecards).where(eq(programmeScorecards.id, sub[0]))
    if (!sc) return notFound()
    const loaded = await load(sc.networkId)
    const t = templateById(sc.template)
    if (!loaded || !t) return notFound()
    const { nodes, admins } = loaded
    const units = unitsOf(nodes, sc.nodeId, sc.unitLevel)
    const view = coordinatorScope(caller, nodes, admins)
    const coord = coordinatorScope(caller, nodes, admins, 'coordinator')
    const state = roundState({ opensOn: sc.opensOn, closesOn: sc.closesOn }, today())

    if (req.method === 'POST' && sub[1] === 'entries' && sub.length === 2) {
      const p = entrySchema.safeParse(body)
      if (!p.success) return bad('Score each item 0, 1 or 2')
      if (!units.some((u) => u.id === p.data.nodeId)) return bad('That level is not part of this scorecard')
      if (!coord.has(p.data.nodeId)) return forbidden()
      if (state !== 'open') return json({ error: state === 'upcoming' ? 'This scorecard has not opened yet' : 'This scorecard has closed' }, 409)
      if (!validEntry(t, p.data.scores)) return bad('Score each item 0 (not in place), 1 (partly) or 2 (fully in place)')
      await db.insert(programmeScorecardEntries).values({ scorecardId: sc.id, nodeId: p.data.nodeId, scores: p.data.scores, enteredBy: caller.email })
        .onConflictDoUpdate({ target: [programmeScorecardEntries.scorecardId, programmeScorecardEntries.nodeId], set: { scores: p.data.scores, enteredBy: caller.email, enteredAt: new Date() } })
      await audit(caller.email, `Entered programme scorecard for ${nodes.find((n) => n.id === p.data.nodeId)?.name}`, sc.id)
      return json({ ok: true, result: scoreUnit(t, p.data.scores) })
    }

    if (req.method === 'GET' && sub.length === 1) {
      const entries = await db.select().from(programmeScorecardEntries).where(eq(programmeScorecardEntries.scorecardId, sc.id))
      const groupOf = (n: NetworkNode) => nodes.find((x) => x.id === n.parentId)?.name ?? '—'
      const base = { id: sc.id, name: sc.name, unitLevel: sc.unitLevel, opensOn: sc.opensOn, closesOn: sc.closesOn, state, template: t }
      const myUnits = units.filter((u) => coord.has(u.id))
      const mine = myUnits.map((u) => {
        const e = entries.find((x) => x.nodeId === u.id)
        return { nodeId: u.id, name: u.name, scores: e?.scores ?? {}, enteredAt: e?.enteredAt ?? null, result: e ? scoreUnit(t, e.scores) : null }
      })
      if (!view.has(sc.nodeId)) {
        if (!myUnits.length) return notFound()
        return json({ ...base, overseeing: false, mine })
      }
      const results: UnitResult[] = entries.filter((e) => units.some((u) => u.id === e.nodeId)).map((e) => {
        const u = units.find((x) => x.id === e.nodeId)!
        return { nodeId: u.id, name: u.name, group: groupOf(u), result: scoreUnit(t, e.scores) }
      })
      const summaries = t.areas.map((a) => ({ area: a.key, name: a.name, components: COMPONENTS.map((c) => ({ component: c, ...summarise(results, a.key, c) })) }))
      // Change since the previous scorecard of the same template at the same level
      const [prev] = await db.select().from(programmeScorecards).where(and(eq(programmeScorecards.networkId, sc.networkId), eq(programmeScorecards.template, sc.template), eq(programmeScorecards.nodeId, sc.nodeId)))
        .orderBy(desc(programmeScorecards.opensOn)).then((rows) => rows.filter((r) => r.id !== sc.id && r.opensOn <= sc.opensOn))
      const prevEntries = prev ? await db.select().from(programmeScorecardEntries).where(eq(programmeScorecardEntries.scorecardId, prev.id)) : []
      const change = prev ? { previous: prev.name, ...changeSince(t, prevEntries, entries) } : null
      // Link to capacity: each unit's members' median overall score in the latest round covering it (5+ submissions)
      const roundRows = await db.select().from(networkRounds).where(eq(networkRounds.networkId, sc.networkId)).orderBy(desc(networkRounds.opensOn))
      const subRows = roundRows.length ? await db.select().from(networkRoundSubmissions).where(inArray(networkRoundSubmissions.roundId, roundRows.map((r) => r.id))) : []
      const capacityByUnit = units.map((u) => {
        const scope = subtree(nodes, u.id)
        const orgs = new Set(distinctAcceptedOrgs(loaded.members, scope))
        for (const r of roundRows) {
          if (!subtree(nodes, r.nodeId).has(u.id)) continue
          const m = instrumentById(r.instrument)
          const subs = subRows.filter((s) => s.roundId === r.id && orgs.has(s.orgId)).map((s) => ({ orgId: s.orgId, scores: s.scores }))
          if (!m || !subs.length) continue
          const cap = capacity(m, subs)
          return { nodeId: u.id, round: r.name, instrument: m.title, members: cap.n, median: cap.composite?.median ?? null }
        }
        return { nodeId: u.id, round: null, instrument: null, members: 0, median: null }
      })
      return json({
        ...base, overseeing: true, mine,
        units: units.map((u) => ({ nodeId: u.id, name: u.name, group: groupOf(u), entered: entries.some((e) => e.nodeId === u.id) })),
        results, summaries, change, capacityByUnit,
      })
    }
    return notFound()
  } catch (err) {
    logger.error('network-scorecards', 'request failed', err)
    return json({ error: 'Request failed' }, 500)
  }
}

export const config: Config = { path: ['/api/network-scorecards', '/api/network-scorecards/*'] }

export default monitored(handleRequest)
