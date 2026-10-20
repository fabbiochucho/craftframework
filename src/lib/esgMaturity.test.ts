// Self-check: `node src/lib/esgMaturity.test.ts`
import assert from 'node:assert/strict'
import { ESG_STAGES, esgMaturity } from './esgMaturity.ts'
import { ESG_DOCS, docKey, ESG_QUESTIONS } from './esg.ts'

const all = (v: number) => Object.fromEntries(ESG_STAGES.flatMap((s) => s.criteria).map((id) => [id, v]))
const fullEvidence = Object.fromEntries((['Environmental', 'Social', 'Governance'] as const).flatMap((p) => ESG_DOCS[p].map((d) => [docKey(p, d), 3])))
assert.equal(ESG_STAGES.map((s) => s.name).join('|'), 'Foundations|Efficiency|Resilience|Integrated value|Systemic leadership')
for (const s of ESG_STAGES) for (const id of s.criteria) assert.ok(ESG_QUESTIONS.some((q) => q.id === id), `criterion ${id} exists`)

// Nothing answered
const none = esgMaturity({}, {})
assert.equal(none.stage, 0); assert.equal(none.next!.n, 1); assert.equal(none.unanswered, 24); assert.equal(none.provisional, false)
// Everything at 3 with evidence: stage 5 confirmed, not provisional
const top = esgMaturity(all(3), fullEvidence)
assert.equal(top.stage, 5); assert.equal(top.confirmed, true); assert.equal(top.provisional, false); assert.equal(top.next, null); assert.deepEqual(top.missing, [])
// Review Focus 2: no evidence means stages 3+ are self-reported
assert.equal(esgMaturity(all(4), {}).confirmed, false)
// No skipping: an answered gap at stage 2 caps at stage 1 even when later stages are met
const capped = esgMaturity({ ...all(4), 'ESG-E5': 1 }, fullEvidence)
assert.equal(capped.stage, 1); assert.equal(capped.next!.n, 2)
assert.deepEqual(capped.missing.map((q) => q.id), ['ESG-E5'])
// Stages 1-2 need no evidence to be confirmed
assert.equal(esgMaturity({ ...all(3), 'ESG-E4': 0 }, {}).confirmed, true)
// Owner amendment: answers saved before the new questions give a provisional stage, not a drop
const legacy = Object.fromEntries(['ESG-E1', 'ESG-E2', 'ESG-E3', 'ESG-E4', 'ESG-S1', 'ESG-S2', 'ESG-S3', 'ESG-S4', 'ESG-G1', 'ESG-G2', 'ESG-G3', 'ESG-G4'].map((id) => [id, 4]))
const l = esgMaturity(legacy, fullEvidence)
assert.equal(l.stage, 4, 'stage 5 has no answers yet, so it is not reached')
assert.equal(l.provisional, true)
assert.equal(l.toConfirm, 9, 'G5, E5, N1, N2, G6, N3 and net-zero Z1, Z2, Z4 unanswered up to stage 4')
assert.equal(l.unanswered, 12)
assert.ok(l.missing.some((q) => q.id === 'ESG-G5'))
// A stage with no answers at all is not reached
assert.equal(esgMaturity({ 'ESG-E3': 4 }, {}).stage, 1)
assert.equal(esgMaturity({ 'ESG-E1': 4 }, {}).stage, 0, 'stage 2 answers without any stage 1 answer do not count')
assert.ok(!/\b(compliant|certified)\b/i.test(JSON.stringify(ESG_STAGES)))
import { stageLabel } from './esgMaturity.ts'
assert.equal(stageLabel(none), 'Not yet at Foundations')
assert.equal(stageLabel(top), 'Stage 5: Systemic leadership')
assert.equal(stageLabel(l), 'Stage 4: Integrated value (provisional — answer 9 remaining questions to confirm)')
assert.equal(stageLabel(esgMaturity(all(4), {})), 'Stage 5: Systemic leadership (self-reported — add evidence to confirm)')
// Minor fixes: the new-questions notice is for organisations that answered the original assessment
import { NEW_ESG_IDS, shouldShowNewQuestionsNotice } from './esgMaturity.ts'
assert.equal(NEW_ESG_IDS.length, 12, 'eight maturity questions and four net-zero questions')
assert.equal(shouldShowNewQuestionsNotice({}), false)
assert.equal(shouldShowNewQuestionsNotice({ 'ESG-N1': 3 }), false, 'a new user who only answered a new question')
assert.equal(shouldShowNewQuestionsNotice({ 'ESG-E1': 3 }), true, 'answered an original question, new ones pending')
assert.equal(shouldShowNewQuestionsNotice({ 'ESG-E1': 3, ...Object.fromEntries(NEW_ESG_IDS.map((id) => [id, 3])) }), false, 'all new questions answered')
console.log('esgMaturity: ok')
