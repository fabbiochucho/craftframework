import { useMemo, useState } from 'react'
import { AlertTriangle, Search, Filter, ClipboardList } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { deriveFindings, severityStyle, TIER_NAMES } from '../lib/data'
import { useApp } from '../lib/context'
import { Card, CardContent, Input, Select, StatusBadge, Button } from '../components/ui'

export function FindingsPage() {
  const { currentOrg, scores, cipStatuses } = useApp()
  const orgScores = currentOrg ? scores[currentOrg.id] || {} : {}
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState('')

  const findings = useMemo(() => deriveFindings(orgScores), [orgScores])

  const filtered = useMemo(
    () =>
      findings.filter(r => {
        const matchesQuery =
          !query ||
          r.id.toLowerCase().includes(query.toLowerCase()) ||
          r.topic.toLowerCase().includes(query.toLowerCase()) ||
          r.description.toLowerCase().includes(query.toLowerCase())
        const matchesSev = !severity || r.severity === severity
        return matchesQuery && matchesSev
      }),
    [findings, query, severity],
  )

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Findings Register
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Identified Gaps</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generated directly from your assessment answers: every control scored 2 or below.
          {findings.length > 0 && ` Showing ${filtered.length} of ${findings.length} findings.`}
        </p>
      </div>

      {findings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-slate-300" />
            <h2 className="mt-4 font-display text-xl font-bold text-emerald-900">No findings yet</h2>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Findings appear here automatically as you answer questions in the Assessment Wizard.
              Any control you score at 2 or below becomes a tracked gap.
            </p>
            <Link to="/assessment" className="mt-5">
              <Button>Go to Assessment Wizard</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search findings…" value={query} onChange={e => setQuery(e.target.value)} className="pl-9" />
            </div>
            <div className="w-56">
              <Select
                placeholder="All severities"
                value={severity}
                onChange={setSeverity}
                options={['Critical', 'High', 'Moderate'].map(s => ({ value: s, label: s }))}
              />
            </div>
          </div>

          <div className="space-y-4">
            {filtered.map(r => {
              const sev = severityStyle(r.severity)
              return (
                <Card key={r.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-800">{r.id}</span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          {r.topic}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${sev.bg} ${sev.text} ${sev.border}`}>
                          {r.severity}
                        </span>
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                          Scored {r.score}/5
                        </span>
                      </div>
                      <StatusBadge status={cipStatuses[r.id] ?? 'To-be-Initiated'} />
                    </div>
                    <p className="mt-3 font-medium text-slate-800">{r.question}</p>
                    <p className="mt-1.5 leading-relaxed text-slate-600">{r.description}</p>
                    <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-3">
                      <div>
                        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          <Filter className="h-3 w-3" /> Domain
                        </p>
                        <p className="mt-0.5 text-sm text-slate-700">{r.domain}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tier</p>
                        <p className="mt-0.5 text-sm text-slate-700">Tier {r.tier} · {TIER_NAMES[r.tier - 1]}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Recommended Action</p>
                        <p className="mt-0.5 text-sm text-slate-700">{r.mitigation}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
