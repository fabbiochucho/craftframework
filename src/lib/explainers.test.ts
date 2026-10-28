// Self-check: `node src/lib/explainers.test.ts` — the "What does this mean?" explainers stay short and plain.
import assert from 'node:assert/strict'
import { EXPLAINERS } from './explainers.ts'

const MAX_WORDS = 28
const JARGON = /\b(heuristic|stochastic|aggregate|leverage|synerg|paradigm|operationali[sz]e|utili[sz]e|Monte Carlo|PERT|Poisson)\b/i

for (const [id, e] of Object.entries(EXPLAINERS)) {
  assert.ok(e.read.length >= 2 && e.read.length <= 4 && e.next.length >= 1 && e.next.length <= 3, `${id}: 2-4 reading points, 1-3 next steps`)
  for (const text of [e.shows, ...e.read, ...e.next]) {
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      const words = sentence.split(/\s+/).filter(Boolean).length
      assert.ok(words <= MAX_WORDS, `${id}: sentence too long (${words} words): ${sentence}`)
    }
    assert.ok(!JARGON.test(text), `${id}: technical word in "${text}"`)
  }
}
console.log('explainers: ok')
