# Stage 3: suggested Capacity Improvement Plan timeline

**Goal:** Replace the fixed plan-length spread with a suggested timeline set by gap severity, action type and minimum weeks, with pace options, owner capacity, fixed dates and per-action overrides.

**Spec:** `docs/superpowers/specs/2026-10-18-craft-indices-v1-102026-design.md` §6.

## Global constraints
- No default plan length; plan length = when the last action is due.
- Standard windows (weeks from plan start): Critical 0→13, High 4→26, Moderate 13→52, Low 26→78.
- `minWeeks` is never compressed; an action that cannot fit its window keeps `minWeeks` and is flagged with the reason.
- Pace: Standard (×1), Accelerated (windows ×0.6), Extended (×1.5), Target date (windows scaled to fit a chosen number of months; actions that still don't fit are listed). Per-action overrides need a reason and are recorded.
- Owner capacity: at most 2/3/5 concurrent actions per owner for small/medium/large organisations (default medium).
- Dependencies: within a domain, `people` after `policy`, `practice` after `system`.
- Change Readiness composite below 2.5 adds 25% embedding time to `people` and `practice` actions.
- Phases from actual dates: 1 quick wins and critical gaps (Critical, or due within 13 weeks); 2 core systems (policy, system, process); 3 embedding and practice evidence (people, practice, assurance).

## Tasks
1. **Engine** `src/lib/cipTimeline.ts` + `cipTimeline.test.ts`: `suggestTimeline(inputs, settings)` → scheduled actions (startWeek, dueWeek, durationWeeks, phase, flags), `planWeeks`, `planMonths`, `cannotFit`. Tests for windows, ordering, duration and minWeeks, dependencies, capacity, fixed dates, each pace, overrides, phases, change-readiness embedding.
2. **Plan integration** `derivePlan(scores, p, settings, threshold, esg)`: findings carry actionType and minWeeks; all due dates come from the engine; `dueMonth`/`dueDate` derived from `dueWeek`. A number passed as `settings` means the Target date pace (back-compatible). Ruling: the old test that two Critical actions must have different due months is replaced by engine rules.
3. **Settings and UI**: `useCipTimeline()` stores `cip:timeline` per organisation (pace, target months, start date, organisation size, overrides with reasons, fixed dates). CIP page: pace selector, target months (Target date pace only), start date, organisation size, per-action start/due dates with phase and flags, override and fixed-date editing, plan length heading. Other pages (Reports, Narrative, Dashboard, Findings, index report) use the saved settings.
4. **Reports**: the CIP CSV and Narrative state pace, plan length and overrides.
