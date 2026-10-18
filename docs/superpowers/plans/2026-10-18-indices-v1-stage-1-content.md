# CRAFT indices v1 (102026), stage 1: content, crosswalk and self-assessment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the four CRAFT indices v1 (102026) as self-assessable modules with applicability rules, a crosswalk
registry, and a founder review export, hidden from organisations until the founders sign off.

**Architecture:** Each index is a `FoundationModule` (existing shape in `src/lib/foundationModules.ts`) in its own data
file under `src/lib/indices/`. Scoring helpers gain an optional `ModuleProfile` so non-applicable indicators drop out.
`src/lib/crosswalk.ts` holds the external framework registry; every new indicator carries crosswalk refs checked by a
test. The existing assessment UI renders the new modules; a `preview` flag limits them to the Super Admin until sign-off.

**Tech Stack:** TypeScript (strict), React 19 / TanStack Start, plain `node` assert self-checks (`node file.test.ts`,
type stripping), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-18-craft-indices-v1-102026-design.md` (sections 2, 3, 4).

## Global Constraints

- Version label on every new indicator: exactly `'v1 (102026)'`.
- Indicator ids: `CRAFT-OHE-NN`, `CRAFT-CHG-NN`, `CRAFT-FCR-NN`, `CRAFT-ESS-NN` (two digits), built with `MODULE_SCORE_PREFIX`.
- Never reproduce or paraphrase one-for-one any third-party question, statement or standard text; no third-party scores,
  benchmarks or "compliant/certified" wording (spec section 3).
- Crosswalk refs name a framework id plus an element id; element labels are CRAFT's own short words.
- Every indicator has descriptors for all of 0–5, `evidence`, `recommendation`, `whyItMatters`, `actionType`, `minWeeks`.
- Copy follows the site voice: plain English, British spelling, no em-dashes in new UI strings.
- New indices stay hidden from non-Super-Admin users until founders sign off (`preview: true`).

## Review Focus

1. A public-body flag left off: the Public Financial Management indicators must not count toward the composite, band or
   weakest-link cap (test in Task 1 and Task 5).
2. A dimension whose indicators are all non-applicable (e.g. Land & Resettlement for a low-risk NGO) must disappear
   from scoring and the radar, never score 0 or trigger the weakest-link cap (Task 1).
3. An organisation user opening `/assessment/craft-health` directly by URL before sign-off must see nothing (Task 7).
4. A typo in a crosswalk ref must fail the test suite, not silently drop from alignment reports later (Task 2).
5. Two modules reusing an indicator id would overwrite each other's scores in the shared score map; ids must be unique
   across all modules (Task 7).

---

### Task 1: Indicator fields, profile and applicability-aware scoring

**Files:**
- Modify: `src/lib/foundationModules.ts` (types at lines 29–75; scoring helpers at lines 764–848)
- Create: `src/lib/foundationModules.test.ts`
- Modify: `package.json` (`test` script: append `&& node src/lib/foundationModules.test.ts`)

**Interfaces:**
- Produces:
  - `type ActionType = 'policy' | 'process' | 'system' | 'people' | 'practice' | 'assurance'`
  - `type CrosswalkRef = { framework: string; ref: string }`
  - `type EsCategory = 'low' | 'moderate' | 'high'`
  - `type EsFlag = 'land' | 'biodiversity' | 'heritage' | 'intermediary'`
  - `interface ModuleProfile { publicBody?: boolean; esCategory?: EsCategory; esFlags?: EsFlag[] }`
  - `type Applicability = { publicBody?: true; esCategories?: EsCategory[]; esFlag?: EsFlag }`
  - `ModuleIndicator` gains optional `version?: string; crosswalk?: CrosswalkRef[]; actionType?: ActionType; minWeeks?: number; appliesWhen?: Applicability`
  - `FoundationModule` gains optional `version?: string; preview?: boolean; specialist?: 'fiduciary' | 'safeguards'`
  - `applies(i: ModuleIndicator, p?: ModuleProfile): boolean`
  - `applicableIndicators(m, p?)`, `applicableDimensions(m, p?)`
  - existing `dimensionScore`, `compositeScore`, `answeredIn`, `bandFor`, `evaluateLens`, `priorityGaps`, `strengths`
    gain an optional last parameter `p?: ModuleProfile`; with no profile, behaviour is unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/foundationModules.test.ts
// Self-check: `node src/lib/foundationModules.test.ts`
import assert from 'node:assert/strict'
import { applies, applicableDimensions, bandFor, compositeScore, type FoundationModule } from './foundationModules.ts'

const m: FoundationModule = {
  id: 'craft-resilience', no: '99', title: 't', question: 'q', intro: 'i', lensTitle: 'l', lensBlurb: 'b',
  dimensions: [{ key: 'a', name: 'A', question: '?' }, { key: 'pfm', name: 'PFM', question: '?' }],
  indicators: [
    { id: 'X-1', dimension: 'a', domain: 'd', question: 'q', soe: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '' }, recommendation: 'r', whyItMatters: 'w' },
    { id: 'X-2', dimension: 'pfm', domain: 'd', question: 'q', soe: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '' }, recommendation: 'r', whyItMatters: 'w', appliesWhen: { publicBody: true } },
  ] as never,
  bands: [{ min: 0, label: 'Low', summary: '', tone: 'rose' }, { min: 2, label: 'Mid', summary: '', tone: 'amber' }, { min: 4, label: 'High', summary: '', tone: 'emerald' }],
  lenses: [], weakestLinkFloor: 2, related: [],
}
const pfm = m.indicators[1]

// Applicability
assert.equal(applies(pfm, {}), false, 'public-body indicator hidden by default')
assert.equal(applies(pfm, { publicBody: true }), true)
assert.equal(applies(pfm), true, 'no profile = legacy behaviour: everything applies')
assert.deepEqual(applicableDimensions(m, {}).map((d) => d.key), ['a'], 'a dimension with no applicable indicator disappears')

// Scoring ignores non-applicable indicators
const scores = { 'X-1': 5, 'X-2': 0 }
assert.equal(compositeScore(m, scores, {}), 5)
assert.equal(compositeScore(m, scores, { publicBody: true }), 2.5)
assert.equal(bandFor(m, scores, {})?.band.label, 'High', 'non-applicable weak dimension does not cap the band')
assert.equal(bandFor(m, scores, { publicBody: true })?.band.label, 'Mid', 'weakest link caps when it applies')

// E&S categories and flags
const es = { appliesWhen: { esCategories: ['moderate', 'high'] } } as never
const flag = { appliesWhen: { esFlag: 'land' } } as never
assert.equal(applies(es, { esCategory: 'low' }), false)
assert.equal(applies(es, { esCategory: 'high' }), true)
assert.equal(applies(es, {}), false, 'no category declared yet: category-gated indicators wait for the screening')
assert.equal(applies(flag, { esCategory: 'high', esFlags: [] }), false)
assert.equal(applies(flag, { esCategory: 'low', esFlags: ['land'] }), true, 'a flagged area applies whatever the category')
console.log('foundationModules: ok')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node src/lib/foundationModules.test.ts`
Expected: FAIL, `applies` is not exported.

- [ ] **Step 3: Implement**

In `src/lib/foundationModules.ts`, add the types listed under Interfaces next to the existing interfaces, add the optional
fields, then add above the Scoring section:

```ts
export function applies(i: ModuleIndicator, p?: ModuleProfile): boolean {
  const w = i.appliesWhen
  if (!w || !p) return true
  if (w.publicBody && !p.publicBody) return false
  if (w.esFlag) return (p.esFlags ?? []).includes(w.esFlag)
  if (w.esCategories) return !!p.esCategory && w.esCategories.includes(p.esCategory)
  return true
}
export const applicableIndicators = (m: FoundationModule, p?: ModuleProfile) => m.indicators.filter((i) => applies(i, p))
export const applicableDimensions = (m: FoundationModule, p?: ModuleProfile) =>
  m.dimensions.filter((d) => applicableIndicators(m, p).some((i) => i.dimension === d.key))
```

Then thread `p?: ModuleProfile` through the scoring helpers so each uses `applicableIndicators(m, p)` instead of
`m.indicators`, and `applicableDimensions(m, p)` instead of `m.dimensions` (in `bandFor` weak-link check,
`indicatorsForDimension`, `compositeScore`, `answeredIn`, `evaluateLens`, `priorityGaps`, `strengths`). In
`evaluateLens`, drop lens indicator ids that do not apply.

- [ ] **Step 4: Run tests**

Run: `node src/lib/foundationModules.test.ts && npx tsc --noEmit`
Expected: `foundationModules: ok`, no type errors (existing callers pass no profile).

- [ ] **Step 5: Commit**

```bash
git add src/lib/foundationModules.ts src/lib/foundationModules.test.ts package.json
git commit -m "feat(indices): applicability-aware module scoring and indicator metadata"
```

---

### Task 2: Crosswalk registry

**Files:**
- Create: `src/lib/crosswalk.ts`
- Create: `src/lib/crosswalk.test.ts`
- Modify: `package.json` (`test`: append `&& node src/lib/crosswalk.test.ts`)

**Interfaces:**
- Produces:
  - `type FrameworkKind = 'certifiable' | 'guidance' | 'framework' | 'regulation' | 'tool'`
  - `interface ExternalFramework { id: string; name: string; owner: string; kind: FrameworkKind; elements: { id: string; label: string }[] }`
  - `const EXTERNAL_FRAMEWORKS: ExternalFramework[]`
  - `function crosswalkProblems(refs: { indicatorId: string; refs: CrosswalkRef[] }[]): string[]` (empty = valid)
  - `function frameworkById(id: string): ExternalFramework | undefined`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/crosswalk.test.ts — self-check: `node src/lib/crosswalk.test.ts`
import assert from 'node:assert/strict'
import { crosswalkProblems, EXTERNAL_FRAMEWORKS, frameworkById } from './crosswalk.ts'

const ids = EXTERNAL_FRAMEWORKS.map((f) => f.id)
assert.equal(new Set(ids).size, ids.length, 'framework ids unique')
for (const f of EXTERNAL_FRAMEWORKS) {
  const els = f.elements.map((e) => e.id)
  assert.equal(new Set(els).size, els.length, `${f.id}: element ids unique`)
  assert.ok(f.owner && f.name, `${f.id}: name and owner`)
}
for (const need of ['coso-ic', 'coso-erm', 'iso-31000', 'ifc-cgdf', 'nccg-2018', 'pefa', 'afdb-iss', 'ifrs-s1', 'ifrs-s2',
  'mck-ohi', 'mck-7s', 'nadler-tushman', 'burke-litwin', 'star-model', 'lencioni', 'cvf', 'bsc', 'adkar', 'kotter', 'lewin',
  'bridges', 'nist-csf-2', 'iso-9001', 'iso-27001', 'iso-22301', 'iso-37001']) assert.ok(frameworkById(need), `registered: ${need}`)
assert.equal(frameworkById('iso-31000')?.kind, 'guidance', 'ISO 31000 is guidance, never certifiable')
assert.equal(frameworkById('iso-27001')?.kind, 'certifiable')

assert.deepEqual(crosswalkProblems([{ indicatorId: 'A', refs: [{ framework: 'coso-ic', ref: 'CE' }] }]), [])
assert.deepEqual(crosswalkProblems([{ indicatorId: 'A', refs: [{ framework: 'coso', ref: 'CE' }] }]), ['A: unknown framework "coso"'])
assert.deepEqual(crosswalkProblems([{ indicatorId: 'A', refs: [{ framework: 'coso-ic', ref: 'ZZ' }] }]), ['A: coso-ic has no element "ZZ"'])
console.log('crosswalk: ok')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node src/lib/crosswalk.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/crosswalk.ts`**

Header comment: names, element ids and short labels only; labels are CRAFT's words; no third-party text. Registry
(element ids in brackets; write each label as a 2–6 word CRAFT phrase):

| id | name | owner | kind | elements |
|---|---|---|---|---|
| coso-ic | COSO Internal Control — Integrated Framework (2013) | COSO | framework | CE, RA, CA, IC, MA, P1 … P17 |
| coso-erm | COSO Enterprise Risk Management (2017) | COSO | framework | GC, SO, PF, RR, ICR |
| iso-31000 | ISO 31000:2018 Risk management | ISO | guidance | 4, 5, 6.3, 6.4, 6.5, 6.6, 6.7 |
| ifc-cgdf | IFC Corporate Governance Development Framework | IFC and partner DFIs | framework | COMMIT, BOARD, CONTROL, DISCLOSURE, SHAREHOLDERS, STAKEHOLDERS |
| nccg-2018 | Nigerian Code of Corporate Governance 2018 | Financial Reporting Council of Nigeria | regulation | BOARD, ASSURANCE, SHAREHOLDERS, CONDUCT, SUSTAINABILITY, TRANSPARENCY |
| pefa | PEFA framework (2016) | PEFA Secretariat | framework | I … VII |
| afdb-iss | AfDB Integrated Safeguards System | African Development Bank | framework | OS1 … OS10 |
| ifrs-s1 | IFRS S1 General sustainability disclosures | IFRS Foundation | framework | GOV, STRAT, RISK, METRICS |
| ifrs-s2 | IFRS S2 Climate-related disclosures | IFRS Foundation | framework | GOV, STRAT, RISK, METRICS |
| mck-ohi | Organizational Health Index (concept level) | McKinsey & Company | tool | DIRECTION, LEADERSHIP, CULTURE, ACCOUNTABILITY, COORDINATION, CAPABILITIES, MOTIVATION, EXTERNAL, INNOVATION |
| mck-7s | 7S Framework | McKinsey & Company | framework | STRATEGY, STRUCTURE, SYSTEMS, SHARED_VALUES, STYLE, STAFF, SKILLS |
| nadler-tushman | Congruence Model | Nadler & Tushman | framework | WORK, PEOPLE, FORMAL, INFORMAL |
| burke-litwin | Model of Organizational Performance and Change | Burke & Litwin | framework | EXTERNAL, MISSION, LEADERSHIP, CULTURE, STRUCTURE, PRACTICES, SYSTEMS, CLIMATE, TASK_SKILLS, NEEDS, MOTIVATION, PERFORMANCE |
| star-model | Star Model | Jay Galbraith | framework | STRATEGY, STRUCTURE, PROCESSES, REWARDS, PEOPLE |
| lencioni | Four Disciplines of Organizational Health | Patrick Lencioni | framework | COHESIVE_TEAM, CLARITY, OVERCOMMUNICATE, REINFORCE |
| cvf | Competing Values Framework | Cameron & Quinn | framework | CLAN, ADHOCRACY, MARKET, HIERARCHY |
| engagement | Employee engagement research (concept level) | Various | framework | MEASURE, ENABLERS, ACTION |
| bsc | Balanced Scorecard | Kaplan & Norton | framework | FINANCIAL, CUSTOMER, PROCESS, LEARNING |
| adkar | ADKAR Model | Prosci | framework | AWARENESS, DESIRE, KNOWLEDGE, ABILITY, REINFORCEMENT |
| kotter | 8-Step Process for Leading Change | John Kotter | framework | URGENCY, COALITION, VISION, VOLUNTEERS, BARRIERS, WINS, ACCELERATE, INSTITUTE |
| lewin | Change Model | Kurt Lewin | framework | UNFREEZE, CHANGE, REFREEZE |
| bridges | Transition Model | William Bridges | framework | ENDING, NEUTRAL, BEGINNING |
| nist-csf-2 | NIST Cybersecurity Framework 2.0 | NIST | guidance | GV, ID, PR, DE, RS, RC |
| iso-9001, iso-14001, iso-22301, iso-27001, iso-27701, iso-37001, iso-37301, iso-42001, iso-45001, iso-50001 | ISO management system standards | ISO | certifiable | MS (standard-level element only in stage 1) |
| iso-14064-1 | ISO 14064-1 GHG quantification | ISO | certifiable | MS |
| iso-37000, iso-37002, iso-26000, iso-30414, iso-30415, iso-14046, iso-14067 | ISO guidance standards | ISO | guidance | MS |

`crosswalkProblems` returns `"<indicatorId>: unknown framework \"<id>\""` or `"<indicatorId>: <framework> has no element \"<ref>\""`.

- [ ] **Step 4: Run tests** — `node src/lib/crosswalk.test.ts` → `crosswalk: ok`; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crosswalk.ts src/lib/crosswalk.test.ts package.json
git commit -m "feat(indices): external framework crosswalk registry"
```

---

### Content tasks (3–6): shared rules and the shared content test

Each index lives in `src/lib/indices/<name>.ts` and exports one `FoundationModule`. Every indicator follows this worked
example exactly in shape (content is per the tables below):

```ts
{
  id: `${P}OHE-01`, dimension: 'direction', domain: 'Strategy in Place',
  question: 'Is there a current, board-approved strategy with measurable goals for the next three to five years?',
  soe: {
    0: 'No written strategy; direction depends on the chief executive.',
    1: 'A strategy exists in draft or is out of date.',
    2: 'A current strategy exists but goals are not measurable.',
    3: 'A board-approved strategy sets measurable goals for three to five years.',
    4: 'Progress against the goals is reported to the board at least twice a year.',
    5: 'The strategy is reviewed yearly and progress data changes priorities and budgets.',
  },
  evidence: 'Board-approved strategy, board minutes approving it, latest progress report.',
  recommendation: 'Agree three to five measurable goals with the board and report progress against them every six months.',
  whyItMatters: 'Funders back institutions that know where they are going and can show progress toward it.',
  version: 'v1 (102026)', actionType: 'policy', minWeeks: 8,
  crosswalk: [{ framework: 'mck-ohi', ref: 'DIRECTION' }, { framework: 'mck-7s', ref: 'STRATEGY' }, { framework: 'bsc', ref: 'FINANCIAL' }],
},
```

Authoring rules (spec section 3): descriptors climb from absent (0) to practised and improving (5); 3 is "documented
and approved", 4 "operating with records", 5 "reviewed and improving"; evidence names documents or records a validator
can inspect; recommendation is one concrete next step; no third-party wording; `minWeeks` ≥ 12 whenever the 4 or 5
descriptor requires operating records.

Shared test `src/lib/indices/indices.test.ts` (created in Task 3, extended by Tasks 4–6 with one import each):

```ts
// Self-check: `node src/lib/indices/indices.test.ts`
import assert from 'node:assert/strict'
import { crosswalkProblems } from '../crosswalk.ts'
import { ORGANISATIONAL_HEALTH } from './organisationalHealth.ts'
import type { FoundationModule } from '../foundationModules.ts'

export function checkIndex(m: FoundationModule, prefix: string, expected: number) {
  assert.equal(m.indicators.length, expected, `${m.id}: indicator count`)
  assert.equal(m.version, 'v1 (102026)')
  assert.equal(m.preview, true, `${m.id}: hidden until founder sign-off`)
  const dims = new Set(m.dimensions.map((d) => d.key))
  m.indicators.forEach((i, n) => {
    assert.equal(i.id, `CRAFT-${prefix}-${String(n + 1).padStart(2, '0')}`, 'ids sequential')
    assert.ok(dims.has(i.dimension), `${i.id}: known dimension`)
    for (const s of [0, 1, 2, 3, 4, 5]) assert.ok((i.soe as Record<number, string>)[s]?.length > 10, `${i.id}: descriptor ${s}`)
    assert.ok(i.evidence && i.recommendation && i.whyItMatters, `${i.id}: evidence, recommendation, why`)
    assert.equal(i.version, 'v1 (102026)')
    assert.ok(i.actionType && (i.minWeeks ?? 0) >= 2, `${i.id}: actionType and minWeeks`)
    assert.ok((i.crosswalk ?? []).length > 0, `${i.id}: at least one crosswalk ref`)
    assert.ok(!/\b(certif|complian)/i.test(`${i.question} ${i.soe[5]}`), `${i.id}: no certification/compliance claims`)
  })
  for (const d of m.dimensions) assert.ok(m.indicators.some((i) => i.dimension === d.key), `${d.key}: has indicators`)
  for (const l of m.lenses) for (const id of l.indicatorIds) assert.ok(m.indicators.some((i) => i.id === id), `${l.key}: ${id}`)
  assert.deepEqual(crosswalkProblems(m.indicators.map((i) => ({ indicatorId: i.id, refs: i.crosswalk ?? [] }))), [])
}

checkIndex(ORGANISATIONAL_HEALTH, 'OHE', 24)
console.log('indices: ok')
```

Bands for all four indices (same thresholds as Resilience, CRAFT's own labels): `Fragile 0 · Developing 1.75 ·
Functional 2.75 · Strong 3.5 · Exemplary 4.4`; `weakestLinkFloor: 1.75`.

---

### Task 3: Organisational Health & Effectiveness index

**Files:**
- Create: `src/lib/indices/organisationalHealth.ts` (exports `ORGANISATIONAL_HEALTH`)
- Create: `src/lib/indices/indices.test.ts` (content above)
- Modify: `package.json` (`test`: append `&& node src/lib/indices/indices.test.ts`)

**Interfaces:** Consumes Task 1 types, Task 2 framework ids. Produces `ORGANISATIONAL_HEALTH: FoundationModule` with
`id: 'craft-health'`, `no: '14'`, `version: 'v1 (102026)'`, `preview: true`.

Module text: title "Organisational Health & Effectiveness Index"; question "Is the institution set up to deliver its
strategy, and do its people make that happen?"; lenses: `alignment` (Strategy to work: OHE-01, 02, 07, 10),
`people` (People to results: OHE-12, 16, 19, 20), `listening` (Outside in: OHE-22, 23, 24).

| Dimension (key) | Id | Domain | Question | actionType | minWeeks | Crosswalk |
|---|---|---|---|---|---|---|
| direction | 01 | Strategy in Place | (worked example above) | policy | 8 | mck-ohi DIRECTION; mck-7s STRATEGY; bsc FINANCIAL |
| direction | 02 | Strategy Cascade | Do team and individual plans trace back to the strategy's goals? | process | 12 | mck-ohi DIRECTION; lencioni CLARITY; star-model STRATEGY |
| direction | 03 | Shared Understanding | Can staff at every level explain the strategy's priorities and their own part in them? | practice | 12 | lencioni OVERCOMMUNICATE; burke-litwin MISSION |
| leadership | 04 | Leadership Rhythm | Does the leadership team meet on a set rhythm and record decisions with owners and dates? | process | 6 | lencioni COHESIVE_TEAM; mck-ohi LEADERSHIP |
| leadership | 05 | Constructive Challenge | Are disagreements in the leadership team raised, resolved and then backed collectively? | practice | 12 | lencioni COHESIVE_TEAM; mck-7s STYLE |
| leadership | 06 | Leadership Feedback | Is leaders' performance assessed, including structured feedback from their staff? | process | 12 | mck-ohi LEADERSHIP; burke-litwin LEADERSHIP |
| design | 07 | Structure Fit | Does the structure match the strategy's priorities, with clear reporting lines and decision rights? | policy | 8 | mck-7s STRUCTURE; star-model STRUCTURE; nadler-tushman FORMAL |
| design | 08 | Process Fit | Are core processes documented, owned and reviewed for fit with the strategy? | process | 12 | mck-7s SYSTEMS; star-model PROCESSES; nadler-tushman WORK |
| design | 09 | Rewards Fit | Do pay, promotion and recognition reinforce the behaviours and results the strategy needs? | policy | 12 | star-model REWARDS; burke-litwin SYSTEMS |
| accountability | 10 | Goal Ownership | Is every strategic goal owned by a named person with targets and deadlines? | process | 6 | mck-ohi ACCOUNTABILITY; lencioni REINFORCE |
| accountability | 11 | Balanced Measures | Are performance measures balanced across finances, the people served, internal processes and learning? | system | 12 | bsc FINANCIAL; bsc CUSTOMER; bsc PROCESS; bsc LEARNING |
| accountability | 12 | Individual Performance | Are individual objectives set, reviewed at least twice a year and linked to development and consequences? | process | 24 | mck-ohi ACCOUNTABILITY; burke-litwin PRACTICES |
| culture | 13 | Lived Values | Are the institution's values defined and applied in hiring, appraisal and decisions? | practice | 12 | mck-7s SHARED_VALUES; nadler-tushman INFORMAL |
| culture | 14 | Culture Check | Is the working culture assessed periodically and compared with the culture the strategy needs? | assurance | 12 | cvf CLAN; cvf ADHOCRACY; cvf MARKET; cvf HIERARCHY; mck-ohi CULTURE |
| culture | 15 | Speaking Up | Can staff raise concerns or mistakes without fear of retaliation, and is that tested? | practice | 12 | mck-ohi CULTURE; burke-litwin CLIMATE |
| engagement | 16 | Engagement Measured | Is staff engagement measured regularly, with results shared and acted on? | process | 12 | engagement MEASURE; engagement ACTION; mck-ohi MOTIVATION |
| engagement | 17 | Barriers Removed | Are resource and tooling problems raised by staff logged and resolved? | process | 8 | engagement ENABLERS; burke-litwin NEEDS |
| engagement | 18 | Retention Insight | Are staff turnover and absence tracked, with causes analysed and addressed? | system | 12 | engagement MEASURE; mck-7s STAFF |
| capabilities | 19 | Capability Gaps | Are the capabilities the strategy needs identified and compared with current skills? | process | 8 | mck-ohi CAPABILITIES; mck-7s SKILLS; burke-litwin TASK_SKILLS |
| capabilities | 20 | Learning Plan | Is there a funded learning plan that closes the identified skills gaps? | policy | 12 | mck-ohi CAPABILITIES; bsc LEARNING |
| capabilities | 21 | Hiring and Keeping Talent | Are key roles filled on time and strong performers retained, with both tracked? | system | 24 | star-model PEOPLE; mck-7s STAFF |
| external | 22 | Voice of the People Served | Is feedback from the people the institution serves collected systematically and used to change services? | practice | 12 | mck-ohi EXTERNAL; bsc CUSTOMER |
| external | 23 | Funder and Partner Feedback | Are relationships with funders and partners reviewed, with their feedback acted on? | process | 12 | mck-ohi EXTERNAL; burke-litwin EXTERNAL |
| external | 24 | Partnership Management | Are partnerships run with agreed objectives, regular reviews and exit terms? | policy | 8 | mck-ohi EXTERNAL; mck-ohi COORDINATION |

Dimension names and questions: as in spec section 2.1 (keys: direction, leadership, design, accountability, culture,
engagement, capabilities, external).

- [ ] **Step 1:** Create `indices.test.ts` (shared content above). Run `node src/lib/indices/indices.test.ts` → FAIL (module missing).
- [ ] **Step 2:** Write `organisationalHealth.ts` with all 24 indicators per the table and authoring rules.
- [ ] **Step 3:** Run `node src/lib/indices/indices.test.ts && npx tsc --noEmit` → `indices: ok`.
- [ ] **Step 4:** Commit: `git add src/lib/indices package.json && git commit -m "feat(indices): Organisational Health & Effectiveness index v1 (102026)"`

---

### Task 4: Change Readiness & Adoption index

**Files:** Create `src/lib/indices/changeReadiness.ts` (exports `CHANGE_READINESS`, `id: 'craft-change'`, `no: '15'`);
modify `indices.test.ts` (add import and `checkIndex(CHANGE_READINESS, 'CHG', 18)`).

Module text: title "Change Readiness & Adoption Index"; question "Can the institution deliver a change, including its own
improvement plan, so that it sticks?"; lenses: `start` (Starting well: CHG-01, 04, 07, 10), `land` (Landing it:
CHG-08, 09, 12, 13), `stick` (Making it stick: CHG-16, 17, 18).

| Dimension (key) | Id | Domain | Question | actionType | minWeeks | Crosswalk |
|---|---|---|---|---|---|---|
| case | 01 | Written Case for Change | Is the reason for each major change written down, with the problem, the goal and the cost of not changing? | policy | 4 | kotter URGENCY; adkar AWARENESS; lewin UNFREEZE |
| case | 02 | Consultation | Are the people affected consulted before a major change is decided? | process | 6 | adkar DESIRE; bridges ENDING |
| case | 03 | Understanding Checked | Is there evidence that staff understand why the change is happening? | assurance | 6 | adkar AWARENESS; kotter VISION |
| sponsorship | 04 | Named Sponsor | Does each major change have a named senior sponsor who is visibly involved? | people | 4 | kotter COALITION; adkar DESIRE |
| sponsorship | 05 | Change Team | Is there a cross-functional change team with time and authority to act? | people | 6 | kotter COALITION; kotter VOLUNTEERS |
| sponsorship | 06 | Sponsor Reviews | Do sponsors review change progress on a set schedule and remove blockers? | process | 8 | kotter BARRIERS; adkar REINFORCEMENT |
| adoption | 07 | Impact Assessment | Is the impact of each change assessed for every group it affects? | process | 4 | adkar KNOWLEDGE; bridges ENDING |
| adoption | 08 | Training Before Go-Live | Are people trained and coached in the new way of working before it starts? | people | 6 | adkar KNOWLEDGE; adkar ABILITY |
| adoption | 09 | Adoption Measured | Is adoption measured after go-live by use and proficiency, not just by completion? | system | 12 | adkar ABILITY; lewin REFREEZE |
| transition | 10 | Two-Way Communication | Does each major change have a communication plan with ways for people to respond? | process | 4 | kotter VISION; bridges NEUTRAL |
| transition | 11 | Concerns Handled | Are concerns and resistance logged and responded to? | process | 8 | bridges NEUTRAL; adkar DESIRE |
| transition | 12 | Support Through Transition | Is practical support (workload relief, wellbeing, manager guidance) given while people adjust? | people | 8 | bridges NEUTRAL; lewin CHANGE |
| wins | 13 | Early Milestones | Are milestones set that show results within the first three months? | process | 4 | kotter WINS |
| wins | 14 | Results Shared | Are early results communicated and credited to the people who produced them? | practice | 8 | kotter WINS; adkar REINFORCEMENT |
| wins | 15 | Course Correction | Is the change plan adjusted using lessons from early results? | practice | 12 | kotter ACCELERATE; lewin CHANGE |
| sustain | 16 | Written Into the System | Are new ways of working written into policies, procedures and job descriptions? | policy | 8 | kotter INSTITUTE; lewin REFREEZE |
| sustain | 17 | Measures and Incentives | Do performance measures and incentives reinforce the new practice? | policy | 12 | adkar REINFORCEMENT; kotter INSTITUTE |
| sustain | 18 | Post-Change Review | Is each major change reviewed 6 to 12 months after go-live to confirm it has lasted? | assurance | 26 | lewin REFREEZE; bridges BEGINNING |

Dimension names and questions: spec section 2.2 (keys: case, sponsorship, adoption, transition, wins, sustain).

- [ ] **Step 1:** Add the import and `checkIndex(CHANGE_READINESS, 'CHG', 18)` to `indices.test.ts`; run → FAIL.
- [ ] **Step 2:** Write `changeReadiness.ts`.
- [ ] **Step 3:** `node src/lib/indices/indices.test.ts && npx tsc --noEmit` → ok.
- [ ] **Step 4:** Commit `feat(indices): Change Readiness & Adoption index v1 (102026)`.

---

### Task 5: Fiduciary Controls & Risk Management index (specialist)

**Files:** Create `src/lib/indices/fiduciaryControls.ts` (exports `FIDUCIARY_CONTROLS`, `id: 'craft-fiduciary'`,
`no: '16'`, `specialist: 'fiduciary'`); modify `indices.test.ts` (import, `checkIndex(FIDUCIARY_CONTROLS, 'FCR', 27)`, and
the public-body assertions below).

Module text: title "Fiduciary Controls & Risk Management Index"; question "Would a funder's money be safe, well accounted
for and protected from the risks that matter?"; lenses: `fraud` (Fraud exposure: FCR-02, 04, 08, 09, 12),
`reporting` (Funder reporting: FCR-10, 11, 14), `board` (Board oversight: FCR-03, 15, 16, 19, 24).

Additional assertions in `indices.test.ts`:

```ts
import { applicableIndicators } from '../foundationModules.ts'
assert.equal(applicableIndicators(FIDUCIARY_CONTROLS, {}).length, 24, 'PFM hidden unless public body')
assert.equal(applicableIndicators(FIDUCIARY_CONTROLS, { publicBody: true }).length, 27)
assert.ok(FIDUCIARY_CONTROLS.indicators.filter((i) => i.dimension === 'pfm').every((i) => i.appliesWhen?.publicBody))
```

| Dimension (key) | Id | Domain | Question | actionType | minWeeks | Crosswalk |
|---|---|---|---|---|---|---|
| environment | 01 | Conduct and Conflicts | Do staff and board members sign a code of conduct and declare conflicts of interest every year? | policy | 6 | coso-ic CE; coso-ic P1; nccg-2018 CONDUCT; iso-37001 MS |
| environment | 02 | Segregation of Duties | Are authorising, recording and paying kept with different people? | process | 6 | coso-ic CA; coso-ic P10 |
| environment | 03 | Board Oversight of Control | Does the board or audit committee review internal control, with the review minuted? | assurance | 12 | coso-ic CE; coso-ic P2; ifc-cgdf CONTROL; nccg-2018 ASSURANCE |
| assessment | 04 | Fraud Risk Assessment | Are fraud risks assessed at least yearly across procurement, payroll, cash and grants? | assurance | 8 | coso-ic RA; coso-ic P8; iso-37001 MS |
| assessment | 05 | Control Objectives | Are control objectives defined for each major financial and operational process? | process | 8 | coso-ic RA; coso-ic P6 |
| assessment | 06 | New Risks From Change | Are new funders, systems and locations assessed for control risks before they start? | process | 8 | coso-ic RA; coso-ic P9 |
| activities | 07 | Approval Limits | Are approval limits documented and enforced in the systems people use? | system | 8 | coso-ic CA; coso-ic P11; coso-ic P12 |
| activities | 08 | Independent Reconciliation | Are bank and key accounts reconciled monthly and checked by someone independent? | practice | 12 | coso-ic CA; coso-ic P10 |
| activities | 09 | Procurement Controls | Are procurement rules (competition, thresholds, supplier checks) followed and tested? | practice | 12 | coso-ic CA; iso-37001 MS |
| information | 10 | Management Accounts | Are financial reports produced monthly, on time, and used by management? | practice | 12 | coso-ic IC; coso-ic P13; ifc-cgdf DISCLOSURE |
| information | 11 | Funder and Regulatory Reporting | Is funder and regulatory reporting accurate, on time and reconciled to the accounts? | practice | 12 | coso-ic IC; coso-ic P15; nccg-2018 TRANSPARENCY |
| information | 12 | Reporting Wrongdoing | Are there safe channels to report suspected fraud or misconduct, with cases tracked to closure? | practice | 12 | coso-ic IC; coso-ic P14; iso-37002 MS; nccg-2018 CONDUCT |
| monitoring | 13 | Internal Audit | Is there an internal audit function, in-house or outsourced, with a risk-based plan? | assurance | 12 | coso-ic MA; coso-ic P16; nccg-2018 ASSURANCE |
| monitoring | 14 | Audit Findings Closed | Are external and internal audit findings tracked to closure with deadlines? | process | 12 | coso-ic MA; coso-ic P17 |
| monitoring | 15 | Controls Tested | Is the effectiveness of key controls tested and reported to the board at least yearly? | assurance | 26 | coso-ic MA; coso-ic P16; ifc-cgdf CONTROL |
| board | 16 | Board Composition | Is the board's composition, independence and skills mix reviewed and documented? | policy | 12 | ifc-cgdf BOARD; nccg-2018 BOARD; iso-37000 MS |
| board | 17 | Board Evaluation | Does the board evaluate its own performance at least every two years? | assurance | 26 | ifc-cgdf BOARD; nccg-2018 BOARD |
| board | 18 | Board Committees | Are board committees (audit, finance, risk) chartered and meeting as their charters require? | policy | 12 | ifc-cgdf BOARD; nccg-2018 BOARD |
| risk-governance | 19 | Risk Appetite | Has the board approved a risk appetite statement for the main risk categories? | policy | 8 | coso-erm GC; coso-erm SO; iso-31000 5 |
| risk-governance | 20 | Risk Register | Is there a risk register with owners, ratings and review dates? | system | 6 | coso-erm PF; iso-31000 6.4 |
| risk-governance | 21 | Risk in Decisions | Is risk considered when strategy, budgets and major decisions are set? | practice | 12 | coso-erm SO; iso-31000 4 |
| risk-treatment | 22 | Treatment Plans | Does each high risk have a treatment plan with an owner and a deadline? | process | 8 | coso-erm PF; iso-31000 6.5 |
| risk-treatment | 23 | Risk Indicators | Are key risk indicators tracked against thresholds that trigger action? | system | 12 | coso-erm RR; iso-31000 6.6 |
| risk-treatment | 24 | Risk Reporting | Are risk reports reviewed by leadership and the board at least quarterly? | practice | 26 | coso-erm ICR; iso-31000 6.7 |
| pfm | 25 | Credible Budget | Is the budget realistic and executed close to plan, with variances explained? | practice | 26 | pefa I; pefa IV |
| pfm | 26 | Assets and Liabilities | Are assets, liabilities, arrears and guarantees recorded and reported? | system | 12 | pefa III |
| pfm | 27 | Commitment Control | Are commitments controlled so spending cannot exceed released funds? | system | 12 | pefa V |

Indicators 25–27 carry `appliesWhen: { publicBody: true }`. Dimension names: Control Environment; Risk Assessment;
Control Activities; Information & Reporting; Monitoring & Internal Audit; Board & Governance Practice; Risk Governance &
Appetite; Risk Treatment & Monitoring; Public Financial Management.

- [ ] **Step 1:** Extend `indices.test.ts`; run → FAIL.
- [ ] **Step 2:** Write `fiduciaryControls.ts`.
- [ ] **Step 3:** Run tests + `tsc` → ok.
- [ ] **Step 4:** Commit `feat(indices): Fiduciary Controls & Risk Management index v1 (102026)`.

---

### Task 6: Environmental & Social Safeguards index (specialist) and screening

**Files:** Create `src/lib/indices/safeguards.ts` (exports `SAFEGUARDS`, `id: 'craft-safeguards'`, `no: '17'`,
`specialist: 'safeguards'`, and `esScreening(answers: EsScreeningAnswers): { category: EsCategory; flags: EsFlag[] }`);
modify `indices.test.ts`.

**Interfaces:** Produces
`type EsScreeningAnswers = { physicalWorks: boolean; largeWorkforce: boolean; sensitiveLocation: boolean; acquiresLand: boolean; nearProtectedArea: boolean; nearHeritage: boolean; lendsOrInvests: boolean }`.
Category rule: `high` if `physicalWorks && (sensitiveLocation || acquiresLand)`; `moderate` if `physicalWorks || largeWorkforce`;
else `low`. Flags: `acquiresLand → land`, `nearProtectedArea → biodiversity`, `nearHeritage → heritage`, `lendsOrInvests → intermediary`.

Test additions:

```ts
import { esScreening, SAFEGUARDS } from './safeguards.ts'
checkIndex(SAFEGUARDS, 'ESS', 25)
const none = { physicalWorks: false, largeWorkforce: false, sensitiveLocation: false, acquiresLand: false, nearProtectedArea: false, nearHeritage: false, lendsOrInvests: false }
assert.deepEqual(esScreening(none), { category: 'low', flags: [] })
assert.deepEqual(esScreening({ ...none, physicalWorks: true, acquiresLand: true }), { category: 'high', flags: ['land'] })
const low = applicableIndicators(SAFEGUARDS, { esCategory: 'low', esFlags: [] }).map((i) => i.dimension)
assert.deepEqual([...new Set(low)].sort(), ['esms', 'labour', 'stakeholders'])
assert.equal(applicableIndicators(SAFEGUARDS, {}).length, 0, 'nothing scores before the screening is done')
```

Applicability: dimensions `esms`, `labour`, `stakeholders` → `esCategories: ['low','moderate','high']`; `resources`,
`community`, `vulnerable` → `['moderate','high']`; `land`, `biodiversity`, `heritage`, `intermediary` → `esFlag` of the same name.

| Dimension (key) | Id | Domain | Question | actionType | minWeeks | Crosswalk |
|---|---|---|---|---|---|---|
| esms | 01 | E&S Policy | Is there an environmental and social policy approved by leadership? | policy | 6 | afdb-iss OS1; iso-14001 MS |
| esms | 02 | Risk Screening | Are environmental and social risks screened and categorised for each project or operation? | process | 8 | afdb-iss OS1 |
| esms | 03 | Management Plan | Is there a staffed environmental and social management plan with monitoring and reporting? | system | 12 | afdb-iss OS1; iso-14001 MS |
| esms | 04 | Climate Risk Governance | Does the board oversee climate-related risks and opportunities, with them assessed at least yearly? | assurance | 12 | ifrs-s2 GOV; ifrs-s2 RISK |
| esms | 05 | Sustainability Disclosure | Are material sustainability risks, opportunities, metrics and targets reported to stakeholders? | practice | 26 | ifrs-s1 STRAT; ifrs-s1 METRICS; ifrs-s2 METRICS |
| labour | 06 | Terms and Conditions | Do all workers, including contractors, have written terms, fair wages and lawful hours? | policy | 8 | afdb-iss OS2; iso-45001 MS |
| labour | 07 | Workers' Grievances | Is there a grievance channel for workers outside the management line, with cases tracked to resolution? | practice | 12 | afdb-iss OS2 |
| labour | 08 | No Child or Forced Labour | Are child and forced labour prevented, including through checks on suppliers? | process | 12 | afdb-iss OS2 |
| resources | 09 | Resource Use | Are energy, water and materials use measured, with reduction targets? | system | 12 | afdb-iss OS3; iso-50001 MS; iso-14064-1 MS |
| resources | 10 | Pollution and Waste | Are waste and pollution managed under the permits that apply, and monitored? | practice | 12 | afdb-iss OS3; iso-14001 MS |
| community | 11 | Community Safety | Are risks to community health and safety assessed and reduced? | process | 8 | afdb-iss OS4 |
| community | 12 | GBV and Harassment | Are gender-based violence and sexual harassment prevented, with survivor-centred reporting and response? | practice | 12 | afdb-iss OS4; afdb-iss OS2 |
| community | 13 | Security and Rights | Are security arrangements proportionate and respectful of human rights? | policy | 8 | afdb-iss OS4 |
| land | 14 | Avoiding Displacement | Is land acquisition or restricted access avoided or minimised, with fair compensation where unavoidable? | process | 12 | afdb-iss OS5 |
| land | 15 | Livelihood Restoration | Is resettlement planned and are livelihood outcomes monitored afterwards? | practice | 26 | afdb-iss OS5 |
| biodiversity | 16 | Habitat Impacts | Are impacts on habitats and biodiversity assessed and then avoided, minimised or offset? | process | 12 | afdb-iss OS6 |
| biodiversity | 17 | Natural Resources | Are living natural resources used sustainably? | practice | 12 | afdb-iss OS6 |
| vulnerable | 18 | Vulnerable Groups Identified | Are the vulnerable groups affected by operations identified? | process | 6 | afdb-iss OS7 |
| vulnerable | 19 | Fair Share of Benefits | Are measures in place so vulnerable groups share in benefits and are not harmed? | practice | 12 | afdb-iss OS7 |
| heritage | 20 | Cultural Heritage | Are cultural heritage sites and practices identified and protected, with a chance-find procedure? | process | 8 | afdb-iss OS8 |
| intermediary | 21 | Portfolio Screening | Does the institution screen what it finances for environmental and social risk? | process | 8 | afdb-iss OS9 |
| intermediary | 22 | Financing Conditions | Are environmental and social conditions written into financing agreements and monitored? | practice | 12 | afdb-iss OS9 |
| stakeholders | 23 | Engagement Plan | Is there a stakeholder engagement plan covering disclosure and consultation? | policy | 6 | afdb-iss OS10 |
| stakeholders | 24 | Accessible Disclosure | Is information disclosed to affected people in languages and formats they can use? | practice | 8 | afdb-iss OS10 |
| stakeholders | 25 | Community Grievances | Is there an accessible, trusted community grievance mechanism, with cases logged and resolved? | practice | 12 | afdb-iss OS10 |

Grievance indicators (07, 25): descriptor 4 and 5 require redacted register extracts and response times (operating
evidence), never a policy alone.

- [ ] **Step 1:** Extend `indices.test.ts`; run → FAIL.
- [ ] **Step 2:** Write `safeguards.ts` (module + `esScreening`).
- [ ] **Step 3:** Run tests + `tsc` → ok.
- [ ] **Step 4:** Commit `feat(indices): Environmental & Social Safeguards index v1 (102026) and screening`.

---

### Task 7: Wire the indices into the app, behind the preview gate

**Files:**
- Modify: `src/lib/foundationModules.ts:29` (`FoundationModuleId` adds `'craft-health' | 'craft-change' | 'craft-fiduciary' | 'craft-safeguards'`) and `:746` (`FOUNDATION_MODULES` adds the four)
- Modify: `src/lib/frameworks.ts` (`FrameworkId` union; four `FRAMEWORKS` entries with `preview: true`; `FrameworkMeta` gains `preview?: boolean`)
- Modify: `src/pages/AssessmentFrameworkPage.tsx:84-88` (four new cases → `FoundationModulePanel`; a preview framework renders nothing unless the user is Super Admin)
- Modify: `src/pages/FrameworksPage.tsx:46` (hide `preview` entries unless Super Admin; show an "In review" badge to the Super Admin)
- Modify: `src/pages/FoundationModulePanel.tsx` (icons; profile controls; pass profile to every scoring call)
- Modify: `src/lib/indices/indices.test.ts` (id uniqueness across all modules)

**Interfaces:**
- Consumes: all four index exports; `ModuleProfile`, `esScreening`, `EsScreeningAnswers`.
- Produces: tenant-state key `modules:profile` holding `ModuleProfile & { esAnswers?: EsScreeningAnswers }`;
  `canSeePreview(role: string | undefined): boolean` in `src/lib/frameworks.ts` (`role === 'super_admin'`).

- [ ] **Step 1: Failing test for id uniqueness and preview helper**

Append to `src/lib/indices/indices.test.ts`:

```ts
import { FOUNDATION_MODULES } from '../foundationModules.ts'
import { canSeePreview, FRAMEWORKS } from '../frameworks.ts'
const allIds = FOUNDATION_MODULES.flatMap((m) => m.indicators.map((i) => i.id))
assert.equal(new Set(allIds).size, allIds.length, 'indicator ids unique across all modules')
for (const id of ['craft-health', 'craft-change', 'craft-fiduciary', 'craft-safeguards'])
  assert.equal(FRAMEWORKS.find((f) => f.id === id)?.preview, true, `${id} registered as preview`)
assert.equal(canSeePreview('super_admin'), true)
assert.equal(canSeePreview('admin'), false)
assert.equal(canSeePreview(undefined), false)
```

Run → FAIL.

- [ ] **Step 2: Register.** Add the ids, the four `FRAMEWORKS` entries (`scale: 'fiduciary-0-5'`, `theme: 'emerald'`,
  `authority: 'CRAFT · v1 (102026)'`, icons (lucide) `HeartPulse` health, `Repeat` change, `ShieldCheck` fiduciary,
  `Leaf` safeguards, added to the panel's icon map too; blurbs one sentence each in plain English, e.g. "Is the institution set up to deliver its strategy?
  24 indicators across direction, leadership, design, accountability, culture, engagement, capabilities and outside
  focus."), `canSeePreview`, and the four modules in `FOUNDATION_MODULES`.

- [ ] **Step 3: Gate.** In `FrameworksPage` filter `FRAMEWORKS.filter((f) => !f.preview || canSeePreview(currentUser?.role))`;
  for preview entries the Super Admin sees a slate "In review · v1 (102026)" badge. In `AssessmentFrameworkPage`, if
  `getFramework(id)?.preview && !canSeePreview(currentUser?.role)` render the same "not found" state the page uses for an
  unknown id.

- [ ] **Step 4: Profile controls in `FoundationModulePanel`.** Read `useTenantState<ModuleProfile & { esAnswers?: EsScreeningAnswers }>(email, orgId, demo, 'modules:profile', {}, readOnly)`.
  For `craft-fiduciary`: a checkbox "We are a public body or manage public money" (sets `publicBody`). For
  `craft-safeguards`: seven yes/no questions (labels: "We build, renovate or operate physical sites"; "We employ or
  contract more than 50 people"; "We work in a sensitive location (conflict, flood-prone, informal settlements)"; "We
  acquire land or restrict people's access to it"; "We work in or near protected or high-biodiversity areas"; "We work
  near cultural heritage sites"; "We lend to or invest in other organisations"), then show the resulting category and
  areas, and save `esCategory`/`esFlags` from `esScreening`. Until answered, the safeguards panel shows only the
  screening. Pass the profile to every scoring helper; render only `applicableDimensions` and `applicableIndicators`.

- [ ] **Step 5: Verify.** `npm test && npx tsc --noEmit && npm run build`. Then run the dev server (`npx vite dev --port 3100`),
  sign in as the Super Admin in the browser, open `/frameworks`: four "In review" cards. Open `/assessment/craft-fiduciary`:
  24 indicators; tick public body: 27. Open `/assessment/craft-safeguards`: screening only; answer all "no": three
  dimensions. Sign in as a test organisation admin (seeded local test account): `/frameworks` shows no new cards and
  `/assessment/craft-health` shows the not-found state.

- [ ] **Step 6: Commit** `feat(indices): register v1 (102026) indices behind a Super Admin preview gate`.

---

### Task 8: Founder review export

**Files:**
- Create: `scripts/export-indices-review.mjs`
- Create (generated, committed): `docs/indices/v1-102026-review.md`

**Interfaces:** Consumes `FOUNDATION_MODULES` (filtered to `version === 'v1 (102026)'`) and `EXTERNAL_FRAMEWORKS`.

- [ ] **Step 1:** Write the script: for each index, a heading, its question, then per dimension a table
  `Id | Question | 0 … 5 descriptors | Evidence | Recommendation | Action type | Min weeks | Draws on` (crosswalk rendered
  as framework names), plus a sign-off checklist line per index (`- [ ] Approved by Abiola · - [ ] Approved by Pauline`).
  Run with `node --experimental-strip-types scripts/export-indices-review.mjs`.
- [ ] **Step 2:** Run it; open the output and check all four indices and 94 indicators appear.
- [ ] **Step 3:** Commit `docs(indices): founder review export for v1 (102026)`.

---

## After stage 1

Open the PR; the founders review `docs/indices/v1-102026-review.md` (or a shared doc made from it). Sign-off flips
`preview` to `false` in a one-line PR. Stage 2 (reports, alignment, ISO readiness, existing-indicator crosswalk),
stage 3 (CIP timeframe), stage 4 (validation and specialist accreditation) and stage 5 (FAIR) each get their own plan.
