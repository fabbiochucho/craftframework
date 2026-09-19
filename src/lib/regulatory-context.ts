// ============================================================================
// CRAFT (ICARF v4.0) - Jurisdictional Context Engine & Global Regulatory Selector
// ----------------------------------------------------------------------------
// The "Regulatory Translator" at the heart of CRAFT v4.0. Given the set of
// jurisdictions an entity operates in (or targets for capital) plus its sector,
// this module resolves the exact statutory frameworks, prudential thresholds,
// data-room checklists and reporting obligations that apply - so a German DFI
// investing in a Nigerian bank can select both jurisdictions and see a unified
// CSRD + FRCN/NDPR + CBN prudential picture from one matrix.
//
// STRICT EMPIRICAL FIDELITY: statutory articles, regulatory thresholds and
// framework dimensions are hardcoded from the source instruments (CBN Prudential
// Guidelines, King IV, SOX, EU CSRD/ESRS, Basel III/IV, ISSB S1/S2, etc.). No
// generic placeholders.
//
// Pure data + helpers (no React, no live Date at module scope) so any page,
// loader or scheduled function can import it and stay SSR-safe.
// ============================================================================

// ----------------------------------------------------------------------------
// The 7 Regional Pillars
// ----------------------------------------------------------------------------

export type JurisdictionId =
  | 'NG' // Nigeria - CBN / SEC / FRCN
  | 'ZA' // South Africa - SARB / FSCA / JSE
  | 'US' // United States - Fed / SEC / PCAOB
  | 'EU' // European Union - ECB / ESMA / EBA
  | 'OHADA' // Francophone Africa - OHADA
  | 'GCC' // Middle East / GCC
  | 'ASIA' // Asia / Global Supply Chain

export type SectorArchetype =
  | 'bank_dfi' // Banks, Development Finance Institutions - triggers Basel/prudential
  | 'public_company' // Listed / public-interest entity - triggers governance codes, SOX, CSRD
  | 'private_sme' // Private company / SME
  | 'islamic_finance' // Sharia-compliant institution
  | 'informal' // Micro / informal cooperative

export const SECTOR_LABEL: Record<SectorArchetype, string> = {
  bank_dfi: 'Bank / DFI',
  public_company: 'Public / Listed Company',
  private_sme: 'Private Company / SME',
  islamic_finance: 'Islamic Finance Institution',
  informal: 'Micro / Informal Economy',
}

// A single statutory requirement, cited to its exact instrument.
export interface StatutoryRequirement {
  code: string
  authority: string
  // Exact statutory language / article reference (empirical fidelity).
  citation: string
  requirement: string
  // Which sectors this requirement is triggered by ('ALL' for any).
  sectors: (SectorArchetype | 'ALL')[]
  priority: 'Critical' | 'High' | 'Moderate'
}

export interface RegulatoryPillar {
  id: JurisdictionId
  name: string
  flag: string
  regulators: string[]
  // One-line description shown in the selector.
  summary: string
  // Hardcoded statutory checklist injected into the Data Room / Wizard.
  requirements: StatutoryRequirement[]
}

export const REGULATORY_PILLARS: RegulatoryPillar[] = [
  {
    id: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    regulators: ['CBN', 'SEC Nigeria', 'FRCN'],
    summary: 'CBN Prudential Guidelines, SEC Rules, FRCN / NCCG 2018 corporate governance.',
    requirements: [
      {
        code: 'NG-CBN-CAR', authority: 'CBN', priority: 'Critical', sectors: ['bank_dfi', 'islamic_finance'],
        citation: 'CBN Prudential Guidelines 2010 §4.1; Basel III as domesticated by CBN',
        requirement: 'Maintain Capital Adequacy Ratio (CAR) ≥ regulatory minimum (10% national, 15% systemically important banks).',
      },
      {
        code: 'NG-CBN-LCR', authority: 'CBN', priority: 'Critical', sectors: ['bank_dfi', 'islamic_finance'],
        citation: 'CBN Basel III Liquidity Framework',
        requirement: 'Maintain Liquidity Coverage Ratio (LCR) ≥ 100% of net cash outflows over 30 days.',
      },
      {
        code: 'NG-CBN-AML', authority: 'CBN', priority: 'Critical', sectors: ['bank_dfi', 'islamic_finance', 'public_company'],
        citation: 'CBN AML/CFT Regulations 2013; Money Laundering (Prevention & Prohibition) Act 2022',
        requirement: 'Operate a risk-based AML/CFT programme with KYC, suspicious-transaction reporting to the NFIU.',
      },
      {
        code: 'NG-SEC-RULES', authority: 'SEC Nigeria', priority: 'High', sectors: ['public_company'],
        citation: 'Investments and Securities Act 2007; SEC Rules & Regulations',
        requirement: 'File periodic disclosures and comply with SEC Rules on issuers and market participants.',
      },
      {
        code: 'NG-FRCN-NCCG', authority: 'FRCN', priority: 'High', sectors: ['public_company', 'bank_dfi'],
        citation: 'Nigerian Code of Corporate Governance (NCCG) 2018; FRC of Nigeria Act 2011',
        requirement: 'Apply the NCCG 2018 principles ("Apply and Explain") and pay annual FRCN dues.',
      },
      {
        code: 'NG-NDPR', authority: 'NDPC', priority: 'High', sectors: ['ALL'],
        citation: 'Nigeria Data Protection Act 2023; NDPR 2019',
        requirement: 'Register as a data controller and report personal-data breaches within statutory windows.',
      },
    ],
  },
  {
    id: 'ZA',
    name: 'South Africa',
    flag: '🇿🇦',
    regulators: ['SARB', 'FSCA', 'JSE'],
    summary: 'King IV "Apply and Explain", SARB Basel III/IV, FSCA market conduct.',
    requirements: [
      {
        code: 'ZA-KINGIV', authority: 'IoDSA / JSE', priority: 'High', sectors: ['public_company', 'bank_dfi'],
        citation: 'King IV Report on Corporate Governance™ (2016) - "Apply and Explain"',
        requirement: 'Apply the 17 King IV principles and explain application in the integrated report.',
      },
      {
        code: 'ZA-SARB-CAR', authority: 'SARB Prudential Authority', priority: 'Critical', sectors: ['bank_dfi', 'islamic_finance'],
        citation: 'Banks Act 94 of 1990; SARB Basel III/IV capital regulations',
        requirement: 'Maintain minimum CAR of 15% (incl. buffers) per SARB Prudential Authority directives.',
      },
      {
        code: 'ZA-FSCA', authority: 'FSCA', priority: 'High', sectors: ['public_company', 'bank_dfi', 'private_sme'],
        citation: 'Financial Sector Regulation Act 9 of 2017 (Twin Peaks); FAIS Act',
        requirement: 'Comply with FSCA market-conduct standards and treating-customers-fairly outcomes.',
      },
      {
        code: 'ZA-POPIA', authority: 'Information Regulator', priority: 'High', sectors: ['ALL'],
        citation: 'Protection of Personal Information Act 4 of 2013 (POPIA)',
        requirement: 'Process personal information lawfully and notify the Regulator of security compromises.',
      },
    ],
  },
  {
    id: 'US',
    name: 'United States',
    flag: '🇺🇸',
    regulators: ['Federal Reserve', 'SEC', 'PCAOB'],
    summary: 'US GAAP, SOX §302/§404 (ICFR), SEC Climate Disclosure, Dodd-Frank, FCPA, OFAC.',
    requirements: [
      {
        code: 'US-SOX-302', authority: 'SEC', priority: 'Critical', sectors: ['public_company'],
        citation: 'Sarbanes-Oxley Act 2002 §302',
        requirement: 'CEO/CFO certification of the accuracy of periodic financial reports.',
      },
      {
        code: 'US-SOX-404', authority: 'SEC / PCAOB', priority: 'Critical', sectors: ['public_company'],
        citation: 'Sarbanes-Oxley Act 2002 §404',
        requirement: "Management's assessment of Internal Control over Financial Reporting (ICFR) + auditor attestation.",
      },
      {
        code: 'US-SEC-CLIMATE', authority: 'SEC', priority: 'High', sectors: ['public_company'],
        citation: 'SEC Climate-Related Disclosures Rule (17 CFR Parts 210, 229, 232, 239, 249)',
        requirement: 'Disclose material climate risks, governance and (where material) GHG emissions.',
      },
      {
        code: 'US-FCPA', authority: 'DOJ / SEC', priority: 'High', sectors: ['ALL'],
        citation: 'Foreign Corrupt Practices Act 1977 (15 U.S.C. §78dd-1)',
        requirement: 'Maintain anti-bribery controls and accurate books & records.',
      },
      {
        code: 'US-OFAC', authority: 'OFAC (US Treasury)', priority: 'High', sectors: ['bank_dfi', 'public_company', 'private_sme'],
        citation: 'OFAC Sanctions Programs (31 CFR Chapter V)',
        requirement: 'Screen counterparties against OFAC SDN and sanctions lists.',
      },
    ],
  },
  {
    id: 'EU',
    name: 'European Union',
    flag: '🇪🇺',
    regulators: ['ECB', 'ESMA', 'EBA'],
    summary: 'CSRD/ESRS (Double Materiality), MiFID II, DORA, GDPR, EU AI Act.',
    requirements: [
      {
        code: 'EU-CSRD', authority: 'European Commission / EFRAG', priority: 'Critical', sectors: ['public_company', 'bank_dfi'],
        citation: 'Directive (EU) 2022/2464 (CSRD); ESRS (Delegated Reg. (EU) 2023/2772)',
        requirement: 'Report under ESRS applying Double Materiality (impact + financial materiality).',
      },
      {
        code: 'EU-DORA', authority: 'ESAs (EBA/ESMA/EIOPA)', priority: 'High', sectors: ['bank_dfi', 'islamic_finance'],
        citation: 'Regulation (EU) 2022/2554 (Digital Operational Resilience Act)',
        requirement: 'Maintain ICT risk management, incident reporting and third-party oversight.',
      },
      {
        code: 'EU-MIFID2', authority: 'ESMA', priority: 'High', sectors: ['bank_dfi', 'public_company'],
        citation: 'Directive 2014/65/EU (MiFID II)',
        requirement: 'Comply with investor-protection, best-execution and transaction-reporting rules.',
      },
      {
        code: 'EU-GDPR', authority: 'EDPB / DPAs', priority: 'Critical', sectors: ['ALL'],
        citation: 'Regulation (EU) 2016/679 (GDPR), Art. 33',
        requirement: 'Report personal-data breaches to the supervisory authority within 72 hours.',
      },
      {
        code: 'EU-AIACT', authority: 'European Commission', priority: 'High', sectors: ['ALL'],
        citation: 'Regulation (EU) 2024/1689 (EU AI Act) - risk classification',
        requirement: 'Classify AI systems (unacceptable/high/limited/minimal) and meet the corresponding obligations.',
      },
    ],
  },
  {
    id: 'OHADA',
    name: 'Francophone Africa (OHADA)',
    flag: '🌍',
    regulators: ['OHADA', 'BCEAO / BEAC'],
    summary: 'SYSCOHADA accounting standards and regional tax frameworks.',
    requirements: [
      {
        code: 'OHADA-SYSCOHADA', authority: 'OHADA', priority: 'Critical', sectors: ['ALL'],
        citation: 'Acte uniforme relatif au droit comptable et à l\'information financière (SYSCOHADA révisé, 2017)',
        requirement: 'Prepare financial statements under SYSCOHADA (Système normal or minimal de trésorerie).',
      },
      {
        code: 'OHADA-CORP', authority: 'OHADA', priority: 'High', sectors: ['public_company', 'private_sme'],
        citation: 'Acte uniforme relatif au droit des sociétés commerciales et du GIE',
        requirement: 'Comply with OHADA company-law governance and annual filing requirements.',
      },
    ],
  },
  {
    id: 'GCC',
    name: 'Middle East / GCC',
    flag: '🕌',
    regulators: ['Central Bank (GCC)', 'Sharia Boards', 'Zakat Authority (ZATCA)'],
    summary: 'Sharia governance, Zakat calculations, nationalization quotas (Nitaqat / Emiratisation).',
    requirements: [
      {
        code: 'GCC-SHARIA', authority: 'AAOIFI / Sharia Board', priority: 'Critical', sectors: ['islamic_finance', 'bank_dfi'],
        citation: 'AAOIFI Governance Standard No. 1-6 (Sharia Supervisory Board)',
        requirement: 'Establish a Sharia Supervisory Board and obtain Sharia compliance certification.',
      },
      {
        code: 'GCC-ZAKAT', authority: 'ZATCA (KSA) / equivalent', priority: 'High', sectors: ['islamic_finance', 'public_company', 'private_sme'],
        citation: 'Zakat regulations (religious tax) - GCC national authorities',
        requirement: 'Compute and remit Zakat on the applicable Zakat base by the statutory deadline.',
      },
      {
        code: 'GCC-NATIONAL', authority: 'MoHRSD (KSA) / MoHRE (UAE)', priority: 'Moderate', sectors: ['ALL'],
        citation: 'Nitaqat (Saudization) / Emiratisation nationalization quotas',
        requirement: 'Meet workforce nationalization quotas for the entity size and sector band.',
      },
    ],
  },
  {
    id: 'ASIA',
    name: 'Asia / Global Supply Chain',
    flag: '🌏',
    regulators: ['National Regulators', 'European Works Councils', 'UK Authorities'],
    summary: 'Family-conglomerate governance, Works Councils (Codetermination), CSDDD, UK Bribery / Modern Slavery.',
    requirements: [
      {
        code: 'ASIA-CSDDD', authority: 'European Commission', priority: 'High', sectors: ['public_company', 'private_sme'],
        citation: 'Directive (EU) 2024/1760 (Corporate Sustainability Due Diligence - CSDDD)',
        requirement: 'Conduct human-rights and environmental due diligence across the value chain.',
      },
      {
        code: 'ASIA-UKBRIBERY', authority: 'UK SFO', priority: 'High', sectors: ['ALL'],
        citation: 'UK Bribery Act 2010, s.7 (failure to prevent bribery)',
        requirement: 'Maintain "adequate procedures" to prevent bribery.',
      },
      {
        code: 'ASIA-MODERNSLAVERY', authority: 'UK Home Office', priority: 'Moderate', sectors: ['public_company', 'private_sme'],
        citation: 'UK Modern Slavery Act 2015, s.54',
        requirement: 'Publish an annual modern-slavery & human-trafficking statement.',
      },
      {
        code: 'ASIA-CODETERMINATION', authority: 'EU / National', priority: 'Moderate', sectors: ['public_company'],
        citation: 'Directive 2009/38/EC (European Works Councils); national codetermination law',
        requirement: 'Establish employee information & consultation bodies (Works Councils).',
      },
    ],
  },
]

export function pillar(id: JurisdictionId): RegulatoryPillar | undefined {
  return REGULATORY_PILLARS.find(p => p.id === id)
}

// ----------------------------------------------------------------------------
// FEATURE 3 - Basel III/IV prudential tracker + SOX + accounting standards
// ----------------------------------------------------------------------------

export type AccountingStandard = 'ifrs_smes' | 'ifrs_full' | 'us_gaap' | 'syscohada'

export interface AccountingStandardMeta {
  id: AccountingStandard
  label: string
  authority: string
  // Advanced disclosure checklists this standard unlocks (exact statutory names).
  unlocks: string[]
}

export const ACCOUNTING_STANDARDS: AccountingStandardMeta[] = [
  {
    id: 'ifrs_smes', label: 'IFRS for SMEs', authority: 'IASB',
    unlocks: ['Simplified disclosure regime', 'Section 11/12 Financial Instruments'],
  },
  {
    id: 'ifrs_full', label: 'Full IFRS', authority: 'IASB',
    unlocks: ['IFRS 9 Expected Credit Losses', 'IFRS 15 Revenue', 'IFRS 16 Leases', 'IFRS 17 Insurance Contracts'],
  },
  {
    id: 'us_gaap', label: 'US GAAP', authority: 'FASB',
    unlocks: ['ASC 326 CECL (Current Expected Credit Losses)', 'ASC 606 Revenue', 'ASC 842 Leases'],
  },
  {
    id: 'syscohada', label: 'OHADA SYSCOHADA', authority: 'OHADA',
    unlocks: ['Système normal', 'Système minimal de trésorerie'],
  },
]

// Basel prudential thresholds keyed to the regulator that supervises the entity.
export interface PrudentialThresholds {
  authority: string
  minCAR: number // Capital Adequacy Ratio, %
  minLCR: number // Liquidity Coverage Ratio, %
  minLeverage: number // Leverage Ratio, %
}

export const PRUDENTIAL_THRESHOLDS: Record<JurisdictionId, PrudentialThresholds | null> = {
  NG: { authority: 'CBN', minCAR: 10, minLCR: 100, minLeverage: 3 },
  ZA: { authority: 'SARB', minCAR: 15, minLCR: 100, minLeverage: 4 },
  US: { authority: 'Federal Reserve', minCAR: 10.5, minLCR: 100, minLeverage: 5 },
  EU: { authority: 'ECB / EBA', minCAR: 10.5, minLCR: 100, minLeverage: 3 },
  OHADA: { authority: 'BCEAO / BEAC', minCAR: 11.25, minLCR: 100, minLeverage: 3 },
  GCC: { authority: 'GCC Central Bank', minCAR: 12.5, minLCR: 100, minLeverage: 3 },
  ASIA: null,
}

export interface PrudentialInputs {
  car?: number
  lcr?: number
  leverage?: number
}

export type PrudentialSeverity = 'compliant' | 'warning' | 'breach' | 'not_entered'

export interface PrudentialFinding {
  metric: 'CAR' | 'LCR' | 'Leverage Ratio'
  value?: number
  threshold: number
  severity: PrudentialSeverity
  message: string
}

// Evaluate prudential inputs against the strictest applicable threshold across
// the selected jurisdictions. A value below the minimum is a Critical breach; a
// value within 1 percentage point of the minimum is an amber warning.
export function evaluatePrudential(
  jurisdictions: JurisdictionId[],
  inputs: PrudentialInputs,
): PrudentialFinding[] {
  const applicable = jurisdictions
    .map(j => PRUDENTIAL_THRESHOLDS[j])
    .filter((t): t is PrudentialThresholds => !!t)
  if (applicable.length === 0) return []

  const strictest = {
    minCAR: Math.max(...applicable.map(t => t.minCAR)),
    minLCR: Math.max(...applicable.map(t => t.minLCR)),
    minLeverage: Math.max(...applicable.map(t => t.minLeverage)),
  }

  const build = (
    metric: PrudentialFinding['metric'],
    value: number | undefined,
    threshold: number,
  ): PrudentialFinding => {
    if (value == null || Number.isNaN(value)) {
      return { metric, value, threshold, severity: 'not_entered', message: `${metric} not entered.` }
    }
    if (value < threshold) {
      return {
        metric, value, threshold, severity: 'breach',
        message: `Prudential Breach: ${metric} of ${value}% is below the ${threshold}% regulatory threshold.`,
      }
    }
    if (value < threshold + 1) {
      return {
        metric, value, threshold, severity: 'warning',
        message: `${metric} of ${value}% is within 1pp of the ${threshold}% minimum - monitor closely.`,
      }
    }
    return { metric, value, threshold, severity: 'compliant', message: `${metric} of ${value}% meets the ${threshold}% minimum.` }
  }

  return [
    build('CAR', inputs.car, strictest.minCAR),
    build('LCR', inputs.lcr, strictest.minLCR),
    build('Leverage Ratio', inputs.leverage, strictest.minLeverage),
  ]
}

// SOX §302/§404 internal-controls checklist (US public companies).
export interface SoxControlItem {
  section: '302' | '404'
  title: string
  citation: string
}

export const SOX_CHECKLIST: SoxControlItem[] = [
  { section: '302', title: 'CEO certification of periodic report accuracy', citation: 'SOX §302(a)(1)' },
  { section: '302', title: 'CFO certification of periodic report accuracy', citation: 'SOX §302(a)(1)' },
  { section: '302', title: 'Disclosure controls & procedures evaluated', citation: 'SOX §302(a)(4)' },
  { section: '404', title: "Management's assessment of ICFR effectiveness", citation: 'SOX §404(a)' },
  { section: '404', title: 'Auditor attestation on ICFR', citation: 'SOX §404(b)' },
  { section: '404', title: 'Material weaknesses identified & remediated', citation: 'SOX §404 / PCAOB AS 2201' },
]

// ----------------------------------------------------------------------------
// FEATURE 4 - Islamic Finance & Informal Economy archetypes
// ----------------------------------------------------------------------------

export interface ShariaPrinciple {
  key: string
  name: string
  arabic: string
  description: string
}

export const SHARIA_PRINCIPLES: ShariaPrinciple[] = [
  { key: 'riba', name: 'Prohibition of Riba', arabic: 'الربا', description: 'No interest / usury on loans or deposits.' },
  { key: 'gharar', name: 'Prohibition of Gharar', arabic: 'الغرر', description: 'No excessive uncertainty or ambiguity in contracts.' },
  { key: 'maysir', name: 'Prohibition of Maysir', arabic: 'الميسر', description: 'No speculation / gambling.' },
  { key: 'haram', name: 'Halal Activity', arabic: 'حلال', description: 'No financing of prohibited (haram) sectors.' },
]

export interface IslamicInstrument {
  key: string
  name: string
  type: 'bond' | 'insurance' | 'financing'
  description: string
}

export const ISLAMIC_INSTRUMENTS: IslamicInstrument[] = [
  { key: 'sukuk', name: 'Sukuk', type: 'bond', description: 'Asset-backed Islamic bonds (no interest coupon).' },
  { key: 'takaful', name: 'Takaful', type: 'insurance', description: 'Cooperative Islamic insurance (risk-sharing).' },
  { key: 'murabaha', name: 'Murabaha', type: 'financing', description: 'Cost-plus financing with disclosed margin.' },
  { key: 'ijara', name: 'Ijara', type: 'financing', description: 'Islamic leasing structure.' },
]

// Simplified ROCA / CPI dimensions for the mobile-first, offline-capable,
// vernacular informal-economy track (cooperatives, street distributors,
// unregistered agricultural collectives) seeking micro-finance / DFI grants.
export interface InformalDimension {
  key: string
  label: string
  vernacularHint: string // plain-language prompt (localised in the UI layer)
}

export const INFORMAL_ROCA_DIMENSIONS: InformalDimension[] = [
  { key: 'records', label: 'Record Keeping', vernacularHint: 'Do you write down money in and money out?' },
  { key: 'savings', label: 'Group Savings', vernacularHint: 'Does the group save money together every week/month?' },
  { key: 'leadership', label: 'Leadership & Trust', vernacularHint: 'Are leaders chosen by the members and trusted?' },
  { key: 'membership', label: 'Membership Register', vernacularHint: 'Is there a list of all members?' },
  { key: 'repayment', label: 'Repayment History', vernacularHint: 'Do members pay back loans on time?' },
]

// ----------------------------------------------------------------------------
// FEATURE 8 - G20 6-dimension AI Readiness Radar (all tracks)
// ----------------------------------------------------------------------------

export interface G20Dimension {
  key: string
  label: string
  description: string
}

export const G20_AI_READINESS_DIMENSIONS: G20Dimension[] = [
  { key: 'infrastructure', label: 'Infrastructure', description: 'Compute, connectivity and data infrastructure.' },
  { key: 'workforce', label: 'Workforce & Skills', description: 'AI talent pipeline and digital-skills capacity.' },
  { key: 'policy', label: 'Policy & Regulation', description: 'National AI strategy, laws and standards.' },
  { key: 'innovation', label: 'Innovation Ecosystem', description: 'R&D, start-ups and public-private partnerships.' },
  { key: 'ethics', label: 'Ethics & Trust', description: 'Responsible-AI principles, transparency and accountability.' },
  { key: 'adoption', label: 'Adoption & Data', description: 'Sectoral AI adoption and data-governance maturity.' },
]

// ----------------------------------------------------------------------------
// Resolver - the dynamic injection engine
// ----------------------------------------------------------------------------

export interface ResolvedContext {
  jurisdictions: JurisdictionId[]
  sector: SectorArchetype
  pillars: RegulatoryPillar[]
  // Statutory requirements triggered by the sector across selected jurisdictions.
  requirements: StatutoryRequirement[]
  // Whether the prudential (Basel) tracker should be shown.
  showPrudential: boolean
  showSox: boolean
  showSharia: boolean
  showInformal: boolean
}

function sectorMatches(reqSectors: (SectorArchetype | 'ALL')[], sector: SectorArchetype): boolean {
  return reqSectors.includes('ALL') || reqSectors.includes(sector)
}

export function resolveRegulatoryContext(
  jurisdictions: JurisdictionId[],
  sector: SectorArchetype,
): ResolvedContext {
  const pillars = jurisdictions.map(pillar).filter((p): p is RegulatoryPillar => !!p)
  const requirements = pillars.flatMap(p => p.requirements.filter(r => sectorMatches(r.sectors, sector)))
  return {
    jurisdictions,
    sector,
    pillars,
    requirements,
    showPrudential: (sector === 'bank_dfi' || sector === 'islamic_finance') &&
      jurisdictions.some(j => PRUDENTIAL_THRESHOLDS[j] != null),
    showSox: sector === 'public_company' && jurisdictions.includes('US'),
    showSharia: sector === 'islamic_finance' || jurisdictions.includes('GCC'),
    showInformal: sector === 'informal',
  }
}

// Priority ordering used by the UI (Critical first).
export const PRIORITY_RANK: Record<StatutoryRequirement['priority'], number> = {
  Critical: 0,
  High: 1,
  Moderate: 2,
}
