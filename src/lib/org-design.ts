// Organisational Design & Diagnosis (CRAFT-OD): identifies an organisation's structural
// configuration, culture and functional interfaces, evaluates its design with Goold and Campbell's
// nine tests, and drives the Organisational Analysis report. Shared by the UI, the API and the
// report renderer, so the form, validation, scoring and report cannot drift apart.
// Self-check: `node src/lib/org-design.test.ts`.
//
// Sources: H. Mintzberg, The Structuring of Organizations (1979) and Structure in Fives (1983);
// C. Handy, Understanding Organizations / Gods of Management; T. Deal & A. Kennedy, Corporate
// Cultures (1982); G. Morgan, Images of Organization (1986); M. Goold & A. Campbell, Designing
// Effective Organizations (2002) and "Do you have a well-designed organization?" (HBR, 2002);
// N. Slack et al., Operations Management (performance objectives); Hersey-Blanchard situational
// leadership; Vroom-Yetton decision styles. The report chapter structure follows the
// organisational-analysis format used in MBA programmes (introduction, planning, structure and
// culture, functional units and interface relations, critical skills, legal environment).

export const ORG_DESIGN_VERSION = 'CRAFT-OD 1.0 (2026-10-14)'

// --- Field model ------------------------------------------------------------------------------
export type FieldType = 'text' | 'textarea' | 'scale' | 'select' | 'rows'
export interface Field {
  key: string
  label: string
  type: FieldType
  help?: string
  min?: number // scale
  max?: number
  minLabel?: string
  maxLabel?: string
  options?: { value: string; label: string }[] // select
  columns?: { key: string; label: string }[] // rows
}
export interface Section {
  id: string
  title: string
  chapter: string // report chapter it feeds
  intro: string
  suggestedWords?: [number, number]
  optional?: boolean
  fields: Field[]
}

const o = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }))
const agree = (key: string, label: string): Field => ({ key, label, type: 'scale', min: 1, max: 5, minLabel: 'Not at all', maxLabel: 'Fully true' })
const scale5 = (key: string, label: string, minLabel: string, maxLabel: string, help?: string): Field => ({ key, label, type: 'scale', min: 1, max: 5, minLabel, maxLabel, help })
const ta = (key: string, label: string, help?: string): Field => ({ key, label, type: 'textarea', help })

// --- Mintzberg ------------------------------------------------------------------------------
export interface Configuration { id: string; label: string; coordination: string; keyPart: string; decentralisation: string; fitsWhen: string }
export const CONFIGURATIONS: Configuration[] = [
  { id: 'simple', label: 'Simple structure (entrepreneurial)', coordination: 'Direct supervision', keyPart: 'Strategic apex', decentralisation: 'Vertical and horizontal centralisation', fitsWhen: 'Small or young organisations in simple but dynamic environments' },
  { id: 'machine', label: 'Machine bureaucracy', coordination: 'Standardisation of work processes', keyPart: 'Technostructure', decentralisation: 'Limited horizontal decentralisation', fitsWhen: 'Large, mature organisations doing routine work in stable, simple environments' },
  { id: 'professional', label: 'Professional bureaucracy', coordination: 'Standardisation of skills', keyPart: 'Operating core', decentralisation: 'Vertical and horizontal decentralisation', fitsWhen: 'Expert work in complex but stable environments (hospitals, universities, audit firms, public health institutes)' },
  { id: 'divisional', label: 'Divisionalised form', coordination: 'Standardisation of outputs', keyPart: 'Middle line', decentralisation: 'Limited vertical decentralisation', fitsWhen: 'Diversified markets, products or regions run as semi-autonomous units' },
  { id: 'adhocracy', label: 'Adhocracy (innovative)', coordination: 'Mutual adjustment', keyPart: 'Support staff (with the operating core)', decentralisation: 'Selective decentralisation', fitsWhen: 'Complex, dynamic environments that demand innovation and project work' },
  { id: 'missionary', label: 'Missionary organisation', coordination: 'Standardisation of norms', keyPart: 'Ideology', decentralisation: 'Decentralisation through shared values', fitsWhen: 'Organisations held together by a strong mission (many NGOs, faith-based and movement organisations)' },
  { id: 'political', label: 'Political organisation', coordination: 'None dominant', keyPart: 'None dominant', decentralisation: 'Varies; power is contested', fitsWhen: 'Transitions or conflict, when no coordinating mechanism dominates' },
]
const CONFIG_ITEMS: [string, string, string][] = [
  ['simple', 'cfg_s1', 'The chief executive or founder personally makes most important decisions.'],
  ['simple', 'cfg_s2', 'There are few formal rules, procedures or staff specialists.'],
  ['simple', 'cfg_s3', 'Most staff report directly or almost directly to the top.'],
  ['machine', 'cfg_m1', 'Work is governed by detailed written procedures and standard operating procedures.'],
  ['machine', 'cfg_m2', 'Planning, budgeting, quality and HR specialists design how others work.'],
  ['machine', 'cfg_m3', 'Jobs are narrow and repetitive, and departments are grouped by function.'],
  ['professional', 'cfg_p1', 'Core work is done by trained professionals who control how they do it.'],
  ['professional', 'cfg_p2', 'Coordination relies on professional standards, licensing and training rather than supervision.'],
  ['professional', 'cfg_p3', 'Professionals have a strong say in decisions about their own work and resources.'],
  ['divisional', 'cfg_d1', 'The organisation runs semi-autonomous divisions or units by product, market or region.'],
  ['divisional', 'cfg_d2', 'Headquarters controls units mainly through targets and performance results.'],
  ['divisional', 'cfg_d3', 'Each unit has its own support functions and a manager accountable for results.'],
  ['adhocracy', 'cfg_a1', 'Much work is organised in multidisciplinary project teams that form and disband.'],
  ['adhocracy', 'cfg_a2', 'People coordinate mainly through informal communication and mutual adjustment.'],
  ['adhocracy', 'cfg_a3', 'Innovation and new solutions are central to what the organisation delivers.'],
  ['missionary', 'cfg_i1', 'A strong shared mission and values guide behaviour more than rules or supervision.'],
  ['missionary', 'cfg_i2', 'New staff are deliberately socialised into the organisation’s ideology.'],
  ['political', 'cfg_l1', 'Decisions are often shaped by power struggles between groups rather than by agreed processes.'],
  ['political', 'cfg_l2', 'No single way of coordinating work dominates; it depends on who is involved.'],
]
export const DESIGN_PARAMETERS: { id: string; label: string; help: string }[] = [
  { id: 'specialisation', label: 'Job specialisation', help: 'How narrowly jobs are defined, horizontally and vertically.' },
  { id: 'formalisation', label: 'Behaviour formalisation', help: 'Rules, job descriptions and procedures that standardise behaviour.' },
  { id: 'training', label: 'Training', help: 'Use of formal training to standardise skills and knowledge.' },
  { id: 'indoctrination', label: 'Indoctrination', help: 'Socialisation into the organisation’s norms and values.' },
  { id: 'grouping', label: 'Unit grouping', help: 'Grouping by function (knowledge, process) or by market (product, client, place).' },
  { id: 'unit_size', label: 'Unit size (span of control)', help: 'Number of people reporting to one manager.' },
  { id: 'planning_control', label: 'Planning and control systems', help: 'Action planning and performance control systems.' },
  { id: 'liaison', label: 'Liaison devices', help: 'Liaison roles, task forces, committees, integrating managers, matrix.' },
  { id: 'decentralisation', label: 'Vertical and horizontal decentralisation', help: 'How far decision power is delegated down the line and to staff and experts.' },
]
export const COORDINATING_MECHANISMS = o([
  ['mutual_adjustment', 'Mutual adjustment'], ['direct_supervision', 'Direct supervision'], ['work_processes', 'Standardisation of work processes'],
  ['outputs', 'Standardisation of outputs'], ['skills', 'Standardisation of skills'], ['norms', 'Standardisation of norms'],
])

// --- Culture ------------------------------------------------------------------------------
export const HANDY = o([['power', 'Power culture (Zeus)'], ['role', 'Role culture (Apollo)'], ['task', 'Task culture (Athena)'], ['person', 'Person culture (Dionysus)']])
const HANDY_ITEMS: [string, string, string][] = [
  ['power', 'hd_p1', 'Influence radiates from one central person or small group.'],
  ['power', 'hd_p2', 'Decisions are fast and depend on the judgement of those at the centre.'],
  ['power', 'hd_p3', 'Success depends on being trusted by the people in power.'],
  ['role', 'hd_r1', 'Work is defined by roles, rules and procedures rather than by who does it.'],
  ['role', 'hd_r2', 'Position and job title determine authority.'],
  ['role', 'hd_r3', 'Stability and predictability are valued over speed.'],
  ['task', 'hd_t1', 'Teams form around tasks and expertise matters more than position.'],
  ['task', 'hd_t2', 'Results and problem-solving are valued above procedure.'],
  ['task', 'hd_t3', 'Resources are allocated to the projects that need them, wherever they sit.'],
  ['person', 'hd_n1', 'The organisation exists mainly to serve the individuals in it (e.g. partners, experts).'],
  ['person', 'hd_n2', 'Individuals have considerable freedom and are hard to direct.'],
  ['person', 'hd_n3', 'Loyalty is to one’s profession or own work more than to the organisation.'],
]
export const DEAL_KENNEDY = o([['tough_guy', 'Tough-guy / macho culture'], ['work_hard', 'Work-hard / play-hard culture'], ['bet_company', 'Bet-your-company culture'], ['process', 'Process culture']])
export const METAPHORS = o([
  ['machine', 'Machine'], ['organism', 'Organism'], ['brain', 'Brain'], ['culture', 'Culture'],
  ['political', 'Political system'], ['psychic_prison', 'Psychic prison'], ['flux', 'Flux and transformation'], ['domination', 'Instrument of domination'],
])
const STRENGTH_ITEMS: [string, string][] = [
  ['st_1', 'Most staff can describe the organisation’s core values in similar words.'],
  ['st_2', 'Behaviour is consistent with the stated values, including under pressure.'],
  ['st_3', 'Stories, heroes, rituals and ceremonies reinforce what matters.'],
  ['st_4', 'New staff quickly learn “how things are done here”.'],
]

// --- Goold & Campbell nine tests -----------------------------------------------------------
export interface DesignTest { id: string; group: 'fit' | 'good_design'; name: string; question: string; prompts: string[] }
export const NINE_TESTS: DesignTest[] = [
  { id: 'market', group: 'fit', name: 'Market advantage test', question: 'Does the design direct enough management attention to the sources of advantage in each market or, for public bodies, to the results the mandate requires?', prompts: ['What are the critical success factors for each product-market or service area?', 'Is each one owned by a unit with the attention, authority and capability to deliver it?', 'Are any operating priorities orphaned or split across units?'] },
  { id: 'parenting', group: 'fit', name: 'Parenting advantage test', question: 'Does the design help the corporate centre (headquarters, ministry or board) add value to the units below it?', prompts: ['What value does the centre add (policy, shared services, capital, standards, assurance)?', 'Are the centre’s roles and units designed to deliver that value?', 'Does the centre destroy value through delay, duplication or interference?'] },
  { id: 'people', group: 'fit', name: 'People test', question: 'Does the design reflect the strengths, weaknesses and motivations of the people available?', prompts: ['Are there people able and willing to fill each key role?', 'Does the design depend on skills the organisation does not have?', 'Will it motivate, or alienate, key staff?'] },
  { id: 'feasibility', group: 'fit', name: 'Feasibility test', question: 'Does the design take account of the constraints that may make it unworkable?', prompts: ['Legal, regulatory and governance constraints (statute, board, donor or funder conditions)', 'Stakeholder and political constraints', 'Information systems, culture and resources needed to make it work'] },
  { id: 'specialist_cultures', group: 'good_design', name: 'Specialist cultures test', question: 'Does the design protect units that need a culture different from the dominant one?', prompts: ['Which units need distinct skills, mindsets or ways of working (e.g. research, laboratory, innovation, audit)?', 'Are they shielded from dominant-culture pressures that would undermine them?'] },
  { id: 'difficult_links', group: 'good_design', name: 'Difficult links test', question: 'Does the design provide coordination solutions for links between units that are likely to be problematic?', prompts: ['Which unit-to-unit links matter most and are likely to fail by themselves?', 'Is there a coordination mechanism (shared target, liaison role, process, committee) for each?'] },
  { id: 'redundant_hierarchy', group: 'good_design', name: 'Redundant hierarchy test', question: 'Does every level and unit in the hierarchy add value?', prompts: ['What does each layer do that the layer above or below cannot?', 'Are there layers that only pass information or approvals through?'] },
  { id: 'accountability', group: 'good_design', name: 'Accountability test', question: 'Does the design support effective controls: is each unit accountable for clear, measurable results?', prompts: ['Does every unit have objectives and performance measures it can influence?', 'Can poor performance be seen and acted on quickly?'] },
  { id: 'flexibility', group: 'good_design', name: 'Flexibility test', question: 'Will the design help the organisation develop new strategies and adapt to change?', prompts: ['How easily can new initiatives be started or resources moved?', 'Is innovation owned somewhere, or does the design lock in today’s strategy?'] },
]
export const TEST_RESULTS = o([['pass', 'Pass'], ['concern', 'Concern'], ['fail', 'Fail'], ['not_assessed', 'Not assessed']])

// --- Functional units ----------------------------------------------------------------------
export const FUNCTIONAL_UNITS: { id: string; label: string; analysisHelp: string }[] = [
  { id: 'hr', label: 'Human resources', analysisHelp: 'Recruitment, selection and placement; induction of new staff; staff development policies; performance appraisal.' },
  { id: 'marketing', label: 'Marketing and strategy', analysisHelp: 'How the marketing (or outreach) mix is managed — product/service, price, place, promotion, people, process, physical evidence — and how strategy is set.' },
  { id: 'operations', label: 'Operations', analysisHelp: 'The input–process–output model applied to the organisation; contribution to the performance objectives of quality, speed, dependability, flexibility and cost.' },
  { id: 'ict', label: 'ICT and information management', analysisHelp: 'How ICT is used; its effect on employees; how information is collected and managed and with which tools.' },
  { id: 'finance', label: 'Finance and fiduciary control', analysisHelp: 'Budgeting, financial reporting, internal control, procurement and treasury; how funds are accounted for to funders.' },
]

// --- Sections ------------------------------------------------------------------------------
export const SECTIONS: Section[] = [
  { id: 'intro', title: 'Introduction', chapter: '1', suggestedWords: [450, 650], intro: 'Your role, and the nature, size, history and services of the organisation.', fields: [
    { key: 'role', label: 'Your role / function', type: 'text' },
    { key: 'sector', label: 'Sector', type: 'select', options: o([['government', 'Government ministry, department or agency'], ['nphi', 'National public health institute'], ['soe', 'State-owned enterprise / parastatal'], ['dfi', 'Development finance institution'], ['ngo', 'NGO / civil society'], ['private', 'Private company'], ['listed', 'Listed company'], ['academic', 'University / research institute'], ['other', 'Other']]) },
    { key: 'size', label: 'Size (staff)', type: 'select', options: o([['micro', 'Under 10'], ['small', '10–49'], ['medium', '50–249'], ['large', '250–999'], ['very_large', '1,000 or more']]) },
    ta('nature', 'Nature and history of the organisation'),
    ta('offerings', 'Products, services or mandate'),
    ta('unitDefinition', 'How the organisation defines a “functional unit” or department'),
  ] },
  { id: 'planning', title: 'Planning the analysis', chapter: '2', suggestedWords: [450, 650], intro: 'Who and what you will consult, when, the difficulties you expect and how you dealt with what happened.', fields: [
    ta('sources', 'Sources and people to consult for data collection'),
    { key: 'timeline', label: 'Timeline', type: 'rows', columns: [{ key: 'activity', label: 'Activity (reading, interviews, writing…)' }, { key: 'start', label: 'Start' }, { key: 'end', label: 'End' }, { key: 'status', label: 'Status' }] },
    ta('difficulties', 'Expected difficulties in collecting data'),
    ta('mitigation', 'How you plan to overcome them'),
    ta('execution', 'How the plan was executed: unexpected problems and how you handled them'),
  ] },
  { id: 'environment', title: 'Environment', chapter: '3', intro: 'Mintzberg’s contingency factors: the environment the structure must fit.', fields: [
    scale5('stability', 'Environmental dynamism', 'Stable, predictable', 'Dynamic, fast-changing'),
    scale5('complexity', 'Environmental complexity', 'Simple, easy to understand', 'Complex, needs expert knowledge'),
    scale5('diversity', 'Market diversity', 'One market or service', 'Many distinct markets, products or regions'),
    scale5('hostility', 'Hostility', 'Benign', 'Hostile (crisis, intense competition or scrutiny)'),
    ta('factors', 'Environmental factors (political, economic, social, technological, legal, environmental) that shape the organisation and its culture'),
  ] },
  { id: 'structure', title: 'Organisational structure', chapter: '3', suggestedWords: [1750, 2250], intro: 'Rate each statement for your organisation. The results identify the dominant Mintzberg configuration.', fields: [
    ta('definitionView', 'Mintzberg defines structure as the ways labour is divided into distinct tasks and then coordinated. What do you think of this definition?'),
    ...CONFIG_ITEMS.map(([, key, label]) => agree(key, label)),
    { key: 'coordination', label: 'Prime coordinating mechanism in practice', type: 'select', options: COORDINATING_MECHANISMS },
    ...DESIGN_PARAMETERS.flatMap((p): Field[] => [scale5(`dp_${p.id}`, `${p.label}: how strongly is it used?`, 'Little', 'Heavily', p.help), { key: `dp_${p.id}_note`, label: `${p.label}: why is it used, and is it efficient?`, type: 'textarea' }]),
    ta('effectiveness', 'Is the structure efficient and effective for the organisation’s objectives? Explain.'),
  ] },
  { id: 'culture', title: 'Organisational culture', chapter: '3', suggestedWords: [1750, 2250], intro: 'Culture strength, Handy’s four cultures, Deal and Kennedy’s risk/feedback model and Morgan’s metaphors.', fields: [
    ...STRENGTH_ITEMS.map(([key, label]) => agree(key, label)),
    ta('shouldBeStrong', 'Should the organisation have a strong culture? Why?'),
    ...HANDY_ITEMS.map(([, key, label]) => agree(key, label)),
    { key: 'handyPreferred', label: 'Which Handy culture should be preferred?', type: 'select', options: HANDY },
    scale5('dkRisk', 'Degree of risk in key decisions', 'Low risk', 'High risk (big, irreversible bets)'),
    scale5('dkFeedback', 'Speed of feedback on whether decisions were right', 'Slow (years)', 'Fast (days or weeks)'),
    { key: 'dkPreferred', label: 'Which Deal and Kennedy culture should be preferred?', type: 'select', options: DEAL_KENNEDY },
    { key: 'metaphor', label: 'Metaphor that best describes the organisation', type: 'select', options: METAPHORS },
    ta('metaphorNotes', 'Why this metaphor? Is there a more fitting one?'),
    ta('managementGrip', 'Can management come to grips with the environmental factors shaping the culture?'),
  ] },
  { id: 'functions', title: 'Functional units and interface relations', chapter: '4', suggestedWords: [4500, 5500], intro: 'For each function: analyse it, analyse how your unit works with it, and recommend improvements.', fields: FUNCTIONAL_UNITS.flatMap((u): Field[] => [
    ta(`${u.id}_analysis`, `${u.label}: how the function is structured and works`, u.analysisHelp),
    ta(`${u.id}_interface`, `${u.label}: how your unit interacts with it`),
    scale5(`${u.id}_effectiveness`, `${u.label}: effectiveness of the interface`, 'Poor', 'Excellent'),
    scale5(`${u.id}_efficiency`, `${u.label}: efficiency of the interface`, 'Poor', 'Excellent'),
    ta(`${u.id}_problems`, `${u.label}: problem areas`),
    ta(`${u.id}_recommendations`, `${u.label}: recommendations to improve the interface`),
  ]) },
  { id: 'skills', title: 'Critical management skills (individual)', chapter: '5', optional: true, suggestedWords: [3500, 4500], intro: 'Optional, for an individual analyst: leadership, decision-making and team behaviour.', fields: [
    scale5('theoryXY', 'Your view of employee motivation', 'Theory X', 'Theory Y'),
    { key: 'leadershipStyle', label: 'Preferred situational leadership style', type: 'select', options: o([['s1', 'S1 Directing'], ['s2', 'S2 Coaching'], ['s3', 'S3 Supporting'], ['s4', 'S4 Delegating']]) },
    scale5('styleFlexibility', 'Style flexibility', 'One style for everyone', 'Adapts to each person and situation'),
    ta('leadershipEvaluation', 'Evaluation of your leadership style in different situations and over time'),
    ta('leadershipPlan', 'Plan to improve your leadership style, and progress so far'),
    { key: 'decisionStyle', label: 'Usual way of involving others in decisions', type: 'select', options: o([['AI', 'AI — decide alone'], ['AII', 'AII — get information, decide alone'], ['CI', 'CI — consult individually'], ['CII', 'CII — consult as a group'], ['GII', 'GII — group decides by consensus']]) },
    ta('decisionPlan', 'Plan to improve the effectiveness and efficiency of your decision-making, and results so far'),
    ta('teamPlan', 'Action plan to improve your behaviour in and towards your team'),
    ta('participation', 'How far team members are encouraged to participate in decisions'),
    ta('acceptance', 'How far team members accept the implementation of decisions'),
  ] },
  { id: 'legal', title: 'Business legal environment', chapter: '6', suggestedWords: [1500, 2000], intro: 'Terms of agreement, consumer protection, legal identity and employment law.', fields: [
    { key: 'gta', label: 'General terms of agreement (GTA)', type: 'select', options: o([['written', 'Written GTA'], ['tacit', 'Tacit / unwritten only'], ['none', 'None']]) },
    ta('gtaPositives', 'Positive elements of the GTA'),
    ta('gtaImprovements', 'Elements to improve, or the risks of having no GTA'),
    ta('consumerProtection', 'Consumer protection in your country (consumer protection, consumer rights and unfair contract terms laws) and what you would improve'),
    { key: 'legalIdentity', label: 'Legal identity of the organisation', type: 'select', options: o([['private_ltd', 'Private limited company'], ['public_ltd', 'Public limited company'], ['guarantee', 'Company limited by guarantee'], ['association', 'Association / registered NGO / trust'], ['cooperative', 'Cooperative'], ['statutory', 'Statutory body / parastatal'], ['government', 'Government ministry, department or agency'], ['partnership', 'Partnership'], ['sole', 'Sole proprietorship'], ['other', 'Other']]) },
    ta('legalAlternatives', 'Alternative legal forms, their pros and cons, and whether the current form is the best choice'),
    ta('employmentLaw', 'Employment and anti-discrimination law and practice in your country and organisation, benchmarked against another jurisdiction'),
    ta('employmentPolicies', 'Policies you would put in place and their effect on the organisation'),
  ] },
  { id: 'tests', title: 'Design evaluation: the nine tests', chapter: '7', intro: 'Goold and Campbell’s four fit tests and five good-design tests. Record a result, the reasoning and any action.', fields: NINE_TESTS.flatMap((t): Field[] => [
    { key: `t_${t.id}`, label: `${t.name}: ${t.question}`, type: 'select', options: TEST_RESULTS, help: t.prompts.join(' · ') },
    ta(`t_${t.id}_rationale`, `${t.name}: evidence and reasoning`),
    ta(`t_${t.id}_action`, `${t.name}: design change or action`),
  ]) },
]
export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id) ?? null

// --- Report review rubric -------------------------------------------------------------------
// Self-review of the written analysis before submission, modelled on MBA organisational-analysis
// marking: each criterion scored 1–10, weighted, grouped by learning outcome; pass mark 55/100.
export const LEARNING_OUTCOMES: Record<string, string> = {
  '4': 'Entrepreneurship', '5': 'Leadership', '8': 'Cooperation', '9': 'Communication', '10': 'Analysis and problem solving', '11': 'Learning and personal development',
}
export const RUBRIC: { id: string; chapter: string; outcome: string; weight: number; criterion: string }[] = [
  { id: '1a', chapter: '1', outcome: '9', weight: 2, criterion: 'Clear account of the analyst’s role and the organisation’s nature, size, history and services' },
  { id: '2a', chapter: '2', outcome: '11', weight: 2, criterion: 'Clear timeline for reading, interviews and writing' },
  { id: '2e', chapter: '2', outcome: '9', weight: 2, criterion: 'Sources and people for data collection identified' },
  { id: '2c', chapter: '2', outcome: '10', weight: 1, criterion: 'Data-collection difficulties identified' },
  { id: '2b', chapter: '2', outcome: '11', weight: 2, criterion: 'Plan to overcome the difficulties' },
  { id: '3d', chapter: '3', outcome: '10', weight: 2, criterion: 'Argued choice of Mintzberg configuration' },
  { id: '3e', chapter: '3', outcome: '10', weight: 2, criterion: 'Design parameters explained and their efficiency analysed' },
  { id: '3c', chapter: '3', outcome: '11', weight: 4, criterion: 'Substantiated view on how well the structure suits the objectives' },
  { id: '3f', chapter: '3', outcome: '10', weight: 2, criterion: 'Environmental factors shaping the culture described' },
  { id: '3g', chapter: '3', outcome: '10', weight: 2, criterion: 'Culture correctly described with Deal and Kennedy' },
  { id: '3m', chapter: '3', outcome: '9', weight: 2, criterion: 'Culture described with metaphors' },
  { id: '3k', chapter: '3', outcome: '11', weight: 4, criterion: 'Meaningful evaluation of the culture' },
  { id: '4b', chapter: '4', outcome: '9', weight: 5, criterion: 'Functions described in sufficient depth' },
  { id: '4h', chapter: '4', outcome: '4', weight: 5, criterion: 'Critical analysis of human resources' },
  { id: '4m', chapter: '4', outcome: '4', weight: 5, criterion: 'Critical analysis of marketing and strategy' },
  { id: '4o', chapter: '4', outcome: '10', weight: 5, criterion: 'Critical analysis of operations' },
  { id: '4i', chapter: '4', outcome: '10', weight: 5, criterion: 'Critical analysis of ICT' },
  { id: '4c', chapter: '4', outcome: '9', weight: 5, criterion: 'Interface relations described soundly' },
  { id: '4d', chapter: '4', outcome: '5', weight: 5, criterion: 'Recommendations to improve the interface relations' },
  { id: '5a', chapter: '5', outcome: '5', weight: 4, criterion: 'Evaluation of leadership styles across situations and time' },
  { id: '5b', chapter: '5', outcome: '5', weight: 5, criterion: 'Plan to improve leadership style' },
  { id: '5c', chapter: '5', outcome: '5', weight: 3, criterion: 'Progress on the leadership plan' },
  { id: '5d', chapter: '5', outcome: '8', weight: 3, criterion: 'How others are involved in decisions' },
  { id: '5e', chapter: '5', outcome: '8', weight: 3, criterion: 'Plan to improve decision-making' },
  { id: '5f', chapter: '5', outcome: '8', weight: 3, criterion: 'Plan to improve team behaviour' },
  { id: '5g', chapter: '5', outcome: '8', weight: 3, criterion: 'Theory-based evaluation of participation in decisions' },
  { id: '5h', chapter: '5', outcome: '8', weight: 3, criterion: 'Theory-based evaluation of acceptance of decisions' },
  { id: '6a', chapter: '6', outcome: '4', weight: 3, criterion: 'Critical evaluation of the legal environment' },
  { id: '6b', chapter: '6', outcome: '4', weight: 3, criterion: 'Contract law and the GTA: strengths and improvements' },
  { id: '6c', chapter: '6', outcome: '4', weight: 3, criterion: 'Consumer protection evaluated' },
  { id: '6d', chapter: '6', outcome: '4', weight: 3, criterion: 'Legal identity analysed with alternatives' },
  { id: '6e', chapter: '6', outcome: '4', weight: 3, criterion: 'Employment and discrimination law applied to the organisation' },
]
export const RUBRIC_PASS = 55

// --- Validation -----------------------------------------------------------------------------
export type OrgData = Record<string, Record<string, unknown>>
const MAX_TEXT = 8000, MAX_ROWS = 50, MAX_CELL = 300

/** Validates one section's answers. Unknown keys are rejected; returns the cleaned values. */
export function cleanSection(sectionId: string, input: unknown): Record<string, unknown> {
  const s = sectionId === 'rubric' ? null : sectionById(sectionId)
  if (sectionId !== 'rubric' && !s) throw new Error(`unknown section ${sectionId}`)
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('section values must be an object')
  const fields: Field[] = s ? s.fields : RUBRIC.map((r) => ({ key: r.id, label: r.criterion, type: 'scale', min: 1, max: 10 }))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const f = fields.find((x) => x.key === k)
    if (!f) throw new Error(`unknown field ${sectionId}.${k}`)
    if (v === null || v === '') { out[k] = null; continue }
    if (f.type === 'text' || f.type === 'textarea') {
      if (typeof v !== 'string' || v.length > (f.type === 'text' ? 300 : MAX_TEXT)) throw new Error(`${k} invalid`)
      out[k] = v
    } else if (f.type === 'scale') {
      if (!Number.isInteger(v) || (v as number) < f.min! || (v as number) > f.max!) throw new Error(`${k} must be an integer ${f.min}-${f.max}`)
      out[k] = v
    } else if (f.type === 'select') {
      if (!f.options!.some((x) => x.value === v)) throw new Error(`${k} invalid option`)
      out[k] = v
    } else {
      if (!Array.isArray(v) || v.length > MAX_ROWS) throw new Error(`${k} must be a list of at most ${MAX_ROWS} rows`)
      out[k] = v.map((row) => {
        if (!row || typeof row !== 'object') throw new Error(`${k} rows must be objects`)
        return Object.fromEntries(f.columns!.map((c) => {
          const cell = (row as Record<string, unknown>)[c.key] ?? ''
          if (typeof cell !== 'string' || cell.length > MAX_CELL) throw new Error(`${k}.${c.key} invalid`)
          return [c.key, cell]
        }))
      })
    }
  }
  return out
}

// --- Diagnosis -------------------------------------------------------------------------------
const num = (v: unknown) => (typeof v === 'number' ? v : null)
const avg = (xs: (number | null)[]) => { const ys = xs.filter((x): x is number => x !== null); return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null }
const r1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10)
const isFilled = (v: unknown) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)

export interface Diagnosis {
  version: string
  configuration: { scores: { id: string; label: string; score: number | null }[]; dominant: string | null; hybridWith: string | null; expected: string | null; expectedReason: string; fit: 'fits' | 'mismatch' | 'unknown' }
  culture: { strength: number | null; strong: boolean | null; handy: { scores: { id: string; label: string; score: number | null }[]; dominant: string | null; preferred: string | null }; dealKennedy: { type: string | null; preferred: string | null }; metaphor: string | null }
  interfaces: { id: string; label: string; effectiveness: number | null; efficiency: number | null }[]
  tests: { fit: Record<string, number>; goodDesign: Record<string, number>; failing: string[]; concerns: string[]; verdict: string }
  completeness: { id: string; title: string; percent: number; optional: boolean }[]
  rubric: { byOutcome: { outcome: string; label: string; mark: number | null }[]; overall: number | null; pass: boolean | null }
  findings: string[]
}

const label = (opts: { value: string; label: string }[], v: unknown) => opts.find((x) => x.value === v)?.label ?? null

export function dealKennedyType(risk: number | null, feedback: number | null): string | null {
  if (risk === null || feedback === null) return null
  const highRisk = risk >= 3, fast = feedback >= 3
  return highRisk ? (fast ? 'tough_guy' : 'bet_company') : (fast ? 'work_hard' : 'process')
}

/** Mintzberg's contingency logic: the configuration the environment calls for. */
export function expectedConfiguration(env: Record<string, unknown>): { id: string | null; reason: string } {
  const dyn = num(env.stability), cx = num(env.complexity), div = num(env.diversity)
  if (dyn === null || cx === null) return { id: null, reason: 'Rate environmental dynamism and complexity to compare structure with environment.' }
  if (div !== null && div >= 4) return { id: 'divisional', reason: 'Diversified markets, products or regions favour the divisionalised form.' }
  if (dyn >= 3.5 && cx >= 3.5) return { id: 'adhocracy', reason: 'A complex, dynamic environment favours adhocracy (mutual adjustment, project teams).' }
  if (dyn >= 3.5) return { id: 'simple', reason: 'A simple but dynamic environment favours the simple structure (direct supervision, fast central decisions).' }
  if (cx >= 3.5) return { id: 'professional', reason: 'A complex but stable environment favours the professional bureaucracy (standardised skills).' }
  return { id: 'machine', reason: 'A simple, stable environment favours the machine bureaucracy (standardised work processes).' }
}

export function diagnose(data: OrgData): Diagnosis {
  const st = data.structure ?? {}, cu = data.culture ?? {}, env = data.environment ?? {}, fn = data.functions ?? {}, te = data.tests ?? {}, ru = data.rubric ?? {}
  const findings: string[] = []

  // Configuration
  const cfgScores = CONFIGURATIONS.map((c) => ({ id: c.id, label: c.label, score: r1(avg(CONFIG_ITEMS.filter(([id]) => id === c.id).map(([, k]) => num(st[k])))) }))
  const ranked = cfgScores.filter((x) => x.score !== null).sort((a, b) => b.score! - a.score!)
  const dominant = ranked[0]?.id ?? null
  const hybridWith = ranked[1] && ranked[0].score! - ranked[1].score! <= 0.5 ? ranked[1].id : null
  const exp = expectedConfiguration(env)
  const fit = !dominant || !exp.id ? 'unknown' : dominant === exp.id || hybridWith === exp.id ? 'fits' : 'mismatch'
  const cfgLabel = (id: string | null) => CONFIGURATIONS.find((c) => c.id === id)?.label ?? id
  if (dominant) findings.push(`The structure reads as a ${cfgLabel(dominant)}${hybridWith ? `, with strong features of a ${cfgLabel(hybridWith)} (hybrid)` : ''}.`)
  if (fit === 'mismatch') findings.push(`Structure–environment mismatch: the environment favours a ${cfgLabel(exp.id)}. ${exp.reason} Review whether the current design parameters still fit.`)
  if (num(env.hostility) !== null && num(env.hostility)! >= 4) findings.push('A hostile environment tends to pull decisions to the centre; check that temporary centralisation does not become permanent.')
  const primary = CONFIGURATIONS.find((c) => c.id === dominant)
  const coord = label(COORDINATING_MECHANISMS, st.coordination)
  if (primary && coord && coord !== primary.coordination && dominant !== 'political') findings.push(`The prime coordinating mechanism reported (${coord}) differs from the one typical of a ${primary.label} (${primary.coordination}); coordination may be inconsistent with the structure.`)

  // Culture
  const strength = r1(avg(STRENGTH_ITEMS.map(([k]) => num(cu[k]))))
  const handyScores = HANDY.map((h) => ({ id: h.value, label: h.label, score: r1(avg(HANDY_ITEMS.filter(([id]) => id === h.value).map(([, k]) => num(cu[k])))) }))
  const handyDominant = handyScores.filter((x) => x.score !== null).sort((a, b) => b.score! - a.score!)[0]?.id ?? null
  const handyPreferred = typeof cu.handyPreferred === 'string' ? cu.handyPreferred : null
  const dk = dealKennedyType(num(cu.dkRisk), num(cu.dkFeedback))
  const dkPreferred = typeof cu.dkPreferred === 'string' ? cu.dkPreferred : null
  if (strength !== null) findings.push(`Culture strength ${strength}/5 (${strength >= 3.5 ? 'strong' : strength >= 2.5 ? 'moderate' : 'weak'}).`)
  if (handyDominant && handyPreferred && handyDominant !== handyPreferred) findings.push(`Culture gap: the current Handy culture is ${label(HANDY, handyDominant)}, but ${label(HANDY, handyPreferred)} is preferred. Plan the change through structure, rewards, leadership behaviour and recruitment.`)
  if (dk && dkPreferred && dk !== dkPreferred) findings.push(`The risk and feedback profile gives a ${label(DEAL_KENNEDY, dk)}, while a ${label(DEAL_KENNEDY, dkPreferred)} is preferred.`)
  if (handyDominant === 'role' && (dominant === 'adhocracy' || exp.id === 'adhocracy')) findings.push('A role culture sits uneasily with the innovative, project-based work an adhocracy needs.')
  if (handyDominant === 'power' && (dominant === 'professional' || dominant === 'divisional')) findings.push('A power culture can undermine the delegated authority that professional and divisional structures depend on.')

  // Interfaces
  const interfaces = FUNCTIONAL_UNITS.map((u) => ({ id: u.id, label: u.label, effectiveness: num(fn[`${u.id}_effectiveness`]), efficiency: num(fn[`${u.id}_efficiency`]) }))
  for (const i of interfaces) if ((i.effectiveness ?? 5) <= 2 || (i.efficiency ?? 5) <= 2) findings.push(`Weak interface with ${i.label.toLowerCase()} (effectiveness ${i.effectiveness ?? '–'}/5, efficiency ${i.efficiency ?? '–'}/5): see the recommendations recorded for it.`)

  // Nine tests
  const tally = (group: DesignTest['group']) => {
    const t: Record<string, number> = { pass: 0, concern: 0, fail: 0, not_assessed: 0 }
    for (const x of NINE_TESTS.filter((n) => n.group === group)) t[(te[`t_${x.id}`] as string) ?? 'not_assessed']++
    return t
  }
  const failing = NINE_TESTS.filter((t) => te[`t_${t.id}`] === 'fail').map((t) => t.name)
  const concerns = NINE_TESTS.filter((t) => te[`t_${t.id}`] === 'concern').map((t) => t.name)
  const assessed = NINE_TESTS.filter((t) => te[`t_${t.id}`] && te[`t_${t.id}`] !== 'not_assessed').length
  const fitFails = NINE_TESTS.filter((t) => t.group === 'fit' && te[`t_${t.id}`] === 'fail').length
  const verdict = assessed === 0 ? 'Not yet evaluated.'
    : fitFails ? 'Redesign needed: the design fails at least one fit test, so it does not yet fit the strategy, people or constraints.'
    : failing.length ? 'Refine the design: it fits, but fails one or more good-design tests.'
    : concerns.length ? 'Sound with concerns: address the flagged tests in the action plan.'
    : assessed < NINE_TESTS.length ? `Passing so far: ${assessed} of 9 tests assessed.` : 'Well designed: passes all nine tests.'
  for (const t of NINE_TESTS) {
    const r = te[`t_${t.id}`]
    if ((r === 'fail' || r === 'concern') && !isFilled(te[`t_${t.id}_action`])) findings.push(`${t.name} is marked ${r} but has no design change or action recorded.`)
  }

  // Completeness
  const completeness = SECTIONS.map((s) => {
    const vals = data[s.id] ?? {}
    return { id: s.id, title: s.title, optional: !!s.optional, percent: Math.round((s.fields.filter((f) => isFilled(vals[f.key])).length / s.fields.length) * 100) }
  })

  // Rubric
  const byOutcome = Object.entries(LEARNING_OUTCOMES).map(([outcome, lbl]) => {
    const rows = RUBRIC.filter((r) => r.outcome === outcome)
    const scored = rows.filter((r) => num(ru[r.id]) !== null)
    const mark = scored.length === rows.length ? Math.round((rows.reduce((a, r) => a + num(ru[r.id])! * r.weight, 0) / rows.reduce((a, r) => a + r.weight, 0)) * 10) : null
    return { outcome, label: lbl, mark }
  })
  const overall = byOutcome.every((x) => x.mark !== null) ? Math.round(byOutcome.reduce((a, x) => a + x.mark!, 0) / byOutcome.length) : null

  return {
    version: ORG_DESIGN_VERSION,
    configuration: { scores: cfgScores, dominant, hybridWith, expected: exp.id, expectedReason: exp.reason, fit },
    culture: { strength, strong: strength === null ? null : strength >= 3.5, handy: { scores: handyScores, dominant: handyDominant, preferred: handyPreferred }, dealKennedy: { type: dk, preferred: dkPreferred }, metaphor: typeof cu.metaphor === 'string' ? cu.metaphor : null },
    interfaces,
    tests: { fit: tally('fit'), goodDesign: tally('good_design'), failing, concerns, verdict },
    completeness,
    rubric: { byOutcome, overall, pass: overall === null ? null : overall >= RUBRIC_PASS },
    findings,
  }
}

export const optionLabel = label

/** What must be in place before a review can be finalised (frozen and approved). */
export function finaliseGaps(data: OrgData): string[] {
  const gaps: string[] = []
  for (const id of ['intro', 'planning', 'functions', 'legal']) {
    const s = sectionById(id)!
    const pct = Math.round((s.fields.filter((f) => isFilled(data[id]?.[f.key])).length / s.fields.length) * 100)
    if (pct < 50) gaps.push(`${s.title} is ${pct}% complete (needs 50%)`)
  }
  const unrated = (section: string, keys: string[]) => keys.filter((k) => num(data[section]?.[k]) === null).length
  const cfgMissing = unrated('structure', CONFIG_ITEMS.map(([, k]) => k))
  if (cfgMissing) gaps.push(`${cfgMissing} structure statement(s) not rated`)
  const cultureMissing = unrated('culture', [...STRENGTH_ITEMS.map(([k]) => k), ...HANDY_ITEMS.map(([, k]) => k), 'dkRisk', 'dkFeedback'])
  if (cultureMissing) gaps.push(`${cultureMissing} culture rating(s) missing`)
  for (const t of NINE_TESTS) if (!data.tests?.[`t_${t.id}`] || data.tests[`t_${t.id}`] === 'not_assessed') gaps.push(`${t.name} not assessed`)
  return gaps
}
