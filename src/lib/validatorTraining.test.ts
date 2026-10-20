// Self-check — run directly with `node src/lib/validatorTraining.test.ts`.
import assert from 'node:assert/strict'
import {
  accreditationState, accreditedUntilOnPass, addYears, allPartsPassed, calibrationScore, canSubmitCase, capstoneResult, caseResult,
  checkPassed, drawExamQuestions, earnedBadges, examDeadline, examEligibility, examOnTime, examPassMark, exemptBody, renewalChecklist,
  renewalOpensAt, renewalWindowStart, renewedUntil, scoreExam, streakDays, wordCount, youtubeEmbedId, type RubricCriterion,
} from './validatorTraining.ts'
import { OPEN_TRAINING_CONTENT as C } from './trainingContent.ts'
const { badges: SEED_BADGES, calibration: SEED_CALIBRATION, modules: SEED_MODULES, questions: SEED_QUESTIONS } = C
const SEED_RUBRIC = C.rubric as RubricCriterion[]

const day = (s: string) => new Date(`${s}T12:00:00Z`)

// --- exam scoring and pass mark: 80% (32/40) --------------------------------------
assert.equal(examPassMark(40), 32)
assert.equal(examPassMark(20), 16)
assert.equal(examPassMark(33), 27, '80% of 33 is 26.4, so 27 are needed')
const drawn40 = Array.from({ length: 40 }, (_, i) => ({ id: `q${i}`, correctIndex: 1 }))
const answers = (right: number) => Object.fromEntries(drawn40.map((q, i) => [q.id, i < right ? 1 : 0]))
assert.deepEqual(scoreExam(drawn40, answers(32)), { score: 32, total: 40, passMark: 32, pct: 80, passed: true })
assert.equal(scoreExam(drawn40, answers(31)).passed, false)
assert.equal(scoreExam(drawn40, {}).score, 0, 'unanswered counts as wrong')
assert.equal(scoreExam([], {}).passed, false, 'an empty exam never passes')
// Timer: 60 minutes plus a short grace.
const t0 = new Date('2026-10-16T10:00:00Z')
assert.equal(examDeadline(t0).toISOString(), '2026-10-16T11:00:00.000Z')
assert.ok(examOnTime(t0, new Date('2026-10-16T10:59:59Z')))
assert.ok(examOnTime(t0, new Date('2026-10-16T11:00:30Z')), 'grace')
assert.ok(!examOnTime(t0, new Date('2026-10-16T11:02:00Z')))
// Random draw: 40 distinct from a big bank; everything when the bank is short.
const bank = Array.from({ length: 120 }, (_, i) => i)
const big = drawExamQuestions(bank)
assert.equal(big.drawn.length, 40); assert.equal(new Set(big.drawn).size, 40); assert.equal(big.short, false)
assert.notDeepEqual(big.drawn, drawExamQuestions(bank).drawn, 'two exams differ')
const small = drawExamQuestions([1, 2, 3])
assert.deepEqual([...small.drawn].sort(), [1, 2, 3]); assert.equal(small.short, true)
assert.equal(drawExamQuestions(SEED_QUESTIONS.filter((q) => q.forExam)).short, true, 'the starter bank is below 40')

// --- retake window (14 days) and yearly cap (3 attempts) -----------------------------
const now = day('2026-10-16')
assert.equal(examEligibility([], now).allowed, true)
const e1 = examEligibility([day('2026-10-10')], now)
assert.deepEqual([e1.allowed, e1.reason, e1.nextAt?.toISOString().slice(0, 10)], [false, 'retake_window', '2026-10-24'])
assert.equal(examEligibility([day('2026-10-02')], now).allowed, true, 'exactly 14 days later is allowed')
assert.equal(examEligibility([day('2026-10-03')], now).allowed, false)
const three = [day('2026-03-01'), day('2026-05-01'), day('2026-08-01')]
const e3 = examEligibility(three, now)
assert.deepEqual([e3.allowed, e3.reason, e3.nextAt?.toISOString().slice(0, 10)], [false, 'yearly_cap', '2027-03-01'])
assert.equal(e3.attemptsThisYear, 3)
assert.equal(examEligibility(three, day('2027-03-02')).allowed, true, 'the oldest attempt rolls off after a year')
assert.equal(examEligibility([day('2025-08-01'), day('2026-03-01'), day('2026-08-01')], now).allowed, true, 'attempts older than a year do not count')

// --- scenario cases: two markers, 70% each, one resubmission ---------------------------
assert.deepEqual(caseResult([80]), { status: 'pending', percent: null })
assert.deepEqual(caseResult([70, 70]), { status: 'passed', percent: 70 })
assert.deepEqual(caseResult([65, 74]), { status: 'failed', percent: 69.5 })
assert.equal(caseResult([90, 50]).status, 'passed', 'the mean of 90 and 50 is 70')
assert.equal(canSubmitCase(0, false, false), true)
assert.equal(canSubmitCase(1, false, false), true, 'one resubmission')
assert.equal(canSubmitCase(2, false, false), false)
assert.equal(canSubmitCase(1, false, true), false, 'not while marking is pending')
assert.equal(canSubmitCase(1, true, false), false, 'already passed')
assert.equal(wordCount('  one two\nthree  '), 3)
assert.equal(wordCount(''), 0)

// --- capstone: 70% overall AND Meets on Outcome and Independence ------------------------
const rubric: RubricCriterion[] = SEED_RUBRIC
const all = (n: number) => Object.fromEntries(rubric.map((c) => [c.key, n]))
assert.equal(rubric.length, 6)
// 70% of 18 means 13 or more; Meets (2) on every criterion is only 12/18.
const meets = capstoneResult(rubric, all(2))
assert.deepEqual([meets.total, meets.max, meets.overallPass, meets.passed], [12, 18, false, false])
const good = { ...all(2), scoring: 3 } // 13/18 = 72%
assert.deepEqual([capstoneResult(rubric, good).total, capstoneResult(rubric, good).passed], [13, true])
assert.equal(capstoneResult(rubric, all(3)).passed, true)
// A high total cannot hide a failed must-meet criterion (Independence or Outcome).
const noOutcome = { ...all(3), outcome: 1 }
const r1 = capstoneResult(rubric, noOutcome)
assert.deepEqual([r1.overallPass, r1.failedMustMeet, r1.passed], [true, ['outcome'], false])
assert.deepEqual(capstoneResult(rubric, { ...all(3), independence: 0 }).failedMustMeet, ['independence'])
assert.equal(capstoneResult(rubric, { ...all(3), outcome: 2, independence: 2 }).passed, true, 'Meets is enough on the must-meet criteria')
// Non-must-meet criteria may be weak if the total passes.
assert.equal(capstoneResult(rubric, { ...all(3), followup: 0 }).passed, true, '15/18 passes despite one Missing')
assert.equal(capstoneResult(rubric, { ...all(3), scoring: 0, evidence: 0, followup: 0 }).passed, false, '9/18 fails overall')
// Missing or out-of-range criterion scores are invalid and never pass.
assert.equal(capstoneResult(rubric, { independence: 3 }).valid, false)
assert.equal(capstoneResult(rubric, { ...all(3), outcome: 4 }).passed, false)
assert.equal(capstoneResult(rubric, { ...all(3), outcome: 2.5 }).passed, false)

// All three parts are required; a great score in one cannot cover a fail in another.
assert.equal(allPartsPassed({ exam: true, cases: [true, true, true, true], capstone: true }), true)
assert.equal(allPartsPassed({ exam: false, cases: [true, true, true, true], capstone: true }), false)
assert.equal(allPartsPassed({ exam: true, cases: [true, true, true, false], capstone: true }), false)
assert.equal(allPartsPassed({ exam: true, cases: [true, true, true, true], capstone: false }), false)
assert.equal(allPartsPassed({ exam: true, cases: [], capstone: true }), false)

// --- accreditation clock ------------------------------------------------------------------
assert.equal(accreditedUntilOnPass(new Date('2026-10-16T12:00:00Z')).toISOString(), '2027-10-16T12:00:00.000Z', 'now + 1 year')
assert.equal(addYears(new Date('2024-02-29T00:00:00Z')).toISOString().slice(0, 10), '2025-03-01', 'leap day rolls over, never shortens')
// Renewal extends the current expiry by a year, so renewing early loses nothing.
assert.equal(renewedUntil(new Date('2026-12-01T00:00:00Z'), now).toISOString(), '2027-12-01T00:00:00.000Z')
// A lapsed accreditation restarts from today.
assert.equal(renewedUntil(new Date('2026-09-01T00:00:00Z'), now).toISOString(), '2027-10-16T12:00:00.000Z')
assert.equal(renewedUntil(null, now).toISOString(), '2027-10-16T12:00:00.000Z')
assert.equal(renewalWindowStart(new Date('2027-10-16T12:00:00Z')).toISOString(), '2026-10-16T12:00:00.000Z')
assert.equal(renewalOpensAt(new Date('2027-10-16T12:00:00Z')).toISOString().slice(0, 10), '2027-08-17')
// Lapsed after expiry; suspension wins; a bare status is not accreditation.
const until = new Date('2027-10-16T12:00:00Z')
assert.equal(accreditationState({ accreditationStatus: 'accredited', accreditedUntil: until }, now), 'accredited')
assert.equal(accreditationState({ accreditationStatus: 'accredited', accreditedUntil: until }, new Date('2027-10-16T12:00:00Z')), 'lapsed', 'lapsed at the moment of expiry')
assert.equal(accreditationState({ accreditationStatus: 'accredited', accreditedUntil: until }, new Date('2028-01-01T00:00:00Z')), 'lapsed')
assert.equal(accreditationState({ accreditationStatus: 'accredited', accreditedUntil: null }, now), 'registered')
assert.equal(accreditationState({ accreditationStatus: 'suspended', accreditedUntil: until }, now), 'suspended')
assert.equal(accreditationState({ accreditationStatus: 'registered', accreditedUntil: until.toISOString() }, now), 'accredited', 'ISO strings work')

// --- renewal checklist -------------------------------------------------------------------------
const videos = [{ moduleId: 'm1', title: 'One', done: true }, { moduleId: 'm2', title: 'Two', done: false }]
const base = { videos, cpdHours: 8, drillPct: 80, declared: true }
const partial = renewalChecklist(base)
assert.equal(partial.ready, false); assert.deepEqual(partial.videosLeft, ['m2'])
assert.equal(renewalChecklist({ ...base, videos: videos.map((v) => ({ ...v, done: true })) }).ready, true)
for (const [name, patch] of Object.entries({ cpd: { cpdHours: 7.5 }, drill: { drillPct: 79 }, nodrill: { drillPct: null }, decl: { declared: false } })) {
  assert.equal(renewalChecklist({ ...base, videos: videos.map((v) => ({ ...v, done: true })), ...patch }).ready, false, name)
}

// --- calibration, check, streaks, exemption, YouTube -----------------------------------------------
assert.deepEqual(calibrationScore([{ ref: 3, given: 4 }, { ref: 3, given: 5 }, { ref: 0, given: 0 }, { ref: 5, given: 3 }]), { within: 2, total: 4, pct: 50 })
assert.equal(calibrationScore([]).pct, 0)
assert.equal(checkPassed(4, 5), true); assert.equal(checkPassed(3, 5), false); assert.equal(checkPassed(0, 0), false)
assert.equal(streakDays(['2026-10-16', '2026-10-15', '2026-10-14', '2026-10-10'], now), 3)
assert.equal(streakDays(['2026-10-15', '2026-10-14'], now), 2, 'yesterday still counts')
assert.equal(streakDays(['2026-10-13'], now), 0)
assert.equal(exemptBody(['Certified Internal Auditor (CIA)']), 'CIA'); assert.equal(exemptBody(['icaN']), 'ICAN')
assert.equal(exemptBody(['ACCA', 'ICAN']), 'ACCA'); assert.equal(exemptBody(['PMP', 'CPA Kenya']), null)
assert.equal(exemptBody(['Associate of Social Sciences']), null, 'no substring matches')
assert.equal(youtubeEmbedId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
assert.equal(youtubeEmbedId('https://youtu.be/dQw4w9WgXcQ?si=abc'), 'dQw4w9WgXcQ')
assert.equal(youtubeEmbedId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
assert.equal(youtubeEmbedId('http://youtube.com/watch?v=dQw4w9WgXcQ'), null, 'https only')
assert.equal(youtubeEmbedId('https://evil.example/watch?v=dQw4w9WgXcQ'), null)
assert.equal(youtubeEmbedId('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ'), null)
assert.equal(youtubeEmbedId('https://youtube.com/watch?v="><script>'), null)
assert.equal(youtubeEmbedId(null), null)

// --- badges reward learning and accuracy only -----------------------------------------------------------
const none = { completedModules: [], rungChallengeDone: false, evidenceSortPerfect: false, conflictSpotterPerfect: false, bestCalibrationPct: null, capstonePassed: false, capstoneScores: null }
assert.deepEqual(earnedBadges(none), [])
assert.deepEqual(earnedBadges({ ...none, completedModules: ['m1', 'm2'], rungChallengeDone: true }), ['ladder-climber'])
assert.deepEqual(earnedBadges({ ...none, completedModules: ['m1'], rungChallengeDone: true }), [])
assert.deepEqual(earnedBadges({ ...none, conflictSpotterPerfect: true }), ['clear-conscience'])
assert.deepEqual(earnedBadges({ ...none, bestCalibrationPct: 90 }), ['calibrated'])
assert.deepEqual(earnedBadges({ ...none, bestCalibrationPct: 89 }), [])
assert.deepEqual(earnedBadges({ ...none, capstonePassed: true, capstoneScores: { outcome: 3, evidence: 2 } }), ['riverbend-solved'])
assert.deepEqual(earnedBadges({ ...none, capstonePassed: true, capstoneScores: { outcome: 2, evidence: 2 } }), [])
assert.deepEqual(earnedBadges({ ...none, evidenceSortPerfect: true, capstonePassed: true, capstoneScores: { outcome: 2, evidence: 2 } }), ['evidence-hawk'])

// --- seed content is consistent with the spec ---------------------------------------------------------------
assert.equal(SEED_MODULES.length, 8)
assert.equal(SEED_BADGES.length, 5, 'Mentor is deferred')
assert.ok(!SEED_BADGES.some((b) => /mentor|volume|speed|fee/i.test(b.key)))
assert.equal(SEED_QUESTIONS.filter((q) => q.forExam).length, 20, 'the 20 starter questions feed the exam')
for (const md of SEED_MODULES) assert.equal(SEED_QUESTIONS.filter((q) => q.moduleId === md.id && q.forCheck).length, 5, `${md.id} has five check questions`)
// Answer checks (valid correct options, a best scenario choice) run in craft-internal, where the answer key lives.
assert.ok(SEED_CALIBRATION.length >= 20, 'enough items that renewal drills draw fresh ones')
console.log('validatorTraining.test.ts: all assertions passed')
