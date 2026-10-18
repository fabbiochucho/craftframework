// Printable jurisdiction alignment report. Data from src/lib/laws/jurisdictionReport.ts.
import { Printer } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '../ui'
import { CoverageChip } from './ReportViews'
import type { JurisdictionReport } from '../../lib/laws/jurisdictionReport'

export function JurisdictionReportView({ r, org, onPrint }: { r: JurisdictionReport; org: string; onPrint: () => void }) {
  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <Card className="print:border-0 print:shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{org}</p>
            <CardTitle>{r.title}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{r.version} · as of {today}</p>
          </div>
          <Button variant="outline" onClick={onPrint} className="print:hidden"><Printer className="h-4 w-4" /> Print / Save as PDF</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {r.sections.map(s => (
          <section key={s.id} className="space-y-3">
            <h3 className="font-display text-lg font-bold text-emerald-900">{s.name}</h3>
            {!s.reviewed && <p className="text-sm text-slate-500">Not yet reviewed. Laws for this jurisdiction will appear once CRAFT has checked them.</p>}
            {s.reviewed && s.pendingCount > 0 && <p className="text-xs text-amber-700">Partly reviewed: {s.pendingCount} {s.pendingCount === 1 ? 'entry is' : 'entries are'} still awaiting review and not shown.</p>}
            {s.areas.map(a => (
              <div key={a.area}>
                <p className="text-xs font-semibold uppercase text-slate-500">{a.label}</p>
                <ul className="mt-1 space-y-2">{a.laws.map(l => (
                  <li key={l.entry.id} className="rounded-lg border border-slate-100 p-3 text-sm print:break-inside-avoid">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">{l.entry.title}</span>
                      <span className="text-xs text-slate-500">{l.entry.citation}</span>
                      {l.coverage === 'no-law' ? <span className="text-xs text-slate-500">No national law in this area</span> : <CoverageChip c={l.coverage} />}
                      {l.coverage !== 'no-law' && <span className="text-xs text-slate-500">{l.answered} of {l.applicable} related questions answered</span>}
                    </div>
                    {l.entry.regulator && <p className="text-xs text-slate-500">Regulator: {l.entry.regulator}</p>}
                    <p className="mt-1 text-slate-700">{l.entry.summary}</p>
                    {l.entry.reformNote && <p className="mt-1 text-xs text-amber-700">{l.entry.reformNote}</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      <a href={l.entry.source.url} target="_blank" rel="noreferrer" className="underline">Source</a>
                      {l.entry.source.kind === 'secondary' ? ' (secondary source, verify)' : ' (official)'} · checked {l.entry.source.checked}
                    </p>
                  </li>
                ))}</ul>
              </div>
            ))}
          </section>
        ))}
        <p className="text-xs text-slate-500">{r.lensNote}</p>
        <p className="border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500">{r.footer}</p>
      </CardContent>
    </Card>
  )
}
