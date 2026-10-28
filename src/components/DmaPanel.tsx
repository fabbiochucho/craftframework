import { useMemo, useState } from 'react'
import { ResultExplainer } from './ResultExplainer'
import { Layers3, Plus, Trash2 } from 'lucide-react'
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from './ui'
import { useWorkspace } from '../lib/context'
import { useLegacyAssessment } from '../lib/legacy-assessment'
import {
  DMA_KEY, DMA_TOPICS, emptyAssessment, esrsMatters, impactScore, financialScore, isMaterial, dmaResult, likelihoodFromFair, suggestEsgG5, ESRS_VERSION_NOTE,
  type DmaAssessment, type DmaMatter, type ImpactAssessment, type FinancialAssessment, type Scale, type ValueChain,
} from '../lib/dma'
import { simulate, type Scenario } from '../lib/fairRisk'

const SCALE = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))
const num = (v: string) => Number(v) as Scale
const newId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const defaultImpact: ImpactAssessment = { kind: 'actual', effect: 'negative', scale: 3, scope: 3, irremediability: 3, valueChain: ['own'] }
const defaultFinancial: FinancialAssessment = { kind: 'risk', trigger: '', magnitude: 3, likelihood: 3 }

// ESRS double materiality assessment: matters, impact and financial scoring (or a reasoned top-down conclusion),
// two matrices, thresholds and sign-off. Stored per tenant; the route is analytics-sensitive.
export function DmaPanel() {
  const { readOnly } = useWorkspace()
  const [saved, setSaved] = useLegacyAssessment<DmaAssessment>(DMA_KEY, emptyAssessment)
  const [scenarios] = useLegacyAssessment<Scenario[]>('fair:scenarios', [])
  const a: DmaAssessment = { ...emptyAssessment(), ...(saved && typeof saved === 'object' ? saved : {}) }
  const [open, setOpen] = useState<string | null>(null)
  const [importText, setImportText] = useState('')
  const set = (patch: Partial<DmaAssessment>) => !readOnly && setSaved({ ...a, ...patch })
  const setMatter = (id: string, patch: Partial<DmaMatter>) => set({ matters: a.matters.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const result = useMemo(() => dmaResult(a), [saved])
  const g5 = suggestEsgG5(a)
  const points = (side: 'impact' | 'financial') => a.matters.flatMap((m) => {
    const s = side === 'impact' ? m.impact : m.financial
    const score = side === 'impact' ? impactScore(m.impact) : financialScore(m.financial)
    if (!s || score === null) return []
    const likelihood = side === 'impact' ? (m.impact!.kind === 'actual' ? 5 : m.impact!.likelihood ?? 1) : m.financial!.likelihood
    const y = side === 'impact' ? Math.round(((m.impact!.scale + m.impact!.scope + (m.impact!.irremediability ?? m.impact!.scale)) / 3) * 10) / 10 : m.financial!.magnitude
    return [{ name: m.name, x: likelihood, y, score }]
  })
  const linkFair = (m: DmaMatter, scenarioId: string) => {
    const s = scenarios.find((x) => x.id === scenarioId)
    const f = { ...(m.financial ?? defaultFinancial), fairScenarioId: scenarioId || undefined }
    if (s) f.likelihood = likelihoodFromFair(simulate(s, { runs: 2000, seed: 1 }).pAny)
    setMatter(m.id, { financial: f })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-emerald-600" /> Double materiality assessment (ESRS)</CardTitle>
        <p className="text-sm text-slate-600">List the sustainability matters, then score each on impact (severity and likelihood) and financial effect (magnitude and likelihood), or record a top-down conclusion with a reason. A matter is material if either score reaches its threshold. {ESRS_VERSION_NOTE}</p>
      </CardHeader>
      <CardContent>
        <fieldset disabled={readOnly} className="space-y-5 text-sm">
          <section className="space-y-2">
            <h3 className="font-semibold text-slate-800">1. Matters</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => set({ matters: [...a.matters, ...esrsMatters().filter((e) => !a.matters.some((m) => m.id === e.id))] })}>Add the ESRS topics</Button>
              <Button size="sm" variant="outline" onClick={() => set({ matters: [...a.matters, { id: newId(), topic: 'entity', name: 'New matter', source: 'entity' }] })}><Plus className="h-3 w-3" /> Add your own matter</Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1"><Input label="Import from an earlier assessment (one matter per line)" value={importText} onChange={(e) => setImportText(e.target.value)} /></div>
              <Button size="sm" variant="outline" disabled={!importText.trim()} onClick={() => { set({ matters: [...a.matters, ...importText.split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean).map((name) => ({ id: newId(), topic: 'entity' as const, name, source: 'imported' as const }))] }); setImportText('') }}>Import</Button>
            </div>
            <p className="text-xs text-slate-500">The ESRS topic list is illustrative: keep the topics that apply and add matters specific to your organisation.</p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-slate-800">2. Assess each matter</h3>
            <ul className="divide-y divide-slate-100 rounded border border-slate-200">
              {a.matters.map((m) => {
                const v = isMaterial(m, a.thresholds)
                return (
                  <li key={m.id} className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button type="button" className="text-left font-medium text-slate-800 underline-offset-2 hover:underline" onClick={() => setOpen(open === m.id ? null : m.id)}>
                        {m.name} <span className="text-xs font-normal text-slate-500">{m.topic === 'entity' ? 'entity-specific' : m.topic}</span>
                      </button>
                      <span className={v === null ? 'text-xs text-slate-500' : v ? 'text-xs font-semibold text-emerald-700' : 'text-xs text-slate-600'}>{v === null ? 'Not assessed' : v ? 'Material' : 'Not material'}</span>
                    </div>
                    {open === m.id && <MatterForm m={m} scenarios={scenarios} onChange={(p) => setMatter(m.id, p)} onLinkFair={(id) => linkFair(m, id)} onRemove={() => set({ matters: a.matters.filter((x) => x.id !== m.id) })} />}
                  </li>
                )
              })}
              {!a.matters.length && <li className="p-3 text-slate-500">No matters yet. Start with the ESRS topics or import your own list.</li>}
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-slate-800">3. Matrices and thresholds</h3>
            <ResultExplainer id="dma" />
            <div className="grid gap-4 md:grid-cols-2">
              <Matrix title="Impact: likelihood x severity" data={points('impact')} yLabel="Severity" threshold={a.thresholds.impact} />
              <Matrix title="Financial: likelihood x magnitude" data={points('financial')} yLabel="Magnitude" threshold={a.thresholds.financial} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Select label="Impact threshold (1-5)" value={String(a.thresholds.impact)} onChange={(v) => set({ thresholds: { ...a.thresholds, impact: Number(v) } })} options={SCALE} />
              <Select label="Financial threshold (1-5)" value={String(a.thresholds.financial)} onChange={(v) => set({ thresholds: { ...a.thresholds, financial: Number(v) } })} options={SCALE} />
              <Input label="Why these thresholds" value={a.thresholdReason} onChange={(e) => set({ thresholdReason: e.target.value })} placeholder="Defaults: the middle of the scale" />
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Input label="Stakeholders engaged and how" value={a.stakeholders} onChange={(e) => set({ stakeholders: e.target.value })} placeholder="e.g. staff survey; two community meetings" />
            <Input label="Approved by (body and date)" value={a.approvedBy} onChange={(e) => set({ approvedBy: e.target.value })} placeholder="e.g. Board, 12 September 2026" />
          </section>

          <section className="rounded border border-slate-200 bg-slate-50 p-3 text-slate-700">
            <p><strong>{result.material.length}</strong> material, <strong>{result.notMaterial.length}</strong> not material, <strong>{result.unassessed.length}</strong> not yet assessed. Disclosures covered (IRO-2): {result.standards.join(', ')}.</p>
            <p className="mt-1 text-xs">Suggested answer for the ESG materiality question (ESG-G5): level {g5.level}. {g5.reason}</p>
            <p className="mt-1 text-xs text-slate-500">The narrative report adds a double materiality section (IRO-1 process, material matters, IRO-2) once matters are assessed.</p>
          </section>
        </fieldset>
      </CardContent>
    </Card>
  )
}

function MatterForm({ m, scenarios, onChange, onLinkFair, onRemove }: { m: DmaMatter; scenarios: Scenario[]; onChange: (p: Partial<DmaMatter>) => void; onLinkFair: (id: string) => void; onRemove: () => void }) {
  const i = m.impact, f = m.financial
  const setI = (p: Partial<ImpactAssessment>) => onChange({ impact: { ...(i ?? defaultImpact), ...p } })
  const setF = (p: Partial<FinancialAssessment>) => onChange({ financial: { ...(f ?? defaultFinancial), ...p } })
  const topic = DMA_TOPICS.find((t) => t.standard === m.topic)
  return (
    <div className="mt-3 space-y-3">
      {m.topic === 'entity' && <Input label="Matter" value={m.name} onChange={(e) => onChange({ name: e.target.value })} />}
      {topic && <p className="text-xs text-slate-500">Sub-topics: {topic.subTopics.join('; ')}</p>}
      <div className="rounded border border-slate-200 p-2">
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={!!m.topDown} onChange={(e) => onChange({ topDown: e.target.checked ? { material: false, reason: '' } : undefined })} /> Conclude top-down from the strategy and business model analysis (no scoring)</label>
        {m.topDown && (
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Select label="Conclusion" value={m.topDown.material ? 'yes' : 'no'} onChange={(v) => onChange({ topDown: { ...m.topDown!, material: v === 'yes' } })} options={[{ value: 'no', label: 'Not material' }, { value: 'yes', label: 'Material' }]} />
            <div className="sm:col-span-2"><Input label="Reason (required)" value={m.topDown.reason} onChange={(e) => onChange({ topDown: { ...m.topDown!, reason: e.target.value } })} /></div>
          </div>
        )}
      </div>
      {!m.topDown && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded border border-slate-200 p-2">
            <p className="mb-2 font-medium">Impact materiality {i ? `· score ${impactScore(i)}` : ''}</p>
            {!i ? <Button size="sm" variant="outline" onClick={() => setI({})}>Assess impact</Button> : (
              <div className="grid grid-cols-2 gap-2">
                <Select label="Actual or potential" value={i.kind} onChange={(v) => setI({ kind: v as ImpactAssessment['kind'] })} options={[{ value: 'actual', label: 'Actual' }, { value: 'potential', label: 'Potential' }]} />
                <Select label="Negative or positive" value={i.effect} onChange={(v) => setI({ effect: v as ImpactAssessment['effect'] })} options={[{ value: 'negative', label: 'Negative' }, { value: 'positive', label: 'Positive' }]} />
                <Select label="Scale (how grave)" value={String(i.scale)} onChange={(v) => setI({ scale: num(v) })} options={SCALE} />
                <Select label="Scope (how widespread)" value={String(i.scope)} onChange={(v) => setI({ scope: num(v) })} options={SCALE} />
                {i.effect === 'negative' && <Select label="Irremediability" value={String(i.irremediability ?? 3)} onChange={(v) => setI({ irremediability: num(v) })} options={SCALE} />}
                {i.kind === 'potential' && <Select label="Likelihood" value={String(i.likelihood ?? 3)} onChange={(v) => setI({ likelihood: num(v) })} options={SCALE} />}
                <fieldset className="col-span-2 flex flex-wrap gap-3"><legend className="text-xs text-slate-600">Where in the value chain</legend>
                  {(['own', 'upstream', 'downstream'] as ValueChain[]).map((vc) => (
                    <label key={vc} className="flex items-center gap-1"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={i.valueChain.includes(vc)} onChange={(e) => setI({ valueChain: e.target.checked ? [...i.valueChain, vc] : i.valueChain.filter((x) => x !== vc) })} />{vc === 'own' ? 'Own operations' : vc === 'upstream' ? 'Upstream' : 'Downstream'}</label>
                  ))}
                </fieldset>
                {i.effect === 'negative' && <label className="col-span-2 flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={!!i.humanRights} onChange={(e) => setI({ humanRights: e.target.checked })} /> A human-rights impact (severity takes precedence over likelihood)</label>}
              </div>
            )}
          </div>
          <div className="rounded border border-slate-200 p-2">
            <p className="mb-2 font-medium">Financial materiality {f ? `· score ${financialScore(f)}` : ''}</p>
            {!f ? <Button size="sm" variant="outline" onClick={() => setF({})}>Assess financial effect</Button> : (
              <div className="grid grid-cols-2 gap-2">
                <Select label="Risk or opportunity" value={f.kind} onChange={(v) => setF({ kind: v as FinancialAssessment['kind'] })} options={[{ value: 'risk', label: 'Risk' }, { value: 'opportunity', label: 'Opportunity' }]} />
                <Input label="What triggers it" value={f.trigger} onChange={(e) => setF({ trigger: e.target.value })} />
                <Select label="Magnitude (benefit or loss)" value={String(f.magnitude)} onChange={(v) => setF({ magnitude: num(v) })} options={SCALE} />
                <Select label="Likelihood" value={String(f.likelihood)} onChange={(v) => setF({ likelihood: num(v) })} options={SCALE} />
                {scenarios.length > 0 && <div className="col-span-2"><Select label="Link a FAIR risk scenario (sets the likelihood)" value={f.fairScenarioId ?? ''} onChange={onLinkFair} placeholder="None" options={scenarios.map((s) => ({ value: s.id, label: s.name }))} /></div>}
              </div>
            )}
          </div>
        </div>
      )}
      <Button size="sm" variant="ghost" onClick={onRemove}><Trash2 className="h-3 w-3" /> Remove this matter</Button>
    </div>
  )
}

function Matrix({ title, data, yLabel, threshold }: { title: string; data: Array<{ name: string; x: number; y: number; score: number }>; yLabel: string; threshold: number }) {
  return (
    <div className="rounded border border-slate-200 p-2">
      <p className="mb-1 text-xs font-medium text-slate-700">{title}</p>
      {data.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No scored matters yet.</p> : (
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top: 8, right: 8, bottom: 16, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name="Likelihood" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} label={{ value: 'Likelihood', position: 'insideBottom', offset: -8, fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name={yLabel} domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} width={28} />
            <ZAxis type="number" dataKey="score" range={[60, 60]} />
            <ReferenceLine y={threshold} stroke="#059669" strokeDasharray="4 4" />
            <Tooltip content={({ payload }) => payload?.[0] ? <div className="rounded bg-white p-2 text-xs shadow">{(payload[0].payload as { name: string }).name}: score {(payload[0].payload as { score: number }).score}</div> : null} />
            <Scatter data={data} fill="#059669" />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
