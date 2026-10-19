// Server-side helpers for the validator training programme (PR 4): lazy content
// seeding, the earned-accreditation grant, assessment status and badges. Used by
// /api/training and /api/directory. Accreditation is granted ONLY here, by
// `maybeAccredit`, after all three assessment parts are passed.

import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  auditLogs, trainingBadges, trainingCalibrationItems, trainingCapstones, trainingCases, trainingDrills, trainingExamAttempts,
  trainingMarks, trainingModules, trainingProgress, trainingQuestions, trainingSettings, trainingStaff, trainingSubmissions,
  validatorProfiles,
} from '../../db/schema.js'
import {
  SEED_BADGES, SEED_CALIBRATION, SEED_CAPSTONE, SEED_CASES, SEED_MODULES, SEED_QUESTIONS,
} from '../../src/lib/trainingSeed.js'
import { SEED_INDEX_MODULES, SEED_INDEX_QUESTIONS } from '../../src/lib/trainingSeedIndices.js'
import { isSpecialistModuleId } from '../../src/lib/specialisms.js'
import {
  accreditedUntilOnPass, allPartsPassed, capstoneResult, earnedBadges, STEPS, type BadgeKey, type RubricCriterion,
} from '../../src/lib/validatorTraining.js'
import { isSuperAdmin } from './auth.js'

export const audit = (actor: string, action: string, target: string, category = 'Training') =>
  db.insert(auditLogs).values({ actor, action, target, category })

// --- seeding -----------------------------------------------------------------
// Runs once: after the flag is set the database is the source of truth, so edits (and
// deletions) made by the programme team are never overwritten.
export async function ensureSeed(): Promise<void> {
  const [flag] = await db.select().from(trainingSettings).where(eq(trainingSettings.key, 'seeded'))
  if (!flag) await seedProgramme()
  await seedIndexContent()
}

async function seedProgramme(): Promise<void> {
  await db.insert(trainingModules).values(SEED_MODULES.map((m) => ({
    id: m.id, position: m.position, title: m.title, outcome: m.outcome, script: m.script, exercises: m.exercises as any,
    scenario: m.scenario, reflectionPrompt: m.reflectionPrompt,
  }))).onConflictDoNothing()
  await db.insert(trainingQuestions).values(SEED_QUESTIONS).onConflictDoNothing()
  await db.insert(trainingCases).values(SEED_CASES).onConflictDoNothing()
  await db.insert(trainingCapstones).values(SEED_CAPSTONE).onConflictDoNothing()
  await db.insert(trainingCalibrationItems).values(SEED_CALIBRATION).onConflictDoNothing()
  await db.insert(trainingBadges).values(SEED_BADGES).onConflictDoNothing()
  await db.insert(trainingSettings).values({ key: 'seeded', value: new Date().toISOString() }).onConflictDoNothing()
}

// The CRAFT indices content (module 9, specialist S1 and S2): added once, to new and existing databases alike.
// Inserts never overwrite, so a module the programme team already edited is left as it is.
async function seedIndexContent(): Promise<void> {
  const [flag] = await db.select().from(trainingSettings).where(eq(trainingSettings.key, 'seeded-indices'))
  if (flag) return
  await db.insert(trainingModules).values(SEED_INDEX_MODULES.map((m) => ({
    id: m.id, position: m.position, title: m.title, outcome: m.outcome, script: m.script, exercises: m.exercises as any,
    scenario: m.scenario, reflectionPrompt: m.reflectionPrompt,
  }))).onConflictDoNothing()
  await db.insert(trainingQuestions).values(SEED_INDEX_QUESTIONS).onConflictDoNothing()
  await db.insert(trainingSettings).values({ key: 'seeded-indices', value: new Date().toISOString() }).onConflictDoNothing()
}

/** Core modules only: specialist modules (s1, s2) never count towards accreditation or renewal. */
export const coreModules = <T extends { id: string }>(mods: T[]): T[] => mods.filter((m) => !isSpecialistModuleId(m.id))

// --- roles --------------------------------------------------------------------
export async function staffRole(email: string): Promise<'programme_team' | 'lead_validator' | null> {
  const [row] = await db.select({ role: trainingStaff.role }).from(trainingStaff).where(eq(trainingStaff.email, email))
  return (row?.role as 'programme_team' | 'lead_validator' | undefined) ?? null
}
// Programme team: platform admin + the 'programme_team' role. Edits content and marks.
export async function isProgrammeTeam(email: string): Promise<boolean> {
  return isSuperAdmin(email) || (await staffRole(email)) === 'programme_team'
}
// Markers: programme team or Lead Validators.
export async function isMarker(email: string): Promise<boolean> {
  return isSuperAdmin(email) || (await staffRole(email)) !== null
}

// --- progress -------------------------------------------------------------------
export async function completedModuleIds(email: string): Promise<string[]> {
  const mods = await db.select({ id: trainingModules.id }).from(trainingModules)
  const rows = await db.select({ moduleId: trainingProgress.moduleId, step: trainingProgress.step }).from(trainingProgress).where(eq(trainingProgress.email, email))
  // Includes specialist modules; callers that gate core steps filter with coreModules.
  const done = new Map<string, Set<string>>()
  for (const r of rows) done.set(r.moduleId, (done.get(r.moduleId) ?? new Set()).add(r.step))
  return mods.filter((m) => STEPS.every((s) => done.get(m.id)?.has(s))).map((m) => m.id)
}

// --- assessment status ------------------------------------------------------------
export async function assessmentParts(email: string) {
  const [attempts, cases, capstones, subs] = await Promise.all([
    db.select().from(trainingExamAttempts).where(and(eq(trainingExamAttempts.email, email), eq(trainingExamAttempts.assessment, 'knowledge'))),
    db.select().from(trainingCases).where(eq(trainingCases.active, true)).orderBy(asc(trainingCases.position)),
    db.select().from(trainingCapstones).where(eq(trainingCapstones.active, true)),
    db.select().from(trainingSubmissions).where(eq(trainingSubmissions.email, email)),
  ])
  const examPassed = attempts.some((a) => a.passed)
  const casePassed = cases.map((c) => subs.some((s) => s.kind === 'case' && s.contentId === c.id && s.status === 'passed'))
  const capstonePassed = subs.some((s) => s.kind === 'capstone' && s.status === 'passed')
  return { examPassed, caseIds: cases.map((c) => c.id), casePassed, capstonePassed, capstoneCount: capstones.length, attempts, subs }
}

// Grants one year of accreditation when (and only when) all three parts are passed and the
// validator has never been accredited. Renewals use /api/training/renewal/complete instead.
// The update is conditional so concurrent calls and suspended validators cannot double-grant.
export async function maybeAccredit(email: string, now = new Date()): Promise<Date | null> {
  const [profile] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.email, email))
  if (!profile || profile.accreditedUntil || profile.accreditationStatus === 'suspended') return null
  const p = await assessmentParts(email)
  if (!allPartsPassed({ exam: p.examPassed, cases: p.casePassed, capstone: p.capstonePassed })) return null
  const until = accreditedUntilOnPass(now)
  const updated = await db.update(validatorProfiles).set({
    accreditedUntil: until, accreditationStatus: 'accredited', accreditationReason: null,
    accreditationChangedBy: 'training programme', accreditationChangedAt: now, updatedAt: now,
  }).where(and(eq(validatorProfiles.id, profile.id), isNull(validatorProfiles.accreditedUntil), ne(validatorProfiles.accreditationStatus, 'suspended'))).returning({ id: validatorProfiles.id })
  if (!updated.length) return null
  await audit('training programme', `accredited until ${until.toISOString().slice(0, 10)} (passed exam, scenario cases and capstone)`, profile.id, 'Accreditation')
  return until
}

// --- badges -----------------------------------------------------------------------
// Earned from learning and accuracy only, derived on read from the training records.
export async function badgesFor(emails: string[]): Promise<Map<string, Array<{ key: BadgeKey; name: string; criteria: string }>>> {
  const out = new Map<string, Array<{ key: BadgeKey; name: string; criteria: string }>>()
  if (!emails.length) return out
  await ensureSeed()
  const [defs, progress, drills, subs, mods] = await Promise.all([
    db.select().from(trainingBadges).where(eq(trainingBadges.active, true)).orderBy(asc(trainingBadges.position)),
    db.select().from(trainingProgress).where(inArray(trainingProgress.email, emails)),
    db.select().from(trainingDrills).where(inArray(trainingDrills.email, emails)),
    db.select().from(trainingSubmissions).where(and(inArray(trainingSubmissions.email, emails), eq(trainingSubmissions.kind, 'capstone'), eq(trainingSubmissions.status, 'passed'))),
    db.select({ id: trainingModules.id }).from(trainingModules).then(coreModules),
  ])
  const marks = subs.length ? await db.select().from(trainingMarks).where(inArray(trainingMarks.submissionId, subs.map((s) => s.id))) : []
  const capstoneRows = subs.length ? await db.select().from(trainingCapstones) : []
  for (const email of emails) {
    const mine = progress.filter((r) => r.email === email)
    const completedModules = mods.filter((m) => STEPS.every((s) => mine.some((r) => r.moduleId === m.id && r.step === s))).map((m) => m.id)
    const detailOf = (key: string) => mine.filter((r) => r.step.startsWith('try:') && r.detail?.key === key)
    const sub = subs.find((s) => s.email === email)
    const mark = sub ? marks.find((m) => m.submissionId === sub.id) : undefined
    const rubric = (capstoneRows.find((c) => c.id === sub?.contentId)?.rubric ?? []) as RubricCriterion[]
    const criteria = (mark?.scores as any)?.criteria as Record<string, number> | undefined
    const capstonePassed = !!sub && !!criteria && capstoneResult(rubric, criteria).passed
    const myDrills = drills.filter((d) => d.email === email)
    const keys = new Set(earnedBadges({
      completedModules,
      rungChallengeDone: mine.some((r) => r.moduleId === 'm2' && r.step.startsWith('try:') && r.detail?.key === 'rung-calculator'),
      evidenceSortPerfect: detailOf('evidence-sort').some((r) => r.detail?.perfect === true),
      conflictSpotterPerfect: detailOf('conflict-spotter').some((r) => r.detail?.perfect === true),
      bestCalibrationPct: myDrills.length ? Math.max(...myDrills.map((d) => d.pct)) : null,
      capstonePassed,
      capstoneScores: capstonePassed ? criteria! : null,
    }))
    out.set(email, defs.filter((d) => keys.has(d.key as BadgeKey)).map((d) => ({ key: d.key as BadgeKey, name: d.name, criteria: d.criteria })))
  }
  return out
}
