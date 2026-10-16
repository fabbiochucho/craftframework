// ============================================================================
// Initial content for the validator training programme (PR 4)
// ----------------------------------------------------------------------------
// Seeded into the training_* tables ONCE by /api/training (flag `seeded` in
// training_settings). After that the database is the source of truth: the CRAFT
// programme team edits it from /training/manage. Source: the 2026-10-16
// training-content spec. Video scripts below are short drafts written from that
// spec's one-line briefs; the programme team is expected to expand them.
// Questions 1-20 are the spec's starter bank (exam + check); q21+ are check-only
// additions so every module has five knowledge-check questions.
// ============================================================================

import type { RubricCriterion } from './validatorTraining'

export type SeedExercise =
  | { type: 'classify'; key?: string; title: string; instructions: string; items: Array<{ prompt: string; options: string[]; correct: number; explain: string }> }
  | { type: 'rung-calculator'; title: string; instructions: string; target: number; start: Record<string, number> }
  | { type: 'calibration-drill'; title: string; instructions: string }
  | { type: 'write'; title: string; instructions: string; items: Array<{ prompt: string; model: string }> }

export type SeedModule = {
  id: string; position: number; title: string; outcome: string; script: string; reflectionPrompt: string
  exercises: SeedExercise[]
  scenario: { prompt: string; choices: Array<{ text: string; consequence: string; feedback: string; best: boolean }> }
}

export const SEED_MODULES: SeedModule[] = [
  {
    id: 'm1', position: 1, title: 'What CRAFT is for, and the validator’s role',
    outcome: 'Explain why independent validation exists and who relies on it.',
    script: `Why trust needs a second pair of eyes.\n\nA funder deciding whether to back an organisation has a problem: the organisation's own account of itself is the only story in the room, and self-assessments run optimistic. Not because people lie, but because everyone is closest to their own work and wants it to look good.\n\nCRAFT gives organisations a shared yardstick, the Capital Readiness Ladder. A validator is the independent person who checks the organisation's self-assessment against evidence. You sit between the organisation and the people who will rely on the result: funders, lenders and partners.\n\nThree labels are never mixed. An Independent validation is done by an accredited external validator, whoever engaged them. A Funder review is done by a funder's own staff and is never called validation. A Self-assessment is the organisation's own scores.\n\nYour value is that people can rely on your conclusion without having to repeat your work. That only holds if you are independent, evidence-based and willing to say no. In this module you will label the parties in three engagements and decide what to do when a grantee asks you to "just confirm" their scores.`,
    reflectionPrompt: 'Who would be harmed if a validator simply confirmed an organisation’s scores? Describe one real situation from your own work where an independent check would have changed a decision.',
    exercises: [{
      type: 'classify', title: 'Label the engagement', instructions: 'For each engagement, choose the label that applies.',
      items: [
        { prompt: 'An accredited consultant from outside the organisation, engaged by the organisation itself, reviews its scores against evidence.', options: ['Independent validation', 'Funder review', 'Self-assessment'], correct: 0, explain: 'Independent validation: an accredited external validator, whoever engaged them.' },
        { prompt: 'A development finance institution’s own portfolio officers review a grantee’s scores before a committee.', options: ['Independent validation', 'Funder review', 'Self-assessment'], correct: 1, explain: 'Funder review: staff employed by the funder are not independent of it, so it is never called validation.' },
        { prompt: 'The finance manager and the director score the organisation together in a workshop.', options: ['Independent validation', 'Funder review', 'Self-assessment'], correct: 2, explain: 'Self-assessment: the organisation’s own scores.' },
      ],
    }],
    scenario: {
      prompt: 'A grantee you do not know well asks you to "just confirm" their scores before a funding deadline next week. They say everything is in order and the funder is waiting.',
      choices: [
        { text: 'Confirm the scores as submitted; they know their organisation best.', consequence: 'The funder commits money on the strength of an unchecked result. Six months later a missing control surfaces and the funder loses faith in every CRAFT result.', feedback: 'A validator’s conclusion must rest on evidence you examined. Confirming without checking is not validation.', best: false },
        { text: 'Explain that you can only validate after reviewing evidence, agree a scope and timetable, and tell the engaging party what is realistic before the deadline.', consequence: 'The organisation is briefly disappointed, but the funder gets a result it can rely on, or an honest account of what could be done in the time.', feedback: 'Correct. A deadline never shortens the method; a narrower scope or a later date does.', best: true },
        { text: 'Review only the three indicators you think are weakest and issue a full result.', consequence: 'The result looks complete but covers a fraction of the ladder. A reader relying on it is misled about the scope.', feedback: 'Scope must be stated honestly. Partial work can be reported as a named narrower scope, not as the whole ladder.', best: false },
      ],
    },
  },
  {
    id: 'm2', position: 2, title: 'The Capital Readiness Ladder and the scoring rubric',
    outcome: 'Score any indicator consistently on the 0-5 scale and compute a rung.',
    script: `The seven rungs, from Survival to Capital Market Readiness.\n\nThe ladder is sequential on purpose. An organisation cannot meaningfully claim Investability if it has not first cleared Credibility and Resilience. So the headline result is not an average: it is the highest rung where that level and every level below it are achieved.\n\nEach rung has indicators scored from 0 to 5. A rung counts as achieved when every indicator is answered and their mean is at least 3.5. One unanswered indicator means the rung is not achieved.\n\nThe seven rungs: Survival, Credibility, Resilience, Sustainability, Investability, Scale and Institutionalisation, and Capital Market Readiness.\n\nScoring consistently means reading the descriptor for each score and choosing the one the evidence supports, not the one that feels fair. You will practise with the rung calculator, then take the calibration drill: ten indicator descriptions, compared with reference scores set by the programme team. Aim to land within one point.`,
    reflectionPrompt: 'Think of an organisation you know. Which rung would it honestly reach today, and which single indicator would block the next one?',
    exercises: [
      { type: 'rung-calculator', title: 'Rung calculator challenge', instructions: 'Change the indicator scores and watch each level turn achieved or not (3.5 mean, every lower level required). Challenge: set the scores so that the organisation’s rung is exactly 3.', target: 3, start: { 'CRL-1A': 4, 'CRL-1B': 4, 'CRL-1C': 4, 'CRL-2A': 4, 'CRL-2B': 4, 'CRL-2C': 4, 'CRL-3A': 2, 'CRL-3B': 2, 'CRL-3C': 2, 'CRL-4A': 4, 'CRL-4B': 4, 'CRL-4C': 4 } },
      { type: 'calibration-drill', title: 'Calibration drill', instructions: 'Score ten indicator descriptions from 0 to 5. You are compared with the reference scores the programme team set; aim to land within 1 point.' },
    ],
    scenario: {
      prompt: 'An organisation’s Level 1, 2 and 4 means are all 4.0, but Level 3 averages 3.2. It claims "rung 4 — we are stronger than the rubric shows".',
      choices: [
        { text: 'Record rung 4 because Levels 1, 2 and 4 are strong.', consequence: 'A funder relies on rung 4 resilience. The organisation’s reserves run out in a shock it was never ready for.', feedback: 'The ladder is sequential: Level 3 not achieved means the rung is 2, whatever happens above it.', best: false },
        { text: 'Record rung 2 and show which Level 3 indicators block the next rung.', consequence: 'The organisation sees exactly what to fix and the result is defensible to any reader.', feedback: 'Correct: the rung is the highest level with every level below it achieved.', best: true },
        { text: 'Round the Level 3 mean up to 3.5 since it is close.', consequence: 'A rounding favour sets a precedent; the next validator is asked for the same.', feedback: 'The threshold is a 3.5 mean. Nearly is not achieved.', best: false },
      ],
    },
  },
  {
    id: 'm3', position: 3, title: 'Evidence: what counts and how much is enough',
    outcome: 'Judge whether evidence supports a score.',
    script: `The evidence hierarchy: a policy on paper versus proof it operates.\n\nA policy shows intent. Minutes, reconciliations and sampled transactions show that something actually happens. When a score claims a control operates, look for operating evidence: signed monthly bank reconciliations for the last six months beat a well-written finance manual.\n\nFour tests for any piece of evidence. Sufficiency: is there enough of it? Relevance: does it bear on this indicator? Reliability: does it come from a source with no interest in the outcome, and can you trace it to source records? Timeliness: is it recent enough for a control that should run monthly?\n\nWhen evidence is insufficient, score what the evidence supports and note the gap. Never leave an indicator blank, score it zero by default, or fall back on the self-score.\n\nIn this module you will sort documents for one indicator into supports, weak or irrelevant, and then score a case where the finance manual is excellent but the reconciliations stopped seven months ago.`,
    reflectionPrompt: 'Which kind of evidence are you most tempted to accept too easily, and what will you do differently?',
    exercises: [{
      type: 'classify', key: 'evidence-sort', title: 'Evidence sort', instructions: 'The indicator is CRL-1B, Basic Financial Controls: "bank reconciliation is performed monthly". Sort each document.',
      items: [
        { prompt: 'Board-approved finance manual describing monthly bank reconciliation.', options: ['Supports the score', 'Weak', 'Irrelevant'], correct: 1, explain: 'A policy shows intent, not that the control operates.' },
        { prompt: 'Signed bank reconciliations for each of the last six months, with a reviewer’s initials.', options: ['Supports the score', 'Weak', 'Irrelevant'], correct: 0, explain: 'Operating evidence that is recent, specific and reviewed.' },
        { prompt: 'A bank reconciliation prepared and emailed the night before your visit for all of last year.', options: ['Supports the score', 'Weak', 'Irrelevant'], correct: 1, explain: 'Prepared for the visit: trace a sample back to source records before relying on it.' },
        { prompt: 'The organisation’s annual report cover and mission statement.', options: ['Supports the score', 'Weak', 'Irrelevant'], correct: 2, explain: 'It does not bear on whether reconciliations are performed.' },
        { prompt: 'Bank reconciliations dated up to 18 months ago, none since.', options: ['Supports the score', 'Weak', 'Irrelevant'], correct: 1, explain: 'Not timely for a monthly control.' },
        { prompt: 'A consultant’s report recommending that the organisation start reconciling monthly.', options: ['Supports the score', 'Weak', 'Irrelevant'], correct: 1, explain: 'A recommendation shows the control was missing, not that it operates.' },
        { prompt: 'Staff list with job titles and start dates.', options: ['Supports the score', 'Weak', 'Irrelevant'], correct: 2, explain: 'Not relevant to this indicator.' },
        { prompt: 'Bank statements for six months matched by you to the organisation’s ledger on a sample of 10 transactions with no differences.', options: ['Supports the score', 'Weak', 'Irrelevant'], correct: 0, explain: 'Your own sample testing against source records is strong evidence.' },
      ],
    }],
    scenario: {
      prompt: 'An organisation’s finance manual is excellent, but the bank reconciliations stopped seven months ago. The self-score for CRL-1B is 4. How do you score it and justify it?',
      choices: [
        { text: 'Keep 4: the manual is excellent and the lapse is probably temporary.', consequence: 'The frozen result says controls operate. A fraud goes undetected for another year.', feedback: 'Score what operates today. A policy cannot make up for a control that stopped.', best: false },
        { text: 'Score about 2, citing the missing reconciliations since seven months ago, and note the policy in the evidence note.', consequence: 'The organisation disputes the score, then restarts reconciling and uses it as a CIP item.', feedback: 'Correct: record the gap and the evidence, and let the score follow operation, not intent.', best: true },
        { text: 'Score 0 because the control has failed.', consequence: 'The result is harsher than the evidence supports, and is easily challenged.', feedback: 'Score what the evidence supports: a documented policy and six months of operation earlier count for something.', best: false },
      ],
    },
  },
  {
    id: 'm4', position: 4, title: 'Independence, conflicts and professional ethics',
    outcome: 'Recognise a conflict and know when to decline.',
    script: `Independence in fact and in appearance.\n\nYou must be independent in fact, meaning you can reach a conclusion unaffected by outside influence, and in appearance, meaning a reasonable observer would not doubt it.\n\nTies that matter: you or your firm advised the organisation on the thing being validated, you are related to or employed by someone in it, it is a large share of your fees, or you hold a seat on its board. Any of these can mean you must decline.\n\nWho can engage you matters less than what you disclose. An organisation, a funder or your firm may engage you. Fee-paying funders must be disclosed. Funder staff doing their own review produce a Funder review, never a validation.\n\nIf you discover a conflict mid-engagement, stop, disclose to the organisation, the engaging party and CRAFT, and withdraw if it cannot be resolved. Do not ask the organisation to waive it. Decline gifts beyond a token amount. Keep the organisation's information confidential.`,
    reflectionPrompt: 'Describe a relationship in your own work that could look like a conflict to an outsider, and how you would disclose it.',
    exercises: [{
      type: 'classify', key: 'conflict-spotter', title: 'Conflict spotter', instructions: 'For each short profile, say whether it is a conflict you must act on.',
      items: [
        { prompt: 'You advised the organisation on writing its finance manual last year.', options: ['Conflict', 'Not a conflict'], correct: 0, explain: 'Self-review: you would be validating your own advice.' },
        { prompt: 'Your sister sits on the organisation’s board.', options: ['Conflict', 'Not a conflict'], correct: 0, explain: 'A family tie to governance threatens independence.' },
        { prompt: 'The organisation would be 40% of your firm’s fees this year.', options: ['Conflict', 'Not a conflict'], correct: 0, explain: 'Fee dependence.' },
        { prompt: 'The funder that engaged you pays your fee, and this is disclosed in your declaration.', options: ['Conflict', 'Not a conflict'], correct: 1, explain: 'Funder engagement is allowed when disclosed.' },
        { prompt: 'You hold a seat on the organisation’s advisory board.', options: ['Conflict', 'Not a conflict'], correct: 0, explain: 'A board seat is a conflict.' },
        { prompt: 'You once attended a public conference session the organisation spoke at.', options: ['Conflict', 'Not a conflict'], correct: 1, explain: 'No relationship or interest.' },
      ],
    }],
    scenario: {
      prompt: 'Halfway through fieldwork you learn your firm is bidding for the same organisation’s statutory audit.',
      choices: [
        { text: 'Carry on and mention it in the final report.', consequence: 'The organisation learns of the bid from someone else. The funder questions the whole result.', feedback: 'Disclose immediately; a late disclosure damages trust.', best: false },
        { text: 'Stop, disclose to the organisation, the engaging party and CRAFT, and withdraw unless it can be resolved (for example by withdrawing the bid).', consequence: 'There is a short delay, but the validation stays credible.', feedback: 'Correct: stop, disclose and withdraw if it cannot be resolved.', best: true },
        { text: 'Ask the organisation to sign a waiver and continue.', consequence: 'The waiver does not remove the threat; a reviewer later finds the bid.', feedback: 'The organisation cannot waive a threat to independence.', best: false },
      ],
    },
  },
  {
    id: 'm5', position: 5, title: 'Planning and fieldwork',
    outcome: 'Plan a proportionate validation and choose the right method.',
    script: `Scoping, methods and planning around risk.\n\nStart with the scope: the whole ladder, or named levels. A narrower scope is honest; a vague one is not. Say it in the engagement.\n\nChoose methods to fit the indicator. Document review shows what exists. Sample testing shows whether a control operates, so choose a sample and a rule for what counts as a failure. Interviews explain how things work and who decides. A site visit confirms what you cannot see on paper. Most validations combine methods.\n\nPlan around the organisation's risks: a cash-heavy field operation needs more testing than a desk-based consultancy.\n\nRecord as you go: what you asked for, what you received, when, from whom, and what you tested. If the organisation keeps failing to provide documents, record it; missing evidence is itself evidence about the indicator.`,
    reflectionPrompt: 'Pick one indicator. Which method mix would you use and what would be your sampling rule?',
    exercises: [{
      type: 'classify', title: 'Method picker', instructions: 'Choose the method that matters most for each situation.',
      items: [
        { prompt: 'You need to know whether payment approvals are really followed. The organisation made 400 payments last year.', options: ['Document review', 'Sample testing', 'Interviews', 'Site visit'], correct: 1, explain: 'Sample testing shows whether a control operates.' },
        { prompt: 'You want to understand who really makes decisions and how conflicts between the director and board are handled.', options: ['Document review', 'Sample testing', 'Interviews', 'Site visit'], correct: 2, explain: 'Interviews reveal how decisions are actually made.' },
        { prompt: 'The organisation claims to run a community clinic with 40 beds and a working cold chain.', options: ['Document review', 'Sample testing', 'Interviews', 'Site visit'], correct: 3, explain: 'A site visit confirms what you cannot see on paper.' },
        { prompt: 'You need to confirm the organisation is registered and see its constitution and board resolutions.', options: ['Document review', 'Sample testing', 'Interviews', 'Site visit'], correct: 0, explain: 'Document review for what exists on paper.' },
      ],
    }],
    scenario: {
      prompt: 'You are validating remotely and the organisation keeps "losing" the documents you request.',
      choices: [
        { text: 'Score from the self-assessment to keep the timetable.', consequence: 'The result is built on the claims you were asked to check.', feedback: 'Do not fall back on the self-score.', best: false },
        { text: 'Record each request and the response, set a deadline in writing, escalate to the engaging party and score what the evidence supports, noting the gap.', consequence: 'Documents arrive, or the result honestly reflects missing evidence.', feedback: 'Correct: the failure to provide evidence is itself evidence.', best: true },
        { text: 'Drop the indicator from scope without telling anyone.', consequence: 'Readers think the whole ladder was reviewed.', feedback: 'Scope changes must be stated openly.', best: false },
      ],
    },
  },
  {
    id: 'm6', position: 6, title: 'Reaching an outcome: validated, qualified or not validated',
    outcome: 'Choose the right outcome and write clear qualifications.',
    script: `From scores to a rung, and from a rung to an outcome.\n\nYour final scores give the validated rung automatically. The Trust Delta shows where you and the organisation differ and what rung each set of scores implies.\n\nIn the debrief, the organisation can respond. Consider new evidence on its merits and record any change. Do not move a score for pressure, for a deadline, or because a funder expects a particular rung.\n\nThree outcomes. Validated: the rung is supported. Validated with qualifications: the rung is supported, but specific matters are listed and tied to indicators. Not validated: the evidence does not support a result.\n\nA good qualification is specific and testable: "Three-quote rule followed in 9 of 15 sampled purchases; retest 15 purchases at follow-up." A bad one is "controls need improvement".\n\nValidity: 12 months; 6 months if qualified; 24 months for rung 5 and above without qualifications if there is a surveillance check at 12 months. You may always set a shorter period for a named risk.`,
    reflectionPrompt: 'Describe a time someone pressed you to change a judgement. What would you say now?',
    exercises: [{
      type: 'write', title: 'Qualification writer', instructions: 'Rewrite each vague qualification as a specific, testable one tied to an indicator.',
      items: [
        { prompt: 'Controls need improvement.', model: 'CRL-1B: bank reconciliations were not performed for the last 7 months (latest dated March); reconcile monthly and retest the last 3 months at follow-up.' },
        { prompt: 'Governance is weak.', model: 'CRL-1C: no board minutes were provided for the last two quarters; provide signed minutes for both and show the board met quorum.' },
        { prompt: 'Procurement is not always followed.', model: 'CRL-2A: three quotes were obtained in 9 of 15 sampled purchases; retest 15 purchases at follow-up with a failure rate under 10%.' },
      ],
    }],
    scenario: {
      prompt: 'In the debrief the CEO disputes three of your scores and threatens to complain to the funder.',
      choices: [
        { text: 'Raise the three scores to keep the peace.', consequence: 'The result no longer follows the evidence. A re-review later finds the gap and the validation is withdrawn.', feedback: 'Never change a score for pressure.', best: false },
        { text: 'Invite new evidence, consider it on its merits, change a score only if the evidence supports it, and record the dispute and the organisation’s response.', consequence: 'The CEO is unhappy but the file shows a fair process; the funder sees the same result.', feedback: 'Correct. The outcome follows the scores, not the expectation.', best: true },
        { text: 'Refuse to discuss the scores.', consequence: 'The organisation feels unheard and escalates, and you lose the chance to see new evidence.', feedback: 'Be firm but open: consider new evidence on its merits.', best: false },
      ],
    },
  },
  {
    id: 'm7', position: 7, title: 'The Capacity Improvement Plan and follow-up',
    outcome: 'Agree a realistic follow-up schedule.',
    script: `Turning findings into action.\n\nEvery CIP action has an owner, a due date and proof of completion. Marking an action done with evidence updates the self-assessment.\n\nOn finalising, you and the organisation pick the follow-up: milestone-based (the default, for example once all blocking or qualified items are done), a fixed interval of 3 or 6 months, or end of plan.\n\nFollow-ups re-check only the qualified or blocking indicators. A full re-validation happens on the normal cycle.\n\nTwo rules matter. The CIP can bring a check forward but never extend validity. A missed follow-up shows as "follow-up overdue"; at expiry the validation shows as "expired", not "not validated".\n\nMaterial events such as fraud, a regulator's sanction or a change of finance director put the validation on hold: it is suspended pending review until you decide to reinstate, re-scope or withdraw.`,
    reflectionPrompt: 'What would make a follow-up date realistic for a small organisation, and how would you stop it becoming a way to extend a result?',
    exercises: [{
      type: 'write', title: 'Plan builder', instructions: 'From a qualified result (reserves below 3 months; impact data copied from last year), write two CIP actions each with an owner, a due date and the proof of done, then choose a follow-up schedule.',
      items: [{ prompt: 'Write two actions and the follow-up schedule you would agree.', model: 'Action 1: raise reserves to 3 months of costs (owner: Finance Director; due: in 4 months; proof: bank balance and board-approved reserves report). Action 2: refresh impact data from the current year (owner: M&E lead; due: in 3 months; proof: dated data set). Follow-up: milestone-based, re-checking CRL-3A and the impact indicator once both actions are done, with the 6-month validity unchanged.' }],
    }],
    scenario: {
      prompt: 'A follow-up is due but only 2 of 5 actions are done.',
      choices: [
        { text: 'Extend validity until the rest are done.', consequence: 'A result stays "current" with unresolved qualifications. Readers are misled.', feedback: 'The CIP can never extend validity.', best: false },
        { text: 'Re-check only the qualified or blocking indicators, report progress as it stands, and let validity run its course.', consequence: 'The result stays honest; the organisation knows what is left.', feedback: 'Correct: follow-ups are targeted and do not extend validity.', best: true },
        { text: 'Quietly pass the follow-up as complete.', consequence: 'The record says the actions are done; a funder checks and finds otherwise.', feedback: 'Never record what was not evidenced.', best: false },
      ],
    },
  },
  {
    id: 'm8', position: 8, title: 'Reporting, the platform and the public record',
    outcome: 'Finalise and publish a validation correctly.',
    script: `A guided tour of the validator workspace.\n\nThe path is: engagement accepted, independence declaration signed, scoring, the Trust Delta comparison, the debrief, then finalise.\n\nFinalising freezes the scores, rung, evidence references, validator, team, declarations, method, dates, outcome and qualifications. Later changes to the organisation's self-scores never alter it.\n\nThe public verification page shows the verification ID, status, organisation, framework and scope, the label and validated rung, the validator, firm and credential, the independence statement, the method, dates, expiry and the standard wording. It never shows indicator scores, evidence, your comments or contact details.\n\nThe standard wording says what the validation means, what it does not mean, and that its status can change. Read it once with care: it is not an audit and not a guarantee.\n\nIf an organisation asks you to "fix a typo" in frozen scores, explain that the result is frozen. Any change needs a new or follow-up validation.`,
    reflectionPrompt: 'Which sentence of the standard wording will organisations misread most, and how would you explain it?',
    exercises: [{
      type: 'classify', title: 'The public page', instructions: 'Public verification page: which of these does it show? (The page itself arrives in a later release; this exercise uses the agreed rules.)',
      items: [
        { prompt: 'The validated rung and outcome type.', options: ['Shown', 'Never shown'], correct: 0, explain: 'Shown on the public page.' },
        { prompt: 'Indicator-by-indicator scores.', options: ['Shown', 'Never shown'], correct: 1, explain: 'Never shown.' },
        { prompt: 'The validator’s comments on evidence.', options: ['Shown', 'Never shown'], correct: 1, explain: 'Never shown.' },
        { prompt: 'The method used and the fieldwork dates.', options: ['Shown', 'Never shown'], correct: 0, explain: 'Shown.' },
        { prompt: 'The validator’s phone number or email.', options: ['Shown', 'Never shown'], correct: 1, explain: 'Contact details are never shown.' },
        { prompt: 'The standard "what this validation means / does not mean" wording.', options: ['Shown', 'Never shown'], correct: 0, explain: 'Always shown.' },
      ],
    }],
    scenario: {
      prompt: 'After finalising, the organisation asks you to "fix a typo" in the frozen scores.',
      choices: [
        { text: 'Edit the score; it is only a typo.', consequence: 'The frozen record is changed after the fact. The audit trail shows an edit nobody approved.', feedback: 'A frozen result is never edited.', best: false },
        { text: 'Explain that it is frozen; any change needs a new or follow-up validation, and record the request.', consequence: 'The organisation understands why a frozen record is valuable.', feedback: 'Correct.', best: true },
        { text: 'Ask CRAFT staff to edit it quietly.', consequence: 'A platform admin cannot edit scores either; the request is refused and logged.', feedback: 'There is no back door; that is the point.', best: false },
      ],
    },
  },
]

export type SeedQuestion = { id: string; moduleId: string | null; topic: string; prompt: string; options: string[]; correctIndex: number; explanation: string; forCheck: boolean; forExam: boolean }
const q = (id: string, moduleId: string | null, topic: string, prompt: string, options: string[], correctIndex: number, explanation: string, starter: boolean): SeedQuestion =>
  ({ id, moduleId, topic, prompt, options, correctIndex, explanation, forCheck: true, forExam: starter })

export const SEED_QUESTIONS: SeedQuestion[] = [
  // Starter bank (spec): exam + module check
  q('q01', 'm2', 'Ladder and scoring', 'A rung is achieved when its indicators are all answered and their mean score is at least:', ['3.0', '3.5', '4.0', '5.0'], 1, 'The ladder’s achievement threshold is a 3.5 mean.', true),
  q('q02', 'm2', 'Ladder and scoring', 'An organisation achieves levels 1, 2 and 4 but not 3. Its rung is:', ['4', '3', '2', '1'], 2, 'The ladder is sequential: the rung is the highest level with every level below it achieved.', true),
  q('q03', 'm2', 'Ladder and scoring', 'Which rung asks "Can external capital confidently and safely enter?"', ['Resilience', 'Sustainability', 'Investability', 'Scale'], 2, 'That is the Investability rung (level 5).', true),
  q('q04', 'm2', 'Ladder and scoring', 'A validator’s scores and the organisation’s self-scores imply different rungs. The validated rung is computed from:', ['The average of both', 'The validator’s final scores', 'The organisation’s scores', 'Whichever is higher'], 1, 'The validated rung is computed from the validator’s final scores.', true),
  q('q05', 'm2', 'Ladder and scoring', 'An indicator left unanswered at level 2 means level 2 is:', ['Achieved if the others average 3.5', 'Not achieved', 'Skipped', 'Scored 0 and averaged in'], 1, 'Every indicator must be answered for a level to be achieved.', true),
  q('q06', 'm3', 'Evidence', 'Which best shows a control operates?', ['A board-approved policy', 'Signed monthly bank reconciliations for the last 6 months', 'A job description', 'A consultant’s report recommending the control'], 1, 'Operating evidence shows it happens; a policy shows intent.', true),
  q('q07', 'm3', 'Evidence', 'Evidence dated 18 months ago for a control that should run monthly is:', ['Sufficient', 'Irrelevant', 'Not timely', 'Unreliable'], 2, 'It fails on timeliness.', true),
  q('q08', 'm3', 'Evidence', 'The organisation emails a spreadsheet it made the night before your visit. Before relying on it you should:', ['Accept it', 'Trace a sample back to source records', 'Reject it outright', 'Ask the funder'], 1, 'Trace a sample back to source records.', true),
  q('q09', 'm3', 'Evidence', 'Evidence that is relevant but comes from a party with an interest in the outcome is weak on:', ['Timeliness', 'Sufficiency', 'Reliability', 'Scope'], 2, 'Reliability.', true),
  q('q10', 'm3', 'Evidence', 'When evidence is insufficient for an indicator, you should:', ['Score it 0', 'Leave it blank', 'Score what the evidence supports and note the gap', 'Use the self-score'], 2, 'Score what the evidence supports and note the gap.', true),
  q('q11', 'm4', 'Independence and ethics', 'Which is NOT a conflict?', ['You advised the organisation on its finance manual last year', 'Your sister sits on its board', 'The organisation is 40% of your firm’s fees', 'The funder that engaged you pays your fee and the relationship is disclosed'], 3, 'A disclosed funder engagement is permitted; the others threaten independence.', true),
  q('q12', 'm4', 'Independence and ethics', 'A funder’s own employee completes a review. It must be labelled:', ['Independent validation', 'Funder review', 'Self-assessment', 'Qualified validation'], 1, 'Staff of the funder are not independent of it.', true),
  q('q13', 'm4', 'Independence and ethics', 'You discover a conflict mid-engagement. You must:', ['Finish and disclose in the report', 'Stop, disclose to the organisation, engaging party and CRAFT, and withdraw if it cannot be resolved', 'Ask the organisation to waive it', 'Continue if the fee is small'], 1, 'Stop, disclose, and withdraw if it cannot be resolved.', true),
  q('q14', 'm4', 'Independence and ethics', 'A gift worth more than a token amount from the organisation during fieldwork should be:', ['Accepted and declared', 'Declined', 'Shared with the team', 'Accepted after finalising'], 1, 'Decline it.', true),
  q('q15', 'm4', 'Independence and ethics', 'Who must consent before you see an organisation’s evidence?', ['The organisation', 'Only the funder', 'Only CRAFT', 'No one, if the funder engaged you'], 0, 'The organisation always gives final consent.', true),
  q('q16', 'm6', 'Outcomes, validity and follow-up', 'A validation "with qualifications" is valid for:', ['3 months', '6 months', '12 months', '24 months'], 1, 'Six months.', true),
  q('q17', 'm6', 'Outcomes, validity and follow-up', 'A rung-5 organisation, validated without qualifications, can be given 24 months only if:', ['The funder pays more', 'A surveillance check is completed at 12 months', 'It has no CIP', 'A second validator re-reviews it'], 1, 'A surveillance check at 12 months; if missed, it expires at 12.', true),
  q('q18', 'm7', 'Outcomes, validity and follow-up', 'The Capacity Improvement Plan can:', ['Bring a follow-up forward', 'Extend validity beyond what the validator set', 'Change the frozen scores', 'Remove qualifications'], 0, 'The CIP can bring a check forward, never extend validity.', true),
  q('q19', 'm7', 'Outcomes, validity and follow-up', 'The organisation reports its CEO has resigned. The validation becomes:', ['Withdrawn', 'Expired', 'Suspended pending review', 'Unchanged'], 2, 'Reporting a material event sets suspended pending review.', true),
  q('q20', 'm8', 'Outcomes, validity and follow-up', 'After finalising, the organisation asks you to correct a score. You should:', ['Edit it', 'Ask CRAFT to edit it', 'Explain the scores are frozen; any change needs a new or follow-up validation', 'Delete and redo the validation'], 2, 'Frozen scores are never edited.', true),
  // Module-check additions (not in the exam until the programme team enables them)
  q('q21', 'm1', 'Roles and labels', 'Who is the "engaging party" in an engagement?', ['The party that engaged the validator, such as the organisation, a funder or a firm', 'Always the funder', 'Always the organisation', 'CRAFT'], 0, 'Whoever engaged the validator; it is shown on the result.', false),
  q('q22', 'm1', 'Roles and labels', 'Which label applies to the organisation’s own scores?', ['Independent validation', 'Funder review', 'Self-assessment', 'Qualified validation'], 2, 'Self-assessment.', false),
  q('q23', 'm1', 'Roles and labels', 'Why do self-assessments need independent checking?', ['They are always wrong', 'People are closest to their own work, so results tend to run optimistic', 'Funders do not read them', 'The law requires it'], 1, 'Optimism is human, not dishonest.', false),
  q('q24', 'm1', 'Roles and labels', 'A funder’s staff review a grantee. The result should be shown as:', ['Independent validation', 'Funder review', 'Self-assessment', 'Audit'], 1, 'Funder review, never validation.', false),
  q('q25', 'm1', 'Roles and labels', 'Your conclusion is valuable because readers can:', ['Skip their own due diligence', 'Rely on it without repeating your work, as you were independent and evidence-based', 'Treat it as a guarantee', 'Use it as an audit opinion'], 1, 'It is not an audit or a guarantee.', false),
  q('q26', 'm5', 'Planning and fieldwork', 'To check whether a control operates across hundreds of transactions you should use:', ['Document review only', 'Sample testing', 'A single interview', 'The self-score'], 1, 'Sample testing.', false),
  q('q27', 'm5', 'Planning and fieldwork', 'A narrower scope than the whole ladder is acceptable if it is:', ['Unstated', 'Stated openly in the engagement and the result', 'Chosen after fieldwork', 'Agreed only with the funder'], 1, 'Say it openly.', false),
  q('q28', 'm5', 'Planning and fieldwork', 'The organisation does not supply a document you asked for twice. You should:', ['Use the self-score', 'Record the requests and score what the evidence supports, noting the gap', 'Assume it exists', 'Drop the indicator quietly'], 1, 'Missing evidence is itself evidence.', false),
  q('q29', 'm5', 'Planning and fieldwork', 'What should you record as you go?', ['Only the final scores', 'What you asked for, received, tested, from whom and when', 'Nothing until finalising', 'Only problems'], 1, 'A clear trail.', false),
  q('q30', 'm5', 'Planning and fieldwork', 'A short validation timetable set by a funder:', ['Allows you to skip methods', 'Never shortens the method; narrow the scope or change the date instead', 'Means fewer indicators need evidence', 'Lets the self-score stand'], 1, 'The method never shrinks to meet a deadline.', false),
  q('q31', 'm6', 'Outcomes', 'In the debrief the CEO says the funder "expects rung 4". Your scores give rung 3. You should:', ['Move scores to rung 4', 'Consider new evidence on its merits; the funder’s expectation is irrelevant', 'Cancel the debrief', 'Tell the funder first'], 1, 'The outcome follows the scores.', false),
  q('q32', 'm6', 'Outcomes', 'Which is a good qualification?', ['Controls need improvement', 'Three-quote rule followed in 9 of 15 sampled purchases; retest 15 at follow-up', 'Governance is weak', 'More training is needed'], 1, 'Specific and testable.', false),
  q('q33', 'm6', 'Outcomes', 'When may you set a validity period shorter than the standard?', ['Never', 'Always, for a named risk', 'Only if the funder asks', 'Only for rung 7'], 1, 'You may always set a shorter period for a named risk.', false),
  q('q34', 'm7', 'Follow-up', 'Follow-ups re-check:', ['Everything again', 'Only the qualified or blocking indicators', 'Only the self-assessed scores', 'Nothing; the CIP decides'], 1, 'Targeted.', false),
  q('q35', 'm7', 'Follow-up', 'A follow-up point is missed. The validation shows as:', ['Not validated', 'Follow-up overdue', 'Withdrawn', 'Unchanged'], 1, 'Follow-up overdue; at expiry, expired.', false),
  q('q36', 'm7', 'Follow-up', 'The default follow-up schedule is:', ['Milestone-based', 'Every month', 'None', 'End of year'], 0, 'Milestone-based.', false),
  q('q37', 'm8', 'Reporting', 'The public verification page never shows:', ['The validated rung', 'Indicator scores and evidence', 'The validity period', 'The standard wording'], 1, 'Never indicator scores, evidence, comments or contact details.', false),
  q('q38', 'm8', 'Reporting', 'Finalising a validation:', ['Allows edits for 30 days', 'Freezes a snapshot; later self-score changes never alter it', 'Needs no declaration', 'Is reversed by CRAFT staff'], 1, 'It is frozen.', false),
  q('q39', 'm8', 'Reporting', 'The standard wording says a validation is:', ['An audit', 'Not an audit and not a guarantee of future performance', 'An endorsement by the engaging party', 'A rating'], 1, 'It is not an audit, endorsement or guarantee.', false),
  q('q40', 'm8', 'Reporting', 'Before relying on a copy of a validation you should:', ['Trust the PDF', 'Check the verification page shows it as current', 'Ask the organisation', 'Ask the validator'], 1, 'Status can change.', false),
]

export const SEED_CASES = [
  { id: 'case-a', position: 1, title: 'Case A. The friendly deadline', topic: 'Independence',
    prompt: 'A grantee you once ran a 2-day workshop for, 3 years ago, asks you to validate them. Their funder needs the result in 10 days and suggests you "rely mostly on last year’s audit". Write about 300 words: how do you respond, what do you disclose, and what do you agree?',
    modelAnswer: 'The old workshop is likely not a conflict but must be disclosed in the declaration. A 10-day deadline cannot cut the method: explain what can be done in the time, propose a narrower scope (named levels) or a later date, and record the funder’s suggestion. An audit is evidence for some indicators, not a substitute for the validation.' },
  { id: 'case-b', position: 2, title: 'Case B. Paper versus practice', topic: 'Evidence',
    prompt: 'The procurement policy is excellent, but in a sample of 15 purchases, 6 lack the required three quotes. Write about 300 words: how do you score the indicator and what do you report?',
    modelAnswer: 'Score on operation, not policy (likely 2 rather than 4); state the sample and failure rate; if it blocks the rung, make it a specific qualification ("three-quote rule followed in 9 of 15 sampled purchases; retest 15 purchases at follow-up").' },
  { id: 'case-c', position: 3, title: 'Case C. The pushback', topic: 'Outcome',
    prompt: 'In the debrief the CEO disputes three scores and says the funder "expects rung 4". Your scores give rung 3. Write about 300 words: what do you do?',
    modelAnswer: 'Consider new evidence on its merits and record any change; do not move a score for pressure; the funder’s expectation is irrelevant; the outcome follows the scores; record the dispute and the organisation’s response.' },
  { id: 'case-d', position: 4, title: 'Case D. The surprise', topic: 'Material events',
    prompt: 'Two weeks after you validated an organisation at rung 4, a newspaper reports its finance director is under police investigation. Write about 300 words: what happens next?',
    modelAnswer: 'The organisation must report it within 5 working days; if it does not, report it to CRAFT yourself; the validation should be suspended pending review; assess whether the controls you relied on depended on that person.' },
]

export const SEED_RUBRIC: RubricCriterion[] = [
  { key: 'independence', name: 'Independence', weight: 'Must meet', mustMeet: true, meets: 'Declaration complete; funder engagement disclosed; the organisation’s auditor relationship noticed' },
  { key: 'scoring', name: 'Scoring accuracy', weight: 'High', mustMeet: false, meets: 'Within 1 point of the reference score on at least 80% of indicators' },
  { key: 'evidence', name: 'Evidence judgement', weight: 'High', mustMeet: false, meets: 'Each score has an evidence note; policy-versus-operation and stale data caught' },
  { key: 'outcome', name: 'Outcome and rung', weight: 'Must meet', mustMeet: true, meets: 'Correct sequential rung; outcome type justified; qualifications specific and testable' },
  { key: 'followup', name: 'Follow-up and validity', weight: 'Medium', mustMeet: false, meets: 'Validity period follows the rules; a realistic milestone follow-up tied to the qualifications' },
  { key: 'events', name: 'Material events and communication', weight: 'Medium', mustMeet: false, meets: 'Resignation treated as a material event; debrief note firm, factual and courteous' },
]

export const SEED_CAPSTONE = {
  id: 'riverbend', position: 1, title: 'Riverbend Health Trust',
  brief: 'Riverbend Health Trust is a mid-sized health NGO. It self-assesses at rung 4 (Sustainability) and wants a validation before a funder’s grant decision. The funder engaged you. Work through the evidence file, then submit: your independence declaration (noting the funder engagement), a score and evidence note for each rung 1-4 indicator, your debrief note responding to the organisation’s pushback, the outcome, the validated rung and your specific qualifications, and your follow-up schedule and validity period. The obvious answer is wrong in at least three places.',
  evidence: [
    { title: 'Registration and governance (rung 1)', body: 'Registered NGO certificate (current); constitution reviewed 2 years ago; board of 7 meets quarterly with signed minutes; approval matrix and segregation of duties documented and sampled with no exceptions.' },
    { title: 'Audited accounts (rung 2)', body: 'Audited accounts for the last two years with an unqualified opinion. Note in the board register: a non-executive board member’s cousin is the managing partner and owner of the audit firm.' },
    { title: 'Reporting and delivery (rung 2)', body: 'Quarterly reports to the funder on time; programme delivery against plan documented for two of three programmes.' },
    { title: 'Reserves (rung 3)', body: 'Reserves policy approved by the board requires 6 months of operating costs. Latest management accounts (last month) show reserves of 1 month of costs after a drawdown to cover a delayed grant.' },
    { title: 'Continuity and succession (rung 3)', body: 'Business continuity plan dated 14 months ago and tested once. Succession plan names an interim for the CEO; none for the finance director.' },
    { title: 'Impact reporting (rung 4)', body: 'Impact report is well written. For the maternal health programme, the headline data tables are identical to the prior year’s report, including the dates in the table footnotes.' },
    { title: 'Late email', body: 'Last week the finance director resigned. The CEO mentions it in passing in an email to you: "we are sorting out cover".' },
  ],
  referenceScores: { 'CRL-1A': 4, 'CRL-1B': 4, 'CRL-1C': 4, 'CRL-2A': 4, 'CRL-2B': 4, 'CRL-2C': 3, 'CRL-3A': 1, 'CRL-3B': 3, 'CRL-3C': 2, 'CRL-4A': 3, 'CRL-4B': 4, 'CRL-4C': 3 } as Record<string, number>,
  modelAnswer: 'Validated with qualifications at rung 2, because rung 3 fails on operated reserves; the auditor relationship qualifies rung 2; validity 6 months with milestone follow-up on reserves and impact data; the finance director’s resignation recorded as a material event. Choosing rung 3 or 4 fails the outcome criterion even if scoring is otherwise good.',
  rubric: SEED_RUBRIC,
}

// Illustrative indicator descriptions with reference scores set by the programme team.
export const SEED_CALIBRATION: Array<{ id: string; statement: string; referenceScore: number }> = [
  ['No legal registration exists; the group operates informally under one person’s name.', 0],
  ['Registration lapsed two years ago and has not been renewed.', 1],
  ['Registered, but the constitution still describes activities the organisation stopped five years ago.', 2],
  ['Registered with current governing documents on file and a board that meets as the constitution requires.', 3],
  ['Legal documents are reviewed every two years and updated after each change in activities.', 4],
  ['Legal structure independently reviewed for fitness against current and planned activities.', 5],
  ['One person approves and records all payments; bank statements are never reviewed by anyone else.', 1],
  ['Approval thresholds exist but are bypassed for urgent payments about once a month.', 2],
  ['Documented approval thresholds and segregation of duties, sampled with no exceptions.', 3],
  ['Controls are monitored and bank reconciliations are signed off by a second person every month.', 4],
  ['Controls independently tested by an external party with no material weaknesses found.', 5],
  ['Leadership roles are defined but decision rights are contested and nothing is written down.', 2],
  ['Decision rights are documented; the board has met every quarter with signed minutes.', 3],
  ['No financial records have been kept for the last year.', 0],
  ['Records are kept but cannot be reconciled to the bank for two of the last six months.', 2],
  ['Annual accounts audited with an unqualified opinion and adjustments under 1% of income.', 4],
  ['Quarterly reports to funders are late about half the time.', 2],
  ['Reserves policy exists; reserves cover about one month of costs against a six month target.', 1],
  ['Reserves cover about three months of costs and are reviewed quarterly by the board.', 3],
  ['A tested continuity plan, reviewed every year, with a named deputy for each key role.', 4],
  ['The CEO is the only person who holds donor relationships; no succession plan exists.', 1],
  ['Programme data for the year is copied from the previous year’s report.', 1],
  ['Staff are covered by written contracts and a grievance policy that is used in practice.', 4],
  ['Community advisory group meets twice a year and its recommendations are tracked and answered.', 4],
].map(([statement, referenceScore], i) => ({ id: `cal-${String(i + 1).padStart(2, '0')}`, statement: statement as string, referenceScore: referenceScore as number }))

export const SEED_BADGES = [
  { key: 'ladder-climber', position: 1, name: 'Ladder Climber', criteria: 'Completing Modules 1-2 and the rung-calculator challenge.' },
  { key: 'evidence-hawk', position: 2, name: 'Evidence Hawk', criteria: 'A perfect score in the Module 3 evidence sort, and a capstone that meets the evidence-judgement criterion (policy versus operation and stale data caught).' },
  { key: 'clear-conscience', position: 3, name: 'Clear Conscience', criteria: 'A perfect score on the Module 4 conflict spotter.' },
  { key: 'calibrated', position: 4, name: 'Calibrated', criteria: 'A calibration score of 90% or more.' },
  { key: 'riverbend-solved', position: 5, name: 'Riverbend Solved', criteria: 'Passing the capstone with Exceeds on Outcome.' },
]
