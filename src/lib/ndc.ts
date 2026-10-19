// Nationally determined contributions (NDCs): each country's latest NDC under the Paris Agreement, and how an
// organisation's actions relate to it. Wording rule: an organisation "contributes to" or "is aligned with" a
// national NDC; it never claims its results are counted or credited, because only the government reports NDC progress.
// Self-check: `node src/lib/ndc.test.ts`.
import { NDC_DATA, NDC_CHECKED } from './ndcData.ts'
import type { NarrativeBlock } from './narrative.ts'

export const NDC_SECTORS = {
  energy: 'Energy', transport: 'Transport', buildings: 'Buildings', industry: 'Industry', agriculture: 'Agriculture',
  'land-forests': 'Land use and forests', waste: 'Waste', water: 'Water', health: 'Health', coastal: 'Coastal zones',
  'disaster-risk': 'Disaster risk management', ecosystems: 'Ecosystems and biodiversity', urban: 'Urban areas',
  education: 'Education', social: 'Social development', tourism: 'Tourism',
} as const
export type NdcSector = keyof typeof NDC_SECTORS

export interface NdcRecord {
  jurisdiction: string
  /** Latest submission, e.g. "2025 NDC (Third NDC)". */
  submission: string | null
  submitted: string | null
  /** Headline greenhouse gas target, in the analysis's words. */
  target: string | null
  targetYear: string | null
  conditionality: string | null
  /** True when the latest NDC has not yet been analysed, so the target may come from an earlier NDC. */
  targetPending: boolean
  mitigation: NdcSector[]
  adaptation: NdcSector[]
  notes?: string
  source: { registry: string; analysis: string; checked: string }
}

const REGISTRY = 'https://unfccc.int/NDCREG'
const NOTES: Record<string, string> = {
  US: 'The United States withdrew from the Paris Agreement with effect from 27 January 2026 and in January 2026 announced withdrawal from the UNFCCC; its last NDC is shown for reference only (Harvard EELP tracker).',
  EU: 'The EU submits one NDC for all 27 member states.',
}

function noteFor(j: string, r: { submission: string | null; targetPending: boolean }): { notes?: string } {
  const notes = [
    NOTES[j],
    r.submission ? '' : 'No NDC document is recorded in the analysis; check the UNFCCC registry.',
    r.targetPending ? 'The latest NDC is still being analysed; the target shown may be from an earlier NDC. Check the NDC document.' : '',
  ].filter(Boolean).join(' ')
  return notes ? { notes } : {}
}

export const NDCS: Record<string, NdcRecord> = Object.fromEntries(Object.entries(NDC_DATA).map(([j, { iso3, ...r }]) => [j, {
  jurisdiction: j, ...r,
  ...noteFor(j, r),
  source: { registry: REGISTRY, analysis: `https://www.climatewatchdata.org/api/v1/data/ndc_content?countries[]=${iso3}`, checked: NDC_CHECKED },
}]))

export type ContributionType = 'mitigation' | 'adaptation' | 'finance-capacity'
export const CONTRIBUTION_TYPES: Record<ContributionType, string> = {
  mitigation: 'Cutting emissions (mitigation)', adaptation: 'Building resilience (adaptation)', 'finance-capacity': 'Finance, technology or capacity building',
}
export interface ContributionProfile { sectors: NdcSector[]; types: ContributionType[]; actions: string }

export interface NdcContribution {
  record: NdcRecord
  profile: ContributionProfile
  mitigationMatches: NdcSector[]
  adaptationMatches: NdcSector[]
  statements: string[]
  caveats: string[]
}

const names = (s: NdcSector[]) => s.map((x) => NDC_SECTORS[x].toLowerCase()).join(', ')

export function assessContribution(jurisdiction: string, profile: ContributionProfile): NdcContribution | null {
  const record = NDCS[jurisdiction]
  if (!record) return null
  const mitigationMatches = profile.types.includes('mitigation') ? profile.sectors.filter((s) => record.mitigation.includes(s)) : []
  const adaptationMatches = profile.types.includes('adaptation') ? profile.sectors.filter((s) => record.adaptation.includes(s)) : []
  const named = new Set([...record.mitigation, ...record.adaptation])
  const outside = profile.sectors.filter((s) => !named.has(s))
  const statements: string[] = []
  if (!profile.types.length) statements.push('Choose how the organisation contributes (mitigation, adaptation, or finance and capacity) to see how it relates to the NDC.')
  if (mitigationMatches.length) statements.push(`Its emission reductions in ${names(mitigationMatches)} contribute to the NDC's mitigation priorities.`)
  if (adaptationMatches.length) statements.push(`Its resilience work in ${names(adaptationMatches)} is aligned with the NDC's adaptation priorities.`)
  if (profile.types.includes('finance-capacity')) statements.push('Its finance, technology or capacity-building support contributes to the means of implementing the NDC.')
  if (outside.length) statements.push(`Not named as a priority sector in the NDC analysis: ${names(outside)}. Describe the link in your own words if there is one.`)
  const caveats = [
    'Only the national government reports progress on its NDC. This section describes alignment, not an accounting claim.',
    'Avoid double claiming: emission reductions sold as carbon credits cannot also be presented as the organisation\'s own contribution.',
  ]
  return { record, profile, mitigationMatches, adaptationMatches, statements, caveats }
}

/** Blocks for the report section "Contribution to [country]'s NDC". */
export function ndcNarrativeBlocks(c: NdcContribution, countryName: string): NarrativeBlock[] {
  const r = c.record
  const blocks: NarrativeBlock[] = [
    { type: 'table', headers: ['NDC', 'Detail'], rows: [
      ['Latest submission', [r.submission, r.submitted].filter(Boolean).join(', ') || 'Not found'],
      ['Headline target', r.target ?? 'No quantified greenhouse gas target found'],
      ['Target year', r.targetYear ?? '-'],
      ['Conditionality', r.conditionality ?? '-'],
      ['Mitigation sectors', names(r.mitigation) || '-'],
      ['Adaptation priorities', names(r.adaptation) || '-'],
    ] },
    { type: 'paragraph', text: `How ${c.profile.actions ? `the organisation's work (${c.profile.actions})` : 'the organisation'} relates to ${countryName}'s NDC:` },
    { type: 'list', items: c.statements },
    ...c.caveats.map((text): NarrativeBlock => ({ type: 'note', text })),
  ]
  if (r.notes) blocks.push({ type: 'note', text: r.notes })
  blocks.push({ type: 'note', text: `Source: UNFCCC NDC Registry (${r.source.registry}); targets and sectors as analysed by Climate Watch (WRI), checked ${r.source.checked}. Confirm against the NDC document.` })
  return blocks
}
