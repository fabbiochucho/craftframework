# CRAFT validator training and accreditation — content

Seed content for PR 4 (training and accreditation). Exported from the "CRAFT Validator Accreditation
Programme" doc (Training modules and Assessment & recognition tabs) on 2026-10-16. Store it as data the CRAFT
programme team can edit without a code change; this file is the initial seed, not the runtime source.
Correct answers in the question bank are marked **bold**.

## Delivery

Eight modules plus a capstone, about 16 hours: 8 modules of about 1.5 hours and a 4-hour capstone.
Self-paced online inside CRAFT; up to 90 days to finish. English first (French and Portuguese later, using
CRAFT's translation support). Accessibility: captions, transcripts, keyboard navigation, no time limits
except the final exam. One optional 90-minute cohort call a month with a senior validator.

Every module follows the same five steps:
1. **Watch** a short video (5-8 minutes). Each module has a written script (below) and a slot for an
   unlisted YouTube video on youtube.com/@DiBadiliTV; until the video exists, show the script. Videos are
   captioned and have a transcript.
2. **Try** an interactive exercise in a sandbox copy of CRAFT.
3. **Decide** a branching scenario where each choice leads to a consequence and feedback.
4. **Check** a 5-question knowledge check; unlimited retries, every question explains its answer.
5. **Reflect** with one written prompt saved to the validator's learning log (used as evidence at renewal).

## Modules

### Module 1. What CRAFT is for, and the validator's role
*Outcome: explain why independent validation exists and who relies on it.*
- **Video script:** "Why trust needs a second pair of eyes": how funders decide, why self-assessments run
  optimistic, and where a validator fits between organisation and funder.
- **Try:** label the parties in three engagement diagrams (organisation, engaging party, validator,
  intended users).
- **Scenario:** a grantee asks you to "just confirm" their scores before a funding deadline. Choose how to
  respond.
- **Check:** the three labels (Independent validation, Funder review, Self-assessment) and when each applies.

### Module 2. The Capital Readiness Ladder and the scoring rubric
*Outcome: score any indicator consistently on the 0-5 scale and compute a rung.*
- **Video script:** the seven rungs, from Survival to Capital Market Readiness, and why the ladder is
  sequential.
- **Try — rung calculator:** change indicator scores and watch levels turn achieved or not at the 3.5 mean
  threshold, with every lower level required (use `currentRung()` in `src/lib/capitalReadiness.ts`).
- **Try — calibration drill:** score 10 indicator descriptions, then compare with the reference scores the
  CRAFT programme team set for the same ones. Aim to land within 1 point.
- **Check:** why a rung-5 claim fails if rung 3 is not fully answered.

### Module 3. Evidence: what counts and how much is enough
*Outcome: judge whether evidence supports a score.*
- **Video script:** the evidence hierarchy: a policy on paper versus proof it operates (minutes,
  reconciliations, sampled transactions).
- **Try — evidence sort:** drag 20 documents into "supports the score", "weak" or "irrelevant" for a given
  indicator.
- **Scenario:** an organisation's finance manual is excellent but the bank reconciliations stopped 7 months
  ago. Score it and justify.
- **Check:** sufficiency, relevance, reliability and timeliness.

### Module 4. Independence, conflicts and professional ethics
*Outcome: recognise a conflict and know when to decline.*
- **Video script:** independence in fact and in appearance; who can engage you and what must be disclosed;
  funder staff versus funder-engaged validators.
- **Try — conflict spotter:** 12 short profiles; flag the conflicts (prior consulting work, family ties, fee
  dependence, a board seat).
- **Scenario:** halfway through fieldwork you learn your firm is bidding for the same organisation's audit.
  Decide what to do.
- **Check:** the independence declaration line by line; gifts and hospitality; confidentiality.

### Module 5. Planning and fieldwork
*Outcome: plan a proportionate validation and choose the right method.*
- **Video script:** scoping (whole ladder or specific levels); choosing document review, sample testing,
  interviews or a site visit; planning around the organisation's risks.
- **Try — method picker:** for 6 organisation profiles, choose a method mix and defend it against a cost
  limit.
- **Scenario:** a remote validation where the organisation keeps "losing" the documents you request.
- **Check:** sampling basics and what to record as you go.

### Module 6. Reaching an outcome: validated, qualified or not validated
*Outcome: choose the right outcome and write clear qualifications.*
- **Video script:** how your scores become a rung; using the Trust Delta comparison; the debrief and
  negotiated scores; when disagreement means "qualified" and when it means "not validated".
- **Try — qualification writer:** rewrite five vague qualifications ("controls need improvement") into
  specific, testable ones tied to indicators.
- **Scenario:** the organisation's CEO disputes three of your scores in the debrief and threatens to
  complain to the funder.
- **Check:** validity periods (12 months, 6 if qualified, 24 with a surveillance check for rung 5+) and when
  you may set a shorter one.

### Module 7. The Capacity Improvement Plan and follow-up
*Outcome: agree a realistic follow-up schedule.*
- **Video script:** turning findings into improvement actions with owners, dates and evidence; choosing
  milestone, fixed-interval or end-of-plan follow-up; targeted follow-up validations.
- **Try — plan builder:** from a qualified result, build a CIP and a follow-up schedule; the sandbox flags
  anything that would extend validity beyond what you set.
- **Scenario:** a follow-up is due but only 2 of 5 actions are done. Decide between extending scope,
  re-validating, or letting it lapse.
- **Check:** material events, suspension, and what "follow-up overdue" means.

### Module 8. Reporting, the platform and the public record
*Outcome: finalise and publish a validation correctly.*
- **Video script:** a guided tour of the validator workspace: engagement, declaration, scoring, comparison,
  debrief, finalise.
- **Try:** finalise a sandbox validation and inspect its public verification page and PDF, including the
  fingerprint check. (If the public page from PR 6 does not exist yet, show a mock and mark it TODO.)
- **Scenario:** after finalising, the organisation asks you to "fix a typo" in the frozen scores.
- **Check:** what the public page shows and never shows; the standard "what this validation means" wording.

## Capstone simulation: "Riverbend Health Trust"

A 4-hour end-to-end validation of a fictional organisation in the sandbox, built so the obvious answer is
wrong in at least three places.

**The case:** Riverbend Health Trust, a mid-sized health NGO, self-assesses at **rung 4 (Sustainability)** and
wants a validation before a funder's grant decision. The funder engaged you.

**Planted in the evidence:**
- Rung 2 (Credibility): audited accounts are current, but the audit firm is owned by a board member's
  relative (tests the independence of *their* auditor, and evidence reliability).
- Rung 3 (Resilience): a strong reserves policy, but reserves were drawn down to 1 month in the latest
  management accounts (tests policy versus operation).
- Rung 4 (Sustainability): impact reporting is good, but one programme's data is copied from a prior year
  (tests timeliness).
- A late email reveals the finance director resigned last week (tests material events).

**The validator must produce:**
1. A signed independence declaration, noting the funder engagement.
2. Scores for every rung-1 to rung-4 indicator, each with an evidence note.
3. The Trust Delta comparison and a debrief note responding to the organisation's pushback (played by the
   sandbox).
4. An outcome, the validated rung, and specific qualifications.
5. A CIP follow-up schedule and validity period.

**Well-reasoned answer (for markers):** validated with qualifications at **rung 2**, because rung 3 fails on
operated reserves; the auditor relationship qualifies rung 2; validity 6 months with milestone follow-up on
reserves and impact data; the finance director's resignation recorded as a material event. Choosing rung 3
or 4 fails the outcome criterion even if scoring is otherwise good.

## How accreditation is assessed

All three parts must be passed; a high score in one cannot make up for a fail in another.

| Part | Format | Pass mark | Retakes |
|---|---|---|---|
| 1. Knowledge exam | 40 multiple-choice questions drawn at random from the bank, 60 minutes, online, open-book | 80% (32/40) | After 14 days; at most 3 attempts a year |
| 2. Scenario cases | 4 written cases, 300 words each, marked by two markers from the CRAFT programme team or Lead Validators against model answers | 70% on each case | One resubmission per case |
| 3. Capstone validation | The Riverbend simulation, marked with the rubric below | 70% overall and "Meets" on Outcome and Independence | One retake with a different sandbox case |

Prior credentials shorten the route but never skip the capstone: ICAN, ANAN, ACCA or CIA holders may skip the
Module 3 knowledge check.

Passing all three sets `accredited_until` one year ahead (see the spec). Marking parts 2 and 3 needs a human
marker role (CRAFT programme team or Lead Validator); build a marking queue for them.

## Question bank (starter, 20 questions; grow to at least 120 so each exam draws a different 40)

**Ladder and scoring**
1. A rung is achieved when its indicators are all answered and their mean score is at least: a) 3.0
   **b) 3.5** c) 4.0 d) 5.0. *The ladder's achievement threshold is a 3.5 mean.*
2. An organisation achieves levels 1, 2 and 4 but not 3. Its rung is: a) 4 b) 3 **c) 2** d) 1. *The ladder is
   sequential: the rung is the highest level with every level below it achieved.*
3. Which rung asks "Can external capital confidently and safely enter?" a) Resilience b) Sustainability
   **c) Investability** d) Scale.
4. A validator's scores and the organisation's self-scores imply different rungs. The validated rung is
   computed from: a) the average of both **b) the validator's final scores** c) the organisation's scores
   d) whichever is higher.
5. An indicator left unanswered at level 2 means level 2 is: a) achieved if the others average 3.5
   **b) not achieved** c) skipped d) scored 0 and averaged in. *Every indicator must be answered.*

**Evidence**
6. Which best shows a control *operates*? a) A board-approved policy **b) Signed monthly bank
   reconciliations for the last 6 months** c) A job description d) A consultant's report recommending the
   control.
7. Evidence dated 18 months ago for a control that should run monthly is: a) sufficient b) irrelevant
   **c) not timely** d) unreliable.
8. The organisation emails a spreadsheet it made the night before your visit. Before relying on it you
   should: a) accept it **b) trace a sample back to source records** c) reject it outright d) ask the funder.
9. Evidence that is relevant but comes from a party with an interest in the outcome is weak on:
   a) timeliness b) sufficiency **c) reliability** d) scope.
10. When evidence is insufficient for an indicator, you should: a) score it 0 b) leave it blank **c) score
    what the evidence supports and note the gap** d) use the self-score.

**Independence and ethics**
11. Which is NOT a conflict? a) You advised the organisation on its finance manual last year b) Your sister
    sits on its board c) The organisation is 40% of your firm's fees **d) The funder that engaged you pays
    your fee and the relationship is disclosed**.
12. A funder's own employee completes a review. It must be labelled: a) Independent validation **b) Funder
    review** c) Self-assessment d) Qualified validation.
13. You discover a conflict mid-engagement. You must: a) finish and disclose in the report **b) stop,
    disclose to the organisation, engaging party and CRAFT, and withdraw if it cannot be resolved** c) ask
    the organisation to waive it d) continue if the fee is small.
14. A gift worth more than a token amount from the organisation during fieldwork should be: a) accepted and
    declared **b) declined** c) shared with the team d) accepted after finalising.
15. Who must consent before you see an organisation's evidence? **a) The organisation** b) Only the funder
    c) Only CRAFT d) No one, if the funder engaged you.

**Outcomes, validity and follow-up**
16. A validation "with qualifications" is valid for: a) 3 months **b) 6 months** c) 12 months d) 24 months.
17. A rung-5 organisation, validated without qualifications, can be given 24 months only if: a) the funder
    pays more **b) a surveillance check is completed at 12 months** c) it has no CIP d) a second validator
    re-reviews it.
18. The Capacity Improvement Plan can: **a) bring a follow-up forward** b) extend validity beyond what the
    validator set c) change the frozen scores d) remove qualifications.
19. The organisation reports its CEO has resigned. The validation becomes: a) withdrawn b) expired
    **c) suspended pending review** d) unchanged.
20. After finalising, the organisation asks you to correct a score. You should: a) edit it b) ask CRAFT to
    edit it **c) explain the scores are frozen; any change needs a new or follow-up validation** d) delete
    and redo the validation.

## Scenario cases (marked against model answers; markers look for judgement, not one right sentence)

**Case A. The friendly deadline (independence).** A grantee you once ran a 2-day workshop for, 3 years ago,
asks you to validate them. Their funder needs the result in 10 days and suggests you "rely mostly on last
year's audit". *Model answer:* the old workshop is likely not a conflict but must be disclosed in the
declaration; a 10-day deadline cannot cut the method: explain what can be done in the time, propose a
narrower scope (named levels) or a later date, and record the funder's suggestion. An audit is evidence for
some indicators, not a substitute for the validation.

**Case B. Paper versus practice (evidence).** Procurement policy is excellent, but in a sample of 15
purchases, 6 lack the required three quotes. *Model answer:* score on operation, not policy (likely 2 rather
than 4); state the sample and failure rate; if it blocks the rung, make it a specific qualification
("three-quote rule followed in 9 of 15 sampled purchases; retest 15 purchases at follow-up").

**Case C. The pushback (outcome).** In the debrief, the CEO disputes three scores and says the funder
"expects rung 4". Your scores give rung 3. *Model answer:* consider new evidence on its merits and record any
change; do not move a score for pressure; the funder's expectation is irrelevant; the outcome follows the
scores; record the dispute and the organisation's response.

**Case D. The surprise (material events).** Two weeks after you validated an organisation at rung 4, a
newspaper reports its finance director is under police investigation. *Model answer:* the organisation must
report it within 5 working days; if it doesn't, report it to CRAFT yourself; the validation should be
suspended pending review; assess whether the controls you relied on depended on that person.

## Capstone marking rubric

Six criteria, each Exceeds (3), Meets (2), Partial (1) or Missing (0). Pass: 70% overall (13 of 18) **and** at
least Meets on Outcome and Independence.

| Criterion | Weight | Meets looks like |
|---|---|---|
| Independence | Must meet | Declaration complete; funder engagement disclosed; the organisation's auditor relationship noticed |
| Scoring accuracy | High | Within 1 point of the reference score on at least 80% of indicators |
| Evidence judgement | High | Each score has an evidence note; policy-versus-operation and stale data caught |
| Outcome and rung | Must meet | Correct sequential rung; outcome type justified; qualifications specific and testable |
| Follow-up and validity | Medium | Validity period follows the rules; a realistic milestone follow-up tied to the qualifications |
| Material events and communication | Medium | Resignation treated as a material event; debrief note firm, factual and courteous |

## Gamification and recognition

Reward **learning and accuracy**, never the number of validations, the rungs awarded, speed or fees (volume
rewards rushing; outcome rewards generosity).

During training:
- **Progress points (XP)** for each completed video, exercise, scenario and check; a progress bar and module
  map show what is left.
- **Streaks** for learning on consecutive days (a nudge, never a requirement).
- **Branching scenarios with consequences:** a poor choice is shown playing out (a funder loses money, a
  validation is withdrawn) before the explanation.
- **Calibration score:** share of drill indicators scored within 1 point of the reference scores, shown as a
  dial.
- **Cohort board:** opt-in board of calibration scores within the monthly cohort only; names can be hidden.

Badges (shown on the validator's directory profile):

| Badge | Earned by |
|---|---|
| Ladder Climber | Completing Modules 1-2 and the rung-calculator challenge |
| Evidence Hawk | Catching every planted evidence problem in the Module 3 sort and the capstone |
| Clear Conscience | A perfect score on the Module 4 conflict spotter |
| Calibrated | A calibration score of 90% or more |
| Riverbend Solved | Passing the capstone with Exceeds on Outcome |
| Mentor | Mentoring 3 new validators through their first validations |

A withdrawal for error removes the Calibrated badge until a recalibration drill is passed.

Levels: Associate (registered, not accredited — reviews labelled "Review by [name]") · Validator (passed the
programme — signs Independent validations) · Senior Validator (10+ validations, none withdrawn for error,
calibration 85%+, 2 years — re-reviewer, mentor, Review Panel) · Lead Validator (Senior for 2 years, no upheld
complaints — marks scenario cases, writes new cases). Senior and Lead need validation history from later PRs.

## Staying accredited (annual)

Accreditation lasts **1 year**. It renews when the validator, and every member of their firm's team,
completes these each year; missing them shows "accreditation lapsed" (no badge) until done:
- Re-watch the current training videos (completion tracked per video).
- 8 hours of continuing development a year: new CRAFT modules, monthly cohort calls, or recognised
  professional CPD (ICAN, ACCA, IIA hours count).
- An annual calibration drill: score 10 fresh indicators; 80% within 1 point of the reference scores.
- An updated independence declaration each year, plus a list of current client relationships.
- No unresolved quality issues: open complaints or re-review findings settled, including any Review Panel
  decision.
- A refresher module whenever CRAFT changes the ladder, the rules or the standard wording; validators cannot
  sign new validations until it is done.
