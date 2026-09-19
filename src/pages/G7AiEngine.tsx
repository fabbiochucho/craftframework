import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  LabelList,
} from 'recharts'
import {
  Cpu,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Sparkles,
  ListChecks,
} from 'lucide-react'
import { cn } from '../lib/utils'
import {
  AI_DIMENSIONS,
  AI_EVAL_MATRIX,
  EIA_CHECKLIST,
  getFramework,
} from '../lib/frameworks'
import {
  Card,
  CardContent,
  Badge,
  Button,
  Input,
  Select,
} from '../components/ui'
import { G20ReadinessRadar } from '../components/G20ReadinessRadar'

// ---------------------------------------------------------------------------
// G7 AI Governance - Public Sector Toolkit (INDIGO theme)
// ---------------------------------------------------------------------------

const SCORE_OPTIONS = [0, 1, 2, 3, 4].map(n => ({ value: String(n), label: String(n) }))

// Maturity anchors for the 0–4 dimension scoring scale.
const DIMENSION_LEVEL: Record<number, { label: string; cls: string }> = {
  0: { label: 'Not assessed', cls: 'bg-slate-100 text-slate-600 border-slate-300' },
  1: { label: 'Initial', cls: 'bg-rose-100 text-rose-700 border-rose-300' },
  2: { label: 'Developing', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  3: { label: 'Managed', cls: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  4: { label: 'Optimized', cls: 'bg-indigo-200 text-indigo-900 border-indigo-400' },
}

export function G7AiEngine() {
  const framework = getFramework('g7-ai-public-sector')
  const authority = framework?.authority ?? 'G7 / OECD · AI Governance Framework'

  // Section 1 - 5-dimension scores (0..4), keyed by dimension key.
  const [dimensionScores, setDimensionScores] = useState<Record<string, number>>(
    () => Object.fromEntries(AI_DIMENSIONS.map(d => [d.key, 2])),
  )

  // Section 2 - editable evaluation-matrix values, prefilled with benchmarks.
  const [metricValues, setMetricValues] = useState<Record<string, number>>(
    () => Object.fromEntries(AI_EVAL_MATRIX.map(m => [m.key, m.benchmark])),
  )

  // Section 4 - EIA checklist gate.
  const [eiaChecks, setEiaChecks] = useState<Record<string, boolean>>(
    () => Object.fromEntries(EIA_CHECKLIST.map(c => [c.key, false])),
  )

  const dimensionAverage = useMemo(() => {
    const vals = Object.values(dimensionScores)
    if (!vals.length) return 0
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }, [dimensionScores])

  // Only the four 0–100 benchmark metrics feed the chart (exclude the count).
  const chartData = useMemo(
    () =>
      AI_EVAL_MATRIX.filter(m => m.unit !== 'count').map(m => ({
        key: m.key,
        name: m.label,
        value: Number.isFinite(metricValues[m.key]) ? metricValues[m.key] : 0,
      })),
    [metricValues],
  )

  const allChecksPassed = useMemo(
    () => EIA_CHECKLIST.every(c => eiaChecks[c.key]),
    [eiaChecks],
  )
  const checksCompleted = EIA_CHECKLIST.filter(c => eiaChecks[c.key]).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">
            <Cpu className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-slate-900">
                G7 AI Governance - Public Sector Toolkit
              </h1>
              <Badge className="border border-indigo-300 bg-indigo-100 text-indigo-700">
                AI Ethics
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              The 5-dimension AI assessment, the evaluation matrix (C-CORE, CASTER, Alpha / GoZero)
              and fully-completed-survey consistency scoring - gated by the UNESCO ethical-impact checks.
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-indigo-500">
              {authority}
            </p>
          </div>
        </div>
      </div>

      {/* Section 1 - 5-dimension classification matrix */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              5-Dimension Classification
            </h2>
            <p className="text-sm text-slate-500">
              Score each dimension 0–4 against the OECD classification facets.
            </p>
          </div>
          <div className="hidden shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-right sm:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
              Mean dimension score
            </p>
            <p className="font-mono text-2xl font-bold text-indigo-700">
              {dimensionAverage.toFixed(2)}
              <span className="text-base text-indigo-400"> / 4</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {AI_DIMENSIONS.map(dim => {
            const score = dimensionScores[dim.key] ?? 0
            const level = DIMENSION_LEVEL[score]
            return (
              <Card
                key={dim.key}
                className="flex flex-col border-indigo-100 ring-1 ring-transparent transition-shadow hover:shadow-md hover:ring-indigo-100"
              >
                <CardContent className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold leading-tight text-slate-900">{dim.label}</h3>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 font-mono text-xs font-bold',
                        level.cls,
                      )}
                    >
                      {score}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">{dim.blurb}</p>
                  <ul className="space-y-1.5">
                    {dim.facets.map(f => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto space-y-2 pt-2">
                    <Select
                      options={SCORE_OPTIONS}
                      value={String(score)}
                      onChange={val =>
                        setDimensionScores(prev => ({ ...prev, [dim.key]: Number(val) }))
                      }
                    />
                    <p
                      className={cn(
                        'rounded-md border px-2 py-1 text-center text-[11px] font-semibold',
                        level.cls,
                      )}
                    >
                      {level.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Section 2 - Evaluation matrix */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-600" />
          <h2 className="font-display text-xl font-bold text-slate-900">Evaluation Matrix</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AI_EVAL_MATRIX.map(metric => {
            const isCount = metric.unit === 'count'
            const unitLabel = metric.unit === '%' ? '%' : metric.unit === 'score' ? 'pts' : 'surveys'
            return (
              <Card key={metric.key} className="border-indigo-100">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {isCount ? 'Number of fully completed surveys' : metric.label}
                    </h3>
                    <Badge className="border border-indigo-200 bg-indigo-50 font-mono text-indigo-600" variant="outline">
                      {metric.unit}
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">{metric.description}</p>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        type="number"
                        value={String(metricValues[metric.key] ?? '')}
                        onChange={e =>
                          setMetricValues(prev => ({
                            ...prev,
                            [metric.key]: e.target.value === '' ? 0 : Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <span className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {unitLabel}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-slate-400">
                    benchmark {metric.benchmark}
                    {metric.unit === '%' ? '%' : ''}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Section 3 - Benchmark bar chart */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          <h2 className="font-display text-xl font-bold text-slate-900">Benchmark Performance</h2>
        </div>
        <Card className="border-indigo-100">
          <CardContent className="p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Score metrics vs. 80% governance threshold (0–100)
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #c7d2fe',
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: 'Threshold 80', fontSize: 10, fill: '#b45309', position: 'right' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={72}>
                    <LabelList dataKey="value" position="top" fontSize={11} fill="#3730a3" />
                    {chartData.map(d => (
                      <Cell key={d.key} fill={d.value >= 80 ? '#4f46e5' : '#a5b4fc'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 4 - Ethical Impact Assessment gate */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <h2 className="font-display text-xl font-bold text-slate-900">
              Ethical Impact Assessment
            </h2>
          </div>
          <Badge className="border border-indigo-200 bg-indigo-50 font-mono text-indigo-600" variant="outline">
            {checksCompleted} / {EIA_CHECKLIST.length}
          </Badge>
        </div>

        <Card className="border-indigo-100">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ListChecks className="h-4 w-4 text-indigo-500" />
              UNESCO-aligned deployment gate
            </div>
            <ul className="divide-y divide-slate-100">
              {EIA_CHECKLIST.map(check => {
                const checked = !!eiaChecks[check.key]
                return (
                  <li key={check.key} className="py-3">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e =>
                          setEiaChecks(prev => ({ ...prev, [check.key]: e.target.checked }))
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="min-w-0">
                        <span
                          className={cn(
                            'flex items-center gap-1.5 text-sm font-semibold',
                            checked ? 'text-indigo-700' : 'text-slate-800',
                          )}
                        >
                          {checked && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />}
                          {check.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">{check.hint}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            {!allChecksPassed && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>Complete all ethical impact checks before approving deployment.</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="primary"
                disabled={!allChecksPassed}
                className={cn(
                  allChecksPassed &&
                    'bg-indigo-600 shadow-indigo-500/30 hover:bg-indigo-700 focus:ring-indigo-500',
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                Approve AI Deployment
              </Button>
              {allChecksPassed && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-indigo-700">
                  <CheckCircle2 className="h-4 w-4" />
                  All ethical impact checks satisfied.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* G20 six-dimension AI Readiness Radar (all tracks) */}
      <section>
        <G20ReadinessRadar />
      </section>
    </div>
  )
}
