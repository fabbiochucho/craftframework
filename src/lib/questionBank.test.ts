// Self-check: `node src/lib/questionBank.test.ts` — the question bank text is private; the public code holds only
// each question's structure plus a demo sample, and signed-in users load the full bank from the server.
import assert from 'node:assert/strict'
import { QUESTION_INDEX, DEMO_SAMPLE_IDS } from './questionIndex.ts'
import * as data from './data.ts'

const allLenses = { climate: true, emergency: true, research: true }
const sample = new Set(DEMO_SAMPLE_IDS)

// The public index: every question's structure, text only for the sample
assert.equal(QUESTION_INDEX.length, 519)
for (const q of QUESTION_INDEX) assert.equal(!!q.question, sample.has(q.id), `${q.id}: text only in the demo sample`)
assert.ok(!QUESTION_INDEX.some((q) => !sample.has(q.id) && (q.insight || q.capacityAction || q.scoringGuide)))

// Before the full bank loads (the demo): counts and scoring see every question, the wizard and findings only the sample
assert.equal(data.MOCK_QUESTIONS.length, 519)
assert.deepEqual(['climate', 'emergency', 'research'].map((l) => data.lensQuestionCount(l as data.LensId)), [51, 20, 16], 'lens counts as before')
assert.ok(data.activeQuestions(allLenses).every((q) => sample.has(q.id)), 'the demo wizard shows only sample questions')
assert.ok(data.activeQuestions(allLenses).length > 0)
const allScores = Object.fromEntries(QUESTION_INDEX.map((q) => [q.id, 1]))
assert.ok(data.deriveFindings(allScores).every((f) => sample.has(f.qId) && f.question), 'findings never show blank questions')

// Signed in: the server's full bank replaces it (rows with an empty archetype list mean "every archetype")
const full = QUESTION_INDEX.map((q) => ({ question: `Q ${q.id}?`, insight: 'i', evidence: ['e'], verificationMethod: 'v', capacityAction: 'a', donorLink: 'd', nationalLink: 'n', ...q, archetypes: q.archetypes ?? [] }))
data.setQuestionBank(full as data.Question[])
assert.equal(data.MOCK_QUESTIONS.length, 519)
assert.equal(data.activeQuestions(allLenses).filter((q) => data.archetypeMatch(q, 'Public')).length,
  QUESTION_INDEX.filter((q) => !q.archetypes || q.archetypes.includes('Public')).length, 'universal questions stay visible')
assert.ok(data.deriveFindings(allScores).some((f) => !sample.has(f.qId)), 'findings cover the full bank once loaded')
assert.equal(data.MOCK_QUESTIONS.find((q) => q.id === 'GOV-02')!.archetypes, undefined)

console.log('questionBank: ok')
