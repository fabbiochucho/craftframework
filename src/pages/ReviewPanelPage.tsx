import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Scale } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../components/ui'
import {
  CASE_KIND_LABEL, CASE_KINDS, FEEDBACK_GROUNDS, NO_CONFLICT_DECLARATION, ROSTER_KIND_LABEL, ROSTER_KINDS, VALIDATION_OUTCOME_LABEL, VALIDATION_OUTCOMES, VALIDATOR_OUTCOME_LABEL,
  VALIDATOR_OUTCOMES, type CaseKind, type Decision, type FeedbackGround, type FeedbackOutcome, type RosterKind, type ValidationOutcome, type ValidatorOutcome,
} from '../lib/reviewPanel'

// Validator system PR 7b: the Independent Review Panel. Disputes and complaints only. Every rule is enforced by
// /api/review-panel; these pages reflect what it allows the signed-in person to do.

async function api<T = any>(path: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method, cache: 'no-store',
    headers: init?.json !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(body?.error === 'mfa_required' ? 'Multi-factor sign-in required' : body?.error || `Request failed (${res.status})`), { reasons: body?.reasons as string[] | undefined })
  return body as T
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—')

type Row = { id: string; kind: CaseKind; kindLabel: string; status: string; statusLabel: string; organization: string | null; validator: string | null; overdue: boolean; decideBy: string | null; isAppeal: boolean; createdAt: string; me: null | { role: string; status: string }; decision: string | null }
type Roster = { email: string; name: string; kind: RosterKind; note: string; active: boolean }

const STATUS_STYLE: Record<string, string> = { open: 'bg-amber-100 text-amber-800', responses: 'bg-sky-100 text-sky-800', deliberating: 'bg-indigo-100 text-indigo-800', decided: 'bg-emerald-100 text-emerald-800' }

function Note({ msg }: { msg: { ok: boolean; text: string } | null }) {
  return msg ? <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p> : null
}

export function ReviewPanelPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const load = () => api<Row[]>('/api/review-panel/cases').then(setRows, (e) => setError(e.message))
  useEffect(() => { void load() }, [])
  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><Scale className="h-4 w-4 text-emerald-600" /> Independent validation</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Independent Review Panel</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Hears disputes about a validation’s result or conduct, complaints about a validator, contested material events and suspensions, challenges to re-review outcomes, and complaints about feedback.
          A new panel sits for each case: a convenor from the CRAFT programme team and two reviewers from a volunteer roster, with no conflict of interest. Both sides respond in writing, the panel decides by majority with written reasons within 30 days, and there is one appeal to a fresh panel. Platform administrators have no vote.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <RaiseCase onDone={load} />
      <Card>
        <CardHeader><CardTitle>Cases</CardTitle></CardHeader>
        <CardContent>
          {rows && !rows.length && <p className="text-sm text-slate-500">No cases.</p>}
          <ul className="space-y-2">
            {rows?.map((c) => (
              <li key={c.id}>
                <Link to="/panel/$id" params={{ id: c.id }} className="block rounded-xl border border-slate-200 bg-white p-3 hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-800">{c.kindLabel}{c.isAppeal ? ' — appeal' : ''}</p>
                    <Badge className={STATUS_STYLE[c.status] ?? ''}>{c.statusLabel}</Badge>
                    {c.overdue && <Badge className="bg-rose-100 text-rose-800">Past its 30-day target</Badge>}
                    {c.me && <Badge variant="outline" className="text-slate-600">You: {c.me.role}{c.me.status === 'invited' ? ' (invited)' : ''}</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{[c.organization, c.validator && `Validator: ${c.validator}`, `raised ${fmt(c.createdAt)}`].filter(Boolean).join(' · ')}</p>
                  {c.decision && <p className="mt-1 text-sm text-slate-700">Decision: {c.decision}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <RosterCard />
    </div>
  )
}

type VSummary = { id: string; organization: string; validatedRung: number; status: string; statusLabel: string }

function RaiseCase({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<CaseKind>('validation_dispute')
  const [vals, setVals] = useState<VSummary[]>([])
  const [validationId, setValidationId] = useState('')
  const [events, setEvents] = useState<Array<{ id: string; label: string; occurredOn: string }>>([])
  const [eventId, setEventId] = useState('')
  const [ratings, setRatings] = useState<Array<{ id: string; stars: number; comment: string }>>([])
  const [ratingId, setRatingId] = useState('')
  const [summary, setSummary] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => { if (open) void api<VSummary[]>('/api/validations').then(setVals, () => setVals([])) }, [open])
  useEffect(() => {
    if (kind === 'feedback_complaint') void api<{ ratings: Array<{ id: string; stars: number; comment: string }> }>('/api/validator-quality/me').then((m) => setRatings(m.ratings), () => setRatings([]))
  }, [kind])
  useEffect(() => {
    setEventId('')
    if (kind === 'contested_event' && validationId) void api<{ events: Array<{ id: string; label: string; occurredOn: string }> }>(`/api/validations/${encodeURIComponent(validationId)}`).then((d) => setEvents(d.events ?? []), () => setEvents([]))
  }, [kind, validationId])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    try {
      await api('/api/review-panel/cases', { method: 'POST', json: { kind, summary, ...(kind === 'feedback_complaint' ? { ratingId } : { validationId }), ...(kind === 'contested_event' ? { eventId } : {}) } })
      setMsg({ ok: true, text: 'Case raised. The CRAFT programme team will seat a panel.' })
      setSummary('')
      setOpen(false)
      onDone()
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }) }
  }
  if (!open) return <div><Button variant="outline" onClick={() => setOpen(true)}>Raise a case…</Button><Note msg={msg} /></div>
  return (
    <Card>
      <CardHeader><CardTitle>Raise a case</CardTitle><p className="text-sm text-slate-500">Only parties to a validation can raise a case about it. A report made from a public verification page is escalated by the programme team.</p></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <Select label="What is it about?" options={CASE_KINDS.map((k) => ({ value: k, label: CASE_KIND_LABEL[k] }))} value={kind} onChange={(v) => setKind(v as CaseKind)} />
          {kind === 'feedback_complaint'
            ? <Select label="The feedback" placeholder="Choose the feedback" options={ratings.map((r) => ({ value: r.id, label: `${r.stars}★ ${r.comment.slice(0, 60)}` }))} value={ratingId} onChange={setRatingId} />
            : <Select label="The validation" placeholder="Choose a validation" options={vals.map((v) => ({ value: v.id, label: `${v.organization} · rung ${v.validatedRung} · ${v.statusLabel}` }))} value={validationId} onChange={setValidationId} />}
          {kind === 'contested_event' && <Select label="The material event" placeholder="Choose the event" options={events.map((ev) => ({ value: ev.id, label: `${ev.label} (${ev.occurredOn})` }))} value={eventId} onChange={setEventId} />}
          <div>
            <label htmlFor="case-summary" className="mb-1 block text-sm font-medium text-slate-700">What happened, and what outcome are you asking for?</label>
            <textarea id="case-summary" className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={4} maxLength={4000} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <Note msg={msg} />
          <div className="flex gap-2"><Button type="submit" disabled={summary.trim().length < 10}>Raise case</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
        </form>
      </CardContent>
    </Card>
  )
}

function RosterCard() {
  const [roster, setRoster] = useState<Roster[] | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<RosterKind>('senior_validator')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const load = () => api<Roster[]>('/api/review-panel/roster').then(setRoster, () => setRoster(null))
  useEffect(() => { void load() }, [])
  if (!roster) return null
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    try { await api('/api/review-panel/roster', { method: 'POST', json: { email, name, kind } }); setEmail(''); setName(''); setMsg({ ok: true, text: 'Added to the roster' }); void load() } catch (err) { setMsg({ ok: false, text: (err as Error).message }) }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Volunteer roster</CardTitle><p className="text-sm text-slate-500">Senior Validators (currently accredited), or an outside chartered accountant or auditor until enough Senior Validators qualify. Programme team only.</p></CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1 text-sm">
          {roster.map((r) => (
            <li key={r.email} className="flex flex-wrap items-center gap-2">
              <span className={r.active ? 'font-medium text-slate-800' : 'text-slate-400 line-through'}>{r.name}</span><span className="text-slate-500">{r.email} · {ROSTER_KIND_LABEL[r.kind]}</span>
              {r.active && <Button size="sm" variant="ghost" onClick={() => void api(`/api/review-panel/roster/${encodeURIComponent(r.email)}`, { method: 'DELETE' }).then(load)}>Stand down</Button>}
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_1fr_14rem_auto] sm:items-end">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Kind" options={ROSTER_KINDS.map((k) => ({ value: k, label: ROSTER_KIND_LABEL[k] }))} value={kind} onChange={(v) => setKind(v as RosterKind)} />
          <Button type="submit" disabled={!email || !name}>Add</Button>
        </form>
        <Note msg={msg} />
      </CardContent>
    </Card>
  )
}

type Detail = {
  id: string; kind: CaseKind; kindLabel: string; status: string; statusLabel: string; summary: string; organization: string | null; validator: string | null
  validation: null | { id: string; verificationId: string | null; validatedRung: number; status: string }
  isAppeal: boolean; appealOf: string | null; appealReason: string | null; appealId: string | null; respondBy: string | null; decideBy: string | null; overdue: boolean; appealBy: string | null
  panel: Array<{ role: string; status: string; name: string; email?: string; voted?: boolean }>
  submissions: Array<{ id: string; side: string; text: string; evidenceRef: string; createdAt: string; mine: boolean }>
  decision: null | (Decision & { label: string; reasons: string; decidedAt: string; late: boolean; effects: string[] })
  can: { submit: boolean; respond: boolean; deliberate: boolean; vote: boolean; decide: boolean; appeal: boolean; compose: boolean }
  me: null | { role: string; status: string; vote: Decision | null; voteReasons: string | null }
  seatsFree: { convenor: number; reviewer: number }
  majority?: (Decision & { label: string }) | null
  evidence?: { sha256: string | null; outcome: string; validatedRung: number | null; selfRung: number | null; method: string; qualifications: Array<{ text: string }>; indicators: Array<{ id: string; level: number; domain: string; self: number | null; validator: number | null; final: number | null; sufficiency: string | null; comment: string; orgResponse: string }> }
  rating?: { stars: number; comment: string; reply: string; party: string; status: string }
  raisedBy?: string
}

export function ReviewPanelCasePage({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string; reasons?: string[] } | null>(null)
  const load = () => api<Detail>(`/api/review-panel/cases/${encodeURIComponent(id)}`).then(setD, (e) => setError(e.message))
  useEffect(() => { void load() }, [id])
  const act = async (path: string, method: string, json: unknown, ok: string) => {
    setMsg(null)
    try { const r = await api(`/api/review-panel/cases/${encodeURIComponent(id)}${path}`, { method, json }); setMsg({ ok: true, text: ok }); await load(); return r } catch (e: any) { setMsg({ ok: false, text: e.message, reasons: e.reasons }); return null }
  }
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!d) return <p className="text-sm text-slate-500">Loading…</p>
  return (
    <div className="space-y-6">
      <Link to="/panel" className="text-sm text-emerald-700 hover:underline">← Review Panel</Link>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-2xl font-bold text-emerald-900">{d.kindLabel}{d.isAppeal ? ' — appeal' : ''}</h1><Badge className={STATUS_STYLE[d.status] ?? ''}>{d.statusLabel}</Badge>{d.overdue && <Badge className="bg-rose-100 text-rose-800">Past its 30-day target</Badge>}</div>
          <p className="text-sm text-slate-500">{[d.organization, d.validator && `Validator: ${d.validator}`, d.validation?.verificationId, d.respondBy && `Responses by ${fmt(d.respondBy)}`, d.decideBy && `Decision by ${fmt(d.decideBy)}`].filter(Boolean).join(' · ')}</p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="whitespace-pre-line text-slate-700">{d.summary}</p>
          {d.isAppeal && d.appealOf && <p className="text-slate-600">Appeal of <Link to="/panel/$id" params={{ id: d.appealOf }} className="text-emerald-700 underline">the first case</Link>. This panel has none of the original members, and its decision is final.</p>}
          {d.appealId && <p className="text-slate-600">This decision was appealed: <Link to="/panel/$id" params={{ id: d.appealId }} className="text-emerald-700 underline">see the appeal</Link>.</p>}
          <Note msg={msg} />
          {msg?.reasons?.length ? <ul className="list-disc pl-5 text-sm text-rose-700">{msg.reasons.map((r) => <li key={r}>{r}</li>)}</ul> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Panel</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!d.panel.length && <p className="text-slate-500">No panel yet.</p>}
          <ul>{d.panel.map((m, i) => <li key={`${m.name}-${i}`}>{m.name}{m.email ? ` (${m.email})` : ''} — {m.role}, {m.status}{m.voted ? ', voted' : ''}</li>)}</ul>
          {d.can.compose && <Compose seats={d.seatsFree} onAdd={(email, role) => act('/members', 'POST', { email, role }, 'Invitation sent')} />}
          {d.can.compose && d.panel.filter((m) => m.status !== 'declined' && m.email).map((m) => <Button key={m.email} size="sm" variant="ghost" onClick={() => void act(`/members/${encodeURIComponent(m.email!)}`, 'DELETE', undefined, 'Invitation withdrawn')}>Withdraw {m.name}</Button>)}
          {d.can.respond && <Respond onAccept={() => void act('/respond', 'POST', { accept: true, declaration: NO_CONFLICT_DECLARATION }, 'You have accepted a seat on this panel')} onDecline={(reason) => void act('/respond', 'POST', { accept: false, reason }, 'You have declined')} />}
        </CardContent>
      </Card>

      {d.evidence && (
        <Card>
          <CardHeader><CardTitle>The frozen review</CardTitle><p className="text-sm text-slate-500">Outcome {d.evidence.outcome}, validated rung {d.evidence.validatedRung ?? '—'}, self-assessed rung {d.evidence.selfRung ?? '—'}. SHA-256 {d.evidence.sha256?.slice(0, 16)}…</p></CardHeader>
          <CardContent className="overflow-x-auto">
            {d.evidence.qualifications.length > 0 && <ul className="mb-2 list-disc pl-5 text-sm">{d.evidence.qualifications.map((q) => <li key={q.text}>{q.text}</li>)}</ul>}
            <table className="w-full text-left text-sm">
              <thead><tr className="text-xs uppercase text-slate-500"><th className="py-1 pr-3">Indicator</th><th className="pr-3">Self</th><th className="pr-3">Validator</th><th className="pr-3">Final</th><th className="pr-3">Evidence</th><th>Comment / response</th></tr></thead>
              <tbody>
                {d.evidence.indicators.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100 align-top"><td className="py-1 pr-3 font-mono text-xs">{i.id}</td><td className="pr-3">{i.self ?? '—'}</td><td className="pr-3">{i.validator ?? '—'}</td><td className="pr-3">{i.final ?? '—'}</td><td className="pr-3">{i.sufficiency ?? '—'}</td><td className="text-slate-600">{i.comment}{i.orgResponse ? <><br /><span className="text-slate-500">Organisation: {i.orgResponse}</span></> : null}</td></tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {d.rating && <Card><CardHeader><CardTitle>The feedback</CardTitle></CardHeader><CardContent className="text-sm"><p>{d.rating.stars}★ from {d.rating.party} ({d.rating.status})</p><p className="text-slate-700">{d.rating.comment}</p>{d.rating.reply && <p className="text-slate-500">Reply: {d.rating.reply}</p>}</CardContent></Card>}

      <Card>
        <CardHeader><CardTitle>Written responses</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!d.submissions.length && <p className="text-slate-500">None yet.</p>}
          {d.submissions.map((s) => (
            <div key={s.id} className="border-b border-slate-100 pb-2 last:border-0">
              <p className="text-xs text-slate-500">{s.side} · {fmt(s.createdAt)}{s.mine ? ' · yours' : ''}</p>
              <p className="whitespace-pre-line text-slate-700">{s.text}</p>
              {s.evidenceRef && <p className="text-xs text-slate-500">Evidence: {s.evidenceRef}</p>}
            </div>
          ))}
          {d.can.submit && <Respondent onSend={(text, evidenceRef) => act('/submissions', 'POST', { text, evidenceRef: evidenceRef || undefined }, 'Response added')} />}
          {d.can.deliberate && <Button onClick={() => void act('/deliberate', 'POST', {}, 'Voting is open')}>Close responses and open voting</Button>}
        </CardContent>
      </Card>

      {(d.can.vote || d.me?.vote) && d.status !== 'decided' && <VoteCard d={d} onVote={(v) => act('/vote', 'PUT', v, 'Vote saved')} />}
      {d.can.decide && <DecideCard majority={d.majority!} onDecide={(reasons) => act('/decide', 'POST', { reasons }, 'Decision recorded and applied')} />}
      {d.status === 'deliberating' && d.me?.role === 'convenor' && !d.majority && <p className="text-sm text-slate-600">No majority yet: at least two of the three members must vote for the same outcome.</p>}

      {d.decision && (
        <Card>
          <CardHeader><CardTitle>Decision</CardTitle><p className="text-sm text-slate-500">{fmt(d.decision.decidedAt)}{d.decision.late ? ' · after the 30-day target' : ''}</p></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-semibold text-slate-800">{d.decision.label}</p>
            <p className="whitespace-pre-line text-slate-700">{d.decision.reasons}</p>
            {d.decision.effects.length > 0 && <ul className="list-disc pl-5 text-slate-600">{d.decision.effects.map((e) => <li key={e}>{e}</li>)}</ul>}
            {d.can.appeal && <AppealForm by={d.appealBy} onAppeal={(reason) => act('/appeal', 'POST', { reason }, 'Appeal raised')} />}
            {!d.can.appeal && !d.isAppeal && !d.appealId && d.appealBy && <p className="text-xs text-slate-500">One appeal, to a fresh panel, until {fmt(d.appealBy)}.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Compose({ seats, onAdd }: { seats: { convenor: number; reviewer: number }; onAdd: (email: string, role: 'convenor' | 'reviewer') => Promise<unknown> }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'convenor' | 'reviewer'>(seats.convenor ? 'convenor' : 'reviewer')
  if (!seats.convenor && !seats.reviewer) return <p className="text-slate-500">All seats are filled; waiting for acceptances.</p>
  return (
    <form className="grid gap-2 sm:grid-cols-[1fr_12rem_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); void onAdd(email, role).then(() => setEmail('')) }}>
      <Input label="Invite by email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Select label="Seat" options={[...(seats.convenor ? [{ value: 'convenor', label: 'Convenor (programme team)' }] : []), ...(seats.reviewer ? [{ value: 'reviewer', label: 'Reviewer (roster)' }] : [])]} value={role} onChange={(v) => setRole(v as 'convenor' | 'reviewer')} />
      <Button type="submit" disabled={!email}>Invite</Button>
    </form>
  )
}

function Respond({ onAccept, onDecline }: { onAccept: () => void; onDecline: (reason: string) => void }) {
  const [agreed, setAgreed] = useState(false)
  const [reason, setReason] = useState('')
  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <p className="font-medium text-slate-800">You are invited to sit on this panel.</p>
      <label className="flex items-start gap-2 text-slate-700"><input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> {NO_CONFLICT_DECLARATION}</label>
      <div className="flex flex-wrap items-end gap-2">
        <Button disabled={!agreed} onClick={onAccept}>Accept the seat</Button>
        <Input label="Reason for declining (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button variant="outline" onClick={() => onDecline(reason)}>Decline</Button>
      </div>
    </div>
  )
}

function Respondent({ onSend }: { onSend: (text: string, ev: string) => Promise<unknown> }) {
  const [text, setText] = useState('')
  const [ev, setEv] = useState('')
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void onSend(text, ev).then((r) => { if (r) { setText(''); setEv('') } }) }}>
      <label htmlFor="resp-text" className="block text-sm font-medium text-slate-700">Your written response</label>
      <textarea id="resp-text" className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={4} maxLength={8000} value={text} onChange={(e) => setText(e.target.value)} />
      <Input label="Evidence reference (document name or link)" value={ev} onChange={(e) => setEv(e.target.value)} />
      <Button type="submit" disabled={text.trim().length < 3}>Add response</Button>
    </form>
  )
}

function VoteCard({ d, onVote }: { d: Detail; onVote: (v: Decision & { reasons: string }) => Promise<unknown> }) {
  const [v, setV] = useState<Decision>(d.me?.vote ?? { validation: 'none', validator: 'none', feedback: 'none' })
  const [reasons, setReasons] = useState(d.me?.voteReasons ?? '')
  const feedback = d.kind === 'feedback_complaint'
  return (
    <Card>
      <CardHeader><CardTitle>Your vote</CardTitle><p className="text-sm text-slate-500">Only you and the panel see votes. You may change your vote until the decision is recorded.</p></CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void onVote({ ...v, reasons }) }}>
          {feedback ? (
            <>
              <Select label="The feedback" options={[{ value: 'keep', label: 'Keep the feedback' }, { value: 'remove', label: 'Remove the feedback' }]} value={v.feedback === 'none' ? '' : v.feedback} placeholder="Choose" onChange={(x) => setV({ ...v, feedback: x as FeedbackOutcome })} />
              {v.feedback === 'remove' && <Select label="Ground" options={FEEDBACK_GROUNDS.map((g) => ({ value: g, label: g.replace('_', ' ') }))} value={v.feedbackGround ?? ''} placeholder="Choose" onChange={(x) => setV({ ...v, feedbackGround: x as FeedbackGround })} />}
            </>
          ) : (
            <>
              <Select label="The validation" options={VALIDATION_OUTCOMES.map((o) => ({ value: o, label: VALIDATION_OUTCOME_LABEL[o] }))} value={v.validation} onChange={(x) => setV({ ...v, validation: x as ValidationOutcome })} />
              <Select label="The validator" options={VALIDATOR_OUTCOMES.map((o) => ({ value: o, label: VALIDATOR_OUTCOME_LABEL[o] }))} value={v.validator} onChange={(x) => setV({ ...v, validator: x as ValidatorOutcome })} />
            </>
          )}
          <label htmlFor="vote-reasons" className="block text-sm font-medium text-slate-700">Your reasons</label>
          <textarea id="vote-reasons" className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={3} maxLength={4000} value={reasons} onChange={(e) => setReasons(e.target.value)} />
          <Button type="submit" disabled={reasons.trim().length < 10}>Save vote</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function DecideCard({ majority, onDecide }: { majority: Decision & { label: string }; onDecide: (reasons: string) => Promise<unknown> }) {
  const [reasons, setReasons] = useState('')
  return (
    <Card>
      <CardHeader><CardTitle>Record the decision</CardTitle><p className="text-sm text-slate-500">Majority: <b>{majority.label}</b>. Write the panel’s reasons; the decision is applied at once and cannot be edited.</p></CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void onDecide(reasons) }}>
          <label htmlFor="decide-reasons" className="block text-sm font-medium text-slate-700">Written reasons</label>
          <textarea id="decide-reasons" className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={5} maxLength={6000} value={reasons} onChange={(e) => setReasons(e.target.value)} />
          <Button type="submit" disabled={reasons.trim().length < 20}>Record and apply the decision</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function AppealForm({ by, onAppeal }: { by: string | null; onAppeal: (reason: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}>Appeal to a fresh panel (until {fmt(by)})…</Button>
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void onAppeal(reason) }}>
      <label htmlFor="appeal-reason" className="block text-sm font-medium text-slate-700">Why are you appealing? (one appeal only; its decision is final)</label>
      <textarea id="appeal-reason" className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={3} maxLength={4000} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2"><Button type="submit" disabled={reason.trim().length < 10}>Appeal</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
    </form>
  )
}
