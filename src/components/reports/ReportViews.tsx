// Printable views for the index, framework alignment and ISO readiness reports. Data comes from the pure builders in
// src/lib/reports; these components only lay it out. Every table keeps a text label next to colour.
import { Printer } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '../ui'
import { COVERAGE_LABEL, type Coverage } from '../../lib/reports/coverage'
import type { IndexReport } from '../../lib/reports/indexReport'
import type { AlignmentReport } from '../../lib/reports/alignmentReport'
import type { IsoReadiness } from '../../lib/reports/isoReadiness'

const COVERAGE_STYLE: Record<Coverage, string> = {
  covered: 'bg-emerald-100 text-emerald-800', partial: 'bg-amber-100 text-amber-800', gap: 'bg-rose-100 text-rose-800', 'gap-limited': 'bg-rose-50 text-rose-700',
  'not-assessed': 'bg-slate-100 text-slate-700', 'not-applicable': 'bg-slate-100 text-slate-700', 'not-mapped': 'bg-slate-100 text-slate-700',
}

export function CoverageChip({ c }: { c: Coverage }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${COVERAGE_STYLE[c]}`}>{COVERAGE_LABEL[c]}</span>
}

const today = () => new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
const fmt = (n: number | null) => (n === null ? '—' : n.toFixed(2))
const LENS_STATUS_LABEL = { 'not-assessed': 'not assessed', 'at-risk': 'at risk', strained: 'strained', holds: 'holds' } as const

function Shell({ title, subtitle, org, onPrint, footer, children }: { title: string; subtitle: string; org: string; onPrint: () => void; footer?: string; children: React.ReactNode }) {
  return (
    <Card className="print:border-0 print:shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{org}</p>
            <CardTitle>{title}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{subtitle} · as of {today()}</p>
          </div>
          <Button variant="outline" onClick={onPrint} className="print:hidden"><Printer className="h-4 w-4" /> Print / Save as PDF</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {children}
        {footer && <p className="border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500">{footer}</p>}
      </CardContent>
    </Card>
  )
}

export function IndexReportView({ r, org, onPrint }: { r: IndexReport; org: string; onPrint: () => void }) {
  return (
    <Shell title={r.title} subtitle={`${r.version ?? 'CRAFT index'} · ${r.answered} of ${r.total} questions answered`} org={org} onPrint={onPrint}>
      <p className="text-sm text-slate-600">{r.question}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs uppercase text-slate-500">Band</p><p className="text-xl font-bold text-emerald-900">{r.band?.band.label ?? 'Not yet assessed'}</p>{r.band?.capReason && <p className="mt-1 text-xs text-amber-700">{r.band.capReason}</p>}</div>
        <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs uppercase text-slate-500">Composite</p><p className="text-xl font-bold text-emerald-900">{r.composite === null ? '—' : `${r.composite.toFixed(2)} / 5`}</p></div>
        <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs uppercase text-slate-500">Plan actions created</p>{r.feedsPlan
          ? <p className="text-xl font-bold text-emerald-900">{r.actions.length}</p>
          : <p className="mt-1 text-sm text-slate-600">This index does not add actions to the Capacity Improvement Plan.</p>}</div>
      </div>
      <table className="w-full text-left text-sm">
        <thead><tr className="text-xs uppercase text-slate-500"><th className="py-1 pr-3">Dimension</th><th>Score (0–5)</th></tr></thead>
        <tbody>{r.dimensions.map(d => <tr key={d.name} className="border-t border-slate-100"><td className="py-1 pr-3">{d.name}</td><td>{fmt(d.score)}</td></tr>)}</tbody>
      </table>
      {r.lenses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Lenses</h3>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">{r.lenses.map(l => (
            <li key={l.lens.key}><span className="font-semibold">{l.lens.name}</span>: {l.score === null ? 'Not assessed' : `${l.score.toFixed(2)} / 5 (${LENS_STATUS_LABEL[l.status]})`}{l.weakest ? ` · fix first: ${l.weakest.question}` : ''}</li>
          ))}</ul>
        </div>
      )}
      {r.weakest.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Weakest answers</h3>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">{r.weakest.map(w => <li key={w.id}><span className="font-mono text-xs">{w.id.replace('CRAFT-', '')}</span> · {w.question} <span className="text-slate-500">({w.score}/5)</span></li>)}</ul>
        </div>
      )}
      {r.actions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Plan actions</h3>
          <table className="mt-1 w-full text-left text-sm">
            <thead><tr className="text-xs uppercase text-slate-500"><th className="py-1 pr-3">Action</th><th className="pr-3">Owner</th><th>Due</th></tr></thead>
            <tbody>{r.actions.map(a => <tr key={a.id} className="border-t border-slate-100 align-top"><td className="py-1 pr-3">{a.mitigation}</td><td className="pr-3">{a.owner}</td><td>{a.dueDate}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Shell>
  )
}

export function AlignmentReportView({ r, org, onPrint }: { r: AlignmentReport; org: string; onPrint: () => void }) {
  return (
    <Shell title={r.title} subtitle={`${r.framework.owner} · ${r.counts.covered} covered · ${r.counts.partial} partial · ${r.counts.gap + r.counts['gap-limited']} gaps · ${r.counts['not-assessed']} not assessed`} org={org} onPrint={onPrint} footer={r.footer}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase text-slate-500"><th className="py-1 pr-3">Element</th><th className="pr-3">Coverage</th><th className="pr-3">Answered</th><th>Average (0–5)</th></tr></thead>
          <tbody>{r.elements.map(e => (
            <tr key={e.id} className="border-t border-slate-100">
              <td className="py-1 pr-3"><span className="font-mono text-xs">{e.id}</span> {e.label}</td>
              <td className="pr-3"><CoverageChip c={e.coverage} /></td>
              <td className="pr-3">{e.applicable ? `${e.answered} of ${e.applicable}` : '—'}</td>
              <td>{fmt(e.mean)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">"Covered" needs an average of 3.5 or more, and "Gap" an average below 2, each with at least half of the related questions answered; a low average on fewer answers shows as "Gap (limited evidence)". ESG questions use your self-assessed answer.</p>
      <p className="text-xs text-slate-500">{r.lensNote}</p>
      {r.statusNote && <p className="text-xs text-amber-700">{r.statusNote}</p>}
    </Shell>
  )
}

export function IsoReadinessView({ r, org, onPrint }: { r: IsoReadiness; org: string; onPrint: () => void }) {
  return (
    <Shell title="ISO certification readiness" subtitle={`${r.standards.length} standard${r.standards.length === 1 ? '' : 's'}`} org={org} onPrint={onPrint} footer={r.footer}>
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{r.statement}</p>
      <p className="text-xs text-slate-500">{r.lensNote}</p>
      {r.standards.map(s => (
        <div key={s.id} className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-800">{s.name}</h3><CoverageChip c={s.readiness} /><span className="text-xs text-slate-500">{s.answered} of {s.applicable} related questions answered</span></div>
          <p className="text-xs text-slate-500">{s.note}</p>
          {s.gaps.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Scoring below 3</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">{s.gaps.slice(0, 15).map(g => <li key={g.id}><span className="font-mono text-xs">{g.id}</span> · {g.question} <span className="text-slate-500">({g.score}/5)</span></li>)}</ul>
            </div>
          )}
        </div>
      ))}
    </Shell>
  )
}
