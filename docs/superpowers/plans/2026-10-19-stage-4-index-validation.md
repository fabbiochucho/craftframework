# Stage 4: validating the CRAFT indices, specialist accreditation and training

**Goal:** Validators can validate the four v1 (102026) indices alongside the ladder; specialist indices need an accredited specialist; training adds module 9 and specialist modules S1 and S2 with their assessments.

**Spec:** `docs/superpowers/specs/2026-10-18-craft-indices-v1-102026-design.md` §7 and §7.1 (option B).

## Global constraints
- The ladder stays the engagement's framework (`result: 'rung'`). Indices are added to the engagement scope (`scope.indices`), each a `band` framework.
- Index self-scores come from `/api/responses` (the `responses` table), not legacy state.
- Every in-scope index indicator must be scored before finalising. The paper-compliance cap applies to every indicator.
- Snapshot schema 2 adds `indices: [{ key, name, version, band, qualifications }]` and `framework` on each indicator. Schema 1 snapshots still render.
- Public page and statement PDF add "CRAFT index results (v1 (102026))" with one band per index. They never show scores or evidence.
- `validator_specialisms (validator_email, specialism fiduciary|safeguards, granted_at, granted_by)`. A specialism counts only while the main accreditation is current, so it renews with it.
- Fiduciary Controls needs `fiduciary`; Safeguards needs `safeguards`. Every named validator must hold the specialism when they join, accept or create, and again when they review.
- Training: module `m9` is required for everyone. Modules whose id starts with `s` are specialist: they are excluded from core completion, the exam gate and renewal videos.
- A specialist assessment is a timed 15-question test (30 minutes, pass 80%). Before taking it, the validator must be accredited and have completed the module. Passing grants the specialism.
- New content reaches existing databases through an idempotent `seeded-indices` step. It never overwrites edits.

## Tasks
1. **Pure rules** in `validationReview.ts`, `engagements.ts` and new `specialisms.ts`, test first:
   - band frameworks;
   - `parseScope` with indices;
   - combined in-scope indicators;
   - finalisation problems for unscored index indicators;
   - `indexResults`;
   - `missingSpecialisms`;
   - specialist assessment scoring.
2. **Database:** migration `validator_specialisms` plus a `training_exam_attempts.assessment` column (default `'knowledge'`); schema.ts.
3. **Reviews server:**
   - in-scope ids across frameworks;
   - self-scores from responses;
   - trust-delta rows tagged with their framework;
   - finalisation;
   - snapshot 2;
   - the reviewer gate checks specialisms.
4. **Engagements server:** scope indices on create; the specialism check where a validator joins, accepts or creates.
5. **Public view and statement PDF:** index results.
6. **Training:**
   - seed m9, s1 and s2 with 20, 15 and 15 questions;
   - specialist filtering;
   - a specialist assessment endpoint that grants the specialism;
   - training UI;
   - video scripts in the training content spec.
7. **UI:**
   - choose indices when creating an engagement;
   - the review page groups rows by framework and shows the band for each index;
   - the directory shows specialisms.
8. **Statistics:** index validations are counted separately.
