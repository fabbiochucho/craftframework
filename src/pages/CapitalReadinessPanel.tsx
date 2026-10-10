import { useMemo } from 'react'
import { useLegacyAssessment } from '../lib/legacy-assessment'
import { LegacySaveStatus } from '../lib/legacy-state'
import {
  Mountain, CheckCircle2, Lock, FileText, AlertTriangle, TrendingUp, ArrowUpRight,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { FIDUCIARY_LEVELS } from '../lib/frameworks'
import {
  LADDER_LEVELS, indicatorsForLevel,
  levelScore, levelAchieved, currentRung, nextRung, blockingIndicators,
  compositeLadderScore, totalAnswered, LADDER_INDICATORS,
} from '../lib/capitalReadiness'
import {
  Card, CardHeader, CardTitle, CardContent, Badge, ProgressBar, Accordion, Stat, Reveal,
} from '../components/ui'

export function CapitalReadinessPanel() {
  const [scores, setScores, saveStatus] = useLegacyAssessment<Record<string, number>>('capital:scores', {})

  const select = (qId: string, value: number) =>
    setScores(prev => ({ ...prev, [qId]: value }))

  const total = LADDER_INDICATORS.length
  const answered = totalAnswered(scores)
  const completionPct = total === 0 ? 0 : Math.round((answered / total) * 100)

  const rung = useMemo(() => currentRung(scores), [scores])
  const rungMeta = LADDER_LEVELS.find(l => l.level === rung)
  const next = useMemo(() => nextRung(scores), [scores])
  const blockers = useMemo(() => blockingIndicators(scores), [scores])
  const composite = useMemo(() => compositeLadderScore(scores), [scores])

  const compositeAccent: 'rose' | 'amber' | 'emerald' | 'slate' =
    answered === 0 ? 'slate' : composite < 2 ? 'rose' : composite < 3.5 ? 'amber' : 'emerald'

  return (
    <div className="space-y-6">
      <LegacySaveStatus status={saveStatus} />
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
          <Mountain className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">CRAFT Capital Readiness Ladder</h1>
          <p className="text-sm text-slate-500">Is this institution strong, credible, resilient and investable enough to attract and sustain capital?</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Rung</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">
            {rung === 0 ? '—' : `${rung} / 7`}
          </p>
          <p className="mt-1 text-xs text-slate-400">{rungMeta ? rungMeta.name : 'Not yet at Level 1'}</p>
        </Card>
        <Stat
          label="Composite Score"
          value={`${composite.toFixed(2)} / 5`}
          hint="Mean across all answered indicators"
          accent={compositeAccent}
        />
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completion</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{completionPct}%</p>
          <ProgressBar value={completionPct} className="mt-3" />
        </Card>
      </div>

      {/* The ladder itself */}
      <Card>
        <CardHeader>
          <CardTitle>The Ladder</CardTitle>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            Sequential - a rung only counts as achieved once every rung below it is also achieved
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...LADDER_LEVELS].reverse().map(lvl => {
              const achieved = levelAchieved(lvl.level, scores)
              const isCurrentTarget = next?.level === lvl.level
              const score = levelScore(lvl.level, scores)
              return (
                <div
                  key={lvl.key}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-4 py-3',
                    achieved
                      ? 'border-emerald-200 bg-emerald-50'
                      : isCurrentTarget
                        ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-300'
                        : 'border-slate-200 bg-white',
                  )}
                >
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    achieved ? 'bg-emerald-600 text-white' : isCurrentTarget ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500',
                  )}>
                    {achieved ? <CheckCircle2 className="h-4 w-4" /> : lvl.level}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {lvl.level}. {lvl.name}
                      {isCurrentTarget && <span className="ml-2 text-xs font-medium text-amber-700">Next rung to climb</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{lvl.question}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-mono text-sm font-semibold text-slate-700">{score.toFixed(1)}</span>
                    <span className="text-xs text-slate-400"> / 5</span>
                  </div>
                  {!achieved && !isCurrentTarget && <Lock className="h-4 w-4 shrink-0 text-slate-300" />}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* What's blocking the next rung */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-display text-xl font-bold text-slate-900">
            <ArrowUpRight className="h-4 w-4 text-amber-600" />
            {next ? `What's Blocking "${next.name}"` : 'Top Rung Reached'}
          </h2>
          {blockers.length > 0 && <Badge className="bg-amber-100 text-amber-700 border border-amber-200">{blockers.length} item(s)</Badge>}
        </div>
        {!next ? (
          <Card className="p-6 text-sm text-slate-600">
            Every rung has been achieved. See the ESG Self-Assessment&apos;s rating-agency translation for how to carry this
            readiness into an actual DFI, credit or capital-markets conversation.
          </Card>
        ) : blockers.length === 0 ? (
          <Card className="p-6 text-sm text-slate-500">
            Answer the indicators under &quot;{next.name}&quot; below to see exactly what&apos;s blocking this rung.
          </Card>
        ) : (
          <div className="space-y-3">
            {blockers.map(ind => {
              const score = scores[ind.id]
              return (
                <Card key={ind.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{ind.domain}</p>
                    <Badge className={cn('shrink-0', score == null ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700')}>
                      {score == null ? 'Not answered' : `${score}/5`}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span>{ind.recommendation}</span>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Scored indicators, grouped by level */}
      <div className="space-y-8">
        {LADDER_LEVELS.map(lvl => {
          const inds = indicatorsForLevel(lvl.level)
          const achieved = levelAchieved(lvl.level, scores)
          return (
            <div key={lvl.key}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold text-slate-900">{lvl.level}. {lvl.name}</h2>
                {achieved && <Badge className="bg-emerald-100 text-emerald-700">Achieved</Badge>}
                <span className="text-xs text-slate-500">{lvl.question}</span>
              </div>
              <div className="space-y-4">
                {inds.map((ind, i) => {
                  const selected = scores[ind.id]
                  return (
                    <Reveal key={ind.id} delay={i * 40}>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ind.domain}</p>
                            <span className="font-mono text-xs text-slate-400">{ind.id}</span>
                          </div>
                          <p className="mt-2 text-base font-medium leading-snug text-slate-900">{ind.question}</p>

                          <div className="mt-4 grid grid-cols-3 gap-2 lg:grid-cols-6">
                            {FIDUCIARY_LEVELS.map(lvl2 => {
                              const active = selected === lvl2.value
                              return (
                                <button
                                  key={lvl2.value}
                                  type="button"
                                  onClick={() => select(ind.id, lvl2.value)}
                                  aria-pressed={active}
                                  className={cn(
                                    'flex items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
                                    active
                                      ? cn(lvl2.badge, 'ring-2 ring-slate-500 ring-offset-1 shadow-sm')
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                                  )}
                                >
                                  {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                                  <span className="font-mono">{lvl2.value}</span>
                                </button>
                              )
                            })}
                          </div>

                          {selected != null && (
                            <p className="mt-3 text-xs text-slate-500">
                              Selected: <span className="font-semibold text-slate-700">{FIDUCIARY_LEVELS.find(l => l.value === selected)?.label}</span>
                              {' - '}{ind.soe[selected]}
                            </p>
                          )}

                          <div className="mt-4">
                            <Accordion title="View Statements of Excellence, recommendation & why this rung matters">
                              <ul className="space-y-2">
                                {FIDUCIARY_LEVELS.map(lvl3 => {
                                  const active = selected === lvl3.value
                                  return (
                                    <li key={lvl3.value} className={cn('rounded-lg border p-3 transition-colors', active ? 'border-slate-300 bg-slate-50 ring-1 ring-slate-400' : 'border-slate-200 bg-white')}>
                                      <div className="flex items-center gap-2">
                                        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', lvl3.badge)}>
                                          <span className="font-mono">{lvl3.value}</span>
                                          <span className="mx-1" aria-hidden>·</span>
                                          {lvl3.label}
                                        </span>
                                        {active && <span className="text-xs font-semibold text-slate-700">Selected</span>}
                                      </div>
                                      <p className={cn('mt-1.5 text-sm leading-snug', active ? 'text-slate-900' : 'text-slate-600')}>{ind.soe[lvl3.value]}</p>
                                    </li>
                                  )
                                })}
                              </ul>
                              <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
                                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span><span className="font-semibold uppercase tracking-wide">Expected evidence:</span> {ind.evidence}</span>
                              </p>
                              <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                                <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                                <span><span className="font-semibold uppercase tracking-wide">Why this rung matters:</span> {ind.ladderRelevance}</span>
                              </p>
                            </Accordion>
                          </div>
                        </CardContent>
                      </Card>
                    </Reveal>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
