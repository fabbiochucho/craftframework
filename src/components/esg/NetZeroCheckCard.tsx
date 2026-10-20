import { useState } from 'react'
import { Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Input } from '../ui'
import { useLegacyAssessment } from '../../lib/legacy-assessment'
import { BENCHMARKS, checkTarget, targetFromSaved, type SavedTarget, type TargetInput } from '../../lib/netZero'

// Net-zero target check: how a stated Scope 1 and 2 target compares with dated 1.5°C benchmarks. Indicative only.
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

export function NetZeroCheckCard() {
  const [saved, setSaved] = useLegacyAssessment<SavedTarget>('esg:netzero', {})
  const s = saved && typeof saved === 'object' ? saved : {}
  const [open, setOpen] = useState(false)
  const set = (k: keyof TargetInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSaved({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value === '' ? undefined : Number(e.target.value) })
  const input = targetFromSaved(s)
  const started = input.baseYear > 0 || input.targetReductionPct > 0
  const r = checkTarget(input)
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2"><Target className="h-4 w-4 text-emerald-600" /> Net-zero target check</CardTitle>
          <button type="button" className="text-sm text-emerald-700 underline" onClick={() => setOpen(!open)}>{open ? 'Hide' : started ? 'Edit' : 'Check a target'}</button>
        </div>
        <p className="text-sm text-slate-600">How your Scope 1 and 2 target compares with 1.5°C benchmarks. Indicative only; it is not an SBTi validation.</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {open && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Base year" type="number" value={num(s.baseYear) ?? ''} onChange={set('baseYear')} />
            <Input label="Base-year Scope 1+2 emissions (tCO2e)" type="number" min={0} value={num(s.baseEmissions) ?? ''} onChange={set('baseEmissions')} />
            <Input label="Target year" type="number" value={num(s.targetYear) ?? ''} onChange={set('targetYear')} />
            <Input label="Reduction by target year (%)" type="number" min={0} max={100} value={num(s.targetReductionPct) ?? ''} onChange={set('targetReductionPct')} />
            <Input label="Net-zero year (optional)" type="number" value={num(s.netZeroYear) ?? ''} onChange={set('netZeroYear')} />
            <Input label="Long-term reduction (%, optional)" type="number" min={0} max={100} value={num(s.longTermReductionPct) ?? ''} onChange={set('longTermReductionPct')} />
            <label className="flex items-center gap-2 sm:col-span-3">
              <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={s.creditsCountedTowardsTarget === true} onChange={set('creditsCountedTowardsTarget')} />
              Carbon credits are counted towards this target
            </label>
          </div>
        )}
        {started && (r.verdict === 'invalid'
          ? <ul className="list-disc pl-5 text-amber-800">{r.problems.map((p) => <li key={p}>{p}</li>)}</ul>
          : (
            <div className="space-y-1">
              <p className={r.verdict === 'aligned' ? 'text-emerald-800' : 'text-amber-800'}>
                {r.annualRatePct}% a year on a straight line. {r.verdict === 'aligned'
                  ? `This meets the ${BENCHMARKS.sbtiNearTerm.annualRatePct}% a year near-term benchmark.`
                  : `This is ${r.gapPct} percentage points short of the ${BENCHMARKS.sbtiNearTerm.annualRatePct}% a year benchmark by the target year.`}
              </p>
              {r.flags.map((f) => <p key={f} className="text-amber-800">{f}</p>)}
            </div>
          ))}
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">About the benchmarks</summary>
          {Object.values(BENCHMARKS).map((b) => (
            <p key={b.label} className="mt-1"><strong>{b.label}.</strong> {b.note} <a href={b.source} target="_blank" rel="noreferrer" className="underline">Source</a> (checked {b.asOf}).</p>
          ))}
        </details>
      </CardContent>
    </Card>
  )
}
