import { useMemo, useState } from 'react'
import { Calculator, Plus, Trash2 } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useScoresCtx, useWorkspace } from '../lib/context'
import { useLegacyAssessment } from '../lib/legacy-assessment'
import { useModuleProfile } from '../lib/moduleProfile'
import { derivePlan } from '../lib/moduleFindings'
import { CIP_PLAN_MONTHS_DEFAULT } from '../lib/data'
import { FOUNDATION_MODULES } from '../lib/foundationModules'
import {
  costOfGap, FAIR_WORDING, LOSS_FORMS, rangeProblems, rankByCostOfGap, simulate, type LossForm, type Range, type Scenario,
} from '../lib/fairRisk'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../components/ui'

// Quantified risk (indices spec §8): a loss-quantification method aligned with Open FAIR. Inputs and results are the
// organisation's own; other organisations see them only with its consent (enforced by /api/legacy-state).

const ZERO: Range = { min: 0, likely: 0, max: 0 }
const blank = (): Scenario => ({
  id: `sc_${Math.random().toString(36).slice(2, 10)}`, name: 'New scenario', asset: '', threat: '', effect: '', indicatorIds: [],
  tef: { min: 1, likely: 1, max: 2 }, vulnerability: { min: 0.1, likely: 0.2, max: 0.4 },
  losses: Object.fromEntries(LOSS_FORMS.map((f) => [f.key, ZERO])) as Record<LossForm, Range>,
})
const money = (n: number, cur = '') => `${cur}${Math.round(n).toLocaleString()}`
const SEED = 20261019

const LINKABLE = FOUNDATION_MODULES.filter((m) => m.id === 'craft-fiduciary' || m.id === 'craft-resilience')
  .flatMap((m) => m.indicators.map((i) => ({ value: i.id, label: `${i.id} ${i.question}`.slice(0, 100) })))

export function RiskQuantPage() {
  const { currentOrg, readOnly, isViewingClient } = useWorkspace()
  const { scores } = useScoresCtx()
  const [scenarios, setScenarios] = useLegacyAssessment<Scenario[]>('fair:scenarios', [])
  const [consent, setConsent] = useLegacyAssessment<boolean>('fair:consent', false)
  const [moduleProfile] = useModuleProfile()
  const [openId, setOpenId] = useState<string | null>(null)
  const list = Array.isArray(scenarios) ? scenarios : []
  const plan = useMemo(() => derivePlan(currentOrg ? scores[currentOrg.id] || {} : {}, moduleProfile, CIP_PLAN_MONTHS_DEFAULT), [currentOrg, scores, moduleProfile])
  const ready = list.filter((s) => rangeProblems(s).length === 0)
  const ranking = useMemo(() => rankByCostOfGap(ready, { seed: SEED }), [ready])
  const update = (s: Scenario) => setScenarios(list.map((x) => (x.id === s.id ? s : x)))

  if (isViewingClient && !consent) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-slate-600">
        This organisation has not shared its quantified-risk figures. They hold financial estimates, so they are shown to others only with the organisation's consent.
      </CardContent></Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><Calculator className="h-4 w-4 text-emerald-600" /> Quantified risk</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">What could a risk cost, and what is fixing it worth?</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{FAIR_WORDING}</p>
      </div>

      <EstimationGuide />

      {!readOnly && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={consent === true} onChange={(e) => setConsent(e.target.checked)} />
              Share these figures with funders and reviewers who already have access to our workspace
            </label>
            <Button onClick={() => { const s = blank(); setScenarios([...list, s]); setOpenId(s.id) }}><Plus className="h-4 w-4" /> Add a scenario</Button>
          </CardContent>
        </Card>
      )}

      {list.length === 0 && <p className="text-sm text-slate-500">No scenarios yet. Start with a risk your Fiduciary Controls or Resilience answers flagged: for example, payroll fraud, a funder disallowing costs, or losing a key system.</p>}

      {list.map((s) => (
        <ScenarioCard key={s.id} s={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)}
          onChange={update} onDelete={() => setScenarios(list.filter((x) => x.id !== s.id))} readOnly={readOnly}
          actions={plan.map((a) => ({ value: a.id, label: `${a.id} ${a.mitigation}`.slice(0, 100) }))} />
      ))}

      {ranking.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Cost of the gap: which fixes pay back most</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Scenario</th><th>Plan action</th><th>Likely annual loss now</th><th>After the fix</th><th>Avoided each year</th><th>Fix cost</th><th>Avoided per unit of cost</th></tr></thead>
              <tbody>{ranking.map((g) => {
                const s = list.find((x) => x.id === g.scenarioId)!
                return (
                  <tr key={g.scenarioId} className="border-t border-slate-100">
                    <td className="py-1">{s.name}</td><td className="font-mono text-xs">{s.fix?.actionId ?? '—'}</td>
                    <td>{money(g.open.p10, s.currency)}–{money(g.open.p90, s.currency)}</td><td>{money(g.fixed.p10, s.currency)}–{money(g.fixed.p90, s.currency)}</td>
                    <td>{money(g.reduction, s.currency)}</td><td>{money(g.cost, s.currency)}</td><td>{g.ratio ?? '—'}</td>
                  </tr>
                )
              })}</tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">Ranges are the 10th to 90th percentile of {ranking[0].open.runs.toLocaleString()} simulated years. "Avoided each year" compares the averages. Estimates only: they rest on the ranges entered.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function EstimationGuide() {
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <summary className="cursor-pointer font-semibold text-emerald-900">How to estimate (read this first)</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Describe one scenario: <strong>what is at risk</strong> (the asset), <strong>what acts against it</strong> (the threat) and <strong>what happens</strong> (the effect). One scenario, one story.</li>
        <li>Give every number as a range: the lowest you would believe, the most likely, and the highest you would believe. A wide honest range beats a precise guess.</li>
        <li><strong>Threat event frequency</strong>: how many times a year the threat acts (attempts, occurrences). Use your incident logs and audit findings.</li>
        <li><strong>Vulnerability</strong>: the chance, from 0 to 1, that an attempt becomes a loss with your current controls. Your Fiduciary Controls answers are a guide: weak controls mean a higher chance.</li>
        <li><strong>Losses per event</strong>, in six forms: productivity, response, replacement, fines and penalties, competitive advantage, reputation. Leave a form at zero if it does not apply.</li>
        <li><strong>The fix</strong>: what the plan action changes (usually vulnerability) and what it costs. The same simulated years are run with and without it.</li>
        <li>Not sure? Ask a specialist validator for an assisted run. Results are never part of a validation.</li>
      </ul>
    </details>
  )
}

function RangeInput({ label, value, onChange, step = 'any', disabled }: { label: string; value: Range; onChange: (r: Range) => void; step?: string; disabled?: boolean }) {
  const set = (k: keyof Range) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value === '' ? 0 : Number(e.target.value) })
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-semibold text-slate-600">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        <Input aria-label={`${label} minimum`} placeholder="Min" type="number" step={step} min={0} value={value.min} onChange={set('min')} disabled={disabled} />
        <Input aria-label={`${label} most likely`} placeholder="Likely" type="number" step={step} min={0} value={value.likely} onChange={set('likely')} disabled={disabled} />
        <Input aria-label={`${label} maximum`} placeholder="Max" type="number" step={step} min={0} value={value.max} onChange={set('max')} disabled={disabled} />
      </div>
      <Select label="Confidence" value={value.confidence ?? 'medium'} onChange={(v) => onChange({ ...value, confidence: v as Range['confidence'] })}
        options={[{ value: 'low', label: 'Low confidence' }, { value: 'medium', label: 'Medium confidence' }, { value: 'high', label: 'High confidence' }]} />
    </fieldset>
  )
}

function ScenarioCard({ s, open, onToggle, onChange, onDelete, readOnly, actions }: {
  s: Scenario; open: boolean; onToggle: () => void; onChange: (s: Scenario) => void; onDelete: () => void; readOnly: boolean
  actions: Array<{ value: string; label: string }>
}) {
  const problems = rangeProblems(s)
  const result = useMemo(() => (problems.length ? null : simulate(s, { seed: SEED })), [JSON.stringify(s)])
  const gap = useMemo(() => (problems.length ? null : costOfGap(s, { seed: SEED })), [JSON.stringify(s)])
  const set = (patch: Partial<Scenario>) => onChange({ ...s, ...patch })
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{s.name || 'Untitled scenario'}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onToggle}>{open ? 'Close' : readOnly ? 'View inputs' : 'Edit'}</Button>
            {!readOnly && <Button size="sm" variant="outline" onClick={onDelete} aria-label={`Delete ${s.name}`}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>
        {result && (
          <p className="text-sm text-slate-700">
            Likely annual loss: <strong>{money(result.p10, s.currency)} to {money(result.p90, s.currency)}</strong> (10th to 90th percentile; median {money(result.p50, s.currency)}, average {money(result.mean, s.currency)}).
            {gap && <> After the fix: {money(gap.fixed.p10, s.currency)} to {money(gap.fixed.p90, s.currency)}, for a cost of {money(gap.cost, s.currency)}.</>}
          </p>
        )}
        {problems.length > 0 && <ul className="list-disc pl-5 text-sm text-amber-800">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Scenario name" value={s.name} onChange={(e) => set({ name: e.target.value })} disabled={readOnly} />
            <Input label="Currency symbol or code" value={s.currency ?? ''} onChange={(e) => set({ currency: e.target.value.slice(0, 6) })} disabled={readOnly} />
            <Input label="What is at risk (asset)" value={s.asset} onChange={(e) => set({ asset: e.target.value })} disabled={readOnly} />
            <Input label="What acts against it (threat)" value={s.threat} onChange={(e) => set({ threat: e.target.value })} disabled={readOnly} />
            <Input label="What happens (effect)" value={s.effect} onChange={(e) => set({ effect: e.target.value })} disabled={readOnly} />
            <Select label="Related indicator (Fiduciary Controls or Resilience)" placeholder="Choose…" value={s.indicatorIds[0] ?? ''} options={LINKABLE}
              onChange={(v) => set({ indicatorIds: v ? [v] : [] })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <RangeInput label="Threat event frequency (times a year)" value={s.tef} onChange={(r) => set({ tef: r })} disabled={readOnly} />
            <RangeInput label="Vulnerability (chance, 0 to 1)" step="0.01" value={s.vulnerability} onChange={(r) => set({ vulnerability: r })} disabled={readOnly} />
            {LOSS_FORMS.map((f) => (
              <div key={f.key}>
                <RangeInput label={`${f.label} loss per event`} value={s.losses[f.key] ?? ZERO} onChange={(r) => set({ losses: { ...s.losses, [f.key]: r } })} disabled={readOnly} />
                <p className="mt-0.5 text-xs text-slate-500">{f.hint}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-700">The fix</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Capacity Improvement Plan action" placeholder="None" value={s.fix?.actionId ?? ''} options={actions}
                onChange={(v) => set({ fix: { cost: s.fix?.cost ?? 0, ...s.fix, actionId: v || undefined } })} />
              <Input label="Estimated cost of the fix" type="number" min={0} value={s.fix?.cost ?? ''} disabled={readOnly}
                onChange={(e) => set({ fix: e.target.value === '' && !s.fix?.actionId ? undefined : { ...s.fix, cost: Number(e.target.value) || 0 } })} />
            </div>
            {s.fix && <RangeInput label="Vulnerability after the fix" step="0.01" value={s.fix.vulnerability ?? s.vulnerability} onChange={(r) => set({ fix: { ...s.fix!, vulnerability: r } })} disabled={readOnly} />}
          </div>
          <Input label="Assumptions and sources" value={s.notes ?? ''} onChange={(e) => set({ notes: e.target.value.slice(0, 2000) })} disabled={readOnly} />
          {result && (
            <div className="h-64">
              <p className="mb-1 text-xs font-semibold text-slate-600">Loss exceedance: the chance a year's loss is above each amount</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.exceedance.map((p, i) => ({ ...p, fixed: gap?.fixed.exceedance[i]?.probability }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="loss" tickFormatter={(v) => money(v)} fontSize={11} />
                  <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} fontSize={11} domain={[0, 1]} />
                  <Tooltip formatter={(v) => `${Math.round(Number(v) * 1000) / 10}%`} labelFormatter={(v) => `Loss above ${money(Number(v), s.currency)}`} />
                  <Line type="monotone" dataKey="probability" name="Gap open" stroke="#e11d48" dot={false} />
                  {gap && <Line type="monotone" dataKey="fixed" name="After the fix" stroke="#059669" dot={false} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
