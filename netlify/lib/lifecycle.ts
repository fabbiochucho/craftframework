// The lifecycle email engine: who is due what, the atomic claim before every send, the send itself and the
// recorded outcome. The rules live in src/lib/lifecycle.ts (pure); this file feeds them from the database.
//
// Safety properties, each covered by tests/integration/lifecycle-emails.test.ts:
//  - one row per recipient/kind/occurrence (unique idempotency key), claimed under an advisory lock, so two runs
//    or a double invocation never send the same email twice;
//  - one celebration per organisation per milestone (a partial unique index backs the check);
//  - nothing goes to the Super Admin, demo sessions, people who opted out of the category, deleted people or
//    archived organisations; the recipient is the person's own email from the users directory;
//  - one failed send never stops the run, and its outcome is recorded.
import { and, asc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  assessments, auditLogs, capacityActions, dailyActive, lifecycleEmails, lifecycleOrgBaselines, lifecyclePreferences,
  lifecycleSettings, onboardingProgress, organizations, responses, users, validations,
} from '../../db/schema.js'
import { legacyWorkspaceState } from '../../db/legacy-schema.js'
import { craftReplyTo } from '../../src/lib/emailSignature.js'
import {
  categoryOf, hasProgress, isActive, isDemoEmail, isSendDay, planForPerson, emailHasSurvey,
  SURVEY_TTL_DAYS, type LifecycleKind, type OrgProgress, type PlanResult, type SentRow,
} from '../../src/lib/lifecycle.js'
import { renderLifecycleEmail, type EmailVariant } from '../../src/lib/lifecycleEmail.js'
import { currentRung, LADDER_INDICATORS } from '../../src/lib/capitalReadiness.js'
import { isSuperAdmin, tenantOrgId } from './auth.js'
import { decryptField } from './crypto.js'
import { logger } from './logger.js'
import { epochSeconds, signLifecycleToken } from './lifecycle-token.js'
import { appUrl, optOutSecret, PENDING_STALE_MS } from './onboarding-nudge.js'
import { onboardingPeople } from './admin-analytics.js'
import { sendReminderEmail, type EmailAcceptance } from './reminder-email.js'

// --- configuration --------------------------------------------------------------------------------------------
export type LifecycleConfig = { configured: boolean; missing: string[]; appUrl: string; secret: string }
export function lifecycleConfig(env: Record<string, string | undefined> = process.env): LifecycleConfig {
  const from = env.COMPLIANCE_FROM_EMAIL || env.REMINDER_FROM_EMAIL || env.INVITE_FROM_EMAIL
  const missing = [
    !env.RESEND_API_KEY && 'RESEND_API_KEY',
    (!from || /@resend\.dev\b/i.test(from)) && 'COMPLIANCE_FROM_EMAIL',
    !env.ONBOARDING_OPTOUT_SECRET && 'ONBOARDING_OPTOUT_SECRET',
    !appUrl() && 'APP_URL',
  ].filter((m): m is string => !!m)
  return { configured: missing.length === 0, missing, appUrl: appUrl(), secret: optOutSecret() }
}

export async function isPaused(): Promise<boolean> {
  const [row] = await db.select({ paused: lifecycleSettings.paused }).from(lifecycleSettings).where(eq(lifecycleSettings.id, 'global')).limit(1)
  return row?.paused ?? false
}
export async function setPaused(paused: boolean, by: string): Promise<void> {
  await db.insert(lifecycleSettings).values({ id: 'global', paused, updatedBy: by, updatedAt: new Date() })
    .onConflictDoUpdate({ target: lifecycleSettings.id, set: { paused, updatedBy: by, updatedAt: new Date() } })
}

// --- signed first-party links ---------------------------------------------------------------------------------
export type LinkDestination = 'assessment' | 'dashboard' | 'survey' | 'badge'
export const goUrl = (base: string, secret: string, emailId: string, dest: LinkDestination) =>
  `${base}/api/lifecycle/go?t=${signLifecycleToken({ p: 'go', i: emailId, d: dest }, secret)}`
export const unsubscribeUrl = (base: string, secret: string, email: string, kind: LifecycleKind, emailId: string) =>
  `${base}/api/lifecycle/unsubscribe?t=${signLifecycleToken({ p: 'unsub', e: email, c: categoryOf(kind), i: emailId }, secret)}`
export const preferencesUrl = (base: string, secret: string, email: string) =>
  `${base}/email-preferences?t=${signLifecycleToken({ p: 'prefs', e: email }, secret)}`
/** Survey link for one email: expires SURVEY_TTL_DAYS after the email was sent, however many times it is opened. */
export const surveyToken = (secret: string, email: string, occurrence: string, emailId: string, sentAt: Date) =>
  signLifecycleToken({ p: 'survey', e: email, o: occurrence, i: emailId, n: epochSeconds(sentAt), x: epochSeconds(sentAt) + SURVEY_TTL_DAYS * 86_400 }, secret)
/** Signed public link to one organisation's badge. `email` is whoever onboarded it (how we find its name and join year). */
export const badgeToken = (secret: string, orgId: string, email: string) => signLifecycleToken({ p: 'badge', g: orgId, e: email }, secret)

// --- what we know about each onboarded person -----------------------------------------------------------------
type Person = {
  progressEmail: string
  completedAt: Date
  name: string
  orgId: string
  orgName: string
  /** The users-directory row of the person who onboarded; null if they have since left. */
  user: { id: string; email: string; name: string } | null
  lastSeenAt: Date | null
  progress: OrgProgress
  startedAssessment: boolean
  orgActive: boolean
}

type LadderScores = Record<string, number>
const chunk = <T>(items: T[], size = 500): T[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))

async function legacyScores(orgIds: string[]): Promise<Map<string, LadderScores>> {
  const out = new Map<string, LadderScores>()
  for (const ids of chunk(orgIds)) {
    const rows = await db.select().from(legacyWorkspaceState).where(and(inArray(legacyWorkspaceState.orgId, ids), eq(legacyWorkspaceState.key, 'capital:scores')))
    for (const r of rows) {
      try {
        const v = JSON.parse(decryptField(r.value))
        if (v && typeof v === 'object') out.set(r.orgId, v)
      } catch { /* unreadable state counts as absent */ }
    }
  }
  return out
}

/** Real numbers per organisation: only things the organisation did, read from CRAFT's own database. */
export async function orgProgress(orgIds: string[], now: Date): Promise<Map<string, { progress: OrgProgress; startedAssessment: boolean; orgActive: boolean }>> {
  const out = new Map<string, { progress: OrgProgress; startedAssessment: boolean; orgActive: boolean }>()
  if (!orgIds.length) return out
  const scores = await legacyScores(orgIds)
  const count = new Map<string, number>()
  const bump = (key: string, by = 1) => count.set(key, (count.get(key) ?? 0) + by)
  const answered = new Set<string>(), completedRows = new Map<string, number>(), validated = new Map<string, number>()
  const baselines = new Map<string, number>()
  for (const ids of chunk(orgIds)) {
    const [assessed, resp, actions, docs, vals, base] = await Promise.all([
      db.select({ orgId: assessments.orgId, completedAt: assessments.completedAt }).from(assessments).where(inArray(assessments.orgId, ids)),
      db.selectDistinct({ orgId: responses.orgId }).from(responses).where(inArray(responses.orgId, ids)),
      db.select({ orgId: capacityActions.orgId, status: capacityActions.status }).from(capacityActions).where(inArray(capacityActions.orgId, ids)),
      db.select({ orgId: auditLogs.orgId }).from(auditLogs).where(and(eq(auditLogs.action, 'Added Data Room evidence'), inArray(auditLogs.orgId, ids))),
      db.select({ orgId: validations.orgId, rung: validations.validatedRung }).from(validations)
        .where(and(inArray(validations.orgId, ids), eq(validations.status, 'current'), sql`${validations.expiresAt} > ${now}`)),
      db.select().from(lifecycleOrgBaselines).where(inArray(lifecycleOrgBaselines.orgId, ids)),
    ])
    for (const a of assessed) { bump(`assessment:${a.orgId}`); if (a.completedAt) completedRows.set(a.orgId, (completedRows.get(a.orgId) ?? 0) + 1) }
    for (const r of resp) answered.add(r.orgId)
    for (const a of actions) { bump(`action:${a.orgId}`); if (a.status.startsWith('Completed')) bump(`done:${a.orgId}`) }
    for (const d of docs) if (d.orgId) bump(`doc:${d.orgId}`)
    for (const v of vals) validated.set(v.orgId, Math.max(validated.get(v.orgId) ?? 0, v.rung))
    for (const b of base) baselines.set(b.orgId, b.startRung)
  }
  for (const id of orgIds) {
    const s = scores.get(id) ?? {}
    const ladderComplete = LADDER_INDICATORS.every((i) => s[i.id] != null)
    const rung = Object.keys(s).length ? currentRung(s) : null
    const startedAssessment = Object.keys(s).length > 0 || (count.get(`assessment:${id}`) ?? 0) > 0 || answered.has(id)
    const progress: OrgProgress = {
      assessmentsCompleted: completedRows.get(id) ?? (ladderComplete ? 1 : 0),
      startRung: baselines.get(id) ?? null, currentRung: rung,
      actionsCompleted: count.get(`done:${id}`) ?? 0, documents: count.get(`doc:${id}`) ?? 0, validatedRung: validated.get(id) ?? null,
    }
    out.set(id, { progress, startedAssessment, orgActive: startedAssessment || (count.get(`action:${id}`) ?? 0) > 0 || progress.documents > 0 })
  }
  return out
}

/** Everyone who completed onboarding and could be emailed (nobody for archived organisations or the platform operator). */
export async function loadPeople(now: Date): Promise<Person[]> {
  const done = await db.select().from(onboardingProgress).where(isNotNull(onboardingProgress.completedAt))
  const eligible = done.filter((p) => !isSuperAdmin(p.email) && !isDemoEmail(p.email))
  if (!eligible.length) return []
  const emails = eligible.map((p) => p.email)
  const named = new Map((await onboardingPeople(now, emails)).map((p) => [p.email, p]))
  const userRows: Array<typeof users.$inferSelect> = []
  const seen: Array<{ email: string; day: string }> = []
  for (const part of chunk(emails)) {
    userRows.push(...await db.select().from(users).where(inArray(users.email, part)))
    seen.push(...await db.select({ email: dailyActive.email, day: sql<string>`max(${dailyActive.day})::text`.as('day') }).from(dailyActive).where(inArray(dailyActive.email, part)).groupBy(dailyActive.email))
  }
  const byEmail = new Map(userRows.map((u) => [u.email, u]))
  const lastDay = new Map(seen.map((s) => [s.email, new Date(`${s.day}T00:00:00Z`)]))
  const orgIds = [...new Set(eligible.map((p) => named.get(p.email)?.orgId ?? byEmail.get(p.email)?.orgId ?? tenantOrgId(p.email)))]
  const orgRows: Array<{ id: string; status: string }> = []
  for (const ids of chunk(orgIds)) orgRows.push(...await db.select({ id: organizations.id, status: organizations.status }).from(organizations).where(inArray(organizations.id, ids)))
  const archived = new Set(orgRows.filter((o) => o.status === 'archived').map((o) => o.id))
  const progress = await orgProgress(orgIds.filter((id) => !archived.has(id)), now)
  const people: Person[] = []
  for (const p of eligible) {
    const n = named.get(p.email)
    const user = byEmail.get(p.email) ?? null
    const orgId = n?.orgId ?? user?.orgId ?? tenantOrgId(p.email)
    if (archived.has(orgId)) continue
    const info = progress.get(orgId)!
    const seenAt = [user?.lastSeenAt ?? null, lastDay.get(p.email) ?? null].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null
    people.push({
      progressEmail: p.email, completedAt: p.completedAt!, name: user?.name || n?.name || '', orgId, orgName: n?.orgName ?? '',
      user: user && user.status !== 'invited' ? { id: user.id, email: user.email, name: user.name } : null,
      lastSeenAt: seenAt, progress: info.progress, startedAssessment: info.startedAssessment, orgActive: info.orgActive,
    })
  }
  return people.sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())
}

/** The person who runs an organisation's workspace when the one who onboarded has left: its earliest active administrator. */
async function orgAdmin(orgId: string): Promise<{ id: string; email: string; name: string } | null> {
  const [admin] = await db.select({ id: users.id, email: users.email, name: users.name }).from(users)
    .where(and(eq(users.orgId, orgId), eq(users.role, 'admin'), ne(users.status, 'invited'))).orderBy(asc(users.createdAt)).limit(1)
  return admin && !isSuperAdmin(admin.email) && !isDemoEmail(admin.email) ? admin : null
}

async function optedOut(email: string): Promise<Record<'checkins' | 'celebrations', boolean>> {
  const [p] = await db.select().from(lifecyclePreferences).where(eq(lifecyclePreferences.email, email)).limit(1)
  return { checkins: !!p?.checkinsOptedOutAt, celebrations: !!p?.celebrationsOptedOutAt }
}

// --- the claim ------------------------------------------------------------------------------------------------
type Claim = { id: string; key: string; kind: LifecycleKind; occurrence: number; variant: EmailVariant; attempts: number; sentAt: Date }
type Recipient = { id: string; email: string; name: string }

const keyFor = (userId: string, kind: LifecycleKind, occurrence: number) => `lifecycle-${userId}-${kind}-${occurrence}`
const variantFor = (kind: LifecycleKind, person: Person): EmailVariant =>
  kind === 'feedback_1m' ? (isActive(person.completedAt, person.lastSeenAt, person.orgActive) ? 'active' : 'inactive')
    : kind === 'milestone' ? (hasProgress(person.progress) ? 'progress' : 'quiet') : 'default'

/**
 * Decides and records, atomically for one recipient: what (if anything) to send now. Items that will never be sent
 * (expired, moot, superseded, already celebrated by a colleague) are recorded as skipped so they are not revisited.
 */
async function claimNext(person: Person, recipient: Recipient, fallback: boolean, now: Date): Promise<Claim | null> {
  const prefs = await optedOut(recipient.email)
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'lifecycle:' + recipient.email}))`, 'objects')
    for (let round = 0; round < 6; round++) {
      const rows = await tx.select().from(lifecycleEmails).where(eq(lifecycleEmails.email, recipient.email))
      const history: SentRow[] = rows.map((r) => ({ kind: r.kind as LifecycleKind, occurrence: r.occurrence, at: r.sentAt, attempts: r.attempts, outcome: r.outcome as SentRow['outcome'] }))
        .filter((r) => !(r.outcome === 'pending' && r.at && now.getTime() - r.at.getTime() >= PENDING_STALE_MS))
      const plan: PlanResult = planForPerson({
        completedAt: person.completedAt, lastSeenAt: person.lastSeenAt, now, startedAssessment: person.startedAssessment, history,
        // A colleague stepping in for someone who left only receives the celebrations.
        optedOut: { checkins: prefs.checkins || fallback, celebrations: prefs.celebrations },
      })
      const skip = async (kind: LifecycleKind, occurrence: number, reason: string) => {
        await tx.insert(lifecycleEmails).values({
          id: `lce_${crypto.randomUUID()}`, idempotencyKey: keyFor(recipient.id, kind, occurrence), userId: recipient.id, email: recipient.email,
          orgId: person.orgId, kind, occurrence, outcome: 'skipped', skipReason: reason,
        }).onConflictDoNothing()
      }
      for (const s of plan.skips) await skip(s.kind, s.occurrence, s.reason)
      if (!plan.send) return null
      const { kind, occurrence } = plan.send
      const variant = variantFor(kind, person)
      const existing = rows.find((r) => r.kind === kind && r.occurrence === occurrence)
      // A colleague (or the same person under another address) already celebrated this milestone for the organisation.
      if (kind === 'milestone') {
        const [taken] = await tx.select({ id: lifecycleEmails.id }).from(lifecycleEmails).where(and(
          eq(lifecycleEmails.orgId, person.orgId), eq(lifecycleEmails.kind, 'milestone'), eq(lifecycleEmails.occurrence, occurrence),
          inArray(lifecycleEmails.outcome, ['pending', 'accepted', 'not_configured']), ne(lifecycleEmails.email, recipient.email),
        )).limit(1)
        if (taken) { await skip(kind, occurrence, 'org_celebrated'); continue }
      }
      const key = keyFor(recipient.id, kind, occurrence)
      try {
        if (existing) {
          const [row] = await tx.update(lifecycleEmails).set({ outcome: 'pending', attempts: existing.attempts + 1, sentAt: now, variant })
            .where(and(eq(lifecycleEmails.id, existing.id), eq(lifecycleEmails.outcome, 'failed'))).returning()
          if (!row) return null
          return { id: row.id, key, kind, occurrence, variant, attempts: row.attempts, sentAt: now }
        }
        const id = `lce_${crypto.randomUUID()}`
        // A savepoint, so a unique-index conflict (a concurrent celebration) does not abort the transaction.
        await tx.transaction((inner) => inner.insert(lifecycleEmails).values({
          id, idempotencyKey: key, userId: recipient.id, email: recipient.email, orgId: person.orgId, kind, occurrence, variant,
          outcome: 'pending', attempts: 1, sentAt: now,
        }))
        return { id, key, kind, occurrence, variant, attempts: 1, sentAt: now }
      } catch (err) {
        if (kind === 'milestone' && /unique|duplicate/i.test(String((err as Error).message) + String((err as { cause?: Error }).cause?.message))) { await skip(kind, occurrence, 'org_celebrated'); continue }
        throw err
      }
    }
    return null
  })
}

export function buildEmail(claim: Pick<Claim, 'id' | 'kind' | 'occurrence' | 'variant' | 'sentAt'>, person: Person, recipient: Recipient, cfg: LifecycleConfig, now: Date) {
  const base = cfg.appUrl
  const link = (dest: LinkDestination) => goUrl(base, cfg.secret, claim.id, dest)
  const cta: LinkDestination = claim.kind === 'nudge_2w' ? 'assessment' : claim.kind === 'feedback_1m' ? 'survey' : 'dashboard'
  const mail = renderLifecycleEmail({
    kind: claim.kind, variant: claim.variant, name: recipient.name || person.name, email: recipient.email, orgName: person.orgName,
    appUrl: base, now, months: claim.kind === 'milestone' ? claim.occurrence : undefined, progress: person.progress,
    links: {
      cta: link(cta),
      badge: claim.kind === 'milestone' && claim.variant === 'progress' ? link('badge') : undefined,
      survey: emailHasSurvey(claim.kind, claim.occurrence, claim.variant) ? link('survey') : undefined,
      unsubscribe: unsubscribeUrl(base, cfg.secret, recipient.email, claim.kind, claim.id),
      preferences: preferencesUrl(base, cfg.secret, recipient.email),
    },
  })
  const unsubscribe = unsubscribeUrl(base, cfg.secret, recipient.email, claim.kind, claim.id)
  return { ...mail, unsubscribe }
}

async function deliver(claim: Claim, person: Person, recipient: Recipient, cfg: LifecycleConfig, now: Date): Promise<EmailAcceptance> {
  const mail = buildEmail(claim, person, recipient, cfg, now)
  const outcome = await sendReminderEmail({
    to: recipient.email, subject: mail.subject, text: mail.text, html: mail.html, reply_to: craftReplyTo(),
    headers: { 'List-Unsubscribe': `<${mail.unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  }, claim.attempts > 1 ? `${claim.key}-a${claim.attempts}` : claim.key, `lifecycle_${claim.kind}`)
  await db.update(lifecycleEmails).set({ outcome, subject: mail.subject, sentAt: now }).where(eq(lifecycleEmails.id, claim.id))
  await db.insert(auditLogs).values({ actor: 'system', action: `lifecycle email ${claim.kind} ${outcome}`, target: recipient.email, category: 'Email', orgId: person.orgId }).catch(() => undefined)
  return outcome
}

// --- the daily run --------------------------------------------------------------------------------------------
export type RunSummary = {
  ran: boolean
  reason?: 'paused' | 'not_configured' | 'not_a_send_day'
  considered: number
  sent: number
  failed: number
  notConfigured: number
}

/** Records the first rung seen for each organisation (every day, send day or not), so milestones can show where it started. */
export async function recordBaselines(people: Person[]): Promise<void> {
  const fresh = new Map<string, number>()
  for (const p of people) if ((p.progress.currentRung ?? 0) > 0) fresh.set(p.orgId, p.progress.currentRung!)
  for (const [orgId, startRung] of fresh) await db.insert(lifecycleOrgBaselines).values({ orgId, startRung }).onConflictDoNothing()
}

export async function runLifecycle(now = new Date(), cfg = lifecycleConfig()): Promise<RunSummary> {
  const summary: RunSummary = { ran: false, considered: 0, sent: 0, failed: 0, notConfigured: 0 }
  if (await isPaused()) return { ...summary, reason: 'paused' }
  if (!cfg.configured) return { ...summary, reason: 'not_configured' }
  const people = await loadPeople(now)
  await recordBaselines(people)
  if (!isSendDay(now)) return { ...summary, reason: 'not_a_send_day' }
  summary.ran = true
  for (const person of people) {
    summary.considered++
    try {
      let recipient: Recipient | null = person.user
      let fallback = false
      if (!recipient) { recipient = await orgAdmin(person.orgId); fallback = true }
      if (!recipient || isSuperAdmin(recipient.email) || isDemoEmail(recipient.email)) continue
      const claim = await claimNext(person, recipient, fallback, now)
      if (!claim) continue
      const outcome = await deliver(claim, person, recipient, cfg, now)
      if (outcome === 'accepted') summary.sent++
      else if (outcome === 'failed') summary.failed++
      else summary.notConfigured++
    } catch (err) {
      summary.failed++
      logger.error('lifecycle-emails', 'one recipient failed', err)
    }
  }
  return summary
}

/** What the member badge says: the organisation's name and the year its first person finished onboarding. Null until someone has. */
export async function orgBadgeData(orgId: string, emailHint: string, now = new Date()): Promise<{ orgName: string; year: number } | null> {
  const members = await db.select({ email: users.email }).from(users).where(eq(users.orgId, orgId))
  const emails = [...new Set([emailHint, ...members.map((m) => m.email)])]
  const done = await db.select({ email: onboardingProgress.email, completedAt: onboardingProgress.completedAt }).from(onboardingProgress)
    .where(and(inArray(onboardingProgress.email, emails), isNotNull(onboardingProgress.completedAt)))
  const joined = done.map((d) => d.completedAt!).sort((a, b) => a.getTime() - b.getTime())[0]
  if (!joined) return null
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1)
  const named = (await onboardingPeople(now, done.map((d) => d.email))).find((p) => p.orgName)
  return { orgName: named?.orgName || org?.name || '', year: joined.getUTCFullYear() }
}
