// Sustainability assurance readiness: which disclosures have (or will get) limited or reasonable assurance, under
// which standard, whether the controls are in place for each level, and a phased roadmap: limited assurance on the
// whole report first, then reasonable assurance on core metrics such as GHG emissions, then reasonable assurance
// broadly. Limited assurance is a real, structured conclusion with a higher acceptable risk and fewer procedures than
// reasonable assurance; it is not an audit and must be described with its scope and limits. CRAFT shows readiness,
// never an assurance opinion. Self-check: `node src/lib/assurance.test.ts`. Stored per tenant under `assurance:plan`.
import type { NarrativeBlock } from './narrative.ts'

export const ASSURANCE_KEY = 'assurance:plan'
export type AssuranceLevel = 'none' | 'limited' | 'reasonable'
export const LEVEL_LABEL: Record<AssuranceLevel, string> = { none: 'No assurance', limited: 'Limited assurance', reasonable: 'Reasonable assurance' }
const RANK: Record<AssuranceLevel, number> = { none: 0, limited: 1, reasonable: 2 }

export const ASSURANCE_STANDARDS = ['ISSA 5000', 'ISAE 3000 (Revised)', 'ISAE 3410 (GHG statements)', 'AA1000AS v3', 'Other'] as const

export const ASSURANCE_PHASES = [
  { n: 1, name: 'Limited assurance on the whole sustainability report' },
  { n: 2, name: 'Reasonable assurance on core metrics, such as Scope 1 and 2 GHG emissions' },
  { n: 3, name: 'Reasonable assurance across the report' },
] as const

/** Controls an assurance provider will test. The first three are the minimum for limited assurance; all for reasonable. */
export const CONTROLS = [
  { key: 'methodology', label: 'Calculation methodology documented', forLimited: true },
  { key: 'owner', label: 'A named owner for the data', forLimited: true },
  { key: 'auditTrail', label: 'An audit trail from source to reported figure', forLimited: true },
  { key: 'reconciled', label: 'Reconciled to source records (e.g. invoices, meter readings)', forLimited: false },
  { key: 'reviewed', label: 'Independent internal review and sign-off before publication', forLimited: false },
  { key: 'priorCycle', label: 'At least one limited-assurance cycle completed, with findings closed', forLimited: false },
] as const
export type ControlKey = (typeof CONTROLS)[number]['key']

export type AssuranceItem = {
  id: string
  name: string
  kind: 'report' | 'metric' | 'topic'
  current: AssuranceLevel
  target: AssuranceLevel
  targetYear?: number
  standard?: string
  provider?: string
  controls: Record<ControlKey, boolean>
}
export type AssurancePlan = { items: AssuranceItem[] }
export const emptyPlan = (): AssurancePlan => ({ items: [] })

const noControls = (): Record<ControlKey, boolean> => Object.fromEntries(CONTROLS.map((c) => [c.key, false])) as Record<ControlKey, boolean>
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Starting items: the whole report, Scope 1 and 2 emissions, and each material topic (from the double materiality assessment). */
export function defaultItems(materialTopics: string[] = []): AssuranceItem[] {
  return [
    { id: 'report', name: 'Whole sustainability report', kind: 'report', current: 'none', target: 'limited', controls: noControls() },
    { id: 'ghg-s12', name: 'Scope 1 and 2 GHG emissions', kind: 'metric', current: 'none', target: 'limited', controls: noControls() },
    ...materialTopics.map((t): AssuranceItem => ({ id: `topic-${slug(t)}`, name: t, kind: 'topic', current: 'none', target: 'limited', controls: noControls() })),
  ]
}

/** The highest level the controls in place support, and what is missing for each level. */
export function readiness(i: AssuranceItem): { ready: AssuranceLevel; missingForLimited: string[]; missingForReasonable: string[] } {
  const missingForLimited = CONTROLS.filter((c) => c.forLimited && !i.controls[c.key]).map((c) => c.label)
  const missingForReasonable = CONTROLS.filter((c) => !i.controls[c.key]).map((c) => c.label)
  return { ready: missingForReasonable.length === 0 ? 'reasonable' : missingForLimited.length === 0 ? 'limited' : 'none', missingForLimited, missingForReasonable }
}

const atLeast = (l: AssuranceLevel, min: AssuranceLevel) => RANK[l] >= RANK[min]

/** Roadmap phase reached (0 = none yet). */
export function currentPhase(p: AssurancePlan): 0 | 1 | 2 | 3 {
  const report = p.items.find((i) => i.kind === 'report')
  if (!report || !atLeast(report.current, 'limited')) return 0
  if (!p.items.some((i) => i.kind === 'metric' && i.current === 'reasonable')) return 1
  return p.items.every((i) => i.current === 'reasonable') ? 3 : 2
}

export function nextStep(p: AssurancePlan): string {
  const phase = currentPhase(p)
  if (phase === 0) return 'Next: obtain limited assurance on the whole report (phase 1). Put the basic controls in place first: documented methodology, a named data owner and an audit trail.'
  if (phase === 1) return 'Next: move core metrics, starting with Scope 1 and 2 GHG emissions, to reasonable assurance (phase 2) once every control is in place and a limited-assurance cycle has closed its findings.'
  if (phase === 2) return 'Next: extend reasonable assurance across the report (phase 3), topic by topic, as controls mature.'
  return 'All items have reasonable assurance. Keep controls tested each cycle.'
}

/** Wording checks for how assurance is described in a report or on a website. Returns the problems found. */
export function checkClaims(text: string, p: AssurancePlan): string[] {
  const top = p.items.reduce<AssuranceLevel>((m, i) => (RANK[i.current] > RANK[m] ? i.current : m), 'none')
  const flags: string[] = []
  if (/\baudit(ed|s)?\b|audit opinion/i.test(text)) flags.push('Says "audit": sustainability assurance is an assurance engagement, not an audit. Say "limited assurance" or "reasonable assurance" and name the standard.')
  if (/reasonable assurance/i.test(text) && !p.items.some((i) => i.current === 'reasonable')) flags.push('Claims reasonable assurance, but no item has reasonable assurance recorded.')
  if (/guarantee|certif|fully verified|100\s*%\s*(accurate|verified)/i.test(text)) flags.push('Implies a guarantee or certification: assurance gives a conclusion within a stated scope, not a guarantee.')
  if (/\b(assured|verified|assurance)\b/i.test(text) && top === 'none') flags.push('Mentions assurance or verification, but no assurance has been obtained yet.')
  return flags
}

/** Report section: what limited assurance is, the plan per item, the roadmap and the CSRD position. */
export function assuranceNarrativeBlocks(p: AssurancePlan): NarrativeBlock[] {
  return [
    { type: 'paragraph', text: 'Limited assurance is a meaningful, structured conclusion: the assurance provider performs fewer procedures than for reasonable assurance and gives a lower, but still meaningful, level of assurance, reported in negative form ("nothing has come to our attention"). It is not an audit and not a guarantee, so its scope and limits are stated wherever it is mentioned.' },
    { type: 'table', headers: ['Item', 'Current', 'Target', 'Standard', 'Controls ready for'], rows: p.items.map((i) => [
      i.name, LEVEL_LABEL[i.current], `${LEVEL_LABEL[i.target]}${i.targetYear ? ` (${i.targetYear})` : ''}`, i.standard || '[not chosen]', LEVEL_LABEL[readiness(i).ready],
    ]) },
    { type: 'list', items: ASSURANCE_PHASES.map((ph) => `Phase ${ph.n}: ${ph.name}${currentPhase(p) >= ph.n ? ' (reached)' : ''}`) },
    { type: 'paragraph', text: nextStep(p) },
    { type: 'note', text: 'EU CSRD: after the Omnibus I amendments (Directive (EU) 2026/470) the law requires limited assurance only; the planned move to reasonable assurance was removed. ISSA 5000 applies to periods beginning on or after 15 December 2026; an EU limited-assurance standard is expected in 2027. Reasonable assurance remains a voluntary choice.' },
  ]
}
