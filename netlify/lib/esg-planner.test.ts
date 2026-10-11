// Self-check — run directly with `node netlify/lib/esg-planner.test.ts`.
import assert from 'node:assert/strict'
import {
  catalogueMeta, defaultFirstReportingYear, ESG_CATALOGUE, generateSecPlan, HORIZON_DAYS, planCsv, renderPlanDoc,
  SEC_NG_CIRCULAR, SEC_NG_ELEMENTS, SEC_NG_FRAMEWORK,
} from './esg-planner.ts'
import { csvEscape } from './workspace.ts'

// The SEC framework carries exactly the circular's eight minimum elements, in order.
const sec = ESG_CATALOGUE.find((f) => f.name === SEC_NG_FRAMEWORK)!
assert.equal(sec.reqs.length, 8)
assert.deepEqual(sec.reqs.map((r) => r[0]), SEC_NG_ELEMENTS.map((e) => e.id))
assert.match(sec.reqs[6][1], /first sustainability reporting.*FRCN Roadmap/)
assert.equal(SEC_NG_CIRCULAR.submissionDeadline, '2026-10-15')

// Catalogue keys are unique, so per-name seeding is idempotent; requirement ids unique per framework.
assert.equal(new Set(ESG_CATALOGUE.map((f) => f.name)).size, ESG_CATALOGUE.length)
for (const f of ESG_CATALOGUE) assert.equal(new Set(f.reqs.map((r) => r[0])).size, f.reqs.length, f.name)
// Unverified frameworks must say so; the meta never leaks requirement rows.
for (const f of ESG_CATALOGUE) if (!f.lastVerified) assert.ok(f.requiresVerification, f.name)
assert.equal('reqs' in (catalogueMeta('GRI') ?? {}), false)
assert.equal(catalogueMeta('nope'), null)

// First reporting year: SEC dates for PIEs and SMEs, never invented for others.
assert.equal(defaultFirstReportingYear('public_company'), 2028)
assert.equal(defaultFirstReportingYear('spicmo'), 2028)
assert.equal(defaultFirstReportingYear('sme'), 2030)
assert.equal(defaultFirstReportingYear('other'), null)

// Plan generation is deterministic, inside the horizon, and milestones are ordered.
for (const h of ['90d', '12m', '24m'] as const) {
  const plan = generateSecPlan('2026-10-12', h)
  assert.deepEqual(plan, generateSecPlan('2026-10-12', h))
  assert.equal(plan.length, 8)
  const end = new Date(Date.UTC(2026, 9, 12) + HORIZON_DAYS[h] * 86_400_000).toISOString().slice(0, 10)
  for (const e of plan) {
    assert.ok(e.timelineStart >= '2026-10-12' && e.timelineEnd <= end, `${h} ${e.requirementId}`)
    assert.equal(e.milestones.length, 3)
    assert.ok(e.milestones[0].targetDate <= e.milestones[1].targetDate && e.milestones[1].targetDate <= e.milestones[2].targetDate)
    assert.equal(e.milestones[2].targetDate, e.timelineEnd)
  }
}
assert.throws(() => generateSecPlan('12/10/2026', '12m'))

// Export: HTML escapes user text, keeps the deadline separate from the first year, and CSV has one row per milestone.
const rows = [{
  requirementId: 'SEC-NG-1', requirementText: 'Governance', owner: '<script>x</script>', status: 'in_progress',
  timelineStart: '2026-10-12', timelineEnd: '2027-01-01',
  milestones: [{ milestoneNum: 1, description: 'A, "quoted"', targetDate: '2026-11-01', status: 'completed', completionEvidenceLink: null }],
}]
const html = renderPlanDoc({ organisationName: 'Acme & Co', entityType: 'other', readiness: 'early', horizon: '12m', startDate: '2026-10-12', firstReportingYear: null }, rows, '2026-10-12')
assert.ok(!html.includes('<script>x'))
assert.ok(html.includes('Acme &amp; Co'))
assert.ok(html.includes('2026-10-15') && html.includes('requires confirmation'))
assert.ok(html.includes('not legal advice'))
const csv = planCsv(rows, csvEscape).split('\n')
assert.equal(csv.length, 2)
assert.ok(csv[1].includes('"A, ""quoted"""'))

console.log('esg-planner.test.ts: all assertions passed')
