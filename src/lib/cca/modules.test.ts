// Self-check — run directly with `node src/lib/cca/modules.test.ts`.
import assert from 'node:assert/strict'
import { CCA_MODULE_IDS, contentProblems, isAwardModule } from './modules.ts'

assert.deepEqual(CCA_MODULE_IDS, ['national', 'state', 'local', 'community', 'pre_award', 'during_award', 'post_award'])
assert.equal(isAwardModule('during_award'), true)
assert.equal(isAwardModule('community'), false)

const st = (id: string) => [{ id, text: `Statement ${id}` }]
const dom = (id: string) => ({ id, name: id, level1: 'Nothing yet.', levels: { 2: st(`${id}.2`), 3: st(`${id}.3`), 4: st(`${id}.4`) } })
const good = [{ id: 'community', name: 'Community', audience: 'CSOs', areas: [{ id: 'gov', name: 'Governance', domains: [dom('g1'), dom('g2'), dom('g3')] }] }]
assert.deepEqual(contentProblems(good), [])
assert.deepEqual(contentProblems('x'), ['content must be a list of modules'])
assert.ok(contentProblems([{ ...good[0], id: 'nope' }]).some((p) => /unknown module/.test(p)))
assert.ok(contentProblems([{ ...good[0], areas: [{ ...good[0].areas[0], domains: [dom('g1'), dom('g2')] }] }]).some((p) => /3 to 5 domains/.test(p)))
assert.ok(contentProblems([{ ...good[0], areas: [{ ...good[0].areas[0], domains: [dom('g1'), dom('g1'), dom('g3')] }] }]).some((p) => /duplicate id g1/.test(p)))
const noL3 = { ...dom('g3'), levels: { ...dom('g3').levels, 3: [] } }
assert.ok(contentProblems([{ ...good[0], areas: [{ ...good[0].areas[0], domains: [dom('g1'), dom('g2'), noL3] }] }]).some((p) => /level 3 needs statements/.test(p)))

console.log('cca/modules.test.ts: all assertions passed')
