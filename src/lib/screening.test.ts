// Self-check — run directly with `node src/lib/screening.test.ts`.
import assert from 'node:assert/strict'
import { classify, cleanSubjects, listName, screeningState, summarise } from './screening.ts'

const m = (score: number) => ({ id: `x${score}`, caption: 'Acme Ltd', score, datasets: ['worldbank_debarred'] })
assert.deepEqual(classify([m(0.4), m(0.69)]).status, 'clear')
const c = classify([m(0.71), m(0.95), m(0.2)])
assert.deepEqual([c.status, c.flagged.map((x) => x.score)], ['possible_match', [0.95, 0.71]])
assert.equal(classify([m(0.6)], 0.5).status, 'possible_match', 'threshold is configurable')

assert.deepEqual(cleanSubjects([
  { name: '  Riverbend   Trust ', type: 'organisation', country: 'KE' }, { name: 'riverbend trust', type: 'organisation' },
  { name: 'A', type: 'person' }, { name: 'Amina Okoro', type: 'person' }, { name: 'X', type: 'robot' as never },
]), [{ name: 'Riverbend Trust', type: 'organisation', country: 'ke' }, { name: 'Amina Okoro', type: 'person' }])
assert.equal(cleanSubjects(Array.from({ length: 30 }, (_, i) => ({ name: `Person ${i}`, type: 'person' as const }))).length, 20)

assert.equal(listName('afdb_sanctions'), 'African Development Bank debarment')
assert.equal(listName('some_other_list'), 'some_other_list')

assert.equal(screeningState([]), 'not_screened')
assert.equal(screeningState([{ status: 'clear', review: '' }, { status: 'possible_match', review: 'false_positive' }]), 'clear')
assert.equal(screeningState([{ status: 'possible_match', review: '' }]), 'needs_review')
assert.equal(screeningState([{ status: 'possible_match', review: 'confirmed_match' }, { status: 'clear', review: '' }]), 'confirmed_match')
assert.equal(screeningState([{ status: 'error', review: '' }]), 'not_screened')

// Automatic review outcome per name.
const rm = (decision: 'false_positive' | 'confirmed_match' | 'needs_review', name = 'X') => ({ id: name, caption: name, matchedName: name, score: 0.9, datasets: ['us_ofac_sdn'], decision, rule: `rule ${decision}` })
assert.deepEqual(summarise([]), { status: 'clear', review: '', note: '' })
assert.deepEqual(summarise([rm('false_positive', 'A'), rm('false_positive', 'B')]), { status: 'possible_match', review: 'false_positive', note: 'A: rule false_positive; B: rule false_positive' })
assert.equal(summarise([rm('false_positive'), rm('confirmed_match', 'C')]).review, 'confirmed_match', 'one confirmation wins')
assert.deepEqual(summarise([rm('false_positive'), rm('needs_review')]), { status: 'possible_match', review: '', note: '' }, 'anything unsettled goes to a person')
console.log('screening.test.ts: all assertions passed')
