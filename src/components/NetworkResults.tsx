import { useCallback, useEffect, useState } from 'react'
import { Button, Select } from './ui'
import { LEVEL_LABEL, type NetworkLevel } from '../lib/networks'
import { NETWORK_SERVICES, SERVICE_LABEL, type NetworkService, type ValueAnswers } from '../lib/networkResults'

// The Network Value Scorecard for one level of a round (capacity, value added, use), and a member's own benchmark.
// Every number comes from /api/network-results, which withholds any group under five members.

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

type Stats = { n: number; median: number; q1: number; q3: number; min: number; max: number }
type Results = {
  minGroup: number
  round: { id: string; name: string; instrumentTitle: string; nodeId: string }
  node: { id: string; name: string; level: NetworkLevel }
  levels: Array<{ id: string; name: string; level: NetworkLevel; parentId: string | null }>
  scorecard: string[]
  capacity: { n: number; suppressed: boolean; composite: Stats | null; bands: Array<{ label: string; tone: string; count: number }> | null; dimensions: Array<{ key: string; name: string; stats: Stats | null }> }
  gaps: Array<{ key: string; name: string; median: number }>
  heatmap: { columns: Array<{ nodeId: string; name: string; n: number; shown: boolean }>; rows: Array<{ key: string; name: string; cells: Array<number | null> }> }
  value: { n: number; suppressed: boolean; services: Array<{ key: string; label: string; usedBy: number; usedPct: number; helpfulPct: number | null }> | null; recommend: { average: number; netScore: number } | null }
  use: Array<{ key: string; label: string; count: number; pct: number }>
  named: Array<{ orgId: string; name: string; composite: number; band: string | null }>
}

const TONE: Record<string, string> = { rose: 'bg-rose-500', amber: 'bg-amber-400', yellow: 'bg-yellow-300', emerald: 'bg-emerald-500' }
/** Heatmap colour by median on the 0-5 scale, matching CRAFT's band thresholds. */
const cell = (v: number | null) => v == null ? 'bg-slate-100 text-slate-400' : v < 1.75 ? 'bg-rose-100 text-rose-900' : v < 2.75 ? 'bg-amber-100 text-amber-900' : v < 3.5 ? 'bg-yellow-100 text-yellow-900' : 'bg-emerald-100 text-emerald-900'

function BandBar({ bands, n }: { bands: Array<{ label: string; tone: string; count: number }>; n: number }) {
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={bands.map((b) => `${b.label}: ${b.count}`).join(', ')}>
        {bands.filter((b) => b.count > 0).map((b) => <div key={b.label} className={TONE[b.tone] ?? 'bg-slate-400'} style={{ width: `${(b.count / n) * 100}%` }} />)}
      </div>
      <p className="mt-1 text-xs text-slate-600">{bands.filter((b) => b.count > 0).map((b) => `${b.label} ${b.count}`).join(' · ')}</p>
    </div>
  )
}

export function CoordinatorResults({ roundId }: { roundId: string }) {
  const [nodeId, setNodeId] = useState('')
  const [r, setR] = useState<Results | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(() => { void api<Results>(`/api/network-results/${roundId}${nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : ''}`).then(setR, (e) => setError(e.message)) }, [roundId, nodeId])
  useEffect(load, [load])
  if (error) return <p className="text-sm text-rose-700">{error}</p>
  if (!r) return <p className="text-sm text-slate-500">Loading results…</p>
  const c = r.capacity
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Network Value Scorecard</p>
          <p className="font-medium text-slate-900">{r.node.name} · {r.round.instrumentTitle}</p>
        </div>
        {r.levels.length > 1 && <div className="min-w-[14rem]"><Select label="Level" options={r.levels.map((l) => ({ value: l.id, label: `${l.name} (${LEVEL_LABEL[l.level]})` }))} value={r.node.id} onChange={setNodeId} /></div>}
      </div>
      <ul className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{r.scorecard.map((l) => <li key={l}>{l}</li>)}</ul>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">1 · Capacity</h3>
        {c.suppressed ? <p className="text-sm text-slate-600">{c.n} member{c.n === 1 ? '' : 's'} submitted. Results show once at least {r.minGroup} have, so no organisation can be identified.</p> : (
          <>
            <BandBar bands={c.bands!} n={c.n} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="py-1 pr-3">Area</th><th className="pr-3">Median</th><th className="pr-3">Middle half of members</th><th>Range</th></tr></thead>
                <tbody>{c.dimensions.map((d) => (
                  <tr key={d.key} className="border-t border-slate-100 tabular-nums">
                    <td className="py-1.5 pr-3 text-slate-800">{d.name}</td>
                    <td className="pr-3"><span className={`rounded px-1.5 py-0.5 ${cell(d.stats?.median ?? null)}`}>{d.stats ? d.stats.median.toFixed(2) : '—'}</span></td>
                    <td className="pr-3 text-slate-600">{d.stats ? `${d.stats.q1.toFixed(2)} to ${d.stats.q3.toFixed(2)}` : '—'}</td>
                    <td className="text-slate-600">{d.stats ? `${d.stats.min} to ${d.stats.max}` : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {r.gaps.length > 0 && <p className="text-sm text-slate-700"><span className="font-medium">Weakest areas across members:</span> {r.gaps.map((g) => `${g.name} (median ${g.median})`).join('; ')}.</p>}
          </>
        )}
        {r.heatmap.columns.length > 0 && (
          <div className="overflow-x-auto">
            <p className="mb-1 text-xs text-slate-500">Median by area for each level below {r.node.name}. Grey cells have fewer than {r.minGroup} members and are hidden.</p>
            <table className="text-xs">
              <thead><tr><th className="py-1 pr-3 text-left text-slate-500">Area</th>{r.heatmap.columns.map((col) => <th key={col.nodeId} className="px-2 text-slate-700">{col.name}<br /><span className="font-normal text-slate-400">{col.n} submitted</span></th>)}</tr></thead>
              <tbody>{r.heatmap.rows.map((row) => (
                <tr key={row.key}><td className="py-1 pr-3 text-slate-800">{row.name}</td>{row.cells.map((v, i) => <td key={i} className="px-1 py-0.5"><span className={`block rounded px-2 py-1 text-center tabular-nums ${cell(v)}`}>{v == null ? '—' : v.toFixed(1)}</span></td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">2 · Value added (member survey)</h3>
        {r.value.suppressed ? <p className="text-sm text-slate-600">{r.value.n} member{r.value.n === 1 ? '' : 's'} answered. Results show once at least {r.minGroup} have.</p> : (
          <>
            <p className="text-sm text-slate-700">Would recommend the network: <span className="font-semibold tabular-nums">{r.value.recommend!.average}/10</span> (net score {r.value.recommend!.netScore}).</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="py-1 pr-3">Service</th><th className="pr-3">Members who used it</th><th>Found it helpful</th></tr></thead>
              <tbody>{r.value.services!.map((s) => (
                <tr key={s.key} className="border-t border-slate-100 tabular-nums"><td className="py-1.5 pr-3 text-slate-800">{s.label}</td><td className="pr-3">{s.usedPct}%</td><td>{s.helpfulPct == null ? '—' : `${s.helpfulPct}%`}</td></tr>
              ))}</tbody>
            </table>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">3 · Use: from assessment to action</h3>
        <ul className="space-y-1.5">{r.use.map((u) => (
          <li key={u.key} className="text-sm">
            <div className="flex justify-between text-slate-700"><span>{u.label}</span><span className="tabular-nums">{u.count} · {u.pct}%</span></div>
            <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, u.pct)}%` }} /></div>
          </li>
        ))}</ul>
      </section>

      {r.named.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Members sharing named results</h3>
          <table className="w-full text-sm">
            <tbody>{r.named.map((x) => <tr key={x.orgId} className="border-t border-slate-100"><td className="py-1.5 pr-3 text-slate-800">{x.name}</td><td className="pr-3 tabular-nums">{x.composite.toFixed(2)}</td><td>{x.band ?? '—'}</td></tr>)}</tbody>
          </table>
          <p className="text-xs text-slate-500">Other members chose totals only and are included in the figures above without being named. Viewing this list is recorded in the audit log.</p>
        </section>
      )}
      <p className="text-xs text-slate-500">These are readiness results, not certification. Use them to plan support, not to rank organisations publicly.</p>
    </div>
  )
}

type Benchmark = { orgId: string; submitted: boolean; groupSize: number; composite: number | null; band: string | null
  benchmark: Array<{ key: string; name: string; mine: number | null; median: number | null; q1: number | null; q3: number | null; position: 'below' | 'within' | 'above' | null }> | null }
const POSITION = { below: 'Below most members', within: 'In line with most members', above: 'Ahead of most members' }

export function MemberBenchmark({ roundId, orgId }: { roundId: string; orgId: string }) {
  const [b, setB] = useState<{ minGroup: number; mine: Benchmark[] } | null>(null)
  useEffect(() => { void api(`/api/network-results/${roundId}`).then(setB, () => setB(null)) }, [roundId])
  const mine = b?.mine.find((x) => x.orgId === orgId)
  if (!mine?.submitted) return null
  if (!mine.benchmark) return <p className="text-xs text-slate-500">Your comparison with other members appears once at least {b!.minGroup} organisations have submitted.</p>
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-700">How you compare with the {mine.groupSize} members in this round (no one is named)</p>
      <table className="w-full text-xs">
        <tbody>{mine.benchmark.map((d) => (
          <tr key={d.key} className="border-t border-slate-100"><td className="py-1 pr-2 text-slate-800">{d.name}</td><td className="pr-2 tabular-nums">{d.mine?.toFixed(2) ?? '—'}</td><td className="pr-2 tabular-nums text-slate-500">median {d.median?.toFixed(2) ?? '—'}</td><td className={d.position === 'below' ? 'text-rose-700' : d.position === 'above' ? 'text-emerald-700' : 'text-slate-600'}>{d.position ? POSITION[d.position] : ''}</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
}

export function ValueSurvey({ roundId, orgId, initial, onDone }: { roundId: string; orgId: string; initial: ValueAnswers | null; onDone: () => void }) {
  const [used, setUsed] = useState<Partial<Record<NetworkService, number>>>(initial?.used ?? {})
  const [recommend, setRecommend] = useState(initial?.recommend ?? 8)
  const [msg, setMsg] = useState('')
  const save = async () => {
    setMsg('')
    try { await api(`/api/network-rounds/${roundId}/value`, { method: 'POST', json: { orgId, answers: { used, recommend } } }); setMsg('Thank you, saved'); onDone() } catch (e) { setMsg((e as Error).message) }
  }
  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      <p className="text-sm text-slate-700">Which of the network's services did you use in this period, and how helpful were they? Only totals are shared, and only when five or more members answer.</p>
      <table className="w-full text-sm">
        <tbody>{NETWORK_SERVICES.map((s) => (
          <tr key={s} className="border-t border-slate-100">
            <td className="py-1 pr-2 text-slate-800">{SERVICE_LABEL[s]}</td>
            <td>
              <select aria-label={`How helpful: ${SERVICE_LABEL[s]}`} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm" value={used[s] ?? ''}
                onChange={(e) => { const v = e.target.value; const next = { ...used }; if (v) next[s] = Number(v); else delete next[s]; setUsed(next) }}>
                <option value="">Didn't use</option><option value="1">1 · Not helpful</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 · Very helpful</option>
              </select>
            </td>
          </tr>
        ))}</tbody>
      </table>
      <label className="block text-sm text-slate-700">How likely are you to recommend this network to a similar organisation? <span className="font-semibold tabular-nums">{recommend}</span>/10
        <input type="range" min={0} max={10} step={1} value={recommend} onChange={(e) => setRecommend(Number(e.target.value))} className="mt-1 w-full accent-emerald-600" />
      </label>
      <Button size="sm" onClick={() => void save()}>Save answers</Button>
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
    </div>
  )
}
