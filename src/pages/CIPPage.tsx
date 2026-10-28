import { useLegacyAssessment } from '../lib/legacy-assessment'
import { ResultExplainer } from '../components/ResultExplainer'
import { useMemo, useState } from 'react'
import { TrendingUp, CalendarRange, ClipboardList } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useWorkspace, useScoresCtx, useCIPCtx } from '../lib/context'
import {
  RISK_STATUSES, RiskStatus, STATUS_STYLES, severityStyle,
  CIP_PLAN_MONTHS_MIN, CIP_PLAN_MONTHS_MAX, type DerivedFinding,
} from '../lib/data'
import { planTimeline } from '../lib/moduleFindings'
import { PACE_LABEL, type OrgSize, type Pace, type TimelineSettings } from '../lib/cipTimeline'
import { useModuleProfile } from '../lib/moduleProfile'
import {
  Card, CardContent, CardHeader, CardTitle, Select, Input, StatusBadge, Button,
  Table, Thead, Tbody, Th, Td,
} from '../components/ui'
import { cn } from '../lib/utils'
import { ValidationCipCard } from '../components/ValidationCipCard'

const DEFAULT_STATUS: RiskStatus = 'To-be-Initiated'
const PACE_HINT: Record<Pace, string> = {
  standard: 'Windows set by gap severity.',
  accelerated: 'Up to 40% shorter. Check owners can carry the load.',
  target: 'Fit the plan to a number of months; what cannot fit is listed.',
  extended: 'Half as long again, for stretched teams.',
}

export function CIPPage() {
  const { currentOrg, readOnly } = useWorkspace()
  const { scores } = useScoresCtx()
  const { cipStatuses, updateCIPStatus, timeline, setTimeline } = useCIPCtx()
  const orgScores = currentOrg ? scores[currentOrg.id] || {} : {}

  const [moduleProfile] = useModuleProfile()
  const [esgScores] = useLegacyAssessment<Record<string, number>>('esg:scores', {})
  const t = useMemo(() => planTimeline(orgScores, moduleProfile, timeline, 2, esgScores), [orgScores, timeline, moduleProfile, esgScores])
  const plan = t.actions
  const [adjusting, setAdjusting] = useState<string | null>(null)

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
          <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">
            {plan.length ? `${t.planMonths}-Month Strengthening Plan` : 'Strengthening Plan'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Every gap from your assessment, converted into an owned action. Dates are suggested from each gap's severity, the kind of
            action and its minimum time, at the {PACE_LABEL[timeline.pace]} pace.
          </p>
          {t.warnings.map(w => <p key={w} className="mt-1 text-sm text-amber-700">{w}</p>)}
          <ResultExplainer id="cip" className="mt-3" />
        </div>
        <TimelineControls value={timeline} onChange={setTimeline} readOnly={readOnly} />
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
                    <Th>Timing</Th>
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
                        <Td className="text-xs">
                          <p className="whitespace-nowrap">Weeks {r.startWeek}–{r.dueWeek} · due {r.dueDate}</p>
                          <p className="text-slate-500">Phase {r.phase}{t.cannotFit.includes(r.id) ? ' · cannot fit the target' : ''}</p>
                          {r.flags?.map(f => <p key={f} className="mt-0.5 max-w-xs text-amber-700">{f}</p>)}
                          {!readOnly && <button type="button" className="mt-1 text-emerald-700 underline" onClick={() => setAdjusting(adjusting === r.id ? null : r.id)}>
                            {adjusting === r.id ? 'Close' : 'Adjust'}
                          </button>}
                          {!readOnly && adjusting === r.id && <AdjustAction action={r} value={timeline} onChange={setTimeline} />}
                        </Td>
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

function TimelineControls({ value, onChange, readOnly }: { value: TimelineSettings; onChange: (t: TimelineSettings) => void; readOnly: boolean }) {
  const set = (patch: Partial<TimelineSettings>) => onChange({ ...value, ...patch })
  return (
    <Card className="w-full max-w-sm space-y-3 p-4 sm:w-auto">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pace</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(PACE_LABEL) as Pace[]).map(p => (
            <button key={p} type="button" aria-pressed={value.pace === p} disabled={readOnly}
              onClick={() => set({ pace: p, targetMonths: p === 'target' ? value.targetMonths ?? 12 : value.targetMonths })}
              className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                value.pace === p ? 'border-emerald-500 bg-emerald-100 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50')}>
              {PACE_LABEL[p]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">{PACE_HINT[value.pace]}</p>
      </div>
      {value.pace === 'target' && (
        <Input label={`Target (months, ${CIP_PLAN_MONTHS_MIN}–${CIP_PLAN_MONTHS_MAX})`} type="number" min={CIP_PLAN_MONTHS_MIN} max={CIP_PLAN_MONTHS_MAX}
          defaultValue={value.targetMonths ?? 12} key={value.targetMonths} disabled={readOnly}
          onBlur={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= CIP_PLAN_MONTHS_MIN && n <= CIP_PLAN_MONTHS_MAX) set({ targetMonths: n }) }} />
      )}
      {/* Saved on blur so a half-typed date never clears the saved one. */}
      <Input label="Plan start date" type="date" defaultValue={value.startDate ?? ''} key={value.startDate ?? ''} disabled={readOnly}
        onBlur={e => { const d = e.target.value; if (d !== (value.startDate ?? '') && (d === '' || /^\d{4}-\d{2}-\d{2}$/.test(d))) set({ startDate: d || undefined }) }} />
      <Select label="Organisation size (actions one owner can run at once)" value={value.orgSize}
        onChange={v => set({ orgSize: v as OrgSize })}
        options={[{ value: 'small', label: 'Small (2)' }, { value: 'medium', label: 'Medium (3)' }, { value: 'large', label: 'Large (5)' }]} />
    </Card>
  )
}

function AdjustAction({ action, value, onChange }: { action: DerivedFinding; value: TimelineSettings; onChange: (t: TimelineSettings) => void }) {
  const ov = value.overrides[action.id]
  const fx = value.fixedDates[action.id]
  const [dueWeek, setDueWeek] = useState(String(ov?.dueWeek ?? action.dueWeek ?? ''))
  const [reason, setReason] = useState(ov?.reason ?? '')
  const [date, setDate] = useState(fx?.date ?? '')
  const [label, setLabel] = useState(fx?.label ?? '')
  const without = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== action.id))
  const weekOk = /^\d+$/.test(dueWeek) && Number(dueWeek) > 0
  return (
    <div className="mt-2 w-64 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <p className="font-semibold text-slate-600">Override the due week</p>
      <Input label="Due in week" type="number" min={1} value={dueWeek} onChange={e => setDueWeek(e.target.value)} />
      <Input label="Reason (recorded)" value={reason} onChange={e => setReason(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={!weekOk || !reason.trim()} onClick={() => onChange({ ...value, overrides: { ...value.overrides, [action.id]: { dueWeek: Number(dueWeek), reason: reason.trim() } } })}>Save override</Button>
        {ov && <Button size="sm" variant="outline" onClick={() => onChange({ ...value, overrides: without(value.overrides) })}>Remove</Button>}
      </div>
      <p className="pt-1 font-semibold text-slate-600">Tie to a fixed date</p>
      {!value.startDate && <p className="text-slate-500">Set the plan start date first.</p>}
      <Input label="Must be done by" type="date" value={date} disabled={!value.startDate} onChange={e => setDate(e.target.value)} />
      <Input label="What the date is for" value={label} disabled={!value.startDate} onChange={e => setLabel(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={!value.startDate || !date || !label.trim()} onClick={() => onChange({ ...value, fixedDates: { ...value.fixedDates, [action.id]: { date, label: label.trim() } } })}>Save date</Button>
        {fx && <Button size="sm" variant="outline" onClick={() => onChange({ ...value, fixedDates: without(value.fixedDates) })}>Remove</Button>}
      </div>
    </div>
  )
}
