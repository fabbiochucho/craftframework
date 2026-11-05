// Self-check — run directly with `node src/lib/fundingModalities.test.ts`.
import assert from 'node:assert/strict'
import { FUNDING_MODALITIES, MOCK_QUESTIONS, modalityMatch, type Question } from './data.ts'

const q = (modalities?: Question['modalities']) => ({ id: 'X', modalities }) as Question
assert.equal(modalityMatch(q()), true, 'universal questions always show')
assert.equal(modalityMatch(q(['milestone'])), false, 'model-specific questions hide until a model is chosen')
assert.equal(modalityMatch(q(['milestone']), ['cost_reimbursement']), false)
assert.equal(modalityMatch(q(['milestone', 'performance']), ['performance']), true)

// Every funding model has its own questions, and every tagged question uses a known model.
const ids = new Set(FUNDING_MODALITIES.map((m) => m.id))
for (const m of ids) assert.ok(MOCK_QUESTIONS.some((x) => x.modalities?.includes(m)), `questions for ${m}`)
for (const x of MOCK_QUESTIONS) for (const m of x.modalities ?? []) assert.ok(ids.has(m), `${x.id}: unknown model ${m}`)
// General funding questions apply to everyone.
assert.ok(MOCK_QUESTIONS.some((x) => x.domain === 'Funding Modalities & Disbursement Readiness' && !x.modalities))

console.log('fundingModalities.test.ts: all assertions passed')
