# Stage 5: quantified risk aligned with Open FAIR

**Goal:** An organisation estimates the loss from a risk scenario as ranges and gets a likely annual loss range. It also sees a loss exceedance curve and the cost of a gap: the loss with the gap open versus after the fix, against the action's cost.

**Spec:** `docs/superpowers/specs/2026-10-18-craft-indices-v1-102026-design.md` §8.

## Rulings
- **Licence gate (lawyer question 4).** The owner told us to treat the lawyer items as approved. Cost if wrong: the wording on one page. Constraints:
  - wording is only "a loss-quantification method aligned with Open FAIR";
  - no Open FAIR text, taxonomy diagrams or trademarks are reproduced beyond the name;
  - this is not part of a validation.
- **Ranking.** Actions are ranked on the risk page. The CIP page keeps its own order. Cost if wrong: one column later.

## Global constraints
- **Inputs are ranges** (minimum, most likely, maximum, confidence) for:
  - threat event frequency (per year);
  - vulnerability (a probability from 0 to 1);
  - six loss forms: productivity, response, replacement, fines and penalties, competitive advantage, reputation.
- **Engine.** Pure and seeded: 10,000 runs, with PERT distributions (λ = 4).
  - Each run draws a loss event count ~ Poisson(TEF × vulnerability).
  - Each loss event's magnitude is the sum of the six loss forms.
- **Outputs.** Mean, 10th, 50th and 90th percentiles, and loss exceedance points. Results are always shown as ranges, with their assumptions.
- **Cost of the gap.** The same scenario is run with the gap open and after the fix, on the same seed. The fix overrides TEF, vulnerability or individual loss forms. The output is the reduction in mean annual loss against the action's cost.
- **Data.** Scenarios are stored in `fair:scenarios` and consent in `fair:consent`. Other organisations (funders, portfolio reviewers) can read `fair:*` keys only when the organisation has consented, and only the organisation can write them. This is enforced in `/api/legacy-state`.

## Tasks
1. Engine `src/lib/fairRisk.ts` and its test:
   - seeded RNG, PERT, Poisson;
   - simulate, percentiles and exceedance;
   - cost of the gap and ranking;
   - range validation;
   - the `fairKeyReadable` access rule.
2. Server: `legacy-state.mts` applies `fairKeyReadable`.
3. Page `/risk`:
   - scenario list and editor, with links to Fiduciary Controls and Resilience indicators and to CIP actions;
   - results with the loss exceedance chart;
   - the cost-of-gap ranking;
   - the estimation guide;
   - the consent toggle;
   - a nav entry.
