// Short plain-language explainers shown beside results and assessments ("What does this mean?"), written for
// non-technical people, boards and teams. Each says what the result shows, how to read it and what to do next.
// Keep sentences short and words everyday; the self-check enforces length. Self-check: `node src/lib/explainers.test.ts`.

export interface Explainer { shows: string; read: string[]; next: string[] }

export const EXPLAINERS = {
  dashboard: {
    shows: 'A summary of your answers so far: an overall score, how you do in each area, and the risks to fix first.',
    read: [
      'The composite score is the average of the areas you have answered, out of 100. It is your own view, not a check by anyone else.',
      'Green is 70 or more, amber is 50 to 69 and red is below 50.',
      'Open critical risks are questions you scored 0 or 1. These usually matter most to funders.',
    ],
    next: [
      'Finish any areas you have not answered, so the picture is complete.',
      'Start with the critical risks. Each one becomes an action in your improvement plan.',
    ],
  },
  capitalLadder: {
    shows: 'Which rung of the seven-rung Capital Readiness Ladder your organisation has reached, from Survival up to Capital Market Readiness.',
    read: [
      'Each rung is a level with a few questions, scored 0 to 5.',
      'You reach a rung when every question on it is answered and the average is at least 3.5.',
      'Rungs build on each other. Your rung is the highest one with every rung below it also reached, so one weak lower rung holds you back.',
    ],
    next: [
      'Look at the first rung you have not reached. Its lowest scores are the quickest way up.',
      'Add evidence for your answers, so a validator can confirm them later.',
    ],
  },
  craftIndex: {
    shows: 'How your organisation scores on one CRAFT index, broken down by its parts (dimensions).',
    read: [
      'Each question is scored 0 to 5. A score of 4, "Managed", or more means the practice is in place and checked.',
      'Each dimension shows its average score out of 5. Lower numbers are weaker areas.',
      'The band is the overall level. It can be held down when key evidence is missing.',
      'Some questions only apply to certain kinds of organisation, so yours may show fewer questions than another.',
    ],
    next: [
      'Pick the two or three weakest dimensions and add them to your improvement plan.',
      'Keep evidence for high scores. A validator will ask to see it.',
    ],
  },
  esgScorecard: {
    shows: 'How your organisation is doing on environmental (E), social (S) and governance (G) practice, based on your own answers.',
    read: [
      'Each pillar is the average of its questions. Higher is better.',
      'This is self-reported. It shows where you think you are, not what has been checked.',
      'The gaps list shows your lowest answers with a suggested first step for each.',
    ],
    next: [
      'Work on the gaps with the clearest first step, then answer again to see the change.',
      'Upload supporting evidence, such as policies or energy records, to make the scores credible.',
    ],
  },
  esgMaturity: {
    shows: 'Where your organisation sits on a five-stage sustainability journey, from Foundations to Systemic leadership.',
    read: [
      'Your stage comes from your answers and is confirmed by the evidence you add.',
      'Each stage builds on the one before. You move up when the next stage’s practices are in place.',
      'The list under the stage shows what is still needed to reach the next one.',
    ],
    next: [
      'Pick one or two items from the "to reach the next stage" list and plan them.',
      'Most organisations take a year or more per stage. Steady progress is the goal.',
    ],
  },
  netZero: {
    shows: 'Whether your emissions target is roughly as fast as the 1.5°C benchmarks that climate science groups publish.',
    read: [
      'It compares your yearly reduction rate with the benchmark rate. A shortfall is shown in percentage points.',
      'This is an indicative check only. It is not an official target validation.',
      'Warnings point to missing parts, such as no near-term milestone or no plan for supplier emissions.',
    ],
    next: [
      'If you fall short, set a near-term milestone that closes the gap, or explain why it differs.',
      'Have the board approve the target and a plan to meet it.',
    ],
  },
  dma: {
    shows: 'Which sustainability matters are important enough to report on: those with a big effect on people or nature, or on your finances.',
    read: [
      'Impact looks at how your work affects people and nature: how severe and how likely.',
      'Financial looks at how a matter could affect your money: how large and how likely.',
      'A matter is material if it passes the threshold on either side. The matrix shows both.',
    ],
    next: [
      'Check the material matters with the people affected and your board.',
      'Report on the material matters. Write down why the others were left out.',
    ],
  },
  assurance: {
    shows: 'How ready your sustainability report is for an independent check (assurance), and the steps to get there.',
    read: [
      'Limited assurance is a lighter check. Reasonable assurance is deeper and closer to an audit.',
      'Most organisations start with limited assurance on the whole report, then go deeper on key figures such as emissions.',
      'CRAFT shows readiness only. It never gives an assurance opinion itself.',
    ],
    next: [
      'Close the control gaps shown for the level you are aiming at.',
      'When you describe your assurance, say its level and scope. Do not call limited assurance an audit.',
    ],
  },
  esgKpis: {
    shows: 'Your key ESG figures, such as emissions, energy, waste and safety, worked out the same way every time.',
    read: [
      'Each figure has a formula and a unit, so you can compare year to year.',
      'The method notes say what is counted, for example which emissions or which hours worked.',
      'These are your own figures. They are not checked unless you have them assured.',
    ],
    next: [
      'Fill in the same figures each year, using the same method.',
      'Keep the source records, such as meter readings and invoices, for each figure.',
    ],
  },
  ndc: {
    shows: 'How your organisation’s climate actions relate to your country’s national climate plan (its NDC).',
    read: [
      'An NDC is the climate pledge each country makes under the Paris Agreement.',
      'Your actions can contribute to the national goal, or be aligned with it.',
      'Only the government reports progress on the NDC. Your results are not counted in it.',
    ],
    next: [
      'Use this to show funders how your work supports national priorities.',
      'Say "contributes to" or "is aligned with". Never say your results are counted or credited.',
    ],
  },
  riskQuant: {
    shows: 'What a risk could cost your organisation in a year, and which fixes are worth the money.',
    read: [
      'The results are ranges, because the inputs are estimates. A range is more honest than one number.',
      'The loss chart shows the chance that one year’s losses go above each amount.',
      '"Cost of the gap" compares the loss a fix avoids with what the fix costs. A higher payback comes first.',
    ],
    next: [
      'Start with the fixes that pay back most, and add them to your improvement plan.',
      'Rerun when your inputs change. These results are never part of a validation.',
    ],
  },
  trustDelta: {
    shows: 'The difference between your own scores and the independent reviewer’s scores, question by question.',
    read: [
      'Each bar compares your self-score with the reviewer’s score. The longer the gap, the bigger the difference in view.',
      'Small gaps are normal. Large gaps usually mean the evidence did not support the self-score.',
      'Where the scores differ, both sides discuss the evidence and agree one final score.',
    ],
    next: [
      'For each large gap, look at the evidence the reviewer asked for.',
      'Fix the cause before the next review, not just the score.',
    ],
  },
  isoReadiness: {
    shows: 'How well your CRAFT answers cover what an ISO standard expects, and where the gaps are.',
    read: [
      'Covered means your related answers average 3.5 or more. Partial is 2 to 3.5. Gap is below 2.',
      'Not assessed means you have not answered the related questions yet.',
      'This shows readiness only. Only an accredited certification body can certify you.',
    ],
    next: [
      'Work on the gap questions first. Each one is listed with your score.',
      'Before you seek certification, ask a certification body what evidence it expects.',
    ],
  },
  frameworkReport: {
    shows: 'How your answers line up with the frameworks funders use, with your weakest answers and the actions planned for them.',
    read: [
      'Each framework part is marked Covered, Partial or Gap, based on the CRAFT questions linked to it.',
      'The weakest answers are your lowest scores. They are the most likely to concern a funder.',
      'This is a readiness view. It is not an endorsement by the framework’s owner.',
    ],
    next: [
      'Share the report with your board and funders, together with your improvement plan.',
      'Improve the weakest answers first, then generate the report again.',
    ],
  },
  jurisdiction: {
    shows: 'For the laws that apply where you work, how far your CRAFT answers show you are ready to meet them.',
    read: [
      'Each law is marked Covered, Partial or Gap from the questions linked to it.',
      'This shows readiness, never legal compliance. It is not legal advice.',
      'Laws marked "partly reviewed" are still being checked by CRAFT’s reviewers.',
    ],
    next: [
      'Work on the gaps that carry penalties or deadlines first.',
      'Ask a local lawyer to confirm what each law requires of you.',
    ],
  },
  findings: {
    shows: 'Every gap found in your answers, with how serious it is.',
    read: [
      'Every question you scored 2 or below appears here. Critical means 0 or 1, and high means 2.',
      'Each finding says which question it came from, so you can see why it was raised.',
    ],
    next: [
      'Turn the critical and high findings into actions in your improvement plan.',
      'When you fix one, update your answer and add the evidence.',
    ],
  },
  cip: {
    shows: 'Your Capacity Improvement Plan: the actions that close your gaps, who owns them and when they are due.',
    read: [
      'Actions come from your lowest answers. The most serious come first.',
      'The suggested timeline spreads the work by how serious each gap is. You can choose a faster or slower pace.',
      'Set each action’s status as work moves. Off-track means it has slipped and needs attention.',
    ],
    next: [
      'Give every action an owner and a realistic date.',
      'Review the plan each month and mark progress, so your scores and reports stay up to date.',
    ],
  },
  examResults: {
    shows: 'Your progress towards becoming a CRAFT-accredited validator: the knowledge exam, the written cases and the capstone.',
    read: [
      'You need to pass all three parts. Passing one part does not carry over to another.',
      'Exam scores show the share of questions you got right against the pass mark.',
      'Written work is marked by trained markers against the rubric shown.',
    ],
    next: [
      'If you did not pass, review the modules linked to the topics you missed, then retake within the limits shown.',
      'Once accredited, renew every year by keeping your training and CPD up to date.',
    ],
  },
  prePostTests: {
    shows: 'How much you learned from this module’s video: your score before watching and your score after.',
    read: [
      'The pre-test is your starting point. You can take it once.',
      'The post-test repeats those questions and adds two more. Your latest attempt counts.',
      'This is practice only. It never counts towards accreditation.',
    ],
    next: [
      'Read the explanation for any question you missed.',
      'Retake the post-test after a few days to check that the learning stuck.',
    ],
  },
} satisfies Record<string, Explainer>

export type ExplainerId = keyof typeof EXPLAINERS
