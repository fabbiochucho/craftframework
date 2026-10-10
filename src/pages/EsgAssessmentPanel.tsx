import { useMemo, type ReactNode } from 'react'
import { useLegacyAssessment } from '../lib/legacy-assessment'
import { LegacySaveStatus } from '../lib/legacy-state'
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
  Leaf, CheckCircle2, FileText, AlertTriangle, Award, TrendingUp, Sparkles,
  Droplets, Scale, Users, ShieldAlert, Landmark, Info,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { FIDUCIARY_LEVELS } from '../lib/frameworks'
import {
  ESG_PILLARS, ESG_QUESTIONS, ESG_DOCS, EVIDENCE_LEVELS, questionsForPillar, docKey,
  pillarVerifiedScore, compositeEsgScore, compositeVerifiedScore,
  evidenceCoveragePct, confidenceFromCoverage, identifyGaps, identifyStrengths,
  unansweredQuestions, getEsgBadge, financingPositioning,
  RATING_AGENCY_MAP, RATING_AGENCY_REFERENCES, AGENCY_TRANSLATION_DISCLAIMER,
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

export function EsgAssessmentPanel() {
  const [scores, setScores, saveStatus] = useLegacyAssessment<Record<string, number>>('esg:scores', {})
  const [evidence, setEvidence, evidenceStatus] = useLegacyAssessment<Record<string, number>>('esg:evidence', {})

  const select = (qId: string, value: number) =>
    setScores(prev => ({ ...prev, [qId]: value }))

  const setEvidenceLevel = (pillar: string, doc: string, value: number) => {
    const k = docKey(pillar, doc)
    setEvidence(prev => ({ ...prev, [k]: prev[k] === value ? undefined as unknown as number : value }))
  }

  const answeredCount = Object.keys(scores).length
  const total = ESG_QUESTIONS.length
  const completionPct = total === 0 ? 0 : Math.round((answeredCount / total) * 100)

  const responseComposite = useMemo(() => compositeEsgScore(scores), [scores])
  const verifiedComposite = useMemo(() => compositeVerifiedScore(scores, evidence), [scores, evidence])
  const coveragePct = useMemo(() => evidenceCoveragePct(evidence), [evidence])
  const confidence = useMemo(() => confidenceFromCoverage(coveragePct), [coveragePct])
  const badge = useMemo(
    () => getEsgBadge(verifiedComposite, answeredCount, coveragePct),
    [verifiedComposite, answeredCount, coveragePct],
  )
  const gaps = useMemo(() => identifyGaps(scores), [scores])
  const strengths = useMemo(() => identifyStrengths(scores), [scores])
  const unanswered = useMemo(() => unansweredQuestions(scores), [scores])
  const narrative = useMemo(() => financingPositioning(badge, gaps), [badge, gaps])

  const radarData = useMemo(
    () => ESG_PILLARS.map(p => ({ pillar: p.key, value: pillarVerifiedScore(p.key, scores, evidence) })),
    [scores, evidence],
  )

  const barData = useMemo(
    () =>
      [...ESG_PILLARS]
        .map(p => ({ key: p.key, label: p.key, score: pillarVerifiedScore(p.key, scores, evidence) }))
        .sort((a, b) => a.score - b.score),
    [scores, evidence],
  )

  const totalDocs = useMemo(
    () => ESG_PILLARS.reduce((acc, p) => acc + ESG_DOCS[p.key].length, 0),
    [],
  )
  const scoredDocs = useMemo(
    () =>
      ESG_PILLARS.reduce(
        (acc, p) => acc + ESG_DOCS[p.key].filter(d => evidence[docKey(p.key, d)] != null).length,
        0,
      ),
    [evidence],
  )

  const confidenceAccent: 'rose' | 'amber' | 'emerald' =
    confidence === 'Low' ? 'rose' : confidence === 'Medium' ? 'amber' : 'emerald'

  const verifiedAccent: 'rose' | 'amber' | 'emerald' | 'slate' =
    answeredCount === 0 ? 'slate' : verifiedComposite < 2 ? 'rose' : verifiedComposite < 3.5 ? 'amber' : 'emerald'

  return (
    <div className="space-y-6">
      <LegacySaveStatus status={saveStatus} />
      <LegacySaveStatus status={evidenceStatus} />
      <p className="text-sm text-amber-700">Evidence confidence is self-reported, not independent verification or an external ESG rating.</p>
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

      {/* Response / Evidence / Confidence + Rating */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Stat
          label="Response"
          value={`${responseComposite.toFixed(2)} / 5`}
          hint="Self-reported composite"
          accent={answeredCount === 0 ? 'slate' : 'emerald'}
        />
        <Stat
          label="Evidence-adjusted self-score"
          value={`${verifiedComposite.toFixed(2)} / 5`}
          hint="60% response + 40% evidence"
          accent={verifiedAccent}
        />
        <Stat
          label="Confidence"
          value={confidence}
          hint={`${coveragePct}% of docs at "Strong"+`}
          accent={confidenceAccent}
        />
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ESG Rating</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-lg font-bold', badge.cls)}>
              {badge.letter}
            </span>
            <Award className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {badge.label}{badge.provisional && badge.letter !== 'Unrated' ? ' · Provisional' : ''}
          </p>
        </Card>
      </div>

      {/* Disclaimer - a self-assessment is never a final/independent rating */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          This is a self-assessment tool based on information entered at a point in time. It does not constitute an
          independent ESG rating, audit or certification. The rating above is <strong>provisional</strong> until
          supporting evidence is verified as &quot;Strong&quot; or &quot;Verified&quot; across most documents.
        </span>
      </div>

      {/* Completion */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assessment Completion</p>
          <span className="text-sm font-semibold text-emerald-600">{completionPct}%</span>
        </div>
        <ProgressBar value={completionPct} className="mt-3" />
      </Card>

      {/* Financing / reporting positioning narrative */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Financing, Partnership &amp; Reporting Readiness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-slate-700">{narrative}</p>
        </CardContent>
      </Card>

      {/* Rating-agency translation reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-indigo-600" />
            How This Maps to Rating Agencies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs text-indigo-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{AGENCY_TRANSLATION_DISCLAIMER}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-semibold">Dimension</th>
                  <th className="py-2 pr-4 font-semibold">What CRAFT measures</th>
                  <th className="py-2 pr-4 font-semibold">How agencies frame it</th>
                  <th className="py-2 font-semibold">Credit/capital relevance</th>
                </tr>
              </thead>
              <tbody>
                {RATING_AGENCY_MAP.map(row => (
                  <tr key={row.dimension} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-3 pr-4">
                      <Badge className="bg-slate-100 text-slate-700">{row.dimension}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{row.craftSignal}</td>
                    <td className="py-3 pr-4 text-slate-600">{row.agencyLens}</td>
                    <td className="py-3 text-slate-600">{row.creditRelevance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Reference ecosystem</p>
            <ul className="space-y-1.5">
              {RATING_AGENCY_REFERENCES.map(ref => (
                <li key={ref.name} className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">{ref.name}:</span> {ref.note}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Radar + Bar (verified score) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>E · S · G Radar (self-reported)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="pillar" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} />
                  <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} />
                  <Radar name="Score" dataKey="value" stroke="#059669" fill="#10b981" fillOpacity={0.35} />
                  <Tooltip formatter={(v) => [`${v} / 5`, 'Verified score']} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pillar Scorecard (self-reported)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={barData} margin={{ top: 8, right: 36, bottom: 8, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12, fill: '#334155' }} stroke="#cbd5e1" />
                  <Tooltip formatter={(v) => [`${v} / 5`, 'Verified score']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
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

      {/* Strengths & Gaps */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-slate-900">
              <Sparkles className="h-4 w-4 text-emerald-600" /> Key Strengths
            </h2>
            {strengths.length > 0 && <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">{strengths.length}</Badge>}
          </div>
          {strengths.length === 0 ? (
            <Card className="p-4 text-sm text-slate-500">
              {answeredCount === 0 ? 'Answer questions below to surface strengths.' : 'No items at "Managed" or above yet.'}
            </Card>
          ) : (
            <div className="space-y-2">
              {strengths.map(({ question, score }) => (
                <Card key={question.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-800">{question.domain}</p>
                    <Badge className="shrink-0 bg-emerald-100 text-emerald-700">{score}/5</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900">Gaps &amp; Recommendations</h2>
            {gaps.length > 0 && <Badge className="bg-rose-50 text-rose-700 border border-rose-200">{gaps.length} open</Badge>}
          </div>
          {gaps.length === 0 ? (
            <Card className="p-4 text-sm text-slate-500">
              {answeredCount === 0 ? 'Answer questions below to surface gaps and recommendations.' : 'No gaps - every answered item meets or exceeds "Defined".'}
            </Card>
          ) : (
            <div className="space-y-3">
              {gaps.map(({ question, score }) => (
                <Card key={question.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{question.domain}</p>
                    <Badge className="shrink-0 bg-amber-100 text-amber-700">{score}/5</Badge>
                  </div>
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-900">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{question.recommendation}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      {unanswered.length > 0 && (
        <p className="text-xs text-slate-400">
          {unanswered.length} question(s) not yet answered - complete the assessment below for a full gap analysis.
        </p>
      )}

      {/* Evidence verification */}
      <div>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">Supporting Evidence</h2>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Verification scale by document - rate each as your assessor would
            </p>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">{scoredDocs} / {totalDocs} scored</Badge>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {ESG_PILLARS.map(p => {
            const Icon = PILLAR_ICONS[p.key]
            const list = ESG_DOCS[p.key]
            return (
              <Card key={p.key}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                      <Icon className="h-4 w-4" />
                    </div>
                    <CardTitle>{p.key}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {list.map(doc => {
                    const current = evidence[docKey(p.key, doc)]
                    return (
                      <div key={doc} className="rounded-lg border border-slate-200 p-2.5">
                        <p className="mb-1.5 text-xs font-medium text-slate-700">{doc}</p>
                        <div className="flex flex-wrap gap-1">
                          {EVIDENCE_LEVELS.map(lvl => {
                            const active = current === lvl.value
                            return (
                              <button
                                key={lvl.value}
                                type="button"
                                onClick={() => setEvidenceLevel(p.key, doc, lvl.value)}
                                aria-pressed={active}
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                                  active ? lvl.badge : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                                )}
                              >
                                {lvl.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
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
                            <div className="flex items-center gap-1.5">
                              {q.frameworkRefs.map(ref => (
                                <span key={ref} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                  {ref}
                                </span>
                              ))}
                              <span className="font-mono text-xs text-slate-400">{q.id}</span>
                            </div>
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
                              <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                                <Award className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                                <span><span className="font-semibold uppercase tracking-wide">Framework references:</span> {q.frameworkRefs.join(', ')}</span>
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
