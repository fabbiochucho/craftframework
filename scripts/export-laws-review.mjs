// Writes docs/laws/review-<batch>.md: every entry in a batch for founder / counsel review.
// Run: node scripts/export-laws-review.mjs phase1
import { mkdirSync, writeFileSync } from 'node:fs'
import { LAW_REGISTER, LAW_DATA_VERSION } from '../src/lib/laws/register.ts'
import { LAW_AREAS, jurisdictionName } from '../src/lib/laws/types.ts'

const batch = process.argv[2] ?? 'phase1'
const BATCHES = { phase1: ['NG', 'KE', 'ZA', 'MA', 'EG', 'SN', 'MU', 'CV', 'US', 'UK', 'EU'] }
const ids = BATCHES[batch] ?? batch.split(',')
// Escape backslashes first, then pipes, so text can never break out of its table cell.
const cell = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const rows = LAW_REGISTER.filter((e) => ids.includes(e.jurisdiction))
const out = [
  `# Laws register review — ${batch}`, '',
  `${LAW_DATA_VERSION}. ${rows.length} entries, ${rows.filter((e) => e.source.kind === 'secondary').length} from secondary sources (marked **verify**). Information, not legal advice.`, '',
  "For each jurisdiction: open every source, confirm the title, citation, regulator and summary, check the secondary-source entries most carefully, then tick the box. Only approved entries appear in organisation reports; approve a jurisdiction's entries together.", '',
  "Where an \"official\" link opens a regulator's home page rather than the law itself, replace it with a direct link to the text, or mark the entry secondary.", '',
]
for (const j of ids) {
  out.push(`## ${jurisdictionName(j)} (${j})`, '', '| Id | Area | Law | Citation | Regulator | Summary | Source | Checked | Notes for CRAFT |', '|---|---|---|---|---|---|---|---|---|')
  for (const e of rows.filter((x) => x.jurisdiction === j)) {
    const kind = e.source.kind === 'secondary' ? '**verify** (secondary)' : 'official'
    const notes = (e.craftNotes ?? []).map((n) => `${n.duty}: ${n.note} (${n.status})`).join('; ')
    out.push(`| ${e.id} | ${LAW_AREAS[e.area]} | ${cell(e.title)}${e.noLaw ? ' (no national law)' : ''} | ${cell(e.citation)} | ${cell(e.regulator)} | ${cell(e.summary)}${e.reformNote ? ` _Reform: ${cell(e.reformNote)}_` : ''} | [${kind}](${e.source.url}) | ${e.source.checked} | ${cell(notes)} |`)
  }
  out.push('', `- [ ] ${jurisdictionName(j)} approved by: ____ on ____`, '')
}
mkdirSync('docs/laws', { recursive: true })
writeFileSync(`docs/laws/review-${batch}.md`, out.join('\n'))
console.log(`wrote docs/laws/review-${batch}.md: ${ids.length} jurisdictions, ${rows.length} entries`)
