import { useMemo } from 'react'
import { Calendar, Clock, Mail, Server, Info } from 'lucide-react'
import { cn } from '../lib/utils'
import { Card, CardHeader, CardTitle, CardContent, Badge, Stat } from '../components/ui'
import { useApp } from '../lib/context'
import {
  generateComplianceCycles,
  cycleStatusFromDays,
  CYCLE_STATUS_META,
  GF_CYCLE_META,
  type GfCycleType,
  type CycleStatus,
} from '../lib/frameworks'

const MS_DAY = 86_400_000

function daysUntil(iso: string, today: Date): number {
  const due = new Date(`${iso}T00:00:00`)
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((due.getTime() - base.getTime()) / MS_DAY)
}

function formatDue(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function daysLabel(days: number): string {
  if (days === 0) return 'Due today'
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
  return `in ${days} day${days === 1 ? '' : 's'}`
}

const CYCLE_ORDER: GfCycleType[] = ['PC', 'PU', 'PUDR', 'Final PU', 'FCR']
const STATUS_ORDER: CycleStatus[] = ['overdue', 'urgent-30', 'warning-90', 'on-track']

export function ComplianceCalendarPage() {
  // Demo sessions show an illustrative year of Global Fund reporting cycles; a
  // live workspace starts empty until its own cycles are scheduled.
  const { isDemo } = useApp()
  const today = useMemo(() => new Date(), [])
  const items = useMemo(() => (isDemo ? generateComplianceCycles(today) : []), [today, isDemo])

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [items],
  )

  const counts = useMemo(() => {
    const c: Record<CycleStatus, number> = {
      overdue: 0,
      'urgent-30': 0,
      'warning-90': 0,
      'on-track': 0,
    }
    for (const it of items) {
      const status = cycleStatusFromDays(daysUntil(it.dueDate, today))
      c[status] += 1
    }
    return c
  }, [items, today])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Calendar className="h-7 w-7 text-emerald-600" />
          <h1 className="text-2xl font-display font-bold text-slate-900">
            Reporting Cycle Calendar
          </h1>
        </div>
        <p className="mt-1 text-slate-500">Global Fund PR reporting cycles</p>
      </div>

      {/* Status legend */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status legend
          </span>
          {STATUS_ORDER.map((s) => {
            const meta = CYCLE_STATUS_META[s]
            return (
              <span
                key={s}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                  meta.cls,
                )}
              >
                <span aria-hidden>{meta.emoji}</span>
                {meta.label}
              </span>
            )
          })}
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Overdue" value={counts.overdue} accent="rose" hint="Past due date" />
        <Stat label="Urgent" value={counts['urgent-30']} accent="amber" hint="Within 30 days" />
        <Stat
          label="Warning"
          value={counts['warning-90']}
          accent="amber"
          hint="Within 90 days"
        />
        <Stat
          label="On Track"
          value={counts['on-track']}
          accent="emerald"
          hint="More than 90 days out"
        />
      </div>

      {/* Reporting-cycle key */}
      <div>
        <h2 className="text-xl font-display font-bold text-slate-900">Reporting Cycle Key</h2>
        <p className="mt-1 text-sm text-slate-500">
          Each obligation maps to one of the Global Fund PR reporting cycle types.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CYCLE_ORDER.map((type) => {
            const meta = GF_CYCLE_META[type]
            return (
              <Card key={type}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-emerald-700">{type}</span>
                    <Badge variant="outline" className="text-[11px]">
                      {meta.cadence}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{meta.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{meta.blurb}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h2 className="text-xl font-display font-bold text-slate-900">Obligations Timeline</h2>
        <p className="mt-1 text-sm text-slate-500">
          Auto-generated from PR reporting cycles, sorted by due date.
        </p>

        {sorted.length === 0 ? (
          <Card className="mt-5">
            <CardContent className="flex flex-col items-center py-14 text-center">
              <Calendar className="h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">No reporting cycles scheduled yet.</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Global Fund PR reporting cycles appear here once scheduled. Explore the demo workspace
                to see a fully populated reporting timeline.
              </p>
            </CardContent>
          </Card>
        ) : (
        <div className="relative mt-5 pl-8">
          {/* vertical rail */}
          <span
            aria-hidden
            className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200"
          />
          <div className="space-y-5">
            {sorted.map((it) => {
              const days = daysUntil(it.dueDate, today)
              const status = cycleStatusFromDays(days)
              const meta = CYCLE_STATUS_META[status]
              const cycle = GF_CYCLE_META[it.type]
              return (
                <div key={it.id} className="relative">
                  {/* rail dot */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute -left-[27px] top-3 h-3.5 w-3.5 rounded-full ring-4 ring-white',
                      meta.dot,
                    )}
                  />
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[11px]">
                              {it.type}
                            </Badge>
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">
                              {cycle.label}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm font-semibold text-slate-900">
                            {it.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDue(it.dueDate)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {daysLabel(days)}
                            </span>
                          </div>
                        </div>
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                            meta.cls,
                          )}
                        >
                          <span aria-hidden>{meta.emoji}</span>
                          {meta.label}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
        )}
      </div>

      {/* Automated alerts */}
      <Card className="border-indigo-200 bg-indigo-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-900">
            <Server className="h-5 w-5 text-indigo-600" />
            Automated Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-slate-600">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
            <span>
              A{' '}
              <span className="font-semibold text-indigo-800">Netlify Scheduled Function</span>{' '}
              runs daily and queries the{' '}
              <code className="font-mono text-xs text-indigo-700">compliance_items</code> table for
              rows where{' '}
              <code className="font-mono text-xs text-indigo-700">due_date - today &lt;= 90</code>{' '}
              days.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
            <span>
              For matching{' '}
              <span className="font-mono text-xs font-semibold text-indigo-800">PU</span>,{' '}
              <span className="font-mono text-xs font-semibold text-indigo-800">PUDR</span>, and{' '}
              <span className="font-mono text-xs font-semibold text-indigo-800">FCR</span>{' '}
              obligations, the function triggers{' '}
              <span className="font-semibold text-indigo-800">Resend</span> email reminders to the
              PR finance and programmatic focal points, escalating cadence at the 90-, 30-, and
              0-day thresholds.
            </span>
          </p>
          <p className="text-xs text-slate-400">
            Explanatory only - alerting is handled server-side and is not configurable from this
            screen.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
