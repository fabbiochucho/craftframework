# Laws Register and Jurisdiction Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sourced register of laws in seven areas for 57 jurisdictions, an organisation-facing jurisdiction alignment report, and a Super Admin internal check; phase 1 fills 11 jurisdictions locally, phase 2 fills the other 46 through cloud routines.

**Architecture:** Plain TypeScript data files under `src/lib/laws/data/`, validated by a node self-check. Each law maps to CRAFT questions by area (via `INDICATOR_CATALOGUE`) plus per-law extras, and is rated with the existing `coverageOf`. A pure report builder feeds a printable view on the Reports page; a pure internal-check builder feeds a new Admin tab.

**Tech Stack:** TanStack Start (React 19), TypeScript strict, Tailwind v4 `print:` variants, node `assert` self-checks run with `node file.test.ts` (imports need `.ts` extensions).

**Spec:** `docs/superpowers/specs/2026-10-18-laws-register-design.md`

## Global Constraints

- Jurisdictions: the 54 AU members (ISO alpha-2 as in `src/lib/africa-countries.ts`) plus `EU`, `UK`, `US`.
- Areas: `company`, `data`, `integrity`, `procurement`, `governance`, `labour`, `eia`, `sustainability`, `financial`, `capital` (the last three added at the owner's request; `governance` widened to codes and regulations). Each area records all the main acts, regulations and codes.
- In force only; at most a one-line `reformNote`.
- Sources: official text first; else a reputable secondary source with `kind: 'secondary'` ("secondary source, verify"). Every entry has `checked: 'YYYY-MM-DD'`.
- `summary` ≤ 60 words, CRAFT's own words; no statute text copied.
- Reports say "readiness"/"alignment", never "compliant", "compliance with" or "certified".
- Only `review: 'approved'` entries reach organisation reports; all new entries start `'pending'`.
- Report footer: "This report is information to support readiness, not legal advice. Laws change; check the cited source and take local legal advice before relying on it." followed by `ATTRIBUTION_NOTICE`.
- Re-check due when `checked` is more than 12 months old.
- Never merge or deploy without the owner's approval; verify the Netlify deploy, not just CI.

## Review Focus

1. Organisation with no `country` and no jurisdictions → the report card asks the user to choose jurisdictions; nothing crashes. (Task 4 test)
2. Jurisdiction whose entries are all `pending` → "Not yet reviewed", no ratings, no law text shown. (Task 4 test)
3. Entity-profile jurisdictions that are not in the register (`OHADA`, `GCC`, `ASIA`) → ignored, never shown as an empty section. (Task 4 test)
4. An area with no national law (`noLaw: true`) → shown as "No national law in this area", never rated as a gap. (Task 4 test)
5. `checked` in the future or an invalid date → rejected by validation; older than 12 months → listed as re-check due. (Tasks 1 and 6 tests)

## Phase 2 jurisdictions (cloud, not built locally)

| Batch | Jurisdictions |
|---|---|
| North (4) | DZ Algeria, LY Libya, MR Mauritania, TN Tunisia |
| West (12) | BJ Benin, BF Burkina Faso, CI Côte d’Ivoire, GM The Gambia, GH Ghana, GN Guinea, GW Guinea-Bissau, LR Liberia, ML Mali, NE Niger, SL Sierra Leone, TG Togo |
| Central (9) | BI Burundi, CM Cameroon, CF Central African Republic, TD Chad, CG Republic of the Congo, CD Democratic Republic of the Congo, GQ Equatorial Guinea, GA Gabon, ST São Tomé and Príncipe |
| East (12) | KM Comoros, DJ Djibouti, ER Eritrea, ET Ethiopia, MG Madagascar, RW Rwanda, SC Seychelles, SO Somalia, SS South Sudan, SD Sudan, TZ Tanzania, UG Uganda |
| Southern (9) | AO Angola, BW Botswana, SZ Eswatini, LS Lesotho, MW Malawi, MZ Mozambique, NA Namibia, ZM Zambia, ZW Zimbabwe |

Phase 1 (local): NG Nigeria, KE Kenya, ZA South Africa, MA Morocco, EG Egypt, SN Senegal, MU Mauritius, CV Cape Verde, US, UK, EU (European Union level only; not member-state law).

## File Structure

- Create `src/lib/laws/types.ts` — types and `LAW_AREAS`, `LAW_JURISDICTIONS`.
- Create `src/lib/laws/validate.ts` — `registerProblems(entries, today)`.
- Create `src/lib/laws/register.ts` — `LAW_REGISTER`, `LAW_DATA_VERSION`, `lawsFor`.
- Create `src/lib/laws/mapping.ts` — `AREA_QUESTIONS`, `questionsForLaw`.
- Create `src/lib/laws/data/phase1.ts` — phase 1 entries.
- Create `src/lib/laws/jurisdictionReport.ts` — `buildJurisdictionReport`.
- Create `src/lib/laws/internalCheck.ts` — `buildInternalCheck`.
- Create `src/lib/laws/laws.test.ts` — all self-checks for the folder.
- Create `src/components/reports/JurisdictionReportView.tsx`.
- Modify `src/pages/ReportsPage.tsx` — fourth card, print target, CSV.
- Modify `src/pages/AdminPage.tsx` — "Laws register" tab.
- Create `scripts/export-laws-review.mjs` → `docs/laws/review-<batch>.md`.
- Modify `package.json` — add `node src/lib/laws/laws.test.ts` to `test`.

---

### Task 1: Types, register and validation

**Files:** Create `src/lib/laws/types.ts`, `src/lib/laws/validate.ts`, `src/lib/laws/register.ts`, `src/lib/laws/data/phase1.ts` (empty array for now), `src/lib/laws/laws.test.ts`; Modify `package.json`.

**Interfaces:**
- Produces: `LawArea`, `LawEntry`, `LAW_AREAS: Record<LawArea, string>`, `LAW_JURISDICTIONS: string[]`, `jurisdictionName(id): string`, `registerProblems(entries: LawEntry[], today: string): string[]`, `LAW_REGISTER: LawEntry[]`, `LAW_DATA_VERSION: string`, `lawsFor(jurisdictions: string[], opts?: { approvedOnly?: boolean }): LawEntry[]`.

- [ ] **Step 1: Write the failing test** (`src/lib/laws/laws.test.ts`)

```ts
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
assert.equal(Object.keys(LAW_AREAS).length, 7)
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
```

- [ ] **Step 2: Run** `node src/lib/laws/laws.test.ts` — Expected: FAIL, cannot find module `./types.ts`.

- [ ] **Step 3: Implement**

`src/lib/laws/types.ts`:
```ts
// The laws register: the laws in seven areas that apply in each jurisdiction CRAFT serves.
// Information to support readiness, not legal advice. Spec: docs/superpowers/specs/2026-10-18-laws-register-design.md
import { AFRICA_COUNTRIES } from '../africa-countries.ts'

export type LawArea = 'company' | 'data' | 'integrity' | 'procurement' | 'governance' | 'labour' | 'eia'
export type SourceKind = 'official' | 'secondary'
export type ReviewStatus = 'pending' | 'approved'
export type CraftDuty = 'registration' | 'cross-border' | 'local-representative' | 'breach-notice' | 'wording' | 'other'

export interface LawEntry {
  id: string
  jurisdiction: string
  area: LawArea
  title: string
  citation: string
  regulator: string | null
  summary: string
  source: { url: string; kind: SourceKind; checked: string }
  /** True when the jurisdiction has no national law in this area; the summary says what applies instead. */
  noLaw?: boolean
  extraQuestions?: string[]
  craftNotes?: { duty: CraftDuty; note: string; status: 'done' | 'needed' | 'n/a' }[]
  reformNote?: string
  review: ReviewStatus
}

export const LAW_AREAS: Record<LawArea, string> = {
  company: 'Company and non-profit law', data: 'Data protection and privacy', integrity: 'Anti-corruption and anti-money-laundering',
  procurement: 'Public procurement', governance: 'Corporate governance codes', labour: 'Labour and employment', eia: 'Environmental impact assessment',
}

const OTHER: Record<string, string> = { EU: 'European Union', UK: 'United Kingdom', US: 'United States' }
export const LAW_JURISDICTIONS: string[] = [...AFRICA_COUNTRIES.map((c) => c.iso2), ...Object.keys(OTHER)]
export const jurisdictionName = (id: string): string => OTHER[id] ?? AFRICA_COUNTRIES.find((c) => c.iso2 === id)?.name ?? id
```

`src/lib/laws/validate.ts`:
```ts
import { INDICATOR_CATALOGUE } from '../crosswalkExisting.ts'
import { LAW_AREAS, LAW_JURISDICTIONS, type LawEntry } from './types.ts'

const KNOWN_QUESTIONS = new Set(INDICATOR_CATALOGUE.map((e) => e.id))
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s

/** Everything wrong with a set of entries; empty when all are valid. `today` is YYYY-MM-DD. */
export function registerProblems(entries: LawEntry[], today: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    const p = (m: string) => out.push(`${e.id}: ${m}`)
    if (seen.has(e.id)) p('duplicate id')
    seen.add(e.id)
    if (!LAW_JURISDICTIONS.includes(e.jurisdiction)) p(`unknown jurisdiction "${e.jurisdiction}"`)
    if (!(e.area in LAW_AREAS)) p(`unknown area "${e.area}"`)
    for (const k of ['title', 'citation', 'summary'] as const) if (!e[k]?.trim()) p(`missing ${k}`)
    if (e.summary.trim().split(/\s+/).length > 60) p('summary over 60 words')
    if (!e.source.url.startsWith('https://')) p('source must be https')
    if (!validDate(e.source.checked)) p('checked is not a valid date')
    else if (e.source.checked > today) p('checked date is in the future')
    for (const q of e.extraQuestions ?? []) if (!KNOWN_QUESTIONS.has(q)) p(`unknown question "${q}"`)
  }
  return out
}
```

`src/lib/laws/data/phase1.ts`:
```ts
// Phase 1: NG, KE, ZA, MA, EG, SN, MU, CV, US, UK, EU. Entries start `review: 'pending'` until the founders approve them.
import type { LawEntry } from '../types.ts'

export const PHASE1_LAWS: LawEntry[] = []
```

`src/lib/laws/register.ts`:
```ts
import { PHASE1_LAWS } from './data/phase1.ts'
import type { LawEntry } from './types.ts'

export const LAW_DATA_VERSION = 'CRAFT-LAW 1.0 (2026-10-18)'
/** Every batch's entries. Phase 2 batches are appended here as their data files land. */
export const LAW_REGISTER: LawEntry[] = [...PHASE1_LAWS]

export function lawsFor(jurisdictions: string[], opts: { approvedOnly?: boolean } = {}): LawEntry[] {
  return LAW_REGISTER.filter((e) => jurisdictions.includes(e.jurisdiction) && (!opts.approvedOnly || e.review === 'approved'))
}
```

Add ` && node src/lib/laws/laws.test.ts` to the end of the `test` script in `package.json`.

- [ ] **Step 4: Run** `node src/lib/laws/laws.test.ts` — Expected: `laws (register): ok`.
- [ ] **Step 5: Commit** `git add src/lib/laws package.json && git commit -m "feat(laws): register types, validation and empty phase 1 file"`

---

### Task 2: Area mapping to CRAFT questions

**Files:** Create `src/lib/laws/mapping.ts`; Modify `src/lib/laws/laws.test.ts`.

**Interfaces:**
- Consumes: `LawArea`, `LawEntry` (Task 1); `INDICATOR_CATALOGUE`, `CatalogueEntry` from `src/lib/crosswalkExisting.ts`; `MOCK_QUESTIONS` from `src/lib/data.ts`; `LADDER_INDICATORS` from `src/lib/capitalReadiness.ts`.
- Produces: `AREA_QUESTIONS: Record<LawArea, CatalogueEntry[]>`, `questionsForLaw(e: LawEntry): CatalogueEntry[]`.

- [ ] **Step 1: Append failing test**

```ts
import { AREA_QUESTIONS, questionsForLaw } from './mapping.ts'
for (const [area, qs] of Object.entries(AREA_QUESTIONS)) assert.ok(qs.length >= 5, `area ${area} maps to CRAFT questions`)
assert.ok(AREA_QUESTIONS.data.every((q) => q.source === 'core'))
assert.ok(AREA_QUESTIONS.integrity.some((q) => q.id.startsWith('CRAFT-FCR-')), 'fiduciary index counts for integrity')
assert.ok(AREA_QUESTIONS.eia.some((q) => q.id.startsWith('CRAFT-ESS-')), 'safeguards index counts for EIA')
const withExtra = questionsForLaw({ ...ok, extraQuestions: ['GOV-01'] })
assert.ok(withExtra.some((q) => q.id === 'GOV-01') && withExtra.length === AREA_QUESTIONS.data.length + 1)
assert.equal(questionsForLaw({ ...ok, extraQuestions: [AREA_QUESTIONS.data[0].id] }).length, AREA_QUESTIONS.data.length, 'no duplicates')
console.log('laws (mapping): ok')
```

- [ ] **Step 2: Run** — Expected: FAIL, cannot find `./mapping.ts`.
- [ ] **Step 3: Implement** `src/lib/laws/mapping.ts`:

```ts
// Which CRAFT questions show readiness for each area of law. Set once per area; a law may add more (`extraQuestions`).
import { INDICATOR_CATALOGUE, type CatalogueEntry } from '../crosswalkExisting.ts'
import { MOCK_QUESTIONS } from '../data.ts'
import { LADDER_INDICATORS } from '../capitalReadiness.ts'
import type { LawArea, LawEntry } from './types.ts'

const RULES: Record<LawArea, { core?: string[]; ladder?: string[]; prefix?: string[] }> = {
  company: { core: ['Legal & Regulatory', 'Governance & Leadership'], ladder: ['Legal Structure & Registration'] },
  data: { core: ['Digital Systems & Cyber'] },
  integrity: { core: ['Ethics & Anti-Fraud', 'Risk & Internal Controls'], prefix: ['CRAFT-FCR-'] },
  procurement: { core: ['Procurement & Supply Chain'] },
  governance: { core: ['Governance & Leadership', 'Audit & Assurance'], ladder: ['Core Governance & Leadership', 'Transparent Governance & Reporting'] },
  labour: { core: ['Human Resources'], ladder: ['Social Value & Human Capital'] },
  eia: { core: ['Env. & Social Safeguards'], prefix: ['CRAFT-ESS-'] },
}
const coreDomain = new Map(MOCK_QUESTIONS.map((q) => [q.id, q.domain]))
const ladderDomain = new Map(LADDER_INDICATORS.map((q) => [q.id, q.domain]))

export const AREA_QUESTIONS = Object.fromEntries(Object.entries(RULES).map(([area, r]) => [area, INDICATOR_CATALOGUE.filter((e) =>
  (e.source === 'core' && r.core?.includes(coreDomain.get(e.id) ?? '')) ||
  (e.source === 'ladder' && r.ladder?.includes(ladderDomain.get(e.id) ?? '')) ||
  (r.prefix ?? []).some((p) => e.id.startsWith(p)))])) as Record<LawArea, CatalogueEntry[]>

export function questionsForLaw(e: LawEntry): CatalogueEntry[] {
  const base = AREA_QUESTIONS[e.area]
  const extra = INDICATOR_CATALOGUE.filter((q) => e.extraQuestions?.includes(q.id) && !base.includes(q))
  return [...base, ...extra]
}
```

- [ ] **Step 4: Run** — Expected: `laws (register): ok`, `laws (mapping): ok`.
- [ ] **Step 5: Commit** `git commit -am "feat(laws): map each area of law to CRAFT questions"` (add `mapping.ts` first).

---

### Task 3: Phase 1 research and entries (NG, KE, ZA, MA, EG, SN, MU, CV, US, UK, EU)

**Files:** Modify `src/lib/laws/data/phase1.ts`, `src/lib/laws/laws.test.ts`.

**Interfaces:** Consumes `LawEntry` (Task 1). Produces populated `PHASE1_LAWS`.

- [ ] **Step 1: Append failing completeness test**

```ts
import { PHASE1_LAWS } from './data/phase1.ts'
const PHASE1 = ['NG', 'KE', 'ZA', 'MA', 'EG', 'SN', 'MU', 'CV', 'US', 'UK', 'EU']
for (const j of PHASE1) for (const a of Object.keys(LAW_AREAS)) assert.ok(PHASE1_LAWS.some((e) => e.jurisdiction === j && e.area === a), `phase 1: ${j} has an entry for ${a}`)
assert.ok(PHASE1_LAWS.every((e) => e.review === 'pending'), 'new entries start pending')
assert.ok(PHASE1_LAWS.filter((e) => e.area === 'data' && !e.noLaw).every((e) => e.craftNotes?.length), 'every data protection law says what it means for CRAFT')
console.log('laws (phase 1 completeness): ok')
```

- [ ] **Step 2: Run** — Expected: FAIL `phase 1: NG has an entry for company`.

- [ ] **Step 3: Research, one jurisdiction at a time, in this order: NG, KE, ZA, US, UK, EU, MU, EG, MA, SN, CV.** For each of the seven areas:
  1. Search for the law in force (`WebSearch`, standard mode; extended only when standard is thin). Find the **official** text: government gazette, ministry, regulator, legislature, `eur-lex.europa.eu`, `legislation.gov.uk`, `uscode.house.gov` / `ecfr.gov`, `kenyalaw.org`, `gov.za`, `sgg.gov.ma`, `mauritiusassembly.govmu.org`, `jo.gov.sn`, `ilo.org/dyn/natlex` (secondary). Open the page (`WebFetch`) to confirm the title, number and year.
  2. If no official copy is online, cite the best secondary source (UNCTAD, World Bank, ILO NATLEX, OECD, a law-firm guide) with `kind: 'secondary'`.
  3. Write the summary in CRAFT's own words, ≤ 60 words, describing the obligations an organisation faces. Never paste statute text.
  4. For `data` laws add `craftNotes` covering at least: registration with the regulator, cross-border transfer conditions, breach-notice deadline, local representative — each with `status: 'needed'` unless already known to be done or not applicable.
  5. Where there is genuinely no national law in an area (e.g. no national governance code), add an entry with `noLaw: true`, a title such as "No national corporate governance code", a summary naming what applies instead, and a source showing that.
  6. Use `checked: '<today>'`, `review: 'pending'`, id `${J}-${area}-${n}`.
  7. Starting candidates to confirm (verify each; replace any that is superseded):
     - NG: Companies and Allied Matters Act 2020; Nigeria Data Protection Act 2023; Corrupt Practices and Other Related Offences Act 2000; Money Laundering (Prevention and Prohibition) Act 2022; Public Procurement Act 2007; Nigerian Code of Corporate Governance 2018; Labour Act (Cap L1 LFN 2004); Environmental Impact Assessment Act (Cap E12 LFN 2004).
     - KE: Companies Act 2015; Data Protection Act 2019; Anti-Corruption and Economic Crimes Act 2003; Proceeds of Crime and Anti-Money Laundering Act 2009; Public Procurement and Asset Disposal Act 2015; CMA Code of Corporate Governance Practices for Issuers 2015; Employment Act 2007; Environmental Management and Co-ordination Act 1999.
     - ZA: Companies Act 71 of 2008; Protection of Personal Information Act 4 of 2013; Prevention and Combating of Corrupt Activities Act 12 of 2004; Financial Intelligence Centre Act 38 of 2001; Public Finance Management Act 1999 / PPPFA 2000; King IV Report (voluntary code); Labour Relations Act 66 of 1995; National Environmental Management Act 107 of 1998.
     - US: federal law only (Foreign Corrupt Practices Act; Bank Secrecy Act; Federal Acquisition Regulation; Sarbanes-Oxley Act; Fair Labor Standards Act; National Environmental Policy Act; state-law note for companies and data — `company` and `data` entries say incorporation and privacy are mainly state law, naming Delaware General Corporation Law and the California Consumer Privacy Act as examples, and HIPAA/FTC Act as federal).
     - UK: Companies Act 2006; UK GDPR and Data Protection Act 2018; Bribery Act 2010; Money Laundering Regulations 2017; Procurement Act 2023; UK Corporate Governance Code 2024; Employment Rights Act 1996; Town and Country Planning (EIA) Regulations 2017.
     - EU: EU-level instruments only (Directive (EU) 2017/1132 on company law; GDPR (EU) 2016/679; AML Regulation (EU) 2024/1624 and anti-corruption conventions; Public Procurement Directive 2014/24/EU; Corporate Sustainability Reporting Directive (EU) 2022/2464 with a note that governance codes are national; Directives on working conditions (EU) 2019/1152 and working time 2003/88/EC; EIA Directive 2011/92/EU as amended by 2014/52/EU). Each summary notes that member states transpose directives.
     - MU, EG, MA, SN, CV: research from scratch with the same seven areas (SN: OHADA Uniform Acts apply for company law; CV: Lusophone sources, Portuguese titles with English gloss).
  8. After each jurisdiction, run `node src/lib/laws/laws.test.ts` and fix any validation problem before moving on.

  Entry shape (example only — confirm every value from the source before use):
```ts
{
  id: 'UK-integrity-1', jurisdiction: 'UK', area: 'integrity', title: 'Bribery Act 2010', citation: '2010 c. 23',
  regulator: 'Serious Fraud Office',
  summary: 'Makes bribing, being bribed and bribing foreign officials offences, and makes organisations liable for failing to prevent bribery unless they have adequate procedures.',
  source: { url: 'https://www.legislation.gov.uk/ukpga/2010/23/contents', kind: 'official', checked: '2026-10-18' },
  extraQuestions: [], review: 'pending',
},
```

- [ ] **Step 4: Run** `npm test` — Expected: all suites ok including `laws (phase 1 completeness): ok`.
- [ ] **Step 5: Commit** one commit per jurisdiction: `git commit -am "feat(laws): phase 1 entries for <Country>"`.

---

### Task 4: Jurisdiction alignment report builder

**Files:** Create `src/lib/laws/jurisdictionReport.ts`; Modify `src/lib/laws/laws.test.ts`.

**Interfaces:**
- Consumes: `lawsFor`, `LAW_DATA_VERSION` (Task 1); `questionsForLaw` (Task 2); `coverageOf`, `lensNote`, `Coverage`, `MappedIndicator` from `src/lib/reports/coverage.ts`; `ATTRIBUTION_NOTICE` from `src/lib/reports/legal.ts`; `ModuleProfile`.
- Produces:
```ts
export const LAW_FOOTER: string
export interface LawRow { entry: LawEntry; coverage: Coverage | 'no-law'; mean: number | null; answered: number; applicable: number; indicators: MappedIndicator[] }
export interface JurisdictionSection { id: string; name: string; reviewed: boolean; areas: { area: LawArea; label: string; laws: LawRow[] }[] }
export interface JurisdictionReport { title: string; version: string; sections: JurisdictionSection[]; lensNote: string; footer: string }
export function reportJurisdictions(country: string, listed: string[]): string[]
export function buildJurisdictionReport(jurisdictions: string[], scores: Record<string, number>, p: ModuleProfile, lenses?: string[], entries?: LawEntry[]): JurisdictionReport
```

- [ ] **Step 1: Append failing tests**

```ts
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
```

- [ ] **Step 2: Run** — Expected: FAIL, cannot find `./jurisdictionReport.ts`.
- [ ] **Step 3: Implement** `src/lib/laws/jurisdictionReport.ts`:

```ts
// Jurisdiction alignment: for each law that applies where the organisation is, how far its CRAFT answers show readiness.
import type { ModuleProfile } from '../foundationModules.ts'
import { coverageOf, lensNote, type Coverage, type MappedIndicator } from '../reports/coverage.ts'
import { ATTRIBUTION_NOTICE } from '../reports/legal.ts'
import { questionsForLaw } from './mapping.ts'
import { LAW_DATA_VERSION, LAW_REGISTER } from './register.ts'
import { jurisdictionName, LAW_AREAS, LAW_JURISDICTIONS, type LawArea, type LawEntry } from './types.ts'

export const LAW_FOOTER = 'This report is information to support readiness, not legal advice. Laws change; check the cited source and take local legal advice before relying on it.'

export interface LawRow { entry: LawEntry; coverage: Coverage | 'no-law'; mean: number | null; answered: number; applicable: number; indicators: MappedIndicator[] }
export interface JurisdictionSection { id: string; name: string; reviewed: boolean; areas: { area: LawArea; label: string; laws: LawRow[] }[] }
export interface JurisdictionReport { title: string; version: string; sections: JurisdictionSection[]; lensNote: string; footer: string }

/** The organisation's home country first, then its other listed jurisdictions; ids outside the register are dropped. */
export function reportJurisdictions(country: string, listed: string[]): string[] {
  return [...new Set([country, ...listed])].filter((j) => LAW_JURISDICTIONS.includes(j))
}

export function buildJurisdictionReport(jurisdictions: string[], scores: Record<string, number>, p: ModuleProfile, lenses: string[] = [], entries: LawEntry[] = LAW_REGISTER): JurisdictionReport {
  const sections = jurisdictions.map((id): JurisdictionSection => {
    const laws = entries.filter((e) => e.jurisdiction === id && e.review === 'approved')
    const areas = (Object.keys(LAW_AREAS) as LawArea[]).map((area) => ({
      area, label: LAW_AREAS[area],
      laws: laws.filter((e) => e.area === area).map((entry): LawRow => entry.noLaw
        ? { entry, coverage: 'no-law', mean: null, answered: 0, applicable: 0, indicators: [] }
        : { entry, ...coverageOf(questionsForLaw(entry), scores, p, lenses) }),
    })).filter((a) => a.laws.length > 0)
    return { id, name: jurisdictionName(id), reviewed: laws.length > 0, areas }
  })
  return { title: 'Jurisdiction alignment (CRAFT readiness)', version: LAW_DATA_VERSION, sections, lensNote: lensNote(lenses), footer: `${LAW_FOOTER} ${ATTRIBUTION_NOTICE}` }
}
```

- [ ] **Step 4: Run** `node src/lib/laws/laws.test.ts` — Expected: all four `laws (...)` lines ok.
- [ ] **Step 5: Commit** `git add src/lib/laws && git commit -m "feat(laws): jurisdiction alignment report builder"`

---

### Task 5: Report view and Reports page card

**Files:** Create `src/components/reports/JurisdictionReportView.tsx`; Modify `src/pages/ReportsPage.tsx`.

**Interfaces:** Consumes `buildJurisdictionReport`, `reportJurisdictions`, `JurisdictionReport` (Task 4); `CoverageChip` from `src/components/reports/ReportViews.tsx`; `useEntityProfileCtx` from `src/lib/context`; existing `printReport`, `hideUnless`, `allScores`, `moduleProfile`, `lenses`, `orgName`, `csvCell` in `ReportsPage.tsx`.

- [ ] **Step 1: Create the view**

```tsx
// Printable jurisdiction alignment report. Data from src/lib/laws/jurisdictionReport.ts.
import { Printer } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '../ui'
import { CoverageChip } from './ReportViews'
import type { JurisdictionReport } from '../../lib/laws/jurisdictionReport'

export function JurisdictionReportView({ r, org, onPrint }: { r: JurisdictionReport; org: string; onPrint: () => void }) {
  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <Card className="print:border-0 print:shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{org}</p>
            <CardTitle>{r.title}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{r.version} · as of {today}</p>
          </div>
          <Button variant="outline" onClick={onPrint} className="print:hidden"><Printer className="h-4 w-4" /> Print / Save as PDF</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {r.sections.map(s => (
          <section key={s.id} className="space-y-3">
            <h3 className="font-display text-lg font-bold text-emerald-900">{s.name}</h3>
            {!s.reviewed && <p className="text-sm text-slate-500">Not yet reviewed. Laws for this jurisdiction will appear once CRAFT has checked them.</p>}
            {s.areas.map(a => (
              <div key={a.area}>
                <p className="text-xs font-semibold uppercase text-slate-500">{a.label}</p>
                <ul className="mt-1 space-y-2">{a.laws.map(l => (
                  <li key={l.entry.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">{l.entry.title}</span>
                      <span className="text-xs text-slate-500">{l.entry.citation}</span>
                      {l.coverage === 'no-law' ? <span className="text-xs text-slate-500">No national law in this area</span> : <CoverageChip c={l.coverage} />}
                      {l.coverage !== 'no-law' && <span className="text-xs text-slate-500">{l.answered} of {l.applicable} related questions answered</span>}
                    </div>
                    {l.entry.regulator && <p className="text-xs text-slate-500">Regulator: {l.entry.regulator}</p>}
                    <p className="mt-1 text-slate-700">{l.entry.summary}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      <a href={l.entry.source.url} target="_blank" rel="noreferrer" className="underline">Source</a>
                      {l.entry.source.kind === 'secondary' ? ' (secondary source, verify)' : ' (official)'} · checked {l.entry.source.checked}
                    </p>
                  </li>
                ))}</ul>
              </div>
            ))}
          </section>
        ))}
        <p className="text-xs text-slate-500">{r.lensNote}</p>
        <p className="border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500">{r.footer}</p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Wire into `ReportsPage.tsx`**
  - Extend `type PrintTarget` with `'jurisdiction'`.
  - Imports: `useEntityProfileCtx` (add to the existing `../lib/context` import), `buildJurisdictionReport`, `reportJurisdictions` from `../lib/laws/jurisdictionReport`, `LAW_JURISDICTIONS`, `jurisdictionName`, `LAW_AREAS` from `../lib/laws/types`, `JurisdictionReportView`.
  - State, after the ISO state:
```tsx
  const { entityProfile } = useEntityProfileCtx()
  const [lawJurisdictions, setLawJurisdictions] = useState<string[] | null>(null)
  const chosenJurisdictions = lawJurisdictions ?? reportJurisdictions(entityProfile.country, entityProfile.jurisdictions)
  const [showLaws, setShowLaws] = useState(false)
  const lawReport = useMemo(() => (showLaws && chosenJurisdictions.length ? buildJurisdictionReport(chosenJurisdictions, allScores, moduleProfile, lenses) : null),
    [showLaws, chosenJurisdictions.join(), allScores, moduleProfile, lenses])
```
  - A fourth card in the "New reports" grid (change `md:grid-cols-3` to `md:grid-cols-2 xl:grid-cols-4`): heading "Jurisdiction alignment", text "Laws that apply where you are registered and operate, and how far your answers show readiness. Information, not legal advice.", a multi-select (`<select multiple>` with `LAW_JURISDICTIONS.map(j => <option value={j}>{jurisdictionName(j)}</option>)`, value `chosenJurisdictions`, onChange sets `lawJurisdictions` from selected options), a line "Choose at least one jurisdiction." when `chosenJurisdictions.length === 0`, a "View report" button (`setShowLaws(true)`, disabled when none chosen), and an "Export CSV" button when `lawReport` exists.
  - Render: `{lawReport && <div className={hideUnless('jurisdiction')}><JurisdictionReportView r={lawReport} org={orgName} onPrint={() => printReport('jurisdiction', 'Jurisdiction alignment')} /></div>}`.
  - CSV function beside `exportAlignmentCsv`:
```tsx
function exportJurisdictionCsv(r: ReturnType<typeof buildJurisdictionReport>) {
  const header = 'Jurisdiction,Area,Law,Citation,Regulator,Rating,Answered,In scope,Source kind,Source,Checked'
  const rows = r.sections.flatMap(s => s.areas.flatMap(a => a.laws.map(l => [csvCell(s.name), csvCell(LAW_AREAS[a.area]), csvCell(l.entry.title), csvCell(l.entry.citation), csvCell(l.entry.regulator ?? ''),
    csvCell(l.coverage === 'no-law' ? 'No national law' : COVERAGE_LABEL[l.coverage]), l.answered, l.applicable, l.entry.source.kind, csvCell(l.entry.source.url), l.entry.source.checked].join(','))))
  const blob = new Blob([[csvCell(r.title), csvCell(r.version), csvCell(r.lensNote), '', header, ...rows, '', csvCell(r.footer)].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'CRAFT_Jurisdiction_Alignment.csv'
  a.click()
  URL.revokeObjectURL(url)
}
```
- [ ] **Step 3: Run** `npx tsc --noEmit -p .` and `npm run build` — Expected: exit 0 for both.
- [ ] **Step 4: Commit** `git add -A src && git commit -m "feat(reports): jurisdiction alignment report card, view, print and CSV"`

---

### Task 6: Internal check (Super Admin)

**Files:** Create `src/lib/laws/internalCheck.ts`; Modify `src/lib/laws/laws.test.ts`, `src/pages/AdminPage.tsx`.

**Interfaces:**
- Produces:
```ts
export interface InternalCheck {
  duties: { jurisdiction: string; law: string; duty: CraftDuty; note: string; status: 'done' | 'needed' | 'n/a' }[]
  recheckDue: LawEntry[]
  pending: { jurisdiction: string; count: number }[]
}
export function buildInternalCheck(entries: LawEntry[], today: string): InternalCheck
```

- [ ] **Step 1: Append failing test**

```ts
import { buildInternalCheck } from './internalCheck.ts'
const notes: LawEntry = { ...ok, id: 'NG-data-2', craftNotes: [{ duty: 'registration', note: 'Register with NDPC', status: 'done' }, { duty: 'cross-border', note: 'Transfer basis', status: 'needed' }] }
const stale: LawEntry = { ...ok, id: 'NG-labour-1', area: 'labour', source: { ...ok.source, checked: '2025-10-17' } }
const fresh: LawEntry = { ...ok, id: 'NG-labour-2', area: 'labour', source: { ...ok.source, checked: '2025-10-18' } }
const ic = buildInternalCheck([notes, stale, fresh], '2026-10-18')
assert.equal(ic.duties[0].status, 'needed', 'needed duties first')
assert.deepEqual(ic.recheckDue.map((e) => e.id), ['NG-labour-1'], 'older than 12 months is due; exactly 12 months is not')
assert.deepEqual(ic.pending, [{ jurisdiction: 'NG', count: 3 }])
console.log('laws (internal check): ok')
```

- [ ] **Step 2: Run** — Expected: FAIL, cannot find `./internalCheck.ts`.
- [ ] **Step 3: Implement** `src/lib/laws/internalCheck.ts`:

```ts
// What each law means for CRAFT itself, which entries need re-checking, and what is still awaiting review. Super Admin only.
import { jurisdictionName, type CraftDuty, type LawEntry } from './types.ts'

export interface InternalCheck {
  duties: { jurisdiction: string; law: string; duty: CraftDuty; note: string; status: 'done' | 'needed' | 'n/a' }[]
  recheckDue: LawEntry[]
  pending: { jurisdiction: string; count: number }[]
}
const ORDER = { needed: 0, done: 1, 'n/a': 2 } as const

export function buildInternalCheck(entries: LawEntry[], today: string): InternalCheck {
  const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`
  const duties = entries.flatMap((e) => (e.craftNotes ?? []).map((n) => ({ jurisdiction: jurisdictionName(e.jurisdiction), law: e.title, ...n })))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.jurisdiction.localeCompare(b.jurisdiction))
  const counts = new Map<string, number>()
  for (const e of entries) if (e.review === 'pending') counts.set(e.jurisdiction, (counts.get(e.jurisdiction) ?? 0) + 1)
  return {
    duties,
    recheckDue: entries.filter((e) => e.source.checked < yearAgo),
    pending: [...counts].map(([jurisdiction, count]) => ({ jurisdiction, count })),
  }
}
```

- [ ] **Step 4: Admin tab.** In `AdminPage.tsx` add `{ id: 'laws', label: 'Laws register' }` to the `Tabs` list and a `{tab === 'laws' && (...)}` block that calls `buildInternalCheck(LAW_REGISTER, new Date().toISOString().slice(0, 10))` and renders three tables using the page's existing `Card`/`Table` components: "What CRAFT must do" (jurisdiction, law, duty, note, status badge), "Re-check due" (jurisdiction, title, checked), "Awaiting review" (jurisdiction name, count), plus `LAW_DATA_VERSION`. Each table shows "None" when empty.
- [ ] **Step 5: Run** `node src/lib/laws/laws.test.ts && npx tsc --noEmit -p .` — Expected: ok, exit 0.
- [ ] **Step 6: Commit** `git add -A src && git commit -m "feat(admin): laws register internal check"`

---

### Task 7: Review document export

**Files:** Create `scripts/export-laws-review.mjs`; generates `docs/laws/review-phase1.md`.

- [ ] **Step 1: Write the script**

```js
// Writes docs/laws/review-<batch>.md: every entry in a batch for founder / counsel review.
// Run: node scripts/export-laws-review.mjs phase1
import { mkdirSync, writeFileSync } from 'node:fs'
import { LAW_REGISTER, LAW_DATA_VERSION } from '../src/lib/laws/register.ts'
import { LAW_AREAS, jurisdictionName } from '../src/lib/laws/types.ts'

const batch = process.argv[2] ?? 'phase1'
const BATCHES = { phase1: ['NG', 'KE', 'ZA', 'MA', 'EG', 'SN', 'MU', 'CV', 'US', 'UK', 'EU'] }
const ids = BATCHES[batch] ?? batch.split(',')
const cell = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const out = [`# Laws register review — ${batch}`, '', `${LAW_DATA_VERSION}. Information, not legal advice. Tick each jurisdiction once every entry is confirmed against its source.`, '']
for (const j of ids) {
  const rows = LAW_REGISTER.filter((e) => e.jurisdiction === j)
  out.push(`## ${jurisdictionName(j)} (${j})`, '', '| Id | Area | Law | Citation | Regulator | Summary | Source | Kind | Checked | Notes for CRAFT |', '|---|---|---|---|---|---|---|---|---|---|')
  for (const e of rows) out.push(`| ${e.id} | ${LAW_AREAS[e.area]} | ${cell(e.title)}${e.noLaw ? ' (no national law)' : ''} | ${cell(e.citation)} | ${cell(e.regulator)} | ${cell(e.summary)} | ${e.source.url} | ${e.source.kind} | ${e.source.checked} | ${cell((e.craftNotes ?? []).map((n) => `${n.duty}: ${n.note} (${n.status})`).join('; '))} |`)
  out.push('', `- [ ] ${jurisdictionName(j)} approved by: ____ on ____`, '')
}
mkdirSync('docs/laws', { recursive: true })
writeFileSync(`docs/laws/review-${batch}.md`, out.join('\n'))
console.log(`wrote docs/laws/review-${batch}.md`)
```

- [ ] **Step 2: Run** `node scripts/export-laws-review.mjs phase1` — Expected: `wrote docs/laws/review-phase1.md`, eleven jurisdiction sections, seven-plus rows each.
- [ ] **Step 3: Commit** `git add scripts/export-laws-review.mjs docs/laws && git commit -m "docs(laws): phase 1 review document"`

After the founders approve, flip each approved jurisdiction's entries to `review: 'approved'` in one commit per jurisdiction ("chore(laws): <Country> approved by <name>, <date>"), regenerate the review doc, and run `npm test`.

---

### Task 8: Phase 2 cloud routines (after phase 1 is merged to main)

**Files:** none locally; five RemoteTrigger routines on env `env_016ET7UEuPRqtn2r87wxq5Qb`, Sonnet 5.5, `clear_mcp_connections: true`.

- [ ] **Step 1:** Confirm phase 1 is merged and deployed (`main` contains `src/lib/laws/`).
- [ ] **Step 2:** Create one routine per batch in the Phase 2 table above (North, West, Central, East, Southern), each with this prompt (fill `<BATCH>`, `<FILE>`, `<LIST>`):

```
Repo fabbiochucho/craftframework, branch from main. Read docs/superpowers/specs/2026-10-18-laws-register-design.md and src/lib/laws/types.ts.
Create src/lib/laws/data/<FILE>.ts exporting `<BATCH>_LAWS: LawEntry[]` for exactly these jurisdictions: <LIST>.
For each jurisdiction cover all ten areas, recording every main act, regulation and code per area (company, data, integrity, procurement, governance = codes and regulator governance rules, labour, eia, sustainability = environment, climate and ISSB/sustainability disclosure rules, financial = financial reporting council / accounting and audit standards / banking and insurance acts, capital — capital = securities / capital markets act and stock exchange listing rules; for WAEMU members cite the regional AMF-UMOA framework, for CEMAC members COSUMAF; where there is no exchange say so with noLaw).
Rules: laws in force only; cite the official text first (gazette, ministry, regulator, legislature); if no official copy is online cite a reputable secondary source with kind 'secondary'; open each source to confirm title, number and year; summary ≤ 60 words in your own words, never statute text; where no national law exists in an area add an entry with noLaw: true naming what applies instead (for OHADA members, the OHADA Uniform Act applies to company law); data-protection entries carry craftNotes for registration, cross-border transfer, breach notice and local representative; checked = today; review: 'pending'; ids `${J}-${area}-${n}`.
Append the array to LAW_REGISTER in src/lib/laws/register.ts, add the batch to BATCHES in scripts/export-laws-review.mjs, run `node scripts/export-laws-review.mjs <FILE>` and `npm test`; fix every failure.
Open a PR titled "Laws register: <BATCH> (pending review)" listing any entry you could only source secondarily.
```
- [ ] **Step 3:** For each PR: check CI, spot-check five citations against their sources, then ask the owner to review `docs/laws/review-<FILE>.md` before merge.

---

## Self-review notes

- Spec §6 "lenses line" and footer: Task 4/5. §7 internal check: Task 6, placed on the Admin page (Super Admin only) rather than the workspace Regulatory sources page, which is workspace-scoped, not Super Admin.
- `regulatory-context.ts` `JurisdictionId` is not changed: the report's own picker offers all 57 jurisdictions including UK, and non-register ids in the entity profile are ignored.
- EU added to phase 1 at the owner's request (11 jurisdictions); phase 2 is the 46 remaining African countries in five regional batches.
