// A printable report of CRAFT Organisational & Network Capacity Index results laid out like an NHOCAT+
// assessment sheet: the same header fields (organisation name, email, lead, date, type, phone, contact,
// assessor) and, per capacity area (NHOCAT domain), a table with Domain | Capacity Score 1-4 | Domain Score |
// Evidence Sighted, yearly score columns and an Evidence row under each domain.
//
// CRAFT scores each indicator 0-5 against six level statements. For the four "Capacity Score" columns the
// report shows CRAFT's level 1, 2, 3 and 5 statements, and converts the 0-5 score to 1-4
// (0-1 → 1, 2 → 2, 3 → 3, 4-5 → 4); the chosen column is highlighted. It is a read-across from CRAFT's own
// indicators, not the official NHOCAT+ instrument, and the report says so.
import { CRAFT_ONC, byNhocatDomain } from './indices/craftOnc'
import { esc } from './inviteEmail'
import { BRAND } from './data'

export type NhocatReportInput = {
  orgName: string
  orgEmail?: string
  orgType?: string
  orgPhone?: string
  orgLead?: string
  phoneContact?: string
  assessor?: string
  /** Date of assessment (YYYY-MM-DD); default today. */
  date?: string
  /** Self-assessment scores keyed by indicator id (0-5). */
  scores: Record<string, number>
  /** Optional independent assessor scores keyed by indicator id (0-5). */
  independent?: Record<string, number>
  /** Optional evidence sighted per indicator id (e.g. document names). */
  evidenceSighted?: Record<string, string>
}

/** CRAFT 0-5 → the four-point capacity score. */
export function toCapacityScore(score: number | null | undefined): 1 | 2 | 3 | 4 | null {
  if (score == null || !Number.isFinite(score)) return null
  if (score < 1.5) return 1
  if (score < 2.5) return 2
  if (score < 3.5) return 3
  return 4
}

const LEVEL_FOR_COLUMN = [1, 2, 3, 5] as const

export function buildNhocatReportHtml(input: NhocatReportInput): string {
  const date = input.date ?? new Date().toISOString().slice(0, 10)
  const year = Number(date.slice(0, 4)) || new Date().getFullYear()
  const years = [year, year + 1, year + 2, year + 3, year + 4]
  const domains = byNhocatDomain(input.scores)
  const indicatorsFor = (domain: string) =>
    CRAFT_ONC.indicators.filter((i) => (i.crosswalk ?? []).some((r) => r.framework === 'nhocat' && r.ref === domain))
  const indep = input.independent ?? {}
  const hasIndep = Object.keys(indep).length > 0
  const sighted = input.evidenceSighted ?? {}
  const v = (s?: string) => esc(s?.trim() ?? '')

  const header = `
<table class="head">
  <tr>
    <td class="brand" rowspan="4">ORGANISATIONAL<br>CAPACITY<br>ASSESSMENT</td>
    <th>ORGANISATION NAME</th><th>ORGANISATION EMAIL</th><th>ORGANISATION LEAD</th><th>DATE OF ASSESSMENT</th>
  </tr>
  <tr><td>${v(input.orgName)}</td><td>${v(input.orgEmail)}</td><td>${v(input.orgLead)}</td><td>${esc(date)}</td></tr>
  <tr><th>ORGANISATION TYPE</th><th>ORGANISATION PHONE</th><th>PHONE CONTACT</th><th>ASSESSOR</th></tr>
  <tr><td>${v(input.orgType)}</td><td>${v(input.orgPhone)}</td><td>${v(input.phoneContact)}</td><td>${v(input.assessor)}</td></tr>
</table>`

  const yearHead = years.map((y) => `<th colspan="2">${y}</th>`).join('')
  const yearSub = years.map(() => '<th>Domain Score</th><th>Evidence Sighted</th>').join('')

  const areas = domains.map((d, n) => {
    const rows = indicatorsFor(d.domain).map((i, k) => {
      const raw = input.scores[i.id]
      const cap = toCapacityScore(raw)
      const capInd = toCapacityScore(indep[i.id])
      const cols = LEVEL_FOR_COLUMN.map((lvl, c) =>
        `<td class="soe${cap === c + 1 ? ' on' : ''}">${esc(i.soe[lvl])}</td>`).join('')
      const scoreCell = cap == null ? '—' : `${cap}${hasIndep ? `<div class="ind">Independent: ${capInd ?? '—'}</div>` : ''}`
      const yearCells = years.map((_y, j) => j === 0
        ? `<td class="n">${scoreCell}</td><td>${v(sighted[i.id])}</td>`
        : '<td></td><td></td>').join('')
      return `<tr>
          <td class="dom"><strong>${n + 1}.${k + 1}: ${esc(i.domain)}</strong></td>${cols}${yearCells}
        </tr>
        <tr class="ev"><td class="dom">Evidence ${n + 1}.${k + 1}</td><td colspan="4">${esc(i.evidence ?? '')}</td>${years.map(() => '<td></td><td></td>').join('')}</tr>`
    }).join('')
    const areaScore = d.score == null ? '' : ` · area score ${toCapacityScore(d.score)} of 4`
    return `<h2>Capacity Area ${n + 1}: ${esc(d.label.toUpperCase())}<span>${areaScore}</span></h2>
<table class="area">
  <thead>
    <tr><th rowspan="2" class="dom">Domain</th><th rowspan="2">Capacity Score 1</th><th rowspan="2">Capacity Score 2</th><th rowspan="2">Capacity Score 3</th><th rowspan="2">Capacity Score 4</th>${yearHead}</tr>
    <tr>${yearSub}</tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`
  }).join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(input.orgName)} — Organisational Capacity Assessment (NHOCAT read-across)</title>
<style>
  @page{size:A4 landscape;margin:8mm}
  body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:16px;font-size:9.5px}
  h1{font-size:15px;text-align:center;margin:0 0 8px;letter-spacing:.5px}
  h2{font-size:11.5px;margin:16px 0 4px;background:#1e3a5f;color:#fff;padding:5px 8px}
  h2 span{font-weight:400;font-size:10px}
  table{width:100%;border-collapse:collapse} th,td{border:1px solid #94a3b8;padding:4px;vertical-align:top;text-align:left}
  th{background:#e2e8f0;font-size:9px}
  .head th{background:#dbeafe;text-align:center} .head td{text-align:center;height:16px}
  .brand{background:#1e3a5f;color:#fff;font-weight:700;text-align:center;vertical-align:middle;width:16%}
  .area .dom{width:12%} .soe{width:13%} .soe.on{background:#fef08a;font-weight:600}
  td.n{text-align:center;font-weight:700;font-size:11px} .ind{font-weight:400;font-size:8.5px;color:#334155}
  tr.ev td{background:#f8fafc;font-style:italic;color:#334155}
  .note{color:#475569;font-size:9px;margin-top:10px}
  .sign td{border:none;padding-top:22px}
  @media print{h2{page-break-after:avoid} tr{page-break-inside:avoid}}
</style></head><body>
<h1>ORGANISATIONAL CAPACITY ASSESSMENT TOOL — NHOCAT READ-ACROSS</h1>
${header}
${areas}
<p class="note">Produced by ${esc(BRAND.product)} from the ${esc(CRAFT_ONC.title)}, arranged by the NHOCAT domains. Each CRAFT indicator is scored 0-5 against six level statements (similar to Statements of Excellence); the four Capacity Score columns show the level 1, 2, 3 and 5 statements and the highlighted column is the organisation's score converted to 1-4.${hasIndep ? ' Independent scores are the independent assessor’s.' : ''} This is a read-across from ${esc(BRAND.product)}, not the official NHOCAT+ instrument. "Evidence Sighted" is for the assessor to complete.</p>
<table class="sign"><tr><td>Organisation lead: ____________________________</td><td>Assessor: ____________________________</td><td>Date: ________________</td></tr></table>
</body></html>`
}
