import type { Config } from '@netlify/functions'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { networkRoundPerspectives, networkRoundSubmissions, networkRounds, networkValueResponses, organizations, responses, users } from '../../db/schema.js'
import { canAccessOrg, filterAuthorizedOrgIds, forbidden, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { audit, coordinatorScope, isSuper, load } from '../lib/network-access.js'
import { sendReminderEmail } from '../lib/reminder-email.js'
import { distinctAcceptedOrgs, subtree } from '../../src/lib/networks.js'
import {
  PERSPECTIVES, instrumentById, participation, perspectiveGaps, progress, roundInstruments, roundState, snapshot,
  validPerspectiveScores, validWindow, type Perspective,
} from '../../src/lib/networkRounds.js'
import { validValueAnswers } from '../../src/lib/networkResults.js'

// /api/network-rounds — assessment rounds in a network (src/lib/networkRounds.ts).
//   GET    ?networkId=                       rounds I coordinate or take part in, and the instruments available
//   POST   { networkId, nodeId, name, instrument, opensOn, closesOn, perspectives }   coordinator of that level
//   GET    :id                               coordinators: participation by level; members: my organisations' status
//   POST   :id/submit { orgId }              the organisation submits a frozen snapshot of its scores
//   POST   :id/perspectives { orgId, perspective, scores }   per-domain scores from one group (optional)
//   POST   :id/value { orgId, answers }      member value survey: services used and how useful, would-recommend
//   POST   :id/remind                         coordinator: email every member in scope that hasn't submitted (daily max)
//   POST   :id/close                          coordinator: close early

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string) => json({ error }, 400)
const notFound = () => json({ error: 'Not found' }, 404)
const today = () => new Date().toISOString().slice(0, 10)
const DAY = 24 * 3600_000

const createSchema = z.object({
  networkId: z.string().max(80), nodeId: z.string().max(80), name: z.string().trim().min(3).max(160),
  instrument: z.string().max(60), opensOn: z.string().max(10), closesOn: z.string().max(10), perspectives: z.boolean().default(false),
}).strict()
const orgSchema = z.object({ orgId: z.string().max(120) }).strict()
const perspectiveSchema = z.object({ orgId: z.string().max(120), perspective: z.enum(PERSPECTIVES), scores: z.record(z.string(), z.number()) }).strict()

async function scoresFor(orgId: string, ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {}
  const rows = await db.select({ q: responses.questionId, s: responses.score }).from(responses).where(and(eq(responses.orgId, orgId), inArray(responses.questionId, ids)))
  return Object.fromEntries(rows.map((r) => [r.q, r.s]))
}

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const url = new URL(req.url)
    const sub = url.pathname.replace(/^\/api\/network-rounds\/?/, '').split('/').filter(Boolean)
    if (req.method !== 'GET') {
      if (caller.readOnly) return forbidden()
      const origin = req.headers.get('origin')
      if (origin && origin !== url.origin) return forbidden()
    }
    const body = req.method === 'GET' ? null : await req.json().catch(() => null)

    // ---- Create a round ----
    if (req.method === 'POST' && sub.length === 0) {
      const p = createSchema.safeParse(body)
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid round')
      const loaded = await load(p.data.networkId)
      if (!loaded) return notFound()
      if (!coordinatorScope(caller, loaded.nodes, loaded.admins, 'coordinator').has(p.data.nodeId)) return forbidden()
      if (loaded.net.status === 'archived' && !isSuper(caller)) return json({ error: 'This network has been archived by CRAFT and can no longer be changed' }, 409)
      if (loaded.nodes.find((n) => n.id === p.data.nodeId)?.status === 'archived') return json({ error: 'This level is archived. Restore it first.' }, 409)
      if (!roundInstruments(isSuper(caller)).some((i) => i.id === p.data.instrument)) return bad('Unknown instrument')
      if (!validWindow(p.data.opensOn, p.data.closesOn)) return bad('Give an opening and closing date, opening first')
      const id = `nrd_${crypto.randomUUID()}`
      await db.insert(networkRounds).values({ id, ...p.data, createdBy: caller.email })
      await audit(caller.email, `Opened assessment round ${p.data.name}`, id)
      return json({ id }, 201)
    }

    // ---- Rounds in a network ----
    if (req.method === 'GET' && sub.length === 0) {
      const networkId = url.searchParams.get('networkId') ?? ''
      const loaded = await load(networkId)
      if (!loaded) return notFound()
      const view = coordinatorScope(caller, loaded.nodes, loaded.admins)
      const coord = coordinatorScope(caller, loaded.nodes, loaded.admins, 'coordinator')
      const myOrgs = new Set(await filterAuthorizedOrgIds(caller, [...new Set(loaded.members.map((m) => m.orgId))], 'read'))
      const myNodes = new Set(loaded.members.filter((m) => m.status === 'accepted' && myOrgs.has(m.orgId)).map((m) => m.nodeId))
      const rounds = await db.select().from(networkRounds).where(eq(networkRounds.networkId, networkId))
      const t = today()
      const visible = rounds.filter((r) => view.has(r.nodeId) || [...myNodes].some((n) => subtree(loaded.nodes, r.nodeId).has(n)))
      return json({
        instruments: roundInstruments(isSuper(caller)),
        canCreate: coord.size > 0,
        rounds: visible.map((r) => ({ id: r.id, name: r.name, nodeId: r.nodeId, instrument: r.instrument, instrumentTitle: instrumentById(r.instrument)?.title ?? r.instrument,
          opensOn: r.opensOn, closesOn: r.closesOn, perspectives: r.perspectives, state: roundState({ ...r, closedAt: r.closedAt?.toISOString() }, t), coordinating: coord.has(r.nodeId) })),
      })
    }

    // ---- One round ----
    const [round] = sub[0] ? await db.select().from(networkRounds).where(eq(networkRounds.id, sub[0])) : []
    if (!round) return notFound()
    const loaded = await load(round.networkId)
    if (!loaded) return notFound()
    const scope = subtree(loaded.nodes, round.nodeId)
    const coord = coordinatorScope(caller, loaded.nodes, loaded.admins, 'coordinator')
    const view = coordinatorScope(caller, loaded.nodes, loaded.admins)
    const m = instrumentById(round.instrument)
    if (!m) return json({ error: 'This round uses an instrument that is no longer available' }, 409)
    const state = roundState({ ...round, closedAt: round.closedAt?.toISOString() }, today())
    const inRound = distinctAcceptedOrgs(loaded.members, scope)
    const ids = m.indicators.map((i) => i.id)

    if (req.method === 'GET' && sub.length === 1) {
      const subs = await db.select({ orgId: networkRoundSubmissions.orgId, submittedAt: networkRoundSubmissions.submittedAt }).from(networkRoundSubmissions).where(eq(networkRoundSubmissions.roundId, round.id))
      const submitted = new Set(subs.map((s) => s.orgId))
      const myOrgIds = (await filterAuthorizedOrgIds(caller, inRound, 'read'))
      const base = { id: round.id, name: round.name, nodeId: round.nodeId, instrument: m.id, instrumentTitle: m.title, opensOn: round.opensOn, closesOn: round.closesOn,
        perspectives: round.perspectives, state, dimensions: m.dimensions.map((d) => ({ key: d.key, name: d.name })) }
      // Members: their own organisations' progress, submission and perspective gaps
      const mine = await Promise.all(myOrgIds.map(async (orgId) => {
        const persp = round.perspectives ? await db.select().from(networkRoundPerspectives).where(and(eq(networkRoundPerspectives.roundId, round.id), eq(networkRoundPerspectives.orgId, orgId))) : []
        const byP = Object.fromEntries(persp.map((x) => [x.perspective, x.scores])) as Partial<Record<Perspective, Record<string, number>>>
        const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId))
        const [value] = await db.select({ answers: networkValueResponses.answers }).from(networkValueResponses).where(and(eq(networkValueResponses.roundId, round.id), eq(networkValueResponses.orgId, orgId)))
        return { orgId, orgName: org?.name ?? orgId, progress: progress(m, await scoresFor(orgId, ids)), value: value?.answers ?? null, submittedAt: subs.find((s) => s.orgId === orgId)?.submittedAt ?? null,
          perspectives: byP, gaps: round.perspectives ? perspectiveGaps(m, byP) : [] }
      }))
      if (!view.has(round.nodeId) && mine.length === 0) return notFound()
      if (!view.has(round.nodeId)) return json({ ...base, mine, participation: null })
      // Coordinators: counts per level in the round's scope; no names (a totals-only member must stay unnamed)
      const startedRows = inRound.length && ids.length ? await db.select({ orgId: responses.orgId }).from(responses).where(and(inArray(responses.orgId, inRound), inArray(responses.questionId, ids))) : []
      const started = new Set(startedRows.map((r) => r.orgId))
      const byNode = loaded.nodes.filter((n) => scope.has(n.id)).map((n) => ({ nodeId: n.id, name: n.name, level: n.level, ...participation(distinctAcceptedOrgs(loaded.members, subtree(loaded.nodes, n.id)), started, submitted) }))
      return json({ ...base, mine, coordinating: coord.has(round.nodeId), lastRemindedAt: round.lastRemindedAt, participation: { total: participation(inRound, started, submitted), byNode } })
    }

    if (req.method === 'POST' && (sub[1] === 'submit' || sub[1] === 'perspectives') && sub.length === 2) {
      const p = (sub[1] === 'submit' ? orgSchema : perspectiveSchema).safeParse(body)
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid request')
      const orgId = p.data.orgId
      if (!inRound.includes(orgId)) return json({ error: 'That organisation is not an accepted member in this round' }, 409)
      if (!(await canAccessOrg(caller, orgId, 'write'))) return forbidden()
      if (state !== 'open') return json({ error: state === 'upcoming' ? 'This round has not opened yet' : 'This round has closed' }, 409)
      if (sub[1] === 'submit') {
        const scores = snapshot(m, await scoresFor(orgId, ids))
        if (Object.keys(scores).length === 0) return json({ error: 'Answer the assessment before submitting it to the network' }, 409)
        await db.insert(networkRoundSubmissions).values({ roundId: round.id, orgId, scores, submittedBy: caller.email })
          .onConflictDoUpdate({ target: [networkRoundSubmissions.roundId, networkRoundSubmissions.orgId], set: { scores, submittedBy: caller.email, submittedAt: new Date() } })
        await audit(caller.email, `Submitted to assessment round ${round.name}`, round.id, orgId)
        return json({ ok: true, ...progress(m, scores) })
      }
      if (!round.perspectives) return json({ error: 'This round does not collect perspectives' }, 409)
      const pp = p.data as z.infer<typeof perspectiveSchema>
      if (!validPerspectiveScores(m, pp.scores)) return bad('Score each area from 0 to 5')
      await db.insert(networkRoundPerspectives).values({ roundId: round.id, orgId, perspective: pp.perspective, scores: pp.scores, enteredBy: caller.email })
        .onConflictDoUpdate({ target: [networkRoundPerspectives.roundId, networkRoundPerspectives.orgId, networkRoundPerspectives.perspective], set: { scores: pp.scores, enteredBy: caller.email, enteredAt: new Date() } })
      await audit(caller.email, `Recorded ${pp.perspective} perspective for ${round.name}`, round.id, orgId)
      return json({ ok: true })
    }

    if (req.method === 'POST' && sub[1] === 'value' && sub.length === 2) {
      const b = body as { orgId?: unknown; answers?: unknown } | null
      const orgId = typeof b?.orgId === 'string' ? b.orgId : ''
      if (!validValueAnswers(b?.answers)) return bad('Rate each service you used from 1 to 5, and say how likely you are to recommend the network (0-10)')
      if (!inRound.includes(orgId)) return json({ error: 'That organisation is not an accepted member in this round' }, 409)
      if (!(await canAccessOrg(caller, orgId, 'write'))) return forbidden()
      if (state !== 'open') return json({ error: 'The value survey is open only while the round is open' }, 409)
      const answers = b!.answers as { used: Record<string, number>; recommend: number }
      await db.insert(networkValueResponses).values({ roundId: round.id, orgId, answers, answeredBy: caller.email })
        .onConflictDoUpdate({ target: [networkValueResponses.roundId, networkValueResponses.orgId], set: { answers, answeredBy: caller.email, answeredAt: new Date() } })
      await audit(caller.email, `Answered the network value survey for ${round.name}`, round.id, orgId)
      return json({ ok: true })
    }

    if (req.method === 'POST' && sub[1] === 'remind' && sub.length === 2) {
      if (!coord.has(round.nodeId)) return forbidden()
      if (state !== 'open') return json({ error: 'Reminders go out only while the round is open' }, 409)
      if (round.lastRemindedAt && Date.now() - round.lastRemindedAt.getTime() < DAY) return json({ error: 'A reminder already went out in the last 24 hours' }, 429)
      const subs = await db.select({ orgId: networkRoundSubmissions.orgId }).from(networkRoundSubmissions).where(eq(networkRoundSubmissions.roundId, round.id))
      const done = new Set(subs.map((s) => s.orgId))
      const waiting = inRound.filter((o) => !done.has(o))
      const orgs = waiting.length ? await db.select({ id: organizations.id, name: organizations.name, email: organizations.email }).from(organizations).where(inArray(organizations.id, waiting)) : []
      const staff = waiting.length ? await db.select({ orgId: users.orgId, email: users.email }).from(users).where(inArray(users.orgId, waiting)) : []
      let sent = 0
      for (const o of orgs) {
        const to = o.email || staff.find((s) => s.orgId === o.id)?.email
        if (!to) continue
        const result = await sendReminderEmail({
          to, subject: `Reminder: ${loaded.net.name} assessment closes on ${round.closesOn}`,
          text: `Hello ${o.name},\n\n${loaded.net.name} is running "${round.name}" (${m.title}). It closes on ${round.closesOn}.\n\nOpen CRAFT, complete the assessment, then go to Networks and press "Submit to the network".\n\nYour network sees only what you chose to share.\n\nCRAFT · DiBadili Institute`,
        }, `network-round-${round.id}-${o.id}-${today()}`, 'network_round_reminder')
        if (result === 'accepted') sent++
      }
      await db.update(networkRounds).set({ lastRemindedAt: new Date() }).where(eq(networkRounds.id, round.id))
      await audit(caller.email, `Sent round reminders (${sent})`, round.id)
      return json({ waiting: waiting.length, sent })
    }

    if (req.method === 'POST' && sub[1] === 'close' && sub.length === 2) {
      if (!coord.has(round.nodeId)) return forbidden()
      if (state === 'closed') return json({ error: 'This round is already closed' }, 409)
      await db.update(networkRounds).set({ closedAt: new Date() }).where(eq(networkRounds.id, round.id))
      await audit(caller.email, `Closed assessment round ${round.name}`, round.id)
      return json({ ok: true })
    }

    return notFound()
  } catch (err) {
    logger.error('network-rounds', 'request failed', err)
    return json({ error: 'Request failed' }, 500)
  }
}

export const config: Config = { path: ['/api/network-rounds', '/api/network-rounds/*'] }

export default monitored(handleRequest)
