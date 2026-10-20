// Self-check: `node src/lib/ndc.test.ts` — national NDC records and how an organisation's actions relate to them.
import assert from 'node:assert/strict'
import { NDCS, NDC_SECTORS, assessContribution, ndcNarrativeBlocks, type ContributionProfile } from './ndc.ts'
import { LAW_JURISDICTIONS } from './laws/types.ts'
import { checkTarget, targetFromSaved } from './netZero.ts'

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

// The net-zero check feeds the mitigation statement: aligned with the NDC's goal, never counted towards it
const mitigation: ContributionProfile = { sectors: ['energy'], types: ['mitigation'], actions: '' }
const good = checkTarget(targetFromSaved({ baseYear: 2020, baseEmissions: 1000, targetYear: 2030, targetReductionPct: 50 }))
const weak = checkTarget(targetFromSaved({ baseYear: 2020, baseEmissions: 1000, targetYear: 2030, targetReductionPct: 20 }))
const aligned = assessContribution('NG', mitigation, good)!
assert.ok(aligned.statements.some((t) => /target .*meets the science-based benchmark.*aligned with the NDC's mitigation goal/i.test(t)), aligned.statements.join(' | '))
const short = assessContribution('NG', mitigation, weak)!
assert.ok(short.statements.some((t) => /falls short .*22 percentage points/i.test(t)), short.statements.join(' | '))
assert.ok(!short.statements.some((t) => /target .*aligned with the NDC/i.test(t)), 'a short target is never called aligned')
for (const c of [aligned, short]) assert.doesNotMatch([...c.statements, ...c.caveats].join(' '), /counts? towards?|counted towards?|credited/i)
// No target, an unfinished target, or no mitigation work: nothing is claimed about a target
assert.ok(!assessContribution('NG', mitigation, null)!.statements.some((t) => /benchmark/.test(t)))
assert.ok(!assessContribution('NG', mitigation, checkTarget(targetFromSaved({})))!.statements.some((t) => /benchmark/.test(t)))
assert.ok(!assessContribution('NG', { sectors: ['water'], types: ['adaptation'], actions: '' }, good)!.statements.some((t) => /benchmark/.test(t)))
// The report section shows the target check when there is one
assert.ok(ndcNarrativeBlocks(aligned, 'Nigeria').some((b) => b.type === 'list' && b.items.some((i) => /benchmark/.test(i))))

console.log('ndc: ok')
