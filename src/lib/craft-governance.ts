/**
 * CRAFT GOVERNANCE SCORECARD
 *
 * A ten-pillar governance assessment framework for African institutions.
 * Pillars are independent domains of governance quality that aggregate into
 * an overall institutional score.
 */

export type GovernancePillarId =
  | 'leadership'
  | 'ethics'
  | 'accountability'
  | 'riskmanagement'
  | 'financial'
  | 'operational'
  | 'people'
  | 'sustainability'
  | 'data'
  | 'resilience'

export interface GovernancePillar {
  id: GovernancePillarId
  name: string
  description: string
  intendedOutcome: string
  weight: number // 0-100, should sum to ~100 across all pillars
  icon: string
  theme: 'emerald' | 'indigo' | 'amber' | 'blue' | 'violet' | 'teal' | 'rose' | 'fuchsia' | 'cyan' | 'lime'
}

export interface GovernanceCriterion {
  id: string
  pillarId: GovernancePillarId
  name: string
  description: string
  assessmentQuestions: string[]
  weight: number // Within pillar
  applicability: 'mandatory' | 'sector-specific' | 'voluntary' | 'best-practice'
  sourceReferences: SourceReference[]
  scoringRubric: ScoringRubric
  requiredDocumentation: string[]
  evidenceRequirements: string[]
  recommendedAction: string
  // Criteria that only apply to some institutions (e.g. those funding or supporting innovation).
  appliesTo?: 'innovation_support'
}

export interface SourceReference {
  framework: string
  jurisdiction?: string
  section?: string
  url?: string
  verifiedDate: string
  authority: 'regulatory' | 'exchange' | 'voluntary' | 'craft'
}

export interface ScoringRubric {
  level5: { label: string; description: string }
  level4: { label: string; description: string }
  level3: { label: string; description: string }
  level2: { label: string; description: string }
  level1: { label: string; description: string }
}

export interface GovernanceAssessmentResponse {
  id: string
  organisationId: string
  assessmentId: string
  reportingPeriod: string
  status: 'draft' | 'in-progress' | 'submitted' | 'under-review' | 'approved'
  responses: Record<string, { criterionId: string; score: 1 | 2 | 3 | 4 | 5; evidence?: string; notes?: string }>
  pillarWeights: Record<GovernancePillarId, number>
  missingDocuments: string[]
  mandatoryFailures: string[]
  createdAt: Date
  updatedAt: Date
  submittedAt?: Date
  reviewedAt?: Date
  reviewedBy?: string
  comments?: string
}

export interface GovernanceScorecard {
  organisationId: string
  assessmentId: string
  reportingPeriod: string
  overallScore: number // 0-100
  overallRating: RatingBand
  pillarScores: Record<GovernancePillarId, { score: number; rating: RatingBand }>
  strongAreas: { pillarId: GovernancePillarId; score: number; reason: string }[]
  weakAreas: { pillarId: GovernancePillarId; score: number; reason: string }[]
  criticalFindings: Finding[]
  missingEvidence: MissingEvidence[]
  recommendations: GovernanceRecommendation[]
  generatedAt: Date
  methodology: {
    version: string
    isProvisional: boolean
    weights: Record<GovernancePillarId, number>
    assumptions: string[]
  }
}

export interface RatingBand {
  level: 'Emerging' | 'Developing' | 'Established' | 'Advanced' | 'Exemplary'
  score: number
  description: string
  color: string
}

export interface Finding {
  id: string
  criterionId: string
  pillarId: GovernancePillarId
  description: string
  severity: 'critical' | 'high' | 'moderate'
  requirement: string
  sourceReference?: SourceReference
}

export interface MissingEvidence {
  criterionId: string
  documentType: string
  status: 'missing' | 'requested' | 'under-review' | 'rejected'
}

export interface GovernanceRecommendation {
  id: string
  findingId: string
  criterionId: string
  pillarId: GovernancePillarId
  gap: string
  rationale: string
  recommendedAction: string
  owner?: string
  resources?: string
  evidenceOfCompletion?: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  estimatedTimeframe?: string
  verificationMethod?: string
}

export interface GovernanceDocumentRegister {
  id: string
  organisationId: string
  reportingPeriod: string
  documents: DocumentRecord[]
}

export interface DocumentRecord {
  id: string
  name: string
  category: string
  linkedCriteria: string[]
  responsibleOfficer?: string
  uploadStatus: 'missing' | 'requested' | 'uploaded' | 'under-review' | 'accepted' | 'rejected' | 'expired'
  version?: string
  uploadedDate?: Date
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  reviewerComments?: string
  expiryDate?: Date
  accessPermissions?: string[]
}

/**
 * CRAFT Governance Pillars - ten-pillar model for African institutions
 */
export const GOVERNANCE_PILLARS: Record<GovernancePillarId, GovernancePillar> = {
  leadership: {
    id: 'leadership',
    name: 'Leadership, Board Effectiveness and Strategic Direction',
    description:
      'The quality of board governance, strategic planning, and institutional leadership that sets the direction for sustainable value creation.',
    intendedOutcome:
      'An effective board that provides strategic oversight, ensures sound decision-making, and holds management accountable.',
    weight: 12,
    icon: 'Shield',
    theme: 'emerald',
  },
  ethics: {
    id: 'ethics',
    name: 'Ethics, Integrity and Organisational Culture',
    description:
      'Institutional commitment to ethical behaviour, integrity, and a culture that reinforces accountability at all levels.',
    intendedOutcome:
      'A strong ethical culture where integrity is demonstrated through policies, practices, and leadership example.',
    weight: 10,
    icon: 'Heart',
    theme: 'rose',
  },
  accountability: {
    id: 'accountability',
    name: 'Accountability, Transparency and Stakeholder Engagement',
    description:
      'Clear lines of accountability, transparent reporting, and meaningful engagement with stakeholders.',
    intendedOutcome:
      'Stakeholders have trust in the institution through transparent communication and responsive engagement.',
    weight: 10,
    icon: 'Eye',
    theme: 'indigo',
  },
  riskmanagement: {
    id: 'riskmanagement',
    name: 'Risk Management, Internal Controls and Assurance',
    description:
      'Comprehensive identification, assessment, and management of institutional risks with effective internal controls.',
    intendedOutcome:
      'Risks are identified, assessed, and managed to acceptable levels with robust internal controls and assurance.',
    weight: 12,
    icon: 'AlertTriangle',
    theme: 'amber',
  },
  financial: {
    id: 'financial',
    name: 'Financial Stewardship and Fiduciary Responsibility',
    description:
      'Sound financial management, effective stewardship of resources, and reliable financial reporting.',
    intendedOutcome:
      'Financial resources are managed with integrity and reported with accuracy and timeliness.',
    weight: 11,
    icon: 'Banknote',
    theme: 'teal',
  },
  operational: {
    id: 'operational',
    name: 'Operational Capability, Performance and Service Delivery',
    description:
      'Institutional capacity to execute strategy, deliver services efficiently, and achieve performance targets.',
    intendedOutcome:
      'The institution operates efficiently and delivers quality services that meet stakeholder needs.',
    weight: 9,
    icon: 'Zap',
    theme: 'lime',
  },
  people: {
    id: 'people',
    name: 'People, Inclusion and Human-Capital Management',
    description:
      'Institutional commitment to developing capable people, promoting diversity, and creating an inclusive workplace.',
    intendedOutcome:
      'The institution attracts, develops, and retains talented people in an inclusive and enabling environment.',
    weight: 9,
    icon: 'Users',
    theme: 'violet',
  },
  sustainability: {
    id: 'sustainability',
    name: 'Sustainability, Climate and Responsible Value Creation',
    description:
      'Integration of environmental and social considerations into business strategy and decision-making.',
    intendedOutcome:
      'The institution creates sustainable value while managing environmental and social impacts responsibly.',
    weight: 9,
    icon: 'Leaf',
    theme: 'emerald',
  },
  data: {
    id: 'data',
    name: 'Data Governance, Cybersecurity and Digital Accountability',
    description:
      'Effective governance of data, protection of information systems, and responsible use of digital technology.',
    intendedOutcome:
      'Data and digital assets are secure, well-managed, and used responsibly.',
    weight: 9,
    icon: 'Lock',
    theme: 'cyan',
  },
  resilience: {
    id: 'resilience',
    name: 'Institutional Resilience, Continuity and Succession',
    description:
      'Institutional capacity to anticipate disruptions, maintain continuity, and plan for sustainable succession.',
    intendedOutcome:
      'The institution can withstand shocks and continue operating through robust contingency planning and succession.',
    weight: 9,
    icon: 'Shield',
    theme: 'fuchsia',
  },
}

// Provisional CRAFT rating bands
export const RATING_BANDS: RatingBand[] = [
  {
    level: 'Emerging',
    score: 0,
    description: 'Governance practices are foundational or inconsistent. Significant improvements required.',
    color: 'text-red-600 bg-red-50',
  },
  {
    level: 'Developing',
    score: 40,
    description: 'Some governance practices are in place but not consistently applied. Development needed.',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    level: 'Established',
    score: 60,
    description: 'Governance practices are established and mostly effective. Continued enhancement recommended.',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    level: 'Advanced',
    score: 80,
    description: 'Governance practices are robust and well-embedded. Regular review and evolution encouraged.',
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    level: 'Exemplary',
    score: 90,
    description: 'Governance practices exemplify leading practice. Continuous innovation encouraged.',
    color: 'text-indigo-600 bg-indigo-50',
  },
]

export function getRatingBand(score: number): RatingBand {
  if (score < 40) return RATING_BANDS[0]
  if (score < 60) return RATING_BANDS[1]
  if (score < 80) return RATING_BANDS[2]
  if (score < 90) return RATING_BANDS[3]
  return RATING_BANDS[4]
}

/**
 * Validate scoring inputs before calculation
 */
export function validateScoringInputs(
  weights: Record<GovernancePillarId, number>,
  responses: Record<string, number>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check weight sum
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0)
  if (Math.abs(weightSum - 100) > 0.5) {
    errors.push(`Pillar weights sum to ${weightSum}, expected 100`)
  }

  // Check weights are non-negative
  for (const [pillar, weight] of Object.entries(weights)) {
    if (weight < 0) errors.push(`Pillar ${pillar} has negative weight: ${weight}`)
  }

  // Check scores are in range
  for (const [id, score] of Object.entries(responses)) {
    if (score < 1 || score > 5) {
      errors.push(`Response ${id} has invalid score: ${score}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Calculate weighted pillar score
 */
export function calculatePillarScore(
  criteriaScores: Array<{ weight: number; score: number }>,
): number {
  if (criteriaScores.length === 0) return 0
  const weightSum = criteriaScores.reduce((sum, c) => sum + c.weight, 0)
  if (weightSum === 0) return 0
  const weighted = criteriaScores.reduce((sum, c) => sum + c.score * c.weight, 0)
  return Math.round((weighted / weightSum / 5) * 100)
}

/**
 * Calculate overall scorecard score from pillar scores
 */
export function calculateOverallScore(
  pillarScores: Record<GovernancePillarId, number>,
  weights: Record<GovernancePillarId, number>,
): number {
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0)
  if (weightSum === 0) return 0
  const weighted = (Object.entries(pillarScores) as Array<[GovernancePillarId, number]>).reduce(
    (sum, [pillarId, score]) => sum + (score * (weights[pillarId] ?? 0)) / 100,
    0,
  )
  return Math.round(weighted)
}

// ============================================================================
// Provisional CRAFT criteria (methodology CRAFT-GS 0.1). Original CRAFT content,
// "informed by" the named frameworks — not a reproduction of, or equivalence to,
// any of them. Source references carry no verifiedDate until checked.
// ============================================================================
export const METHODOLOGY = {
  version: 'CRAFT-GS 0.1',
  isProvisional: true,
  evidenceCap: 2,
  assumptions: [
    'Provisional CRAFT methodology: weights, criteria and rating bands have not been externally validated.',
    'Each criterion is scored 1–5 against the shared rubric; criteria within a pillar carry equal weight.',
    'A score without supporting evidence counts at most 2 (Initial): a policy on paper is not verified practice.',
    'Not-applicable criteria require a reason and are excluded from the pillar score; unanswered criteria are reported, not scored.',
    'The overall score renormalises pillar weights over the pillars that have at least one scored criterion.',
    'A CRAFT score is not a certification, credit rating, assurance opinion or official score of any governance code.',
    'Founder-protection criteria apply only to institutions that fund or support innovation (incubators, accelerators, startup competitions, innovation funders). They assess safeguards within the institution’s control and do not replace legislation, legal advice or an effective justice system.',
  ],
}

export const SHARED_RUBRIC: ScoringRubric = {
  level1: { label: 'Absent', description: 'No practice, policy or owner exists.' },
  level2: { label: 'Initial', description: 'Some practice exists but is informal, inconsistent or undocumented.' },
  level3: { label: 'Defined', description: 'Documented, approved and assigned; implementation partly evidenced.' },
  level4: { label: 'Implemented', description: 'Applied consistently across the defined scope and monitored.' },
  level5: { label: 'Embedded and reviewed', description: 'Effectiveness is reviewed periodically and improvements are evidenced.' },
}

const ref = (framework: string, authority: SourceReference['authority'], jurisdiction?: string): SourceReference =>
  ({ framework, jurisdiction, authority, verifiedDate: '' })
const NCCG = ref('Nigerian Code of Corporate Governance (FRCN)', 'regulatory', 'NG')
const KING = ref('King Report on Corporate Governance', 'voluntary', 'ZA')
const MWONGOZO = ref('Mwongozo Code of Governance for State Corporations', 'regulatory', 'KE')
const OECD = ref('G20/OECD Principles of Corporate Governance', 'voluntary')
const OECD_SOE = ref('OECD Guidelines on Corporate Governance of State-Owned Enterprises', 'voluntary')
const COSO = ref('COSO Internal Control — Integrated Framework', 'voluntary')
const ISO31000 = ref('ISO 31000 Risk management', 'voluntary')
const ISO22301 = ref('ISO 22301 Business continuity management', 'voluntary')
const ISO27001 = ref('ISO/IEC 27001 Information security management', 'voluntary')
const NDPA = ref('Nigeria Data Protection Act 2023', 'regulatory', 'NG')
const ISSB = ref('IFRS S1 / IFRS S2', 'voluntary')
const GRI = ref('GRI Standards', 'voluntary')
const ISO37001 = ref('ISO 37001 Anti-bribery management systems', 'voluntary')
const APRM = ref('African Peer Review Mechanism', 'voluntary')
const CRAFT_GP = ref('CRAFT good practice — founder protection and innovation governance', 'craft')

type C = Omit<GovernanceCriterion, 'weight' | 'scoringRubric' | 'applicability'> & Partial<Pick<GovernanceCriterion, 'applicability'>>
const c = (x: C): GovernanceCriterion => ({ weight: 1, scoringRubric: SHARED_RUBRIC, applicability: 'best-practice', ...x })

export const GOVERNANCE_CRITERIA: GovernanceCriterion[] = [
  // 1 Leadership
  c({ id: 'LDR-1', pillarId: 'leadership', name: 'Board mandate and composition', description: 'The governing body has a documented mandate, appropriate skills mix and independence.', assessmentQuestions: ['Is there an approved board charter defining roles, powers and reserved matters?', 'Is the skills, diversity and independence mix reviewed against the institution’s needs?'], sourceReferences: [NCCG, KING, MWONGOZO, OECD], requiredDocumentation: ['Board charter', 'Board composition and skills matrix'], evidenceRequirements: ['Approved charter', 'Latest composition review'], recommendedAction: 'Approve or update the board charter and run a documented skills and independence review.' }),
  c({ id: 'LDR-2', pillarId: 'leadership', name: 'Strategy oversight', description: 'The board approves strategy and monitors delivery against it.', assessmentQuestions: ['Is there a board-approved strategic plan?', 'Does the board receive periodic performance reports against that plan?'], sourceReferences: [NCCG, KING, OECD_SOE], requiredDocumentation: ['Strategic plan', 'Board performance reports'], evidenceRequirements: ['Board minutes approving strategy', 'Recent performance report'], recommendedAction: 'Adopt a board-approved strategy with indicators and a fixed reporting cadence to the board.' }),
  c({ id: 'LDR-3', pillarId: 'leadership', name: 'Board evaluation and delegation', description: 'Board effectiveness is evaluated and authority is delegated through a documented framework.', assessmentQuestions: ['Has a board evaluation been carried out in the last two years?', 'Is there an approved delegation-of-authority framework?'], sourceReferences: [NCCG, KING, MWONGOZO], requiredDocumentation: ['Board evaluation report', 'Delegation of authority'], evidenceRequirements: ['Evaluation report and action plan', 'Approved delegation matrix'], recommendedAction: 'Commission a board evaluation and approve a delegation-of-authority matrix.' }),
  // 2 Ethics
  c({ id: 'ETH-1', pillarId: 'ethics', name: 'Code of conduct', description: 'A code of conduct is approved, communicated and acknowledged.', assessmentQuestions: ['Is there an approved code of conduct?', 'Do staff and directors acknowledge it periodically?'], sourceReferences: [NCCG, KING, MWONGOZO], requiredDocumentation: ['Code of conduct'], evidenceRequirements: ['Approved code', 'Acknowledgement records'], recommendedAction: 'Approve a code of conduct and collect annual acknowledgements from staff and directors.' }),
  c({ id: 'ETH-2', pillarId: 'ethics', name: 'Conflicts of interest and anti-bribery', description: 'Conflicts are declared and managed; bribery risks are controlled.', assessmentQuestions: ['Are conflict-of-interest declarations collected and reviewed?', 'Is there an anti-bribery policy with controls?'], sourceReferences: [NCCG, ISO37001, OECD], requiredDocumentation: ['Conflict-of-interest policy', 'Declarations register', 'Anti-bribery policy'], evidenceRequirements: ['Completed declarations', 'Exceptions handled'], recommendedAction: 'Introduce a declarations register with periodic review and an anti-bribery policy with assigned controls.' }),
  c({ id: 'ETH-3', pillarId: 'ethics', name: 'Speak-up and whistleblowing', description: 'Concerns can be raised anonymously and are investigated without retaliation.', assessmentQuestions: ['Is there an anonymous reporting channel?', 'Are reports tracked to resolution and reported to the board?'], sourceReferences: [NCCG, KING, MWONGOZO], requiredDocumentation: ['Whistleblowing policy', 'Case log'], evidenceRequirements: ['Anonymous channel in operation', 'Case statistics reported to the board'], recommendedAction: 'Set up an anonymous channel, a case log and periodic reporting of case statistics to the board.' }),
  // 3 Accountability
  c({ id: 'ACC-1', pillarId: 'accountability', name: 'Roles and accountability', description: 'Responsibilities are documented and decisions are recorded.', assessmentQuestions: ['Is there an accountability matrix for key decisions?', 'Are decisions minuted with owners and actions?'], sourceReferences: [KING, MWONGOZO, OECD_SOE], requiredDocumentation: ['Accountability matrix', 'Minutes'], evidenceRequirements: ['Approved matrix', 'Sample minutes with action owners'], recommendedAction: 'Document an accountability (RACI) matrix and record decisions with owners and due dates.' }),
  c({ id: 'ACC-2', pillarId: 'accountability', name: 'Public and stakeholder disclosure', description: 'Material information is disclosed to stakeholders in a timely way.', assessmentQuestions: ['Are annual reports and financial statements published on time?', 'Is there a disclosure policy?'], sourceReferences: [NCCG, OECD, APRM], requiredDocumentation: ['Annual report', 'Disclosure policy'], evidenceRequirements: ['Published report', 'Publication dates'], recommendedAction: 'Adopt a disclosure policy and a publication calendar for annual and periodic reporting.' }),
  c({ id: 'ACC-3', pillarId: 'accountability', name: 'Stakeholder engagement', description: 'Stakeholders are identified and engaged, and their concerns feed decisions.', assessmentQuestions: ['Is there a stakeholder map and engagement plan?', 'Is feedback recorded and acted on?'], sourceReferences: [KING, GRI, APRM], requiredDocumentation: ['Stakeholder map', 'Engagement records'], evidenceRequirements: ['Engagement plan', 'Record of actions taken on feedback'], recommendedAction: 'Map stakeholders, agree an engagement plan and record how feedback changed decisions.' }),
  // 4 Risk
  c({ id: 'RSK-1', pillarId: 'riskmanagement', name: 'Risk management framework', description: 'Material risks are identified, owned, assessed and monitored.', assessmentQuestions: ['Is there an approved risk framework and risk appetite?', 'Is the risk register reviewed at least quarterly?'], sourceReferences: [ISO31000, COSO, NCCG], requiredDocumentation: ['Risk framework', 'Risk register'], evidenceRequirements: ['Approved framework', 'Recent register review'], recommendedAction: 'Approve a risk framework and appetite, and review an owned risk register on a fixed cadence.' }),
  c({ id: 'RSK-2', pillarId: 'riskmanagement', name: 'Internal controls', description: 'Key controls are documented, owned and tested.', assessmentQuestions: ['Are key controls documented with owners?', 'Are control failures logged and remediated?'], sourceReferences: [COSO, NCCG], requiredDocumentation: ['Control matrix', 'Control test results'], evidenceRequirements: ['Control matrix', 'Test results and remediation log'], recommendedAction: 'Document key controls with owners and test them, logging failures into the corrective action plan.' }),
  c({ id: 'RSK-3', pillarId: 'riskmanagement', name: 'Internal audit and assurance', description: 'An independent internal audit function reports to the board or audit committee.', assessmentQuestions: ['Is there an approved, risk-based internal audit plan?', 'Are audit findings tracked to closure?'], sourceReferences: [NCCG, KING, MWONGOZO], requiredDocumentation: ['Internal audit charter and plan', 'Audit reports'], evidenceRequirements: ['Approved plan', 'Finding-tracking report'], recommendedAction: 'Approve a risk-based audit plan and track every audit finding to verified closure.' }),
  // 5 Financial
  c({ id: 'FIN-1', pillarId: 'financial', name: 'Budgeting and financial control', description: 'Budgets are approved and expenditure is controlled and reconciled.', assessmentQuestions: ['Is the budget approved and monitored against actuals?', 'Are bank and ledger reconciliations performed monthly?'], sourceReferences: [COSO, OECD_SOE], requiredDocumentation: ['Approved budget', 'Reconciliations'], evidenceRequirements: ['Budget-vs-actual reports', 'Signed reconciliations'], recommendedAction: 'Introduce monthly budget-vs-actual reporting and signed reconciliations.' }),
  c({ id: 'FIN-2', pillarId: 'financial', name: 'Financial reporting and external audit', description: 'Financial statements are prepared on time and externally audited.', assessmentQuestions: ['Were the latest financial statements audited within the statutory deadline?', 'Are audit management-letter points resolved?'], sourceReferences: [NCCG, OECD], requiredDocumentation: ['Audited financial statements', 'Management letter'], evidenceRequirements: ['Audit report', 'Management-letter response tracker'], recommendedAction: 'Set a reporting timetable to meet audit deadlines and track management-letter points to closure.' }),
  c({ id: 'FIN-3', pillarId: 'financial', name: 'Procurement and asset stewardship', description: 'Procurement is competitive and documented; assets are recorded and safeguarded.', assessmentQuestions: ['Is there a procurement policy with thresholds and approvals?', 'Is there a reconciled fixed-asset register?'], sourceReferences: [OECD_SOE, COSO], requiredDocumentation: ['Procurement policy', 'Asset register'], evidenceRequirements: ['Sampled procurement files', 'Asset verification'], recommendedAction: 'Adopt procurement thresholds with approval evidence and verify the asset register annually.' }),
  // 6 Operational
  c({ id: 'OPS-1', pillarId: 'operational', name: 'Documented core processes', description: 'Core processes are documented and followed.', assessmentQuestions: ['Are standard operating procedures documented for core services?'], sourceReferences: [KING, OECD_SOE], requiredDocumentation: ['Standard operating procedures'], evidenceRequirements: ['Approved SOPs', 'Evidence of use'], recommendedAction: 'Document SOPs for core services and check adherence by sampling.' }),
  c({ id: 'OPS-2', pillarId: 'operational', name: 'Performance management', description: 'Performance indicators are set, monitored and acted on.', assessmentQuestions: ['Are KPIs defined for core services and reviewed by management?'], sourceReferences: [MWONGOZO, OECD_SOE], requiredDocumentation: ['KPI framework', 'Performance reports'], evidenceRequirements: ['Management review records'], recommendedAction: 'Define service KPIs and hold periodic management reviews with recorded actions.' }),
  c({ id: 'OPS-3', pillarId: 'operational', name: 'Service quality and complaints', description: 'Service users can complain and complaints are resolved and analysed.', assessmentQuestions: ['Is there a complaints process with tracked resolution times?'], sourceReferences: [APRM, KING], requiredDocumentation: ['Complaints procedure', 'Complaints log'], evidenceRequirements: ['Resolution statistics'], recommendedAction: 'Introduce a complaints log with resolution targets and periodic trend analysis.' }),
  // 7 People
  c({ id: 'PPL-1', pillarId: 'people', name: 'Workforce planning and capability', description: 'Skills needs are planned and capability is developed.', assessmentQuestions: ['Is there a workforce plan and a training plan linked to strategy?'], sourceReferences: [KING, GRI], requiredDocumentation: ['Workforce plan', 'Training plan'], evidenceRequirements: ['Training records'], recommendedAction: 'Prepare a workforce plan and a training plan tied to strategic priorities.' }),
  c({ id: 'PPL-2', pillarId: 'people', name: 'Inclusion and fair treatment', description: 'Policies promote inclusion, equal pay and non-discrimination.', assessmentQuestions: ['Are inclusion and non-discrimination policies in place and monitored?'], sourceReferences: [GRI, KING], requiredDocumentation: ['Inclusion policy', 'Workforce data'], evidenceRequirements: ['Monitoring report'], recommendedAction: 'Adopt inclusion and equal-pay policies and monitor workforce data against them.' }),
  c({ id: 'PPL-3', pillarId: 'people', name: 'Safeguarding and health and safety', description: 'People are protected from harm, abuse and unsafe conditions.', assessmentQuestions: ['Are safeguarding and health-and-safety policies in place with incident reporting?'], sourceReferences: [GRI], requiredDocumentation: ['Safeguarding policy', 'Health and safety policy', 'Incident log'], evidenceRequirements: ['Incident statistics and follow-up'], recommendedAction: 'Adopt safeguarding and health-and-safety policies with an incident log and follow-up.' }),
  // 8 Sustainability
  c({ id: 'SUS-1', pillarId: 'sustainability', name: 'Material sustainability topics', description: 'Material environmental and social topics are identified and governed.', assessmentQuestions: ['Has a materiality assessment been carried out?', 'Is board oversight of sustainability defined?'], sourceReferences: [ISSB, GRI, KING], requiredDocumentation: ['Materiality assessment', 'Sustainability policy'], evidenceRequirements: ['Board-approved material topics'], recommendedAction: 'Run a materiality assessment and assign board oversight of the material topics.' }),
  c({ id: 'SUS-2', pillarId: 'sustainability', name: 'Climate-related risks', description: 'Climate-related risks and opportunities are assessed and integrated into risk management.', assessmentQuestions: ['Are climate-related risks in the risk register?', 'Are GHG emissions measured?'], sourceReferences: [ISSB], requiredDocumentation: ['Climate risk assessment', 'GHG inventory'], evidenceRequirements: ['Register entries', 'Emissions calculation'], recommendedAction: 'Add climate-related risks to the risk register and start a Scope 1 and 2 GHG inventory.' }),
  c({ id: 'SUS-3', pillarId: 'sustainability', name: 'Sustainability metrics and disclosure', description: 'Sustainability metrics and targets are set and reported reliably.', assessmentQuestions: ['Are sustainability metrics defined, owned and reported?'], sourceReferences: [ISSB, GRI], requiredDocumentation: ['Metric definitions', 'Sustainability report'], evidenceRequirements: ['Data owner matrix', 'Published disclosures'], recommendedAction: 'Define sustainability metrics with owners and include them in periodic reporting.' }),
  // 9 Data
  c({ id: 'DAT-1', pillarId: 'data', name: 'Data protection and privacy', description: 'Personal data is processed lawfully with documented controls.', assessmentQuestions: ['Is there a data protection policy and a record of processing?', 'Is a data protection officer or lead designated?'], sourceReferences: [NDPA], requiredDocumentation: ['Data protection policy', 'Record of processing'], evidenceRequirements: ['Designation letter', 'Privacy notices'], recommendedAction: 'Designate a data protection lead, adopt a policy and keep a record of processing activities.' }),
  c({ id: 'DAT-2', pillarId: 'data', name: 'Cybersecurity controls', description: 'Information systems are protected and incidents are managed.', assessmentQuestions: ['Are access reviews, backups and incident response in place and tested?'], sourceReferences: [ISO27001], requiredDocumentation: ['Information security policy', 'Incident response plan'], evidenceRequirements: ['Access review records', 'Backup test results'], recommendedAction: 'Introduce periodic access reviews, tested backups and an incident response plan.' }),
  c({ id: 'DAT-3', pillarId: 'data', name: 'Data quality and governance', description: 'Key data has owners, definitions and quality checks.', assessmentQuestions: ['Do critical datasets have owners and quality checks?'], sourceReferences: [COSO], requiredDocumentation: ['Data inventory', 'Data dictionary'], evidenceRequirements: ['Quality-check records'], recommendedAction: 'Inventory critical datasets, assign owners and schedule quality checks.' }),
  // Innovation-support overlay: founder protection, IP governance, fair contracting and redress.
  c({ id: 'ETH-4', pillarId: 'ethics', appliesTo: 'innovation_support', applicability: 'sector-specific', name: 'Fair and transparent founder contracting', description: 'Equity, IP-assignment and other obligations asked of founders are documented, proportionate and agreed with informed consent.', assessmentQuestions: ['Are equity terms, founder obligations and any IP assignment disclosed in writing before founders apply or commit?', 'Is informed consent recorded, with time and access to independent advice before signing?', 'Are terms reviewed for proportionality against the value the programme provides?'], sourceReferences: [CRAFT_GP], requiredDocumentation: ['Standard term sheet or participation agreement', 'Pre-application disclosure pack', 'Signed consent records'], evidenceRequirements: ['Published terms predating applications', 'Consent records for a sample of founders'], recommendedAction: 'Publish standard terms before applications open, record informed consent and give founders time and access to independent advice before they sign.' }),
  c({ id: 'DAT-4', pillarId: 'data', appliesTo: 'innovation_support', applicability: 'sector-specific', name: 'Intellectual property and confidential information safeguards', description: 'Ideas, IP and confidential information submitted by every participant — not only the winners — are protected.', assessmentQuestions: ['Are IP ownership and licensing terms clear for every stage of the programme?', 'Are there written rules for handling submitted ideas, including for unsuccessful applicants?', 'Is access to proprietary submissions restricted, logged and time-limited, with deletion or return on exit?'], sourceReferences: [CRAFT_GP], requiredDocumentation: ['IP and confidentiality policy', 'Submission-handling procedure', 'Confidentiality undertakings for judges, mentors and staff'], evidenceRequirements: ['Access logs for submissions', 'Deletion or return records for unsuccessful applicants'], recommendedAction: 'Adopt an IP and submission-handling policy covering all participants, bind judges and mentors to confidentiality, and restrict, log and expire access to submissions.' }),
  c({ id: 'ACC-4', pillarId: 'accountability', appliesTo: 'innovation_support', applicability: 'sector-specific', name: 'Accessible grievance and dispute resolution for founders', description: 'Founders and participants can raise complaints and have them resolved or referred within defined timelines.', assessmentQuestions: ['Is there an accessible complaint channel for founders and participants, including after the programme?', 'Are escalation steps and response timelines defined and met?', 'Are cases documented through resolution or referral (for example to mediation or arbitration), without retaliation?'], sourceReferences: [CRAFT_GP], requiredDocumentation: ['Grievance and dispute-resolution procedure', 'Case log with dates'], evidenceRequirements: ['Response and resolution times against targets', 'Referral records'], recommendedAction: 'Publish a grievance procedure with escalation steps and response timelines, log every case to resolution or referral, and report timeliness to the board.' }),
  c({ id: 'RSK-4', pillarId: 'riskmanagement', appliesTo: 'innovation_support', applicability: 'sector-specific', name: 'Demonstrable founder-safeguard accountability', description: 'Someone owns founder safeguards; breaches are tracked as corrective actions and followed up.', assessmentQuestions: ['Is an accountable owner assigned for founder safeguards?', 'Are breaches of commitments to founders recorded and tracked to verified closure?', 'Does the board or funder receive periodic reporting on safeguards and breaches?'], sourceReferences: [CRAFT_GP], requiredDocumentation: ['Responsibility matrix', 'Breach register'], evidenceRequirements: ['Corrective actions linked to breaches', 'Board or funder reports'], recommendedAction: 'Assign an owner for founder safeguards, log breaches as corrective actions with evidence-based closure, and report them to the board or funder.' }),
  // 10 Resilience
  c({ id: 'RES-1', pillarId: 'resilience', name: 'Business continuity', description: 'Critical functions can continue through disruption.', assessmentQuestions: ['Is there a tested business continuity plan for critical functions?'], sourceReferences: [ISO22301], requiredDocumentation: ['Business continuity plan', 'Test report'], evidenceRequirements: ['Latest exercise report'], recommendedAction: 'Prepare a business continuity plan for critical functions and exercise it annually.' }),
  c({ id: 'RES-2', pillarId: 'resilience', name: 'Leadership succession', description: 'Succession for the board and key roles is planned.', assessmentQuestions: ['Is there a succession plan for the board, CEO and key roles?'], sourceReferences: [NCCG, KING, MWONGOZO], requiredDocumentation: ['Succession plan'], evidenceRequirements: ['Board-reviewed succession plan'], recommendedAction: 'Prepare and periodically review a succession plan for the board, CEO and key roles.' }),
  c({ id: 'RES-3', pillarId: 'resilience', name: 'Financial and operational resilience', description: 'Reserves, funding diversity and contingency plans protect the institution from shocks.', assessmentQuestions: ['Are funding concentration and reserves monitored against targets?'], sourceReferences: [OECD_SOE, KING], requiredDocumentation: ['Reserves policy', 'Funding analysis'], evidenceRequirements: ['Board-reviewed resilience indicators'], recommendedAction: 'Set reserve and funding-diversity targets and report them to the board.' }),
]

export interface CriterionResponse {
  criterionId: string
  score: number | null // 1–5, null when unanswered
  evidence: boolean
  notApplicable: boolean
}

export interface CraftScorecardResult {
  methodology: typeof METHODOLOGY
  errors: string[]
  complete: boolean
  completeness: number // % of applicable criteria scored
  overall: number | null
  rating: RatingBand | null
  pillars: { id: GovernancePillarId; name: string; weight: number; score: number | null; rating: RatingBand | null; scored: number; applicable: number }[]
  missingResponses: string[]
  unevidenced: string[]
  notApplicable: string[]
  recommendations: { criterionId: string; pillarId: GovernancePillarId; criterion: string; effectiveScore: number; action: string; evidence: string[]; priority: 'high' | 'medium' }[]
}

export const DEFAULT_PILLAR_WEIGHTS = Object.fromEntries(Object.values(GOVERNANCE_PILLARS).map((p) => [p.id, p.weight])) as Record<GovernancePillarId, number>

// Deterministic CRAFT scoring. Unanswered ≠ not applicable ≠ compliant; unevidenced scores are capped.
export interface ScorecardOptions { innovationSupport?: boolean }
export const activeCriteria = (opts: ScorecardOptions = {}) => GOVERNANCE_CRITERIA.filter((x) => !x.appliesTo || (x.appliesTo === 'innovation_support' && !!opts.innovationSupport))

export function craftScorecard(responses: CriterionResponse[], weights: Record<GovernancePillarId, number> = DEFAULT_PILLAR_WEIGHTS, opts: ScorecardOptions = {}): CraftScorecardResult {
  const active = activeCriteria(opts)
  const byId = new Map(responses.map((r) => [r.criterionId, r]))
  const scored = Object.fromEntries(responses.filter((r) => r.score != null && !r.notApplicable).map((r) => [r.criterionId, r.score as number]))
  const { errors } = validateScoringInputs(weights, scored)
  const missingResponses: string[] = [], unevidenced: string[] = [], notApplicable: string[] = []
  const recommendations: CraftScorecardResult['recommendations'] = []
  const pillarScores: Partial<Record<GovernancePillarId, number>> = {}
  const pillars = Object.values(GOVERNANCE_PILLARS).map((p) => {
    const rows: { weight: number; score: number }[] = []
    let applicable = 0
    for (const k of active.filter((x) => x.pillarId === p.id)) {
      const r = byId.get(k.id)
      if (r?.notApplicable) { notApplicable.push(k.id); continue }
      applicable++
      if (r?.score == null) { missingResponses.push(k.id); continue }
      const effective = r.evidence ? r.score : Math.min(r.score, METHODOLOGY.evidenceCap)
      if (!r.evidence) unevidenced.push(k.id)
      rows.push({ weight: k.weight, score: effective })
      if (effective <= 2) recommendations.push({ criterionId: k.id, pillarId: p.id, criterion: k.name, effectiveScore: effective, action: k.recommendedAction, evidence: k.evidenceRequirements, priority: effective <= 1 ? 'high' : 'medium' })
    }
    const score = rows.length ? calculatePillarScore(rows) : null
    if (score != null) pillarScores[p.id] = score
    return { id: p.id, name: p.name, weight: weights[p.id], score, rating: score == null ? null : getRatingBand(score), scored: rows.length, applicable }
  })
  const used = Object.keys(pillarScores) as GovernancePillarId[]
  const usedWeight = used.reduce((a, id) => a + (weights[id] ?? 0), 0)
  const overall = used.length && usedWeight > 0 ? Math.round(used.reduce((a, id) => a + pillarScores[id]! * weights[id], 0) / usedWeight) : null
  const applicableTotal = pillars.reduce((a, p) => a + p.applicable, 0)
  const scoredTotal = pillars.reduce((a, p) => a + p.scored, 0)
  return {
    methodology: METHODOLOGY, errors,
    complete: !errors.length && missingResponses.length === 0 && applicableTotal > 0,
    completeness: applicableTotal ? Math.round((scoredTotal / applicableTotal) * 100) : 0,
    overall: errors.length ? null : overall,
    rating: errors.length || overall == null ? null : getRatingBand(overall),
    pillars, missingResponses, unevidenced, notApplicable,
    recommendations: recommendations.sort((a, b) => a.effectiveScore - b.effectiveScore),
  }
}

export const criterionById = (id: string) => GOVERNANCE_CRITERIA.find((x) => x.id === id) ?? null
