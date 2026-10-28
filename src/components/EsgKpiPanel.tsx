import { Calculator } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Input, Select } from './ui'
import { useWorkspace } from '../lib/context'
import { useLegacyAssessment } from '../lib/legacy-assessment'
import { ESG_KPIS, ESG_KPIS_KEY, INPUT_LABEL, computeKpi, type InputKey, type KpiInputs } from '../lib/esgKpis'

// ESG KPI calculator: enter the period's figures once; each KPI shows its value, formula and the boundary or
// method choice that makes it comparable. Stored per tenant; the page is analytics-sensitive.
const PILLAR = { E: 'Environmental', S: 'Social', G: 'Governance' } as const

export function EsgKpiPanel() {
  const { readOnly } = useWorkspace()
  const [saved, setSaved] = useLegacyAssessment<KpiInputs>(ESG_KPIS_KEY, {})
  const inputs: KpiInputs = saved && typeof saved === 'object' ? saved : {}
  const set = (patch: Partial<KpiInputs>) => !readOnly && setSaved({ ...inputs, ...patch })
  const num = (k: InputKey) => (e: React.ChangeEvent<HTMLInputElement>) => set({ [k]: e.target.value === '' ? undefined : Number(e.target.value) })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Calculator className="h-4 w-4 text-emerald-600" /> ESG KPI calculator</CardTitle>
        <p className="text-sm text-slate-600">Enter the period's figures; each indicator shows its formula and the choice that makes it comparable. Use one boundary for every figure. These are your own figures, not assured data.</p>
      </CardHeader>
      <CardContent>
        <fieldset disabled={readOnly} className="space-y-6 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Scope 2 method" value={inputs.scope2Method ?? ''} placeholder="Not stated" onChange={(v) => set({ scope2Method: (v || undefined) as KpiInputs['scope2Method'] })}
              options={[{ value: 'location', label: 'Location-based' }, { value: 'market', label: 'Market-based' }]} />
            <Select label="LTIFR basis" value={String(inputs.ltifrBasis ?? 1_000_000)} onChange={(v) => set({ ltifrBasis: Number(v) })}
              options={[{ value: '1000000', label: 'Per 1,000,000 hours' }, { value: '200000', label: 'Per 200,000 hours' }]} />
          </div>
          {(['E', 'S', 'G'] as const).map((p) => (
            <section key={p} className="space-y-3">
              <h3 className="font-semibold text-slate-800">{PILLAR[p]}</h3>
              {ESG_KPIS.filter((k) => k.pillar === p).map((k) => {
                const v = computeKpi(k.id, inputs)
                return (
                  <div key={k.id} className="rounded border border-slate-200 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium text-slate-900">{k.name}</p>
                      <p className="font-mono text-emerald-800">{v === null ? '—' : `${v} ${k.id === 'ltifr' ? `per ${(inputs.ltifrBasis ?? 1_000_000).toLocaleString('en')} hours` : k.unit}`}</p>
                    </div>
                    <p className="text-xs text-slate-500">{k.formula}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {k.inputs.map((n) => <Input key={n} label={INPUT_LABEL[n]} type="number" value={inputs[n] ?? ''} onChange={num(n)} />)}
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{k.note}</p>
                  </div>
                )
              })}
            </section>
          ))}
        </fieldset>
      </CardContent>
    </Card>
  )
}
