import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Tabs } from '../components/ui'
import { api, training } from '../lib/trainingClient'
import { trackEvent } from '../lib/analytics'
import { Drill } from './TrainingModulePage'
import { CASES, EXAM, wordCount } from '../lib/validatorTraining'
import { SPECIALIST_EXAM } from '../lib/specialisms'

// Validator system PR 4: the three-part assessment (knowledge exam, scenario cases,
// capstone), annual renewal and the firm-team view. All rules are enforced by
// /api/training; this page reflects them.

const Note = ({ msg }: { msg: { ok: boolean; text: string } | null }) => msg ? <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p> : null
const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : '')
const STATUS: Record<string, string> = { pending: 'Awaiting marking', passed: 'Passed', failed: 'Not passed' }
const STATUS_STYLE: Record<string, string> = { pending: 'bg-amber-100 text-amber-800', passed: 'bg-emerald-100 text-emerald-800', failed: 'bg-rose-100 text-rose-800' }

export function TrainingAssessmentPage() {
  const [tab, setTab] = useState('exam')
  const [me, setMe] = useState<any>(null)
  const reload = () => training('me').then(setMe, () => {})
  useEffect(() => { void reload() }, [])
  return (
    <div className="space-y-5">
      <Link to="/training" className="text-sm text-emerald-700 hover:underline">← Module map</Link>
      <div>
        <h1 className="font-display text-3xl font-bold text-emerald-900">Assessment and renewal</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">All three parts must be passed; a high score in one cannot make up for a fail in another. Passing all three makes you CRAFT-accredited for one year. This is the only way accreditation is granted.</p>
      </div>
      {me && !me.assessment.trainingComplete && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Complete all the core modules first. The assessment opens when the module map shows every core module complete.</p>}
      {me && !me.profile && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Create your <Link to="/directory" className="underline">validator profile</Link> before the assessment.</p>}
      {me?.profile?.accreditation === 'suspended' && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">Your validator profile is suspended, so the assessment and renewal are unavailable.</p>}
      <Tabs tabs={[{ id: 'exam', label: '1. Knowledge exam' }, { id: 'cases', label: '2. Scenario cases' }, { id: 'capstone', label: '3. Capstone' }, { id: 'renewal', label: 'Annual renewal' }, { id: 'specialist', label: 'Specialisms' }, { id: 'firm', label: 'My firm’s team' }]} active={tab} onChange={setTab} />
      {tab === 'exam' && <Exam onChange={reload} />}
      {tab === 'cases' && <Cases onChange={reload} />}
      {tab === 'capstone' && <Capstone onChange={reload} />}
      {tab === 'renewal' && <Renewal />}
      {tab === 'specialist' && <Specialist me={me} onChange={reload} />}
      {tab === 'firm' && <FirmTeam />}
    </div>
  )
}

function Exam({ onChange }: { onChange: () => void }) {
  const [info, setInfo] = useState<any>(null)
  const [exam, setExam] = useState<any>(null)
  const [ans, setAns] = useState<Record<string, number>>({})
  const [result, setResult] = useState<any>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [left, setLeft] = useState<number | null>(null)
  const load = () => training('exam').then(setInfo, (e) => setMsg({ ok: false, text: e.message }))
  useEffect(() => { void load() }, [])
  const submit = async (answers = ans) => {
    if (!exam) return
    try { const r = await training(`exam/${exam.id}/submit`, { method: 'POST', json: { answers } }); void trackEvent({ event: r.passed ? 'exam_passed' : 'exam_failed' }); setResult(r); setExam(null); setMsg(null); void load(); onChange() } catch (e: any) { setMsg({ ok: false, text: e.message }); setExam(null); void load() }
  }
  useEffect(() => {
    if (!exam) return
    const tick = () => setLeft(Math.max(0, Math.round((new Date(exam.deadline).getTime() - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [exam?.id])
  useEffect(() => { if (exam && left === 0) void submit() }, [left])
  if (exam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Knowledge exam ({exam.questions.length} questions)</CardTitle>
          <p className="text-sm text-slate-600">Open-book. The only timed part of the programme. <strong role="timer">Time left: {left === null ? '' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</strong></p>
          {exam.note && <p className="text-sm text-amber-800">{exam.note}</p>}
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit() }}>
            {exam.questions.map((q: any, i: number) => (
              <fieldset key={q.id} className="rounded-lg border border-slate-100 p-3">
                <legend className="text-sm font-medium text-slate-800">{i + 1}. {q.prompt}</legend>
                {q.options.map((o: string, j: number) => (
                  <label key={j} className="flex cursor-pointer items-start gap-2 px-2 py-1 text-sm text-slate-700"><input type="radio" name={q.id} checked={ans[q.id] === j} onChange={() => setAns({ ...ans, [q.id]: j })} className="mt-1 h-4 w-4 accent-emerald-600" />{o}</label>
                ))}
              </fieldset>
            ))}
            <div className="flex flex-wrap items-center gap-3"><Button type="submit">Submit exam ({Object.keys(ans).length} of {exam.questions.length} answered)</Button><Note msg={msg} /></div>
          </form>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Part 1: knowledge exam</CardTitle>
        <p className="text-sm text-slate-600">{EXAM.questions} multiple-choice questions drawn at random from the bank, {EXAM.minutes} minutes, open-book. Pass mark {EXAM.passPct}%. Retake after {EXAM.retakeDays} days; at most {EXAM.maxAttemptsPerYear} attempts a year.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {info?.bankShort && <p className="text-sm text-amber-800">The question bank currently has {info.bankSize} exam questions, fewer than {EXAM.questions}, so every question is drawn (the pass mark is still {EXAM.passPct}% of the questions drawn). The programme team is growing the bank.</p>}
        {info && <p className="text-sm text-slate-600">Attempts in the last 12 months: {info.eligibility.attemptsThisYear} of {EXAM.maxAttemptsPerYear}.{info.eligibility.nextAt && !info.eligibility.allowed ? ` You can sit it again on ${new Date(info.eligibility.nextAt).toLocaleDateString()}.` : ''}</p>}
        {info?.attempts.length > 0 && <ul className="space-y-1 text-sm">{info.attempts.map((a: any) => <li key={a.id}>{fmt(a.startedAt)}: {a.status === 'in_progress' ? 'in progress' : a.status === 'expired' ? 'time ran out' : `${a.score}/${a.total}`} <Badge className={a.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>{a.passed ? 'Passed' : a.status === 'in_progress' ? 'In progress' : 'Not passed'}</Badge></li>)}</ul>}
        {result && (
          <div role="status" className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
            <p className="font-semibold">{result.score} of {result.total} ({result.pct}%): {result.passed ? 'passed' : `not passed (pass mark ${result.passMark})`}</p>
            <ol className="list-decimal space-y-2 pl-5">{result.review.map((q: any) => <li key={q.id}><p>{q.prompt}</p><p className={q.yours === q.correctIndex ? 'text-emerald-700' : 'text-rose-700'}>Your answer: {q.yours === null ? 'none' : q.options[q.yours]}{q.yours !== q.correctIndex && `; correct: ${q.options[q.correctIndex]}`}. {q.explanation}</p></li>)}</ol>
          </div>
        )}
        {!info?.attempts.some((a: any) => a.passed) && (
          <Button disabled={info && !info.eligibility.allowed && !info.attempts.some((a: any) => a.status === 'in_progress')} onClick={async () => {
            try { const e = await training('exam/start', { method: 'POST', json: {} }); void trackEvent({ event: 'exam_started' }); setExam(e); setAns({}); setResult(null); setMsg(null) } catch (err: any) { setMsg({ ok: false, text: err.message }) }
          }}>{info?.attempts.some((a: any) => a.status === 'in_progress') ? 'Resume exam' : 'Start the exam'}</Button>
        )}
        <Note msg={msg} />
      </CardContent>
    </Card>
  )
}

function Cases({ onChange }: { onChange: () => void }) {
  const [data, setData] = useState<any>(null)
  const [text, setText] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const load = () => training('cases').then(setData, (e) => setMsg({ ok: false, text: e.message }))
  useEffect(() => { void load() }, [])
  if (!data) return <Note msg={msg} />
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Four written cases of about 300 words ({CASES.minWords}-{CASES.maxWords} accepted), each marked by two markers from the CRAFT programme team or Lead Validators. 70% on each case passes it. One resubmission per case.</p>
      {data.cases.map((c: any) => {
        const w = wordCount(text[c.id] ?? '')
        return (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle>{c.title}</CardTitle>
              <p className="text-sm text-slate-700">{c.prompt}</p>
              {c.submissions.map((s: any) => (
                <div key={s.attempt} className="mt-1 text-sm">Attempt {s.attempt}: <Badge className={STATUS_STYLE[s.status]}>{STATUS[s.status]}{s.percent !== null ? ` (${s.percent}%)` : ''}</Badge>
                  {s.feedback.map((f: string, i: number) => <p key={i} className="mt-1 rounded bg-slate-50 p-2 text-slate-700">Marker feedback: {f}</p>)}
                </div>
              ))}
            </CardHeader>
            {c.canSubmit && (
              <CardContent className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Your answer ({w} words)
                  <textarea rows={8} value={text[c.id] ?? ''} onChange={(e) => setText({ ...text, [c.id]: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                </label>
                <Button disabled={w < CASES.minWords || w > CASES.maxWords} onClick={async () => {
                  try { await training(`cases/${c.id}/submit`, { method: 'POST', json: { text: text[c.id] } }); setMsg({ ok: true, text: 'Submitted for marking' }); setText({ ...text, [c.id]: '' }); void load(); onChange() } catch (e: any) { setMsg({ ok: false, text: e.message }) }
                }}>Submit for marking</Button>
              </CardContent>
            )}
          </Card>
        )
      })}
      <Note msg={msg} />
    </div>
  )
}

const OUTCOMES = [{ v: 'validated', l: 'Validated' }, { v: 'validated_with_qualifications', l: 'Validated with qualifications' }, { v: 'not_validated', l: 'Not validated' }]

function Capstone({ onChange }: { onChange: () => void }) {
  const [data, setData] = useState<any>(null)
  const [f, setF] = useState<any>({ declaration: '', debrief: '', outcome: 'validated_with_qualifications', ratedRung: 0, qualifications: '', followUp: '', validityMonths: 6, materialEvents: '' })
  const [scores, setScores] = useState<Record<string, { score: number; note: string }>>({})
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const load = () => training('capstone').then(setData, (e) => setMsg({ ok: false, text: e.message }))
  useEffect(() => { void load() }, [])
  if (!data) return <Note msg={msg} />
  const cap = data.capstone
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">A simulated end-to-end validation, marked against a rubric. Pass: 70% overall and at least “Meets” on Independence and Outcome. One retake, with a different case.</p>
      {data.submissions.map((s: any) => (
        <p key={s.id} className="text-sm">Attempt {s.attempt}: <Badge className={STATUS_STYLE[s.status]}>{STATUS[s.status]}{s.percent !== null ? ` (${s.percent}%)` : ''}</Badge>{s.feedback.map((x: string, i: number) => <span key={i} className="mt-1 block rounded bg-slate-50 p-2">Marker feedback: {x}</span>)}</p>
      ))}
      {data.noCaseForRetake && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">A retake needs a different sandbox case, and none is available yet. The CRAFT programme team has been asked to add one; contact them to arrange your retake.</p>}
      {cap && data.canSubmit && (
        <>
          <Card>
            <CardHeader><CardTitle>{cap.title}</CardTitle><p className="whitespace-pre-line text-sm text-slate-700">{cap.brief}</p></CardHeader>
            <CardContent className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Evidence file</h3>
              {cap.evidence.map((e: any, i: number) => <details key={i} className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-medium">{e.title}</summary><p className="mt-1 whitespace-pre-line text-sm text-slate-700">{e.body}</p></details>)}
              <h3 className="text-sm font-semibold text-slate-800">Marking rubric</h3>
              <ul className="space-y-1 text-sm text-slate-600">{cap.rubric.map((r: any) => <li key={r.key}><strong>{r.name}</strong> ({r.mustMeet ? 'must meet' : r.weight}): {r.meets}</li>)}</ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Your validation</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault()
                try { await training(`capstone/${cap.id}/submit`, { method: 'POST', json: { ...f, ratedRung: Number(f.ratedRung), validityMonths: Number(f.validityMonths), scores } }); setMsg({ ok: true, text: 'Submitted for marking' }); void load(); onChange() } catch (err: any) { setMsg({ ok: false, text: err.message }) }
              }}>
                <label className="block text-sm font-medium text-slate-700">1. Independence declaration (note the funder engagement and any relationship you noticed)
                  <textarea rows={4} required value={f.declaration} onChange={set('declaration')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <fieldset className="space-y-2"><legend className="text-sm font-medium text-slate-700">2. Score each rung 1-4 indicator (0-5) with an evidence note</legend>
                  {data.indicators.map((i: any) => (
                    <div key={i.id} className="grid gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-[14rem_6rem_1fr] sm:items-center">
                      <p className="text-sm text-slate-700"><span className="font-mono text-xs">{i.id}</span> {i.domain}</p>
                      <select aria-label={`${i.id} score`} value={scores[i.id]?.score ?? ''} onChange={(e) => setScores({ ...scores, [i.id]: { score: Number(e.target.value), note: scores[i.id]?.note ?? '' } })} className="rounded border border-slate-300 px-2 py-1 text-sm" required>
                        <option value="" disabled>Score</option>{[0, 1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <input aria-label={`${i.id} evidence note`} placeholder="Evidence note" required minLength={5} value={scores[i.id]?.note ?? ''} onChange={(e) => setScores({ ...scores, [i.id]: { score: scores[i.id]?.score ?? 0, note: e.target.value } })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
                    </div>
                  ))}
                </fieldset>
                <label className="block text-sm font-medium text-slate-700">3. Debrief note responding to the organisation’s pushback
                  <textarea rows={3} required value={f.debrief} onChange={set('debrief')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm font-medium text-slate-700">4. Outcome
                    <select value={f.outcome} onChange={set('outcome')} className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm font-normal">{OUTCOMES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label>
                  <Input label="Validated rung (0-7)" type="number" min={0} max={7} value={f.ratedRung} onChange={set('ratedRung')} />
                  <Input label="Validity (months)" type="number" min={1} max={24} value={f.validityMonths} onChange={set('validityMonths')} />
                </div>
                <label className="block text-sm font-medium text-slate-700">Qualifications (specific and testable, tied to indicators)
                  <textarea rows={3} value={f.qualifications} onChange={set('qualifications')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <label className="block text-sm font-medium text-slate-700">5. Follow-up schedule
                  <textarea rows={2} required value={f.followUp} onChange={set('followUp')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <label className="block text-sm font-medium text-slate-700">Material events (record any you found, or write “none”)
                  <textarea rows={2} required value={f.materialEvents} onChange={set('materialEvents')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <div className="flex flex-wrap items-center gap-3"><Button type="submit">Submit capstone for marking</Button><Note msg={msg} /></div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Renewal() {
  const [r, setR] = useState<any>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [cpd, setCpd] = useState({ hours: '1', activity: '', occurredOn: new Date().toISOString().slice(0, 10) })
  const [clients, setClients] = useState('')
  const load = () => training('renewal').then(setR, (e) => setError(e.message))
  useEffect(() => { void load() }, [])
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setMsg({ ok: true, text: ok }); void load() } catch (e: any) { setMsg({ ok: false, text: e.message }) } }
  if (error) return <p className="text-sm text-slate-600">{error}. Renewal applies once you have passed the assessment.</p>
  if (!r) return null
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Annual renewal</CardTitle>
          <p className="text-sm text-slate-600">Accredited until {new Date(r.until).toLocaleDateString()}. Renewal opens on {new Date(r.opensAt).toLocaleDateString()}; complete the items below within your accreditation year. Renewing extends your accreditation by one year. If it lapses you lose the badge until you renew.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-1 text-sm">{r.items.map((i: any) => <li key={i.key}>{i.done ? '✓' : '○'} {i.label} <span className="text-slate-500">({i.detail})</span></li>)}</ul>
          {r.videosLeft.length > 0 && <p className="text-sm text-slate-600">Videos to re-watch: {r.videosLeft.map((id: string) => <Link key={id} to="/training/module/$moduleId" params={{ moduleId: id }} className="mr-2 text-emerald-700 underline">Module {id.replace('m', '')}</Link>)}</p>}
          <Button disabled={!r.ready || !r.open} onClick={() => void act(() => training('renewal/complete', { method: 'POST', json: {} }), 'Accreditation renewed')}>Renew my accreditation</Button>
          {!r.open && <p className="text-xs text-slate-500">Renewal is not open yet.</p>}
          <Note msg={msg} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Continuing development log</CardTitle><p className="text-sm text-slate-500">Eight hours a year: new CRAFT modules, monthly cohort calls or recognised professional CPD (ICAN, ACCA, IIA hours count).</p></CardHeader>
        <CardContent className="space-y-2">
          <ul className="space-y-1 text-sm">{r.cpd.map((c: any) => <li key={c.id} className="flex flex-wrap items-center gap-2">{c.occurredOn}: {c.hours} h, {c.activity}<Button size="sm" variant="ghost" onClick={() => void act(() => training(`renewal/cpd/${c.id}`, { method: 'DELETE' }), 'Removed')}>Remove</Button></li>)}</ul>
          <form className="grid gap-2 sm:grid-cols-[6rem_1fr_10rem_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); void act(() => training('renewal/cpd', { method: 'POST', json: { hours: Number(cpd.hours), activity: cpd.activity, occurredOn: cpd.occurredOn } }), 'Logged') }}>
            <Input label="Hours" type="number" step="0.5" min="0.5" max="24" value={cpd.hours} onChange={(e) => setCpd({ ...cpd, hours: e.target.value })} />
            <Input label="Activity" required value={cpd.activity} onChange={(e) => setCpd({ ...cpd, activity: e.target.value })} />
            <Input label="Date" type="date" required value={cpd.occurredOn} onChange={(e) => setCpd({ ...cpd, occurredOn: e.target.value })} />
            <Button type="submit" variant="outline">Add</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Annual calibration drill</CardTitle><p className="text-sm text-slate-500">Score 10 fresh indicators; 80% must be within 1 point of the reference scores.</p></CardHeader>
        <CardContent><Drill path="renewal/drill" onDone={() => void load()} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Updated independence declaration</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-slate-700">{r.declaration}</p>
          <label className="block text-sm font-medium text-slate-700">Current client relationships (write “None” if there are none)
            <textarea rows={3} value={clients} onChange={(e) => setClients(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
          <Button variant="outline" onClick={() => void act(() => training('renewal/declaration', { method: 'POST', json: { confirm: true, clients } }), 'Declaration signed')}>I confirm and sign</Button>
        </CardContent>
      </Card>
    </div>
  )
}

function FirmTeam() {
  const [firms, setFirms] = useState<any[] | null>(null)
  const [teams, setTeams] = useState<Record<string, any>>({})
  useEffect(() => {
    api('/api/directory/me').then(async (me) => {
      const owned = (me.firms as any[]).filter((f) => f.kind === 'validator_firm' && f.role === 'owner')
      setFirms(owned)
      for (const f of owned) training(`firm/${f.id}/team`).then((t) => setTeams((x) => ({ ...x, [f.id]: t })), () => {})
    }, () => setFirms([]))
  }, [])
  if (!firms) return null
  if (!firms.length) return <p className="text-sm text-slate-600">If you own a validator firm’s profile, you will see here which team members’ accreditation has lapsed. Each member renews for themselves.</p>
  return (
    <div className="space-y-4">
      {firms.map((f) => (
        <Card key={f.id}>
          <CardHeader><CardTitle>{f.name}</CardTitle>{teams[f.id] && <p className="text-sm text-slate-600">{teams[f.id].lapsed} of {teams[f.id].team.length} team members lapsed. Each member renews on their own account.</p>}</CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {teams[f.id]?.team.map((m: any) => (
                <li key={m.email} className="flex flex-wrap items-center gap-2">
                  {m.name ?? m.email}
                  <Badge className={m.state === 'accredited' ? 'bg-emerald-100 text-emerald-800' : m.state === 'lapsed' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>{m.state === 'lapsed' ? 'Accreditation lapsed' : m.state}</Badge>
                  {m.accreditedUntil && <span className="text-slate-500">{m.lapsed ? 'lapsed' : 'until'} {new Date(m.accreditedUntil).toLocaleDateString()}</span>}
                  {m.renewal && <span className="text-slate-500">renewal items {m.renewal.done}/{m.renewal.total}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Specialist accreditation (indices spec §7.1): for the Fiduciary Controls and Safeguards indices.
type SpecialistState = {
  specialism: string; label: string; moduleId: string; moduleTitle: string | null; moduleComplete: boolean
  granted: boolean; current: boolean; accredited: boolean; allowed: boolean; nextAt: string | null; inProgress: string | null
  attempts: Array<{ id: string; startedAt: string; status: string; score: number | null; total: number; passed: boolean }>
}

function Specialist({ me, onChange }: { me: any; onChange: () => void }) {
  const [run, setRun] = useState<any>(null)
  const [ans, setAns] = useState<Record<string, number>>({})
  const [result, setResult] = useState<any>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [left, setLeft] = useState<number | null>(null)
  const submit = async () => {
    if (!run) return
    try { const r = await training(`specialist/attempt/${run.id}/submit`, { method: 'POST', json: { answers: ans } }); setResult(r); setRun(null); setMsg(null); onChange() } catch (e: any) { setMsg({ ok: false, text: e.message }); setRun(null); onChange() }
  }
  useEffect(() => {
    if (!run) return
    const tick = () => setLeft(Math.max(0, Math.round((new Date(run.deadline).getTime() - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [run?.id])
  useEffect(() => { if (run && left === 0) void submit() }, [left])
  const list: SpecialistState[] = me?.specialist ?? []
  if (run) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{run.label} specialist assessment ({run.questions.length} questions)</CardTitle>
          <p className="text-sm text-slate-600">Open-book. <strong role="timer">Time left: {left === null ? '' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</strong></p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit() }}>
            {run.questions.map((q: any, i: number) => (
              <fieldset key={q.id} className="rounded-lg border border-slate-100 p-3">
                <legend className="text-sm font-medium text-slate-800">{i + 1}. {q.prompt}</legend>
                {q.options.map((o: string, j: number) => (
                  <label key={j} className="flex cursor-pointer items-start gap-2 px-2 py-1 text-sm text-slate-700"><input type="radio" name={q.id} checked={ans[q.id] === j} onChange={() => setAns({ ...ans, [q.id]: j })} className="mt-1 h-4 w-4 accent-emerald-600" />{o}</label>
                ))}
              </fieldset>
            ))}
            <div className="flex flex-wrap items-center gap-3"><Button type="submit">Submit ({Object.keys(ans).length} of {run.questions.length} answered)</Button><Note msg={msg} /></div>
          </form>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-slate-600">Validating the Fiduciary Controls & Risk Management or Environmental & Social Safeguards index needs the matching specialism. Complete the specialist module, then pass its timed assessment: {SPECIALIST_EXAM.questions} questions, {SPECIALIST_EXAM.minutes} minutes, pass mark {SPECIALIST_EXAM.passPct}%. A specialism counts only while your main accreditation is current.</p>
      {result && <p role="status" className={`rounded-lg p-3 text-sm ${result.passed ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>{result.score}/{result.total}: {result.passed ? 'passed. The specialism is now on your profile.' : 'not passed this time. You can retake it after 14 days.'}</p>}
      {list.map((s) => (
        <Card key={s.specialism}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{s.label}</CardTitle>
              {s.current ? <Badge className="bg-emerald-100 text-emerald-800">Held</Badge> : s.granted ? <Badge className="bg-amber-100 text-amber-800">Lapsed with your accreditation</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>Module: <Link to="/training/module/$moduleId" params={{ moduleId: s.moduleId }} className="text-emerald-700 hover:underline">{s.moduleTitle ?? s.moduleId}</Link> {s.moduleComplete ? '(complete)' : '(not yet complete)'}</p>
            {s.attempts.length > 0 && <p className="text-slate-500">Attempts: {s.attempts.map((a) => `${new Date(a.startedAt).toLocaleDateString()} ${a.status === 'submitted' ? `${a.score}/${a.total}${a.passed ? ' passed' : ''}` : a.status}`).join('; ')}</p>}
            {!s.granted && (
              <Button disabled={!s.accredited || !s.moduleComplete || (!s.allowed && !s.inProgress)} onClick={async () => {
                try { const r = await training(`specialist/${s.specialism}/start`, { method: 'POST', json: {} }); setRun({ ...r, label: s.label }); setAns({}); setResult(null); setMsg(null) } catch (e: any) { setMsg({ ok: false, text: e.message }) }
              }}>{s.inProgress ? 'Resume the assessment' : 'Start the assessment'}</Button>
            )}
            {!s.accredited && !s.granted && <p className="text-slate-500">You need to be CRAFT-accredited first.</p>}
            {!s.allowed && !s.inProgress && s.nextAt && <p className="text-slate-500">Next attempt from {new Date(s.nextAt).toLocaleDateString()}.</p>}
          </CardContent>
        </Card>
      ))}
      <Note msg={msg} />
    </div>
  )
}
