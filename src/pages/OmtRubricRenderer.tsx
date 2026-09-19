import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts'
import { CheckCircle2, ClipboardList, Radar as RadarIcon, FileText } from 'lucide-react'
import { cn } from '../lib/utils'
import {
  getFramework,
  rubricForFramework,
  levelsForScale,
  scaleMax,
  OPI_DOMAINS,
  type ScaleLevel,
} from '../lib/frameworks'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  ProgressBar,
  Accordion,
  Stat,
  Reveal,
} from '../components/ui'

type RendererId = 'pact-omt-v6' | 'oca-opi'

export function OmtRubricRenderer({ frameworkId }: { frameworkId: RendererId }) {
  const meta = getFramework(frameworkId)
  const questions = useMemo(() => rubricForFramework(frameworkId), [frameworkId])
  const levels: ScaleLevel[] = useMemo(
    () => (meta ? levelsForScale(meta.scale) : []),
    [meta],
  )
  const max = meta ? scaleMax(meta.scale) : 4

  const [scores, setScores] = useState<Record<string, number>>({})

  const select = (qId: string, value: number) =>
    setScores(prev => ({ ...prev, [qId]: value }))

  const answeredIds = Object.keys(scores)
  const answeredCount = answeredIds.length
  const total = questions.length
  const avg =
    answeredCount === 0
      ? 0
      : Math.round(
          (answeredIds.reduce((s, id) => s + (scores[id] ?? 0), 0) / answeredCount) * 100,
        ) / 100
  const completionPct = total === 0 ? 0 : Math.round((answeredCount / total) * 100)

  const avgAccent: 'rose' | 'amber' | 'emerald' | 'slate' =
    answeredCount === 0 ? 'slate' : avg <= 1.5 ? 'rose' : avg < 3 ? 'amber' : 'emerald'

  // OPI radar - one value per performance domain, derived from answered OCA
  // questions whose domain matches the OPI domain key (fallback 0).
  const opiData = useMemo(() => {
    if (frameworkId !== 'oca-opi') return []
    return OPI_DOMAINS.map(d => {
      const matches = questions.filter(
        q => q.domain.toLowerCase() === d.label.toLowerCase() && scores[q.id] != null,
      )
      const value =
        matches.length === 0
          ? 0
          : Math.round(
              (matches.reduce((s, q) => s + (scores[q.id] ?? 0), 0) / matches.length) * 100,
            ) / 100
      return { domain: d.label, value, blurb: d.blurb }
    })
  }, [frameworkId, questions, scores])

  if (!meta) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          Unknown framework: <span className="font-mono">{frameworkId}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {meta.authority}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">{meta.name}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{meta.blurb}</p>
        </div>
        <Badge className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
          <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
          1–{max} maturity scale
        </Badge>
      </div>

      {/* Live summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Questions answered"
          value={`${answeredCount} / ${total}`}
          hint="Across all domains"
          accent="slate"
        />
        <Stat
          label="Average maturity"
          value={`${avg.toFixed(2)} / ${max}`}
          hint={answeredCount === 0 ? 'Awaiting scoring' : 'Mean of answered items'}
          accent={avgAccent}
        />
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completion</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{completionPct}%</p>
          <ProgressBar value={completionPct} className="mt-3" />
        </Card>
      </div>

      {/* OPI radar (OCA only) */}
      {frameworkId === 'oca-opi' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg text-slate-900">
              <RadarIcon className="h-5 w-5 text-emerald-600" />
              Organizational Performance Index (OPI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={opiData} outerRadius="72%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis
                    dataKey="domain"
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                  />
                  <PolarRadiusAxis
                    domain={[0, max]}
                    tickCount={max + 1}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={false}
                  />
                  <Radar
                    name="Maturity"
                    dataKey="value"
                    stroke="#059669"
                    fill="#10b981"
                    fillOpacity={0.35}
                  />
                  <Tooltip
                    formatter={(v) => [`${v} / ${max}`, 'Maturity']}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">
              Domain values computed from answered OCA items (0 where unanswered).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rubric questions */}
      <div className="space-y-4">
        {questions.map((q, i) => {
          const selected = scores[q.id]
          return (
            <Reveal key={q.id} delay={i * 40}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {q.domain}
                    </p>
                    <span className="font-mono text-xs text-slate-400">{q.id}</span>
                  </div>
                  <p className="mt-2 text-base font-medium leading-snug text-slate-900">
                    {q.question}
                  </p>

                  {/* Radio group of levels */}
                  <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {levels.map(lvl => {
                      const active = selected === lvl.value
                      return (
                        <button
                          key={lvl.value}
                          type="button"
                          onClick={() => select(q.id, lvl.value)}
                          aria-pressed={active}
                          className={cn(
                            'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1',
                            active
                              ? cn(lvl.badge, 'ring-2 ring-emerald-500 ring-offset-1 shadow-sm')
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                          )}
                        >
                          {active && <CheckCircle2 className="h-4 w-4" />}
                          <span className="font-mono">{lvl.value}</span>
                          <span aria-hidden>·</span>
                          <span>{lvl.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {selected != null && (
                    <p className="mt-3 text-xs text-slate-500">
                      Selected:{' '}
                      <span className="font-semibold text-slate-700">
                        {levels.find(l => l.value === selected)?.label}
                      </span>{' '}
                      - {levels.find(l => l.value === selected)?.anchor}
                    </p>
                  )}

                  {/* Statements of Excellence */}
                  <div className="mt-4">
                    <Accordion title="View Statements of Excellence">
                      <ul className="space-y-2">
                        {levels.map(lvl => {
                          const active = selected === lvl.value
                          const text = q.soe[lvl.value] ?? lvl.anchor
                          return (
                            <li
                              key={lvl.value}
                              className={cn(
                                'rounded-lg border p-3 transition-colors',
                                active
                                  ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-400'
                                  : 'border-slate-200 bg-white',
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                                    lvl.badge,
                                  )}
                                >
                                  <span className="font-mono">{lvl.value}</span>
                                  <span className="mx-1" aria-hidden>·</span>
                                  {lvl.label}
                                </span>
                                {active && (
                                  <span className="text-xs font-semibold text-emerald-700">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <p
                                className={cn(
                                  'mt-1.5 text-sm leading-snug',
                                  active ? 'text-emerald-900' : 'text-slate-600',
                                )}
                              >
                                {text}
                              </p>
                            </li>
                          )
                        })}
                      </ul>
                      {q.evidence && (
                        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
                          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>
                            <span className="font-semibold uppercase tracking-wide">
                              Expected evidence:
                            </span>{' '}
                            {q.evidence}
                          </span>
                        </p>
                      )}
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
}
