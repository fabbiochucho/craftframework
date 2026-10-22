// ESRS double materiality assessment (DMA): list the sustainability matters, assess impact materiality
// (severity, likelihood) and financial materiality (magnitude, likelihood), decide what is material, and report
// the process (IRO-1) and the outcome (material impacts, risks and opportunities; disclosures covered, IRO-2).
// Follows the revised ESRS (Delegated Regulation (EU) 2026/1563): the topic list is illustrative, a matter may be
// concluded material or not top-down with a reason, and time horizons are optional. CRAFT shows readiness only.
// Self-check: `node src/lib/dma.test.ts`. Stored per tenant under `dma:assessment`.
import type { NarrativeBlock } from './narrative.ts'

export const DMA_KEY = 'dma:assessment'
export const ESRS_VERSION_NOTE = 'Revised ESRS, Commission Delegated Regulation (EU) 2026/1563 (mandatory from financial years starting on or after 1 January 2027; earlier use allowed).'

export type EsrsStandard = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'S1' | 'S2' | 'S3' | 'S4' | 'G1'
/** Illustrative topics and sub-topics (ESRS 1, AR 16). Organisations add their own matters. */
export const DMA_TOPICS: Array<{ standard: EsrsStandard; name: string; subTopics: string[] }> = [
  { standard: 'E1', name: 'Climate change', subTopics: ['Climate change adaptation', 'Climate change mitigation', 'Energy'] },
  { standard: 'E2', name: 'Pollution', subTopics: ['Pollution of air', 'Pollution of water', 'Pollution of soil', 'Pollution of living organisms and food resources', 'Substances of concern', 'Microplastics'] },
  { standard: 'E3', name: 'Water and marine resources', subTopics: ['Water', 'Marine resources'] },
  { standard: 'E4', name: 'Biodiversity and ecosystems', subTopics: ['Direct drivers of biodiversity loss', 'Impacts on the state of species', 'Impacts on the extent and condition of ecosystems', 'Impacts and dependencies on ecosystem services'] },
  { standard: 'E5', name: 'Resource use and circular economy', subTopics: ['Resource inflows', 'Resource outflows related to products and services', 'Waste'] },
  { standard: 'S1', name: 'Own workforce', subTopics: ['Working conditions', 'Equal treatment and opportunities for all', 'Other work-related rights'] },
  { standard: 'S2', name: 'Workers in the value chain', subTopics: ['Working conditions', 'Equal treatment and opportunities for all', 'Other work-related rights'] },
  { standard: 'S3', name: 'Affected communities', subTopics: ["Communities' economic, social and cultural rights", "Communities' civil and political rights", 'Rights of indigenous peoples'] },
  { standard: 'S4', name: 'Consumers and end-users', subTopics: ['Information-related impacts', 'Personal safety', 'Social inclusion'] },
  { standard: 'G1', name: 'Business conduct', subTopics: ['Corporate culture', 'Protection of whistle-blowers', 'Animal welfare', 'Political engagement and lobbying', 'Relationships with suppliers, including payment practices', 'Corruption and bribery'] },
]

export type Scale = 1 | 2 | 3 | 4 | 5
export type ValueChain = 'own' | 'upstream' | 'downstream'
export type Horizon = 'short' | 'medium' | 'long'
export type ImpactAssessment = {
  kind: 'actual' | 'potential'
  effect: 'negative' | 'positive'
  /** Human-rights impacts: severity takes precedence over likelihood (ESRS 1). */
  humanRights?: boolean
  scale: Scale
  scope: Scale
  /** How hard the harm is to remedy; negative impacts only. */
  irremediability?: Scale
  /** Potential impacts only. */
  likelihood?: Scale
  valueChain: ValueChain[]
  horizon?: Horizon
}
export type FinancialAssessment = {
  kind: 'risk' | 'opportunity'
  /** What triggers the risk or opportunity. */
  trigger: string
  magnitude: Scale
  likelihood: Scale
  horizon?: Horizon
  /** A FAIR scenario on the risk page that quantifies this risk. */
  fairScenarioId?: string
}
export type DmaMatter = {
  id: string
  /** The ESRS topical standard, or 'entity' for an entity-specific matter. */
  topic: EsrsStandard | 'entity'
  name: string
  source: 'esrs' | 'entity' | 'imported'
  /** A conclusion reached from the strategy and business model analysis, without scoring (needs a reason). */
  topDown?: { material: boolean; reason: string }
  impact?: ImpactAssessment
  financial?: FinancialAssessment
  notes?: string
}
export type DmaAssessment = {
  matters: DmaMatter[]
  thresholds: { impact: number; financial: number }
  thresholdReason: string
  stakeholders: string
  approvedBy: string
}

export const DEFAULT_THRESHOLDS = { impact: 3, financial: 3 }
export const esrsMatters = (): DmaMatter[] => DMA_TOPICS.map((t) => ({ id: t.standard, topic: t.standard, name: t.name, source: 'esrs' }))
export const emptyAssessment = (): DmaAssessment => ({ matters: [], thresholds: { ...DEFAULT_THRESHOLDS }, thresholdReason: '', stakeholders: '', approvedBy: '' })

const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Impact score on 1-5: severity for actual impacts; severity x likelihood / 5 for potential ones (except human rights). */
export function impactScore(i: ImpactAssessment | undefined): number | null {
  if (!i) return null
  const severity = mean(i.effect === 'negative' ? [i.scale, i.scope, i.irremediability ?? i.scale] : [i.scale, i.scope])
  if (i.kind === 'actual' || (i.humanRights && i.effect === 'negative')) return round1(severity)
  return round1((severity * (i.likelihood ?? 1)) / 5)
}

/** Financial score on 1-5: magnitude x likelihood / 5. */
export function financialScore(f: FinancialAssessment | undefined): number | null {
  return f ? round1((f.magnitude * f.likelihood) / 5) : null
}

/** Likelihood band from a FAIR scenario's chance of any loss in a year. */
export function likelihoodFromFair(pAny: number): Scale {
  return pAny >= 0.9 ? 5 : pAny >= 0.5 ? 4 : pAny >= 0.2 ? 3 : pAny >= 0.05 ? 2 : 1
}

const hasTopDown = (m: DmaMatter) => !!m.topDown && m.topDown.reason.trim() !== ''

/** True or false once assessed; null while the matter has neither scores nor a reasoned top-down conclusion. */
export function isMaterial(m: DmaMatter, t: DmaAssessment['thresholds']): boolean | null {
  if (hasTopDown(m)) return m.topDown!.material
  const i = impactScore(m.impact), f = financialScore(m.financial)
  if (i === null && f === null) return null
  return (i !== null && i >= t.impact) || (f !== null && f >= t.financial)
}

export type DmaResult = {
  material: DmaMatter[]
  notMaterial: DmaMatter[]
  unassessed: DmaMatter[]
  /** ESRS 2 plus each topical standard with a material matter (entity-specific matters are reported under ESRS 2). */
  standards: string[]
  method: 'bottom-up' | 'top-down' | 'mixed' | 'none'
}

export function dmaResult(a: DmaAssessment): DmaResult {
  const verdict = a.matters.map((m) => ({ m, v: isMaterial(m, a.thresholds) }))
  const material = verdict.filter((x) => x.v === true).map((x) => x.m)
  const assessed = verdict.filter((x) => x.v !== null).map((x) => x.m)
  const topDown = assessed.filter(hasTopDown).length
  const order = DMA_TOPICS.map((t) => t.standard)
  return {
    material,
    notMaterial: verdict.filter((x) => x.v === false).map((x) => x.m),
    unassessed: verdict.filter((x) => x.v === null).map((x) => x.m),
    standards: ['ESRS 2', ...order.filter((s) => material.some((m) => m.topic === s))],
    method: !assessed.length ? 'none' : topDown === 0 ? 'bottom-up' : topDown === assessed.length ? 'top-down' : 'mixed',
  }
}

/** Suggested level for ESG-G5 (materiality assessment), from what the assessment records. */
export function suggestEsgG5(a: DmaAssessment): { level: 0 | 2 | 3 | 5; reason: string } {
  const r = dmaResult(a)
  if (r.method === 'none') return { level: 0, reason: 'No matters assessed yet.' }
  const bothSides = a.matters.some((m) => m.impact) && a.matters.some((m) => m.financial)
  if (!a.stakeholders.trim()) return { level: 2, reason: 'Matters are assessed, but stakeholder input is not recorded.' }
  if (bothSides && a.approvedBy.trim()) return { level: 5, reason: 'Impact and financial materiality are assessed, with stakeholder input and approval recorded.' }
  return { level: 3, reason: 'A documented assessment with stakeholder input.' }
}

const nameOf = (m: DmaMatter) => (m.topic === 'entity' ? `${m.name} (entity-specific)` : `${m.name} (${m.topic})`)
function why(m: DmaMatter, t: DmaAssessment['thresholds']): string {
  if (hasTopDown(m)) return `Concluded ${m.topDown!.material ? 'material' : 'not material'} from the strategy and business model analysis: ${m.topDown!.reason.trim()}`
  const parts: string[] = []
  const i = impactScore(m.impact), f = financialScore(m.financial)
  if (i !== null) parts.push(`impact ${i} (threshold ${t.impact})`)
  if (f !== null) parts.push(`financial ${f} (threshold ${t.financial})`)
  return `Scored: ${parts.join('; ')}`
}

/** Report section: the process (IRO-1), material impacts, risks and opportunities, and disclosures covered (IRO-2). */
export function dmaNarrativeBlocks(a: DmaAssessment): NarrativeBlock[] {
  const r = dmaResult(a)
  const t = a.thresholds
  const atDefault = t.impact === DEFAULT_THRESHOLDS.impact && t.financial === DEFAULT_THRESHOLDS.financial
  const method = { 'bottom-up': 'each matter was scored', 'top-down': 'each matter was concluded from the strategy and business model analysis', mixed: 'some matters were scored and others concluded from the strategy and business model analysis', none: 'no matters have been assessed yet' }[r.method]
  const blocks: NarrativeBlock[] = [
    { type: 'paragraph', text: `Process (IRO-1). The organisation assessed ${a.matters.length} sustainability matters for impact materiality (severity from scale, scope and how hard the harm is to remedy, and likelihood for potential impacts) and financial materiality (magnitude and likelihood of the risk or opportunity). Method: ${method}. A matter is material if either score reaches its threshold. Thresholds: impact ${t.impact} and financial ${t.financial} on a 1 to 5 scale${atDefault && !a.thresholdReason.trim() ? ' (the middle of the scale)' : ''}.${a.thresholdReason.trim() ? ` Reason: ${a.thresholdReason.trim()}` : ''} Stakeholders engaged: ${a.stakeholders.trim() || '[not recorded]'}. Approved by: ${a.approvedBy.trim() || '[not recorded]'}.` },
    { type: 'table', headers: ['Material matter', 'Why'], rows: r.material.length ? r.material.map((m) => [nameOf(m), why(m, t)]) : [['None identified yet', '']] },
    { type: 'paragraph', text: `Disclosures covered (IRO-2): ${r.standards.join(', ')}.` },
  ]
  if (r.notMaterial.length) blocks.push({ type: 'list', items: r.notMaterial.map((m) => `Not material: ${nameOf(m)}. ${why(m, t)}`) })
  if (r.unassessed.length) blocks.push({ type: 'note', text: `Not yet assessed: ${r.unassessed.map(nameOf).join(', ')}.` })
  blocks.push({ type: 'note', text: `Applies the ${ESRS_VERSION_NOTE} This is a readiness view prepared in CRAFT; check paragraph references against the published text.` })
  return blocks
}
