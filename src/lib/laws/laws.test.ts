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
assert.equal(Object.keys(LAW_AREAS).length, 10)
assert.equal(LAW_AREAS.governance, 'Corporate governance codes and regulations')
assert.equal(LAW_AREAS.sustainability, 'Environment, climate and sustainability')
assert.equal(LAW_AREAS.financial, 'Financial reporting and financial regulation')
assert.equal(LAW_AREAS.capital, 'Capital markets and securities')
assert.deepEqual(registerProblems([ok], today), [])
const bad = (patch: Partial<LawEntry>) => registerProblems([{ ...ok, ...patch }], today)
assert.match(bad({ jurisdiction: 'XX' }).join(), /jurisdiction/)
assert.match(bad({ area: 'tax' as never }).join(), /area/)
assert.match(bad({ source: { ...ok.source, url: 'http://x.org' } }).join(), /https/)
assert.match(bad({ source: { ...ok.source, checked: '2027-01-01' } }).join(), /future/)
assert.match(bad({ source: { ...ok.source, checked: '2026-13-40' } }).join(), /date/)
assert.match(bad({ summary: Array(61).fill('word').join(' ') }).join(), /60 words/)
assert.match(bad({ extraQuestions: ['NOPE-01'] }).join(), /unknown question/)
assert.match(registerProblems([ok, ok], today).join(), /duplicate/)
assert.match(bad({ title: '' }).join(), /title/)
assert.deepEqual(registerProblems(LAW_REGISTER, today), [], 'the shipped register is valid')
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
for (const j of PHASE1) for (const a of Object.keys(LAW_AREAS)) assert.ok(PHASE1_LAWS.some((e) => e.jurisdiction === j && e.area === a), `phase 1: ${j} has an entry for ${a}`)
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
