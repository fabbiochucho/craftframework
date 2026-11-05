import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ClipboardCheck } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../components/ui'
import { METHOD_LABEL, METHODS, OUTCOME_LABEL, OUTCOMES, SUFFICIENCY, type Method, type Outcome } from '../lib/validationReview'
import { CHECK_LABEL, CHECK_VALUES, CONTROL_CHECKS, isComplete, scoreCap, scoreProblem, type CheckValue, type ControlChecks, type ScoreResult } from '../lib/controlChecks'
import { FOLLOW_UP_LABEL, FOLLOW_UP_MODES } from '../lib/validationLifecycle'
import { methodologyById, methodologyConclusion } from '../lib/methodologies'
import { scopeText, type EngagementScope } from '../lib/engagements'

// Validator system PR 3: the review itself. Every rule (who may score, when the
// debrief is open, what freezes) is enforced by /api/validation-reviews.

type Row = {
  id: string; framework?: string; level: number; domain: string; question: string; self: number | null; validator: number | null; delta: number | null; optimismBias: number | null
  sufficiency?: string | null; comment?: string; evidenceRef?: string; orgResponse?: string; negotiated?: number | null
  paperCap?: { negotiated: number; capped: number; message: string } | null; final?: number | null; evidence?: LinkedEvidence[]
  result?: ScoreResult | null; checks?: ControlChecks
}
type LinkedEvidence = {
  indicatorId: string; evidenceId: number; name: string; documentType: string; sha256: string | null; linkedAt: string
  available: boolean; status: string | null; expiryDate: string | null; sizeKb: number | null
}
type Confirmation = { level: number; name: string; achieved: boolean }
type View = {
  status: string; engagementStatus: string; framework: { name: string; version: string }; type: string
  lead?: boolean; method?: Method | null; fieldworkStart?: string | null; fieldworkEnd?: string | null
  levels?: Array<{ level: number; name: string }>; rows?: Row[]
  qualifications?: Array<{ id: string; text: string; indicatorIds: string[] }>; problems?: string[]
  rungs?: { self: number; validator: number } | null; partialScope?: boolean; confirmedLevels?: Confirmation[] | null; scored?: number; total?: number
  indicators?: Array<{ id: string; level: number; question: string }>; evidence?: LinkedEvidence[]
  /** CRAFT indices validated alongside the ladder, the band each would get so far, and any specialism block. */
  indices?: Array<{ key: string; name: string; version: string }>; indexBands?: Array<{ key: string; band: string | null }>; specialismBlock?: string | null
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
const Confirmed = ({ levels }: { levels: Confirmation[] }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-4 py-2">
    <p className="text-xs text-slate-500">Levels confirmed (this scope yields no rung)</p>
    <p className="text-sm font-semibold text-emerald-900">{levels.map((l) => `Level ${l.level}: ${l.achieved ? 'achieved' : 'not achieved'}`).join(' · ')}</p>
  </div>
)
const CapNote = ({ cap }: { cap: { negotiated: number; capped: number; message?: string } }) => (
  <p className="rounded bg-rose-50 px-2 py-1 text-sm text-rose-800">Paper-compliance cap: negotiated {cap.negotiated} stands at {cap.capped} because the evidence is insufficient.</p>
)
const EvidenceList = ({ items }: { items: LinkedEvidence[] }) => items.length ? (
  <div className="text-sm text-slate-700">
    <p className="text-xs font-medium text-slate-500">Linked by the organisation (read-only)</p>
    <ul className="list-disc pl-5">{items.map((x) => (
      <li key={x.evidenceId}>{x.name} <span className="text-xs text-slate-500">({x.documentType}{x.status ? `, ${x.status}` : ''}{x.expiryDate ? `, expires ${x.expiryDate}` : ''}{x.available ? '' : ', no longer available'})</span>
        {x.sha256 && <span className="ml-1 font-mono text-xs text-slate-400">sha256 {x.sha256.slice(0, 12)}…</span>}</li>
    ))}</ul>
  </div>
) : null
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
      {v.indicators && v.evidence && <OrgEvidence id={id} v={v} act={act} call={call} />}
      {v.specialismBlock && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{v.specialismBlock}</p>}
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
        {v.rungs ? (
          <>
            <Rung label="Rung implied by self-scores" value={v.rungs.self} />
            <Rung label={debrief ? 'Rung implied by final scores' : 'Rung implied by your scores'} value={v.rungs.validator} />
          </>
        ) : v.confirmedLevels && <Confirmed levels={v.confirmedLevels} />}
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
      {(v.indices ?? []).map((ix) => {
        const rows = v.rows!.filter((r) => r.framework === ix.key)
        const band = v.indexBands?.find((b) => b.key === ix.key)?.band
        return rows.length ? (
          <Card key={ix.key}>
            <CardHeader>
              <CardTitle>{ix.name} ({ix.version})</CardTitle>
              <p className="text-sm text-slate-600">Band on the scores so far: <strong>{band ?? 'not yet scored'}</strong>. Only the band is published, never the scores.</p>
            </CardHeader>
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
  const [result, setResult] = useState<ScoreResult>(r.result ?? 'scored')
  const [checks, setChecks] = useState<ControlChecks>(r.checks ?? {})
  const scores = [0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))
  const cap = isComplete(checks) ? scoreCap(checks) : null
  const problem = score === '' ? null : scoreProblem(result, result === 'not_evidenced' ? 0 : Number(score), checks)
  return (
    <div className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
      <p className="text-sm font-medium text-slate-800"><span className="font-mono text-xs text-slate-500">{r.id}</span> {r.question}</p>
      <p className="text-sm">
        Self {r.self ?? '—'} · You {r.validator ?? '—'} · <span className={deltaStyle(r.delta)}>{r.delta == null ? 'no delta' : `delta ${r.delta > 0 ? '+' : ''}${r.delta}`}</span>
        {r.optimismBias != null && r.optimismBias !== 0 && <span className="text-slate-500"> ({r.optimismBias}% optimism bias)</span>}
      </p>
      <EvidenceList items={r.evidence ?? []} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44"><Select label="Result" options={[{ value: 'scored', label: 'Scored' }, { value: 'not_evidenced', label: 'Not evidenced' }]} value={result}
          onChange={(v) => { setResult(v as ScoreResult); if (v === 'not_evidenced') setScore('0') }} /></div>
        {result === 'not_evidenced' && <p className="pb-2 text-xs text-amber-700">Recorded as 0. It cannot confirm a level and must be named in a qualification.</p>}
      </div>
      {result === 'scored' && (
        <fieldset className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold text-slate-600">Control checks (a check you did not test counts as not met)</legend>
          <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {CONTROL_CHECKS.map((c) => (
              <label key={c.key} className="text-xs text-slate-700" title={c.help}>
                <span className="block font-medium">{c.label}</span>
                <select className="mt-1 w-full rounded border border-slate-300 px-1 py-1 text-xs" value={checks[c.key] ?? ''}
                  onChange={(e) => setChecks({ ...checks, [c.key]: e.target.value as CheckValue })}>
                  <option value="">–</option>
                  {CHECK_VALUES.map((v) => <option key={v} value={v}>{CHECK_LABEL[v]}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{cap ? <>These checks allow a score of at most <b>{cap.max}</b>{cap.reasons.length ? ` (${cap.reasons.join(', ')})` : ''}.</> : 'Record all seven checks to score.'}</p>
        </fieldset>
      )}
      <div className="grid gap-2 sm:grid-cols-[6rem_12rem_1fr_1fr_auto] sm:items-end">
        <Select label="Your score" placeholder="–" options={result === 'not_evidenced' ? [{ value: '0', label: '0' }] : scores} value={score} onChange={setScore} />
        <Select label="Evidence" options={SUFFICIENCY.map((x) => ({ value: x, label: SUFF_LABEL[x] }))} value={suff} onChange={setSuff} />
        <Input label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} />
        <Input label="Evidence reference" value={ref} onChange={(e) => setRef(e.target.value)} />
        <Button size="sm" disabled={score === '' || !!problem} onClick={() => void act(call(`/scores/${r.id}`, 'PUT', { score: result === 'not_evidenced' ? 0 : Number(score), sufficiency: suff, comment, evidenceRef: ref, result, ...(result === 'scored' ? { checks } : {}) }), `${r.id} saved`)}>Save</Button>
      </div>
      {problem && <p className="text-xs text-rose-700" role="alert">{problem}</p>}
      {debrief && (
        <div className="rounded-lg bg-amber-50/60 p-3 text-sm">
          <p className="text-slate-700"><span className="font-medium">Organisation response:</span> {r.orgResponse || <span className="text-slate-400">none yet</span>}</p>
          {r.paperCap && <CapNote cap={r.paperCap} />}
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

function OrgEvidence({ id, v, act, call }: { id: string; v: View; act: Act; call: Call }) {
  const [options, setOptions] = useState<Array<{ id: number; name: string; documentType: string }>>([])
  const [indicator, setIndicator] = useState('')
  const [item, setItem] = useState('')
  useEffect(() => { void api<{ options: typeof options }>(`/api/validation-reviews/${encodeURIComponent(id)}/evidence-options`).then((r) => setOptions(r.options), () => setOptions([])) }, [id])
  return (
    <Card>
      <CardHeader><CardTitle>Evidence for the validator</CardTitle><p className="text-sm text-slate-500">Link items from your evidence register to indicators. Validators on this engagement can see the name, type and status of linked items once their access is active; links are references, nothing is copied.</p></CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1 text-sm">
          {v.evidence!.map((x) => (
            <li key={`${x.indicatorId}-${x.evidenceId}`} className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-slate-500">{x.indicatorId}</span> {x.name}
              <Button size="sm" variant="ghost" onClick={() => void act(call(`/evidence/${x.indicatorId}/${x.evidenceId}`, 'DELETE'), 'Link removed')}>Unlink</Button></li>
          ))}
          {!v.evidence!.length && <li className="text-slate-400">Nothing linked yet.</li>}
        </ul>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Select label="Indicator" placeholder="Choose…" options={v.indicators!.map((i) => ({ value: i.id, label: `${i.id} ${i.question}`.slice(0, 90) }))} value={indicator} onChange={setIndicator} />
          <Select label="Evidence item" placeholder={options.length ? 'Choose…' : 'No evidence you can link'} options={options.map((o) => ({ value: String(o.id), label: `${o.name} (${o.documentType})` }))} value={item} onChange={setItem} />
          <Button disabled={!indicator || !item} onClick={() => void act(call(`/evidence/${indicator}`, 'POST', { evidenceId: Number(item) }), 'Evidence linked')}>Link</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function OrgRow({ r, act, call }: { r: Row; act: Act; call: Call }) {
  const [text, setText] = useState(r.orgResponse ?? '')
  return (
    <Card><CardContent className="space-y-2 pt-6">
      <p className="text-sm font-medium text-slate-800"><span className="font-mono text-xs text-slate-500">{r.id}</span> {r.question}</p>
      <p className="text-sm">You scored {r.self ?? '—'} · validator {r.validator ?? '—'} · <span className={deltaStyle(r.delta)}>{r.delta == null ? '' : `delta ${r.delta > 0 ? '+' : ''}${r.delta}`}</span>{r.negotiated != null && ` · negotiated ${r.negotiated}`}</p>
      {r.comment && <p className="text-sm text-slate-600">Validator comment: {r.comment}</p>}
      {r.paperCap && <CapNote cap={r.paperCap} />}
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
            {s.partialScope && v.outcome !== 'not_validated' && <Badge className="bg-emerald-100 text-emerald-800">Confirmed: {(s.confirmedLevels as Confirmation[]).filter((c) => c.achieved).map((c) => `level ${c.level}`).join(', ') || 'no levels'}</Badge>}
            <Badge variant="outline" className="text-slate-600">Frozen {new Date(v.finalisedAt!).toLocaleDateString()}</Badge>
          </div>
          <p className="text-sm text-slate-600">{s.engagement.statement}</p>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-700">
          <p>Method: {METHOD_LABEL[s.method as Method]} · Fieldwork {s.fieldwork.start} to {s.fieldwork.end}</p>
          {Array.isArray(s.indices) && s.indices.length > 0 && <p>CRAFT index results: {s.indices.map((ix: any) => `${ix.name}: ${ix.band ?? 'no band'}`).join('; ')}</p>}
          {s.partialScope && <p>This scope skips level 1, so it confirms levels rather than a rung: {(s.confirmedLevels as Confirmation[]).map((c) => `level ${c.level} ${c.achieved ? 'achieved' : 'not achieved'}`).join('; ')}.</p>}
          <p>Self-assessed rung then: {s.selfRung} · Team: {s.team.map((t: any) => `${t.name} (${t.role})`).join(', ')}</p>
          {s.outcomeSummary && <p>{s.outcomeSummary}</p>}
          <p className="break-all font-mono text-xs text-slate-500">SHA-256 of the frozen record: {v.sha256}</p>
          {v.outcome !== 'not_validated' && <Link to="/validations" className="text-sm font-semibold text-emerald-700 hover:underline">See its validity, follow-ups and status →</Link>}
        </CardContent>
      </Card>
      <EngagementReport s={s} />
      {s.qualifications.length > 0 && (
        <Card><CardHeader><CardTitle>Qualifications</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-1 pl-5 text-sm">{s.qualifications.map((q: any) => <li key={q.text}>{q.text} <span className="font-mono text-xs text-slate-500">({q.indicatorIds.join(', ')})</span></li>)}</ul></CardContent></Card>
      )}
      <Card>
        <CardHeader><CardTitle>Scores</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs text-slate-500"><th className="py-1 pr-3">Indicator</th><th className="pr-3">Self</th><th className="pr-3">Validator</th><th className="pr-3">Negotiated</th><th>Final</th></tr></thead>
            <tbody>{s.indicators.map((i: any) => (
              <tr key={i.id} className="border-t border-slate-100"><td className="py-1 pr-3"><span className="font-mono text-xs">{i.id}</span> {i.domain}</td><td className="pr-3">{i.self ?? '—'}</td><td className="pr-3">{i.validator ?? '—'}</td><td className="pr-3">{i.negotiated ?? '—'}</td><td className="font-semibold">{i.final ?? '—'}{i.paperCap && <span className="ml-1 text-xs font-normal text-rose-700">(capped from {i.paperCap.negotiated}: insufficient evidence)</span>}</td></tr>
            ))}</tbody>
          </table>
          {s.indicators.some((i: any) => i.evidence?.length) && (
            <div className="mt-4 text-sm"><p className="text-xs font-medium text-slate-500">Evidence the organisation linked (references only)</p>
              <ul className="list-disc pl-5">{s.indicators.flatMap((i: any) => (i.evidence ?? []).map((x: any) => <li key={`${i.id}-${x.id}`}><span className="font-mono text-xs">{i.id}</span> {x.name}{x.sha256 && <span className="ml-1 font-mono text-xs text-slate-400">sha256 {x.sha256.slice(0, 12)}…</span>}</li>))}</ul></div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/**
 * The engagement report sections that follow from the frozen record: methodology and scope, the methodology's working
 * conclusion (never an audit opinion), limitations and the evidence register. Findings, risk, management responses
 * and the corrective action plan live in the CAP hub and are linked, not copied.
 */
function EngagementReport({ s }: { s: any }) {
  const scope = (s.scope ?? { kind: 'whole' }) as EngagementScope
  const m = methodologyById(scope.methodology)
  const rows = (s.indicators ?? []) as Array<{ id: string; domain: string; final: number | null; paperCap?: unknown; evidence?: unknown[] }>
  const result = m ? methodologyConclusion(m, rows.map((i) => ({ domain: i.domain, final: i.final }))) : null
  const unscored = rows.filter((i) => i.final == null)
  const capped = rows.filter((i) => i.paperCap)
  const linked = rows.reduce((n, i) => n + (i.evidence?.length ?? 0), 0)
  return (
    <Card>
      <CardHeader><CardTitle>Engagement report</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        <div><p className="font-medium text-slate-900">Methodology and scope</p>
          <p>{m ? `${m.name}: ${m.purpose}` : 'No methodology chosen: ladder validation only.'} Scope: {scopeText(scope)}. Method: {METHOD_LABEL[s.method as Method]}; fieldwork {s.fieldwork.start} to {s.fieldwork.end}.</p></div>
        {m && result && (
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="font-medium text-slate-900">Working conclusion: {result.conclusion} ({result.percent}% weighted)</p>
            <p className="text-xs text-slate-500">From the final scores, weighted for this methodology (ready at {m.thresholds.ready}%, conditional at {m.thresholds.conditional}%). It supports the report; it is not an audit opinion or certification and does not change the validation statement.</p>
            {result.weakKeyDomains.length > 0 && <p className="text-xs text-amber-700">Key domains below {m.floor}: {result.weakKeyDomains.join(', ')}.</p>}
          </div>
        )}
        <div><p className="font-medium text-slate-900">Limitations</p>
          <ul className="list-disc pl-5">
            <li>{unscored.length ? `${unscored.length} indicator(s) in scope have no final score: ${unscored.map((i) => i.id).join(', ')}.` : 'Every indicator in scope has a final score.'}</li>
            <li>{capped.length ? `${capped.length} score(s) were capped for insufficient evidence.` : 'No score was capped for insufficient evidence.'}</li>
            {result && result.missingDomains.length > 0 && <li>Methodology domains not covered by this scope: {result.missingDomains.join(', ')}.</li>}
            {s.qualifications.length > 0 && <li>{s.qualifications.length} qualification(s) form part of the conclusion (below).</li>}
          </ul></div>
        <div><p className="font-medium text-slate-900">Findings, risk profile, management response and corrective action plan</p>
          <p>Recorded on the organisation’s corrective action plan with criteria, condition, cause, consequence, inherent and residual risk and the management response: <Link to="/cip" className="text-emerald-700 underline">Capacity plan</Link>.</p></div>
        <div><p className="font-medium text-slate-900">Evidence register</p>
          <p>{linked ? `${linked} evidence item(s) linked to indicators (listed under Scores).` : 'No evidence was linked to indicators.'}</p></div>
      </CardContent>
    </Card>
  )
}
