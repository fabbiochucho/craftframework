import type { Config } from '@netlify/functions'
import { and, asc, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  firmMembers, firms, trainingActivity, trainingBadges, trainingCalibrationItems, trainingCapstones, trainingCases, trainingCpd,
  trainingDeclarations, trainingDrills, trainingExamAttempts, trainingMarks, trainingModules, trainingProgress, trainingQuestions,
  trainingStaff, trainingSubmissions, validatorCredentials, validatorProfiles, validatorSpecialisms,
  type TrainingExercise,
} from '../../db/schema.js'
import { forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import {
  assessmentParts, audit, badgesFor, completedModuleIds, coreModules, ensureSeed, isMarker, isProgrammeTeam, maybeAccredit,
} from '../lib/training.js'
import { effectiveAccreditation } from '../../src/lib/validatorDirectory.js'
import {
  heldSpecialisms, isSpecialistModuleId, SPECIALISM_LABEL, SPECIALISM_MODULE, SPECIALISMS, SPECIALIST_EXAM, specialistPassed, type Specialism,
} from '../../src/lib/specialisms.js'
import { LADDER_INDICATORS, currentRung } from '../../src/lib/capitalReadiness.js'
import {
  accreditationState, calibrationScore, canSubmitCase, capstoneResult, CAPSTONE, CASES, caseResult, checkPassed, dayKey, DRILL,
  drawExamQuestions, examDeadline, examEligibility, examOnTime, exemptBody, renewalChecklist, renewalOpensAt, renewalWindowStart,
  renewedUntil, scoreExam, STEPS, streakDays, wordCount, XP, youtubeEmbedId, type RubricCriterion, type Step,
} from '../../src/lib/validatorTraining.js'

// /api/training — the validator training and accreditation programme (spec PR 4).
// Signed-in only. Learners work through eight modules (Watch → Try → Decide → Check →
// Reflect), then sit the three-part assessment. Accreditation is granted ONLY by
// passing all three parts (netlify/lib/training.ts maybeAccredit) and renewed
// yearly; no endpoint accepts an accreditation date. Content is data edited by the
// CRAFT programme team (platform admin or the programme_team role).
//
//   GET    me                                  overview: modules, progress, badges, assessment, renewal
//   GET    modules/:id                         one module for the learner
//   POST   modules/:id/watch|decide|reflect    complete a step
//   POST   modules/:id/try/:n                  submit exercise n (graded server-side)
//   POST   modules/:id/check[/skip]            knowledge check (m3 skip: ICAN/ANAN/ACCA/CIA)
//   GET    drill                               10 random calibration indicators
//   GET    exam | POST exam/start | POST exam/:id/submit
//   GET    cases | POST cases/:id/submit       written scenario cases
//   GET    capstone | POST capstone/:id/submit
//   GET    marking/queue | GET marking/:id | POST marking/:id       markers only
//   POST   renewal/cpd | DELETE renewal/cpd/:id | POST renewal/declaration|drill|complete
//   GET    firm/:firmId/team                   firm owner: which members are lapsed
//   GET    manage/content | PUT/POST manage/...   programme team: edit content
//   PUT/DELETE manage/staff/:email             platform admin: programme team / Lead Validators

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const notFound = () => json({ error: 'Not found' }, 404)
const bad = (error: string) => json({ error }, 400)
const conflict = (error: string) => json({ error }, 409)
const rid = (p: string) => `${p}_${crypto.randomUUID()}`
const EXAM_GRACE_MS = SPECIALIST_EXAM.graceSeconds * 1000
const DECLARATION = 'I remain independent of every organisation I validate, I have disclosed any relationship that could threaten that independence, and the list of current client relationships below is complete.'

// --- schemas ---------------------------------------------------------------------
const exerciseSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('classify'), key: z.string().max(60).optional(), title: z.string().min(1).max(200), instructions: z.string().max(2000).default(''),
    items: z.array(z.object({ prompt: z.string().min(1).max(1000), options: z.array(z.string().min(1).max(300)).min(2).max(8), correct: z.number().int().min(0), explain: z.string().max(1000).default('') }).refine((i) => i.correct < i.options.length, 'correct must index an option')).min(1).max(40) }),
  z.object({ type: z.literal('rung-calculator'), title: z.string().min(1).max(200), instructions: z.string().max(2000).default(''), target: z.number().int().min(1).max(7), start: z.record(z.string(), z.number().int().min(0).max(5)) }),
  z.object({ type: z.literal('calibration-drill'), title: z.string().min(1).max(200), instructions: z.string().max(2000).default('') }),
  z.object({ type: z.literal('write'), title: z.string().min(1).max(200), instructions: z.string().max(2000).default(''), items: z.array(z.object({ prompt: z.string().min(1).max(1000), model: z.string().max(3000).default('') })).min(1).max(20) }),
])
const scenarioSchema = z.object({
  prompt: z.string().min(1).max(3000),
  choices: z.array(z.object({ text: z.string().min(1).max(1000), consequence: z.string().max(2000).default(''), feedback: z.string().max(2000).default(''), best: z.boolean() })).min(2).max(6),
}).refine((s) => s.choices.some((c) => c.best), 'mark at least one best choice')
const moduleSchema = z.object({
  title: z.string().trim().min(1).max(200), outcome: z.string().max(500), script: z.string().max(40000),
  youtubeUrl: z.string().trim().max(300).nullable().optional(), reflectionPrompt: z.string().max(1000),
  exercises: z.array(exerciseSchema).max(10), scenario: scenarioSchema.nullable(),
}).strict()
const questionSchema = z.object({
  moduleId: z.string().max(40).nullable().optional(), topic: z.string().max(120).default(''), prompt: z.string().trim().min(1).max(1000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(6), correctIndex: z.number().int().min(0), explanation: z.string().max(2000).default(''),
  forCheck: z.boolean().default(false), forExam: z.boolean().default(false), active: z.boolean().default(true),
}).strict().refine((q) => q.correctIndex < q.options.length, 'correctIndex must index an option')
const caseSchema = z.object({ title: z.string().trim().min(1).max(200), topic: z.string().max(120).default(''), prompt: z.string().trim().min(1).max(4000), modelAnswer: z.string().max(4000).default(''), position: z.number().int().min(1).max(100).optional(), active: z.boolean().default(true) }).strict()
const rubricSchema = z.array(z.object({ key: z.string().regex(/^[a-z][a-z0-9_-]{0,30}$/), name: z.string().min(1).max(120), weight: z.string().max(40), mustMeet: z.boolean(), meets: z.string().max(1000) })).min(1).max(12)
const capstoneSchema = z.object({
  title: z.string().trim().min(1).max(200), brief: z.string().trim().min(1).max(8000), modelAnswer: z.string().max(4000).default(''),
  evidence: z.array(z.object({ title: z.string().min(1).max(200), body: z.string().max(4000) })).max(30),
  referenceScores: z.record(z.string(), z.number().int().min(0).max(5)), rubric: rubricSchema, position: z.number().int().min(1).max(100).optional(), active: z.boolean().default(true),
}).strict()
const calibrationSchema = z.object({ statement: z.string().trim().min(1).max(600), referenceScore: z.number().int().min(0).max(5), active: z.boolean().default(true) }).strict()
const badgeSchema = z.object({ name: z.string().trim().min(1).max(80), criteria: z.string().max(1000), active: z.boolean() }).strict()

const indicatorIds = LADDER_INDICATORS.filter((i) => i.level <= 4).map((i) => i.id)
const capstoneBodySchema = z.object({
  declaration: z.string().trim().min(20).max(4000),
  scores: z.record(z.string(), z.object({ score: z.number().int().min(0).max(5), note: z.string().trim().min(5).max(2000) })),
  debrief: z.string().trim().min(20).max(4000),
  outcome: z.enum(['validated', 'validated_with_qualifications', 'not_validated']),
  ratedRung: z.number().int().min(0).max(7),
  qualifications: z.string().max(4000),
  followUp: z.string().trim().min(5).max(3000),
  validityMonths: z.number().int().min(1).max(24),
  materialEvents: z.string().trim().min(2).max(3000),
}).strict().refine((b) => indicatorIds.every((id) => b.scores[id]), 'A score and evidence note are required for every rung 1-4 indicator')

// --- shared lookups ----------------------------------------------------------------
async function profileOf(email: string) {
  const [p] = await db.select().from(validatorProfiles).where(eq(validatorProfiles.email, email))
  return p ?? null
}

function learnerModule(m: typeof trainingModules.$inferSelect) {
  const exercises = (m.exercises as any[]).map((e) => {
    if (e.type === 'classify') return { type: e.type, title: e.title, instructions: e.instructions, items: e.items.map((i: any) => ({ prompt: i.prompt, options: i.options })) }
    if (e.type === 'write') return { type: e.type, title: e.title, instructions: e.instructions, items: e.items.map((i: any) => ({ prompt: i.prompt })) }
    return e
  })
  return {
    id: m.id, position: m.position, title: m.title, outcome: m.outcome, script: m.script, reflectionPrompt: m.reflectionPrompt,
    videoId: youtubeEmbedId(m.youtubeUrl), revision: m.revision, exercises,
    scenario: m.scenario ? { prompt: m.scenario.prompt, choices: m.scenario.choices.map((c) => ({ text: c.text })) } : null,
  }
}

async function recordActivity(email: string, now: Date) {
  await db.insert(trainingActivity).values({ email, day: dayKey(now) }).onConflictDoNothing()
}

async function completeStep(email: string, moduleId: string, step: string, revision: number, detail: Record<string, unknown> = {}, now = new Date()) {
  await db.insert(trainingProgress).values({ email, moduleId, step, completedAt: now, revision, detail })
    .onConflictDoUpdate({ target: [trainingProgress.email, trainingProgress.moduleId, trainingProgress.step], set: { completedAt: now, revision, detail } })
  await recordActivity(email, now)
}

// Renewal state of one validator for the yearly cycle that ends at `until`.
async function renewalState(email: string, until: Date, now: Date) {
  const start = renewalWindowStart(until)
  const [mods, prog, cpd, drills, decls] = await Promise.all([
    db.select().from(trainingModules).orderBy(asc(trainingModules.position)).then(coreModules),
    db.select().from(trainingProgress).where(and(eq(trainingProgress.email, email), eq(trainingProgress.step, 'watch'))),
    db.select().from(trainingCpd).where(and(eq(trainingCpd.email, email), gte(trainingCpd.occurredOn, dayKey(start)))),
    db.select().from(trainingDrills).where(and(eq(trainingDrills.email, email), eq(trainingDrills.purpose, 'renewal'), gte(trainingDrills.takenAt, start))),
    db.select().from(trainingDeclarations).where(and(eq(trainingDeclarations.email, email), gte(trainingDeclarations.signedAt, start))),
  ])
  const check = renewalChecklist({
    videos: mods.map((m) => {
      const w = prog.find((p) => p.moduleId === m.id)
      return { moduleId: m.id, title: m.title, done: !!w && w.completedAt.getTime() >= start.getTime() && w.revision >= m.revision }
    }),
    cpdHours: Math.round(cpd.reduce((a, c) => a + Number(c.hours), 0) * 10) / 10,
    drillPct: drills.length ? Math.max(...drills.map((d) => d.pct)) : null,
    declared: decls.length > 0,
  })
  const opensAt = renewalOpensAt(until)
  return { ...check, windowStart: start, opensAt, open: now.getTime() >= opensAt.getTime(), cpd, declaration: DECLARATION }
}

async function expireStaleAttempts(email: string, now: Date) {
  const open = await db.select().from(trainingExamAttempts).where(and(eq(trainingExamAttempts.email, email), eq(trainingExamAttempts.status, 'in_progress')))
  for (const a of open) {
    if (now.getTime() > a.deadline.getTime() + EXAM_GRACE_MS) {
      await db.update(trainingExamAttempts).set({ status: 'expired', score: 0, submittedAt: now }).where(eq(trainingExamAttempts.id, a.id))
    }
  }
}

function sanitizeSub(s: typeof trainingSubmissions.$inferSelect, marks: Array<typeof trainingMarks.$inferSelect>) {
  const done = s.status !== 'pending'
  return {
    id: s.id, attempt: s.attempt, status: s.status, percent: s.resultPercent === null ? null : Number(s.resultPercent), submittedAt: s.submittedAt,
    feedback: done ? marks.filter((m) => m.comment).map((m) => m.comment) : [], marksReceived: marks.length,
  }
}

// The learner's specialist modules, specialisms and assessment state (indices spec §7.1).
async function specialistState(email: string, profile: typeof validatorProfiles.$inferSelect | null, modules: Array<{ id: string; title: string; complete: boolean }>, now: Date) {
  const [rows, attempts] = await Promise.all([
    db.select().from(validatorSpecialisms).where(eq(validatorSpecialisms.email, email)),
    db.select().from(trainingExamAttempts).where(and(eq(trainingExamAttempts.email, email), ne(trainingExamAttempts.assessment, 'knowledge'))).orderBy(desc(trainingExamAttempts.startedAt)),
  ])
  const accreditation = profile ? effectiveAccreditation(profile, now) : 'registered'
  const held = heldSpecialisms(rows, accreditation)
  return SPECIALISMS.map((s) => {
    const mod = modules.find((x) => x.id === SPECIALISM_MODULE[s])
    const mine = attempts.filter((x) => x.assessment === s)
    const el = examEligibility(mine.map((x) => x.startedAt), now)
    return {
      specialism: s, label: SPECIALISM_LABEL[s], moduleId: SPECIALISM_MODULE[s], moduleTitle: mod?.title ?? null, moduleComplete: !!mod?.complete,
      granted: rows.some((r) => r.specialism === s), current: held.includes(s), accredited: accreditation === 'accredited',
      allowed: el.allowed, nextAt: el.nextAt ?? null, inProgress: mine.find((x) => x.status === 'in_progress')?.id ?? null,
      attempts: mine.map((x) => ({ id: x.id, startedAt: x.startedAt, status: x.status, score: x.score, total: x.total, passed: x.passed })),
    }
  })
}

// --- handler -------------------------------------------------------------------------
const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (req.method !== 'GET' && caller.readOnly) return forbidden()
    const email = caller.email
    const now = new Date()
    const url = new URL(req.url)
    const seg = url.pathname.replace(/^\/api\/training\/?/, '').split('/').filter(Boolean)
    const [a, b, c, d] = seg
    const m = req.method
    const readBody = async () => { try { return await req.json() } catch { return null } }
    await ensureSeed()
    const requireProfile = async () => {
      const p = await profileOf(email)
      if (!p) return { error: bad('Create your validator profile in the Directory first') }
      if (p.accreditationStatus === 'suspended') return { error: json({ error: 'Your validator profile is suspended; the assessment is unavailable' }, 403) }
      return { profile: p }
    }
    // The assessment follows the eight modules.
    const requireTraining = async () => {
      const done = new Set(await completedModuleIds(email))
      const all = coreModules(await db.select({ id: trainingModules.id }).from(trainingModules))
      return all.every((x) => done.has(x.id)) ? null : bad('Complete all the core modules before the assessment')
    }

    // ---------- learner overview ----------
    if (m === 'GET' && a === 'me' && !b) {
      await maybeAccredit(email, now)
      const [profile, mods, prog, days, drills, staff, badgeMap] = await Promise.all([
        profileOf(email),
        db.select().from(trainingModules).orderBy(asc(trainingModules.position)),
        db.select().from(trainingProgress).where(eq(trainingProgress.email, email)),
        db.select().from(trainingActivity).where(eq(trainingActivity.email, email)),
        db.select().from(trainingDrills).where(eq(trainingDrills.email, email)).orderBy(desc(trainingDrills.takenAt)),
        isMarker(email), badgesFor([email]),
      ])
      const stepsOf = (id: string) => STEPS.filter((s) => prog.some((p) => p.moduleId === id && p.step === s))
      const specialistModules = mods.filter((md) => isSpecialistModuleId(md.id)).map((md) => ({ id: md.id, position: md.position, title: md.title, outcome: md.outcome, complete: stepsOf(md.id).length === STEPS.length }))
      const modules = coreModules(mods).map((md) => {
        const steps = stepsOf(md.id)
        return { id: md.id, position: md.position, title: md.title, outcome: md.outcome, hasVideo: !!youtubeEmbedId(md.youtubeUrl), steps, complete: steps.length === STEPS.length }
      })
      const xp = prog.filter((p) => (STEPS as readonly string[]).includes(p.step)).reduce((acc, p) => acc + XP[p.step as Step], 0)
      const parts = await assessmentParts(email)
      const live = parts.attempts.filter((x) => x.status === 'in_progress' && examOnTime(x.startedAt, now))
      const eligibility = examEligibility(parts.attempts.map((x) => x.startedAt), now)
      const until = profile?.accreditedUntil ?? null
      const state = profile ? accreditationState(profile, now) : 'registered'
      const caseRows = await db.select().from(trainingCases).where(eq(trainingCases.active, true))
      const notes = prog.filter((p) => p.step === 'reflect').map((p) => ({ moduleId: p.moduleId, text: String(p.detail?.text ?? ''), at: p.completedAt }))
      return json({
        email, isMarker: staff, isProgrammeTeam: await isProgrammeTeam(email), isAdmin: isSuperAdmin(email),
        profile: profile ? { id: profile.id, name: profile.name, accreditation: state, accreditedUntil: until } : null,
        modules, progress: {
          xp, streak: streakDays(days.map((x) => x.day), now), modulesDone: modules.filter((x) => x.complete).length, modulesTotal: modules.length,
          pct: modules.length ? Math.round((modules.reduce((acc, x) => acc + x.steps.length, 0) / (modules.length * STEPS.length)) * 100) : 0,
          calibration: drills.length ? { pct: drills[0].pct, within: drills[0].within, total: drills[0].total } : null,
        },
        badges: badgeMap.get(email) ?? [],
        assessment: {
          examPassed: parts.examPassed, examAllowed: eligibility.allowed, examReason: eligibility.reason ?? null, examNextAt: eligibility.nextAt ?? null,
          attemptsThisYear: eligibility.attemptsThisYear, examInProgress: live[0]?.id ?? null,
          casesPassed: parts.casePassed.filter(Boolean).length, casesTotal: caseRows.length, capstonePassed: parts.capstonePassed,
          trainingComplete: modules.length > 0 && modules.every((x) => x.complete),
        },
        renewal: until && profile ? { ...(await renewalState(email, until, now)), until } : null,
        learningLog: notes,
        specialist: await specialistState(email, profile, specialistModules, now),
      })
    }

    // ---------- modules ----------
    if (a === 'modules' && b) {
      const [md] = await db.select().from(trainingModules).where(eq(trainingModules.id, b))
      if (!md) return notFound()
      if (m === 'GET' && !c) {
        const prog = await db.select().from(trainingProgress).where(and(eq(trainingProgress.email, email), eq(trainingProgress.moduleId, md.id)))
        const pool = await db.select().from(trainingQuestions).where(and(eq(trainingQuestions.moduleId, md.id), eq(trainingQuestions.forCheck, true), eq(trainingQuestions.active, true)))
        const drawn = drawExamQuestions(pool, Math.random, 5).drawn
        const creds = await db.select({ body: validatorCredentials.body, verifiedAt: validatorCredentials.verifiedAt }).from(validatorCredentials)
          .innerJoin(validatorProfiles, eq(validatorProfiles.id, validatorCredentials.validatorId)).where(eq(validatorProfiles.email, email))
        const body = exemptBody(creds.map((x) => x.body))
        const skip = md.id === 'm3' && body ? { body, verified: creds.some((x) => x.verifiedAt && exemptBody([x.body])) } : null
        return json({
          ...learnerModule(md), steps: STEPS.filter((s) => prog.some((p) => p.step === s)),
          exercisesDone: prog.filter((p) => p.step.startsWith('try:')).map((p) => ({ n: Number(p.step.slice(4)), score: p.detail?.score ?? null, total: p.detail?.total ?? null })),
          decision: prog.find((p) => p.step === 'decide')?.detail ?? null, reflection: String(prog.find((p) => p.step === 'reflect')?.detail?.text ?? ''),
          checkQuestions: drawn.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })), checkSkip: skip,
        })
      }
      if (m === 'POST' && c === 'watch') {
        await completeStep(email, md.id, 'watch', md.revision, { video: !!youtubeEmbedId(md.youtubeUrl) }, now)
        return json({ ok: true })
      }
      if (m === 'POST' && c === 'decide') {
        const p = z.object({ choice: z.number().int().min(0) }).safeParse(await readBody())
        if (!p.success || !md.scenario || !md.scenario.choices[p.data.choice]) return bad('Choose one of the options')
        const ch = md.scenario.choices[p.data.choice]
        await completeStep(email, md.id, 'decide', md.revision, { choice: p.data.choice, best: ch.best }, now)
        return json({ consequence: ch.consequence, feedback: ch.feedback, best: ch.best, bestChoices: md.scenario.choices.map((x, i) => (x.best ? i : -1)).filter((i) => i >= 0) })
      }
      if (m === 'POST' && c === 'reflect') {
        const p = z.object({ text: z.string().trim().min(20).max(4000) }).safeParse(await readBody())
        if (!p.success) return bad('Write at least a couple of sentences')
        await completeStep(email, md.id, 'reflect', md.revision, { text: p.data.text }, now)
        return json({ ok: true })
      }
      if (m === 'POST' && c === 'try' && d !== undefined) {
        const n = Number(d)
        const ex = (md.exercises as any[])[n]
        if (!Number.isInteger(n) || !ex) return notFound()
        const body = await readBody()
        let result: Record<string, unknown> = {}
        let detail: Record<string, unknown> | null = null
        if (ex.type === 'classify') {
          const p = z.object({ answers: z.array(z.number().int()).length(ex.items.length) }).safeParse(body)
          if (!p.success) return bad('Answer every item')
          const items = ex.items.map((it: any, i: number) => ({ correct: p.data.answers[i] === it.correct, correctIndex: it.correct, explain: it.explain }))
          const score = items.filter((i: any) => i.correct).length
          const [prev] = await db.select().from(trainingProgress).where(and(eq(trainingProgress.email, email), eq(trainingProgress.moduleId, md.id), eq(trainingProgress.step, `try:${n}`)))
          const perfect = score === items.length || prev?.detail?.perfect === true
          detail = { kind: 'classify', key: ex.key ?? null, score, total: items.length, perfect }
          result = { score, total: items.length, items }
        } else if (ex.type === 'rung-calculator') {
          const p = z.object({ scores: z.record(z.string(), z.number().int().min(0).max(5)) }).safeParse(body)
          if (!p.success) return bad('Invalid scores')
          const scores = Object.fromEntries(Object.entries(p.data.scores).filter(([k]) => LADDER_INDICATORS.some((i) => i.id === k)))
          const rung = currentRung(scores)
          result = { rung, target: ex.target, done: rung === ex.target }
          if (rung === ex.target) detail = { kind: 'rung-calculator', key: 'rung-calculator', score: 1, total: 1, perfect: true }
        } else if (ex.type === 'calibration-drill') {
          const p = z.object({ answers: z.record(z.string(), z.number().int().min(0).max(5)) }).safeParse(body)
          if (!p.success) return bad('Invalid scores')
          const r = await gradeDrill(email, p.data.answers, 'module', now)
          if ('error' in r) return bad(String(r.error))
          detail = { kind: 'calibration-drill', key: 'calibration', score: r.within, total: r.total, perfect: r.pct === 100 }
          result = r
        } else {
          const p = z.object({ answers: z.array(z.string().trim().min(10).max(3000)).length(ex.items.length) }).safeParse(body)
          if (!p.success) return bad('Write an answer for every item (at least a sentence)')
          detail = { kind: 'write', key: null, score: ex.items.length, total: ex.items.length, perfect: true }
          result = { models: ex.items.map((i: any) => i.model) }
        }
        if (detail) {
          await completeStep(email, md.id, `try:${n}`, md.revision, detail, now)
          const rows = await db.select({ step: trainingProgress.step }).from(trainingProgress).where(and(eq(trainingProgress.email, email), eq(trainingProgress.moduleId, md.id)))
          if ((md.exercises as any[]).every((_, i) => rows.some((r) => r.step === `try:${i}`))) await completeStep(email, md.id, 'try', md.revision, {}, now)
        }
        return json({ ...result, recorded: !!detail })
      }
      if (m === 'POST' && c === 'check' && !d) {
        const p = z.object({ answers: z.record(z.string(), z.number().int()) }).safeParse(await readBody())
        if (!p.success) return bad('Invalid answers')
        const pool = await db.select().from(trainingQuestions).where(and(eq(trainingQuestions.moduleId, md.id), eq(trainingQuestions.forCheck, true), eq(trainingQuestions.active, true)))
        const asked = pool.filter((q) => q.id in p.data.answers)
        if (!pool.length || asked.length < Math.min(5, pool.length)) return bad(`Answer ${Math.min(5, pool.length)} questions`)
        const results = asked.map((q) => ({ id: q.id, correct: p.data.answers[q.id] === q.correctIndex, correctIndex: q.correctIndex, explanation: q.explanation }))
        const correct = results.filter((r) => r.correct).length
        const passed = checkPassed(correct, results.length)
        if (passed) await completeStep(email, md.id, 'check', md.revision, { score: correct, total: results.length }, now)
        return json({ score: correct, total: results.length, passed, results })
      }
      if (m === 'POST' && c === 'check' && d === 'skip') {
        if (md.id !== 'm3') return bad('Only the Module 3 check can be skipped')
        const creds = await db.select({ body: validatorCredentials.body, verifiedAt: validatorCredentials.verifiedAt }).from(validatorCredentials)
          .innerJoin(validatorProfiles, eq(validatorProfiles.id, validatorCredentials.validatorId)).where(eq(validatorProfiles.email, email))
        const body = exemptBody(creds.map((x) => x.body))
        if (!body) return forbidden()
        const verified = creds.some((x) => x.verifiedAt && exemptBody([x.body]))
        await completeStep(email, md.id, 'check', md.revision, { skipped: true, body, verified }, now)
        await audit(email, `skipped Module 3 check on the strength of ${body} (${verified ? 'verified' : 'self-declared'})`, md.id)
        return json({ ok: true, body, verified })
      }
    }

    // ---------- calibration drill ----------
    if (m === 'GET' && a === 'drill') {
      const pool = await db.select().from(trainingCalibrationItems).where(eq(trainingCalibrationItems.active, true))
      return json({ items: drawExamQuestions(pool, Math.random, DRILL.size).drawn.map((i) => ({ id: i.id, statement: i.statement })) })
    }

    // ---------- specialist assessments (indices spec §7.1) ----------
    //   POST specialist/:specialism/start    accredited, module done, not yet held: a timed 15-question assessment
    //   POST specialist/attempt/:id/submit   scored server-side; a pass grants the specialism
    if (a === 'specialist') {
      await expireStaleAttempts(email, now)
      if (m === 'POST' && b && (SPECIALISMS as readonly string[]).includes(b) && c === 'start') {
        const s = b as Specialism
        const g = await requireProfile()
        if (g.error) return g.error
        if (effectiveAccreditation(g.profile) !== 'accredited') return forbidden()
        const done = await completedModuleIds(email)
        if (!done.includes(SPECIALISM_MODULE[s])) return bad(`Complete the ${SPECIALISM_LABEL[s]} module first`)
        const held = await db.select().from(validatorSpecialisms).where(and(eq(validatorSpecialisms.email, email), eq(validatorSpecialisms.specialism, s)))
        if (held.length) return conflict('You already hold this specialism')
        const attempts = await db.select().from(trainingExamAttempts).where(and(eq(trainingExamAttempts.email, email), eq(trainingExamAttempts.assessment, s)))
        const show = async (at: typeof attempts[number]) => {
          const qs = await db.select().from(trainingQuestions).where(inArray(trainingQuestions.id, at.questionIds))
          return json({ id: at.id, specialism: s, startedAt: at.startedAt, deadline: at.deadline, questions: at.questionIds.map((id) => qs.find((q) => q.id === id)).filter(Boolean).map((q) => ({ id: q!.id, prompt: q!.prompt, options: q!.options })) })
        }
        const live = attempts.find((x) => x.status === 'in_progress')
        if (live) return show(live)
        const el = examEligibility(attempts.map((x) => x.startedAt), now)
        if (!el.allowed) return json({ error: el.reason === 'yearly_cap' ? 'You have used all three attempts for this year' : 'You can retake the assessment 14 days after your last attempt', nextAt: el.nextAt }, 429)
        const bank = await db.select().from(trainingQuestions).where(and(eq(trainingQuestions.moduleId, SPECIALISM_MODULE[s]), eq(trainingQuestions.forExam, true), eq(trainingQuestions.active, true)))
        if (!bank.length) return bad('The assessment bank is empty')
        const { drawn } = drawExamQuestions(bank, Math.random, SPECIALIST_EXAM.questions)
        const id = rid('spec')
        const [row] = await db.insert(trainingExamAttempts).values({
          id, email, assessment: s, startedAt: now, deadline: new Date(now.getTime() + SPECIALIST_EXAM.minutes * 60_000), questionIds: drawn.map((q) => q.id), total: drawn.length,
        }).returning()
        await audit(email, `started ${SPECIALISM_LABEL[s]} specialist assessment (${drawn.length} questions)`, id)
        return show(row)
      }
      if (m === 'POST' && b === 'attempt' && c && d === 'submit') {
        const g = await requireProfile()
        if (g.error) return g.error
        const [at] = await db.select().from(trainingExamAttempts).where(and(eq(trainingExamAttempts.id, c), eq(trainingExamAttempts.email, email)))
        if (!at || !(SPECIALISMS as readonly string[]).includes(at.assessment)) return notFound()
        if (at.status !== 'in_progress') return conflict(at.status === 'expired' ? 'Time ran out; this attempt was not accepted' : 'Already submitted')
        const p = z.object({ answers: z.record(z.string(), z.number().int()) }).safeParse(await readBody())
        if (!p.success) return bad('Invalid answers')
        const s = at.assessment as Specialism
        const qs = await db.select().from(trainingQuestions).where(inArray(trainingQuestions.id, at.questionIds))
        const r = scoreExam(qs.map((q) => ({ id: q.id, correctIndex: q.correctIndex })), p.data.answers)
        const passed = specialistPassed(r.score, r.total) && effectiveAccreditation(g.profile) === 'accredited'
        await db.transaction(async (tx) => {
          await tx.update(trainingExamAttempts).set({ status: 'submitted', submittedAt: now, answers: p.data.answers, score: r.score, passed }).where(eq(trainingExamAttempts.id, at.id))
          if (passed) await tx.insert(validatorSpecialisms).values({ email, specialism: s, grantedAt: now, grantedBy: 'training programme', attemptId: at.id }).onConflictDoNothing()
        })
        await audit(email, `submitted ${SPECIALISM_LABEL[s]} specialist assessment: ${r.score}/${r.total} ${passed ? 'passed; specialism granted' : 'not passed'}`, at.id, passed ? 'Accreditation' : 'Training')
        // The bank is small, so answers are shown only after a pass: a retake must not be a copying exercise.
        return json({ ...r, passed, review: passed ? qs.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options, yours: p.data.answers[q.id] ?? null, correctIndex: q.correctIndex, explanation: q.explanation })) : [] })
      }
      return notFound()
    }

    // ---------- exam (part 1) ----------
    if (a === 'exam') {
      await expireStaleAttempts(email, now)
      if (m === 'GET' && !b) {
        const attempts = await db.select().from(trainingExamAttempts).where(and(eq(trainingExamAttempts.email, email), eq(trainingExamAttempts.assessment, 'knowledge'))).orderBy(desc(trainingExamAttempts.startedAt))
        const el = examEligibility(attempts.map((x) => x.startedAt), now)
        const bank = (await db.select({ id: trainingQuestions.id, moduleId: trainingQuestions.moduleId }).from(trainingQuestions).where(and(eq(trainingQuestions.forExam, true), eq(trainingQuestions.active, true))))
          .filter((q) => !isSpecialistModuleId(q.moduleId ?? ''))
        return json({
          eligibility: { allowed: el.allowed, reason: el.reason ?? null, nextAt: el.nextAt ?? null, attemptsThisYear: el.attemptsThisYear },
          bankSize: bank.length, bankShort: bank.length < 40,
          attempts: attempts.map((x) => ({ id: x.id, startedAt: x.startedAt, status: x.status, score: x.score, total: x.total, passed: x.passed, note: x.note })),
        })
      }
      if (m === 'POST' && b === 'start' && !c) {
        const g = await requireProfile()
        if (g.error) return g.error
        const gate = await requireTraining()
        if (gate) return gate
        const attempts = await db.select().from(trainingExamAttempts).where(and(eq(trainingExamAttempts.email, email), eq(trainingExamAttempts.assessment, 'knowledge')))
        if (attempts.some((x) => x.passed)) return conflict('You have already passed the knowledge exam')
        const live = attempts.find((x) => x.status === 'in_progress')
        // Specialist banks (s1, s2) are for the specialist assessments only.
        const bankAll = (await db.select().from(trainingQuestions).where(and(eq(trainingQuestions.forExam, true), eq(trainingQuestions.active, true))))
          .filter((q) => !isSpecialistModuleId(q.moduleId ?? ''))
        const exam = async (at: typeof attempts[number]) => {
          const qs = at.questionIds.length ? await db.select().from(trainingQuestions).where(inArray(trainingQuestions.id, at.questionIds)) : []
          return json({ id: at.id, startedAt: at.startedAt, deadline: at.deadline, note: at.note, questions: at.questionIds.map((id) => qs.find((q) => q.id === id)).filter(Boolean).map((q) => ({ id: q!.id, prompt: q!.prompt, options: q!.options })) })
        }
        if (live) return exam(live)
        const el = examEligibility(attempts.map((x) => x.startedAt), now)
        if (!el.allowed) return json({ error: el.reason === 'yearly_cap' ? 'You have used all three exam attempts for this year' : 'You can retake the exam 14 days after your last attempt', nextAt: el.nextAt }, 429)
        if (!bankAll.length) return bad('The question bank is empty')
        const { drawn, short } = drawExamQuestions(bankAll)
        const id = rid('exam')
        const [row] = await db.insert(trainingExamAttempts).values({
          id, email, startedAt: now, deadline: examDeadline(now), questionIds: drawn.map((q) => q.id), total: drawn.length,
          note: short ? `The question bank has only ${bankAll.length} questions (fewer than 40), so all of them were drawn.` : null,
        }).returning()
        await audit(email, `started knowledge exam (${drawn.length} questions)`, id)
        return exam(row)
      }
      if (m === 'POST' && b && c === 'submit') {
        const g = await requireProfile()
        if (g.error) return g.error
        const [at] = await db.select().from(trainingExamAttempts).where(and(eq(trainingExamAttempts.id, b), eq(trainingExamAttempts.email, email), eq(trainingExamAttempts.assessment, 'knowledge')))
        if (!at) return notFound()
        if (at.status !== 'in_progress') return conflict(at.status === 'expired' ? 'Time ran out; this attempt was not accepted' : 'Already submitted')
        const p = z.object({ answers: z.record(z.string(), z.number().int()) }).safeParse(await readBody())
        if (!p.success) return bad('Invalid answers')
        const qs = await db.select().from(trainingQuestions).where(inArray(trainingQuestions.id, at.questionIds))
        const r = scoreExam(qs.map((q) => ({ id: q.id, correctIndex: q.correctIndex })), p.data.answers)
        await db.update(trainingExamAttempts).set({ status: 'submitted', submittedAt: now, answers: p.data.answers, score: r.score, passed: r.passed }).where(eq(trainingExamAttempts.id, at.id))
        await audit(email, `submitted knowledge exam: ${r.score}/${r.total} ${r.passed ? 'passed' : 'not passed'}`, at.id)
        if (r.passed) await maybeAccredit(email, now)
        return json({ ...r, review: qs.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options, yours: p.data.answers[q.id] ?? null, correctIndex: q.correctIndex, explanation: q.explanation })) })
      }
    }

    // ---------- scenario cases (part 2) ----------
    if (a === 'cases') {
      if (m === 'GET' && !b) {
        const cases = await db.select().from(trainingCases).where(eq(trainingCases.active, true)).orderBy(asc(trainingCases.position))
        const subs = await db.select().from(trainingSubmissions).where(and(eq(trainingSubmissions.email, email), eq(trainingSubmissions.kind, 'case')))
        const marks = subs.length ? await db.select().from(trainingMarks).where(inArray(trainingMarks.submissionId, subs.map((s) => s.id))) : []
        return json({
          minWords: CASES.minWords, maxWords: CASES.maxWords,
          cases: cases.map((cs) => {
            const mine = subs.filter((s) => s.contentId === cs.id).sort((x, y) => x.attempt - y.attempt)
            return {
              id: cs.id, title: cs.title, topic: cs.topic, prompt: cs.prompt,
              submissions: mine.map((s) => sanitizeSub(s, marks.filter((mk) => mk.submissionId === s.id))),
              canSubmit: canSubmitCase(mine.length, mine.some((s) => s.status === 'passed'), mine.some((s) => s.status === 'pending')),
            }
          }),
        })
      }
      if (m === 'POST' && b && c === 'submit') {
        const g = await requireProfile()
        if (g.error) return g.error
        const gate = await requireTraining()
        if (gate) return gate
        const [cs] = await db.select().from(trainingCases).where(and(eq(trainingCases.id, b), eq(trainingCases.active, true)))
        if (!cs) return notFound()
        const p = z.object({ text: z.string().max(10000) }).safeParse(await readBody())
        if (!p.success) return bad('Invalid submission')
        const words = wordCount(p.data.text)
        if (words < CASES.minWords || words > CASES.maxWords) return bad(`Write between ${CASES.minWords} and ${CASES.maxWords} words (about 300); yours is ${words}`)
        const mine = await db.select().from(trainingSubmissions).where(and(eq(trainingSubmissions.email, email), eq(trainingSubmissions.kind, 'case'), eq(trainingSubmissions.contentId, cs.id)))
        if (!canSubmitCase(mine.length, mine.some((s) => s.status === 'passed'), mine.some((s) => s.status === 'pending'))) return conflict('This case cannot be submitted now (one resubmission only, and not while marking is pending)')
        const id = rid('sub')
        await db.insert(trainingSubmissions).values({ id, email, kind: 'case', contentId: cs.id, attempt: mine.length + 1, body: { text: p.data.text, words } })
        await audit(email, `submitted scenario case ${cs.id} (attempt ${mine.length + 1})`, id)
        return json({ id }, 201)
      }
    }

    // ---------- capstone (part 3) ----------
    if (a === 'capstone') {
      if (m === 'GET' && !b) {
        const caps = await db.select().from(trainingCapstones).where(eq(trainingCapstones.active, true)).orderBy(asc(trainingCapstones.position))
        const subs = await db.select().from(trainingSubmissions).where(and(eq(trainingSubmissions.email, email), eq(trainingSubmissions.kind, 'capstone'))).orderBy(asc(trainingSubmissions.attempt))
        const marks = subs.length ? await db.select().from(trainingMarks).where(inArray(trainingMarks.submissionId, subs.map((s) => s.id))) : []
        const used = new Set(subs.map((s) => s.contentId))
        const canSubmit = subs.length < CAPSTONE.maxAttempts && !subs.some((s) => s.status === 'pending' || s.status === 'passed')
        // A retake uses a different sandbox case.
        const available = caps.filter((cp) => !used.has(cp.id))
        return json({
          indicators: LADDER_INDICATORS.filter((i) => i.level <= 4).map((i) => ({ id: i.id, level: i.level, domain: i.domain, question: i.question })),
          submissions: subs.map((s) => ({ ...sanitizeSub(s, marks.filter((mk) => mk.submissionId === s.id)), contentId: s.contentId })),
          canSubmit: canSubmit && available.length > 0, noCaseForRetake: canSubmit && available.length === 0,
          capstone: available[0] ? { id: available[0].id, title: available[0].title, brief: available[0].brief, evidence: available[0].evidence, rubric: available[0].rubric } : null,
        })
      }
      if (m === 'POST' && b && c === 'submit') {
        const g = await requireProfile()
        if (g.error) return g.error
        const gate = await requireTraining()
        if (gate) return gate
        const [cp] = await db.select().from(trainingCapstones).where(and(eq(trainingCapstones.id, b), eq(trainingCapstones.active, true)))
        if (!cp) return notFound()
        const parsed = capstoneBodySchema.safeParse(await readBody())
        if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Invalid capstone submission')
        const mine = await db.select().from(trainingSubmissions).where(and(eq(trainingSubmissions.email, email), eq(trainingSubmissions.kind, 'capstone')))
        if (mine.length >= CAPSTONE.maxAttempts || mine.some((s) => s.status === 'pending' || s.status === 'passed')) return conflict('The capstone cannot be submitted now')
        if (mine.some((s) => s.contentId === cp.id)) return conflict('A retake uses a different sandbox case')
        const id = rid('sub')
        await db.insert(trainingSubmissions).values({ id, email, kind: 'capstone', contentId: cp.id, attempt: mine.length + 1, body: parsed.data })
        await audit(email, `submitted capstone ${cp.id} (attempt ${mine.length + 1})`, id)
        return json({ id }, 201)
      }
    }

    // ---------- marking queue ----------
    if (a === 'marking') {
      if (!(await isMarker(email))) return forbidden()
      if (m === 'GET' && b === 'queue') {
        const pending = await db.select().from(trainingSubmissions).where(eq(trainingSubmissions.status, 'pending')).orderBy(asc(trainingSubmissions.submittedAt))
        const marks = pending.length ? await db.select().from(trainingMarks).where(inArray(trainingMarks.submissionId, pending.map((s) => s.id))) : []
        const cases = await db.select({ id: trainingCases.id, title: trainingCases.title }).from(trainingCases)
        const caps = await db.select({ id: trainingCapstones.id, title: trainingCapstones.title }).from(trainingCapstones)
        const names = pending.length ? await db.select({ email: validatorProfiles.email, name: validatorProfiles.name }).from(validatorProfiles).where(inArray(validatorProfiles.email, [...new Set(pending.map((s) => s.email))])) : []
        return json(pending.map((s) => {
          const mk = marks.filter((x) => x.submissionId === s.id)
          return {
            id: s.id, kind: s.kind, title: (s.kind === 'case' ? cases : caps).find((x) => x.id === s.contentId)?.title ?? s.contentId, attempt: s.attempt,
            learner: names.find((n) => n.email === s.email)?.name ?? s.email, own: s.email === email, markedByMe: mk.some((x) => x.marker === email),
            marksNeeded: s.kind === 'case' ? CASES.requiredMarkers : 1, marksReceived: mk.length, submittedAt: s.submittedAt,
          }
        }))
      }
      if (b && b !== 'queue') {
        const [s] = await db.select().from(trainingSubmissions).where(eq(trainingSubmissions.id, b))
        if (!s) return notFound()
        if (s.email === email) return json({ error: 'You cannot mark your own work' }, 403)
        const marks = await db.select().from(trainingMarks).where(eq(trainingMarks.submissionId, s.id))
        if (m === 'GET') {
          const [cs] = s.kind === 'case' ? await db.select().from(trainingCases).where(eq(trainingCases.id, s.contentId)) : []
          const [cp] = s.kind === 'capstone' ? await db.select().from(trainingCapstones).where(eq(trainingCapstones.id, s.contentId)) : []
          let accuracy: unknown = null
          if (cp) {
            const given = (s.body as any).scores as Record<string, { score: number }>
            const pairs = Object.entries(cp.referenceScores).filter(([k]) => given[k]).map(([k, ref]) => ({ ref, given: given[k].score }))
            accuracy = pairs.length ? calibrationScore(pairs) : null
          }
          return json({
            id: s.id, kind: s.kind, status: s.status, attempt: s.attempt, body: s.body,
            case: cs ? { title: cs.title, prompt: cs.prompt, modelAnswer: cs.modelAnswer } : null,
            capstone: cp ? { title: cp.title, brief: cp.brief, evidence: cp.evidence, rubric: cp.rubric, referenceScores: cp.referenceScores, modelAnswer: cp.modelAnswer, accuracy } : null,
            markedByMe: marks.some((x) => x.marker === email),
          })
        }
        if (m === 'POST') {
          if (s.status !== 'pending') return conflict('Already marked')
          if (marks.some((x) => x.marker === email)) return conflict('You have already marked this')
          const raw = await readBody()
          const comment = String((raw as any)?.comment ?? '').slice(0, 4000)
          let scores: Record<string, unknown>
          let status: 'pending' | 'passed' | 'failed' = 'pending'
          let percent: number | null = null
          if (s.kind === 'case') {
            const p = z.object({ percent: z.number().min(0).max(100) }).safeParse(raw)
            if (!p.success) return bad('A percentage from 0 to 100 is required')
            scores = { percent: p.data.percent }
            const r = caseResult([...marks.map((x) => Number((x.scores as any).percent)), p.data.percent])
            status = r.status
            percent = r.percent
          } else {
            const [cp] = await db.select().from(trainingCapstones).where(eq(trainingCapstones.id, s.contentId))
            const rubric = (cp?.rubric ?? []) as RubricCriterion[]
            const p = z.object({ criteria: z.record(z.string(), z.number().int().min(0).max(3)) }).safeParse(raw)
            if (!p.success) return bad('A score from 0 to 3 is required for every criterion')
            const r = capstoneResult(rubric, p.data.criteria)
            if (!r.valid) return bad('A score from 0 to 3 is required for every criterion')
            scores = { criteria: p.data.criteria }
            status = r.passed ? 'passed' : 'failed'
            percent = r.pct
          }
          try {
            await db.insert(trainingMarks).values({ submissionId: s.id, marker: email, scores, comment })
          } catch { return conflict('You have already marked this') }
          await db.update(trainingSubmissions).set({ status, resultPercent: percent === null ? null : String(percent) }).where(eq(trainingSubmissions.id, s.id))
          await audit(email, `marked ${s.kind} submission ${s.id}${status === 'pending' ? ' (awaiting second marker)' : `: ${status}`}`, s.id)
          if (status === 'passed') await maybeAccredit(s.email, now)
          return json({ ok: true, status, percent })
        }
      }
    }

    // ---------- annual renewal ----------
    if (a === 'renewal') {
      const g = await requireProfile()
      if (g.error) return g.error
      const profile = g.profile!
      if (m === 'GET' && !b) {
        if (!profile.accreditedUntil) return bad('Renewal applies once you are accredited')
        return json({ until: profile.accreditedUntil, ...(await renewalState(email, profile.accreditedUntil, now)) })
      }
      if (m === 'POST' && b === 'cpd') {
        const p = z.object({ hours: z.number().min(0.5).max(24), activity: z.string().trim().min(2).max(300), occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), notes: z.string().max(1000).optional() }).safeParse(await readBody())
        if (!p.success || Number.isNaN(Date.parse(p.data.occurredOn)) || Date.parse(p.data.occurredOn) > now.getTime() + 86_400_000) return bad('Hours, an activity and a past date are required')
        const [row] = await db.insert(trainingCpd).values({ email, hours: String(p.data.hours), activity: p.data.activity, occurredOn: p.data.occurredOn, notes: p.data.notes ?? '' }).returning({ id: trainingCpd.id })
        await audit(email, `logged ${p.data.hours} CPD hours`, String(row.id))
        return json({ id: row.id }, 201)
      }
      if (m === 'DELETE' && b === 'cpd' && c) {
        const gone = await db.delete(trainingCpd).where(and(eq(trainingCpd.id, Number(c) || -1), eq(trainingCpd.email, email))).returning({ id: trainingCpd.id })
        return gone.length ? json({ ok: true }) : notFound()
      }
      if (m === 'POST' && b === 'declaration') {
        const p = z.object({ confirm: z.literal(true), clients: z.string().trim().min(2).max(4000) }).safeParse(await readBody())
        if (!p.success) return bad('Confirm the declaration and list your current clients (write "None" if there are none)')
        await db.insert(trainingDeclarations).values({ email, clients: p.data.clients })
        await audit(email, 'signed the annual independence declaration', profile.id)
        return json({ ok: true }, 201)
      }
      if (m === 'POST' && b === 'drill') {
        const p = z.object({ answers: z.record(z.string(), z.number().int().min(0).max(5)) }).safeParse(await readBody())
        if (!p.success) return bad('Invalid scores')
        const r = await gradeDrill(email, p.data.answers, 'renewal', now)
        return 'error' in r ? bad(String(r.error)) : json(r)
      }
      if (m === 'POST' && b === 'complete') {
        if (!profile.accreditedUntil) return bad('Renewal applies once you are accredited')
        const st = await renewalState(email, profile.accreditedUntil, now)
        if (!st.open) return json({ error: 'Renewal opens 60 days before your accreditation expires', opensAt: st.opensAt }, 409)
        if (!st.ready) return json({ error: 'Some renewal items are incomplete', items: st.items }, 409)
        const until = renewedUntil(profile.accreditedUntil, now)
        const updated = await db.update(validatorProfiles).set({ accreditedUntil: until, accreditationChangedBy: 'training programme', accreditationChangedAt: now, updatedAt: now })
          .where(and(eq(validatorProfiles.id, profile.id), sql`date_trunc('milliseconds', ${validatorProfiles.accreditedUntil}) = ${profile.accreditedUntil.toISOString()}::timestamptz`, ne(validatorProfiles.accreditationStatus, 'suspended'))).returning({ id: validatorProfiles.id })
        if (!updated.length) return conflict('Renewal could not be applied; reload and try again')
        await audit(email, `accreditation renewed until ${until.toISOString().slice(0, 10)}`, profile.id, 'Accreditation')
        return json({ ok: true, until })
      }
    }

    // ---------- firm team (owner) ----------
    if (m === 'GET' && a === 'firm' && b && c === 'team') {
      const [own] = await db.select({ role: firmMembers.role }).from(firmMembers).innerJoin(firms, eq(firms.id, firmMembers.firmId))
        .where(and(eq(firmMembers.firmId, b), eq(firmMembers.email, email), eq(firmMembers.status, 'active'), eq(firms.kind, 'validator_firm')))
      if (own?.role !== 'owner') return forbidden()
      const members = await db.select().from(firmMembers).where(and(eq(firmMembers.firmId, b), eq(firmMembers.status, 'active')))
      const profiles = members.length ? await db.select().from(validatorProfiles).where(inArray(validatorProfiles.email, members.map((x) => x.email))) : []
      const team = []
      for (const mem of members) {
        const p = profiles.find((x) => x.email === mem.email)
        if (!p) { team.push({ email: mem.email, name: null, state: 'no profile', accreditedUntil: null, lapsed: false, renewal: null }); continue }
        const state = accreditationState(p, now)
        const renewal = p.accreditedUntil ? await renewalState(mem.email, p.accreditedUntil, now) : null
        team.push({
          email: mem.email, name: p.name, state, accreditedUntil: p.accreditedUntil, lapsed: state === 'lapsed',
          renewal: renewal ? { done: renewal.items.filter((i) => i.done).length, total: renewal.items.length, opensAt: renewal.opensAt } : null,
        })
      }
      return json({ lapsed: team.filter((x) => x.lapsed).length, team })
    }

    // ---------- content management (programme team) ----------
    if (a === 'manage') {
      if (b === 'staff') {
        if (!isSuperAdmin(email)) return forbidden()
        if (m === 'GET') return json(await db.select().from(trainingStaff).orderBy(asc(trainingStaff.email)))
        const target = (c ?? '').trim().toLowerCase()
        if (!target.includes('@')) return bad('An email is required')
        if (m === 'PUT') {
          const p = z.object({ role: z.enum(['programme_team', 'lead_validator']) }).safeParse(await readBody())
          if (!p.success) return bad('Invalid role')
          await db.insert(trainingStaff).values({ email: target, role: p.data.role, addedBy: email }).onConflictDoUpdate({ target: trainingStaff.email, set: { role: p.data.role, addedBy: email } })
          await audit(email, `set ${target} as ${p.data.role}`, target, 'Accreditation')
          return json({ ok: true })
        }
        if (m === 'DELETE') {
          await db.delete(trainingStaff).where(eq(trainingStaff.email, target))
          await audit(email, `removed ${target} from the programme team`, target, 'Accreditation')
          return json({ ok: true })
        }
      }
      if (!(await isProgrammeTeam(email))) return forbidden()
      if (m === 'GET' && b === 'content') {
        const [modules, questions, cases, capstones, calibration, badges] = await Promise.all([
          db.select().from(trainingModules).orderBy(asc(trainingModules.position)), db.select().from(trainingQuestions).orderBy(asc(trainingQuestions.id)),
          db.select().from(trainingCases).orderBy(asc(trainingCases.position)), db.select().from(trainingCapstones).orderBy(asc(trainingCapstones.position)),
          db.select().from(trainingCalibrationItems).orderBy(asc(trainingCalibrationItems.id)), db.select().from(trainingBadges).orderBy(asc(trainingBadges.position)),
        ])
        return json({ modules, questions, cases, capstones, calibration, badges })
      }
      const body = m === 'PUT' || m === 'POST' ? await readBody() : null
      const stamp = { updatedBy: email, updatedAt: now }
      if (m === 'PUT' && b === 'modules' && c) {
        const p = moduleSchema.safeParse(body)
        if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid module')
        const [cur] = await db.select().from(trainingModules).where(eq(trainingModules.id, c))
        if (!cur) return notFound()
        const yt = p.data.youtubeUrl?.trim() || null
        if (yt && !youtubeEmbedId(yt)) return bad('The video link must be a YouTube link (youtube.com/watch, youtu.be or /embed)')
        const bump = p.data.script !== cur.script || yt !== cur.youtubeUrl
        await db.update(trainingModules).set({ ...p.data, youtubeUrl: yt, exercises: p.data.exercises as TrainingExercise[], revision: bump ? cur.revision + 1 : cur.revision, ...stamp }).where(eq(trainingModules.id, c))
        await audit(email, `edited training module ${c}${bump ? ` (revision ${cur.revision + 1}: learners must re-watch at renewal)` : ''}`, c)
        return json({ ok: true, revision: bump ? cur.revision + 1 : cur.revision })
      }
      if ((m === 'POST' && b === 'questions') || (m === 'PUT' && b === 'questions' && c)) {
        const p = questionSchema.safeParse(body)
        if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid question')
        const id = m === 'POST' ? rid('q') : c!
        if (m === 'PUT' && !(await db.select({ id: trainingQuestions.id }).from(trainingQuestions).where(eq(trainingQuestions.id, id))).length) return notFound()
        await db.insert(trainingQuestions).values({ id, ...p.data, moduleId: p.data.moduleId ?? null, ...stamp }).onConflictDoUpdate({ target: trainingQuestions.id, set: { ...p.data, moduleId: p.data.moduleId ?? null, ...stamp } })
        await audit(email, `${m === 'POST' ? 'added' : 'edited'} training question`, id)
        return json({ id }, m === 'POST' ? 201 : 200)
      }
      if ((m === 'POST' && b === 'cases') || (m === 'PUT' && b === 'cases' && c)) {
        const p = caseSchema.safeParse(body)
        if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid case')
        const id = m === 'POST' ? rid('case') : c!
        const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(trainingCases)
        if (m === 'PUT' && !(await db.select({ id: trainingCases.id }).from(trainingCases).where(eq(trainingCases.id, id))).length) return notFound()
        const vals = { ...p.data, position: p.data.position ?? n + 1, ...stamp }
        await db.insert(trainingCases).values({ id, ...vals }).onConflictDoUpdate({ target: trainingCases.id, set: vals })
        await audit(email, `${m === 'POST' ? 'added' : 'edited'} scenario case`, id)
        return json({ id }, m === 'POST' ? 201 : 200)
      }
      if ((m === 'POST' && b === 'capstones') || (m === 'PUT' && b === 'capstones' && c)) {
        const p = capstoneSchema.safeParse(body)
        if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid capstone')
        const id = m === 'POST' ? rid('cap') : c!
        const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(trainingCapstones)
        if (m === 'PUT' && !(await db.select({ id: trainingCapstones.id }).from(trainingCapstones).where(eq(trainingCapstones.id, id))).length) return notFound()
        const vals = { ...p.data, position: p.data.position ?? n + 1, ...stamp }
        await db.insert(trainingCapstones).values({ id, ...vals }).onConflictDoUpdate({ target: trainingCapstones.id, set: vals })
        await audit(email, `${m === 'POST' ? 'added' : 'edited'} capstone case`, id)
        return json({ id }, m === 'POST' ? 201 : 200)
      }
      if ((m === 'POST' && b === 'calibration') || (m === 'PUT' && b === 'calibration' && c)) {
        const p = calibrationSchema.safeParse(body)
        if (!p.success) return bad(p.error.issues[0]?.message ?? 'Invalid item')
        const id = m === 'POST' ? rid('cal') : c!
        if (m === 'PUT' && !(await db.select({ id: trainingCalibrationItems.id }).from(trainingCalibrationItems).where(eq(trainingCalibrationItems.id, id))).length) return notFound()
        await db.insert(trainingCalibrationItems).values({ id, ...p.data }).onConflictDoUpdate({ target: trainingCalibrationItems.id, set: p.data })
        await audit(email, `${m === 'POST' ? 'added' : 'edited'} calibration item`, id)
        return json({ id }, m === 'POST' ? 201 : 200)
      }
      if (m === 'PUT' && b === 'badges' && c) {
        const p = badgeSchema.safeParse(body)
        if (!p.success) return bad('Invalid badge')
        const updated = await db.update(trainingBadges).set(p.data).where(eq(trainingBadges.key, c)).returning({ key: trainingBadges.key })
        if (!updated.length) return notFound()
        await audit(email, 'edited badge text', c)
        return json({ ok: true })
      }
    }

    return notFound()
  } catch (err) {
    logger.error('/api/training', 'failed', err)
    return json({ error: 'Training request failed' }, 500)
  }
}

// Scores a calibration drill server-side: the learner scores indicators from the pool and is
// compared with the programme team's reference scores (revealed only after submission).
async function gradeDrill(email: string, answers: Record<string, number>, purpose: 'module' | 'renewal', now: Date) {
  const ids = Object.keys(answers)
  const pool = await db.select().from(trainingCalibrationItems).where(and(eq(trainingCalibrationItems.active, true)))
  const need = Math.min(DRILL.size, pool.length)
  const items = pool.filter((i) => ids.includes(i.id))
  if (items.length !== ids.length || items.length < need) return { error: `Score ${need} different indicators` }
  const r = calibrationScore(items.map((i) => ({ ref: i.referenceScore, given: answers[i.id] })))
  await db.insert(trainingDrills).values({ email, purpose, within: r.within, total: r.total, pct: r.pct, takenAt: now })
  await recordActivity(email, now)
  return { ...r, passed: r.pct >= DRILL.passPct, items: items.map((i) => ({ id: i.id, statement: i.statement, yours: answers[i.id], reference: i.referenceScore, within: Math.abs(i.referenceScore - answers[i.id]) <= DRILL.withinPoints })) }
}

export const config: Config = { path: ['/api/training', '/api/training/*'] }

export default monitored(handleRequest)
