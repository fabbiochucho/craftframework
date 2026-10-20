// Self-check: `node src/lib/ndc.test.ts` — national NDC records and how an organisation's actions relate to them.
import assert from 'node:assert/strict'
import { NDCS, NDC_SECTORS, assessContribution, ndcNarrativeBlocks, type ContributionProfile } from './ndc.ts'
import { LAW_JURISDICTIONS } from './laws/types.ts'

// Every jurisdiction in the laws register has an NDC record (the EU submits one NDC for all member states)
for (const j of LAW_JURISDICTIONS) assert.ok(NDCS[j], `${j} has an NDC record`)
for (const [j, r] of Object.entries(NDCS)) {
  assert.equal(r.jurisdiction, j)
  assert.ok(r.source.registry.startsWith('https://unfccc.int/'), `${j} links the UNFCCC registry`)
  assert.ok(r.source.analysis.startsWith('https://www.climatewatchdata.org/'), `${j} names the analysis it was read from`)
  assert.match(r.source.checked, /^\d{4}-\d{2}-\d{2}$/)
  if (r.submitted) assert.match(r.submitted, /^\d{4}-\d{2}-\d{2}$/, `${j} submission date is ISO`)
  for (const s of [...r.mitigation, ...r.adaptation]) assert.ok(NDC_SECTORS[s], `${j}: known sector ${s}`)
}
assert.match(NDCS.NG.target ?? '', /32.2%/, 'Nigeria NDC 3.0: 32.2% below 2018 by 2035')
assert.match(NDCS.LY.notes ?? '', /No NDC document/)
assert.match(NDCS.US.notes ?? '', /withdr/i, 'the US withdrawal from the Paris Agreement is stated')

// An organisation's contribution
const solar: ContributionProfile = { sectors: ['energy', 'water'], types: ['mitigation', 'adaptation'], actions: 'Solar mini-grids and borehole pumps' }
const c = assessContribution('NG', solar)!
assert.ok(c.mitigationMatches.includes('energy'), 'energy is an NDC mitigation sector in Nigeria')
assert.ok(c.adaptationMatches.includes('water'))
assert.ok(c.statements.some((s) => /contributes to|aligned with/.test(s)))
// Wording rule: alignment, never an accounting claim
const text = [...c.statements, ...c.caveats].join(' ')
assert.doesNotMatch(text, /counts? towards?|counted towards?|credited/i)
assert.ok(c.caveats.some((s) => /government/i.test(s)), 'only the government reports NDC progress')
// A sector the NDC does not name is reported as outside it, not as a match
const tourism = assessContribution('NG', { sectors: ['tourism'], types: ['mitigation'], actions: '' })!
assert.deepEqual(tourism.mitigationMatches, [])
assert.ok(tourism.statements.some((s) => /not named/i.test(s)))
// Finance and capacity support is stated without a sector match
const finance = assessContribution('KE', { sectors: [], types: ['finance-capacity'], actions: 'Green bond' })!
assert.ok(finance.statements.some((s) => /finance|capacity/i.test(s)))
assert.equal(assessContribution('ZZ', solar), null)
// An empty profile asks for input rather than claiming anything
assert.ok(assessContribution('NG', { sectors: [], types: [], actions: '' })!.statements.every((s) => !/contributes to/.test(s)))

// Report section
const blocks = ndcNarrativeBlocks(c, 'Nigeria')
assert.ok(blocks.some((b) => b.type === 'table'))
assert.ok(blocks.some((b) => b.type === 'note' && /unfccc/i.test(b.text)), 'the section cites its source')

console.log('ndc: ok')
