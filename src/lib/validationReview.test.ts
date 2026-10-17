// Self-check — run directly with `node src/lib/validationReview.test.ts`.
import assert from 'node:assert/strict'
import {
  canonicalJson, cappedNegotiated, finalisationProblems, finalScores, FRAMEWORKS, impliedRung, indicatorsInScope, levelConfirmations, levelsAchieved, paperCaps,
  supportsRung, trustDelta, trustDeltaWithCaps,
} from './validationReview.ts'

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
// Partial scopes: only a scope that includes level 1 supports a rung; the others confirm each level they cover.
assert.equal(supportsRung(whole), true)
assert.equal(supportsRung({ kind: 'levels', levels: [1, 2] } as any), true)
assert.equal(supportsRung(l34), false)
const l3Failed = { ...all(5, [4]), ...Object.fromEntries(fw.indicators.filter((i) => i.level === 3).map((i) => [i.id, 2])) }
assert.deepEqual(levelConfirmations(fw, l3Failed, l34).map((c) => [c.level, c.achieved]), [[3, false], [4, true]])
assert.equal(levelConfirmations(fw, all(5), l34)[0].name, fw.levels.find((l) => l.level === 3)!.name)
const partial = { ...ready, scope: l34, validatorScores: all(5, [3, 4]) }
assert.deepEqual(finalisationProblems(partial as any), [], 'every in-scope level confirmed: validated is allowed without a rung')
assert.ok(finalisationProblems({ ...partial, validatorScores: l3Failed } as any).some((p) => /every level in scope confirmed/.test(p)), 'a plain validated outcome needs all levels')
assert.deepEqual(finalisationProblems({ ...partial, validatorScores: l3Failed, outcome: 'validated_with_qualifications', qualifications: [{ text: 'L3 gaps', indicatorIds: [indicatorsInScope(fw, l34)[0].id] }] } as any), [])
assert.ok(finalisationProblems({ ...partial, validatorScores: all(1, [3, 4]), outcome: 'validated_with_qualifications', qualifications: [{ text: 'x', indicatorIds: [indicatorsInScope(fw, l34)[0].id] }] } as any).some((p) => /Not validated/.test(p)), 'no confirmed level')
assert.deepEqual(finalisationProblems({ ...partial, validatorScores: all(1, [3, 4]), outcome: 'not_validated' } as any), [])

// Paper-compliance cap: a negotiated score above 2 on insufficient evidence stands at 2; nothing else is touched.
const caps = paperCaps({ a: 4, b: 4, c: 2, d: 5 }, { a: 'insufficient', b: 'partial', c: 'insufficient', d: 'sufficient' })
assert.deepEqual(Object.keys(caps), ['a'])
assert.equal(caps.a.capped, 2)
assert.match(caps.a.message, /PAPER COMPLIANCE/)
assert.deepEqual(cappedNegotiated({ a: 4, b: 4 }, caps), { a: 2, b: 4 })
assert.deepEqual(paperCaps({ a: 3 }, {}), {}, 'no sufficiency recorded: no cap')
const one = fw.indicators.find((i) => i.level === 1)!.id
const rows = trustDeltaWithCaps(fw, { kind: 'levels', levels: [1] } as any, { [one]: 5 }, { [one]: 2 }, { [one]: 4 }, { [one]: 'insufficient' })
assert.deepEqual([rows[0].negotiated, rows[0].paperCap?.capped, rows[0].final], [4, 2, 2])
assert.equal(trustDeltaWithCaps(fw, { kind: 'levels', levels: [1] } as any, {}, { [one]: 2 }, {}, {})[0].final, 2, 'without a negotiation the validator score stands')
// The cap feeds the outcome: negotiating level 1 up to 4 on insufficient evidence no longer supports a rung.
const lvl1 = all(1, [1])
assert.deepEqual(finalisationProblems({ ...ready, scope: { kind: 'levels', levels: [1] }, validatorScores: lvl1, negotiated: all(4, [1]), outcome: 'validated' } as any), [])
assert.ok(finalisationProblems({ ...ready, scope: { kind: 'levels', levels: [1] }, validatorScores: lvl1, negotiated: all(4, [1]), sufficiency: Object.fromEntries(Object.keys(lvl1).map((k) => [k, 'insufficient'])), outcome: 'validated' } as any).some((p) => /Not validated/.test(p)))

console.log('validationReview.test.ts ok')
