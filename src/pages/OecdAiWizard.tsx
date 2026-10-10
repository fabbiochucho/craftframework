import { useMemo, useState } from 'react'
import { useLegacyAssessment } from '../lib/legacy-assessment'
import { LegacySaveStatus } from '../lib/legacy-state'
import {
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Info,
  Sparkles,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { AI_DIMENSIONS, EIA_CHECKLIST, getFramework } from '../lib/frameworks'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Select,
  ProgressBar,
  Stat,
} from '../components/ui'

type Classification = 'low' | 'medium' | 'high'

const CLASS_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const CLASS_META: Record<Classification, { label: string; badge: string; dot: string }> = {
  low: { label: 'Low', badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  medium: { label: 'Medium', badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', dot: 'bg-amber-500' },
  high: { label: 'High', badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200', dot: 'bg-rose-500' },
}

/** Stable composite key for a dimension facet. */
function facetKey(dimKey: string, facet: string): string {
  return `${dimKey}::${facet}`
}

export function OecdAiWizard() {
  const framework = getFramework('oecd-ai')
  const authority = framework?.authority ?? 'OECD / UNESCO · AI Principles'

  const [step, setStep] = useState(0)
  const lastStep = AI_DIMENSIONS.length - 1
  const dim = AI_DIMENSIONS[step]

  // Wizard answers keyed by facetKey -> classification
  const [answers, setAnswers, saveStatus] = useLegacyAssessment<Record<string, Classification>>('oecd:answers', {})

  // EIA checklist state keyed by check.key -> boolean
  const [checks, setChecks, checkStatus] = useLegacyAssessment<Record<string, boolean>>('oecd:checks', {})

  const setAnswer = (key: string, value: Classification) =>
    setAnswers(prev => ({ ...prev, [key]: value }))

  const toggleCheck = (key: string) =>
    setChecks(prev => ({ ...prev, [key]: !prev[key] }))

  const totalFacets = useMemo(
    () => AI_DIMENSIONS.reduce((acc, d) => acc + d.facets.length, 0),
    [],
  )
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers])

  // Highest-risk classification seen across all answers (for the summary tone).
  const riskTone = useMemo<Classification>(() => {
    const vals = Object.values(answers)
    if (vals.includes('high')) return 'high'
    if (vals.includes('medium')) return 'medium'
    return 'low'
  }, [answers])

  const checkedCount = useMemo(
    () => EIA_CHECKLIST.filter(c => checks[c.key]).length,
    [checks],
  )
  const readinessPct = Math.round((checkedCount / EIA_CHECKLIST.length) * 100)
  const allChecked = checkedCount === EIA_CHECKLIST.length

  return (
    <div className="space-y-6">
      <LegacySaveStatus status={saveStatus} />
      <LegacySaveStatus status={checkStatus} />
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <Badge className="bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">AI Ethics Gate</Badge>
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            OECD / UNESCO AI Classification &amp; Ethical Impact
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Step-by-step classification of the AI system across five OECD dimensions, gated by the
            UNESCO Ethical Impact Assessment before deployment can be approved.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Authority</p>
          <p className="font-mono text-sm text-indigo-700">{authority}</p>
        </div>
      </div>

      {/* Stepper */}
      <Card className="border-indigo-100">
        <CardContent className="pt-6">
          <IndigoStepper steps={AI_DIMENSIONS.map(d => d.label)} current={step} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Wizard body */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-indigo-600" />
                    <span className="font-display">{dim.label}</span>
                  </span>
                </CardTitle>
                <Badge variant="outline" className="font-mono text-xs">
                  Dimension {step + 1} / {AI_DIMENSIONS.length}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-slate-600">{dim.blurb}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {dim.facets.map(facet => {
                const key = facetKey(dim.key, facet)
                const current = answers[key]
                return (
                  <div
                    key={key}
                    className={cn(
                      'rounded-xl border p-4 transition-colors',
                      current
                        ? 'border-indigo-200 bg-indigo-50/40'
                        : 'border-slate-200 bg-white',
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{facet}</p>
                        <p className="text-xs text-slate-500">
                          Classify the level of risk / impact for this facet.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {current && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                              CLASS_META[current].badge,
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', CLASS_META[current].dot)} />
                            {CLASS_META[current].label}
                          </span>
                        )}
                        <Select
                          options={CLASS_OPTIONS}
                          value={current ?? ''}
                          placeholder="Select…"
                          onChange={val => setAnswer(key, val as Classification)}
                          className="w-36"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Nav */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(s => Math.max(0, s - 1))}
                  disabled={step === 0}
                >
                  <span className="flex items-center gap-1.5">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </span>
                </Button>
                <p className="text-xs text-slate-500">
                  {answeredCount} of {totalFacets} facets classified
                </p>
                <Button
                  onClick={() => setStep(s => Math.min(lastStep, s + 1))}
                  disabled={step === lastStep}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <span className="flex items-center gap-1.5">
                    Next <ChevronRight className="h-4 w-4" />
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* UNESCO EIA Scorecard */}
          <Card className="border-indigo-100">
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-600" />
                  <span className="font-display">UNESCO Ethical Impact Assessment</span>
                </span>
              </CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                Every item must be satisfied before AI deployment can be approved.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {EIA_CHECKLIST.map(c => {
                  const on = !!checks[c.key]
                  return (
                    <button
                      type="button"
                      key={c.key}
                      onClick={() => toggleCheck(c.key)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                        on
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                          on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white',
                        )}
                      >
                        {on && <CheckCircle2 className="h-4 w-4" />}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{c.label}</span>
                        <span className="block text-xs text-slate-500">{c.hint}</span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wide text-slate-500">
                    EIA Readiness
                  </span>
                  <span className="font-mono text-indigo-700">
                    {checkedCount}/{EIA_CHECKLIST.length} · {readinessPct}%
                  </span>
                </div>
                <ProgressBar value={readinessPct} className="[&>div]:bg-indigo-500" />
              </div>

              {!allChecked && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Deployment is blocked. Complete all {EIA_CHECKLIST.length} ethical-impact
                    safeguards before approval.
                  </span>
                </div>
              )}

              <Button
                disabled={!allChecked}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Approve AI Deployment
                </span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-6">
          <Stat
            label="Facets Classified"
            value={`${answeredCount} / ${totalFacets}`}
            hint="Across all five OECD dimensions"
            accent={answeredCount === totalFacets ? 'emerald' : 'slate'}
          />
          <Stat
            label="Highest Risk Level"
            value={CLASS_META[riskTone].label}
            hint={answeredCount === 0 ? 'No facets classified yet' : 'Drives the EIA scrutiny depth'}
            accent={riskTone === 'high' ? 'rose' : riskTone === 'medium' ? 'amber' : 'emerald'}
          />

          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  <span className="font-display">Classification Summary</span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {AI_DIMENSIONS.map(d => {
                const facetsDone = d.facets.filter(f => answers[facetKey(d.key, f)]).length
                return (
                  <div key={d.key} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">{d.label}</span>
                      <span className="font-mono text-xs text-slate-400">
                        {facetsDone}/{d.facets.length}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {d.facets.map(f => {
                        const c = answers[facetKey(d.key, f)]
                        return (
                          <div key={f} className="flex items-center justify-between text-xs">
                            <span className="truncate pr-2 text-slate-500">{f}</span>
                            {c ? (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                                  CLASS_META[c].badge,
                                )}
                              >
                                <span className={cn('h-1.5 w-1.5 rounded-full', CLASS_META[c].dot)} />
                                {CLASS_META[c].label}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs text-indigo-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Classification is advisory: it scopes the depth of the UNESCO EIA. Approval still
              requires every ethical safeguard to be satisfied.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Indigo-themed stepper variant (the shared Stepper is emerald-keyed). */
function IndigoStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  done && 'bg-indigo-500 text-white',
                  active && 'bg-indigo-600 text-white ring-4 ring-indigo-100',
                  !done && !active && 'bg-slate-200 text-slate-500',
                )}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className={cn(
                  'hidden text-sm font-medium sm:block',
                  active ? 'text-slate-900' : 'text-slate-500',
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('mx-3 h-0.5 flex-1 rounded', done ? 'bg-indigo-400' : 'bg-slate-200')} />
            )}
          </div>
        )
      })}
    </div>
  )
}
