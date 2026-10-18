// Self-check: `node src/lib/crosswalk.test.ts`
import assert from 'node:assert/strict'
import { crosswalkProblems, EXTERNAL_FRAMEWORKS, frameworkById } from './crosswalk.ts'

const ids = EXTERNAL_FRAMEWORKS.map((f) => f.id)
assert.equal(new Set(ids).size, ids.length, 'framework ids unique')
for (const f of EXTERNAL_FRAMEWORKS) {
  const els = f.elements.map((e) => e.id)
  assert.equal(new Set(els).size, els.length, `${f.id}: element ids unique`)
  assert.ok(f.owner && f.name, `${f.id}: name and owner`)
  assert.ok(f.elements.length > 0, `${f.id}: at least one element`)
}
for (const need of ['coso-ic', 'coso-erm', 'iso-31000', 'ifc-cgdf', 'nccg-2018', 'pefa', 'afdb-iss', 'ifrs-s1', 'ifrs-s2',
  'mck-ohi', 'mck-7s', 'nadler-tushman', 'burke-litwin', 'star-model', 'lencioni', 'cvf', 'bsc', 'adkar', 'kotter', 'lewin',
  'bridges', 'nist-csf-2', 'iso-9001', 'iso-27001', 'iso-22301', 'iso-37001']) assert.ok(frameworkById(need), `registered: ${need}`)
assert.equal(frameworkById('iso-31000')?.kind, 'guidance', 'ISO 31000 is guidance, never certifiable')
assert.equal(frameworkById('iso-37002')?.kind, 'guidance')
assert.equal(frameworkById('iso-27001')?.kind, 'certifiable')
assert.equal(frameworkById('iso-14064-1')?.kind, 'verified', 'GHG statements are verified, not certified')
for (const existing of ['pact-omt', 'pact-oca', 'gf-pr', 'gfa', 'oecd-ai', 'g7-ai']) assert.ok(frameworkById(existing), `existing CRAFT framework registered: ${existing}`)
assert.equal(frameworkById('coso-ic')?.elements.length, 22, 'COSO IC: 5 components + 17 principles')

assert.deepEqual(crosswalkProblems([{ indicatorId: 'A', refs: [{ framework: 'coso-ic', ref: 'CE' }] }]), [])
assert.deepEqual(crosswalkProblems([{ indicatorId: 'A', refs: [{ framework: 'coso', ref: 'CE' }] }]), ['A: unknown framework "coso"'])
assert.deepEqual(crosswalkProblems([{ indicatorId: 'A', refs: [{ framework: 'coso-ic', ref: 'ZZ' }] }]), ['A: coso-ic has no element "ZZ"'])
console.log('crosswalk: ok')
