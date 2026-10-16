import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from './ui'

// Validator system: the improvement actions that come out of an independent validation, on the CIP page.
// Owner, due date and proof of done are the organisation's to keep; the validator and (with consent)
// funders follow progress. Every rule is enforced by /api/validations; this card reflects what it allows.

type Action = { id: string; text: string; indicatorIds: string[]; owner: string | null; dueDate: string | null; status: 'open' | 'done'; proof: string; fromQualification: boolean }
type Plan = {
  id: string; verificationId: string; outcome: string; validatedRung: number; status: string; statusLabel: string; expiresAt: string
  nextFollowUp: string | null; followUpOverdue: boolean; broughtForward: boolean; tracked: string[]
  progress: { done: number; total: number }; progressLine: string; actions: Action[]
  funders: Array<{ firmId: string; name: string; grantedAt: string }>; canEdit: boolean
}

async function api<T = any>(path: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method, cache: 'no-store',
    headers: init?.json !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error === 'mfa_required' ? 'Multi-factor sign-in required' : body?.error || `Request failed (${res.status})`)
  return body as T
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—')

export function ValidationCipCard() {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string; reassess?: string[] } | null>(null)
  const load = () => api<Plan[]>('/api/validations/cip').then(setPlans, () => setPlans([]))
  useEffect(() => { void load() }, [])
  if (!plans?.length) return null
  const act = async (fn: () => Promise<any>, ok: string) => {
    try { const r = await fn(); setMsg({ ok: true, text: ok, reassess: r?.reassess }); await load() } catch (e: any) { setMsg({ ok: false, text: e.message }) }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Validation follow-up</CardTitle>
        <p className="text-sm text-slate-500">Actions arising from your independent validation. Each one needs an owner, a due date and proof it was done. Finishing them can bring the next follow-up forward; it never extends how long the validation lasts.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {msg && (
          <div role="status" className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
            <p>{msg.text}</p>
            {msg.reassess && msg.reassess.length > 0 && (
              <p className="text-slate-600">Now re-assess {msg.reassess.join(', ')} in your self-assessment: <Link to="/assessment/$frameworkId" params={{ frameworkId: 'capital-readiness-ladder' }} className="font-semibold text-emerald-700 underline">open the Capital Readiness Ladder</Link>.</p>
            )}
          </div>
        )}
        {plans.map((p) => <PlanBlock key={p.id} p={p} act={act} />)}
      </CardContent>
    </Card>
  )
}

function PlanBlock({ p, act }: { p: Plan; act: (fn: () => Promise<any>, ok: string) => Promise<void> }) {
  const base = `/api/validations/${encodeURIComponent(p.id)}`
  const closed = p.status === 'withdrawn' || p.status === 'superseded'
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/validations/$id" params={{ id: p.id }} className="font-mono text-sm font-semibold text-emerald-700 hover:underline">{p.verificationId}</Link>
        <Badge variant="outline" className="text-slate-600">{p.statusLabel}</Badge>
        <span className="text-sm text-slate-600">{p.progressLine}</span>
        {p.followUpOverdue && <Badge className="bg-amber-100 text-amber-800">follow-up overdue</Badge>}
        {p.broughtForward && <Badge className="bg-emerald-100 text-emerald-800">check brought forward</Badge>}
      </div>
      <p className="text-xs text-slate-500">Valid until {fmt(p.expiresAt)}{p.nextFollowUp ? ` · next follow-up ${fmt(p.nextFollowUp)}` : ''}</p>
      <ul className="space-y-3">
        {p.actions.map((a) => <ActionRow key={a.id} a={a} editable={p.canEdit && !closed} base={base} act={act} />)}
      </ul>
      {p.canEdit && !closed && <AddAction base={base} tracked={p.tracked} act={act} />}
      {p.canEdit && !closed && <Funders p={p} base={base} act={act} />}
    </div>
  )
}

function ActionRow({ a, editable, base, act }: { a: Action; editable: boolean; base: string; act: (fn: () => Promise<any>, ok: string) => Promise<void> }) {
  const [owner, setOwner] = useState(a.owner ?? '')
  const [due, setDue] = useState(a.dueDate ?? '')
  const [proof, setProof] = useState('')
  const done = a.status === 'done'
  return (
    <li className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-800">{a.text}</span>
        <Badge className={done ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>{done ? 'done' : 'open'}</Badge>
        <span className="font-mono text-xs text-slate-500">{a.indicatorIds.join(', ')}</span>
      </div>
      {done ? (
        <p className="text-slate-600">Owner {a.owner} · due {fmt(a.dueDate)} · proof: {a.proof}</p>
      ) : editable ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
          <Input label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
          <Input label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => void act(() => api(`${base}/cip-actions/${a.id}`, { method: 'PUT', json: { owner, dueDate: due || null } }), 'Action saved')}>Save</Button>
        </div>
      ) : <p className="text-slate-600">Owner {a.owner ?? '—'} · due {fmt(a.dueDate)}</p>}
      {editable && !done && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <Input label="Proof it was done (document reference or link)" value={proof} onChange={(e) => setProof(e.target.value)} />
          <Button size="sm" disabled={proof.trim().length < 3} onClick={() => void act(() => api(`${base}/cip-actions/${a.id}/done`, { method: 'POST', json: { proof, owner: owner || undefined, dueDate: due || undefined } }), 'Marked done')}>Mark done</Button>
        </div>
      )}
      {editable && done && <Button size="sm" variant="ghost" onClick={() => void act(() => api(`${base}/cip-actions/${a.id}/reopen`, { method: 'POST', json: {} }), 'Reopened')}>Reopen</Button>}
      {editable && !a.fromQualification && !done && <Button size="sm" variant="ghost" onClick={() => void act(() => api(`${base}/cip-actions/${a.id}`, { method: 'DELETE' }), 'Removed')}>Remove</Button>}
    </li>
  )
}

function AddAction({ base, tracked, act }: { base: string; tracked: string[]; act: (fn: () => Promise<any>, ok: string) => Promise<void> }) {
  const [text, setText] = useState('')
  const [ids, setIds] = useState(tracked.slice(0, 1).join(', '))
  const [owner, setOwner] = useState('')
  const [due, setDue] = useState('')
  return (
    <form className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault()
      void act(() => api(`${base}/cip-actions`, { method: 'POST', json: { text, indicatorIds: ids.split(/[ ,]+/).filter(Boolean), owner: owner || null, dueDate: due || null } }), 'Action added').then(() => { setText(''); setOwner(''); setDue('') })
    }}>
      <div className="sm:col-span-2"><Input label="Add an improvement action" value={text} onChange={(e) => setText(e.target.value)} /></div>
      <Input label={`Indicators (e.g. ${tracked[0] ?? 'CRL-1A'})`} value={ids} onChange={(e) => setIds(e.target.value)} />
      <div className="grid grid-cols-2 gap-2"><Input label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} /><Input label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
      <div><Button type="submit" variant="outline" disabled={!text.trim() || !ids.trim()}>Add action</Button></div>
    </form>
  )
}

// The organisation decides which funding partners may follow schedule and progress. They see counts and dates only.
function Funders({ p, base, act }: { p: Plan; base: string; act: (fn: () => Promise<any>, ok: string) => Promise<void> }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Array<{ id: string; name: string }>>([])
  return (
    <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
      <h4 className="font-semibold text-slate-700">Funding partners who can follow this</h4>
      <p className="text-xs text-slate-500">With your consent a funding partner sees the status, the schedule and a count such as “2 of 5 actions done, follow-up due 15 March”. Never the actions, owners or proof. You can withdraw consent at any time.</p>
      <ul className="space-y-1">
        {p.funders.map((f) => (
          <li key={f.firmId} className="flex items-center gap-2">{f.name} <span className="text-xs text-slate-500">since {fmt(f.grantedAt)}</span>
            <Button size="sm" variant="ghost" onClick={() => void act(() => api(`${base}/funder-consent`, { method: 'PUT', json: { funderFirmId: f.firmId, granted: false } }), `${f.name} can no longer follow this`)}>Withdraw</Button></li>
        ))}
        {!p.funders.length && <li className="text-slate-500">None.</li>}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[14rem] flex-1"><Input label="Find a funding partner" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Button size="sm" variant="outline" onClick={() => void api(`/api/directory/search?${new URLSearchParams({ type: 'funders', q })}`).then(setHits, () => setHits([]))}>Search</Button>
      </div>
      <ul className="space-y-1">
        {hits.filter((h) => !p.funders.some((f) => f.firmId === h.id)).map((h) => (
          <li key={h.id} className="flex items-center gap-2">{h.name}
            <Button size="sm" variant="ghost" onClick={() => void act(() => api(`${base}/funder-consent`, { method: 'PUT', json: { funderFirmId: h.id, granted: true } }), `${h.name} can now follow this`)}>Allow</Button></li>
        ))}
      </ul>
    </div>
  )
}
