// Self-check — run directly with `node src/lib/org-design.test.ts`.
import assert from 'node:assert/strict'
import { cleanSection, dealKennedyType, diagnose, expectedConfiguration, NINE_TESTS, RUBRIC, SECTIONS } from './org-design.ts'

// Catalogue integrity
assert.equal(NINE_TESTS.length, 9)
assert.equal(NINE_TESTS.filter((t) => t.group === 'fit').length, 4)
for (const s of SECTIONS) assert.equal(new Set(s.fields.map((f) => f.key)).size, s.fields.length, `duplicate keys in ${s.id}`)

// Validation rejects unknown keys and out-of-range values, keeps valid ones.
assert.throws(() => cleanSection('structure', { nope: 1 }), /unknown field/)
assert.throws(() => cleanSection('structure', { cfg_m1: 6 }), /1-5/)
assert.throws(() => cleanSection('nope', {}), /unknown section/)
assert.deepEqual(cleanSection('planning', { timeline: [{ activity: 'Interviews', start: '2026-11-01', end: '2026-11-14', extra: 'x' }] }),
  { timeline: [{ activity: 'Interviews', start: '2026-11-01', end: '2026-11-14', status: '' }] })
assert.throws(() => cleanSection('tests', { t_people: 'maybe' }), /invalid option/)
assert.equal(cleanSection('rubric', { '1a': 8 })['1a'], 8)

// Deal & Kennedy quadrants and Mintzberg contingency
assert.equal(dealKennedyType(5, 5), 'tough_guy')
assert.equal(dealKennedyType(1, 5), 'work_hard')
assert.equal(dealKennedyType(5, 1), 'bet_company')
assert.equal(dealKennedyType(1, 1), 'process')
assert.equal(expectedConfiguration({ stability: 1, complexity: 5 }).id, 'professional')
assert.equal(expectedConfiguration({ stability: 5, complexity: 5 }).id, 'adhocracy')
assert.equal(expectedConfiguration({ stability: 1, complexity: 1, diversity: 5 }).id, 'divisional')

// A machine bureaucracy facing a complex, dynamic environment: mismatch, culture gap, failing fit test.
const d = diagnose({
  environment: { stability: 5, complexity: 5 },
  structure: { cfg_m1: 5, cfg_m2: 5, cfg_m3: 4, cfg_a1: 2, coordination: 'work_processes' },
  culture: { hd_r1: 5, hd_r2: 5, hd_r3: 4, hd_t1: 2, handyPreferred: 'task', dkRisk: 1, dkFeedback: 1, st_1: 4, st_2: 4, st_3: 4, st_4: 4 },
  functions: { ict_effectiveness: 2, ict_efficiency: 3 },
  tests: { t_market: 'fail', t_people: 'pass', t_flexibility: 'concern', t_flexibility_action: 'Create an innovation unit' },
})
assert.equal(d.configuration.dominant, 'machine')
assert.equal(d.configuration.expected, 'adhocracy')
assert.equal(d.configuration.fit, 'mismatch')
assert.equal(d.culture.handy.dominant, 'role')
assert.equal(d.culture.dealKennedy.type, 'process')
assert.equal(d.culture.strong, true)
assert.match(d.tests.verdict, /Redesign needed/)
assert.ok(d.findings.some((f) => /mismatch/.test(f)))
assert.ok(d.findings.some((f) => /Culture gap/.test(f)))
assert.ok(d.findings.some((f) => /Market advantage test is marked fail but has no design change/.test(f)))
assert.ok(!d.findings.some((f) => /Flexibility test is marked/.test(f)), 'actions recorded clear the finding')
assert.ok(d.findings.some((f) => /Weak interface with ict/.test(f)))
assert.equal(d.rubric.overall, null)

// Rubric: all 6 scored → weighted marks, pass at 55.
const all6 = Object.fromEntries(RUBRIC.map((r) => [r.id, 6]))
assert.equal(diagnose({ rubric: all6 }).rubric.overall, 60)
assert.equal(diagnose({ rubric: all6 }).rubric.pass, true)
assert.equal(diagnose({ rubric: Object.fromEntries(RUBRIC.map((r) => [r.id, 5])) }).rubric.pass, false)
console.log('org-design.test.ts: all assertions passed')
