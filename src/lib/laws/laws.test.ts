// Self-check: `node src/lib/laws/laws.test.ts`
import assert from 'node:assert/strict'
import { LAW_AREAS, LAW_JURISDICTIONS, type LawEntry } from './types.ts'
import { registerProblems } from './validate.ts'
import { LAW_REGISTER, lawsFor } from './register.ts'

const ok: LawEntry = {
  id: 'NG-data-1', jurisdiction: 'NG', area: 'data', title: 'Nigeria Data Protection Act', citation: 'Act No. 37 of 2023',
  regulator: 'Nigeria Data Protection Commission', summary: 'Sets lawful bases for processing personal data and duties for controllers.',
  source: { url: 'https://example.gov.ng/ndpa.pdf', kind: 'official', checked: '2026-10-18' }, review: 'pending',
}
const today = '2026-10-18'
assert.equal(LAW_JURISDICTIONS.length, 57)
assert.ok(LAW_JURISDICTIONS.includes('UK') && LAW_JURISDICTIONS.includes('CV'))
assert.equal(Object.keys(LAW_AREAS).length, 16)
for (const a of ['tax', 'competition', 'consumer', 'sanctions', 'forex', 'licensing']) assert.ok(a in LAW_AREAS, `area ${a}`)
assert.equal(LAW_AREAS.governance, 'Corporate governance codes and regulations')
assert.equal(LAW_AREAS.sustainability, 'Environment, climate and sustainability')
assert.equal(LAW_AREAS.financial, 'Financial reporting and financial regulation')
assert.equal(LAW_AREAS.capital, 'Capital markets and securities')
assert.deepEqual(registerProblems([ok], today), [])
const bad = (patch: Partial<LawEntry>) => registerProblems([{ ...ok, ...patch }], today)
assert.match(bad({ jurisdiction: 'XX' }).join(), /jurisdiction/)
assert.match(bad({ area: 'astrology' as never }).join(), /area/)
assert.match(bad({ source: { ...ok.source, url: 'http://x.org' } }).join(), /https/)
assert.match(bad({ source: { ...ok.source, checked: '2027-01-01' } }).join(), /future/)
assert.match(bad({ source: { ...ok.source, checked: '2026-13-40' } }).join(), /date/)
assert.match(bad({ summary: Array(61).fill('word').join(' ') }).join(), /60 words/)
assert.match(bad({ extraQuestions: ['NOPE-01'] }).join(), /unknown question/)
assert.match(registerProblems([ok, ok], today).join(), /duplicate/)
assert.match(bad({ title: '' }).join(), /title/)
assert.deepEqual(registerProblems(LAW_REGISTER, new Date().toISOString().slice(0, 10)), [], 'the shipped register is valid today')
assert.deepEqual(lawsFor(['NG'], { approvedOnly: true }).filter((e) => e.review !== 'approved'), [])
console.log('laws (register): ok')

import { AREA_QUESTIONS, questionsForLaw } from './mapping.ts'
for (const [area, qs] of Object.entries(AREA_QUESTIONS)) assert.ok(qs.length >= 5, `area ${area} maps to CRAFT questions`)
assert.ok(AREA_QUESTIONS.data.every((q) => q.source === 'core'))
assert.ok(AREA_QUESTIONS.integrity.some((q) => q.id.startsWith('CRAFT-FCR-')), 'fiduciary index counts for integrity')
assert.ok(AREA_QUESTIONS.eia.some((q) => q.id.startsWith('CRAFT-ESS-')), 'safeguards index counts for EIA')
assert.ok(AREA_QUESTIONS.capital.some((q) => q.source === 'ladder'), 'capital readiness questions count for capital markets law')
assert.ok(AREA_QUESTIONS.sustainability.some((q) => q.source === 'esg'), 'ESG answers count for sustainability law')
assert.ok(AREA_QUESTIONS.financial.some((q) => q.source === 'core') && AREA_QUESTIONS.financial.some((q) => q.source === 'ladder'))
const withExtra = questionsForLaw({ ...ok, extraQuestions: ['GOV-01'] })
assert.ok(withExtra.some((q) => q.id === 'GOV-01') && withExtra.length === AREA_QUESTIONS.data.length + 1)
assert.equal(questionsForLaw({ ...ok, extraQuestions: [AREA_QUESTIONS.data[0].id] }).length, AREA_QUESTIONS.data.length, 'no duplicates')
console.log('laws (mapping): ok')

import { PHASE1_LAWS } from './data/phase1.ts'
const PHASE1 = ['NG', 'KE', 'ZA', 'MA', 'EG', 'SN', 'MU', 'CV', 'US', 'UK', 'EU']
for (const j of PHASE1) for (const a of Object.keys(LAW_AREAS)) assert.ok(LAW_REGISTER.some((e) => e.jurisdiction === j && e.area === a), `phase 1: ${j} has an entry for ${a}`)
assert.ok(PHASE1_LAWS.every((e) => e.review === 'pending'), 'new entries start pending')
assert.ok(PHASE1_LAWS.filter((e) => e.area === 'data' && !e.noLaw).every((e) => e.craftNotes?.length), 'every data protection law says what it means for CRAFT')
console.log('laws (phase 1 completeness): ok')

import { buildJurisdictionReport, LAW_FOOTER, reportJurisdictions } from './jurisdictionReport.ts'
const approved = (e: LawEntry): LawEntry => ({ ...e, review: 'approved' })
const fixtures: LawEntry[] = [
  approved(ok),
  approved({ ...ok, id: 'NG-governance-1', area: 'governance', noLaw: true, title: 'No national code' }),
  { ...ok, id: 'KE-data-1', jurisdiction: 'KE' },
]
// Review Focus 1 and 3: no country; non-register ids ignored
assert.deepEqual(reportJurisdictions('', []), [])
assert.deepEqual(reportJurisdictions('NG', ['NG', 'EU', 'OHADA', 'GCC', 'ASIA']), ['NG', 'EU'])
assert.deepEqual(buildJurisdictionReport([], {}, {}, [], fixtures).sections, [])
const jr = buildJurisdictionReport(['NG', 'KE'], {}, {}, [], fixtures)
const ng = jr.sections.find((s) => s.id === 'NG')!
assert.equal(ng.reviewed, true)
assert.equal(ng.areas.find((a) => a.area === 'data')!.laws[0].coverage, 'not-assessed')
// Review Focus 4: no law in an area is never a gap
assert.equal(ng.areas.find((a) => a.area === 'governance')!.laws[0].coverage, 'no-law')
// Review Focus 2: only pending entries → not reviewed, nothing shown
const ke = jr.sections.find((s) => s.id === 'KE')!
assert.equal(ke.reviewed, false)
assert.deepEqual(ke.areas, [])
// Scores drive the rating
const low = Object.fromEntries(AREA_QUESTIONS.data.map((q) => [q.id, 0]))
assert.equal(buildJurisdictionReport(['NG'], low, {}, [], fixtures).sections[0].areas.find((a) => a.area === 'data')!.laws[0].coverage, 'gap')
assert.ok(jr.footer.startsWith(LAW_FOOTER))
assert.ok(!/\b(compliant|certified)\b|compliance with/i.test(JSON.stringify({ t: jr.title, f: LAW_FOOTER })))
console.log('laws (report): ok')

import { buildInternalCheck } from './internalCheck.ts'
const notes: LawEntry = { ...ok, id: 'NG-data-2', craftNotes: [{ duty: 'registration', note: 'Register with NDPC', status: 'done' }, { duty: 'cross-border', note: 'Transfer basis', status: 'needed' }] }
const stale: LawEntry = { ...ok, id: 'NG-labour-1', area: 'labour', source: { ...ok.source, checked: '2025-10-17' } }
const fresh: LawEntry = { ...ok, id: 'NG-labour-2', area: 'labour', source: { ...ok.source, checked: '2025-10-18' } }
const ic = buildInternalCheck([notes, stale, fresh], '2026-10-18')
assert.equal(ic.duties[0].status, 'needed', 'needed duties first')
assert.deepEqual(ic.recheckDue.map((e) => e.id), ['NG-labour-1'], 'older than 12 months is due; exactly 12 months is not')
assert.deepEqual(ic.pending, [{ jurisdiction: 'NG', count: 3 }])
console.log('laws (internal check): ok')

// Final review: partial approval is visible; the CSV explains unreviewed and partly reviewed jurisdictions
import { jurisdictionCsvRows } from './jurisdictionReport.ts'
const partial = buildJurisdictionReport(['NG', 'KE'], {}, {}, [], [...fixtures, { ...ok, id: 'NG-labour-9', area: 'labour' }])
assert.equal(partial.sections.find((s) => s.id === 'NG')!.pendingCount, 1, 'pending entries in a reviewed jurisdiction are counted')
assert.equal(partial.sections.find((s) => s.id === 'KE')!.pendingCount, 1)
const csvRows = jurisdictionCsvRows(partial)
assert.ok(csvRows.some((r) => r[0] === 'Kenya' && r[2] === 'Not yet reviewed'), 'unreviewed jurisdiction gets a CSV row')
assert.ok(csvRows.some((r) => r[0] === 'Nigeria' && /1 entry still awaiting review/.test(String(r[2]))), 'partly reviewed jurisdiction says so in the CSV')
assert.ok(csvRows.some((r) => r[0] === 'Nigeria' && r[2] === 'Nigeria Data Protection Act'), 'approved laws still listed')
console.log('laws (final review fixes): ok')

// Every jurisdiction in the register covers all areas, and phase 2 entries start pending
for (const j of new Set(LAW_REGISTER.map((e) => e.jurisdiction))) for (const a of Object.keys(LAW_AREAS)) assert.ok(LAW_REGISTER.some((e) => e.jurisdiction === j && e.area === a), `${j} has an entry for ${a}`)
assert.ok(LAW_REGISTER.filter((e) => !PHASE1.includes(e.jurisdiction)).every((e) => e.review === 'pending'), 'phase 2 entries start pending')
console.log('laws (all jurisdictions complete): ok')

// Batch A, task 1: deferred review fixes in the data
const byId = (id: string) => LAW_REGISTER.find((e) => e.id === id)!
for (const id of ['US-company-1', 'US-data-1', 'SN-governance-1', 'CV-governance-1']) assert.ok(!byId(id).noLaw, `${id} is rated, not "no national law"`)
assert.equal(byId('NG-sustainability-1').source.kind, 'secondary')
assert.equal(byId('EG-company-2').source.url, 'https://www.icnl.org/resources/civic-freedom-monitor/egypt')
console.log('laws (batch A data fixes): ok')

// Batch A, task 2: organisations see when an entry is due for re-checking
import { isRecheckDue } from './jurisdictionReport.ts'
assert.equal(isRecheckDue({ ...ok, source: { ...ok.source, checked: '2025-10-17' } }, '2026-10-18'), true)
assert.equal(isRecheckDue({ ...ok, source: { ...ok.source, checked: '2025-10-18' } }, '2026-10-18'), false)
const staleReport = buildJurisdictionReport(['NG'], {}, {}, [], [approved({ ...ok, source: { ...ok.source, checked: '2024-01-01' } })], [], '2026-10-18')
assert.equal(staleReport.sections[0].areas[0].laws[0].recheckDue, true)
console.log('laws (re-check warning): ok')

// Batch A, task 3: in-app approval per jurisdiction
import { applyApprovals } from './jurisdictionReport.ts'
const pend: LawEntry[] = [ok, { ...ok, id: 'KE-data-1', jurisdiction: 'KE' }]
assert.deepEqual(applyApprovals(pend, ['NG']).map((e) => e.review), ['approved', 'pending'])
assert.equal(buildJurisdictionReport(['NG'], {}, {}, [], pend, ['NG']).sections[0].reviewed, true, 'an approved jurisdiction shows its laws')
assert.equal(buildJurisdictionReport(['KE'], {}, {}, [], pend, ['NG']).sections[0].reviewed, false)
assert.deepEqual(buildInternalCheck(pend, '2026-10-18', ['NG']).pending, [{ jurisdiction: 'KE', count: 1 }], 'approved jurisdictions leave the pending list')
console.log('laws (approvals): ok')

// Batch A, task 4: onboarding offers every country the register covers
import { COUNTRIES } from '../countries.ts'
assert.equal(COUNTRIES.length, 56, '54 African countries plus the UK and US')
assert.deepEqual(COUNTRIES.slice(0, 3).map((c) => c.code), ['NG', 'KE', 'RW'], 'the familiar ten stay first')
for (const c of COUNTRIES) assert.ok(LAW_JURISDICTIONS.includes(c.code), `${c.code} is a register jurisdiction`)
assert.equal(COUNTRIES.find((c) => c.code === 'UK')!.flag, '\u{1F1EC}\u{1F1E7}')
assert.equal(new Set(COUNTRIES.map((c) => c.code)).size, 56)
console.log('laws (onboarding countries): ok')

// PR #88 review: an approval only counts for the register version it was given for
import { currentApprovals } from './jurisdictionReport.ts'
{
  const recs = [
    { jurisdiction: 'NG', registerVersion: 'CRAFT-LAW 1.2 (2026-10-18)' },
    { jurisdiction: 'KE', registerVersion: 'CRAFT-LAW 1.1 (2026-10-01)' },
  ]
  assert.deepEqual(currentApprovals(recs, 'CRAFT-LAW 1.2 (2026-10-18)'), ['NG'], 'an approval for an earlier register version needs re-approval')
  console.log('laws (approval versions): ok')
}
