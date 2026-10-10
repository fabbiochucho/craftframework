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
    weight: 11,
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
    weight: 11,
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
    weight: 10,
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
    weight: 10,
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
    weight: 10,
    icon: 'Leaf',
    theme: 'green',
  },
  data: {
    id: 'data',
    name: 'Data Governance, Cybersecurity and Digital Accountability',
    description:
      'Effective governance of data, protection of information systems, and responsible use of digital technology.',
    intendedOutcome:
      'Data and digital assets are secure, well-managed, and used responsibly.',
    weight: 10,
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
    weight: 10,
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
