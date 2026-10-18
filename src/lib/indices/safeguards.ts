// CRAFT Environmental & Social Safeguards Index · v1 (102026) · specialist validation
// Original CRAFT indicators. Draws on multilateral safeguard systems and sustainability disclosure
// frameworks (cited in the crosswalk); no third-party text or scoring is reproduced.
import type { EsCategory, EsFlag, FoundationModule } from '../foundationModules.ts'
import { id, indicator, V1, V1_BANDS } from './shared.ts'

const C = 'ESS'
const i = (...a: Parameters<typeof indicator> extends [string, ...infer R] ? R : never) => indicator(C, ...a)
const ALL = { esCategories: ['low', 'moderate', 'high'] as EsCategory[] }
const MOD = { esCategories: ['moderate', 'high'] as EsCategory[] }
const FLAG = (esFlag: EsFlag) => ({ esFlag })

/** Answers to the seven screening questions. */
export type EsScreeningAnswers = {
  physicalWorks: boolean
  largeWorkforce: boolean
  sensitiveLocation: boolean
  acquiresLand: boolean
  nearProtectedArea: boolean
  nearHeritage: boolean
  lendsOrInvests: boolean
}

/** The seven screening questions, in order, as organisations see them. */
export const SCREENING_QUESTIONS: Array<[keyof EsScreeningAnswers, string]> = [
  ['physicalWorks', 'We build, renovate or operate physical sites'],
  ['largeWorkforce', 'We employ or contract more than 50 people'],
  ['sensitiveLocation', 'We work in a sensitive location (conflict, flood-prone areas, informal settlements)'],
  ['acquiresLand', "We acquire land or restrict people's access to it"],
  ['nearProtectedArea', 'We work in or near protected or high-biodiversity areas'],
  ['nearHeritage', 'We work near cultural heritage sites'],
  ['lendsOrInvests', 'We lend to or invest in other organisations'],
]
export const CATEGORY_LABEL = { low: 'Low risk', moderate: 'Moderate risk', high: 'High risk' } as const

/** CRAFT's own risk categorisation: decides which safeguard areas apply and how much evidence they need. */
export function esScreening(a: EsScreeningAnswers): { category: EsCategory; flags: EsFlag[] } {
  const category: EsCategory = a.physicalWorks && (a.sensitiveLocation || a.acquiresLand) ? 'high'
    : a.physicalWorks || a.largeWorkforce ? 'moderate'
      : 'low'
  const flags: EsFlag[] = []
  if (a.acquiresLand) flags.push('land')
  if (a.nearProtectedArea) flags.push('biodiversity')
  if (a.nearHeritage) flags.push('heritage')
  if (a.lendsOrInvests) flags.push('intermediary')
  return { category, flags }
}

export const SAFEGUARDS: FoundationModule = {
  id: 'craft-safeguards',
  no: '17',
  version: V1,
  specialist: 'safeguards',
  title: 'Environmental & Social Safeguards Index',
  question: 'Does the institution avoid harm to people and the environment, and put it right when harm happens?',
  intro:
    'Up to twenty-five indicators across ten safeguard areas. A short screening decides which areas apply and how much evidence is needed, so a small, low-risk organisation is not asked for what a large infrastructure operator must show. Validating this index needs a specialist-accredited validator.',
  lensTitle: 'Safeguard lenses',
  lensBlurb: 'Three views across the areas: whether a working system exists, whether the people affected are protected, and whether they can be heard.',
  dimensions: [
    { key: 'esms', name: 'E&S Risk Management System', question: 'Is there a working system to find and manage environmental, social and climate risks?' },
    { key: 'labour', name: 'Labour & Working Conditions', question: 'Are workers, including contractors, treated fairly and safely?' },
    { key: 'resources', name: 'Resource Efficiency & Pollution', question: 'Are resources used efficiently and pollution prevented?' },
    { key: 'community', name: 'Community Health, Safety & Security', question: 'Are communities protected from harm, including gender-based violence and harassment?' },
    { key: 'land', name: 'Land & Resettlement', question: 'Is displacement avoided, and are livelihoods restored where it cannot be?' },
    { key: 'biodiversity', name: 'Biodiversity & Habitats', question: 'Are habitats and natural resources protected?' },
    { key: 'vulnerable', name: 'Vulnerable Groups', question: 'Are vulnerable people identified, protected and able to benefit?' },
    { key: 'heritage', name: 'Cultural Heritage', question: 'Is cultural heritage identified and protected?' },
    { key: 'intermediary', name: 'Financial Intermediary E&S Systems', question: 'For lenders and investors: are safeguards applied to what they finance?' },
    { key: 'stakeholders', name: 'Stakeholder Engagement & Grievance Redress', question: 'Are affected people informed, consulted and able to complain and get a response?' },
  ],
  indicators: [
    i(1, 'esms', 'E&S Policy', 'Is there an environmental and social policy approved by leadership?', [
      'No environmental or social policy.',
      'Commitments exist only in funding proposals.',
      'A draft policy exists but is not approved or known.',
      'An approved environmental and social policy sets the institution\'s commitments and responsibilities.',
      'The policy is communicated to staff and contractors and applied in operations.',
      'The policy is reviewed every two years using monitoring results and stakeholder feedback.',
    ], 'Approved E&S policy, communication records.', 'Agree a two-page environmental and social policy with leadership and share it with staff and contractors.',
    'A policy sets out what the institution commits to; without one, safeguards depend on individuals.', 'policy', 6, 'afdb-iss:OS1 iso-14001:MS', ALL),
    i(2, 'esms', 'Risk Screening', 'Are environmental and social risks screened and categorised for each project or operation?', [
      'Risks are not screened.',
      'Screening happens only when a funder requires it.',
      'Screening is done for some projects without a standard method.',
      'A screening procedure categorises the risk of every project or operation before it starts.',
      'Screening records exist for current projects, with the required actions taken.',
      'Screening results are reviewed for accuracy and the procedure is improved.',
    ], 'Screening procedure, completed screening forms; for high-risk operations, the independently prepared impact assessment.', 'Screen every new project with a one-page checklist before it starts and record the category.',
    'Unscreened projects are where serious harm, and funder withdrawal, usually start.', 'process', 8, 'afdb-iss:OS1', ALL),
    i(3, 'esms', 'Management Plan', 'Is there a staffed environmental and social management plan with monitoring and reporting?', [
      'No management plan or responsible staff.',
      'Responsibilities are informal.',
      'A plan exists but is not resourced or monitored.',
      'A management plan sets measures, responsibilities, budget and monitoring, with named staff.',
      'Monitoring reports show measures implemented and issues corrected.',
      'Monitoring results improve the plan, and performance is reported to leadership and funders.',
    ], 'E&S management plan, staffing, monitoring reports.', 'Name one person responsible for environmental and social measures and give them a simple monitoring plan.',
    'Measures that no one owns or monitors are not carried out.', 'system', 12, 'afdb-iss:OS1 iso-14001:MS', ALL),
    i(4, 'esms', 'Climate Risk Governance', 'Does the board oversee climate-related risks and opportunities, with them assessed at least yearly?', [
      'Climate risk is not considered.',
      'Climate is mentioned only in proposals.',
      'Climate risks are discussed but not assessed or assigned.',
      'The board has assigned oversight of climate risks, and an assessment is done at least yearly.',
      'Assessment results are reported to the board and affect plans and budgets.',
      'Climate scenarios inform strategy, and the assessment method is improved over time.',
    ], 'Board terms of reference covering climate, climate risk assessment, board minutes.', 'Assign climate risk oversight to a board committee and assess the main climate risks once a year.',
    'Climate risks increasingly decide whether institutions and their assets stay viable.', 'assurance', 12, 'ifrs-s2:GOV ifrs-s2:RISK', MOD),
    i(5, 'esms', 'Sustainability Disclosure', 'Are material sustainability risks, opportunities, metrics and targets reported to stakeholders?', [
      'No sustainability reporting.',
      'Occasional stories, with no data.',
      'Some data is reported without targets or a method.',
      'A yearly report covers material sustainability risks and opportunities, with metrics and targets.',
      'Reported data is reconciled to records and progress against targets is shown.',
      'Reporting is assured or reviewed externally, and stakeholder feedback shapes what is reported.',
    ], 'Sustainability report, data sources, review or assurance statement.', 'Publish a short yearly report on your main sustainability risks with two or three measures and targets.',
    'Funders and regulators increasingly expect sustainability information alongside financial reports.', 'practice', 26, 'ifrs-s1:STRAT ifrs-s1:METRICS ifrs-s2:METRICS', MOD),
    i(6, 'labour', 'Terms and Conditions', 'Do all workers, including contractors, have written terms, fair wages and lawful hours?', [
      'Workers have no written terms.',
      'Some staff have contracts; contractors do not.',
      'Contracts exist, but wages or hours fall short of the law in places.',
      'All workers, including contractors\' staff, have written terms meeting legal wage and hours requirements.',
      'Payroll and contractor checks confirm terms are applied.',
      'Terms are reviewed yearly against law and good practice, and contractor checks are risk-based.',
    ], 'Employment contracts, payroll records, contractor labour checks.', 'Check a sample of contractor workers\' pay and hours against the legal minimum.',
    'Labour abuses in the supply chain become the institution\'s problem the moment they are found.', 'policy', 8, 'afdb-iss:OS2 iso-45001:MS', ALL),
    i(7, 'labour', "Workers' Grievances", 'Is there a grievance channel for workers outside the management line, with cases tracked to resolution?', [
      'Workers have no way to complain.',
      'Complaints go only to supervisors.',
      'A channel exists but is unknown or not trusted.',
      'A written procedure provides a confidential grievance channel outside the management line, open to contractors\' workers.',
      'A grievance register (redacted extracts available) shows cases logged, response times and resolutions.',
      'Grievance trends are reviewed by leadership and lead to changes, and workers report trusting the channel.',
    ], 'Grievance procedure, redacted register extracts, response times, worker feedback.', 'Open a confidential grievance channel for all workers and log every case with the date it was resolved.',
    'Workers with no safe way to complain have no way to stop harm early.', 'practice', 12, 'afdb-iss:OS2', ALL),
    i(8, 'labour', 'No Child or Forced Labour', 'Are child and forced labour prevented, including through checks on suppliers?', [
      'No measures against child or forced labour.',
      'Measures exist only for direct employees.',
      'Supplier contracts mention the issue but are not checked.',
      'A procedure covers age verification and prevents forced labour, including in supplier contracts.',
      'Supplier checks are carried out and recorded for higher-risk suppliers.',
      'Findings are acted on, and the supplier check approach is reviewed yearly.',
    ], 'Age verification procedure, supplier clauses, supplier check records.', 'Add child and forced labour clauses to supplier contracts and check your highest-risk suppliers.',
    'Child or forced labour found anywhere in the chain causes lasting harm and can end funding.', 'process', 12, 'afdb-iss:OS2', ALL),
    i(9, 'resources', 'Resource Use', 'Are energy, water and materials use measured, with reduction targets?', [
      'Resource use is not measured.',
      'Bills are paid without analysis.',
      'Some use is measured, without targets.',
      'Energy, water and main materials use are measured, with reduction targets.',
      'Use is reported against targets, with measures taken to reduce it.',
      'Reductions are achieved and verified, and targets are raised over time.',
    ], 'Resource use records, targets, progress reports.', 'Track monthly energy and water use for your main sites and set a one-year reduction target.',
    'Using less saves money and lowers the institution\'s exposure to price and climate shocks.', 'system', 12, 'afdb-iss:OS3 iso-50001:MS iso-14064-1:MS', MOD),
    i(10, 'resources', 'Pollution and Waste', 'Are waste and pollution managed under the permits that apply, and monitored?', [
      'Waste and pollution are not managed.',
      'Waste is removed without records.',
      'Permits exist, but monitoring is irregular.',
      'Waste and pollution procedures meet the permits that apply, with monitoring planned.',
      'Monitoring records show permit limits met, with incidents recorded and corrected.',
      'Pollution and waste are reduced over time, and monitoring results are published.',
    ], 'Permits, waste and emissions monitoring records, incident log.', 'List every permit you hold and check your monitoring records against each one.',
    'Pollution incidents harm communities and can halt operations.', 'practice', 12, 'afdb-iss:OS3 iso-14001:MS', MOD),
    i(11, 'community', 'Community Safety', 'Are risks to community health and safety assessed and reduced?', [
      'Community risks are not considered.',
      'Risks are addressed only after incidents.',
      'Some risks are identified, without a plan.',
      'Community health and safety risks are assessed, with a plan to reduce them.',
      'The plan is implemented, and incidents are recorded and investigated.',
      'Incident trends fall, and the plan is updated with community input.',
    ], 'Community risk assessment, mitigation plan, incident records.', 'Assess how your operations could harm nearby communities and write down how you will prevent it.',
    'Harm to communities is the fastest way to lose a licence to operate.', 'process', 8, 'afdb-iss:OS4', MOD),
    i(12, 'community', 'SEAH and Gender-Based Violence', 'Are sexual exploitation, abuse and harassment, and other gender-based violence, prevented, with survivor-centred reporting and response?', [
      'No measures on gender-based violence or harassment.',
      'A general conduct policy only.',
      'A policy exists, but reporting routes and support are unclear.',
      'A policy, code of conduct, safe reporting routes and referral to survivor support are in place for staff, contractors and communities.',
      'Training records and a confidential case log show cases handled with survivor-centred responses.',
      'Prevention is reviewed with specialist input, and lessons change practice.',
    ], 'SEAH and GBV policy, signed codes of conduct, training records, confidential case handling procedure, confidential case log (zero cases recorded as zero).', 'Adopt a policy on sexual exploitation, abuse and harassment, train all staff and contractors, and set up a confidential reporting route.',
    'These harms are severe, often hidden, and funders treat failures as grounds for suspension.', 'practice', 12, 'afdb-iss:OS4 afdb-iss:OS2', ALL),
    i(13, 'community', 'Security and Rights', 'Are security arrangements proportionate and respectful of human rights?', [
      'Security arrangements are unmanaged.',
      'Security staff have no rules of engagement.',
      'Rules exist but are not trained or monitored.',
      'Security arrangements are assessed for proportionality, with rules of engagement and human rights requirements in contracts.',
      'Security personnel are trained, and incidents are recorded and investigated.',
      'Arrangements are reviewed with community input, and incidents are reported openly.',
    ], 'Security risk assessment, security contracts, training records, incident log.', 'Write rules of engagement for security staff and include them in every security contract.',
    'Disproportionate security can turn a community concern into a human rights violation.', 'policy', 8, 'afdb-iss:OS4', MOD),
    i(14, 'land', 'Avoiding Displacement', 'Is land acquisition or restricted access avoided or minimised, with fair compensation where unavoidable?', [
      'Land is acquired without considering impacts.',
      'Impacts are considered only after complaints.',
      'Some compensation is paid without a consistent method.',
      'Alternatives are assessed to avoid displacement, and a compensation framework applies at full replacement cost.',
      'Compensation records show payments made before displacement, with grievances handled.',
      'Outcomes are independently monitored, and lessons improve future land decisions.',
    ], 'Alternatives analysis, compensation framework, payment records.', 'Before acquiring land, document the alternatives you considered and how you will compensate affected people.',
    'Displacement without fair compensation causes lasting hardship and serious reputational damage.', 'process', 12, 'afdb-iss:OS5', FLAG('land')),
    i(15, 'land', 'Livelihood Restoration', 'Is resettlement planned and are livelihood outcomes monitored afterwards?', [
      'No resettlement planning.',
      'People are moved without a plan.',
      'A plan exists but is not implemented or monitored.',
      'A resettlement and livelihood restoration plan is agreed with affected people before moving anyone.',
      'Monitoring shows livelihoods restored, with corrective support where they are not.',
      'Completion is independently checked, and affected people confirm their livelihoods are restored.',
    ], 'Resettlement action plan, monitoring reports, completion audit.', 'Agree a livelihood restoration plan with affected households and measure their income before and after.',
    'Moving people is not enough; their livelihoods must be at least as good afterwards.', 'practice', 26, 'afdb-iss:OS5', FLAG('land')),
    i(16, 'biodiversity', 'Habitat Impacts', 'Are impacts on habitats and biodiversity assessed and then avoided, minimised or offset?', [
      'Impacts on nature are not considered.',
      'Impacts are noted without assessment.',
      'Some impacts are assessed, without a mitigation plan.',
      'A biodiversity assessment sets measures to avoid, then minimise, then offset impacts.',
      'Measures are implemented and monitored.',
      'Monitoring shows no net loss, and results are reported publicly.',
    ], 'Biodiversity assessment, mitigation plan, monitoring reports.', 'Commission a basic habitat assessment for sites near protected or high-biodiversity areas.',
    'Damage to critical habitats can be irreversible and is a red line for many funders.', 'process', 12, 'afdb-iss:OS6', FLAG('biodiversity')),
    i(17, 'biodiversity', 'Natural Resources', 'Are living natural resources used sustainably?', [
      'Natural resources are used without limits.',
      'Use is informal and unrecorded.',
      'Use is recorded, without sustainability limits.',
      'Sustainable use limits are set for living natural resources the institution depends on.',
      'Use is monitored against the limits.',
      'Limits are reviewed with experts and communities, and practices improve.',
    ], 'Resource use plan, monitoring records.', 'Set and record a sustainable limit for each natural resource your operations depend on.',
    'Over-used resources fail the communities that depend on them, and then the operations themselves.', 'practice', 12, 'afdb-iss:OS6', FLAG('biodiversity')),
    i(18, 'vulnerable', 'Vulnerable Groups Identified', 'Are the vulnerable groups affected by operations identified?', [
      'Vulnerable groups are not considered.',
      'Groups are considered only when someone raises them.',
      'Some groups are named, without analysis.',
      'An assessment identifies vulnerable groups affected by operations and how they are affected.',
      'The assessment is updated as operations change.',
      'Vulnerable groups help shape the assessment and confirm it reflects their situation.',
    ], 'Social assessment identifying vulnerable groups.', 'List the groups most likely to be harmed or left out by your operations, and why.',
    'Groups no one has identified are the ones most likely to be harmed.', 'process', 6, 'afdb-iss:OS7', MOD),
    i(19, 'vulnerable', 'Fair Share of Benefits', 'Are measures in place so vulnerable groups share in benefits and are not harmed?', [
      'No measures for vulnerable groups.',
      'Measures depend on individual staff.',
      'Measures are planned but not delivered.',
      'Differentiated measures are planned for each identified vulnerable group.',
      'Measures are delivered, and outcomes for vulnerable groups are monitored.',
      'Outcomes show vulnerable groups benefiting, and measures are improved with their input.',
    ], 'Differentiated measures plan, outcome monitoring by group.', 'For each vulnerable group identified, agree one measure that helps them benefit, and track it.',
    'Without deliberate measures, benefits flow to those already best placed to receive them.', 'practice', 12, 'afdb-iss:OS7', MOD),
    i(20, 'heritage', 'Cultural Heritage', 'Are cultural heritage sites and practices identified and protected, with a chance-find procedure?', [
      'Cultural heritage is not considered.',
      'Heritage is considered only when communities object.',
      'Known sites are noted, without protection measures.',
      'Heritage sites and practices are identified with communities, with protection measures and a chance-find procedure.',
      'Measures and the chance-find procedure are applied, with records kept.',
      'Communities confirm heritage is respected, and procedures are reviewed with them.',
    ], 'Heritage assessment, chance-find procedure, records of finds.', 'Ask affected communities which places and practices matter to them, and add a chance-find procedure to work contracts.',
    'Damage to heritage destroys something that cannot be replaced and breaks community trust.', 'process', 8, 'afdb-iss:OS8', FLAG('heritage')),
    i(21, 'intermediary', 'Portfolio Screening', 'Does the institution screen what it finances for environmental and social risk?', [
      'Lending or investment is not screened.',
      'Only an exclusion list is applied.',
      'Screening happens for some transactions, without a method.',
      'A procedure screens and categorises every transaction for environmental and social risk.',
      'Screening records exist for the portfolio, with higher-risk transactions given more scrutiny.',
      'Portfolio risk is reported to the board, and the procedure improves using results.',
    ], 'E&S screening procedure, transaction screening records, portfolio risk report.', 'Add an environmental and social screening step to your credit or investment approval process.',
    'A lender or investor carries the risks of what it finances.', 'process', 8, 'afdb-iss:OS9', FLAG('intermediary')),
    i(22, 'intermediary', 'Financing Conditions', 'Are environmental and social conditions written into financing agreements and monitored?', [
      'No conditions in financing agreements.',
      'Generic clauses are included but never checked.',
      'Conditions exist for some deals, without monitoring.',
      'Financing agreements include specific conditions proportionate to the risk.',
      'Conditions are monitored, and breaches are followed up.',
      'Monitoring results inform future lending, and clients improve their own systems.',
    ], 'Sample financing agreements, monitoring records.', 'Add risk-based environmental and social conditions to new financing agreements and check them yearly.',
    'Conditions that are never checked give no protection.', 'practice', 12, 'afdb-iss:OS9', FLAG('intermediary')),
    i(23, 'stakeholders', 'Engagement Plan', 'Is there a stakeholder engagement plan covering disclosure and consultation?', [
      'No plan to engage stakeholders.',
      'Engagement happens only when problems arise.',
      'Stakeholders are listed, without a plan.',
      'A stakeholder engagement plan identifies stakeholders and sets how they will be informed and consulted.',
      'Engagement happens as planned, with records of meetings and feedback.',
      'Feedback visibly shapes decisions, and the plan is updated regularly.',
    ], 'Stakeholder engagement plan, meeting records.', 'Map your stakeholders and plan when and how you will inform and consult each group.',
    'People who are consulted early raise problems while they are still cheap to fix.', 'policy', 6, 'afdb-iss:OS10', ALL),
    i(24, 'stakeholders', 'Accessible Disclosure', 'Is information disclosed to affected people in languages and formats they can use?', [
      'Information is not shared.',
      'Information is shared only in official documents.',
      'Information is shared, but in languages or formats affected people cannot use.',
      'Key information is disclosed in local languages and accessible formats.',
      'Disclosure records show information shared before decisions affecting people.',
      'Affected people confirm the information is understandable and timely.',
    ], 'Disclosure materials in local languages, disclosure records.', 'Translate a one-page summary of each project into the local language and share it before work starts.',
    'Information people cannot read has not been disclosed.', 'practice', 8, 'afdb-iss:OS10', ALL),
    i(25, 'stakeholders', 'Community Grievances', 'Is there an accessible, trusted community grievance mechanism, with cases logged and resolved?', [
      'Communities have no way to complain.',
      'Complaints are handled informally and not recorded.',
      'A mechanism exists, but communities do not know about it or trust it.',
      'A free, accessible community grievance mechanism is publicised, with a procedure and timelines.',
      'A grievance register (redacted extracts available) shows cases logged, response times and resolutions.',
      'Trends are reviewed by leadership, communities report trusting the mechanism, and lessons change operations.',
    ], 'Grievance procedure, publicity materials, redacted register extracts, response times.', 'Set up a free way for community members to complain, publicise it locally, and log every case with its resolution date.',
    'A working grievance mechanism catches harm early and shows communities they are heard.', 'practice', 12, 'afdb-iss:OS10', ALL),
  ],
  bands: V1_BANDS([
    'Safeguards are missing; operations could cause serious harm without anyone noticing.',
    'Some safeguards exist, but significant gaps leave people and the environment at risk.',
    'Core safeguards work for the risks that apply, though monitoring is uneven.',
    'Safeguards are in place, monitored and evidenced for every area that applies.',
    'Safeguards are reviewed with affected people and continuously improved.',
  ]),
  weakestLinkFloor: 1.75,
  lenses: [
    { key: 'system', name: 'A working system', description: 'Is there a system that finds and manages environmental and social risks?', indicatorIds: [id(C, 1), id(C, 2), id(C, 3)] },
    { key: 'protected', name: 'People protected', description: 'Are workers, communities and vulnerable people protected from harm?', indicatorIds: [id(C, 6), id(C, 8), id(C, 11), id(C, 12), id(C, 19)] },
    { key: 'heard', name: 'People heard', description: 'Can affected people get information, raise concerns and get a response?', indicatorIds: [id(C, 7), id(C, 23), id(C, 24), id(C, 25)] },
  ],
  related: [
    { frameworkId: 'esg-self-assessment', label: 'ESG Self-Assessment' },
  ],
}
