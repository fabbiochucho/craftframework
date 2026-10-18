import { useLegacyAssessment } from '../lib/legacy-assessment'
import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, CalendarRange, ClipboardList } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useWorkspace, useScoresCtx, useCIPCtx } from '../lib/context'
import {
  RISK_STATUSES, RiskStatus, STATUS_STYLES, severityStyle,
  CIP_PLAN_MONTHS_MIN, CIP_PLAN_MONTHS_MAX, CIP_PLAN_MONTHS_PRESETS,
} from '../lib/data'
import { derivePlan } from '../lib/moduleFindings'
import { useModuleProfile } from '../lib/moduleProfile'
import {
  Card, CardContent, CardHeader, CardTitle, Select, Input, StatusBadge, Button,
  Table, Thead, Tbody, Th, Td,
} from '../components/ui'
import { cn } from '../lib/utils'
import { ValidationCipCard } from '../components/ValidationCipCard'

const DEFAULT_STATUS: RiskStatus = 'To-be-Initiated'

export function CIPPage() {
  const { currentOrg } = useWorkspace()
  const { scores } = useScoresCtx()
  const { cipStatuses, updateCIPStatus, planMonths, setPlanMonths } = useCIPCtx()
  const orgScores = currentOrg ? scores[currentOrg.id] || {} : {}

  // Local draft so typing a custom value doesn't re-derive (and re-save) the
  // whole plan on every keystroke - only once it's a valid, settled number.
  const [monthsDraft, setMonthsDraft] = useState(String(planMonths))
  // planMonths loads asynchronously from the saved per-org value (it starts
  // at the default and is replaced once the real value arrives) - keep the
  // draft in sync with whatever it resolves to.
  useEffect(() => setMonthsDraft(String(planMonths)), [planMonths])
  const monthsDraftValid = /^\d+$/.test(monthsDraft) && Number(monthsDraft) >= CIP_PLAN_MONTHS_MIN && Number(monthsDraft) <= CIP_PLAN_MONTHS_MAX
  const commitMonthsDraft = () => {
    if (monthsDraftValid) setPlanMonths(Number(monthsDraft))
    else setMonthsDraft(String(planMonths))
  }

  const [moduleProfile] = useModuleProfile()
  const [esgScores] = useLegacyAssessment<Record<string, number>>('esg:scores', {})
  const plan = useMemo(() => derivePlan(orgScores, moduleProfile, planMonths, 2, esgScores), [orgScores, planMonths, moduleProfile, esgScores])

  const summary = useMemo(() => {
    const counts: Record<RiskStatus, number> = {
      'Completed-Validated': 0, 'Completed-Invalidated': 0, 'On-Track': 0,
      'In-Progress': 0, 'Off-Track': 0, 'To-be-Initiated': 0,
    }
    plan.forEach(r => { counts[cipStatuses[r.id] ?? DEFAULT_STATUS]++ })
    return counts
  }, [plan, cipStatuses])

  return (
    <div className="space-y-6">
      <ValidationCipCard />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> Capacity Development Plan
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">{planMonths}-Month Strengthening Plan</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every gap from your assessment, converted into an owned, scheduled mitigation action.
          </p>
        </div>

        <Card className="w-full max-w-xs p-4 sm:w-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan length</p>
          <p className="mt-0.5 text-xs text-slate-400">Choose any length - due dates rescale to fit.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CIP_PLAN_MONTHS_PRESETS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setPlanMonths(m)}
                aria-pressed={planMonths === m}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                  planMonths === m
                    ? 'border-emerald-500 bg-emerald-100 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50',
                )}
              >
                {m}mo
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Input
              type="number"
              min={CIP_PLAN_MONTHS_MIN}
              max={CIP_PLAN_MONTHS_MAX}
              value={monthsDraft}
              onChange={e => setMonthsDraft(e.target.value)}
              onBlur={commitMonthsDraft}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="w-20"
              aria-label="Custom plan length in months"
            />
            <span className="text-xs text-slate-500">
              custom months ({CIP_PLAN_MONTHS_MIN}–{CIP_PLAN_MONTHS_MAX})
            </span>
          </div>
          {!monthsDraftValid && (
            <p className="mt-1.5 text-xs text-rose-600">
              Enter {CIP_PLAN_MONTHS_MIN}–{CIP_PLAN_MONTHS_MAX}.
            </p>
          )}
        </Card>
      </div>

      {plan.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-slate-300" />
            <h2 className="mt-4 font-display text-xl font-bold text-emerald-900">Your plan is empty</h2>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              The Capacity Development Plan is built from the gaps in your assessment. Complete the
              Assessment Wizard and any control scored 2 or below will be scheduled here with an
              owner and a due date.
            </p>
            <Link to="/assessment" className="mt-5">
              <Button>Go to Assessment Wizard</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Status legend / summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {RISK_STATUSES.map(s => {
              const st = STATUS_STYLES[s]
              return (
                <Card key={s} className={`border p-4 ${st.border}`}>
                  <p className="text-2xl font-bold text-emerald-900">{summary[s]}</p>
                  <p className={`mt-1 flex items-center gap-1.5 text-[11px] font-semibold ${st.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} /> {st.label}
                  </p>
                </Card>
              )
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarRange className="h-4 w-4 text-emerald-600" /> Action Tracker</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <Thead>
                  <tr>
                    <Th>ID</Th>
                    <Th>Mitigation Action</Th>
                    <Th>Owner</Th>
                    <Th>Due</Th>
                    <Th>Severity</Th>
                    <Th>Status</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {plan.map(r => {
                    const sev = severityStyle(r.severity)
                    const status = cipStatuses[r.id] ?? DEFAULT_STATUS
                    return (
                      <tr key={r.id} className="align-top">
                        <Td><span className="font-mono text-xs font-semibold text-slate-700">{r.id}</span></Td>
                        <Td>
                          <p className="font-medium text-slate-800">{r.mitigation}</p>
                          <p className="mt-0.5 max-w-md text-xs text-slate-500 line-clamp-2">{r.description}</p>
                        </Td>
                        <Td className="whitespace-nowrap text-xs">{r.owner}</Td>
                        <Td className="whitespace-nowrap text-xs">{r.dueDate}</Td>
                        <Td>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${sev.bg} ${sev.text} ${sev.border}`}>
                            {r.severity}
                          </span>
                        </Td>
                        <Td>
                          <div className="space-y-1.5">
                            <StatusBadge status={status} />
                            <Select
                              value={status}
                              onChange={v => updateCIPStatus(r.id, v as RiskStatus)}
                              options={RISK_STATUSES.map(s => ({ value: s, label: STATUS_STYLES[s].label }))}
                            />
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                </Tbody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
