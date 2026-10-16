import type { Config } from '@netlify/functions'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, engagementMembers, firmMembers, firms, organizations, validationEngagements, validationFunderConsents, validationRatings, validations, validatorProfiles } from '../../db/schema.js'
import { canAccessOrg, forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger } from '../lib/logger.js'
import { allValidatorStats, flaggedValidations, ratingsFor } from '../lib/validator-quality.js'
import { RATING_PARTIES, REMOVAL_GROUNDS, type RatingParty } from '../../src/lib/validatorQuality.js'

// /api/validator-quality — ratings and feedback, validator statistics and re-review flags (validator system PR 7).
//
//   GET  /ratings/mine             engagements the caller may rate (as the organisation, or as the engaging funding partner) with any rating given
//   POST /ratings                  {engagementId, party, stars, comment}: rate the lead validator of a finalised independent validation, once per party
//   PUT  /ratings/:id/reply        the validator rated: a public reply
//   POST /ratings/:id/remove       platform admin (until the Review Panel decides): remove false or abusive feedback {ground, reason}
//   POST /ratings/:id/restore      platform admin: put a removed rating back {reason}
//   GET  /me                       a validator: own statistics, ratings and replies
//   GET  /stats                    platform admin: statistics for every validator
//   GET  /flags                    platform admin: validations flagged for re-review; funding-partner staff: flags of validations whose organisation lets them follow progress
//
// Flags are advice. Nothing here opens a re-review, changes a validation or touches a validator's accreditation.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const bad = (error: string) => json({ error }, 400)
const notFound = () => json({ error: 'Not found' }, 404)
const audit = (actor: string, action: string, target: string, orgId: string) =>
  db.insert(auditLogs).values({ actor, action, target, category: 'Validation', orgId })

const rateSchema = z.object({
  engagementId: z.string().min(1).max(200), party: z.enum(RATING_PARTIES),
  stars: z.number().int().min(1).max(5), comment: z.string().trim().max(2000).optional(),
})
const replySchema = z.object({ reply: z.string().trim().min(1).max(2000) })
const removeSchema = z.object({ ground: z.enum(REMOVAL_GROUNDS), reason: z.string().trim().min(3).max(1000) })
const restoreSchema = z.object({ reason: z.string().trim().min(3).max(1000) })

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
    const [area, id, act] = url.pathname.replace(/^\/api\/validator-quality\/?/, '').split('/').filter(Boolean)
    const readBody = async () => { try { return await req.json() } catch { return null } }
    const admin = isSuperAdmin(caller.email)

    /** Which parties of a finalised independent validation the caller speaks for. */
    const partiesOf = async (e: typeof validationEngagements.$inferSelect): Promise<RatingParty[]> => {
      if (e.status !== 'finalised' || e.type !== 'independent_validation') return []
      const out: RatingParty[] = []
      if (e.orgStatus === 'accepted' && caller.orgId === e.orgId && (await canAccessOrg(caller, e.orgId, 'write'))) out.push('organisation')
      if (e.funderFirmId && e.funderStatus === 'accepted' && (await myFunderFirms(caller.email)).includes(e.funderFirmId)) out.push('funder')
      // A validator on the engagement never rates their own work, whatever other hats they wear.
      const team = await db.select({ email: engagementMembers.email }).from(engagementMembers).where(eq(engagementMembers.engagementId, e.id))
      return team.some((m) => m.email === caller.email) ? [] : out
    }

    if (area === 'ratings') {
      if (req.method === 'GET' && id === 'mine' && !act) {
        const fundersMine = await myFunderFirms(caller.email)
        if (!caller.orgId && !fundersMine.length) return json([])
        const candidates = await db.select().from(validationEngagements).where(and(
          eq(validationEngagements.status, 'finalised'), eq(validationEngagements.type, 'independent_validation'),
          or(caller.orgId ? eq(validationEngagements.orgId, caller.orgId) : undefined, fundersMine.length ? inArray(validationEngagements.funderFirmId, fundersMine) : undefined),
        ))
        const mine = []
        for (const e of candidates) {
          const parties = await partiesOf(e)
          if (!parties.length) continue
          const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, e.orgId))
          const given = await db.select().from(validationRatings).where(eq(validationRatings.engagementId, e.id))
          const [lead] = await db.select({ email: engagementMembers.email }).from(engagementMembers).where(and(eq(engagementMembers.engagementId, e.id), eq(engagementMembers.role, 'lead'), eq(engagementMembers.status, 'named')))
          const [profile] = lead ? await db.select({ name: validatorProfiles.name }).from(validatorProfiles).where(eq(validatorProfiles.email, lead.email)) : []
          for (const party of parties) {
            const r = given.find((x) => x.party === party)
            mine.push({
              engagementId: e.id, party, organization: org?.name ?? '', validator: profile?.name ?? 'Validator',
              rating: r ? { id: r.id, stars: r.stars, comment: r.comment, reply: r.reply, status: r.status } : null,
            })
          }
        }
        return json(mine)
      }

      if (req.method === 'POST' && !id) {
        const p = rateSchema.safeParse(await readBody())
        if (!p.success) return bad('Choose a rating from 1 to 5 stars; a comment is optional (up to 2000 characters)')
        const [e] = await db.select().from(validationEngagements).where(eq(validationEngagements.id, p.data.engagementId))
        if (!e) return notFound()
        if (!(await partiesOf(e)).includes(p.data.party)) return forbidden()
        const [lead] = await db.select({ email: engagementMembers.email }).from(engagementMembers).where(and(eq(engagementMembers.engagementId, e.id), eq(engagementMembers.role, 'lead'), eq(engagementMembers.status, 'named')))
        const validatorEmail = lead?.email ?? e.validatorEmail
        if (!validatorEmail) return bad('This engagement has no lead validator to rate')
        const [issued] = await db.select({ id: validations.id }).from(validations).where(eq(validations.engagementId, e.id))
        const rid = `rat_${crypto.randomUUID()}`
        const created = await db.insert(validationRatings).values({
          id: rid, engagementId: e.id, validationId: issued?.id ?? null, orgId: e.orgId, party: p.data.party, raterEmail: caller.email,
          validatorEmail, validatorFirmId: e.validatorFirmId, stars: p.data.stars, comment: p.data.comment ?? '',
        }).onConflictDoNothing().returning({ id: validationRatings.id })
        if (!created.length) return json({ error: 'This engagement has already been rated by your side' }, 409)
        await audit(caller.email, `rated validator ${p.data.stars}/5 (${p.data.party})`, rid, e.orgId)
        return json({ ok: true, id: rid }, 201)
      }

      if (req.method === 'PUT' && id && act === 'reply') {
        const p = replySchema.safeParse(await readBody())
        if (!p.success) return bad('Write your reply (up to 2000 characters)')
        const [r] = await db.select().from(validationRatings).where(eq(validationRatings.id, id))
        if (!r || r.validatorEmail !== caller.email) return notFound()
        if (r.status !== 'published') return json({ error: 'This feedback has been removed' }, 409)
        await db.update(validationRatings).set({ reply: p.data.reply, replyBy: caller.email, replyAt: new Date(), updatedAt: new Date() }).where(eq(validationRatings.id, id))
        await audit(caller.email, 'replied to feedback', id, r.orgId)
        return json({ ok: true })
      }

      if (req.method === 'POST' && id && (act === 'remove' || act === 'restore')) {
        if (!admin) return forbidden()
        const [r] = await db.select().from(validationRatings).where(eq(validationRatings.id, id))
        if (!r) return notFound()
        const now = new Date()
        if (act === 'remove') {
          const p = removeSchema.safeParse(await readBody())
          if (!p.success) return bad('Choose a ground and give a reason (at least 3 characters)')
          if (r.status === 'removed') return json({ error: 'Already removed' }, 409)
          await db.update(validationRatings).set({ status: 'removed', removedBy: caller.email, removedAt: now, removalGround: p.data.ground, removalReason: p.data.reason, updatedAt: now }).where(eq(validationRatings.id, id))
          await audit(caller.email, `removed feedback (${p.data.ground}): ${p.data.reason}`, id, r.orgId)
        } else {
          const p = restoreSchema.safeParse(await readBody())
          if (!p.success) return bad('Give a reason (at least 3 characters)')
          if (r.status !== 'removed') return json({ error: 'Not removed' }, 409)
          await db.update(validationRatings).set({ status: 'published', removedBy: null, removedAt: null, removalGround: null, removalReason: null, updatedAt: now }).where(eq(validationRatings.id, id))
          await audit(caller.email, `restored feedback: ${p.data.reason}`, id, r.orgId)
        }
        return json({ ok: true })
      }
      return notFound()
    }

    if (area === 'me' && req.method === 'GET') {
      const [profile] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.email, caller.email))
      if (!profile) return json({ error: 'No validator profile' }, 404)
      const stats = (await allValidatorStats()).get(caller.email) ?? null
      return json({ stats, ...(await ratingsFor(caller.email)) })
    }

    if (area === 'stats' && req.method === 'GET') {
      if (!admin) return forbidden()
      const stats = await allValidatorStats()
      const emails = [...stats.keys()]
      const profiles = emails.length ? await db.select({ email: validatorProfiles.email, name: validatorProfiles.name, id: validatorProfiles.id }).from(validatorProfiles).where(inArray(validatorProfiles.email, emails)) : []
      const out = []
      for (const [email, s] of stats) {
        const r = await ratingsFor(email)
        out.push({ validatorId: profiles.find((p) => p.email === email)?.id ?? null, name: profiles.find((p) => p.email === email)?.name ?? email, stats: s, rating: r.summary })
      }
      return json(out.sort((a, b) => b.stats.reviews - a.stats.reviews))
    }

    if (area === 'flags' && req.method === 'GET') {
      const all = await flaggedValidations()
      if (admin) return json(all)
      const firmsOf = await myFunderFirms(caller.email)
      if (!firmsOf.length) return forbidden()
      // A funding partner sees flags only for validations whose organisation currently lets it follow them.
      const consents = await db.select({ validationId: validationFunderConsents.validationId }).from(validationFunderConsents)
        .where(and(inArray(validationFunderConsents.funderFirmId, firmsOf), isNull(validationFunderConsents.revokedAt)))
      const allowed = new Set(consents.map((c) => c.validationId))
      return json(all.filter((f) => allowed.has(f.validationId)))
    }

    return notFound()
  } catch (err) {
    logger.error('/api/validator-quality', 'failed', err)
    return json({ error: 'Something went wrong' }, 500)
  }
}

export const config: Config = { path: ['/api/validator-quality', '/api/validator-quality/*'] }
