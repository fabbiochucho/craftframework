// ESG KPI calculator: thirteen common environmental, social and governance KPIs with their formulas, units and the
// boundary and method choices that make them comparable. Corrected where common versions mislead: incineration is
// not waste diversion, a women-to-employees ratio is a gender measure (not "diversity"), GHG intensity states its
// Scope 2 method, and LTIFR states its hours basis. Readiness figures, not assured data.
// Self-check: `node src/lib/esgKpis.test.ts`. Stored per tenant under `esg:kpis`.
import type { NarrativeBlock } from './narrative.ts'

export const ESG_KPIS_KEY = 'esg:kpis'
export type KpiInputs = Partial<Record<InputKey, number>> & { scope2Method?: 'location' | 'market'; ltifrBasis?: number }
export type InputKey =
  | 'scope1' | 'scope2' | 'revenue' | 'renewableEnergy' | 'totalEnergy' | 'waterWithdrawn' | 'output' | 'wasteTotal' | 'landfilled'
  | 'incinerated' | 'previousEmissions' | 'currentEmissions' | 'lostTimeInjuries' | 'hoursWorked' | 'leavers' | 'avgEmployees'
  | 'trainingHours' | 'employees' | 'women' | 'independentDirectors' | 'totalDirectors' | 'womenDirectors' | 'opsCovered' | 'opsTotal'
  | 'complianceTrained'

export const INPUT_LABEL: Record<InputKey, string> = {
  scope1: 'Scope 1 emissions (tCO2e)', scope2: 'Scope 2 emissions (tCO2e)', revenue: 'Revenue (millions, reporting currency)',
  renewableEnergy: 'Renewable energy used (MWh)', totalEnergy: 'Total energy used (MWh)', waterWithdrawn: 'Water withdrawn (m³)',
  output: 'Production output (units)', wasteTotal: 'Waste generated (t)', landfilled: 'Waste sent to landfill (t)',
  incinerated: 'Waste incinerated, with or without energy recovery (t)', previousEmissions: 'Previous-year emissions (tCO2e)',
  currentEmissions: 'Current-year emissions (tCO2e)', lostTimeInjuries: 'Lost-time injuries', hoursWorked: 'Hours worked',
  leavers: 'Employees who left in the period', avgEmployees: 'Average number of employees', trainingHours: 'Training hours',
  employees: 'Employees', women: 'Women employees', independentDirectors: 'Independent directors', totalDirectors: 'Total directors',
  womenDirectors: 'Women directors', opsCovered: 'Operations covered by ESG policies', opsTotal: 'Total operations',
  complianceTrained: 'Employees trained on compliance',
}

export interface EsgKpi {
  id: string; pillar: 'E' | 'S' | 'G'; name: string; formula: string; unit: string; note: string
  inputs: InputKey[]
  calc: (i: Required<Pick<KpiInputs, InputKey>> & KpiInputs) => number
  choices?: { scope2Method?: readonly ['location', 'market']; ltifrBasis?: readonly [1_000_000, 200_000] }
}

const pct = (a: number, b: number) => (a / b) * 100
export const ESG_KPIS: EsgKpi[] = [
  { id: 'ghg-intensity', pillar: 'E', name: 'GHG emissions intensity', formula: '(Scope 1 + Scope 2) ÷ revenue', unit: 'tCO2e per million revenue',
    inputs: ['scope1', 'scope2', 'revenue'], calc: (i) => (i.scope1 + i.scope2) / i.revenue, choices: { scope2Method: ['location', 'market'] },
    note: 'State whether Scope 2 is location-based or market-based. Revenue intensity falls with inflation and price changes even when emissions do not, so report absolute emissions too.' },
  { id: 'renewable-share', pillar: 'E', name: 'Renewable energy share', formula: 'Renewable energy used ÷ total energy used × 100', unit: '%',
    inputs: ['renewableEnergy', 'totalEnergy'], calc: (i) => pct(i.renewableEnergy, i.totalEnergy),
    note: 'Use the same boundary for both figures. Count purchased renewable electricity only with contracts or certificates you can show.' },
  { id: 'water-intensity', pillar: 'E', name: 'Water use intensity', formula: 'Water withdrawn ÷ production output', unit: 'm³ per unit',
    inputs: ['waterWithdrawn', 'output'], calc: (i) => i.waterWithdrawn / i.output,
    note: 'Say which sources are included (municipal, ground, surface) and flag sites in water-stressed areas.' },
  { id: 'waste-diversion', pillar: 'E', name: 'Waste diversion rate', formula: '(Waste generated − landfilled − incinerated) ÷ waste generated × 100', unit: '%',
    inputs: ['wasteTotal', 'landfilled', 'incinerated'], calc: (i) => pct(i.wasteTotal - i.landfilled - i.incinerated, i.wasteTotal),
    note: 'Only reuse, recycling and composting count as diverted. Incineration, with or without energy recovery, is disposal.' },
  { id: 'yoy-reduction', pillar: 'E', name: 'Year-on-year emissions reduction', formula: '(Previous − current) ÷ previous × 100', unit: '%',
    inputs: ['previousEmissions', 'currentEmissions'], calc: (i) => pct(i.previousEmissions - i.currentEmissions, i.previousEmissions),
    note: 'Positive means a reduction. Compare like with like: recalculate the base year after acquisitions, disposals or method changes.' },
  { id: 'ltifr', pillar: 'S', name: 'Lost Time Injury Frequency Rate (LTIFR)', formula: 'Lost-time injuries × basis ÷ hours worked', unit: 'per basis hours',
    inputs: ['lostTimeInjuries', 'hoursWorked'], calc: (i) => (i.lostTimeInjuries * (i.ltifrBasis ?? 1_000_000)) / i.hoursWorked,
    choices: { ltifrBasis: [1_000_000, 200_000] },
    note: 'State the basis: per 1,000,000 hours (common internationally) or per 200,000 hours (used by some regulators). Include contractors if they are in your boundary.' },
  { id: 'turnover', pillar: 'S', name: 'Employee turnover rate', formula: 'Leavers ÷ average employees × 100', unit: '%',
    inputs: ['leavers', 'avgEmployees'], calc: (i) => pct(i.leavers, i.avgEmployees),
    note: 'Say whether voluntary and involuntary leavers are combined, and how the average headcount is taken.' },
  { id: 'training-hours', pillar: 'S', name: 'Training hours per employee', formula: 'Total training hours ÷ employees', unit: 'hours',
    inputs: ['trainingHours', 'employees'], calc: (i) => i.trainingHours / i.employees,
    note: 'Use the same headcount basis as other people metrics, for example average headcount.' },
  { id: 'women-workforce', pillar: 'S', name: 'Women in the workforce', formula: 'Women employees ÷ employees × 100', unit: '%',
    inputs: ['women', 'employees'], calc: (i) => pct(i.women, i.employees),
    note: 'This is a gender measure, not a measure of diversity overall. Report it by level (board, management, staff) where you can.' },
  { id: 'board-independence', pillar: 'G', name: 'Board independence', formula: 'Independent directors ÷ total directors × 100', unit: '%',
    inputs: ['independentDirectors', 'totalDirectors'], calc: (i) => pct(i.independentDirectors, i.totalDirectors),
    note: 'Apply the independence test in your governance code and say which one it is.' },
  { id: 'women-board', pillar: 'G', name: 'Women on the board', formula: 'Women directors ÷ total directors × 100', unit: '%',
    inputs: ['womenDirectors', 'totalDirectors'], calc: (i) => pct(i.womenDirectors, i.totalDirectors),
    note: 'Count directors at the reporting date, and say so.' },
  { id: 'policy-coverage', pillar: 'G', name: 'ESG policy coverage', formula: 'Operations covered by ESG policies ÷ total operations × 100', unit: '%',
    inputs: ['opsCovered', 'opsTotal'], calc: (i) => pct(i.opsCovered, i.opsTotal),
    note: 'Define an "operation" (site, subsidiary, project) and count only policies that are approved and in force.' },
  { id: 'compliance-training', pillar: 'G', name: 'Compliance training coverage', formula: 'Employees trained on compliance ÷ employees × 100', unit: '%',
    inputs: ['complianceTrained', 'employees'], calc: (i) => pct(i.complianceTrained, i.employees),
    note: 'Count training completed in the period, with records you could show a validator.' },
]

const round1 = (x: number) => Math.round(x * 10) / 10

/** One KPI's value, rounded to one decimal; null when an input is missing or a denominator is zero. */
export function computeKpi(id: string, i: KpiInputs): number | null {
  const k = ESG_KPIS.find((x) => x.id === id)
  if (!k || !k.inputs.every((n) => typeof i[n] === 'number' && Number.isFinite(i[n]))) return null
  const v = k.calc(i as never)
  return Number.isFinite(v) ? round1(v) : null
}

export function computeAll(i: KpiInputs) {
  return ESG_KPIS.map((k) => ({ kpi: k, value: computeKpi(k.id, i) }))
}

/** Report section: the KPIs that have data, with formulas and the method choices made. */
export function esgKpiNarrativeBlocks(results: ReturnType<typeof computeAll>, i: Pick<KpiInputs, 'scope2Method' | 'ltifrBasis'>): NarrativeBlock[] {
  const done = results.filter((r) => r.value !== null)
  const unit = (r: (typeof done)[number]) => (r.kpi.id === 'ltifr' ? `per ${(i.ltifrBasis ?? 1_000_000).toLocaleString('en')} hours` : r.kpi.unit)
  return [
    { type: 'paragraph', text: 'Key ESG indicators calculated from the organisation\'s own data for the reporting period, with the formula used for each. They have not been independently assured.' },
    { type: 'table', headers: ['Indicator', 'Value', 'Formula'], rows: done.map((r) => [r.kpi.name, `${r.value} ${unit(r)}`, r.kpi.formula]) },
    { type: 'note', text: `Scope 2 emissions are ${i.scope2Method === 'location' ? 'location-based' : i.scope2Method === 'market' ? 'market-based' : 'reported without a stated method'}. Waste diversion counts reuse, recycling and composting only; incineration is treated as disposal.` },
  ]
}
