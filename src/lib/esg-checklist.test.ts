// Self-check — run directly with `node src/lib/esg-checklist.test.ts`.
import assert from 'node:assert/strict'
import {
  applicableChecks, CHECKS, ifrsApplicability, JURISDICTIONS, LEGACY_CHECKS_STATUS, scoreChecklist, type CheckInstance, type QaProfile,
} from './esg-checklist.ts'

const base: QaProfile = { jurisdiction: 'NG', category: 'ng_pie', adoptingVoluntarily: false, financialActivities: false, secScope: false, mofiScope: false, mofiOverlay: false }
const p = (x: Partial<QaProfile>): QaProfile => ({ ...base, ...x })

// Catalogue integrity: unique ids, the user's packs complete, no fabricated legacy checks.
assert.equal(new Set(CHECKS.map((c) => c.id)).size, CHECKS.length)
for (const [pack, n] of [['GQ', 30], ['S1', 20], ['S2', 21], ['SEC', 8], ['FRC', 12], ['MOFI', 9], ['EC', 4]] as const) assert.equal(CHECKS.filter((c) => c.pack === pack).length, n, pack)
// The 30-check baseline is a provisional reconstruction, never presented as the verified original.
assert.equal(CHECKS.filter((c) => c.pack === 'GQ' && c.provisional).length, LEGACY_CHECKS_STATUS.imported)
assert.equal(LEGACY_CHECKS_STATUS.reconciled, false)
assert.ok(CHECKS.filter((c) => c.pack === 'GQ').every((c) => c.classes.length === 1 && c.classes[0] === 'GP'))
for (const j of JURISDICTIONS) if (!j.lastVerified) assert.ok(j.requiresVerification, j.code)

// Nigeria (SRG 1 §18): periods BEGINNING on or after 1 Jan 2028 are mandatory; a 2027 start is not.
assert.equal(ifrsApplicability(base, '2028-01-01').status, 'mandatory')
assert.equal(ifrsApplicability(base, '2027-07-01').status, 'not_required')
assert.equal(ifrsApplicability(p({ category: 'ng_sme' }), '2028-01-01').status, 'not_required')
assert.equal(ifrsApplicability(p({ category: 'ng_sme' }), '2030-01-01').status, 'mandatory')
assert.equal(ifrsApplicability(p({ category: 'ng_public' }), '2030-01-01').status, 'other_basis', 'public sector → IPSASB')
assert.equal(ifrsApplicability(p({ adoptingVoluntarily: true }), '2026-01-01').status, 'voluntary')

// Other jurisdictions use their own verified dates.
assert.equal(ifrsApplicability(p({ jurisdiction: 'KE', category: 'ke_pie' }), '2027-01-01').status, 'mandatory')
assert.equal(ifrsApplicability(p({ jurisdiction: 'KE', category: 'ke_sme' }), '2028-01-01').status, 'not_required')
assert.equal(ifrsApplicability(p({ jurisdiction: 'GH', category: 'gh_sector' }), '2027-01-01').status, 'mandatory')
assert.equal(ifrsApplicability(p({ jurisdiction: 'ZM', category: 'zm_pae' }), '2025-01-01').status, 'mandatory')
assert.equal(ifrsApplicability(p({ jurisdiction: 'ZA', category: 'za_any' }), '2028-01-01').status, 'not_required')
assert.equal(ifrsApplicability(p({ jurisdiction: 'ZA', category: 'za_any' }), '2028-01-01').requiresVerification, true)
// Rwanda phases: exchange guidelines → climate-only → full.
assert.equal(ifrsApplicability(p({ jurisdiction: 'RW', category: 'rw_g1_listed' }), '2025-01-01').scope, 'exchange_esg_guidelines')
assert.equal(ifrsApplicability(p({ jurisdiction: 'RW', category: 'rw_g1_listed' }), '2026-01-01').scope, 'climate_only')
assert.equal(ifrsApplicability(p({ jurisdiction: 'RW', category: 'rw_g1_listed' }), '2027-01-01').scope, 'full')

const ids = (prof: QaProfile, start: string) => applicableChecks(prof, start).checks.map((c) => c.check.id)
// Not reporting yet: no S1/S2/FRC checks, but SEC plan checks still apply to SEC-scope entities.
const pre = ids(p({ secScope: true }), '2026-01-01')
assert.ok(!pre.some((i) => i.startsWith('S1-') || i.startsWith('FRC-')))
assert.equal(pre.filter((i) => i.startsWith('SEC-')).length, 8)
// Mandatory NG PIE in 2028: S1, S2, FRC, readiness test; financed emissions only for financial activities.
const ng = ids(base, '2028-01-01')
assert.ok(ng.includes('S1-04') && ng.includes('FRC-09') && ng.includes('NG-01') && !ng.includes('S2-21'))
assert.ok(ids(p({ financialActivities: true }), '2028-01-01').includes('S2-21'))
// General quality and evidence-control checks apply to every report, mandatory or not.
assert.ok(pre.includes('GQ-01') && pre.includes('EC-03'))
// MOFI: mandatory only in scope; benchmark otherwise.
const mofi = applicableChecks(p({ mofiScope: true }), '2028-01-01').checks.find((c) => c.check.id === 'MOFI-01')!
assert.equal(mofi.mandatory, true)
const bench = applicableChecks(p({ mofiOverlay: true }), '2028-01-01').checks.find((c) => c.check.id === 'MOFI-01')!
assert.equal(bench.mandatory, false)
assert.match(bench.label, /Good practice/)
// No Nigerian packs outside Nigeria; Kenya readiness assessment for PIEs; Rwanda climate-only S1 is not mandatory.
const ke = ids(p({ jurisdiction: 'KE', category: 'ke_pie', secScope: true, mofiScope: true }), '2027-01-01')
assert.ok(ke.includes('KE-01') && !ke.some((i) => i.startsWith('SEC-') || i.startsWith('FRC-') || i.startsWith('MOFI-')))
const rw = applicableChecks(p({ jurisdiction: 'RW', category: 'rw_g2' }), '2026-01-01').checks
assert.ok(rw.some((c) => c.check.id === 'RW-02'))
assert.equal(rw.find((c) => c.check.id === 'S1-03')?.mandatory, false)
assert.ok(!ids(p({ jurisdiction: 'RW', category: 'rw_g1_listed' }), '2025-01-01').some((i) => i.startsWith('S1-')), 'RSE guidelines phase')

// Scoring: evidence-gated Met, half credit for partial, approved N/A excluded, gate overrides the score.
const app = applicableChecks(base, '2028-01-01').checks
const allMet: CheckInstance[] = app.map((c) => ({ checkId: c.check.id, status: 'met', evidence: 'accepted', naApproved: false }))
const full = scoreChecklist(app, allMet, true)
assert.equal(full.score, 100)
assert.equal(full.readyForApproval, true)
assert.equal(scoreChecklist(app, allMet, false).readyForApproval, false, 'sign-off required')
const unevidenced = scoreChecklist(app, allMet.map((i) => ({ ...i, evidence: 'pending' as const })), true)
assert.equal(unevidenced.score, 0, 'no points before evidence acceptance')
assert.equal(unevidenced.readyForApproval, false)
// One open critical blocks approval even at a high score.
const oneCritical = allMet.map((i) => (i.checkId === 'S1-04' ? { ...i, status: 'in_progress' as const } : i))
const r = scoreChecklist(app, oneCritical, true)
assert.ok(r.score > 90)
assert.equal(r.readyForApproval, false)
assert.deepEqual(r.criticalOpen, ['S1-04'])
// An approved exception earns nothing and does not clear a critical check.
const exc = scoreChecklist(app, allMet.map((i) => (i.checkId === 'S1-04' ? { ...i, status: 'exception_approved' as const } : i)), true)
assert.deepEqual(exc.criticalOpen, ['S1-04'])
assert.equal(exc.readyForApproval, false)
// Pending review counts as unreviewed evidence.
assert.ok(scoreChecklist(app, allMet.map((i) => (i.checkId === 'GQ-01' ? { ...i, status: 'pending_review' as const } : i)), true).unreviewedEvidence.includes('GQ-01'))
// N/A: excluded only once approved; pending N/A blocks.
const na = allMet.map((i) => (i.checkId === 'S1-14' ? { ...i, status: 'not_applicable' as const, evidence: 'none' as const } : i))
assert.deepEqual(scoreChecklist(app, na, true).pendingNa, ['S1-14'])
const naOk = scoreChecklist(app, na.map((i) => (i.checkId === 'S1-14' ? { ...i, naApproved: true } : i)), true)
assert.equal(naOk.applicable, app.length - 1)
assert.equal(naOk.score, 100)
// Partially met earns half the weight (a high check = 3 points).
const half = scoreChecklist(app, allMet.map((i) => (i.checkId === 'S1-01' ? { ...i, status: 'partially_met' as const } : i)), true)
assert.ok(half.score < 100 && half.score > 98)
assert.equal(scoreChecklist([], [], true).score, 0)

console.log('esg-checklist.test.ts: all assertions passed')
