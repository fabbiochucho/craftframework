import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../components/ui'
import { EVENT_DECISIONS, FOLLOW_UP_LABEL, FOLLOW_UP_MODES, type FollowUpMode } from '../lib/validationLifecycle'

// Validator system PR 5: the issued validation's lifecycle. Every rule is
// enforced by /api/validations; status is always computed on the server.

type Summary = {
  id: string; organization: string; framework: string; outcome: string; validatedRung: number; status: string; statusLabel: string
  issuedAt: string; expiresAt: string; nextFollowUp: string | null; can: { org: boolean; lead: boolean }
}
type Event = {
  id: string; key: string; label: string; starred: boolean; details: string; occurredOn: string; reportedAt: string; reportedBySide: string
  deadlineOn: string; late: boolean; status: string; orgResponse: string; decisionNote: string
}
type Detail = Summary & {
  validityMonths: number; validityReason: string; statusReason: string | null; surveillance: null | { dueAt: string; doneAt: string | null }
  followUp: { mode: FollowUpMode; dueOn: string | null; overdue: boolean; broughtForward: boolean; history: Array<{ dueOn: string; result: string; note: string }>; tracked: string[] }
  events: Event[]; history: Array<{ at: string; action: string }>; eventTypes: Array<{ key: string; star: boolean; label: string }>; canReport: boolean
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

const STATUS_STYLE: Record<string, string> = {
  current: 'bg-emerald-100 text-emerald-800', follow_up_overdue: 'bg-amber-100 text-amber-800', suspended: 'bg-rose-100 text-rose-800',
  expired: 'bg-slate-100 text-slate-700', withdrawn: 'bg-rose-100 text-rose-800', superseded: 'bg-slate-100 text-slate-700',
}
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—')

export function ValidationsPage() {
  const [items, setItems] = useState<Summary[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { void api<Summary[]>('/api/validations').then(setItems, (e) => setError(e.message)) }, [])
  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Independent validation</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Validations</h1>
        <p className="mt-1 text-sm text-slate-500">Issued validations with their validity, follow-up schedule and any material events. Status always follows the calendar and the recorded decisions.</p>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {items && !items.length && <p className="text-sm text-slate-500">No validation has been issued yet.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {items?.map((v) => (
          <li key={v.id}>
            <Link to="/validations/$id" params={{ id: v.id }} className="block h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-800">{v.organization}</p><Badge className={STATUS_STYLE[v.status] ?? ''}>{v.statusLabel}</Badge></div>
              <p className="mt-0.5 text-sm text-slate-500">Rung {v.validatedRung} · {v.outcome === 'validated' ? 'Validated' : 'With qualifications'} · expires {fmt(v.expiresAt)}</p>
              {v.nextFollowUp && <p className="mt-1 text-xs text-slate-600">Next follow-up {fmt(v.nextFollowUp)}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ValidationDetailPage({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const load = () => api<Detail>(`/api/validations/${encodeURIComponent(id)}`).then(setD, (e) => setError(e.message))
  useEffect(() => { void load() }, [id])
  const act = async (fn: () => Promise<Detail>, ok: string) => {
    try { setD(await fn()); setMsg({ ok: true, text: ok }) } catch (e: any) { setMsg({ ok: false, text: e.message }) }
  }
  const send = (path: string, method: string, json?: unknown) => () => api<Detail>(`/api/validations/${encodeURIComponent(id)}${path}`, { method, json: json ?? (method === 'GET' ? undefined : {}) })
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!d) return <p className="text-sm text-slate-500">Loading…</p>
  const closed = !['current', 'follow_up_overdue', 'suspended'].includes(d.status) && d.status !== 'expired'
  return (
    <div className="space-y-6">
      <Link to="/validations" className="text-sm text-emerald-700 hover:underline">← Validations</Link>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-2xl font-bold text-emerald-900">{d.organization}</h1><Badge className={STATUS_STYLE[d.status] ?? ''}>{d.statusLabel}</Badge></div>
          <p className="text-sm text-slate-600">{d.framework} · rung {d.validatedRung} · {d.outcome === 'validated' ? 'Validated' : 'Validated with qualifications'}</p>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-700">
          <p>Issued {fmt(d.issuedAt)} · valid {d.validityMonths} months · {d.status === 'expired' ? 'expired' : 'expires'} {fmt(d.expiresAt)}{d.validityReason ? ` (${d.validityReason})` : ''}</p>
          {d.surveillance && <p>Surveillance check due {fmt(d.surveillance.dueAt)}: {d.surveillance.doneAt ? `done ${fmt(d.surveillance.doneAt)}` : 'not yet recorded (if missed, the validation expires at 12 months)'}</p>}
          {d.statusReason && <p className="text-rose-700">{d.statusReason}</p>}
          {d.can.lead && ['current', 'follow_up_overdue'].includes(d.status) && d.surveillance && !d.surveillance.doneAt && <Button size="sm" variant="outline" onClick={() => void act(send('/surveillance', 'POST'), 'Surveillance check recorded')}>Record the surveillance check</Button>}
        </CardContent>
      </Card>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}

      <Card>
        <CardHeader><CardTitle>Follow-up</CardTitle><p className="text-sm text-slate-500">A follow-up re-checks only the qualified or blocking indicators ({d.followUp.tracked.join(', ') || 'none'}). The CIP can bring a check forward; it never extends validity.</p></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-700">
            {d.followUp.dueOn ? <>Next check <strong>{fmt(d.followUp.dueOn)}</strong>{d.followUp.overdue && <Badge className="ml-2 bg-amber-100 text-amber-800">overdue</Badge>}{d.followUp.broughtForward && <span className="text-slate-500"> (brought forward: the CIP actions are done)</span>}</> : 'No follow-up is due.'}
          </p>
          {(d.can.org || d.can.lead) && ['current', 'follow_up_overdue', 'suspended', 'expired'].includes(d.status) && (
            <Select label="Schedule" options={FOLLOW_UP_MODES.map((m) => ({ value: m, label: FOLLOW_UP_LABEL[m] }))} value={d.followUp.mode} onChange={(mode) => void act(send('/schedule', 'PUT', { mode }), 'Schedule updated; the other side has been told')} />
          )}
          {d.can.lead && d.followUp.dueOn && <FollowUpForm onSubmit={(b) => act(send('/follow-ups', 'POST', b), 'Follow-up recorded')} />}
          <ul className="space-y-1 text-sm text-slate-600">{d.followUp.history.map((h) => <li key={h.dueOn}>{fmt(h.dueOn)}: {h.result}{h.note ? ` — ${h.note}` : ''}</li>)}</ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Material events</CardTitle><p className="text-sm text-slate-500">The organisation reports within 30 days (5 working days for ★ events). Reporting suspends the validation until the validator reviews it.</p></CardHeader>
        <CardContent className="space-y-4">
          {!d.events.length && <p className="text-sm text-slate-500">None recorded.</p>}
          {d.events.map((e) => <EventRow key={e.id} e={e} d={d} act={act} send={send} />)}
          {d.canReport && ['current', 'follow_up_overdue', 'suspended'].includes(d.status) && <ReportEvent types={d.eventTypes} onSubmit={(b) => act(send('/events', 'POST', b), 'Event recorded; the validation is suspended pending review')} />}
        </CardContent>
      </Card>

      {d.can.lead && ['current', 'follow_up_overdue', 'suspended'].includes(d.status) && <LeadControls act={act} send={send} />}

      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent><ol className="space-y-1 text-sm text-slate-600">{d.history.map((h, i) => <li key={i}>{fmt(h.at)} — {h.action}</li>)}</ol></CardContent>
      </Card>
      {closed && <p className="text-xs text-slate-500">This validation is closed.</p>}
    </div>
  )
}

function FollowUpForm({ onSubmit }: { onSubmit: (b: unknown) => void }) {
  const [result, setResult] = useState('confirmed')
  const [note, setNote] = useState('')
  return (
    <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
      <Select label="Result of this follow-up" options={[{ value: 'confirmed', label: 'Confirmed' }, { value: 'concerns', label: 'Concerns raised' }]} value={result} onChange={setResult} />
      <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" onClick={() => onSubmit({ result, note })}>Record follow-up</Button>
    </div>
  )
}

function ReportEvent({ types, onSubmit }: { types: Array<{ key: string; star: boolean; label: string }>; onSubmit: (b: unknown) => void }) {
  const [key, setKey] = useState('')
  const [on, setOn] = useState('')
  const [details, setDetails] = useState('')
  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <h4 className="text-sm font-semibold text-slate-700">Record a material event</h4>
      <Select label="Event" placeholder="Choose…" options={types.map((t) => ({ value: t.key, label: `${t.star ? '★ ' : ''}${t.label}` }))} value={key} onChange={setKey} />
      <Input label="When it happened" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
      <Input label="Details" value={details} onChange={(e) => setDetails(e.target.value)} />
      <Button disabled={!key || !on} onClick={() => onSubmit({ eventKey: key, occurredOn: on, details })}>Record (suspends the validation pending review)</Button>
    </div>
  )
}

function EventRow({ e, d, act, send }: { e: Event; d: Detail; act: (fn: () => Promise<Detail>, ok: string) => Promise<void>; send: (p: string, m: string, j?: unknown) => () => Promise<Detail> }) {
  const [response, setResponse] = useState(e.orgResponse)
  const [note, setNote] = useState('')
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{e.starred ? '★ ' : ''}{e.label}</span>
        <Badge variant="outline" className="text-slate-600">{e.status}</Badge>
        {e.late && <Badge className="bg-rose-100 text-rose-800">reported late</Badge>}
        <Badge variant="outline" className="text-slate-600">{e.reportedBySide === 'programme' ? 'recorded by CRAFT programme team' : 'reported by the organisation'}</Badge>
      </div>
      <p className="text-slate-600">Occurred {fmt(e.occurredOn)} · reporting deadline {fmt(e.deadlineOn)}{e.details ? ` · ${e.details}` : ''}</p>
      {e.orgResponse && e.status !== 'open' && <p className="text-slate-600">Organisation response: {e.orgResponse}</p>}
      {e.decisionNote && <p className="text-slate-600">Decision note: {e.decisionNote}</p>}
      {d.can.org && e.status === 'open' && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem] flex-1"><Input label="Your response" value={response} onChange={(ev) => setResponse(ev.target.value)} /></div>
          <Button size="sm" variant="outline" disabled={!response.trim()} onClick={() => void act(send(`/events/${e.id}/respond`, 'PUT', { response }), 'Response saved')}>Respond</Button>
        </div>
      )}
      {d.can.lead && e.status === 'open' && (
        <div className="space-y-2">
          <Input label="Your note on the decision" value={note} onChange={(ev) => setNote(ev.target.value)} />
          <div className="flex flex-wrap gap-2">
            {EVENT_DECISIONS.map((x) => <Button key={x} size="sm" variant={x === 'withdraw' ? 'outline' : 'primary'} disabled={!note.trim()} onClick={() => void act(send(`/events/${e.id}/decision`, 'POST', { decision: x, note }), 'Decision recorded')}>{x === 'reinstate' ? 'Reinstate' : x === 're_scope' ? 'Re-scope' : 'Withdraw'}</Button>)}
          </div>
        </div>
      )}
    </div>
  )
}

function LeadControls({ act, send }: { act: (fn: () => Promise<Detail>, ok: string) => Promise<void>; send: (p: string, m: string, j?: unknown) => () => Promise<Detail> }) {
  const [until, setUntil] = useState('')
  const [why, setWhy] = useState('')
  return (
    <Card>
      <CardHeader><CardTitle>Validator controls</CardTitle><p className="text-sm text-slate-500">You can shorten the validity for a named risk (never lengthen it) or withdraw the validation with a reason.</p></CardHeader>
      <CardContent className="space-y-2">
        <Input label="Reason / named risk" value={why} onChange={(e) => setWhy(e.target.value)} />
        <div className="grid gap-2 sm:grid-cols-[12rem_auto_auto] sm:items-end">
          <Input label="Shorten to" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          <Button size="sm" variant="outline" disabled={!until || !why.trim()} onClick={() => void act(send('/shorten', 'PUT', { expiresOn: until, reason: why }), 'Validity shortened')}>Shorten validity</Button>
          <Button size="sm" variant="outline" disabled={!why.trim()} onClick={() => { if (window.confirm('Withdraw this validation? This cannot be undone.')) void act(send('/withdraw', 'POST', { reason: why }), 'Validation withdrawn') }}>Withdraw</Button>
        </div>
      </CardContent>
    </Card>
  )
}
