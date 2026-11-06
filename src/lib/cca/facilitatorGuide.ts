// CRAFT Capacity Assessment: facilitator orientation agenda and assessment script (in-app help, CRAFT's own words).
// The rules it describes live in src/lib/cca/engine.ts; keep the two in step.

export type AgendaItem = { minutes: number; title: string; points: string[] }
export type ScriptStep = { title: string; say: string; do: string[] }

/** Orientation for facilitators and the organisation's team, before the first session (about three hours). */
export const ORIENTATION_AGENDA: AgendaItem[] = [
  { minutes: 15, title: 'Welcome and purpose', points: [
    'Why the organisation is being assessed and what the results will be used for.',
    'The assessment is about the organisation’s systems, not about individuals.',
    'Results belong to the organisation; who else sees them is its decision.',
  ] },
  { minutes: 30, title: 'How scoring works', points: [
    'Each domain scores 1 to 4. Level 1 is the starting point and needs no evidence.',
    'A higher level counts only when every statement in it, and in the levels below, is met and the evidence has been seen.',
    'Something that is true but cannot be shown counts as not met for now; the improvement plan records how to evidence it.',
    'Growth levels read the average as a share of the maximum: Nascent up to 25%, Emerging up to 50%, Expanding up to 75%, Mature above.',
  ] },
  { minutes: 20, title: 'Roles', points: [
    'Facilitator: runs the session, keeps time, keeps the discussion on evidence.',
    'Assessor: records what was seen for each statement, with document names and dates.',
    'Note-taker: records discussion points, disagreements and actions.',
    'Organisation lead: makes sure documents and the right people are available.',
  ] },
  { minutes: 30, title: 'Facilitated scoring', points: [
    'Approach I, anonymous votes: everyone scores the domain privately; the spread is shown; the highest score the evidence supports stands.',
    'Approach II, group consensus: the group agrees a score; it stands only as far as the evidence supports, and any difference is explained in writing.',
    'Choose one approach per domain and say which before scoring starts.',
  ] },
  { minutes: 25, title: 'Evidence and the desk review', points: [
    'Use the desk review list to request documents before the session, with a custodian and due date for each.',
    'Ask for the approved version and evidence that it is used. If a document does not exist, record that and why: do not create one for the assessment.',
    'Documents approved shortly before the assessment are checked with extra care.',
  ] },
  { minutes: 20, title: 'Marking domains not assessed', points: [
    'A domain can be left out when it does not apply or cannot be assessed this time, with the reason recorded.',
    'It is then left out of the averages and listed in the plan as yet to be assessed. Grant-stage assessments cannot skip domains.',
  ] },
  { minutes: 25, title: 'After scoring: plan, SWOT and reports', points: [
    'The improvement plan is generated: every domain below 4 aims one level up within 12 months, using the statements not yet met.',
    'Add a timeline, a person responsible and the costs by kind for each domain.',
    'Agree strengths, weaknesses, opportunities and threats in the SWOT debrief.',
    'Yearly reports are immediate; mid-term and five-year reports follow consecutive yearly assessments.',
  ] },
  { minutes: 15, title: 'Reassessment and close', points: [
    'Reassess after 12 months. Each target from the plan that was not reached needs an explanation before the reassessment can be completed.',
    'Confirm dates, document requests and who will attend each session.',
  ] },
]

/** Script for each assessment session. */
export const ASSESSMENT_SCRIPT: ScriptStep[] = [
  { title: 'Opening', say: 'Thank you for making time. Today we look at how the organisation works, area by area, and what can be shown for each statement. Scores reflect what we can see today, not effort or intentions.', do: [
    'Introduce the people present and their roles.', 'Confirm which capacity areas this session covers.', 'Agree whether each domain will use anonymous votes or group consensus.',
  ] },
  { title: 'For each domain', say: 'Here is what level 1 looks like. Let us read the statements for level 2 and see which we can show.', do: [
    'Read the level 1 description, then the statements for the next level.',
    'For each statement, ask for the evidence and record what was seen, with its name and date.',
    'Move up a level only when every statement in the current level is met and evidenced.',
    'Run the vote or agree the consensus score, and record it.',
    'If the vote or consensus is higher than the evidence supports, say so and record why the group sees it differently.',
  ] },
  { title: 'When evidence is missing', say: 'If this is in place but we cannot see it today, we will note it as not yet evidenced. The plan will show what to provide.', do: [
    'Mark the statement not met and note what evidence would show it.', 'Do not accept documents written during the session as evidence of established practice.',
  ] },
  { title: 'When a domain does not apply', say: 'If this domain does not apply to you at present, we can record it as not assessed with the reason. It will not count in the averages.', do: [
    'Record the reason in the domain.', 'Remember grant-stage assessments must cover every domain.',
  ] },
  { title: 'Closing', say: 'Here is where the evidence places each area today, and the steps that would move each one up. We will share the plan and agree who leads each action.', do: [
    'Show the dashboard and radar.', 'Walk through the generated improvement plan and agree owners and dates.', 'Capture the SWOT debrief.', 'Confirm when the next session or the reassessment will be.',
  ] },
]
