import { useCallback, useEffect, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from './ui'
import { LEVEL_LABEL, NETWORK_LEVELS, type NetworkLevel } from '../lib/networks'
import { BAND_LABEL, BANDS, COMPONENT_LABEL, ITEM_SCALE, componentsOf, type Band, type Component, type Template } from '../lib/programmeScorecard'

// Programme Response Scorecards: units (e.g. states) self-assess their programme response; the level above sees
// how many units sit in each band, by zone, with the lists, as in NACA's subnational scorecards.

async function api<T = any>(path: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method, cache: 'no-store',
    headers: init?.json !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error === 'mfa_required' ? 'Confirm your two-step sign-in, then try again.' : body?.error || `Request failed (${res.status})`)
  return body as T
}

type UnitResult = Array<{ area: string; name: string; components: Array<{ component: Component; pct: number; band: Band; gaps: string[] }> }>
type Detail = {
  id: string; name: string; unitLevel: NetworkLevel; opensOn: string; closesOn: string; state: 'upcoming' | 'open' | 'closed'; template: Template; overseeing: boolean
  mine: Array<{ nodeId: string; name: string; scores: Record<string, number>; enteredAt: string | null; result: UnitResult | null }>
  units?: Array<{ nodeId: string; name: string; group: string; entered: boolean }>
  summaries?: Array<{ area: string; name: string; components: Array<{ component: Component; counts: Record<Band, number>; byGroup: Array<{ group: string } & Record<Band, number>>; lists: Record<Band, string[]> }> }>
  change?: null | { previous: string; comparedUnits: number; improved: number; worsened: number; same: number }
  capacityByUnit?: Array<{ nodeId: string; round: string | null; instrument: string | null; members: number; median: number | null }>
  results?: Array<{ nodeId: string; name: string; group: string; result: UnitResult }>
}

const BAND_STYLE: Record<Band, string> = { immediate: 'bg-rose-600 text-white', attention: 'bg-amber-400 text-slate-900', good: 'bg-emerald-600 text-white' }
const BANDS_ORDER: Band[] = ['immediate', 'attention', 'good']

function UnitEntry({ d, unit, onDone }: { d: Detail; unit: Detail['mine'][number]; onDone: () => void }) {
  const [scores, setScores] = useState<Record<string, number>>(unit.scores)
  const [msg, setMsg] = useState('')
  const save = async () => {
    setMsg('')
    try { await api(`/api/network-scorecards/${d.id}/entries`, { method: 'POST', json: { nodeId: unit.nodeId, scores } }); setMsg('Saved'); onDone() } catch (e) { setMsg((e as Error).message) }
  }
  return (
    <div className="space-y-4">
      {d.template.areas.map((a) => (
        <div key={a.key} className="space-y-2">
          <p className="font-medium text-slate-900">{a.name}</p>
          {componentsOf(a).map((c) => (
            <div key={c} className="rounded-md border border-slate-200 p-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{COMPONENT_LABEL[c]}</p>
              <ul className="mt-1 space-y-1">
                {a.items[c]!.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-slate-800">{i.text}</span>
                    <select aria-label={i.text} disabled={d.state !== 'open'} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm" value={scores[i.id] ?? ''}
                      onChange={(e) => { const v = e.target.value; const next = { ...scores }; if (v === '') delete next[i.id]; else next[i.id] = Number(v); setScores(next) }}>
                      <option value="">Choose</option>
                      {ITEM_SCALE.map((s) => <option key={s.value} value={s.value}>{s.value} · {s.label}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
      {d.state === 'open' && <Button size="sm" onClick={() => void save()}>Save {unit.name}'s scorecard</Button>}
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
      {unit.result && <UnitResultView result={unit.result} />}
    </div>
  )
}

function UnitResultView({ result }: { result: UnitResult }) {
  return (
    <div className="space-y-2">
      {result.map((a) => (
        <div key={a.area}>
          <p className="text-sm font-medium text-slate-800">{a.name}</p>
          <div className="mt-1 grid gap-2 sm:grid-cols-4">
            {a.components.map((c) => (
              <div key={c.component} className="rounded-md border border-slate-200 p-2">
                <p className="text-xs text-slate-500">{COMPONENT_LABEL[c.component]}</p>
                <p className="mt-1"><span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${BAND_STYLE[c.band]}`}>{BAND_LABEL[c.band]}</span> <span className="text-xs tabular-nums text-slate-600">{c.pct}%</span></p>
                {c.gaps.length > 0 && <p className="mt-1 text-xs text-slate-600">To strengthen: {c.gaps.join('; ')}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Overview({ d }: { d: Detail }) {
  const [area, setArea] = useState(d.template.areas[0]?.key ?? '')
  const [comp, setComp] = useState<Component>('management')
  const areaDef = d.template.areas.find((x) => x.key === area)
  useEffect(() => { if (areaDef && !componentsOf(areaDef).includes(comp)) setComp('management') }, [areaDef, comp])
  const s = d.summaries?.find((x) => x.area === area)?.components.find((c) => c.component === comp)
  const entered = d.units?.filter((u) => u.entered).length ?? 0
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">{entered} of {d.units?.length ?? 0} {LEVEL_LABEL[d.unitLevel].toLowerCase()} units have entered their scorecard.
        {d.change ? ` Since ${d.change.previous}: ${d.change.improved} area-components moved up a band and ${d.change.worsened} moved down across ${d.change.comparedUnits} units.` : ''}</p>
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[14rem]"><Select label="Programme area" options={d.template.areas.map((a) => ({ value: a.key, label: a.name }))} value={area} onChange={setArea} /></div>
        <div className="min-w-[14rem]"><Select label="Component" options={componentsOf(d.template.areas.find((x) => x.key === area) ?? d.template.areas[0]).map((c) => ({ value: c, label: COMPONENT_LABEL[c] }))} value={comp} onChange={(v) => setComp(v as Component)} /></div>
      </div>
      {s && (
        <>
          <div className="flex flex-wrap gap-2">
            {BANDS_ORDER.map((b) => <span key={b} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${BAND_STYLE[b]}`}>{s.counts[b]} · {BAND_LABEL[b]}</span>)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="py-1 pr-3">Zone or grouping</th><th className="pr-3">By band</th></tr></thead>
              <tbody>{s.byGroup.map((g) => {
                const total = BANDS_ORDER.reduce((n, b) => n + g[b], 0)
                return (
                  <tr key={g.group} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 text-slate-800">{g.group}</td>
                    <td><div className="flex h-4 w-full max-w-md overflow-hidden rounded" role="img" aria-label={BANDS_ORDER.map((b) => `${BAND_LABEL[b]}: ${g[b]}`).join(', ')}>
                      {BANDS_ORDER.filter((b) => g[b] > 0).map((b) => <div key={b} className={BAND_STYLE[b].split(' ')[0]} style={{ width: `${(g[b] / total) * 100}%` }} />)}
                    </div></td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {BANDS_ORDER.map((b) => (
              <div key={b} className="rounded-md border border-slate-200 p-2">
                <p className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${BAND_STYLE[b]}`}>{BAND_LABEL[b]}</p>
                <p className="mt-1 text-sm text-slate-800">{s.lists[b].join(', ') || '—'}</p>
              </div>
            ))}
          </div>
        </>
      )}
      {d.capacityByUnit && d.capacityByUnit.some((c) => c.round) && (
        <div className="overflow-x-auto">
          <p className="text-sm font-medium text-slate-800">Programme response next to member capacity</p>
          <table className="mt-1 w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="py-1 pr-3">Unit</th><th className="pr-3">{COMPONENT_LABEL[comp]}</th><th className="pr-3">Member capacity (median, 0-5)</th><th>From</th></tr></thead>
            <tbody>{d.units!.map((u) => {
              const r = d.results?.find((x) => x.nodeId === u.nodeId)?.result.find((x) => x.area === area)?.components.find((c) => c.component === comp)
              const cap = d.capacityByUnit!.find((c) => c.nodeId === u.nodeId)
              return (
                <tr key={u.nodeId} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3 text-slate-800">{u.name}</td>
                  <td className="pr-3">{r ? <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${BAND_STYLE[r.band]}`}>{BAND_LABEL[r.band]}</span> : <span className="text-xs text-slate-400">Not entered</span>}</td>
                  <td className="pr-3 tabular-nums">{cap?.median != null ? cap.median.toFixed(2) : <span className="text-xs text-slate-400">{cap?.members ? `fewer than 5 members (${cap.members})` : '—'}</span>}</td>
                  <td className="text-xs text-slate-500">{cap?.round ? `${cap.round} · ${cap.instrument}` : ''}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">Bands use CRAFT's thresholds: below {BANDS.attentionFrom}% of the maximum is "Immediate action required", {BANDS.attentionFrom}% to {BANDS.goodFrom - 1}% "Attention needed", {BANDS.goodFrom}% and above "Good, but may need improvement". {d.template.source}</p>
    </div>
  )
}

export function ProgrammeScorecards({ networkId, nodes, coordinates }: { networkId: string; nodes: Array<{ id: string; name: string; level: NetworkLevel }>; coordinates: string[] }) {
  const [list, setList] = useState<{ templates: Array<{ id: string; name: string; source: string; areas: string[] }>; canCreate: boolean
    scorecards: Array<{ id: string; name: string; template: string; nodeId: string; unitLevel: NetworkLevel; opensOn: string; closesOn: string; state: string; overseeing: boolean }> } | null>(null)
  const [open, setOpen] = useState<Detail | null>(null)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ nodeId: coordinates[0] ?? '', unitLevel: 'subnational' as NetworkLevel, template: 'hiv-prevention-subnational', name: '', opensOn: new Date().toISOString().slice(0, 10), closesOn: '' })
  const load = useCallback(() => { void api(`/api/network-scorecards?networkId=${encodeURIComponent(networkId)}`).then(setList, () => setList(null)) }, [networkId])
  useEffect(load, [load])
  const show = (id: string) => { void api<Detail>(`/api/network-scorecards/${id}`).then(setOpen, (e) => setMsg(e.message)) }
  const create = async () => {
    setMsg('')
    try { await api('/api/network-scorecards', { method: 'POST', json: { networkId, ...form } }); setForm({ ...form, name: '' }); load() } catch (e) { setMsg((e as Error).message) }
  }
  if (!list || (!list.scorecards.length && !list.canCreate)) return null
  return (
    <Card>
      <CardHeader><CardTitle>Programme response scorecards</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">Each unit (for example, each state) scores how well its programme response is managed, implemented, delivered and showing results. Modelled on NACA's subnational HIV prevention self-assessment scorecards.</p>
        <ul className="space-y-2">
          {list.scorecards.map((s) => (
            <li key={s.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-600">{list.templates.find((t) => t.id === s.template)?.name} · each {LEVEL_LABEL[s.unitLevel].toLowerCase()} under {nodes.find((n) => n.id === s.nodeId)?.name} · {s.opensOn} to {s.closesOn} · {s.state}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => (open?.id === s.id ? setOpen(null) : show(s.id))}>{open?.id === s.id ? 'Close' : 'Open'}</Button>
              </div>
              {open?.id === s.id && (
                <div className="mt-3 space-y-4 border-t border-slate-200 pt-3">
                  {open.overseeing && <Overview d={open} />}
                  {open.mine.map((u) => <div key={u.nodeId} className="space-y-2"><p className="text-sm font-semibold text-slate-900">{u.name}{u.enteredAt ? ` · last saved ${new Date(u.enteredAt).toLocaleDateString()}` : ''}</p><UnitEntry d={open} unit={u} onDone={() => show(s.id)} /></div>)}
                </div>
              )}
            </li>
          ))}
        </ul>
        {list.canCreate && coordinates.length > 0 && (
          <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
            <p className="text-sm font-medium text-slate-800 sm:col-span-2">Open a scorecard</p>
            <Input label="Name (e.g. HIV prevention scorecard 2026)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select label="Template" options={list.templates.map((t) => ({ value: t.id, label: t.name }))} value={form.template} onChange={(v) => setForm({ ...form, template: v })} />
            <Select label="Overseen by" options={nodes.filter((n) => coordinates.includes(n.id)).map((n) => ({ value: n.id, label: n.name }))} value={form.nodeId} onChange={(v) => setForm({ ...form, nodeId: v })} />
            <Select label="Units that fill it in" options={NETWORK_LEVELS.map((l) => ({ value: l, label: `Each ${LEVEL_LABEL[l].toLowerCase()}` }))} value={form.unitLevel} onChange={(v) => setForm({ ...form, unitLevel: v as NetworkLevel })} />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Opens" type="date" value={form.opensOn} onChange={(e) => setForm({ ...form, opensOn: e.target.value })} />
              <Input label="Closes" type="date" value={form.closesOn} onChange={(e) => setForm({ ...form, closesOn: e.target.value })} />
            </div>
            <div className="flex items-end"><Button size="sm" disabled={form.name.trim().length < 3 || !form.closesOn} onClick={() => void create()}>Open scorecard</Button></div>
          </div>
        )}
        {msg && <p className="text-sm text-slate-700">{msg}</p>}
      </CardContent>
    </Card>
  )
}
