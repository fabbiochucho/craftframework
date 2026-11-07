import type { Config } from '@netlify/functions'
import { and, eq, gte, inArray, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  capacityActions, invitations, networkAdmins, networkExchanges, networkMembers, networkNodes, networkRoundPerspectives, networkRoundSubmissions, networkRounds,
  networks, networkValueResponses, organizations, programmeScorecardEntries, programmeScorecards, responses,
} from '../../db/schema.js'
import { audit, coordinatorScope, isSuper, load } from '../lib/network-access.js'
import { canAccessOrg, filterAuthorizedOrgIds, forbidden, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { inviteOrganization } from '../lib/invitations.js'
import { parseOrgType } from '../../src/lib/orgType.js'
import {
  NETWORK_LEVELS, SHARING, canNest, distinctAcceptedOrgs, everyoneNamed, memberView, subtree, validGeoCode, type NetworkLevel,
} from '../../src/lib/networks.js'
import { GROUPINGS, NETWORK_TEMPLATES, buildStructure, templateNodes } from '../../src/lib/networkTemplates.js'
import { instrumentById } from '../../src/lib/networkRounds.js'
import { capacity, networkProfile } from '../../src/lib/networkResults.js'
import { bandFor, compositeScore, answeredIn } from '../../src/lib/foundationModules.js'

// /api/networks — civil society networks: levels, coordinators and member organisations (src/lib/networks.ts).
//   GET                                   my networks, my organisations' invitations and memberships
//   POST   { name, description, kind, template, root } or { name, description, kind, structure }   any signed-in
//                                         organisation: create a network (5 a day) from a template or a guided structure;
//                                         the creator becomes coordinator of its top level
//   POST   :id/moderate { archived?, verified? }   Super Admin: archive a misused network, mark a known one verified
//   DELETE :id { confirmName }               delete the network and everything in it, for good. The Super Admin always;
//                                         the person who set it up only while no organisation has joined (else archive)
//   GET    :id/overview                  coordinators: profile (secretariat, members, use) and alerts
//   GET    :id                            the tree; coordinators see members in their scope (named only if "full")
//   POST   :id/nodes { parentId, level, name, geoCode }       coordinator of the parent level
//   DELETE :id/nodes/:nodeId { confirmName }  Super Admin: delete a level and every level below it, for good
//   PATCH  :id/nodes/:nodeId { name?, archived? }            coordinator of that level: rename, or archive/restore it
//                                         with everything below it (the top level cannot be archived)
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
  kind: z.enum(['network', 'cohort']).default('network'),
  template: z.enum(NETWORK_TEMPLATES).default('blank'),
  root: z.object({ level, name: z.string().trim().min(2).max(160), geoCode: geo }).strict().optional(),
  structure: z.object({
    countries: z.array(z.string().length(2).toUpperCase()).min(1).max(54),
    grouping: z.enum(GROUPINGS).default('au-region'),
    zones: z.boolean().default(false),
    subdivisions: z.boolean().default(false),
  }).strict().optional(),
}).strict().refine((d) => !!d.root !== !!d.structure, 'Send either a top level (root) or a structure')
const moderateSchema = z.object({ archived: z.boolean().optional(), verified: z.boolean().optional() }).strict()
const deleteSchema = z.object({ confirmName: z.string().max(200) }).strict()
/** New networks per person per day, and invitations per network per day (verified networks get more). */
const CREATE_PER_DAY = 5
const INVITES_PER_DAY = { unverified: 50, verified: 500 }
const DAY = 24 * 3600_000
const nodePatchSchema = z.object({ name: z.string().trim().min(2).max(160).optional(), archived: z.boolean().optional() }).strict()
const nodeSchema = z.object({ parentId: z.string().max(80), level, name: z.string().trim().min(2).max(160), geoCode: geo }).strict()
const adminSchema = z.object({ nodeId: z.string().max(80), email: z.string().trim().toLowerCase().email().max(200), role: z.enum(['coordinator', 'viewer']).default('coordinator') }).strict()
const adminDeleteSchema = z.object({ nodeId: z.string().max(80), email: z.string().trim().toLowerCase().email().max(200) }).strict()
const inviteSchema = z.object({
  nodeId: z.string().max(80), org: z.string().trim().min(2).max(200),
  // Only for an organisation not on CRAFT yet: invited by email, it joins this level once it has a workspace.
  orgName: z.string().trim().min(2).max(200).refine((v) => !/[\u0000-\u001f\u007f-\u009f]/.test(v)).optional(),
  message: z.string().trim().max(1000).optional(),
  orgArchetype: z.string().trim().max(40).optional(),
  orgSector: z.string().trim().max(80).optional(),
  orgCountry: z.string().trim().max(8).optional(),
}).strict()
const decideSchema = z.object({ action: z.enum(['accept', 'decline', 'leave', 'sharing']), sharing: z.enum(SHARING).optional() }).strict()

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
/**
 * Permanently remove network levels and everything attached to them: memberships, coordinators, rounds
 * (with submissions, perspectives and value responses), exchanges, programme scorecards (and scorecard
 * entries for these levels), and open email invitations to them. `wholeNetwork` also clears the
 * network-wide rows. Organisations keep their own workspaces and data.
 */
async function removeLevels(tx: Tx, networkId: string, nodeIds: string[], wholeNetwork: boolean) {
  if (!nodeIds.length) return
  const rounds = wholeNetwork ? eq(networkRounds.networkId, networkId) : and(eq(networkRounds.networkId, networkId), inArray(networkRounds.nodeId, nodeIds))
  const roundIds = (await tx.select({ id: networkRounds.id }).from(networkRounds).where(rounds)).map((r) => r.id)
  if (roundIds.length) {
    await tx.delete(networkRoundSubmissions).where(inArray(networkRoundSubmissions.roundId, roundIds))
    await tx.delete(networkRoundPerspectives).where(inArray(networkRoundPerspectives.roundId, roundIds))
    await tx.delete(networkValueResponses).where(inArray(networkValueResponses.roundId, roundIds))
    await tx.delete(networkRounds).where(inArray(networkRounds.id, roundIds))
  }
  await tx.delete(networkExchanges).where(wholeNetwork ? eq(networkExchanges.networkId, networkId) : and(eq(networkExchanges.networkId, networkId), inArray(networkExchanges.nodeId, nodeIds)))
  const cards = wholeNetwork ? eq(programmeScorecards.networkId, networkId) : and(eq(programmeScorecards.networkId, networkId), inArray(programmeScorecards.nodeId, nodeIds))
  const cardIds = (await tx.select({ id: programmeScorecards.id }).from(programmeScorecards).where(cards)).map((c) => c.id)
  if (cardIds.length) {
    await tx.delete(programmeScorecardEntries).where(inArray(programmeScorecardEntries.scorecardId, cardIds))
    await tx.delete(programmeScorecards).where(inArray(programmeScorecards.id, cardIds))
  }
  // Entries about these levels inside scorecards owned by a level that stays.
  await tx.delete(programmeScorecardEntries).where(inArray(programmeScorecardEntries.nodeId, nodeIds))
  await tx.delete(networkMembers).where(inArray(networkMembers.nodeId, nodeIds))
  await tx.delete(networkAdmins).where(inArray(networkAdmins.nodeId, nodeIds))
  await tx.update(invitations).set({ status: 'revoked', respondedAt: new Date() })
    .where(and(inArray(invitations.networkNodeId, nodeIds), eq(invitations.status, 'pending')))
  await tx.delete(networkNodes).where(inArray(networkNodes.id, nodeIds))
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
        canCreate: !caller.readOnly,
        isSuperAdmin: isSuper(caller),
        networks: nets.filter((n) => n.status === 'active' || isSuper(caller)).map((n) => ({ id: n.id, name: n.name, description: n.description, status: n.status, kind: n.kind, verified: n.verified, setUpBy: n.createdBy,
          coordinating: adminNodes.some((a) => a.networkId === n.id) || isSuper(caller) })),
        memberships: mine.map((m) => {
          const node = nodeById.get(m.nodeId)
          return { id: m.id, status: m.status, sharing: m.sharing, orgId: m.orgId, orgName: orgs.find((o) => o.id === m.orgId)?.name ?? m.orgId,
            nodeName: node?.name ?? '', level: node?.level ?? '', networkId: node?.networkId ?? '', networkName: netById.get(node?.networkId ?? '')?.name ?? '',
            setUpBy: netById.get(node?.networkId ?? '')?.createdBy ?? '', verified: netById.get(node?.networkId ?? '')?.verified ?? false, archived: netById.get(node?.networkId ?? '')?.status === 'archived' }
        }),
      })
    }

    // ---- Create a network (any signed-in organisation; the creator coordinates its top level) ----
    if (req.method === 'POST' && sub.length === 0) {
      const p = createSchema.safeParse(body)
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid network')
      if (p.data.root && !validGeoCode(p.data.root.level, p.data.root.geoCode)) return bad('That geography code does not fit the level')
      let tmpl
      try { tmpl = p.data.structure ? buildStructure(p.data.structure) : templateNodes(p.data.template, p.data.root!) } catch (e) { return bad((e as Error).message) }
      if (!isSuper(caller)) {
        const recent = await db.select({ id: networks.id }).from(networks).where(and(eq(networks.createdBy, caller.email), gte(networks.createdAt, new Date(Date.now() - DAY))))
        if (recent.length >= CREATE_PER_DAY) return json({ error: `You can create up to ${CREATE_PER_DAY} networks a day` }, 429)
      }
      const id = newId('net')
      const ids = new Map(tmpl.map((n) => [n.key, newId('nnd')]))
      await db.insert(networks).values({ id, name: p.data.name, description: p.data.description, kind: p.data.kind, createdBy: caller.email, secretariatOrgId: caller.orgId })
      // Parents before children (templates list them in that order)
      await db.insert(networkNodes).values(tmpl.map((n) => ({ id: ids.get(n.key)!, networkId: id, parentId: n.parent ? ids.get(n.parent)! : null, level: n.level, name: n.name, geoCode: n.geoCode })))
      const rootId = ids.get(tmpl[0].key)!
      await db.insert(networkAdmins).values({ nodeId: rootId, email: caller.email, role: 'coordinator', addedBy: caller.email })
      await audit(caller.email, `Created network ${p.data.name} (${p.data.structure ? 'guided structure' : p.data.template})`, id)
      return json({ id, rootId, levels: tmpl.length }, 201)
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

    if (req.method === 'POST' && sub[1] === 'moderate' && sub.length === 2) {
      if (!isSuper(caller)) return forbidden()
      const p = moderateSchema.safeParse(body)
      if (!p.success) return bad('Send archived and/or verified as true or false')
      const set: { status?: string; verified?: boolean } = {}
      if (p.data.archived !== undefined) set.status = p.data.archived ? 'archived' : 'active'
      if (p.data.verified !== undefined) set.verified = p.data.verified
      await db.update(networks).set(set).where(eq(networks.id, net.id))
      await audit(caller.email, `Moderated network: ${JSON.stringify(p.data)}`, net.id)
      return json({ ok: true })
    }
    if (req.method === 'DELETE' && sub.length === 1) {
      const joined = members.filter((m) => m.status === 'accepted').length
      const owner = net.createdBy.toLowerCase() === caller.email
      if (!isSuper(caller) && !owner) return forbidden()
      if (!isSuper(caller) && net.status === 'archived') return json({ error: 'This network has been archived by CRAFT and can no longer be changed' }, 409)
      if (!isSuper(caller) && joined) return json({ error: `${joined} organisation${joined === 1 ? ' has' : 's have'} joined this network, so it cannot be deleted. Ask CRAFT to archive it instead.` }, 409)
      const p = deleteSchema.safeParse(body)
      if (!p.success || p.data.confirmName.trim().toLowerCase() !== net.name.trim().toLowerCase()) return bad('Type the network name exactly to confirm')
      const nodeIds = nodes.map((n) => n.id)
      await db.transaction(async (tx) => {
        await removeLevels(tx, net.id, nodeIds, true)
        await tx.delete(networks).where(eq(networks.id, net.id))
      })
      await audit(caller.email, `Deleted network "${net.name}" (${nodes.length} level${nodes.length === 1 ? '' : 's'}, ${joined} joined organisation${joined === 1 ? '' : 's'})`, net.id)
      return json({ ok: true })
    }
    // An archived network is read-only for everyone but the Super Admin.
    if (req.method !== 'GET' && net.status === 'archived' && !isSuper(caller)) return json({ error: 'This network has been archived by CRAFT and can no longer be changed' }, 409)
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
        network: { id: net.id, name: net.name, description: net.description, status: net.status, kind: net.kind, verified: net.verified, setUpBy: net.createdBy, canModerate: isSuper(caller),
          canDelete: isSuper(caller) || (net.createdBy.toLowerCase() === caller.email && net.status !== 'archived' && !members.some((m) => m.status === 'accepted')) },
        nodes: nodes.map((n) => ({ id: n.id, parentId: n.parentId, level: n.level, name: n.name, geoCode: n.geoCode, status: n.status, members: viewScope.has(n.id) ? perNode[n.id] : undefined })),
        coordinates: [...coordScope], views: [...viewScope],
        admins: admins.filter((a) => viewScope.has(a.nodeId)).map((a) => ({ nodeId: a.nodeId, email: a.email, role: a.role })),
        members: viewScope.size ? view : null,
        pending: members.filter((m) => coordScope.has(m.nodeId) && m.status === 'invited').length,
        mine: ownRows.map((m) => ({ id: m.id, nodeId: m.nodeId, orgId: m.orgId, status: m.status, sharing: m.sharing })),
      })
    }

    if (req.method === 'GET' && sub[1] === 'overview' && sub.length === 2) {
      if (!viewScope.size) return notFound()
      const root = nodes.find((n) => n.parentId === null)!
      const scope = subtree(nodes, root.id)
      const accepted = distinctAcceptedOrgs(members, scope)
      // Secretariat: the Network Capacity Index answered by the organisation that runs the network
      const nci = instrumentById('craft-network')
      let secretariat: null | { score: number; band: string | null; answered: number; total: number } = null
      if (nci && net.secretariatOrgId) {
        const ids = nci.indicators.map((i) => i.id)
        const rows = await db.select({ q: responses.questionId, s: responses.score }).from(responses).where(and(eq(responses.orgId, net.secretariatOrgId), inArray(responses.questionId, ids)))
        const scores = Object.fromEntries(rows.map((r) => [r.q, r.s]))
        const answered = answeredIn(nci, scores)
        if (answered > 0) secretariat = { score: compositeScore(nci, scores), band: bandFor(nci, scores)?.band.label ?? null, answered, total: nci.indicators.length }
      }
      // Members: the latest round with submissions at the top level
      const rounds = (await db.select().from(networkRounds).where(eq(networkRounds.networkId, net.id))).sort((a, b) => b.opensOn.localeCompare(a.opensOn))
      let membersNow: null | { round: string; instrument: string; submitted: number; median: number | null; suppressed: boolean } = null
      for (const r of rounds) {
        const m = instrumentById(r.instrument)
        const subs = (await db.select().from(networkRoundSubmissions).where(eq(networkRoundSubmissions.roundId, r.id))).filter((x) => accepted.includes(x.orgId))
        if (!m || !subs.length) continue
        const cap = capacity(m, subs.map((x) => ({ orgId: x.orgId, scores: x.scores })), everyoneNamed(members, scope))
        membersNow = { round: r.name, instrument: m.title, submitted: subs.length, median: cap.composite?.median ?? null, suppressed: cap.suppressed }
        break
      }
      const actions = accepted.length ? await db.select({ orgId: capacityActions.orgId, status: capacityActions.status }).from(capacityActions).where(inArray(capacityActions.orgId, accepted)) : []
      const doneOrgs = new Set(actions.filter((a) => a.status === 'Completed-Validated').map((a) => a.orgId)).size
      const useRate = accepted.length ? Math.round((doneOrgs / accepted.length) * 100) : null
      // Alerts a coordinator should act on
      const today = new Date().toISOString().slice(0, 10)
      const alerts: string[] = []
      const uncovered = nodes.filter((n) => n.parentId && ['national', 'zonal', 'subnational'].includes(n.level) && !admins.some((a) => subtree(nodes, a.nodeId).has(n.id) && a.nodeId !== root.id))
      if (uncovered.length) alerts.push(`${uncovered.length} level${uncovered.length === 1 ? ' has' : 's have'} no coordinator of their own (for example ${uncovered.slice(0, 3).map((n) => n.name).join(', ')}).`)
      for (const r of rounds) {
        if (r.closedAt || r.closesOn < today) continue
        const daysLeft = Math.ceil((Date.parse(r.closesOn) - Date.parse(today)) / DAY)
        const subs = (await db.select({ orgId: networkRoundSubmissions.orgId }).from(networkRoundSubmissions).where(eq(networkRoundSubmissions.roundId, r.id))).filter((x) => accepted.includes(x.orgId)).length
        const inRound = distinctAcceptedOrgs(members, subtree(nodes, r.nodeId)).length
        if (daysLeft <= 7 && inRound && subs / inRound < 0.5) alerts.push(`"${r.name}" closes in ${daysLeft} day${daysLeft === 1 ? '' : 's'} with ${subs} of ${inRound} members submitted. Send a reminder.`)
      }
      const staleInvites = members.filter((m) => m.status === 'invited' && Date.now() - new Date(m.invitedAt).getTime() > 14 * DAY).length
      if (staleInvites) alerts.push(`${staleInvites} invitation${staleInvites === 1 ? ' has' : 's have'} been waiting more than two weeks.`)
      if (!secretariat) alerts.push('The secretariat has not taken the Network Capacity Index yet.')
      return json({ profile: networkProfile(secretariat?.score ?? null, membersNow && !membersNow.suppressed ? membersNow.median : null, useRate), secretariat, members: membersNow, useRate, acceptedMembers: accepted.length, alerts })
    }

    if (req.method === 'POST' && sub[1] === 'nodes' && sub.length === 2) {
      const p = nodeSchema.safeParse(body)
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid level')
      const parent = nodes.find((n) => n.id === p.data.parentId)
      if (!parent) return bad('Unknown parent level')
      if (!coordScope.has(parent.id)) return forbidden()
      if (parent.status === 'archived') return json({ error: `${parent.name} is archived. Restore it first.` }, 409)
      if (!canNest(parent.level, p.data.level as NetworkLevel)) return bad('A level must sit below its parent')
      if (!validGeoCode(p.data.level as NetworkLevel, p.data.geoCode)) return bad('That geography code does not fit the level')
      const id = newId('nnd')
      await db.insert(networkNodes).values({ id, networkId: net.id, parentId: parent.id, level: p.data.level, name: p.data.name, geoCode: p.data.geoCode })
      await audit(caller.email, `Added network level ${p.data.name}`, id)
      return json({ id }, 201)
    }

    if (req.method === 'DELETE' && sub[1] === 'nodes' && sub.length === 3) {
      if (!isSuper(caller)) return forbidden()
      const node = nodes.find((n) => n.id === sub[2])
      if (!node) return notFound()
      if (node.parentId === null) return bad('The top level is the network itself. Delete the network instead.')
      const p = deleteSchema.safeParse(body)
      if (!p.success || p.data.confirmName.trim().toLowerCase() !== node.name.trim().toLowerCase()) return bad('Type the level name exactly to confirm')
      const ids = [...subtree(nodes, node.id)]
      const joined = members.filter((m) => ids.includes(m.nodeId) && m.status === 'accepted').length
      await db.transaction(async (tx) => { await removeLevels(tx, net.id, ids, false) })
      await audit(caller.email, `Deleted network level ${node.name} (${ids.length} level${ids.length === 1 ? '' : 's'}, ${joined} joined organisation${joined === 1 ? '' : 's'})`, node.id)
      return json({ ok: true, deleted: ids.length })
    }

    if (req.method === 'PATCH' && sub[1] === 'nodes' && sub.length === 3) {
      const p = nodePatchSchema.safeParse(body)
      if (!p.success) return bad(p.error.issues[0]?.message ?? 'Give a new name or archived: true/false')
      const node = nodes.find((n) => n.id === sub[2])
      if (!node) return notFound()
      if (!coordScope.has(node.id)) return forbidden()
      if (p.data.archived !== undefined && node.parentId === null) return bad('The top level cannot be archived')
      if (p.data.name) await db.update(networkNodes).set({ name: p.data.name }).where(eq(networkNodes.id, node.id))
      if (p.data.archived !== undefined) {
        await db.update(networkNodes).set({ status: p.data.archived ? 'archived' : 'active' }).where(inArray(networkNodes.id, [...subtree(nodes, node.id)]))
      }
      await audit(caller.email, p.data.archived === undefined ? `Renamed network level ${node.name} to ${p.data.name}` : `${p.data.archived ? 'Archived' : 'Restored'} network level ${node.name}`, node.id)
      return json({ ok: true })
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
      if (nodes.find((n) => n.id === p.data.nodeId)?.status === 'archived') return json({ error: 'This level is archived. Restore it first.' }, 409)
      const nodeIds = nodes.map((n) => n.id)
      const recentEmailInvites = nodeIds.length ? (await db.select({ id: invitations.id }).from(invitations)
        .where(and(inArray(invitations.networkNodeId, nodeIds), gte(invitations.createdAt, new Date(Date.now() - DAY))))).length : 0
      const recentInvites = members.filter((m) => m.invitedAt && Date.now() - new Date(m.invitedAt).getTime() < DAY).length + recentEmailInvites
      const cap = net.verified ? INVITES_PER_DAY.verified : INVITES_PER_DAY.unverified
      if (!isSuper(caller) && recentInvites >= cap) return json({ error: `This network can send up to ${cap} invitations a day${net.verified ? '' : ' until CRAFT verifies it'}` }, 429)
      const key = p.data.org
      const [org] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations)
        .where(or(eq(organizations.id, key), eq(organizations.email, key.toLowerCase()))).limit(1)
      if (!org) {
        // Not on CRAFT yet: invite the contact by email. The level is joined (as an invitation the
        // organisation still accepts) once it has created its workspace.
        const email = key.toLowerCase()
        if (!z.string().email().safeParse(email).success) return json({ error: 'No CRAFT organisation has that ID. To invite one that is not on CRAFT yet, enter its contact email and name.' }, 404)
        if (!p.data.orgName) return json({ error: 'This organisation is not on CRAFT yet. Enter its name to invite it by email.', needsOrgName: true }, 404)
        const orgType = parseOrgType({ archetype: p.data.orgArchetype, sector: p.data.orgSector, country: p.data.orgCountry })
        if (orgType === 'invalid') return bad('Choose the organisation type from the list')
        const { invitation, email: sent } = await inviteOrganization(caller, { email, orgName: p.data.orgName, message: p.data.message, networkNodeId: p.data.nodeId, orgType })
        await audit(caller.email, `Invited ${p.data.orgName} to network by email`, p.data.nodeId)
        return json({ ok: true, orgName: p.data.orgName, invitedByEmail: true, invitationId: invitation.id, email: sent.body }, 201)
      }
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
