import { useEffect, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle } from './ui'
import { api } from '../lib/trainingClient'

// Pre- and post-tests for a module's explainer video (/api/training-baseline): three questions before the video,
// the same three plus two after. Scored on the server. Practice only: never counted towards accreditation.

type Kind = 'pre' | 'post'
type Result = { score: number; total: number }
type Question = { id: string; prompt: string; options: string[] }
type Scored = Result & { results: Array<{ id: string; chosen: number; correct: number; ok: boolean; explanation: string }> }

export function BaselineTests({ moduleId }: { moduleId: string }) {
  const [mine, setMine] = useState<{ pre?: Result; post?: Result } | null>(null)
  const [open, setOpen] = useState<Kind | null>(null)
  const [error, setError] = useState('')
  const load = () => api<{ modules: Record<string, { pre?: Result; post?: Result }> }>('/api/training-baseline')
    .then((r) => setMine(r.modules[moduleId] ?? {}), (e) => setError(e.message))
  useEffect(() => { setMine(null); setOpen(null); void load() }, [moduleId])
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!mine) return null
  const pct = (r: Result) => Math.round((r.score / r.total) * 100)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pre-test and post-test</CardTitle>
        <p className="text-sm text-slate-600">Answer the pre-test before you watch the explainer video, and the post-test after it, to see what you have learned. Practice only: it does not count towards accreditation.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-md bg-slate-100 px-3 py-1">Pre-test: {mine.pre ? `${mine.pre.score}/${mine.pre.total} (${pct(mine.pre)}%)` : 'not taken'}</span>
          <span className="rounded-md bg-slate-100 px-3 py-1">Post-test: {mine.post ? `${mine.post.score}/${mine.post.total} (${pct(mine.post)}%)` : 'not taken'}</span>
          {mine.pre && mine.post && (
            <span className="rounded-md bg-emerald-50 px-3 py-1 text-emerald-800">Change: {pct(mine.post) - pct(mine.pre) >= 0 ? '+' : ''}{pct(mine.post) - pct(mine.pre)} points</span>
          )}
        </div>
        {!open && (
          <div className="flex flex-wrap gap-2">
            {!mine.pre && <Button onClick={() => setOpen('pre')}>Take the pre-test (3 questions)</Button>}
            {mine.pre && <Button variant={mine.post ? 'outline' : 'primary'} onClick={() => setOpen('post')}>{mine.post ? 'Retake the post-test' : 'Take the post-test (5 questions)'}</Button>}
          </div>
        )}
        {open && <Attempt moduleId={moduleId} kind={open} onDone={() => void load()} onClose={() => setOpen(null)} />}
      </CardContent>
    </Card>
  )
}

function Attempt({ moduleId, kind, onDone, onClose }: { moduleId: string; kind: Kind; onDone: () => void; onClose: () => void }) {
  const [qs, setQs] = useState<Question[] | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [scored, setScored] = useState<Scored | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { api<{ questions: Question[] }>(`/api/training-baseline/questions/${moduleId}/${kind}`).then((r) => setQs(r.questions), (e) => setError(e.message)) }, [moduleId, kind])
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!qs) return <p className="text-sm text-slate-500">Loading…</p>
  const complete = qs.every((_, i) => answers[i] !== undefined)
  async function submit() {
    setBusy(true)
    try {
      setScored(await api<Scored>('/api/training-baseline', { method: 'POST', json: { moduleId, kind, answers: qs!.map((_, i) => answers[i]) } }))
      onDone()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      {qs.map((q, i) => {
        const r = scored?.results[i]
        return (
          <fieldset key={q.id} className="space-y-1" disabled={!!scored}>
            <legend className="text-sm font-medium text-slate-800">{i + 1}. {q.prompt}</legend>
            {q.options.map((o, j) => (
              <label key={j} className={`flex items-start gap-2 rounded-md px-2 py-1 text-sm ${r && j === r.correct ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700'}`}>
                <input type="radio" name={`${kind}-${q.id}`} checked={answers[i] === j} onChange={() => setAnswers({ ...answers, [i]: j })} className="mt-1 h-4 w-4 accent-emerald-600" />
                <span>{o}{r && j === r.correct ? ' (correct answer)' : ''}</span>
              </label>
            ))}
            {r && <p className={`text-sm ${r.ok ? 'text-emerald-700' : 'text-amber-800'}`}>{r.ok ? 'Correct. ' : 'Not quite. '}{r.explanation}</p>}
          </fieldset>
        )
      })}
      {!scored && <Button onClick={submit} disabled={!complete || busy}>Submit {kind === 'pre' ? 'pre-test' : 'post-test'}</Button>}
      {scored && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm font-medium text-slate-800">You scored {scored.score} out of {scored.total}.</p>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      )}
    </div>
  )
}
