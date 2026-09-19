export interface Question {
  id: string
  domain: string
  tier: number
  tierName: string
  question: string
  insight: string
  evidence: string[]
  verificationMethod: string
  score: number
  maxScore: number
  riskIfWeak: 'Critical' | 'High' | 'Moderate' | 'Low'
  capacityAction: string
  donorLink: string
  nationalLink: string
  priority: 'Critical' | 'High' | 'Moderate' | 'Low'
  riskCategory?: string
  evidenceNote?: string
  // Thematic lens this question belongs to. Undefined = part of the always-on
  // Core Foundation (the fiduciary G2G, DFI and donor baseline).
  lens?: LensId
  // Scoring rubric (0–5 maturity anchors), surfaced in the wizard where present.
  scoringGuide?: string
  // Entity archetypes this question applies to. Undefined = universal (shown to
  // every archetype). When present, the question is rendered ONLY for a matching
  // workspace archetype - e.g. a Cap Table question is Private-only, a Supreme
  // Audit Institution question is Public-only.
  archetypes?: Archetype[]
  // Optional link to a Data Room requirement that satisfies this question's
  // evidence - the wizard surfaces a "Link from Data Room" affordance for these.
  requiredDataRoomDoc?: string
}

// The three institutional archetypes the platform adapts to. The Core fiduciary
// bank is universal; archetype tags carve out the entity-specific questions and
// drive the dynamic Pan-African Data Room (see lib/dataroom.ts).
export type Archetype = 'Public' | 'Civil Society' | 'Private'

export const ARCHETYPES: { id: Archetype; label: string; blurb: string }[] = [
  { id: 'Public', label: 'Public Sector', blurb: 'Ministries, agencies, regulators & sub-national entities' },
  { id: 'Civil Society', label: 'Civil Society', blurb: 'NGOs, foundations, cooperatives & member bodies' },
  { id: 'Private', label: 'Private Sector', blurb: 'SMEs, startups & corporates seeking capital or contracts' },
]

// A question is visible for a given archetype when it is universal (no archetype
// tag) or explicitly tagged for that archetype. With no archetype selected, only
// the universal Core bank is shown.
export function archetypeMatch(q: Question, archetype?: Archetype | ''): boolean {
  if (!q.archetypes) return true
  return !!archetype && q.archetypes.includes(archetype)
}

export interface Organization {
  id: string
  name: string
  country: string
  targetDonor: string
  email: string
  createdAt: string
  lastUpdated: string
  scores: Record<string, number>
  // Email of the Portfolio Reviewer accountable for this institution. Super
  // Admins are never recorded here - platform oversight is not a "reviewer".
  reviewer?: string
  // Soft-archive flag: 'active' (default) | 'archived'. Archived institutions
  // are hidden from working surfaces but retained and restorable.
  status?: 'active' | 'archived'
}

// A portfolio is a named grouping of institutions administered by a Portfolio
// Reviewer (or created by a Super Admin for platform oversight). Reviewers may
// own several portfolios; each scopes the comparison and reporting surfaces.
export interface Portfolio {
  id: string
  name: string
  orgIds: string[]
  // Email of the Portfolio Reviewer who administers this portfolio. Left unset
  // for Super-Admin-created portfolios so admins are never listed as reviewers.
  reviewer?: string
  firmId?: string
  // Soft-archive flag: 'active' (default) | 'archived'.
  status?: 'active' | 'archived'
}

export interface User {
  id: string
  email: string
  orgId: string
  role: 'assessor' | 'admin'
}

export interface CIPItem {
  id: string
  qId: string
  domain: string
  gapDescription: string
  rootCause: string
  capacityAction: string
  owner: string
  dueDate: string
  status: 'Not Started' | 'In Progress' | 'Completed'
  evidenceLink?: string
}

// ============================================================================
// CRAFT (ICARF v4.0) - 450-Question Master Bank
// 5 tiers · 20 domains. The bank below is the canonical source of truth; the
// rich UI fields (insight, evidence, action, links) come either from a curated
// enrichment overlay for the most critical questions or sensible per-domain
// defaults for the rest.
// ============================================================================

export const TIER_NAMES = [
  'Organizational Maturity',
  'Fiduciary Assurance',
  'Grant Management',
  'Donor & USG Readiness',
  'Digital & Operational Readiness',
]

// Friendly display labels for the 20 CSV domain codes.
const DOMAIN_DISPLAY: Record<string, string> = {
  Governance: 'Governance & Leadership',
  Legal: 'Legal & Regulatory',
  Strategy: 'Strategy & Planning',
  HR: 'Human Resources',
  Sustainability: 'Sustainability & Financing',
  Finance: 'Financial Management',
  Procurement: 'Procurement & Supply Chain',
  Risk: 'Risk & Internal Controls',
  Audit: 'Audit & Assurance',
  Ethics: 'Ethics & Anti-Fraud',
  Grant: 'Grant Management',
  Program: 'Program & Project Mgmt',
  MEL: 'Monitoring, Evaluation & Learning',
  Partnership: 'Partnerships & Stakeholders',
  USG: 'USG Compliance',
  International: 'International Donor Compliance',
  Digital: 'Digital Systems & Cyber',
  Emergency: 'Emergency Preparedness',
  Research: 'Research & Innovation',
  PMO: 'PMO & Delivery',
}

export const DOMAINS = Object.values(DOMAIN_DISPLAY)

const TIER_OF: Record<string, number> = { T1: 1, T2: 2, T3: 3, T4: 4, T5: 5 }

interface Enrichment {
  insight: string
  evidence: string[]
  verificationMethod: string
  capacityAction: string
  donorLink: string
  nationalLink: string
}

// Curated 10-point deep-dive content for the most critical questions. These
// surface the universalized operational realities (legacy accounting, paper
// asset tags, centralized LMIS, restricted audit scopes, non-anonymous
// whistleblowing, etc.) with no specific agency or country named.
const QUESTION_ENRICHMENT: Record<string, Enrichment> = {
  'GOV-01': {
    insight: 'Reports are often submitted to oversight bodies, but systematic review and feedback loops are missing, hindering corrective action and institutional accountability.',
    evidence: ['SAI/Parliamentary committee minutes', 'Executive response memos', 'Formal oversight trackers'],
    verificationMethod: 'Document review; interview with Board Secretary and Head of Internal Audit',
    capacityAction: 'Institute a mandatory Oversight Tracker linking audit findings to executive action plans with quarterly reporting to the Board.',
    donorLink: 'Global Fund FMS; USAID ADS 591',
    nationalLink: 'Public Finance Management (PFM) Act; Supreme Audit Institution Guidelines',
  },
  'GOV-05': {
    insight: 'Lack of a clear, system-enforced Delegation of Authority leads to unauthorized commitments of funds and bottlenecks in emergency procurement.',
    evidence: ['Approved DOA matrix', 'System access logs', 'Authorization thresholds document'],
    verificationMethod: 'System demonstration; document review',
    capacityAction: 'Develop and system-enforce a DOA matrix aligned with donor approval thresholds.',
    donorLink: 'USAID ADS 302',
    nationalLink: 'National Financial Regulations',
  },
  'LEG-01': {
    insight: 'Ambiguity in enabling legislation can prevent the agency from legally holding foreign grants or opening dedicated donor accounts.',
    evidence: ['Enabling Act', 'Legal opinions', 'Donor account agreements'],
    verificationMethod: 'Legal review; document review',
    capacityAction: 'Secure a formal legal opinion or amend enabling legislation to clarify donor fund management authority.',
    donorLink: '2 CFR 200.302',
    nationalLink: 'Constitution / Agency Enabling Act',
  },
  'LEG-07': {
    insight: 'Without formal legal or policy protections, staff are highly vulnerable to retaliation when reporting fraud, especially in hierarchical government structures.',
    evidence: ['National Whistleblower Act', 'Agency Whistleblower Policy', 'Legal opinions'],
    verificationMethod: 'Document review; legal counsel interview',
    capacityAction: "Enshrine whistleblower protections in the agency's Best Practice Manual and advocate for national legal frameworks.",
    donorLink: 'USAID ADS 591; Global Fund Fraud Policy',
    nationalLink: 'National Whistleblower Protection Act; Anti-Corruption Commission Guidelines',
  },
  'HR-02': {
    insight: 'High turnover and brain drain in fiduciary roles disrupt grant implementation and erode institutional memory.',
    evidence: ['Workforce plan', 'Turnover reports', 'Skills gap assessment'],
    verificationMethod: 'HR interview; document review',
    capacityAction: 'Develop a targeted retention and capacity-building plan for grant management and fiduciary staff.',
    donorLink: 'PEPFAR HRH Guidelines',
    nationalLink: 'National Civil Service Rules',
  },
  'FIN-08': {
    insight: 'The agency lacks alternative mechanisms or contingency plans for treasury disbursement delays or low bank penetration, which can halt emergency response.',
    evidence: ['Cash flow contingency plan', 'Meeting minutes with National Central Bank/Treasury'],
    verificationMethod: 'Document review; interview',
    capacityAction: 'Develop a formal cash flow contingency plan and establish a working relationship with the National Central Bank/Treasury.',
    donorLink: '2 CFR 200.305',
    nationalLink: 'National Treasury Cash Management Guidelines',
  },
  'FIN-13': {
    insight: 'Legacy accounting software cannot generate trial balances for individual donors. Reconciliations require manual spreadsheet intervention, impinging on the completeness and accuracy of reports.',
    evidence: ['ERP/Accounting software screenshots', 'Donor-specific Trial Balance', 'Chart of Accounts'],
    verificationMethod: 'Live system demonstration; interview with Finance Manager',
    capacityAction: 'Upgrade the accounting system to support multi-dimensional fund coding (Fund/Grant/Project) and a dedicated donor-reporting module.',
    donorLink: '2 CFR 200.302; Global Fund FMS',
    nationalLink: 'IPSAS; National PFM Act',
  },
  'FIN-15': {
    insight: 'The agency uses a manual system (spreadsheets) to track expenditure, outflows, and fund balance, which is highly prone to error and manipulation.',
    evidence: ['ERP system logs', 'Budget Tracker screenshots', 'Finance SOPs'],
    verificationMethod: 'System demonstration; interview',
    capacityAction: 'Transition from manual trackers to fully automated ERP modules and train the finance team.',
    donorLink: '2 CFR 200.302; Global Fund FMS',
    nationalLink: 'IPSAS; National PFM Act',
  },
  'FIN-22': {
    insight: 'Delayed bank reconciliations prevent the timely detection of errors, unauthorized transactions, or missing funds.',
    evidence: ['Signed bank reconciliations', 'Bank statements', 'Maker-checker sign-off logs'],
    verificationMethod: 'Document review; sampling',
    capacityAction: 'Enforce strict monthly bank reconciliation deadlines with maker-checker sign-offs.',
    donorLink: 'Global Fund FMS',
    nationalLink: 'National Treasury Guidelines',
  },
  'FIN-28': {
    insight: 'Evidence of poor advance management: significant advances for project activities were paid to individual staff bank accounts, resulting in late retirement and high fraud risk.',
    evidence: ['Payment vouchers', 'Bank statements', 'Advance aging report', 'Updated Best Practice Manual'],
    verificationMethod: 'Voucher sampling; interview',
    capacityAction: 'Issue an executive directive banning staff advances and mandate direct vendor/beneficiary payments.',
    donorLink: '2 CFR 200.305; Global Fund FMS',
    nationalLink: 'National Treasury Imprest Regulations',
  },
  'FIN-32': {
    insight: 'The agency is not mandated to prepare interim financial reports outside the annual cycle. Annual frequency prevents the swift detection and correction of accounting errors.',
    evidence: ['Quarterly financial reports', 'Management accounts', 'Donor reporting submissions'],
    verificationMethod: 'Document review; system demonstration',
    capacityAction: 'Prepare interim financial reports quarterly in line with donor standards, independent of the annual government cycle.',
    donorLink: 'Global Fund FMS; 2 CFR 200.302',
    nationalLink: 'National PFM Act',
  },
  'FIN-42': {
    insight: 'Assets are tagged with degradable printed-paper tags, and there is no evidence of annual physical asset verification exercises.',
    evidence: ['Photos of asset tags', 'Fixed Asset Register', 'Annual Verification Report'],
    verificationMethod: 'Physical observation; document review',
    capacityAction: 'Replace paper tags with durable barcode/RFID labels and conduct and document an annual physical verification.',
    donorLink: '2 CFR 200.313; Global Fund FMS',
    nationalLink: 'National Asset Management Guidelines',
  },
  'PROC-11': {
    insight: 'The assessment team was unable to ascertain the basis of selecting a vendor for IT equipment, as solicitation documents and evaluation matrices were not documented on file.',
    evidence: ['Complete procurement files', 'Evaluation matrices', 'Award letters'],
    verificationMethod: 'File sampling; document review',
    capacityAction: 'Document procedures based on the SOP and ensure all supporting documents are created and archived in an easy-to-retrieve location.',
    donorLink: '2 CFR 200.318; Global Fund Procurement Guidelines',
    nationalLink: 'National Public Procurement Act',
  },
  'PROC-17': {
    insight: 'Current warehousing arrangements are suboptimal for emergency services. Inventory management is weak, and distribution services are largely ad hoc.',
    evidence: ['Warehousing Transition Plan', 'Logistics Unit organogram', 'Warehouse staff contracts'],
    verificationMethod: 'Physical observation; document review',
    capacityAction: 'Finalize the Warehousing & Distribution Transition Plan including HR management, organogram, and engagement of warehousing/health-product specialists.',
    donorLink: 'Global Fund PSM; USAID Supply Chain',
    nationalLink: 'National Medical Stores Guidelines',
  },
  'PROC-19': {
    insight: 'Quantification is done, but there is no integrated national supply plan. Donated and procured pipelines are not synchronized, leading to stockouts or expiries.',
    evidence: ['Integrated Supply Plan document', 'Quantification reports'],
    verificationMethod: 'Document review; interview with Logistics Unit',
    capacityAction: 'Develop a robust integrated supply plan with technical assistance covering all priority diseases/emergencies.',
    donorLink: 'Global Fund PSM; WHO Quantification Tools',
    nationalLink: 'National Health Supply Chain Policy',
  },
  'PROC-29': {
    insight: 'The Reference Laboratory carries out validation tests but lacks ISO/IEC 17025 certification, and donated health products are not routinely sampled and tested by the National Regulatory Authority.',
    evidence: ['Valid ISO/IEC 17025 Certificate', 'Quality Assurance Manual', 'Records of validation tests', 'NRA sampling logs'],
    verificationMethod: 'Physical inspection; interview with Lab Director',
    capacityAction: 'Liaise with an ISO-certified partner laboratory for validation tests and ensure the National Regulatory Authority routinely samples donated products.',
    donorLink: 'US CDC Laboratory Systems Assessment; Global Fund HSS',
    nationalLink: 'National Regulatory Authority Guidelines; National Bureau of Standards',
  },
  'RISK-06': {
    insight: 'Lack of segregation of duties allows a single individual to initiate, approve, and record fraudulent transactions.',
    evidence: ['System access logs', 'SoD matrix', 'System configuration screenshots'],
    verificationMethod: 'System demonstration; IT audit',
    capacityAction: 'Configure the financial system to enforce maker-checker and SoD controls; conduct a quarterly access-rights review.',
    donorLink: 'COSO Internal Control Framework',
    nationalLink: 'National PFM Internal Control Guidelines',
  },
  'AUD-04': {
    insight: 'The Internal Audit unit only reviews the Finance and Admin function on a quarterly basis, excluding all other units within the agency, and quarterly reviews have not been conducted regularly.',
    evidence: ['Approved Annual Internal Audit Plan', 'Audit reports covering non-finance units', 'SOP for audit review'],
    verificationMethod: 'Document review; interview with Head of Audit',
    capacityAction: 'Update the Best Practice Manual and develop an SOP to guide internal audit review of ALL units; conduct quarterly reviews.',
    donorLink: 'Global Fund Audit Guidelines; ISSAI / IIA Standards',
    nationalLink: 'National Internal Audit Guidelines; Supreme Audit Institution',
  },
  'ETH-04': {
    insight: 'The reporting style for suspected fraud requires staff to include their name in the petition to the Executive Director. The lack of anonymity may lead to retaliation, hindering the reporting of sensitive cases.',
    evidence: ['Whistleblower Policy', 'Best Practice Manual excerpts', 'Third-party hotline contract'],
    verificationMethod: 'Policy review; staff interview',
    capacityAction: 'Contract an independent third-party ethics hotline and enshrine anonymous whistleblowing and non-retaliation in the Best Practice Manual.',
    donorLink: 'USAID ADS 591; Global Fund Fraud and Corruption Policy',
    nationalLink: 'National Whistleblower Protection Act; Anti-Corruption Commission Guidelines',
  },
  'GRANT-01': {
    insight: 'The agency lacks direct experience managing large multilateral grants as a Principal Recipient. The scope and size of current grants pale in comparison to the target grant amount.',
    evidence: ['Past grant portfolio', 'Staff CVs', 'Capacity assessment reports'],
    verificationMethod: 'Document review; interview',
    capacityAction: 'Educate staff on donor requirements; engage in mentorship with experienced Principal Recipients; conduct targeted training.',
    donorLink: 'Global Fund PR Guidelines; USAID CAP Assessments',
    nationalLink: 'National Grant Management Guidelines',
  },
  'GRANT-06': {
    insight: 'Fragmented grant management across technical units leads to siloed planning and poor financial oversight.',
    evidence: ['PMU Charter', 'Organogram', 'Staff job descriptions'],
    verificationMethod: 'Document review; interview',
    capacityAction: 'Establish a centralized PMU with dedicated fiduciary and M&E staff aligned to donor requirements.',
    donorLink: 'Global Fund PMU Standards',
    nationalLink: 'National Project Implementation Guidelines',
  },
  'GRANT-09': {
    insight: 'The financial system does not have the capacity to link financial information with programmatic progress, preventing real-time burn-rate analysis.',
    evidence: ['Integrated GMIS screenshots', 'Variance reports linking spend to outputs'],
    verificationMethod: 'System demonstration; joint Finance/M&E interview',
    capacityAction: 'Train the agency on donor financial reporting systems and upgrade the system to link fund codes to M&E milestones.',
    donorLink: 'USAID Project Management; Global Fund FMS',
    nationalLink: 'National M&E Policy',
  },
  'GRANT-12': {
    insight: 'Passing funds to sub-recipients without risk assessment exposes the prime recipient to severe fiduciary and compliance risks.',
    evidence: ['Subrecipient risk assessments', 'Monitoring reports', 'Sub-award files'],
    verificationMethod: 'Document review; site visit reports',
    capacityAction: 'Develop a standardized Subrecipient Risk Assessment Tool and mandate annual monitoring visits.',
    donorLink: '2 CFR 200.331; Global Fund Sub-recipient Management Guidelines',
    nationalLink: 'National Grant Management Guidelines',
  },
  'USG-01': {
    insight: 'Lack of awareness of USG federal rules leads to unallowable costs and failed Single Audits.',
    evidence: ['Training records', '2 CFR 200 manual', 'Certification sign-off sheets'],
    verificationMethod: 'Document review; staff interview',
    capacityAction: 'Mandate annual 2 CFR 200 certification training for all grant management and finance staff.',
    donorLink: '2 CFR 200; USAID ADS 200',
    nationalLink: 'National Civil Service Training Guidelines',
  },
  'USG-09': {
    insight: 'Grants from US agencies are exempt from VAT, but the agency has not obtained the tax exemption certificate for these donor-funded activities.',
    evidence: ['VAT Exemption Certificates specific to USG', 'Correspondence with Revenue Authority'],
    verificationMethod: 'Document review; Finance interview',
    capacityAction: 'Obtain a VAT Exemption Certificate specifically for USG cooperative agreements.',
    donorLink: '2 CFR 200.303; USAID ADS 303',
    nationalLink: 'National Tax / VAT Act',
  },
  'USG-13': {
    insight: 'USG rules require specific risk assessments for subrecipients; failure to perform them is a major compliance finding.',
    evidence: ['Subrecipient risk assessments', 'Sub-award files', 'Monitoring visit reports'],
    verificationMethod: 'Document review; file sampling',
    capacityAction: 'Implement 2 CFR 200.331-compliant risk assessments for all sub-awards prior to execution.',
    donorLink: '2 CFR 200.331; USAID ADS 303',
    nationalLink: 'National Grant Management Regulations',
  },
  'USG-22': {
    insight: 'USG requires strict documentation of personnel effort; retroactive or estimated timesheets are disallowed costs.',
    evidence: ['Timesheets', 'Effort certification forms', 'Payroll integration logs'],
    verificationMethod: 'File sampling; HR interview',
    capacityAction: 'Implement a strict After-The-Fact time and effort reporting system integrated with payroll.',
    donorLink: '2 CFR 200.430; USAID ADS 303',
    nationalLink: 'National Labor / Civil Service Rules',
  },
  'USG-31': {
    insight: 'Entities expending federal funds above the threshold must undergo a Single Audit; lack of preparation leads to qualified opinions.',
    evidence: ['Single Audit report', 'SEFA (Schedule of Expenditures of Federal Awards)', 'Auditor engagement letter'],
    verificationMethod: 'Document review; external auditor interview',
    capacityAction: 'Engage external auditors with specific USG Single Audit experience and prepare a robust SEFA.',
    donorLink: '2 CFR 200 Subpart F; USAID ADS 200',
    nationalLink: 'National Audit Act',
  },
  'DIG-05': {
    insight: 'The Logistics Management Information System is used only at central headquarters. Reporting rates from sub-national/emergency facilities are low, leaving the central level blind to actual field stock status.',
    evidence: ['LMIS architecture', 'Sub-national login logs', 'Facility-level reporting rate dashboards'],
    verificationMethod: 'System demonstration; field focal point interview',
    capacityAction: 'Decommission the legacy centralized system and adopt a cloud-based LMIS with sub-national localization and bi-directional reporting.',
    donorLink: 'USAID Supply Chain; Global Fund HSS',
    nationalLink: 'National Digital Health Strategy',
  },
  'DIG-13': {
    insight: 'Details of the offsite location and the written schedule for computer backup were not provided for review, posing a catastrophic data loss risk.',
    evidence: ['IT Disaster Recovery Plan', 'Backup logs', 'Offsite facility agreement'],
    verificationMethod: 'System demonstration; document review',
    capacityAction: 'Document backup options and frequency in the IT Best Practice Manual and implement automated, geographically redundant cloud backups.',
    donorLink: 'USAID ADS 545; ISO 27001',
    nationalLink: 'National Data Protection Act',
  },
  'PMO-02': {
    insight: 'Fragmented implementation across grants hinders overall institutional delivery and executive visibility.',
    evidence: ['PMO Charter', 'Portfolio dashboard screenshots', 'Project registry'],
    verificationMethod: 'System demonstration; PMO interview',
    capacityAction: 'Establish a centralized PMO and deploy an enterprise project portfolio management (EPPM) tool.',
    donorLink: 'Global Fund PMU Standards',
    nationalLink: 'National Planning Commission Guidelines',
  },
  'EPR-02': {
    insight: 'Static emergency plans fail during novel outbreaks or complex security emergencies. Without testing, plans remain theoretical.',
    evidence: ['Emergency response plans', 'Simulation exercise reports', 'After-Action Review documentation'],
    verificationMethod: 'Document review; EOC interview',
    capacityAction: 'Conduct annual tabletop simulation exercises and update contingency plans based on after-action review findings.',
    donorLink: 'WHO IHR; US CDC LFA',
    nationalLink: 'National Emergency Management Act',
  },
}

// Default donor/national references for questions without a curated overlay.
const DOMAIN_LINKS: Record<string, { donor: string; national: string }> = {
  'Governance & Leadership': { donor: 'Global Fund FMS; USAID ADS 591', national: 'PFM Act / SAI Guidelines' },
  'Legal & Regulatory': { donor: '2 CFR 200.302', national: 'Agency Enabling Act' },
  'Strategy & Planning': { donor: 'USAID Program Cycle (ADS 201)', national: 'National Development Plan' },
  'Human Resources': { donor: 'PEPFAR HRH Guidelines', national: 'National Civil Service Rules' },
  'Sustainability & Financing': { donor: 'Global Fund Sustainability & Transition Policy', national: 'National Health Financing Strategy' },
  'Financial Management': { donor: '2 CFR 200.302; Global Fund FMS', national: 'IPSAS; National PFM Act' },
  'Procurement & Supply Chain': { donor: '2 CFR 200.317-327; Global Fund Procurement', national: 'National Public Procurement Act' },
  'Risk & Internal Controls': { donor: 'COSO Internal Control Framework; ISO 31000', national: 'National PFM Internal Control Guidelines' },
  'Audit & Assurance': { donor: 'ISSAI / IIA Standards', national: 'National Internal Audit Guidelines' },
  'Ethics & Anti-Fraud': { donor: 'USAID ADS 591; Global Fund Fraud Policy', national: 'Anti-Corruption Commission Guidelines' },
  'Grant Management': { donor: '2 CFR 200; Global Fund PR Guidelines', national: 'National Grant Management Guidelines' },
  'Program & Project Mgmt': { donor: 'USAID Project Management; PMBOK', national: 'National Project Implementation Guidelines' },
  'Monitoring, Evaluation & Learning': { donor: 'USAID Evaluation Policy', national: 'National M&E Policy' },
  'Partnerships & Stakeholders': { donor: 'Donor Coordination Frameworks', national: 'National Aid Coordination Policy' },
  'USG Compliance': { donor: '2 CFR 200; USAID ADS 303', national: 'National Grant Management Regulations' },
  'International Donor Compliance': { donor: 'Global Fund / World Bank / Gavi Guidelines', national: 'National Aid Coordination Policy' },
  'Digital Systems & Cyber': { donor: 'USAID ADS 545; ISO 27001', national: 'National Data Protection Act' },
  'Emergency Preparedness': { donor: 'WHO IHR; US CDC LFA', national: 'National Emergency Management Act' },
  'Research & Innovation': { donor: 'PHS/NIH Research Compliance', national: 'National Research Ethics Guidelines' },
  'PMO & Delivery': { donor: 'Global Fund PMU Standards', national: 'National Planning Commission Guidelines' },
}

function defaultEnrichment(domain: string, riskCategory: string): Enrichment {
  const links = DOMAIN_LINKS[domain] ?? { donor: 'Donor fiduciary standards', national: 'National regulatory framework' }
  return {
    insight: `Donor due-diligence rewards documented, system-enforced practice over ad-hoc effort. Weakness here elevates ${riskCategory.toLowerCase()} risk and can constrain direct-funding eligibility.`,
    evidence: ['Approved policy / SOP', 'Implementation records', 'Management sign-off'],
    verificationMethod: 'Document review; interview; system demonstration',
    capacityAction: 'Formalize and document this control in the institutional manual, assign a clear owner, and demonstrate execution through verifiable evidence.',
    donorLink: links.donor,
    nationalLink: links.national,
  }
}

// The canonical 450-question bank (Q_ID, Tier, Domain, Question, Priority, Risk_Category).
const QUESTION_BANK_CSV = `Q_ID,Tier,Domain,Core_Assessment_Question,Priority,Risk_Category
GOV-01,T1,Governance,Does the Supreme Audit Institution or National Legislature systematically review financial reports and provide formal oversight feedback?,Critical,Governance
GOV-02,T1,Governance,Is there a formally constituted Governing Board with an approved Charter and clear Terms of Reference?,High,Governance
GOV-03,T1,Governance,Does the Board meet at least quarterly to review institutional performance and fiduciary risk?,High,Governance
GOV-04,T1,Governance,Are Board sub-committees (Audit Finance Risk) established with approved Terms of Reference?,High,Governance
GOV-05,T1,Governance,Is there a formally approved and system-enforced Delegation of Authority (DOA) matrix?,High,Fiduciary
GOV-06,T1,Governance,Is there a documented succession plan for the Executive Director and all critical fiduciary roles?,Moderate,Operational
GOV-07,T1,Governance,Are executive management decisions formally documented and tracked in a decision log?,Moderate,Governance
GOV-08,T1,Governance,Does the agency publish annual performance and financial reports publicly for stakeholder review?,Moderate,Reputation
GOV-09,T1,Governance,Is there a public register of conflicts of interest for senior leadership and board members?,High,Reputation
GOV-10,T1,Governance,Is there an independent Ethics Committee overseeing institutional integrity and code of conduct?,High,Governance
GOV-11,T1,Governance,Is the organizational structure optimized and formally approved by the governing board?,Low,Operational
GOV-12,T1,Governance,Does the Board conduct an annual self-evaluation of its performance and governance effectiveness?,Moderate,Governance
GOV-13,T1,Governance,Is there a formal change management framework for major institutional reforms or restructuring?,Low,Operational
GOV-14,T1,Governance,Has the agency developed an institutional resilience and business continuity strategy?,High,Operational
GOV-15,T1,Governance,Are senior managers held accountable through signed annual performance contracts linked to strategy?,Moderate,Operational
LEG-01,T1,Legal,Does the agency have explicit legal authority to receive and manage direct donor funds?,Critical,Compliance
LEG-02,T1,Legal,Can the agency legally enter into grant agreements and cooperative agreements with international donors?,Critical,Compliance
LEG-03,T1,Legal,Does the agency have the legal capacity to execute public procurement contracts and hold title to assets?,High,Compliance
LEG-04,T1,Legal,Is there a comprehensive legal framework managing conflicts of interest for staff and board members?,High,Reputation
LEG-05,T1,Legal,Are there legal protections for whistleblowers against retaliation established in national or agency law?,Critical,Reputation
LEG-06,T1,Legal,Are there mandatory legal obligations for reporting fraud to national anti-corruption authorities?,High,Compliance
LEG-07,T1,Legal,Has the agency secured legal tax and VAT exemptions for all donor-funded activities?,High,Fiduciary
LEG-08,T1,Legal,Is the agency fully compliant with national data protection and privacy laws?,High,Cyber
LEG-09,T1,Legal,Does the agency have a legally binding anti-corruption compliance framework?,High,Reputation
LEG-10,T1,Legal,Is the agency compliant with the national public procurement regulatory authority guidelines?,High,Procurement
LEG-11,T1,Legal,Is the agency compliant with national labor pension and social security laws?,Moderate,Operational
LEG-12,T1,Legal,Does the agency comply with national environmental and social safeguard laws?,Moderate,Compliance
LEG-13,T1,Legal,Has the agency mapped domestic laws against international donor compliance requirements to identify conflicts?,High,Compliance
LEG-14,T1,Legal,Is there a legal protocol for managing intellectual property and data sovereignty for research generated?,Moderate,Reputation
LEG-15,T1,Legal,Does the agency have the legal personality to litigate or be litigated in the event of a contract dispute?,Low,Compliance
SP-01,T1,Strategy,Does the agency have a formally approved 5-year Strategic Plan aligned with national mandates?,High,Operational
SP-02,T1,Strategy,Is there a fully costed implementation plan for the strategic objectives?,High,Fiduciary
SP-03,T1,Strategy,Are Annual Work Plans (AWPs) developed and cascaded to all departments and linked to the budget?,High,Fiduciary
SP-04,T1,Strategy,Is there a clear Results Framework linking activities to strategic outcomes and donor expectations?,High,Programmatic
SP-05,T1,Strategy,Are SMART Key Performance Indicators (KPIs) defined for all strategic goals and departments?,Moderate,Operational
SP-06,T1,Strategy,Is there a real-time performance dashboard accessible to executive leadership?,Moderate,Operational
SP-07,T1,Strategy,Are departmental plans explicitly aligned with the central strategic plan to prevent siloed operations?,Moderate,Operational
SP-08,T1,Strategy,Is risk-adjusted planning integrated into the strategic and annual planning cycles?,High,Operational
SP-09,T1,Strategy,Are formal mid-term reviews conducted to assess strategic plan progress and allow course correction?,Moderate,Operational
SP-10,T1,Strategy,Are quarterly performance reviews institutionalized across the agency?,High,Operational
SP-11,T1,Strategy,Does the agency conduct an annual strategic performance retreat with the Board and senior management?,Low,Operational
SP-12,T1,Strategy,Is there a system for tracking long-term programmatic outcomes and impact beyond mere outputs?,High,Programmatic
SP-13,T1,Strategy,Is a high-performance culture actively promoted and linked to staff appraisals?,Low,Operational
SP-14,T1,Strategy,Are major executive decisions required to be backed by data and evidence?,Moderate,Operational
SP-15,T1,Strategy,Is the institutional budget explicitly aligned with strategic priorities and donor funding pipelines?,High,Fiduciary
HR-01,T1,HR,Is there a comprehensive legally compliant HR Policy Manual?,Moderate,Operational
HR-02,T1,HR,Is there a workforce strategy and skills gap assessment linked to grant management needs?,High,Operational
HR-03,T1,HR,Is recruitment conducted transparently based on merit and documented criteria?,High,Reputation
HR-04,T1,HR,Is there a standardized onboarding and induction program for new hires including fiduciary training?,Moderate,Operational
HR-05,T1,HR,Is there an annual performance management and appraisal system linked to strategic KPIs?,Moderate,Operational
HR-06,T1,HR,Is there an annual training and capacity-building plan based on identified skills gaps?,High,Operational
HR-07,T1,HR,Are succession plans in place for all critical and senior management roles?,High,Operational
HR-08,T1,HR,Are compensation and benefits scales competitive equitable and standardized to prevent brain drain?,High,Operational
HR-09,T1,HR,Is there a clear fair disciplinary code and grievance mechanism?,Moderate,Operational
HR-10,T1,HR,Is an automated Human Resource Information System (HRIS) utilized for payroll and records?,High,Cyber
HR-11,T1,HR,Are staff retention rates monitored and exit interviews conducted to identify systemic issues?,Moderate,Operational
HR-12,T1,HR,Are occupational health and safety standards strictly enforced especially in lab or field environments?,High,Operational
HR-13,T1,HR,Are diversity equity and inclusion principles integrated into hiring and promotion?,Low,Reputation
HR-14,T1,HR,Is there a policy managing the ethical recruitment of staff from partner agencies?,Low,Reputation
HR-15,T1,HR,Are timesheets and effort reporting strictly enforced and integrated with the HRIS payroll system?,Critical,Fiduciary
SUS-01,T1,Sustainability,Is there a formalized Resource Mobilization Strategy approved by the Board?,High,Fiduciary
SUS-02,T1,Sustainability,Is the agency actively advocating for increased domestic budget allocations for its mandate?,High,Fiduciary
SUS-03,T1,Sustainability,Is the donor portfolio diversified across multilateral bilateral and private sources to reduce reliance?,High,Fiduciary
SUS-04,T1,Sustainability,Are cost-recovery mechanisms implemented for applicable services (e.g. lab testing)?,Moderate,Fiduciary
SUS-05,T1,Sustainability,Are sustainability and transition plans developed for all major donor grants before they close?,High,Programmatic
SUS-06,T1,Sustainability,Are government counterpart funding agreements formalized and tracked?,High,Fiduciary
SUS-07,T1,Sustainability,Is there a policy for building and maintaining operational cash reserves?,Moderate,Fiduciary
SUS-08,T1,Sustainability,Is the agency continuously building capacity to win competitive global grants?,Moderate,Programmatic
SUS-09,T1,Sustainability,Does the government retain ownership of critical infrastructure and data?,High,Reputation
SUS-10,T1,Sustainability,Are efficiency savings reinvested into core strategic programs?,Low,Fiduciary
SUS-11,T1,Sustainability,Is there a formal partnership framework for engaging the private sector for co-investment?,Moderate,Programmatic
SUS-12,T1,Sustainability,Are donor-funded projects mapped against and aligned with the national strategy?,High,Programmatic
SUS-13,T1,Sustainability,Is there a formal knowledge management strategy to retain institutional memory?,Moderate,Operational
SUS-14,T1,Sustainability,Does the agency produce policy briefs to influence national health or security financing?,Low,Reputation
SUS-15,T1,Sustainability,Are transition plans developed for donor phase-outs (e.g. Gavi Global Fund)?,High,Fiduciary
FIN-01,T2,Finance,Is there an approved budget policy aligned with national and donor best practices?,High,Fiduciary
FIN-02,T2,Finance,Is there a strict documented budget calendar enforced across the agency?,Moderate,Fiduciary
FIN-03,T2,Finance,Does the agency prepare multi-year (3-5 year) financial projections for sustainability planning?,Moderate,Fiduciary
FIN-04,T2,Finance,Is Activity-Based Budgeting (ABB) utilized to link costs to specific outputs and AWPs?,High,Fiduciary
FIN-05,T2,Finance,Are donor-specific budgets developed using standardized compliant templates?,High,Fiduciary
FIN-06,T2,Finance,Are there hard system controls preventing expenditures beyond approved budgets?,Critical,Fiduciary
FIN-07,T2,Finance,Are monthly budget vs. actual variance analyses conducted and reviewed by management?,High,Fiduciary
FIN-08,T2,Finance,Is there a documented contingency plan for cash flow bottlenecks or low bank penetration?,High,Operational
FIN-09,T2,Finance,Are there strict controls and approval thresholds for budget reprogramming (virement)?,High,Fiduciary
FIN-10,T2,Finance,Are budgets formally approved by the Board and relevant donor authorities before execution?,Critical,Fiduciary
FIN-11,T2,Finance,Is there an updated Accounting Manual reflecting current IPSAS and donor standards?,High,Fiduciary
FIN-12,T2,Finance,Does the Chart of Accounts (CoA) include dimensions for donor project and activity?,Critical,Fiduciary
FIN-13,T2,Finance,Can the financial system generate automated donor-specific trial balances without manual intervention?,Critical,Fiduciary
FIN-14,T2,Finance,Is the agency compliant with IPSAS or national accrual accounting standards?,High,Fiduciary
FIN-15,T2,Finance,Is expenditure and fund balance tracking fully automated avoiding manual spreadsheets?,Critical,Fiduciary
FIN-16,T2,Finance,Are all journal entries supported by documentation and subject to maker-checker controls?,High,Fiduciary
FIN-17,T2,Finance,Is the month-end closing process completed within 10 working days?,Moderate,Fiduciary
FIN-18,T2,Finance,Are bank reconciliations prepared reviewed and approved monthly for ALL accounts?,Critical,Fiduciary
FIN-19,T2,Finance,Is there a policy mandating the retention of financial records for a minimum of 5-7 years?,Moderate,Compliance
FIN-20,T2,Finance,Is there an approved Cost Allocation Plan for distributing indirect costs across grants?,High,Fiduciary
FIN-21,T2,Finance,Are 13-week cash flow forecasts prepared and updated weekly?,High,Fiduciary
FIN-22,T2,Finance,Are bank reconciliations completed and signed off by the 5th of the following month?,High,Fiduciary
FIN-23,T2,Finance,Are donor funds kept in segregated dedicated bank accounts?,Critical,Fiduciary
FIN-24,T2,Finance,Are bank mandates updated to require dual/multiple signatories for all transactions?,Critical,Fiduciary
FIN-25,T2,Finance,Are payment processing times standardized across all transaction classes?,Moderate,Fiduciary
FIN-26,T2,Finance,Is there a clear policy for managing foreign exchange gains losses and conversions?,Moderate,Fiduciary
FIN-27,T2,Finance,Are cash handling procedures strict minimizing the use of physical cash?,High,Fiduciary
FIN-28,T2,Finance,Are project advances paid directly to vendors/beneficiaries rather than to staff personal accounts?,Critical,Fiduciary
FIN-29,T2,Finance,Is the investment of idle donor funds prohibited or strictly regulated?,Moderate,Fiduciary
FIN-30,T2,Finance,Is there a liquidity management strategy to handle delayed donor disbursements?,High,Fiduciary
FIN-31,T2,Finance,Are monthly management accounts produced and distributed to department heads?,High,Fiduciary
FIN-32,T2,Finance,Are interim (quarterly) financial reports prepared outside the annual government reporting cycle?,High,Compliance
FIN-33,T2,Finance,Are donor financial reports prepared strictly in accordance with agreed templates?,Critical,Compliance
FIN-34,T2,Finance,Does the Executive Director receive a monthly financial dashboard?,Moderate,Fiduciary
FIN-35,T2,Finance,Are quarterly financial reports formally presented to the Governing Board?,High,Governance
FIN-36,T2,Finance,Are annual financial statements prepared and ready for external audit within 3 months?,High,Fiduciary
FIN-37,T2,Finance,Is there an automated process for consolidating financial data from sub-national levels?,High,Fiduciary
FIN-38,T2,Finance,Are financial files maintained in a continuous audit-ready state?,Moderate,Compliance
FIN-39,T2,Finance,Is there a zero-tolerance policy for late submission of financial reports to donors?,Critical,Compliance
FIN-40,T2,Finance,Are financial reports subjected to internal review before submission to donors?,High,Fiduciary
FIN-41,T2,Finance,Is there a comprehensive updated Fixed Asset Register for all agency property?,High,Fiduciary
FIN-42,T2,Finance,Are assets tagged with durable scannable identifiers (not printed paper) and verified annually?,High,Fiduciary
FIN-43,T2,Finance,Is a physical asset verification conducted annually and reconciled with the ledger?,High,Fiduciary
FIN-44,T2,Finance,Are there formal procedures for the disposal of assets per donor and national rules?,High,Fiduciary
FIN-45,T2,Finance,Are high-value assets physically safeguarded with adequate security measures?,Moderate,Fiduciary
PROC-01,T2,Procurement,Is there an approved Procurement Policy aligned with international best practices?,High,Procurement
PROC-02,T2,Procurement,Is there a comprehensive Procurement Manual detailing step-by-step procedures?,High,Procurement
PROC-03,T2,Procurement,Is an Annual Procurement Plan (APP) developed and linked to the approved budget?,High,Procurement
PROC-04,T2,Procurement,Is a functional independent Procurement/Tenders Board established with approved TORs?,High,Procurement
PROC-05,T2,Procurement,Is there strict segregation of duties between requisition evaluation and award?,Critical,Procurement
PROC-06,T2,Procurement,Are procurement thresholds clearly defined for RFQ ITB and RFP methods?,High,Procurement
PROC-07,T2,Procurement,Are sole-source procurements restricted fully justified and approved at the highest level?,High,Procurement
PROC-08,T2,Procurement,Is there a pre-qualified vetted vendor database updated annually?,Moderate,Procurement
PROC-09,T2,Procurement,Are rigorous due diligence and background checks conducted on all major vendors?,High,Procurement
PROC-10,T2,Procurement,Are vendors screened against national and international debarment lists (e.g. SAM.gov)?,Critical,Compliance
PROC-11,T2,Procurement,Is the basis for vendor selection clearly documented with evaluation matrices for all procurements?,High,Procurement
PROC-12,T2,Procurement,Are bid openings conducted publicly or with a formal bid opening committee?,Moderate,Procurement
PROC-13,T2,Procurement,Are all contracts reviewed by legal counsel before signature?,High,Procurement
PROC-14,T2,Procurement,Is there a dedicated contract management process tracking deliverables and milestones?,High,Procurement
PROC-15,T2,Procurement,Are solicitation documents and non-health product procurement files fully archived?,High,Procurement
PROC-16,T2,Procurement,Are perpetual inventory systems and bin cards utilized for all stock items?,High,Procurement
PROC-17,T2,Procurement,Is there a finalized Warehousing & Distribution Transition Plan ensuring optimal storage?,Critical,Operational
PROC-18,T2,Procurement,Are monthly physical stock counts conducted and reconciled with inventory records?,High,Procurement
PROC-19,T2,Procurement,Is there an integrated national supply plan aligning forecasting with procurement pipelines?,Critical,Programmatic
PROC-20,T2,Procurement,Is fleet management tracked via logbooks fuel cards and maintenance schedules?,Moderate,Fiduciary
PROC-21,T2,Procurement,Are fast-track emergency procurement SOPs defined for outbreak/security responses?,High,Operational
PROC-22,T2,Procurement,Is there an independent mechanism for handling vendor procurement complaints?,Moderate,Reputation
PROC-23,T2,Procurement,Are Long-Term Agreements (LTAs) established for high-frequency low-value commodities?,Moderate,Procurement
PROC-24,T2,Procurement,Is the agency transitioning to an e-Procurement system for tendering and evaluation?,Moderate,Procurement
PROC-25,T2,Procurement,Are specialized annual procurement audits conducted to assess compliance?,High,Procurement
PROC-26,T2,Procurement,Are vendor performance evaluations conducted post-delivery?,Moderate,Procurement
PROC-27,T2,Procurement,Are procurement KPIs (e.g. cycle time savings) tracked on a dashboard?,Low,Operational
PROC-28,T2,Procurement,Has the agency mapped its supply chain for resilience against global/national shocks?,High,Operational
PROC-29,T2,Procurement,Do national reference laboratories hold ISO/IEC 17025 certification for testing/calibration?,High,Operational
PROC-30,T2,Procurement,Are contract awards and procurement plans published publicly?,Moderate,Reputation
PROC-31,T2,Procurement,Is there a system to track donated vs procured pipelines to prevent stockouts or expiries?,High,Programmatic
PROC-32,T2,Procurement,Are cold-chain storage facilities monitored with automated temperature logging?,High,Operational
PROC-33,T2,Procurement,Is there a formal process for the safe disposal of expired or contaminated health products?,High,Operational
PROC-34,T2,Procurement,Are importation and customs clearance processes for emergency supplies streamlined?,High,Operational
PROC-35,T2,Procurement,Is there a dedicated health product management specialist on staff?,Moderate,Operational
PROC-36,T2,Procurement,Are warehouse staff trained on standard operating procedures for indexing and coding?,High,Operational
PROC-37,T2,Procurement,Is there a standard warehouse-to-warehouse transport protocol for sensitive products?,High,Operational
PROC-38,T2,Procurement,Are regional cold room stores utilized and adequately funded for maintenance?,Moderate,Operational
PROC-39,T2,Procurement,Is there a protocol for verifying the quality of donated products upon receipt?,High,Operational
PROC-40,T2,Procurement,Are procurement files digitized and searchable by auditors?,Moderate,Procurement
PROC-41,T2,Procurement,Is there a conflict of interest declaration required for all procurement committee members?,High,Procurement
PROC-42,T2,Procurement,Are procurement thresholds reviewed annually for inflation and market changes?,Low,Procurement
PROC-43,T2,Procurement,Is there a framework for managing vendor contracts during force majeure events?,Low,Procurement
PROC-44,T2,Procurement,Are local content and small business participation targets tracked in procurement?,Low,Reputation
PROC-45,T2,Procurement,Is there a system to track and report procurement fraud or red flags to the Board?,High,Governance
RISK-01,T2,Risk,Is there an approved Enterprise Risk Management (ERM) policy?,High,Operational
RISK-02,T2,Risk,Is an ERM framework (e.g. COSO ISO 31000) implemented across all departments?,High,Operational
RISK-03,T2,Risk,Is a corporate risk register maintained and reviewed quarterly by management?,High,Operational
RISK-04,T2,Risk,Is an annual fraud risk assessment conducted to identify vulnerable processes?,High,Fiduciary
RISK-05,T2,Risk,Do department heads sign annual control self-assessment certifications?,Moderate,Fiduciary
RISK-06,T2,Risk,Is segregation of duties strictly enforced in financial and procurement systems?,Critical,Fiduciary
RISK-07,T2,Risk,Are system access controls and approval limits enforced via the DOA matrix?,Critical,Cyber
RISK-08,T2,Risk,Is there a tested Business Continuity Plan (BCP) for critical operations?,High,Operational
RISK-09,T2,Risk,Is there a tested Disaster Recovery Plan (DRP) for IT and financial systems?,Critical,Cyber
RISK-10,T2,Risk,Are physical access controls (badges logs security) in place for all facilities?,Moderate,Operational
RISK-11,T2,Risk,Are IT General Controls (ITGC) like password policies and access reviews enforced?,High,Cyber
RISK-12,T2,Risk,Are Anti-Money Laundering (AML) and Know Your Customer (KYC) checks applied?,Moderate,Fiduciary
RISK-13,T2,Risk,Is there a strict policy and register for managing gifts and hospitality?,High,Reputation
RISK-14,T2,Risk,Are all official travel requests pre-approved and aligned with program budgets?,Moderate,Fiduciary
RISK-15,T2,Risk,Are per diem and allowance rates standardized and aligned with donor/government scales?,High,Fiduciary
RISK-16,T2,Risk,Is the payroll reconciled monthly against the active HR master data?,Critical,Fiduciary
RISK-17,T2,Risk,Are biometric or strict identity verification checks used for payroll processing?,High,Fiduciary
RISK-18,T2,Risk,Are staff trained regularly on identifying procurement and financial red flags?,High,Fiduciary
RISK-19,T2,Risk,Is there a mandatory fraud awareness training program for all grant-handling staff?,High,Fiduciary
RISK-20,T2,Risk,Is there an anonymous third-party managed whistleblowing hotline?,Critical,Reputation
RISK-21,T2,Risk,Is there a standardized SOP for investigating allegations of fraud?,High,Fiduciary
RISK-22,T2,Risk,Are disciplinary sanctions consistently applied for verified ethical breaches?,High,Reputation
RISK-23,T2,Risk,Does the agency maintain adequate insurance for assets fleet and fiduciary liability?,Moderate,Operational
RISK-24,T2,Risk,Has the Board defined and approved the agency's risk appetite statement?,Moderate,Governance
RISK-25,T2,Risk,Are top institutional risks reported to the Board on a quarterly basis?,High,Governance
RISK-26,T2,Risk,Is there a specific risk mitigation plan for cyberattacks and ransomware?,Critical,Cyber
RISK-27,T2,Risk,Are vendor contracts subjected to rigorous cybersecurity and data privacy audits?,High,Cyber
RISK-28,T2,Risk,Is there a protocol for managing physical security during public health emergencies?,High,Operational
RISK-29,T2,Risk,Are political and institutional transition risks documented and mitigated?,Moderate,Governance
RISK-30,T2,Risk,Is there a formal process for updating the risk register based on audit findings?,High,Governance
AUD-01,T2,Audit,Is there an independent Internal Audit Charter approved by the Board?,High,Governance
AUD-02,T2,Audit,Is there an independent Audit Committee comprising non-executive board members?,High,Governance
AUD-03,T2,Audit,Is a risk-based Annual Internal Audit Plan developed and approved?,High,Governance
AUD-04,T2,Audit,Does the internal audit scope cover ALL operational units not just Finance and Admin?,High,Governance
AUD-05,T2,Audit,Are internal audits conducted at the frequency defined in the annual plan?,High,Governance
AUD-06,T2,Audit,Are reputable independent external auditors appointed annually?,High,Fiduciary
AUD-07,T2,Audit,Is there a formal SOP and tracker for monitoring and closing audit findings?,Critical,Governance
AUD-08,T2,Audit,Does management provide formal responses to all audit recommendations?,High,Governance
AUD-09,T2,Audit,Does the DG/Board systematically review audit reports and enforce oversight?,Critical,Governance
AUD-10,T2,Audit,Does the agency consistently achieve unqualified (clean) external audit opinions?,High,Fiduciary
AUD-11,T2,Audit,Is the agency prepared for the requirements of a USG Single Audit?,High,Compliance
AUD-12,T2,Audit,Are special fraud investigations conducted when red flags are identified?,High,Fiduciary
AUD-13,T2,Audit,Are internal quality assessments conducted on the audit function itself?,Moderate,Governance
AUD-14,T2,Audit,Is the internal audit unit staffed with qualified professionals (CIA CPA)?,High,Governance
AUD-15,T2,Audit,Do audit staff meet continuing professional education (CPE) requirements?,Moderate,Governance
ETH-01,T2,Ethics,Is there a formally approved zero-tolerance Anti-Fraud Policy?,Critical,Reputation
ETH-02,T2,Ethics,Do all staff sign an annual Code of Conduct acknowledging ethical standards?,High,Reputation
ETH-03,T2,Ethics,Are annual Conflict of Interest (COI) declarations mandatory for senior staff?,High,Reputation
ETH-04,T2,Ethics,Is the whistleblowing mechanism strictly anonymous to prevent retaliation?,Critical,Reputation
ETH-05,T2,Ethics,Is regular mandatory fraud awareness training conducted for all staff?,High,Fiduciary
ETH-06,T2,Ethics,Is there a standardized SOP for investigating fraud allegations?,High,Fiduciary
ETH-07,T2,Ethics,Are disciplinary sanctions consistently applied for ethical breaches?,High,Reputation
ETH-08,T2,Ethics,Is there a strict policy and register for managing gifts and hospitality?,High,Reputation
ETH-09,T2,Ethics,Is the payment of facilitation grease payments strictly prohibited?,Critical,Fiduciary
ETH-10,T2,Ethics,Is annual ethics training integrated into the onboarding process?,Moderate,Operational
ETH-11,T2,Ethics,Is there an Ethics Committee to advise management on complex dilemmas?,Moderate,Governance
ETH-12,T2,Ethics,Are Integrity Pacts required from vendors for major procurements?,High,Procurement
ETH-13,T2,Ethics,Are sub-recipients assessed for their ethical and anti-fraud controls?,High,Fiduciary
ETH-14,T2,Ethics,Is a speak-up culture actively promoted by executive leadership?,Moderate,Reputation
ETH-15,T2,Ethics,Is financial and procurement data published on a transparency portal?,Moderate,Reputation
GRANT-01,T3,Grant,Does the agency have direct experience managing large-scale multilateral grants as a Principal Recipient?,High,Programmatic
GRANT-02,T3,Grant,Is there dedicated capacity for developing compliant grant proposals?,Moderate,Programmatic
GRANT-03,T3,Grant,Is there expertise in developing budgets compliant with 2 CFR 200 and donor rules?,High,Fiduciary
GRANT-04,T3,Grant,Is there a formal Go/No-Go review process for responding to NOFOs/RFPs?,Moderate,Programmatic
GRANT-05,T3,Grant,Are legal and finance teams involved in negotiating grant agreement terms?,High,Fiduciary
GRANT-06,T3,Grant,Is there a dedicated Grant/Project Management Unit (PMU) with clearly defined fiduciary roles?,High,Programmatic
GRANT-07,T3,Grant,Is there a comprehensive Grant Management Manual detailing SOPs?,High,Programmatic
GRANT-08,T3,Grant,Are formal internal and donor kick-off meetings conducted for every new award?,Moderate,Programmatic
GRANT-09,T3,Grant,Does the financial system link expenditure data directly to programmatic progress?,High,Fiduciary
GRANT-10,T3,Grant,Is there a system for tracking deliverables against award milestones?,High,Programmatic
GRANT-11,T3,Grant,Are sub-awards managed through a formalized sub-granting process?,High,Fiduciary
GRANT-12,T3,Grant,Are sub-recipients subject to formal risk assessments and routine monitoring?,Critical,Fiduciary
GRANT-13,T3,Grant,Is there a formal process for managing and approving budget modifications?,High,Fiduciary
GRANT-14,T3,Grant,Are No-Cost Extension (NCE) requests managed proactively and justified?,Moderate,Programmatic
GRANT-15,T3,Grant,Are programmatic reports narrative-driven and aligned with financial spend?,High,Programmatic
GRANT-16,T3,Grant,Can the financial system provide consolidated data for multi-partner grants?,High,Fiduciary
GRANT-17,T3,Grant,Are quarterly grant compliance reviews conducted internally?,High,Fiduciary
GRANT-18,T3,Grant,Is there a formal SOP for grant close-out including final reporting?,High,Programmatic
GRANT-19,T3,Grant,Are final technical and financial reports submitted within donor deadlines?,Critical,Compliance
GRANT-20,T3,Grant,Are asset disposition plans developed and approved at grant close-out?,High,Fiduciary
GRANT-21,T3,Grant,Are lessons learned documented and shared across the agency post-grant?,Moderate,Operational
GRANT-22,T3,Grant,Are grant files maintained in a standardized audit-ready format?,High,Compliance
GRANT-23,T3,Grant,Is After-The-Fact (ATF) time and effort reporting enforced for all grant staff?,Critical,Compliance
GRANT-24,T3,Grant,Is there an allowability matrix guiding staff on allowable vs. unallowable costs?,High,Fiduciary
GRANT-25,T3,Grant,Are indirect costs applied consistently using an approved NICRA or de minimis rate?,High,Fiduciary
PM-01,T3,Program,Is there a centralized Project Management Office (PMO) establishing standards?,High,Operational
PM-02,T3,Program,Is a standardized project management methodology (e.g. PMBOK) adopted?,Moderate,Operational
PM-03,T3,Program,Are Project Charters developed and approved for all major initiatives?,Moderate,Operational
PM-04,T3,Program,Are detailed Work Breakdown Structures (WBS) created for all projects?,Moderate,Operational
PM-05,T3,Program,Are projects scheduled using Gantt charts or critical path methodologies?,Moderate,Operational
PM-06,T3,Program,Is resource allocation tracked to prevent staff burnout or underutilization?,Moderate,Operational
PM-07,T3,Program,Are project-level risk registers maintained and updated monthly?,High,Operational
PM-08,T3,Program,Is there a formal issue log for tracking and resolving project blockers?,Moderate,Operational
PM-09,T3,Program,Is there a formal change control process for project scope adjustments?,High,Operational
PM-10,T3,Program,Are quality management plans defined for project deliverables?,Moderate,Operational
PM-11,T3,Program,Are operational Steering Committees established for major programs?,High,Governance
PM-12,T3,Program,Are standardized weekly/monthly project status reports generated?,Moderate,Operational
PM-13,T3,Program,Is there a stakeholder engagement plan for every major project?,Moderate,Reputation
PM-14,T3,Program,Are project schedules integrated with the procurement pipeline?,High,Operational
PM-15,T3,Program,Are project financial burn rates tracked against the physical schedule?,High,Fiduciary
PM-16,T3,Program,Is there a process for tracking post-implementation benefits realization?,Moderate,Programmatic
PM-17,T3,Program,Are lessons learned captured formally at every project phase and closure?,Moderate,Operational
PM-18,T3,Program,Are enterprise project management (EPM) software tools deployed?,Moderate,Cyber
PM-19,T3,Program,Are project managers certified or trained in standard methodologies?,Low,Operational
PM-20,T3,Program,Is the agency's portfolio of projects managed strategically as a single entity?,High,Operational
MEL-01,T3,MEL,Is there a comprehensive MEL Plan for every major program and grant?,High,Programmatic
MEL-02,T3,MEL,Is a Theory of Change (ToC) developed for strategic interventions?,Moderate,Programmatic
MEL-03,T3,MEL,Are Indicator Reference Sheets (IRS) created for all KPIs?,Moderate,Programmatic
MEL-04,T3,MEL,Are baseline studies conducted before program implementation begins?,High,Programmatic
MEL-05,T3,MEL,Are data collection tools digitized (e.g. ODK Kobo) for field use?,Moderate,Cyber
MEL-06,T3,MEL,Are routine Data Quality Assessments (DQAs) conducted and documented?,High,Programmatic
MEL-07,T3,MEL,Is routine monitoring data reviewed monthly to track indicator progress?,Moderate,Programmatic
MEL-08,T3,MEL,Are independent mid-term and final evaluations commissioned?,High,Programmatic
MEL-09,T3,MEL,Is there a formal Learning Agenda guiding research and evaluations?,Moderate,Programmatic
MEL-10,T3,MEL,Are After-Action Reviews (AARs) conducted post-outbreak or post-event?,High,Operational
MEL-11,T3,MEL,Is MEL data visualized using interactive dashboards (e.g. PowerBI)?,Moderate,Cyber
MEL-12,T3,MEL,Are feedback loops established to share MEL findings with field teams?,Moderate,Programmatic
MEL-13,T3,MEL,Is all programmatic data disaggregated by sex age and disability?,High,Programmatic
MEL-14,T3,MEL,Is there a Community Response Mechanism for beneficiary feedback?,Moderate,Reputation
MEL-15,T3,MEL,Are dedicated qualified MEL specialists hired within the agency?,Moderate,Operational
PART-01,T3,Partnership,Is there a formal Partnership Engagement Framework?,Moderate,Operational
PART-02,T3,Partnership,Does the agency actively lead or participate in Health/Security Donor TWGs?,High,Programmatic
PART-03,T3,Partnership,Is a comprehensive stakeholder mapping exercise conducted regularly?,Moderate,Operational
PART-04,T3,Partnership,Are all partnerships formalized through clear legally reviewed MOUs?,High,Fiduciary
PART-05,T3,Partnership,Is there a strategy for promoting private sector co-investment?,Moderate,Fiduciary
PART-06,T3,Partnership,Are community engagement strategies integrated into program design?,Moderate,Reputation
PART-07,T3,Partnership,Is there active collaboration with sister agencies (e.g. NPHI Regulatory)?,High,Programmatic
PART-08,T3,Partnership,Is the agency actively engaged with global bodies (Africa CDC WHO US-CDC)?,High,Programmatic
PART-09,T3,Partnership,Are partnerships evaluated annually for mutual value and impact?,Low,Operational
PART-10,T3,Partnership,Is there a strategic communication plan for partners and the public?,Moderate,Reputation
PART-11,T3,Partnership,Are sub-national government entities engaged in joint planning?,High,Programmatic
PART-12,T3,Partnership,Is there a formal mechanism for resolving disputes with partners?,Moderate,Operational
PART-13,T3,Partnership,Are academic and research institutions integrated into program design?,Moderate,Programmatic
PART-14,T3,Partnership,Is there a framework for engaging traditional and religious leaders?,Low,Reputation
PART-15,T3,Partnership,Are donor visibility and branding guidelines strictly followed?,High,Compliance
USG-01,T4,USG,Is there documented evidence that staff are trained on 2 CFR 200 (Uniform Guidance)?,High,Compliance
USG-02,T4,USG,Are USG cost principles (allowable/unallowable costs) documented in an internal manual?,High,Fiduciary
USG-03,T4,USG,Is there a pre-transaction review process to verify cost allowability?,High,Fiduciary
USG-04,T4,USG,Has the agency negotiated a NICRA or formally adopted the 10% de minimis rate?,High,Fiduciary
USG-05,T4,USG,Are the start and end dates of the Period of Performance strictly tracked?,High,Compliance
USG-06,T4,USG,Is there a checklist for identifying when USG Prior Approvals are required?,High,Compliance
USG-07,T4,USG,Is program income tracked and applied according to the specific award's terms?,Moderate,Fiduciary
USG-08,T4,USG,Are USG standard financial conditions understood and monitored for compliance?,High,Compliance
USG-09,T4,USG,Has the agency secured statutory tax/VAT exemptions specifically for USG cooperative agreements?,High,Fiduciary
USG-10,T4,USG,Is there a separate property register exclusively for USG-funded equipment?,High,Fiduciary
USG-11,T4,USG,Are USG assets tagged with durable labels indicating Federal Property?,High,Fiduciary
USG-12,T4,USG,Is a physical inventory of USG property conducted and reconciled annually?,High,Fiduciary
USG-13,T4,USG,Are subrecipients assessed for risk per 2 CFR 200.331 before awarding funds?,Critical,Compliance
USG-14,T4,USG,Do all sub-award agreements include the mandatory USG flow-down clauses?,Critical,Compliance
USG-15,T4,USG,Is there a schedule for conducting desk reviews and site visits of subrecipients?,High,Compliance
USG-16,T4,USG,Are Corrective Action Plans (CAPs) issued for subrecipient audit findings?,High,Compliance
USG-17,T4,USG,Are relevant staff trained on the SF-424 application and reporting suite?,Moderate,Compliance
USG-18,T4,USG,Are Federal Financial Reports (SF-425) submitted accurately and on time?,Critical,Compliance
USG-19,T4,USG,Are performance reports aligned with USG-specific indicators and timelines?,High,Compliance
USG-20,T4,USG,Is the agency's SAM.gov registration active and is the UEI managed correctly?,Critical,Compliance
USG-21,T4,USG,Is the agency aware of and compliant with FPDS-NG reporting for contracts?,Moderate,Compliance
USG-22,T4,USG,Is After-The-Fact (ATF) time and effort certification enforced for all staff?,Critical,Compliance
USG-23,T4,USG,Are procurement files compliant with 2 CFR 200.317-327 (USG procurement standards)?,Critical,Compliance
USG-24,T4,USG,Are vendors and subrecipients checked against the SAM.gov Exclusions list?,Critical,Compliance
USG-25,T4,USG,Is the SF-LLL (Lobbying Certification) completed and filed for applicable awards?,High,Compliance
USG-26,T4,USG,Are non-discrimination and Title VI civil rights requirements integrated?,High,Compliance
USG-27,T4,USG,Are environmental screening checklists completed for applicable USG activities?,High,Compliance
USG-28,T4,USG,Is IRB/FWA approval obtained for any USG-funded human subjects research?,Critical,Compliance
USG-29,T4,USG,Is PHS Animal Welfare Assurance obtained if applicable to the research?,Moderate,Compliance
USG-30,T4,USG,Are Financial Conflict of Interest (FCOI) policies compliant with PHS/NSF rules?,High,Compliance
USG-31,T4,USG,Is the agency prepared to undergo an annual Single Audit (Subpart F)?,Critical,Compliance
USG-32,T4,USG,Is there a process for resolving Single Audit findings in the SEFA?,High,Compliance
USG-33,T4,USG,Are internal controls specifically documented and tested for USG compliance?,High,Fiduciary
USG-34,T4,USG,Are USG financial records retained for a minimum of 3 years post-closeout?,High,Compliance
USG-35,T4,USG,Does the agency guarantee the USG Inspector General access to all records?,Critical,Compliance
INTL-01,T4,International,Is the agency familiar with the Global Fund's FMS and PSM guidelines?,High,Compliance
INTL-02,T4,International,Does the agency comply with the World Bank's Environmental and Social Framework (ESF)?,High,Compliance
INTL-03,T4,International,Is the agency compliant with Gavi's HSS and cold-chain requirements?,Moderate,Compliance
INTL-04,T4,International,Are Global Fund Principal Recipient (PR) reporting templates fully understood?,High,Compliance
INTL-05,T4,International,Is there a dedicated focal point for Global Fund grant management?,High,Operational
INTL-06,T4,International,Are World Bank procurement guidelines (including STEP) utilized correctly?,High,Procurement
INTL-07,T4,International,Is the agency compliant with UNDP's Harmonized Approach to Cash Transfers (HACT)?,High,Fiduciary
INTL-08,T4,International,Are bilateral donor (e.g. FCDO EU) specific fiduciary requirements mapped?,Moderate,Compliance
INTL-09,T4,International,Is there a process for managing multi-donor trust funds or pooled funding?,High,Fiduciary
INTL-10,T4,International,Are donor-specific audit requirements (e.g. GF Locally Approved Audit) met?,Critical,Compliance
INTL-11,T4,International,Is the agency compliant with the International Health Regulations (IHR 2005)?,High,Programmatic
INTL-12,T4,International,Are WHO prequalification standards met for any locally manufactured products?,Moderate,Operational
INTL-13,T4,International,Is the agency compliant with the Paris Declaration on Aid Effectiveness?,Low,Programmatic
INTL-14,T4,International,Are donor visibility and branding guidelines strictly followed for all partners?,High,Compliance
INTL-15,T4,International,Is there a system for tracking and reporting donor-specific gender markers?,High,Programmatic
INTL-16,T4,International,Are climate finance and environmental safeguard requirements met?,Moderate,Compliance
INTL-17,T4,International,Is the agency compliant with the ILO's core conventions regarding child labor?,High,Compliance
INTL-18,T4,International,Are data sharing agreements compliant with international privacy standards?,High,Cyber
INTL-19,T4,International,Is there a framework for managing intellectual property generated by donor funds?,Moderate,Reputation
INTL-20,T4,International,Are sub-national entities trained on international donor compliance requirements?,High,Compliance
INTL-21,T4,International,Is there a process for handling donor-specific complaints or grievances?,Moderate,Reputation
INTL-22,T4,International,Are anti-terrorism financing and sanctions checks applied to all vendors?,Critical,Compliance
INTL-23,T4,International,Is the agency compliant with the OECD DAC guidelines on aid untying?,Low,Procurement
INTL-24,T4,International,Are there protocols for managing conflicts of interest involving donor staff?,High,Reputation
INTL-25,T4,International,Is there a system for tracking and reporting donor-specific environmental indicators?,Moderate,Programmatic
INTL-26,T4,International,Are financial reports translated into English/French as required by the donor?,Moderate,Compliance
INTL-27,T4,International,Is there a dedicated compliance officer for multilateral donor requirements?,High,Compliance
INTL-28,T4,International,Are donor-specific procurement thresholds and methods clearly documented?,High,Procurement
INTL-29,T4,International,Is there a process for managing donor-specific sub-recipient capacity building?,High,Programmatic
INTL-30,T4,International,Are donor-specific asset management and disposal rules strictly followed?,High,Fiduciary
INTL-31,T4,International,Is the agency compliant with the UN Convention on the Rights of Persons with Disabilities?,Moderate,Reputation
INTL-32,T4,International,Are there protocols for managing donor-specific cybersecurity requirements?,High,Cyber
INTL-33,T4,International,Is there a system for tracking and reporting donor-specific HIV/AIDS markers (PEPFAR)?,High,Programmatic
INTL-34,T4,International,Are donor-specific anti-corruption and integrity pacts signed by all vendors?,High,Procurement
INTL-35,T4,International,Is there a process for managing donor-specific close-out and transition requirements?,High,Programmatic
INTL-36,T4,International,Are donor-specific financial management and internal control standards met?,Critical,Fiduciary
INTL-37,T4,International,Is the agency compliant with the UN Guiding Principles on Business and Human Rights?,Moderate,Reputation
INTL-38,T4,International,Are there protocols for managing donor-specific data privacy and protection requirements?,High,Cyber
INTL-39,T4,International,Is there a system for tracking and reporting donor-specific nutrition markers?,Moderate,Programmatic
INTL-40,T4,International,Are donor-specific procurement fraud and corruption red flags actively monitored?,Critical,Procurement
DIG-01,T5,Digital,Is an integrated ERP system deployed for Finance HR and Procurement?,High,Cyber
DIG-02,T5,Digital,Is an automated HRMIS managing the entire employee lifecycle?,Moderate,Cyber
DIG-03,T5,Digital,Is an e-Procurement platform utilized for tendering and contract management?,High,Procurement
DIG-04,T5,Digital,Is a centralized Document Management System (DMS) in place?,Moderate,Cyber
DIG-05,T5,Digital,Is the Logistics Management Information System (LMIS) deployed to sub-national levels?,Critical,Operational
DIG-06,T5,Digital,Are digital surveillance systems integrated with national labs?,High,Operational
DIG-07,T5,Digital,Is there an approved Enterprise Data Governance Policy?,High,Cyber
DIG-08,T5,Digital,Is there a standardized Data Dictionary across all agency systems?,Moderate,Cyber
DIG-09,T5,Digital,Are systems designed for interoperability (e.g. HL7 FHIR standards)?,High,Cyber
DIG-10,T5,Digital,Is there a comprehensive enforced Cybersecurity Policy?,Critical,Cyber
DIG-11,T5,Digital,Are annual third-party penetration tests conducted on critical systems?,High,Cyber
DIG-12,T5,Digital,Is Role-Based Access Control (RBAC) strictly enforced across all systems?,Critical,Cyber
DIG-13,T5,Digital,Are offsite backup locations documented and written backup schedules strictly enforced?,Critical,Cyber
DIG-14,T5,Digital,Is the Disaster Recovery Plan (DRP) tested annually via simulation?,High,Cyber
DIG-15,T5,Digital,Is there an IT Asset Register tracking all hardware and software licenses?,Moderate,Cyber
DIG-16,T5,Digital,Is an IT Helpdesk system in place to track and resolve staff issues?,Low,Operational
DIG-17,T5,Digital,Is there a secure compliant cloud hosting strategy for agency data?,High,Cyber
DIG-18,T5,Digital,Are Privacy Impact Assessments (PIA) conducted for new digital tools?,High,Cyber
DIG-19,T5,Digital,Is regular digital literacy and cyber-hygiene training provided to staff?,High,Cyber
DIG-20,T5,Digital,Is there an IT Steering Committee overseeing digital investments?,Moderate,Governance
DIG-21,T5,Digital,Are mobile data collection tools utilized for field surveillance and reporting?,Moderate,Operational
DIG-22,T5,Digital,Is there a system for managing and tracking IT support tickets?,Low,Operational
DIG-23,T5,Digital,Are software updates and patch management processes strictly enforced?,Critical,Cyber
DIG-24,T5,Digital,Is there a protocol for managing end-of-life hardware and software?,Moderate,Cyber
DIG-25,T5,Digital,Are digital systems accessible to staff with disabilities?,Low,Reputation
EPR-01,T5,Emergency,Is there a functional fully equipped Emergency Operations Center (EOC)?,High,Operational
EPR-02,T5,Emergency,Are hazard-specific contingency and emergency response plans updated annually?,High,Operational
EPR-03,T5,Emergency,Are simulation exercises and After-Action Reviews (AARs) conducted post-event?,High,Operational
EPR-04,T5,Emergency,Are emergency medical/health product stockpiles maintained and rotated?,High,Operational
EPR-05,T5,Emergency,Are surge staffing arrangements and deployment rosters formally documented?,High,Operational
EPR-06,T5,Emergency,Are emergency procurement fast-track procedures defined and tested?,High,Procurement
EPR-07,T5,Emergency,Are public health emergency KPIs monitored in real-time?,High,Operational
EPR-08,T5,Emergency,Is there a formal protocol for declaring and managing a state of emergency?,High,Governance
EPR-09,T5,Emergency,Are EOC staff trained on incident command system (ICS) protocols?,High,Operational
EPR-10,T5,Emergency,Is there a system for tracking and managing emergency donor funds?,High,Fiduciary
EPR-11,T5,Emergency,Are emergency communication systems (satellite radio etc.) tested regularly?,High,Operational
EPR-12,T5,Emergency,Is there a formal protocol for coordinating with international emergency response teams?,High,Operational
EPR-13,T5,Emergency,Are emergency logistics and supply chain pre-positioning agreements in place?,High,Operational
EPR-14,T5,Emergency,Is there a system for managing and tracking emergency volunteer deployments?,Moderate,Operational
EPR-15,T5,Emergency,Are emergency risk communication and community engagement (RCCE) protocols defined?,High,Reputation
EPR-16,T5,Emergency,Is there a formal protocol for managing dead bodies and mortalities during emergencies?,Moderate,Operational
EPR-17,T5,Emergency,Are emergency mental health and psychosocial support (MHPSS) services available for staff?,Moderate,Operational
EPR-18,T5,Emergency,Is there a system for tracking and managing emergency security incidents?,High,Operational
EPR-19,T5,Emergency,Are emergency financial management and reporting procedures defined?,High,Fiduciary
EPR-20,T5,Emergency,Is there a formal protocol for transitioning from emergency response to recovery?,High,Operational
RES-01,T5,Research,Is there an approved costed institutional Research Agenda aligned with national priorities?,High,Programmatic
RES-02,T5,Research,Is there a robust governance framework for managing grant-funded research (ethics IP)?,High,Reputation
RES-03,T5,Research,Is there a centralized accessible Institutional Repository for all publications?,Moderate,Operational
RES-04,T5,Research,Are research partnerships with academic and global institutions formalized via MOUs?,Moderate,Programmatic
RES-05,T5,Research,Is there a formal knowledge dissemination and translation strategy to inform policy?,High,Programmatic
RES-06,T5,Research,Is there an Institutional Review Board (IRB) or Research Ethics Committee (REC)?,Critical,Compliance
RES-07,T5,Research,Are researchers trained on responsible conduct of research (RCR) and ethics?,High,Compliance
RES-08,T5,Research,Is there a formal process for managing intellectual property (IP) and technology transfer?,Moderate,Reputation
RES-09,T5,Research,Are research data management plans (DMPs) required for all grant-funded research?,High,Cyber
RES-10,T5,Research,Is there a system for tracking and reporting research outputs and impact?,Moderate,Programmatic
RES-11,T5,Research,Are research facilities and equipment properly maintained and calibrated?,High,Operational
RES-12,T5,Research,Is there a formal process for managing research conflicts of interest?,High,Reputation
RES-13,T5,Research,Are research participants' rights and welfare strictly protected?,Critical,Compliance
RES-14,T5,Research,Is there a formal process for managing research misconduct allegations?,High,Reputation
RES-15,T5,Research,Is there a system for tracking and reporting research funding and expenditures?,High,Fiduciary
PMO-01,T5,PMO,Is there a formally established resourced Project Management Office (PMO)?,High,Operational
PMO-02,T5,PMO,Does the PMO maintain an enterprise project portfolio dashboard tracking all grants?,High,Operational
PMO-03,T5,PMO,Are project management standards (e.g. PMBOK/PRINCE2) mandatory for all grants?,High,Operational
PMO-04,T5,PMO,Are project risks escalated through a structured governance process to the SteerCo?,High,Operational
PMO-05,T5,PMO,Are project benefits and outcomes tracked for at least 12 months post-completion?,Moderate,Programmatic
PMO-06,T5,PMO,Is there a project quality assurance framework for all major initiatives?,Moderate,Operational
PMO-07,T5,PMO,Are project managers certified or trained in standard methodologies?,Moderate,Operational
PMO-08,T5,PMO,Are lessons learned systematically captured and shared across the agency?,Moderate,Operational
PMO-09,T5,PMO,Is there a formal process for managing project scope changes and variations?,High,Operational
PMO-10,T5,PMO,Are project resources (staff equipment) allocated and tracked centrally?,Moderate,Operational
PMO-11,T5,PMO,Is there a formal process for managing project dependencies and interdependencies?,Moderate,Operational
PMO-12,T5,PMO,Are project communications plans developed and executed for all major initiatives?,Moderate,Reputation
PMO-13,T5,PMO,Is there a formal process for managing project procurement and contracting?,High,Procurement
PMO-14,T5,PMO,Are project financial management and reporting procedures strictly followed?,High,Fiduciary
PMO-15,T5,PMO,Is there a formal process for managing project close-out and handover to operations?,High,Operational`

// A handful of Core-bank questions live in the universal fiduciary bank but in
// practice apply only to specific archetypes - donor-compliance (USG &
// multilateral), donor tax/VAT exemption, sub-recipient oversight and the
// emergency/research lens items are not relevant to a private commercial entity.
// This overlay scopes those questions to [Public, Civil Society] without moving
// them out of the canonical CSV. Keyed by Q_ID; any ID not listed stays universal.
const CORE_ARCHETYPE_SCOPE: Record<string, Archetype[]> = {
  'LEG-07': ['Public', 'Civil Society'],
  'GRANT-12': ['Public', 'Civil Society'],
  'USG-13': ['Public', 'Civil Society'],
  'USG-22': ['Public', 'Civil Society'],
  'INTL-07': ['Public', 'Civil Society'],
  'EPR-03': ['Public', 'Civil Society'],
  'RES-06': ['Public', 'Civil Society'],
}

function parseBank(csv: string): Question[] {
  return csv.trim().split('\n').slice(1).map(line => {
    const c = line.split(',')
    const id = c[0].trim()
    const tier = TIER_OF[c[1].trim()] ?? 1
    const domain = DOMAIN_DISPLAY[c[2].trim()] ?? c[2].trim()
    const priority = c[c.length - 2].trim() as Question['priority']
    const riskCategory = c[c.length - 1].trim()
    const question = c.slice(3, c.length - 2).join(',').trim()
    const enr = QUESTION_ENRICHMENT[id] ?? defaultEnrichment(domain, riskCategory)
    return {
      id,
      domain,
      tier,
      tierName: TIER_NAMES[tier - 1],
      question,
      insight: enr.insight,
      evidence: enr.evidence,
      verificationMethod: enr.verificationMethod,
      score: 0,
      maxScore: 5,
      riskIfWeak: priority,
      capacityAction: enr.capacityAction,
      donorLink: enr.donorLink,
      nationalLink: enr.nationalLink,
      priority,
      riskCategory,
      archetypes: CORE_ARCHETYPE_SCOPE[id],
    }
  })
}

// ============================================================================
// Modular Sovereignty - Thematic Lenses
// ----------------------------------------------------------------------------
// CRAFT respects institutional sovereignty: the fiduciary Core Foundation is
// always active, while institutions activate only the thematic lenses relevant
// to their mandate, donor requirements, and national context. The Dashboard and
// Assessment Wizard recalculate dynamically against the active lenses.
// ============================================================================

export type LensId = 'climate' | 'emergency' | 'research'

export interface Lens {
  id: LensId
  name: string
  emoji: string
  description: string
  geoNote: string
  defaultOn: boolean
  // Domains this lens governs in the question bank.
  domains: string[]
}

// Domains owned by the Climate & ESG lens (the 50 new CLIM questions below).
const CLIMATE_DOMAINS = [
  'Climate Governance',
  'Env. & Social Safeguards',
  'Climate Finance Access',
  'MRV & Article 6',
]

export const LENSES: Lens[] = [
  {
    id: 'climate',
    name: 'Climate, ESG & Article 6 Lens',
    emoji: '🌍',
    description:
      'Assesses Environmental & Social Safeguards, Climate Budget Tagging, MRV systems, and Paris Agreement Article 6 carbon market readiness.',
    geoNote:
      'Recommended for institutions seeking GCF/WB Direct Access or engaging in sovereign carbon markets.',
    defaultOn: true,
    domains: CLIMATE_DOMAINS,
  },
  {
    id: 'emergency',
    name: 'Emergency & Health Security Lens',
    emoji: '🚨',
    description:
      'Assesses Emergency Operations Center (EOC) readiness, surge capacity, and emergency supply chain logistics.',
    geoNote:
      'Recommended for National Public Health Institutes and institutions with an emergency-response mandate.',
    defaultOn: true,
    domains: ['Emergency Preparedness'],
  },
  {
    id: 'research',
    name: 'Research, Data & Innovation Lens',
    emoji: '🔬',
    description:
      'Assesses research ethics (IRB), genomic/data sovereignty, and intellectual property management.',
    geoNote:
      'Recommended for institutions running research programmes or managing sensitive scientific data.',
    defaultOn: true,
    domains: ['Research & Innovation'],
  },
]

export const LENS_BY_ID: Record<LensId, Lens> = Object.fromEntries(
  LENSES.map(l => [l.id, l]),
) as Record<LensId, Lens>

// A lens is active by default when its defaultOn flag is set. The Core Foundation
// (everything not owned by a lens) is always active.
export function defaultActiveLenses(): Record<LensId, boolean> {
  return LENSES.reduce(
    (acc, l) => ({ ...acc, [l.id]: l.defaultOn }),
    {} as Record<LensId, boolean>,
  )
}

// --- The 50-question Climate & ESG Readiness Module --------------------------
// Maturity-anchored questions spanning Climate Governance, Safeguards, Climate
// Finance, and MRV / Paris Agreement Article 6. No specific agency or country is
// named - the realities are universalized.
interface RawClimate {
  id: string
  tier: string
  domain: string
  question: string
  insight: string
  evidence: string
  verification: string
  scoring: string
  risk: string
  action: string
  donorLink: string
  nationalLink: string
  priority: string
}

const RAW_CLIMATE: RawClimate[] = [
  {"id":"CLIM-01","tier":"T1","domain":"Climate Governance","question":"Are institutional strategic plans explicitly aligned with national NDCs and NAPs?","insight":"Strategic plans often exist in silos, disconnected from national climate commitments.","evidence":"Approved Strategic Plan; NDC/NAP alignment matrix.","verification":"Document review; Interview.","scoring":"0=None | 1=Awareness | 2=Draft alignment | 3=Formally aligned | 4=Tracked via KPIs | 5=Automated NDC dashboard.","risk":"Strategic","action":"Develop formal NDC alignment matrix.","donorLink":"GCF Readiness; WB CPE","nationalLink":"Government NDC Documents","priority":"Critical"},
  {"id":"CLIM-02","tier":"T1","domain":"Climate Governance","question":"Is there a designated Climate Change Focal Point with clear authority and dedicated budget?","insight":"Climate responsibilities are often added to existing roles without budget, causing bottlenecks.","evidence":"Organogram; Job description; Budget allocation.","verification":"Document review; Interview.","scoring":"0=None | 1=Informal | 2=Designated, no budget | 3=Dedicated unit, limited budget | 4=Fully resourced | 5=Cross-ministerial directorate.","risk":"Operational","action":"Formalize Climate Focal Point role with dedicated budget.","donorLink":"GCF Accreditation","nationalLink":"National Climate Change Act","priority":"High"},
  {"id":"CLIM-03","tier":"T1","domain":"Climate Governance","question":"Is climate risk integrated into sectoral planning and national budgeting (Climate Budget Tagging)?","insight":"Climate expenditures are hidden within general budgets, making tracking impossible.","evidence":"Climate Budget Tagging (CBT) guidelines; Tagged reports.","verification":"Document review; Finance interview.","scoring":"0=None | 1=Ad-hoc | 2=Manual tagging | 3=Standardized tagging | 4=Integrated in system | 5=Real-time automated CBT.","risk":"Fiduciary","action":"Implement standardized CBT methodology.","donorLink":"WB PforR; GCF","nationalLink":"MoF CBT Guidelines","priority":"Critical"},
  {"id":"CLIM-04","tier":"T1","domain":"Climate Governance","question":"Does the governing board receive quarterly reports on institutional climate and ESG performance?","insight":"Boards often focus solely on financial metrics, ignoring mounting ESG risks.","evidence":"Board minutes; Quarterly ESG performance reports.","verification":"Document review; Interview.","scoring":"0=None | 1=Annual | 2=Ad-hoc | 3=Quarterly, no action | 4=Quarterly with tracked actions | 5=Real-time ESG dashboard for Board.","risk":"Governance","action":"Establish mandatory quarterly ESG reporting agenda.","donorLink":"GCF ESP; IFC PS","nationalLink":"National Corporate Governance Code","priority":"High"},
  {"id":"CLIM-05","tier":"T1","domain":"Climate Governance","question":"Is there a formal policy for managing climate-related physical and transition risks?","insight":"Institutions rarely assess how climate change or policy shifts will impact operational continuity.","evidence":"Climate Risk Assessment report; Business Continuity Plan (BCP).","verification":"Document review; Interview.","scoring":"0=None | 1=Informal | 2=Basic risk register | 3=Formal assessment | 4=BCP updated with climate risks | 5=Dynamic, scenario-based modeling.","risk":"Operational","action":"Conduct comprehensive climate risk assessment and update BCP.","donorLink":"TCFD; WB ESF","nationalLink":"National Disaster Risk Policy","priority":"High"},
  {"id":"CLIM-06","tier":"T1","domain":"Climate Governance","question":"Are gender and social inclusion (GSI) principles explicitly integrated into climate project design?","insight":"Climate projects often exacerbate inequalities if vulnerable group impacts are not assessed.","evidence":"Gender Action Plan (GAP); Social Inclusion framework.","verification":"Document review; Project file sampling.","scoring":"0=None | 1=Mentioned | 2=Basic checklist | 3=Formal GAP | 4=GAP funded/implemented | 5=GSI outcomes systematically measured.","risk":"Programmatic","action":"Develop and fund a comprehensive Gender Action Plan.","donorLink":"GCF Gender Policy","nationalLink":"National Gender Policy","priority":"High"},
  {"id":"CLIM-07","tier":"T1","domain":"Climate Governance","question":"Is there a formalized mechanism for engaging Indigenous Peoples and local communities in climate planning?","insight":"Top-down planning ignores local knowledge, leading to project delays and reputational damage.","evidence":"Indigenous Peoples Planning Framework (IPPF); Engagement logs.","verification":"Document review; Interview.","scoring":"0=None | 1=Ad-hoc | 2=Consultations documented | 3=Formal IPPF | 4=IPPF implemented with feedback | 5=Co-design with communities.","risk":"Reputational","action":"Develop and operationalize an IPPF.","donorLink":"WB ESS7; GCF ESP","nationalLink":"National Indigenous Rights Framework","priority":"High"},
  {"id":"CLIM-08","tier":"T1","domain":"Climate Governance","question":"Does the institution have a publicly available policy on biodiversity and nature-based solutions?","insight":"Climate interventions sometimes inadvertently harm local ecosystems.","evidence":"Biodiversity policy; Environmental management plans.","verification":"Document review.","scoring":"0=None | 1=General policy | 2=Biodiversity mentioned | 3=Formal policy | 4=Policy enforced | 5=Net-positive biodiversity impact measured.","risk":"Operational","action":"Develop specific biodiversity guidelines.","donorLink":"GCF ESP; CBD","nationalLink":"National Biodiversity Strategy","priority":"Medium"},
  {"id":"CLIM-09","tier":"T1","domain":"Climate Governance","question":"Are climate change considerations integrated into institutional procurement policies?","insight":"Procurement defaults to cheapest options, ignoring lifecycle carbon footprint.","evidence":"Green Procurement Policy; Sustainable vendor criteria.","verification":"Document review; Procurement sampling.","scoring":"0=None | 1=Awareness | 2=Voluntary guidelines | 3=Formal policy | 4=Policy enforced with scoring | 5=Automated carbon tracking in procurement.","risk":"Fiduciary","action":"Integrate environmental criteria into procurement manual.","donorLink":"WB ESS; UN Sustainable Procurement","nationalLink":"National Public Procurement Act","priority":"High"},
  {"id":"CLIM-10","tier":"T1","domain":"Climate Governance","question":"Is there a dedicated internal audit function for reviewing climate and ESG compliance?","insight":"Internal audit traditionally focuses only on financial compliance, leaving ESG risks unverified.","evidence":"Internal Audit Charter; ESG audit reports.","verification":"Document review; Interview with Head of Audit.","scoring":"0=None | 1=Ad-hoc | 2=Planned, not executed | 3=Annual ESG audit | 4=Findings tracked to closure | 5=Continuous, risk-based ESG auditing.","risk":"Governance","action":"Expand Internal Audit Charter to include mandatory annual ESG reviews.","donorLink":"GCF Accreditation; IFC","nationalLink":"National Internal Audit Standards","priority":"High"},
  {"id":"CLIM-11","tier":"T1","domain":"Climate Governance","question":"Does the institution publish an annual Sustainability or ESG Report?","insight":"Lack of public transparency on climate performance erodes donor and public trust.","evidence":"Annual Sustainability/ESG Report.","verification":"Document review.","scoring":"0=None | 1=Data collected, not published | 2=Published irregularly | 3=Published annually, basic | 4=GRI/SASB aligned | 5=Independently assured annual report.","risk":"Reputational","action":"Commit to publishing an annual, independently verified ESG report.","donorLink":"GRI Standards; TCFD","nationalLink":"National Sustainability Reporting Guidelines","priority":"Medium"},
  {"id":"CLIM-12","tier":"T1","domain":"Climate Governance","question":"Is there a formal policy for managing climate-related intellectual property and data sovereignty?","insight":"Institutions often sign away rights to climate data or innovations to external consultants.","evidence":"Data sharing agreements; IP policy.","verification":"Document review; Legal interview.","scoring":"0=None | 1=Ad-hoc | 2=Basic data policy | 3=Formal IP/data sovereignty policy | 4=Enforced in contracts | 5=National framework actively defended.","risk":"Legal","action":"Develop strict IP and data sovereignty policy for climate research.","donorLink":"Paris Agreement; DPGA","nationalLink":"National Data Protection Act","priority":"High"},
  {"id":"CLIM-13","tier":"T2","domain":"Env. & Social Safeguards","question":"Has the institution operationalized an ESMF aligned with international standards?","insight":"Institutions often have an ESMF document but lack operational capacity to apply it.","evidence":"Approved ESMF; Records of ESMF application to recent projects.","verification":"Document review; Project file sampling.","scoring":"0=None | 1=Draft | 2=Approved, not used | 3=Applied to some | 4=Systematically applied | 5=Digitized, real-time ESMF tracking.","risk":"Critical Fiduciary","action":"Operationalize ESMF with dedicated staff and mandatory screening.","donorLink":"GCF ESP; WB ESF","nationalLink":"National Environmental Management Act","priority":"Critical"},
  {"id":"CLIM-14","tier":"T2","domain":"Env. & Social Safeguards","question":"Is there a functional, accessible GRM for affected communities?","insight":"GRMs often exist only on paper, with no actual community awareness or logged resolutions.","evidence":"GRM Policy; GRM logbook/portal; Community awareness materials.","verification":"Document review; Physical observation; Community interview.","scoring":"0=None | 1=Policy only | 2=Mechanism exists, unknown | 3=Logged complaints, slow | 4=Functional, transparent | 5=Proactive, multi-channel with independent oversight.","risk":"Reputational","action":"Launch multi-channel, community-aware GRM with strict resolution timelines.","donorLink":"GCF ESP; WB ESS10","nationalLink":"National Grievance Redress Guidelines","priority":"Critical"},
  {"id":"CLIM-15","tier":"T2","domain":"Env. & Social Safeguards","question":"Are ESIAs conducted and approved BEFORE project implementation begins?","insight":"Projects frequently start before ESIA approval, leading to donor fund suspension.","evidence":"Approved ESIAs; Project start dates vs. ESIA approval dates.","verification":"Document review; Timeline analysis.","scoring":"0=None | 1=Retrospective | 2=Inconsistent | 3=ESIAs for major projects | 4=Mandatory for all applicable | 5=Automated system block preventing start without ESIA.","risk":"Critical Fiduciary","action":"Enforce strict 'No ESIA, No Start' policy with system-enforced blocks.","donorLink":"WB ESS1; GCF ESP","nationalLink":"National EIA Regulations","priority":"Critical"},
  {"id":"CLIM-16","tier":"T2","domain":"Env. & Social Safeguards","question":"Is there a dedicated, ring-fenced budget for implementing ESMPs?","insight":"ESMPs are often approved but remain unfunded, rendering them useless.","evidence":"Project budgets; ESMP budget line items.","verification":"Document review; Finance interview.","scoring":"0=None | 1=Unfunded | 2=Ad-hoc funding | 3=Budgeted but reallocated | 4=Ring-fenced ESMP budget | 5=Automated tracking of ESMP expenditure.","risk":"Fiduciary","action":"Mandate ring-fenced, non-transferable budget lines for all approved ESMPs.","donorLink":"GCF ESP; WB ESS","nationalLink":"National Budget Guidelines","priority":"High"},
  {"id":"CLIM-17","tier":"T2","domain":"Env. & Social Safeguards","question":"Are occupational health and safety (OHS) standards strictly enforced for all project workers and contractors?","insight":"Climate projects carry high physical risks, yet OHS is often neglected for subcontractors.","evidence":"OHS Policy; Contractor OHS compliance reports; Incident logs.","verification":"Document review; Site observation.","scoring":"0=None | 1=Policy, no enforcement | 2=Enforced for staff only | 3=Contractor OHS monitored | 4=Strict enforcement with penalties | 5=Zero-harm culture with proactive audits.","risk":"Operational","action":"Extend OHS policy explicitly to all contractors and enforce via penalties.","donorLink":"IFC PS2; WB ESS2","nationalLink":"National Labor and OHS Act","priority":"High"},
  {"id":"CLIM-18","tier":"T2","domain":"Env. & Social Safeguards","question":"Is there a formal process for the safe and legal disposal of hazardous waste and e-waste?","insight":"Institutions lack protocols for end-of-life management of project materials.","evidence":"Waste management policy; Disposal certificates.","verification":"Document review; Site observation.","scoring":"0=None | 1=Informal disposal | 2=Basic guidelines | 3=Formal policy with licensed vendors | 4=Tracked disposal with certificates | 5=Circular economy principles integrated.","risk":"Environmental","action":"Establish formal agreements with licensed hazardous waste disposal facilities.","donorLink":"Basel Convention; GCF ESP","nationalLink":"National Environmental Waste Regulations","priority":"High"},
  {"id":"CLIM-19","tier":"T2","domain":"Env. & Social Safeguards","question":"Are land acquisition and resettlement processes compliant with international involuntary resettlement standards?","insight":"Uncompensated land acquisition is a leading cause of project cancellation.","evidence":"Resettlement Action Plan (RAP); Compensation records.","verification":"Document review; Legal interview.","scoring":"0=None | 1=Ad-hoc compensation | 2=Basic RAP | 3=RAP implemented with delays | 4=Full compliance with int'l standards | 5=Proactive livelihood restoration.","risk":"Critical Reputational","action":"Develop strict RAP protocols aligned with WB ESS5.","donorLink":"WB ESS5; GCF ESP","nationalLink":"National Land Acquisition Act","priority":"Critical"},
  {"id":"CLIM-20","tier":"T2","domain":"Env. & Social Safeguards","question":"Is there a mechanism to monitor cumulative environmental impacts of multiple projects in the same area?","insight":"Institutions assess projects in isolation, missing compounding environmental degradation.","evidence":"Cumulative impact assessment reports; Regional monitoring data.","verification":"Document review.","scoring":"0=None | 1=Awareness | 2=Ad-hoc consideration | 3=Formal assessments for clustered projects | 4=Integrated regional monitoring | 5=Predictive modeling of cumulative impacts.","risk":"Environmental","action":"Implement cumulative impact assessment requirements for sensitive zones.","donorLink":"WB ESF; GCF ESP","nationalLink":"National Environmental Management Act","priority":"Medium"},
  {"id":"CLIM-21","tier":"T2","domain":"Env. & Social Safeguards","question":"Are supply chain environmental and social risks actively monitored and audited?","insight":"Institutions assume vendors comply with ESG standards, but rarely conduct due diligence.","evidence":"Supplier Code of Conduct; Vendor ESG audit reports.","verification":"Document review; Vendor file sampling.","scoring":"0=None | 1=Basic code | 2=Self-assessment | 3=Third-party audits for major vendors | 4=Systematic ESG scoring | 5=Real-time supply chain ESG risk dashboard.","risk":"Fiduciary","action":"Implement mandatory ESG due diligence for high-value contracts.","donorLink":"UN Guiding Principles on Business and Human Rights","nationalLink":"National Procurement Act","priority":"High"},
  {"id":"CLIM-22","tier":"T2","domain":"Env. & Social Safeguards","question":"Is there a formal protocol for managing cultural heritage and chance finds during implementation?","insight":"Construction frequently uncovers artifacts, leading to work stoppages if no protocol exists.","evidence":"Cultural Heritage Management Plan (CHMP).","verification":"Document review; Project file sampling.","scoring":"0=None | 1=Ad-hoc response | 2=Basic CHMP | 3=CHMP in contractor agreements | 4=Staff/contractors trained | 5=Proactive archaeological screening.","risk":"Operational","action":"Develop and enforce a CHMP for all infrastructure projects.","donorLink":"WB ESS8; GCF ESP","nationalLink":"National Heritage Protection Act","priority":"Medium"},
  {"id":"CLIM-23","tier":"T3","domain":"Climate Finance Access","question":"Can the financial system track, tag, and report climate-specific expenditures separately from core budgets?","insight":"Manual or commingled tracking leads to audit failures and fund suspension.","evidence":"Climate finance tracking methodology; Tagged financial reports.","verification":"Document review; System demo.","scoring":"0=None | 1=Manual spreadsheets | 2=Partial tagging | 3=Standardized methodology | 4=Integrated in system | 5=Real-time, donor-specific dashboard.","risk":"Critical Fiduciary","action":"Upgrade financial system to support multi-dimensional climate budget tagging.","donorLink":"GCF FM Manual; WB","nationalLink":"Government CBT Guidelines","priority":"Critical"},
  {"id":"CLIM-24","tier":"T3","domain":"Climate Finance Access","question":"Does the institution have the legal and fiduciary capacity to manage blended finance instruments?","insight":"Most institutions are only equipped to manage grants, not complex debt or equity.","evidence":"Legal opinions on borrowing; Blended finance transaction records.","verification":"Document review; Legal/Finance interview.","scoring":"0=None | 1=Grant management only | 2=Awareness | 3=Legal framework allows borrowing | 4=Managed one transaction | 5=Robust portfolio management.","risk":"Fiduciary/Legal","action":"Develop legal and financial frameworks to safely manage debt.","donorLink":"GCF Direct Access; WB","nationalLink":"National Public Debt Management Act","priority":"High"},
  {"id":"CLIM-25","tier":"T3","domain":"Climate Finance Access","question":"Is there a dedicated pipeline of 'bankable' climate projects that have completed pre-feasibility and ESIA screening?","insight":"Donors complain of a 'lack of good projects.' Ideas are often not technically viable.","evidence":"Project pipeline database; Pre-feasibility study reports.","verification":"Document review; Interview.","scoring":"0=None | 1=Ad-hoc ideas | 2=List, no screening | 3=Pre-feasibility for some | 4=Standardized pipeline with ESIA | 5=Investor-ready pipeline with modeling.","risk":"Programmatic","action":"Establish a dedicated Project Preparation Facility (PPF).","donorLink":"GCF PPF; WB","nationalLink":"National Investment Promotion Guidelines","priority":"High"},
  {"id":"CLIM-26","tier":"T3","domain":"Climate Finance Access","question":"Are climate finance funds kept in segregated, dedicated bank accounts?","insight":"Commingling climate funds with general accounts violates donor agreements.","evidence":"Bank account mandates; Donor funding agreements.","verification":"Document review; Bank statement sampling.","scoring":"0=None | 1=Fully commingled | 2=Separate ledger, same account | 3=Dedicated for major donors | 4=Dedicated for all climate funds | 5=Automated system preventing non-climate transactions.","risk":"Critical Fiduciary","action":"Open and strictly manage segregated bank accounts for climate funding.","donorLink":"GCF FM Manual; AF","nationalLink":"National Treasury Account Guidelines","priority":"Critical"},
  {"id":"CLIM-27","tier":"T3","domain":"Climate Finance Access","question":"Is there a formal mechanism for leveraging domestic or private sector co-financing?","insight":"Over-reliance on 100% donor funding is unsustainable.","evidence":"Co-financing agreements; Private sector partnership MOUs.","verification":"Document review.","scoring":"0=None | 1=Aspirational | 2=Ad-hoc partnerships | 3=Formal strategy | 4=Active co-financing in 50% of projects | 5=Innovative instruments (green bonds) deployed.","risk":"Fiduciary/Strategic","action":"Develop resource mobilization strategy targeting climate co-financing.","donorLink":"GCF Leveraging Policy; WB","nationalLink":"National PPP Act","priority":"High"},
  {"id":"CLIM-28","tier":"T3","domain":"Climate Finance Access","question":"Does the institution have access to climate risk insurance or disaster risk financing mechanisms?","insight":"Post-disaster recovery drains budgets. Proactive risk transfer is rarely utilized.","evidence":"Insurance policies; Disaster risk financing strategy.","verification":"Document review; Interview.","scoring":"0=None | 1=Awareness | 2=Basic asset insurance | 3=Parametric insurance explored | 4=Active disaster risk facility | 5=Integrated, multi-layered insurance portfolio.","risk":"Financial","action":"Partner with regional risk facilities (e.g., ARC) for parametric insurance.","donorLink":"African Risk Capacity; WB","nationalLink":"National Disaster Risk Financing Strategy","priority":"High"},
  {"id":"CLIM-29","tier":"T3","domain":"Climate Finance Access","question":"Are financial reports for climate projects prepared and submitted strictly within donor deadlines?","insight":"Late reporting is a primary trigger for donor fund suspension.","evidence":"Donor financial reports; Submission timestamps.","verification":"Document review.","scoring":"0=None | 1=Consistently late | 2=Occasionally late | 3=On time, frequent queries | 4=Consistently on time, clean | 5=Automated, real-time reporting aligned with portals.","risk":"Critical Compliance","action":"Implement automated financial reporting workflows with internal buffers.","donorLink":"GCF FM Manual; WB","nationalLink":"National PFM Act","priority":"Critical"},
  {"id":"CLIM-30","tier":"T3","domain":"Climate Finance Access","question":"Is there a clear policy for managing foreign exchange (FX) risks on climate finance transactions?","insight":"Multi-currency transactions create unmanaged FX exposure that can wipe out budgets.","evidence":"FX risk management policy; Hedging records.","verification":"Document review; Finance interview.","scoring":"0=None | 1=Ad-hoc | 2=Basic awareness | 3=Formal FX policy | 4=Active hedging strategies | 5=Automated FX risk monitoring.","risk":"Fiduciary","action":"Develop formal Foreign Exchange Risk Management Policy.","donorLink":"WB; GCF FM Manual","nationalLink":"National Central Bank FX Regulations","priority":"Medium"},
  {"id":"CLIM-31","tier":"T3","domain":"Climate Finance Access","question":"Are indirect costs (overhead) applied consistently and transparently across all climate grants?","insight":"Inconsistent overhead application leads to donor audits or accusations of double-dipping.","evidence":"Cost allocation plan; Indirect cost rate agreements.","verification":"Document review; Finance interview.","scoring":"0=None | 1=Arbitrary | 2=Inconsistent | 3=Standardized policy | 4=Consistently applied/documented | 5=Automated, donor-compliant allocation system.","risk":"Fiduciary","action":"Develop and negotiate a formal, standardized Indirect Cost Rate Agreement.","donorLink":"GCF FM Manual; USAID 2 CFR 200","nationalLink":"National Cost Accounting Standards","priority":"High"},
  {"id":"CLIM-32","tier":"T3","domain":"Climate Finance Access","question":"Is there a formal process for the transparent and compliant closure of climate projects?","insight":"Project close-out is often chaotic, leading to unaccounted assets and unresolved audit findings.","evidence":"Project close-out checklist; Asset disposition records.","verification":"Document review.","scoring":"0=None | 1=Ad-hoc | 2=Basic checklist | 3=Checklist followed, delays common | 4=Systematic, timely close-out | 5=Automated workflow with full asset reconciliation.","risk":"Fiduciary","action":"Implement standardized, mandatory project close-out and asset disposition SOP.","donorLink":"GCF FM Manual; WB","nationalLink":"National Asset Disposal Guidelines","priority":"High"},
  {"id":"CLIM-33","tier":"T5","domain":"MRV & Article 6","question":"Does the institution have a functional system for national/institutional GHG inventory compilation?","insight":"Without accurate baseline data, it is impossible to measure emission reductions.","evidence":"GHG inventory reports; MRV standard operating procedures.","verification":"Document review; Technical interview.","scoring":"0=None | 1=Ad-hoc estimates | 2=Basic methodology | 3=Standardized, periodic inventory | 4=Aligned with IPCC guidelines | 5=Real-time, digitized system with third-party verification.","risk":"Technical","action":"Establish dedicated MRV unit and adopt IPCC-compliant methodologies.","donorLink":"UNFCCC; GCF MRV Guidelines","nationalLink":"National Climate Change MRV Framework","priority":"Critical"},
  {"id":"CLIM-34","tier":"T5","domain":"MRV & Article 6","question":"Is there a clear, legally binding framework defining carbon rights ownership?","insight":"Ambiguity over who owns carbon credits is the #1 legal blocker to Article 6 transactions.","evidence":"Legal framework on carbon rights; Project agreements.","verification":"Document review; Legal interview.","scoring":"0=None | 1=Total ambiguity | 2=Informal understandings | 3=Draft legal framework | 4=Formal legal framework | 5=Framework enforced with standardized benefit-sharing.","risk":"Critical Legal","action":"Enact clear legislation defining carbon rights and benefit-sharing.","donorLink":"Paris Agreement Art 6; WB Carbon Pricing","nationalLink":"National Environmental/Climate Act","priority":"Critical"},
  {"id":"CLIM-35","tier":"T5","domain":"MRV & Article 6","question":"Is there an officially designated, empowered National Focal Point (NFP) for Paris Agreement Article 6?","insight":"Without a central authority, transactions are legally invalid and risk double-counting.","evidence":"Official designation of NFP; NFP operational guidelines.","verification":"Document review; Interview.","scoring":"0=None | 1=Informal contact | 2=Designated, no mandate | 3=NFP with clear guidelines | 4=NFP actively authorizing/tracking | 5=NFP integrated with national strategy and int'l registries.","risk":"Critical Legal","action":"Formally designate and resource the Article 6 NFP with clear legal mandate.","donorLink":"UNFCCC Article 6; WB","nationalLink":"National Climate Change Governance Structure","priority":"Critical"},
  {"id":"CLIM-36","tier":"T5","domain":"MRV & Article 6","question":"Does the institution have the technical capacity to track and apply 'Corresponding Adjustments' (CAs)?","insight":"Failure to apply CAs means both host country and buyer claim the same reduction, invalidating the credit.","evidence":"CA tracking methodology; Registry records.","verification":"Document review; Technical interview.","scoring":"0=None | 1=Awareness | 2=Basic understanding | 3=Methodology developed | 4=System capable of tracking CAs | 5=Fully integrated with national registry and automated CA application.","risk":"Critical Technical","action":"Build technical capacity and systems specifically for tracking CAs.","donorLink":"UNFCCC Art 6.2/6.4 Guidance; WB","nationalLink":"National Carbon Registry Guidelines","priority":"Critical"},
  {"id":"CLIM-37","tier":"T5","domain":"MRV & Article 6","question":"Is there a national registry capable of tracking the issuance, transfer, and retirement of ITMOs?","insight":"Carbon credits cannot be traded without a secure, transparent, fraud-resistant digital registry.","evidence":"National carbon registry documentation; System demo.","verification":"Document review; System demo.","scoring":"0=None | 1=Manual spreadsheet | 2=Basic database | 3=Functional for domestic credits | 4=Capable of international ITMO tracking | 5=Secure, internationally interoperable registry.","risk":"Critical Technical","action":"Develop or integrate with a secure, internationally recognized national carbon registry.","donorLink":"UNFCCC Art 6.4 Mechanism; WB","nationalLink":"National Digital Infrastructure Strategy","priority":"Critical"},
  {"id":"CLIM-38","tier":"T5","domain":"MRV & Article 6","question":"Are MRV systems interoperable and capable of sharing data with the National Meteorological Agency?","insight":"Siloed data systems prevent timely and accurate reporting required by international agreements.","evidence":"Data sharing agreements; System architecture diagrams.","verification":"Document review; IT interview.","scoring":"0=None | 1=Manual transfer | 2=Basic API | 3=Standardized formats | 4=Automated, secure sharing | 5=Fully interoperable, real-time national ecosystem.","risk":"Technical","action":"Establish formal data-sharing protocols and API integrations.","donorLink":"UNFCCC Transparency Framework; GCF","nationalLink":"National Data Interoperability Standards","priority":"High"},
  {"id":"CLIM-39","tier":"T5","domain":"MRV & Article 6","question":"Is there a formal process for independent, third-party verification (V&V) of emission reductions?","insight":"Self-reported reductions are not accepted by carbon markets. Lack of V&V blocks access.","evidence":"V&V reports; List of accredited verifiers.","verification":"Document review.","scoring":"0=None | 1=Awareness | 2=Ad-hoc verification | 3=Formal V&V process | 4=Regular use of int'l accredited verifiers | 5=Domestic capacity developed and int'l recognized.","risk":"Technical/Compliance","action":"Establish formal V&V protocol and build relationships with accredited bodies.","donorLink":"ISO 14064; Verra; Gold Standard","nationalLink":"National Accreditation Body Guidelines","priority":"High"},
  {"id":"CLIM-40","tier":"T5","domain":"MRV & Article 6","question":"Does the institution have a strategy for managing long-term permanence and reversal risks of nature-based projects?","insight":"Nature-based solutions are vulnerable to fires/logging. Without buffers, credits are worthless.","evidence":"Permanence risk assessment; Buffer pool mechanisms.","verification":"Document review.","scoring":"0=None | 1=Awareness | 2=Basic risk ID | 3=Formal assessment | 4=Participation in recognized buffer pool | 5=Dynamic, satellite-monitored tracking with automated adjustments.","risk":"Technical/Financial","action":"Integrate permanence risk assessments and buffer pools into project designs.","donorLink":"Verra VCS; ART-TREES","nationalLink":"National Forestry/Environmental Regulations","priority":"High"},
  {"id":"CLIM-41","tier":"T5","domain":"MRV & Article 6","question":"Is there a clear policy ensuring climate finance proceeds contribute to sustainable development and Do No Significant Harm (DNSH)?","insight":"Carbon projects sometimes generate revenue but cause local harm, violating DNSH principles.","evidence":"DNSH assessment reports; Sustainable development co-benefit reports.","verification":"Document review; Project file sampling.","scoring":"0=None | 1=Ad-hoc | 2=Basic checklist | 3=Formal DNSH required | 4=Systematically applied/monitored | 5=Quantifiable co-benefits tracked and reported.","risk":"Reputational","action":"Mandate DNSH and sustainable development co-benefit assessments.","donorLink":"GCF ESP; Art 6.4 SD Tool","nationalLink":"National Sustainable Development Framework","priority":"High"},
  {"id":"CLIM-42","tier":"T5","domain":"MRV & Article 6","question":"Are staff and leadership regularly trained on the evolving complexities of Article 6 rules and MRV?","insight":"Technical complexity is high. Relying on external consultants without building internal capacity creates vulnerability.","evidence":"Training records; Staff competency assessments.","verification":"Document review; Interview.","scoring":"0=None | 1=Occasional briefings | 2=Basic internal training | 3=Structured program | 4=Certified internal experts | 5=Continuous learning culture contributing to global policy.","risk":"Technical","action":"Implement continuous capacity-building program on Article 6 for key staff.","donorLink":"UNFCCC Capacity-building; GCF","nationalLink":"National Public Service Training Guidelines","priority":"High"},
  {"id":"CLIM-43","tier":"T5","domain":"MRV & Article 6","question":"Is there a transparent mechanism for sharing financial benefits of carbon sales with local communities?","insight":"Unfair benefit-sharing leads to community backlash, project cancellation, and reputational ruin.","evidence":"Benefit-sharing agreements; Revenue distribution records.","verification":"Document review; Community interview.","scoring":"0=None | 1=No sharing | 2=Ad-hoc, discretionary | 3=Formal policy exists | 4=Transparently implemented with oversight | 5=Automated, highly transparent revenue distribution.","risk":"Critical Reputational","action":"Develop and enforce transparent, legally binding Benefit-Sharing Mechanism.","donorLink":"UNFCCC Article 6; WB","nationalLink":"National Revenue Sharing/Community Rights Acts","priority":"Critical"},
  {"id":"CLIM-44","tier":"T5","domain":"MRV & Article 6","question":"Are there clear protocols for managing the potential 'leakage' of emissions?","insight":"Failure to account for leakage results in inflated, invalid carbon credits rejected by buyers.","evidence":"Leakage assessment methodologies; Project monitoring reports.","verification":"Document review.","scoring":"0=None | 1=Awareness | 2=Basic qualitative | 3=Quantitative assessment required | 4=Actively monitored and mitigated | 5=Advanced spatial modeling used to predict/prevent.","risk":"Technical/Compliance","action":"Integrate rigorous leakage assessment into all project design documents.","donorLink":"Verra VCS; Gold Standard","nationalLink":"National Land Use Planning Guidelines","priority":"High"},
  {"id":"CLIM-45","tier":"T5","domain":"MRV & Article 6","question":"Is there a formalized relationship with the national statistics office to ensure climate data aligns with official reporting?","insight":"Discrepancies between institutional climate data and official statistics create credibility issues.","evidence":"Data sharing MOUs; Aligned reporting frameworks.","verification":"Document review.","scoring":"0=None | 1=Informal communication | 2=Occasional sharing | 3=Formal MOU | 4=Regular, standardized alignment | 5=Fully integrated national statistical and climate system.","risk":"Technical/Governance","action":"Establish formal data-sharing protocol with the National Statistics Office.","donorLink":"UNFCCC Transparency Framework","nationalLink":"National Statistics Act","priority":"Medium"},
  {"id":"CLIM-46","tier":"T5","domain":"MRV & Article 6","question":"Are there clear protocols for the ethical retirement and cancellation of carbon credits to prevent double-claiming?","insight":"Improper retirement undermines market integrity and exposes the institution to fraud allegations.","evidence":"Credit retirement certificates; Registry cancellation logs.","verification":"Document review.","scoring":"0=None | 1=Unaware | 2=Ad-hoc | 3=Formal protocol | 4=Systematically tracked/verified | 5=Automated, transparent process with public registry links.","risk":"Critical Compliance","action":"Implement strict, auditable protocols for ethical retirement and cancellation.","donorLink":"ICROA Code of Best Practice; Verra","nationalLink":"National Fraud/Financial Crime Regulations","priority":"Critical"},
  {"id":"CLIM-47","tier":"T5","domain":"MRV & Article 6","question":"Is the institution prepared to undergo rigorous, independent audits of its entire MRV and Article 6 compliance framework?","insight":"International carbon markets require absolute trust. Lack of audit readiness is a definitive barrier.","evidence":"Audit readiness assessments; Past audit reports.","verification":"Document review; Interview.","scoring":"0=None | 1=Highly vulnerable | 2=Basic documentation | 3=Internal audits conducted | 4=Successfully passed external MRV audits | 5=Continuous, proactive readiness with zero major findings.","risk":"Critical Fiduciary","action":"Conduct comprehensive, mock international MRV audit to identify/close gaps.","donorLink":"UNFCCC Supervisory Body; GCF","nationalLink":"National Supreme Audit Institution Guidelines","priority":"Critical"},
  {"id":"CLIM-48","tier":"T2","domain":"Env. & Social Safeguards","question":"Are stakeholder engagement plans (SEPs) developed and disclosed for all category A and B projects?","insight":"Meaningful, documented stakeholder engagement is a precondition for donor disbursement, yet is often skipped.","evidence":"Stakeholder Engagement Plan (SEP); Disclosure records.","verification":"Document review; Interview.","scoring":"0=None | 1=Ad-hoc | 2=Consultations documented | 3=Formal SEP for major projects | 4=SEP disclosed and implemented | 5=Continuous, two-way engagement with feedback loops.","risk":"Reputational","action":"Develop and disclose a Stakeholder Engagement Plan for every applicable project.","donorLink":"WB ESS10; GCF ESP","nationalLink":"National Public Consultation Guidelines","priority":"High"},
  {"id":"CLIM-49","tier":"T2","domain":"Env. & Social Safeguards","question":"Does the institution screen all projects against an exclusion list of prohibited activities?","insight":"Funding a prohibited activity (e.g., in critical habitat) triggers immediate, irreversible donor sanctions.","evidence":"Exclusion list policy; Project screening records.","verification":"Document review; Project file sampling.","scoring":"0=None | 1=Awareness | 2=Informal screening | 3=Formal exclusion list applied | 4=System-enforced screening gate | 5=Automated, auditable screening with override controls.","risk":"Critical Compliance","action":"Adopt and system-enforce a donor-aligned exclusion list at project intake.","donorLink":"GCF ESP; IFC Exclusion List","nationalLink":"National Environmental Management Act","priority":"Critical"},
  {"id":"CLIM-50","tier":"T1","domain":"Climate Governance","question":"Has the institution set and publicly committed to a measurable net-zero or emissions-reduction target?","insight":"Without a quantified, public target, climate ambition cannot be measured, tracked, or held accountable.","evidence":"Board-approved net-zero/reduction target; Public commitment statement.","verification":"Document review.","scoring":"0=None | 1=Aspirational statement | 2=Internal target | 3=Public target, no pathway | 4=Public target with costed pathway | 5=Independently verified, on-track progress.","risk":"Reputational","action":"Set, cost, and publicly commit to a science-based emissions-reduction target.","donorLink":"SBTi; UNFCCC Race to Zero","nationalLink":"National NDC Targets","priority":"High"},
]

function buildClimateQuestions(): Question[] {
  return RAW_CLIMATE.map(r => {
    const priority = (r.priority === 'Medium' ? 'Moderate' : r.priority) as Question['priority']
    const tier = TIER_OF[r.tier] ?? 1
    return {
      id: r.id,
      domain: r.domain,
      tier,
      tierName: TIER_NAMES[tier - 1],
      question: r.question,
      insight: r.insight,
      evidence: r.evidence.split(';').map(s => s.trim()).filter(Boolean),
      verificationMethod: r.verification,
      score: 0,
      maxScore: 5,
      riskIfWeak: priority,
      capacityAction: r.action,
      donorLink: r.donorLink,
      nationalLink: r.nationalLink,
      priority,
      riskCategory: r.risk,
      scoringGuide: r.scoring,
      lens: 'climate' as const,
    }
  })
}

export const CLIMATE_QUESTIONS: Question[] = buildClimateQuestions()

// --- ARCHETYPE-SPECIFIC QUESTIONS --------------------------------------------
// Entity-specific questions that carve the universal Core bank by archetype.
// Public-only questions (Supreme Audit Institutions) never reach a Private
// startup; Private-only questions (Cap Table, burn rate) never reach a Public
// ministry. Several carry a requiredDataRoomDoc that the wizard links straight
// to the Dynamic Data Room, eliminating duplicate evidence uploads.
interface RawArchetypeQ {
  id: string
  tier: 'T1' | 'T2' | 'T3' | 'T4' | 'T5'
  domain: string
  question: string
  archetypes: Archetype[]
  lens?: LensId
  priority: Question['priority']
  insight: string
  doc?: string
}

const RAW_ARCHETYPE_QS: RawArchetypeQ[] = [
  {
    id: 'GOV-PS-01', tier: 'T1', domain: 'Governance', archetypes: ['Private'], priority: 'Critical',
    question: 'Is there a formalized, legally binding Cap Table and clear shareholder agreements detailing equity ownership?',
    insight: 'Investors will not proceed past first screening without a clean Cap Table; undocumented equity splits are the single most common deal-breaker in early-stage due diligence.',
    doc: 'Cap Table & Shareholder Agreements',
  },
  {
    id: 'GOV-PS-02', tier: 'T1', domain: 'Governance', archetypes: ['Private'], priority: 'High',
    question: 'Does the Board of Directors include independent, non-executive members with relevant industry or financial expertise?',
    insight: 'Independent board members signal mature governance and reassure investors that founder decisions are subject to genuine oversight.',
  },
  {
    id: 'LEG-PS-01', tier: 'T1', domain: 'Legal', archetypes: ['Private'], priority: 'Critical',
    question: 'Is all intellectual property (IP) and code formally assigned to the company via signed agreements with founders and contractors?',
    insight: 'Unassigned IP sitting with founders or freelancers can collapse a funding round; assignment agreements prove the company actually owns what it sells.',
    doc: 'Founder/Contractor IP Assignment Agreements',
  },
  {
    id: 'LEG-PS-02', tier: 'T1', domain: 'Legal', archetypes: ['Private'], priority: 'Critical',
    question: 'Is the company fully compliant with relevant data privacy regulations (e.g., GDPR, NDPR) regarding customer and employee data?',
    insight: 'Data-protection registration and a published privacy policy are now table stakes for corporate procurement and cross-border investment.',
    doc: 'Data Privacy Policy & Registration Certificate',
  },
  {
    id: 'FIN-PS-01', tier: 'T2', domain: 'Finance', archetypes: ['Private'], priority: 'Critical',
    question: 'Are unit economics, monthly burn rate, and cash runway tracked and reported to the board/investors monthly?',
    insight: 'A startup that cannot state its runway in months is uninvestable; monthly management accounts are the proof that financial discipline exists.',
    doc: 'Monthly Management Accounts & Financial Projections',
  },
  {
    id: 'PROC-PS-01', tier: 'T2', domain: 'Procurement', archetypes: ['Private'], lens: 'climate', priority: 'High',
    question: 'Does the company conduct ESG and anti-modern-slavery due diligence on its top 20% of suppliers by spend?',
    insight: 'Large corporate buyers increasingly require ESG and modern-slavery assurances before adding a supplier to their chain.',
    doc: 'Supplier Code of Conduct & ESG Audit Reports',
  },
  {
    id: 'SUS-PS-01', tier: 'T1', domain: 'Sustainability', archetypes: ['Private'], priority: 'Critical',
    question: 'Is there a clear, documented pathway to profitability or a strategy for subsequent venture/debt funding rounds?',
    insight: 'A credible route to either profitability or the next round is what converts an interesting product into a fundable company.',
  },
  {
    id: 'GOV-CS-02', tier: 'T1', domain: 'Governance', archetypes: ['Civil Society'], priority: 'Critical',
    question: 'Are annual general meetings (AGMs) or Member Assemblies held regularly with documented, transparent voting records?',
    insight: 'For member-based bodies, documented assemblies and voting records are the legal foundation of legitimacy and a precondition for most institutional funding.',
  },
  {
    id: 'FIN-CS-01', tier: 'T2', domain: 'Finance', archetypes: ['Civil Society'], priority: 'Critical',
    question: 'Does the financial system strictly segregate restricted donor funds from unrestricted core funds, or member equity from operational revenue?',
    insight: 'Commingling restricted and unrestricted funds is the fastest route to an audit qualification and donor fund suspension.',
  },
  {
    id: 'ETH-CS-01', tier: 'T2', domain: 'Ethics', archetypes: ['Civil Society'], priority: 'Critical',
    question: 'Is there a functional, anonymous Safeguarding and PSEA reporting mechanism?',
    insight: 'A working Protection from Sexual Exploitation and Abuse channel is now a hard eligibility gate for the major humanitarian and development donors.',
  },
  {
    id: 'GOV-PUB-01', tier: 'T1', domain: 'Governance', archetypes: ['Public'], priority: 'Critical',
    question: 'Does the Supreme Audit Institution systematically review financial reports and is there a tracker closing its findings?',
    insight: 'Sovereign assurance hinges on the SAI loop actually closing; open audit findings with no tracker are a defining weakness for public bodies.',
  },
  {
    id: 'SP-PS-01', tier: 'T1', domain: 'Strategy', archetypes: ['Private'], priority: 'High',
    question: 'Is there a documented go-to-market strategy with clear unit economics, customer acquisition costs (CAC), and growth milestones?',
    insight: 'Investors fund traction, not ideas; a costed go-to-market plan with defensible CAC and growth milestones is what separates a fundable company from a promising prototype.',
  },
  {
    id: 'HR-PS-01', tier: 'T1', domain: 'HR', archetypes: ['Private'], priority: 'High',
    question: 'Are employee compensation, stock option plans (ESOPs), and performance bonuses structured transparently and aligned with company milestones?',
    insight: 'Opaque or undocumented equity and bonus arrangements deter talent and raise investor red flags; a transparent, milestone-linked compensation structure signals a company built to scale.',
  },
  {
    id: 'HR-CS-02', tier: 'T1', domain: 'HR', archetypes: ['Civil Society'], priority: 'Critical',
    question: 'Are volunteer management, stipend, and safeguarding policies clearly defined and strictly enforced?',
    insight: 'Volunteers are central to civil-society delivery yet a major safeguarding and fiduciary exposure; clearly defined, enforced policies on management, stipends and safeguarding are a hard donor precondition.',
  },
  {
    id: 'RISK-CS-01', tier: 'T2', domain: 'Risk', archetypes: ['Civil Society'], priority: 'High',
    question: 'Is there a specific protocol for managing the physical and digital security of staff and beneficiaries in restrictive civic environments?',
    insight: 'Civil-society actors often operate in restrictive or hostile contexts where staff and beneficiary security is an existential risk; a documented physical and digital security protocol is essential duty of care.',
  },
  {
    id: 'GRANT-PS-01', tier: 'T3', domain: 'Grant', archetypes: ['Private'], priority: 'High',
    question: 'Are commercial contracts and vendor SLAs reviewed by legal counsel and tracked for deliverable milestones?',
    insight: 'Unreviewed commercial contracts and untracked SLAs are a silent source of revenue leakage and dispute risk; legal review and milestone tracking protect margin and reputation.',
  },
  {
    id: 'MEL-CS-01', tier: 'T3', domain: 'MEL', archetypes: ['Civil Society'], priority: 'High',
    question: 'Is there a formalized Beneficiary Feedback and Community Grievance Mechanism that directly influences program design?',
    insight: 'Accountability to affected populations is now a core donor standard; a feedback and grievance mechanism that actually reshapes programming is what distinguishes participatory practice from box-ticking.',
  },
  {
    id: 'DIG-PS-01', tier: 'T5', domain: 'Digital', archetypes: ['Private'], priority: 'Critical',
    question: 'Are customer payment gateways and financial data environments fully PCI-DSS compliant and subjected to annual penetration testing?',
    insight: 'For any company handling card data, PCI-DSS compliance and routine penetration testing are non-negotiable gates for payment processing and enterprise customer onboarding.',
  },
  {
    id: 'RES-PS-01', tier: 'T5', domain: 'Research', archetypes: ['Private'], lens: 'research', priority: 'Critical',
    question: 'Are all intellectual property (IP), code, and trade secrets formally assigned to the company via signed agreements with founders and contractors?',
    insight: 'Unassigned IP held by founders or contractors can unravel a funding round or acquisition; signed assignment agreements prove the company actually owns what it sells.',
  },
]

function buildArchetypeQuestions(): Question[] {
  return RAW_ARCHETYPE_QS.map(r => {
    const tier = TIER_OF[r.tier] ?? 1
    const enr = defaultEnrichment(DOMAIN_DISPLAY[r.domain] ?? r.domain, r.priority)
    return {
      id: r.id,
      domain: DOMAIN_DISPLAY[r.domain] ?? r.domain,
      tier,
      tierName: TIER_NAMES[tier - 1],
      question: r.question,
      insight: r.insight,
      evidence: enr.evidence,
      verificationMethod: enr.verificationMethod,
      score: 0,
      maxScore: 5,
      riskIfWeak: r.priority,
      capacityAction: enr.capacityAction,
      donorLink: enr.donorLink,
      nationalLink: enr.nationalLink,
      priority: r.priority,
      archetypes: r.archetypes,
      lens: r.lens,
      requiredDataRoomDoc: r.doc,
    }
  })
}

export const ARCHETYPE_QUESTIONS: Question[] = buildArchetypeQuestions()

// --- MOCK QUESTIONS DATA (Core 450-question bank + active-lens modules) ------
// The Core Foundation (the parsed fiduciary bank) is always present; the Climate
// & ESG module is appended as a lens-tagged extension. Emergency and Research
// lenses are governed by their existing Core domains via questionLens().
export const MOCK_QUESTIONS: Question[] = [
  ...parseBank(QUESTION_BANK_CSV),
  ...CLIMATE_QUESTIONS,
  ...ARCHETYPE_QUESTIONS,
]

// Resolve which lens a question belongs to (or undefined for the Core Foundation).
export function questionLens(q: Question): LensId | undefined {
  if (q.lens) return q.lens
  for (const lens of LENSES) {
    if (lens.id !== 'climate' && lens.domains.includes(q.domain)) return lens.id
  }
  return undefined
}

// The number of questions each lens contributes to the assessment.
export function lensQuestionCount(id: LensId): number {
  return MOCK_QUESTIONS.filter(q => questionLens(q) === id).length
}

// The set of questions visible for a given lens activation map. A question is
// visible when it is part of the Core Foundation OR its lens is active.
export function activeQuestions(active: Record<LensId, boolean>): Question[] {
  return MOCK_QUESTIONS.filter(q => {
    const lens = questionLens(q)
    return !lens || active[lens]
  })
}

// Human-readable scope label, e.g. "Core + Climate & ESG + Emergency".
export function scopeLabel(active: Record<LensId, boolean>): string {
  const on = LENSES.filter(l => active[l.id]).map(l => l.name.replace(/ Lens$/, ''))
  return ['Core Foundation', ...on].join(' + ')
}

// --- DOMAIN MAPPING ---
export const DOMAIN_WEIGHTS: Record<string, number> = {
  'Governance & Leadership': 0.08,
  'Legal & Regulatory': 0.05,
  'Strategy & Planning': 0.04,
  'Human Resources': 0.04,
  'Sustainability & Financing': 0.04,
  'Financial Management': 0.12,
  'Procurement & Supply Chain': 0.10,
  'Risk & Internal Controls': 0.07,
  'Audit & Assurance': 0.06,
  'Ethics & Anti-Fraud': 0.05,
  'Grant Management': 0.07,
  'Program & Project Mgmt': 0.04,
  'Monitoring, Evaluation & Learning': 0.03,
  'Partnerships & Stakeholders': 0.02,
  'USG Compliance': 0.05,
  'International Donor Compliance': 0.04,
  'Digital Systems & Cyber': 0.05,
  'Emergency Preparedness': 0.02,
  'Research & Innovation': 0.01,
  'PMO & Delivery': 0.02,
}

export const COMPOSITE_INDICES = [
  'Governance',
  'Fiduciary',
  'Grant Mgmt',
  'Program Delivery',
  'Digital',
  'Risk Mgmt',
  'Sustainability',
  'USG Compliance',
  'Resilience',
]

// --- MOCK ORGANIZATIONS ---
// `scores` below holds the curated narrative seeds for the most critical
// questions; full coverage of the 450-question bank is generated
// deterministically further down so dashboards remain meaningful.
export const MOCK_ORGANIZATIONS: Organization[] = [
  {
    id: 'org-001',
    name: 'National Public Health Agency',
    country: 'Kenya',
    targetDonor: 'USAID',
    email: 'admin@npha.go.ke',
    createdAt: '2024-11-15',
    lastUpdated: '2025-06-01',
    scores: {
      'GOV-01': 3, 'GOV-05': 2, 'LEG-01': 3, 'HR-02': 2,
      'FIN-13': 1, 'FIN-28': 1, 'FIN-22': 2, 'FIN-42': 2,
      'PROC-11': 2, 'RISK-06': 2, 'AUD-04': 2, 'ETH-04': 1,
      'GRANT-06': 3, 'GRANT-09': 1, 'GRANT-12': 2,
      'USG-01': 2, 'USG-13': 1, 'USG-22': 1, 'USG-31': 2,
      'DIG-05': 1, 'DIG-13': 2, 'PMO-02': 2, 'EPR-02': 3,
    }
  },
  {
    id: 'org-002',
    name: 'Ministry of Health, Disease Control Directorate',
    country: 'Uganda',
    targetDonor: 'Global Fund',
    email: 'admin@moh-dcd.go.ug',
    createdAt: '2024-10-22',
    lastUpdated: '2025-05-18',
    scores: {
      'GOV-01': 4, 'GOV-05': 3, 'LEG-01': 4, 'HR-02': 3,
      'FIN-13': 2, 'FIN-28': 2, 'FIN-22': 3, 'FIN-42': 3,
      'PROC-11': 3, 'RISK-06': 3, 'AUD-04': 3, 'ETH-04': 2,
      'GRANT-06': 4, 'GRANT-09': 2, 'GRANT-12': 3,
      'USG-01': 3, 'USG-13': 2, 'USG-22': 2, 'USG-31': 3,
      'DIG-05': 2, 'DIG-13': 3, 'PMO-02': 3, 'EPR-02': 4,
    }
  },
  {
    id: 'org-003',
    name: 'National AIDS Control Agency',
    country: 'Tanzania',
    targetDonor: 'PEPFAR/CDC',
    email: 'admin@naca.go.tz',
    createdAt: '2024-09-05',
    lastUpdated: '2025-04-30',
    scores: {
      'GOV-01': 2, 'GOV-05': 1, 'LEG-01': 2, 'HR-02': 1,
      'FIN-13': 1, 'FIN-28': 1, 'FIN-22': 1, 'FIN-42': 1,
      'PROC-11': 1, 'RISK-06': 1, 'AUD-04': 1, 'ETH-04': 1,
      'GRANT-06': 2, 'GRANT-09': 1, 'GRANT-12': 1,
      'USG-01': 1, 'USG-13': 1, 'USG-22': 1, 'USG-31': 1,
      'DIG-05': 1, 'DIG-13': 1, 'PMO-02': 1, 'EPR-02': 2,
    }
  },
  {
    id: 'org-004',
    name: 'Federal Ministry of Finance, Grants Unit',
    country: 'Nigeria',
    targetDonor: 'World Bank',
    email: 'admin@fmfgrants.gov.ng',
    createdAt: '2024-08-14',
    lastUpdated: '2025-06-03',
    scores: {
      'GOV-01': 4, 'GOV-05': 4, 'LEG-01': 5, 'HR-02': 4,
      'FIN-13': 3, 'FIN-28': 3, 'FIN-22': 4, 'FIN-42': 4,
      'PROC-11': 4, 'RISK-06': 4, 'AUD-04': 4, 'ETH-04': 3,
      'GRANT-06': 4, 'GRANT-09': 3, 'GRANT-12': 4,
      'USG-01': 3, 'USG-13': 3, 'USG-22': 3, 'USG-31': 4,
      'DIG-05': 3, 'DIG-13': 4, 'PMO-02': 4, 'EPR-02': 4,
    }
  },
]

// Per-org maturity baseline used to generate full-bank coverage deterministically.
const ORG_BASELINE: Record<string, number> = {
  'org-001': 2.3,
  'org-002': 3.0,
  'org-003': 1.5,
  'org-004': 3.7,
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Deterministic 0–5 score for an (org, question) pair - stable across renders/SSR.
function seededScore(orgId: string, qId: string, baseline: number): number {
  const jitter = (hashStr(`${orgId}|${qId}`) % 1000) / 1000 // 0..1
  const offset = jitter * 2.6 - 1.3 // -1.3..+1.3
  return Math.max(0, Math.min(5, Math.round(baseline + offset)))
}

// Expand each org's narrative seeds to full coverage of the 450-question bank.
for (const org of MOCK_ORGANIZATIONS) {
  const baseline = ORG_BASELINE[org.id] ?? 2.5
  const full: Record<string, number> = {}
  for (const q of MOCK_QUESTIONS) full[q.id] = seededScore(org.id, q.id, baseline)
  org.scores = { ...full, ...org.scores }
}

// Helper: compute overall score percentage for an org
export function computeOrgScore(scores: Record<string, number>): number {
  const keys = Object.keys(scores)
  if (keys.length === 0) return 0
  const total = keys.reduce((sum, k) => sum + (scores[k] || 0), 0)
  return Math.round((total / (keys.length * 5)) * 100)
}

// Helper: get readiness classification
export function getReadinessClassification(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: 'Accredited G2G, DFI and Donor Partner', color: 'text-emerald-700', bg: 'bg-emerald-100' }
  if (score >= 80) return { label: 'Direct Funding Ready', color: 'text-emerald-600', bg: 'bg-emerald-50' }
  if (score >= 70) return { label: 'Ready with Conditions', color: 'text-emerald-700', bg: 'bg-emerald-100' }
  if (score >= 60) return { label: 'Moderate Risk', color: 'text-amber-700', bg: 'bg-amber-100' }
  if (score >= 50) return { label: 'Significant Capacity Gaps', color: 'text-amber-600', bg: 'bg-amber-50' }
  return { label: 'Not Ready for Direct Funding', color: 'text-rose-700', bg: 'bg-rose-100' }
}

export function getRiskColor(score: number) {
  if (score <= 1) return { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Critical', border: 'border-rose-300' }
  if (score === 2) return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'High', border: 'border-amber-300' }
  if (score === 3) return { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Moderate', border: 'border-yellow-200' }
  return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Low', border: 'border-emerald-300' }
}

export function computeTierScore(
  scores: Record<string, number>,
  tier: number,
  active?: Record<LensId, boolean>,
): number {
  // Tier completeness is measured only over questions currently in scope, so a
  // deactivated lens never dilutes the percentage. When no lens map is supplied,
  // the Core Foundation plus the default-on lenses are counted.
  const inScope = (q: Question) => {
    const lens = questionLens(q)
    if (!lens) return true
    return active ? active[lens] : LENS_BY_ID[lens].defaultOn
  }
  const tierQs = MOCK_QUESTIONS.filter(q => q.tier === tier && inScope(q))
  if (tierQs.length === 0) return 0
  const total = tierQs.reduce((sum, q) => sum + (scores[q.id] || 0), 0)
  return Math.round((total / (tierQs.length * 5)) * 100)
}

export function computeDomainScore(scores: Record<string, number>, domain: string): number {
  const domainQs = MOCK_QUESTIONS.filter(q => q.domain === domain)
  if (domainQs.length === 0) return 0
  const total = domainQs.reduce((sum, q) => sum + (scores[q.id] || 0), 0)
  return Math.round((total / (domainQs.length * 5)) * 100)
}

// Composite score for the Climate & ESG lens (average across its four domains).
export function computeClimateScore(scores: Record<string, number>): number {
  return Math.round(
    CLIMATE_DOMAINS.reduce((sum, d) => sum + computeDomainScore(scores, d), 0) / CLIMATE_DOMAINS.length,
  )
}

export function computeCompositeIndices(
  scores: Record<string, number>,
  active?: Record<LensId, boolean>,
) {
  const avg = (...vals: number[]) => Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  const indices = [
    { name: 'Governance', value: avg(computeDomainScore(scores, 'Governance & Leadership'), computeDomainScore(scores, 'Legal & Regulatory')) },
    { name: 'Fiduciary', value: computeDomainScore(scores, 'Financial Management') },
    { name: 'Grant Mgmt', value: computeDomainScore(scores, 'Grant Management') },
    { name: 'Program Delivery', value: avg(computeDomainScore(scores, 'Program & Project Mgmt'), computeDomainScore(scores, 'PMO & Delivery'), computeDomainScore(scores, 'Monitoring, Evaluation & Learning')) },
    { name: 'Digital', value: computeDomainScore(scores, 'Digital Systems & Cyber') },
    { name: 'Risk Mgmt', value: avg(computeDomainScore(scores, 'Risk & Internal Controls'), computeDomainScore(scores, 'Audit & Assurance')) },
    { name: 'Sustainability', value: avg(computeDomainScore(scores, 'Sustainability & Financing'), computeDomainScore(scores, 'Human Resources')) },
    { name: 'USG Compliance', value: avg(computeDomainScore(scores, 'USG Compliance'), computeDomainScore(scores, 'International Donor Compliance')) },
  ]

  // Resilience axis is driven by the Emergency & Research lenses. When lens
  // activation is supplied, the axis reflects only the active modules and is
  // dropped entirely if neither is active.
  const emergencyOn = !active || active.emergency
  const researchOn = !active || active.research
  const resilienceParts: number[] = []
  if (emergencyOn) resilienceParts.push(computeDomainScore(scores, 'Emergency Preparedness'))
  if (researchOn) resilienceParts.push(computeDomainScore(scores, 'Research & Innovation'))
  if (resilienceParts.length) indices.push({ name: 'Resilience', value: avg(...resilienceParts) })

  // Climate & ESG axis appears only when the lens is active.
  if (active?.climate) indices.push({ name: 'Climate & ESG', value: computeClimateScore(scores) })

  return indices
}

// ============================================================================
// CRAFT (ICARF v4.0) - DiBadili Institute extensions
// ============================================================================

export const BRAND = {
  product: 'CRAFT',
  framework: 'ICARF v4.0',
  expansion: 'Capacity Readiness & Fiduciary Assurance Toolkit',
  fullName: 'CRAFT: Capacity Readiness & Fiduciary Assurance Toolkit',
  institute: 'DiBadili Institute',
  instituteUrl: 'https://becomechange.institute',
  instituteMeaning: 'Become Change',
  tagline: 'The CRAFT Framework: Building Fiduciary Trust for Direct G2G, DFI and Donor Partnerships.',
  heroSubtitle:
    'The CRAFT Framework: Building Fiduciary Trust for Direct G2G, DFI and Donor Partnerships.',
  contactEmail: 'partnership@becomechange.institute',
  socials: {
    linkedin: 'https://www.linkedin.com/company/dibadili-institute/',
    facebook: 'https://www.facebook.com/DiBadiliAfrica',
    instagram: 'https://www.instagram.com/dibadiliafrica',
    x: 'https://x.com/dibadiliafrica',
  },
  mandate: 'From Policy Intent to Execution Clarity.',
  footer:
    '© 2026 DiBadili Institute. CRAFT (ICARF v4.0) is an open-source public good. Software GPL-3.0 | Framework CC BY-SA 4.0.',
} as const

// --- Super Admin access mapping --------------------------------------------
// Emails that are granted the Super Admin (Global Control Center) view level the
// moment they sign in - regardless of the provider used (password, Google, or
// GitHub). Matching is case-insensitive. A GitHub or Google login resolves to
// the account's primary email, so listing the email here covers all three
// sign-in methods for the same person.
export const SUPER_ADMIN_EMAILS: readonly string[] = ['fabbiochucho@gmail.com']

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === normalized)
}

// --- Strict status badge legend -------------------------------------------
export type RiskStatus =
  | 'Completed-Validated'
  | 'Completed-Invalidated'
  | 'On-Track'
  | 'In-Progress'
  | 'Off-Track'
  | 'To-be-Initiated'

export const RISK_STATUSES: RiskStatus[] = [
  'Completed-Validated',
  'Completed-Invalidated',
  'On-Track',
  'In-Progress',
  'Off-Track',
  'To-be-Initiated',
]

export const STATUS_STYLES: Record<
  RiskStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  'Completed-Validated': { label: 'Completed-Validated', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  'Completed-Invalidated': { label: 'Completed-Invalidated', bg: 'bg-slate-200', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500' },
  'On-Track': { label: 'On-Track', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-500' },
  'In-Progress': { label: 'In-Progress', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500' },
  'Off-Track': { label: 'Off-Track', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300', dot: 'bg-rose-500' },
  'To-be-Initiated': { label: 'To-be-Initiated', bg: 'bg-white', text: 'text-slate-500', border: 'border-slate-300', dot: 'bg-slate-300' },
}

// --- Universal mock data injection -----------------------------------------
// Universalized findings abstracted from global fiduciary assessments.
// NO specific country or agency names are used.
export interface UniversalRisk {
  id: string
  topic: string
  domain: string
  tier: number
  severity: 'Critical' | 'High' | 'Moderate' | 'Low'
  description: string
  mitigation: string
  status: RiskStatus
  owner: string
  dueDate: string
}

export const UNIVERSAL_RISKS: UniversalRisk[] = [
  {
    id: 'FIN-01', topic: 'Grant Experience', domain: 'Grant Management', tier: 3, severity: 'High',
    description: 'The Agency lacks direct experience managing large-scale multilateral grants as a principal recipient. Current scope pales in comparison to target funding size.',
    mitigation: 'Donor capacity building & Principal Recipient mentorship.',
    status: 'In-Progress', owner: 'Director, Programmes', dueDate: 'Q2, Month 6',
  },
  {
    id: 'FIN-08', topic: 'Cash Bottlenecks', domain: 'Financial Management', tier: 2, severity: 'High',
    description: 'No alternative mechanisms or contingency plans in place for situations where national banking penetration is low or treasury disbursements are delayed.',
    mitigation: 'Develop formal cash flow contingency plan.',
    status: 'To-be-Initiated', owner: 'Head of Finance', dueDate: 'Q3, Month 9',
  },
  {
    id: 'FIN-13', topic: 'Accounting Software', domain: 'Financial Management', tier: 2, severity: 'Critical',
    description: 'Legacy accounting software cannot generate trial balances for individual donors. Reconciliations require manual spreadsheet intervention.',
    mitigation: 'Upgrade system and train finance team on advanced modules.',
    status: 'In-Progress', owner: 'Head of Finance / ICT', dueDate: 'Q2, Month 5',
  },
  {
    id: 'FIN-28', topic: 'Internal Controls', domain: 'Internal Controls', tier: 2, severity: 'Critical',
    description: 'Poor advance management. Significant project funds paid directly to individual staff personal bank accounts, resulting in late retirement.',
    mitigation: 'Directive issued to pay beneficiaries/vendors directly.',
    status: 'In-Progress', owner: 'Head of Finance', dueDate: 'Q1, Month 2',
  },
  {
    id: 'GOV-01', topic: 'Oversight', domain: 'Governance & Leadership', tier: 1, severity: 'Critical',
    description: 'No evidence that the Supreme Audit Institution (SAI) or National Legislature systematically reviews financial reports and provides formal oversight feedback.',
    mitigation: 'Ensure minutes and audit reports are formally filed and tracked.',
    status: 'In-Progress', owner: 'Board Secretary', dueDate: 'Q2, Month 6',
  },
  {
    id: 'PROC-11', topic: 'Procurement Docs', domain: 'Procurement & Supply Chain', tier: 2, severity: 'High',
    description: 'Unable to ascertain the basis of vendor selection for IT/office equipment; solicitation documents and evaluation matrices missing from procurement files.',
    mitigation: 'Document procedures based on SOP and archive supporting docs.',
    status: 'In-Progress', owner: 'Head of Procurement', dueDate: 'Q2, Month 4',
  },
  {
    id: 'FIN-42', topic: 'Asset Tagging', domain: 'Financial Management', tier: 2, severity: 'Moderate',
    description: 'Fixed assets are tagged with degradable printed-paper tags. No evidence of annual physical asset verification exercises.',
    mitigation: 'Change tagging mode; conduct annual physical verification.',
    status: 'In-Progress', owner: 'Head of Administration', dueDate: 'Q3, Month 8',
  },
  {
    id: 'ETH-04', topic: 'Whistleblowing', domain: 'Ethics & Anti-Fraud', tier: 2, severity: 'High',
    description: 'Internal fraud reporting requires staff to include names in petitions to the Executive Director. Lack of anonymity creates retaliation risks.',
    mitigation: 'Anonymous whistleblowing policy being enshrined in manual.',
    status: 'On-Track', owner: 'Head of Internal Audit', dueDate: 'Q2, Month 5',
  },
  {
    id: 'FIN-32', topic: 'Interim Reporting', domain: 'Financial Management', tier: 2, severity: 'Moderate',
    description: 'Agency not mandated to prepare interim financial reports outside the annual government cycle. Annual frequency prevents swift error correction.',
    mitigation: 'Quarterly financial reports now prepared for donor compliance.',
    status: 'In-Progress', owner: 'Head of Finance', dueDate: 'Q1, Month 3',
  },
  {
    id: 'AUD-04', topic: 'Audit Scope', domain: 'Audit & Compliance', tier: 2, severity: 'High',
    description: 'Internal Audit scope inadequate. Unit only reviews Finance and Admin functions quarterly, excluding all other operational/programmatic units.',
    mitigation: 'SOP developed to guide review of all units.',
    status: 'On-Track', owner: 'Head of Internal Audit', dueDate: 'Q2, Month 6',
  },
  {
    id: 'PROC-19', topic: 'Supply Planning', domain: 'Procurement & Supply Chain', tier: 5, severity: 'Moderate',
    description: 'Quantification is done, but no integrated national supply plan exists. Donated and procured pipelines are not synchronized.',
    mitigation: 'Integrated supply plan developed with technical assistance.',
    status: 'On-Track', owner: 'Supply Chain Lead', dueDate: 'Q3, Month 9',
  },
  {
    id: 'PROC-17', topic: 'Warehousing', domain: 'Procurement & Supply Chain', tier: 5, severity: 'High',
    description: 'Current warehousing arrangements suboptimal for emergency response. Inventory management weak, distribution services largely ad hoc.',
    mitigation: 'Finalizing Warehousing Transition Plan; hiring specialists.',
    status: 'In-Progress', owner: 'Supply Chain Lead', dueDate: 'Q4, Month 12',
  },
  {
    id: 'PROC-29', topic: 'Lab Quality', domain: 'Procurement & Supply Chain', tier: 5, severity: 'High',
    description: 'National Reference Laboratory lacks ISO/IEC 17025 certification. Donated medical/health products not routinely sampled by National Regulatory Authority.',
    mitigation: 'Liaising with an already ISO-certified partner lab.',
    status: 'In-Progress', owner: 'Quality Assurance Lead', dueDate: 'Q4, Month 14',
  },
  {
    id: 'DIG-05', topic: 'LMIS Digital', domain: 'Digital Systems', tier: 5, severity: 'Critical',
    description: 'Logistics Management Information System (LMIS) used only at central headquarters. Sub-national facility reporting rates critically low.',
    mitigation: 'Legacy system decommissioned; procurement of new cloud LMIS ongoing.',
    status: 'Off-Track', owner: 'Head of ICT', dueDate: 'Q5, Month 18',
  },
]

export function severityStyle(sev: UniversalRisk['severity']) {
  switch (sev) {
    case 'Critical': return { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' }
    case 'High': return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' }
    case 'Moderate': return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' }
    default: return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' }
  }
}

// --- Accreditation engine + Paper Compliance Penalty -----------------------
// Implementation evidence (0-100) measures system-enforced execution, not paper.
// If implementation evidence < 50%, accreditation is mathematically capped.
export const PAPER_COMPLIANCE_THRESHOLD = 50

export interface Accreditation {
  level: 'A' | 'B' | 'C' | 'D' | 'E'
  label: string
  color: string
  bg: string
  ring: string
  rawLevel: 'A' | 'B' | 'C' | 'D' | 'E'
  capped: boolean
  composite: number
}

const LEVEL_META: Record<Accreditation['level'], { label: string; color: string; bg: string; ring: string }> = {
  A: { label: 'Level A: Fully Accredited', color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-400' },
  B: { label: 'Level B: Accredited with Conditions', color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-300' },
  C: { label: 'Level C: Provisional', color: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-400' },
  D: { label: 'Level D: Strengthening Required', color: 'text-orange-700', bg: 'bg-orange-50', ring: 'ring-orange-400' },
  E: { label: 'Level E: Not Yet Eligible', color: 'text-rose-700', bg: 'bg-rose-50', ring: 'ring-rose-400' },
}

function levelFromScore(score: number): Accreditation['level'] {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'E'
}

const LEVEL_ORDER: Accreditation['level'][] = ['A', 'B', 'C', 'D', 'E']

export function getAccreditation(composite: number, implementationEvidence: number): Accreditation {
  const rawLevel = levelFromScore(composite)
  // Paper Compliance Penalty Engine: cap accreditation at Level C when
  // implementation evidence falls below threshold, regardless of paper score.
  let level = rawLevel
  let capped = false
  if (implementationEvidence < PAPER_COMPLIANCE_THRESHOLD) {
    const cappedFloorIndex = LEVEL_ORDER.indexOf('C')
    if (LEVEL_ORDER.indexOf(rawLevel) < cappedFloorIndex) {
      level = 'C'
      capped = true
    }
  }
  return { level, rawLevel, capped, composite, ...LEVEL_META[level] }
}

// Per-org implementation evidence (system-enforced execution %), mock.
export const ORG_IMPLEMENTATION_EVIDENCE: Record<string, number> = {
  'org-001': 42, // triggers Paper Compliance Penalty banner
  'org-002': 61,
  'org-003': 31,
  'org-004': 78,
}

export function getImplementationEvidence(orgId: string): number {
  return ORG_IMPLEMENTATION_EVIDENCE[orgId] ?? 50
}

// --- Donor frameworks (onboarding alignment) -------------------------------
export const DONOR_FRAMEWORKS = [
  { id: 'usaid', name: 'USAID / 2 CFR 200', desc: 'US Government Uniform Guidance & ADS series.' },
  { id: 'globalfund', name: 'Global Fund', desc: 'FMS, PR capacity & sub-recipient management.' },
  { id: 'worldbank', name: 'World Bank', desc: 'Financial Management & Procurement frameworks.' },
  { id: 'gavi', name: 'Gavi', desc: 'Programme funding & transparency policy.' },
  { id: 'eu', name: 'EU / DEVCO', desc: 'Pillar Assessment (PAGoDA) compliance.' },
]

export const MANDATE_TYPES = ['Ministry', 'National Public Health Institute (NPHI)', 'NGO', 'Regulatory Authority', 'Sub-National Entity']

// --- Portfolios (Portfolio Admin scoping) ----------------------------------
// Illustrative portfolios used ONLY to seed the demo workspace. A live
// workspace starts with no portfolios - Portfolio Reviewers and Super Admins
// create their own. The demo reviewer mirrors the seeded demo team member.
export const MOCK_PORTFOLIOS: Portfolio[] = [
  { id: 'pf-east', name: 'East Africa Portfolio', orgIds: ['org-001', 'org-002', 'org-003'], reviewer: 'd.mwangi@craft.demo' },
  { id: 'pf-west', name: 'West Africa Portfolio', orgIds: ['org-004'], reviewer: 'd.mwangi@craft.demo' },
]

// --- Access / view levels (the user-preference tiers) ----------------------
// Every member of the platform is granted one of these view levels. The level
// determines what they can see and is enforced through the sidebar navigation
// and the role gates on the Super Admin and Portfolio Admin portals.
//
// Two administrative tiers exist and must not be confused:
//   • `admin` (Administrator) — a normal, assignable role for someone running
//     their OWN organization or a consultancy: they onboard institutions, manage
//     their team and access grants, and review their client book. Their reach is
//     scoped to what they administer, never the whole platform.
//   • `super_admin` (Super Admin) — the sole platform operator. Platform-wide
//     control of every feature, institution, the question bank and the global
//     audit log. Reserved for the single allowlisted operator (see
//     [[SUPER_ADMIN_EMAILS]]); invisible to, and unassignable by, everyone else.
export type ViewLevel = 'assessor' | 'independent' | 'portfolio' | 'admin' | 'super_admin'

export interface ViewLevelMeta {
  id: ViewLevel
  label: string
  short: string
  scopeKind: 'organization' | 'portfolio' | 'platform'
  scopeNoun: string
  description: string
  badge: { bg: string; text: string }
}

export const VIEW_LEVELS: ViewLevelMeta[] = [
  {
    id: 'assessor',
    label: 'Organization Assessor',
    short: 'Assessor',
    scopeKind: 'organization',
    scopeNoun: 'a single institution',
    description:
      'Works inside one institution’s secure workspace: dashboard, assessment wizard, findings, evidence vault and capacity plan.',
    badge: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  },
  {
    id: 'independent',
    label: 'Independent Assessor',
    short: 'Independent',
    scopeKind: 'organization',
    scopeNoun: 'a single institution (independent review)',
    description:
      'An external reviewer (e.g. a consultant or LFA) scoped to one institution. Their scores are recorded independently of the institution’s self-assessment and reconciled on the Trust Delta screen.',
    badge: { bg: 'bg-violet-100', text: 'text-violet-700' },
  },
  {
    id: 'portfolio',
    label: 'Portfolio Reviewer',
    short: 'Portfolio',
    scopeKind: 'portfolio',
    scopeNoun: 'a collection of institutions',
    description:
      'Compares readiness across an assigned portfolio of institutions. Adds the Portfolio Admin portal; records outside the portfolio stay isolated.',
    badge: { bg: 'bg-blue-100', text: 'text-blue-700' },
  },
  {
    id: 'admin',
    label: 'Administrator',
    short: 'Admin',
    scopeKind: 'organization',
    scopeNoun: 'their organization or consultancy',
    description:
      'Administers their own institution or a consultancy: onboard institutions, manage the team and access, and review the client book. Adds the Portfolio Admin portal. Reach is scoped to what they administer, not the whole platform.',
    badge: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  },
  {
    id: 'super_admin',
    label: 'Super Admin',
    short: 'Super Admin',
    scopeKind: 'platform',
    scopeNoun: 'the entire platform',
    description:
      'Sole platform operator: full control of every institution, portfolios, the question bank, global domain weights and the security audit log. Reserved for the single allowlisted operator and never assignable to anyone else.',
    badge: { bg: 'bg-amber-100', text: 'text-amber-800' },
  },
]

export function getViewLevel(id: ViewLevel): ViewLevelMeta {
  return VIEW_LEVELS.find(v => v.id === id) ?? VIEW_LEVELS[0]
}

// Roles an admin may hand out from the portal, or a user may self-select as
// their working view. The `super_admin` tier is deliberately excluded: it is
// reserved for the single allowlisted operator (see [[SUPER_ADMIN_EMAILS]]) and
// is never assignable to anyone else, so the platform always has exactly one
// Super Admin. The ordinary `admin` (Administrator) tier IS assignable.
export const ASSIGNABLE_VIEW_LEVELS: ViewLevelMeta[] = VIEW_LEVELS.filter(v => v.id !== 'super_admin')

// The effective view level for an email given the role assigned to it in the
// directory. The super-admin allowlist is the SOLE source of platform
// `super_admin` rights: a listed operator is always `super_admin`; for anyone
// else a `super_admin` assignment is clamped down to `admin` (the highest
// assignable tier), so only the allowlisted operator can ever hold platform
// Super Admin access.
export function effectiveViewLevel(email: string | null | undefined, assigned?: string | null): ViewLevel {
  if (isSuperAdminEmail(email)) return 'super_admin'
  const role = (assigned as ViewLevel) || 'assessor'
  return role === 'super_admin' ? 'admin' : role
}

// --- Session timeout (security-bounded user preference) --------------------
// Assessors may choose an idle-logout window, but only within a safe range so
// nobody can leave a session open indefinitely. Bounds: 5–60 minutes.
export const SESSION_TIMEOUT_MIN = 5
export const SESSION_TIMEOUT_MAX = 60
export const SESSION_TIMEOUT_DEFAULT = 15
export const SESSION_TIMEOUT_OPTIONS = [5, 10, 15, 30, 45, 60] as const

// Clamp any requested timeout into the permitted security range.
export function clampSessionTimeout(minutes: number): number {
  if (Number.isNaN(minutes)) return SESSION_TIMEOUT_DEFAULT
  return Math.min(SESSION_TIMEOUT_MAX, Math.max(SESSION_TIMEOUT_MIN, Math.round(minutes)))
}

// --- Welcome / invitation email (mock) -------------------------------------
// The platform is invitation-only: every invited user receives a branded
// DiBadili Institute welcome email. This builds the exact body shown in the
// "Preview Email" modal and that a real mail service would deliver.
export interface WelcomeEmailInput {
  name: string
  email: string
  role: ViewLevel
  scopeLabel: string
  inviterName: string
  inviterEmail: string
  message?: string
}

export function buildWelcomeEmail(input: WelcomeEmailInput): { subject: string; body: string } {
  const level = getViewLevel(input.role)
  const subject = `Welcome to ${BRAND.product}: you're invited to join the ${BRAND.institute}`
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  const messageBlock = input.message?.trim()
    ? `\nMessage from ${input.inviterName}:\n"${input.message.trim()}"\n`
    : ''
  const body = `Dear ${input.name || 'Colleague'},

You have been invited to join the ${BRAND.product} (${BRAND.expansion}) platform by the ${BRAND.institute}.

INVITATION DETAILS:
${divider}
Role: ${level.label}
Scope: ${input.scopeLabel}
Invited by: ${input.inviterName} (${input.inviterEmail})
${divider}
${messageBlock}
YOUR NEXT STEPS:
1. Click the button below to create your account
2. Complete your profile setup
3. Begin your institutional assessment

[ ACCEPT INVITATION & CREATE ACCOUNT ]

This invitation will expire in 7 days.

ABOUT ${BRAND.product}:
${BRAND.product} is built by the ${BRAND.institute} to help government entities and NGOs
achieve institutional sovereignty and fiduciary trust for direct G2G, DFI and donor partnerships.

If you have questions, reach the ${BRAND.institute} at ${BRAND.contactEmail}.

Welcome to the ${BRAND.product} community.

Best regards,
The ${BRAND.institute} Team
"${BRAND.instituteMeaning}."

${divider}
This is an automated message from the ${BRAND.product} platform.
${BRAND.footer.split('.')[0]}. All rights reserved.`
  return { subject, body }
}

// Branded, self-contained HTML rendering of the welcome email - the actual
// template artifact a transactional mail service (e.g. an identity-signup
// function or SendGrid/Postmark) would deliver. Uses inline styles and a
// table-free, email-client-safe layout in the CRAFT / DiBadili palette. The
// same {{handlebars}}-style tokens map onto the plain-text version above.
export function buildWelcomeEmailHtml(input: WelcomeEmailInput): { subject: string; html: string } {
  const level = getViewLevel(input.role)
  const { subject } = buildWelcomeEmail(input)
  const name = esc(input.name || 'Colleague')
  const messageBlock = input.message?.trim()
    ? `<tr><td style="padding:0 32px 8px"><div style="border-left:3px solid #34d399;background:#f0fdf4;padding:12px 16px;border-radius:8px;color:#334155;font-size:14px;font-style:italic">${esc(input.inviterName)} wrote: “${esc(input.message.trim())}”</div></td></tr>`
    : ''
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0f172a;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <table role="presentation" width="100%" style="border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(2,44,34,.35)">
      <tr><td style="background:linear-gradient(135deg,#064e3b,#0f172a);padding:28px 32px">
        <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:.5px">${esc(BRAND.product)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#fbbf24">${esc(BRAND.framework)} · ${esc(BRAND.institute)}</p>
      </td></tr>
      <tr><td style="padding:32px 32px 8px">
        <h1 style="margin:0 0 8px;font-size:22px;color:#064e3b">Welcome, ${name}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#475569">You have been invited to join the <strong>${esc(BRAND.product)}</strong> (${esc(BRAND.expansion)}) platform by the ${esc(BRAND.institute)}.</p>
      </td></tr>
      <tr><td style="padding:16px 32px 8px">
        <table role="presentation" width="100%" style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
          <tr><td style="padding:12px 16px;font-size:13px;color:#64748b">Access level</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0f172a;text-align:right">${esc(level.label)}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0">Scope</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0f172a;text-align:right;border-top:1px solid #e2e8f0">${esc(input.scopeLabel)}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0">Invited by</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0f172a;text-align:right;border-top:1px solid #e2e8f0">${esc(input.inviterName)}</td></tr>
        </table>
      </td></tr>
      ${messageBlock}
      <tr><td style="padding:16px 32px 8px;text-align:center">
        <a href="${esc(BRAND.instituteUrl)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px">Accept Invitation &amp; Create Account</a>
        <p style="margin:12px 0 0;font-size:12px;color:#94a3b8">This invitation expires in 7 days.</p>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #f1f5f9">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8">Questions? Reach the ${esc(BRAND.institute)} at <a href="mailto:${esc(BRAND.contactEmail)}" style="color:#059669">${esc(BRAND.contactEmail)}</a>.<br>“${esc(BRAND.instituteMeaning)}.” · ${esc(BRAND.footer.split('.')[0])}.</p>
      </td></tr>
    </table>
  </div>
</body>
</html>`
  return { subject, html }
}

// Minimal HTML-entity escaper so invitee/inviter input is safe inside the
// template markup (the preview renders it via an iframe srcDoc).
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}


export interface EvidenceDoc {
  id: string
  name: string
  type: 'PDF' | 'XLSX' | 'DOCX' | 'IMG'
  domain: string
  linkedRisk: string
  sizeKb: number
  uploadedBy: string
  uploadedAt: string
  status: 'Validated' | 'Pending Review' | 'Invalidated'
}

export const EVIDENCE_DOCS: EvidenceDoc[] = [
  { id: 'EV-001', name: 'Board_Minutes_Q1.pdf', type: 'PDF', domain: 'Governance & Leadership', linkedRisk: 'GOV-01', sizeKb: 842, uploadedBy: 'Board Secretary', uploadedAt: '2026-02-12', status: 'Validated' },
  { id: 'EV-002', name: 'Donor_Trial_Balance_Test.xlsx', type: 'XLSX', domain: 'Financial Management', linkedRisk: 'FIN-13', sizeKb: 311, uploadedBy: 'Head of Finance', uploadedAt: '2026-02-20', status: 'Pending Review' },
  { id: 'EV-003', name: 'Advance_Payment_Directive.pdf', type: 'PDF', domain: 'Internal Controls', linkedRisk: 'FIN-28', sizeKb: 156, uploadedBy: 'Head of Finance', uploadedAt: '2026-01-30', status: 'Validated' },
  { id: 'EV-004', name: 'Procurement_File_Index_SOP.docx', type: 'DOCX', domain: 'Procurement & Supply Chain', linkedRisk: 'PROC-11', sizeKb: 98, uploadedBy: 'Head of Procurement', uploadedAt: '2026-03-04', status: 'Pending Review' },
  { id: 'EV-005', name: 'Whistleblower_Policy_Draft.pdf', type: 'PDF', domain: 'Ethics & Anti-Fraud', linkedRisk: 'ETH-04', sizeKb: 204, uploadedBy: 'Head of Internal Audit', uploadedAt: '2026-03-11', status: 'Validated' },
  { id: 'EV-006', name: 'Asset_Register_2026.xlsx', type: 'XLSX', domain: 'Financial Management', linkedRisk: 'FIN-42', sizeKb: 529, uploadedBy: 'Head of Administration', uploadedAt: '2026-02-28', status: 'Invalidated' },
  { id: 'EV-007', name: 'Integrated_Supply_Plan.pdf', type: 'PDF', domain: 'Procurement & Supply Chain', linkedRisk: 'PROC-19', sizeKb: 1204, uploadedBy: 'Supply Chain Lead', uploadedAt: '2026-03-18', status: 'Validated' },
  { id: 'EV-008', name: 'LMIS_Architecture_v2.pdf', type: 'PDF', domain: 'Digital Systems', linkedRisk: 'DIG-05', sizeKb: 766, uploadedBy: 'Head of ICT', uploadedAt: '2026-03-22', status: 'Pending Review' },
]

// --- Audit log -------------------------------------------------------------
export interface AuditEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  target: string
  category: 'Auth' | 'Assessment' | 'Evidence' | 'Config' | 'Export'
}

export const AUDIT_LOG: AuditEntry[] = [
  { id: 'A-1042', timestamp: '2026-06-06 09:14:22', actor: 'admin@workspace', action: 'Signed in', target: 'Secure Vault', category: 'Auth' },
  { id: 'A-1041', timestamp: '2026-06-06 09:15:03', actor: 'admin@workspace', action: 'Updated score', target: 'FIN-13 → 2', category: 'Assessment' },
  { id: 'A-1040', timestamp: '2026-06-05 16:48:51', actor: 'finance@workspace', action: 'Uploaded evidence', target: 'Donor_Trial_Balance_Test.xlsx', category: 'Evidence' },
  { id: 'A-1039', timestamp: '2026-06-05 14:02:10', actor: 'audit@workspace', action: 'Validated evidence', target: 'Whistleblower_Policy_Draft.pdf', category: 'Evidence' },
  { id: 'A-1038', timestamp: '2026-06-05 11:31:44', actor: 'admin@workspace', action: 'Exported report', target: 'Executive Summary (PDF)', category: 'Export' },
  { id: 'A-1037', timestamp: '2026-06-04 17:55:09', actor: 'admin@workspace', action: 'Bulk import', target: 'CRAFT_Template.csv (450 rows)', category: 'Assessment' },
  { id: 'A-1036', timestamp: '2026-06-04 10:12:37', actor: 'sysadmin@dibadili', action: 'Adjusted global weight', target: 'Financial Management 0.12', category: 'Config' },
  { id: 'A-1035', timestamp: '2026-06-03 08:47:19', actor: 'finance@workspace', action: 'Signed in', target: 'Secure Vault', category: 'Auth' },
]

// --- Help: FAQs + Glossary -------------------------------------------------
export const FAQS = [
  // Signing in & account access
  { q: 'How do I sign in to CRAFT?', a: 'Open the sign-in screen and enter the work email and password you registered with. New here? Switch to the Register tab, name your institution, pick the category you are registering as, and create a password of at least 6 characters - you will then confirm your email before your first sign-in. Where your organization has enabled social sign-in, a "continue with" option (Google and/or GitHub) also appears beneath the form.' },
  { q: 'Which sign-in methods are available?', a: 'Email and password is always available. Google and GitHub single sign-on are also supported, but each only appears on the sign-in screen when it has been switched on for the site under Identity → External providers. CRAFT checks the live provider configuration on load and only shows a social button when that provider is actually enabled, so you will never be offered a button that cannot complete.' },
  { q: 'The GitHub (or Google) sign-in button is missing or was not working - why?', a: 'A social button only appears when that provider is enabled in the site’s Identity settings. If GitHub is not showing, it has not been enabled for your deployment yet - an administrator can turn it on under Identity → External providers, after which the button appears automatically. If GitHub is enabled but sign-in fails, the usual cause is that GitHub did not share a verified email address: make sure your GitHub account has a verified, non-private primary email, then try again. In the meantime you can always sign in with your email and password.' },
  { q: 'I signed in with Google or GitHub - which organization and role do I get?', a: 'Social sign-in resolves to your account’s primary email, and CRAFT looks that email up in the user directory. If an administrator has already assigned you to an institution or portfolio, you land in that workspace at the role they set. If not, you start in your own isolated workspace at the category you registered as. Signing in with a password, Google, or GitHub for the same email always resolves to the same account.' },
  { q: 'Where can I find a full user guide?', a: 'Open User Guide from the sidebar (under Support, next to Help & Glossary). It is an interactive, step-by-step walkthrough of the whole platform - from signing in and onboarding to the assessment wizard, findings, capacity plan, data room and reports. You can filter it to your access level, search it, track which sections you have read, and download the entire guide as a self-contained file or print it to PDF to read offline or share with colleagues.' },

  // Who CRAFT is for - organizational archetypes
  { q: 'Who is CRAFT built for?', a: 'CRAFT serves any institution that needs to prove fiduciary trust to a government (G2G), a Development Finance Institution (DFI), or a donor. It adapts to three organizational archetypes - Public Sector (ministries, agencies, regulators, National Public Health Institutes and sub-national entities), Civil Society (NGOs, foundations, cooperatives, faith-based and member bodies), and Private Sector (SMEs, startups and corporates seeking capital or contracts). A universal fiduciary core applies to all three, and archetype-specific questions are layered on top.' },
  { q: 'Which archetype should I choose for my organization?', a: 'Pick the archetype that matches your legal form and mandate. Public Sector covers government and statutory bodies that answer to a Supreme Audit Institution. Civil Society covers not-for-profits, NGOs, foundations and cooperatives that rely on grants and member trust. Private Sector covers for-profit companies - from startups to corporates - pursuing investment, lending or commercial contracts. Your choice is set during onboarding and tailors the entire assessment; you can refine it later from your workspace profile.' },
  { q: 'How does the assessment change for each archetype?', a: 'Every institution answers the universal Core fiduciary questions on governance, finance, procurement, risk and ethics. On top of that, CRAFT injects archetype-specific questions: Private Sector entities pick up cap-table, beneficial-ownership, unit-economics and ESG questions; Civil Society entities pick up board-independence, restricted-fund, safeguarding and MEL questions; Public Sector entities pick up SAI oversight and public-accountability questions. Questions that do not apply to your archetype are never shown.' },
  { q: "I'm a startup or private company - is CRAFT relevant to me?", a: 'Yes. The Private Sector archetype is designed for SMEs, startups and corporates raising capital or bidding for donor- and government-backed contracts. It assesses the same fiduciary discipline investors and DFIs expect - clean cap tables, verified beneficial ownership, credible unit economics, and ESG/safeguard controls - and turns gaps into an investor-ready strengthening plan.' },
  { q: 'We are an NGO or foundation - how is CRAFT different for us?', a: 'The Civil Society archetype focuses on the trust signals grant-makers and multilateral donors look for: an independent board, segregation between governance and management, restricted-fund accounting, anonymous whistleblowing, safeguarding, and credible monitoring, evaluation and learning (MEL). Your readiness score and capacity plan are framed around grant eligibility and Principal Recipient capacity.' },
  { q: 'We are a ministry or public agency - what does CRAFT assess for us?', a: 'The Public Sector archetype emphasizes public accountability: oversight by the Supreme Audit Institution, transparency of public finances, sub-national reporting reach, and the controls donors require before channelling funds Government-to-Government (G2G). It is well-suited to ministries, regulatory authorities, National Public Health Institutes and sub-national entities.' },
  { q: 'How do sector and subsector affect my assessment?', a: 'After choosing an archetype you select a sector (e.g. Fintech, NGO-Health, or Ministry of Finance) and, where relevant, a subsector (e.g. Digital Lending, Humanitarian, or Disease Surveillance). These sharpen your dynamic Data Room checklist so the platform asks for exactly the regulatory evidence your kind of institution must hold - a crypto fintech, for example, picks up VASP obligations a payments fintech does not.' },
  { q: 'What are thematic lenses and should I switch them on?', a: 'Lenses are optional question packs you can toggle to match your context: the Climate, ESG & Article 6 lens (environmental and social safeguards, climate budget tagging, carbon-market readiness), the Emergency & Health Security lens (emergency operations and surge logistics), and the Research, Data & Innovation lens (research ethics, data sovereignty and IP). Activate the lenses that reflect your mandate; they add targeted questions without changing your Core baseline.' },
  { q: 'Which donor frameworks can I align my accreditation to?', a: 'During onboarding you map your assessment to the funders that matter to you - USAID / 2 CFR 200, the Global Fund, the World Bank, Gavi and the EU / DEVCO (PAGoDA). CRAFT cross-references your answers against each selected framework so your findings speak directly to those donors’ fiduciary standards.' },

  // Access levels - the three user types
  { q: 'What are the access levels in CRAFT?', a: 'Every user is granted one view level. An Organization Assessor works inside a single institution’s secure workspace - dashboard, wizard, findings, evidence vault and capacity plan. A Portfolio Reviewer compares readiness across an assigned portfolio of institutions and gains the Portfolio Admin portal, while records outside their portfolio stay isolated. An Administrator has admin access across the platform: every institution, portfolios, the question bank, global domain weights and the security audit log.' },
  { q: 'Can a Portfolio Reviewer see inside every institution?', a: 'No. A reviewer only sees the institutions explicitly assigned to their portfolio. Multi-tenant isolation is enforced by organization_id, so an institution’s detailed scores and evidence are never visible to reviewers outside its portfolio, and never to other assessors.' },
  { q: 'How do I add colleagues, and what roles can they have?', a: 'From Team & Roles (or during onboarding) you invite colleagues by email and assign each a view level scoped to the right institution or portfolio. Co-assessors join scoped to your institution; reviewers are scoped to a named portfolio. Invitations are logged in the audit trail.' },

  // Getting started & filling the assessment
  { q: 'How do I begin a CRAFT assessment?', a: 'Register your institution, confirm your email, then complete onboarding - naming your workspace, choosing your archetype, sector and country, and selecting your donor frameworks. The Assessment Wizard then opens with the questions tailored to your profile. Work through the five tiers in order; each question carries an insight and a 0–5 maturity slider, and your answers save to your private vault and immediately drive your dashboard, findings, and capacity plan.' },
  { q: 'What does the 0–5 maturity score mean for each question?', a: '0 = no evidence the control exists; 1 = ad-hoc or informal; 2 = documented but not consistently applied; 3 = applied but not independently verified; 4 = implemented and monitored; 5 = fully system-enforced with audit trails. Scores of 0–2 are treated as gaps and flow into your Findings and Capacity Plan automatically.' },
  { q: 'How do my answers become Findings and a Capacity Plan?', a: 'Every question you answer at 2 or below becomes a finding, classified Critical (0–1) or High (2). Each finding is then converted into a costed, owned, time-bound action in your 24-Month Capacity Plan. The owner is assigned from the question’s domain and the due date is scheduled by severity, with critical gaps front-loaded into the first six months.' },
  { q: 'Do I have to answer every question before I see results?', a: 'No. The dashboard, findings register, and capacity plan are built only from the questions you have actually answered, so they fill in progressively as you work. You can save and return at any time; unanswered questions are simply excluded until you score them.' },
  { q: 'What is the 7-Point Evidence Matrix?', a: 'Beneath each question you record where the control sits on the implementation ladder: from No Evidence through Drafted, Approved, Disseminated, Partially Implemented, Implemented, to System-Enforced. This captures execution maturity, not just whether a policy exists on paper.' },
  { q: 'How is my Implementation Evidence percentage calculated?', a: 'It is the share of your answered questions that score 4 or higher, i.e. controls that are genuinely implemented or system-enforced. It updates live as you complete the wizard and directly determines whether the Paper Compliance Penalty applies.' },
  { q: 'What is the Paper Compliance Penalty Engine?', a: 'When your live Implementation Evidence falls below 50%, your accreditation level is mathematically capped at Level C, regardless of how strong your policy manuals look on paper. CRAFT rewards execution, not documentation.' },
  { q: 'What do the 5 Tiers represent?', a: 'Organizational Maturity, Fiduciary Assurance, Grant Management, Donor & USG Readiness, and Digital & Operational Readiness, the full lifecycle from governance to field execution.' },
  { q: 'How is my accreditation level (A–E) determined?', a: 'Your weighted composite score across all 20 domains maps to a raw level (A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, E below 40). The Paper Compliance Penalty can then cap that level if implementation evidence is weak, so two institutions with identical paper scores can land on different levels.' },
  { q: 'Can I import existing scores instead of entering them by hand?', a: 'Yes. Use Bulk Import in the Assessment Wizard to upload a single CRAFT template file under 5MB. It is scanned, sanitized, and validated, and each row is written into your vault exactly as if you had entered it manually.' },
  { q: 'How do I track progress on closing a gap?', a: 'Open the Capacity Plan and set each action’s status: To-be-Initiated, In-Progress, On-Track, Off-Track, Completed-Validated, or Completed-Invalidated. The dashboard summarises how many actions are off-track so leadership can intervene early.' },
  { q: 'Can I export my results for the Board or a donor?', a: 'Yes. The Reports Export Center generates a board-ready Executive Summary (PDF) and a full 24-Month Capacity Plan (Excel/CSV). Both are built from your own answers, with owners, due dates, mitigation actions, and statuses included.' },
  { q: 'What is the Data Room and how does it relate to my answers?', a: 'The Data Room is your dynamic evidence vault. Based on your archetype, sector, subsector and country, CRAFT generates the exact list of regulatory and fiduciary documents your institution should hold, then tracks each as Missing, Uploaded, Verified or Flagged. Wizard questions can link directly to the Data Room item that satisfies their evidence, so your readiness score and your document trail stay in sync.' },
  { q: 'How is my data isolated from other organizations?', a: 'Every record is scoped by organization_id. You can only read and write scores belonging to your own workspace, and the audit log records activity from your first sign-in onward so you have a complete, tamper-evident history. Portfolio Reviewers see only their assigned institutions, and administrators are never recorded as reviewers of any single institution.' },
  { q: 'What is the difference between the live workspace and the demo?', a: 'Your workspace starts empty and reflects only the data you enter. The demo opens in a separate tab pre-loaded with illustrative sample institutions - including an example assessor workspace and a portfolio view - so you can explore every screen and access level. Nothing in the demo touches or appears in your real vault.' },
]

export const GLOSSARY = [
  // CRAFT platform terms
  { term: 'CRAFT', def: 'Capacity Readiness & Fiduciary Assurance Toolkit - the platform that diagnoses, accredits, strengthens and monitors institutional readiness for G2G, DFI and donor partnerships.' },
  { term: 'ICARF v4.0', def: 'The Institutional Capacity Assessment & Readiness Framework underlying CRAFT: 5 tiers and 20 domains scored on a 0–5 maturity scale.' },
  { term: 'Archetype', def: 'The organizational type a workspace belongs to - Public Sector, Civil Society or Private Sector - which determines the archetype-specific questions layered on the universal fiduciary core.' },
  { term: 'Thematic Lens', def: 'An optional question pack (Climate/ESG & Article 6, Emergency & Health Security, or Research, Data & Innovation) that adds context-specific questions without changing the Core baseline.' },
  { term: 'Data Room', def: 'The dynamic evidence vault that lists the regulatory and fiduciary documents an institution should hold - generated from its archetype, sector, subsector and country - and tracks each as Missing, Uploaded, Verified or Flagged.' },
  { term: 'Implementation Evidence', def: 'The share of answered questions scoring 4 or higher (genuinely implemented or system-enforced); it determines whether the Paper Compliance Penalty applies.' },
  { term: 'Paper Compliance Penalty', def: 'A rule that caps accreditation at Level C when Implementation Evidence falls below 50%, so documentation alone cannot inflate a score.' },
  { term: 'Organization Assessor', def: 'A view level scoped to a single institution’s workspace: dashboard, wizard, findings, evidence vault and capacity plan.' },
  { term: 'Portfolio Reviewer', def: 'A view level that compares readiness across an assigned portfolio of institutions, with records outside the portfolio kept isolated.' },
  { term: 'Administrator', def: 'A view level with admin access across the platform: every institution, portfolios, the question bank, global domain weights and the security audit log.' },
  // Donor & fiduciary terms
  { term: '2 CFR 200', def: 'US Government Uniform Guidance governing federal award management, cost principles, and audit requirements.' },
  { term: 'Principal Recipient (PR)', def: 'The entity legally accountable to a multilateral donor for the implementation of a grant.' },
  { term: 'Trial Balance', def: 'A report listing all ledger balances; donors require it disaggregated per grant.' },
  { term: 'LMIS', def: 'Logistics Management Information System: tracks commodity stock from central to sub-national facilities.' },
  { term: 'SAI', def: 'Supreme Audit Institution: the national body providing external oversight of public finances.' },
  { term: 'Single Audit', def: 'An organization-wide audit required for entities expending federal funds above a threshold (2 CFR 200 Subpart F).' },
  { term: 'ISO/IEC 17025', def: 'International standard for the competence of testing and calibration laboratories.' },
  { term: 'Segregation of Duties', def: 'Control principle ensuring no single individual can initiate, approve, and record a transaction.' },
  { term: 'PAGoDA', def: 'The EU’s Pillar Assessment for Grants or Delegation Agreements, used to verify an entity’s systems before channelling EU funds.' },
  { term: 'Beneficial Ownership', def: 'The natural persons who ultimately own or control an entity; disclosure is a baseline fiduciary and anti-money-laundering control.' },
]

// 4-Layer lifecycle (methodology)
export const LIFECYCLE = [
  { step: 1, name: 'Assessment', desc: 'Diagnose institutional readiness across 5 tiers and 20 domains using a 0–5 maturity scale backed by a 7-point evidence matrix.' },
  { step: 2, name: 'Accreditation', desc: 'Compute a Level A–E rating. The Paper Compliance Penalty Engine caps the level when implementation evidence is weak.' },
  { step: 3, name: 'Strengthening', desc: 'Convert every gap into a costed, owned, and time-bound action within a 24-month Capacity Improvement Plan.' },
  { step: 4, name: 'Monitoring', desc: 'Track validated execution over time, re-scoring as evidence matures and donor frameworks evolve.' },
]

export const STRATEGIC_PILLARS = [
  { name: 'Advisory & Strategy', desc: 'Translating policy intent into executable institutional strategy.' },
  { name: 'Policy Innovation & Research', desc: 'Evidence-led frameworks for African public institutions.' },
  { name: 'Systems Leadership', desc: 'Building leaders who become the change their systems require.' },
]

export const PANAFRICAN_BADGES = [
  'Excellence in Institutional Quality',
  'Pan-African Perspective',
  'Integrity & Principled Leadership',
  'Afro-Continuous Development Mindset',
]

export const BLINDSPOTS = [
  { title: 'The Spreadsheet Trap', desc: 'Legacy accounting systems unable to generate automated donor-specific trial balances.', icon: 'spreadsheet' },
  { title: 'The Sub-National Blindspot', desc: 'Centralized logistics systems with critically low facility-level reporting.', icon: 'map' },
  { title: 'The Paper Compliance Illusion', desc: 'Institutions with perfect policy manuals but zero system-enforced implementation.', icon: 'paper' },
  { title: 'The Anonymity Gap', desc: 'Whistleblowing mechanisms requiring staff names, deterring fraud reporting.', icon: 'anon' },
]

// ============================================================================
// Answer-derived intelligence
// Findings, the 24-month Capacity Plan, and Implementation Evidence are all
// computed live from the maturity scores the user actually enters in the
// Assessment Wizard - there is no static finding list in the live workspace.
// ============================================================================

export interface DerivedFinding {
  id: string
  qId: string
  topic: string
  domain: string
  tier: number
  severity: 'Critical' | 'High' | 'Moderate'
  score: number
  question: string
  description: string
  mitigation: string
  owner: string
  dueMonth: number
  dueDate: string
}

// Accountable owner inferred from the question's domain.
const OWNER_BY_DOMAIN: Record<string, string> = {
  'Governance & Leadership': 'Board Secretary',
  'Legal & Regulatory': 'Legal Counsel',
  'Strategy & Planning': 'Director, Strategy',
  'Human Resources': 'Head of Human Resources',
  'Sustainability & Financing': 'Director, Resource Mobilization',
  'Financial Management': 'Head of Finance',
  'Procurement & Supply Chain': 'Head of Procurement',
  'Risk & Internal Controls': 'Head of Risk & Controls',
  'Audit & Assurance': 'Head of Internal Audit',
  'Ethics & Anti-Fraud': 'Ethics & Compliance Officer',
  'Grant Management': 'Director, Programmes',
  'Program & Project Mgmt': 'Head of Programmes',
  'Monitoring, Evaluation & Learning': 'Head of M&E',
  'Partnerships & Stakeholders': 'Head of Partnerships',
  'USG Compliance': 'Donor Compliance Manager',
  'International Donor Compliance': 'Donor Compliance Manager',
  'Digital Systems & Cyber': 'Head of ICT',
  'Emergency Preparedness': 'Emergency Preparedness Coordinator',
  'Research & Innovation': 'Head of Research',
  'PMO & Delivery': 'Head of PMO',
}

function severityFromScore(score: number): DerivedFinding['severity'] {
  if (score <= 1) return 'Critical'
  if (score === 2) return 'High'
  return 'Moderate'
}

function quarterLabel(month: number): string {
  return `Q${Math.ceil(month / 3)}, Month ${month}`
}

// Schedule each gap into the 24-month window: the more critical the gap, the
// earlier it is due. Critical → months 2–6, High → 7–14, Moderate → 15–24.
function dueMonthFor(severity: DerivedFinding['severity'], index: number): number {
  if (severity === 'Critical') return 2 + (index % 5)
  if (severity === 'High') return 7 + (index % 8)
  return 15 + (index % 10)
}

// Build the findings register from the answers provided. Only questions that
// have actually been answered (a key exists in `orgScores`) and scored at or
// below `threshold` (default 2) are surfaced as gaps requiring action.
export function deriveFindings(
  orgScores: Record<string, number>,
  threshold = 2,
): DerivedFinding[] {
  const sevOrder: Record<DerivedFinding['severity'], number> = { Critical: 0, High: 1, Moderate: 2 }
  const findings: DerivedFinding[] = []
  let i = 0
  for (const q of MOCK_QUESTIONS) {
    if (!(q.id in orgScores)) continue
    const score = orgScores[q.id]
    if (score > threshold) continue
    const severity = severityFromScore(score)
    const dueMonth = dueMonthFor(severity, i)
    findings.push({
      id: q.id,
      qId: q.id,
      topic: q.riskCategory || q.domain,
      domain: q.domain,
      tier: q.tier,
      severity,
      score,
      question: q.question,
      description: q.insight || q.question,
      mitigation: q.capacityAction,
      owner: OWNER_BY_DOMAIN[q.domain] ?? 'Executive Director',
      dueMonth,
      dueDate: quarterLabel(dueMonth),
    })
    i++
  }
  return findings.sort(
    (a, b) => sevOrder[a.severity] - sevOrder[b.severity] || a.dueMonth - b.dueMonth || a.tier - b.tier,
  )
}

// Implementation Evidence (0–100): share of answered controls that are actually
// implemented or system-enforced (score ≥ 4). Reflects execution, not paper.
export function computeImplementationEvidence(orgScores: Record<string, number>): number {
  const keys = Object.keys(orgScores)
  if (keys.length === 0) return 0
  const enforced = keys.filter(k => orgScores[k] >= 4).length
  return Math.round((enforced / keys.length) * 100)
}

// Number of questions the user has actually answered.
export function answeredCount(orgScores: Record<string, number>): number {
  return Object.keys(orgScores).length
}

// --- Interactive user guide ------------------------------------------------
// The full, step-by-step walkthrough rendered on /guide and exported as a
// self-contained downloadable document. Content is data-driven so the same
// source powers the in-app interactive view and the offline HTML/PDF export.
export const USER_GUIDE_VERSION = 'v4.0'
export const USER_GUIDE_UPDATED = 'July 2026'

export interface GuideStep {
  heading: string
  detail: string
  tip?: string
}

export interface GuideSection {
  id: string
  // Icon key resolved to a lucide glyph in the UserGuidePage; kept as a string
  // here so the data layer stays free of React/JSX imports.
  icon: 'rocket' | 'building' | 'clipboard' | 'gauge' | 'target' | 'folder' | 'report' | 'network' | 'shield' | 'lock' | 'life-buoy'
  title: string
  summary: string
  // View levels this section is most relevant to. Used by the role filter; a
  // section listing all four levels shows for everyone.
  roles: ViewLevel[]
  steps: GuideStep[]
}

const ALL_ROLES: ViewLevel[] = ['assessor', 'independent', 'portfolio', 'admin']

export const USER_GUIDE: GuideSection[] = [
  {
    id: 'getting-started',
    icon: 'rocket',
    title: 'Getting started & signing in',
    summary: 'Create your account, confirm your email, and choose how you sign in.',
    roles: ALL_ROLES,
    steps: [
      {
        heading: 'Register your institution',
        detail:
          'On the sign-in screen, switch to the Register tab. Enter your institution name, choose the category you are registering as (Organization Assessor, Independent Assessor or Portfolio Reviewer), give a work email, and set a password of at least 6 characters. Administrator access is never self-serve - it is granted only from the admin portal.',
      },
      {
        heading: 'Confirm your email',
        detail:
          'Unless your site has autoconfirm switched on, you will receive a confirmation link by email. Click it to activate your account; you cannot sign in until the email is confirmed. If it does not arrive, check your spam folder or register again to resend the link.',
        tip: 'The confirmation link signs you straight in and drops you into your workspace - no need to return to the login form manually.',
      },
      {
        heading: 'Sign in with email or a social provider',
        detail:
          'Enter your email and password to sign in. If your organization has enabled Google or GitHub single sign-on, a "continue with" button also appears beneath the form. CRAFT checks the live provider configuration on load, so a social button is only ever shown when that provider is actually enabled and able to complete a sign-in.',
        tip: 'Password, Google and GitHub all resolve to your account’s primary email, so any method lands you in the same workspace.',
      },
      {
        heading: 'Explore without an account',
        detail:
          'Not ready to register? Choose View Live Demo to open pre-loaded sample institutions and portfolios in a separate space. Nothing in the demo touches your real vault.',
      },
    ],
  },
  {
    id: 'onboarding',
    icon: 'building',
    title: 'Onboarding your workspace',
    summary: 'Tell CRAFT what kind of institution you are so it can tailor the assessment.',
    roles: ['assessor', 'independent', 'portfolio'],
    steps: [
      {
        heading: 'Name your workspace and pick an archetype',
        detail:
          'Choose the archetype that matches your legal form and mandate: Public Sector (ministries, agencies, regulators, NPHIs), Civil Society (NGOs, foundations, cooperatives, faith-based bodies) or Private Sector (SMEs, startups, corporates). A universal fiduciary core applies to all three; archetype-specific questions are layered on top.',
      },
      {
        heading: 'Select sector, subsector and country',
        detail:
          'Your sector and subsector sharpen the Data Room checklist so CRAFT asks for exactly the regulatory evidence your kind of institution must hold. Your country aligns national regulatory references.',
      },
      {
        heading: 'Map your donor frameworks',
        detail:
          'Pick the funders that matter to you - USAID / 2 CFR 200, the Global Fund, the World Bank, Gavi, EU / DEVCO (PAGoDA). CRAFT cross-references your answers against each so your findings speak directly to those donors’ standards.',
      },
      {
        heading: 'Switch on thematic lenses (optional)',
        detail:
          'Activate optional question packs that reflect your mandate - Climate/ESG & Article 6, Emergency & Health Security, or Research, Data & Innovation. Lenses add targeted questions without changing your Core baseline.',
      },
    ],
  },
  {
    id: 'assessment',
    icon: 'clipboard',
    title: 'Completing the assessment',
    summary: 'Work through the five tiers, scoring each control on a 0–5 maturity scale.',
    roles: ['assessor', 'independent'],
    steps: [
      {
        heading: 'Understand the five tiers',
        detail:
          'Questions are organised into five tiers: Organizational Maturity, Fiduciary Assurance, Grant Management, Donor & USG Readiness, and Digital & Operational Readiness. Work through them in order; each question carries an insight explaining why it matters.',
      },
      {
        heading: 'Score each control 0–5',
        detail:
          '0 = no evidence the control exists; 1 = ad-hoc or informal; 2 = documented but not consistently applied; 3 = applied but not independently verified; 4 = implemented and monitored; 5 = fully system-enforced with audit trails. Scores of 0–2 are treated as gaps.',
        tip: 'You do not have to answer everything at once - your dashboard, findings and capacity plan build only from what you have actually scored, so results fill in progressively.',
      },
      {
        heading: 'Record the 7-Point Evidence Matrix',
        detail:
          'Beneath each question, note where the control sits on the implementation ladder: No Evidence → Drafted → Approved → Disseminated → Partially Implemented → Implemented → System-Enforced. This captures execution maturity, not just whether a policy exists on paper.',
      },
      {
        heading: 'Import existing scores (optional)',
        detail:
          'Use Bulk Import in the wizard to upload a single CRAFT template file under 5MB. It is scanned, sanitized and validated, and each row is written into your vault exactly as if you had entered it by hand.',
      },
    ],
  },
  {
    id: 'scoring',
    icon: 'gauge',
    title: 'Scores, evidence & accreditation',
    summary: 'How your answers roll up into an A–E accreditation level.',
    roles: ALL_ROLES,
    steps: [
      {
        heading: 'Weighted composite score',
        detail:
          'Your answers roll up into a weighted composite across all domains, which maps to a raw accreditation level: A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, E below 40.',
      },
      {
        heading: 'Implementation Evidence',
        detail:
          'This is the share of your answered questions scoring 4 or higher - controls that are genuinely implemented or system-enforced. It updates live as you complete the wizard.',
      },
      {
        heading: 'The Paper Compliance Penalty',
        detail:
          'When Implementation Evidence falls below 50%, your accreditation is mathematically capped at Level C regardless of how strong your policy manuals look. CRAFT rewards execution, not documentation - so two institutions with identical paper scores can land on different levels.',
        tip: 'Prioritise moving controls from "documented" to "implemented and monitored" to lift the penalty cap.',
      },
    ],
  },
  {
    id: 'findings',
    icon: 'target',
    title: 'Findings & the Capacity Plan',
    summary: 'Turn gaps into a costed, owned, time-bound 24-month plan.',
    roles: ['assessor', 'independent', 'portfolio'],
    steps: [
      {
        heading: 'From answers to findings',
        detail:
          'Every question scored 2 or below becomes a finding, classified Critical (0–1) or High (2). Findings appear automatically in your Findings register as you score.',
      },
      {
        heading: 'The 24-Month Capacity Plan',
        detail:
          'Each finding is converted into a costed, owned, time-bound action. Owners are assigned from the question’s domain and due dates are scheduled by severity, with critical gaps front-loaded into the first six months.',
      },
      {
        heading: 'Track execution',
        detail:
          'Set each action’s status: To-be-Initiated, In-Progress, On-Track, Off-Track, Completed-Validated or Completed-Invalidated. The dashboard summarises how many actions are off-track so leadership can intervene early.',
      },
    ],
  },
  {
    id: 'data-room',
    icon: 'folder',
    title: 'Data Room & evidence',
    summary: 'Your dynamic evidence vault, generated from your profile.',
    roles: ['assessor', 'independent'],
    steps: [
      {
        heading: 'A checklist tailored to you',
        detail:
          'Based on your archetype, sector, subsector and country, CRAFT generates the exact list of regulatory and fiduciary documents your institution should hold.',
      },
      {
        heading: 'Track each document',
        detail:
          'Every item is tracked as Missing, Uploaded, Verified or Flagged. Wizard questions can link directly to the Data Room item that satisfies their evidence, so your readiness score and your document trail stay in sync.',
      },
    ],
  },
  {
    id: 'reports',
    icon: 'report',
    title: 'Reports & exports',
    summary: 'Board- and donor-ready outputs built from your own answers.',
    roles: ALL_ROLES,
    steps: [
      {
        heading: 'Executive Summary (PDF)',
        detail:
          'The Reports Export Center generates a board-ready Executive Summary with your accreditation level, domain scores and headline findings.',
      },
      {
        heading: 'Capacity Plan (Excel/CSV)',
        detail:
          'Export the full 24-Month Capacity Plan with owners, due dates, mitigation actions and statuses for offline tracking or donor submission.',
      },
    ],
  },
  {
    id: 'portfolio',
    icon: 'network',
    title: 'Reviewing a portfolio',
    summary: 'Compare readiness across an assigned set of institutions.',
    roles: ['portfolio', 'admin'],
    steps: [
      {
        heading: 'See only your portfolio',
        detail:
          'A Portfolio Reviewer sees only the institutions explicitly assigned to their portfolio. Multi-tenant isolation is enforced by organization_id, so records outside the portfolio stay invisible.',
      },
      {
        heading: 'The Portfolio Admin portal',
        detail:
          'Compare accreditation levels and readiness trends across institutions, and reconcile self-assessments against independent reviews on the Trust Delta screen.',
      },
    ],
  },
  {
    id: 'admin',
    icon: 'shield',
    title: 'Administrator controls',
    summary: 'Administer your institution or consultancy: onboard institutions, manage your team and access.',
    roles: ['admin', 'portfolio'],
    steps: [
      {
        heading: 'Onboard and administer institutions',
        detail:
          'As an Administrator you register the institutions you run or consult for, curate portfolios, and open any client you administer read-only from the workspace switcher. Your reach is scoped to what you administer - other tenants stay isolated.',
      },
      {
        heading: 'Manage your team and access',
        detail:
          'Assign colleagues and consultants to your organisation, set their view levels, and grant or revoke cross-tenant access. Platform-wide configuration - the question bank, global domain weights and the cross-tenant audit log - is reserved for the platform operator and is not part of this role.',
      },
    ],
  },
  {
    id: 'security',
    icon: 'lock',
    title: 'Security, roles & sessions',
    summary: 'How your data is isolated and your session protected.',
    roles: ALL_ROLES,
    steps: [
      {
        heading: 'Multi-tenant isolation',
        detail:
          'Every record is scoped by organization_id. You can only read and write scores belonging to your own workspace, and an append-only audit log records activity from your first sign-in for a tamper-evident history.',
      },
      {
        heading: 'Idle session timeout',
        detail:
          'You can set an idle-logout window between 5 and 60 minutes in Settings. The session timer signs you out automatically after inactivity so an unattended session cannot stay open indefinitely.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    icon: 'life-buoy',
    title: 'Troubleshooting sign-in',
    summary: 'What to do when a social login or confirmation link misbehaves.',
    roles: ALL_ROLES,
    steps: [
      {
        heading: 'A social button is missing',
        detail:
          'Google and GitHub buttons only appear when that provider is enabled for the site under Identity → External providers. If GitHub is not showing, it has not been enabled yet - an administrator can switch it on, after which the button appears automatically. Email-and-password sign-in is always available.',
      },
      {
        heading: 'GitHub sign-in fails after redirect',
        detail:
          'The most common cause is that GitHub did not share a verified email. Make sure your GitHub account has a verified, non-private primary email, then try again. If it keeps failing, sign in with your email and password instead.',
      },
      {
        heading: 'You never received the confirmation email',
        detail:
          'Check your spam folder. You can register again with the same email to resend the confirmation link. Sign-in stays blocked until the email is confirmed.',
      },
    ],
  },
]

