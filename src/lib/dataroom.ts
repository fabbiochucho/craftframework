// ============================================================================
// CRAFT (ICARF v4.0) - Dynamic Data Room & Regulatory Compliance Engine
// ----------------------------------------------------------------------------
// Generates a categorized, dynamic checklist of the legal, financial, HR and
// sector-specific regulatory documents an entity needs to be "due-diligence
// ready". The checklist is mapped on the fly from three inputs:
//
//   • Archetype  - Public · Civil Society · Private
//   • Country    - Pan-African ISO-2 code (or universal)
//   • Sector     - industry / mandate within the archetype
//
// so a Nigerian fintech sees CBN / NDPR requirements, a Kenyan NGO sees the NGO
// Coordination Board cert, and a South African ministry sees AGSA + Treasury
// monitoring - all from the same matrix with zero UI changes per jurisdiction.
//
// Evidence is dual-mode: a document can be satisfied by a direct Upload OR by a
// verifiable External Link (Drive / SharePoint), and an Independent Assessor can
// Verify or Flag each one. When every Critical and High requirement is verified
// the workspace earns the "CRAFT Verified Data Room" badge.
//
// Demo vs. live separation mirrors the rest of the platform: a LIVE workspace
// opens empty (every requirement Missing), while a DEMO session is seeded with
// an illustrative spread of statuses. SSR-safe: no Date objects at module scope.
// ============================================================================

import type { Archetype } from './data'
import {
  resolveRegulatoryContext, pillar, type JurisdictionId, type SectorArchetype,
} from './regulatory-context'

export type EvidenceType = 'upload' | 'external_link'

// The lifecycle of a single Data Room requirement.
// not_available: the organisation states the document does not exist (with a reason), which is different from
// missing (not yet provided). A desk review records the gap instead of asking for a document written for the review.
export type DataRoomStatus = 'missing' | 'uploaded' | 'verified' | 'flagged' | 'not_available'

export type DataRoomCategory =
  | 'Corporate & Legal'
  | 'Financial'
  | 'Sector Regulatory'
  | 'Statutory & Regulatory'
  | 'HR & Data Compliance'
  | 'Governance & Sovereign'

export const CATEGORY_ORDER: DataRoomCategory[] = [
  'Corporate & Legal',
  'Financial',
  'Sector Regulatory',
  'Statutory & Regulatory',
  'HR & Data Compliance',
  'Governance & Sovereign',
]

export type Priority = 'Critical' | 'High' | 'Moderate' | 'Low'

export interface ComplianceRequirement {
  id: string
  category: DataRoomCategory
  documentName: string
  description: string
  priority: Priority
  applicableArchetypes: Archetype[]
  // ISO-2 country codes the requirement applies to, or ['ALL'] for universal.
  applicableCountries: string[]
  // Sector keys the requirement applies to, or ['ALL'] for any sector.
  applicableSectors: string[]
  // Optional finer granularity within a sector. Omitted (or ['ALL']) means the
  // requirement applies to every subsector of its sectors - most requirements
  // sit at the sector level and leave this unset.
  applicableSubsectors?: string[]
  // The CRAFT Capacity Assessment domains this document is evidence for, so a desk review feeds scoring. Community
  // ids are full domain ids; government keys omit the national/state/local prefix (e.g. 'plan-1' for nat-plan-1).
  cca?: { community?: string[]; government?: string[] }
  // For network documents: the network coordinating-body area it supports (src/lib/indices/networkCapacity.ts).
  network?: string
}

// A user/assessor's working record against one requirement.
export interface DataRoomItem {
  requirementId: string
  // User-defined label for the evidence they provided (defaults to the doc name).
  documentName: string
  evidenceType?: EvidenceType
  fileName?: string
  fileUrl?: string
  status: DataRoomStatus
  // Assessor's note left when flagging for correction.
  assessorNote?: string
  verifiedBy?: string
  updatedAt?: string
  // Desk review fields: when the document was approved, how it is shown to be in use, why it does not exist,
  // who in the organisation holds it, and when it is due.
  approvedOn?: string
  evidenceOfUse?: string
  notAvailableReason?: string
  custodian?: string
  dueDate?: string
  providedBy?: string
}

// ----------------------------------------------------------------------------
// Reference data - Pan-African countries & per-archetype sectors
// ----------------------------------------------------------------------------

export { COUNTRIES, type Country } from './countries'
import { COUNTRIES } from './countries'

export function countryName(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.name ?? code
}
export function countryFlag(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.flag ?? '🌍'
}

// Sector options depend on the archetype - a startup picks an industry, an NGO
// picks an organizational form, a public body picks a mandate.
export const SECTORS_BY_ARCHETYPE: Record<Archetype, string[]> = {
  Private: ['Fintech', 'Healthtech', 'Agritech', 'Manufacturing', 'Tech / SaaS', 'Renewable Energy', 'Logistics'],
  'Civil Society': ['NGO', 'CBO', 'Faith-Based', 'Network', 'Coalition', 'Advocacy Group', 'Union', 'Cooperative', 'Foundation', 'Research Institute'],
  Public: ['Ministry', 'Agency', 'National Public Health Institute (NPHI)', 'Regulatory Authority', 'Sub-National Entity'],
}

// Optional finer granularity beneath a sector. A sector that is not listed here
// simply has no subsectors, so the profile pickers and the engine treat it as a
// single undivided sector. Subsectors sharpen the regulatory checklist (e.g. a
// crypto fintech picks up VASP obligations a payments fintech does not).
export const SUBSECTORS_BY_SECTOR: Record<string, string[]> = {
  // Private
  Fintech: ['Payments & Wallets', 'Digital Lending & Credit', 'Insurtech', 'Crypto / Digital Assets', 'Wealth & Capital Markets'],
  Healthtech: ['Telemedicine', 'Diagnostics & Devices', 'Pharma & Biotech', 'Health Insurance / HMO'],
  Agritech: ['Crop Production & Export', 'Livestock & Aquaculture', 'Agri-Marketplace & Logistics', 'Agri-Fintech'],
  Manufacturing: ['Food & Beverage', 'Pharmaceuticals', 'Industrial & Chemicals', 'Consumer Goods'],
  'Tech / SaaS': ['Enterprise SaaS', 'Consumer / Mobile', 'AI & Data', 'E-commerce'],
  'Renewable Energy': ['Solar (C&I / Mini-grid)', 'Wind', 'Clean Cooking', 'E-mobility'],
  Logistics: ['Last-Mile Delivery', 'Freight & Haulage', 'Warehousing & Cold Chain'],
  // Civil Society
  NGO: ['Health', 'Education', 'Humanitarian & Emergency', 'Governance & Human Rights', 'Livelihoods & Economic Empowerment'],
  Foundation: ['Grant-Making', 'Operating Foundation'],
  Cooperative: ['Agricultural', 'Savings & Credit (SACCO)', 'Housing', 'Worker / Producer'],
  'Research Institute': ['Health & Clinical', 'Climate & Environment', 'Social & Economic'],
  // Public
  Ministry: ['Health', 'Finance', 'Agriculture', 'Education', 'Environment'],
  Agency: ['Public Health', 'Revenue', 'Disaster Management', 'Procurement & Supply'],
  'National Public Health Institute (NPHI)': ['Disease Surveillance', 'Emergency Operations', 'Public Health Laboratories'],
}

// The subsector options available beneath a sector (empty if the sector has none).
export function subsectorsForSector(sector: string): string[] {
  return SUBSECTORS_BY_SECTOR[sector] ?? []
}

type DeskRow = [string, DataRoomCategory, string, string, Priority, ComplianceRequirement['cca'], string?]
// Compact rows for the desk review documents (same shape as every other requirement).
function deskReview(rows: DeskRow[], archetypes: Archetype[], sectors: string[]): ComplianceRequirement[] {
  return rows.map(([id, category, documentName, description, priority, cca, network]) => ({
    id, category, documentName, description, priority, applicableArchetypes: archetypes, applicableCountries: ['ALL'], applicableSectors: sectors,
    ...(cca ? { cca } : {}), ...(network ? { network } : {}),
  }))
}

// Healthcare documents for every country. Regulators differ by country, so each names the kind of body and
// gives examples; the organisation's own national regulator is what counts.
const HEALTH_PRIVATE = { applicableArchetypes: ['Private'] as Archetype[], applicableSectors: ['Healthtech'] }
const HEALTH_CIVIL = { applicableArchetypes: ['Civil Society'] as Archetype[], applicableSectors: ['NGO', 'Research Institute'], applicableSubsectors: ['Health', 'Health & Clinical'] }
function healthcare(): ComplianceRequirement[] {
  const rows: Array<[string, DataRoomCategory, string, string, Priority, 'both' | 'private' | 'civil', string[]?]> = [
    ['HC-FACILITY', 'Sector Regulatory', 'Health Facility Registration / Operating Licence',
      'Current registration or licence for each facility, laboratory or clinic from the health facility regulator or health ministry (for example HEFAMAA in Lagos State, the Health Facilities Regulatory Agency in Ghana, the Kenya Medical Practitioners and Dentists Council).',
      'Critical', 'both', ['Telemedicine', 'Diagnostics & Devices']],
    ['HC-PAYER', 'Financial', 'Health Insurance & Payer Accreditation and Payment Terms',
      'Accreditation with the national health insurance scheme or with insurers and HMOs, and the signed payment terms with each payer (for example NHIA in Nigeria, the Social Health Authority in Kenya, the NHIS in Ghana, medical schemes in South Africa).',
      'High', 'both'],
    ['HC-RECEIVABLES', 'Financial', 'Aged Receivables & Claims Status by Payer',
      'What each payer owes and for how long: insurance and HMO claims submitted, paid, queried and denied, government and donor reimbursements outstanding, and the average days from service to payment.',
      'High', 'both'],
    ['HC-CLINICAL', 'Sector Regulatory', 'Clinical Evidence & Ethics Approvals',
      'Evidence for each clinical or health-outcome claim, and approval from a recognised research ethics committee for any study involving people (for example the National Health Research Ethics Committee in Nigeria).',
      'High', 'both'],
    ['HC-PRACTITIONERS', 'HR & Data Compliance', 'Professional Licences of Clinical Staff',
      'Current practising licences for doctors, nurses, pharmacists, laboratory scientists and other clinical staff from their professional councils, with renewal dates.',
      'High', 'both'],
    ['HC-DATA', 'HR & Data Compliance', 'Patient Data Protection Safeguards',
      'How health and patient data is protected under the national data protection law: consent forms, access controls, a data protection impact assessment and any registration with the data protection authority.',
      'High', 'both'],
  ]
  return rows.flatMap(([id, category, documentName, description, priority, who, subsectors]) => [
    ...(who !== 'civil' ? [{ id: `${id}-PS`, category, documentName, description, priority, ...HEALTH_PRIVATE, applicableCountries: ['ALL'], ...(subsectors ? { applicableSubsectors: subsectors } : {}) }] : []),
    ...(who !== 'private' ? [{ id: `${id}-CS`, category, documentName, description, priority, ...HEALTH_CIVIL, applicableCountries: ['ALL'] }] : []),
  ])
}

// ----------------------------------------------------------------------------
// The master compliance matrix - the single source of truth the engine filters.
// ----------------------------------------------------------------------------

export const MASTER_COMPLIANCE_MATRIX: ComplianceRequirement[] = [
  // --- Universal (all archetypes, all countries) ---
  {
    id: 'UNI-FIN-01', category: 'Financial', documentName: 'Audited Financial Statements (Last 2–3 Years)',
    description: 'Independently audited annual accounts demonstrating financial track record and going-concern.',
    priority: 'Critical', applicableArchetypes: ['Public', 'Civil Society', 'Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'UNI-FIN-02', category: 'Financial', documentName: 'Tax Clearance / Compliance Certificate',
    description: 'Current certificate from the revenue authority confirming the entity is in good standing.',
    priority: 'High', applicableArchetypes: ['Public', 'Civil Society', 'Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'UNI-FIN-03', category: 'Financial', documentName: 'Bank Account Mandates & Signatory List',
    description: 'Authorised signatories and approval thresholds for every operating bank account.',
    priority: 'Moderate', applicableArchetypes: ['Public', 'Civil Society', 'Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'UNI-LEG-01', category: 'Corporate & Legal', documentName: 'Certificate of Incorporation / Registration',
    description: 'Primary registration document establishing the entity as a recognised legal person.',
    priority: 'Critical', applicableArchetypes: ['Public', 'Civil Society', 'Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'UNI-HR-01', category: 'HR & Data Compliance', documentName: 'Employee Contracts & HR Policy Manual',
    description: 'Template employment contracts and the staff handbook covering conduct and grievance.',
    priority: 'Moderate', applicableArchetypes: ['Public', 'Civil Society', 'Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'UNI-HR-02', category: 'HR & Data Compliance', documentName: 'Data Privacy Policy (GDPR / NDPR aligned)',
    description: 'Published policy governing the handling of customer and employee personal data.',
    priority: 'High', applicableArchetypes: ['Public', 'Civil Society', 'Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'UNI-HR-03', category: 'HR & Data Compliance', documentName: 'ESG / Safeguarding Policy',
    description: 'Environmental, social and safeguarding commitments expected by funders and corporate buyers.',
    priority: 'Moderate', applicableArchetypes: ['Public', 'Civil Society', 'Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },

  // --- Private sector ---
  {
    id: 'PS-LEG-01', category: 'Corporate & Legal', documentName: 'Memorandum & Articles of Association',
    description: 'Constitutional documents defining objects, share classes and internal governance.',
    priority: 'Critical', applicableArchetypes: ['Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'PS-LEG-02', category: 'Corporate & Legal', documentName: 'Cap Table & Shareholder Agreements',
    description: 'Fully diluted capitalisation table plus executed shareholder / SAFE / convertible agreements.',
    priority: 'Critical', applicableArchetypes: ['Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'PS-LEG-03', category: 'Corporate & Legal', documentName: 'Founder / Contractor IP Assignment Agreements',
    description: 'Signed assignment of all IP and code from founders and contractors to the company.',
    priority: 'Critical', applicableArchetypes: ['Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'PS-FIN-01', category: 'Financial', documentName: 'Monthly Management Accounts & Financial Projections',
    description: 'Unit economics, burn rate, runway and a forward model shared with the board / investors.',
    priority: 'Critical', applicableArchetypes: ['Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'PS-HR-01', category: 'HR & Data Compliance', documentName: 'Supplier Code of Conduct & ESG Audit Reports',
    description: 'Anti-modern-slavery and ESG due diligence covering top suppliers by spend.',
    priority: 'High', applicableArchetypes: ['Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },

  // --- Private · sector-specific regulatory ---
  {
    id: 'PS-SEC-FINTECH', category: 'Sector Regulatory', documentName: 'Central Bank Operating Licence & PCI-DSS Certificate',
    description: 'Payment / lending licence from the central bank plus PCI-DSS attestation for card data.',
    priority: 'Critical', applicableArchetypes: ['Private'], applicableCountries: ['ALL'], applicableSectors: ['Fintech'],
  },
  {
    id: 'PS-SEC-HEALTH', category: 'Sector Regulatory', documentName: 'Medical / Drug Regulatory Approval & Clinical Trial Ethics',
    description: 'Approval from the national medicines and medical-device regulator for each product (for example NAFDAC in Nigeria, SAHPRA in South Africa, the Pharmacy and Poisons Board in Kenya, the Food and Drugs Authority in Ghana) and ethics clearance for any trials.',
    priority: 'Critical', applicableArchetypes: ['Private'], applicableCountries: ['ALL'], applicableSectors: ['Healthtech'],
  },
  {
    id: 'PS-SEC-AGRI', category: 'Sector Regulatory', documentName: 'Phytosanitary Certificates & Export Licences',
    description: 'Plant-health certification and export authorisation for agricultural produce.',
    priority: 'High', applicableArchetypes: ['Private'], applicableCountries: ['ALL'], applicableSectors: ['Agritech'],
  },
  {
    id: 'PS-SEC-MANUF', category: 'Sector Regulatory', documentName: 'Factory Licence & Product Standards Certification',
    description: 'Operating licence and national bureau of standards certification for manufactured goods.',
    priority: 'High', applicableArchetypes: ['Private'], applicableCountries: ['ALL'], applicableSectors: ['Manufacturing'],
  },
  {
    id: 'PS-SEC-ENERGY', category: 'Sector Regulatory', documentName: 'Energy Regulator Generation Licence & EIA',
    description: 'Generation / distribution licence and an approved Environmental Impact Assessment.',
    priority: 'High', applicableArchetypes: ['Private'], applicableCountries: ['ALL'], applicableSectors: ['Renewable Energy'],
  },

  // --- Healthcare (any country): health providers, health technology and health research ---
  ...healthcare(),

  // --- Investment readiness (any country) ---
  {
    id: 'INV-MODEL', category: 'Financial', documentName: 'Financial Model, Funding Ask & Use of Funds',
    description: 'A driver-based model with base and downside cases, the amount sought worked out from it, use of funds by category and the dated milestones it reaches.',
    priority: 'Moderate', applicableArchetypes: ['Civil Society', 'Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'INV-RISKS', category: 'Corporate & Legal', documentName: 'Known Risks & Mitigations Register',
    description: 'Every known weakness or open issue with a factual answer and what is being done about it, shared with financiers upfront.',
    priority: 'Moderate', applicableArchetypes: ['Civil Society', 'Private'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },

  // --- Private · subsector-specific regulatory (only when the subsector is set) ---
  {
    id: 'PS-SUB-CRYPTO', category: 'Sector Regulatory', documentName: 'VASP Registration & Travel-Rule AML Programme',
    description: 'Virtual Asset Service Provider registration plus a Travel-Rule-compliant AML/CFT programme for digital-asset flows.',
    priority: 'Critical', applicableArchetypes: ['Private'], applicableCountries: ['ALL'], applicableSectors: ['Fintech'],
    applicableSubsectors: ['Crypto / Digital Assets'],
  },
  {
    id: 'PS-SUB-LENDING', category: 'Sector Regulatory', documentName: 'Digital Lending Licence & Fair-Lending / Pricing Disclosure',
    description: 'Consumer-credit / digital-lending authorisation and the mandated effective-interest-rate and collections-conduct disclosures.',
    priority: 'High', applicableArchetypes: ['Private'], applicableCountries: ['ALL'], applicableSectors: ['Fintech'],
    applicableSubsectors: ['Digital Lending & Credit'],
  },
  {
    id: 'PS-SUB-PHARMA', category: 'Sector Regulatory', documentName: 'GMP Manufacturing Licence & Pharmacovigilance SOP',
    description: 'Good Manufacturing Practice licence and an active pharmacovigilance / adverse-event reporting procedure.',
    priority: 'Critical', applicableArchetypes: ['Private'], applicableCountries: ['ALL'], applicableSectors: ['Healthtech'],
    applicableSubsectors: ['Pharma & Biotech'],
  },

  // --- Private · country-specific data / regulatory ---
  {
    id: 'PS-NG-NDPR', category: 'Sector Regulatory', documentName: 'NITDA NDPR Compliance Audit Filing',
    description: 'Annual Nigeria Data Protection Regulation audit filed via a licensed DPCO.',
    priority: 'High', applicableArchetypes: ['Private'], applicableCountries: ['NG'], applicableSectors: ['ALL'],
  },
  {
    id: 'PS-KE-ODPC', category: 'Sector Regulatory', documentName: 'ODPC Data Controller Registration (Kenya)',
    description: 'Registration with the Office of the Data Protection Commissioner under the DPA 2019.',
    priority: 'High', applicableArchetypes: ['Private'], applicableCountries: ['KE'], applicableSectors: ['ALL'],
  },
  {
    id: 'PS-RW-RURA', category: 'Sector Regulatory', documentName: 'RURA / NBR Sector Authorisation (Rwanda)',
    description: 'Sector regulator authorisation and Rwanda Data Protection registration.',
    priority: 'High', applicableArchetypes: ['Private'], applicableCountries: ['RW'], applicableSectors: ['ALL'],
  },

  // --- Civil Society ---
  {
    id: 'CS-LEG-01', category: 'Corporate & Legal', documentName: 'Constitution / Trust Deed & Governing Board Charter',
    description: 'Founding constitution or trust deed plus the charter and ToR of the governing board.',
    priority: 'Critical', applicableArchetypes: ['Civil Society'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'CS-FIN-01', category: 'Financial', documentName: 'Restricted-Fund Segregation & Donor Reporting Pack',
    description: 'Evidence that restricted donor funds are ring-fenced from unrestricted core funds.',
    priority: 'Critical', applicableArchetypes: ['Civil Society'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'CS-HR-01', category: 'HR & Data Compliance', documentName: 'Safeguarding & PSEA Policy with Reporting Mechanism',
    description: 'Protection from Sexual Exploitation and Abuse policy and a functional anonymous channel.',
    priority: 'Critical', applicableArchetypes: ['Civil Society'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'CS-KE-NGO', category: 'Sector Regulatory', documentName: 'NGO Coordination Board Cert & KRA Tax Exemption',
    description: 'Valid Kenyan NGO Coordination Board certificate and KRA tax-exemption letter.',
    priority: 'Critical', applicableArchetypes: ['Civil Society'], applicableCountries: ['KE'], applicableSectors: ['NGO'],
  },
  {
    id: 'CS-NG-CAC', category: 'Sector Regulatory', documentName: 'CAC Incorporated Trustees & SCUML Registration (Nigeria)',
    description: 'Corporate Affairs Commission trustee registration and SCUML AML registration.',
    priority: 'High', applicableArchetypes: ['Civil Society'], applicableCountries: ['NG'], applicableSectors: ['ALL'],
  },
  {
    id: 'CS-COOP-01', category: 'Corporate & Legal', documentName: 'Cooperative Bylaws & Member Share Register',
    description: 'Registered cooperative bylaws and an up-to-date member share register.',
    priority: 'Critical', applicableArchetypes: ['Civil Society'], applicableCountries: ['ALL'], applicableSectors: ['Cooperative'],
  },
  {
    id: 'CS-SUB-HUM', category: 'HR & Data Compliance', documentName: 'IASC PSEA Certification & Humanitarian Access Agreements',
    description: 'Inter-Agency Standing Committee PSEA self-assessment and signed access / civil-military coordination agreements.',
    priority: 'High', applicableArchetypes: ['Civil Society'], applicableCountries: ['ALL'], applicableSectors: ['NGO'],
    applicableSubsectors: ['Humanitarian & Emergency'],
  },

  // ── Desk review: documents every organisation should hold (owned by the CRAFT Capacity Assessment desk review) ──
  ...deskReview([
    ['UNI-ORG-01', 'Corporate & Legal', 'Current Organisational Profile', 'A current description of the organisation: mandate, programmes, locations, staffing and funding.', 'Moderate', { community: ['com-leg-1'], government: ['gov-1'] }],
    ['UNI-ORG-02', 'Corporate & Legal', 'Current Strategic Plan', 'The approved strategic plan in force, with its period and approval record.', 'High', { community: ['com-prog-1', 'com-res-1'], government: ['plan-1', 'gov-4'] }],
    ['UNI-ORG-03', 'Corporate & Legal', 'Organisational Structure (Organogram)', 'The approved organogram showing units, posts and reporting lines.', 'Moderate', { community: ['com-hr-1'], government: ['gov-1'] }],
    ['UNI-GOV-01', 'Governance & Sovereign', 'Governing Board Membership List', 'Current members of the board or governing body, with appointment dates and roles.', 'High', { community: ['com-gov-1'], government: ['gov-5'] }],
    ['UNI-GOV-02', 'Governance & Sovereign', 'Minutes of Board Meetings (Last Two Years)', 'Signed minutes of governing body meetings for the last two years.', 'High', { community: ['com-gov-1', 'com-gov-2'], government: ['gov-5', 'gov-2'] }],
    ['UNI-GOV-03', 'Governance & Sovereign', 'Code of Conduct and Conflict of Interest Policy', 'The approved code of conduct and conflict of interest policy, with signed declarations.', 'High', { community: ['com-gov-4'], government: ['gov-3'] }],
    ['UNI-FIN-04', 'Financial', 'Financial Management Policy or Manual', 'The approved finance manual covering accounting, controls, cash and reporting.', 'Critical', { community: ['com-fin-1', 'com-fin-3'], government: ['pfm-3', 'pfm-4'] }],
    ['UNI-FIN-05', 'Financial', 'Procurement Policy', 'The approved procurement policy with methods, thresholds and approvals.', 'High', { community: ['com-fin-3'], government: ['proc-1'] }],
    ['UNI-FIN-06', 'Financial', 'Annual and Operational Budgets', 'Approved budgets for the current and last financial year.', 'High', { community: ['com-fin-2'], government: ['pfm-1', 'pfm-5'] }],
    ['UNI-PRG-01', 'Corporate & Legal', 'Programme or Project Implementation Reports (Last Two Years)', 'Progress and final reports for programmes and projects over the last two years.', 'High', { community: ['com-prog-2', 'com-rql-1'], government: ['plan-5'] }],
    ['UNI-PRG-02', 'Corporate & Legal', 'Monitoring and Evaluation Framework', 'The results framework, indicators and data collection plan in use.', 'High', { community: ['com-prog-3'], government: ['plan-2'] }],
    ['UNI-PRG-03', 'Corporate & Legal', 'Annual Reports', 'Published or board-approved annual reports for the last two years.', 'Moderate', { community: ['com-rql-1'], government: ['plan-5', 'adv-3'] }],
    ['UNI-PRG-04', 'Corporate & Legal', 'Previous Capacity Assessment Reports', 'Reports of earlier organisational capacity assessments, if any, with the improvement plans that followed.', 'Low', undefined],
    ['UNI-HR-04', 'HR & Data Compliance', 'Confidentiality Policy', 'The approved policy on confidential information, including personal data of people served.', 'Moderate', { community: ['com-leg-3'], government: ['plan-5'] }],
    ['UNI-RES-01', 'Financial', 'Resource Mobilisation or Fundraising Strategy', 'The approved strategy for raising and diversifying funds.', 'Moderate', { community: ['com-res-1'], government: ['res-1'] }],
    ['UNI-PRT-01', 'Corporate & Legal', 'Advocacy and Communication Strategy', 'The approved advocacy and communication strategy or plan.', 'Moderate', { community: ['com-part-1'], government: ['adv-1', 'adv-3'] }],
    ['UNI-PRT-02', 'Corporate & Legal', 'Partnership Agreements and Memoranda of Understanding', 'Signed agreements with the main partners, funders and government bodies.', 'Moderate', { community: ['com-part-2'], government: ['part-4'] }],
  ], ['Public', 'Civil Society', 'Private'], ['ALL']),
  ...deskReview([
    ['CS-HR-02', 'HR & Data Compliance', 'Child Protection Policy', 'The approved child protection policy, with the reporting procedure and focal person.', 'High', { community: ['com-svc-4'] }],
  ], ['Civil Society'], ['ALL']),
  // ── Networks, coalitions and unions: documents about members, chapters and representation ──
  ...deskReview([
    ['NET-01', 'Governance & Sovereign', 'Membership Policy and Guidelines', 'Who can join, members’ rights and duties, and how membership is granted or withdrawn.', 'Critical', { community: ['com-gov-1'] }, 'mandate'],
    ['NET-02', 'Governance & Sovereign', 'Membership Register and List of Chapters', 'The current register of members and the list of state or regional chapters with contacts.', 'High', { community: ['com-part-2'] }, 'mandate'],
    ['NET-03', 'Governance & Sovereign', 'Chapter Coordination Guidelines', 'How the national body and chapters coordinate, report and share decisions.', 'High', { community: ['com-gov-3'] }, 'coordination'],
    ['NET-04', 'Governance & Sovereign', 'Records of National and Chapter Meetings', 'Minutes or reports of national and chapter meetings over the last two years.', 'High', { community: ['com-gov-1'] }, 'coordination'],
    ['NET-05', 'Governance & Sovereign', 'Records of Elections and Leadership Transitions', 'Election notices, results and handover records for the governing body and officers.', 'High', { community: ['com-gov-2'] }, 'mandate'],
    ['NET-06', 'Governance & Sovereign', 'Evidence of Representation in National Coordination Structures', 'Appointments, attendance or submissions showing the network represents members in national bodies.', 'Moderate', { community: ['com-part-1'] }, 'representation'],
  ], ['Civil Society'], ['Network', 'Coalition', 'Union']),

  // --- Public sector / sovereign ---
  {
    id: 'PUB-GOV-01', category: 'Governance & Sovereign', documentName: 'Enabling Act / Establishment Instrument',
    description: 'The statute or instrument constituting the body and defining its legal mandate.',
    priority: 'Critical', applicableArchetypes: ['Public'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'PUB-GOV-02', category: 'Governance & Sovereign', documentName: 'Supreme Audit Institution Report & Findings Tracker',
    description: 'Latest SAI audit report and the tracker evidencing closure of prior findings.',
    priority: 'Critical', applicableArchetypes: ['Public'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'PUB-FIN-01', category: 'Financial', documentName: 'Treasury Monthly Budget Monitoring Reports',
    description: 'In-year budget execution and monitoring reports submitted to the national treasury.',
    priority: 'High', applicableArchetypes: ['Public'], applicableCountries: ['ALL'], applicableSectors: ['ALL'],
  },
  {
    id: 'PUB-ZA-AGSA', category: 'Governance & Sovereign', documentName: 'AGSA Audit Report & Treasury Monitoring (South Africa)',
    description: 'Auditor-General of South Africa report and National Treasury monthly monitoring.',
    priority: 'Critical', applicableArchetypes: ['Public'], applicableCountries: ['ZA'], applicableSectors: ['ALL'],
  },
]

// ----------------------------------------------------------------------------
// Engine - filter the matrix to the workspace's profile
// ----------------------------------------------------------------------------

function appliesTo(values: string[], target: string): boolean {
  return values.includes('ALL') || values.includes(target)
}

// Generate the dynamic checklist for a given Archetype + Country + Sector +
// Subsector. Any of country/sector/subsector may be empty, in which case only
// that dimension's universal ('ALL') requirements are returned. A requirement
// with no applicableSubsectors applies to every subsector of its sectors.
export function generateChecklist(
  archetype: Archetype | '',
  country: string,
  sector: string,
  subsector = '',
): ComplianceRequirement[] {
  if (!archetype) return []
  return MASTER_COMPLIANCE_MATRIX.filter(
    r =>
      r.applicableArchetypes.includes(archetype) &&
      appliesTo(r.applicableCountries, country) &&
      appliesTo(r.applicableSectors, sector) &&
      appliesTo(r.applicableSubsectors ?? ['ALL'], subsector),
  )
}

export function requirementsByCategory(
  reqs: ComplianceRequirement[],
): { category: DataRoomCategory; items: ComplianceRequirement[] }[] {
  return CATEGORY_ORDER.map(category => ({
    category,
    items: reqs.filter(r => r.category === category),
  })).filter(g => g.items.length > 0)
}

// ----------------------------------------------------------------------------
// Status helpers
// ----------------------------------------------------------------------------

export const STATUS_META: Record<DataRoomStatus, { label: string; cls: string; dot: string }> = {
  missing: { label: 'Missing', cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  uploaded: { label: 'Uploaded', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  verified: { label: 'Assessor Verified', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  flagged: { label: 'Flagged for Correction', cls: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-600' },
  not_available: { label: 'Does not exist', cls: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-500' },
}

export const PRIORITY_META: Record<Priority, string> = {
  Critical: 'bg-rose-100 text-rose-700',
  High: 'bg-amber-100 text-amber-700',
  Moderate: 'bg-slate-100 text-slate-600',
  Low: 'bg-slate-100 text-slate-500',
}

export function statusOf(item: DataRoomItem | undefined): DataRoomStatus {
  return item?.status ?? 'missing'
}

export interface DataRoomProgress {
  total: number
  provided: number // uploaded + verified
  verified: number
  flagged: number
  missing: number
  notAvailable: number // declared not to exist (a recorded gap, not a provided document)
  percent: number // completion: provided / total
  verifiedPercent: number
}

export function computeProgress(
  reqs: ComplianceRequirement[],
  items: Record<string, DataRoomItem>,
): DataRoomProgress {
  const total = reqs.length
  let verified = 0
  let provided = 0
  let flagged = 0
  let notAvailable = 0
  for (const r of reqs) {
    const s = statusOf(items[r.id])
    if (s === 'verified') {
      verified++
      provided++
    } else if (s === 'uploaded') {
      provided++
    } else if (s === 'flagged') {
      flagged++
    } else if (s === 'not_available') {
      notAvailable++
    }
  }
  const missing = total - provided - flagged - notAvailable
  return {
    total,
    provided,
    verified,
    flagged,
    missing,
    notAvailable,
    percent: total ? Math.round((provided / total) * 100) : 0,
    verifiedPercent: total ? Math.round((verified / total) * 100) : 0,
  }
}

// The workspace earns the "CRAFT Verified Data Room" badge once every Critical
// AND High requirement has been verified by an assessor (and at least one such
// requirement exists). Moderate/Low items do not gate the badge.
export function isVerifiedDataRoom(
  reqs: ComplianceRequirement[],
  items: Record<string, DataRoomItem>,
): boolean {
  const gating = reqs.filter(r => r.priority === 'Critical' || r.priority === 'High')
  if (gating.length === 0) return false
  return gating.every(r => statusOf(items[r.id]) === 'verified')
}

// ----------------------------------------------------------------------------
// Demo seed - illustrative spread of statuses; live workspaces start empty.
// Static timestamps keep the module SSR-safe (no Date at module scope).
// ----------------------------------------------------------------------------

const SEED_PLAN: Record<string, { status: DataRoomStatus; type?: EvidenceType; note?: string }> = {
  'UNI-FIN-01': { status: 'verified', type: 'upload' },
  'UNI-FIN-02': { status: 'flagged', type: 'upload', note: 'Tax clearance certificate is expired. Please upload the current-year certificate.' },
  'UNI-LEG-01': { status: 'verified', type: 'upload' },
  'UNI-HR-02': { status: 'uploaded', type: 'external_link' },
  'PS-LEG-01': { status: 'verified', type: 'upload' },
  'PS-LEG-02': { status: 'verified', type: 'upload' },
  'PS-LEG-03': { status: 'uploaded', type: 'upload' },
  'PS-FIN-01': { status: 'uploaded', type: 'external_link' },
  'PS-SEC-FINTECH': { status: 'verified', type: 'upload' },
  'PS-SUB-LENDING': { status: 'uploaded', type: 'upload' },
  'PS-NG-NDPR': { status: 'uploaded', type: 'upload' },
}

export function seedDataRoom(
  isDemo: boolean,
  reqs: ComplianceRequirement[],
): Record<string, DataRoomItem> {
  if (!isDemo) return {}
  const out: Record<string, DataRoomItem> = {}
  for (const r of reqs) {
    const plan = SEED_PLAN[r.id]
    if (!plan) continue
    out[r.id] = {
      requirementId: r.id,
      documentName: r.documentName,
      evidenceType: plan.type,
      fileName: plan.type === 'upload' ? `${r.id.toLowerCase()}.pdf` : undefined,
      fileUrl: plan.type === 'external_link' ? 'https://drive.example.org/d/craft-demo' : undefined,
      status: plan.status,
      assessorNote: plan.note,
      verifiedBy: plan.status === 'verified' ? 'a.okeke@craft.demo' : undefined,
      updatedAt: '2026-05-28',
    }
  }
  return out
}

// ----------------------------------------------------------------------------
// FEATURE 1 - Jurisdictional injection into the Data Room
// ----------------------------------------------------------------------------
// Turns the statutory requirements triggered by the selected jurisdictions +
// regulatory sector into Data-Room ComplianceRequirement rows, so they flow
// through the same upload / verify / progress machinery as every other document.
// Each becomes a required disclosure in a dedicated "Statutory & Regulatory"
// category. Selecting jurisdictions therefore dynamically injects new documents
// into the checklist with zero UI changes per jurisdiction.
export function injectedStatutoryRequirements(
  jurisdictions: JurisdictionId[],
  regSector: SectorArchetype | '',
): ComplianceRequirement[] {
  if (!jurisdictions.length || !regSector) return []
  const ctx = resolveRegulatoryContext(jurisdictions, regSector)
  return ctx.requirements.map(r => {
    const p = pillar(jurisdictions.find(j => (pillar(j)?.requirements ?? []).includes(r)) ?? jurisdictions[0])
    return {
      id: `STAT-${r.code}`,
      category: 'Statutory & Regulatory' as DataRoomCategory,
      documentName: `${r.authority}: ${r.requirement}`,
      description: `${r.citation}${p ? ` · ${p.name}` : ''}`,
      priority: r.priority as Priority,
      applicableArchetypes: ['Public', 'Civil Society', 'Private'] as Archetype[],
      applicableCountries: ['ALL'],
      applicableSectors: ['ALL'],
    }
  })
}

// ----------------------------------------------------------------------------
// Desk review helpers (CRAFT Capacity Assessment)
// ----------------------------------------------------------------------------

/** Documents approved this many days or fewer before the review date are flagged as possibly written for the review. */
export const RECENT_APPROVAL_DAYS = 90

/** True when a document was approved within RECENT_APPROVAL_DAYS before the review date (or after it). */
export function approvedForReview(approvedOn: string | undefined, reviewDate: string, days = RECENT_APPROVAL_DAYS): boolean {
  if (!approvedOn || !reviewDate) return false
  const gap = (Date.parse(reviewDate) - Date.parse(approvedOn)) / 86_400_000
  return Number.isFinite(gap) && gap <= days
}

/** The desk review documents that are evidence for a Capacity Assessment domain. */
export function documentsForDomain(reqs: ComplianceRequirement[], moduleId: string, domainId: string): ComplianceRequirement[] {
  const gov = moduleId === 'national' || moduleId === 'state' || moduleId === 'local'
  const key = gov ? domainId.replace(/^[a-z]+-/, '') : domainId
  return reqs.filter((r) => (gov ? r.cca?.government : r.cca?.community)?.includes(key))
}

const csvCell = (v: string | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`

/** The evidence request list as CSV: one row per document with status, custodian, due date and notes. */
export function requestListCsv(reqs: ComplianceRequirement[], items: Record<string, DataRoomItem>): string {
  const head = ['ID', 'Category', 'Document', 'Priority', 'Status', 'Custodian', 'Due date', 'Approved on', 'Evidence of use', 'Reason it does not exist', 'Assessor note']
  const rows = reqs.map((r) => {
    const it = items[r.id]
    return [r.id, r.category, r.documentName, r.priority, STATUS_META[statusOf(it)].label, it?.custodian, it?.dueDate, it?.approvedOn, it?.evidenceOfUse, it?.notAvailableReason, it?.assessorNote]
  })
  return [head, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

/** ISO-2 code for a country stored by name on an organisation ('' if unknown). */
export function countryCode(nameOrCode: string): string {
  const c = COUNTRIES.find((x) => x.code === nameOrCode || x.name.toLowerCase() === nameOrCode.toLowerCase())
  return c?.code ?? ''
}
