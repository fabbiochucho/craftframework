// Read side of the Super Admin 'Lifecycle emails' tab: counts per kind, what is due in the next 30 days, per-person
// history and the survey results. Aggregates and per-person rows for the Super Admin only (the caller enforces that).
import { desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { dailyActive, lifecycleEmails, lifecyclePreferences, surveyResponses, users, organizations } from '../../db/schema.js'
import {
  CHECKIN_GAP_DAYS, daysBetweenUtc, emailHasSurvey, INACTIVE_DAYS, isActive, KIND_LABEL, LIFECYCLE_KINDS, MS_DAY, nextSendDay,
  scheduledItems, STALE_AFTER_DAYS, utcDay, CAP_DAYS, categoryOf, type LifecycleKind,
} from '../../src/lib/lifecycle.js'
import { average, npsSummary, npsTrend, USED_MOST_OPTIONS } from '../../src/lib/survey.js'
import { firstNameOf } from '../../src/lib/nudgeEmail.js'
import { loadPeople } from './lifecycle.js'

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 1000) / 10 : null)

export async function overview(now: Date) {
  const rows = await db.select().from(lifecycleEmails)
  const sentRows = rows.filter((r) => r.outcome === 'accepted')
  const perKind = LIFECYCLE_KINDS.map((kind) => {
    const k = rows.filter((r) => r.kind === kind)
    return {
      kind, label: KIND_LABEL[kind],
      sent: k.filter((r) => r.outcome === 'accepted').length, failed: k.filter((r) => r.outcome === 'failed').length,
      notConfigured: k.filter((r) => r.outcome === 'not_configured').length, skipped: k.filter((r) => r.outcome === 'skipped').length,
      unsubscribed: k.filter((r) => r.unsubscribedAt).length,
    }
  })
  const [prefs] = await db.select({
    checkins: sql<number>`count(*) filter (where ${lifecyclePreferences.checkinsOptedOutAt} is not null)::int`,
    celebrations: sql<number>`count(*) filter (where ${lifecyclePreferences.celebrationsOptedOutAt} is not null)::int`,
  }).from(lifecyclePreferences)

  // Emails old enough for a full 7-day window: did the recipient click a button, and sign in within 7 days?
  const settled = sentRows.filter((r) => r.sentAt && now.getTime() - r.sentAt.getTime() >= 7 * MS_DAY)
  const emails = [...new Set(settled.map((r) => r.email))]
  const activity = emails.length ? await db.select().from(dailyActive).where(inArray(dailyActive.email, emails)) : []
  const daysByEmail = new Map<string, number[]>()
  for (const a of activity) daysByEmail.set(a.email, [...(daysByEmail.get(a.email) ?? []), utcDay(new Date(`${a.day}T00:00:00Z`))])
  const signedIn = settled.filter((r) => (daysByEmail.get(r.email) ?? []).some((d) => d >= utcDay(r.sentAt!) && d <= utcDay(r.sentAt!) + 7))
  const clicked = settled.filter((r) => r.clickedAt)

  const surveyEmails = sentRows.filter((r) => emailHasSurvey(r.kind as LifecycleKind, r.occurrence, r.variant))
  const answered = await db.select({ id: surveyResponses.lifecycleEmailId }).from(surveyResponses)
  const answeredIds = new Set(answered.map((a) => a.id))
  return {
    generatedAt: now.toISOString(),
    perKind,
    optedOut: { checkins: prefs?.checkins ?? 0, celebrations: prefs?.celebrations ?? 0 },
    survey: { emailsWithSurvey: surveyEmails.length, responses: surveyEmails.filter((r) => answeredIds.has(r.id)).length, responseRatePct: pct(surveyEmails.filter((r) => answeredIds.has(r.id)).length, surveyEmails.length) },
    engagement: {
      emailsInWindow: settled.length,
      clickedPct: pct(clicked.length, settled.length),
      signedInWithin7DaysPct: pct(signedIn.length, settled.length),
      recipientsSignedInWithin7Days: new Set(signedIn.map((r) => r.email)).size,
      recipients: emails.length,
    },
  }
}

export type ScheduleRow = { email: string; name: string; orgName: string; kind: LifecycleKind; occurrence: number; dueAt: string; plannedSend: string; note?: string }

/** What falls due in the next `horizonDays` (and anything already overdue that is still waiting), per kind. */
export async function schedule(now: Date, horizonDays = 30): Promise<Array<{ kind: LifecycleKind; label: string; count: number; rows: ScheduleRow[] }>> {
  const people = await loadPeople(now)
  const all = await db.select().from(lifecycleEmails)
  const prefs = await db.select().from(lifecyclePreferences)
  const optedOut = new Map(prefs.map((p) => [p.email, { checkins: !!p.checkinsOptedOutAt, celebrations: !!p.celebrationsOptedOutAt }]))
  const horizon = new Date(now.getTime() + horizonDays * MS_DAY)
  const out: ScheduleRow[] = []
  for (const person of people) {
    const email = person.user?.email
    if (!email) continue // a colleague only stands in for celebrations; those appear under their own address once they are due
    const mine = all.filter((r) => r.email === email)
    const used = new Set(mine.filter((r) => !(r.outcome === 'failed' && r.attempts < 3)).map((r) => `${r.kind}:${r.occurrence}`))
    const lastSent = mine.filter((r) => r.outcome === 'accepted' && r.sentAt).map((r) => r.sentAt!).sort((a, b) => b.getTime() - a.getTime())[0]
    const opt = optedOut.get(email) ?? { checkins: false, celebrations: false }
    const planned = (due: Date) => {
      let at = due.getTime() > now.getTime() ? due : now
      if (lastSent) at = new Date(Math.max(at.getTime(), lastSent.getTime() + CAP_DAYS * MS_DAY))
      return nextSendDay(at)
    }
    const base = { email, name: person.user?.name || person.name, orgName: person.orgName }
    const items = scheduledItems(person.completedAt, new Date(0), horizon).filter((i) => !used.has(`${i.kind}:${i.occurrence}`))
    const overdueMilestones = items.filter((i) => i.kind === 'milestone' && i.dueAt <= now)
    for (const i of items) {
      if (categoryOf(i.kind) === 'checkins' ? opt.checkins : opt.celebrations) continue
      if (i.kind === 'milestone' && i.dueAt <= now && i !== overdueMilestones[overdueMilestones.length - 1]) continue
      if (i.kind !== 'milestone' && daysBetweenUtc(i.dueAt, now) > STALE_AFTER_DAYS) continue
      if (i.kind === 'nudge_2w' && person.startedAssessment) continue
      const note = i.kind === 'feedback_1m' ? (isActive(person.completedAt, person.lastSeenAt, person.orgActive) ? 'active variant' : 'inactive variant') : undefined
      out.push({ ...base, kind: i.kind, occurrence: i.occurrence, dueAt: i.dueAt.toISOString(), plannedSend: planned(i.dueAt).toISOString(), note })
    }
    if (!opt.checkins) {
      const lastCheckin = mine.filter((r) => r.kind === 'checkin' && r.outcome === 'accepted' && r.sentAt).map((r) => r.sentAt!).sort((a, b) => b.getTime() - a.getTime())[0]
      const seen = person.lastSeenAt && person.lastSeenAt > person.completedAt ? person.lastSeenAt : person.completedAt
      let due = new Date(seen.getTime() + INACTIVE_DAYS * MS_DAY)
      if (lastCheckin) due = new Date(Math.max(due.getTime(), lastCheckin.getTime() + CHECKIN_GAP_DAYS * MS_DAY))
      if (due < horizon) out.push({ ...base, kind: 'checkin', occurrence: mine.filter((r) => r.kind === 'checkin').length + 1, dueAt: due.toISOString(), plannedSend: planned(due).toISOString(), note: 'only if they have still not signed in' })
    }
  }
  return LIFECYCLE_KINDS.map((kind) => {
    const rows = out.filter((r) => r.kind === kind).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    return { kind, label: KIND_LABEL[kind], count: rows.length, rows: rows.slice(0, 200) }
  })
}

export async function history(email: string | null, limit = 100) {
  const rows = await db.select().from(lifecycleEmails).where(email ? eq(lifecycleEmails.email, email) : undefined).orderBy(desc(lifecycleEmails.createdAt)).limit(limit)
  const names = new Map<string, string>()
  const orgs = new Map<string, string>()
  const emails = [...new Set(rows.map((r) => r.email))]
  if (emails.length) for (const u of await db.select({ email: users.email, name: users.name }).from(users).where(inArray(users.email, emails))) names.set(u.email, u.name)
  const orgIds = [...new Set(rows.map((r) => r.orgId))]
  if (orgIds.length) for (const o of await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, orgIds))) orgs.set(o.id, o.name)
  return rows.map((r) => ({
    id: r.id, email: r.email, name: names.get(r.email) ?? '', orgName: orgs.get(r.orgId) ?? '', kind: r.kind, occurrence: r.occurrence, variant: r.variant,
    outcome: r.outcome, skipReason: r.skipReason, attempts: r.attempts, subject: r.subject, sentAt: r.sentAt?.toISOString() ?? null,
    clickedAt: r.clickedAt?.toISOString() ?? null, unsubscribedAt: r.unsubscribedAt?.toISOString() ?? null,
  }))
}

export async function surveyResults(now: Date) {
  const rows = await db.select().from(surveyResponses).orderBy(desc(surveyResponses.createdAt))
  const emails = [...new Set(rows.map((r) => r.email))]
  const people = new Map<string, { name: string; orgId: string | null }>()
  if (emails.length) for (const u of await db.select({ email: users.email, name: users.name, orgId: users.orgId }).from(users).where(inArray(users.email, emails))) people.set(u.email, u)
  const orgIds = [...new Set(rows.map((r) => r.orgId).filter((x): x is string => !!x))]
  const orgs = new Map<string, string>()
  if (orgIds.length) for (const o of await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, orgIds))) orgs.set(o.id, o.name)
  const who = (r: (typeof rows)[number]) => ({ name: people.get(r.email)?.name || firstNameOf('', r.email), email: r.email, orgName: (r.orgId && orgs.get(r.orgId)) || '' })
  const usedMost = USED_MOST_OPTIONS.map((label) => ({ label, count: rows.filter((r) => r.usedMost.includes(label)).length })).sort((a, b) => b.count - a.count)
  return {
    generatedAt: now.toISOString(),
    nps: npsSummary(rows.map((r) => r.nps)),
    trend: npsTrend(rows.map((r) => ({ at: r.createdAt, nps: r.nps }))),
    easeAverage: average(rows.map((r) => r.ease)),
    usedMost,
    improvements: rows.filter((r) => r.improve).slice(0, 15).map((r) => ({ id: r.id, at: r.createdAt.toISOString(), text: r.improve, ...who(r) })),
    callRequests: rows.filter((r) => r.wantsCall).map((r) => ({
      id: r.id, at: r.createdAt.toISOString(), times: r.callTimes, handledAt: r.callHandledAt?.toISOString() ?? null, handledBy: r.callHandledBy, ...who(r),
    })),
  }
}
