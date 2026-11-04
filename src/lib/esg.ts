// ============================================================================
// ESG Self-Assessment
// ----------------------------------------------------------------------------
// A standalone ESG (Environmental, Social, Governance) diagnostic modeled on
// GRI / IFRS S1-S2 / TCFD disclosure categories, with a scoring methodology
// benchmarked against how independent ESG self-assessment platforms actually
// operate (response + reviewer-verified evidence, blended - not a single
// self-reported number). It reuses the platform's existing fiduciary 0-5
// scale (see frameworks.ts) so colors and badges stay visually consistent
// with every other framework.
//
// Every question carries:
//   - pillar        - which of the three ESG pillars it belongs to
//   - frameworkRefs - the GRI Standard / IFRS Sustainability Standard / TCFD
//                      pillar this question maps to, for traceability
//   - recommendation - the concrete next action to close the gap, shown
//                       whenever the question scores below "Defined" (3)
//   - financingNote  - why this specific item matters to a financier,
//                       investor, partner, procurement officer or to
//                       sustainability-reporting readiness
// so gaps, recommendations and the financing narrative all fall out of the
// same question data - no separate content model.
//
// Scoring is two-layer, same idea as a reviewer-controlled ESG platform:
//   - "Response" score  - the self-reported 0-5 answer (self-assessment).
//   - "Evidence" score   - a 0-4 verification level per supporting document
//                           (Missing / Weak / Partial / Strong / Verified),
//                           scaled to 0-5.
//   - "Verified" score   - 60% response + 40% evidence, per pillar and
//                           composite. The rating badge is computed from
//                           this blended score, and is explicitly marked
//                           "Provisional" until evidence coverage is high
//                           enough to trust it - a self-assessment alone is
//                           never presented as a final/independent rating.
// ============================================================================

import type { RubricQuestion } from './frameworks'

export type EsgPillar = 'Environmental' | 'Social' | 'Governance'

export const ESG_PILLARS: { key: EsgPillar; blurb: string }[] = [
  { key: 'Environmental', blurb: 'Climate, resource use and environmental compliance' },
  { key: 'Social', blurb: 'Labor practices, safety, DEI and community impact' },
  { key: 'Governance', blurb: 'Board oversight, ethics, risk controls and disclosure' },
]

export interface EsgQuestion extends RubricQuestion {
  pillar: EsgPillar
  /** GRI Standard / IFRS Sustainability Standard / TCFD pillar this question maps to. */
  frameworkRefs: string[]
  recommendation: string
  financingNote: string
  /** Only for organisations it applies to: skipped in completion counts and never listed as missing. */
  optional?: boolean
}

export const ESG_QUESTIONS: EsgQuestion[] = [
  // --- Environmental ---------------------------------------------------
  {
    id: 'ESG-E1',
    pillar: 'Environmental',
    domain: 'Climate & Emissions',
    frameworkRefs: ['GRI 305', 'TCFD', 'IFRS S2'],
    question: 'Does the organization measure and manage its greenhouse gas emissions?',
    soe: {
      0: 'Emissions are not tracked in any form.',
      1: 'Emissions are estimated informally with no consistent method.',
      2: 'A basic Scope 1/2 estimate exists but is not updated regularly.',
      3: 'Scope 1 and 2 emissions are measured annually using a documented method.',
      4: 'Scope 1, 2 and material Scope 3 emissions are tracked, reviewed and trending down.',
      5: 'Emissions are independently verified and tied to a published reduction target.',
    },
    evidence: 'GHG inventory, utility/fuel records, emissions reduction plan.',
    recommendation: 'Stand up an annual Scope 1/2 emissions inventory using a recognized method (e.g. GHG Protocol) before attempting Scope 3.',
    financingNote: 'Climate finance and most DFI facilities now require at minimum a Scope 1/2 baseline before disbursement.',
  },
  {
    id: 'ESG-E2',
    pillar: 'Environmental',
    domain: 'Resource & Waste Efficiency',
    frameworkRefs: ['GRI 302', 'GRI 306'],
    question: 'Are resource use (energy, water, materials) and waste streams actively managed?',
    soe: {
      0: 'No tracking of resource consumption or waste.',
      1: 'Awareness of usage but no data collected.',
      2: 'Utility bills are kept but not analyzed for efficiency.',
      3: 'Consumption is tracked and benchmarked year over year.',
      4: 'Active efficiency program with documented reduction in waste/energy intensity.',
      5: 'Circular-economy practices in place (reuse, recycling, take-back) with measured diversion rate.',
    },
    evidence: 'Utility bills, waste manifests, efficiency program documentation.',
    recommendation: 'Start logging monthly energy, water and waste volumes - the data itself usually surfaces the first efficiency win.',
    financingNote: 'Procurement RFPs increasingly score bidders on resource efficiency as a tie-breaker.',
  },
  {
    id: 'ESG-E3',
    pillar: 'Environmental',
    domain: 'Environmental Compliance',
    frameworkRefs: ['GRI 2-27'],
    question: 'Does the organization hold and maintain all required environmental permits and clearances?',
    soe: {
      0: 'Required permits are unknown or absent.',
      1: 'Some permits held but several are lapsed or missing.',
      2: 'Core permits held; renewal tracking is informal.',
      3: 'All required permits held and tracked with renewal dates.',
      4: 'Permits held plus an internal environmental compliance calendar.',
      5: 'Zero compliance findings in the last 3 years, independently audited.',
    },
    evidence: 'Environmental permits/licences, EIA certificates, regulator correspondence.',
    recommendation: 'Build a permit register with renewal dates and assign an owner - most lapses are calendar failures, not legal ones.',
    financingNote: 'A lapsed environmental permit is a common deal-breaker in DFI/PE environmental due diligence.',
  },
  {
    id: 'ESG-E4',
    pillar: 'Environmental',
    domain: 'Climate Risk Exposure',
    frameworkRefs: ['TCFD', 'IFRS S2'],
    question: 'Has the organization assessed its physical and transition climate risk exposure?',
    soe: {
      0: 'Climate risk has never been considered.',
      1: 'Informal awareness that climate risk may be relevant.',
      2: 'A qualitative risk list exists but is not scored.',
      3: 'Physical and transition risks are identified and scored.',
      4: 'Risks are scenario-tested and feed into strategic planning.',
      5: 'Climate risk is integrated into enterprise risk management with board-level reporting.',
    },
    evidence: 'Climate risk register, scenario analysis, ERM integration records.',
    recommendation: 'Run a lightweight physical + transition risk screen against your top 3 sites/operations before building a full scenario model.',
    financingNote: 'Aligns directly with ISSB/TCFD disclosure expectations now written into many lending covenants.',
  },

  {
    id: 'ESG-E5', pillar: 'Environmental', domain: 'Targets & Reduction', frameworkRefs: ['IFRS S2', 'SBTi (reference)'],
    question: 'Are there time-bound reduction targets for emissions, energy, water or waste, with a plan to meet them?',
    soe: { 0: 'No targets exist.', 1: 'Aspirations are stated without numbers or dates.', 2: 'Some numeric targets exist but have no plan or owner.',
      3: 'Time-bound targets for the main impacts have an owner and a plan.', 4: 'Progress against targets is tracked and reported to leadership.', 5: 'Targets are science-informed, externally reviewed and met or on track.' },
    evidence: 'Target statement, reduction plan, progress reports.',
    recommendation: 'Set one or two time-bound reduction targets for your largest impacts, name an owner and review progress quarterly.',
    financingNote: 'Green and sustainability-linked finance is priced against credible, time-bound targets.',
  },
  {
    id: 'ESG-N1', pillar: 'Environmental', domain: 'Nature: Locate & Evaluate', frameworkRefs: ['TNFD', 'IFRS S1'],
    question: 'Has the organisation located where its sites, supply chain or activities interface with nature, including sensitive areas, and evaluated its dependencies and impacts on nature?',
    soe: { 0: 'Nature is not considered.', 1: 'Some sites near sensitive areas are known informally.', 2: 'Sites are listed but dependencies and impacts are not evaluated.',
      3: 'Sites and key supply chains are mapped against sensitive areas and the main dependencies and impacts are evaluated.', 4: 'The evaluation covers the value chain and is updated regularly.', 5: 'The evaluation uses recognised data sources and is reviewed independently.' },
    evidence: 'Site map against protected and key biodiversity areas, dependency and impact screening.',
    recommendation: 'Map your sites and main supply sources against protected and high-biodiversity areas, then list what you depend on (water, soil, ecosystems) and what you affect.',
    financingNote: 'Funders and investors increasingly ask for nature screening alongside climate, following the TNFD approach.',
  },
  {
    id: 'ESG-N2', pillar: 'Environmental', domain: 'Nature: Assess & Prepare', frameworkRefs: ['TNFD', 'IFRS S1'],
    question: 'Are nature-related risks and opportunities assessed and managed alongside other risks, with responses prioritised?',
    soe: { 0: 'Nature risks are not considered.', 1: 'Nature risks are discussed occasionally.', 2: 'Some nature risks are listed but not assessed.',
      3: 'Material nature risks and opportunities are assessed and in the risk register with responses.', 4: 'Responses are funded, owned and reviewed.', 5: 'Nature risk management shapes strategy and investment decisions.' },
    evidence: 'Risk register entries, nature risk assessment, response plans.',
    recommendation: 'Add your material nature risks to the risk register with an owner and a response, and review them with other risks.',
    financingNote: 'Unmanaged nature dependencies (for example water) are a growing credit and operational risk for lenders.',
  },
  {
    id: 'ESG-N3', pillar: 'Environmental', domain: 'Nature: Metrics & Targets', frameworkRefs: ['TNFD', 'IFRS S1'],
    question: 'Are nature-related metrics and targets set and reported (for example land use change, pollution, water from stressed areas)?',
    soe: { 0: 'No nature metrics are tracked.', 1: 'Ad hoc figures exist.', 2: 'Some metrics are tracked without targets.',
      3: 'Core nature metrics are tracked with targets.', 4: 'Metrics and progress are reported publicly.', 5: 'Metrics are assured and aligned with recognised disclosure frameworks.' },
    evidence: 'Metric definitions, data, targets, published report.',
    recommendation: 'Choose a few core nature metrics that match your impacts, set targets and report them each year.',
    financingNote: 'Measured nature metrics let funders track outcomes and support nature-positive finance.',
  },
  // --- Social ------------------------------------------------------------
  {
    id: 'ESG-S1',
    pillar: 'Social',
    domain: 'Labor Practices & Human Capital',
    frameworkRefs: ['GRI 401', 'GRI 407'],
    question: 'Are fair labor practices documented and consistently applied?',
    soe: {
      0: 'No documented labor policies.',
      1: 'Informal practices, inconsistently applied.',
      2: 'Basic policy exists but is not communicated to staff.',
      3: 'Documented labor policy, communicated and consistently applied.',
      4: 'Policy includes living-wage benchmarking and grievance mechanism.',
      5: 'Independently audited labor practices with published outcomes.',
    },
    evidence: 'HR policy manual, employment contracts, wage benchmarking study.',
    recommendation: 'Publish a single labor policy document covering wages, hours and grievance handling, and have every employee acknowledge it.',
    financingNote: 'Labor-practice red flags are one of the most common reasons impact investors walk away post-diligence.',
  },
  {
    id: 'ESG-S2',
    pillar: 'Social',
    domain: 'Health & Safety',
    frameworkRefs: ['GRI 403'],
    question: 'Is there an active occupational health and safety (OHS) management system?',
    soe: {
      0: 'No OHS system; incidents are not tracked.',
      1: 'Ad-hoc safety awareness, no formal system.',
      2: 'Basic safety rules exist but incident tracking is inconsistent.',
      3: 'OHS system in place with incident tracking and reporting.',
      4: 'OHS system with regular training and a declining incident trend.',
      5: 'Certified OHS management system (e.g. ISO 45001) with zero lost-time incidents.',
    },
    evidence: 'OHS policy, incident log, training records, certifications.',
    recommendation: 'Start a simple incident log today - you cannot improve a safety record you are not measuring.',
    financingNote: 'Lenders to physical operations (manufacturing, agriculture, construction) typically require evidence of an active OHS system as a condition precedent.',
  },
  {
    id: 'ESG-S3',
    pillar: 'Social',
    domain: 'Diversity, Equity & Inclusion',
    frameworkRefs: ['GRI 405'],
    question: 'Does the organization track and actively manage workforce diversity?',
    soe: {
      0: 'No diversity data collected.',
      1: 'Awareness of the issue, no data.',
      2: 'Headcount diversity known informally but not reported.',
      3: 'Diversity data tracked and reported internally (gender, at minimum).',
      4: 'Diversity targets set with a documented action plan.',
      5: 'Diversity targets met and disclosed externally, including leadership representation.',
    },
    evidence: 'Workforce composition data, DEI policy, leadership representation report.',
    recommendation: 'Start with one metric - gender split by seniority level - before building a broader DEI program.',
    financingNote: 'Gender-lens and 2X-aligned investors specifically screen for workforce and leadership diversity data.',
  },
  {
    id: 'ESG-S4',
    pillar: 'Social',
    domain: 'Community & Stakeholder Engagement',
    frameworkRefs: ['GRI 413'],
    question: 'Is there a structured process for engaging and addressing concerns from affected communities?',
    soe: {
      0: 'No community engagement process.',
      1: 'Engagement happens reactively, only when issues arise.',
      2: 'Informal engagement exists but nothing is documented.',
      3: 'A documented stakeholder engagement plan is in place.',
      4: 'Plan includes a functioning grievance redress mechanism with tracked resolution times.',
      5: 'Engagement outcomes are independently monitored and published.',
    },
    evidence: 'Stakeholder engagement plan, grievance log, community consultation records.',
    recommendation: 'Set up a single, visible channel (phone line, box, or form) for community grievances and commit to a resolution timeline.',
    financingNote: 'IFC Performance Standards and most DFI social safeguards require a functioning grievance mechanism as a baseline condition.',
  },

  {
    id: 'ESG-V1', pillar: 'Social', domain: 'Value Chain', frameworkRefs: ['GRI 308', 'GRI 414', 'IFRS S2'],
    question: 'Does the organisation work with suppliers and partners to measure and reduce value-chain impacts, including indirect emissions and nature impacts?',
    soe: { 0: 'Suppliers are not engaged on sustainability.', 1: 'Expectations are mentioned informally.', 2: 'A supplier code exists but is not monitored.',
      3: 'Main suppliers are screened and engaged on key impacts.', 4: 'Value-chain data is collected and reduction programmes run with partners.', 5: 'Value-chain results are verified and drive sourcing decisions.' },
    evidence: 'Supplier code, screening records, engagement programme, value-chain data.',
    recommendation: 'Screen your main suppliers on environmental and social impacts and agree improvement actions with the highest-impact ones.',
    financingNote: 'Buyers and investors now ask for value-chain emissions and supplier due diligence.',
  },
  // --- Governance ----------------------------------------------------------
  {
    id: 'ESG-G1',
    pillar: 'Governance',
    domain: 'Board Oversight & Structure',
    frameworkRefs: ['GRI 2-9', 'GRI 2-12'],
    question: 'Does the governing board provide active, independent oversight of strategy and risk?',
    soe: {
      0: 'No functioning board or governing body.',
      1: 'Board exists on paper; rarely meets or decides anything.',
      2: 'Board meets but lacks independent members or formal agendas.',
      3: 'Board meets regularly with minutes, agendas and some independent members.',
      4: 'Board has defined committees (audit/risk) and documented oversight of management.',
      5: 'Board effectiveness is independently reviewed and disclosed.',
    },
    evidence: 'Board charter, meeting minutes, committee terms of reference.',
    recommendation: 'Formalize a board calendar with a standing risk/finance agenda item, and minute every meeting.',
    financingNote: 'Weak board oversight is the single most common governance red flag in institutional due diligence.',
  },
  {
    id: 'ESG-G2',
    pillar: 'Governance',
    domain: 'Business Ethics & Anti-Corruption',
    frameworkRefs: ['GRI 205'],
    question: 'Is there a documented anti-corruption / code of conduct policy, actively enforced?',
    soe: {
      0: 'No code of conduct or anti-corruption policy.',
      1: 'Informal expectation of honesty, nothing written.',
      2: 'Code of conduct exists but is not communicated or enforced.',
      3: 'Code of conduct communicated to all staff, with sign-off.',
      4: 'Policy includes a whistleblower channel and periodic ethics training.',
      5: 'Independently audited anti-corruption program with zero substantiated findings.',
    },
    evidence: 'Code of conduct, anti-bribery policy, whistleblower log, training records.',
    recommendation: 'Adopt a one-page code of conduct covering gifts, conflicts of interest and reporting, and have staff sign it annually.',
    financingNote: 'Anti-corruption policy is a near-universal condition precedent for DFI and multilateral financing.',
  },
  {
    id: 'ESG-G3',
    pillar: 'Governance',
    domain: 'Risk Management & Internal Controls',
    frameworkRefs: ['TCFD'],
    question: 'Are financial and operational risks formally identified, scored and monitored?',
    soe: {
      0: 'No risk management process.',
      1: 'Risks are discussed informally when problems occur.',
      2: 'A risk list exists but is not scored or owned.',
      3: 'A risk register exists with owners and is reviewed periodically.',
      4: 'Risk register is scored, tracked and reported to the board.',
      5: 'Enterprise risk management is independently assured and integrated into strategic planning.',
    },
    evidence: 'Risk register, internal controls policy, internal/external audit reports.',
    recommendation: 'Build a one-page risk register (top 10 risks, owner, likelihood/impact) and review it quarterly.',
    financingNote: 'A live risk register is typically the first document requested in institutional financial due diligence.',
  },
  {
    id: 'ESG-G4',
    pillar: 'Governance',
    domain: 'Transparency & Disclosure',
    frameworkRefs: ['GRI 2-3', 'IFRS S1'],
    question: 'Does the organization publish regular, reliable performance and governance disclosures?',
    soe: {
      0: 'No external reporting of any kind.',
      1: 'Reporting only when required by a specific funder.',
      2: 'Annual report produced but inconsistent or late.',
      3: 'Annual financial and narrative report produced on schedule.',
      4: 'Report includes ESG/sustainability performance alongside financials.',
      5: 'Disclosures are independently audited and published proactively.',
    },
    evidence: 'Annual report, audited financial statements, ESG/sustainability disclosure.',
    recommendation: 'Add a one-page ESG summary to your existing annual report before building a standalone sustainability report.',
    financingNote: 'Consistent, timely disclosure is what ESG-linked loans and sustainability-linked bonds price against.',
  },
  {
    id: 'ESG-G5', pillar: 'Governance', domain: 'Materiality', frameworkRefs: ['GRI 3', 'IFRS S1'],
    question: "Has a materiality assessment identified the organisation's most significant ESG issues, reviewed at least every two years?",
    soe: { 0: 'No materiality assessment.', 1: 'Issues are chosen informally by management.', 2: 'A one-off assessment exists but is out of date.',
      3: 'A documented assessment with stakeholder input is reviewed at least every two years.', 4: 'Material issues drive targets and reporting.', 5: 'The assessment covers financial and impact materiality and is reviewed by the board.' },
    evidence: 'Materiality assessment, stakeholder input, board minutes.',
    recommendation: 'Run a materiality assessment with input from staff, partners and communities, and repeat it at least every two years.',
    financingNote: 'Materiality shows funders that ESG effort targets what matters most.',
  },
  {
    id: 'ESG-G6', pillar: 'Governance', domain: 'Strategy Integration', frameworkRefs: ['IFRS S1', 'TCFD', 'TNFD'],
    question: 'Is sustainability built into strategy, budgets and investment decisions, with named board-level oversight?',
    soe: { 0: 'Sustainability is separate from strategy.', 1: 'Mentioned in strategy without resources.', 2: 'Some budget is set aside but decisions ignore it.',
      3: 'Strategy and budgets include sustainability goals with named board oversight.', 4: 'Investment decisions test sustainability impacts and risks.', 5: 'Performance and pay are linked to sustainability outcomes.' },
    evidence: 'Strategic plan, budget lines, board terms of reference, investment papers.',
    recommendation: 'Name a board member or committee responsible for sustainability and add sustainability goals to the strategy and budget.',
    financingNote: 'Board-level oversight is a core expectation in IFRS S1 and S2 and in DFI governance reviews.',
  },
  {
    id: 'ESG-V2', pillar: 'Governance', domain: 'Collective Impact', frameworkRefs: ['SDGs (reference)'],
    question: 'Does the organisation contribute to sector, landscape or SDG-level collective action and report its impact?',
    soe: { 0: 'No external collaboration.', 1: 'Occasional participation in events.', 2: 'Member of initiatives without commitments.',
      3: 'Active in at least one collective initiative with stated commitments.', 4: 'Leads or co-leads initiatives and reports contribution.', 5: 'Collective results are measured and reported against the SDGs.' },
    evidence: 'Initiative memberships, commitments, impact reports.',
    recommendation: 'Join one sector or landscape initiative relevant to your material issues and report what you contribute.',
    financingNote: 'Collective action strengthens the case for blended and outcome-based finance.',
  },

  // Net zero (indices spec, net-zero addition): what a credible 1.5°C-aligned target needs. Benchmarks and their
  // sources are in netZero.ts; SBTi V2.0 (June 2026) and V1.3.1 (usable to January 2028) are both accommodated.
  {
    id: 'ESG-Z1', pillar: 'Environmental', domain: 'Net Zero: Target & Transition Plan', frameworkRefs: ['SBTi Corporate Net-Zero Standard (reference)', 'IFRS S2'],
    question: 'Is there a net-zero target with near-term (around five-year or 2030) milestones for Scope 1, 2 and material Scope 3 emissions, set against a 1.5°C pathway and backed by a transition plan?',
    soe: { 0: 'No net-zero target.', 1: 'A net-zero ambition is stated without a year, scope or milestones.', 2: 'A net-zero year is set, but there are no near-term milestones or Scope 3 coverage.',
      3: 'Near-term milestones cover Scope 1, 2 and material Scope 3 and are checked against a 1.5°C pathway.', 4: 'A board-approved transition plan sets the actions, budget and owners to meet each milestone.', 5: 'Targets are externally validated (for example by SBTi) and progress is reported against the plan.' },
    evidence: 'Target statement with years and scopes, 1.5°C pathway check, board-approved transition plan.',
    recommendation: 'Set a near-term milestone for Scope 1 and 2 (about 4.2% a year under SBTi V1, or the V2.0 target types from 2027), add material Scope 3, and write the transition plan that delivers it.',
    financingNote: 'Lenders and investors increasingly price transition finance against credible, validated targets and transition plans.',
  },
  {
    id: 'ESG-Z2', pillar: 'Environmental', domain: 'Net Zero: Absolute Reductions', frameworkRefs: ['GHG Protocol', 'IFRS S2'],
    question: 'Are emissions cut in absolute terms against a recent base year, with Scope 1 and 2 progress reported at least annually?',
    soe: { 0: 'Emissions are not tracked over time.', 1: 'Only intensity measures are tracked.', 2: 'Absolute emissions are tracked, but against an old or unclear base year.',
      3: 'Absolute Scope 1 and 2 emissions are reported annually against a recent base year.', 4: 'Year-on-year reductions are on the target path, with variances explained.', 5: 'Reductions are independently assured and include material Scope 3.' },
    evidence: 'Annual emissions inventory, base-year statement, progress report against the target path.',
    recommendation: 'Report absolute Scope 1 and 2 emissions every year against a recent base year, and explain any year off the target path.',
    financingNote: 'Annual absolute reductions are the key performance indicator in sustainability-linked loans and bonds.',
  },
  {
    id: 'ESG-Z3', pillar: 'Environmental', domain: 'Net Zero: Residual Emissions & Removals', frameworkRefs: ['SBTi Corporate Net-Zero Standard (reference)'],
    question: 'Does the plan cut most value-chain emissions first (about 90% in most sectors), neutralising only the residual emissions with durable carbon removals?',
    soe: { 0: 'Net zero is planned mainly through offsetting.', 1: 'Residual emissions are not defined.', 2: 'A residual share is estimated, without a plan for removals.',
      3: 'The plan cuts most value-chain emissions and limits neutralisation to residual emissions.', 4: 'Durable removals for the residual emissions are identified, with quality criteria.', 5: 'Removals are contracted or delivered and verified, and reported separately from reductions.' },
    evidence: 'Reduction pathway, residual emissions estimate, removal strategy and contracts.',
    recommendation: 'Define the residual emissions you cannot cut and plan durable, verified removals for those alone.',
    financingNote: 'Plans that rely on offsets instead of cuts are treated as greenwashing risk by investors and regulators.',
  },
  {
    id: 'ESG-Z4', pillar: 'Environmental', domain: 'Net Zero: Use of Carbon Credits', frameworkRefs: ['UN High-Level Expert Group on net-zero (reference)', 'SBTi (reference)'],
    question: 'Are carbon credits used only beyond, never instead of, the organisation\'s own reductions, and reported separately from them?',
    soe: { 0: 'Credits are used to claim reductions or carbon neutrality.', 1: 'Credits are counted towards interim targets.', 2: 'Credits are reported separately, but their quality is not assessed.',
      3: 'Credits are never counted towards targets and are reported separately.', 4: 'Credit quality is assessed against recognised integrity criteria.', 5: 'Credits fund mitigation beyond the value chain and are disclosed with full details.' },
    evidence: 'Carbon credit policy, retirement records, disclosure showing reductions and credits separately.',
    recommendation: 'Stop counting credits towards targets; report them separately as action beyond your value chain.',
    financingNote: 'Misused credits are a growing legal and reputational risk under green-claims rules.',
  },
  {
    id: 'ESG-C1', pillar: 'Environmental', domain: 'Carbon Credit Generation', optional: true,
    frameworkRefs: ['ICVCM Core Carbon Principles (reference)', 'Paris Agreement Article 6 (reference)'],
    question: 'Only if the organisation generates or plans to generate carbon credits: can it measure, report and independently verify the emission reductions it claims?',
    soe: { 0: 'Credits are planned or sold without a baseline or an approved methodology.', 1: 'A baseline exists, but no approved methodology or monitoring plan.',
      2: 'An approved methodology is chosen and monitoring has started; leakage and reversal risk are not yet accounted for.',
      3: 'The project is validated and registered on a recognised registry, and monitoring covers leakage and the buffer reserve.',
      4: 'Reductions are independently verified and credits issued with traceable serial numbers; national registration or authorisation is in place where required.',
      5: 'Every monitoring period is verified on schedule, issuances and retirements are disclosed, and double counting with national targets is ruled out.' },
    evidence: 'Methodology and monitoring plan, validation and verification reports, registry project page and issuance records, national registration or authorisation (Article 6 where credits are transferred abroad).',
    recommendation: 'Do not sell or promise credits until a third party has verified the reductions and a registry has issued them.',
    financingNote: 'Buyers and funders check registry records; credits sold before issuance or counted twice expose the organisation to refunds and fraud claims.',
  },
]

/** Questions every organisation answers: the basis for completion counts. */
export const CORE_ESG_QUESTIONS = ESG_QUESTIONS.filter((q) => !q.optional)
export const coreAnswered = (scores: Record<string, number>): number => CORE_ESG_QUESTIONS.filter((q) => q.id in scores).length

export function questionsForPillar(pillar: EsgPillar): EsgQuestion[] {
  return ESG_QUESTIONS.filter(q => q.pillar === pillar)
}

// ----------------------------------------------------------------------------
// Evidence verification (reviewer-scored, mirrors the 5-point verification
// scale used by independent ESG review platforms: Missing/Weak/Partial/
// Strong/Verified, rather than a flat "uploaded or not" checkbox).
// ----------------------------------------------------------------------------

export interface EvidenceLevel {
  value: number // 0-4
  label: string
  badge: string
}

export const EVIDENCE_LEVELS: EvidenceLevel[] = [
  { value: 0, label: 'Missing', badge: 'bg-rose-100 text-rose-700 border-rose-300' },
  { value: 1, label: 'Weak', badge: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 2, label: 'Partial', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 3, label: 'Strong', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 4, label: 'Verified', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
]

export const ESG_DOCS: Record<EsgPillar, string[]> = {
  Environmental: [
    'GHG emissions inventory',
    'Environmental permits & licences',
    'Environmental/Social Impact Assessment (ESIA)',
    'Climate risk assessment',
  ],
  Social: [
    'HR / labor policy manual',
    'Occupational health & safety policy',
    'Workforce diversity data',
    'Stakeholder engagement & grievance plan',
  ],
  Governance: [
    'Board charter & committee terms of reference',
    'Code of conduct / anti-corruption policy',
    'Risk register',
    'Latest audited financial statements',
  ],
}

export function docKey(pillar: string, doc: string): string {
  return `${pillar}::${doc}`
}

/** Mean evidence level (0-4) across a pillar's documents, scaled to 0-5 to match the response scale. 0 if nothing scored. */
export function pillarEvidenceScore(pillar: EsgPillar, evidence: Record<string, number>): number {
  const docs = ESG_DOCS[pillar]
  const scored = docs.filter(d => evidence[docKey(pillar, d)] != null)
  if (scored.length === 0) return 0
  const sum = scored.reduce((acc, d) => acc + (evidence[docKey(pillar, d)] ?? 0), 0)
  return Math.round(((sum / scored.length) * (5 / 4)) * 100) / 100
}

/** Share (0-100) of all documents scored "Strong" or "Verified". Drives the Confidence stat. */
export function evidenceCoveragePct(evidence: Record<string, number>): number {
  const allDocs = ESG_PILLARS.flatMap(p => ESG_DOCS[p.key].map(d => docKey(p.key, d)))
  if (allDocs.length === 0) return 0
  const strong = allDocs.filter(k => (evidence[k] ?? -1) >= 3).length
  return Math.round((strong / allDocs.length) * 100)
}

export type ConfidenceLevel = 'Low' | 'Medium' | 'High'

export function confidenceFromCoverage(coveragePct: number): ConfidenceLevel {
  if (coveragePct >= 70) return 'High'
  if (coveragePct >= 35) return 'Medium'
  return 'Low'
}

// ----------------------------------------------------------------------------
// Scoring
// ----------------------------------------------------------------------------

const GAP_THRESHOLD = 3 // below "Defined" counts as a gap
const STRENGTH_THRESHOLD = 4 // "Managed" or above counts as a strength
const RESPONSE_WEIGHT = 0.6
const EVIDENCE_WEIGHT = 0.4

/** Self-reported response score for a pillar (0-5), ignoring evidence. */
export function pillarScore(pillar: EsgPillar, scores: Record<string, number>): number {
  const qs = questionsForPillar(pillar)
  const answered = qs.filter(q => scores[q.id] != null)
  if (answered.length === 0) return 0
  const sum = answered.reduce((acc, q) => acc + (scores[q.id] ?? 0), 0)
  return Math.round((sum / answered.length) * 100) / 100
}

/** Blended 60% response + 40% evidence score for a pillar (0-5). */
export function pillarVerifiedScore(
  pillar: EsgPillar,
  scores: Record<string, number>,
  evidence: Record<string, number>,
): number {
  const response = pillarScore(pillar, scores)
  const ev = pillarEvidenceScore(pillar, evidence)
  return Math.round((response * RESPONSE_WEIGHT + ev * EVIDENCE_WEIGHT) * 100) / 100
}

function answeredPillars(scores: Record<string, number>) {
  return ESG_PILLARS.filter(p => questionsForPillar(p.key).some(q => scores[q.id] != null))
}

/** Composite self-reported response score (0-5) - what IPMC-style tools label "Response". */
export function compositeEsgScore(scores: Record<string, number>): number {
  const answered = answeredPillars(scores)
  if (answered.length === 0) return 0
  const sum = answered.reduce((acc, p) => acc + pillarScore(p.key, scores), 0)
  return Math.round((sum / answered.length) * 100) / 100
}

/** Composite blended response+evidence score (0-5) - the basis for the rating badge. */
export function compositeVerifiedScore(scores: Record<string, number>, evidence: Record<string, number>): number {
  const answered = answeredPillars(scores)
  if (answered.length === 0) return 0
  const sum = answered.reduce((acc, p) => acc + pillarVerifiedScore(p.key, scores, evidence), 0)
  return Math.round((sum / answered.length) * 100) / 100
}

export interface EsgGap {
  question: EsgQuestion
  score: number
}

/** Answered questions scoring below the "Defined" threshold, worst first. */
export function identifyGaps(scores: Record<string, number>): EsgGap[] {
  return ESG_QUESTIONS
    .filter(q => scores[q.id] != null && (scores[q.id] as number) < GAP_THRESHOLD)
    .map(q => ({ question: q, score: scores[q.id] as number }))
    .sort((a, b) => a.score - b.score)
}

/** Answered questions at "Managed" (4) or above, best first - the mirror of identifyGaps. */
export function identifyStrengths(scores: Record<string, number>): EsgGap[] {
  return ESG_QUESTIONS
    .filter(q => scores[q.id] != null && (scores[q.id] as number) >= STRENGTH_THRESHOLD)
    .map(q => ({ question: q, score: scores[q.id] as number }))
    .sort((a, b) => b.score - a.score)
}

/** Unanswered questions - these count against the badge but aren't "gaps" yet. */
export function unansweredQuestions(scores: Record<string, number>): EsgQuestion[] {
  return CORE_ESG_QUESTIONS.filter(q => scores[q.id] == null)
}

// ----------------------------------------------------------------------------
// ESG rating badge - mirrors mainstream letter-band ESG ratings (e.g. MSCI
// AAA-CCC) so the output is immediately legible to financiers and partners.
// Computed from the blended (response + evidence) score, not the raw
// self-report, and explicitly flagged "Provisional" until evidence coverage
// is high enough to trust - a self-assessment alone is never presented as a
// final or independent rating.
// ----------------------------------------------------------------------------

export interface EsgBadge {
  letter: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'Unrated'
  label: string
  cls: string
  provisional: boolean
}

const PROVISIONAL_COVERAGE_THRESHOLD = 70 // % of docs at "Strong"+ needed to lift the provisional flag

/** The original twelve questions the letter rating is based on. Later questions (maturity, nature, value chain) inform the
 *  maturity stage but don't withhold a rating from organisations that completed the original assessment. */
export const RATED_QUESTION_IDS = ['ESG-E1', 'ESG-E2', 'ESG-E3', 'ESG-E4', 'ESG-S1', 'ESG-S2', 'ESG-S3', 'ESG-S4', 'ESG-G1', 'ESG-G2', 'ESG-G3', 'ESG-G4']
export const ratedAnswered = (scores: Record<string, number>): number => RATED_QUESTION_IDS.filter((id) => id in scores).length

export function getEsgBadge(
  verifiedScore: number,
  totalAnswered: number,
  evidenceCoverage: number,
): EsgBadge {
  if (totalAnswered < RATED_QUESTION_IDS.length) {
    return { letter: 'Unrated', label: 'Unrated - assessment incomplete', cls: 'bg-slate-100 text-slate-600 border-slate-300', provisional: true }
  }
  const provisional = evidenceCoverage < PROVISIONAL_COVERAGE_THRESHOLD
  if (verifiedScore >= 4.5) return { letter: 'AAA', label: 'Leader', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', provisional }
  if (verifiedScore >= 4.0) return { letter: 'AA', label: 'Leader', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300', provisional }
  if (verifiedScore >= 3.5) return { letter: 'A', label: 'Strong Performer', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', provisional }
  if (verifiedScore >= 3.0) return { letter: 'BBB', label: 'Average Performer', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', provisional }
  if (verifiedScore >= 2.0) return { letter: 'BB', label: 'Below Average', cls: 'bg-amber-100 text-amber-700 border-amber-300', provisional }
  if (verifiedScore >= 1.0) return { letter: 'B', label: 'Laggard', cls: 'bg-rose-100 text-rose-700 border-rose-300', provisional }
  return { letter: 'CCC', label: 'High Risk', cls: 'bg-rose-100 text-rose-800 border-rose-400', provisional }
}

// ----------------------------------------------------------------------------
// Financing / investment / partnership / procurement / reporting positioning
// ----------------------------------------------------------------------------

export function financingPositioning(badge: EsgBadge, gaps: EsgGap[]): string {
  if (badge.letter === 'Unrated') {
    return 'Complete every question to unlock a rating. An incomplete ESG profile is typically treated as a "no" by ESG-linked financing screens, regardless of actual performance.'
  }
  const provisionalNote = badge.provisional
    ? ' This rating is provisional pending stronger supporting evidence - add or upgrade documents below to move it to a confirmed result.'
    : ''
  if (badge.letter === 'AAA' || badge.letter === 'AA') {
    return `This profile is strong enough to lead with ESG as a differentiator in financing, partnership, procurement and sustainability-reporting conversations - consider pursuing a sustainability-linked facility or publishing results to attract impact-focused capital.${provisionalNote}`
  }
  if (badge.letter === 'A' || badge.letter === 'BBB') {
    return `Fundable with standard ESG conditions attached, and a workable starting point for GRI/IFRS S1-S2/TCFD-aligned reporting. Closing the ${gaps.length} open gap(s) below would move this profile into the top rating band and remove the most common conditions financiers attach at this level.${provisionalNote}`
  }
  return `At this rating, most ESG-linked financing, DFI facilities and large-procurement tenders will treat ESG gaps as a blocking condition, not a minor note. Prioritize the ${Math.min(3, gaps.length)} lowest-scoring item(s) below before approaching financing, tender processes or sustainability disclosure.${provisionalNote}`
}

// ----------------------------------------------------------------------------
// Rating-agency translation
// ----------------------------------------------------------------------------
// CRAFT does not replicate, issue or predict a credit rating or an ESG rating
// from any agency. What follows is a reference layer explaining how the
// dimensions CRAFT already measures (here, and via the GFA Diagnostic's
// financial pillars) typically factor into how major rating agencies think -
// context for institutions preparing for external review, not a forecast.
//
// The agency descriptions below are factual summaries of publicly documented
// methodology positioning (Fitch's ESG Relevance Scores, Moody's Issuer
// Profile/Credit Impact Scores, S&P's materiality-gated approach to ESG in
// credit ratings) - not CRAFT's own claims about those agencies' processes.
// ----------------------------------------------------------------------------

export interface RatingAgencyMapping {
  dimension: EsgPillar | 'Financial'
  craftSignal: string
  agencyLens: string
  creditRelevance: string
}

export const RATING_AGENCY_MAP: RatingAgencyMapping[] = [
  {
    dimension: 'Financial',
    craftSignal: 'Cash management, controls, leverage and credibility pillars (CRAFT · GFA Business Diagnostic)',
    agencyLens: 'Earnings stability, financial flexibility, leverage, liquidity coverage',
    creditRelevance: 'The core driver of default risk and liquidity risk in any credit rating.',
  },
  {
    dimension: 'Governance',
    craftSignal: 'Board oversight, anti-corruption controls, risk management, transparency & disclosure, materiality, strategy integration and collective action (ESG-G1 to ESG-G6, ESG-V2)',
    agencyLens: 'Management quality, governance structure, internal controls, reporting reliability',
    creditRelevance: 'Weak governance is one of the most common drivers of negative rating actions.',
  },
  {
    dimension: 'Environmental',
    craftSignal: 'GHG emissions management, resource/waste efficiency, environmental compliance, climate risk exposure, reduction targets and nature (ESG-E1 to ESG-E5, ESG-N1 to ESG-N3)',
    agencyLens: 'Physical and transition climate risk, regulatory exposure, asset and capex impact',
    creditRelevance: 'Can affect operating costs, capital expenditure, asset values and regulatory risk over the rating horizon.',
  },
  {
    dimension: 'Social',
    craftSignal: 'Labor practices, health & safety, DEI, community & stakeholder engagement and value chain (ESG-S1 to ESG-S4, ESG-V1)',
    agencyLens: 'Social licence to operate, litigation exposure, workforce and community relations',
    creditRelevance: 'Can translate into operational disruption, regulatory intervention or reputational and revenue impact.',
  },
]

export interface RatingAgencyReference {
  name: string
  note: string
}

export const RATING_AGENCY_REFERENCES: RatingAgencyReference[] = [
  {
    name: 'Fitch Ratings',
    note: 'Publishes ESG Relevance Scores showing whether and how much an ESG factor influenced a specific credit-rating decision - not a standalone ESG score.',
  },
  {
    name: "Moody's Ratings",
    note: 'Integrates ESG considerations into credit analysis through Issuer Profile Scores (IPS) and Credit Impact Scores (CIS), rather than a separate ESG rating.',
  },
  {
    name: 'S&P Global Ratings',
    note: 'Factors ESG into credit ratings only when an ESG issue is material to creditworthiness and sufficiently visible.',
  },
  {
    name: 'MSCI, Sustainalytics, CDP, GRESB, ISS ESG',
    note: 'Pure-play ESG raters - score ESG performance and risk independently of credit analysis, unlike the credit agencies above.',
  },
]

export const AGENCY_TRANSLATION_DISCLAIMER =
  "CRAFT does not replicate, issue or predict any credit rating or ESG rating from Fitch, Moody's, S&P, MSCI, Sustainalytics or any other agency. This section explains how the dimensions CRAFT already measures typically factor into how those agencies approach credit and ESG analysis, as context for institutions preparing for external review - it is not a forecast of any specific agency outcome."
