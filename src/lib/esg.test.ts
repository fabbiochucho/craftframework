// Self-check: `node src/lib/esg.test.ts`
import assert from 'node:assert/strict'
import { ESG_QUESTIONS } from './esg.ts'

const NEW = ['ESG-G5', 'ESG-E5', 'ESG-N1', 'ESG-N2', 'ESG-N3', 'ESG-G6', 'ESG-V1', 'ESG-V2']
assert.equal(ESG_QUESTIONS.length, 20)
for (const id of NEW) assert.ok(ESG_QUESTIONS.some((q) => q.id === id), `question ${id}`)
assert.equal(new Set(ESG_QUESTIONS.map((q) => q.id)).size, 20, 'unique ids')
for (const q of ESG_QUESTIONS) {
  assert.ok(q.recommendation.length > 20 && q.financingNote.length > 20, `${q.id} has recommendation and financing note`)
  for (const k of [0, 1, 2, 3, 4, 5] as const) assert.ok(q.soe[k]?.length > 5, `${q.id} level ${k}`)
  assert.ok(!/\b(compliant|certified)\b/i.test(q.question), `${q.id} wording`)
}
assert.ok(ESG_QUESTIONS.filter((q) => q.id.startsWith('ESG-N')).every((q) => q.frameworkRefs.includes('TNFD')))
console.log('esg: ok')
