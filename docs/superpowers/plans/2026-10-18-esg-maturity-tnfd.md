# ESG Maturity Journey and TNFD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place each organisation on a five-stage ESG maturity journey from evidence, add eight ESG questions (three on nature, following TNFD's LEAP approach), add TNFD to the crosswalk and attribution notice, and feed next-stage gaps into the Capacity Improvement Plan.

**Architecture:** Questions stay in `src/lib/esg.ts`. A new pure module `src/lib/esgMaturity.ts` computes the stage. `derivePlan` gains an optional ESG score map and a `deriveEsgFindings` helper. A small card component shows the stage on the ESG page, with one-line mentions in the Executive Summary and Narrative report.

**Tech Stack:** TanStack Start (React 19), TypeScript strict, node `assert` self-checks (`node file.test.ts`, imports with `.ts` extensions), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-18-esg-maturity-tnfd-design.md`

## Global Constraints

- Stage names: Foundations, Efficiency, Resilience, Integrated value, Systemic leadership. CRAFT's own wording; no text from One Stop ESG or TNFD reproduced.
- A criterion is met when its answer is 3 or higher; stage = highest stage whose criteria and all lower stages' criteria are met; unanswered = not met.
- Stages 3–5 are "confirmed" only if `pillarEvidenceScore` ≥ 2.5 (Partial) for every pillar the stage's criteria use; otherwise "self-reported — add evidence to confirm".
- Plan: only unmet criteria up to and including the next stage become actions; severity from score (0–1 Critical, 2 High); unanswered criteria are not actions.
- TNFD status note wherever TNFD is shown: "TNFD is concluding its technical work; the ISSB is developing nature-related requirements that build on it (exposure draft expected around COP17, October 2026)."
- Never "compliant", "compliance with" or "certified" in stage or report labels.
- Never merge or deploy without the owner's approval.

## Review Focus

1. Organisation with ESG answers saved before this change (12 questions) → existing answers keep their scores; stage computed with the 8 new questions unanswered (so capped at "Not yet at Foundations" until ESG-G5 is answered); page explains what's missing. (Task 4 test)
2. All criteria answered at 3+ but no evidence uploaded → stage 5 shown as self-reported, not confirmed. (Task 4 test)
3. A low score on a stage-4 question while stage 2 is incomplete → that stage-4 gap is not added to the plan. (Task 5 test)
4. ESG scores absent (`{}`) for pages/callers that don't pass them → plan identical to today. (Task 5 test)
5. TNFD alignment report with only ESG-N questions answered → coverage shown per element; elements with no answers stay "Not assessed". (Task 3 test)

---

### Task 1: TNFD in the attribution notice and crosswalk register

**Files:** Modify `src/lib/reports/legal.ts`, `src/lib/crosswalk.ts`, `src/lib/crosswalk.test.ts`, `src/lib/reports/reports.test.ts`.

**Interfaces:** Produces framework id `tnfd` with elements `GOV`, `STRAT`, `RIM`, `MT`, `L`, `E`, `A`, `P`; exported `TNFD_STATUS_NOTE: string` from `src/lib/crosswalk.ts`.

- [ ] **Step 1: Failing tests**

Append to `src/lib/crosswalk.test.ts` (before its final `console.log`):
```ts
const tnfd = frameworkById('tnfd')!
assert.equal(tnfd.elements.length, 8, 'TNFD: 4 pillars + 4 LEAP phases')
assert.deepEqual(tnfd.elements.map((e) => e.id), ['GOV', 'STRAT', 'RIM', 'MT', 'L', 'E', 'A', 'P'])
assert.match(TNFD_STATUS_NOTE, /ISSB/)
```
and add `TNFD_STATUS_NOTE` to its import from `./crosswalk.ts`.

Append to `src/lib/reports/reports.test.ts`:
```ts
assert.match(ATTRIBUTION_NOTICE, /\bTNFD\b/, 'TNFD named in the attribution notice')
console.log('reports (TNFD attribution): ok')
```

- [ ] **Step 2: Run** `node src/lib/crosswalk.test.ts` — Expected: FAIL (`TNFD_STATUS_NOTE` not exported / `tnfd` undefined).

- [ ] **Step 3: Implement**

`src/lib/reports/legal.ts`: in `ATTRIBUTION_NOTICE` replace `PEFA, FAIR and Open FAIR` with `PEFA, TNFD, FAIR and Open FAIR`, and change the header comment's first line to `// ... Approved for use (owner, 18 October 2026; TNFD added 18 October 2026);`.

`src/lib/crosswalk.ts`: add after the `bsc` entry:
```ts
  { id: 'tnfd', name: 'TNFD Recommendations and LEAP approach', owner: 'Taskforce on Nature-related Financial Disclosures', kind: 'framework',
    elements: el([['GOV', 'Governance of nature-related issues'], ['STRAT', 'Nature in strategy'], ['RIM', 'Risk and impact management'], ['MT', 'Metrics and targets'],
      ['L', 'Locate the interface with nature'], ['E', 'Evaluate dependencies and impacts'], ['A', 'Assess risks and opportunities'], ['P', 'Prepare to respond and report']]) },
```
and export:
```ts
/** Shown wherever TNFD is named, so users know its status. */
export const TNFD_STATUS_NOTE = 'TNFD is concluding its technical work; the ISSB is developing nature-related requirements that build on it (exposure draft expected around COP17, October 2026).'
```

- [ ] **Step 4: Run** `node src/lib/crosswalk.test.ts && node src/lib/reports/reports.test.ts` — Expected: ok lines including `reports (TNFD attribution): ok`.
- [ ] **Step 5: Commit** `feat(esg): TNFD in the crosswalk register and attribution notice`.

---

### Task 2: Eight new ESG questions

**Files:** Modify `src/lib/esg.ts`; Create `src/lib/esg.test.ts`; Modify `package.json` (add `node src/lib/esg.test.ts` to `test`).

**Interfaces:** Produces question ids `ESG-G5`, `ESG-E5`, `ESG-N1`, `ESG-N2`, `ESG-N3`, `ESG-G6`, `ESG-V1`, `ESG-V2` in `ESG_QUESTIONS`.

- [ ] **Step 1: Failing test** `src/lib/esg.test.ts`:
```ts
// Self-check: `node src/lib/esg.test.ts`
import assert from 'node:assert/strict'
import { ESG_QUESTIONS } from './esg.ts'

const NEW = ['ESG-G5', 'ESG-E5', 'ESG-N1', 'ESG-N2', 'ESG-N3', 'ESG-G6', 'ESG-V1', 'ESG-V2']
assert.equal(ESG_QUESTIONS.length, 20)
for (const id of NEW) assert.ok(ESG_QUESTIONS.some((q) => q.id === id), `question ${id}`)
assert.equal(new Set(ESG_QUESTIONS.map((q) => q.id)).size, 20, 'unique ids')
for (const q of ESG_QUESTIONS) {
  assert.ok(q.recommendation.length > 20 && q.financingNote.length > 20, `${q.id} has recommendation and financing note`)
  for (const k of [0, 1, 2, 3, 4, 5] as const) assert.ok(q.soe[k]?.length > 5, `${q.id} level ${k}`)
  assert.ok(!/\b(compliant|certified)\b/i.test(q.question), `${q.id} wording`)
}
assert.ok(ESG_QUESTIONS.filter((q) => q.id.startsWith('ESG-N')).every((q) => q.frameworkRefs.includes('TNFD')))
console.log('esg: ok')
```
- [ ] **Step 2: Run** `node src/lib/esg.test.ts` — Expected: FAIL `20 !== 12`.
- [ ] **Step 3: Implement** — append to `ESG_QUESTIONS`, each in its pillar's section (Environmental: E5, N1, N2, N3; Social: V1; Governance: G5, G6, V2), using the existing object shape:

```ts
  {
    id: 'ESG-E5', pillar: 'Environmental', domain: 'Targets & Reduction', frameworkRefs: ['IFRS S2', 'SBTi (reference)'],
    question: 'Are there time-bound reduction targets for emissions, energy, water or waste, with a plan to meet them?',
    soe: { 0: 'No targets exist.', 1: 'Aspirations are stated without numbers or dates.', 2: 'Some numeric targets exist but have no plan or owner.',
      3: 'Time-bound targets for the main impacts have an owner and a plan.', 4: 'Progress against targets is tracked and reported to leadership.', 5: 'Targets are science-informed, externally reviewed and met or on track.' },
    evidence: 'Target statement, reduction plan, progress reports.',
    recommendation: 'Set one or two time-bound reduction targets for your largest impacts, name an owner and review progress quarterly.',
    financingNote: 'Green and sustainability-linked finance is priced against credible, time-bound targets.',
  },
  {
    id: 'ESG-N1', pillar: 'Environmental', domain: 'Nature: Locate & Evaluate', frameworkRefs: ['TNFD', 'IFRS S1'],
    question: 'Has the organisation located where its sites, supply chain or activities interface with nature, including sensitive areas, and evaluated its dependencies and impacts on nature?',
    soe: { 0: 'Nature is not considered.', 1: 'Some sites near sensitive areas are known informally.', 2: 'Sites are listed but dependencies and impacts are not evaluated.',
      3: 'Sites and key supply chains are mapped against sensitive areas and the main dependencies and impacts are evaluated.', 4: 'The evaluation covers the value chain and is updated regularly.', 5: 'The evaluation uses recognised data sources and is reviewed independently.' },
    evidence: 'Site map against protected and key biodiversity areas, dependency and impact screening.',
    recommendation: 'Map your sites and main supply sources against protected and high-biodiversity areas, then list what you depend on (water, soil, ecosystems) and what you affect.',
    financingNote: 'Funders and investors increasingly ask for nature screening alongside climate, following the TNFD approach.',
  },
  {
    id: 'ESG-N2', pillar: 'Environmental', domain: 'Nature: Assess & Prepare', frameworkRefs: ['TNFD', 'IFRS S1'],
    question: 'Are nature-related risks and opportunities assessed and managed alongside other risks, with responses prioritised?',
    soe: { 0: 'Nature risks are not considered.', 1: 'Nature risks are discussed occasionally.', 2: 'Some nature risks are listed but not assessed.',
      3: 'Material nature risks and opportunities are assessed and in the risk register with responses.', 4: 'Responses are funded, owned and reviewed.', 5: 'Nature risk management shapes strategy and investment decisions.' },
    evidence: 'Risk register entries, nature risk assessment, response plans.',
    recommendation: 'Add your material nature risks to the risk register with an owner and a response, and review them with other risks.',
    financingNote: 'Unmanaged nature dependencies (for example water) are a growing credit and operational risk for lenders.',
  },
  {
    id: 'ESG-N3', pillar: 'Environmental', domain: 'Nature: Metrics & Targets', frameworkRefs: ['TNFD', 'IFRS S1'],
    question: 'Are nature-related metrics and targets set and reported (for example land use change, pollution, water from stressed areas)?',
    soe: { 0: 'No nature metrics are tracked.', 1: 'Ad hoc figures exist.', 2: 'Some metrics are tracked without targets.',
      3: 'Core nature metrics are tracked with targets.', 4: 'Metrics and progress are reported publicly.', 5: 'Metrics are assured and aligned with recognised disclosure frameworks.' },
    evidence: 'Metric definitions, data, targets, published report.',
    recommendation: 'Choose a few core nature metrics that match your impacts, set targets and report them each year.',
    financingNote: 'Measured nature metrics let funders track outcomes and support nature-positive finance.',
  },
  {
    id: 'ESG-V1', pillar: 'Social', domain: 'Value Chain', frameworkRefs: ['GRI 308', 'GRI 414', 'IFRS S2'],
    question: 'Does the organisation work with suppliers and partners to measure and reduce value-chain impacts, including indirect emissions and nature impacts?',
    soe: { 0: 'Suppliers are not engaged on sustainability.', 1: 'Expectations are mentioned informally.', 2: 'A supplier code exists but is not monitored.',
      3: 'Main suppliers are screened and engaged on key impacts.', 4: 'Value-chain data is collected and reduction programmes run with partners.', 5: 'Value-chain results are verified and drive sourcing decisions.' },
    evidence: 'Supplier code, screening records, engagement programme, value-chain data.',
    recommendation: 'Screen your main suppliers on environmental and social impacts and agree improvement actions with the highest-impact ones.',
    financingNote: 'Buyers and investors now ask for value-chain emissions and supplier due diligence.',
  },
  {
    id: 'ESG-G5', pillar: 'Governance', domain: 'Materiality', frameworkRefs: ['GRI 3', 'IFRS S1'],
    question: 'Has a materiality assessment identified the organisation\'s most significant ESG issues, reviewed at least every two years?',
    soe: { 0: 'No materiality assessment.', 1: 'Issues are chosen informally by management.', 2: 'A one-off assessment exists but is out of date.',
      3: 'A documented assessment with stakeholder input is reviewed at least every two years.', 4: 'Material issues drive targets and reporting.', 5: 'The assessment covers financial and impact materiality and is reviewed by the board.' },
    evidence: 'Materiality assessment, stakeholder input, board minutes.',
    recommendation: 'Run a materiality assessment with input from staff, partners and communities, and repeat it at least every two years.',
    financingNote: 'Materiality shows funders that ESG effort targets what matters most.',
  },
  {
    id: 'ESG-G6', pillar: 'Governance', domain: 'Strategy Integration', frameworkRefs: ['IFRS S1', 'TCFD', 'TNFD'],
    question: 'Is sustainability built into strategy, budgets and investment decisions, with named board-level oversight?',
    soe: { 0: 'Sustainability is separate from strategy.', 1: 'Mentioned in strategy without resources.', 2: 'Some budget is set aside but decisions ignore it.',
      3: 'Strategy and budgets include sustainability goals with named board oversight.', 4: 'Investment decisions test sustainability impacts and risks.', 5: 'Performance and pay are linked to sustainability outcomes.' },
    evidence: 'Strategic plan, budget lines, board terms of reference, investment papers.',
    recommendation: 'Name a board member or committee responsible for sustainability and add sustainability goals to the strategy and budget.',
    financingNote: 'Board-level oversight is a core expectation in IFRS S1 and S2 and in DFI governance reviews.',
  },
  {
    id: 'ESG-V2', pillar: 'Governance', domain: 'Collective Impact', frameworkRefs: ['SDGs (reference)'],
    question: 'Does the organisation contribute to sector, landscape or SDG-level collective action and report its impact?',
    soe: { 0: 'No external collaboration.', 1: 'Occasional participation in events.', 2: 'Member of initiatives without commitments.',
      3: 'Active in at least one collective initiative with stated commitments.', 4: 'Leads or co-leads initiatives and reports contribution.', 5: 'Collective results are measured and reported against the SDGs.' },
    evidence: 'Initiative memberships, commitments, impact reports.',
    recommendation: 'Join one sector or landscape initiative relevant to your material issues and report what you contribute.',
    financingNote: 'Collective action strengthens the case for blended and outcome-based finance.',
  },
```
- [ ] **Step 4: Run** `node src/lib/esg.test.ts && node src/lib/crosswalkExisting.test.ts` — Expected: `esg: ok`, `crosswalkExisting: ok`.
- [ ] **Step 5: Commit** `feat(esg): eight questions on materiality, targets, nature (TNFD LEAP), strategy, value chain and collective impact`.

---

### Task 3: TNFD and nature crosswalk mappings

**Files:** Modify `src/lib/crosswalkExisting.ts`, `src/lib/indices/safeguards.ts`, `src/lib/crosswalkExisting.test.ts`.

**Interfaces:** Consumes `tnfd` (Task 1), ESG ids (Task 2). Produces `alignmentAvailable('tnfd') === true`.

- [ ] **Step 1: Failing test** append to `src/lib/crosswalkExisting.test.ts`:
```ts
import { alignmentAvailable, buildAlignmentReport } from './reports/alignmentReport.ts'
assert.ok(indicatorsFor('tnfd', 'L').some((e) => e.id === 'ESG-N1') && indicatorsFor('tnfd', 'L').some((e) => e.id === 'CRAFT-ESS-16'))
assert.ok(indicatorsFor('tnfd', 'MT').some((e) => e.id === 'ESG-N3'))
assert.ok(indicatorsFor('tnfd', 'GOV').some((e) => e.id === 'ESG-G6'))
assert.equal(alignmentAvailable('tnfd'), true)
const onlyN = buildAlignmentReport('tnfd', { 'ESG-N1': 4 }, {})
assert.equal(onlyN.elements.find((e) => e.id === 'MT')!.coverage, 'not-assessed', 'unanswered elements stay not assessed')
assert.ok(entry('ESG-N1').rationale['tnfd:L'].length > 10)
console.log('crosswalkExisting (TNFD): ok')
```
- [ ] **Step 2: Run** — Expected: FAIL on the first assertion.
- [ ] **Step 3: Implement**
  - In `QUESTION_LINKS` add:
```ts
  'ESG-N1': { refs: 'tnfd:L tnfd:E ifrs-s1:STRAT', why: 'Locating sites against sensitive areas and evaluating dependencies and impacts are the first LEAP phases.' },
  'ESG-N2': { refs: 'tnfd:A tnfd:P tnfd:RIM ifrs-s1:RISK', why: 'Assessing and responding to nature risks is the assess and prepare phases and risk management.' },
  'ESG-N3': { refs: 'tnfd:MT ifrs-s1:METRICS', why: 'Nature metrics and targets are the metrics and targets pillar.' },
  'ESG-G1': { refs: 'tnfd:GOV', why: 'Board oversight of strategy and risk includes nature-related issues.' },
  'ESG-G6': { refs: 'tnfd:GOV tnfd:STRAT ifrs-s1:STRAT', why: 'Building sustainability into strategy with named board oversight.' },
  'ESG-E4': { refs: 'tnfd:STRAT', why: 'Climate and nature risk assessment feeds strategy resilience.' },
```
  - Apply `QUESTION_LINKS` to ESG entries as well as core entries: in the `ESG_QUESTIONS.map` block build `refs` and `rationale` the same way `coreEntry` does (pillar refs plus link refs not already present; link `why` for the added refs).
  - `CORE_DOMAIN_REFS['Env. & Social Safeguards']`: append ` tnfd:RIM`.
  - `src/lib/indices/safeguards.ts`: change the crosswalk argument of indicators 16 and 17 from `'afdb-iss:OS6'` to `'afdb-iss:OS6 tnfd:L tnfd:E tnfd:RIM'`.
- [ ] **Step 4: Run** `node src/lib/crosswalkExisting.test.ts && node src/lib/indices/indices.test.ts && node src/lib/reports/reports.test.ts` — Expected: all ok.
- [ ] **Step 5: Commit** `feat(esg): map nature questions and biodiversity indicators to TNFD`.

---

### Task 4: Maturity stage engine

**Files:** Create `src/lib/esgMaturity.ts`, `src/lib/esgMaturity.test.ts`; Modify `package.json`.

**Interfaces:**
```ts
export interface EsgStage { n: 1 | 2 | 3 | 4 | 5; name: string; summary: string; criteria: string[] }
export const ESG_STAGES: EsgStage[]
export interface EsgMaturity {
  stage: 0 | 1 | 2 | 3 | 4 | 5          // 0 = not yet at Foundations
  confirmed: boolean                    // false when stage ≥ 3 and a pillar's evidence is below Partial
  next: EsgStage | null                 // the stage to work towards
  missing: EsgQuestion[]                // unmet criteria up to and including `next`
  unanswered: number                    // unanswered criteria across all stages
}
export function esgMaturity(scores: Record<string, number>, evidence: Record<string, number>): EsgMaturity
export const EVIDENCE_CONFIRM_THRESHOLD = 2.5
```

- [ ] **Step 1: Failing test** `src/lib/esgMaturity.test.ts`:
```ts
// Self-check: `node src/lib/esgMaturity.test.ts`
import assert from 'node:assert/strict'
import { ESG_STAGES, esgMaturity } from './esgMaturity.ts'
import { ESG_DOCS, docKey, ESG_QUESTIONS } from './esg.ts'

const all = (v: number) => Object.fromEntries(ESG_STAGES.flatMap((s) => s.criteria).map((id) => [id, v]))
const fullEvidence = Object.fromEntries((['Environmental', 'Social', 'Governance'] as const).flatMap((p) => ESG_DOCS[p].map((d) => [docKey(p, d), 3])))
assert.equal(ESG_STAGES.map((s) => s.name).join('|'), 'Foundations|Efficiency|Resilience|Integrated value|Systemic leadership')
for (const s of ESG_STAGES) for (const id of s.criteria) assert.ok(ESG_QUESTIONS.some((q) => q.id === id), `criterion ${id} exists`)
// Nothing answered
const none = esgMaturity({}, {})
assert.equal(none.stage, 0); assert.equal(none.next!.n, 1); assert.equal(none.unanswered, 20)
// Everything at 3 with evidence → stage 5 confirmed
const top = esgMaturity(all(3), fullEvidence)
assert.equal(top.stage, 5); assert.equal(top.confirmed, true); assert.equal(top.next, null); assert.deepEqual(top.missing, [])
// Review Focus 2: no evidence → self-reported
assert.equal(esgMaturity(all(4), {}).confirmed, false)
// No skipping: a stage-2 gap caps at stage 1 even when later stages are met
const capped = esgMaturity({ ...all(4), 'ESG-E5': 1 }, fullEvidence)
assert.equal(capped.stage, 1); assert.equal(capped.next!.n, 2)
assert.deepEqual(capped.missing.map((q) => q.id), ['ESG-E5'])
// Stages 1–2 need no evidence to be confirmed
assert.equal(esgMaturity({ ...all(3), 'ESG-E4': 0 }, {}).confirmed, true)
// Review Focus 1: legacy 12 answers only → not yet at Foundations because ESG-G5 is new
const legacy = Object.fromEntries(['ESG-E1', 'ESG-E2', 'ESG-E3', 'ESG-E4', 'ESG-S1', 'ESG-S2', 'ESG-S3', 'ESG-S4', 'ESG-G1', 'ESG-G2', 'ESG-G3', 'ESG-G4'].map((id) => [id, 4]))
const l = esgMaturity(legacy, fullEvidence)
assert.equal(l.stage, 0); assert.ok(l.missing.some((q) => q.id === 'ESG-G5')); assert.equal(l.unanswered, 8)
assert.ok(!/\b(compliant|certified)\b/i.test(JSON.stringify(ESG_STAGES)))
console.log('esgMaturity: ok')
```
- [ ] **Step 2: Run** — Expected: FAIL, cannot find `./esgMaturity.ts`.
- [ ] **Step 3: Implement** `src/lib/esgMaturity.ts`:
```ts
// The five-stage ESG maturity journey, placed from answers and confirmed by evidence. Stage names and descriptions are
// CRAFT's own; the idea of a staged journey draws on published sustainability maturity models (see the spec).
// Self-check: `node src/lib/esgMaturity.test.ts`.
import { ESG_QUESTIONS, pillarEvidenceScore, type EsgPillar, type EsgQuestion } from './esg.ts'

export interface EsgStage { n: 1 | 2 | 3 | 4 | 5; name: string; summary: string; criteria: string[] }
export const ESG_STAGES: EsgStage[] = [
  { n: 1, name: 'Foundations', summary: 'Policies, legal permits, fair labour, ethics and board oversight in place; material issues identified.', criteria: ['ESG-E3', 'ESG-S1', 'ESG-G1', 'ESG-G2', 'ESG-G5'] },
  { n: 2, name: 'Efficiency', summary: 'Emissions, energy, water and waste measured and managed, with reduction targets; safe workplaces.', criteria: ['ESG-E1', 'ESG-E2', 'ESG-E5', 'ESG-S2'] },
  { n: 3, name: 'Resilience', summary: 'Climate and nature risks assessed, risk management formalised, affected communities engaged.', criteria: ['ESG-E4', 'ESG-N1', 'ESG-N2', 'ESG-G3', 'ESG-S4'] },
  { n: 4, name: 'Integrated value', summary: 'Sustainability built into strategy, budget and board oversight, with regular disclosure and nature and climate targets.', criteria: ['ESG-G4', 'ESG-G6', 'ESG-N3', 'ESG-S3'] },
  { n: 5, name: 'Systemic leadership', summary: 'Working with the value chain on emissions and nature, and contributing to sector or SDG-level change.', criteria: ['ESG-V1', 'ESG-V2'] },
]
export const EVIDENCE_CONFIRM_THRESHOLD = 2.5 // "Partial" on the 0–4 evidence scale, scaled to 0–5

export interface EsgMaturity { stage: 0 | 1 | 2 | 3 | 4 | 5; confirmed: boolean; next: EsgStage | null; missing: EsgQuestion[]; unanswered: number }

const byId = new Map(ESG_QUESTIONS.map((q) => [q.id, q]))
const met = (scores: Record<string, number>, id: string) => (scores[id] ?? -1) >= 3

export function esgMaturity(scores: Record<string, number>, evidence: Record<string, number>): EsgMaturity {
  let stage = 0
  for (const s of ESG_STAGES) { if (s.criteria.every((id) => met(scores, id))) stage = s.n; else break }
  const next = ESG_STAGES.find((s) => s.n === stage + 1) ?? null
  const upTo = ESG_STAGES.filter((s) => s.n <= (next?.n ?? 0))
  const missing = upTo.flatMap((s) => s.criteria).filter((id) => !met(scores, id)).map((id) => byId.get(id)!)
  const unanswered = ESG_STAGES.flatMap((s) => s.criteria).filter((id) => !(id in scores)).length
  const pillars = new Set<EsgPillar>(ESG_STAGES.filter((s) => s.n <= stage).flatMap((s) => s.criteria).map((id) => byId.get(id)!.pillar))
  const confirmed = stage < 3 || [...pillars].every((p) => pillarEvidenceScore(p, evidence) >= EVIDENCE_CONFIRM_THRESHOLD)
  return { stage: stage as EsgMaturity['stage'], confirmed, next, missing, unanswered }
}
```
- [ ] **Step 4: Run** `node src/lib/esgMaturity.test.ts` — Expected: `esgMaturity: ok`. Add `node src/lib/esgMaturity.test.ts` (and `node src/lib/esg.test.ts` if not yet) to `package.json` `test`.
- [ ] **Step 5: Commit** `feat(esg): five-stage maturity engine with evidence confirmation`.

---

### Task 5: Next-stage gaps in the Capacity Improvement Plan

**Files:** Modify `src/lib/moduleFindings.ts`, `src/lib/moduleFindings.test.ts`, and the callers `src/pages/CIPPage.tsx`, `ReportsPage.tsx`, `NarrativeReportPage.tsx`, `DashboardPage.tsx`, `FindingsPage.tsx`.

**Interfaces:**
- Consumes `esgMaturity` (Task 4).
- Produces `deriveEsgFindings(esg: Record<string, number>, planMonths: number, startAt?: Record<Severity, number>): DerivedFinding[]` and `derivePlan(scores, p, planMonths, threshold = 2, esg: Record<string, number> = {})`.

- [ ] **Step 1: Failing test** append to `src/lib/moduleFindings.test.ts`:
```ts
import { deriveEsgFindings } from './moduleFindings.ts'
// Review Focus 4: no ESG scores → plan unchanged
assert.deepEqual(derivePlan({ 'GOV-01': 0 }, {}, 24), derivePlan({ 'GOV-01': 0 }, {}, 24, 2, {}))
// Only gaps up to the next stage; unanswered criteria are not actions
const esg = { 'ESG-E3': 3, 'ESG-S1': 3, 'ESG-G1': 3, 'ESG-G2': 1, 'ESG-G5': 2, 'ESG-N3': 0 }
const ef = deriveEsgFindings(esg, 24)
assert.deepEqual(ef.map((f) => f.id).sort(), ['ESG-G2', 'ESG-G5'], 'stage-4 gap ESG-N3 is not added while stage 1 is incomplete (Review Focus 3)')
assert.equal(ef.find((f) => f.id === 'ESG-G2')!.severity, 'Critical')
assert.equal(ef.find((f) => f.id === 'ESG-G5')!.severity, 'High')
assert.ok(derivePlan({}, {}, 24, 2, esg).some((f) => f.id === 'ESG-G2'), 'ESG actions reach the plan')
console.log('moduleFindings (ESG): ok')
```
- [ ] **Step 2: Run** — Expected: FAIL, `deriveEsgFindings` not exported.
- [ ] **Step 3: Implement** in `src/lib/moduleFindings.ts`:
```ts
import { esgMaturity } from './esgMaturity.ts'

/** Unmet ESG criteria up to the next maturity stage become plan actions; later stages wait, so the plan stays achievable. */
export function deriveEsgFindings(esg: Record<string, number>, planMonths: number, startAt: Record<Severity, number> = { Critical: 0, High: 0, Moderate: 0 }): DerivedFinding[] {
  const perSeverity = { ...startAt }
  const { missing, next } = esgMaturity(esg, {})
  return missing.filter((q) => q.id in esg && esg[q.id] <= 2).map((q) => {
    const score = esg[q.id]
    const severity = severityFromScore(score)
    const dueMonth = dueMonthFor(severity, perSeverity[severity]++, planMonths)
    return { id: q.id, qId: q.id, topic: `ESG maturity: towards ${next?.name ?? 'next stage'}`, domain: q.domain, tier: 0, severity, score,
      question: q.question, description: q.question, mitigation: q.recommendation,
      owner: q.pillar === 'Governance' ? 'Board Secretary' : 'Sustainability lead', dueMonth, dueDate: quarterLabel(dueMonth) }
  })
}
```
and change `derivePlan`:
```ts
export function derivePlan(scores: Record<string, number>, p: ModuleProfile, planMonths: number, threshold = 2, esg: Record<string, number> = {}): DerivedFinding[] {
  const core = deriveFindings(scores, threshold, planMonths)
  const startAt: Record<Severity, number> = { Critical: 0, High: 0, Moderate: 0 }
  for (const f of core) startAt[f.severity]++
  const modules = deriveModuleFindings(scores, p, planMonths, threshold, startAt)
  for (const f of modules) startAt[f.severity]++
  return [...core, ...modules, ...deriveEsgFindings(esg, planMonths, startAt)]
    .sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || a.dueMonth - b.dueMonth || a.tier - b.tier)
}
```
  Note: `deriveModuleFindings` already receives `startAt` by value; counting its results after the call keeps ESG actions after both.
  Callers: in each of `CIPPage`, `ReportsPage`, `NarrativeReportPage`, `DashboardPage`, `FindingsPage`, read `const [esgScores] = useLegacyAssessment<Record<string, number>>('esg:scores', {})` (ReportsPage and NarrativeReportPage already do) and pass it as the fifth argument with `2` as the fourth; add `esgScores` to the `useMemo` dependencies. Wallboard and the index report stay as they are.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit -p .` — Expected: all ok, exit 0.
- [ ] **Step 5: Commit** `feat(esg): next-stage ESG gaps feed the Capacity Improvement Plan`.

---

### Task 6: Show the stage

**Files:** Create `src/components/esg/EsgMaturityCard.tsx`; Modify `src/pages/EsgAssessmentPanel.tsx`, `src/pages/ReportsPage.tsx`, `src/pages/NarrativeReportPage.tsx`.

**Interfaces:** Consumes `esgMaturity`, `ESG_STAGES` (Task 4), `TNFD_STATUS_NOTE` (Task 1).

- [ ] **Step 1: Component**
```tsx
// The organisation's ESG maturity stage and what it needs to reach the next one.
import { Card, CardContent, CardHeader, CardTitle } from '../ui'
import { ESG_STAGES, type EsgMaturity } from '../../lib/esgMaturity'
import { TNFD_STATUS_NOTE } from '../../lib/crosswalk'

export function EsgMaturityCard({ m }: { m: EsgMaturity }) {
  const current = ESG_STAGES.find((s) => s.n === m.stage)
  return (
    <Card>
      <CardHeader><CardTitle>ESG maturity journey</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <ol className="grid gap-2 sm:grid-cols-5" aria-label="ESG maturity stages">
          {ESG_STAGES.map((s) => (
            <li key={s.n} className={`rounded-lg border p-3 text-sm ${s.n <= m.stage ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-500'}`}
              aria-current={s.n === m.stage ? 'step' : undefined}>
              <p className="text-xs font-semibold uppercase">Stage {s.n}</p><p className="font-semibold">{s.name}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-slate-700">
          {current ? <>Current stage: <strong>{current.name}</strong>{m.confirmed ? '' : ' (self-reported — add evidence to confirm)'}. {current.summary}</> : 'Not yet at Foundations.'}
        </p>
        {m.next && (
          <div>
            <h3 className="text-sm font-semibold text-slate-800">To reach Stage {m.next.n}: {m.next.name}</h3>
            <ul className="mt-1 space-y-1 text-sm text-slate-700">{m.missing.map((q) => <li key={q.id}><span className="font-mono text-xs">{q.id}</span> · {q.recommendation}</li>)}</ul>
          </div>
        )}
        {m.unanswered > 0 && <p className="text-xs text-slate-500">{m.unanswered} stage question{m.unanswered === 1 ? '' : 's'} not yet answered.</p>}
        <p className="text-xs text-slate-500">Nature questions follow the TNFD approach. {TNFD_STATUS_NOTE}</p>
      </CardContent>
    </Card>
  )
}
```
- [ ] **Step 2: Wire in** — `EsgAssessmentPanel.tsx`: `const maturity = useMemo(() => esgMaturity(scores, evidence), [scores, evidence])` and render `<EsgMaturityCard m={maturity} />` above the pillar sections. `ReportsPage.tsx` Executive Summary: add a line "ESG maturity: Stage N — Name (self-reported)" using `esgMaturity(esgScores, esgEvidence)` with `const [esgEvidence] = useLegacyAssessment<Record<string, number>>('esg:evidence', {})`. `NarrativeReportPage.tsx`: the same one-line statement in the ESG paragraph.
- [ ] **Step 3: Run** `npx tsc --noEmit -p .` and `npm run build` — Expected: exit 0.
- [ ] **Step 4: Commit** `feat(esg): maturity journey card on the ESG page and stage in reports`.

---

## Self-review notes

- Spec §2 → Task 4; §3 → Task 2; §4 → Task 5; §5 → Tasks 1, 3, 6; §6 tests spread across Tasks 1–5; attribution change approved by the owner → Task 1.
- Wallboard and the index report don't pass ESG scores (ESG is not loaded per organisation there); their labels already say core and index gaps.

## Owner amendments (18 October 2026)

1. **Provisional stage (Task 4).** Unanswered criteria do not drop an organisation's stage. Stage = highest stage *s* such that every stage up to *s* has at least one answered criterion and no answered criterion below 3. `EsgMaturity` gains `provisional: boolean` (true when any criterion up to the current stage is unanswered). The card shows "Stage N: Name (provisional — answer K new questions to confirm)". Tests: legacy 12 answers at 4 → stage 4, provisional; an answered criterion below 3 still caps (no skipping).
2. **New-questions notice (Task 6).** The ESG page shows a dismissible notice "8 new questions added, including nature (TNFD)" while any new question is unanswered and the organisation has earlier answers; dismissal is remembered per browser (localStorage, wrapped in try/catch).
3. **Wallboard counts ESG gaps (new Task 7).** Load each organisation's `esg:scores` the same way as `modules:profile` (one request per organisation); pass them to `derivePlan`. Same fallback: until all profiles and ESG answers load, or if any request fails, counts are core-only and labelled "Core assessment gaps only"; otherwise "Core, index and ESG gaps". Solo view uses the organisation's own ESG answers.
