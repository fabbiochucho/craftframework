// Queries behind the Super Admin analytics dashboard. Everything is read from CRAFT's own database and
// returned as aggregates, except the onboarding table, which lists people for the Super Admin only.
// Pure maths lives in src/lib/adminAnalytics.ts; the caller (admin-analytics.mts) enforces Super Admin + MFA.
import { and, eq, gte, inArray, isNotNull } from 'drizzle-orm'
import { isSpecialistModuleId } from '../../src/lib/specialisms.js'
import { db } from '../../db/index.js'
import { legacyWorkspaceState } from '../../db/legacy-schema.js'
import {
  assessments, auditLogs, dailyActive, directoryProfileViews, directorySearchLog, emailLog, firms, onboardingNudges,
  onboardingOptouts, onboardingProgress, orgDirectoryProfiles, orgListingProposals, organizations, panelCases, responses,
  supportEscalations, supportIssues, trainingCapstones, trainingCases, trainingExamAttempts, trainingModules, trainingProgress,
  trainingQuestions, trainingSubmissions, users, validationEngagements, validationReviews, validatorProfiles,
} from '../../db/schema.js'
import {
  activitySummary, buildFunnel, dailySeries, daysBetween, median, MS_DAY, rangeStart, type ActivityRow, type RangeKey, type StalledPerson,
} from '../../src/lib/adminAnalytics.js'
import { LADDER_INDICATORS } from '../../src/lib/capitalReadiness.js'
import { ONBOARDING_STEPS } from '../../src/lib/onboardingProgress.js'
import { STEPS as TRAINING_STEPS } from '../../src/lib/validatorTraining.js'
import { tenantOrgId } from './auth.js'
import { decryptField } from './crypto.js'
import { PENDING_STALE_MS } from './onboarding-nudge.js'

const orgKey = (u: { email: string; orgId: string | null }) => u.orgId || tenantOrgId(u.email)
const inRange = (d: Date | string | null | undefined, since: Date | null) => !since || (!!d && new Date(d) >= since)
const day = (d: Date) => d.toISOString().slice(0, 10)
const countBy = <T>(rows: T[], key: (r: T) => string) => {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1)
  return m
}
const topRows = (m: Map<string, number>, limit = 10) =>
  [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit)

// --- legacy per-organisation state (encrypted JSON) -----------------------------------------------------------
type LegacyState = { entityComplete: Set<string>; scores: Map<string, Record<string, number>> }
async function legacyState(orgIds: string[]): Promise<LegacyState> {
  const out: LegacyState = { entityComplete: new Set(), scores: new Map() }
  if (!orgIds.length) return out
  const rows = await db.select().from(legacyWorkspaceState)
    .where(and(inArray(legacyWorkspaceState.orgId, orgIds), inArray(legacyWorkspaceState.key, ['entity-profile', 'capital:scores'])))
  for (const r of rows) {
    try {
      const value = JSON.parse(decryptField(r.value))
      if (r.key === 'entity-profile' && value?.onboardingComplete === true && value?.archetype) out.entityComplete.add(r.orgId)
      if (r.key === 'capital:scores' && value && typeof value === 'object') out.scores.set(r.orgId, value)
    } catch { /* unreadable state counts as absent */ }
  }
  return out
}

// --- onboarding people ---------------------------------------------------------------------------------------
export type OnboardingPerson = StalledPerson & {
  completed: boolean; optedOut: boolean; startedAtDate: Date; lastNudgeAtDate: Date | null; orgId: string
}

// Everyone who started /onboarding (optionally only these addresses), with whether they finished (server-side
// progress OR the saved entity profile), opted out, and when they were last nudged. `now` drives days stalled.
export async function onboardingPeople(now: Date, emails?: string[]): Promise<OnboardingPerson[]> {
  const progress = await db.select().from(onboardingProgress).where(emails ? inArray(onboardingProgress.email, emails) : undefined)
  if (!progress.length) return []
  const list = progress.map((p) => p.email)
  const [userRows, optouts, nudges] = await Promise.all([
    db.select().from(users).where(inArray(users.email, list)),
    db.select().from(onboardingOptouts).where(inArray(onboardingOptouts.email, list)),
    db.select().from(onboardingNudges).where(inArray(onboardingNudges.email, list)),
  ])
  const byEmail = new Map(userRows.map((u) => [u.email, u]))
  const orgIds = [...new Set(list.map((e) => orgKey({ email: e, orgId: byEmail.get(e)?.orgId ?? null })))]
  const [orgRows, state] = await Promise.all([
    db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, orgIds)),
    legacyState(orgIds),
  ])
  const orgNames = new Map(orgRows.map((o) => [o.id, o.name]))
  const opted = new Set(optouts.map((o) => o.email))
  return progress.map((p) => {
    const user = byEmail.get(p.email)
    const orgId = orgKey({ email: p.email, orgId: user?.orgId ?? null })
    // Nudges that count towards the 7-day limit: delivered, or still being sent (a stale claim does not count).
    const counted = nudges.filter((n) => n.email === p.email && (n.outcome === 'accepted' ||
      (n.outcome === 'pending' && now.getTime() - n.sentAt.getTime() < PENDING_STALE_MS)))
    const last = counted.reduce<Date | null>((a, n) => (!a || n.sentAt > a ? n.sentAt : a), null)
    return {
      email: p.email, name: user?.name ?? '', orgName: orgNames.get(orgId) ?? '', orgId,
      step: p.step, stepName: p.stepName, startedAt: p.startedAt.toISOString(), lastActivityAt: p.lastActivityAt.toISOString(),
      daysStalled: daysBetween(p.lastActivityAt, now), nudgesSent: nudges.filter((n) => n.email === p.email && n.outcome === 'accepted').length,
      lastNudgeAt: last?.toISOString() ?? null, lastNudgeAtDate: last,
      completed: p.completedAt != null || state.entityComplete.has(orgId), optedOut: opted.has(p.email), startedAtDate: p.startedAt,
    }
  })
}

// --- the dashboard payload -----------------------------------------------------------------------------------
export async function buildAnalytics(range: RangeKey, now = new Date()) {
  const since = rangeStart(range, now)
  const [allUsers, progress, allOrgs] = await Promise.all([
    db.select().from(users), db.select().from(onboardingProgress), db.select().from(organizations),
  ])
  const countryByOrg = new Map(allOrgs.map((o) => [o.id, o.country]))
  const userByEmail = new Map(allUsers.map((u) => [u.email, u]))

  // ---- Onboarding
  const cohortUsers = allUsers.filter((u) => inRange(u.createdAt, since))
  const started = progress.filter((p) => inRange(p.startedAt, since))
  const people = await onboardingPeople(now)
  const completedSet = new Set(people.filter((p) => p.completed).map((p) => p.email))
  const stalled = people.filter((p) => !p.completed && inRange(p.startedAtDate, since))
  const finishTimes = started.filter((p) => p.completedAt).map((p) => (p.completedAt!.getTime() - p.startedAt.getTime()) / 3_600_000)
  const onboarding = {
    signedUp: cohortUsers.length,
    started: started.length,
    reachedStep: ONBOARDING_STEPS.map((name, i) => ({ step: i + 1, name, count: started.filter((p) => p.step >= i + 1).length })),
    completed: started.filter((p) => completedSet.has(p.email)).length,
    medianHoursToComplete: median(finishTimes),
    stalled: stalled.map(({ completed: _c, startedAtDate: _s, lastNudgeAtDate, orgId: _o, ...p }) => ({
      ...p, optedOut: people.find((x) => x.email === p.email)!.optedOut,
      nextNudgeAllowedAt: lastNudgeAtDate ? new Date(lastNudgeAtDate.getTime() + 7 * MS_DAY).toISOString() : null,
    })),
  }

  // ---- Organisation funnel (a strict funnel: each stage is a subset of the one before)
  const orgIds = [...new Set(cohortUsers.map(orgKey))]
  const [state, assessed, answered, evidence, engagements, validated] = await Promise.all([
    legacyState(orgIds),
    db.select({ orgId: assessments.orgId, completedAt: assessments.completedAt }).from(assessments),
    db.selectDistinct({ orgId: responses.orgId }).from(responses),
    db.selectDistinct({ orgId: auditLogs.orgId }).from(auditLogs).where(and(eq(auditLogs.action, 'Added Data Room evidence'), isNotNull(auditLogs.orgId))),
    db.select({ orgId: validationEngagements.orgId, id: validationEngagements.id }).from(validationEngagements),
    db.select({ engagementId: validationReviews.engagementId }).from(validationReviews)
      .where(and(eq(validationReviews.status, 'finalised'), inArray(validationReviews.outcome, ['validated', 'validated_with_qualifications']))),
  ])
  const hasSet = (rows: Array<{ orgId: string | null }>) => new Set(rows.map((r) => r.orgId))
  const onboardedEmails = new Set(progress.filter((p) => p.completedAt).map((p) => p.email))
  const onboardedOrgs = new Set(orgIds.filter((id) => state.entityComplete.has(id)))
  for (const u of allUsers) if (onboardedEmails.has(u.email)) onboardedOrgs.add(orgKey(u))
  const scoreSets = state.scores
  const startedAssessment = new Set([
    ...orgIds.filter((id) => Object.keys(scoreSets.get(id) ?? {}).length > 0), ...hasSet(assessed), ...hasSet(answered),
  ])
  const completedAssessment = new Set([
    ...orgIds.filter((id) => LADDER_INDICATORS.every((i) => scoreSets.get(id)?.[i.id] != null)),
    ...assessed.filter((a) => a.completedAt).map((a) => a.orgId),
  ])
  const evidenceOrgs = hasSet(evidence)
  const engagementOrgs = hasSet(engagements)
  const validatedIds = new Set(validated.map((v) => v.engagementId))
  const validatedOrgs = new Set(engagements.filter((e) => validatedIds.has(e.id)).map((e) => e.orgId))
  let cur = new Set(orgIds)
  const stage = (key: string, label: string, pass: Set<string | null>) => {
    cur = new Set([...cur].filter((id) => pass.has(id)))
    return { key, label, count: cur.size }
  }
  const orgFunnel = buildFunnel([
    { key: 'signed_up', label: 'Signed up', count: orgIds.length },
    stage('onboarded', 'Finished onboarding', onboardedOrgs),
    stage('assessment_started', 'First assessment started', startedAssessment),
    stage('assessment_completed', 'Assessment completed', completedAssessment),
    stage('evidence', 'Evidence uploaded', evidenceOrgs),
    stage('engagement', 'Validation engagement created', engagementOrgs),
    stage('validated', 'Validated', validatedOrgs),
  ])

  // ---- Validator funnel (independent milestones, as % of profiles created)
  const profiles = (await db.select().from(validatorProfiles)).filter((p) => inRange(p.createdAt, since))
  const emails = new Set(profiles.map((p) => p.email))
  const [modules, tProgress, attempts, subs, tCases, tCaps, tQuestions] = await Promise.all([
    db.select().from(trainingModules).then((ms) => ms.filter((m) => !isSpecialistModuleId(m.id))), db.select().from(trainingProgress), db.select().from(trainingExamAttempts).where(eq(trainingExamAttempts.assessment, 'knowledge')),
    db.select().from(trainingSubmissions), db.select({ id: trainingCases.id }).from(trainingCases).where(eq(trainingCases.active, true)),
    db.select({ id: trainingCapstones.id }).from(trainingCapstones).where(eq(trainingCapstones.active, true)),
    db.select().from(trainingQuestions),
  ])
  const mine = <T extends { email: string }>(rows: T[]) => rows.filter((r) => emails.has(r.email))
  const stepsDone = new Map<string, Set<string>>() // `${email}|${module}` -> steps
  for (const r of mine(tProgress)) stepsDone.set(`${r.email}|${r.moduleId}`, (stepsDone.get(`${r.email}|${r.moduleId}`) ?? new Set()).add(r.step.split(':')[0]))
  const trained = new Set([...mine(tProgress), ...mine(attempts), ...mine(subs)].map((r) => r.email))
  const passedSubs = (kind: string) => mine(subs).filter((s) => s.kind === kind && s.status === 'passed')
  const caseOk = (email: string) => tCases.length > 0 && tCases.every((c) => passedSubs('case').some((s) => s.email === email && s.contentId === c.id))
  const capOk = (email: string) => tCaps.length > 0 && tCaps.every((c) => passedSubs('capstone').some((s) => s.email === email && s.contentId === c.id))
  const validatorFunnel = buildFunnel([
    { key: 'profile', label: 'Profile created', count: profiles.length },
    { key: 'training', label: 'Training started', count: trained.size },
    ...[...modules].sort((a, b) => a.position - b.position).map((m) => ({
      key: `module_${m.id}`, label: `Module ${m.position}: ${m.title}`,
      count: [...emails].filter((e) => TRAINING_STEPS.every((s) => stepsDone.get(`${e}|${m.id}`)?.has(s))).length,
    })),
    { key: 'exam', label: 'Exam passed', count: new Set(mine(attempts).filter((a) => a.passed).map((a) => a.email)).size },
    { key: 'cases', label: 'Cases passed', count: [...emails].filter(caseOk).length },
    { key: 'capstone', label: 'Capstone passed', count: [...emails].filter(capOk).length },
    { key: 'accredited', label: 'Accredited', count: profiles.filter((p) => p.accreditationStatus === 'accredited' || (p.accreditedUntil && p.accreditationStatus !== 'suspended')).length },
  ], { clamp: false })
  // Hardest exam questions over every submitted attempt in range (not only these profiles): lowest % correct first.
  const allSubmitted = attempts.filter((a) => a.status === 'submitted' && inRange(a.submittedAt, since))
  const tally = new Map<string, { asked: number; right: number }>()
  const questionById = new Map(tQuestions.map((q) => [q.id, q]))
  for (const a of allSubmitted) for (const qid of a.questionIds) {
    const q = questionById.get(qid)
    if (!q || a.answers[qid] === undefined) continue
    const t = tally.get(qid) ?? { asked: 0, right: 0 }
    t.asked++
    if (a.answers[qid] === q.correctIndex) t.right++
    tally.set(qid, t)
  }
  const hardest = [...tally].filter(([, t]) => t.asked >= 3)
    .map(([id, t]) => ({ id, topic: questionById.get(id)!.topic, prompt: questionById.get(id)!.prompt, asked: t.asked, pctCorrect: Math.round((t.right / t.asked) * 1000) / 10 }))
    .sort((a, b) => a.pctCorrect - b.pctCorrect || b.asked - a.asked).slice(0, 10)
  const validators = {
    funnel: validatorFunnel,
    exam: { attempts: allSubmitted.length, passed: allSubmitted.filter((a) => a.passed).length,
      passRatePct: allSubmitted.length ? Math.round((allSubmitted.filter((a) => a.passed).length / allSubmitted.length) * 1000) / 10 : null },
    hardestQuestions: hardest,
  }

  // ---- Activity (history = daily_active snapshots plus each person's latest last_seen_at)
  const snapshots = await db.select().from(dailyActive)
  const rowsAll: ActivityRow[] = snapshots.map((s) => ({ email: s.email, day: s.day }))
  for (const u of allUsers) if (u.lastSeenAt) rowsAll.push({ email: u.email, day: day(u.lastSeenAt) })
  const sinceDay = since ? day(since) : '0000-00-00'
  const rowsInRange = rowsAll.filter((r) => r.day >= sinceDay)
  const activeEmails = [...new Set(rowsInRange.map((r) => r.email))]
  const roleOf = (e: string) => userByEmail.get(e)?.role ?? 'assessor'
  const countryOf = (e: string) => {
    const u = userByEmail.get(e)
    return (u && countryByOrg.get(orgKey(u))) || 'Unknown'
  }
  const seriesDays = range === 'all' ? 90 : Number(range)
  const activity = {
    ...activitySummary(rowsAll, now),
    activeInRange: activeEmails.length,
    ...(() => { const s = activitySummary(rowsInRange, now); return { returning: s.returning, oneOff: s.oneOff } })(),
    byRole: topRows(countBy(activeEmails, roleOf), 12).map(([label, count]) => ({ label, count })),
    byCountry: topRows(countBy(activeEmails, countryOf), 12).map(([label, count]) => ({ label, count })),
    series: dailySeries(rowsAll, seriesDays, now),
    historyNote: 'Daily counts start from the first sign-in recorded after this feature shipped; older activity is limited to each person’s latest sign-in.',
  }

  // ---- Directory
  const [searches, views, proposals, validatorNames, firmNames, listed] = await Promise.all([
    db.select().from(directorySearchLog).where(since ? gte(directorySearchLog.createdAt, since) : undefined),
    db.select().from(directoryProfileViews).where(since ? gte(directoryProfileViews.day, day(since)) : undefined),
    db.select().from(orgListingProposals).where(since ? gte(orgListingProposals.createdAt, since) : undefined),
    db.select({ id: validatorProfiles.id, name: validatorProfiles.name }).from(validatorProfiles),
    db.select({ id: firms.id, name: firms.name }).from(firms),
    db.select({ id: orgDirectoryProfiles.id, name: organizations.name }).from(orgDirectoryProfiles)
      .innerJoin(organizations, eq(organizations.id, orgDirectoryProfiles.orgId)),
  ])
  const names = new Map<string, string>([
    ...validatorNames.map((v) => [`validator|${v.id}`, v.name] as const), ...firmNames.map((f) => [`firm|${f.id}`, f.name] as const),
    ...listed.map((l) => [`organization|${l.id}`, l.name] as const),
  ])
  const viewTotals = new Map<string, number>()
  for (const v of views) viewTotals.set(`${v.kind}|${v.profileId}`, (viewTotals.get(`${v.kind}|${v.profileId}`) ?? 0) + v.views)
  const noResults = countBy(searches.filter((s) => s.resultCount === 0), (s) => `${s.type}|${s.query}`)
  const directory = {
    totalSearches: searches.length,
    noResultSearches: searches.filter((s) => s.resultCount === 0).length,
    noResultQueries: topRows(noResults, 15).map(([k, count]) => ({ type: k.split('|')[0], query: k.slice(k.indexOf('|') + 1), count })),
    mostViewed: topRows(viewTotals, 10).map(([k, count]) => ({ kind: k.split('|')[0], name: names.get(k) ?? 'Removed profile', views: count })),
    proposals: ['approved', 'rejected', 'pending', 'withdrawn'].map((status) => ({ status, count: proposals.filter((p) => p.status === status).length })),
  }

  // ---- Support (categories and unresolved escalations only: no message bodies)
  const [issues, escalations] = await Promise.all([
    db.select({ category: supportIssues.category, status: supportIssues.status, createdAt: supportIssues.createdAt }).from(supportIssues),
    db.select({ category: supportEscalations.category, reason: supportEscalations.reason, status: supportEscalations.status, createdAt: supportEscalations.createdAt }).from(supportEscalations),
  ])
  const issuesIn = issues.filter((i) => inRange(i.createdAt, since))
  const escIn = escalations.filter((e) => inRange(e.createdAt, since))
  const support = {
    issuesByCategory: topRows(countBy(issuesIn, (i) => i.category)).map(([label, count]) => ({ label, count })),
    escalationsByCategory: topRows(countBy(escIn, (e) => e.category)).map(([label, count]) => ({ label, count })),
    escalationsByReason: topRows(countBy(escIn, (e) => e.reason)).map(([label, count]) => ({ label, count })),
    openIssues: issues.filter((i) => i.status === 'open').length,
    unresolvedEscalations: escalations.filter((e) => e.status !== 'accepted')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((e) => ({ category: e.category, reason: e.reason, status: e.status, createdAt: e.createdAt.toISOString(), ageDays: daysBetween(e.createdAt, now) })),
  }

  // ---- Operations
  const [mail, cases] = await Promise.all([
    db.select().from(emailLog).where(since ? gte(emailLog.createdAt, since) : undefined),
    db.select().from(panelCases),
  ])
  const kinds = [...new Set(mail.map((m) => m.kind))].sort()
  const decided = cases.filter((c) => c.decidedAt && inRange(c.decidedAt, since))
  const operations = {
    emailsByType: kinds.map((kind) => ({
      kind, sent: mail.filter((m) => m.kind === kind && m.outcome === 'accepted').length,
      failed: mail.filter((m) => m.kind === kind && m.outcome === 'failed').length,
      notConfigured: mail.filter((m) => m.kind === kind && m.outcome === 'not_configured').length,
    })),
    panelOpenCases: cases.filter((c) => c.status !== 'decided').length,
    panelDecidedCases: decided.length,
    panelMedianDecisionDays: median(decided.map((c) => (c.decidedAt!.getTime() - c.createdAt.getTime()) / MS_DAY)),
  }

  return { range, generatedAt: now.toISOString(), onboarding, orgFunnel, validators, activity, directory, support, operations }
}
