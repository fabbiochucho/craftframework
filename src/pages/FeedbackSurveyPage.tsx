import { useEffect, useRef, useState } from 'react'
import { Loader2, MailWarning, CheckCircle2 } from 'lucide-react'
import { Button, Card, CardContent } from '../components/ui'
import { EmailSignature } from '../components/EmailSignature'
import { fetchSurvey, submitSurvey, type SurveyState } from '../lib/lifecycleApi'
import { CALL_TIMES_MAX, IMPROVE_MAX, USED_MOST_OPTIONS } from '../lib/survey'
import { cn } from '../lib/utils'

type Draft = { nps: number | null; ease: number | null; usedMost: string[]; improve: string; wantsCall: boolean | null; callTimes: string }
const EMPTY: Draft = { nps: null, ease: null, usedMost: [], improve: '', wantsCall: null, callTimes: '' }
const EASE_LABELS = ['Very difficult', 'Difficult', 'Neither', 'Easy', 'Very easy']

function ScaleButton({ name, value, label, checked, onChange }: { name: string; value: number; label?: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={cn('relative flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center rounded-lg border px-2 py-2 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-1',
      checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-400')}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span>{value}</span>
      {label && <span className="mt-0.5 text-[10px] font-normal leading-tight">{label}</span>}
    </label>
  )
}

// The one-month (and anniversary) feedback survey. No sign-in: the signed link in the email is the credential.
export function FeedbackSurveyPage({ token }: { token: string }) {
  const [survey, setSurvey] = useState<SurveyState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ editableUntil: string; callRequested: boolean } | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let live = true
    fetchSurvey(token).then((s) => {
      if (!live) return
      setSurvey(s)
      if (s.answer) setDraft({ ...s.answer })
    }).catch((e: Error) => live && setLoadError(e.message))
    return () => { live = false }
  }, [token])
  useEffect(() => { if (done) headingRef.current?.focus() }, [done])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const toggle = (option: string) => set('usedMost', draft.usedMost.includes(option) ? draft.usedMost.filter((o) => o !== option) : [...draft.usedMost, option])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (draft.nps === null) return setError('Please choose a number from 0 to 10 for question 1.')
    if (draft.ease === null) return setError('Please choose from 1 to 5 for question 2.')
    if (draft.wantsCall === null) return setError('Please tell us whether you would like a 20-minute call (question 5).')
    setError(null); setSaving(true)
    try {
      const r = await submitSurvey(token, { nps: draft.nps, ease: draft.ease, usedMost: draft.usedMost, improve: draft.improve, wantsCall: draft.wantsCall, callTimes: draft.wantsCall ? draft.callTimes : '' })
      setDone({ editableUntil: r.editableUntil, callRequested: r.callRequested })
    } catch (err) {
      setError((err as Error).message)
    } finally { setSaving(false) }
  }

  const frame = (children: React.ReactNode) => (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">{children}</main>
  )

  if (loadError) return frame(
    <Card><CardContent className="flex gap-3 p-6">
      <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
      <div><h1 className="font-display text-xl font-bold text-emerald-900">This survey link can’t be used</h1><p className="mt-2 text-sm text-slate-600" role="alert">{loadError}</p></div>
    </CardContent></Card>,
  )
  if (!survey) return frame(<p className="flex items-center gap-2 text-sm text-slate-500" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your survey…</p>)

  if (done) return frame(
    <Card><CardContent className="p-6 sm:p-8">
      <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden="true" />
      <h1 ref={headingRef} tabIndex={-1} className="mt-3 font-display text-2xl font-bold text-emerald-900 outline-none">Thank you, {survey.firstName}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">We read every response, and yours will help us make CRAFT better for organisations like yours.</p>
      {done.callRequested && <p className="mt-3 text-sm leading-relaxed text-slate-600">We’ve noted that you’d like a 20-minute call, and we’ll be in touch by email to arrange it.</p>}
      <EmailSignature />
      <p className="mt-6 text-xs text-slate-500">You can change your answers until {new Date(done.editableUntil).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}. <button type="button" className="font-semibold text-emerald-700 underline" onClick={() => setDone(null)}>Change my answers</button></p>
    </CardContent></Card>,
  )

  if (survey.state === 'closed') return frame(
    <Card><CardContent className="p-6 sm:p-8">
      <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden="true" />
      <h1 className="mt-3 font-display text-2xl font-bold text-emerald-900">Thank you, we already have your answers</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">Answers can be changed for 24 hours after they are sent. If there’s something more you’d like to tell us, just reply to our email.</p>
      <EmailSignature />
    </CardContent></Card>,
  )

  const field = 'rounded-xl border border-slate-200 bg-white p-4 sm:p-5'
  const legend = 'text-sm font-semibold text-slate-900'
  return frame(
    <form onSubmit={submit} noValidate aria-labelledby="survey-title">
      <h1 id="survey-title" className="font-display text-2xl font-bold text-emerald-900 sm:text-3xl">How is CRAFT working for {survey.orgName ?? 'your organisation'}?</h1>
      <p className="mt-2 text-sm text-slate-600">Hi {survey.firstName}. This takes about two minutes. Questions 1, 2 and 5 are required.{survey.state === 'editable' && ' You are changing answers you sent earlier.'}</p>

      {error && <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      <div className="mt-6 space-y-4">
        <fieldset className={field}>
          <legend className={legend}>1. How likely are you to recommend CRAFT to a colleague? <span className="text-rose-600" aria-hidden="true">*</span></legend>
          <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-11">
            {Array.from({ length: 11 }, (_, i) => <ScaleButton key={i} name="nps" value={i} checked={draft.nps === i} onChange={() => set('nps', i)} />)}
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500"><span>0 = Not at all likely</span><span>10 = Extremely likely</span></div>
        </fieldset>

        <fieldset className={field}>
          <legend className={legend}>2. How easy has CRAFT been to use so far? <span className="text-rose-600" aria-hidden="true">*</span></legend>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {EASE_LABELS.map((label, i) => <ScaleButton key={label} name="ease" value={i + 1} label={i === 0 || i === 4 ? label : undefined} checked={draft.ease === i + 1} onChange={() => set('ease', i + 1)} />)}
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500"><span>1 = Very difficult</span><span>5 = Very easy</span></div>
        </fieldset>

        <fieldset className={field}>
          <legend className={legend}>3. What have you used most? <span className="font-normal text-slate-500">(choose any)</span></legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {USED_MOST_OPTIONS.map((o) => (
              <label key={o} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus-within:ring-2 focus-within:ring-emerald-500 hover:border-emerald-300">
                <input type="checkbox" checked={draft.usedMost.includes(o)} onChange={() => toggle(o)} className="h-4 w-4 accent-emerald-600" /> {o}
              </label>
            ))}
          </div>
        </fieldset>

        <div className={field}>
          <label htmlFor="improve" className={legend}>4. What’s one thing we should improve? <span className="font-normal text-slate-500">(optional)</span></label>
          <textarea id="improve" value={draft.improve} onChange={(e) => set('improve', e.target.value.slice(0, IMPROVE_MAX))} maxLength={IMPROVE_MAX} rows={4} aria-describedby="improve-count"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          <p id="improve-count" className="mt-1 text-right text-xs text-slate-500">{draft.improve.length} / {IMPROVE_MAX}</p>
        </div>

        <fieldset className={field}>
          <legend className={legend}>5. Would you like a 20-minute call with us? <span className="text-rose-600" aria-hidden="true">*</span></legend>
          <div className="mt-3 flex gap-3">
            {([['Yes', true], ['No', false]] as const).map(([label, value]) => (
              <label key={label} className={cn('flex min-h-11 min-w-20 cursor-pointer items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold focus-within:ring-2 focus-within:ring-emerald-500',
                draft.wantsCall === value ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-400')}>
                <input type="radio" name="call" checked={draft.wantsCall === value} onChange={() => set('wantsCall', value)} className="sr-only" /> {label}
              </label>
            ))}
          </div>
          {draft.wantsCall && (
            <div className="mt-4">
              <label htmlFor="times" className="text-sm font-medium text-slate-700">Preferred times <span className="font-normal text-slate-500">(optional)</span></label>
              <input id="times" value={draft.callTimes} onChange={(e) => set('callTimes', e.target.value.slice(0, CALL_TIMES_MAX))} maxLength={CALL_TIMES_MAX} placeholder="For example: weekday mornings, West Africa time"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
          )}
        </fieldset>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={saving} className="min-h-11">{saving ? 'Sending…' : survey.state === 'editable' ? 'Update my answers' : 'Send my answers'}</Button>
        <p className="text-xs text-slate-500">Only the CRAFT team sees your answers.</p>
      </div>
    </form>,
  )
}
