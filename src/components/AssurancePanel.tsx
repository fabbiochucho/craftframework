import { useState } from 'react'
import { ShieldCheck, Trash2, Plus } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from './ui'
import { useWorkspace } from '../lib/context'
import { useLegacyAssessment } from '../lib/legacy-assessment'
import {
  ASSURANCE_KEY, ASSURANCE_PHASES, ASSURANCE_STANDARDS, CONTROLS, LEVEL_LABEL, checkClaims, currentPhase, defaultItems, emptyPlan, nextStep, readiness,
  type AssuranceItem, type AssuranceLevel, type AssurancePlan,
} from '../lib/assurance'
import { DMA_KEY, dmaResult, emptyAssessment, type DmaAssessment } from '../lib/dma'

const LEVELS = (['none', 'limited', 'reasonable'] as AssuranceLevel[]).map((l) => ({ value: l, label: LEVEL_LABEL[l] }))

// Sustainability assurance readiness: level per item (current and target), standard, controls, roadmap and a
// wording check for how assurance is described. Stored per tenant; the page is analytics-sensitive.
export function AssurancePanel() {
  const { readOnly } = useWorkspace()
  const [saved, setSaved] = useLegacyAssessment<AssurancePlan>(ASSURANCE_KEY, emptyPlan)
  const [dma] = useLegacyAssessment<DmaAssessment>(DMA_KEY, emptyAssessment)
  const [claim, setClaim] = useState('')
  const plan: AssurancePlan = { ...emptyPlan(), ...(saved && typeof saved === 'object' ? saved : {}) }
  const set = (items: AssuranceItem[]) => !readOnly && setSaved({ ...plan, items })
  const setItem = (id: string, patch: Partial<AssuranceItem>) => set(plan.items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const material = () => dmaResult({ ...emptyAssessment(), ...(dma && typeof dma === 'object' ? dma : {}) }).material.map((m) => (m.topic === 'entity' ? m.name : `${m.name} (${m.topic})`))
  const phase = currentPhase(plan)
  const flags = claim.trim() ? checkClaims(claim, plan) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Assurance readiness</CardTitle>
        <p className="text-sm text-slate-600">Plan limited and reasonable assurance for your sustainability information. Limited assurance is a meaningful conclusion with fewer procedures than reasonable assurance; it is not an audit. CRAFT shows readiness, never an assurance opinion.</p>
      </CardHeader>
      <CardContent>
        <fieldset disabled={readOnly} className="space-y-5 text-sm">
          <section>
            <h3 className="mb-2 font-semibold text-slate-800">Roadmap</h3>
            <ol className="space-y-1">
              {ASSURANCE_PHASES.map((ph) => (
                <li key={ph.n} className={phase >= ph.n ? 'text-emerald-700' : 'text-slate-600'}>{phase >= ph.n ? '✓' : `${ph.n}.`} {ph.name}</li>
              ))}
            </ol>
            <p className="mt-2 text-slate-700">{nextStep(plan)}</p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-slate-800">Items</h3>
            <div className="flex flex-wrap gap-2">
              {plan.items.length === 0 && <Button size="sm" variant="outline" onClick={() => set(defaultItems(material()))}>Start with the report, emissions and your material topics</Button>}
              <Button size="sm" variant="outline" onClick={() => set([...plan.items, { ...defaultItems()[1], id: `m${Date.now().toString(36)}`, name: 'New metric' }])}><Plus className="h-3 w-3" /> Add a metric</Button>
            </div>
            <ul className="space-y-3">
              {plan.items.map((i) => {
                const r = readiness(i)
                const short = r.ready !== 'reasonable' && i.target === 'reasonable' ? r.missingForReasonable : i.target === 'limited' && r.ready === 'none' ? r.missingForLimited : []
                return (
                  <li key={i.id} className="rounded border border-slate-200 p-3">
                    <div className="grid gap-2 sm:grid-cols-6">
                      <div className="sm:col-span-2"><Input label="Item" value={i.name} onChange={(e) => setItem(i.id, { name: e.target.value })} /></div>
                      <Select label="Current" value={i.current} onChange={(v) => setItem(i.id, { current: v as AssuranceLevel })} options={LEVELS} />
                      <Select label="Target" value={i.target} onChange={(v) => setItem(i.id, { target: v as AssuranceLevel })} options={LEVELS} />
                      <Input label="Target year" type="number" value={i.targetYear ?? ''} onChange={(e) => setItem(i.id, { targetYear: e.target.value ? Number(e.target.value) : undefined })} />
                      <Select label="Standard" value={i.standard ?? ''} onChange={(v) => setItem(i.id, { standard: v || undefined })} placeholder="Not chosen" options={ASSURANCE_STANDARDS.map((s) => ({ value: s, label: s }))} />
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Input label="Assurance provider" value={i.provider ?? ''} onChange={(e) => setItem(i.id, { provider: e.target.value || undefined })} />
                    </div>
                    <fieldset className="mt-2 grid gap-1 sm:grid-cols-2">
                      <legend className="text-xs text-slate-600">Controls in place</legend>
                      {CONTROLS.map((c) => (
                        <label key={c.key} className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={!!i.controls[c.key]} onChange={(e) => setItem(i.id, { controls: { ...i.controls, [c.key]: e.target.checked } })} />{c.label}{c.forLimited ? '' : <span className="text-xs text-slate-500"> (reasonable)</span>}</label>
                      ))}
                    </fieldset>
                    <p className="mt-2 text-xs text-slate-600">Controls ready for: <strong>{LEVEL_LABEL[r.ready]}</strong>{short.length ? `. Missing for the target: ${short.join('; ')}.` : '.'}</p>
                    <Button size="sm" variant="ghost" onClick={() => set(plan.items.filter((x) => x.id !== i.id))}><Trash2 className="h-3 w-3" /> Remove</Button>
                  </li>
                )
              })}
            </ul>
          </section>
        </fieldset>

        <section className="mt-5 space-y-2 text-sm">
          <h3 className="font-semibold text-slate-800">Check how you describe your assurance</h3>
          <Input label="Paste a sentence from your report or website" value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="e.g. Our sustainability report was independently assured." />
          {claim.trim() && (flags.length
            ? <ul className="list-disc pl-5 text-amber-800">{flags.map((f) => <li key={f}>{f}</li>)}</ul>
            : <p className="text-emerald-700">No problems found with this wording.</p>)}
        </section>
      </CardContent>
    </Card>
  )
}
