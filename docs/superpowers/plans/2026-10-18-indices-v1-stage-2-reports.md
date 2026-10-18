# CRAFT indices v1 (102026), stage 2: reports, alignment, ISO readiness and plan actions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the four indices into outputs organisations can use: index reports, an alignment report per external
framework, an ISO certification readiness report, and plan actions in the Capacity Improvement Plan, plus the
high-risk safeguards cap deferred from stage 1.

**Architecture:** Pure report builders in `src/lib/reports/` take score maps and the module profile and return plain
data; `ReportsPage` renders them and prints them with print-only CSS (no new server code, no database changes).
`src/lib/crosswalkExisting.ts` maps CRAFT's existing questions (core bank by domain, Capital Readiness Ladder by
domain, the three older indices by dimension, ESG by pillar) onto the stage 1 framework register, so alignment and ISO
reports draw on everything an organisation has answered. `src/lib/moduleFindings.ts` turns index gaps into
`DerivedFinding` plan actions alongside the core bank's.

**Tech Stack:** TypeScript (strict), React 19 / TanStack Start, plain `node` assert self-checks, Tailwind v4 `print:`
variants.

**Spec:** `docs/superpowers/specs/2026-10-18-craft-indices-v1-102026-design.md` (sections 2.4, 4, 5.1, 5.2, 5.3, 9).

## Global Constraints

- Version label: `'v1 (102026)'`. No database migrations in this stage.
- Report titles: alignment reports are titled exactly `Alignment with <framework name> principles (CRAFT mapping)`.
- Every alignment and ISO report footer carries the attribution notice; the ISO report also carries the ISO statement
  (both verbatim from the lawyer-review doc, section "Third-party frameworks", stored in `src/lib/reports/legal.ts`).
- Never write "certified", "compliant", "passes" or a rating CRAFT issues about an organisation; use "aligned with",
  "helps you prepare for".
- Crosswalk refs only to registered framework elements (`crosswalkProblems` returns `[]`).
- Non-applicable indicators (stage 1 `applies`) never count in any report.
- Plain English, British spelling, no em-dashes in new UI strings.
- Health-security catalogues (workspace module, separate data store) are out of scope for this stage.

## Review Focus

1. An organisation that has answered none of the questions mapped to a framework element must see "Not assessed",
   never "Gap" (test in Task 4).
2. Non-applicable indicators (public financial management for a non-public body, safeguard areas the screening left
   off) are excluded from alignment coverage; an element whose mapped indicators are all excluded shows
   "Not applicable" (Task 4).
3. A high-risk organisation without an independent impact assessment never shows above "Developing" for the
   safeguards index, in the panel or in its index report (Tasks 1 and 4).
4. Printing a report shows only that report: no sidebar, top bar, chat button, consent banner or other report cards
   (Task 5, browser check).
5. Index plan actions must not collide with core question ids, must not change the core composite score or
   accreditation level, and must not duplicate an action already in the plan (Task 3).

---

### Task 1: High-risk safeguards cap

**Files:**
- Modify: `src/lib/foundationModules.ts` (`ModuleProfile`, `FoundationModule`, `bandFor`)
- Modify: `src/lib/indices/safeguards.ts` (set the cap rule)
- Modify: `src/pages/FoundationModulePanel.tsx` (checkbox for high-risk organisations)
- Test: `src/lib/indices/indices.test.ts`

**Interfaces:**
- Produces: `ModuleProfile.esIndependentAssessment?: boolean`; `FoundationModule.bandCap?: (p?: ModuleProfile) => { maxBandIndex: number; reason: string } | null`;
  `BandResult.capReason?: string`.

- [ ] **Step 1: Failing test** — append to `indices.test.ts`:

```ts
// Stage 2: high-risk safeguards cap (spec 2.4)
import { bandFor } from '../foundationModules.ts'
const allFives = Object.fromEntries(SAFEGUARDS.indicators.map((x) => [x.id, 5]))
const high = { esCategory: 'high' as const, esFlags: [] }
assert.equal(bandFor(SAFEGUARDS, allFives, high)?.band.label, 'Developing', 'high risk without an independent assessment caps at Developing')
assert.match(bandFor(SAFEGUARDS, allFives, high)?.capReason ?? '', /independent/i)
assert.equal(bandFor(SAFEGUARDS, allFives, { ...high, esIndependentAssessment: true })?.band.label, 'Exemplary')
assert.equal(bandFor(SAFEGUARDS, allFives, { esCategory: 'moderate', esFlags: [] })?.band.label, 'Exemplary', 'moderate risk is not capped')
```

- [ ] **Step 2:** `node src/lib/indices/indices.test.ts` → FAIL (band is Exemplary).
- [ ] **Step 3: Implement.** Add the fields. In `bandFor`, after the weakest-link cap, apply `m.bandCap?.(p)`: if it
  returns a cap and the current band index is above `maxBandIndex`, use `m.bands[maxBandIndex]` and set `capReason`.
  In `safeguards.ts` set
  `bandCap: (p) => p?.esCategory === 'high' && !p.esIndependentAssessment ? { maxBandIndex: 1, reason: 'High-risk operations need an independently prepared impact assessment before the index can score above Developing.' } : null`.
  In the panel, when `profile.esCategory === 'high'`, show under the screening a checkbox "An independently prepared
  environmental and social impact assessment has been completed" bound to `esIndependentAssessment`; show
  `band.capReason` under the band card when present.
- [ ] **Step 4:** `node src/lib/indices/indices.test.ts && node src/lib/foundationModules.test.ts && npx tsc --noEmit` → ok.
- [ ] **Step 5:** Commit `feat(indices): cap high-risk safeguards at Developing until an independent impact assessment`.

---

### Task 2: Crosswalk for CRAFT's existing questions, and one indicator catalogue

**Files:**
- Create: `src/lib/crosswalkExisting.ts`
- Create: `src/lib/crosswalkExisting.test.ts`
- Modify: `package.json` (`test`: append `&& node src/lib/crosswalkExisting.test.ts`)

**Interfaces:**
- Consumes: `MOCK_QUESTIONS` (`src/lib/data.ts`), `LADDER_INDICATORS` (`src/lib/capitalReadiness.ts`),
  `ESG_QUESTIONS` (`src/lib/esg.ts`), `FOUNDATION_MODULES`, `applies`, `crosswalkProblems`, `CrosswalkRef`, `ModuleProfile`.
- Produces:
  - `type CatalogueSource = 'core' | 'ladder' | 'esg' | 'module'`
  - `interface CatalogueEntry { id: string; source: CatalogueSource; sourceName: string; question: string; refs: CrosswalkRef[]; applies: (p?: ModuleProfile) => boolean }`
  - `INDICATOR_CATALOGUE: CatalogueEntry[]` (every core, ladder, ESG and module indicator)
  - `CORE_DOMAIN_REFS`, `LADDER_DOMAIN_REFS`, `MODULE_DIMENSION_REFS`, `ESG_PILLAR_REFS: Record<string, CrosswalkRef[]>`
  - `indicatorsFor(framework: string, element?: string): CatalogueEntry[]`

- [ ] **Step 1: Failing test** `src/lib/crosswalkExisting.test.ts`:

```ts
// Self-check: `node src/lib/crosswalkExisting.test.ts`
import assert from 'node:assert/strict'
import { MOCK_QUESTIONS } from './data.ts'
import { LADDER_INDICATORS } from './capitalReadiness.ts'
import { ESG_QUESTIONS } from './esg.ts'
import { crosswalkProblems } from './crosswalk.ts'
import { CORE_DOMAIN_REFS, ESG_PILLAR_REFS, INDICATOR_CATALOGUE, LADDER_DOMAIN_REFS, MODULE_DIMENSION_REFS, indicatorsFor } from './crosswalkExisting.ts'
import { FOUNDATION_MODULES } from './foundationModules.ts'

for (const d of new Set(MOCK_QUESTIONS.map((q) => q.domain))) assert.ok(CORE_DOMAIN_REFS[d]?.length, `core domain mapped: ${d}`)
for (const d of new Set(LADDER_INDICATORS.map((q) => q.domain))) assert.ok(LADDER_DOMAIN_REFS[d]?.length, `ladder domain mapped: ${d}`)
for (const m of FOUNDATION_MODULES.filter((x) => !x.version)) for (const d of m.dimensions) assert.ok(MODULE_DIMENSION_REFS[`${m.id}:${d.key}`]?.length, `module dimension mapped: ${m.id}:${d.key}`)
for (const p of new Set(ESG_QUESTIONS.map((q) => q.pillar))) assert.ok(ESG_PILLAR_REFS[p]?.length, `ESG pillar mapped: ${p}`)

const ids = INDICATOR_CATALOGUE.map((e) => e.id)
assert.equal(new Set(ids).size, ids.length, 'catalogue ids unique across sources')
assert.equal(INDICATOR_CATALOGUE.length, MOCK_QUESTIONS.length + LADDER_INDICATORS.length + ESG_QUESTIONS.length + FOUNDATION_MODULES.reduce((n, m) => n + m.indicators.length, 0))
assert.deepEqual(crosswalkProblems(INDICATOR_CATALOGUE.map((e) => ({ indicatorId: e.id, refs: e.refs }))), [])
assert.ok(indicatorsFor('iso-27001').some((e) => e.source === 'core'), 'core cyber questions support ISO 27001 readiness')
assert.ok(indicatorsFor('coso-ic', 'CE').some((e) => e.id === 'CRAFT-FCR-01'), 'new index refs flow through')
const pfm = INDICATOR_CATALOGUE.find((e) => e.id === 'CRAFT-FCR-25')!
assert.equal(pfm.applies({}), false); assert.equal(pfm.applies({ publicBody: true }), true)
console.log('crosswalkExisting: ok')
```

- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3: Implement.** Header comment: mappings are CRAFT's judgement of relevance, reviewed by the founders, not an
  endorsement. Refs written as `'fw:REF'` strings parsed the same way as `src/lib/indices/shared.ts`. Tables:

`CORE_DOMAIN_REFS` (the 24 core domains):

| Domain | Refs |
|---|---|
| Governance & Leadership | ifc-cgdf:BOARD ifc-cgdf:COMMIT nccg-2018:BOARD coso-ic:CE mck-ohi:LEADERSHIP iso-37000:MS |
| Legal & Regulatory | nccg-2018:CONDUCT iso-37301:MS coso-ic:RA |
| Strategy & Planning | mck-ohi:DIRECTION mck-7s:STRATEGY star-model:STRATEGY bsc:FINANCIAL coso-erm:SO pefa:IV |
| Human Resources | mck-7s:STAFF star-model:PEOPLE mck-ohi:CAPABILITIES iso-45001:MS iso-30414:MS afdb-iss:OS2 |
| Sustainability & Financing | bsc:FINANCIAL ifrs-s1:STRAT |
| Financial Management | coso-ic:CA coso-ic:IC pefa:I pefa:VI ifc-cgdf:DISCLOSURE |
| Procurement & Supply Chain | coso-ic:CA iso-37001:MS |
| Risk & Internal Controls | coso-ic:RA coso-ic:CA coso-erm:PF iso-31000:6.4 iso-31000:6.5 |
| Audit & Assurance | coso-ic:MA coso-ic:P16 nccg-2018:ASSURANCE pefa:VII |
| Ethics & Anti-Fraud | coso-ic:P1 coso-ic:P8 iso-37001:MS iso-37002:MS nccg-2018:CONDUCT |
| Grant Management | coso-ic:CA pefa:V gf-pr:TOOL |
| Program & Project Mgmt | bsc:PROCESS mck-7s:SYSTEMS |
| Monitoring, Evaluation & Learning | bsc:LEARNING mck-ohi:INNOVATION |
| Partnerships & Stakeholders | mck-ohi:EXTERNAL ifc-cgdf:STAKEHOLDERS afdb-iss:OS10 |
| USG Compliance | iso-37301:MS coso-ic:IC |
| International Donor Compliance | iso-37301:MS coso-ic:IC gf-pr:TOOL |
| Digital Systems & Cyber | iso-27001:MS iso-27701:MS nist-csf-2:GV nist-csf-2:ID nist-csf-2:PR nist-csf-2:DE nist-csf-2:RS nist-csf-2:RC |
| Emergency Preparedness | iso-22301:MS nist-csf-2:RC coso-erm:PF |
| Research & Innovation | mck-ohi:INNOVATION bsc:LEARNING |
| PMO & Delivery | bsc:PROCESS mck-ohi:COORDINATION |
| Climate Governance | ifrs-s2:GOV ifrs-s2:STRAT ifrs-s2:RISK |
| Env. & Social Safeguards | afdb-iss:OS1 afdb-iss:OS2 afdb-iss:OS4 afdb-iss:OS10 iso-14001:MS |
| Climate Finance Access | ifrs-s2:STRAT ifrs-s1:STRAT |
| MRV & Article 6 | ifrs-s2:METRICS iso-14064-1:MS |

`LADDER_DOMAIN_REFS` (the 21 ladder domains):

| Domain | Refs |
|---|---|
| Legal Structure & Registration | ifc-cgdf:COMMIT iso-37301:MS |
| Basic Financial Controls | coso-ic:CA coso-ic:P10 |
| Core Governance & Leadership | ifc-cgdf:BOARD nccg-2018:BOARD |
| Auditable Financial Records | coso-ic:IC pefa:VI nccg-2018:ASSURANCE |
| Transparent Governance & Reporting | ifc-cgdf:DISCLOSURE nccg-2018:TRANSPARENCY |
| Evidence of Delivery | bsc:CUSTOMER bsc:PROCESS |
| Financial Resilience & Reserves | bsc:FINANCIAL coso-erm:PF |
| Operational & Crisis Continuity | iso-22301:MS |
| Leadership Succession Planning | mck-7s:STAFF ifc-cgdf:BOARD |
| Environmental & Resource Performance | iso-14001:MS iso-50001:MS afdb-iss:OS3 |
| Social Value & Human Capital | afdb-iss:OS2 iso-30414:MS |
| Community Legitimacy | afdb-iss:OS4 afdb-iss:OS10 |
| Investment Case & Revenue Model | bsc:FINANCIAL gfa:TOOL |
| Cash-Flow Visibility & Bankability | bsc:FINANCIAL gfa:TOOL |
| Investor Protections & Regulatory Certainty | ifc-cgdf:SHAREHOLDERS nccg-2018:SHAREHOLDERS |
| Institutional Depth & Systems | mck-7s:SYSTEMS star-model:PROCESSES |
| Data & Controls Maturity | coso-ic:IC iso-27001:MS |
| Replicability & Partnerships | mck-ohi:EXTERNAL |
| Development Finance / DFI Readiness | ifc-cgdf:COMMIT afdb-iss:OS1 |
| Capital Markets & Credit Readiness | ifc-cgdf:DISCLOSURE nccg-2018:TRANSPARENCY |
| Sustainability-Linked / Green Finance Readiness | ifrs-s1:METRICS ifrs-s2:METRICS |

`MODULE_DIMENSION_REFS` (older indices, keyed `moduleId:dimension`):

| Key | Refs |
|---|---|
| craft-resilience:financial | bsc:FINANCIAL coso-erm:PF |
| craft-resilience:funding | coso-erm:SO |
| craft-resilience:operational | iso-22301:MS |
| craft-resilience:people | mck-7s:STAFF |
| craft-resilience:digital | iso-27001:MS nist-csf-2:RC |
| craft-resilience:risk | coso-erm:PF iso-31000:6.4 |
| craft-transformation:foresight | coso-erm:SO burke-litwin:EXTERNAL |
| craft-transformation:learning | mck-ohi:INNOVATION bsc:LEARNING |
| craft-transformation:innovation | mck-ohi:INNOVATION |
| craft-transformation:change | kotter:VISION adkar:AWARENESS burke-litwin:CULTURE |
| craft-transformation:digital | nist-csf-2:GV iso-42001:MS |
| craft-transformation:model | star-model:STRATEGY |
| craft-legacy:memory | mck-ohi:CAPABILITIES |
| craft-legacy:pipeline | mck-7s:STAFF ifc-cgdf:BOARD |
| craft-legacy:governance | ifc-cgdf:BOARD nccg-2018:BOARD |
| craft-legacy:finance | bsc:FINANCIAL |
| craft-legacy:mission | mck-7s:SHARED_VALUES |
| craft-legacy:stewardship | ifrs-s1:STRAT iso-26000:MS |

`ESG_PILLAR_REFS`: `Environmental` → ifrs-s2:METRICS iso-14001:MS afdb-iss:OS3; `Social` → afdb-iss:OS2 afdb-iss:OS4
iso-26000:MS; `Governance` → ifc-cgdf:BOARD ifrs-s1:GOV nccg-2018:BOARD.

Catalogue: core entries use `CORE_DOMAIN_REFS[q.domain]`, `sourceName: 'Core assessment'`, `applies: () => true`;
ladder entries `LADDER_DOMAIN_REFS[q.domain]`, `'Capital Readiness Ladder'`; ESG entries `ESG_PILLAR_REFS[q.pillar]`,
`'ESG Self-Assessment'`; module entries use the indicator's own `crosswalk` when present, else
`MODULE_DIMENSION_REFS[`${m.id}:${i.dimension}`]`, `sourceName: m.title`, `applies: (p) => applies(i, p)`.
`indicatorsFor(fw, el)` filters entries with a ref to that framework (and element when given).

- [ ] **Step 4:** Run the test and `npx tsc --noEmit` → ok.
- [ ] **Step 5:** Commit `feat(crosswalk): map existing CRAFT questions and build one indicator catalogue`.

---

### Task 3: Index gaps become plan actions

**Files:**
- Create: `src/lib/moduleFindings.ts`
- Create: `src/lib/moduleFindings.test.ts`
- Create: `src/lib/moduleProfile.ts` (shared hook)
- Modify: `src/lib/data.ts` (export `severityFromScore`, `dueMonthFor`, `quarterLabel`)
- Modify: `src/pages/FoundationModulePanel.tsx` (use the shared hook)
- Modify: `src/pages/CIPPage.tsx:37`, `src/pages/ReportsPage.tsx:40`, `src/pages/NarrativeReportPage.tsx:75` (append index actions)
- Modify: `package.json` (`test`: append `&& node src/lib/moduleFindings.test.ts`)

**Interfaces:**
- Produces:
  - `deriveModuleFindings(scores: Record<string, number>, p: ModuleProfile, planMonths: number, threshold = 2): DerivedFinding[]`
    covering only modules with `version === 'v1 (102026)'`, only applicable answered indicators at or below `threshold`;
    `id`/`qId` = the indicator id; `topic` = module title; `domain` = dimension name; `tier` = 0;
    `mitigation` = indicator recommendation; `owner` = `OWNER_BY_ACTION[actionType]`; `dueMonth` via `dueMonthFor`.
  - `OWNER_BY_ACTION: Record<ActionType, string>` = policy → 'Board Secretary', process → 'Head of Operations',
    system → 'Head of Finance / ICT', people → 'Head of Human Resources', practice → 'Head of Operations',
    assurance → 'Internal Audit'.
  - `useModuleProfile(): [ModuleProfile & { esAnswers?: EsScreeningAnswers }, (v) => void]` in `src/lib/moduleProfile.ts`
    (moves the panel's existing `useTenantState(..., 'modules:profile', {}, readOnly)` call unchanged).

- [ ] **Step 1: Failing test** `src/lib/moduleFindings.test.ts`:

```ts
// Self-check: `node src/lib/moduleFindings.test.ts`
import assert from 'node:assert/strict'
import { deriveModuleFindings } from './moduleFindings.ts'
import { computeOrgScore, deriveFindings } from './data.ts'

const scores = { 'CRAFT-OHE-01': 1, 'CRAFT-OHE-02': 4, 'CRAFT-FCR-25': 0, 'CRAFT-RES-01': 0 }
const f = deriveModuleFindings(scores, {}, 24)
assert.deepEqual(f.map((x) => x.id), ['CRAFT-OHE-01'], 'only answered, applicable v1 index gaps (not older modules, not PFM for non-public bodies)')
assert.equal(f[0].mitigation.length > 10, true)
assert.equal(f[0].owner, 'Board Secretary', 'policy actions owned by the board secretary')
assert.deepEqual(deriveModuleFindings(scores, { publicBody: true }, 24).map((x) => x.id).sort(), ['CRAFT-FCR-25', 'CRAFT-OHE-01'])
assert.deepEqual(deriveModuleFindings({}, {}, 24), [], 'nothing answered, nothing added')
// core plan and score untouched
const core = { 'GOV-01': 1 }
assert.equal(computeOrgScore({ ...core, ...scores }), computeOrgScore(core), 'index answers never change the core composite')
assert.ok(!deriveFindings({ ...core, ...scores }).some((x) => x.id.startsWith('CRAFT-')), 'core plan never contains index ids')
console.log('moduleFindings: ok')
```

- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3: Implement** `moduleFindings.ts` and export the three helpers from `data.ts`. Create `moduleProfile.ts` with
  the hook (reads `useAuthCtx`, `useWorkspace`; same key, initial `{}`, `readOnly`), switch the panel to it. In
  `CIPPage`, `ReportsPage` and `NarrativeReportPage`, build the plan as
  `useMemo(() => [...deriveFindings(orgScores, 2, planMonths), ...deriveModuleFindings(orgScores, profile, planMonths)], [...])`
  with `const [profile] = useModuleProfile()`.
- [ ] **Step 4:** `node src/lib/moduleFindings.test.ts && npm test && npx tsc --noEmit` → ok.
- [ ] **Step 5:** Commit `feat(indices): index gaps become Capacity Improvement Plan actions`.

---

### Task 4: Report builders

**Files:**
- Create: `src/lib/reports/legal.ts`, `src/lib/reports/indexReport.ts`, `src/lib/reports/alignmentReport.ts`, `src/lib/reports/isoReadiness.ts`
- Create: `src/lib/reports/reports.test.ts`
- Modify: `package.json` (`test`: append `&& node src/lib/reports/reports.test.ts`)

**Interfaces:**
- Consumes: `INDICATOR_CATALOGUE`, `indicatorsFor`, `EXTERNAL_FRAMEWORKS`, `frameworkById`, `bandFor`, `applicableDimensions`,
  `dimensionScore`, `compositeScore`, `evaluateLens`, `priorityGaps`, `deriveModuleFindings`.
- Produces:
  - `legal.ts`: `ATTRIBUTION_NOTICE: string`, `ISO_STATEMENT: string` (verbatim from the lawyer-review doc).
  - `buildIndexReport(m: FoundationModule, scores, p: ModuleProfile, planMonths: number)` →
    `{ title, version, question, band: BandResult | null, composite, answered, total, dimensions: { name, score }[], weakest: { id, question, score }[], lenses: LensResult[], actions: DerivedFinding[] }`
  - `type Coverage = 'covered' | 'partial' | 'gap' | 'not-assessed' | 'not-applicable' | 'not-mapped'`
  - `buildAlignmentReport(frameworkId: string, scores, p: ModuleProfile)` →
    `{ title, framework: ExternalFramework, elements: { id, label, coverage: Coverage, mean: number | null, indicators: { id, sourceName, question, score: number | null }[] }[], counts: Record<Coverage, number>, footer: string }`.
    Rules per element: no catalogue entry maps to it → `not-mapped`; all mapped entries non-applicable → `not-applicable`;
    applicable but none answered → `not-assessed`; else mean of answered applicable scores: ≥ 3.5 `covered`, ≥ 2 `partial`, else `gap`.
  - `buildIsoReadiness(standardIds: string[], scores, p: ModuleProfile)` →
    `{ standards: { id, name, kind, readiness: Coverage, related: { id, sourceName, question, score }[], gaps: { id, question, score }[] }[], statement: string, footer: string }`
    (same coverage rule over all entries mapped to the standard; `gaps` = answered applicable entries scoring below 3).

- [ ] **Step 1: Failing test** `src/lib/reports/reports.test.ts`:

```ts
// Self-check: `node src/lib/reports/reports.test.ts`
import assert from 'node:assert/strict'
import { buildAlignmentReport } from './alignmentReport.ts'
import { buildIndexReport } from './indexReport.ts'
import { buildIsoReadiness } from './isoReadiness.ts'
import { ATTRIBUTION_NOTICE, ISO_STATEMENT } from './legal.ts'
import { SAFEGUARDS } from '../indices/safeguards.ts'

// Alignment: nothing answered = not assessed, never gap (Review Focus 1)
const empty = buildAlignmentReport('coso-ic', {}, {})
assert.equal(empty.title, 'Alignment with COSO Internal Control — Integrated Framework (2013) principles (CRAFT mapping)')
assert.ok(empty.elements.every((e) => e.coverage === 'not-assessed' || e.coverage === 'not-mapped'), 'no gaps without answers')
assert.equal(empty.footer, ATTRIBUTION_NOTICE)
// Scores drive coverage
const r = buildAlignmentReport('coso-ic', { 'CRAFT-FCR-01': 5, 'CRAFT-FCR-03': 5 }, {})
assert.equal(r.elements.find((e) => e.id === 'CE')?.coverage, 'covered')
const low = buildAlignmentReport('coso-ic', { 'CRAFT-FCR-01': 0, 'CRAFT-FCR-03': 1 }, {})
assert.equal(low.elements.find((e) => e.id === 'CE')?.coverage, 'gap')
// Non-applicable (Review Focus 2): PFM-only element for a non-public body
const pefa = buildAlignmentReport('pefa', { 'CRAFT-FCR-27': 1 }, {})
const v = pefa.elements.find((e) => e.id === 'V')!
assert.ok(!v.indicators.some((x) => x.id === 'CRAFT-FCR-27'), 'non-applicable indicators are not listed')
assert.notEqual(v.coverage, 'gap', 'a non-applicable low score never creates a gap')

// Index report respects the high-risk cap (Review Focus 3)
const fives = Object.fromEntries(SAFEGUARDS.indicators.map((x) => [x.id, 5]))
const ir = buildIndexReport(SAFEGUARDS, fives, { esCategory: 'high', esFlags: [] }, 24)
assert.equal(ir.band?.band.label, 'Developing')
assert.equal(ir.version, 'v1 (102026)')

// ISO readiness
const iso = buildIsoReadiness(['iso-27001', 'iso-31000'], { 'CRAFT-FCR-19': 1 }, {})
assert.equal(iso.statement, ISO_STATEMENT)
assert.equal(iso.standards.find((s) => s.id === 'iso-31000')?.kind, 'guidance')
// Only CRAFT's own labels are checked: mapped question text is the organisation's assessment wording.
const labels = JSON.stringify({ statement: iso.statement, standards: iso.standards.map((s) => ({ name: s.name, kind: s.kind, readiness: s.readiness })) })
assert.ok(!/\b(certified|compliant|passes)\b/i.test(labels), 'report labels never claim certification or compliance')
console.log('reports: ok')
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** the four files per Interfaces. `legal.ts` text, verbatim:

```ts
export const ATTRIBUTION_NOTICE = 'CRAFT is an independent methodology developed by the DiBadili Institute. Third-party names, including McKinsey Organizational Health Index and McKinsey 7S, Prosci ADKAR, COSO, ISO, IFRS, PEFA, FAIR and Open FAIR, are trademarks or names of their respective owners. CRAFT refers to these frameworks for context and alignment only. This does not imply any affiliation with, sponsorship by or endorsement from their owners. CRAFT does not reproduce their proprietary questions, scoring methods, benchmark data or standard text; all CRAFT indicators are original.'
export const ISO_STATEMENT = 'CRAFT helps organisations build and evidence the management systems that ISO certification audits examine, including quality (ISO 9001), information security (ISO 27001), anti-bribery (ISO 37001) and business continuity (ISO 22301). CRAFT is not a certification body; certification is granted only by accredited certification bodies.'
```

- [ ] **Step 4:** `node src/lib/reports/reports.test.ts && npx tsc --noEmit` → ok.
- [ ] **Step 5:** Commit `feat(reports): index, framework alignment and ISO readiness report builders`.

---

### Task 5: Reports page and print-friendly layout

**Files:**
- Modify: `src/components/AppLayout.tsx` (add `print:hidden` to the sidebar, mobile drawer, top bar and floating chat button)
- Modify: `src/components/ConsentBanner.tsx`, `src/components/SupportBot.tsx`, `src/components/SessionTimer.tsx`, `src/components/OfflineBanner.tsx`, `src/components/AutoTranslate.tsx` (add `print:hidden` to each one's outermost fixed element)
- Modify: `src/pages/ReportsPage.tsx` (three new report cards and a report view)
- Create: `src/components/reports/ReportViews.tsx` (`IndexReportView`, `AlignmentReportView`, `IsoReadinessView`)

**Interfaces:**
- Consumes: Task 4 builders; `useModuleProfile`; `useLegacyAssessment('capital:scores', {})` and
  `useLegacyAssessment('esg:scores', {})` for ladder and ESG scores, merged with core scores into one map;
  `FOUNDATION_MODULES`, `EXTERNAL_FRAMEWORKS`, `canSeePreview`.

- [ ] **Step 1:** Add the three cards to `ReportsPage` under the existing two:
  - "Index report": a select of `FOUNDATION_MODULES` (preview ones only for the Super Admin) → renders `IndexReportView`.
  - "Framework alignment": a select of `EXTERNAL_FRAMEWORKS` whose `kind` is not `certifiable`/`verified`/`tool` →
    renders `AlignmentReportView`, with "Export CSV" (element id, label, coverage, mean, mapped question ids).
  - "ISO certification readiness": checkboxes for every `certifiable` and `verified` ISO standard, guidance standards
    in a separate "For reference" group → renders `IsoReadinessView`.
  Each view has a heading, the as-of date (today), the body tables, the footer text, and a "Print / Save as PDF"
  button that sets `printTarget` state then calls `window.print()`. Every other report section on the page gets
  `print:hidden` while a target is set; the target section gets `print:block`.
- [ ] **Step 2:** Coverage chips: covered emerald, partial amber, gap rose, not assessed / not applicable / not mapped slate,
  with text labels (never colour alone).
- [ ] **Step 3:** `npm test && npx tsc --noEmit && npm run build` → ok; update `src/lib/analyticsRoutes.ts` only if a route
  file was added (none planned).
- [ ] **Step 4: Browser check (after merge, signed in as Super Admin on production):** open `/reports`; generate the
  Organisational Effectiveness index report, a COSO IC alignment report and an ISO 27001 + ISO 22301 readiness report;
  use the browser print preview for each and confirm only that report prints, with the footer text.
- [ ] **Step 5:** Commit `feat(reports): index, alignment and ISO readiness reports on the Reports page; print-only layout`.
