// Self-check — run directly with `node src/lib/riskMatrix.test.ts`.
import assert from 'node:assert/strict'
import { band, heatMap, mustEscalate, ratingProblem, riskScore, scoreOf } from './riskMatrix.ts'

assert.deepEqual([1, 4, 5, 9, 10, 16, 17, 25].map(band), ['Low', 'Low', 'Moderate', 'Moderate', 'High', 'High', 'Critical', 'Critical'])
assert.equal(riskScore(4, 5), 20)
assert.equal(scoreOf({ likelihood: 3, impact: null }), null)
assert.equal(scoreOf({ likelihood: 6, impact: 2 }), null, 'outside 1–5 is not a rating')

assert.equal(ratingProblem({ likelihood: 3, impact: 3 }, { likelihood: 2, impact: 3 }), null)
assert.match(ratingProblem({ likelihood: 2, impact: 2 }, { likelihood: 3, impact: 3 })!, /cannot be higher/)
assert.equal(ratingProblem({ likelihood: null, impact: null }, { likelihood: 5, impact: 5 }), null, 'nothing to compare yet')

assert.equal(mustEscalate({ likelihood: 1, impact: 1 }, { likelihood: 1, impact: 1 }, 'safeguarding'), true, 'category escalates regardless')
assert.equal(mustEscalate({ likelihood: 4, impact: 4 }, { likelihood: 2, impact: 2 }, ''), false, 'controls brought it down')
assert.equal(mustEscalate({ likelihood: 4, impact: 4 }, { likelihood: null, impact: null }, ''), true, 'falls back to inherent')
assert.equal(mustEscalate({ likelihood: null, impact: null }, { likelihood: null, impact: null }, ''), false)

const g = heatMap([{ likelihood: 5, impact: 5 }, { likelihood: 1, impact: 1 }, { likelihood: 5, impact: 5 }, { likelihood: null, impact: 2 }])
assert.equal(g[0][4], 2, 'almost certain × severe at top right')
assert.equal(g[4][0], 1, 'rare × insignificant at bottom left')
assert.equal(g.flat().reduce((a, b) => a + b, 0), 3, 'unrated items are left out')

console.log('riskMatrix.test.ts: all assertions passed')
