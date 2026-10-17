// Server side of the Independent Review Panel (validator system PR 7b): who is in a case, the conflict check
// run against the database, and what a decision does. Pure rules live in src/lib/reviewPanel.ts.
import { and, eq, gte, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  accessGrants, auditLogs, engagementMembers, firmMembers, panelCases, panelMembers, users, validationEngagements, validationEvents, validationRatings, validations, validatorProfiles,
  type PanelCaseRow, type PanelMemberRow,
} from '../../db/schema.js'
import { isSuperAdmin } from './auth.js'
import { contactsFor, notify, orgContactsFor, recordStatusHistory } from './validation-lifecycle.js'
import { reconcileValidator } from './engagement-access.js'
import { CONFLICT_YEARS, conflictReasons, type Decision, type Side } from '../../src/lib/reviewPanel.js'

type Tx = Pick<typeof db, 'insert' | 'select' | 'update' | 'delete'>
/** What a conflict check needs to know: a panel case, or a re-review described the same way. */
export type ConflictSubject = Pick<PanelCaseRow, 'engagementId' | 'orgId' | 'subjectValidatorEmail' | 'raisedBy' | 'raisedSide' | 'appealOf'>
const lower = (l: Array<string | null | undefined>) => [...new Set(l.filter((e): e is string => !!e).map((e) => e.toLowerCase()))]

export async function membersOf(caseId: string): Promise<PanelMemberRow[]> {
  return db.select().from(panelMembers).where(eq(panelMembers.caseId, caseId))
}

/** Everyone who is a named member of the case's engagement (the validation team), lead first. */
async function teamEmails(c: Pick<PanelCaseRow, 'engagementId'>): Promise<string[]> {
  if (!c.engagementId) return []
  const rows = await db.select({ email: engagementMembers.email }).from(engagementMembers).where(and(eq(engagementMembers.engagementId, c.engagementId), eq(engagementMembers.status, 'named')))
  return rows.map((r) => r.email)
}

const activeFirms = async (email: string): Promise<string[]> =>
  (await db.select({ id: firmMembers.firmId }).from(firmMembers).where(and(eq(firmMembers.email, email), eq(firmMembers.status, 'active')))).map((r) => r.id)

/** The people the case is about or brought by: they may never sit on its panel. */
export async function partyEmails(c: ConflictSubject): Promise<string[]> {
  // Every person in the organisation is a party, not only its admins and contact address.
  const org = c.orgId ? [...await orgContactsFor(c.orgId), ...(await db.select({ email: users.email }).from(users).where(eq(users.orgId, c.orgId))).map((u) => u.email)] : []
  return lower([c.subjectValidatorEmail, c.raisedBy === 'public' ? null : c.raisedBy, ...org, ...(await teamEmails(c))])
}

/** What the database says about a possible reviewer; the pure rules decide. Empty means no conflict found. */
export async function conflictCheck(c: ConflictSubject, reviewer: string, now = new Date()): Promise<string[]> {
  const email = reviewer.toLowerCase()
  const since = new Date(now.getTime() - CONFLICT_YEARS * 365.25 * 86_400_000)
  const [engagement] = c.engagementId ? await db.select().from(validationEngagements).where(eq(validationEngagements.id, c.engagementId)) : []
  const subjectFirms = c.subjectValidatorEmail ? await activeFirms(c.subjectValidatorEmail) : []
  const raiserFirms = c.raisedSide === 'funder' ? await activeFirms(c.raisedBy) : []
  const partyFirmIds = [...new Set([...subjectFirms, ...raiserFirms, ...[engagement?.validatorFirmId, engagement?.funderFirmId].filter((x): x is string => !!x)])]

  // Worked for or with a party in the last 3 years: on an engagement with the organisation or the validator,
  // or holding an access grant to the organisation.
  const mine = await db.select({ engagementId: engagementMembers.engagementId, orgId: validationEngagements.orgId }).from(engagementMembers)
    .innerJoin(validationEngagements, eq(validationEngagements.id, engagementMembers.engagementId))
    .where(and(eq(engagementMembers.email, email), gte(validationEngagements.createdAt, since)))
  let worked = !!c.orgId && mine.some((m) => m.orgId === c.orgId)
  if (!worked && c.subjectValidatorEmail && mine.length) {
    const shared = await db.select({ id: engagementMembers.id }).from(engagementMembers)
      .where(and(eq(engagementMembers.email, c.subjectValidatorEmail), inArray(engagementMembers.engagementId, mine.map((m) => m.engagementId))))
    worked = shared.length > 0
  }
  if (!worked && c.orgId) {
    const grants = await db.select({ id: accessGrants.id }).from(accessGrants).where(and(eq(accessGrants.orgId, c.orgId), eq(accessGrants.grantee, email), gte(accessGrants.createdAt, since)))
    worked = grants.length > 0
  }
  // Members of the case this one appeals (and of any earlier panel in that chain).
  const earlier: string[] = []
  for (let cur = c.appealOf; cur;) {
    earlier.push(...(await membersOf(cur)).filter((m) => m.status !== 'declined').map((m) => m.email))
    const [prev] = await db.select({ appealOf: panelCases.appealOf }).from(panelCases).where(eq(panelCases.id, cur))
    cur = prev?.appealOf ?? null
  }
  return conflictReasons({
    reviewer: email, isPlatformAdmin: isSuperAdmin(email), parties: await partyEmails(c), reviewerFirmIds: await activeFirms(email), partyFirmIds,
    workedWithPartyRecently: worked, earlierPanelMembers: earlier,
  })
}

/** Which side of the case a signed-in person is on (for labelling their written responses), or null when none. */
export async function sideOfCaller(c: PanelCaseRow, email: string, canWriteOrg: boolean): Promise<Side | null> {
  const me = email.toLowerCase()
  if (c.subjectValidatorEmail?.toLowerCase() === me || (await teamEmails(c)).some((t) => t.toLowerCase() === me)) return 'validator'
  if (canWriteOrg) return 'organisation'
  if (c.raisedBy.toLowerCase() === me) return c.raisedSide === 'funder' ? 'funder' : 'other'
  return null
}

/** Everyone who should hear about the case: parties' contacts. */
export async function noticeRecipients(c: PanelCaseRow): Promise<string[]> {
  const org = c.orgId ? await orgContactsFor(c.orgId) : []
  let validator: string[] = []
  if (c.validationId) {
    const [v] = await db.select().from(validations).where(eq(validations.id, c.validationId))
    if (v) validator = (await contactsFor(v)).validator
  }
  return lower([...org, ...validator, c.subjectValidatorEmail, c.raisedBy === 'public' ? null : c.raisedBy])
}

export async function noticeAll(c: PanelCaseRow, subject: string, text: string): Promise<void> {
  await notify(await noticeRecipients(c), subject, text)
}

/**
 * Applies a panel decision to the validation, the validator and the feedback it concerned. State-setting and
 * repeatable, so an appeal decision simply overrides the first. Returns a plain-language list of what changed.
 */
export async function applyDecision(tx: Tx, c: PanelCaseRow, d: Decision, reasons: string, now: Date): Promise<{ effects: string[]; reconcile: string | null }> {
  const effects: string[] = []
  const why = `Independent Review Panel decision (case ${c.id})`
  const actor = `panel:${c.id}`

  if (c.validationId && d.validation !== 'none') effects.push(...await applyValidationOutcome(tx, c.validationId, d.validation, { why, by: `the Independent Review Panel (case ${c.id})`, actor, reasons, now, eventId: c.eventId }))

  let reconcile: string | null = null
  if (d.validator !== 'none') {
    if (!c.subjectValidatorEmail) effects.push('No validator is recorded on this case; no action was taken against a validator')
    else if (d.validator === 'warned') effects.push(`Validator warned (${c.subjectValidatorEmail})`)
    else {
      const [p] = await tx.select().from(validatorProfiles).where(eq(validatorProfiles.email, c.subjectValidatorEmail))
      if (!p) effects.push('The validator has no profile; nothing to change')
      else {
        const patch = d.validator === 'retrain'
          // Accreditation lapses until the validator passes the yearly renewal again.
          ? { accreditedUntil: now, accreditationReason: `${why}: retraining required` }
          : d.validator === 'suspended'
            ? { accreditationStatus: 'suspended', accreditationReason: `${why}: ${reasons.slice(0, 300)}` }
            : { accreditationStatus: 'suspended', accreditedUntil: null, accreditationReason: `${why}: removed — ${reasons.slice(0, 300)}` }
        await tx.update(validatorProfiles).set({ ...patch, accreditationChangedBy: actor, accreditationChangedAt: now }).where(eq(validatorProfiles.id, p.id))
        effects.push(`Validator ${d.validator === 'retrain' ? 'must retrain (accreditation lapsed)' : d.validator === 'suspended' ? 'suspended' : 'removed'}: ${p.name}`)
        reconcile = p.email
      }
    }
  }

  if (c.ratingId && d.feedback !== 'none') {
    const [r] = await tx.select().from(validationRatings).where(eq(validationRatings.id, c.ratingId)).for('update')
    if (r && d.feedback === 'remove' && r.status !== 'removed') {
      await tx.update(validationRatings).set({ status: 'removed', removedBy: actor, removedAt: now, removalGround: d.feedbackGround ?? 'false', removalReason: `${why}: ${reasons.slice(0, 300)}`, updatedAt: now }).where(eq(validationRatings.id, r.id))
      effects.push('Feedback removed')
    } else if (r && d.feedback === 'keep') {
      if (r.status === 'removed') {
        await tx.update(validationRatings).set({ status: 'published', removedBy: null, removedAt: null, removalGround: null, removalReason: null, updatedAt: now }).where(eq(validationRatings.id, r.id))
        effects.push('Feedback restored')
      } else effects.push('Feedback kept')
    }
  }
  await tx.insert(auditLogs).values({ actor, action: `applied panel decision: ${effects.join('; ') || 'no change'}`, target: c.id, category: 'Validation', orgId: c.orgId ?? undefined })
  return { effects, reconcile }
}

/**
 * Sets a validation's status for a ruling (panel decision or re-review outcome). State-setting and repeatable.
 * A contested material event, if given, follows the same ruling. Returns a plain-language list of what changed.
 */
export async function applyValidationOutcome(
  tx: Tx, validationId: string, outcome: Exclude<Decision['validation'], 'none'>,
  o: { why: string; by: string; actor: string; reasons: string; now: Date; eventId?: string | null },
): Promise<string[]> {
  const effects: string[] = []
  const { why, actor, reasons, now } = o
  const [v] = await tx.select().from(validations).where(eq(validations.id, validationId)).for('update')
  if (v) {
    const set = async (to: 'current' | 'suspended' | 'withdrawn') => {
      await tx.update(validations).set({ status: to, statusReason: `${why}: ${reasons.slice(0, 300)}`, statusChangedAt: now, statusChangedBy: actor }).where(eq(validations.id, v.id))
      await recordStatusHistory(tx as never, v.id, v.status, to, `${why}: ${reasons.slice(0, 300)}`, actor, now)
      effects.push(`Validation ${v.verificationId ?? v.id}: ${v.status} → ${to}`)
    }
    if (v.status === 'withdrawn' || v.status === 'superseded') effects.push(`Validation ${v.verificationId ?? v.id} is ${v.status}; its status was left as it is`)
    else if (outcome === 'suspended') { if (v.status !== 'suspended') await set('suspended'); else effects.push('Validation remains suspended') }
    else if (outcome === 'withdrawn') await set('withdrawn')
    else if (outcome === 'stands') { if (v.status === 'suspended') await set('current'); else effects.push('Validation stands') }
    else if (outcome === 'amended') {
      // A frozen review is never rewritten: the amendment is recorded and the validator must issue a corrected one.
      await recordStatusHistory(tx as never, v.id, v.status, v.status, `Amended by ${o.by}: ${reasons.slice(0, 300)}`, actor, now)
      effects.push(`Validation ${v.verificationId ?? v.id}: amendment recorded; a corrected validation must be issued`)
    }
  }
  if (o.eventId) {
    const status = outcome === 'stands' ? 'reinstated' : outcome === 'withdrawn' ? 'withdrawn' : null
    if (status) {
      await tx.update(validationEvents).set({ status, decidedBy: actor, decidedAt: now, decisionNote: `${why}: ${reasons.slice(0, 300)}` }).where(eq(validationEvents.id, o.eventId))
      effects.push(`Material event closed as ${status}`)
    }
  }
  return effects
}

/** After the transaction: a validator who lost accreditation loses the access their seats carried. */
export async function afterDecision(reconcile: string | null): Promise<void> {
  if (reconcile) await reconcileValidator(reconcile)
}

