import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Award, CheckCircle2, Circle, Flame, GraduationCap, Sparkles } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ProgressBar } from '../components/ui'
import { training } from '../lib/trainingClient'
import { STEPS } from '../lib/validatorTraining'

// Validator system PR 4: the learner's home for the training programme. Module map,
// progress, XP, streak, calibration dial, badges and the learning log. Everything is
// computed by /api/training; accreditation can only be earned by passing the assessment.

export type TrainingMe = {
  email: string; isMarker: boolean; isProgrammeTeam: boolean; isAdmin: boolean
  profile: null | { id: string; name: string; accreditation: string; accreditedUntil: string | null }
  modules: Array<{ id: string; position: number; title: string; outcome: string; hasVideo: boolean; steps: string[]; complete: boolean }>
  progress: { xp: number; streak: number; modulesDone: number; modulesTotal: number; pct: number; calibration: null | { pct: number; within: number; total: number } }
  badges: Array<{ key: string; name: string; criteria: string }>
  assessment: { examPassed: boolean; examAllowed: boolean; examReason: string | null; examNextAt: string | null; attemptsThisYear: number; examInProgress: string | null; casesPassed: number; casesTotal: number; capstonePassed: boolean; trainingComplete: boolean }
  renewal: null | { until: string; open: boolean; opensAt: string; ready: boolean }
  learningLog: Array<{ moduleId: string; text: string; at: string }>
  specialist?: Array<{ specialism: string; label: string; moduleId: string; moduleTitle: string | null; moduleComplete: boolean; current: boolean }>
}

const STEP_LABEL: Record<string, string> = { watch: 'Watch', try: 'Try', decide: 'Decide', check: 'Check', reflect: 'Reflect' }
const STATE_STYLE: Record<string, string> = { accredited: 'bg-emerald-100 text-emerald-800', lapsed: 'bg-amber-100 text-amber-800', registered: 'bg-slate-100 text-slate-700', suspended: 'bg-rose-100 text-rose-800' }
const STATE_LABEL: Record<string, string> = { accredited: 'CRAFT-accredited', lapsed: 'Accreditation lapsed', registered: 'Not yet accredited', suspended: 'Suspended' }

export function CalibrationDial({ pct }: { pct: number }) {
  const r = 28
  const c = 2 * Math.PI * r
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={`Calibration score ${pct}%`}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={pct >= 90 ? '#059669' : pct >= 80 ? '#10b981' : '#f59e0b'} strokeWidth="8" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 36 36)" strokeLinecap="round" />
      <text x="36" y="41" textAnchor="middle" className="fill-slate-800 text-[15px] font-semibold">{pct}%</text>
    </svg>
  )
}

export function TrainingPage() {
  const [me, setMe] = useState<TrainingMe | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { training<TrainingMe>('me').then(setMe, (e) => setError(e.message)) }, [])
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!me) return <p className="text-sm text-slate-500">Loading…</p>
  const state = me.profile?.accreditation ?? 'registered'
  const next = me.modules.find((m) => !m.complete)
  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><GraduationCap className="h-4 w-4 text-emerald-600" /> Independent validation</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Validator training and accreditation</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Eight short modules, then a knowledge exam, four written cases and the Riverbend capstone. Passing all three assessment parts is the only way to become CRAFT-accredited. Accreditation lasts a year and is renewed by re-completing the current training. There are no time limits except in the exam, and every video has a transcript.</p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {me.isMarker && <Link to="/training/manage" className="text-emerald-700 underline">Marking queue{me.isProgrammeTeam ? ' and content' : ''}</Link>}
        </div>
      </div>

      {!me.profile && (
        <Card className="border-amber-200 bg-amber-50/50"><CardContent className="pt-6 text-sm text-slate-700">
          You can study now. To sit the assessment, first <Link to="/directory" className="text-emerald-700 underline">create your validator profile</Link>.
        </CardContent></Card>
      )}

      <section aria-labelledby="progress-h" className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle><span id="progress-h">Your progress</span></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ProgressBar value={me.progress.pct} />
            <p className="text-sm text-slate-600">{me.progress.modulesDone} of {me.progress.modulesTotal} modules complete ({me.progress.pct}% of steps).</p>
            <div className="flex flex-wrap items-center gap-6">
              <p className="flex items-center gap-1.5 text-sm"><Sparkles className="h-4 w-4 text-amber-500" /> <strong>{me.progress.xp}</strong> XP</p>
              <p className="flex items-center gap-1.5 text-sm"><Flame className="h-4 w-4 text-rose-500" /> <strong>{me.progress.streak}</strong> day streak <span className="text-xs text-slate-500">(a nudge, never a requirement)</span></p>
              {me.progress.calibration && (
                <div className="flex items-center gap-2 text-sm"><CalibrationDial pct={me.progress.calibration.pct} /> <span>Calibration: {me.progress.calibration.within} of {me.progress.calibration.total} within 1 point</span></div>
              )}
            </div>
            {next && <Link to="/training/module/$moduleId" params={{ moduleId: next.id }} className="inline-block"><Button>{me.progress.modulesDone ? 'Continue' : 'Start'}: Module {next.position}</Button></Link>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Accreditation</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Badge className={STATE_STYLE[state]}>{STATE_LABEL[state]}</Badge>
            {me.profile?.accreditedUntil && <p className="text-slate-600">{state === 'lapsed' ? 'Lapsed on' : 'Valid until'} {new Date(me.profile.accreditedUntil).toLocaleDateString()}</p>}
            <p className="text-slate-600">Exam {me.assessment.examPassed ? 'passed' : 'not passed'} · Cases {me.assessment.casesPassed}/{me.assessment.casesTotal} · Capstone {me.assessment.capstonePassed ? 'passed' : 'not passed'}</p>
            <Link to="/training/assessment" className="text-emerald-700 underline">{me.profile?.accreditedUntil ? 'Renewal and assessment' : 'Assessment'}</Link>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="map-h">
        <h2 id="map-h" className="mb-3 text-lg font-semibold text-slate-800">Module map</h2>
        <ol className="grid gap-3 md:grid-cols-2">
          {me.modules.map((m) => (
            <li key={m.id}>
              <Link to="/training/module/$moduleId" params={{ moduleId: m.id }} className="block h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <p className="flex items-start gap-2 font-semibold text-slate-800">
                  {m.complete ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-label="Complete" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" aria-hidden />}
                  <span>Module {m.position}. {m.title}</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">{m.outcome}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5 text-xs" aria-label="Steps">
                  {STEPS.map((s) => (
                    <li key={s} className={`rounded-full px-2 py-0.5 ${m.steps.includes(s) ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{STEP_LABEL[s]}{m.steps.includes(s) ? ' ✓' : ''}</li>
                  ))}
                  {m.hasVideo && <li className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">Video</li>}
                </ul>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="badges-h">
        <h2 id="badges-h" className="mb-3 flex items-center gap-1.5 text-lg font-semibold text-slate-800"><Award className="h-5 w-5 text-indigo-600" /> Badges</h2>
        <p className="mb-2 text-sm text-slate-500">Badges reward learning and accuracy, never the number of validations, the rungs awarded, speed or fees. They show on your directory profile.</p>
        {me.badges.length ? (
          <ul className="flex flex-wrap gap-2">{me.badges.map((b) => <li key={b.key} title={b.criteria}><Badge className="bg-indigo-100 text-indigo-800">{b.name}</Badge></li>)}</ul>
        ) : <p className="text-sm text-slate-500">None yet. Ladder Climber, Evidence Hawk, Clear Conscience, Calibrated and Riverbend Solved are earned through the modules, the calibration drill and the capstone.</p>}
      </section>

      {(me.specialist ?? []).some((s) => s.moduleTitle) && (
        <Card>
          <CardHeader><CardTitle>Specialist modules</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-slate-600">Optional. Each leads to a specialist assessment, needed to validate the Fiduciary Controls or Safeguards index.</p>
            {(me.specialist ?? []).filter((s) => s.moduleTitle).map((s) => (
              <p key={s.moduleId}><Link to="/training/module/$moduleId" params={{ moduleId: s.moduleId }} className="font-medium text-emerald-700 hover:underline">{s.moduleTitle}</Link>{s.moduleComplete ? ' · complete' : ''}{s.current ? ' · specialism held' : ''}</p>
            ))}
            <Link to="/training/assessment" className="text-emerald-700 hover:underline">Specialist assessments →</Link>
          </CardContent>
        </Card>
      )}
      {me.learningLog.length > 0 && (
        <section aria-labelledby="log-h">
          <h2 id="log-h" className="mb-3 text-lg font-semibold text-slate-800">Learning log</h2>
          <p className="mb-2 text-sm text-slate-500">Your reflections are kept as evidence of continuing development at renewal.</p>
          <ul className="space-y-2">
            {me.learningLog.map((l) => (
              <li key={l.moduleId} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <p className="text-xs text-slate-500">Module {l.moduleId.replace('m', '')} · {new Date(l.at).toLocaleDateString()}</p>
                <p className="mt-1 whitespace-pre-line text-slate-700">{l.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
