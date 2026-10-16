import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CalendarClock } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../components/ui'
import { OUTCOME_LABEL, type Outcome } from '../lib/validationReview'
import { FOLLOW_UP_KINDS, FOLLOW_UP_LABEL, MATERIAL_EVENTS, STATUS_LABEL, type FollowUpKind, type ValidationStatus } from '../lib/validity'

// Validator system PR 5: validity, status, material events and the CIP follow-up for a finalised validation.
// Every rule is enforced by /api/validation-lifecycle; this page only shows state and sends requests.

type Action = { id: string; text: string; indicatorIds: string[]; owner: string | null; dueDate: string | null; status: string; proof: string; fromQualification: boolean }
type Checkpoint = { id: string; kind: string; dueAt: string; state: string; result: string | null; note: string; indicatorIds: string[] }
type MEvent = {
  id: string; label: string; starred: boolean; description: string; occurredOn: string; reportedBySide: string; reportDue: string; late: boolean; status: string
  resolutionNote: string; orgResponse: string; contestedAt: string | null; contestReason: string
}
type View = {
  verificationId: string; organization: string; outcome: Outcome; validatedRung: number | null; issuedAt: string; expiresAt: string | null; status: ValidationStatus
  statusChangedAt: string; validityMonths: number; validityChoice: string; validityReason: string; surveillance: boolean; withdrawnReason: string | null; scopeNote: string
  followUp: { kind: FollowUpKind; validatorOk: boolean; orgOk: boolean; indicatorIds: string[] }
  viewer: { org: boolean; lead: boolean; funder: boolean; programme: boolean }
  funderConsent?: boolean
  history: Array<{ id: string; fromStatus: string | null; toStatus: string; reason: string; actor: string; createdAt: string }>
  checkpoints?: Checkpoint[]; actions?: Action[]; events?: MEvent[]
  progress?: { done: number; total: number; sentence: string }
  cip?: { progress: { sentence: string } } | null
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

const day = (s: string | null) => (s ? new Date(s).toISOString().slice(0, 10) : '—')
const STATUS_STYLE: Record<ValidationStatus, string> = {
  current: 'bg-emerald-100 text-emerald-800', follow_up_overdue: 'bg-amber-100 text-amber-800', suspended: 'bg-rose-100 text-rose-800',
  expired: 'bg-slate-200 text-slate-700', withdrawn: 'bg-rose-100 text-rose-800', superseded: 'bg-slate-200 text-slate-700',
}

export function ValidityPage({ id }: { id: string }) {
  const [v, setV] = useState<View | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const load = () => api<View>(`/api/validation-lifecycle/${encodeURIComponent(id)}`).then(setV, (e) => setError(e.message))
  useEffect(() => { void load() }, [id])
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg({ ok: true, text: ok }); await load() } catch (e: any) { setMsg({ ok: false, text: e.message }); await load() }
  }
  const call = (path: string, method: string, json?: unknown) => () => api(`/api/validation-lifecycle/${encodeURIComponent(id)}${path}`, { method, json })
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!v) return <p className="text-sm text-slate-500">Loading…</p>
  const closed = ['expired', 'withdrawn', 'superseded'].includes(v.status)
  return (
    <div className="space-y-6">
      <Link to="/engagements/$id/review" params={{ id }} className="text-sm text-emerald-700 hover:underline">← The frozen review</Link>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><CalendarClock className="h-4 w-4 text-emerald-600" /> {v.organization}</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Validity and follow-up</h1>
      </div>
      {msg && <div role="status" className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</div>}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-mono">{v.verificationId}</CardTitle>
            <Badge className={STATUS_STYLE[v.status]}>{STATUS_LABEL[v.status]}</Badge>
            <Badge variant="outline" className="text-slate-600">{OUTCOME_LABEL[v.outcome]}{v.validatedRung != null ? `, rung ${v.validatedRung}` : ''}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-700">
          <p>Issued {day(v.issuedAt)} · {v.expiresAt ? `valid until ${day(v.expiresAt)} (${v.validityMonths} months${v.validityChoice === 'shorter' ? `, shortened: ${v.validityReason}` : v.surveillance ? ', surveillance check at month 12' : ''})` : 'no validity period (not validated)'}</p>
          <p>Last status change {day(v.statusChangedAt)}.{v.withdrawnReason ? ` Withdrawn: ${v.withdrawnReason}` : ''}</p>
          {v.scopeNote && <p>Scope limitation: {v.scopeNote}</p>}
          <p className="text-xs text-slate-500">The CIP can bring a follow-up check forward but never extends validity.</p>
        </CardContent>
      </Card>

      {v.cip && <Card><CardHeader><CardTitle>CIP progress</CardTitle></CardHeader><CardContent className="text-sm">{v.cip.progress.sentence}</CardContent></Card>}
      {v.viewer.funder && !v.cip && <p className="text-sm text-slate-500">The organisation has not shared its CIP progress with you.</p>}

      {v.checkpoints && <Checkpoints v={v} act={act} call={call} />}
      {(v.viewer.org || v.viewer.lead || v.viewer.funder) && v.expiresAt ? <Schedule v={v} act={act} call={call} closed={closed} /> : null}
      {v.actions && <Plan v={v} act={act} call={call} closed={closed} />}
      {v.events && <Events v={v} act={act} call={call} closed={closed} />}

      <Card>
        <CardHeader><CardTitle>Status history</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-1 text-sm text-slate-700">
            {v.history.map((h) => <li key={h.id}>{day(h.createdAt)} · {h.fromStatus ? `${STATUS_LABEL[h.fromStatus as ValidationStatus] ?? h.fromStatus} → ` : ''}<strong>{STATUS_LABEL[h.toStatus as ValidationStatus] ?? h.toStatus}</strong>{h.reason ? ` — ${h.reason}` : ''}</li>)}
          </ol>
        </CardContent>
      </Card>
      {v.viewer.lead && !closed && <LeadControls act={act} call={call} />}
    </div>
  )
}

type Act = (fn: () => Promise<unknown>, ok: string) => Promise<void>
type Call = (path: string, method: string, json?: unknown) => () => Promise<unknown>

function Checkpoints({ v, act, call }: { v: View; act: Act; call: Call }) {
  const [note, setNote] = useState('')
  const cps = v.checkpoints!
  if (!cps.length) return null
  return (
    <Card>
      <CardHeader><CardTitle>Verification points</CardTitle><p className="text-sm text-slate-500">A follow-up re-checks only the qualified or blocking indicators: {v.followUp.indicatorIds.join(', ') || 'none'}.</p></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {cps.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2">
            <span>{c.kind === 'surveillance' ? 'Surveillance check' : 'Follow-up check'} · {day(c.dueAt)}</span>
            <Badge variant="outline" className={c.state === 'done' ? 'text-emerald-700' : 'text-slate-600'}>{c.state === 'done' ? `Done: ${c.result === 'confirmed' ? 'confirmed' : 'not confirmed'}` : 'Pending'}</Badge>
            {v.viewer.lead && c.state === 'pending' && !['expired', 'withdrawn', 'superseded'].includes(v.status) && (
              <>
                <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button size="sm" onClick={() => void act(call(`/checkpoints/${c.id}/complete`, 'POST', { result: 'confirmed', note }), 'Check recorded')}>Confirmed</Button>
                <Button size="sm" variant="outline" onClick={() => void act(call(`/checkpoints/${c.id}/complete`, 'POST', { result: 'not_confirmed', note }), 'Check recorded')}>Not confirmed</Button>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function Schedule({ v, act, call, closed }: { v: View; act: Act; call: Call; closed: boolean }) {
  const [kind, setKind] = useState<string>(v.followUp.kind)
  if (v.outcome === 'not_validated') return null
  const agreed = v.followUp.orgOk && v.followUp.validatorOk
  const mine = v.viewer.org ? v.followUp.orgOk : v.followUp.validatorOk
  return (
    <Card>
      <CardHeader><CardTitle>Follow-up schedule</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        <p>{FOLLOW_UP_LABEL[v.followUp.kind]} · {agreed ? 'agreed by both sides' : `waiting for the ${mine ? (v.viewer.org ? 'validator' : 'organisation') : 'you'} to agree`}</p>
        {!closed && (v.viewer.org || v.viewer.lead) && (
          <div className="flex flex-wrap items-end gap-2">
            <Select label="Propose" options={FOLLOW_UP_KINDS.map((k) => ({ value: k, label: FOLLOW_UP_LABEL[k] }))} value={kind} onChange={setKind} className="max-w-sm" />
            <Button size="sm" variant="outline" disabled={kind === v.followUp.kind} onClick={() => void act(call('/schedule', 'PUT', { kind }), 'Schedule proposed')}>Propose</Button>
            {!agreed && !mine && <Button size="sm" onClick={() => void act(call('/schedule/agree', 'POST'), 'Schedule agreed')}>Agree to this schedule</Button>}
          </div>
        )}
        {v.viewer.org && (
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!v.funderConsent} onChange={(e) => void act(call('/consent', 'PUT', { funder: e.target.checked }), 'Saved')} />
            Let the engaging funder see CIP progress (not the plan itself)</label>
        )}
      </CardContent>
    </Card>
  )
}

function Plan({ v, act, call, closed }: { v: View; act: Act; call: Call; closed: boolean }) {
  const [draft, setDraft] = useState({ text: '', owner: '', dueDate: '', ids: '' })
  const canPlan = (v.viewer.org || v.viewer.lead) && !closed
  return (
    <Card>
      <CardHeader><CardTitle>Capacity Improvement Plan actions</CardTitle><p className="text-sm text-slate-500">{v.progress?.sentence}. Marking an action done needs an owner, a due date and proof of completion.</p></CardHeader>
      <CardContent className="space-y-3">
        {v.actions!.length === 0 && <p className="text-sm text-slate-500">No actions yet.</p>}
        {v.actions!.map((a) => <ActionRow key={a.id} a={a} v={v} act={act} call={call} canPlan={canPlan} />)}
        {canPlan && (
          <form className="grid gap-2 sm:grid-cols-[1fr_10rem_9rem_12rem_auto] sm:items-end" onSubmit={(e) => {
            e.preventDefault()
            void act(call('/cip', 'POST', { text: draft.text, owner: draft.owner || null, dueDate: draft.dueDate || null, indicatorIds: draft.ids.split(/[ ,]+/).filter(Boolean) }), 'Action added').then(() => setDraft({ text: '', owner: '', dueDate: '', ids: '' }))
          }}>
            <Input label="Action" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
            <Input label="Owner" value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} />
            <Input label="Due" type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
            <Input label="Indicators" value={draft.ids} onChange={(e) => setDraft({ ...draft, ids: e.target.value })} />
            <Button type="submit" variant="outline" disabled={!draft.text.trim()}>Add</Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function ActionRow({ a, v, act, call, canPlan }: { a: Action; v: View; act: Act; call: Call; canPlan: boolean }) {
  const [owner, setOwner] = useState(a.owner ?? '')
  const [due, setDue] = useState(a.dueDate ?? '')
  const [proof, setProof] = useState('')
  const done = a.status === 'done'
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-sm">
      <p className="font-medium text-slate-800">{a.text} {a.indicatorIds.length > 0 && <span className="font-mono text-xs text-slate-500">({a.indicatorIds.join(', ')})</span>}</p>
      {done ? <p className="mt-1 text-emerald-700">Done · {a.owner} · due {a.dueDate} · proof: {a.proof}</p> : (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          {canPlan ? (
            <>
              <Input label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
              <Input label="Due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              <Button size="sm" variant="outline" onClick={() => void act(call(`/cip/${a.id}`, 'PUT', { owner: owner || null, dueDate: due || null }), 'Saved')}>Save</Button>
              {!a.fromQualification && <Button size="sm" variant="ghost" onClick={() => void act(call(`/cip/${a.id}`, 'DELETE'), 'Removed')}>Remove</Button>}
            </>
          ) : <p>{a.owner ?? 'No owner yet'} · due {a.dueDate ?? '—'}</p>}
          {v.viewer.org && !['expired', 'withdrawn', 'superseded'].includes(v.status) && (
            <>
              <Input label="Proof of completion (evidence reference)" value={proof} onChange={(e) => setProof(e.target.value)} />
              <Button size="sm" disabled={proof.trim().length < 3} onClick={() => void act(call(`/cip/${a.id}/done`, 'POST', { proof }), 'Marked done')}>Mark done</Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Events({ v, act, call, closed }: { v: View; act: Act; call: Call; closed: boolean }) {
  const [draft, setDraft] = useState({ eventType: '', occurredOn: '', description: '' })
  const canReport = (v.viewer.org || v.viewer.programme) && !closed && v.expiresAt
  return (
    <Card>
      <CardHeader>
        <CardTitle>Material events</CardTitle>
        <p className="text-sm text-slate-500">The organisation reports within 30 days (5 working days for ★ events). Reporting suspends the validation pending the validator's review. Failing to report is grounds for withdrawal.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {v.events!.length === 0 && <p className="text-sm text-slate-500">None reported.</p>}
        {v.events!.map((e) => <EventRow key={e.id} e={e} v={v} act={act} call={call} />)}
        {canReport && (
          <form className="space-y-2" onSubmit={(ev) => {
            ev.preventDefault()
            void act(call('/events', 'POST', draft), v.viewer.org ? 'Reported. The validation is suspended pending review.' : 'Recorded. The organisation has been told.').then(() => setDraft({ eventType: '', occurredOn: '', description: '' }))
          }}>
            <Select label={v.viewer.org ? 'Report an event' : 'Record an event'} placeholder="Choose…" value={draft.eventType} onChange={(x) => setDraft({ ...draft, eventType: x })}
              options={MATERIAL_EVENTS.map((m) => ({ value: m.key, label: `${m.starred ? '★ ' : ''}${m.label}` }))} />
            <Input label="Date it happened" type="date" value={draft.occurredOn} onChange={(e) => setDraft({ ...draft, occurredOn: e.target.value })} />
            <Input label="What happened" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <Button type="submit" disabled={!draft.eventType || !draft.occurredOn || !draft.description.trim()}>{v.viewer.org ? 'Report' : 'Record'}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function EventRow({ e, v, act, call }: { e: MEvent; v: View; act: Act; call: Call }) {
  const [text, setText] = useState('')
  const [scope, setScope] = useState('')
  const pending = e.status === 'pending_review'
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-sm">
      <p className="font-medium text-slate-800">{e.starred ? '★ ' : ''}{e.label}</p>
      <p className="text-slate-600">{e.occurredOn} · {e.reportedBySide === 'programme_team' ? 'recorded by the CRAFT programme team' : 'reported by the organisation'}{e.late ? ' · reported late' : ''} · {e.status.replace('_', ' ')}</p>
      <p className="mt-1">{e.description}</p>
      {e.orgResponse && <p className="mt-1 text-slate-600">Organisation's response: {e.orgResponse}</p>}
      {e.resolutionNote && <p className="mt-1 text-slate-600">Validator's reasons: {e.resolutionNote}</p>}
      {e.contestedAt && <p className="mt-1 text-amber-800">Contested — referred to the Independent Review Panel: {e.contestReason}</p>}
      {v.viewer.org && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Input label="Respond / explain" value={text} onChange={(x) => setText(x.target.value)} />
          <Button size="sm" variant="outline" disabled={!text.trim()} onClick={() => void act(call(`/events/${e.id}/respond`, 'POST', { response: text }), 'Response saved')}>Respond</Button>
          {!e.contestedAt && <Button size="sm" variant="ghost" disabled={text.trim().length < 3} onClick={() => void act(call(`/events/${e.id}/contest`, 'POST', { reason: text }), 'Referred to the Independent Review Panel')}>Contest (uses the text)</Button>}
        </div>
      )}
      {v.viewer.lead && pending && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Input label="Reasons" value={text} onChange={(x) => setText(x.target.value)} />
          <Input label="Scope limitation (re-scope only)" value={scope} onChange={(x) => setScope(x.target.value)} />
          <Button size="sm" disabled={text.trim().length < 3} onClick={() => void act(call(`/events/${e.id}/resolve`, 'POST', { decision: 'reinstate', note: text }), 'Reinstated')}>Reinstate</Button>
          <Button size="sm" variant="outline" disabled={text.trim().length < 3 || !scope.trim()} onClick={() => void act(call(`/events/${e.id}/resolve`, 'POST', { decision: 'rescope', note: text, scopeNote: scope }), 'Re-scoped')}>Re-scope</Button>
          <Button size="sm" variant="outline" disabled={text.trim().length < 3} onClick={() => { if (window.confirm('Withdraw this validation? This cannot be undone.')) void act(call(`/events/${e.id}/resolve`, 'POST', { decision: 'withdraw', note: text }), 'Withdrawn') }}>Withdraw</Button>
        </div>
      )}
    </div>
  )
}

function LeadControls({ act, call }: { act: Act; call: Call }) {
  const [months, setMonths] = useState('')
  const [reason, setReason] = useState('')
  return (
    <Card>
      <CardHeader><CardTitle>Validator controls</CardTitle><p className="text-sm text-slate-500">You can shorten validity for a named risk, or withdraw if new evidence shows the validation was wrong. Validity can never be extended.</p></CardHeader>
      <CardContent className="flex flex-wrap items-end gap-2">
        <Input label="Reason / named risk" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Input label="Shorten to (months)" type="number" value={months} onChange={(e) => setMonths(e.target.value)} />
        <Button size="sm" variant="outline" disabled={!months || reason.trim().length < 3} onClick={() => void act(call('/shorten', 'POST', { months: Number(months), reason }), 'Validity shortened')}>Shorten</Button>
        <Button size="sm" variant="outline" disabled={reason.trim().length < 3} onClick={() => { if (window.confirm('Withdraw this validation? This cannot be undone.')) void act(call('/withdraw', 'POST', { reason }), 'Withdrawn') }}>Withdraw</Button>
      </CardContent>
    </Card>
  )
}
