import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, Clock, Download, FileText, Inbox, Paperclip, RefreshCw, Send, Upload, X } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from './ui'

// Evidence requests inside an engagement (/api/evidence-requests). The reviewing side asks for a document
// by a due date; the organisation links items from its Evidence registry and submits; the reviewer opens
// what was submitted and accepts it or asks for more.

export type EvidenceRequest = {
  id: string; engagementId: string; title: string; indicatorId: string | null; note: string; dueOn: string
  status: 'open' | 'submitted' | 'accepted' | 'more_needed' | 'cancelled'; overdue: boolean
  requestedBy: string; createdAt: string; submittedBy: string | null; submittedAt: string | null; submissionNote: string
  reviewedBy: string | null; reviewedAt: string | null; reviewNote: string
  items: Array<{ evidenceId: number; name: string; sha256: string | null; linkedBy: string; linkedAt: string }>
}
type Option = { id: number; name: string; documentType: string; status: string }

async function call<T = any>(path: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method, cache: 'no-store',
    headers: init?.json !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error === 'mfa_required' ? 'Multi-factor sign-in required' : body?.error || `Request failed (${res.status})`)
  return body as T
}

const STATUS: Record<EvidenceRequest['status'], { label: string; cls: string }> = {
  open: { label: 'Waiting for evidence', cls: 'bg-amber-100 text-amber-800' },
  more_needed: { label: 'More needed', cls: 'bg-rose-100 text-rose-800' },
  submitted: { label: 'Submitted · to review', cls: 'bg-indigo-100 text-indigo-800' },
  accepted: { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Withdrawn', cls: 'bg-slate-100 text-slate-600' },
}
const fmt = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

export function EvidenceRequests({ engagementId }: { engagementId: string }) {
  const [data, setData] = useState<{ side: 'organization' | 'reviewer'; engagementStatus: string; requests: EvidenceRequest[] } | null>(null)
  const [options, setOptions] = useState<Option[]>([])
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const load = useCallback(() => call(`/api/evidence-requests?engagementId=${encodeURIComponent(engagementId)}`).then(setData, (e) => setError(e.message)), [engagementId])
  const loadOptions = useCallback(() => call<{ options: Option[] }>(`/api/evidence-requests/options?engagementId=${encodeURIComponent(engagementId)}`)
    .then((o) => setOptions(o.options), () => {}), [engagementId])
  useEffect(() => { void load() }, [load])
  useEffect(() => { if (data?.side === 'organization') void loadOptions() }, [data?.side, loadOptions])

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null)
    try { await fn(); setMsg({ ok: true, text: ok }); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  if (error) return null // not a party to this engagement's requests: show nothing
  if (!data) return null
  const active = data.engagementStatus === 'active'
  const open = data.requests.filter((r) => r.status !== 'cancelled')
  const waiting = open.filter((r) => (data.side === 'organization' ? r.status === 'open' || r.status === 'more_needed' : r.status === 'submitted')).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Inbox className="h-4 w-4 text-emerald-600" /> Evidence requests
          {waiting > 0 && <Badge className="bg-amber-100 text-amber-800">{waiting} {data.side === 'organization' ? 'waiting for you' : 'to review'}</Badge>}
        </CardTitle>
        <p className="text-sm text-slate-500">
          {data.side === 'organization'
            ? 'Documents the reviewers asked for. Upload them to your Evidence registry (or pick ones already there), link them here and submit. Reviewers can open only what you submit to a request.'
            : 'Ask the organisation for specific documents by a due date. You can open only what it submits to your requests; every view is logged.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.side === 'reviewer' && active && <NewRequest engagementId={engagementId} onDone={load} />}
        {!active && <p className="text-sm text-slate-500">This engagement is not active, so requests cannot change.</p>}
        {!open.length && <p className="text-sm text-slate-500">No evidence requested yet.</p>}
        <ul className="space-y-3">
          {data.requests.map((r) => (
            <RequestRow key={r.id} r={r} side={data.side} active={active} options={options} onRefreshOptions={loadOptions} act={act} />
          ))}
        </ul>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-emerald-700' : 'text-sm text-rose-700'}>{msg.text}</p>}
      </CardContent>
    </Card>
  )
}

function NewRequest({ engagementId, onDone }: { engagementId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', indicatorId: '', dueOn: inDays(14), note: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!open) return <Button size="sm" onClick={() => setOpen(true)}><FileText className="h-4 w-4" /> Request evidence</Button>
  return (
    <form className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault()
      setBusy(true); setErr('')
      try {
        await call('/api/evidence-requests', { method: 'POST', json: { engagementId, title: f.title, indicatorId: f.indicatorId || undefined, dueOn: f.dueOn, note: f.note || undefined } })
        setF({ title: '', indicatorId: '', dueOn: inDays(14), note: '' }); setOpen(false); onDone()
      } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
    }}>
      <div className="sm:col-span-2"><Input label="What do you need?" placeholder="Audited accounts 2025, signed by the auditor" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <Input label="Indicator or question (optional)" placeholder="e.g. L2-FIN-03" value={f.indicatorId} onChange={(e) => setF({ ...f, indicatorId: e.target.value })} />
      <Input label="Due date" type="date" min={inDays(0)} max={inDays(365)} value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} />
      <div className="sm:col-span-2">
        <label htmlFor="evr-note" className="mb-1 block text-sm font-medium text-slate-700">Note to the organisation (optional)</label>
        <textarea id="evr-note" rows={2} maxLength={2000} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
      </div>
      {err && <p role="alert" className="text-sm text-rose-700 sm:col-span-2">{err}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={busy || f.title.trim().length < 3 || !f.dueOn}><Send className="h-4 w-4" /> Send request</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}

function RequestRow({ r, side, active, options, onRefreshOptions, act }: {
  r: EvidenceRequest; side: 'organization' | 'reviewer'; active: boolean; options: Option[]; onRefreshOptions: () => void
  act: (fn: () => Promise<unknown>, ok: string) => Promise<void>
}) {
  const [pick, setPick] = useState('')
  const [note, setNote] = useState('')
  const base = `/api/evidence-requests/${encodeURIComponent(r.id)}`
  const waitingOnOrg = r.status === 'open' || r.status === 'more_needed'
  const linked = new Set(r.items.map((i) => i.evidenceId))
  const choices = options.filter((o) => !linked.has(o.id))
  return (
    <li className={`rounded-xl border p-4 ${r.overdue ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-slate-900">{r.title}</p>
        <Badge className={STATUS[r.status].cls}>{STATUS[r.status].label}</Badge>
        {r.overdue && <Badge className="bg-rose-100 text-rose-800"><Clock className="mr-1 inline h-3 w-3" />Overdue</Badge>}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Due {fmt(r.dueOn)}{r.indicatorId ? ` · ${r.indicatorId}` : ''} · asked by {r.requestedBy} on {fmt(r.createdAt)}
      </p>
      {r.note && <p className="mt-2 text-sm text-slate-700">{r.note}</p>}
      {r.status === 'more_needed' && r.reviewNote && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-sm text-rose-800"><strong>More needed:</strong> {r.reviewNote}</p>}
      {r.status === 'accepted' && r.reviewNote && <p className="mt-2 text-sm text-emerald-800">{r.reviewNote}</p>}
      {r.submissionNote && <p className="mt-2 text-sm text-slate-600"><strong>Organisation's note:</strong> {r.submissionNote}</p>}

      {r.items.length > 0 && (
        <ul className="mt-3 space-y-1">
          {r.items.map((i) => (
            <li key={i.evidenceId} className="flex flex-wrap items-center gap-2 text-sm">
              <Paperclip className="h-3.5 w-3.5 text-slate-400" /> {i.name}
              {side === 'reviewer' && r.status !== 'open' && (
                <a className="inline-flex items-center gap-1 text-emerald-700 underline" href={`${base}/items/${i.evidenceId}/download`}>
                  <Download className="h-3.5 w-3.5" /> Open
                </a>
              )}
              {side === 'organization' && waitingOnOrg && active && (
                <button type="button" aria-label={`Remove ${i.name}`} className="text-slate-400 hover:text-rose-600"
                  onClick={() => void act(() => call(`${base}/items/${i.evidenceId}`, { method: 'DELETE' }), 'Removed')}><X className="h-3.5 w-3.5" /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      {side === 'organization' && waitingOnOrg && active && (
        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1">
              <Select label="Link a document from your Evidence registry" placeholder={choices.length ? 'Choose a document' : 'No documents yet: upload one first'}
                value={pick} onChange={setPick} options={choices.map((o) => ({ value: String(o.id), label: o.name }))} />
            </div>
            <Button size="sm" variant="outline" disabled={!pick}
              onClick={() => void act(() => call(`${base}/items`, { method: 'POST', json: { evidenceId: Number(pick) } }).then(() => setPick('')), 'Linked')}>
              <Paperclip className="h-4 w-4" /> Link
            </Button>
          </div>
          <p className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <Link to="/app/workspaces" target="_blank" className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline"><Upload className="h-3.5 w-3.5" /> Upload to your Evidence registry</Link>
            <button type="button" onClick={onRefreshOptions} className="inline-flex items-center gap-1 text-slate-600 underline"><RefreshCw className="h-3.5 w-3.5" /> Refresh the list after uploading</button>
          </p>
          <Input label="Note to the reviewer (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" disabled={!r.items.length}
            onClick={() => void act(() => call(`${base}/submit`, { method: 'POST', json: { note: note || undefined } }).then(() => setNote('')), 'Submitted. The reviewer has been told.')}>
            <Send className="h-4 w-4" /> Mark as submitted
          </Button>
        </div>
      )}

      {side === 'reviewer' && active && r.status === 'submitted' && (
        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <Input label="Note to the organisation (required to ask for more)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void act(() => call(`${base}/review`, { method: 'POST', json: { decision: 'accept', note: note || undefined } }).then(() => setNote('')), 'Accepted')}>
              <CheckCircle2 className="h-4 w-4" /> Accept
            </Button>
            <Button size="sm" variant="outline" disabled={!note.trim()}
              onClick={() => void act(() => call(`${base}/review`, { method: 'POST', json: { decision: 'more', note } }).then(() => setNote('')), 'Asked for more')}>
              Ask for more
            </Button>
          </div>
        </div>
      )}
      {side === 'reviewer' && active && waitingOnOrg && (
        <button type="button" className="mt-2 text-xs text-slate-500 underline"
          onClick={() => void act(() => call(`${base}/cancel`, { method: 'POST', json: {} }), 'Request withdrawn')}>Withdraw request</button>
      )}
    </li>
  )
}

/** "Evidence waiting" summary for the Engagements list: requests on my organisation, submissions to my review. */
export function EvidenceWaiting() {
  const [d, setD] = useState<{ forMyOrganisation: EvidenceRequest[]; awaitingMyReview: Array<EvidenceRequest & { organization: string }> } | null>(null)
  useEffect(() => { void call('/api/evidence-requests?mine=1').then(setD, () => {}) }, [])
  if (!d || (!d.forMyOrganisation.length && !d.awaitingMyReview.length)) return null
  const rows = [
    ...d.forMyOrganisation.map((r) => ({ r, label: `Requested from your organisation: ${r.title}`, hint: `due ${fmt(r.dueOn)}${r.overdue ? ' · overdue' : ''}` })),
    ...d.awaitingMyReview.map((r) => ({ r, label: `${r.organization} submitted: ${r.title}`, hint: 'to review' })),
  ]
  return (
    <Card className="border-amber-200">
      <CardHeader><CardTitle className="flex items-center gap-2"><Inbox className="h-4 w-4 text-amber-600" /> Evidence waiting ({rows.length})</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {rows.map(({ r, label, hint }) => (
            <li key={r.id}>
              <Link to="/engagements/$id" params={{ id: r.engagementId }} className="font-medium text-emerald-700 underline">{label}</Link>
              <span className={`ml-2 text-xs ${r.overdue ? 'text-rose-700' : 'text-slate-500'}`}>{hint}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
