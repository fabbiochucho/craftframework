// The organisation's ESG maturity stage and what it needs to reach the next one.
import { Card, CardContent, CardHeader, CardTitle } from '../ui'
import { ESG_STAGES, stageLabel, type EsgMaturity } from '../../lib/esgMaturity'
import { TNFD_STATUS_NOTE } from '../../lib/crosswalk'

export function EsgMaturityCard({ m }: { m: EsgMaturity }) {
  const current = ESG_STAGES.find((s) => s.n === m.stage)
  return (
    <Card>
      <CardHeader><CardTitle>ESG maturity journey</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <ol className="grid gap-2 sm:grid-cols-5" aria-label="ESG maturity stages">
          {ESG_STAGES.map((s) => (
            <li key={s.n} className={`rounded-lg border p-3 text-sm ${s.n <= m.stage ? `border-emerald-300 bg-emerald-50 text-emerald-900${m.provisional ? ' border-dashed' : ''}` : 'border-slate-200 text-slate-500'}`}
              aria-current={s.n === m.stage ? 'step' : undefined}>
              <p className="text-xs font-semibold uppercase">Stage {s.n}</p>
              <p className="font-semibold">{s.name}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-slate-700"><strong>{stageLabel(m)}</strong>{current ? `. ${current.summary}` : '.'}</p>
        {m.next && m.missing.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-800">To reach Stage {m.next.n}: {m.next.name}</h3>
            <ul className="mt-1 space-y-1 text-sm text-slate-700">
              {m.missing.map((q) => <li key={q.id}><span className="font-mono text-xs">{q.id}</span> · {q.recommendation}</li>)}
            </ul>
          </div>
        )}
        {m.unanswered > 0 && <p className="text-xs text-slate-500">{m.unanswered} stage question{m.unanswered === 1 ? '' : 's'} not yet answered.</p>}
        <p className="text-xs text-slate-500">Nature questions follow the TNFD approach. {TNFD_STATUS_NOTE}</p>
      </CardContent>
    </Card>
  )
}
