# ESG maturity journey and TNFD nature alignment — design

**Date:** 18 October 2026 · **Owner:** Abiola Oshunniyi · **Status:** direction approved in conversation; awaiting spec review

## 1. Purpose

CRAFT's ESG Self-Assessment gives scores (12 questions, three pillars, response plus evidence). Organisations also need to know **where they are on the sustainability journey and what to do next**, and funders increasingly ask about **nature** as well as climate. This adds:

1. A **five-stage ESG maturity journey**, placed from evidence, with "to reach the next stage" actions that feed the Capacity Improvement Plan.
2. **Nature-related questions** built on the TNFD approach (LEAP: Locate, Evaluate, Assess, Prepare), and **TNFD in the framework crosswalk** so the alignment report covers it.

References (concepts only, no text reproduced): One Stop ESG, "Sustainability Maturity Journey" (five-stage progression from compliance to transformation); TNFD recommendations and LEAP approach (tnfd.global). TNFD is concluding its technical work as the ISSB develops nature-related requirements building on it (exposure draft expected around COP17, October 2026); CRAFT shows this status note wherever TNFD is named.

## 2. The five stages (CRAFT wording)

| Stage | Name | What it means |
|---|---|---|
| 1 | Foundations | Policies, legal permits, fair labour, ethics and board oversight in place; material issues identified. |
| 2 | Efficiency | Emissions, energy, water and waste measured and managed, with reduction targets; safe workplaces. |
| 3 | Resilience | Climate and nature risks assessed, risk management formalised, affected communities engaged. |
| 4 | Integrated value | Sustainability built into strategy, budget and board oversight; regular, reliable disclosure; nature and climate metrics and targets. |
| 5 | Systemic leadership | Working with the value chain on emissions and nature, and contributing to sector or SDG-level change. |

### Placement rules
- Each stage has **criteria** (question ids, §3). A criterion is met when its answer is **3 (Defined) or higher**.
- An organisation's stage is the **highest stage whose criteria, and all lower stages' criteria, are met** (no skipping). Below stage 1: "Not yet at Foundations".
- **Evidence check:** for stages 3–5, the stage is shown as **confirmed** only if the evidence level for every pillar involved is Partial or better; otherwise it shows "Stage N (self-reported — add evidence to confirm)". This addresses self-overrating.
- Unanswered criteria count as not met; the page says how many are unanswered.

## 3. Questions

Existing questions keep their ids. Eight are added (all 0–5, with recommendation and financing note like the others, in CRAFT's own words):

| Id | Pillar | Question (summary) | Stage |
|---|---|---|---|
| ESG-G5 | Governance | Has a materiality assessment identified the organisation's most significant ESG issues, reviewed at least every two years? | 1 |
| ESG-E5 | Environmental | Are there time-bound reduction targets for emissions, energy, water or waste, with a plan to meet them? | 2 |
| ESG-N1 | Environmental | Has the organisation located where its sites, supply chain or activities interface with nature, including sensitive areas, and evaluated its dependencies and impacts on nature? (TNFD LEAP: Locate, Evaluate) | 3 |
| ESG-N2 | Environmental | Are nature-related risks and opportunities assessed and managed alongside other risks, with responses prioritised? (LEAP: Assess, Prepare) | 3 |
| ESG-N3 | Environmental | Are nature-related metrics and targets set and reported (e.g. land use change, pollution, water from stressed areas)? | 4 |
| ESG-G6 | Governance | Is sustainability built into strategy, budgets and investment decisions, with named board-level oversight? | 4 |
| ESG-V1 | Social | Does the organisation work with suppliers and partners to measure and reduce value-chain impacts (including indirect emissions and nature impacts)? | 5 |
| ESG-V2 | Governance | Does the organisation contribute to sector, landscape or SDG-level collective action and report its impact? | 5 |

Stage criteria:

| Stage | Criteria |
|---|---|
| 1 Foundations | ESG-E3, ESG-S1, ESG-G1, ESG-G2, ESG-G5 |
| 2 Efficiency | ESG-E1, ESG-E2, ESG-E5, ESG-S2 |
| 3 Resilience | ESG-E4, ESG-N1, ESG-N2, ESG-G3, ESG-S4 |
| 4 Integrated value | ESG-G4, ESG-G6, ESG-N3, ESG-S3 |
| 5 Systemic leadership | ESG-V1, ESG-V2 |

The ESG score itself (pillar and verified composite) now uses all 20 questions; existing answers are kept.

## 4. Next-stage actions and the Capacity Improvement Plan

- The ESG page shows "To reach Stage N+1": each unmet criterion of the next stage (and any unmet lower-stage criterion) with its recommendation.
- `deriveEsgFindings(esgScores, …)` turns unmet criteria **up to the next stage** into plan actions (tier 0, severity from score as for other findings: 0–1 Critical, 2 High; unanswered not included), merged into `derivePlan` on the same schedule. Owner: Sustainability lead (or Board for governance items).
- Later-stage criteria beyond the next stage are not added to the plan, so the plan stays achievable.

## 5. TNFD in the crosswalk and reports

- Add `tnfd` to `EXTERNAL_FRAMEWORKS`: owner "Taskforce on Nature-related Financial Disclosures", kind `framework`, elements: GOV (Governance), STRAT (Strategy), RIM (Risk and impact management), MT (Metrics and targets), L (Locate), E (Evaluate), A (Assess), P (Prepare) — CRAFT labels.
- Map: ESG-N1 → L, E; ESG-N2 → A, P, RIM; ESG-N3 → MT; ESG-G1, ESG-G6 → GOV; ESG-E4, ESG-G6 → STRAT; E&S Safeguards index biodiversity indicators → L, E, RIM; core `Env. & Social Safeguards` domain → RIM. With ≥5 mapped questions, TNFD appears automatically in the Framework alignment report.
- Also map ESG-N1–N3 to `ifrs-s1` (STRAT/RISK/METRICS as already defined) where they fit.
- Reports: the ESG maturity stage and next-stage actions appear on the ESG page, in the Executive Summary and in the Narrative report. The alignment report and ESG page show the TNFD status note (§1).
- Attribution notice: add "TNFD" to the list of named third-party frameworks (owner to confirm the amended wording, since the notice was approved as final text).

## 6. Tests

- Stage placement: all criteria at 3 → stage 5; a gap at stage 2 caps at stage 1 even if stage 3–5 criteria are met (no skipping); unanswered = not met; nothing answered → "Not yet at Foundations".
- Evidence check: stage 3+ with a pillar below Partial → self-reported label; at Partial → confirmed.
- Plan: only next-stage (and lower) unmet criteria become actions; severities from score; core score unaffected.
- Crosswalk: `tnfd` refs valid; `alignmentAvailable('tnfd')` true; every new question has recommendation and financing note.
- Copy: no "compliant/certified" in stage names or labels.

## 7. Out of scope

A TNFD-format disclosure report; nature metrics data collection beyond the 0–5 answers; ISSB nature requirements (revisit when the exposure draft is final); the second reference link (to be supplied).
