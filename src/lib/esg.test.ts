// Self-check: `node src/lib/esg.test.ts`
import assert from 'node:assert/strict'
import { ESG_QUESTIONS } from './esg.ts'

const NEW = ['ESG-G5', 'ESG-E5', 'ESG-N1', 'ESG-N2', 'ESG-N3', 'ESG-G6', 'ESG-V1', 'ESG-V2']
assert.equal(ESG_QUESTIONS.length, 25, '20, the four net-zero criteria, and the optional credit-generation question')
for (const id of NEW) assert.ok(ESG_QUESTIONS.some((q) => q.id === id), `question ${id}`)
assert.equal(new Set(ESG_QUESTIONS.map((q) => q.id)).size, 25, 'unique ids')
for (const q of ESG_QUESTIONS) {
  assert.ok(q.recommendation.length > 20 && q.financingNote.length > 20, `${q.id} has recommendation and financing note`)
  for (const k of [0, 1, 2, 3, 4, 5] as const) assert.ok(q.soe[k]?.length > 5, `${q.id} level ${k}`)
  assert.ok(!/\b(compliant|certified)\b/i.test(q.question), `${q.id} wording`)
}
assert.ok(ESG_QUESTIONS.filter((q) => q.id.startsWith('ESG-N')).every((q) => q.frameworkRefs.includes('TNFD')))
// Final review: adding questions must not cost existing organisations their rating
import { getEsgBadge, ratedAnswered, RATED_QUESTION_IDS } from './esg.ts'
assert.equal(RATED_QUESTION_IDS.length, 12)
const legacy12 = Object.fromEntries(RATED_QUESTION_IDS.map((id) => [id, 4]))
assert.equal(ratedAnswered(legacy12), 12)
assert.equal(getEsgBadge(4.2, ratedAnswered(legacy12), 100).letter, 'AA', 'a complete original assessment keeps its rating')
assert.equal(ratedAnswered({ 'ESG-N1': 4, 'ESG-G5': 3 }), 0, 'new questions do not count towards the rating')
assert.equal(getEsgBadge(4.2, 11, 100).letter, 'Unrated')
console.log('esg: ok')

// The credit-generation question only applies to credit generators: skipping it costs nothing
import { CORE_ESG_QUESTIONS, coreAnswered, unansweredQuestions } from './esg.ts'
assert.equal(CORE_ESG_QUESTIONS.length, 24)
assert.ok(!unansweredQuestions({}).some((q) => q.id === 'ESG-C1'), 'never listed as missing')
assert.equal(coreAnswered({ 'ESG-C1': 2 }), 0, 'not counted towards completion')
