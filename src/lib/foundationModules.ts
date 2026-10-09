// ============================================================================
// CRAFT Institutional Readiness Architecture - CRAFT-authored modules
// ----------------------------------------------------------------------------
// Three modules of the Readiness Architecture had no dedicated framework: only a
// single Capital Readiness Ladder rung touched Resilience and Transformation,
// and nothing assessed Intergenerational & Institutional Legacy. Each module
// here is a full diagnostic in its own right:
//   • 02 Resilience - "Can you survive disruption?"
//   • 05 Transformation & Adaptability - "Can you evolve?"
//   • 12 Intergenerational & Institutional Legacy - "Does the institution
//     outlast the people who built it?"
//
// All three share one shape (dimensions → indicators on the fiduciary 0-5 scale
// with Statements of Excellence) plus two things a flat average cannot express:
//   1. A weakest-link rule. A strong average cannot hide a collapsed dimension -
//      an institution with excellent reserves but no succession plan is not
//      resilient. Any dimension below the floor caps the maturity band.
//   2. Lenses - cross-cutting views over the same indicators (Resilience stress
//      tests, the Sense / Seize / Transform adaptive cycle, Legacy horizons).
//
// Indicator ids carry MODULE_SCORE_PREFIX so they can share the per-org
// responses store with the core question bank without diluting core readiness
// scores (see isCoreScoreKey in data.ts).
// ============================================================================

import type { RubricQuestion } from './frameworks'
import { MODULE_SCORE_PREFIX } from './data'

export type FoundationModuleId = 'craft-resilience' | 'craft-transformation' | 'craft-legacy'

export interface ModuleDimension {
  key: string
  name: string
  question: string
}

export interface ModuleIndicator extends RubricQuestion {
  dimension: string
  recommendation: string
  whyItMatters: string
}

export interface ModuleBand {
  /** Minimum composite (0-5) to reach this band. Bands are listed lowest first. */
  min: number
  label: string
  summary: string
  tone: 'rose' | 'amber' | 'yellow' | 'emerald'
}

export interface ModuleLens {
  key: string
  name: string
  description: string
  indicatorIds: string[]
}

export interface FoundationModule {
  id: FoundationModuleId
  no: string
  title: string
  question: string
  intro: string
  lensTitle: string
  lensBlurb: string
  dimensions: ModuleDimension[]
  indicators: ModuleIndicator[]
  bands: ModuleBand[]
  lenses: ModuleLens[]
  /** A dimension scoring below this caps the band at the second-lowest level. */
  weakestLinkFloor: number
  /** Related CRAFT frameworks that reuse or deepen this module's evidence. */
  related: { frameworkId: string; label: string }[]
}

const P = MODULE_SCORE_PREFIX

// ----------------------------------------------------------------------------
// 02 · Resilience
// ----------------------------------------------------------------------------

const RESILIENCE: FoundationModule = {
  id: 'craft-resilience',
  no: '02',
  title: 'CRAFT Institutional Resilience Index',
  question: 'Can you survive disruption?',
  intro:
    'Measures whether the institution can absorb a financial, operational, leadership, digital or external shock and keep delivering its mandate - and stress-tests that capacity against the disruptions that most often break institutions in practice.',
  lensTitle: 'Stress Tests',
  lensBlurb: 'How the institution would likely fare under the five shocks that most often break institutions. Each test draws on the indicators that actually determine survival in that scenario.',
  weakestLinkFloor: 2,
  dimensions: [
    { key: 'financial', name: 'Financial Buffers', question: 'Can the institution absorb a financial shock without halting operations?' },
    { key: 'funding', name: 'Funding Diversification', question: 'Would the loss of any single funder or client be survivable?' },
    { key: 'operational', name: 'Operational Continuity', question: 'Can critical services continue through a disruption?' },
    { key: 'people', name: 'People & Leadership Depth', question: 'Would the institution survive the loss of key people?' },
    { key: 'digital', name: 'Digital & Data Resilience', question: 'Can the institution withstand and recover from a cyber or systems failure?' },
    { key: 'risk', name: 'Risk Intelligence & Response', question: 'Does the institution see shocks coming and respond deliberately?' },
  ],
  indicators: [
    {
      id: `${P}RES-01`, dimension: 'financial', domain: 'Operating Reserves',
      question: 'How many months of core operating costs could the institution cover from unrestricted reserves?',
      soe: {
        0: 'No unrestricted reserves; operations depend on the next disbursement.',
        1: 'Reserves cover less than one month of core costs.',
        2: 'Reserves cover one to two months of core costs.',
        3: 'Reserves cover three to five months, tracked against a documented target.',
        4: 'Reserves cover six or more months under a board-approved reserves policy.',
        5: 'Six-plus months held, reviewed annually and replenished after every drawdown.',
      },
      evidence: 'Reserves policy, audited balance sheet, monthly unrestricted cash report.',
      recommendation: 'Set a board-approved reserves target (three months of core costs is a credible first milestone) and report against it every quarter.',
      whyItMatters: 'Reserves are the time an institution buys itself when anything else goes wrong. Without them every other shock becomes existential.',
    },
    {
      id: `${P}RES-02`, dimension: 'financial', domain: 'Liquidity & Contingency Finance',
      question: 'Does the institution have pre-arranged access to liquidity if cash inflows stop unexpectedly?',
      soe: {
        0: 'No contingency finance and no forward cash visibility.',
        1: 'Cash position known only at month end.',
        2: 'A short-term cash forecast exists but no contingency facility.',
        3: 'A rolling 13-week cash forecast is maintained with named contingency options.',
        4: 'A committed overdraft, credit line or bridge-funding agreement is in place.',
        5: 'Contingency finance has been tested (drawn or stress-modelled) and the forecast drives decisions.',
      },
      evidence: '13-week cash forecast, facility agreement, board minutes on liquidity.',
      recommendation: 'Start a 13-week rolling cash forecast and negotiate a standby facility while the institution is healthy - lenders rarely extend one in a crisis.',
      whyItMatters: 'Most institutional failures are liquidity failures first and solvency failures second.',
    },
    {
      id: `${P}RES-03`, dimension: 'funding', domain: 'Revenue Concentration',
      question: 'What share of income comes from the single largest funder, client or revenue line?',
      soe: {
        0: 'One source provides over 80% of income.',
        1: 'One source provides 60-80% of income.',
        2: 'One source provides 40-60% of income.',
        3: 'No source exceeds 40% and concentration is tracked.',
        4: 'No source exceeds 25%, with a diversification target in the strategy.',
        5: 'No source exceeds 20%, including some unrestricted or self-generated income.',
      },
      evidence: 'Income analysis by source for the last three years, funding strategy.',
      recommendation: 'Track concentration as a standing board metric and set a ceiling for any one source, then build a pipeline to bring the largest share below it.',
      whyItMatters: 'Concentration turns one funder\'s policy change into the institution\'s crisis.',
    },
    {
      id: `${P}RES-04`, dimension: 'funding', domain: 'Funding Pipeline & Renewal',
      question: 'Is there a managed pipeline that replaces income before current agreements end?',
      soe: {
        0: 'No visibility of when current funding ends.',
        1: 'End dates known but no replacement activity.',
        2: 'Ad-hoc proposal writing as agreements near expiry.',
        3: 'A documented pipeline tracks prospects against the funding cliff.',
        4: 'The pipeline covers at least 12 months of projected gaps with probability-weighting.',
        5: 'Pipeline conversion is measured and the institution has bridged past funding cliffs without cuts.',
      },
      evidence: 'Funding pipeline tracker, grant/contract expiry schedule, renewal history.',
      recommendation: 'Map every agreement\'s end date on one timeline - the "funding cliff" - and start replacement work at least nine months before each drop.',
      whyItMatters: 'Funding cliffs are predictable shocks; resilient institutions treat them as such.',
    },
    {
      id: `${P}RES-05`, dimension: 'operational', domain: 'Business Continuity Planning',
      question: 'Is there a tested plan to keep critical services running through a disruption?',
      soe: {
        0: 'No continuity planning.',
        1: 'Awareness of risk but nothing documented.',
        2: 'A basic continuity list exists but has never been tested.',
        3: 'A documented continuity plan identifies critical services, owners and recovery times.',
        4: 'The plan has been exercised through a drill or real incident within 12 months.',
        5: 'Continuity is reviewed after every incident and recovery times are consistently met.',
      },
      evidence: 'Business continuity plan, drill reports, incident and after-action reviews.',
      recommendation: 'List the three services that must never stop, name an owner and a maximum tolerable outage for each, then run one tabletop exercise.',
      whyItMatters: 'DFIs, insurers and government partners increasingly screen for tested continuity plans before contracting.',
    },
    {
      id: `${P}RES-06`, dimension: 'operational', domain: 'Supply Chain & Partner Dependency',
      question: 'Could the institution keep delivering if a critical supplier or implementing partner failed?',
      soe: {
        0: 'Critical dependencies are not identified.',
        1: 'Dependencies known informally; no alternatives.',
        2: 'Critical suppliers listed but single-sourced.',
        3: 'Alternatives identified for each critical supplier or partner.',
        4: 'Pre-qualified alternates and contractual exit/transition clauses are in place.',
        5: 'Dependency risk is reviewed annually and a switch has been executed without service loss.',
      },
      evidence: 'Critical supplier register, framework agreements, partner due-diligence files.',
      recommendation: 'Identify the single supplier or partner whose failure would stop delivery and pre-qualify one alternate.',
      whyItMatters: 'A partner\'s failure becomes the institution\'s failure in the eyes of its funders and beneficiaries.',
    },
    {
      id: `${P}RES-07`, dimension: 'people', domain: 'Key-Person Dependency',
      question: 'Would the institution keep functioning if its chief executive or founder left suddenly?',
      soe: {
        0: 'The institution is entirely dependent on one person.',
        1: 'Risk recognised but no interim arrangement exists.',
        2: 'An informal interim arrangement exists.',
        3: 'A documented emergency succession plan names interim leadership.',
        4: 'Succession cover extends to every senior role and critical technical post.',
        5: 'Interim cover has operated in practice (leave, transition) without disruption.',
      },
      evidence: 'Emergency succession plan, delegation of authority matrix, board minutes.',
      recommendation: 'Agree an emergency succession plan with the board that names who acts, with what authority, from day one.',
      whyItMatters: 'Key-person risk is one of the most common reasons funders and investors decline otherwise-strong institutions.',
    },
    {
      id: `${P}RES-08`, dimension: 'people', domain: 'Workforce Stability & Wellbeing',
      question: 'Can the institution retain critical staff and protect their wellbeing through prolonged pressure?',
      soe: {
        0: 'High unplanned turnover and no retention data.',
        1: 'Turnover recognised as a problem; no response.',
        2: 'Turnover tracked; ad-hoc retention measures.',
        3: 'Retention and wellbeing policies are in place, with turnover below sector norms.',
        4: 'Critical roles have retention plans and staff wellbeing is surveyed regularly.',
        5: 'Workforce stability held through a recent shock, with evidence of sustained engagement.',
      },
      evidence: 'HR turnover data, staff survey results, wellbeing and duty-of-care policies.',
      recommendation: 'Identify the roles whose loss would hurt most and put a specific retention conversation and plan in place for each.',
      whyItMatters: 'Shocks are absorbed by people. Burned-out or departing teams turn a recoverable shock into a lasting one.',
    },
    {
      id: `${P}RES-09`, dimension: 'digital', domain: 'Cybersecurity Controls',
      question: 'Are core cybersecurity controls (MFA, patching, access reviews, phishing awareness) in place?',
      soe: {
        0: 'No deliberate security controls.',
        1: 'Antivirus only; shared accounts in use.',
        2: 'Some controls in place but inconsistently applied.',
        3: 'MFA on all critical systems, managed patching and named user accounts.',
        4: 'Access reviews, staff awareness training and an incident response plan are in place.',
        5: 'Controls independently tested (e.g. penetration test or certification) with findings closed.',
      },
      evidence: 'IT security policy, MFA coverage report, training records, penetration test.',
      recommendation: 'Turn on multi-factor authentication for email, finance and data systems first - it blocks the majority of real-world account compromises.',
      whyItMatters: 'Ransomware and payment fraud are now among the fastest ways an institution loses funds, data and trust.',
    },
    {
      id: `${P}RES-10`, dimension: 'digital', domain: 'Backup & Recovery',
      question: 'Could the institution restore its critical data and systems after a total loss?',
      soe: {
        0: 'No backups.',
        1: 'Occasional manual backups on local devices.',
        2: 'Regular backups, but never restored or tested.',
        3: 'Automated, off-site backups of all critical systems.',
        4: 'Backups are immutable or offline, and restores are tested at least annually.',
        5: 'Recovery time objectives are defined and have been met in a real or simulated recovery.',
      },
      evidence: 'Backup configuration, restore test logs, disaster recovery plan.',
      recommendation: 'Schedule a test restore of the finance system this quarter - an untested backup is a hope, not a control.',
      whyItMatters: 'Records lost to a systems failure can make an institution unauditable, which stops funding.',
    },
    {
      id: `${P}RES-11`, dimension: 'risk', domain: 'Risk Register & Early Warning',
      question: 'Does the institution maintain a live risk register with early-warning indicators?',
      soe: {
        0: 'Risks are not identified.',
        1: 'Risks discussed informally when problems arise.',
        2: 'A risk register exists but is rarely updated.',
        3: 'The register is reviewed quarterly with owners and mitigations.',
        4: 'Key risk indicators with thresholds trigger escalation to leadership and board.',
        5: 'Early-warning signals have demonstrably triggered timely action on emerging risks.',
      },
      evidence: 'Risk register, risk appetite statement, board risk-committee minutes.',
      recommendation: 'Pick five top risks, assign an owner and one measurable early-warning indicator to each, and review them at every board meeting.',
      whyItMatters: 'Resilience starts with seeing the shock before it lands.',
    },
    {
      id: `${P}RES-12`, dimension: 'risk', domain: 'Crisis Governance & Learning',
      question: 'Is there a defined crisis-management structure, and does the institution learn from incidents?',
      soe: {
        0: 'No crisis structure; responses are improvised.',
        1: 'Leadership responds ad-hoc.',
        2: 'Roles understood informally; no communications plan.',
        3: 'A crisis protocol defines decision rights, escalation and stakeholder communications.',
        4: 'After-action reviews follow every significant incident, with tracked actions.',
        5: 'Learning from incidents measurably changes plans, controls and budgets.',
      },
      evidence: 'Crisis management protocol, communications plan, after-action reviews.',
      recommendation: 'Write a one-page crisis protocol: who convenes, who decides, who speaks to funders and staff, within what hours.',
      whyItMatters: 'How an institution behaves in the first 72 hours of a crisis decides whether funders stay.',
    },
  ],
  bands: [
    { min: 0, label: 'Fragile', summary: 'A single shock could halt operations. Resilience is not yet designed in.', tone: 'rose' },
    { min: 1.75, label: 'Exposed', summary: 'Some buffers exist, but material gaps mean a moderate shock would cause lasting damage.', tone: 'amber' },
    { min: 2.75, label: 'Coping', summary: 'The institution would likely survive a typical shock, though with disruption to delivery.', tone: 'yellow' },
    { min: 3.5, label: 'Resilient', summary: 'Buffers, plans and people are in place to absorb shocks and recover quickly.', tone: 'emerald' },
    { min: 4.4, label: 'Antifragile', summary: 'The institution absorbs shocks and systematically comes out stronger.', tone: 'emerald' },
  ],
  lenses: [
    { key: 'funder-loss', name: 'Loss of the largest funder', description: 'The single biggest income source ends with 90 days\' notice.', indicatorIds: [`${P}RES-01`, `${P}RES-02`, `${P}RES-03`, `${P}RES-04`] },
    { key: 'leader-exit', name: 'Sudden leadership exit', description: 'The chief executive or founder leaves without warning.', indicatorIds: [`${P}RES-07`, `${P}RES-08`, `${P}RES-12`] },
    { key: 'cyber', name: 'Ransomware or systems loss', description: 'Core systems and data are encrypted or lost overnight.', indicatorIds: [`${P}RES-09`, `${P}RES-10`, `${P}RES-05`] },
    { key: 'macro', name: 'Currency or inflation shock', description: 'A sharp devaluation or inflation spike erodes budgets and reserves.', indicatorIds: [`${P}RES-01`, `${P}RES-02`, `${P}RES-11`] },
    { key: 'operational', name: 'Operational disruption', description: 'Unrest, disaster or a partner failure interrupts service delivery.', indicatorIds: [`${P}RES-05`, `${P}RES-06`, `${P}RES-12`] },
  ],
  related: [
    { frameworkId: 'capital-readiness-ladder', label: 'Capital Readiness Ladder - Level 3 Resilience' },
    { frameworkId: 'gfa-diagnostic', label: 'GFA Business Diagnostic - Cash Management & Runway' },
  ],
}

// ----------------------------------------------------------------------------
// 05 · Transformation & Adaptability
// ----------------------------------------------------------------------------

const TRANSFORMATION: FoundationModule = {
  id: 'craft-transformation',
  no: '05',
  title: 'CRAFT Transformation & Adaptability Index',
  question: 'Can you evolve?',
  intro:
    'Measures whether the institution can sense change in its environment, decide and act on it, and reconfigure its strategy, model, systems and culture - rather than simply surviving the status quo.',
  lensTitle: 'Adaptive Cycle',
  lensBlurb: 'Adaptation is a cycle: sense what is changing, seize the opportunity by deciding and resourcing, then transform how the institution actually works. An institution is only as adaptive as the weakest stage.',
  weakestLinkFloor: 2,
  dimensions: [
    { key: 'foresight', name: 'Strategic Foresight', question: 'Does the institution see change coming?' },
    { key: 'learning', name: 'Learning & Evidence Use', question: 'Does evidence change what the institution does?' },
    { key: 'innovation', name: 'Innovation & Experimentation', question: 'Can the institution try new things safely?' },
    { key: 'change', name: 'Change Leadership & Culture', question: 'Can the institution carry its people through change?' },
    { key: 'digital', name: 'Digital Transformation', question: 'Is technology changing how value is delivered?' },
    { key: 'model', name: 'Model Agility', question: 'Can the operating and funding model be reconfigured?' },
  ],
  indicators: [
    {
      id: `${P}TRA-01`, dimension: 'foresight', domain: 'Environmental Scanning',
      question: 'Does the institution systematically track policy, market, technology, climate and demographic trends?',
      soe: {
        0: 'No attention to the external environment.',
        1: 'Trends noticed informally by individuals.',
        2: 'Occasional context analysis, usually for proposals.',
        3: 'A structured scan (e.g. PESTLE) informs the strategy cycle.',
        4: 'Scanning is continuous, with named owners reporting to leadership.',
        5: 'Scanning has demonstrably led the institution to act ahead of peers.',
      },
      evidence: 'Context analyses, horizon-scanning briefs, strategy papers.',
      recommendation: 'Assign one leader to bring a short "what is changing" brief to every quarterly management meeting.',
      whyItMatters: 'Institutions rarely fail from change they saw coming - they fail from change nobody was watching for.',
    },
    {
      id: `${P}TRA-02`, dimension: 'foresight', domain: 'Scenario & Adaptive Planning',
      question: 'Is strategy built around multiple plausible futures, with triggers for changing course?',
      soe: {
        0: 'No strategic plan.',
        1: 'A single-point plan that is rarely revisited.',
        2: 'Strategy reviewed annually but assumes one future.',
        3: 'Strategy includes scenarios or explicit assumptions that are monitored.',
        4: 'Defined triggers prompt a strategy refresh when assumptions break.',
        5: 'The institution has pivoted successfully using its scenario triggers.',
      },
      evidence: 'Strategic plan, scenario analysis, board strategy-review minutes.',
      recommendation: 'Write down the three assumptions your strategy depends on most and what you would do if each proved wrong.',
      whyItMatters: 'Scenario-based strategy turns surprises into prepared-for contingencies.',
    },
    {
      id: `${P}TRA-03`, dimension: 'learning', domain: 'Monitoring, Evaluation & Learning',
      question: 'Do monitoring and evaluation findings routinely change programmes, products or operations?',
      soe: {
        0: 'No monitoring or evaluation.',
        1: 'Data collected only for donor reporting.',
        2: 'Findings reported but rarely acted on.',
        3: 'Findings are reviewed in structured learning sessions with tracked actions.',
        4: 'Adaptive management is standard: plans change mid-cycle based on evidence.',
        5: 'Learning is shared externally and shapes sector practice.',
      },
      evidence: 'MEL framework, learning-review minutes, examples of design changes made from findings.',
      recommendation: 'Hold a quarterly "pause and reflect" for each major programme and record at least one decision it changed.',
      whyItMatters: 'Evidence that never changes a decision is a cost, not a capability.',
    },
    {
      id: `${P}TRA-04`, dimension: 'learning', domain: 'Feedback from Beneficiaries & Clients',
      question: 'Do the people the institution serves have a real channel to shape what it does?',
      soe: {
        0: 'No feedback channels.',
        1: 'Feedback received informally and not recorded.',
        2: 'Feedback collected occasionally through surveys.',
        3: 'Systematic feedback channels with responses logged and closed.',
        4: 'Feedback is analysed for trends and drives service redesign.',
        5: 'Beneficiaries or clients participate in governance or co-design.',
      },
      evidence: 'Feedback and complaints logs, client survey results, co-design records.',
      recommendation: 'Close the loop: tell people what changed because of their feedback - it multiplies the quality of what you hear next.',
      whyItMatters: 'The people served notice change first; listening to them is the cheapest early-warning system there is.',
    },
    {
      id: `${P}TRA-05`, dimension: 'innovation', domain: 'Innovation Pipeline',
      question: 'Does the institution have a deliberate process for generating, testing and scaling new ideas?',
      soe: {
        0: 'No new ideas are pursued.',
        1: 'Innovation happens by individual initiative only.',
        2: 'Occasional pilots without defined success criteria.',
        3: 'Pilots have defined hypotheses, budgets and stop/scale criteria.',
        4: 'A managed pipeline moves ideas from test to scale, with dedicated resources.',
        5: 'Multiple innovations have scaled and now form part of the core model.',
      },
      evidence: 'Pilot designs, innovation budget lines, scale-up decisions.',
      recommendation: 'Ring-fence a small, explicit budget for experiments and decide in advance what result would make you stop or scale.',
      whyItMatters: 'Without a pipeline, adaptation only happens in a crisis - when it is most expensive.',
    },
    {
      id: `${P}TRA-06`, dimension: 'innovation', domain: 'Risk Appetite for Experimentation',
      question: 'Are staff able to propose and run experiments, and is a failed test treated as learning?',
      soe: {
        0: 'Failure is punished; new ideas are discouraged.',
        1: 'Experimentation tolerated only at senior levels.',
        2: 'Stated openness, but failures are hidden.',
        3: 'A documented risk appetite allows bounded experiments.',
        4: 'Failed experiments are reviewed openly and lessons are shared.',
        5: 'Staff at every level routinely run and report experiments.',
      },
      evidence: 'Risk appetite statement, experiment reviews, staff survey on psychological safety.',
      recommendation: 'Have leadership share one failed experiment and its lesson publicly - it signals safety more than any policy.',
      whyItMatters: 'Psychological safety is the precondition for every other innovation practice.',
    },
    {
      id: `${P}TRA-07`, dimension: 'change', domain: 'Change Management Capability',
      question: 'Does the institution deliver major change through a structured process with clear ownership?',
      soe: {
        0: 'Change is imposed without planning.',
        1: 'Change is announced but rarely embedded.',
        2: 'Some planning for major changes, inconsistently applied.',
        3: 'A structured approach (sponsor, plan, communications, training) is standard.',
        4: 'Change adoption is measured and course-corrected.',
        5: 'Multiple major changes delivered on time with sustained adoption.',
      },
      evidence: 'Change plans, communication logs, adoption metrics, post-implementation reviews.',
      recommendation: 'For the next major change, name one accountable sponsor and measure adoption three months after go-live.',
      whyItMatters: 'Most transformation failures are adoption failures, not design failures.',
    },
    {
      id: `${P}TRA-08`, dimension: 'change', domain: 'Leadership for Adaptation',
      question: 'Does leadership actively model, resource and reward adaptation?',
      soe: {
        0: 'Leadership resists change.',
        1: 'Leadership accepts change only when forced.',
        2: 'Leadership supports change verbally but not with resources.',
        3: 'Leadership sponsors change and allocates budget and time to it.',
        4: 'Adaptive behaviour is part of performance management and promotion.',
        5: 'The board holds leadership accountable for adaptation outcomes.',
      },
      evidence: 'Leadership objectives, performance frameworks, board agendas.',
      recommendation: 'Add one adaptation objective to every senior leader\'s annual goals.',
      whyItMatters: 'Staff take their cue on change from what leadership funds and rewards, not what it says.',
    },
    {
      id: `${P}TRA-09`, dimension: 'digital', domain: 'Digital Strategy & Adoption',
      question: 'Is there a digital strategy that is changing how services are delivered and managed?',
      soe: {
        0: 'Paper-based operations, no digital plan.',
        1: 'Basic office tools only.',
        2: 'Some systems digitised in isolation.',
        3: 'A digital strategy is aligned to institutional strategy and funded.',
        4: 'Core processes are digital end-to-end with high staff adoption.',
        5: 'Digital channels have created new services or reach not otherwise possible.',
      },
      evidence: 'Digital/ICT strategy, systems inventory, adoption and usage data.',
      recommendation: 'Pick the one paper process that costs the most staff time and digitise it end-to-end before starting anything new.',
      whyItMatters: 'Digital capability is now how institutions scale reach without scaling cost.',
    },
    {
      id: `${P}TRA-10`, dimension: 'digital', domain: 'Data-Driven Decision Making',
      question: 'Do leaders use timely data to make and revise decisions?',
      soe: {
        0: 'Decisions are made without data.',
        1: 'Data exists but is hard to access or untrusted.',
        2: 'Periodic reports are produced but lag decisions.',
        3: 'Dashboards with timely, trusted data inform regular management meetings.',
        4: 'Decisions reference data explicitly and are revisited when data shifts.',
        5: 'Data and analytics have enabled new strategies or efficiencies.',
      },
      evidence: 'Management dashboards, meeting papers citing data, data governance policy.',
      recommendation: 'Agree five metrics leadership reviews every month and make one person accountable for their accuracy.',
      whyItMatters: 'You cannot adapt to what you cannot see quickly enough to act on.',
    },
    {
      id: `${P}TRA-11`, dimension: 'model', domain: 'Business & Funding Model Agility',
      question: 'Could the institution reconfigure its revenue or funding model if its current model weakened?',
      soe: {
        0: 'The model has never been reviewed.',
        1: 'Weakness recognised; no alternatives considered.',
        2: 'Alternatives discussed but not tested.',
        3: 'Alternative models have been costed and at least one has been piloted.',
        4: 'The institution runs a deliberately mixed model it can rebalance.',
        5: 'The institution has successfully shifted its model in response to change.',
      },
      evidence: 'Business model reviews, pilot results for new revenue lines, financial projections.',
      recommendation: 'Cost one alternative revenue or funding model now, while there is time to test it properly.',
      whyItMatters: 'Funding landscapes shift faster than strategies - model agility is what keeps the mission funded.',
    },
    {
      id: `${P}TRA-12`, dimension: 'model', domain: 'Structural & Partnership Flexibility',
      question: 'Can the institution restructure teams, form partnerships or exit activities quickly when needed?',
      soe: {
        0: 'Structures are rigid; no partnerships.',
        1: 'Restructuring is slow and disruptive.',
        2: 'Some flexibility, but partnerships are ad-hoc.',
        3: 'Clear processes exist for restructuring, partnering and exiting activities.',
        4: 'Cross-functional teams and partnerships form routinely around priorities.',
        5: 'The institution has exited or transferred activities cleanly to focus on higher value.',
      },
      evidence: 'Organisational reviews, partnership agreements, exit/transition plans.',
      recommendation: 'Review your activity portfolio annually and name one thing to stop, transfer or partner on.',
      whyItMatters: 'Adapting often means stopping things - institutions that cannot exit cannot evolve.',
    },
  ],
  bands: [
    { min: 0, label: 'Static', summary: 'The institution operates as it always has and is unlikely to adapt without a crisis.', tone: 'rose' },
    { min: 1.75, label: 'Reactive', summary: 'Change happens when forced, usually late and at high cost.', tone: 'amber' },
    { min: 2.75, label: 'Responsive', summary: 'The institution adapts to visible change through deliberate processes.', tone: 'yellow' },
    { min: 3.5, label: 'Adaptive', summary: 'Sensing, deciding and transforming are embedded and resourced.', tone: 'emerald' },
    { min: 4.4, label: 'Transformative', summary: 'The institution anticipates change and helps shape its sector.', tone: 'emerald' },
  ],
  lenses: [
    { key: 'sense', name: 'Sense', description: 'Seeing change early - in the environment, the evidence and the people served.', indicatorIds: [`${P}TRA-01`, `${P}TRA-03`, `${P}TRA-04`, `${P}TRA-10`] },
    { key: 'seize', name: 'Seize', description: 'Deciding and resourcing - turning signals into funded choices.', indicatorIds: [`${P}TRA-02`, `${P}TRA-05`, `${P}TRA-06`, `${P}TRA-08`] },
    { key: 'transform', name: 'Transform', description: 'Reconfiguring - changing systems, structures, models and behaviour.', indicatorIds: [`${P}TRA-07`, `${P}TRA-09`, `${P}TRA-11`, `${P}TRA-12`] },
  ],
  related: [
    { frameworkId: 'capital-readiness-ladder', label: 'Capital Readiness Ladder - Level 6 Scale' },
    { frameworkId: 'g7-ai-public-sector', label: 'G7 AI Governance - Public Sector Toolkit' },
  ],
}

// ----------------------------------------------------------------------------
// 12 · Intergenerational & Institutional Legacy
// ----------------------------------------------------------------------------

const LEGACY: FoundationModule = {
  id: 'craft-legacy',
  no: '12',
  title: 'CRAFT Intergenerational & Institutional Legacy Index',
  question: 'Does the institution outlast the people who built it?',
  intro:
    'Measures whether the institution is built to endure beyond its founders and current leaders - in its knowledge, leadership pipeline, governance renewal, long-term finance, mission integrity and the stewardship it owes to future generations.',
  lensTitle: 'Legacy Horizons',
  lensBlurb: 'Legacy is tested over time. Each horizon asks whether the institution would still be itself - mission, capability and trust intact - after that span of change.',
  weakestLinkFloor: 2,
  dimensions: [
    { key: 'memory', name: 'Institutional Memory', question: 'Does knowledge belong to the institution rather than individuals?' },
    { key: 'pipeline', name: 'Leadership Pipeline', question: 'Is the next generation of leaders being developed?' },
    { key: 'governance', name: 'Governance Renewal', question: 'Does governance renew itself without depending on founders?' },
    { key: 'finance', name: 'Long-Term Financial Stewardship', question: 'Is the institution financed for decades, not cycles?' },
    { key: 'mission', name: 'Mission & Values Integrity', question: 'Would the mission survive changes in leadership and funding?' },
    { key: 'stewardship', name: 'Intergenerational Stewardship', question: 'Does the institution act fairly toward future generations?' },
  ],
  indicators: [
    {
      id: `${P}LEG-01`, dimension: 'memory', domain: 'Knowledge Management',
      question: 'Is critical institutional knowledge documented, organised and accessible beyond the people who hold it?',
      soe: {
        0: 'Knowledge lives only in people\'s heads.',
        1: 'Some documents exist on personal devices.',
        2: 'Shared storage exists but is disorganised.',
        3: 'A structured knowledge repository covers critical processes and decisions.',
        4: 'Knowledge capture is part of every project close-out and role handover.',
        5: 'New staff become productive quickly using documented knowledge; capture is audited.',
      },
      evidence: 'Knowledge repository, SOP library, project close-out reports, onboarding materials.',
      recommendation: 'Require a short handover note and repository update whenever a project closes or a person changes role.',
      whyItMatters: 'Every undocumented process leaves the institution when the person who knows it does.',
    },
    {
      id: `${P}LEG-02`, dimension: 'memory', domain: 'Records, Archives & History',
      question: 'Are the institution\'s governing records, decisions and history preserved for the long term?',
      soe: {
        0: 'No records are kept systematically.',
        1: 'Records kept but at risk of loss.',
        2: 'Key records stored, but retention is undefined.',
        3: 'A records-retention policy covers governance, legal and financial records.',
        4: 'An institutional archive records major decisions and the reasons behind them.',
        5: 'The institution\'s history and lessons are actively used in induction and strategy.',
      },
      evidence: 'Records retention policy, board minute archive, institutional history documents.',
      recommendation: 'Capture the reasons behind major past decisions, not only the decisions - future leaders need the "why".',
      whyItMatters: 'Institutions that forget why they made choices tend to repeat their most expensive mistakes.',
    },
    {
      id: `${P}LEG-03`, dimension: 'pipeline', domain: 'Leadership Development',
      question: 'Is there a deliberate programme to develop future leaders from within?',
      soe: {
        0: 'No leadership development.',
        1: 'Development depends on individual initiative.',
        2: 'Occasional training without a pipeline view.',
        3: 'High-potential staff are identified and have development plans.',
        4: 'A structured pipeline (mentoring, stretch roles, rotation) is resourced annually.',
        5: 'Most senior appointments are filled internally from the pipeline.',
      },
      evidence: 'Talent reviews, development plans, internal promotion data.',
      recommendation: 'Identify two potential successors for every senior role and give each one stretch responsibility this year.',
      whyItMatters: 'Institutions that cannot grow their own leaders import new cultures with every hire at the top.',
    },
    {
      id: `${P}LEG-04`, dimension: 'pipeline', domain: 'Planned Founder & CEO Transition',
      question: 'Is there a planned, board-owned process for long-term leadership transition (beyond emergency cover)?',
      soe: {
        0: 'Transition has never been discussed.',
        1: 'Discussed informally; considered sensitive.',
        2: 'The board recognises the need but has no plan.',
        3: 'A documented long-term transition plan with a timeline is owned by the board.',
        4: 'Successor candidates are being developed against the plan.',
        5: 'A leadership transition has been completed with mission and performance sustained.',
      },
      evidence: 'Long-term succession policy, board minutes, transition timelines.',
      recommendation: 'Put long-term leadership transition on the board agenda annually, separate from emergency succession cover.',
      whyItMatters: 'Founder transitions are the single most common point at which institutions lose their way.',
    },
    {
      id: `${P}LEG-05`, dimension: 'governance', domain: 'Board Renewal & Term Limits',
      question: 'Does the board renew itself through term limits, skills reviews and structured recruitment?',
      soe: {
        0: 'No board, or members serve indefinitely without review.',
        1: 'Board exists but has never refreshed.',
        2: 'Some turnover, but recruitment is informal.',
        3: 'Term limits and a skills matrix guide board recruitment.',
        4: 'Board effectiveness is evaluated regularly and gaps drive recruitment.',
        5: 'The board has renewed through several cycles with continuity of oversight.',
      },
      evidence: 'Board charter, term-limit policy, skills matrix, board evaluation reports.',
      recommendation: 'Adopt staggered term limits so the board renews steadily rather than all at once.',
      whyItMatters: 'A board that never renews eventually guards the past rather than the institution\'s future.',
    },
    {
      id: `${P}LEG-06`, dimension: 'governance', domain: 'Founder-Independent Governance',
      question: 'Do governance and decision rights function independently of the founder or any one individual?',
      soe: {
        0: 'The founder controls all decisions.',
        1: 'Formal structures exist but defer to the founder.',
        2: 'Some independent decisions, but the founder can override.',
        3: 'Decision rights are vested in governance bodies, not individuals.',
        4: 'Independent members form a majority and chair key committees.',
        5: 'Governance has held firm through disagreement with founders or major stakeholders.',
      },
      evidence: 'Constitution/bylaws, delegation of authority, committee compositions.',
      recommendation: 'Move any decision the founder alone can make into a documented governance process with independent oversight.',
      whyItMatters: 'Institutions outlive founders only when authority sits in structures, not personalities.',
    },
    {
      id: `${P}LEG-07`, dimension: 'finance', domain: 'Endowment & Long-Term Capital',
      question: 'Does the institution hold or build capital designed to fund its mission over decades?',
      soe: {
        0: 'No long-term capital; all funding is short-term.',
        1: 'Long-term capital discussed but not pursued.',
        2: 'Small surpluses retained without a long-term purpose.',
        3: 'A designated long-term fund or endowment strategy exists.',
        4: 'Long-term capital is invested under a policy with spending rules.',
        5: 'Long-term capital generates a stable share of core costs.',
      },
      evidence: 'Endowment or investment policy, fund statements, spending rule.',
      recommendation: 'Designate a long-term fund, even a small one, with a written rule that it is only spent on mission continuity.',
      whyItMatters: 'Project funding sustains activities; long-term capital sustains institutions.',
    },
    {
      id: `${P}LEG-08`, dimension: 'finance', domain: 'Long-Horizon Financial Planning',
      question: 'Does financial planning look beyond the current funding cycle to the institution\'s long-term viability?',
      soe: {
        0: 'No financial planning beyond the current year.',
        1: 'Budgets follow funding agreements only.',
        2: 'A medium-term (2-3 year) view exists informally.',
        3: 'A documented 5-year financial plan links to strategy.',
        4: 'Long-range plans model full cost recovery, asset renewal and liabilities.',
        5: 'Long-horizon planning has guided decisions that sustained the institution through cycles.',
      },
      evidence: '5-year financial plan, full-cost recovery model, asset and liability schedules.',
      recommendation: 'Build a 5-year financial plan that includes the true full cost of running the institution, not just programmes.',
      whyItMatters: 'Institutions funded cycle-to-cycle are always one cycle away from closing.',
    },
    {
      id: `${P}LEG-09`, dimension: 'mission', domain: 'Mission Lock & Purpose Protection',
      question: 'Are the mission and core purpose protected in governing documents against drift or capture?',
      soe: {
        0: 'Mission undefined.',
        1: 'Mission stated but not referenced in decisions.',
        2: 'Mission in governing documents but easily amended.',
        3: 'Mission changes require a defined supermajority or stakeholder process.',
        4: 'Major decisions are formally tested against the mission.',
        5: 'The mission has held through leadership changes and funding pressure.',
      },
      evidence: 'Constitution/articles, mission-alignment review in board papers, amendment history.',
      recommendation: 'Add a mission-alignment check to every major board decision and funding acceptance.',
      whyItMatters: 'Mission drift is how institutions survive while ceasing to be what they were built for.',
    },
    {
      id: `${P}LEG-10`, dimension: 'mission', domain: 'Values, Culture & Ethical Continuity',
      question: 'Are the institution\'s values embedded in systems (hiring, induction, performance) rather than personalities?',
      soe: {
        0: 'Values undefined.',
        1: 'Values exist only as a statement.',
        2: 'Values are discussed but not built into people systems.',
        3: 'Values inform recruitment, induction and conduct policies.',
        4: 'Values are assessed in performance reviews and reinforced by leadership.',
        5: 'Staff surveys show values held consistently across generations of staff.',
      },
      evidence: 'Values statement, code of conduct, induction materials, culture survey results.',
      recommendation: 'Build the values into recruitment questions and induction so each new cohort inherits them by design.',
      whyItMatters: 'Culture carried only by founders leaves with them.',
    },
    {
      id: `${P}LEG-11`, dimension: 'stewardship', domain: 'Youth & Next-Generation Inclusion',
      question: 'Do young people and next-generation stakeholders have a voice in the institution\'s governance and direction?',
      soe: {
        0: 'No consideration of next-generation stakeholders.',
        1: 'Young people are beneficiaries only.',
        2: 'Occasional consultation with young people.',
        3: 'Structured youth or next-generation advisory mechanisms exist.',
        4: 'Next-generation representatives sit in governance with real influence.',
        5: 'Next-generation input has demonstrably shaped strategy.',
      },
      evidence: 'Youth advisory terms of reference, board composition, consultation records.',
      recommendation: 'Create a youth or next-generation advisory voice with a direct line to the board.',
      whyItMatters: 'An institution built to outlast its founders must be shaped by those who will inherit it.',
    },
    {
      id: `${P}LEG-12`, dimension: 'stewardship', domain: 'Long-Term Impact & Stewardship of Assets',
      question: 'Does the institution account for its long-term environmental, social and asset-stewardship impact on future generations?',
      soe: {
        0: 'Long-term impacts are not considered.',
        1: 'Considered informally in some decisions.',
        2: 'Some long-term commitments, not tracked.',
        3: 'Long-term impact and asset stewardship commitments are documented and tracked.',
        4: 'Decisions consider intergenerational effects (climate, debt, asset renewal) explicitly.',
        5: 'Long-term impact is independently evaluated and publicly reported.',
      },
      evidence: 'Sustainability/impact reports, asset management plans, long-term commitments register.',
      recommendation: 'Add an "impact in 25 years" test to capital and strategy decisions - climate, debt and asset renewal first.',
      whyItMatters: 'A legacy is what an institution leaves behind as much as what it builds.',
    },
  ],
  bands: [
    { min: 0, label: 'Person-Dependent', summary: 'The institution would struggle to outlast its current leaders.', tone: 'rose' },
    { min: 1.75, label: 'Transitional', summary: 'Foundations for continuity exist but would not yet survive a leadership transition intact.', tone: 'amber' },
    { min: 2.75, label: 'Durable', summary: 'The institution could likely survive a leadership transition with its mission intact.', tone: 'yellow' },
    { min: 3.5, label: 'Enduring', summary: 'Knowledge, leadership, governance and finance are built to last across generations of staff.', tone: 'emerald' },
    { min: 4.4, label: 'Intergenerational', summary: 'The institution is designed to serve - and be shaped by - future generations.', tone: 'emerald' },
  ],
  lenses: [
    { key: 'transition', name: 'Next leadership transition', description: 'Would the institution remain itself after its next chief executive change?', indicatorIds: [`${P}LEG-01`, `${P}LEG-03`, `${P}LEG-04`, `${P}LEG-06`] },
    { key: 'decade', name: '10-year horizon', description: 'Would mission, finance and governance hold through a decade of change?', indicatorIds: [`${P}LEG-05`, `${P}LEG-08`, `${P}LEG-09`, `${P}LEG-10`] },
    { key: 'generation', name: 'Generational horizon (25+ years)', description: 'Is the institution built to serve, and be shaped by, the next generation?', indicatorIds: [`${P}LEG-02`, `${P}LEG-07`, `${P}LEG-11`, `${P}LEG-12`] },
  ],
  related: [
    { frameworkId: 'esg-self-assessment', label: 'ESG Self-Assessment - Governance pillar' },
    { frameworkId: 'pact-omt-v6', label: 'Pact OMT v6 - Governance & Leadership' },
  ],
}

export const FOUNDATION_MODULES: FoundationModule[] = [RESILIENCE, TRANSFORMATION, LEGACY]

export function getFoundationModule(id: string): FoundationModule | undefined {
  return FOUNDATION_MODULES.find(m => m.id === id)
}

// ----------------------------------------------------------------------------
// Scoring
// ----------------------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100

function meanOf(ids: string[], scores: Record<string, number>): number | null {
  const answered = ids.filter(id => scores[id] != null)
  if (answered.length === 0) return null
  return round2(answered.reduce((s, id) => s + scores[id], 0) / answered.length)
}

export function indicatorsForDimension(m: FoundationModule, dim: string): ModuleIndicator[] {
  return m.indicators.filter(i => i.dimension === dim)
}

/** Mean of the answered indicators in a dimension, or null when none answered. */
export function dimensionScore(m: FoundationModule, dim: string, scores: Record<string, number>): number | null {
  return meanOf(indicatorsForDimension(m, dim).map(i => i.id), scores)
}

export function compositeScore(m: FoundationModule, scores: Record<string, number>): number {
  return meanOf(m.indicators.map(i => i.id), scores) ?? 0
}

export function answeredIn(m: FoundationModule, scores: Record<string, number>): number {
  return m.indicators.filter(i => scores[i.id] != null).length
}

export interface BandResult {
  band: ModuleBand
  /** The band the composite alone would earn, before the weakest-link cap. */
  uncapped: ModuleBand
  /** Dimensions below the weakest-link floor (these caused the cap, if any). */
  weakLinks: ModuleDimension[]
  provisional: boolean
}

export function bandFor(m: FoundationModule, scores: Record<string, number>): BandResult | null {
  const answered = answeredIn(m, scores)
  if (answered === 0) return null
  const composite = compositeScore(m, scores)
  const byComposite = [...m.bands].reverse().find(b => composite >= b.min) ?? m.bands[0]
  const weakLinks = m.dimensions.filter(d => {
    const s = dimensionScore(m, d.key, scores)
    return s != null && s < m.weakestLinkFloor
  })
  const capIndex = 1
  const uncappedIndex = m.bands.indexOf(byComposite)
  const band = weakLinks.length > 0 && uncappedIndex > capIndex ? m.bands[capIndex] : byComposite
  return { band, uncapped: byComposite, weakLinks, provisional: answered < m.indicators.length }
}

export type LensStatus = 'not-assessed' | 'at-risk' | 'strained' | 'holds'

export interface LensResult {
  lens: ModuleLens
  score: number | null
  status: LensStatus
  /** The weakest answered indicator in this lens - the thing to fix first. */
  weakest: ModuleIndicator | null
  answered: number
}

export function evaluateLens(m: FoundationModule, lens: ModuleLens, scores: Record<string, number>): LensResult {
  const score = meanOf(lens.indicatorIds, scores)
  const inds = lens.indicatorIds
    .map(id => m.indicators.find(i => i.id === id))
    .filter((i): i is ModuleIndicator => !!i)
  const answeredInds = inds.filter(i => scores[i.id] != null)
  const weakest = answeredInds.length
    ? answeredInds.reduce((a, b) => (scores[b.id] < scores[a.id] ? b : a))
    : null
  // Any single indicator at 0-1 inside a lens is a point of failure for that
  // scenario, regardless of how strong the others are.
  const hasCollapse = answeredInds.some(i => scores[i.id] <= 1)
  const status: LensStatus =
    score == null ? 'not-assessed'
      : score < 2 || hasCollapse ? 'at-risk'
        : score < 3.5 ? 'strained'
          : 'holds'
  return { lens, score, status, weakest, answered: answeredInds.length }
}

/** Answered indicators below "Defined" (3), weakest first - the priority action list. */
export function priorityGaps(m: FoundationModule, scores: Record<string, number>): ModuleIndicator[] {
  return m.indicators
    .filter(i => scores[i.id] != null && scores[i.id] < 3)
    .sort((a, b) => scores[a.id] - scores[b.id])
}

/** Answered indicators at "Managed" (4) or above. */
export function strengths(m: FoundationModule, scores: Record<string, number>): ModuleIndicator[] {
  return m.indicators
    .filter(i => scores[i.id] != null && scores[i.id] >= 4)
    .sort((a, b) => scores[b.id] - scores[a.id])
}
