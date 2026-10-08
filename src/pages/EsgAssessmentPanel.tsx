import { useMemo, useState, type ReactNode } from 'react'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  LabelList,
} from 'recharts'
import {
  Leaf, CheckCircle2, Circle, FileText, AlertTriangle, Award, TrendingUp,
  Droplets, Scale, Users,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { FIDUCIARY_LEVELS } from '../lib/frameworks'
import {
  ESG_PILLARS, ESG_QUESTIONS, ESG_DOCS, questionsForPillar,
  pillarScore, compositeEsgScore, identifyGaps, unansweredQuestions,
  getEsgBadge, financingPositioning,
  type EsgPillar,
} from '../lib/esg'
import {
  Card, CardHeader, CardTitle, CardContent, Badge, ProgressBar, Accordion, Stat, Reveal,
} from '../components/ui'

const PILLAR_ICONS: Record<EsgPillar, typeof Leaf> = {
  Environmental: Droplets,
  Social: Users,
  Governance: Scale,
}

function docKey(pillar: string, doc: string): string {
  return `${pillar}::${doc}`
}

export function EsgAssessmentPanel() {
  const [scores, setScores] = useState<Record<string, number>>({})
  const [docs, setDocs] = useState<Record<string, boolean>>({})

  const select = (qId: string, value: number) =>
    setScores(prev => ({ ...prev, [qId]: value }))

  const toggleDoc = (pillar: string, doc: string) => {
    const k = docKey(pillar, doc)
    setDocs(prev => ({ ...prev, [k]: !prev[k] }))
  }

  const answeredCount = Object.keys(scores).length
  const total = ESG_QUESTIONS.length
  const completionPct = total === 0 ? 0 : Math.round((answeredCount / total) * 100)

  const composite = useMemo(() => compositeEsgScore(scores), [scores])
  const badge = useMemo(() => getEsgBadge(composite, answeredCount), [composite, answeredCount])
  const gaps = useMemo(() => identifyGaps(scores), [scores])
  const unanswered = useMemo(() => unansweredQuestions(scores), [scores])
  const narrative = useMemo(() => financingPositioning(badge, gaps), [badge, gaps])

  const radarData = useMemo(
    () => ESG_PILLARS.map(p => ({ pillar: p.key, value: pillarScore(p.key, scores) })),
    [scores],
  )

  const barData = useMemo(
    () =>
      [...ESG_PILLARS]
        .map(p => ({ key: p.key, label: p.key, score: pillarScore(p.key, scores) }))
        .sort((a, b) => a.score - b.score),
    [scores],
  )

  const totalDocs = useMemo(
    () => ESG_PILLARS.reduce((acc, p) => acc + ESG_DOCS[p.key].length, 0),
    [],
  )
  const collectedDocs = useMemo(
    () =>
      ESG_PILLARS.reduce(
        (acc, p) => acc + ESG_DOCS[p.key].filter(d => docs[docKey(p.key, d)]).length,
        0,
      ),
    [docs],
  )
  const docsPct = totalDocs === 0 ? 0 : Math.round((collectedDocs / totalDocs) * 100)

  const scoreAccent: 'rose' | 'amber' | 'emerald' | 'slate' =
    answeredCount === 0 ? 'slate' : composite < 2 ? 'rose' : composite < 3.5 ? 'amber' : 'emerald'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
          <Leaf className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">ESG Self-Assessment</h1>
          <p className="text-sm text-slate-500">Environmental, Social &amp; Governance performance and readiness</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Stat
          label="ESG Score"
          value={`${composite.toFixed(2)} / 5`}
          hint={answeredCount === 0 ? 'Awaiting scoring' : 'Composite of E · S · G'}
          accent={scoreAccent}
        />
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ESG Rating</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-lg font-bold', badge.cls)}>
              {badge.letter}
            </span>
            <Award className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-1 text-xs text-slate-400">{badge.label}</p>
        </Card>
        <Stat
          label="Open Gaps"
          value={gaps.length}
          hint="Answered items below 'Defined'"
          accent={gaps.length === 0 && answeredCount > 0 ? 'emerald' : gaps.length > 0 ? 'rose' : 'slate'}
        />
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completion</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{completionPct}%</p>
          <ProgressBar value={completionPct} className="mt-3" />
        </Card>
      </div>

      {/* Financing positioning narrative */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Financing &amp; Positioning Readiness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-slate-700">{narrative}</p>
        </CardContent>
      </Card>

      {/* Radar + Bar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>E · S · G Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="pillar" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} />
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
            <CardTitle>Pillar Scorecard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={barData} margin={{ top: 8, right: 36, bottom: 8, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12, fill: '#334155' }} stroke="#cbd5e1" />
                  <Tooltip formatter={(v) => [`${v} / 5`, 'Score']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={28}>
                    {barData.map(d => (
                      <Cell key={d.key} fill={d.score < 2 ? '#f43f5e' : d.score < 3.5 ? '#f59e0b' : '#10b981'} />
                    ))}
                    <LabelList dataKey="score" position="right" formatter={(v: ReactNode) => Number(v).toFixed(1)} style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gaps & Recommendations */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-slate-900">Gaps &amp; Recommendations</h2>
          {gaps.length > 0 && (
            <Badge className="bg-rose-50 text-rose-700 border border-rose-200">{gaps.length} open</Badge>
          )}
        </div>
        {gaps.length === 0 ? (
          <Card className="p-6 text-sm text-slate-500">
            {answeredCount === 0
              ? 'Answer the questions below to surface ESG gaps and recommendations.'
              : 'No gaps - every answered item meets or exceeds the "Defined" threshold.'}
          </Card>
        ) : (
          <div className="space-y-3">
            {gaps.map(({ question, score }) => (
              <Card key={question.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {question.pillar} · {question.domain}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{question.question}</p>
                  </div>
                  <Badge className="shrink-0 bg-amber-100 text-amber-700">Score {score}/5</Badge>
                </div>
                <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span><span className="font-semibold">Recommendation:</span> {question.recommendation}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
        {unanswered.length > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            {unanswered.length} question(s) not yet answered - complete the assessment below for a full gap analysis.
          </p>
        )}
      </div>

      {/* Documentation / evidence checklist */}
      <div>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">Supporting Evidence</h2>
            <p className="text-xs uppercase tracking-wide text-slate-500">Documentation checklist by pillar</p>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">{docsPct}% complete</Badge>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {ESG_PILLARS.map(p => {
            const Icon = PILLAR_ICONS[p.key]
            const list = ESG_DOCS[p.key]
            const collected = list.filter(d => docs[docKey(p.key, d)]).length
            const pct = list.length === 0 ? 0 : Math.round((collected / list.length) * 100)
            return (
              <Card key={p.key}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle>{p.key}</CardTitle>
                      <p className="mt-0.5 text-xs text-slate-500">{collected} of {list.length} documents</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ProgressBar value={pct} className="mb-3" />
                  <ul className="space-y-1.5">
                    {list.map(doc => {
                      const checked = !!docs[docKey(p.key, doc)]
                      return (
                        <li key={doc}>
                          <button
                            type="button"
                            onClick={() => toggleDoc(p.key, doc)}
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                              checked
                                ? 'border-emerald-200 bg-emerald-50 text-slate-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50',
                            )}
                          >
                            {checked ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                            )}
                            <span className={cn(checked && 'font-medium')}>{doc}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Scored questions, grouped by pillar */}
      <div className="space-y-8">
        {ESG_PILLARS.map(pillar => {
          const Icon = PILLAR_ICONS[pillar.key]
          const qs = questionsForPillar(pillar.key)
          return (
            <div key={pillar.key}>
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-5 w-5 text-emerald-600" />
                <h2 className="font-display text-xl font-bold text-slate-900">{pillar.key}</h2>
                <span className="text-xs text-slate-500">{pillar.blurb}</span>
              </div>
              <div className="space-y-4">
                {qs.map((q, i) => {
                  const selected = scores[q.id]
                  return (
                    <Reveal key={q.id} delay={i * 40}>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{q.domain}</p>
                            <span className="font-mono text-xs text-slate-400">{q.id}</span>
                          </div>
                          <p className="mt-2 text-base font-medium leading-snug text-slate-900">{q.question}</p>

                          <div className="mt-4 grid grid-cols-3 gap-2 lg:grid-cols-6">
                            {FIDUCIARY_LEVELS.map(lvl => {
                              const active = selected === lvl.value
                              return (
                                <button
                                  key={lvl.value}
                                  type="button"
                                  onClick={() => select(q.id, lvl.value)}
                                  aria-pressed={active}
                                  className={cn(
                                    'flex items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1',
                                    active
                                      ? cn(lvl.badge, 'ring-2 ring-emerald-500 ring-offset-1 shadow-sm')
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                                  )}
                                >
                                  {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                                  <span className="font-mono">{lvl.value}</span>
                                </button>
                              )
                            })}
                          </div>

                          {selected != null && (
                            <p className="mt-3 text-xs text-slate-500">
                              Selected: <span className="font-semibold text-slate-700">{FIDUCIARY_LEVELS.find(l => l.value === selected)?.label}</span>
                              {' - '}{q.soe[selected]}
                            </p>
                          )}

                          <div className="mt-4">
                            <Accordion title="View Statements of Excellence, recommendation & financing relevance">
                              <ul className="space-y-2">
                                {FIDUCIARY_LEVELS.map(lvl => {
                                  const active = selected === lvl.value
                                  return (
                                    <li key={lvl.value} className={cn('rounded-lg border p-3 transition-colors', active ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-400' : 'border-slate-200 bg-white')}>
                                      <div className="flex items-center gap-2">
                                        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', lvl.badge)}>
                                          <span className="font-mono">{lvl.value}</span>
                                          <span className="mx-1" aria-hidden>·</span>
                                          {lvl.label}
                                        </span>
                                        {active && <span className="text-xs font-semibold text-emerald-700">Selected</span>}
                                      </div>
                                      <p className={cn('mt-1.5 text-sm leading-snug', active ? 'text-emerald-900' : 'text-slate-600')}>{q.soe[lvl.value]}</p>
                                    </li>
                                  )
                                })}
                              </ul>
                              <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
                                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span><span className="font-semibold uppercase tracking-wide">Expected evidence:</span> {q.evidence}</span>
                              </p>
                              <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                                <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                <span><span className="font-semibold uppercase tracking-wide">Why it matters for financing:</span> {q.financingNote}</span>
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
