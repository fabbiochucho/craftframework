import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '../components/ui'
import { training } from '../lib/trainingClient'
import { BaselineTests } from '../components/BaselineTests'
import { trackEvent } from '../lib/analytics'
import { LADDER_INDICATORS, LADDER_LEVELS, currentRung, levelAchieved, levelScore } from '../lib/capitalReadiness'
import { STEPS, type Step } from '../lib/validatorTraining'
import { WATCHED_PCT, createWatchTracker, playerProgress } from '../lib/videoWatch'

// One training module: Watch → Try → Decide → Check → Reflect. Grading, answer keys and
// completion are all server-side (/api/training/modules/:id/...); this page shows what the
// server returns. Keyboard operable throughout; no time limits.

type ModuleView = {
  id: string; position: number; title: string; outcome: string; script: string; reflectionPrompt: string; videoId: string | null
  exercises: any[]; scenario: null | { prompt: string; choices: Array<{ text: string }> }
  steps: string[]; exercisesDone: Array<{ n: number; score: number | null; total: number | null }>
  decision: null | { choice: number; best: boolean }; reflection: string
  checkQuestions: Array<{ id: string; prompt: string; options: string[] }>; checkSkip: null | { body: string; verified: boolean }
}
const LABEL: Record<Step, string> = { watch: '1. Watch', try: '2. Try', decide: '3. Decide', check: '4. Check', reflect: '5. Reflect' }

const Note = ({ msg }: { msg: { ok: boolean; text: string } | null }) => msg ? <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p> : null

function Radios({ name, legend, options, value, onChange, disabled }: { name: string; legend: string; options: string[]; value: number | undefined; onChange: (i: number) => void; disabled?: boolean }) {
  return (
    <fieldset className="space-y-1" disabled={disabled}>
      <legend className="text-sm font-medium text-slate-800">{legend}</legend>
      {options.map((o, i) => (
        <label key={i} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
          <input type="radio" name={name} checked={value === i} onChange={() => onChange(i)} className="mt-1 h-4 w-4 accent-emerald-600" />
          <span>{o}</span>
        </label>
      ))}
    </fieldset>
  )
}

export function TrainingModulePage({ moduleId }: { moduleId: string }) {
  const [m, setM] = useState<ModuleView | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState<Step>('watch')
  const load = () => training<ModuleView>(`modules/${moduleId}`).then(setM, (e) => setError(e.message))
  useEffect(() => { setM(null); void load() }, [moduleId])
  // Reports a module the first time it turns complete in this visit (not when an already-complete one is opened).
  const wasComplete = useRef<boolean | null>(null)
  useEffect(() => { wasComplete.current = null }, [moduleId])
  useEffect(() => {
    if (!m) return
    const done = STEPS.every((s) => m.steps.includes(s))
    if (wasComplete.current === false && done) void trackEvent({ event: 'training_module_completed', module: m.id })
    wasComplete.current = done
  }, [m])
  useEffect(() => { if (m && step === 'watch' && m.steps.includes('watch')) { const next = STEPS.find((s) => !m.steps.includes(s)); if (next) setStep(next) } }, [m?.id])
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!m) return <p className="text-sm text-slate-500">Loading…</p>
  return (
    <div className="space-y-5">
      <Link to="/training" className="text-sm text-emerald-700 hover:underline">← Module map</Link>
      <div>
        <h1 className="font-display text-2xl font-bold text-emerald-900">Module {m.position}. {m.title}</h1>
        <p className="mt-1 text-sm text-slate-600"><strong>Outcome:</strong> {m.outcome}</p>
      </div>
      <BaselineTests moduleId={m.id} />
      <nav aria-label="Module steps" className="flex flex-wrap gap-1 border-b border-slate-200">
        {STEPS.map((s) => (
          <button key={s} onClick={() => setStep(s)} aria-current={step === s ? 'step' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${step === s ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {LABEL[s]}{m.steps.includes(s) ? ' ✓' : ''}
          </button>
        ))}
      </nav>
      {step === 'watch' && <WatchStep m={m} reload={load} next={() => setStep('try')} />}
      {step === 'try' && <TryStep m={m} reload={load} next={() => setStep('decide')} />}
      {step === 'decide' && <DecideStep m={m} reload={load} next={() => setStep('check')} />}
      {step === 'check' && <CheckStep m={m} reload={load} next={() => setStep('reflect')} />}
      {step === 'reflect' && <ReflectStep m={m} reload={load} />}
      {STEPS.every((s) => m.steps.includes(s)) && (
        <Card className="border-emerald-200 bg-emerald-50/50"><CardContent className="pt-6 text-sm text-emerald-900">Module complete. <Link to="/training" className="underline">Back to the module map</Link>.</CardContent></Card>
      )}
    </div>
  )
}

const PLAYER_ORIGIN = 'https://www.youtube-nocookie.com'

function WatchStep({ m, reload, next }: { m: ModuleView; reload: () => void; next: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pct, setPct] = useState(0)
  const [noProgress, setNoProgress] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const watched = m.steps.includes('watch')
  // The embedded player reports its progress by postMessage once told we are listening; only seconds played
  // through count (see videoWatch.ts), so the button opens once most of the video has really been watched.
  useEffect(() => {
    if (!m.videoId) return
    const tracker = createWatchTracker()
    let heard = false
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== PLAYER_ORIGIN || e.source !== frame.current?.contentWindow) return
      heard = true
      const p = playerProgress(e.data)
      if (p) setPct(tracker.update(p.currentTime, p.duration))
    }
    window.addEventListener('message', onMessage)
    const listen = () => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), PLAYER_ORIGIN)
    const timers = [500, 1500, 3000, 6000].map((ms) => setTimeout(listen, ms))
    // ponytail: if the player never answers (YouTube changed its embed messages), fall back to the honour button
    // rather than lock learners out; the upgrade is YouTube's IFrame API script, which needs a CSP change.
    const fallback = setTimeout(() => { if (!heard) setNoProgress(true) }, 15000)
    return () => { window.removeEventListener('message', onMessage); timers.forEach(clearTimeout); clearTimeout(fallback) }
  }, [m.videoId])
  const canRecord = !m.videoId || pct >= WATCHED_PCT || noProgress
  return (
    <Card>
      <CardHeader><CardTitle>Watch</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {m.videoId ? (
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
            <iframe ref={frame} className="h-full w-full" title={`Module ${m.position} video: ${m.title}`}
              src={`${PLAYER_ORIGIN}/embed/${m.videoId}?cc_load_policy=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              allow="encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          </div>
        ) : <p className="text-sm text-slate-500">The video for this module has not been recorded yet. Read the written script below.</p>}
        {m.videoId ? (
          <details className="rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Transcript</summary>
            <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{m.script}</div>
          </details>
        ) : <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{m.script}</div>}
        {watched && <p role="status" className="text-sm text-emerald-700">You have already watched this module. You do not need to watch it again unless your yearly renewal asks you to.</p>}
        {m.videoId && !noProgress && !(watched && pct === 0) && (
          <p className="text-sm text-slate-600" aria-live="polite">Watched so far: {pct}%{pct < WATCHED_PCT ? ` (the button opens at ${WATCHED_PCT}%)` : ''}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {watched && <Button onClick={next}>Next: Try</Button>}
          <Button variant={watched ? 'outline' : 'primary'} disabled={!canRecord} onClick={async () => {
            try { await training(`modules/${m.id}/watch`, { method: 'POST', json: m.videoId ? { watchedPct: noProgress ? null : pct } : {} }); setMsg({ ok: true, text: 'Recorded' }); reload(); next() } catch (e: any) { setMsg({ ok: false, text: e.message }) }
          }}>{m.videoId ? (watched ? 'Record watching again' : 'I have watched this video') : 'I have read the script'}</Button>
          <Note msg={msg} />
        </div>
      </CardContent>
    </Card>
  )
}

function TryStep({ m, reload, next }: { m: ModuleView; reload: () => void; next: () => void }) {
  return (
    <div className="space-y-4">
      {m.exercises.map((ex, n) => (
        <Card key={n}>
          <CardHeader>
            <CardTitle>{ex.title}</CardTitle>
            <p className="text-sm text-slate-500">{ex.instructions}</p>
            {m.exercisesDone.some((d) => d.n === n) && <Badge className="bg-emerald-100 text-emerald-800">Done</Badge>}
          </CardHeader>
          <CardContent>
            {ex.type === 'classify' && <Classify m={m} n={n} ex={ex} reload={reload} />}
            {ex.type === 'rung-calculator' && <RungCalculator m={m} n={n} ex={ex} reload={reload} />}
            {ex.type === 'calibration-drill' && <Drill path={`modules/${m.id}/try/${n}`} onDone={reload} />}
            {ex.type === 'write' && <Write m={m} n={n} ex={ex} reload={reload} />}
          </CardContent>
        </Card>
      ))}
      {m.steps.includes('try') && <Button variant="outline" onClick={next}>Next: Decide</Button>}
    </div>
  )
}

function Classify({ m, n, ex, reload }: { m: ModuleView; n: number; ex: any; reload: () => void }) {
  const [ans, setAns] = useState<number[]>(() => ex.items.map(() => -1))
  const [res, setRes] = useState<any>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault()
      try { setRes(await training(`modules/${m.id}/try/${n}`, { method: 'POST', json: { answers: ans } })); setMsg(null); reload() } catch (err: any) { setMsg({ ok: false, text: err.message }) }
    }}>
      {ex.items.map((it: any, i: number) => (
        <div key={i} className="rounded-lg border border-slate-100 p-3">
          <Radios name={`ex${n}-${i}`} legend={`${i + 1}. ${it.prompt}`} options={it.options} value={ans[i] >= 0 ? ans[i] : undefined} onChange={(v) => setAns(ans.map((a, j) => (j === i ? v : a)))} />
          {res && (
            <p role="status" className={`mt-2 text-sm ${res.items[i].correct ? 'text-emerald-700' : 'text-rose-700'}`}>
              {res.items[i].correct ? 'Correct. ' : `Not quite; the answer is "${it.options[res.items[i].correctIndex]}". `}{res.items[i].explain}
            </p>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={ans.some((a) => a < 0)}>Check my answers</Button>
        {res && <p role="status" className="text-sm font-medium text-slate-700">Score: {res.score} of {res.total}. You can try again.</p>}
        <Note msg={msg} />
      </div>
    </form>
  )
}

function RungCalculator({ m, n, ex, reload }: { m: ModuleView; n: number; ex: any; reload: () => void }) {
  const inds = LADDER_INDICATORS.filter((i) => i.level <= 4)
  const [scores, setScores] = useState<Record<string, number>>(ex.start)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const rung = currentRung(scores)
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {LADDER_LEVELS.filter((l) => l.level <= 4).map((l) => (
          <li key={l.level} className="rounded-lg border border-slate-100 p-3">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
              Level {l.level}: {l.name}
              <Badge className={levelAchieved(l.level, scores) ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}>mean {levelScore(l.level, scores).toFixed(2)} · {levelAchieved(l.level, scores) ? 'achieved' : 'not achieved'}</Badge>
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {inds.filter((i) => i.level === l.level).map((i) => (
                <label key={i.id} className="text-xs text-slate-600">
                  <span className="font-mono">{i.id}</span> {i.domain}: <strong>{scores[i.id]}</strong>
                  <input type="range" min={0} max={5} step={1} value={scores[i.id]} aria-label={`${i.id} ${i.domain} score`} onChange={(e) => setScores({ ...scores, [i.id]: Number(e.target.value) })} className="mt-1 w-full accent-emerald-600" />
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-slate-700" role="status">The organisation’s current rung: <strong>{rung}</strong> (a level only counts when every level below it is achieved).</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={async () => {
          try {
            const r = await training(`modules/${m.id}/try/${n}`, { method: 'POST', json: { scores } })
            setMsg(r.done ? { ok: true, text: `Challenge complete: rung ${r.rung}.` } : { ok: false, text: `Your scores give rung ${r.rung}; the challenge is rung ${ex.target}.` })
            if (r.done) reload()
          } catch (e: any) { setMsg({ ok: false, text: e.message }) }
        }}>Submit: make the rung exactly {ex.target}</Button>
        <Note msg={msg} />
      </div>
    </div>
  )
}

export function Drill({ path, onDone }: { path: string; onDone?: (r: any) => void }) {
  const [items, setItems] = useState<Array<{ id: string; statement: string }> | null>(null)
  const [ans, setAns] = useState<Record<string, number>>({})
  const [res, setRes] = useState<any>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const start = () => { setRes(null); setAns({}); training('drill').then((d) => setItems(d.items), (e) => setMsg({ ok: false, text: e.message })) }
  useEffect(start, [])
  if (!items) return <Note msg={msg} />
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault()
      try { const r = await training(path, { method: 'POST', json: { answers: ans } }); setRes(r); onDone?.(r) } catch (err: any) { setMsg({ ok: false, text: err.message }) }
    }}>
      {items.map((it, i) => {
        const r = res?.items.find((x: any) => x.id === it.id)
        return (
          <div key={it.id} className="rounded-lg border border-slate-100 p-3">
            <p id={`dr-${it.id}`} className="text-sm text-slate-800">{i + 1}. {it.statement}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <label className="text-sm text-slate-600">Your score (0-5)
                <select aria-labelledby={`dr-${it.id}`} value={ans[it.id] ?? ''} disabled={!!res} onChange={(e) => setAns({ ...ans, [it.id]: Number(e.target.value) })} className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm">
                  <option value="" disabled>Choose</option>
                  {[0, 1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              {r && <span role="status" className={`text-sm ${r.within ? 'text-emerald-700' : 'text-rose-700'}`}>Reference score {r.reference}: {r.within ? 'within 1 point' : 'more than 1 point away'}</span>}
            </div>
          </div>
        )
      })}
      <div className="flex flex-wrap items-center gap-3">
        {!res ? <Button type="submit" disabled={Object.keys(ans).length < items.length}>Compare with the reference scores</Button> : <Button type="button" variant="outline" onClick={start}>Try fresh indicators</Button>}
        {res && <p role="status" className="text-sm font-medium text-slate-700">Calibration: {res.within} of {res.total} within 1 point ({res.pct}%){res.passed ? '. Meets the 80% mark.' : '.'}</p>}
        <Note msg={msg} />
      </div>
    </form>
  )
}

function Write({ m, n, ex, reload }: { m: ModuleView; n: number; ex: any; reload: () => void }) {
  const [ans, setAns] = useState<string[]>(() => ex.items.map(() => ''))
  const [models, setModels] = useState<string[] | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault()
      try { const r = await training(`modules/${m.id}/try/${n}`, { method: 'POST', json: { answers: ans } }); setModels(r.models); setMsg(null); reload() } catch (err: any) { setMsg({ ok: false, text: err.message }) }
    }}>
      {ex.items.map((it: any, i: number) => (
        <div key={i}>
          <label className="block text-sm font-medium text-slate-800">{i + 1}. {it.prompt}
            <textarea rows={3} value={ans[i]} onChange={(e) => setAns(ans.map((a, j) => (j === i ? e.target.value : a)))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
          </label>
          {models && models[i] && <p className="mt-1 rounded bg-emerald-50 p-2 text-sm text-emerald-900"><strong>An example answer:</strong> {models[i]}</p>}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3"><Button type="submit">Save and show an example</Button><Note msg={msg} /></div>
    </form>
  )
}

function DecideStep({ m, reload, next }: { m: ModuleView; reload: () => void; next: () => void }) {
  const [choice, setChoice] = useState<number | undefined>(m.decision?.choice)
  const [res, setRes] = useState<any>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!m.scenario) return <p className="text-sm text-slate-500">No scenario for this module.</p>
  return (
    <Card>
      <CardHeader><CardTitle>Decide</CardTitle><p className="text-sm text-slate-700">{m.scenario.prompt}</p></CardHeader>
      <CardContent className="space-y-3">
        <Radios name="scenario" legend="What do you do?" options={m.scenario.choices.map((c) => c.text)} value={choice} onChange={setChoice} disabled={!!res} />
        {!res && <Button disabled={choice === undefined} onClick={async () => {
          try { setRes(await training(`modules/${m.id}/decide`, { method: 'POST', json: { choice } })); reload() } catch (e: any) { setMsg({ ok: false, text: e.message }) }
        }}>See what happens</Button>}
        {res && (
          <div role="status" className="space-y-2 text-sm">
            <p className="rounded-lg bg-slate-50 p-3 text-slate-700"><strong>What happens next:</strong> {res.consequence}</p>
            <p className={`rounded-lg p-3 ${res.best ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}><strong>{res.best ? 'Good judgement. ' : 'Think again. '}</strong>{res.feedback}</p>
            {!res.best && <p className="text-slate-600">The strongest option was: “{m.scenario.choices[res.bestChoices[0]]?.text}”</p>}
            <div className="flex gap-2"><Button variant="outline" onClick={() => { setRes(null) }}>Try another choice</Button><Button onClick={next}>Next: Check</Button></div>
          </div>
        )}
        <Note msg={msg} />
      </CardContent>
    </Card>
  )
}

function CheckStep({ m, reload, next }: { m: ModuleView; reload: () => void; next: () => void }) {
  const [ans, setAns] = useState<Record<string, number>>({})
  const [res, setRes] = useState<any>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Check</CardTitle>
        <p className="text-sm text-slate-500">{m.checkQuestions.length} questions. Get 80% right to complete this step; you can retry as often as you like and every question explains its answer.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {m.checkSkip && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 text-sm text-slate-700">
            Your {m.checkSkip.body} membership means you may skip this check. It is {m.checkSkip.verified ? 'verified' : 'self-declared, not yet verified by the CRAFT team'}.
            <div className="mt-2"><Button variant="outline" onClick={async () => {
              try { await training(`modules/${m.id}/check/skip`, { method: 'POST', json: {} }); reload(); next() } catch (e: any) { setMsg({ ok: false, text: e.message }) }
            }}>Skip this check</Button></div>
          </div>
        )}
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault()
          try { const r = await training(`modules/${m.id}/check`, { method: 'POST', json: { answers: ans } }); setRes(r); setMsg(null); if (r.passed) reload() } catch (err: any) { setMsg({ ok: false, text: err.message }) }
        }}>
          {m.checkQuestions.map((q, i) => {
            const r = res?.results.find((x: any) => x.id === q.id)
            return (
              <div key={q.id} className="rounded-lg border border-slate-100 p-3">
                <Radios name={q.id} legend={`${i + 1}. ${q.prompt}`} options={q.options} value={ans[q.id]} onChange={(v) => setAns({ ...ans, [q.id]: v })} disabled={!!res} />
                {r && <p role="status" className={`mt-2 text-sm ${r.correct ? 'text-emerald-700' : 'text-rose-700'}`}>{r.correct ? 'Correct. ' : `Not quite; the answer is "${q.options[r.correctIndex]}". `}{r.explanation}</p>}
              </div>
            )
          })}
          <div className="flex flex-wrap items-center gap-3">
            {!res ? <Button type="submit" disabled={Object.keys(ans).length < m.checkQuestions.length}>Submit answers</Button>
              : <Button type="button" variant="outline" onClick={() => { setRes(null); setAns({}); reload() }}>Try again with fresh questions</Button>}
            {res && <p role="status" className="text-sm font-medium text-slate-700">{res.score} of {res.total}. {res.passed ? 'Step complete.' : 'Not yet at 80%: review the explanations and try again.'}</p>}
            {res?.passed && <Button type="button" onClick={next}>Next: Reflect</Button>}
            <Note msg={msg} />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function ReflectStep({ m, reload }: { m: ModuleView; reload: () => void }) {
  const [text, setText] = useState(m.reflection)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <Card>
      <CardHeader><CardTitle>Reflect</CardTitle><p className="text-sm text-slate-700">{m.reflectionPrompt}</p></CardHeader>
      <CardContent className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">Your reflection (saved to your learning log, used as evidence at renewal)
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={async () => {
            try { await training(`modules/${m.id}/reflect`, { method: 'POST', json: { text } }); setMsg({ ok: true, text: 'Saved to your learning log' }); reload() } catch (e: any) { setMsg({ ok: false, text: e.message }) }
          }}>Save reflection</Button>
          <Note msg={msg} />
        </div>
      </CardContent>
    </Card>
  )
}
