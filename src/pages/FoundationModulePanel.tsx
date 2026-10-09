import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip,
} from 'recharts'
import {
  ShieldHalf, Sprout, Landmark, CheckCircle2, FileText, AlertTriangle, TrendingUp, Sparkles,
  Gauge, Lock, CloudCheck, Eye, ArrowRight, Info,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { FIDUCIARY_LEVELS, type FrameworkId } from '../lib/frameworks'
import {
  getFoundationModule, indicatorsForDimension, dimensionScore, compositeScore, answeredIn,
  bandFor, evaluateLens, priorityGaps, strengths,
  type FoundationModuleId, type ModuleBand, type LensStatus,
} from '../lib/foundationModules'
import { useAuthCtx, useScoresCtx, useWorkspace } from '../lib/context'
import {
  Card, CardHeader, CardTitle, CardContent, Badge, ProgressBar, Accordion, Stat, Reveal,
} from '../components/ui'

const MODULE_ICONS: Record<FoundationModuleId, typeof ShieldHalf> = {
  'craft-resilience': ShieldHalf,
  'craft-transformation': Sprout,
  'craft-legacy': Landmark,
}

const BAND_TONE: Record<ModuleBand['tone'], string> = {
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const LENS_STATUS: Record<LensStatus, { label: string; chip: string; bar: string }> = {
  'not-assessed': { label: 'Not assessed', chip: 'bg-slate-100 text-slate-500 border-slate-200', bar: 'bg-slate-200' },
  'at-risk': { label: 'At risk', chip: 'bg-rose-100 text-rose-700 border-rose-200', bar: 'bg-rose-500' },
  strained: { label: 'Strained', chip: 'bg-amber-100 text-amber-700 border-amber-200', bar: 'bg-amber-500' },
  holds: { label: 'Holds', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
}

// Shared engine for the three CRAFT-authored Readiness Architecture modules
// (Resilience, Transformation & Adaptability, Intergenerational Legacy). Scores
// are read from and written to the workspace's per-org score store, so answers
// persist to the database (offline-safe via the mutations queue) exactly like
// the core assessment, and are scoped to whichever organization is in view.
export function FoundationModulePanel({ moduleId }: { moduleId: FoundationModuleId }) {
  const m = getFoundationModule(moduleId)!
  const { currentUser } = useAuthCtx()
  const { currentOrg, readOnly } = useWorkspace()
  const { scores: allScores, updateScore } = useScoresCtx()

  const orgId = currentOrg?.id ?? currentUser?.orgId ?? ''
  const scores = useMemo(() => allScores[orgId] ?? {}, [allScores, orgId])
  const select = (qId: string, value: number) => {
    if (!orgId || readOnly) return
    updateScore(orgId, qId, value)
  }

  const total = m.indicators.length
  const answered = answeredIn(m, scores)
  const completionPct = Math.round((answered / total) * 100)
  const composite = useMemo(() => compositeScore(m, scores), [m, scores])
  const band = useMemo(() => bandFor(m, scores), [m, scores])
  const lenses = useMemo(() => m.lenses.map(l => evaluateLens(m, l, scores)), [m, scores])
  const gaps = useMemo(() => priorityGaps(m, scores), [m, scores])
  const strong = useMemo(() => strengths(m, scores), [m, scores])
  const radarData = useMemo(
    () => m.dimensions.map(d => ({ dimension: d.name, value: dimensionScore(m, d.key, scores) ?? 0 })),
    [m, scores],
  )

  const compositeAccent: 'rose' | 'amber' | 'emerald' | 'slate' =
    answered === 0 ? 'slate' : composite < 2 ? 'rose' : composite < 3.5 ? 'amber' : 'emerald'
  const Icon = MODULE_ICONS[m.id]
  const persistence = readOnly
    ? { icon: Eye, text: `Viewing ${currentOrg?.name ?? 'client'} - read-only` }
    : currentUser?.isDemo
      ? { icon: Info, text: 'Demo workspace - answers are not saved' }
      : { icon: CloudCheck, text: 'Answers save automatically to your workspace' }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Readiness Architecture · Module {m.no}
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900">{m.title}</h1>
            <p className="text-sm text-slate-500">{m.question}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
          <persistence.icon className="h-3.5 w-3.5" /> {persistence.text}
        </span>
      </div>
      <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{m.intro}</p>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Maturity Band</p>
          {band ? (
            <>
              <span className={cn('mt-2 inline-flex rounded-full border px-3 py-1 text-base font-bold', BAND_TONE[band.band.tone])}>
                {band.band.label}
              </span>
              <p className="mt-2 text-xs text-slate-400">{band.provisional ? 'Provisional - not all indicators answered' : 'All indicators answered'}</p>
            </>
          ) : (
            <>
              <p className="mt-2 text-3xl font-bold text-slate-300">—</p>
              <p className="mt-1 text-xs text-slate-400">Answer an indicator to begin</p>
            </>
          )}
        </Card>
        <Stat label="Composite Score" value={`${composite.toFixed(2)} / 5`} hint="Mean across answered indicators" accent={compositeAccent} />
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weak Links</p>
          <p className={cn('mt-2 text-3xl font-bold', band?.weakLinks.length ? 'text-rose-600' : 'text-slate-800')}>
            {band ? band.weakLinks.length : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Dimensions below {m.weakestLinkFloor.toFixed(1)} / 5</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completion</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{completionPct}%</p>
          <p className="text-xs text-slate-400">{answered} of {total} indicators</p>
          <ProgressBar value={completionPct} className="mt-2" />
        </Card>
      </div>

      {band && (
        <Card className="p-5">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">{band.band.label}:</span> {band.band.summary}
          </p>
          {band.band !== band.uncapped && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                The composite alone would earn <span className="font-semibold">{band.uncapped.label}</span>, but the weakest-link rule caps
                the band while {band.weakLinks.map(d => d.name).join(', ')} {band.weakLinks.length === 1 ? 'scores' : 'score'} below{' '}
                {m.weakestLinkFloor}. A strong average cannot compensate for a collapsed dimension.
              </span>
            </p>
          )}
        </Card>
      )}

      {/* Profile + lenses */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dimension Profile</CardTitle>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Mean score per dimension (0-5)</p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="68%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                  <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} />
                  <Radar name="Score" dataKey="value" stroke="#059669" fill="#10b981" fillOpacity={0.35} />
                  <Tooltip formatter={(v) => [`${v} / 5`, 'Score']} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5"><Gauge className="h-4 w-4 text-emerald-600" /> {m.lensTitle}</CardTitle>
            <p className="mt-1 text-xs text-slate-500">{m.lensBlurb}</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {lenses.map(r => {
                const st = LENS_STATUS[r.status]
                return (
                  <li key={r.lens.key} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{r.lens.name}</p>
                        <p className="text-xs text-slate-500">{r.lens.description}</p>
                      </div>
                      <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold', st.chip)}>{st.label}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn('h-full rounded-full transition-all', st.bar)} style={{ width: `${((r.score ?? 0) / 5) * 100}%` }} />
                      </div>
                      <span className="font-mono text-xs text-slate-600">{r.score == null ? '—' : r.score.toFixed(1)}</span>
                    </div>
                    {r.weakest && r.status !== 'holds' && (
                      <p className="mt-1.5 text-xs text-slate-500">
                        Fix first: <span className="font-medium text-slate-700">{r.weakest.domain}</span> ({scores[r.weakest.id]}/5)
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Priority actions + strengths */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-display text-xl font-bold text-slate-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Priority Actions
            </h2>
            {gaps.length > 0 && <Badge className="border border-amber-200 bg-amber-100 text-amber-700">{gaps.length} gap(s)</Badge>}
          </div>
          {gaps.length === 0 ? (
            <Card className="p-6 text-sm text-slate-500">
              {answered === 0 ? 'Score the indicators below to generate a prioritized action list.' : 'No answered indicator is below "Defined" (3). Keep going to complete the picture.'}
            </Card>
          ) : (
            <div className="space-y-3">
              {gaps.slice(0, 6).map(ind => (
                <Card key={ind.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{ind.domain}</p>
                    <Badge className={scores[ind.id] <= 1 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}>{scores[ind.id]}/5</Badge>
                  </div>
                  <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">{ind.recommendation}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="mb-3 flex items-center gap-1.5 font-display text-xl font-bold text-slate-900">
            <Sparkles className="h-4 w-4 text-emerald-600" /> Strengths
          </h2>
          {strong.length === 0 ? (
            <Card className="p-6 text-sm text-slate-500">Indicators scored "Managed" (4) or above appear here.</Card>
          ) : (
            <Card className="divide-y divide-slate-100">
              {strong.map(ind => (
                <div key={ind.id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <span className="flex items-center gap-1.5 text-sm text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {ind.domain}
                  </span>
                  <Badge className="bg-emerald-100 text-emerald-700">{scores[ind.id]}/5</Badge>
                </div>
              ))}
            </Card>
          )}
          <Card className="mt-4 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Related frameworks</p>
            <ul className="mt-2 space-y-1.5">
              {m.related.map(r => (
                <li key={r.label}>
                  <Link
                    to="/assessment/$frameworkId"
                    params={{ frameworkId: r.frameworkId as FrameworkId }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:underline"
                  >
                    {r.label} <ArrowRight className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Scored indicators, grouped by dimension */}
      <div className="space-y-8">
        {m.dimensions.map(dim => {
          const ds = dimensionScore(m, dim.key, scores)
          const weak = ds != null && ds < m.weakestLinkFloor
          return (
            <div key={dim.key}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold text-slate-900">{dim.name}</h2>
                {ds != null && (
                  <Badge className={weak ? 'bg-rose-100 text-rose-700' : ds >= 3.5 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                    {ds.toFixed(1)} / 5{weak ? ' · weak link' : ''}
                  </Badge>
                )}
                <span className="text-xs text-slate-500">{dim.question}</span>
              </div>
              <div className="space-y-4">
                {indicatorsForDimension(m, dim.key).map((ind, i) => {
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
                            {FIDUCIARY_LEVELS.map(lvl => {
                              const active = selected === lvl.value
                              return (
                                <button
                                  key={lvl.value}
                                  type="button"
                                  disabled={readOnly}
                                  onClick={() => select(ind.id, lvl.value)}
                                  aria-pressed={active}
                                  title={`${lvl.label} - ${ind.soe[lvl.value]}`}
                                  className={cn(
                                    'flex items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:cursor-not-allowed',
                                    active
                                      ? cn(lvl.badge, 'shadow-sm ring-2 ring-emerald-500 ring-offset-1')
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60',
                                  )}
                                >
                                  {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : readOnly && <Lock className="h-3 w-3" />}
                                  <span className="font-mono">{lvl.value}</span>
                                  <span className="hidden xl:inline">{lvl.label}</span>
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
                            <Accordion title="View Statements of Excellence, evidence & recommendation">
                              <ul className="space-y-2">
                                {FIDUCIARY_LEVELS.map(lvl => {
                                  const active = selected === lvl.value
                                  return (
                                    <li key={lvl.value} className={cn('rounded-lg border p-3', active ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-400' : 'border-slate-200 bg-white')}>
                                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', lvl.badge)}>
                                        <span className="font-mono">{lvl.value}</span>
                                        <span className="mx-1" aria-hidden>·</span>
                                        {lvl.label}
                                      </span>
                                      <p className={cn('mt-1.5 text-sm leading-snug', active ? 'text-slate-900' : 'text-slate-600')}>{ind.soe[lvl.value]}</p>
                                    </li>
                                  )
                                })}
                              </ul>
                              <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
                                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span><span className="font-semibold uppercase tracking-wide">Expected evidence:</span> {ind.evidence}</span>
                              </p>
                              <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                                <span><span className="font-semibold uppercase tracking-wide">Recommendation:</span> {ind.recommendation}</span>
                              </p>
                              <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                                <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                <span><span className="font-semibold uppercase tracking-wide">Why it matters:</span> {ind.whyItMatters}</span>
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
