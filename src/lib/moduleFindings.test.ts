// Self-check: `node src/lib/moduleFindings.test.ts`
import assert from 'node:assert/strict'
import { deriveModuleFindings, derivePlan } from './moduleFindings.ts'
import { computeOrgScore, deriveFindings } from './data.ts'

const scores = { 'CRAFT-OHE-01': 1, 'CRAFT-OHE-02': 4, 'CRAFT-FCR-25': 0, 'CRAFT-RES-01': 0 }
const f = deriveModuleFindings(scores, {}, 24)
assert.deepEqual(f.map((x) => x.id), ['CRAFT-OHE-01'], 'only answered, applicable v1 index gaps (not older modules, not PFM for non-public bodies)')
assert.ok(f[0].mitigation.length > 10)
assert.equal(f[0].owner, 'Board Secretary', 'policy actions owned by the board secretary')
assert.equal(f[0].topic, 'Organisational Effectiveness Index')
assert.deepEqual(deriveModuleFindings(scores, { publicBody: true }, 24).map((x) => x.id).sort(), ['CRAFT-FCR-25', 'CRAFT-OHE-01'])
assert.deepEqual(deriveModuleFindings({}, {}, 24), [], 'nothing answered, nothing added')
// The core plan and score are untouched by index answers
const core = { 'GOV-01': 1 }
assert.equal(computeOrgScore({ ...core, ...scores }), computeOrgScore(core), 'index answers never change the core composite')
assert.ok(!deriveFindings({ ...core, ...scores }).some((x) => x.id.startsWith('CRAFT-')), 'core plan never contains index ids')
// One plan, sorted together (checkpoint 1)
const mixed = derivePlan({ 'GOV-01': 3, 'GOV-02': 2, 'CRAFT-OHE-01': 0 }, {}, 24)
assert.equal(mixed[0].id, 'CRAFT-OHE-01', 'a critical index gap sorts above core high/moderate gaps')
const twoCritical = derivePlan({ 'GOV-01': 0, 'CRAFT-OHE-01': 0 }, {}, 24)
assert.notEqual(twoCritical[0].dueMonth, twoCritical[1].dueMonth, 'core and index actions share one schedule, not two bunched ones')
console.log('moduleFindings: ok')
