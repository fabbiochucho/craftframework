import { useState, useMemo, type ReactNode } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ReferenceLine,
} from 'recharts'
import {
  Briefcase,
  CheckCircle2,
  Circle,
  Banknote,
  ShieldCheck,
  Database,
  Network,
  Scale,
  TrendingUp,
  FileText,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { GFA_PILLARS } from '../lib/frameworks'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  ProgressBar,
  Stat,
} from '../components/ui'

const PILLAR_ICONS: Record<string, typeof Briefcase> = {
  cash: Banknote,
  risk: ShieldCheck,
  controls: Database,
  people: Network,
  governance: Scale,
  impact: TrendingUp,
  credibility: FileText,
}

function readinessColor(v: number): string {
  if (v < 50) return '#f43f5e' // rose-500
  if (v < 70) return '#f59e0b' // amber-500
  return '#10b981' // emerald-500
}

function readinessBadge(v: number): { label: string; cls: string } {
  if (v < 50) return { label: 'Not Ready', cls: 'bg-rose-100 text-rose-700 border-rose-200' }
  if (v < 70) return { label: 'Developing', cls: 'bg-amber-100 text-amber-700 border-amber-200' }
  return { label: 'Investment Ready', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
}

// Build a stable list of all (pillar, doc) keys for the data-room checklist.
type DocState = Record<string, boolean>

function docKey(pillarKey: string, doc: string): string {
  return `${pillarKey}::${doc}`
}

export function GfaDiagnosticPanel() {
  const [docs, setDocs] = useState<DocState>({})

  const toggle = (pillarKey: string, doc: string) => {
    const k = docKey(pillarKey, doc)
    setDocs((prev) => ({ ...prev, [k]: !prev[k] }))
  }

  const chartData = useMemo(
    () =>
      [...GFA_PILLARS]
        .sort((a, b) => a.readiness - b.readiness)
        .map((p) => ({ key: p.key, label: p.label, readiness: p.readiness })),
    []
  )

  const overall = useMemo(() => {
    if (GFA_PILLARS.length === 0) return 0
    const sum = GFA_PILLARS.reduce((acc, p) => acc + p.readiness, 0)
    return Math.round(sum / GFA_PILLARS.length)
  }, [])

  const totalDocs = useMemo(
    () => GFA_PILLARS.reduce((acc, p) => acc + p.docs.length, 0),
    []
  )

  const collectedDocs = useMemo(
    () =>
      GFA_PILLARS.reduce(
        (acc, p) => acc + p.docs.filter((d) => docs[docKey(p.key, d)]).length,
        0
      ),
    [docs]
  )

  const overallAccent: 'rose' | 'amber' | 'emerald' =
    overall < 50 ? 'rose' : overall < 70 ? 'amber' : 'emerald'

  const dataRoomPct = totalDocs === 0 ? 0 : Math.round((collectedDocs / totalDocs) * 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              GFA Business Diagnostic
            </h1>
            <p className="text-sm text-slate-500">7-Pillar Investment Readiness</p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Overall Readiness"
          value={`${overall}%`}
          hint="Mean across 7 pillars"
          accent={overallAccent}
        />
        <Stat
          label="Pillars Ready"
          value={`${GFA_PILLARS.filter((p) => p.readiness >= 70).length} / ${GFA_PILLARS.length}`}
          hint="≥ 70% threshold"
          accent="emerald"
        />
        <Stat
          label="Data Room"
          value={`${collectedDocs} / ${totalDocs}`}
          hint={`${dataRoomPct}% of documents collected`}
          accent={dataRoomPct >= 70 ? 'emerald' : dataRoomPct >= 40 ? 'amber' : 'slate'}
        />
      </div>

      {/* Readiness chart */}
      <Card>
        <CardHeader>
          <CardTitle>Pillar Readiness Scorecard</CardTitle>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            DFI / PE investment-readiness across the seven GFA pillars
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 8, right: 48, bottom: 8, left: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={180}
                  tick={{ fontSize: 12, fill: '#334155' }}
                  stroke="#cbd5e1"
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                  formatter={(v) => [`${v}%`, 'Readiness']}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                />
                <ReferenceLine
                  x={70}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{ value: 'Ready 70%', position: 'top', fontSize: 10, fill: '#059669' }}
                />
                <Bar dataKey="readiness" radius={[0, 6, 6, 0]} barSize={22}>
                  {chartData.map((d) => (
                    <Cell key={d.key} fill={readinessColor(d.readiness)} />
                  ))}
                  <LabelList
                    dataKey="readiness"
                    position="right"
                    formatter={(v: ReactNode) => `${v}%`}
                    style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Data Room checklist */}
      <div>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              DFI / PE Data Room
            </h2>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Due-diligence document checklist by pillar
            </p>
          </div>
          <Badge className="bg-amber-50 text-amber-700 border border-amber-200">
            {dataRoomPct}% complete
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {GFA_PILLARS.map((p) => {
            const Icon = PILLAR_ICONS[p.key] ?? FileText
            const collected = p.docs.filter((d) => docs[docKey(p.key, d)]).length
            const pct = p.docs.length === 0 ? 0 : Math.round((collected / p.docs.length) * 100)
            const rb = readinessBadge(p.readiness)
            return (
              <Card key={p.key}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle>{p.label}</CardTitle>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {collected} of {p.docs.length} documents
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                        rb.cls
                      )}
                    >
                      {p.readiness}% · {rb.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ProgressBar value={pct} className="mb-3" />
                  <ul className="space-y-1.5">
                    {p.docs.map((doc) => {
                      const checked = !!docs[docKey(p.key, doc)]
                      return (
                        <li key={doc}>
                          <button
                            type="button"
                            onClick={() => toggle(p.key, doc)}
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                              checked
                                ? 'border-emerald-200 bg-emerald-50 text-slate-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50'
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
    </div>
  )
}
