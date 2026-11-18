// An organisation's assessment steps, and a message to it each time it finishes one: what it just did, what is
// left, and a congratulation (copied to its independent assessor) when everything is done. Called after the
// actions that can finish a step; never fails the action that called it.
// Self-check: `node --experimental-transform-types --import ./tests/integration/register.mjs --test tests/integration/progress.test.ts`.
import { and, eq, inArray, isNotNull, like, ne } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { ccaAssessments, evidenceRequests, financeRoles, financialTriangulations, orgProgress, organizations, responses } from '../../db/schema.js'
import { independentAssessorOf } from './independent-assessor.js'
import { logger } from './logger.js'
import { publicBaseUrl } from './public-validation.js'
import { sendReminderEmail } from './reminder-email.js'
import { orgContactsFor } from './validation-lifecycle.js'

export type Step = { id: string; title: string; how: string; applies: boolean; done: boolean }

const ONC_INDICATORS = 44

/** Where the organisation stands on each step. A step that does not apply (no evidence was requested) is left out. */
export async function stepsFor(orgId: string): Promise<Step[]> {
  const [onc, evidence, wizard, cca, roles, finance] = await Promise.all([
    db.select({ q: responses.questionId }).from(responses).where(and(eq(responses.orgId, orgId), like(responses.questionId, 'CRAFT-ONC-%'), isNotNull(responses.selfAt))),
    db.select({ status: evidenceRequests.status }).from(evidenceRequests).where(and(eq(evidenceRequests.orgId, orgId), ne(evidenceRequests.status, 'cancelled'))),
    db.select({ wizardDoneAt: orgProgress.wizardDoneAt }).from(orgProgress).where(eq(orgProgress.orgId, orgId)),
    db.select({ id: ccaAssessments.id }).from(ccaAssessments).where(and(eq(ccaAssessments.orgId, orgId), eq(ccaAssessments.status, 'complete'))),
    db.select({ role: financeRoles.role }).from(financeRoles).where(eq(financeRoles.orgId, orgId)),
    db.select({ id: financialTriangulations.id }).from(financialTriangulations)
      .where(and(eq(financialTriangulations.orgId, orgId), inArray(financialTriangulations.status, ['pending_review', 'pending_assessor', 'locked']))),
  ])
  const ownOnc = new Set(onc.map((r) => r.q)).size
  return [
    { id: 'joined', title: 'Set up your workspace', how: 'Done when you joined CRAFT.', applies: true, done: true },
    { id: 'onc', title: `Answer your own CRAFT-ONC (${Math.min(ownOnc, ONC_INDICATORS)} of ${ONC_INDICATORS})`, how: 'Assessment Frameworks → CRAFT-ONC', applies: true, done: ownOnc >= ONC_INDICATORS },
    { id: 'evidence', title: `Submit the requested evidence (${evidence.filter((e) => !['open', 'more_needed'].includes(e.status)).length} of ${evidence.length})`, how: 'Validation Engagements → Evidence waiting', applies: evidence.length > 0, done: evidence.length > 0 && evidence.every((e) => !['open', 'more_needed'].includes(e.status)) },
    { id: 'wizard', title: 'Answer every question in the 5-tier Assessment Wizard', how: 'Assessment Wizard', applies: true, done: !!wizard[0]?.wizardDoneAt },
    { id: 'cca', title: 'Complete your Capacity Assessment with your independent assessor', how: 'Capacity Assessment → open the draft → Complete', applies: true, done: cca.length > 0 },
    { id: 'roles', title: 'Name your finance officer and grant manager', how: 'Settings & Team → Finance roles', applies: true, done: roles.length >= 2 },
    { id: 'finance', title: 'Submit a Finance Triangulation report', how: 'Finance Triangulation (finance officer)', applies: true, done: finance.length > 0 },
  ].filter((s) => s.applies)
}

/** The message for a newly finished step, or the congratulation when all are done (pure; tested). */
export function progressMessage(orgName: string, steps: Step[], justDone: Step[]): { subject: string; text: string; complete: boolean } {
  const left = steps.filter((s) => !s.done)
  const list = steps.map((s) => `${s.done ? '[done]' : '[ to do ]'} ${s.title}${s.done ? '' : ` (${s.how})`}`).join('\n')
  if (!left.length) {
    return {
      complete: true,
      subject: `Congratulations: ${orgName} has completed its CRAFT assessment`,
      text: `Congratulations! ${orgName} has finished every step of its CRAFT assessment:\n\n${list}\n\nThank you for your work. Your independent assessor will review the results with you, and your results and capacity plan are on your dashboard: ${publicBaseUrl()}/dashboard`,
    }
  }
  return {
    complete: false,
    subject: `${orgName}: ${justDone.map((s) => s.title.replace(/ \(.*\)$/, '')).join(', ')} done. ${left.length} step${left.length === 1 ? '' : 's'} left`,
    text: `Well done: ${justDone.map((s) => s.title).join('; ')}.\n\nYour CRAFT assessment so far:\n\n${list}\n\nNext: ${left[0].title} (${left[0].how}).\n\nSign in: ${publicBaseUrl()}/dashboard`,
  }
}

/** Compare with what the organisation was last told; message it about newly finished steps. */
export async function checkProgress(orgId: string): Promise<void> {
  try {
    const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId))
    if (!org) return
    const steps = await stepsFor(orgId)
    const [prev] = await db.select().from(orgProgress).where(eq(orgProgress.orgId, orgId))
    const told = new Set(prev?.notified ?? [])
    const justDone = steps.filter((s) => s.done && !told.has(s.id))
    const doneIds = steps.filter((s) => s.done).map((s) => s.id)
    if (!justDone.length) return
    await db.insert(orgProgress).values({ orgId, notified: doneIds }).onConflictDoUpdate({ target: orgProgress.orgId, set: { notified: doneIds, updatedAt: new Date() } })
    const msg = progressMessage(org.name, steps, justDone)
    if (msg.complete && prev?.congratulatedAt) return
    const to = await orgContactsFor(orgId)
    if (msg.complete) {
      const assessor = await independentAssessorOf(orgId)
      if (assessor) to.push(assessor.email)
      await db.update(orgProgress).set({ congratulatedAt: new Date() }).where(eq(orgProgress.orgId, orgId))
    }
    if (to.length) await sendReminderEmail({ to, subject: msg.subject, text: msg.text }, undefined, msg.complete ? 'progress_complete' : 'progress_step')
  } catch (err) {
    logger.error('progress', 'check failed', err)
  }
}
