import { useEffect, useMemo, useState } from 'react'
import { FileBarChart, FileText, FileSpreadsheet, Download, Printer } from 'lucide-react'
import { useAuthCtx, useWorkspace, useScoresCtx, useCIPCtx, useAuditCtx, useLensCtx, useEntityProfileCtx } from '../lib/context'
import {
  computeOrgScore, getAccreditation, DerivedFinding, answeredCount, RiskStatus,
} from '../lib/data'
import { derivePlan } from '../lib/moduleFindings'
import { useModuleProfile } from '../lib/moduleProfile'
import { useLegacyAssessment } from '../lib/legacy-assessment'
import { FOUNDATION_MODULES } from '../lib/foundationModules'
import { canSeePreview } from '../lib/frameworks'
import { EXTERNAL_FRAMEWORKS } from '../lib/crosswalk'
import { buildIndexReport } from '../lib/reports/indexReport'
import { alignmentAvailable, buildAlignmentReport } from '../lib/reports/alignmentReport'
import { buildIsoReadiness } from '../lib/reports/isoReadiness'
import { COVERAGE_LABEL } from '../lib/reports/coverage'
import { AlignmentReportView, IndexReportView, IsoReadinessView } from '../components/reports/ReportViews'
import { buildJurisdictionReport, reportJurisdictions } from '../lib/laws/jurisdictionReport'
import { LAW_AREAS, LAW_JURISDICTIONS, jurisdictionName } from '../lib/laws/types'
import { JurisdictionReportView } from '../components/reports/JurisdictionReportView'
import { Card, CardContent, CardHeader, CardTitle, Button, Toast, StatusBadge } from '../components/ui'

function csvCell(v: string | number) {
  return `"${String(v).replace(/"/g, '""')}"`
}

function exportCsv(plan: DerivedFinding[], statusOf: (id: string) => string, orgName: string, planMonths: number) {
  const header = 'ID,Topic,Domain,Tier,Severity,Score,Owner,Due,Status,Mitigation Action'
  const rows = plan.map(r =>
    [
      r.id, csvCell(r.topic), csvCell(r.domain), r.tier || '', r.severity, r.score,
      csvCell(r.owner), csvCell(r.dueDate), csvCell(statusOf(r.id)), csvCell(r.mitigation),
    ].join(','),
  )
  const meta = `CRAFT ${planMonths}-Month Capacity Plan,${csvCell(orgName)}`
  const blob = new Blob([[meta, '', header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'CRAFT_Capacity_Plan.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function exportAlignmentCsv(r: ReturnType<typeof buildAlignmentReport>) {
  const header = 'Element,Label,Coverage,Answered,In scope,Average,Mapped question ids,Why mapped'
  const rows = r.elements.map(e => [e.id, csvCell(e.label), csvCell(COVERAGE_LABEL[e.coverage]), e.answered, e.applicable, e.mean ?? '', csvCell(e.indicators.map(i => i.id).join(' ')), csvCell(e.rationale.join(' | '))].join(','))
  const blob = new Blob([[csvCell(r.title), csvCell(r.lensNote), '', header, ...rows, '', csvCell(r.footer)].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `CRAFT_Alignment_${r.framework.id}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportJurisdictionCsv(r: ReturnType<typeof buildJurisdictionReport>) {
  const header = 'Jurisdiction,Area,Law,Citation,Regulator,Rating,Answered,In scope,Source kind,Source,Checked'
  const rows = r.sections.flatMap(s => s.areas.flatMap(a => a.laws.map(l => [csvCell(s.name), csvCell(LAW_AREAS[a.area]), csvCell(l.entry.title), csvCell(l.entry.citation), csvCell(l.entry.regulator ?? ''),
    csvCell(l.coverage === 'no-law' ? 'No national law' : COVERAGE_LABEL[l.coverage]), l.answered, l.applicable, l.entry.source.kind, csvCell(l.entry.source.url), l.entry.source.checked].join(','))))
  const blob = new Blob([[csvCell(r.title), csvCell(r.version), csvCell(r.lensNote), '', header, ...rows, '', csvCell(r.footer)].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'CRAFT_Jurisdiction_Alignment.csv'
  a.click()
  URL.revokeObjectURL(url)
}

type PrintTarget = 'summary' | 'index' | 'alignment' | 'iso' | 'jurisdiction' | null
const ISO_IDS = EXTERNAL_FRAMEWORKS.filter(f => f.owner === 'ISO')

export function ReportsPage() {
  const { currentUser } = useAuthCtx()
  const { currentOrg } = useWorkspace()
  const { scores, implementationEvidence } = useScoresCtx()
  const { cipStatuses, planMonths } = useCIPCtx()
  const { logActivity } = useAuditCtx()
  const orgScores = currentOrg ? scores[currentOrg.id] || {} : {}
  const composite = computeOrgScore(orgScores)
  const accred = getAccreditation(composite, implementationEvidence)
  const [moduleProfile] = useModuleProfile()
  const plan = useMemo(() => derivePlan(orgScores, moduleProfile, planMonths), [orgScores, planMonths, moduleProfile])
  const criticals = plan.filter(p => p.severity === 'Critical')
  const answered = answeredCount(orgScores)
  const [toast, setToast] = useState<string | null>(null)
  const statusOf = (id: string): RiskStatus => cipStatuses[id] ?? 'To-be-Initiated'
  // The organisation whose data is shown (a consultant viewing a client sees the client's name).
  const orgName = currentOrg?.name ?? currentUser?.orgName ?? 'Workspace'

  // New reports draw on every assessment: core and indices (one score map), the ladder and ESG (their own stores).
  const [ladderScores] = useLegacyAssessment<Record<string, number>>('capital:scores', {})
  const [esgScores] = useLegacyAssessment<Record<string, number>>('esg:scores', {})
  const { activeLenses } = useLensCtx()
  const lenses = useMemo(() => Object.entries(activeLenses).filter(([, on]) => on).map(([k]) => k), [activeLenses])
  const allScores = useMemo(() => ({ ...orgScores, ...ladderScores, ...esgScores }), [orgScores, ladderScores, esgScores])
  const modules = FOUNDATION_MODULES.filter(m => !m.preview || canSeePreview(currentUser?.role))
  const alignable = EXTERNAL_FRAMEWORKS.filter(f => f.owner !== 'ISO' && alignmentAvailable(f.id))
  const [indexId, setIndexId] = useState('')
  const [frameworkId, setFrameworkId] = useState('')
  const [isoIds, setIsoIds] = useState<string[]>([])
  const indexReport = useMemo(() => {
    const m = modules.find(x => x.id === indexId)
    return m ? buildIndexReport(m, allScores, moduleProfile, planMonths) : null
  }, [indexId, allScores, moduleProfile, planMonths])
  const alignment = useMemo(() => (frameworkId ? buildAlignmentReport(frameworkId, allScores, moduleProfile, lenses) : null), [frameworkId, allScores, moduleProfile, lenses])
  const iso = useMemo(() => (isoIds.length ? buildIsoReadiness(isoIds, allScores, moduleProfile, lenses) : null), [isoIds, allScores, moduleProfile, lenses])
  // Jurisdiction alignment starts from the organisation's home country and listed jurisdictions; the user can change the list.
  const { entityProfile } = useEntityProfileCtx()
  const [lawJurisdictions, setLawJurisdictions] = useState<string[] | null>(null)
  const chosenJurisdictions = lawJurisdictions ?? reportJurisdictions(entityProfile.country, entityProfile.jurisdictions)
  const [showLaws, setShowLaws] = useState(false)
  const lawKey = chosenJurisdictions.join()
  const lawReport = useMemo(() => (showLaws && lawKey ? buildJurisdictionReport(lawKey.split(','), allScores, moduleProfile, lenses) : null),
    [showLaws, lawKey, allScores, moduleProfile, lenses])
  const toggleJurisdiction = (j: string, on: boolean) => setLawJurisdictions(on ? [...chosenJurisdictions, j] : chosenJurisdictions.filter(x => x !== j))

  // Print only the chosen report: everything else on the page is hidden while printing.
  const [printTarget, setPrintTarget] = useState<PrintTarget>(null)
  useEffect(() => {
    if (!printTarget) return
    const done = () => setPrintTarget(null)
    window.addEventListener('afterprint', done)
    // print() returns once the dialog closes; resetting here too lets the same report print again where afterprint never fires.
    const t = window.setTimeout(() => { window.print(); done() }, 50)
    return () => { window.clearTimeout(t); window.removeEventListener('afterprint', done) }
  }, [printTarget])
  const hideUnless = (t: PrintTarget) => (printTarget && printTarget !== t ? 'print:hidden' : '')
  const printReport = (t: Exclude<PrintTarget, null>, label: string) => { logActivity('Exported report', label, 'Export'); setPrintTarget(t) }

  return (
    <div className="space-y-6">
      <div className={printTarget ? 'print:hidden' : ''}>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
          <FileBarChart className="h-4 w-4 text-emerald-600" /> Export Center
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Reports &amp; Exports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every export is built from your own assessment answers, with owners, due dates, and statuses included.
        </p>
      </div>

      {answered === 0 && (
        <Card className="print:hidden">
          <CardContent className="p-6 text-sm text-slate-500">
            Complete your assessment first. Reports populate automatically once you have answered questions.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2 print:hidden">
        <Card>
          <CardContent className="p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-emerald-900">Executive Summary (print / PDF)</h3>
            <p className="mt-1 text-sm text-slate-500">
              Board-ready brief: accreditation level, composite score, and your top critical risks.
            </p>
            <Button
              className="mt-4"
              disabled={answered === 0}
              onClick={() => { printReport('summary', 'Executive Summary (PDF)'); setToast('🔒 Executive Summary prepared (print to PDF).') }}
            >
              <Printer className="h-4 w-4" /> Print / Save as PDF
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-emerald-900">Capacity Plan (CSV)</h3>
            <p className="mt-1 text-sm text-slate-500">
              Full {planMonths}-month plan with owners, due dates, and mitigation statuses ({plan.length} actions).
            </p>
            <Button
              className="mt-4"
              variant="outline"
              disabled={plan.length === 0}
              onClick={() => { exportCsv(plan, statusOf, orgName, planMonths); logActivity('Exported report', 'Capacity Plan (CSV)', 'Export'); setToast('✅ Capacity Plan exported as CSV.') }}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* New reports: choose, view, print */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4 print:hidden">
        <Card>
          <CardContent className="space-y-3 p-6">
            <h3 className="font-display text-lg font-bold text-emerald-900">Index report</h3>
            <p className="text-sm text-slate-500">Band, dimension scores, weakest answers and the plan actions an index created.</p>
            <label className="block text-xs font-medium text-slate-600" htmlFor="rep-index">Index</label>
            <select id="rep-index" className="w-full rounded-lg border border-slate-300 p-2 text-sm" value={indexId} onChange={e => setIndexId(e.target.value)}>
              <option value="">Choose an index</option>
              {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <h3 className="font-display text-lg font-bold text-emerald-900">Framework alignment</h3>
            <p className="text-sm text-slate-500">How your answers line up with each element of a framework funders and regulators use.</p>
            <label className="block text-xs font-medium text-slate-600" htmlFor="rep-fw">Framework</label>
            <select id="rep-fw" className="w-full rounded-lg border border-slate-300 p-2 text-sm" value={frameworkId} onChange={e => setFrameworkId(e.target.value)}>
              <option value="">Choose a framework</option>
              {alignable.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {alignment && <Button variant="outline" size="sm" onClick={() => { exportAlignmentCsv(alignment); logActivity('Exported report', `Alignment (CSV): ${alignment.framework.name}`, 'Export') }}><Download className="h-4 w-4" /> Export CSV</Button>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <h3 className="font-display text-lg font-bold text-emerald-900">ISO certification readiness</h3>
            <p className="text-sm text-slate-500">Choose the standards you are working towards.</p>
            <fieldset className="max-h-48 space-y-1 overflow-y-auto text-sm">
              <legend className="sr-only">ISO standards</legend>
              {ISO_IDS.map(f => (
                <label key={f.id} className="flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5 accent-emerald-600" checked={isoIds.includes(f.id)}
                    onChange={e => setIsoIds(e.target.checked ? [...isoIds, f.id] : isoIds.filter(x => x !== f.id))} />
                  <span>{f.name}{f.kind === 'guidance' ? ' (guidance, for reference)' : f.kind === 'verified' ? ' (verified)' : ''}</span>
                </label>
              ))}
            </fieldset>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <h3 className="font-display text-lg font-bold text-emerald-900">Jurisdiction alignment</h3>
            <p className="text-sm text-slate-500">Laws that apply where you are registered and operate, and how far your answers show readiness. Information, not legal advice.</p>
            <fieldset className="max-h-48 space-y-1 overflow-y-auto text-sm">
              <legend className="sr-only">Jurisdictions</legend>
              {LAW_JURISDICTIONS.map(j => (
                <label key={j} className="flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5 accent-emerald-600" checked={chosenJurisdictions.includes(j)} onChange={e => toggleJurisdiction(j, e.target.checked)} />
                  <span>{jurisdictionName(j)}</span>
                </label>
              ))}
            </fieldset>
            {chosenJurisdictions.length === 0 && <p className="text-xs text-amber-700">Choose at least one jurisdiction.</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={chosenJurisdictions.length === 0} onClick={() => setShowLaws(true)}>View report</Button>
              {lawReport && <Button variant="outline" size="sm" onClick={() => { exportJurisdictionCsv(lawReport); logActivity('Exported report', 'Jurisdiction alignment (CSV)', 'Export') }}><Download className="h-4 w-4" /> Export CSV</Button>}
            </div>
          </CardContent>
        </Card>
      </div>

      {indexReport && <div className={hideUnless('index')}><IndexReportView r={indexReport} org={orgName} onPrint={() => printReport('index', `Index report: ${indexReport.title}`)} /></div>}
      {alignment && <div className={hideUnless('alignment')}><AlignmentReportView r={alignment} org={orgName} onPrint={() => printReport('alignment', `Alignment: ${alignment.framework.name}`)} /></div>}
      {iso && <div className={hideUnless('iso')}><IsoReadinessView r={iso} org={orgName} onPrint={() => printReport('iso', 'ISO certification readiness')} /></div>}
      {lawReport && <div className={hideUnless('jurisdiction')}><JurisdictionReportView r={lawReport} org={orgName} onPrint={() => printReport('jurisdiction', 'Jurisdiction alignment')} /></div>}

      {/* Printable executive summary */}
      <Card className={`print:shadow-none print:border-0 ${hideUnless('summary')}`}>
        <CardHeader>
          <CardTitle>Executive Summary: {orgName}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-400">Accreditation</p>
              <p className={`text-2xl font-bold ${accred.color}`}>Level {accred.level}</p>
              <p className="text-xs text-slate-500">{accred.label}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-400">Composite Score</p>
              <p className="text-2xl font-bold text-emerald-900">{composite}%</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-400">High-score execution proxy (not verified evidence)</p>
              <p className="text-2xl font-bold text-emerald-900">{implementationEvidence}%</p>
            </div>
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Top Critical Risks ({criticals.length})
          </p>
          <div className="mt-2 space-y-2">
            {criticals.length === 0 && (
              <p className="text-sm text-slate-400">No critical risks identified from the current answers.</p>
            )}
            {criticals.map(r => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2">
                <span className="text-sm text-slate-700"><span className="font-mono text-xs font-bold">{r.id}</span> · {r.topic} · {r.domain}</span>
                <StatusBadge status={statusOf(r.id)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
