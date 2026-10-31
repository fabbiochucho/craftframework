import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, ProgressBar, Select } from './ui'
import { PERSPECTIVES, PERSPECTIVE_LABEL, type Perspective } from '../lib/networkRounds'
import { LEVEL_LABEL, type NetworkLevel } from '../lib/networks'
import { CoordinatorResults, MemberBenchmark, ValueSurvey } from './NetworkResults'
import type { ValueAnswers } from '../lib/networkResults'

// Assessment rounds in a network: coordinators open them and follow participation; members complete the
// instrument, submit it to the network, and can add perspectives. Rules live in /api/network-rounds.

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

type RoundSummary = { id: string; name: string; nodeId: string; instrument: string; instrumentTitle: string; opensOn: string; closesOn: string; perspectives: boolean; state: 'upcoming' | 'open' | 'closed'; coordinating: boolean }
type Counts = { total: number; submitted: number; inProgress: number; notStarted: number; rate: number }
type Mine = {
  orgId: string; orgName: string; progress: { answered: number; total: number; complete: boolean }; submittedAt: string | null; value: ValueAnswers | null
  perspectives: Partial<Record<Perspective, Record<string, number>>>
  gaps: Array<{ dimension: string; name: string; spread: number | null; disagree: boolean; values: Array<{ perspective: Perspective; score: number }> }>
}
type RoundDetail = RoundSummary & {
  dimensions: Array<{ key: string; name: string }>; mine: Mine[]; coordinating?: boolean; lastRemindedAt?: string | null
  participation: null | { total: Counts; byNode: Array<Counts & { nodeId: string; name: string; level: NetworkLevel }> }
}

const STATE_STYLE = { upcoming: 'bg-slate-100 text-slate-700', open: 'bg-emerald-100 text-emerald-800', closed: 'bg-slate-200 text-slate-700' }
const STATE_LABEL = { upcoming: 'Not open yet', open: 'Open', closed: 'Closed' }

function RoundBadge({ state }: { state: RoundSummary['state'] }) {
  return <Badge className={STATE_STYLE[state]}>{STATE_LABEL[state]}</Badge>
}

function PerspectiveForm({ round, mine, onDone }: { round: RoundDetail; mine: Mine; onDone: () => void }) {
  const [p, setP] = useState<Perspective>('board')
  const [scores, setScores] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  useEffect(() => {
    const existing = mine.perspectives[p] ?? {}
    setScores(Object.fromEntries(round.dimensions.map((d) => [d.key, existing[d.key] != null ? String(existing[d.key]) : ''])))
  }, [p, mine, round.dimensions])
  const save = async () => {
    setMsg('')
    const clean = Object.fromEntries(Object.entries(scores).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]))
    try { await api(`/api/network-rounds/${round.id}/perspectives`, { method: 'POST', json: { orgId: mine.orgId, perspective: p, scores: clean } }); setMsg('Saved'); onDone() } catch (e) { setMsg((e as Error).message) }
  }
  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-3">
      <p className="text-sm text-slate-700">Ask each group to agree a score from 0 to 5 for each area, then record it here. Where groups see things differently, the report shows it.</p>
      <Select label="Whose view" options={PERSPECTIVES.map((x) => ({ value: x, label: PERSPECTIVE_LABEL[x] }))} value={p} onChange={(v) => setP(v as Perspective)} />
      <div className="grid gap-2 sm:grid-cols-2">
        {round.dimensions.map((d) => (
          <Input key={d.key} label={d.name} type="number" min={0} max={5} step={1} value={scores[d.key] ?? ''} onChange={(e) => setScores({ ...scores, [d.key]: e.target.value })} />
        ))}
      </div>
      <Button size="sm" onClick={() => void save()}>Save this view</Button>
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
      {mine.gaps.some((g) => g.disagree) && (
        <div>
          <p className="text-sm font-medium text-amber-800">Where the groups disagree (2 points or more apart)</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
            {mine.gaps.filter((g) => g.disagree).map((g) => <li key={g.dimension}>{g.name}: {g.values.map((v) => `${PERSPECTIVE_LABEL[v.perspective]} ${v.score}`).join(', ')}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

/** For a member organisation: the rounds of this network it takes part in. */
export function MemberRounds({ networkId }: { networkId: string }) {
  const [rounds, setRounds] = useState<RoundDetail[] | null>(null)
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [survey, setSurvey] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const list = await api<{ rounds: RoundSummary[] }>(`/api/network-rounds?networkId=${encodeURIComponent(networkId)}`)
      setRounds(await Promise.all(list.rounds.filter((r) => r.state !== 'upcoming').map((r) => api<RoundDetail>(`/api/network-rounds/${r.id}`))))
    } catch (e) { setMsg((e as Error).message); setRounds([]) }
  }, [networkId])
  useEffect(() => { void load() }, [load])
  const submit = async (roundId: string, orgId: string) => {
    setMsg('')
    try { await api(`/api/network-rounds/${roundId}/submit`, { method: 'POST', json: { orgId } }); setMsg('Submitted to the network'); void load() } catch (e) { setMsg((e as Error).message) }
  }
  if (!rounds || rounds.length === 0) return null
  return (
    <div className="space-y-3 border-t border-slate-200 pt-3">
      <p className="text-sm font-medium text-slate-800">Assessment rounds</p>
      {rounds.map((r) => r.mine.map((m) => (
        <div key={r.id + m.orgId} className="space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">{r.name} · {r.instrumentTitle}</p>
            <RoundBadge state={r.state} />
          </div>
          <p className="text-xs text-slate-600">Open {r.opensOn} to {r.closesOn}. {m.submittedAt ? `Submitted ${new Date(m.submittedAt).toLocaleDateString()}.` : 'Not submitted yet.'}</p>
          <ProgressBar value={m.progress.answered} max={Math.max(1, m.progress.total)} />
          <p className="text-xs text-slate-600">{m.progress.answered} of {m.progress.total} questions answered</p>
          {r.state === 'open' && (
            <div className="flex flex-wrap gap-2">
              <Link to="/assessment/$frameworkId" params={{ frameworkId: r.instrument }} className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50">Open the assessment</Link>
              <Button size="sm" onClick={() => void submit(r.id, m.orgId)} disabled={m.progress.answered === 0}>{m.submittedAt ? 'Submit again with my latest answers' : 'Submit to the network'}</Button>
              {r.perspectives && <Button size="sm" variant="outline" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Hide perspectives' : 'Add perspectives'}</Button>}
              <Button size="sm" variant="outline" onClick={() => setSurvey(survey === r.id ? null : r.id)}>{survey === r.id ? 'Hide value survey' : m.value ? 'Update value survey' : 'Value survey (2 minutes)'}</Button>
            </div>
          )}
          {open === r.id && <PerspectiveForm round={r} mine={m} onDone={() => void load()} />}
          {survey === r.id && <ValueSurvey roundId={r.id} orgId={m.orgId} initial={m.value} onDone={() => void load()} />}
          <MemberBenchmark roundId={r.id} orgId={m.orgId} />
        </div>
      )))}
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
    </div>
  )
}

function Participation({ d, onChange }: { d: RoundDetail; onChange: () => void }) {
  const [msg, setMsg] = useState('')
  const act = async (path: string, ok: (b: any) => string) => {
    setMsg('')
    try { const b = await api(`/api/network-rounds/${d.id}/${path}`, { method: 'POST' }); setMsg(ok(b)); onChange() } catch (e) { setMsg((e as Error).message) }
  }
  if (!d.participation) return null
  const t = d.participation.total
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-4">
        {[['Submitted', t.submitted], ['In progress', t.inProgress], ['Not started', t.notStarted], ['Response rate', `${t.rate}%`]].map(([l, v]) => (
          <div key={l as string} className="rounded-md border border-slate-200 p-2"><p className="text-xs text-slate-500">{l}</p><p className="text-lg font-semibold tabular-nums text-slate-900">{v}</p></div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="py-1 pr-3">Level</th><th className="pr-3">Members</th><th className="pr-3">Submitted</th><th className="pr-3">In progress</th><th>Not started</th></tr></thead>
          <tbody>{d.participation.byNode.map((n) => (
            <tr key={n.nodeId} className="border-t border-slate-100 tabular-nums"><td className="py-1 pr-3">{n.name} <span className="text-xs text-slate-500">{LEVEL_LABEL[n.level]}</span></td><td className="pr-3">{n.total}</td><td className="pr-3">{n.submitted}</td><td className="pr-3">{n.inProgress}</td><td>{n.notStarted}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Participation is shown as counts so members who chose "totals only" stay unnamed. A reminder goes straight to every member that hasn't submitted.</p>
      {d.coordinating && d.state === 'open' && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void act('remind', (b) => `Reminder sent to ${b.sent} of ${b.waiting} organisations that haven't submitted`)}>Send reminder</Button>
          <Button size="sm" variant="outline" onClick={() => void act('close', () => 'Round closed')}>Close round now</Button>
        </div>
      )}
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
    </div>
  )
}

/** For coordinators: rounds at their levels, participation, and opening a new round. */
export function CoordinatorRounds({ networkId, nodes, coordinates }: { networkId: string; nodes: Array<{ id: string; name: string; level: NetworkLevel }>; coordinates: string[] }) {
  const [list, setList] = useState<{ instruments: Array<{ id: string; title: string }>; canCreate: boolean; rounds: RoundSummary[] } | null>(null)
  const [detail, setDetail] = useState<RoundDetail | null>(null)
  const [resultsFor, setResultsFor] = useState<string | null>(null)
  const [form, setForm] = useState({ nodeId: coordinates[0] ?? '', name: '', instrument: '', opensOn: new Date().toISOString().slice(0, 10), closesOn: '', perspectives: false })
  const [msg, setMsg] = useState('')
  const load = useCallback(() => { void api(`/api/network-rounds?networkId=${encodeURIComponent(networkId)}`).then(setList, (e) => setMsg(e.message)) }, [networkId])
  useEffect(load, [load])
  const show = (id: string) => { void api<RoundDetail>(`/api/network-rounds/${id}`).then(setDetail, (e) => setMsg(e.message)) }
  const create = async () => {
    setMsg('')
    try { await api('/api/network-rounds', { method: 'POST', json: { networkId, ...form } }); setForm({ ...form, name: '' }); load() } catch (e) { setMsg((e as Error).message) }
  }
  if (!list) return null
  const coordNodes = nodes.filter((n) => coordinates.includes(n.id))
  return (
    <Card>
      <CardHeader><CardTitle>Assessment rounds</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {list.rounds.length === 0 && <p className="text-sm text-slate-500">No rounds yet. A round asks every member at a level, and below it, to complete one assessment by a closing date.</p>}
        <ul className="space-y-2">
          {list.rounds.map((r) => (
            <li key={r.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-600">{r.instrumentTitle} · {nodes.find((n) => n.id === r.nodeId)?.name} and below · {r.opensOn} to {r.closesOn}{r.perspectives ? ' · perspectives on' : ''}</p>
                </div>
                <div className="flex items-center gap-2"><RoundBadge state={r.state} /><Button size="sm" variant="outline" onClick={() => (detail?.id === r.id ? setDetail(null) : show(r.id))}>{detail?.id === r.id ? 'Hide' : 'Participation'}</Button><Button size="sm" variant="outline" onClick={() => setResultsFor(resultsFor === r.id ? null : r.id)}>{resultsFor === r.id ? 'Hide results' : 'Results'}</Button></div>
              </div>
              {detail?.id === r.id && <div className="mt-3"><Participation d={detail} onChange={() => { show(r.id); load() }} /></div>}
              {resultsFor === r.id && <div className="mt-3 border-t border-slate-200 pt-3"><CoordinatorResults roundId={r.id} /></div>}
            </li>
          ))}
        </ul>
        {list.canCreate && coordNodes.length > 0 && (
          <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
            <p className="text-sm font-medium text-slate-800 sm:col-span-2">Open a new round</p>
            <Input label="Round name (e.g. Baseline 2026)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select label="Level (members at this level and below take part)" options={coordNodes.map((n) => ({ value: n.id, label: `${n.name} (${LEVEL_LABEL[n.level]})` }))} value={form.nodeId} onChange={(v) => setForm({ ...form, nodeId: v })} />
            <Select label="Assessment" placeholder="Choose" options={list.instruments.map((i) => ({ value: i.id, label: i.title }))} value={form.instrument} onChange={(v) => setForm({ ...form, instrument: v })} />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Opens" type="date" value={form.opensOn} onChange={(e) => setForm({ ...form, opensOn: e.target.value })} />
              <Input label="Closes" type="date" value={form.closesOn} onChange={(e) => setForm({ ...form, closesOn: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={form.perspectives} onChange={(e) => setForm({ ...form, perspectives: e.target.checked })} />
              Also collect perspectives (board, management, staff, community, facilitator) so differences of view show up
            </label>
            <div><Button size="sm" onClick={() => void create()} disabled={form.name.trim().length < 3 || !form.instrument || !form.closesOn}>Open round</Button></div>
          </div>
        )}
        {msg && <p className="text-sm text-slate-700">{msg}</p>}
      </CardContent>
    </Card>
  )
}
