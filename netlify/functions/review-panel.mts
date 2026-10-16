import type { Config } from '@netlify/functions'
import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  auditLogs, engagementMembers, firmMembers, firms, organizations, panelCases, panelMembers, panelRoster, panelSubmissions, validationConcerns, validationEvents, validationFunderConsents,
  validationRatings, validationReviews, validations, validatorProfiles, type PanelCaseRow, type PanelMemberRow, type ValidationRow,
} from '../../db/schema.js'
import { canAccessOrg, forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { isProgrammeTeam, staffRole } from '../lib/training.js'
import { logger } from '../lib/logger.js'
import { notify } from '../lib/validation-lifecycle.js'
import { afterDecision, applyDecision, conflictCheck, membersOf, noticeAll, sideOfCaller } from '../lib/review-panel.js'
import { effectiveAccreditation } from '../../src/lib/validatorDirectory.js'
import {
  appealDeadline, appealOpen, CASE_KIND_LABEL, CASE_KINDS, caseClock, CASE_STATUS_LABEL, decisionLabel, decisionProblems, FEEDBACK_GROUNDS, FEEDBACK_OUTCOMES, isOverdue, majority,
  mayDeliberate, NO_CONFLICT_DECLARATION, panelSeated, ROSTER_KINDS, seatsFree, VALIDATION_OUTCOMES, VALIDATOR_OUTCOMES, type CaseKind, type Decision, type RaisedSide,
} from '../../src/lib/reviewPanel.js'

// /api/review-panel — the Independent Review Panel (validator system PR 7b). Disputes and complaints only.
//
//   GET    /roster                          programme team: the volunteer roster
//   POST   /roster                          programme team: add or re-activate {email, name, kind, note?}
//   DELETE /roster/:email                   programme team: stand a volunteer down
//   GET    /cases                           the cases the caller may see (programme team: all)
//   POST   /cases                           raise a case {kind, validationId | ratingId | concernId, eventId?, summary}
//   GET    /cases/:id                       one case, as much of it as the caller's role allows
//   POST   /cases/:id/members               programme team: invite the convenor or a reviewer {email, role}
//   DELETE /cases/:id/members/:email        programme team: take back an invitation (before the panel is seated)
//   POST   /cases/:id/respond               an invited member: accept (with a no-conflict declaration) or decline
//   POST   /cases/:id/submissions           a party: a written response with an evidence reference
//   POST   /cases/:id/deliberate            convenor: close the response window and open voting
//   PUT    /cases/:id/vote                  a panel member: their vote and reasons
//   POST   /cases/:id/decide                convenor: record the majority decision with written reasons; applies it
//   POST   /cases/:id/appeal                a party: one appeal, to a fresh panel
//
// Platform administrators can compose panels and see cases but never sit or vote. Panel members get no
// technical rights: only these endpoints, scoped to their own case.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string) => json({ error }, 400)
const notFound = () => json({ error: 'Not found' }, 404)
const conflict = (error: string, extra: object = {}) => json({ error, ...extra }, 409)
const audit = (actor: string, action: string, target: string, orgId?: string | null) =>
  db.insert(auditLogs).values({ actor, action, target, category: 'Validation', orgId: orgId ?? undefined })

const decisionSchema = z.object({
  validation: z.enum(VALIDATION_OUTCOMES).default('none'), validator: z.enum(VALIDATOR_OUTCOMES).default('none'),
  feedback: z.enum(FEEDBACK_OUTCOMES).default('none'), feedbackGround: z.enum(FEEDBACK_GROUNDS).optional(),
})
const raiseSchema = z.object({
  kind: z.enum(CASE_KINDS), validationId: z.string().max(200).optional(), ratingId: z.string().max(200).optional(), concernId: z.string().max(200).optional(),
  eventId: z.string().max(200).optional(), summary: z.string().trim().min(10).max(4000),
})
const rosterSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), name: z.string().trim().min(1).max(200), kind: z.enum(ROSTER_KINDS), note: z.string().trim().max(500).optional() })
const memberSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), role: z.enum(['convenor', 'reviewer']) })
const respondSchema = z.object({ accept: z.boolean(), declaration: z.string().trim().max(1000).optional(), reason: z.string().trim().max(1000).optional() })
const submissionSchema = z.object({ text: z.string().trim().min(3).max(8000), evidenceRef: z.string().trim().max(1000).optional() })
const voteSchema = decisionSchema.extend({ reasons: z.string().trim().min(10).max(4000) })
const decideSchema = z.object({ reasons: z.string().trim().min(20).max(6000) })
const appealSchema = z.object({ reason: z.string().trim().min(10).max(4000) })


async function myFunderFirms(email: string): Promise<string[]> {
  const rows = await db.select({ id: firms.id }).from(firmMembers).innerJoin(firms, eq(firms.id, firmMembers.firmId))
    .where(and(eq(firmMembers.email, email), eq(firmMembers.status, 'active'), eq(firms.kind, 'funding_partner')))
  return rows.map((r) => r.id)
}

export default async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (caller.readOnly) return forbidden()
    const url = new URL(req.url)
    const [area, id, sub, extra] = url.pathname.replace(/^\/api\/review-panel\/?/, '').split('/').filter(Boolean)
    const readBody = async () => { try { return await req.json() } catch { return null } }
    const me = caller.email.toLowerCase()
    const staff = await isProgrammeTeam(caller.email)

    // ---- Roster -------------------------------------------------------------------------------------------
    if (area === 'roster') {
      if (!staff) return forbidden()
      if (req.method === 'GET' && !id) return json(await db.select().from(panelRoster).orderBy(panelRoster.name))
      if (req.method === 'POST' && !id) {
        const p = rosterSchema.safeParse(await readBody())
        if (!p.success) return bad('An email, a name and a kind (Senior Validator or outside auditor) are required')
        if (isSuperAdmin(p.data.email)) return bad('Platform administrators do not sit on a panel')
        if (p.data.kind === 'senior_validator') {
          const [prof] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.email, p.data.email))
          if (!prof || effectiveAccreditation(prof) !== 'accredited') return bad('A Senior Validator must be a currently accredited validator')
        }
        await db.insert(panelRoster).values({ ...p.data, note: p.data.note ?? '', addedBy: caller.email }).onConflictDoUpdate({
          target: panelRoster.email, set: { name: p.data.name, kind: p.data.kind, note: p.data.note ?? '', active: true },
        })
        await audit(caller.email, `added ${p.data.email} to the review panel roster (${p.data.kind})`, p.data.email)
        return json({ ok: true }, 201)
      }
      if (req.method === 'DELETE' && id) {
        const done = await db.update(panelRoster).set({ active: false }).where(eq(panelRoster.email, id.toLowerCase())).returning({ email: panelRoster.email })
        if (!done.length) return notFound()
        await audit(caller.email, `stood ${id} down from the review panel roster`, id)
        return json({ ok: true })
      }
      return notFound()
    }

    if (area !== 'cases') return notFound()

    // ---- Loading and who the caller is --------------------------------------------------------------------
    const load = async (caseId: string) => (await db.select().from(panelCases).where(eq(panelCases.id, caseId)))[0] as PanelCaseRow | undefined
    const validationOf = async (c: PanelCaseRow) => (c.validationId ? (await db.select().from(validations).where(eq(validations.id, c.validationId)))[0] as ValidationRow | undefined : undefined)

    /** The caller's standing in a case. */
    const standing = async (c: PanelCaseRow, members: PanelMemberRow[]) => {
      const member = members.find((m) => m.email.toLowerCase() === me && m.status !== 'declined') ?? null
      const orgWrite = !!c.orgId && caller.orgId === c.orgId && (await canAccessOrg(caller, c.orgId, 'write'))
      const orgRead = orgWrite || (!!c.orgId && caller.orgId === c.orgId && (await canAccessOrg(caller, c.orgId, 'read')))
      const side = await sideOfCaller(c, caller.email, orgWrite)
      const party = side !== null || orgRead
      return { member, orgWrite, side, party, seated: member?.status === 'accepted' }
    }

    const view = async (c: PanelCaseRow) => {
      const members = await membersOf(c.id)
      const st = await standing(c, members)
      if (!staff && !st.member && !st.party) return null
      const v = await validationOf(c)
      const [org] = c.orgId ? await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, c.orgId)) : []
      const [subject] = c.subjectValidatorEmail ? await db.select({ name: validatorProfiles.name }).from(validatorProfiles).where(eq(validatorProfiles.email, c.subjectValidatorEmail)) : []
      const names = await db.select({ email: validatorProfiles.email, name: validatorProfiles.name }).from(validatorProfiles).where(inArray(validatorProfiles.email, members.map((m) => m.email)))
      const roster = await db.select().from(panelRoster).where(inArray(panelRoster.email, members.map((m) => m.email)))
      const subs = await db.select().from(panelSubmissions).where(eq(panelSubmissions.caseId, c.id)).orderBy(panelSubmissions.createdAt)
      const [appeal] = await db.select({ id: panelCases.id }).from(panelCases).where(eq(panelCases.appealOf, c.id))
      const sidesHeard = new Set(subs.filter((s) => s.side === 'organisation' || s.side === 'validator').map((s) => s.side)).size
      const decision = c.decision as Decision | null
      const votes = members.filter((m) => m.status === 'accepted' && m.vote)
      const maj = c.status === 'deliberating' ? majority(votes.map((m) => m.vote as Decision)) : null
      const convenor = st.member?.role === 'convenor' && st.member.status === 'accepted'
      const out: Record<string, unknown> = {
        id: c.id, kind: c.kind, kindLabel: CASE_KIND_LABEL[c.kind as CaseKind], status: c.status, statusLabel: CASE_STATUS_LABEL[c.status as keyof typeof CASE_STATUS_LABEL],
        raisedSide: c.raisedSide, summary: c.summary, createdAt: c.createdAt, organization: org?.name ?? null, validator: subject?.name ?? null,
        validation: v ? { id: v.id, verificationId: v.verificationId, validatedRung: v.validatedRung, status: v.status } : null,
        isAppeal: !!c.appealOf, appealOf: c.appealOf, appealReason: c.appealReason, appealId: appeal?.id ?? null,
        convenedAt: c.convenedAt, respondBy: c.respondBy, decideBy: c.decideBy, overdue: isOverdue({ status: c.status, decideBy: c.decideBy }),
        // Panel: names, role and status. Emails only for the programme team who composes it.
        panel: members.map((m) => ({
          role: m.role, status: m.status, name: names.find((n) => n.email === m.email)?.name ?? roster.find((r) => r.email === m.email)?.name ?? 'Panel member',
          ...(staff ? { email: m.email } : {}), ...(staff || convenor ? { voted: !!m.vote } : {}),
        })),
        // An invited member reads only the summary until they have accepted with their declaration.
        submissions: (st.member && !st.seated && !staff && !st.party ? [] : subs).map((s) => ({ id: s.id, side: s.side, text: s.text, evidenceRef: s.evidenceRef, createdAt: s.createdAt, mine: s.author.toLowerCase() === me })),
        sidesHeard,
        decision: c.status === 'decided' && decision ? { ...decision, label: decisionLabel(decision), reasons: c.decisionReasons, decidedAt: c.decidedAt, late: c.decidedLate, effects: c.effects ?? [] } : null,
        appealBy: c.appealBy,
        can: {
          submit: st.side !== null || st.orgWrite ? ['responses', 'deliberating'].includes(c.status) && !st.member : false,
          respond: st.member?.status === 'invited',
          deliberate: convenor && mayDeliberate({ status: c.status, respondBy: c.respondBy, sidesHeard }),
          vote: st.seated && c.status === 'deliberating',
          decide: convenor && c.status === 'deliberating' && !!maj,
          appeal: (st.side !== null || st.orgWrite) && !st.member && appealOpen({ status: c.status, appealBy: c.appealBy, hasAppeal: !!appeal, isAppeal: !!c.appealOf }),
          compose: staff && c.status === 'open',
        },
        me: st.member ? { role: st.member.role, status: st.member.status, vote: st.member.vote, voteReasons: st.member.voteReasons } : null,
        seatsFree: { convenor: seatsFree(members, 'convenor'), reviewer: seatsFree(members, 'reviewer') },
      }
      if (staff && c.raisedBy) out.raisedBy = c.raisedBy
      if (convenor && c.status === 'deliberating') out.majority = maj ? { ...maj, label: decisionLabel(maj) } : null
      // Panel members who have accepted read the frozen review; an invited member sees only the summary until they accept.
      if (st.seated && v) out.evidence = await evidenceFor(v)
      if (st.seated && c.ratingId) {
        const [r] = await db.select().from(validationRatings).where(eq(validationRatings.id, c.ratingId))
        if (r) out.rating = { stars: r.stars, comment: r.comment, reply: r.reply, party: r.party, status: r.status }
      }
      return out
    }

    async function evidenceFor(v: ValidationRow) {
      const [review] = await db.select({ snapshot: validationReviews.snapshot, sha: validationReviews.snapshotSha256 }).from(validationReviews).where(eq(validationReviews.id, v.reviewId))
      const snap = (review?.snapshot ?? {}) as Record<string, any>
      return {
        sha256: review?.sha ?? null, outcome: snap.outcome, validatedRung: snap.validatedRung, selfRung: snap.selfRung, method: snap.method, fieldwork: snap.fieldwork,
        qualifications: snap.qualifications ?? [], team: (snap.team ?? []).map((t: any) => ({ name: t.name, role: t.role, declaration: t.declaration ? { version: t.declaration.version, fundedDisclosure: t.declaration.fundedDisclosure, disclosure: t.declaration.disclosure } : null })),
        indicators: (snap.indicators ?? []).map((i: any) => ({ id: i.id, level: i.level, domain: i.domain, self: i.self, validator: i.validator, final: i.final, sufficiency: i.sufficiency, comment: i.comment, orgResponse: i.orgResponse })),
      }
    }

    // ---- Cases: list and raise ----------------------------------------------------------------------------
    if (!id) {
      if (req.method === 'GET') {
        const all = await db.select().from(panelCases).orderBy(desc(panelCases.createdAt)).limit(300)
        const out = []
        for (const c of all) { const v = await view(c); if (v) out.push({ id: v.id, kind: v.kind, kindLabel: v.kindLabel, status: v.status, statusLabel: v.statusLabel, organization: v.organization, validator: v.validator, overdue: v.overdue, decideBy: v.decideBy, isAppeal: v.isAppeal, createdAt: v.createdAt, me: v.me, decision: (v.decision as any)?.label ?? null }) }
        return json(out)
      }
      if (req.method === 'POST') {
        const p = raiseSchema.safeParse(await readBody())
        if (!p.success) return bad('Choose what the case is about and describe it (at least 10 characters)')
        const d = p.data
        const open = await db.select({ id: panelCases.id }).from(panelCases).where(and(eq(panelCases.raisedBy, caller.email), ne(panelCases.status, 'decided')))
        if (open.length >= 3) return conflict('You already have three open cases. Wait for a decision before raising another.')
        let row: Omit<typeof panelCases.$inferInsert, 'id' | 'kind' | 'summary' | 'raisedBy' | 'raisedSide'> & { raisedSide: RaisedSide }
        const leadOf = async (engagementId: string) => (await db.select({ email: engagementMembers.email }).from(engagementMembers)
          .where(and(eq(engagementMembers.engagementId, engagementId), eq(engagementMembers.role, 'lead'), eq(engagementMembers.status, 'named'))))[0]?.email ?? null

        if (d.concernId) {
          // A concern reported from a public page, escalated by the programme team.
          if (!staff) return forbidden()
          if (d.kind !== 'validation_dispute' && d.kind !== 'validator_complaint') return bad('A reported concern becomes a dispute about the result or a complaint about the validator')
          const [con] = await db.select().from(validationConcerns).where(eq(validationConcerns.id, d.concernId))
          if (!con) return notFound()
          const [v] = await db.select().from(validations).where(eq(validations.id, con.validationId))
          if (!v) return notFound()
          row = { raisedSide: 'programme', validationId: v.id, engagementId: v.engagementId, orgId: v.orgId, concernId: con.id, subjectValidatorEmail: await leadOf(v.engagementId) }
          await db.update(validationConcerns).set({ status: 'in_review', handledBy: caller.email, handledAt: new Date() }).where(eq(validationConcerns.id, con.id))
        } else if (d.kind === 'feedback_complaint') {
          if (!d.ratingId) return bad('Choose the feedback this is about')
          const [r] = await db.select().from(validationRatings).where(eq(validationRatings.id, d.ratingId))
          // Only the validator who was rated can complain about it.
          if (!r || r.validatorEmail.toLowerCase() !== me) return notFound()
          row = { raisedSide: 'validator', validationId: r.validationId, engagementId: r.engagementId, orgId: r.orgId, ratingId: r.id, subjectValidatorEmail: r.validatorEmail }
        } else {
          if (!d.validationId) return bad('Choose the validation this is about')
          const [v] = await db.select().from(validations).where(eq(validations.id, d.validationId))
          if (!v) return notFound()
          const lead = await leadOf(v.engagementId)
          const isLead = lead?.toLowerCase() === me
          const orgWrite = caller.orgId === v.orgId && (await canAccessOrg(caller, v.orgId, 'write'))
          const mineFirms = await myFunderFirms(caller.email)
          const consents = mineFirms.length ? await db.select({ id: validationFunderConsents.id }).from(validationFunderConsents)
            .where(and(eq(validationFunderConsents.validationId, v.id), inArray(validationFunderConsents.funderFirmId, mineFirms), isNull(validationFunderConsents.revokedAt))) : []
          const side: RaisedSide | null = orgWrite ? 'organisation' : isLead ? 'validator' : consents.length ? 'funder' : null
          if (!side) return forbidden()
          // A validator does not complain about themselves; funders and organisations do not contest a validator's own filing decisions.
          if (d.kind === 'validator_complaint' && side === 'validator') return forbidden()
          if (d.kind === 'contested_event' || d.eventId) {
            if (!d.eventId) return bad('Choose the material event this is about')
            const [ev] = await db.select().from(validationEvents).where(and(eq(validationEvents.id, d.eventId), eq(validationEvents.validationId, v.id)))
            if (!ev) return notFound()
          }
          if ((d.kind === 'contested_event' || d.kind === 're_review_challenge') && side === 'funder') return forbidden()
          row = { raisedSide: side, validationId: v.id, engagementId: v.engagementId, orgId: v.orgId, eventId: d.eventId ?? null, subjectValidatorEmail: lead }
        }
        const caseId = `case_${crypto.randomUUID()}`
        await db.insert(panelCases).values({ ...row, id: caseId, kind: d.kind, summary: d.summary, raisedBy: d.concernId ? 'public' : caller.email })
        await audit(caller.email, `raised review panel case (${d.kind})`, caseId, row.orgId)
        if (process.env.CONCERNS_TO_EMAIL) await notify([process.env.CONCERNS_TO_EMAIL], `New Independent Review Panel case: ${CASE_KIND_LABEL[d.kind]}`, `A case was raised (${caseId}). Sign in to CRAFT, open the Review Panel, and invite a convenor and two reviewers.`)
        return json({ id: caseId }, 201)
      }
      return new Response('Method Not Allowed', { status: 405 })
    }

    const c = await load(id)
    if (!c) return notFound()

    if (req.method === 'GET' && !sub) {
      const v = await view(c)
      return v ? json(v) : notFound()
    }
    const members = await membersOf(c.id)
    const st = await standing(c, members)
    if (!staff && !st.member && !st.party) return notFound()

    // ---- Composing the panel (programme team) ---------------------------------------------------------------
    if (sub === 'members' && req.method === 'POST' && !extra) {
      if (!staff) return forbidden()
      if (c.status !== 'open') return conflict('The panel is already seated for this case')
      const p = memberSchema.safeParse(await readBody())
      if (!p.success) return bad('An email and a role (convenor or reviewer) are required')
      const { email, role } = p.data
      if (members.some((m) => m.email.toLowerCase() === email && m.status !== 'declined')) return conflict('That person is already on this panel')
      if (!seatsFree(members, role)) return conflict(role === 'convenor' ? 'The case already has a convenor' : 'Both reviewer seats are taken')
      if (role === 'convenor') {
        // The convenor comes from the CRAFT programme team's own members, never a platform administrator.
        if (isSuperAdmin(email) || (await staffRole(email)) !== 'programme_team') return bad('The convenor must be a CRAFT programme team member (not a platform administrator)')
      } else {
        const [r] = await db.select().from(panelRoster).where(and(eq(panelRoster.email, email), eq(panelRoster.active, true)))
        if (!r) return bad('Reviewers are chosen from the volunteer roster')
        if (r.kind === 'senior_validator') {
          const [prof] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.email, email))
          if (!prof || effectiveAccreditation(prof) !== 'accredited') return bad('A Senior Validator reviewer must be currently accredited')
        }
      }
      const reasons = await conflictCheck(c, email)
      if (reasons.length) return conflict('This person has a conflict and cannot sit on the panel', { reasons })
      await db.insert(panelMembers).values({ id: `pm_${crypto.randomUUID()}`, caseId: c.id, email, role, addedBy: caller.email }).onConflictDoUpdate({
        target: [panelMembers.caseId, panelMembers.email], set: { role, status: 'invited', declaration: null, declinedReason: null, respondedAt: null },
      })
      await audit(caller.email, `invited a ${role} to review panel case`, c.id, c.orgId)
      await notify([email], 'You are invited to sit on a CRAFT Independent Review Panel', `You have been invited as ${role} on a panel case. Sign in to CRAFT and open the Review Panel to read the summary, then accept (with a no-conflict declaration) or decline.`)
      return json({ ok: true }, 201)
    }
    if (sub === 'members' && req.method === 'DELETE' && extra) {
      if (!staff) return forbidden()
      if (c.status !== 'open') return conflict('The panel is already seated for this case')
      const gone = await db.delete(panelMembers).where(and(eq(panelMembers.caseId, c.id), eq(panelMembers.email, extra.toLowerCase()))).returning({ id: panelMembers.id })
      if (!gone.length) return notFound()
      await audit(caller.email, `took back a panel invitation`, c.id, c.orgId)
      return json({ ok: true })
    }

    // ---- An invited member accepts or declines ----------------------------------------------------------------
    if (sub === 'respond' && req.method === 'POST') {
      const p = respondSchema.safeParse(await readBody())
      if (!p.success) return bad('Accept or decline')
      const mine = members.find((m) => m.email.toLowerCase() === me && m.status === 'invited')
      if (!mine) return notFound()
      const now = new Date()
      if (!p.data.accept) {
        await db.update(panelMembers).set({ status: 'declined', declinedReason: p.data.reason ?? '', respondedAt: now }).where(eq(panelMembers.id, mine.id))
        await audit(caller.email, 'declined a review panel seat', c.id, c.orgId)
        return json({ ok: true })
      }
      if (!p.data.declaration || p.data.declaration.trim() !== NO_CONFLICT_DECLARATION) return bad('Confirm the no-conflict declaration to accept')
      // The check is run again now: things change between an invitation and an acceptance.
      const reasons = await conflictCheck(c, caller.email)
      if (reasons.length) return conflict('You have a conflict and cannot sit on this panel', { reasons })
      const seated = await db.transaction(async (tx) => {
        await tx.update(panelMembers).set({ status: 'accepted', declaration: p.data.declaration, respondedAt: now }).where(eq(panelMembers.id, mine.id))
        const [locked] = await tx.select().from(panelCases).where(eq(panelCases.id, c.id)).for('update')
        const all = await tx.select().from(panelMembers).where(eq(panelMembers.caseId, c.id))
        if (locked.status === 'open' && panelSeated(all)) {
          const clock = caseClock(now)
          await tx.update(panelCases).set({ status: 'responses', convenedAt: now, respondBy: clock.respondBy, decideBy: clock.decideBy, updatedAt: now }).where(eq(panelCases.id, c.id))
          return clock
        }
        return null
      })
      await audit(caller.email, 'accepted a review panel seat with a no-conflict declaration', c.id, c.orgId)
      if (seated) {
        await audit('system', `review panel seated: written responses by ${seated.respondBy}, decision by ${seated.decideBy}`, c.id, c.orgId)
        await noticeAll(c, 'An Independent Review Panel has been seated', `The panel for your case is seated. Written responses (with evidence references) are open until ${seated.respondBy}; a decision with written reasons is due by ${seated.decideBy}. Sign in to CRAFT and open the Review Panel.`)
      }
      return json({ ok: true, seated: !!seated })
    }

    // ---- Written responses -----------------------------------------------------------------------------------
    if (sub === 'submissions' && req.method === 'POST') {
      if (st.member || !(st.side !== null || st.orgWrite)) return forbidden()
      if (!['responses', 'deliberating'].includes(c.status)) return conflict(c.status === 'decided' ? 'This case has been decided' : 'Written responses open once the panel is seated')
      const p = submissionSchema.safeParse(await readBody())
      if (!p.success) return bad('Write your response (up to 8000 characters); an evidence reference is optional')
      const side = st.side ?? 'organisation'
      await db.insert(panelSubmissions).values({ id: `ps_${crypto.randomUUID()}`, caseId: c.id, side, author: caller.email, text: p.data.text, evidenceRef: p.data.evidenceRef ?? '' })
      await audit(caller.email, `wrote a response to review panel case (${side})`, c.id, c.orgId)
      return json({ ok: true }, 201)
    }

    // ---- Convenor: open voting -------------------------------------------------------------------------------
    if (sub === 'deliberate' && req.method === 'POST') {
      if (!(st.member?.role === 'convenor' && st.member.status === 'accepted')) return forbidden()
      const subs = await db.select({ side: panelSubmissions.side }).from(panelSubmissions).where(eq(panelSubmissions.caseId, c.id))
      const sidesHeard = new Set(subs.filter((s) => s.side === 'organisation' || s.side === 'validator').map((s) => s.side)).size
      if (!mayDeliberate({ status: c.status, respondBy: c.respondBy, sidesHeard })) return conflict('Both sides have not yet responded and the response window has not closed')
      await db.update(panelCases).set({ status: 'deliberating', updatedAt: new Date() }).where(and(eq(panelCases.id, c.id), eq(panelCases.status, 'responses')))
      await audit(caller.email, 'opened review panel voting', c.id, c.orgId)
      return json({ ok: true })
    }

    // ---- Votes ---------------------------------------------------------------------------------------------------
    if (sub === 'vote' && req.method === 'PUT') {
      if (!st.seated) return forbidden()
      if (c.status !== 'deliberating') return conflict('Voting is not open')
      const p = voteSchema.safeParse(await readBody())
      if (!p.success) return bad('Choose an outcome and give your reasons (at least 10 characters)')
      const { reasons, ...vote } = p.data
      const problems = decisionProblems(c.kind as CaseKind, vote)
      if (problems.length) return bad(problems[0])
      await db.update(panelMembers).set({ vote, voteReasons: reasons, votedAt: new Date() }).where(eq(panelMembers.id, st.member!.id))
      await audit(caller.email, 'voted on review panel case', c.id, c.orgId)
      return json({ ok: true })
    }

    // ---- Decision ------------------------------------------------------------------------------------------------
    if (sub === 'decide' && req.method === 'POST') {
      if (!(st.member?.role === 'convenor' && st.member.status === 'accepted')) return forbidden()
      const p = decideSchema.safeParse(await readBody())
      if (!p.success) return bad('Write the panel’s reasons (at least 20 characters)')
      const now = new Date()
      const out = await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(panelCases).where(eq(panelCases.id, c.id)).for('update')
        if (locked.status !== 'deliberating') return { error: conflict('This case is not open for a decision') }
        const all = await tx.select().from(panelMembers).where(and(eq(panelMembers.caseId, c.id), eq(panelMembers.status, 'accepted')))
        const decision = majority(all.flatMap((m) => (m.vote ? [m.vote as Decision] : [])), all.length)
        if (!decision) return { error: conflict('There is no majority yet: at least two of the three members must vote for the same outcome') }
        const problems = decisionProblems(locked.kind as CaseKind, decision)
        if (problems.length) return { error: bad(problems[0]) }
        const applied = await applyDecision(tx as never, locked, decision, p.data.reasons, now)
        const late = !!locked.decideBy && locked.decideBy < now.toISOString().slice(0, 10)
        await tx.update(panelCases).set({
          status: 'decided', decision, decisionReasons: p.data.reasons, decidedAt: now, decidedBy: caller.email, decidedLate: late, effects: applied.effects,
          appealBy: locked.appealOf ? null : appealDeadline(now), updatedAt: now,
        }).where(eq(panelCases.id, c.id))
        await tx.insert(auditLogs).values({ actor: caller.email, action: `review panel decided: ${decisionLabel(decision)}${late ? ' (after the 30-day target)' : ''}`, target: c.id, category: 'Validation', orgId: c.orgId ?? undefined })
        return { decision, applied, late }
      })
      if ('error' in out) return out.error
      await afterDecision(out.applied.reconcile)
      await noticeAll(c, 'The Independent Review Panel has decided', `The panel decided: ${decisionLabel(out.decision)}.\n\nReasons: ${p.data.reasons}\n\n${c.appealOf ? 'This was an appeal, so the decision is final.' : 'Either side may appeal once, to a fresh panel, within 14 days.'}`)
      return json({ ok: true, decision: out.decision, effects: out.applied.effects })
    }

    // ---- One appeal, to a fresh panel -------------------------------------------------------------------------------
    if (sub === 'appeal' && req.method === 'POST') {
      if (st.member || !(st.side !== null || st.orgWrite)) return forbidden()
      const p = appealSchema.safeParse(await readBody())
      if (!p.success) return bad('Say why you are appealing (at least 10 characters)')
      const [existing] = await db.select({ id: panelCases.id }).from(panelCases).where(eq(panelCases.appealOf, c.id))
      if (!appealOpen({ status: c.status, appealBy: c.appealBy, hasAppeal: !!existing, isAppeal: !!c.appealOf })) return conflict('This case cannot be appealed (already appealed, itself an appeal, not yet decided, or the 14 days have passed)')
      const appealId = `case_${crypto.randomUUID()}`
      const side = st.side ?? 'organisation'
      try {
        await db.insert(panelCases).values({
          id: appealId, kind: c.kind, raisedBy: caller.email, raisedSide: side === 'other' ? 'funder' : side, summary: `Appeal of case ${c.id}: ${p.data.reason}`, validationId: c.validationId, engagementId: c.engagementId, orgId: c.orgId,
          ratingId: c.ratingId, eventId: c.eventId, concernId: c.concernId, subjectValidatorEmail: c.subjectValidatorEmail, appealOf: c.id, appealReason: p.data.reason,
        })
      } catch {
        return conflict('This case has already been appealed')
      }
      await audit(caller.email, 'appealed a review panel decision', appealId, c.orgId)
      if (process.env.CONCERNS_TO_EMAIL) await notify([process.env.CONCERNS_TO_EMAIL], 'Appeal to the Independent Review Panel', `A decision (case ${c.id}) was appealed (${appealId}). Invite a fresh panel: none of the original members may sit.`)
      return json({ id: appealId }, 201)
    }

    return notFound()
  } catch (err) {
    logger.error('/api/review-panel', 'failed', err)
    return json({ error: 'Something went wrong' }, 500)
  }
}

export const config: Config = { path: ['/api/review-panel', '/api/review-panel/*'] }
