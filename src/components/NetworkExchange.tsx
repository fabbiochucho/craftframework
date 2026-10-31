import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from './ui'
import { EXCHANGE_LABEL, EXCHANGE_TYPES, type ExchangeType } from '../lib/networkExchange'
import { instrumentById, roundInstruments } from '../lib/networkRounds'
import { useI18n } from '../lib/i18n'

// Learning between members (the exchange log) and what follows from results (plan, pairings, progress, exports).

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

type Exchange = { id: string; nodeId: string; type: ExchangeType; title: string; heldOn: string; location: string; instrument: string; areas: string[]; people: number
  followUp: string; organisations: number; named: string[]; canAttend: string[]; canDelete: boolean }

export function ExchangeLog({ networkId, nodes, coordinates, named, myOrgNames }: {
  networkId: string; nodes: Array<{ id: string; name: string }>; coordinates: string[]
  named: Array<{ orgId: string; name: string }>; myOrgNames?: Record<string, string>
}) {
  const [items, setItems] = useState<Exchange[] | null>(null)
  const [msg, setMsg] = useState('')
  const instruments = roundInstruments(true)
  const [form, setForm] = useState({ nodeId: coordinates[0] ?? '', type: 'peer-learning' as ExchangeType, title: '', heldOn: new Date().toISOString().slice(0, 10), location: '',
    instrument: 'craft-onc', areas: [] as string[], orgIds: [] as string[], people: '', followUp: '' })
  const load = useCallback(() => { void api<{ exchanges: Exchange[] }>(`/api/network-exchanges?networkId=${encodeURIComponent(networkId)}`).then((b) => setItems(b.exchanges), () => setItems([])) }, [networkId])
  useEffect(load, [load])
  const m = instrumentById(form.instrument)
  const save = async () => {
    setMsg('')
    try {
      await api('/api/network-exchanges', { method: 'POST', json: { networkId, ...form, people: Number(form.people || 0) } })
      setForm({ ...form, title: '', areas: [], orgIds: [], people: '', followUp: '' }); setMsg('Exchange logged'); load()
    } catch (e) { setMsg((e as Error).message) }
  }
  const attend = async (id: string, orgId: string) => {
    setMsg('')
    try { await api(`/api/network-exchanges/${id}/attend`, { method: 'POST', json: { orgId } }); load() } catch (e) { setMsg((e as Error).message) }
  }
  const remove = async (id: string) => { try { await api(`/api/network-exchanges/${id}`, { method: 'DELETE' }); load() } catch (e) { setMsg((e as Error).message) } }
  if (!items) return null
  if (!items.length && !coordinates.length) return null
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  return (
    <Card>
      <CardHeader><CardTitle>Learning and exchange</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">Peer learning, exchange visits, study tours, conferences, mentoring and twinning between members, linked to the areas they strengthen. These feed the network's capacity-building plan and its progress results.</p>
        {items.length === 0 && <p className="text-sm text-slate-500">Nothing logged yet.</p>}
        <ul className="space-y-2">
          {items.map((x) => (
            <li key={x.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{x.title}</p>
                  <p className="text-xs text-slate-600">{EXCHANGE_LABEL[x.type]} · {x.heldOn}{x.location ? ` · ${x.location}` : ''} · {nodes.find((n) => n.id === x.nodeId)?.name ?? ''}</p>
                  <p className="text-xs text-slate-600">Areas: {x.areas.map((a) => instrumentById(x.instrument)?.dimensions.find((d) => d.key === a)?.name ?? a).join(', ') || '—'}</p>
                  <p className="text-xs text-slate-600">{x.organisations} member organisation{x.organisations === 1 ? '' : 's'}{x.people ? `, ${x.people} people` : ''}{x.named.length ? ` · named: ${x.named.join(', ')}` : ''}</p>
                  {x.followUp && <p className="mt-1 text-xs text-slate-700">Follow-up: {x.followUp}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {x.canAttend.map((o) => <Button key={o} size="sm" variant="outline" onClick={() => void attend(x.id, o)}>{myOrgNames?.[o] ? `${myOrgNames[o]} took part` : 'We took part'}</Button>)}
                  {x.canDelete && <Button size="sm" variant="ghost" onClick={() => void remove(x.id)}>Remove</Button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {coordinates.length > 0 && (
          <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
            <p className="text-sm font-medium text-slate-800 sm:col-span-2">Log an exchange</p>
            <Select label="Type" options={EXCHANGE_TYPES.map((t) => ({ value: t, label: EXCHANGE_LABEL[t] }))} value={form.type} onChange={(v) => setForm({ ...form, type: v as ExchangeType })} />
            <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select label="Level that organised it" options={nodes.filter((n) => coordinates.includes(n.id)).map((n) => ({ value: n.id, label: n.name }))} value={form.nodeId} onChange={(v) => setForm({ ...form, nodeId: v })} />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Date" type="date" value={form.heldOn} onChange={(e) => setForm({ ...form, heldOn: e.target.value })} />
              <Input label="People attending" type="number" min={0} value={form.people} onChange={(e) => setForm({ ...form, people: e.target.value })} />
            </div>
            <Input label="Where" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Select label="Assessment the areas come from" options={instruments.map((i) => ({ value: i.id, label: i.title }))} value={form.instrument} onChange={(v) => setForm({ ...form, instrument: v, areas: [] })} />
            {m && (
              <fieldset className="sm:col-span-2">
                <legend className="text-sm text-slate-700">Areas it strengthens</legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {m.dimensions.map((d) => (
                    <label key={d.key} className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                      <input type="checkbox" checked={form.areas.includes(d.key)} onChange={() => setForm({ ...form, areas: toggle(form.areas, d.key) })} /> {d.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {named.length > 0 && (
              <fieldset className="sm:col-span-2">
                <legend className="text-sm text-slate-700">Members who took part (others can add themselves)</legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {named.map((o) => (
                    <label key={o.orgId} className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                      <input type="checkbox" checked={form.orgIds.includes(o.orgId)} onChange={() => setForm({ ...form, orgIds: toggle(form.orgIds, o.orgId) })} /> {o.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="sm:col-span-2"><Input label="Follow-up agreed (optional)" value={form.followUp} onChange={(e) => setForm({ ...form, followUp: e.target.value })} /></div>
            <div><Button size="sm" disabled={form.title.trim().length < 3} onClick={() => void save()}>Log exchange</Button></div>
          </div>
        )}
        {msg && <p className="text-sm text-slate-700">{msg}</p>}
      </CardContent>
    </Card>
  )
}

type Plan = {
  minGroup: number
  plan: null | Array<{ key: string; name: string; median: number | null; membersBelow: number; share: number; support: string | null; exchangesHeld: number }>
  pairings: Array<{ key: string; name: string; pairs: Array<{ learner: { name: string; score: number }; mentor: { name: string; score: number } }> }>
}
type Progress = {
  minGroup: number; baseline?: { id: string; name: string }; baselines: Array<{ id: string; name: string; opensOn: string }>
  progress: null | { cohort: number; newMembers: number; suppressed: boolean; movedUp: number | null; movedDown: number | null
    areas: null | Array<{ key: string; name: string; medianChange: number | null; improved: number; declined: number }> }
  contribution: Array<{ key: string; name: string; shown: boolean; took: number; didnt: number; tookMedian?: number; didntMedian?: number }>
}

/** Under a round's results: the capacity-building plan, pairings, progress since an earlier round, and exports. */
export function PlanAndProgress({ roundId, nodeId, networkId }: { roundId: string; nodeId?: string; networkId: string }) {
  const q = nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : ''
  const { lang } = useI18n()
  const csvQ = `${q ? `${q}&` : '?'}${lang && lang !== 'en' ? `lang=${lang}` : ''}`.replace(/[?&]$/, '')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [prog, setProg] = useState<Progress | null>(null)
  const [baseline, setBaseline] = useState('')
  useEffect(() => { void api<Plan>(`/api/network-results/${roundId}/plan${q}`).then(setPlan, () => setPlan(null)) }, [roundId, q])
  useEffect(() => {
    const p = new URLSearchParams(); if (nodeId) p.set('nodeId', nodeId); if (baseline) p.set('baseline', baseline)
    void api<Progress>(`/api/network-results/${roundId}/progress?${p}`).then(setProg, () => setProg(null))
  }, [roundId, nodeId, baseline])
  const sign = (x: number | null) => (x == null ? '—' : x > 0 ? `+${x}` : `${x}`)
  return (
    <div className="space-y-5 border-t border-slate-200 pt-4">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Network capacity-building plan</h3>
        {!plan?.plan ? <p className="text-sm text-slate-600">The plan appears once at least {plan?.minGroup ?? 5} members have submitted.</p> : plan.plan.length === 0 ? <p className="text-sm text-slate-600">No area has members below the gap line.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="py-1 pr-3">Area</th><th className="pr-3">Members needing support</th><th className="pr-3">Suggested collective support</th><th>Exchanges held</th></tr></thead>
            <tbody>{plan.plan.map((a) => (
              <tr key={a.key} className="border-t border-slate-100 align-top"><td className="py-1.5 pr-3 text-slate-800">{a.name}</td><td className="pr-3 tabular-nums">{a.membersBelow} ({a.share}%)</td><td className="pr-3 text-slate-700">{a.support}</td><td className="tabular-nums">{a.exchangesHeld}</td></tr>
            ))}</tbody>
          </table>
        )}
        {plan && plan.pairings.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-800">Suggested mentoring pairs (members sharing named results only)</p>
            <ul className="mt-1 space-y-1 text-sm text-slate-700">
              {plan.pairings.flatMap((a) => a.pairs.map((p) => <li key={a.key + p.learner.name}>{a.name}: <span className="font-medium">{p.mentor.name}</span> could mentor <span className="font-medium">{p.learner.name}</span></li>))}
            </ul>
          </div>
        )}
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Progress since an earlier round</h3>
        {!prog || !prog.baselines.length ? <p className="text-sm text-slate-600">Progress appears when there is an earlier round with the same assessment.</p> : (
          <>
            <div className="max-w-xs"><Select label="Compare with" options={prog.baselines.map((b) => ({ value: b.id, label: `${b.name} (${b.opensOn})` }))} value={prog.baseline?.id ?? ''} onChange={setBaseline} /></div>
            {prog.progress?.suppressed ? <p className="text-sm text-slate-600">{prog.progress.cohort} members took part in both rounds; progress shows once at least {prog.minGroup} have.</p> : prog.progress && (
              <>
                <p className="text-sm text-slate-700">{prog.progress.cohort} members took part in both rounds: {prog.progress.movedUp} moved up a band, {prog.progress.movedDown} moved down. {prog.progress.newMembers} new members are not in the comparison.</p>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="py-1 pr-3">Area</th><th className="pr-3">Median change</th><th className="pr-3">Improved</th><th className="pr-3">Declined</th><th>Exchange participants vs others</th></tr></thead>
                  <tbody>{prog.progress.areas!.map((a) => {
                    const c = prog.contribution.find((x) => x.key === a.key)
                    return (
                      <tr key={a.key} className="border-t border-slate-100 tabular-nums"><td className="py-1.5 pr-3 text-slate-800">{a.name}</td><td className="pr-3">{sign(a.medianChange)}</td><td className="pr-3">{a.improved}</td><td className="pr-3">{a.declined}</td>
                        <td className="text-slate-700">{c?.shown ? `${sign(c.tookMedian ?? null)} vs ${sign(c.didntMedian ?? null)}` : <span className="text-xs text-slate-400">needs {prog.minGroup}+ on each side</span>}</td></tr>
                    )
                  })}</tbody>
                </table>
                <p className="text-xs text-slate-500">The last column compares members who took part in an exchange on that area with those who didn't. It shows the network's possible contribution; it doesn't prove the exchange caused the change.</p>
              </>
            )}
          </>
        )}
      </section>
      <div className="flex flex-wrap gap-2">
        <a href={`/api/network-results/${roundId}/export.csv${csvQ}`} className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50">Download results (CSV)</a>
        <Link to="/networks/$networkId/brief/$roundId" params={{ networkId, roundId }} className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50">Funder and government brief</Link>
      </div>
    </div>
  )
}
