// The NHOCAT+ methodology report: NHOCAT+ sheet fields, one table per capacity area with four capacity
// score columns, the organisation's column highlighted, evidence rows, and everything escaped.
// Set NHOCAT_REPORT_OUT=<file> to save the sample HTML for a visual check.
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { buildNhocatReportHtml, toCapacityScore } from '../../src/lib/nhocatReport.ts'
import { CRAFT_ONC } from '../../src/lib/indices/craftOnc.ts'

describe('NHOCAT+ methodology report', () => {
  it('prints the NHOCAT+ sheet fields and capacity area tables', () => {
    const scores = Object.fromEntries(CRAFT_ONC.indicators.map((i, n) => [i.id, n % 6]))
    const html = buildNhocatReportHtml({
      orgName: 'NYNETHA', orgEmail: 'nynetha.ng@gmail.com', orgType: 'Civil Society · Network', orgLead: 'National Coordinator',
      assessor: 'Martin Mary Consult', date: '2026-11-09', scores, independent: { [CRAFT_ONC.indicators[0].id]: 4 },
    })
    if (process.env.NHOCAT_REPORT_OUT) writeFileSync(process.env.NHOCAT_REPORT_OUT, html)
    for (const field of ['ORGANISATION NAME', 'ORGANISATION EMAIL', 'ORGANISATION LEAD', 'DATE OF ASSESSMENT', 'ORGANISATION TYPE', 'ORGANISATION PHONE', 'PHONE CONTACT', 'ASSESSOR'])
      assert.ok(html.includes(field), field)
    assert.match(html, /Capacity Area 1: GOVERNANCE AND LEADERSHIP/)
    for (const c of ['Capacity Score 1', 'Capacity Score 2', 'Capacity Score 3', 'Capacity Score 4', 'Domain Score', 'Evidence Sighted']) assert.ok(html.includes(c), c)
    assert.match(html, /<th colspan="2">2026<\/th>.*<th colspan="2">2030<\/th>/s, 'five yearly columns from the assessment year')
    assert.match(html, /Evidence 1\.1/)
    assert.match(html, /class="soe on"/, 'the chosen statement is highlighted')
    assert.match(html, /Independent: 4/)
    assert.match(html, /adopts the official NHOCAT\+ tool methodology and other frameworks to assess and strengthen organisations/)
  })

  it('converts CRAFT 0-5 to the four-point capacity score and escapes input', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5].map((s) => toCapacityScore(s)), [1, 1, 2, 3, 4, 4])
    assert.equal(toCapacityScore(null), null)
    const evil = '<script>alert(1)</script>'
    const html = buildNhocatReportHtml({ orgName: evil, orgLead: evil, scores: {} })
    assert.ok(!html.includes('<script>alert'))
  })
})
