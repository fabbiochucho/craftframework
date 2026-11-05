// Milestone register and verification packs for one award. The organisation builds and approves packs; the award's
// funder accepts or returns submitted milestones. Rules: src/lib/milestones.ts; storage: /api/milestones.
import { useCallback, useEffect, useState } from 'react'
import { Button, Input } from './ui'
import { cn } from '../lib/utils'
import { useAuthCtx } from '../lib/context'
import { canApprove, MILESTONE_STATUS_LABEL, packGaps, registerSummary, type EvidenceItem, type Milestone } from '../lib/milestones'

type Row = Milestone & { funderNote: string }

async function api<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/milestones${path}`, init && { method: init.method, headers: { 'content-type': 'application/json' }, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const body = await res.json().catch(() => ({})) as T & { error?: string }
  if (!res.ok) throw new Error(body.error === 'mfa_required' ? 'Confirm your two-step sign-in, then try again.' : body.error ?? `Request failed (${res.status})`)
  return body
}

const STATUS_STYLE: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-700', approved: 'bg-sky-100 text-sky-800', submitted: 'bg-amber-100 text-amber-800', accepted: 'bg-emerald-100 text-emerald-800', rejected: 'bg-rose-100 text-rose-800',
}
const blankMilestone = { title: '', owner: '', indicator: '', baseline: '', target: '', verificationMeans: '', dueDate: '' }

export function MilestonesCard({ awardId, asFunder = false }: { awardId: string; asFunder?: boolean }) {
  const { currentUser } = useAuthCtx()
  const me = currentUser?.email ?? ''
  const [data, setData] = useState<{ milestones: Row[]; evidence: EvidenceItem[] } | null>(null)
  const [f, setF] = useState(blankMilestone)
  const [ev, setEv] = useState<Record<string, { description: string; ref: string }>>({})
  const [note, setNote] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(async () => { try { setData(await api(`?awardId=${encodeURIComponent(awardId)}`)) } catch (e) { setMsg((e as Error).message) } }, [awardId])
  useEffect(() => { void load() }, [load])
  const run = async (fn: () => Promise<unknown>, done?: string) => { try { await fn(); setMsg(done ?? null); await load() } catch (e) { setMsg((e as Error).message) } }

  if (!data) return <p className="text-slate-500">{msg ?? 'Loading milestones…'}</p>
  const sum = registerSummary(data.milestones, new Date().toISOString().slice(0, 10))

  return (
    <div className="space-y-2">
      <p className="font-medium">Milestones</p>
      {data.milestones.length > 0 && <p className="text-xs text-slate-500">{data.milestones.length} milestone(s) · {sum.byStatus.accepted} accepted · {sum.byStatus.submitted} awaiting the funder{sum.overdue.length > 0 && <span className="text-rose-700"> · {sum.overdue.length} overdue</span>}</p>}
      {data.milestones.map((m) => {
        const pack = data.evidence.filter((e) => e.milestoneId === m.id)
        const gaps = packGaps(m, data.evidence)
        const approve = canApprove(m, data.evidence, me)
        const open = m.status === 'planned' || m.status === 'rejected'
        const e = ev[m.id] ?? { description: '', ref: '' }
        return (
          <div key={m.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <b>{m.title}</b>
              <span className={cn('rounded px-1.5 text-xs font-semibold', STATUS_STYLE[m.status])}>{MILESTONE_STATUS_LABEL[m.status]}</span>
              {sum.overdue.includes(m.id) && <span className="rounded bg-rose-100 px-1.5 text-xs text-rose-800">Overdue</span>}
            </div>
            <p className="mt-1 text-xs text-slate-600">Owner: {m.owner || '–'} · Indicator: {m.indicator || '–'} · Baseline {m.baseline || '–'} → target {m.target || '–'}{m.dueDate && ` · due ${m.dueDate}`}</p>
            <p className="text-xs text-slate-600">Means of verification: {m.verificationMeans || '–'}{m.approvedBy && ` · pack approved by ${m.approvedBy}`}</p>
            {m.funderNote && <p className="text-xs text-slate-700">Funder: {m.funderNote}</p>}
            <p className="mt-2 text-xs font-medium">Verification pack ({pack.length})</p>
            {pack.length > 0 && <ol className="list-decimal pl-5 text-xs">{pack.map((x) => <li key={x.id}>{x.description}: {/^https?:\/\//.test(x.ref) ? <a className="text-emerald-700 underline" href={x.ref} target="_blank" rel="noopener noreferrer">{x.ref}</a> : x.ref} <span className="text-slate-400">({x.addedBy})</span></li>)}</ol>}
            {!asFunder && open && (
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Input label="Evidence" value={e.description} onChange={(x) => setEv({ ...ev, [m.id]: { ...e, description: x.target.value } })} />
                <Input label="Link or where it is held" value={e.ref} onChange={(x) => setEv({ ...ev, [m.id]: { ...e, ref: x.target.value } })} />
                <Button size="sm" variant="outline" disabled={e.description.trim().length < 3 || e.ref.trim().length < 3}
                  onClick={() => void run(() => api(`/${m.id}/evidence`, { method: 'POST', body: e }).then(() => setEv({ ...ev, [m.id]: { description: '', ref: '' } })))}>Add to pack</Button>
              </div>
            )}
            {!asFunder && open && gaps.length > 0 && <p className="mt-1 text-xs text-amber-700">Before approval: {gaps.join('; ')}.</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {!asFunder && open && <Button size="sm" disabled={!approve.ok} title={approve.reason} onClick={() => void run(() => api(`/${m.id}/approve`, { method: 'POST' }), 'Pack approved.')}>Approve pack</Button>}
              {!asFunder && m.status === 'approved' && <Button size="sm" onClick={() => void run(() => api(`/${m.id}/submit`, { method: 'POST' }), 'Submitted to the funder.')}>Submit to funder</Button>}
              {asFunder && m.status === 'submitted' && <>
                <Input aria-label="Note to the organisation" placeholder="Note (required to return)" value={note[m.id] ?? ''} onChange={(x) => setNote({ ...note, [m.id]: x.target.value })} />
                <Button size="sm" onClick={() => void run(() => api(`/${m.id}/decide`, { method: 'POST', body: { accept: true, note: note[m.id] ?? '' } }), 'Accepted.')}>Accept</Button>
                <Button size="sm" variant="outline" className="text-rose-600" disabled={(note[m.id] ?? '').trim().length < 3}
                  onClick={() => void run(() => api(`/${m.id}/decide`, { method: 'POST', body: { accept: false, note: note[m.id] } }), 'Returned.')}>Return</Button>
              </>}
            </div>
            {!asFunder && open && !approve.ok && gaps.length === 0 && <p className="mt-1 text-xs text-slate-500">{approve.reason}</p>}
          </div>
        )
      })}
      {!asFunder && (
        <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input label="Milestone" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <Input label="Owner (role)" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} />
            <Input label="Due date" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            <Input label="Indicator" value={f.indicator} onChange={(e) => setF({ ...f, indicator: e.target.value })} />
            <Input label="Baseline" value={f.baseline} onChange={(e) => setF({ ...f, baseline: e.target.value })} />
            <Input label="Target" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Input label="Means of verification agreed with the funder" value={f.verificationMeans} onChange={(e) => setF({ ...f, verificationMeans: e.target.value })} />
            <Button size="sm" variant="outline" disabled={f.title.trim().length < 2}
              onClick={() => void run(() => api('', { method: 'POST', body: { awardId, ...f, dueDate: f.dueDate || null } }).then(() => setF(blankMilestone)), 'Milestone added.')}>Add milestone</Button>
          </div>
        </div>
      )}
      {msg && <p role="status" className="text-xs">{msg}</p>}
    </div>
  )
}
