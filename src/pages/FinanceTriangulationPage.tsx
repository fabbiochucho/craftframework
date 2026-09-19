import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Calculator,
  CheckCircle,
  Lock,
  ShieldCheck,
  Unlock,
} from 'lucide-react'
import { Accordion, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../components/ui'
import { cn } from '../lib/utils'
import { useApp } from '../lib/context'
import * as api from '../lib/api'
import { offlineDB } from '../lib/offline/db'
import { queueAndSync } from '../lib/offline/sync-engine'

type WorkflowRole = 'org_finance_officer' | 'org_grant_manager' | 'independent_assessor'
type SubmissionStatus = 'draft' | 'pending_review' | 'pending_assessor' | 'locked'
type VerificationStatus = 'verified' | 'qualified' | 'rejected'

interface DonorConfig {
  id: string
  name: string
  agreementPartyLabel: string
  grants: { id: string; name: string }[]
  reportTypes: { id: string; name: string }[]
  streams: { id: string; name: string }[]
}

interface TriangulationRecord {
  id: string
  openingBalance: number
  incomeReceived: number
  expenditures: number
  adjustments: number
  actualBankBalance: number
  financeOfficerNotes: string
  grantManagerCommentary: string
  assessorNotes: string
  verificationStatus: VerificationStatus
  status: SubmissionStatus
  lockedBy?: string
  lockedAt?: string
  history: string[]
}

const DONORS: DonorConfig[] = [
  {
    id: 'global-fund',
    name: 'Global Fund',
    agreementPartyLabel: 'Principal Recipient',
    grants: [
      { id: 'hss-2026', name: 'Health Systems Strengthening Grant' },
      { id: 'malaria-2026', name: 'Malaria Resilience Grant' },
    ],
    reportTypes: [
      { id: 'pudr', name: 'PUDR' },
      { id: 'financial-progress', name: 'Financial Progress Report' },
    ],
    streams: [
      { id: 'regular', name: 'Regular' },
      { id: 'emergency', name: 'Emergency' },
    ],
  },
  {
    id: 'usaid',
    name: 'USAID',
    agreementPartyLabel: 'Prime Recipient',
    grants: [
      { id: 'health-supply-chain', name: 'Health Supply Chain Activity' },
      { id: 'local-capacity', name: 'Local Capacity Strengthening Award' },
    ],
    reportTypes: [
      { id: 'sf-425', name: 'SF-425' },
      { id: 'disbursement-request', name: 'Disbursement Request' },
    ],
    streams: [
      { id: 'core', name: 'Core' },
      { id: 'sub-grant-a', name: 'Sub-grant A' },
    ],
  },
  {
    id: 'world-bank',
    name: 'World Bank',
    agreementPartyLabel: 'Implementing Entity',
    grants: [
      { id: 'pfm-modernization', name: 'PFM Modernization Project' },
      { id: 'climate-resilience', name: 'Climate Resilience Program' },
    ],
    reportTypes: [
      { id: 'interim-financial-report', name: 'Interim Financial Report' },
      { id: 'withdrawal-application', name: 'Withdrawal Application' },
    ],
    streams: [
      { id: 'ida-credit', name: 'IDA Credit' },
      { id: 'trust-fund', name: 'Trust Fund' },
    ],
  },
  {
    id: 'fcdo',
    name: 'FCDO',
    agreementPartyLabel: 'Delivery Partner',
    grants: [
      { id: 'governance-reform', name: 'Governance Reform Programme' },
      { id: 'humanitarian-response', name: 'Humanitarian Response Fund' },
    ],
    reportTypes: [
      { id: 'financial-progress', name: 'Financial Progress Report' },
      { id: 'claim-statement', name: 'Claim Statement' },
    ],
    streams: [
      { id: 'core', name: 'Core' },
      { id: 'tranche-2', name: 'Tranche 2' },
    ],
  },
]

const PERIODS = [
  { id: '2026-q1', label: '2026-01-01 - 2026-03-31' },
  { id: '2026-q2', label: '2026-04-01 - 2026-06-30' },
  { id: '2026-q3', label: '2026-07-01 - 2026-09-30' },
]

const ROLE_OPTIONS = [
  { value: 'org_finance_officer', label: 'Finance Officer' },
  { value: 'org_grant_manager', label: 'Grant Manager' },
  { value: 'independent_assessor', label: 'Independent Assessor' },
]

const BASELINE: Record<string, TriangulationRecord> = {
  'usaid|health-supply-chain|sf-425|core|2026-q1': {
    id: 'usaid-q1',
    openingBalance: 425000,
    incomeReceived: 920000,
    expenditures: 1180000,
    adjustments: -2500,
    actualBankBalance: 162500,
    financeOfficerNotes: 'Timing difference relates to unpresented payments and a minor bank charge pending posting.',
    grantManagerCommentary: 'Variance explanation aligns with procurement close-out and verified distribution milestones.',
    assessorNotes: '',
    verificationStatus: 'verified',
    status: 'pending_assessor',
    history: [
      '2026-04-03 09:20 - Finance Officer updated Expenditures to $1,180,000.',
      '2026-04-04 14:15 - Grant Manager approved variance explanations.',
    ],
  },
  'world-bank|pfm-modernization|interim-financial-report|ida-credit|2026-q1': {
    id: 'wb-q1',
    openingBalance: 780000,
    incomeReceived: 1450000,
    expenditures: 1515000,
    adjustments: 10000,
    actualBankBalance: 725000,
    financeOfficerNotes: 'Foreign exchange gain booked after period-end bank statement extraction.',
    grantManagerCommentary: '',
    assessorNotes: '',
    verificationStatus: 'verified',
    status: 'pending_review',
    history: ['2026-04-02 11:05 - Finance Officer submitted cash-flow reconciliation for review.'],
  },
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0)
}

function nowStamp() {
  return new Date().toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function emptyRecord(key: string): TriangulationRecord {
  return {
    id: key,
    openingBalance: 0,
    incomeReceived: 0,
    expenditures: 0,
    adjustments: 0,
    actualBankBalance: 0,
    financeOfficerNotes: '',
    grantManagerCommentary: '',
    assessorNotes: '',
    verificationStatus: 'verified',
    status: 'draft',
    history: [],
  }
}

const statusStyle: Record<SubmissionStatus, string> = {
  draft: 'border-slate-300 bg-slate-100 text-slate-700',
  pending_review: 'border-amber-300 bg-amber-100 text-amber-700',
  pending_assessor: 'border-blue-300 bg-blue-100 text-blue-700',
  locked: 'border-emerald-300 bg-emerald-100 text-emerald-700',
}

const statusLabel: Record<SubmissionStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  pending_assessor: 'Pending Assessor',
  locked: 'Locked',
}

function NumberInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  return (
    <Input
      label={label}
      type="number"
      value={Number.isNaN(value) ? '' : value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      className="font-mono tabular-nums disabled:bg-slate-100 disabled:text-slate-500"
    />
  )
}

export function FinanceTriangulationPage() {
  const { currentUser } = useApp()
  const queryClient = useQueryClient()
  const [role, setRole] = useState<WorkflowRole>('org_finance_officer')
  const [donorId, setDonorId] = useState(DONORS[0].id)
  const donor = DONORS.find((d) => d.id === donorId) ?? DONORS[0]
  const [grantId, setGrantId] = useState(donor.grants[0].id)
  const [reportTypeId, setReportTypeId] = useState(donor.reportTypes[0].id)
  const [streamId, setStreamId] = useState(donor.streams[0].id)
  const [periodId, setPeriodId] = useState(PERIODS[0].id)
  const [record, setRecord] = useState<TriangulationRecord>(() => emptyRecord('initial'))
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    setGrantId(donor.grants[0].id)
    setReportTypeId(donor.reportTypes[0].id)
    setStreamId(donor.streams[0].id)
  }, [donor.id])

  const contextKey = `${donorId}|${grantId}|${reportTypeId}|${streamId}|${periodId}`
  const orgId = currentUser?.orgId ?? 'demo'
  const periodLabel = PERIODS.find((p) => p.id === periodId)?.label ?? periodId
  const reportTypeLabel = donor.reportTypes.find((r) => r.id === reportTypeId)?.name ?? reportTypeId
  const userName = currentUser?.email?.split('@')[0] || 'Current User'
  const assessorName = role === 'independent_assessor' ? userName : 'Independent Assessor'

  const baselineQuery = useQuery({
    queryKey: ['financial-triangulation', orgId, contextKey],
    queryFn: async () => {
      const persisted = await api.fetchFinancialTriangulation(orgId, contextKey)
      if (persisted) return persisted
      return BASELINE[contextKey] ? { ...BASELINE[contextKey], history: [...BASELINE[contextKey].history] } : emptyRecord(contextKey)
    },
  })

  useEffect(() => {
    if (baselineQuery.data) setRecord(baselineQuery.data)
  }, [baselineQuery.data])

  const expectedClosing = useMemo(
    () => record.openingBalance + record.incomeReceived - record.expenditures + record.adjustments,
    [record.openingBalance, record.incomeReceived, record.expenditures, record.adjustments],
  )
  const variance = expectedClosing - record.actualBankBalance
  const locked = record.status === 'locked'
  const financeCanEdit = role === 'org_finance_officer' && !locked
  const managerCanEdit = role === 'org_grant_manager' && !locked
  const assessorCanEdit = role === 'independent_assessor' && !locked

  const saveMutation = useMutation({
    mutationFn: async (next: TriangulationRecord) => {
      BASELINE[contextKey] = next
      const payload = {
        ...next,
        orgId,
        contextKey,
        donorId,
        grantId,
        reportTypeId,
        streamId,
        periodId,
      }
      // Local-first: persist the running total as a draft for zero-latency
      // reload, then queue the authoritative write. queueAndSync flushes right
      // away when online and safely holds the state in IndexedDB when offline;
      // the dedupeKey means only the latest reconciliation state is synced, not
      // every keystroke.
      const draftKey = `triangulation:${orgId}:${contextKey}`
      void offlineDB.putDraft(draftKey, payload)
      void queueAndSync({
        kind: 'financial-triangulation',
        endpoint: '/api/financial-triangulation',
        method: 'POST',
        body: payload,
        dedupeKey: draftKey,
      })
      return next
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['financial-triangulation', orgId, contextKey], next)
      setRecord(next)
    },
  })

  const patchRecord = (patch: Partial<TriangulationRecord>, history?: string) => {
    setRecord((prev) => {
      const next = { ...prev, ...patch, history: history ? [...prev.history, history] : prev.history }
      saveMutation.mutate(next)
      return next
    })
  }

  const submitForReview = () => {
    patchRecord({ status: 'pending_review' }, `${nowStamp()} - ${userName} submitted the reconciliation for Grant Manager review.`)
  }

  const approveForAssessor = () => {
    patchRecord({ status: 'pending_assessor' }, `${nowStamp()} - ${userName} approved variance explanations for independent verification.`)
  }

  const lockSubmission = () => {
    const stamp = nowStamp()
    patchRecord(
      { status: 'locked', lockedBy: assessorName, lockedAt: stamp },
      `${stamp} - ${assessorName} ${record.verificationStatus} and Locked the submission.`,
    )
    setShowConfirm(false)
  }

  const showEmptyState = !baselineQuery.isLoading && record.history.length === 0 && expectedClosing === 0 && record.actualBankBalance === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <Calculator className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Financial Triangulation & Reconciliation Engine</span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold text-slate-900">Universal Donor Reconciliation</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Select a donor context, enter the period cash flow, explain variance drivers, and lock the final verified submission through an independent assessor workflow.
          </p>
        </div>
        <Badge className={cn('border', statusStyle[record.status])}>
          {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          {statusLabel[record.status]}
        </Badge>
      </div>

      {locked && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Locked by {record.lockedBy} on {record.lockedAt}. No further edits are permitted for this reporting period.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Report Context</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Select label="Donor/Funding Agency" value={donorId} onChange={setDonorId} options={DONORS.map((d) => ({ value: d.id, label: d.name }))} />
            <Select label="Grant/Project Name" value={grantId} onChange={setGrantId} options={donor.grants.map((g) => ({ value: g.id, label: g.name }))} />
            <Select label="Report Type" value={reportTypeId} onChange={setReportTypeId} options={donor.reportTypes.map((r) => ({ value: r.id, label: r.name }))} />
            <Select label="Funding Stream/Tranche" value={streamId} onChange={setStreamId} options={donor.streams.map((s) => ({ value: s.id, label: s.name }))} />
            <Select label="Reporting Period" value={periodId} onChange={setPeriodId} options={PERIODS.map((p) => ({ value: p.id, label: p.label }))} />
            <Select label="Workflow Role" value={role} onChange={(value) => setRole(value as WorkflowRole)} options={ROLE_OPTIONS} />
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500">
            Current agreement term: <span className="text-slate-800">{donor.agreementPartyLabel}</span>
          </p>
        </CardContent>
      </Card>

      {showEmptyState && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
          No triangulation data found for this period. Finance Officer, please input the opening balances and cash flows to begin.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className={cn('relative overflow-hidden', locked && 'border-emerald-300 bg-emerald-50/30')}>
          {locked && <div className="pointer-events-none absolute inset-0 bg-emerald-500/5" />}
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {locked ? <Lock className="h-4 w-4 text-emerald-600" /> : <Calculator className="h-4 w-4 text-emerald-600" />}
              Cash Flow Triangulation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberInput label="Opening Cash Balance" value={record.openingBalance} disabled={!financeCanEdit} onChange={(v) => patchRecord({ openingBalance: v }, `${nowStamp()} - ${userName} updated Opening Cash Balance to ${formatMoney(v)}.`)} />
              <NumberInput label="Total Income/Disbursements Received" value={record.incomeReceived} disabled={!financeCanEdit} onChange={(v) => patchRecord({ incomeReceived: v }, `${nowStamp()} - ${userName} updated Income to ${formatMoney(v)}.`)} />
              <NumberInput label="Total Expenditures/Cash Outflows" value={record.expenditures} disabled={!financeCanEdit} onChange={(v) => patchRecord({ expenditures: v }, `${nowStamp()} - ${userName} updated Expenditures to ${formatMoney(v)}.`)} />
              <NumberInput label="Reconciling Adjustments" value={record.adjustments} disabled={!financeCanEdit} onChange={(v) => patchRecord({ adjustments: v }, `${nowStamp()} - ${userName} updated Adjustments to ${formatMoney(v)}.`)} />
            </div>
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Expected Closing Cash Balance</p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-emerald-700">{formatMoney(expectedClosing)}</p>
              <p className="mt-1 text-xs text-emerald-700">Opening + Income - Expenditures +/- Adjustments</p>
            </div>
          </CardContent>
        </Card>

        <Card className={cn('relative overflow-hidden', locked && 'border-emerald-300 bg-emerald-50/30')}>
          {locked && <div className="pointer-events-none absolute inset-0 bg-emerald-500/5" />}
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {locked ? <Lock className="h-4 w-4 text-emerald-600" /> : <Calculator className="h-4 w-4 text-emerald-600" />}
              Bank Reconciliation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NumberInput label="Actual Bank Statement Balance" value={record.actualBankBalance} disabled={!financeCanEdit} onChange={(v) => patchRecord({ actualBankBalance: v }, `${nowStamp()} - ${userName} updated Bank Statement Balance to ${formatMoney(v)}.`)} />
            <div className={cn('mt-5 rounded-xl border px-5 py-4', variance === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50')}>
              <div className="flex items-center gap-3">
                {variance === 0 ? <CheckCircle className="h-8 w-8 text-emerald-600" /> : <AlertTriangle className="h-8 w-8 text-rose-500" />}
                <div>
                  <p className={cn('text-sm font-semibold', variance === 0 ? 'text-emerald-800' : 'text-rose-700')}>
                    {variance === 0 ? 'Reconciled' : 'Variance Detected'}
                  </p>
                  <p className={cn('font-mono text-3xl font-bold tabular-nums', variance === 0 ? 'text-emerald-700' : 'text-rose-600')}>
                    {formatMoney(variance)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={cn(locked && 'border-emerald-300 bg-emerald-50/30')}>
        <CardHeader>
          <CardTitle>Review & Commentary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Finance Officer Notes
              <textarea
                value={record.financeOfficerNotes}
                disabled={!financeCanEdit && !managerCanEdit}
                onChange={(e) => patchRecord({ financeOfficerNotes: e.target.value })}
                className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Grant Manager Commentary
              <textarea
                value={record.grantManagerCommentary}
                disabled={!managerCanEdit}
                onChange={(e) => patchRecord({ grantManagerCommentary: e.target.value })}
                className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {role === 'org_finance_officer' && (
              <Button onClick={submitForReview} disabled={locked || saveMutation.isPending}>Submit for Grant Manager Review</Button>
            )}
            {role === 'org_grant_manager' && (
              <Button onClick={approveForAssessor} disabled={locked || saveMutation.isPending}>Approve for Independent Verification</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {role === 'independent_assessor' && (
        <div className="rounded-xl bg-slate-900 p-6 text-white shadow-xl">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <div>
              <h2 className="font-display text-xl font-bold">Assessor Verification Panel</h2>
              <p className="text-sm text-slate-300">Independent verification for {reportTypeLabel} - {periodLabel}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Select
              label="Verification Status"
              value={record.verificationStatus}
              onChange={(value) => patchRecord({ verificationStatus: value as VerificationStatus })}
              options={[
                { value: 'verified', label: 'Verified' },
                { value: 'qualified', label: 'Qualified' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              className="lg:col-span-1 [&_label]:text-slate-200"
            />
            <label className="block text-sm font-medium text-slate-200 lg:col-span-2">
              Assessor Audit Notes
              <textarea
                value={record.assessorNotes}
                disabled={!assessorCanEdit}
                onChange={(e) => patchRecord({ assessorNotes: e.target.value })}
                className="mt-1 min-h-28 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:bg-slate-800/60 disabled:text-slate-400"
              />
            </label>
          </div>
          <Button
            size="lg"
            disabled={locked || saveMutation.isPending}
            onClick={() => setShowConfirm(true)}
            className="mt-5 bg-emerald-600 shadow-lg shadow-emerald-500/40 hover:bg-emerald-500"
          >
            <Lock className="h-5 w-5" />
            Verify & Lock Submission
          </Button>
        </div>
      )}

      <Accordion title="Submission History">
        {record.history.length === 0 ? (
          <p className="text-slate-400">No submission history has been recorded for this context.</p>
        ) : (
          <ul className="space-y-2">
            {record.history.map((item, index) => (
              <li key={`${item}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
                {item}
              </li>
            ))}
          </ul>
        )}
      </Accordion>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-amber-500" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Lock financial triangulation?</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Are you sure? This will lock the financial triangulation for {reportTypeLabel} - {periodLabel}. No further edits will be permitted.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button onClick={lockSubmission}>
                <ShieldCheck className="h-4 w-4" />
                Confirm Lock
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
