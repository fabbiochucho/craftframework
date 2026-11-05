// The quick pre-award screen: a short self-reported questionnaire per award, scored into one of four outcomes.
// Scoring rules: src/lib/cca/quickScreen.ts; the questions are private content served by /api/cca-screen/content.
import { useCallback, useEffect, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Select } from './ui'
import { cn } from '../lib/utils'
import { OUTCOME_LABEL, OUTCOME_NEXT, scoreScreen, type Outcome, type QuickScreen, type ScreenAnswers } from '../lib/cca/quickScreen'

type Row = { id: string; awardRef: string; status: 'draft' | 'complete'; answers: ScreenAnswers; notes: string; score: number | null; maxScore: number | null; outcome: Outcome | null }

const OUTCOME_STYLE: Record<Outcome, string> = {
  minimal_support: 'bg-emerald-100 text-emerald-800', substantial_support: 'bg-sky-100 text-sky-800', high_risk: 'bg-amber-100 text-amber-800', not_eligible: 'bg-rose-100 text-rose-800',
}

async function api<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/cca-screen${path}`, init && { method: init.method, headers: { 'content-type': 'application/json' }, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const body = await res.json().catch(() => ({})) as T & { error?: string }
  if (!res.ok) throw new Error(body.error === 'mfa_required' ? 'Confirm your two-step sign-in, then try again.' : body.error ?? `Request failed (${res.status})`)
  return body
}

export function QuickScreenCard({ orgId, awards }: { orgId: string; awards: { id: string; title: string }[] }) {
  const [screen, setScreen] = useState<QuickScreen | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [award, setAward] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!orgId) return
    try { setRows((await api<{ screens: Row[] }>(`?orgId=${encodeURIComponent(orgId)}`)).screens) } catch (e) { setMsg((e as Error).message) }
  }, [orgId])
  useEffect(() => { api<{ screen: QuickScreen }>('/content').then((b) => setScreen(b.screen)).catch(() => setScreen(null)) }, [])
  useEffect(() => { void load() }, [load])
  const title = (ref: string) => awards.find((a) => a.id === ref)?.title ?? ref

  const start = async () => {
    try { const { id } = await api<{ id: string }>('', { method: 'POST', body: { orgId, awardRef: award } }); await load(); setOpenId(id); setMsg(null) } catch (e) { setMsg((e as Error).message) }
  }

  if (!screen) return null
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Quick pre-award screen</CardTitle>
        <p className="text-sm text-slate-500">A short check of policies, finances, controls, audit, assets and technical capacity, answered by the applicant. It sorts the applicant into one of four outcomes; a borderline result calls for the full Pre-Award assessment (start it above), which needs evidence.</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-72"><Select label="Grant or contract" placeholder="Choose an award" value={award} onChange={setAward} options={awards.map((a) => ({ value: a.id, label: a.title }))} /></div>
          <Button size="sm" disabled={!award} onClick={() => void start()}>Start quick screen</Button>
        </div>
        {msg && <p role="status" className="text-slate-700">{msg}</p>}
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const live = scoreScreen(screen, r.answers)
            const outcome = r.outcome ?? live.outcome
            const pct = r.status === 'complete' && r.maxScore ? Math.round(((r.score ?? 0) / r.maxScore) * 100) : live.percent
            return (
              <li key={r.id} className="py-2">
                <button type="button" className="flex w-full items-center justify-between text-left hover:text-emerald-700" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                  <span>{title(r.awardRef)} · {r.status === 'complete' ? 'Complete' : `Draft (${live.unanswered} unanswered)`}</span>
                  <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', OUTCOME_STYLE[outcome])}>{pct}% · {OUTCOME_LABEL[outcome]}</span>
                </button>
                {openId === r.id && <ScreenForm key={r.id} screen={screen} row={r} onChanged={load} />}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function ScreenForm({ screen, row, onChanged }: { screen: QuickScreen; row: Row; onChanged: () => Promise<void> }) {
  const [answers, setAnswers] = useState<ScreenAnswers>(row.answers)
  const [notes, setNotes] = useState(row.notes)
  const [msg, setMsg] = useState<string | null>(null)
  const locked = row.status === 'complete'
  const r = scoreScreen(screen, answers)
  const save = async () => { await api(`/${row.id}`, { method: 'PUT', body: { answers, notes } }); await onChanged() }
  const act = async (complete: boolean) => {
    try {
      await save()
      if (complete) await api(`/${row.id}/complete`, { method: 'POST' })
      setMsg(complete ? 'Screen completed.' : 'Saved.'); await onChanged()
    } catch (e) { setMsg((e as Error).message) }
  }

  return (
    <div className="mt-3 space-y-4">
      <div className={cn('rounded-lg p-3', OUTCOME_STYLE[r.outcome])}>
        <p className="font-semibold">{r.percent}% ({r.score} of {r.max}) · {OUTCOME_LABEL[r.outcome]}</p>
        <p className="mt-1">{OUTCOME_NEXT[r.outcome]}</p>
      </div>
      {screen.sections.map((sec) => {
        const s = r.sections.find((x) => x.id === sec.id)!
        return (
          <fieldset key={sec.id} className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 font-medium text-slate-900">{sec.name} <span className="text-xs font-normal text-slate-500">{s.score} of {s.max}</span></legend>
            {sec.questions.map((q) => (
              <div key={q.id} className="grid gap-2 py-1 sm:grid-cols-[1fr_14rem] sm:items-center">
                <span className="text-slate-800">{q.text}</span>
                {q.kind === 'yes_no' ? (
                  <div className="flex gap-4" role="radiogroup" aria-label={q.text}>
                    {(['yes', 'no'] as const).map((v) => (
                      <label key={v} className="flex items-center gap-1 capitalize">
                        <input type="radio" name={`${row.id}-${q.id}`} checked={answers[q.id] === v} disabled={locked} onChange={() => setAnswers({ ...answers, [q.id]: v })} />{v}
                      </label>
                    ))}
                  </div>
                ) : (
                  <select aria-label={q.text} value={answers[q.id] ?? ''} disabled={locked} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                    <option value="">Choose</option>
                    {q.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </div>
            ))}
          </fieldset>
        )
      })}
      <label className="block font-medium text-slate-700">Notes (who answered, what was checked)
        <textarea rows={3} disabled={locked} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {msg && <p role="status">{msg}</p>}
      {!locked && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void act(false)}>Save</Button><Button size="sm" disabled={r.unanswered > 0} onClick={() => void act(true)}>Complete screen</Button></div>}
    </div>
  )
}
