import { useMemo, useState } from 'react'
import { FileBarChart, FileText, FileSpreadsheet, Download, Printer } from 'lucide-react'
import { useApp } from '../lib/context'
import {
  deriveFindings, computeOrgScore, getAccreditation, DerivedFinding, answeredCount, RiskStatus,
} from '../lib/data'
import { Card, CardContent, CardHeader, CardTitle, Button, Toast, StatusBadge } from '../components/ui'

function csvCell(v: string | number) {
  return `"${String(v).replace(/"/g, '""')}"`
}

function exportCsv(plan: DerivedFinding[], statusOf: (id: string) => string, orgName: string) {
  const header = 'ID,Topic,Domain,Tier,Severity,Score,Owner,Due,Status,Mitigation Action'
  const rows = plan.map(r =>
    [
      r.id, csvCell(r.topic), csvCell(r.domain), r.tier, r.severity, r.score,
      csvCell(r.owner), csvCell(r.dueDate), csvCell(statusOf(r.id)), csvCell(r.mitigation),
    ].join(','),
  )
  const meta = `CRAFT 24-Month Capacity Plan,${csvCell(orgName)}`
  const blob = new Blob([[meta, '', header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'CRAFT_Capacity_Plan.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportsPage() {
  const { currentUser, currentOrg, scores, cipStatuses, implementationEvidence, logActivity } = useApp()
  const orgScores = currentOrg ? scores[currentOrg.id] || {} : {}
  const composite = computeOrgScore(orgScores)
  const accred = getAccreditation(composite, implementationEvidence)
  const plan = useMemo(() => deriveFindings(orgScores), [orgScores])
  const criticals = plan.filter(p => p.severity === 'Critical')
  const answered = answeredCount(orgScores)
  const [toast, setToast] = useState<string | null>(null)
  const statusOf = (id: string): RiskStatus => cipStatuses[id] ?? 'To-be-Initiated'

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
          <FileBarChart className="h-4 w-4 text-emerald-600" /> Export Center
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Reports &amp; Exports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every export is built from your own assessment answers, with owners, due dates, and statuses included.
        </p>
      </div>

      {answered === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            Complete your assessment first. Reports populate automatically once you have answered questions.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-emerald-900">Executive Summary (PDF)</h3>
            <p className="mt-1 text-sm text-slate-500">
              Board-ready brief: accreditation level, composite score, and your top critical risks.
            </p>
            <Button
              className="mt-4"
              disabled={answered === 0}
              onClick={() => { logActivity('Exported report', 'Executive Summary (PDF)', 'Export'); window.print(); setToast('🔒 Executive Summary prepared (print to PDF).') }}
            >
              <Printer className="h-4 w-4" /> Generate PDF
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-emerald-900">Capacity Plan (Excel)</h3>
            <p className="mt-1 text-sm text-slate-500">
              Full 24-month plan with owners, due dates, and mitigation statuses ({plan.length} actions).
            </p>
            <Button
              className="mt-4"
              variant="outline"
              disabled={plan.length === 0}
              onClick={() => { exportCsv(plan, statusOf, currentUser?.orgName ?? 'Workspace'); logActivity('Exported report', 'Capacity Plan (Excel/CSV)', 'Export'); setToast('✅ Capacity Plan exported (CSV/Excel).') }}
            >
              <Download className="h-4 w-4" /> Export Excel
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Printable executive summary */}
      <Card className="print:shadow-none print:border-0">
        <CardHeader>
          <CardTitle>Executive Summary: {currentUser?.orgName}</CardTitle>
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
              <p className="text-xs uppercase text-slate-400">Implementation Evidence</p>
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
