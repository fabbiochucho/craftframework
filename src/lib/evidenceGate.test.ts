// Self-check — run directly with `node src/lib/evidenceGate.test.ts`.
import assert from 'node:assert/strict'
import { gatedScore, isGated, statementId } from './evidenceGate.ts'

const levels = { 1: ['a'], 2: ['b', 'c'], 3: ['d'], 4: ['e'], 5: ['f'] }
const ok = { met: true, evidence: 'Seen: policy dated 2026-01' }
const r = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, ok]))
assert.equal(statementId('FIN-01', 2, 1), 'FIN-01.L2.2')
assert.equal(isGated(levels), true)
assert.equal(isGated({ 1: ['a'], 2: ['b'] }), false)
assert.equal(gatedScore('Q', levels, {}), 0)
assert.equal(gatedScore('Q', levels, r(['Q.L1.1', 'Q.L2.1'])), 1, 'all statements in a level are needed')
assert.equal(gatedScore('Q', levels, r(['Q.L1.1', 'Q.L2.1', 'Q.L2.2', 'Q.L3.1'])), 3)
assert.equal(gatedScore('Q', levels, r(['Q.L1.1', 'Q.L2.1', 'Q.L2.2', 'Q.L4.1', 'Q.L5.1'])), 2, 'no skipping levels')
assert.equal(gatedScore('Q', levels, { 'Q.L1.1': { met: true, evidence: ' ' } }), 0, 'met without evidence does not count')
assert.equal(gatedScore('Q', levels, r(['Q.L1.1', 'Q.L2.1', 'Q.L2.2', 'Q.L3.1', 'Q.L4.1', 'Q.L5.1'])), 5)
console.log('evidenceGate.test.ts: all assertions passed')
