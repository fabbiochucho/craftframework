// Builders that turn scorecards, plans, the roadmap and ESG report QA views into the shared
// export document model (netlify/lib/export-formats.ts) for XLSX and PDF downloads.
import type { ExportDoc } from './export-formats.js'
import type { QaView } from './qa-report.js'
import type { PlanRow, PlanSettings } from './esg-planner.js'
import type { CatalogueScore } from '../../src/lib/health-security.js'
import type { PlanAnalysis } from '../../src/lib/plan-graph.js'

const LIMITS = 'Prepared with CRAFT. Not a certification, credit rating, regulator-issued rating or assurance opinion.'
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '' : v)

interface Meta { organisation: string; generatedOn: string; author: string }
const baseMeta = (m: Meta, extra: [string, string][] = []): [string, string][] => [['Organisation', m.organisation], ...extra, ['Generated', `${m.generatedOn} by ${m.author}`]]

export function qaExportDoc(v: QaView, m: Meta, reportId: string): ExportDoc {
  const s = v.summary
  return {
    title: `ESG report quality review — ${v.period.label}`,
    meta: baseMeta(m, [['Period', `${v.period.periodStart} to ${v.period.periodEnd} (${v.period.status})`], ['Report ID', reportId], ['Checklist version', s.version], ['Jurisdiction', v.jurisdiction.name]]),
    blocks: [
      { kind: 'h2', text: 'Score and readiness' },
      { kind: 'p', text: `Score ${s.score}/100 — ${s.band}. ${s.readyForApproval ? 'Ready for approval.' : `Approval blocked: ${s.blockers.join('; ')}`}` },
      { kind: 'p', text: `Coverage ${s.coverage}% · Evidence acceptance ${s.evidenceAcceptance}% · Mandatory coverage ${s.mandatoryCoverage}% · Mandatory pass rate ${s.mandatoryPassRate}%` },
      { kind: 'p', text: `Applicability: IFRS S1/S2 ${v.applicability.status}${v.applicability.effectiveFrom ? ` from ${v.applicability.effectiveFrom}` : ''}, scope ${v.applicability.scope}. ${v.applicability.note}` },
      { kind: 'table', table: { title: 'Checklist detail', sheet: 'Checks', columns: [
        { header: 'ID', width: 0.7 }, { header: 'Pack', width: 0.5 }, { header: 'Check', width: 3 }, { header: 'Class', width: 1.4 }, { header: 'Severity', width: 0.7 },
        { header: 'Status', width: 0.9 }, { header: 'Evidence', width: 0.9 }, { header: 'Owner', width: 1.1 }, { header: 'Due', width: 0.8 }, { header: 'Gap / rationale', width: 2.5 },
      ], rows: v.rows.map((r) => [r.id, r.pack, r.title, r.label, r.severity, r.status, r.evidenceState, r.owner, r.dueDate, r.status === 'not_applicable' ? r.naReason : r.status === 'blocked' ? r.blocker : r.notes]) } },
    ],
    footer: `${LIMITS} Weights, score labels and the 30 general quality checks follow the CRAFT baseline approved on 12 October 2026.`,
  }
}

export function planExportDoc(settings: Partial<PlanSettings>, rows: (PlanRow & { workstream?: string; dependsOn?: number[]; budgetEstimate?: number | null; budgetActual?: number | null; budgetCurrency?: string; planId?: number | null })[], m: Meta): ExportDoc {
  const byPlan = new Map(rows.map((r) => [r.planId, r.requirementId]))
  return {
    title: 'IFRS S1/S2 implementation plan (SEC Nigeria)',
    meta: baseMeta({ ...m, organisation: settings.organisationName || m.organisation }, [['Entity type', String(settings.entityType ?? '')], ['Readiness', String(settings.readiness ?? '')], ['Horizon', String(settings.horizon ?? '')], ['Start', String(settings.startDate ?? '')]]),
    blocks: [
      { kind: 'table', table: { title: 'Required elements', sheet: 'Plan', columns: [
        { header: '#', width: 0.7 }, { header: 'Required element', width: 3 }, { header: 'Workstream', width: 1.1 }, { header: 'Owner', width: 1.2 }, { header: 'Start', width: 0.8 }, { header: 'End', width: 0.8 },
        { header: 'Status', width: 0.8 }, { header: 'Depends on', width: 1 }, { header: 'Budget', width: 0.8 }, { header: 'Actual', width: 0.8 }, { header: 'Currency', width: 0.6 },
      ], rows: rows.map((r) => [r.requirementId, r.requirementText, r.workstream ?? '', r.owner, r.timelineStart, r.timelineEnd, r.status, (r.dependsOn ?? []).map((d) => byPlan.get(d) ?? d).join(', '), r.budgetEstimate ?? null, r.budgetActual ?? null, r.budgetCurrency ?? '']) } },
      { kind: 'table', table: { title: 'Milestones', sheet: 'Milestones', columns: [{ header: '#', width: 0.7 }, { header: 'Milestone', width: 0.5 }, { header: 'Description', width: 4 }, { header: 'Target date', width: 0.9 }, { header: 'Status', width: 0.9 }, { header: 'Evidence', width: 1.5 }],
        rows: rows.flatMap((r) => r.milestones.map((ms) => [r.requirementId, ms.milestoneNum, ms.description, ms.targetDate, ms.status, ms.completionEvidenceLink])) } },
    ],
    footer: 'Plan aligned to the SEC Nigeria circular of 23 September 2026 and FRCN SRG 1. Confirm dates against the FRCN Roadmap for the entity.',
  }
}

export function roadmapExportDoc(items: { planId: number; requirementId: string; text: string; category: string; workstream: string; status: string; start: string | null; end: string | null; deadline: string | null; percentComplete: number; dependsOn: number[]; budgetEstimate: number | null; budgetActual: number | null; budgetCurrency: string }[], a: PlanAnalysis, m: Meta): ExportDoc {
  const label = (id: number) => items.find((i) => i.planId === id)?.requirementId ?? String(id)
  return {
    title: 'ESG implementation roadmap',
    meta: baseMeta(m),
    blocks: [
      { kind: 'h2', text: 'Dependencies' },
      { kind: 'p', text: `Critical path (${a.criticalPath.days} days): ${a.criticalPath.taskIds.map(label).join(' -> ') || 'none'}` },
      ...(a.blocked.length ? [{ kind: 'p' as const, text: `Blocked: ${a.blocked.map((b) => `${label(b.taskId)} waits on ${b.waitingOn.map(label).join(', ')}`).join('; ')}` }] : []),
      ...a.conflicts.map((c) => ({ kind: 'p' as const, text: `Schedule conflict: ${c.message}` })),
      { kind: 'p', text: a.totals.length ? `Budget totals: ${a.totals.map((t) => `${t.currency} ${t.estimate} budget, ${t.actual} actual, variance ${t.variance}`).join('; ')}. ${a.unbudgeted} item(s) without a budget.` : 'No budgets recorded.' },
      { kind: 'table', table: { title: 'Workstreams', sheet: 'Workstreams', columns: [{ header: 'Workstream', width: 2 }, { header: 'Items', width: 0.6 }, { header: 'Complete %', width: 0.8 }, { header: 'Budget', width: 1 }, { header: 'Actual', width: 1 }, { header: 'Variance', width: 1 }, { header: 'Currencies', width: 0.9 }],
        rows: a.workstreams.map((w) => [w.name, w.tasks, w.percent, w.budgetEstimate, w.budgetActual, w.variance, w.currencies.join('/')]) } },
      { kind: 'table', table: { title: 'Plan items', sheet: 'Items', columns: [{ header: '#', width: 0.8 }, { header: 'Requirement', width: 3 }, { header: 'Category', width: 1 }, { header: 'Workstream', width: 1.1 }, { header: 'Status', width: 0.8 }, { header: 'Start', width: 0.8 }, { header: 'End', width: 0.8 }, { header: '% done', width: 0.6 }, { header: 'Depends on', width: 1 }, { header: 'Budget', width: 0.8 }, { header: 'Actual', width: 0.8 }, { header: 'Cur.', width: 0.5 }],
        rows: items.map((i) => [i.requirementId, i.text, i.category, i.workstream, i.status, i.start, i.end ?? i.deadline, i.percentComplete, i.dependsOn.map(label).join(', '), i.budgetEstimate, i.budgetActual, i.budgetCurrency]) } },
    ],
    footer: LIMITS,
  }
}

interface CraftOut { methodology: { version: string }; overall: number | null; rating: { level: string } | null; completeness: number; pillars: { name: string; weight: number; score: number | null; rating?: { level: string } | null; scored: number; applicable: number }[]; recommendations: { criterionId: string; criterion: string; effectiveScore: number; priority: string; action: string; evidence: string[] }[] }
export function craftScorecardDoc(r: CraftOut, a: { version: number; reportingPeriod: string; status: string }, m: Meta): ExportDoc {
  return {
    title: `CRAFT Governance Scorecard v${a.version}${a.reportingPeriod ? ` — ${a.reportingPeriod}` : ''}`,
    meta: baseMeta(m, [['Methodology', r.methodology.version], ['Status', a.status]]),
    blocks: [
      { kind: 'p', text: `Overall ${r.overall ?? '—'}${r.rating ? ` — ${r.rating.level}` : ''} · completeness ${r.completeness}%` },
      { kind: 'table', table: { title: 'Pillars', sheet: 'Pillars', columns: [{ header: 'Pillar', width: 3 }, { header: 'Weight %', width: 0.7 }, { header: 'Score', width: 0.7 }, { header: 'Rating', width: 1 }, { header: 'Scored / applicable', width: 1 }],
        rows: r.pillars.map((p) => [p.name, p.weight, pct(p.score), p.rating?.level ?? '', `${p.scored}/${p.applicable}`]) } },
      { kind: 'table', table: { title: 'Recommendations', sheet: 'Recommendations', columns: [{ header: 'Criterion', width: 0.7 }, { header: 'Name', width: 1.8 }, { header: 'Effective score', width: 0.7 }, { header: 'Priority', width: 0.7 }, { header: 'Recommended action', width: 3 }, { header: 'Evidence of completion', width: 2 }],
        rows: r.recommendations.map((x) => [x.criterionId, x.criterion, x.effectiveScore, x.priority, x.action, x.evidence.join('; ')]) } },
    ],
    footer: LIMITS,
  }
}

export function catalogueScorecardDoc(r: CatalogueScore, a: { version: number; reportingPeriod: string; status: string; label: string }, m: Meta): ExportDoc {
  return {
    title: `${a.label} v${a.version}${a.reportingPeriod ? ` — ${a.reportingPeriod}` : ''}`,
    meta: baseMeta(m, [['Basis', r.catalogue.version], ['Source', r.catalogue.source.title], ['Status', a.status]]),
    blocks: [
      { kind: 'p', text: `Overall ${r.overall ?? '—'}% · completeness ${r.completeness}%${r.sdg ? ` · ${r.sdg.indicator}: ${r.sdg.value ?? '—'}%` : ''}` },
      { kind: 'p', text: r.catalogue.disclaimer },
      { kind: 'table', table: { title: 'Sections', sheet: 'Sections', columns: [{ header: 'Section', width: 3 }, { header: 'Score %', width: 0.8 }, { header: 'Scored / applicable', width: 1 }],
        rows: r.sections.map((s) => [s.name, pct(s.percent), `${s.scored}/${s.total}`]) } },
      { kind: 'table', table: { title: 'Items', sheet: 'Items', columns: [{ header: 'ID', width: 0.6 }, { header: 'Item', width: 3 }, { header: 'Critical', width: 0.6 }, { header: 'Level', width: 0.6 }, { header: 'Effective', width: 0.7 }, { header: 'Evidence', width: 0.7 }, { header: 'N/A', width: 0.5 }, { header: '%', width: 0.6 }],
        rows: r.items.map((i) => [i.id, i.name, i.critical ? 'yes' : '', i.score, i.effective, i.evidence ? 'yes' : '', i.notApplicable ? 'yes' : '', pct(i.percent)]) } },
    ],
    footer: LIMITS,
  }
}

export function domainScorecardDoc(r: { overallTier: number; risk: string | null; pillars: Record<string, { avgTier: number; domains: number }>; domains: { pillar: string; domain: string; tier: number }[] }, a: { assessmentType: string; version: number; status: string }, m: Meta): ExportDoc {
  return {
    title: `${a.assessmentType} governance assessment v${a.version}`,
    meta: baseMeta(m, [['Status', a.status]]),
    blocks: [
      { kind: 'p', text: `Overall tier ${r.overallTier.toFixed(1)} · risk classification ${r.risk ?? 'not scored'}. Shared governance-domain scoring, not a specialised ISO or COSO rubric.` },
      { kind: 'table', table: { title: 'Pillars', sheet: 'Pillars', columns: [{ header: 'Pillar', width: 2 }, { header: 'Average tier', width: 1 }, { header: 'Domains scored', width: 1 }], rows: Object.entries(r.pillars).map(([p, v]) => [p, Math.round(v.avgTier * 10) / 10, v.domains]) } },
      { kind: 'table', table: { title: 'Domains', sheet: 'Domains', columns: [{ header: 'Pillar', width: 1.5 }, { header: 'Domain', width: 2.5 }, { header: 'Tier', width: 0.6 }], rows: r.domains.map((d) => [d.pillar, d.domain, d.tier]) } },
    ],
    footer: LIMITS,
  }
}
