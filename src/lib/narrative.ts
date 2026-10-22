// ============================================================================
// CRAFT (ICARF v4.0) - Sustainability & Regulatory Narrative Generator
// ----------------------------------------------------------------------------
// Assembles a jurisdiction- and standard-aware narrative implementation-plan
// document (e.g. an IFRS S1/S2 sustainability-disclosure implementation plan
// for a regulator such as SEC Nigeria) from the entity's own CRAFT data:
//   - regulatory citations from regulatory-context.ts (real statutes/regulators)
//   - ESG Self-Assessment gaps and recommendations from esg.ts (real answers)
//   - CIP findings/mitigations from data.ts deriveFindings (real answers)
//   - ISSB disclosure pillars and Scope 1/2/3 state from issb.ts
//
// Fields CRAFT does not (yet) capture - legal entity name formatting, named
// board committees, exact budget figures, specific filing dates - are left as
// bracketed placeholders, the same convention a professionally drafted filing
// uses, rather than being invented. Every citation and recommendation that IS
// rendered traces back to real, already-scored CRAFT data.
//
// Pure data + helpers (no React) so both the on-screen preview and the
// exported/printed document render from one source of truth.
// ============================================================================

import { Archetype } from './data'
import type { DerivedFinding } from './data'
import {
  JurisdictionId, SectorArchetype, RegulatoryPillar, StatutoryRequirement,
  resolveRegulatoryContext, pillar as regulatoryPillar,
} from './regulatory-context'
import { DISCLOSURE_PILLARS, MaterialityLens, MATERIALITY_LABEL, ScopeEmissions, scope3RedFlag } from './issb'
import type { EsgGap, EsgBadge } from './esg'
import { ndcNarrativeBlocks, type NdcContribution } from './ndc'

// ----------------------------------------------------------------------------
// Input: everything the generator reads from the entity's real CRAFT data.
// ----------------------------------------------------------------------------

export interface NarrativeOrgContext {
  orgName: string
  archetype: Archetype | ''
  country: string
  businessSector: string // free-text sector (entityProfile.sector), used for the Scope 3 red flag
  jurisdictions: JurisdictionId[]
  regSector: SectorArchetype | ''
  compositeScore: number
  accreditationLevel: string
  accreditationLabel: string
  implementationEvidence: number
  planMonths: number
  /** Timeline pace label, e.g. Standard. */
  planPace?: string
  lens: MaterialityLens
  esgBadge: EsgBadge
  esgVerifiedScore: number
  esgAnswered: number
  esgTotal: number
  esgGaps: EsgGap[]
  /** ESG maturity stage label, e.g. "Stage 2: Efficiency (provisional ...)". */
  esgStage?: string
  cipFindings: DerivedFinding[]
  scopeEmissions: ScopeEmissions
  /** The organisation's contribution to its country's NDC, when it has described one. */
  ndc?: { contribution: NdcContribution; countryName: string }
  /** Report blocks from the double materiality assessment, when matters have been assessed. */
  dma?: NarrativeBlock[]
  /** Report blocks from the assurance readiness plan, when it has items. */
  assurance?: NarrativeBlock[]
}

// ----------------------------------------------------------------------------
// Output: a sequence of sections, each a sequence of render-agnostic blocks.
// ----------------------------------------------------------------------------

export type NarrativeBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'note'; text: string } // a flagged/callout line (e.g. a red-flag or placeholder reminder)

export interface NarrativeSection {
  id: string
  number: number
  title: string
  blocks: NarrativeBlock[]
}

export interface NarrativeDocument {
  docTitle: string
  submittedTo: string
  dateOfSubmission: string
  reportingEntity: string
  sections: NarrativeSection[]
}

const PLACEHOLDER = (hint: string) => `[${hint}]`

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function monthsFromNow(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

// ----------------------------------------------------------------------------
// Section builders - each pulls from real ctx fields where CRAFT has the data,
// and falls back to a clearly bracketed placeholder where it does not.
// ----------------------------------------------------------------------------

function sectionGovernance(ctx: NarrativeOrgContext, pillars: RegulatoryPillar[]): NarrativeSection {
  const govPillar = DISCLOSURE_PILLARS.find(p => p.key === 'governance')!
  const regulatorNames = pillars.flatMap(p => p.regulators).join(', ') || PLACEHOLDER('applicable regulator(s)')
  return {
    id: 'governance', number: 1, title: 'Governance Arrangements',
    blocks: [
      { type: 'paragraph', text: `The Board of Directors of ${ctx.orgName} holds ultimate accountability for the organization's sustainability strategy, risk appetite and performance under ${govPillar.standard}. Oversight is delegated to ${PLACEHOLDER('named Board Committee, e.g. Audit Committee / Risk Committee / Sustainability Committee')}.` },
      { type: 'paragraph', text: `Per CRAFT's self-assessment, governance maturity for this entity currently scores ${ctx.esgVerifiedScore.toFixed(2)} / 5 on the ESG Governance pillar (self-reported, evidence-adjusted). The designated committee reviews sustainability and climate-related risks and opportunities at ${PLACEHOLDER('review frequency, e.g. quarterly')}, informed by this score and the gap assessment in Section 6.` },
      { type: 'paragraph', text: `Management-level accountability for day-to-day implementation sits with ${PLACEHOLDER('executive sponsor, e.g. Chief Sustainability Officer / CFO')}, reporting to the Chief Executive Officer and to the designated Board Committee at each scheduled meeting.` },
      { type: 'note', text: `This entity's regulatory jurisdiction(s) trigger oversight from: ${regulatorNames}.` },
    ],
  }
}

function sectionChallenges(ctx: NarrativeOrgContext): NarrativeSection {
  const esgRows = ctx.esgGaps.slice(0, 4).map(g => [
    g.question.domain,
    g.question.question,
    g.question.recommendation,
  ])
  // ESG-maturity actions are already listed with the ESG gaps, so leave them out here.
  const cipRows = ctx.cipFindings
    .filter(f => !f.id.startsWith('ESG-') && (f.severity === 'Critical' || f.severity === 'High'))
    .slice(0, 4)
    .map(f => [f.domain, f.description, f.mitigation])
  const rows = [...esgRows, ...cipRows]
  return {
    id: 'challenges', number: 2, title: 'Key Implementation Challenges & Mitigation Strategies',
    blocks: [
      { type: 'paragraph', text: rows.length
        ? `The following challenges were identified directly from this entity's CRAFT assessment answers, ranked by severity, each paired with the mitigation action already on record.`
        : `No ESG or capacity gaps are currently on record for this entity - complete the ESG Self-Assessment and the full Assessment Wizard to populate this section with entity-specific challenges and mitigations.` },
      ...(rows.length ? [{ type: 'table' as const, headers: ['Domain', 'Challenge', 'Mitigation Strategy'], rows }] : []),
    ],
  }
}

function sectionScope3Clause(ctx: NarrativeOrgContext): NarrativeSection {
  const flag = scope3RedFlag(ctx.businessSector, ctx.scopeEmissions)
  return {
    id: 'scope3', number: 3, title: 'Supply Chain Scope 3 Data-Gathering Framework',
    blocks: [
      { type: 'paragraph', text: `To mitigate the data-collection challenges above, ${ctx.orgName} is incorporating the following standardized clause into vendor and supplier agreements.` },
      ...(flag.severity === 'amber' ? [{ type: 'note' as const, text: `${flag.message} (${ctx.businessSector} is treated as a high-impact sector under ISSB S2 / CSRD.)` }] : []),
      { type: 'paragraph', text: `Clause ${PLACEHOLDER('X')}.1 - Provision of Sustainability Data: The Supplier acknowledges that ${ctx.orgName} is subject to mandatory or voluntary sustainability reporting under the International Sustainability Standards Board (ISSB) frameworks (IFRS S1 and IFRS S2). To enable calculation of Category-specific Scope 3 greenhouse gas emissions, the Supplier agrees to provide accurate, verifiable and timely environmental performance data related to the goods, services or materials provided under this Agreement.` },
      { type: 'paragraph', text: `Clause ${PLACEHOLDER('X')}.2 - Reporting Timelines: The Supplier shall deliver an annual Sustainability Performance Report covering the same operational period as ${ctx.orgName}'s financial year, with a provisional data set no later than ${PLACEHOLDER('N days prior to year-end')} and the final report no later than ${PLACEHOLDER('N days following year-end')}.` },
      { type: 'paragraph', text: `Clause ${PLACEHOLDER('X')}.3 - Data Audit and Integrity: The Supplier warrants that all data is calculated in good faith using recognized international standards, and ${ctx.orgName} or its designated assurance provider may audit the Supplier's data-collection methodology on reasonable notice.` },
    ],
  }
}

function sectionTraining(ctx: NarrativeOrgContext, pillars: RegulatoryPillar[]): NarrativeSection {
  const n = Math.max(1, ctx.planMonths)
  const phaseLen = Math.max(1, Math.round(n / 4))
  const phaseEnd = (k: number) => Math.min(n, k * phaseLen)
  const regulatorNames = pillars.flatMap(p => p.regulators).join(' / ') || PLACEHOLDER('national accounting/audit body')
  const rows = [
    [`Phase 1: Foundations (Months 1-${phaseEnd(1)})`, 'CFO / Controllers / Senior Finance', `Core architecture of ${MATERIALITY_LABEL[ctx.lens]}; evaluating material sustainability impacts on the balance sheet.`, `${regulatorNames} technical guidance`],
    [`Phase 2: Carbon Accounting (Months ${phaseEnd(1) + 1}-${phaseEnd(2)})`, 'Management Accountants / Reporting Teams', 'Translating operational energy, logistics and supply data into GHG Protocol-aligned Scope 1/2/3 figures.', PLACEHOLDER('professional body certificate program')],
    [`Phase 3: Controls & Assurance (Months ${phaseEnd(2) + 1}-${phaseEnd(3)})`, 'Internal Audit / Risk Compliance', 'Applying financial-control standards to sustainability data; building audit trails for limited-assurance review.', PLACEHOLDER('internal audit training partner')],
    [`Phase 4: Disclosure Dry Run (Months ${phaseEnd(3) + 1}-${n})`, 'Investor Relations / Full Reporting Team', 'Drafting the combined narrative, merging financial statements with the sustainability disclosure for a single annual package.', PLACEHOLDER('external reviewer / mock-disclosure partner')],
  ]
  return {
    id: 'training', number: 4, title: 'Capacity Building & Professional Training Schedule',
    blocks: [
      { type: 'paragraph', text: `The training schedule below is phased across the entity's chosen ${n}-month Capacity Improvement Plan window (CRAFT lets any institution rescale this to its own timeframe), so capability-building lands ahead of each reporting milestone.` },
      { type: 'table', headers: ['Phase & Timeline', 'Target Audience', 'Focus Areas', 'Delivery Partners'], rows },
    ],
  }
}

function sectionBudget(ctx: NarrativeOrgContext): NarrativeSection {
  const rows = [
    ['1. Capacity Building & Training', 'Professional sustainability/ESG training for core finance staff; Board/Committee briefings.', PLACEHOLDER('cost range, local currency'), 'High (Immediate)'],
    ['2. Software & Systems Upgrades', 'Licensing for ESG/carbon-accounting modules; data-capture integration into the financial ledger.', PLACEHOLDER('cost range, local currency'), 'High'],
    ['3. External Advisory & Assessment', 'Baseline gap assessment, Scope 3 supply-chain mapping, climate-scenario analysis.', PLACEHOLDER('cost range, local currency'), 'Medium'],
    ['4. Control & Assurance Readiness', 'Pre-assurance mock audit by an independent third party.', PLACEHOLDER('cost range, local currency'), 'Medium'],
  ]
  return {
    id: 'budget', number: 5, title: 'Budget Estimation Framework',
    blocks: [
      { type: 'note', text: `CRAFT does not capture financial budget figures - the ranges below are placeholders for ${ctx.orgName}'s Finance function to complete before Board submission.` },
      { type: 'table', headers: ['Budget Category', 'Line Item', 'Estimated Cost', 'Priority'], rows },
    ],
  }
}

function sectionGapAssessment(ctx: NarrativeOrgContext, requirements: StatutoryRequirement[]): NarrativeSection {
  const esgRows = ctx.esgGaps.map(g => [g.question.domain, `${g.score}/5`, g.question.recommendation])
  const cipRows = ctx.cipFindings.filter(f => !f.id.startsWith('ESG-')).slice(0, 8).map(f => [f.domain, f.severity, f.mitigation])
  const reqRows = requirements.slice(0, 6).map(r => [r.authority, r.citation, r.requirement])
  return {
    id: 'gap-assessment', number: 6, title: 'Gap Assessment',
    blocks: [
      { type: 'paragraph', text: `This entity's composite CRAFT readiness score is ${ctx.compositeScore}%, corresponding to accreditation ${ctx.accreditationLabel}. Its ESG Self-Assessment evidence-adjusted score is ${ctx.esgVerifiedScore.toFixed(2)} / 5 (${ctx.esgAnswered} / ${ctx.esgTotal} questions answered), rated ${ctx.esgBadge.letter} - ${ctx.esgBadge.label}${ctx.esgBadge.provisional ? ' (provisional, pending further evidence verification)' : ''}.${ctx.esgStage ? ` ESG maturity: ${ctx.esgStage}.` : ''}` },
      { type: 'paragraph', text: ctx.implementationEvidence < 50
        ? `Implementation evidence stands at ${ctx.implementationEvidence}%, below the 50% threshold - under CRAFT's Paper Compliance Penalty Engine this caps accreditation at Level C regardless of the raw composite score, reflecting that policy-on-paper has not yet converted to system-enforced execution.`
        : `Implementation evidence stands at ${ctx.implementationEvidence}%, at or above the 50% threshold required to avoid the Paper Compliance Penalty cap.` },
      ...(esgRows.length ? [
        { type: 'paragraph' as const, text: 'ESG disclosure gaps identified (self-reported, worst first):' },
        { type: 'table' as const, headers: ['Domain', 'Score', 'Recommendation'], rows: esgRows },
      ] : []),
      ...(cipRows.length ? [
        { type: 'paragraph' as const, text: 'Fiduciary/operational gaps from the full CRAFT assessment:' },
        { type: 'table' as const, headers: ['Domain', 'Severity', 'Mitigation Action'], rows: cipRows },
      ] : []),
      ...(reqRows.length ? [
        { type: 'paragraph' as const, text: 'Applicable statutory requirements against which these gaps are assessed:' },
        { type: 'table' as const, headers: ['Authority', 'Citation', 'Requirement'], rows: reqRows },
      ] : []),
    ],
  }
}

function sectionDataSystems(ctx: NarrativeOrgContext): NarrativeSection {
  const e = ctx.scopeEmissions
  const scopeLine = (label: string, state: string) => `${label}: ${state}`
  const scope1 = scopeLine('Scope 1 (direct)', e.scope1 != null ? `${e.scope1} tCO2e tracked` : 'not yet entered')
  const scope2 = scopeLine('Scope 2 (indirect energy)', e.scope2 != null ? `${e.scope2} tCO2e tracked` : 'not yet entered')
  const scope3 = scopeLine('Scope 3 (value chain)', e.scope3State === 'tracked' ? `${e.scope3 ?? PLACEHOLDER('value')} tCO2e tracked` : e.scope3State === 'not_applicable' ? 'not applicable' : 'not tracked')
  return {
    id: 'data-systems', number: 7, title: 'Data Collection and Reporting Systems',
    blocks: [
      { type: 'paragraph', text: `${ctx.orgName} will route sustainability data through CRAFT's Universal Data Room, with ownership assigned per domain and every entry backed by a verifiable source document, mirroring the control rigor applied to financial reporting.` },
      { type: 'list', items: [scope1, scope2, scope3] },
      { type: 'paragraph', text: `System access controls and audit trails will ensure any adjustment to a sustainability metric is trackable by internal risk/compliance officers and by external assurance providers, consistent with ${DISCLOSURE_PILLARS.find(p => p.key === 'metrics')!.standard}.` },
    ],
  }
}

function sectionFirstReportingYear(ctx: NarrativeOrgContext): NarrativeSection {
  const target = monthsFromNow(ctx.planMonths)
  return {
    id: 'first-report', number: 8, title: 'Expected Year of First Sustainability Reporting',
    blocks: [
      { type: 'paragraph', text: `Based on the entity's ${ctx.planMonths}-month Capacity Improvement Plan, suggested from the severity of its gaps${ctx.planPace ? ` at the ${ctx.planPace} pace` : ''} (submitted ${today()}), ${ctx.orgName} targets its first fully compliant sustainability disclosure for the period ending ${PLACEHOLDER('financial year-end date')}, around ${target}, issued concurrently with its mainstream Annual Report and Accounts.` },
      { type: 'list', items: [
        'Phase 1 - Submission of this implementation plan, foundational capacity building, launch of the formal gap assessment (see Section 6).',
        'Phase 2 - Deployment of data-collection systems, vendor contract updates (see Section 3), internal dry-run using the most recent operational data.',
        'Phase 3 - Full execution of data gathering, ongoing internal control tracking, final preparation of the baseline report.',
      ] },
    ],
  }
}

// ----------------------------------------------------------------------------
// Top-level assembly
// ----------------------------------------------------------------------------

export function buildNarrativeDocument(ctx: NarrativeOrgContext): NarrativeDocument {
  const pillars = ctx.jurisdictions.map(regulatoryPillar).filter((p): p is RegulatoryPillar => !!p)
  const resolved = ctx.regSector ? resolveRegulatoryContext(ctx.jurisdictions, ctx.regSector) : null
  const requirements = resolved?.requirements ?? []
  const regulatorNames = pillars.flatMap(p => p.regulators)
  const submittedTo = regulatorNames.length ? regulatorNames.join(' / ') : PLACEHOLDER('the applicable regulator')

  return {
    docTitle: `${MATERIALITY_LABEL[ctx.lens]} Implementation Plan`,
    submittedTo,
    dateOfSubmission: today(),
    reportingEntity: ctx.orgName,
    sections: [
      sectionGovernance(ctx, pillars),
      sectionChallenges(ctx),
      sectionScope3Clause(ctx),
      sectionTraining(ctx, pillars),
      sectionBudget(ctx),
      sectionGapAssessment(ctx, requirements),
      sectionDataSystems(ctx),
      sectionFirstReportingYear(ctx),
      ...(ctx.ndc ? [{ id: 'ndc', number: 9, title: `Contribution to ${ctx.ndc.countryName}'s Nationally Determined Contribution`, blocks: ndcNarrativeBlocks(ctx.ndc.contribution, ctx.ndc.countryName) }] : []),
      ...(ctx.dma ? [{ id: 'dma', number: ctx.ndc ? 10 : 9, title: 'Double Materiality Assessment (ESRS)', blocks: ctx.dma }] : []),
      ...(ctx.assurance ? [{ id: 'assurance', number: 9 + (ctx.ndc ? 1 : 0) + (ctx.dma ? 1 : 0), title: 'Assurance Readiness', blocks: ctx.assurance }] : []),
    ],
  }
}

// ----------------------------------------------------------------------------
// Standalone HTML export - same brand-styled, self-contained, print-ready
// pattern as the User Guide export (see UserGuidePage.tsx buildGuideHtml).
// ----------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function blockToHtml(b: NarrativeBlock): string {
  switch (b.type) {
    case 'paragraph':
      return `<p>${esc(b.text)}</p>`
    case 'note':
      return `<p class="note">${esc(b.text)}</p>`
    case 'list':
      return `<ul>${b.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
    case 'table':
      return `<table><thead><tr>${b.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
        b.rows.map(row => `<tr>${row.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
      }</tbody></table>`
  }
}

export function buildNarrativeHtml(doc: NarrativeDocument): string {
  const toc = doc.sections.map(s => `<li><a href="#${s.id}">${s.number}. ${esc(s.title)}</a></li>`).join('')
  const body = doc.sections.map(s => `
    <section id="${s.id}">
      <h2>${s.number}. ${esc(s.title)}</h2>
      ${s.blocks.map(blockToHtml).join('')}
    </section>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(doc.docTitle)} - ${esc(doc.reportingEntity)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1e293b; max-width: 860px; margin: 0 auto; padding: 48px 24px 96px; line-height: 1.6; }
  h1 { font-size: 28px; color: #064e3b; margin-bottom: 4px; }
  .meta { color: #64748b; font-size: 14px; margin-bottom: 28px; }
  .meta strong { color: #334155; }
  h2 { font-size: 20px; color: #064e3b; border-bottom: 2px solid #d1fae5; padding-bottom: 6px; margin-top: 40px; }
  p { margin: 10px 0; }
  p.note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 14px; font-size: 14px; color: #92400e; }
  ul { padding-left: 22px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f0fdf4; color: #064e3b; }
  nav.toc { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 24px; margin: 24px 0; }
  nav.toc ol { margin: 8px 0 0; padding-left: 20px; }
  @media print { nav.toc { display: none; } a { color: inherit; text-decoration: none; } }
</style>
</head>
<body>
  <h1>${esc(doc.docTitle)}</h1>
  <p class="meta">
    <strong>Submitted to:</strong> ${esc(doc.submittedTo)}<br />
    <strong>Date of submission:</strong> ${esc(doc.dateOfSubmission)}<br />
    <strong>Reporting entity:</strong> ${esc(doc.reportingEntity)}<br />
    <strong>Generated by:</strong> CRAFT (ICARF v4.0) - DiBadili Institute
  </p>
  <nav class="toc"><strong>Contents</strong><ol>${toc}</ol></nav>
  ${body}
</body>
</html>`
}
