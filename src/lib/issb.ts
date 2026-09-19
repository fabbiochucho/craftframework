// ============================================================================
// CRAFT (ICARF v4.0) - ISSB S1/S2, CSRD & Sustainability Disclosure Engine
// ----------------------------------------------------------------------------
// Structures sustainability disclosure around the 4 TCFD-aligned pillars, and
// accommodates BOTH reporting lenses:
//   • ISSB S1/S2 (IFRS Sustainability) - Single Materiality (financial)
//   • EU CSRD / ESRS                    - Double Materiality (impact + financial)
//
// Includes the climate-scenario financial-impact model (1.5°C / 2°C / >3°C) for
// the Recharts visualizer, and the Scope 1/2/3 emissions model with the red-flag
// logic mandated by ISSB S2 / CSRD for high-impact sectors.
//
// Pure data + helpers, SSR-safe (no live Date at module scope).
// ============================================================================

export type MaterialityLens = 'single' | 'double'

export const MATERIALITY_LABEL: Record<MaterialityLens, string> = {
  single: 'Single Materiality (ISSB S1/S2)',
  double: 'Double Materiality (EU CSRD / ESRS)',
}

// The 4 pillars (TCFD / ISSB-aligned).
export interface DisclosurePillar {
  key: 'governance' | 'strategy' | 'risk' | 'metrics'
  title: string
  standard: string
  description: string
  requirements: string[]
}

export const DISCLOSURE_PILLARS: DisclosurePillar[] = [
  {
    key: 'governance',
    title: 'Governance',
    standard: 'ISSB S1 §5-6 / ESRS 2 GOV',
    description: 'Board oversight of climate & sustainability-related risks and opportunities.',
    requirements: [
      'Board committee with explicit climate mandate',
      'Management roles & responsibilities for sustainability',
      'Integration of sustainability into remuneration',
    ],
  },
  {
    key: 'strategy',
    title: 'Strategy',
    standard: 'ISSB S2 §9-14 / ESRS E1',
    description: 'Climate scenario analysis and its effect on strategy and financial planning.',
    requirements: [
      'Climate scenario analysis (1.5°C, 2°C, >3°C)',
      'Transition plan toward net-zero',
      'Resilience of the business model under each scenario',
    ],
  },
  {
    key: 'risk',
    title: 'Risk Management',
    standard: 'ISSB S1 §24-26 / ESRS 2 IRO',
    description: 'Integration of ESG / climate risks into the Enterprise Risk Management (ERM) framework.',
    requirements: [
      'ESG risks mapped into the ERM risk register',
      'Processes to identify, assess and prioritise climate risks',
      'Integration with overall risk management',
    ],
  },
  {
    key: 'metrics',
    title: 'Metrics & Targets',
    standard: 'ISSB S2 §28-37 / ESRS E1-6',
    description: 'Scope 1, 2 and 3 GHG emissions, targets and cross-industry metrics.',
    requirements: [
      'Scope 1 (direct) emissions disclosed',
      'Scope 2 (indirect - purchased energy) emissions disclosed',
      'Scope 3 (value-chain) emissions disclosed',
      'Science-based emissions-reduction targets',
    ],
  },
]

// ----------------------------------------------------------------------------
// Climate scenario financial-impact model (Recharts visualizer input)
// ----------------------------------------------------------------------------

export type ScenarioKey = '1.5C' | '2C' | '3C+'

export interface ClimateScenario {
  key: ScenarioKey
  label: string
  narrative: string
  // Illustrative % impact on EBITDA under each scenario (negative = downside).
  physicalRiskPct: number
  transitionRiskPct: number
  opportunityPct: number
}

export const CLIMATE_SCENARIOS: ClimateScenario[] = [
  {
    key: '1.5C', label: '1.5°C (Paris-aligned)',
    narrative: 'Aggressive decarbonisation: high transition risk, low physical risk, strong green-market opportunity.',
    physicalRiskPct: -3, transitionRiskPct: -12, opportunityPct: 9,
  },
  {
    key: '2C', label: '2°C (Well-below 2°C)',
    narrative: 'Moderate, orderly transition with balanced physical and transition exposure.',
    physicalRiskPct: -6, transitionRiskPct: -7, opportunityPct: 5,
  },
  {
    key: '3C+', label: '>3°C (Hot house)',
    narrative: 'Failed transition: severe chronic & acute physical risk dominates the outlook.',
    physicalRiskPct: -18, transitionRiskPct: -2, opportunityPct: 1,
  },
]

// Net EBITDA impact per scenario, for the visualizer.
export function netScenarioImpact(s: ClimateScenario): number {
  return s.physicalRiskPct + s.transitionRiskPct + s.opportunityPct
}

// ----------------------------------------------------------------------------
// Scope 1/2/3 emissions + red-flag logic
// ----------------------------------------------------------------------------

export type EmissionState = 'tracked' | 'not_tracked' | 'not_applicable'

export interface ScopeEmissions {
  scope1?: number // tCO2e
  scope2?: number // tCO2e
  scope3State: EmissionState
  scope3?: number // tCO2e (when tracked)
}

// Sectors where Scope 3 value-chain disclosure is treated as mandatory under
// ISSB S2 / CSRD (value chain dominates the footprint).
export const HIGH_IMPACT_SECTORS = [
  'Oil & Gas',
  'Manufacturing',
  'Mining & Metals',
  'Agriculture',
  'Cement & Construction',
  'Transport & Logistics',
  'Utilities',
] as const

export type HighImpactSector = (typeof HIGH_IMPACT_SECTORS)[number]

export interface EmissionFlag {
  severity: 'amber' | 'none'
  message?: string
}

// Red-flag: Scope 3 "Not Tracked" in a high-impact sector → Amber warning.
export function scope3RedFlag(sector: string, emissions: ScopeEmissions): EmissionFlag {
  const isHighImpact = (HIGH_IMPACT_SECTORS as readonly string[]).includes(sector)
  if (isHighImpact && emissions.scope3State === 'not_tracked') {
    return {
      severity: 'amber',
      message: 'ISSB S2 / CSRD Gap: Scope 3 value chain disclosure is mandatory.',
    }
  }
  return { severity: 'none' }
}
