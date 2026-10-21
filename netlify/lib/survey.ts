// Survey storage and the one internal notification: when someone asks for a 20-minute call, CRAFT's own inbox gets
// their name, email, organisation and preferred times. That email is the only place a response leaves the database.
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { organizations, surveyResponses, users } from '../../db/schema.js'
import { craftReplyTo } from '../../src/lib/emailSignature.js'
import { EDIT_WINDOW_MS, type SurveyAnswer } from '../../src/lib/survey.js'
import { tenantOrgId } from './auth.js'
import { sendReminderEmail } from './reminder-email.js'

export type SurveyRow = typeof surveyResponses.$inferSelect
export const editableUntil = (row: Pick<SurveyRow, 'createdAt'>): Date => new Date(row.createdAt.getTime() + EDIT_WINDOW_MS)

export async function personContext(email: string): Promise<{ name: string; orgId: string; orgName: string }> {
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  const orgId = u?.orgId || tenantOrgId(email)
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1)
  return { name: u?.name || '', orgId, orgName: org?.name || '' }
}

export async function getResponse(email: string, occurrence: string): Promise<SurveyRow | null> {
  const [row] = await db.select().from(surveyResponses).where(and(eq(surveyResponses.email, email), eq(surveyResponses.occurrence, occurrence))).limit(1)
  return row ?? null
}

/** Stores (or, inside the 24-hour window, replaces) one person's answer. The caller has already checked the window. */
export async function saveResponse(email: string, occurrence: string, emailId: string | undefined, a: SurveyAnswer, now: Date): Promise<SurveyRow> {
  const ctx = await personContext(email)
  const values = { nps: a.nps, ease: a.ease, usedMost: a.usedMost, improve: a.improve, wantsCall: a.wantsCall, callTimes: a.callTimes, updatedAt: now }
  const [row] = await db.insert(surveyResponses).values({
    id: `srv_${crypto.randomUUID()}`, email, orgId: ctx.orgId, occurrence, lifecycleEmailId: emailId ?? null, createdAt: now, ...values,
  }).onConflictDoUpdate({ target: [surveyResponses.email, surveyResponses.occurrence], set: values }).returning()
  return row
}

/** Tells CRAFT someone wants a call, once per response. Returns whether it went out (so a failed send can be retried on an edit). */
export async function notifyCallRequest(row: SurveyRow): Promise<boolean> {
  if (!row.wantsCall || row.callNotifiedAt) return false
  const ctx = await personContext(row.email)
  const text = [
    'Someone asked for a 20-minute call in the CRAFT feedback survey.', '',
    `Name: ${ctx.name || '(not given)'}`, `Email: ${row.email}`, `Organisation: ${ctx.orgName || '(not given)'}`,
    `Preferred times: ${row.callTimes || '(none given)'}`, '', 'Reply to this email to reach them.',
  ].join('\n')
  const outcome = await sendReminderEmail({ to: craftReplyTo(), subject: `CRAFT call request: ${ctx.name || row.email}${ctx.orgName ? ` (${ctx.orgName})` : ''}`, text, reply_to: row.email }, `survey-call-${row.id}`, 'survey_call_request')
  if (outcome !== 'accepted') return false
  await db.update(surveyResponses).set({ callNotifiedAt: new Date() }).where(eq(surveyResponses.id, row.id))
  return true
}
