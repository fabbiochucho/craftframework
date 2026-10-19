// Self-check: `node src/lib/indexValidation.test.ts` — stage 4: validating the CRAFT indices (spec §7).
import assert from 'node:assert/strict'
import { parseScope, scopeText, type EngagementScope } from './engagements.ts'
import { allInScope, finalisationProblems, FRAMEWORKS, indexResults, trustDelta } from './validationReview.ts'
import { heldSpecialisms, missingSpecialisms, requiredSpecialisms, SPECIALIST_EXAM, specialistPassed } from './specialisms.ts'

const ladder = FRAMEWORKS['capital-readiness']
assert.equal(ladder.result, 'rung')

// The four v1 indices are band frameworks with their own indicators
for (const k of ['craft-health', 'craft-change', 'craft-fiduciary', 'craft-safeguards']) {
  const f = FRAMEWORKS[k]
  assert.ok(f, k)
  assert.equal(f.result, 'band')
  assert.ok(f.indicators.length >= 10 && f.indicators.every((i) => i.id.startsWith('CRAFT-')), `${k} has its indicators`)
  assert.equal(f.version, 'v1 (102026)')
}

// Scope: indices are optional, must be known, never repeated
assert.deepEqual(parseScope({ kind: 'whole', indices: ['craft-change', 'craft-health'] }), { kind: 'whole', indices: ['craft-health', 'craft-change'] }, 'kept in display order')
assert.deepEqual(parseScope({ kind: 'whole', indices: [] }), { kind: 'whole' }, 'an empty list is no indices')
assert.equal(parseScope({ kind: 'whole', indices: ['craft-nope'] }), null)
assert.equal(parseScope({ kind: 'whole', indices: ['craft-health', 'craft-health'] }), null)
assert.equal(parseScope({ kind: 'levels', levels: [1], indices: 'craft-health' }), null)
assert.match(scopeText({ kind: 'whole', indices: ['craft-fiduciary'] }), /Whole ladder; CRAFT indices: Fiduciary Controls/)

// In-scope indicators span the ladder and the indices, tagged with their framework
const scope: EngagementScope = { kind: 'levels', levels: [1], indices: ['craft-change'] }
const inScope = allInScope(ladder, scope)
const chg = FRAMEWORKS['craft-change'].indicators
assert.equal(inScope.length, ladder.indicators.filter((i) => i.level === 1).length + chg.length)
assert.ok(inScope.filter((i) => i.framework === 'craft-change').length === chg.length)
assert.ok(trustDelta(ladder, scope, {}, {}).some((r) => r.framework === 'craft-change'), 'trust delta rows include index indicators')

// Finalisation: every index indicator must be scored
const ladderOnly = Object.fromEntries(ladder.indicators.filter((i) => i.level === 1).map((i) => [i.id, 4]))
const base = { fw: ladder, scope, negotiated: {}, method: 'document_review' as const, fieldworkStart: '2026-10-01', fieldworkEnd: '2026-10-02', outcome: 'validated' as const, qualifications: [], now: new Date('2026-10-19') }
assert.ok(finalisationProblems({ ...base, validatorScores: ladderOnly }).some((p) => /Score every indicator/.test(p)), 'unscored index indicators block finalising')
const everything = { ...ladderOnly, ...Object.fromEntries(chg.map((i) => [i.id, 4])) }
assert.deepEqual(finalisationProblems({ ...base, validatorScores: everything }), [])
// A qualification may name an index indicator
assert.deepEqual(finalisationProblems({ ...base, outcome: 'validated_with_qualifications', validatorScores: everything, qualifications: [{ text: 'x', indicatorIds: [chg[0].id] }] }), [])

// Index results: one band per index from the final (capped) scores; no scores leave the function
const res = indexResults(scope, everything)
assert.equal(res.length, 1)
assert.equal(res[0].key, 'craft-change')
assert.ok(res[0].band && res[0].band.length > 2)
assert.deepEqual(Object.keys(res[0]).sort(), ['band', 'key', 'name', 'version'])
assert.equal(indexResults({ kind: 'whole' }, everything).length, 0)
// Safeguards indicators follow the organisation's E&S category, as in self-assessment
const sg: EngagementScope = { kind: 'whole', indices: ['craft-safeguards'] }
const lowOnly = allInScope(ladder, sg, { esCategory: 'low' }).filter((i) => i.framework === 'craft-safeguards').length
const high = allInScope(ladder, sg, { esCategory: 'high' }).filter((i) => i.framework === 'craft-safeguards').length
assert.ok(lowOnly > 0 && high > lowOnly, 'a high-risk organisation has more safeguards indicators in scope')

// Specialisms: the specialist indices need them; a specialism counts only while accredited
assert.deepEqual(requiredSpecialisms({ kind: 'whole', indices: ['craft-fiduciary', 'craft-health', 'craft-safeguards'] }), ['fiduciary', 'safeguards'])
assert.deepEqual(missingSpecialisms({ kind: 'whole', indices: ['craft-fiduciary'] }, []), ['fiduciary'])
assert.deepEqual(missingSpecialisms({ kind: 'whole', indices: ['craft-fiduciary'] }, ['fiduciary']), [])
assert.deepEqual(missingSpecialisms({ kind: 'whole' }, []), [])
assert.deepEqual(heldSpecialisms([{ specialism: 'fiduciary' }, { specialism: 'bogus' }], 'accredited'), ['fiduciary'])
assert.deepEqual(heldSpecialisms([{ specialism: 'fiduciary' }], 'lapsed'), [], 'a lapsed accreditation lapses its specialisms')

// Specialist assessment: 15 questions, 30 minutes, 80% to pass
assert.deepEqual([SPECIALIST_EXAM.questions, SPECIALIST_EXAM.minutes, SPECIALIST_EXAM.passPct], [15, 30, 80])
assert.equal(specialistPassed(12, 15), true)
assert.equal(specialistPassed(11, 15), false)
assert.equal(specialistPassed(0, 0), false)
console.log('indexValidation: ok')

// Training content for the indices (spec §7.1)
import { SEED_INDEX_MODULES, SEED_INDEX_QUESTIONS } from './trainingSeedIndices.ts'
import { isSpecialistModuleId } from './specialisms.ts'
{
  assert.deepEqual(SEED_INDEX_MODULES.map((m) => m.id), ['m9', 's1', 's2'])
  const of = (id: string) => SEED_INDEX_QUESTIONS.filter((q) => q.moduleId === id)
  assert.equal(of('m9').length, 20, 'module 9 adds 20 exam questions')
  assert.equal(of('s1').length, 15); assert.equal(of('s2').length, 15)
  for (const id of ['m9', 's1', 's2']) assert.equal(of(id).filter((q) => q.forCheck).length, 5, `${id} has a 5-question check`)
  assert.ok(SEED_INDEX_QUESTIONS.every((q) => q.correctIndex < q.options.length), 'every answer indexes an option')
  assert.equal(new Set(SEED_INDEX_QUESTIONS.map((q) => q.id)).size, SEED_INDEX_QUESTIONS.length)
  assert.ok(SEED_INDEX_MODULES.every((m) => m.scenario.choices.some((c) => c.best)))
  assert.deepEqual(['m1', 'm9', 's1', 's2'].map(isSpecialistModuleId), [false, false, true, true])
  console.log('indexValidation (training): ok')
}

// Public page and statement: index bands from the frozen snapshot (schema 2); schema 1 has none
import { indexResultsFromSnapshot, indexResultsHeading } from './validationStatement.ts'
{
  assert.equal(indexResultsFromSnapshot({ schema: 1 }), null)
  assert.equal(indexResultsFromSnapshot(null), null)
  const r = indexResultsFromSnapshot({ schema: 2, indices: [{ key: 'craft-change', name: 'CRAFT Change Readiness & Adoption Index', version: 'v1 (102026)', band: 'Functional', qualifications: ['q'] }, { bad: true }] })
  assert.deepEqual(r, [{ name: 'CRAFT Change Readiness & Adoption Index', version: 'v1 (102026)', band: 'Functional' }], 'band only: no qualifications or scores leak through')
  assert.equal(indexResultsFromSnapshot({ schema: 2, indices: [] }), null)
  assert.equal(indexResultsHeading(r!), 'CRAFT index results (v1 (102026))')
  console.log('indexValidation (public): ok')
}

// Statistics count index validations separately; rung gaps stay ladder-only
import { reviewMetrics, validatorStats } from './validatorQuality.ts'
{
  const snap = { schema: 2, selfRung: 3, impliedRung: 3, validatedRung: 3, indices: [{ key: 'craft-change' }], indicators: [
    { id: 'CRL-1A', framework: 'capital-readiness', self: 4, final: 4 },
    { id: 'CRAFT-CHG-01', framework: 'craft-change', self: 5, final: 1 },
  ] }
  const m = reviewMetrics('validated', snap)
  assert.equal(m.gap, 0, 'index indicators do not distort the ladder gap')
  assert.equal(m.indexGap, 4)
  assert.equal(m.indices, 1)
  const old = reviewMetrics('validated', { selfRung: 2, impliedRung: 2, validatedRung: 2, indicators: [{ id: 'CRL-1A', self: 3, final: 2 }] })
  assert.equal(old.gap, 1, 'schema 1 snapshots are all ladder')
  assert.equal(old.indices, 0)
  const st = validatorStats([m, old])
  assert.equal(st.indexValidations, 1)
  assert.equal(st.meanIndexGap, 4)
  console.log('indexValidation (statistics): ok')
}
