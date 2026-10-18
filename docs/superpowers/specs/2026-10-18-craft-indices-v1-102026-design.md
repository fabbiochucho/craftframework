# CRAFT indices v1 (102026): organisational strengthening, change, fiduciary controls and safeguards

Status: design, awaiting owner review · 18 October 2026 · decisions by Abiola Oshunniyi (owner)

## 1. Goal

Strengthen CRAFT as an organisational strengthening and improvement platform by adding four new scored indices,
a crosswalk to the external frameworks funders and regulators recognise, framework alignment reports, an ISO
certification readiness report, a suggested Capacity Improvement Plan (CIP) timeframe, and (phase 2) quantified
risk in money ranges. Every indicator is CRAFT's own wording; external frameworks are cited, never copied.

Decisions already taken by the owner:

| Decision | Choice |
|---|---|
| How frameworks appear | Crosswalk first, then new original indicators where the crosswalk shows a gap (option C) |
| Validation | The new indices are validatable from launch (option B), because adoption is still low |
| Version label | `v1 (102026)` (version 1, October 2026), not "pilot" |
| Specialist accreditation | Required to validate Fiduciary Controls & Risk Management and Environmental & Social Safeguards |
| E&S safeguards | Its own fourth index |
| Risk and ISO | ERM joins the fiduciary index; information security and AI join the crosswalk; ISO readiness is a report, not a score |
| CIP timeframe | CRAFT suggests one; the organisation can accelerate, set a target date, extend, or override per action |
| FAIR | Built in phase 2, after phase 1 ships, because funders and boards respond to real numbers |
| Claims | Stated as aims ("helps", "designed to", "aligned with"), never guarantees, certification or a "rating" CRAFT issues |

## 2. The four indices

All four reuse the existing `FoundationModule` shape in `src/lib/foundationModules.ts` (dimensions → indicators on the
fiduciary 0–5 scale with a descriptor per score, evidence, recommendation, why it matters, maturity bands, lenses),
extended with the fields in section 3. Ids use the existing `CRAFT-` module prefix so scores stay out of the core
ladder (`MODULE_SCORE_PREFIX`).

### 2.1 Organisational Effectiveness (`craft-health`, prefix `CRAFT-OHE-`)

Draws on: organisational health research (including the McKinsey Organizational Health Index and 7S Framework),
Nadler-Tushman congruence, Burke-Litwin, Galbraith Star Model, Lencioni's disciplines, the Competing Values Framework,
employee engagement research, the Balanced Scorecard.

| Dimension | Question it answers |
|---|---|
| Direction & Strategic Clarity | Does everyone know where the institution is going and how their work contributes? |
| Leadership Cohesion | Does the leadership team act as one, with trust and shared decisions? |
| Design Fit | Do strategy, structure, processes, rewards and people pull in the same direction? |
| Accountability & Performance Management | Are results owned by named people and managed against balanced measures? |
| Culture & Working Climate | Does the way people actually work support the strategy? |
| Engagement & Motivation | Do people have what they need and want to give their best? |
| Capabilities & Talent | Does the institution have, grow and keep the skills its strategy needs? |
| External Orientation | Does the institution listen to the people it serves, funders and partners, and act on it? |

24 indicators (3 per dimension). Learning and innovation are already measured by the Transformation index; the
crosswalk links them rather than duplicating them.

### 2.2 Change Readiness & Adoption (`craft-change`, prefix `CRAFT-CHG-`)

Draws on: Prosci ADKAR, Kotter's change model, Lewin, Bridges' transition model, and the models in the Prosci and
SI Labs overviews. Overlaps the Transformation index's Change Leadership & Culture dimension; that overlap is
crosswalked, and these indicators focus on delivering a specific change (including the CIP itself).

| Dimension | Question it answers |
|---|---|
| Case for Change | Is the reason for change understood and accepted by those it affects? |
| Sponsorship & Coalition | Do visible sponsors and a guiding group own the change? |
| Individual Adoption | Do people move from awareness to ability to sustained new practice? |
| Transition Support | Are people supported through the loss and uncertainty change brings? |
| Quick Wins & Momentum | Are early results produced, shown and used to build momentum? |
| Sustaining the Change | Is the new way embedded in systems, roles and measures so it lasts? |

18 indicators. Gaps here become CIP actions about how the plan is delivered, and feed the timeframe (section 6).

### 2.3 Fiduciary Controls & Risk Management (`craft-fiduciary`, prefix `CRAFT-FCR-`) · specialist

Draws on: COSO Internal Control (5 components, 17 principles), COSO Enterprise Risk Management (5 components,
20 principles), ISO 31000, the IFC Corporate Governance Development Framework, the Nigerian Code of Corporate
Governance 2018, PEFA (public bodies only).

| Dimension | Applies to |
|---|---|
| Control Environment | All |
| Risk Assessment (internal control) | All |
| Control Activities | All |
| Information & Reporting | All |
| Monitoring & Internal Audit | All |
| Board & Governance Practice | All |
| Risk Governance & Appetite | All |
| Risk Treatment & Monitoring | All |
| Public Financial Management | Public bodies and entities managing public money only |

27 indicators (3 per dimension). The Public Financial Management dimension is out of scope (not scored, not
counted) unless the organisation's profile marks it as a public or state-adjacent body.

### 2.4 Environmental & Social Safeguards (`craft-safeguards`, prefix `CRAFT-ESS-`) · specialist

Draws on: the African Development Bank Integrated Safeguards System (10 Operational Safeguards) and IFRS S1/S2
for climate and sustainability risk governance. CRAFT's existing ESG module and IFRS S1/S2 surface are crosswalked.

Ten dimensions in CRAFT's own names, one per safeguard area: E&S Risk Management System; Labour & Working Conditions;
Resource Efficiency & Pollution; Community Health, Safety & Security (including GBV and harassment prevention);
Land & Resettlement; Biodiversity & Habitats; Vulnerable Groups; Cultural Heritage; Financial Intermediary E&S
Systems; Stakeholder Engagement & Grievance Redress.

About 25 indicators. Applicability is set by an E&S risk category the organisation declares through a short
screening (high / moderate / low, modelled on the categorisation logic multilateral lenders use, in CRAFT's words):

| Category | What is required |
|---|---|
| Low | E&S Risk Management System, Labour, Stakeholder Engagement & Grievance only |
| Moderate | Plus the dimensions the screening flags as relevant, and an active E&S management plan as evidence |
| High | All relevant dimensions; an independently prepared impact assessment is required evidence before the index can score above band 2 |

Land, Biodiversity, Cultural Heritage and Financial Intermediary dimensions are scored only when the screening flags
them. Grievance indicators require operating evidence (redacted register extracts, response times), not a policy alone.

## 3. Indicator content rules (copyright and quality)

Each new indicator adds these fields to `ModuleIndicator`:

| Field | Purpose |
|---|---|
| `version` | `'v1 (102026)'` on every indicator; a later edit is a new version, never a silent change |
| `crosswalk` | `[{ framework, ref, label }]`: framework id plus element id or clause number and a short title in CRAFT's words |
| `actionType` | `policy` · `process` · `system` · `people` · `practice` · `assurance`: drives the CIP timeframe |
| `minWeeks` | Shortest honest time to close the gap (e.g. 12 for "used in practice" evidence) |
| `appliesWhen` | Optional applicability rule (public body; E&S category; screening flag) |

Authoring rules:

1. Write each indicator from CRAFT's evidence-first view: what an institution must show, not what staff feel.
2. Never paraphrase a third-party question, statement or item one for one, and never reproduce standard text.
3. Cite frameworks at index and dimension level, and in the crosswalk by name plus element id or clause number only.
4. No third-party scores, benchmarks or equivalence claims ("OHI score", "COSO compliant").
5. Paper compliance cap applies as today: a high score with insufficient evidence is capped.
6. Founders review and sign off every indicator before it goes live; Claude drafts.

## 4. Crosswalk (`src/lib/crosswalk.ts`)

- A registry of external frameworks: id, full name, owner, kind (certifiable standard / guidance / framework /
  regulation / tool), and their element list as ids plus short CRAFT-worded labels (no copied text).
- Frameworks covered: McKinsey OHI and 7S (concept-level only), Nadler-Tushman, Burke-Litwin, Star Model, Lencioni,
  Competing Values, Balanced Scorecard, ADKAR, Kotter, Lewin, Bridges, COSO IC, COSO ERM, ISO 31000, IFC CGDF,
  NCCG 2018, PEFA, AfDB ISS, IFRS S1/S2, NIST CSF 2.0, and the ISO standards in section 5.2. Existing Pact OMT/OCA,
  Global Fund, GFA and AI governance frameworks are added as framework entries.
- Mappings: every existing CRAFT indicator (core ladder, foundation indices, ESG, health security) and every new
  indicator carries its crosswalk refs. A test checks every ref points to a registered framework element.

## 5. Reports

### 5.1 Index reports
One per index: band, dimension scores, weakest indicators, evidence status, lens views, the CIP actions it created.
Same PDF pipeline as today (`netlify/lib/reports.ts`).

### 5.2 Framework alignment reports
One per external framework the organisation selects: each framework element, the CRAFT indicators mapped to it,
their scores and evidence, coverage (covered / partial / gap / not applicable), and the CIP actions that close the gaps.
Titled "Alignment with [framework] principles (CRAFT mapping)". Footer: the attribution notice (section 9).

### 5.3 ISO certification readiness report
The organisation picks target standards. Certifiable: ISO 9001, 22301, 37001, 37301, 27001, 27701, 42001, 14001,
50001, 45001; ISO 14064-1 (verification). Shown for reference as guidance: ISO 31000, 37000, 37002, 26000, 30415,
30414, 14046, 14067, NIST CSF 2.0. For each: related CRAFT indicators and evidence, gaps, CIP actions tagged
"supports ISO ____ preparation". Fixed statement: CRAFT is not a certification body.

### 5.4 Existing reports
The CIP report gains the timeframe (phases, pace, overrides). The validation statement and public verification page
show index results (section 7).

## 6. Suggested CIP timeframe

There is no default plan length. The severity of each gap sets its window, and the plan's length is simply the date its
last action is due: a plan with a few Low gaps may take 4 months, one with many Critical gaps may need more than 24.
Replaces the fixed 24-month spread in `dueMonthFor` / `CIP_PLAN_MONTHS_DEFAULT` (`src/lib/data.ts`); `planMonths`
remains only as the "Target date" pace option. Pure function `suggestTimeline(actions, profile, pace, fixedDates)` in
`src/lib/cipTimeline.ts` with a self-check test.

Severity windows (Standard pace), measured from the plan's start:

| Severity | Start | Target close |
|---|---|---|
| Critical | Immediately | Within 3 months |
| High | Within 1 month | Within 6 months |
| Moderate | Within 3 months | Within 12 months |
| Low | When capacity allows | Within 18 months |

1. Order: Critical first, then High, Moderate, Low; within a severity, lower ladder rungs first; dependencies always
   respected (a `policy` action before `people` training on it; `system` before `practice`).
2. Duration per action: from gap size (target score minus current) and `actionType`, never below `minWeeks`. If
   `minWeeks` cannot fit inside the severity window, the action keeps `minWeeks` and is marked "needs longer than its
   severity window" with the reason. Change Readiness gaps add embedding time to the actions they affect.
3. Capacity: at most N concurrent actions per owner (N from organisation size: 2 small, 3 medium, 5 large); overflow
   moves later actions back and is shown as the reason.
4. Fixed dates: regulatory deadlines entered by the organisation, validation follow-up and expiry dates, funder
   deadlines; an action tied to one is due before it, whatever its severity.
5. Output: suggested start and due date per action, the resulting plan length, and phases derived from the actual
   dates (quick wins and critical gaps · core systems · embedding and practice evidence).

Pace options: Standard (the severity windows above) · Accelerated (shortens windows up to 40%, warns when an owner is
overloaded) · Target date (fits the plan to a chosen date and lists what cannot fit) · Extended (lengthens windows for
organisations with fewer people or less funding) · per-action override with a short reason.
Guardrails: `minWeeks` is never compressed (the UI says why); acceleration never shortens validation validity, but can
bring a follow-up check forward as today; the plan records its pace and every override, visible to validators and
consented funders.

## 7. Validation integration (option B)

- `FrameworkDef` in `src/lib/validationReview.ts` gains `result: 'rung' | 'band'`. The ladder stays `rung`; the four
  indices register as `band` frameworks with `bands`, `bandFor(scores)` and `blocking(scores)`.
- Engagement scope lists the frameworks covered (ladder plus any indices). The frozen snapshot records each framework
  key and version; snapshot schema bumps to 2 and old snapshots still render.
- Finalisation: the ladder rung as today; each index records its band and qualifications. The paper compliance cap
  applies to every framework.
- Public verification page and statement PDF: rung plus "CRAFT index results (v1 (102026))" with band per index;
  never scores or evidence. Statement wording is the lawyer-reviewed text in the validator system doc.
- Specialist accreditation: new `validator_specialisms` (validator, specialism `fiduciary` | `safeguards`, granted on
  passing the specialist assessment, renewed with the main accreditation). Engagement acceptance checks every
  validator named for a specialist index holds that specialism.
- Re-review, ratings, Review Panel: unchanged in shape; an "amended" outcome may name the index amended.
- Statistics and re-review flags count index validations separately from rung validations.

### 7.1 Training additions
- Module 9 "The CRAFT indices": all validators. Script plus video slot, practice, scenario, 5-question check.
- Specialist modules S1 Fiduciary Controls & Risk Management and S2 Environmental & Social Safeguards, each with a
  timed specialist assessment and one scenario case.
- Exam bank: 20 new questions for module 9; 15 per specialist assessment.
- Video scripts for module 9, S1 and S2 are added to the training content spec so a later video run can render them;
  the 21 October video run (modules 1–8) is unaffected.

## 8. Phase 2: quantified risk aligned with Open FAIR

Starts after phase 1 ships. Gate: confirm The Open Group / FAIR Institute licence position (lawyer question 4).

- Scenario: asset, threat, effect, linked to the Fiduciary Controls & Risk Management or Resilience indicators it
  relates to.
- Inputs as ranges (minimum, most likely, maximum, confidence): threat event frequency, vulnerability, and six loss
  forms (productivity, response, replacement, fines and penalties, competitive advantage, reputation).
- Engine: Monte Carlo (10,000 runs, PERT distributions), pure function with a seeded self-check test.
- Outputs: likely annual loss range, 10% and 90% points, loss exceedance curve chart.
- Cost of the gap: on a CIP action, likely annual loss with the gap open versus after the fix, against the action's
  estimated cost; used to rank actions.
- Data: financial inputs are restricted like evidence; shown to funders only with the organisation's consent.
- Guidance and calibration: estimation guide in the app; specialist-assisted runs offered through specialist
  validators.
- Not part of a validation. Wording: "a loss-quantification method aligned with Open FAIR". Results always shown as
  ranges with assumptions.

## 9. Legal and claims

- Attribution notice, ISO statement and the will-say / won't-say claims table: as in the validator system doc
  ("Third-party frameworks" section), pending lawyer review. Added to the methodology page, every alignment and
  ISO report footer, and the open-source README.
- Existing content: Pact OMT "exact Statements of Excellence" and Global Fund tab names are raised with counsel
  (question 2); no change until advice.

## 10. Build order

Each is its own implementation plan and PR series:

1. Content: four indices drafted (about 94 indicators), founder sign-off, crosswalk registry and mappings.
2. Self-assessment UI for the four indices, index reports, alignment reports, ISO readiness report, CIP actions.
3. Suggested CIP timeframe and pace controls.
4. Validation integration, specialist accreditation, training module 9 and specialist modules.
5. Phase 2: FAIR quantified risk and cost of the gap.

## 11. Testing

Unit self-checks for crosswalk integrity, band calculation, applicability rules, `suggestTimeline` (ordering, minimum
durations, capacity, acceleration limits) and the FAIR engine (seeded). Integration tests for multi-framework
engagements, specialist checks on acceptance, snapshot v2, and public page output. Accessibility and phone checks
on the new screens.

## 12. Out of scope

Third-party benchmarks or equivalence scores; issuing any rating or certification; reproducing third-party text;
automatic ISO gap scoring against clause text; FAIR inside validations.
