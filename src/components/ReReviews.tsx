import { useEffect, useState } from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Select } from './ui'
import { REREVIEW_OUTCOME_LABEL, REREVIEW_OUTCOMES, type RereviewOutcome } from '../lib/validatorQuality'

// Re-review (spec: "Re-review"). Every rule is enforced by /api/re-reviews; these components show what it allows
// the signed-in person to do: a funder requires one, the programme team assigns a Senior Validator from a
// different firm, and that re-reviewer records stands, amended or withdrawn.

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

type Row = {
  id: string; validationId: string; verificationId: string | null; validatedRung: number | null; organization: string; reasonLabel: string; note: string
  reviewer: string | null; status: 'requested' | 'assigned' | 'decided'; outcome: RereviewOutcome | null; outcomeLabel: string | null; reasons: string | null
  effects: string[]; mine: boolean; createdAt: string; decidedAt: string | null
}
type Indicator = { id: string; level: number; self: number | null; validator: number | null; final: number | null; sufficiency: string | null; comment: string; evidence: Array<{ id: number; name: string }> }
type Detail = Row & { review: null | { sha: string | null; snapshot: { outcome: string; outcomeSummary: string; validatedRung: number | null; selfRung: number | null; indicators: Indicator[]; qualifications: Array<{ text: string }> } }; declaration: string }
type RosterEntry = { email: string; name: string; kind: string; active: boolean }

const STATUS: Record<Row['status'], { label: string; style: string }> = {
  requested: { label: 'Requested', style: 'bg-amber-100 text-amber-800' },
  assigned: { label: 'In progress', style: 'bg-sky-100 text-sky-800' },
  decided: { label: 'Decided', style: 'bg-emerald-100 text-emerald-800' },
}

function Note({ msg }: { msg: { ok: boolean; text: string } | null }) {
  return msg ? <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p> : null
}

/** Programme team: active Senior Validators who could be assigned. Null for anyone else. */
function useSeniorValidators(): RosterEntry[] | null {
  const [roster, setRoster] = useState<RosterEntry[] | null>(null)
  useEffect(() => {
    void api<RosterEntry[]>('/api/review-panel/roster').then((r) => setRoster(r.filter((x) => x.active && x.kind === 'senior_validator')), () => setRoster(null))
  }, [])
  return roster
}

function ReviewerPicker({ roster, label, onPick }: { roster: RosterEntry[]; label: string; onPick: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  if (!roster.length) return <p className="text-xs text-slate-500">No active Senior Validators on the review panel roster yet.</p>
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select label="Senior Validator (different firm, no ties to the parties)" options={[{ value: '', label: 'Choose…' }, ...roster.map((r) => ({ value: r.email, label: r.name }))]} value={email} onChange={setEmail} />
      <Button size="sm" disabled={!email || busy} onClick={() => { setBusy(true); void onPick(email).finally(() => setBusy(false)) }}>{label}</Button>
    </div>
  )
}

/** Programme team, from the flag queue: open a re-review of one validation. */
export function OpenReReview({ validationId, funderRequired, onDone }: { validationId: string; funderRequired: boolean; onDone: () => void }) {
  const roster = useSeniorValidators()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!roster) return null
  return (
    <div className="space-y-1">
      <ReviewerPicker roster={roster} label="Open re-review" onPick={async (reviewerEmail) => {
        try {
          await api('/api/re-reviews', { method: 'POST', json: { validationId, reviewerEmail, reason: funderRequired ? 'funder_required' : 'flagged' } })
          setMsg({ ok: true, text: 'Re-review opened; everyone involved has been told' })
          onDone()
        } catch (e: any) { setMsg({ ok: false, text: e.message }) }
      }} />
      <Note msg={msg} />
    </div>
  )
}

/** A funding partner that follows a validation: require a re-review. */
export function RequireReReview({ validationId }: { validationId: string }) {
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault()
      void api('/api/re-reviews/request', { method: 'POST', json: { validationId, note: note.trim() || undefined } })
        .then(() => setMsg({ ok: true, text: 'Re-review required. The CRAFT programme team will assign a Senior Validator from a different firm.' }), (err) => setMsg({ ok: false, text: err.message }))
    }}>
      <label className="block text-xs font-medium text-slate-600" htmlFor={`rr-note-${validationId}`}>Why you need a second look (optional)</label>
      <textarea id={`rr-note-${validationId}`} className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      <Button type="submit" size="sm" variant="outline">Require a re-review</Button>
      <Note msg={msg} />
    </form>
  )
}

function DecideForm({ d, onDone }: { d: Detail; onDone: () => void }) {
  const [outcome, setOutcome] = useState<RereviewOutcome | ''>('')
  const [reasons, setReasons] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <form className="space-y-2 rounded-lg border border-slate-200 p-3" onSubmit={(e) => {
      e.preventDefault()
      void api(`/api/re-reviews/${d.id}/decide`, { method: 'POST', json: { outcome, reasons, declaration: d.declaration } })
        .then(() => { setMsg({ ok: true, text: 'Decision recorded; everyone involved has been told' }); onDone() }, (err) => setMsg({ ok: false, text: err.message }))
    }}>
      <Select label="Outcome" options={[{ value: '', label: 'Choose…' }, ...REREVIEW_OUTCOMES.map((o) => ({ value: o, label: REREVIEW_OUTCOME_LABEL[o] }))]} value={outcome} onChange={(v) => setOutcome(v as RereviewOutcome)} />
      <label className="block text-xs font-medium text-slate-600" htmlFor={`rr-reasons-${d.id}`}>Your reasons (shared with the organisation, the validator and any funder involved)</label>
      <textarea id={`rr-reasons-${d.id}`} className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={4} minLength={20} maxLength={6000} value={reasons} onChange={(e) => setReasons(e.target.value)} />
      <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> {d.declaration}</label>
      <Button type="submit" size="sm" disabled={!outcome || reasons.trim().length < 20 || !confirmed}>Record decision</Button>
      <Note msg={msg} />
    </form>
  )
}

/** The frozen review, for the re-reviewer and the programme team. */
function FrozenReview({ d }: { d: Detail }) {
  const s = d.review?.snapshot
  if (!s) return <p className="text-sm text-slate-500">The frozen review is not available.</p>
  return (
    <div className="space-y-2 text-sm text-slate-700">
      <p>Validator’s outcome: <strong>{s.outcome.replace(/_/g, ' ')}</strong> · rung {s.validatedRung ?? '—'} (self-assessed {s.selfRung ?? '—'})</p>
      {s.outcomeSummary && <p className="text-slate-600">{s.outcomeSummary}</p>}
      {s.qualifications.length > 0 && <ul className="list-disc pl-5 text-slate-600">{s.qualifications.map((q, i) => <li key={i}>{q.text}</li>)}</ul>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="uppercase text-slate-500"><th className="py-1 pr-2">Indicator</th><th className="pr-2">Self</th><th className="pr-2">Validator</th><th className="pr-2">Final</th><th className="pr-2">Evidence</th><th>Comment</th></tr></thead>
          <tbody>
            {s.indicators.map((i) => (
              <tr key={i.id} className="border-t border-slate-100 align-top">
                <td className="py-1 pr-2 font-mono">{i.id}</td><td className="pr-2">{i.self ?? '—'}</td><td className="pr-2">{i.validator ?? '—'}</td><td className="pr-2 font-semibold">{i.final ?? '—'}</td>
                <td className="pr-2">{i.sufficiency ?? '—'}{i.evidence.length ? ` · ${i.evidence.map((e) => e.name).join(', ')}` : ''}</td><td className="text-slate-600">{i.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {d.review?.sha && <p className="break-all font-mono text-xs text-slate-400">Frozen review SHA-256 {d.review.sha}</p>}
    </div>
  )
}

function ReReviewItem({ r, roster, onChange }: { r: Row; roster: RosterEntry[] | null; onChange: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const canOpen = r.mine || !!roster
  const open = () => void api<Detail>(`/api/re-reviews/${r.id}`).then(setDetail, (e) => setMsg({ ok: false, text: e.message }))
  return (
    <li className="space-y-2 border-b border-slate-100 pb-3 text-sm last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-slate-800">{r.verificationId ?? r.validationId} · {r.organization}</p>
        <Badge className={STATUS[r.status].style}>{STATUS[r.status].label}</Badge>
        {r.mine && r.status === 'assigned' && <Badge className="bg-indigo-100 text-indigo-800">Assigned to you</Badge>}
      </div>
      <p className="text-slate-500">{r.reasonLabel} · {r.reviewer ? `re-reviewer ${r.reviewer}` : 'no re-reviewer yet'} · opened {fmt(r.createdAt)}{r.decidedAt ? ` · decided ${fmt(r.decidedAt)}` : ''}</p>
      {r.note && <p className="text-slate-600">Note: {r.note}</p>}
      {r.status === 'decided' && (
        <div className="rounded-lg bg-slate-50 p-2 text-slate-700">
          <p className="font-medium">{r.outcomeLabel}</p>
          {r.reasons && <p className="mt-1 whitespace-pre-line">{r.reasons}</p>}
          <p className="mt-1 text-xs text-slate-500">Disagree? Raise a challenge to a re-review outcome with the Independent Review Panel.</p>
        </div>
      )}
      {roster && r.status !== 'decided' && (
        <ReviewerPicker roster={roster} label={r.reviewer ? 'Reassign' : 'Assign'} onPick={async (reviewerEmail) => {
          try { await api(`/api/re-reviews/${r.id}/reviewer`, { method: 'PUT', json: { reviewerEmail } }); setMsg({ ok: true, text: 'Re-reviewer assigned' }); onChange() } catch (e: any) { setMsg({ ok: false, text: e.message }) }
        }} />
      )}
      {canOpen && !detail && r.status !== 'requested' && <Button size="sm" variant="outline" onClick={open}>{r.mine && r.status === 'assigned' ? 'Open the frozen review' : 'View the frozen review'}</Button>}
      {detail && <FrozenReview d={detail} />}
      {detail && detail.mine && detail.status === 'assigned' && <DecideForm d={detail} onDone={() => { setDetail(null); onChange() }} />}
      <Note msg={msg} />
    </li>
  )
}

/** Every re-review the signed-in person may see: assigned to them, about their organisation, followed as a funder, or all for the programme team. */
export function ReReviews() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const roster = useSeniorValidators()
  const load = () => void api<Row[]>('/api/re-reviews').then(setRows, () => setRows(null))
  useEffect(load, [])
  if (!rows?.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Re-reviews</CardTitle>
        <p className="text-sm text-slate-500">A Senior Validator from a different firm, with no ties to the parties, reads the frozen review and decides whether the validation stands, is amended or is withdrawn. The validation’s status does not change until then.</p>
      </CardHeader>
      <CardContent><ul className="space-y-3">{rows.map((r) => <ReReviewItem key={r.id} r={r} roster={roster} onChange={load} />)}</ul></CardContent>
    </Card>
  )
}
