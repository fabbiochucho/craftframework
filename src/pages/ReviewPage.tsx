import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ClipboardCheck } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../components/ui'
import { METHOD_LABEL, METHODS, OUTCOME_LABEL, OUTCOMES, SUFFICIENCY, type Method, type Outcome } from '../lib/validationReview'
import { FOLLOW_UP_LABEL, FOLLOW_UP_MODES } from '../lib/validationLifecycle'

// Validator system PR 3: the review itself. Every rule (who may score, when the
// debrief is open, what freezes) is enforced by /api/validation-reviews.

type Row = {
  id: string; level: number; domain: string; question: string; self: number | null; validator: number | null; delta: number | null; optimismBias: number | null
  sufficiency?: string | null; comment?: string; evidenceRef?: string; orgResponse?: string; negotiated?: number | null
}
type View = {
  status: string; engagementStatus: string; framework: { name: string; version: string }; type: string
  lead?: boolean; method?: Method | null; fieldworkStart?: string | null; fieldworkEnd?: string | null
  levels?: Array<{ level: number; name: string }>; rows?: Row[]
  qualifications?: Array<{ id: string; text: string; indicatorIds: string[] }>; problems?: string[]
  rungs?: { self: number; validator: number }; scored?: number; total?: number
  outcome?: Outcome; validatedRung?: number | null; sha256?: string; finalisedAt?: string; snapshot?: any
}

async function api<T = any>(path: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method, cache: 'no-store',
    headers: init?.json !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(body?.error === 'mfa_required' ? 'Multi-factor sign-in required' : body?.error || `Request failed (${res.status})`), { problems: body?.problems as string[] | undefined })
  return body as T
}

const SUFF_LABEL: Record<string, string> = { sufficient: 'Evidence sufficient', partial: 'Partly sufficient', insufficient: 'Insufficient' }
const deltaStyle = (d: number | null) => (d == null ? 'text-slate-400' : d > 0 ? 'text-amber-700 font-semibold' : d < 0 ? 'text-indigo-700' : 'text-emerald-700')
const Rung = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-4 py-2"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold text-emerald-900">{value || '—'}</p></div>
)

export function ReviewPage({ id }: { id: string }) {
  const [v, setV] = useState<View | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string; problems?: string[] } | null>(null)
  const load = () => api<View>(`/api/validation-reviews/${encodeURIComponent(id)}`).then(setV, (e) => setError(e.message))
  useEffect(() => { void load() }, [id])
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg({ ok: true, text: ok }); await load() } catch (e: any) { setMsg({ ok: false, text: e.message, problems: e.problems }); await load() }
  }
  const call = (path: string, method: string, json?: unknown) => () => api(`/api/validation-reviews/${encodeURIComponent(id)}${path}`, { method, json })
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!v) return <p className="text-sm text-slate-500">Loading…</p>
  return (
    <div className="space-y-6">
      <Link to="/engagements/$id" params={{ id }} className="text-sm text-emerald-700 hover:underline">← Engagement</Link>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><ClipboardCheck className="h-4 w-4 text-emerald-600" /> {v.framework.name}, {v.framework.version}</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Review</h1>
      </div>
      {msg && (
        <div role="status" className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
          <p>{msg.text}</p>
          {msg.problems && <ul className="list-disc pl-5">{msg.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        </div>
      )}
      {v.status === 'finalised' ? <Frozen v={v} /> : v.rows && v.lead !== undefined ? <Reviewer v={v} act={act} call={call} /> : v.rows ? <OrgDebrief v={v} act={act} call={call} />
        : <p className="text-sm text-slate-600">{v.status === 'not_started' ? 'The review has not started.' : 'The review is in progress. You will see the validator\'s scores and comments when the debrief opens.'}</p>}
    </div>
  )
}

type Act = (fn: () => Promise<unknown>, ok: string) => Promise<void>
type Call = (path: string, method: string, json?: unknown) => () => Promise<unknown>

function Reviewer({ v, act, call }: { v: View; act: Act; call: Call }) {
  const debrief = v.status === 'debrief'
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Rung label="Rung implied by self-scores" value={v.rungs!.self} />
        <Rung label={debrief ? 'Rung implied by final scores' : 'Rung implied by your scores'} value={v.rungs!.validator} />
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2"><p className="text-xs text-slate-500">Scored</p><p className="text-2xl font-bold text-emerald-900">{v.scored}/{v.total}</p></div>
      </div>
      {v.lead && <Setup v={v} act={act} call={call} />}
      {v.levels!.map((lvl) => {
        const rows = v.rows!.filter((r) => r.level === lvl.level)
        return rows.length ? (
          <Card key={lvl.level}>
            <CardHeader><CardTitle>Level {lvl.level}: {lvl.name}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {rows.map((r) => <IndicatorRow key={r.id} r={r} debrief={debrief} lead={!!v.lead} act={act} call={call} />)}
            </CardContent>
          </Card>
        ) : null
      })}
      {v.lead && <Close v={v} act={act} call={call} />}
    </>
  )
}

function Setup({ v, act, call }: { v: View; act: Act; call: Call }) {
  const [m, setM] = useState<string>(v.method ?? '')
  const [s, setS] = useState(v.fieldworkStart ?? '')
  const [e, setE] = useState(v.fieldworkEnd ?? '')
  return (
    <Card>
      <CardHeader><CardTitle>Method and fieldwork</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-4 sm:items-end">
        <Select label="Method" placeholder="Choose…" options={METHODS.map((x) => ({ value: x, label: METHOD_LABEL[x] }))} value={m} onChange={setM} />
        <Input label="Fieldwork start" type="date" value={s} onChange={(ev) => setS(ev.target.value)} />
        <Input label="Fieldwork end" type="date" value={e} onChange={(ev) => setE(ev.target.value)} />
        <Button disabled={!m || !s || !e} onClick={() => void act(call('/setup', 'PUT', { method: m, fieldworkStart: s, fieldworkEnd: e }), 'Saved')}>Save</Button>
      </CardContent>
    </Card>
  )
}

function IndicatorRow({ r, debrief, lead, act, call }: { r: Row; debrief: boolean; lead: boolean; act: Act; call: Call }) {
  const [score, setScore] = useState(r.validator == null ? '' : String(r.validator))
  const [suff, setSuff] = useState(r.sufficiency ?? 'sufficient')
  const [comment, setComment] = useState(r.comment ?? '')
  const [ref, setRef] = useState(r.evidenceRef ?? '')
  const [neg, setNeg] = useState(r.negotiated == null ? '' : String(r.negotiated))
  const scores = [0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))
  return (
    <div className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
      <p className="text-sm font-medium text-slate-800"><span className="font-mono text-xs text-slate-500">{r.id}</span> {r.question}</p>
      <p className="text-sm">
        Self {r.self ?? '—'} · You {r.validator ?? '—'} · <span className={deltaStyle(r.delta)}>{r.delta == null ? 'no delta' : `delta ${r.delta > 0 ? '+' : ''}${r.delta}`}</span>
        {r.optimismBias != null && r.optimismBias !== 0 && <span className="text-slate-500"> ({r.optimismBias}% optimism bias)</span>}
      </p>
      <div className="grid gap-2 sm:grid-cols-[6rem_12rem_1fr_1fr_auto] sm:items-end">
        <Select label="Your score" placeholder="–" options={scores} value={score} onChange={setScore} />
        <Select label="Evidence" options={SUFFICIENCY.map((x) => ({ value: x, label: SUFF_LABEL[x] }))} value={suff} onChange={setSuff} />
        <Input label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} />
        <Input label="Evidence reference" value={ref} onChange={(e) => setRef(e.target.value)} />
        <Button size="sm" disabled={score === ''} onClick={() => void act(call(`/scores/${r.id}`, 'PUT', { score: Number(score), sufficiency: suff, comment, evidenceRef: ref }), `${r.id} saved`)}>Save</Button>
      </div>
      {debrief && (
        <div className="rounded-lg bg-amber-50/60 p-3 text-sm">
          <p className="text-slate-700"><span className="font-medium">Organisation response:</span> {r.orgResponse || <span className="text-slate-400">none yet</span>}</p>
          {lead && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="w-28"><Select label="Negotiated score" placeholder="–" options={scores} value={neg} onChange={setNeg} /></div>
              <Button size="sm" variant="outline" onClick={() => void act(call(`/negotiated/${r.id}`, 'PUT', { score: neg === '' ? null : Number(neg) }), 'Negotiated score recorded')}>Record</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Close({ v, act, call }: { v: View; act: Act; call: Call }) {
  const [q, setQ] = useState({ text: '', ids: '' })
  const [outcome, setOutcome] = useState<string>('')
  const [summary, setSummary] = useState('')
  const [months, setMonths] = useState('')
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState('milestone')
  return (
    <>
      {v.status === 'draft' && (
        <Card><CardHeader><CardTitle>Debrief (optional)</CardTitle><p className="text-sm text-slate-500">Opening the debrief shows the organisation your scores and comments so it can respond to disputed indicators. You can then record negotiated scores.</p></CardHeader>
          <CardContent><Button variant="outline" onClick={() => void act(call('/debrief/open', 'POST'), 'Debrief opened')}>Open the debrief</Button></CardContent></Card>
      )}
      <Card>
        <CardHeader><CardTitle>Qualifications</CardTitle><p className="text-sm text-slate-500">Each qualification is linked to the indicators it concerns.</p></CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-1 text-sm">
            {v.qualifications!.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2">{x.text} <Badge variant="outline" className="font-mono text-slate-600">{x.indicatorIds.join(', ')}</Badge>
                <Button size="sm" variant="ghost" onClick={() => void act(call(`/qualifications/${x.id}`, 'DELETE'), 'Removed')}>Remove</Button></li>
            ))}
          </ul>
          <form className="grid gap-2 sm:grid-cols-[1fr_16rem_auto] sm:items-end" onSubmit={(e) => {
            e.preventDefault()
            void act(call('/qualifications', 'POST', { text: q.text, indicatorIds: q.ids.split(/[ ,]+/).filter(Boolean) }), 'Qualification added').then(() => setQ({ text: '', ids: '' }))
          }}>
            <Input label="Qualification" value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} />
            <Input label="Indicators (e.g. CRL-1A, CRL-2B)" value={q.ids} onChange={(e) => setQ({ ...q, ids: e.target.value })} />
            <Button type="submit" variant="outline" disabled={!q.text.trim() || !q.ids.trim()}>Add</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="border-emerald-200">
        <CardHeader><CardTitle>Outcome and freeze</CardTitle>
          <p className="text-sm text-slate-500">Finalising freezes the result: scores, rung, team, declarations, method, dates, outcome and qualifications. Nothing can be changed afterwards and everyone's access to the organisation's results ends.</p></CardHeader>
        <CardContent className="space-y-3">
          {v.problems!.length > 0 && <ul className="list-disc pl-5 text-sm text-amber-800">{v.problems!.map((p) => <li key={p}>{p}</li>)}</ul>}
          <Select label="Outcome" placeholder="Choose…" options={OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] }))} value={outcome} onChange={setOutcome} />
          <Input label="Summary (optional)" value={summary} onChange={(e) => setSummary(e.target.value)} />
          {outcome !== '' && outcome !== 'not_validated' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label={`Validity in months (blank = ${outcome === 'validated' ? 12 : 6}; 24 for rung 5+ with no qualifications)`} type="number" value={months} onChange={(e) => setMonths(e.target.value)} />
              <Input label="Named risk (needed for a shorter period)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Select label="Follow-up schedule" options={FOLLOW_UP_MODES.map((m) => ({ value: m, label: FOLLOW_UP_LABEL[m] }))} value={mode} onChange={setMode} />
            </div>
          )}
          <Button disabled={!outcome} onClick={() => {
            if (window.confirm('Finalise and freeze this review? This cannot be undone.')) {
              void act(call('/finalise', 'POST', { outcome, summary, ...(outcome !== 'not_validated' ? { followUpMode: mode, ...(months ? { validityMonths: Number(months), validityReason: reason } : {}) } : {}) }), 'Review finalised and frozen')
            }
          }}>Finalise and freeze</Button>
        </CardContent>
      </Card>
    </>
  )
}

function OrgDebrief({ v, act, call }: { v: View; act: Act; call: Call }) {
  return (
    <>
      <p className="text-sm text-slate-600">The validator has opened the debrief. Respond to any indicator you dispute; the validator may then record a negotiated score.</p>
      {v.rows!.map((r) => <OrgRow key={r.id} r={r} act={act} call={call} />)}
    </>
  )
}

function OrgRow({ r, act, call }: { r: Row; act: Act; call: Call }) {
  const [text, setText] = useState(r.orgResponse ?? '')
  return (
    <Card><CardContent className="space-y-2 pt-6">
      <p className="text-sm font-medium text-slate-800"><span className="font-mono text-xs text-slate-500">{r.id}</span> {r.question}</p>
      <p className="text-sm">You scored {r.self ?? '—'} · validator {r.validator ?? '—'} · <span className={deltaStyle(r.delta)}>{r.delta == null ? '' : `delta ${r.delta > 0 ? '+' : ''}${r.delta}`}</span>{r.negotiated != null && ` · negotiated ${r.negotiated}`}</p>
      {r.comment && <p className="text-sm text-slate-600">Validator comment: {r.comment}</p>}
      <Input label="Your response" value={text} onChange={(e) => setText(e.target.value)} />
      <Button size="sm" disabled={!text.trim()} onClick={() => void act(call(`/debrief/${r.id}`, 'PUT', { response: text }), 'Response saved')}>Save response</Button>
    </CardContent></Card>
  )
}

function Frozen({ v }: { v: View }) {
  const s = v.snapshot
  return (
    <>
      <Card className="border-emerald-200">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{OUTCOME_LABEL[v.outcome!]}</CardTitle>
            {v.validatedRung != null && <Badge className="bg-emerald-100 text-emerald-800">Validated rung {v.validatedRung}</Badge>}
            <Badge variant="outline" className="text-slate-600">Frozen {new Date(v.finalisedAt!).toLocaleDateString()}</Badge>
          </div>
          <p className="text-sm text-slate-600">{s.engagement.statement}</p>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-700">
          <p>Method: {METHOD_LABEL[s.method as Method]} · Fieldwork {s.fieldwork.start} to {s.fieldwork.end}</p>
          <p>Self-assessed rung then: {s.selfRung} · Team: {s.team.map((t: any) => `${t.name} (${t.role})`).join(', ')}</p>
          {s.outcomeSummary && <p>{s.outcomeSummary}</p>}
          <p className="break-all font-mono text-xs text-slate-500">SHA-256 of the frozen record: {v.sha256}</p>
          {v.outcome !== 'not_validated' && <Link to="/validations" className="text-sm font-semibold text-emerald-700 hover:underline">See its validity, follow-ups and status →</Link>}
        </CardContent>
      </Card>
      {s.qualifications.length > 0 && (
        <Card><CardHeader><CardTitle>Qualifications</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-1 pl-5 text-sm">{s.qualifications.map((q: any) => <li key={q.text}>{q.text} <span className="font-mono text-xs text-slate-500">({q.indicatorIds.join(', ')})</span></li>)}</ul></CardContent></Card>
      )}
      <Card>
        <CardHeader><CardTitle>Scores</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs text-slate-500"><th className="py-1 pr-3">Indicator</th><th className="pr-3">Self</th><th className="pr-3">Validator</th><th className="pr-3">Negotiated</th><th>Final</th></tr></thead>
            <tbody>{s.indicators.map((i: any) => (
              <tr key={i.id} className="border-t border-slate-100"><td className="py-1 pr-3"><span className="font-mono text-xs">{i.id}</span> {i.domain}</td><td className="pr-3">{i.self ?? '—'}</td><td className="pr-3">{i.validator ?? '—'}</td><td className="pr-3">{i.negotiated ?? '—'}</td><td className="font-semibold">{i.final ?? '—'}</td></tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>
    </>
  )
}
