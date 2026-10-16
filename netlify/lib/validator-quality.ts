// Server side of "trust and quality" (validator system PR 7): loads finalised reviews and ratings, and hands
// them to the pure rules in src/lib/validatorQuality.ts. Also the one DevMapper summary function.
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { legacyWorkspaceState } from '../../db/legacy-schema.js'
import {
  engagementMembers, firms, organizations, validationConcerns, validationEngagements, validationRatings, validationReviews, validations, validatorProfiles,
  type ValidationRow,
} from '../../db/schema.js'
import { decryptField } from './crypto.js'
import { describeValidation } from './validation-lifecycle.js'
import { publicUrlFor } from './public-validation.js'
import { cleanScores, FRAMEWORKS } from '../../src/lib/validationReview.js'
import {
  isConfirmedStatus, outOfLine, positionsByValidator, reReviewFlags, reviewMetrics, summariseRatings, validatorStats,
  type DevMapperSummary, type Flag, type RatingSummary, type ReviewMetrics, type ValidatorStats,
} from '../../src/lib/validatorQuality.js'

/** The organisation's own scores for a framework, from its saved assessment. */
export async function loadSelfScores(orgId: string, key: string, ids: Set<string>): Promise<Record<string, number>> {
  const [row] = await db.select().from(legacyWorkspaceState).where(and(eq(legacyWorkspaceState.orgId, orgId), eq(legacyWorkspaceState.key, key)))
  if (!row) return {}
  try { return cleanScores(JSON.parse(decryptField(row.value)), ids) } catch { return {} }
}

export type FinalisedReview = {
  engagementId: string
  orgId: string
  /** Lead validator's email; the unit statistics and ratings are kept against. */
  validator: string
  validatorFirmId: string | null
  funderFirmId: string | null
  finalisedAt: Date
  metrics: ReviewMetrics
  validationId: string | null
}

/** Every finalised independent validation (funder reviews have no validator to assess), with its frozen metrics. */
export async function finalisedReviews(): Promise<FinalisedReview[]> {
  const rows = await db.select({ r: validationReviews, e: validationEngagements }).from(validationReviews)
    .innerJoin(validationEngagements, eq(validationEngagements.id, validationReviews.engagementId))
    .where(and(eq(validationReviews.status, 'finalised'), eq(validationEngagements.type, 'independent_validation')))
  if (!rows.length) return []
  const ids = rows.map((x) => x.e.id)
  const leads = await db.select().from(engagementMembers).where(and(inArray(engagementMembers.engagementId, ids), eq(engagementMembers.role, 'lead'), eq(engagementMembers.status, 'named')))
  const issued = await db.select({ id: validations.id, engagementId: validations.engagementId }).from(validations).where(inArray(validations.engagementId, ids))
  const out: FinalisedReview[] = []
  for (const { r, e } of rows) {
    const validator = leads.find((l) => l.engagementId === e.id)?.email ?? e.validatorEmail
    if (!validator || !r.finalisedAt) continue
    out.push({
      engagementId: e.id, orgId: e.orgId, validator, validatorFirmId: e.validatorFirmId, funderFirmId: e.funderFirmId, finalisedAt: r.finalisedAt,
      metrics: reviewMetrics(r.outcome ?? '', r.snapshot as never), validationId: issued.find((i) => i.engagementId === e.id)?.id ?? null,
    })
  }
  return out
}

/** Statistics for every validator that has at least one finalised validation. */
export async function allValidatorStats(reviews?: FinalisedReview[]): Promise<Map<string, ValidatorStats>> {
  const list = reviews ?? await finalisedReviews()
  const issued = list.flatMap((r) => (r.validationId ? [r.validationId] : []))
  const status = issued.length ? await db.select({ id: validations.id, status: validations.status }).from(validations).where(inArray(validations.id, issued)) : []
  const concerns = issued.length ? await db.select({ validationId: validationConcerns.validationId }).from(validationConcerns).where(inArray(validationConcerns.validationId, issued)) : []
  const byValidator = new Map<string, FinalisedReview[]>()
  for (const r of list) byValidator.set(r.validator, [...(byValidator.get(r.validator) ?? []), r])
  const out = new Map<string, ValidatorStats>()
  for (const [validator, rs] of byValidator) {
    const mine = new Set(rs.flatMap((r) => (r.validationId ? [r.validationId] : [])))
    out.set(validator, validatorStats(rs.map((r) => r.metrics), {
      withdrawn: status.filter((s) => mine.has(s.id) && s.status === 'withdrawn').length,
      concerns: concerns.filter((c) => mine.has(c.validationId)).length,
    }))
  }
  return out
}

export type FlaggedValidation = {
  validationId: string
  verificationId: string | null
  organization: string
  validatorName: string
  firm: string | null
  engagementId: string
  validatedRung: number
  finalisedAt: string
  flags: Flag[]
}

/** Issued validations that deserve a re-review look. Advice only: nothing is opened or changed by it. */
export async function flaggedValidations(): Promise<FlaggedValidation[]> {
  const reviews = await finalisedReviews()
  const stats = await allValidatorStats(reviews)
  const positions = positionsByValidator(reviews.map((r) => ({ id: r.engagementId, validator: r.validator, finalisedAt: r.finalisedAt })))
  const issued = reviews.filter((r) => r.validationId)
  if (!issued.length) return []
  const vals = await db.select().from(validations).where(inArray(validations.id, issued.map((r) => r.validationId!)))
  const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, [...new Set(issued.map((r) => r.orgId))]))
  const profiles = await db.select({ email: validatorProfiles.email, name: validatorProfiles.name }).from(validatorProfiles).where(inArray(validatorProfiles.email, [...new Set(issued.map((r) => r.validator))]))
  const firmIds = [...new Set(issued.flatMap((r) => (r.validatorFirmId ? [r.validatorFirmId] : [])))]
  const firmRows = firmIds.length ? await db.select({ id: firms.id, name: firms.name }).from(firms).where(inArray(firms.id, firmIds)) : []
  const out: FlaggedValidation[] = []
  for (const r of issued) {
    const v = vals.find((x) => x.id === r.validationId)
    // Only validations that still stand need a second look.
    if (!v || v.status === 'withdrawn' || v.status === 'superseded') continue
    const own = stats.get(r.validator)
    const peers = [...stats.entries()].filter(([k]) => k !== r.validator).map(([, s]) => s)
    const flags = reReviewFlags({ position: positions.get(r.engagementId) ?? 0, metrics: r.metrics, peer: own ? outOfLine(own, peers) : { reasons: [] } })
    if (!flags.length) continue
    out.push({
      validationId: v.id, verificationId: v.verificationId, organization: orgs.find((o) => o.id === r.orgId)?.name ?? '',
      validatorName: profiles.find((p) => p.email === r.validator)?.name ?? 'Validator', firm: firmRows.find((f) => f.id === r.validatorFirmId)?.name ?? null,
      engagementId: r.engagementId, validatedRung: v.validatedRung, finalisedAt: r.finalisedAt.toISOString(), flags,
    })
  }
  return out.sort((a, b) => b.flags.length - a.flags.length || b.finalisedAt.localeCompare(a.finalisedAt))
}

export type PublicRating = { id: string; party: string; stars: number; comment: string; reply: string; replyAt: Date | null; createdAt: Date; country: string }
export type RemovedRating = PublicRating & { removalGround: string | null; removalReason: string | null }

/** A validator's published ratings: the party and the organisation's country only, never names or emails. */
export async function ratingsFor(validatorEmail: string, opts: { includeRemoved?: boolean } = {}): Promise<{ summary: RatingSummary; ratings: PublicRating[]; removed?: RemovedRating[] }> {
  const rows = await db.select({ r: validationRatings, country: organizations.country }).from(validationRatings)
    .innerJoin(organizations, eq(organizations.id, validationRatings.orgId))
    .where(eq(validationRatings.validatorEmail, validatorEmail)).orderBy(desc(validationRatings.createdAt))
  return {
    summary: summariseRatings(rows.map((x) => x.r)),
    ratings: rows.filter((x) => x.r.status === 'published').map(({ r, country }) => ({
      id: r.id, party: r.party, stars: r.stars, comment: r.comment, reply: r.reply, replyAt: r.replyAt, createdAt: r.createdAt, country,
    })),
    // Platform admin only: removed feedback stays on record so a removal can be reviewed and undone.
    ...(opts.includeRemoved ? {
      removed: rows.filter((x) => x.r.status === 'removed').map(({ r, country }) => ({
        id: r.id, party: r.party, stars: r.stars, comment: r.comment, reply: r.reply, replyAt: r.replyAt, createdAt: r.createdAt, country,
        removalGround: r.removalGround, removalReason: r.removalReason,
      })),
    } : {}),
  }
}

/** Average rating of a firm's validators' engagements (for firm profiles). */
export async function firmRatingSummary(firmId: string): Promise<RatingSummary> {
  const rows = await db.select({ stars: validationRatings.stars, status: validationRatings.status }).from(validationRatings).where(eq(validationRatings.validatorFirmId, firmId))
  return summariseRatings(rows)
}

// ---- DevMapper summary ------------------------------------------------------------------------------------------

/**
 * What DevMapper shows for an organisation: the self-assessed rung, and the latest validation that currently
 * stands, if any. Expired, suspended, withdrawn and superseded validations are not a confirmed rung.
 * A funder's own review is labelled "Funder review" and never "validated".
 */
export async function devMapperSummary(orgId: string, framework = 'capital-readiness', now = new Date()): Promise<DevMapperSummary | null> {
  const fw = FRAMEWORKS[framework]
  if (!fw) return null
  const ids = new Set(fw.indicators.map((i) => i.id))
  const self = await loadSelfScores(orgId, fw.scoresKey, ids)
  const answered = Object.keys(self).length > 0
  const selfRung = answered ? fw.rung(self) : null
  const summary: DevMapperSummary = {
    organisationId: orgId, framework,
    selfAssessed: { label: 'Self-assessed', rung: selfRung, rungName: selfRung === null ? null : (fw.levels.find((l) => l.level === selfRung)?.name ?? null) },
    validation: null,
  }
  const rows = await db.select().from(validations).where(and(eq(validations.orgId, orgId), eq(validations.framework, framework))).orderBy(desc(validations.issuedAt))
  for (const v of rows as ValidationRow[]) {
    const d = await describeValidation(v, now)
    if (!isConfirmedStatus(d.status)) continue
    const [e] = await db.select().from(validationEngagements).where(eq(validationEngagements.id, v.engagementId))
    const [review] = await db.select({ snapshot: validationReviews.snapshot, finalisedAt: validationReviews.finalisedAt }).from(validationReviews).where(eq(validationReviews.id, v.reviewId))
    const snap = (review?.snapshot ?? {}) as { engagement?: { engagedBy?: string }; validatorFirm?: string | null }
    const funder = e?.type === 'funder_review'
    const next = [
      d.followUp.dueOn ? { kind: 'follow_up', on: d.followUp.dueOn } : null,
      ...d.checkpoints.filter((c) => c.state === 'pending').map((c) => ({ kind: c.kind, on: c.dueOn })),
    ].filter((x): x is { kind: string; on: string } => !!x).sort((a, b) => a.on.localeCompare(b.on))[0] ?? null
    summary.validation = {
      label: funder ? 'Funder review' : 'Independent validation', validatedRung: v.validatedRung, rungName: fw.levels.find((l) => l.level === v.validatedRung)?.name ?? '',
      outcome: v.outcome, status: d.status,
      validatorOrganisation: snap.validatorFirm ?? null, validatorType: e?.validatorFirmId ? 'firm' : 'individual',
      engagedBy: snap.engagement?.engagedBy ?? '', finalisedOn: (review?.finalisedAt ?? v.issuedAt).toISOString().slice(0, 10), expiresOn: d.expiresAt.toISOString().slice(0, 10),
      nextVerificationPoint: next, verificationId: v.verificationId,
    }
    break
  }
  return summary
}

export const verificationUrlFor = (summary: DevMapperSummary): string | null => (summary.validation?.verificationId ? publicUrlFor(summary.validation.verificationId) : null)
