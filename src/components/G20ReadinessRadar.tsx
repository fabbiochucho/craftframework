import { useMemo, useState } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from 'recharts'
import { Radio, Globe } from 'lucide-react'
import { Card, CardContent } from './ui'
import { cn } from '../lib/utils'
import { G20_AI_READINESS_DIMENSIONS } from '../lib/regulatory-context'

// ============================================================================
// FEATURE 8 - G20 6-dimension AI Readiness Radar (cross-archetype / all tracks).
// A real, interactive radar: score each dimension 0-100 and read the composite
// National/Institutional AI Readiness Index with a maturity band. SSR-safe.
// ============================================================================

const BANDS = [
  { min: 75, label: 'Advanced', tone: 'text-emerald-600', chip: 'bg-emerald-100 text-emerald-700' },
  { min: 50, label: 'Emerging', tone: 'text-amber-600', chip: 'bg-amber-100 text-amber-700' },
  { min: 0, label: 'Nascent', tone: 'text-rose-600', chip: 'bg-rose-100 text-rose-700' },
]

function bandFor(score: number) {
  return BANDS.find(b => score >= b.min) ?? BANDS[BANDS.length - 1]
}

const DEFAULTS: Record<string, number> = {
  infrastructure: 55, workforce: 45, policy: 60, innovation: 50, ethics: 40, adoption: 48,
}

export function G20ReadinessRadar() {
  const [scores, setScores] = useState<Record<string, number>>(DEFAULTS)

  const data = useMemo(
    () => G20_AI_READINESS_DIMENSIONS.map(d => ({
      dimension: d.label,
      key: d.key,
      score: scores[d.key] ?? 0,
      description: d.description,
    })),
    [scores],
  )

  const composite = useMemo(() => {
    const vals = G20_AI_READINESS_DIMENSIONS.map(d => scores[d.key] ?? 0)
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }, [scores])

  const band = bandFor(composite)

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-indigo-600" />
          <h3 className="font-display text-lg font-semibold text-slate-800">G20 AI Readiness Radar</h3>
          <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">
            <Globe className="h-3.5 w-3.5" /> G20 · all tracks
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          The G20 six-dimension AI readiness model. Score each dimension to compute the composite readiness index.
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {/* Radar */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data} outerRadius="72%">
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${v}/100`, 'Score']} />
                <Radar name="Readiness" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Controls + composite */}
          <div className="flex flex-col">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Composite AI Readiness Index</p>
                  <p className={cn('mt-1 text-3xl font-bold', band.tone)}>{composite}<span className="text-lg text-slate-400">/100</span></p>
                </div>
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', band.chip)}>{band.label}</span>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {data.map(d => (
                <div key={d.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700" title={d.description}>{d.dimension}</span>
                    <span className="font-mono text-slate-500">{d.score}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={d.score}
                    onChange={e => setScores(s => ({ ...s, [d.key]: Number(e.target.value) }))}
                    className="mt-1 w-full accent-indigo-600"
                    aria-label={d.dimension}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
