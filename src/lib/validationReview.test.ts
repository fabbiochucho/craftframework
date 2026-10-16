// Self-check — run directly with `node src/lib/validationReview.test.ts`.
import assert from 'node:assert/strict'
import { canonicalJson, finalisationProblems, finalScores, FRAMEWORKS, impliedRung, indicatorsInScope, levelsAchieved, trustDelta } from './validationReview.ts'

const fw = FRAMEWORKS['capital-readiness']
const whole: any = { kind: 'whole' }
const all = (n: number, levels = [1, 2, 3, 4, 5, 6, 7]) => Object.fromEntries(fw.indicators.filter((i) => levels.includes(i.level)).map((i) => [i.id, n]))

// Rung comes from the validator's scores, not the organisation's.
assert.equal(impliedRung(fw, all(4), whole), 7)
assert.equal(impliedRung(fw, all(4, [1, 2, 3]), whole), 3)
assert.equal(impliedRung(fw, { ...all(4), ...Object.fromEntries(fw.indicators.filter((i) => i.level === 3).map((i) => [i.id, 1])) }, whole), 2, 'a failed rung stops the climb')
// A scope that skips level 1 supports no rung, but reports the levels it did confirm.
const l34: any = { kind: 'levels', levels: [3, 4] }
assert.equal(impliedRung(fw, all(5), l34), 0)
assert.deepEqual(levelsAchieved(fw, all(5), l34), [3, 4])
assert.deepEqual([...new Set(indicatorsInScope(fw, l34).map((i) => i.level))], [3, 4])
// Out-of-scope scores are ignored.
assert.equal(impliedRung(fw, all(5), { kind: 'levels', levels: [1, 2] }), 2)

// Negotiated scores replace the validator's where recorded.
assert.deepEqual(finalScores({ a: 2, b: 3 }, { b: 4 }), { a: 2, b: 4 })

// Trust Delta: self vs validator, with optimism bias.
const td = trustDelta(fw, { kind: 'levels', levels: [1] } as any, { 'CRL-1A': 4 }, { 'CRL-1A': 2 })
assert.equal(td[0].delta, 2)
assert.equal(td[0].optimismBias, 40)
assert.equal(td[1].delta, null, 'unscored rows have no delta')

const ready = { fw, scope: whole, validatorScores: all(4), negotiated: {}, method: 'combined', fieldworkStart: '2026-01-05', fieldworkEnd: '2026-01-09', outcome: 'validated', qualifications: [], now: new Date('2026-02-01') } as const
assert.deepEqual(finalisationProblems(ready as any), [])
assert.match(finalisationProblems({ ...ready, validatorScores: all(4, [1]) } as any)[0], /not yet scored/)
assert.ok(finalisationProblems({ ...ready, method: null } as any).some((p) => /method/.test(p)))
assert.ok(finalisationProblems({ ...ready, fieldworkEnd: '2026-01-01' } as any).some((p) => /before it starts/.test(p)))
assert.ok(finalisationProblems({ ...ready, fieldworkEnd: '2026-03-01' } as any).some((p) => /future/.test(p)))
assert.ok(finalisationProblems({ ...ready, outcome: 'validated_with_qualifications' } as any).some((p) => /at least one qualification/.test(p)))
assert.ok(finalisationProblems({ ...ready, qualifications: [{ text: 'x', indicatorIds: ['CRL-1A'] }] } as any).some((p) => /plain/.test(p)))
assert.ok(finalisationProblems({ ...ready, outcome: 'validated_with_qualifications', qualifications: [{ text: 'x', indicatorIds: [] }] } as any).some((p) => /Link every/.test(p)))
assert.deepEqual(finalisationProblems({ ...ready, outcome: 'validated_with_qualifications', qualifications: [{ text: 'Board minutes missing', indicatorIds: ['CRL-1A'] }] } as any), [])
assert.ok(finalisationProblems({ ...ready, validatorScores: all(1), outcome: 'validated' } as any).some((p) => /Not validated/.test(p)), 'rung 0 cannot be validated')
assert.deepEqual(finalisationProblems({ ...ready, validatorScores: all(1), outcome: 'not_validated' } as any), [])
// Negotiated scores count towards the rung.
assert.deepEqual(finalisationProblems({ ...ready, validatorScores: all(1), negotiated: all(4), outcome: 'validated' } as any), [])

assert.equal(canonicalJson({ b: 1, a: [2, { d: undefined, c: 'x' }] }), '{"a":[2,{"c":"x"}],"b":1}')
console.log('validationReview.test.ts ok')
