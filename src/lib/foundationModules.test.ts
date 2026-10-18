// Self-check: `node src/lib/foundationModules.test.ts`
import assert from 'node:assert/strict'
import { applies, applicableDimensions, bandFor, compositeScore, type FoundationModule } from './foundationModules.ts'

const soe = { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '' }
const m: FoundationModule = {
  id: 'craft-resilience', no: '99', title: 't', question: 'q', intro: 'i', lensTitle: 'l', lensBlurb: 'b',
  dimensions: [{ key: 'a', name: 'A', question: '?' }, { key: 'pfm', name: 'PFM', question: '?' }],
  indicators: [
    { id: 'X-1', dimension: 'a', domain: 'd', question: 'q', soe, recommendation: 'r', whyItMatters: 'w' },
    { id: 'X-2', dimension: 'pfm', domain: 'd', question: 'q', soe, recommendation: 'r', whyItMatters: 'w', appliesWhen: { publicBody: true } },
  ] as never,
  bands: [{ min: 0, label: 'Low', summary: '', tone: 'rose' }, { min: 2, label: 'Mid', summary: '', tone: 'amber' }, { min: 4, label: 'High', summary: '', tone: 'emerald' }],
  lenses: [], weakestLinkFloor: 2, related: [],
}
const pfm = m.indicators[1]

// Applicability
assert.equal(applies(pfm, {}), false, 'public-body indicator hidden by default')
assert.equal(applies(pfm, { publicBody: true }), true)
assert.equal(applies(pfm), true, 'no profile = legacy behaviour: everything applies')
assert.deepEqual(applicableDimensions(m, {}).map((d) => d.key), ['a'], 'a dimension with no applicable indicator disappears')

// Scoring ignores non-applicable indicators
const scores = { 'X-1': 5, 'X-2': 0 }
assert.equal(compositeScore(m, scores, {}), 5)
assert.equal(compositeScore(m, scores, { publicBody: true }), 2.5)
assert.equal(bandFor(m, scores, {})?.band.label, 'High', 'non-applicable weak dimension does not cap the band')
assert.equal(bandFor(m, scores, { publicBody: true })?.band.label, 'Mid', 'weakest link caps when it applies')

// E&S categories and flags
const es = { appliesWhen: { esCategories: ['moderate', 'high'] } } as never
const flag = { appliesWhen: { esFlag: 'land' } } as never
assert.equal(applies(es, { esCategory: 'low' }), false)
assert.equal(applies(es, { esCategory: 'high' }), true)
assert.equal(applies(es, {}), false, 'no category declared yet: category-gated indicators wait for the screening')
assert.equal(applies(flag, { esCategory: 'high', esFlags: [] }), false)
assert.equal(applies(flag, { esCategory: 'low', esFlags: ['land'] }), true, 'a flagged area applies whatever the category')
console.log('foundationModules: ok')
