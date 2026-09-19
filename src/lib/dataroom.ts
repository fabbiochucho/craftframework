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
  resolveRegulatoryContext, JurisdictionId, SectorArchetype, pillar,
} from './regulatory-context'

export type EvidenceType = 'upload' | 'external_link'

// The lifecycle of a single Data Room requirement.
export type DataRoomStatus = 'missing' | 'uploaded' | 'verified' | 'flagged'

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
}

// ----------------------------------------------------------------------------
// Reference data - Pan-African countries & per-archetype sectors
// ----------------------------------------------------------------------------

export interface Country {
  code: string
  name: string
  flag: string
}

export const COUNTRIES: Country[] = [
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮' },
]

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
  'Civil Society': ['NGO', 'Cooperative', 'Foundation', 'Faith-Based', 'Research Institute'],
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
    description: 'Approval from the national medicines authority and ethics clearance for any trials.',
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
  for (const r of reqs) {
    const s = statusOf(items[r.id])
    if (s === 'verified') {
      verified++
      provided++
    } else if (s === 'uploaded') {
      provided++
    } else if (s === 'flagged') {
      flagged++
    }
  }
  const missing = total - provided - flagged
  return {
    total,
    provided,
    verified,
    flagged,
    missing,
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
