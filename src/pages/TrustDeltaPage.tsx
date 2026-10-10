import { useEffect, useMemo, useState, Fragment, type ReactNode } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
  LabelList,
} from 'recharts'
import {
  Scale,
  Gavel,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileText,
  X,
  Info,
  TrendingUp,
} from 'lucide-react'
import { cn } from '../lib/utils'
import {
  TRUST_DELTA_SEED,
  optimismBias,
  variance,
  paperCompliancePenalty,
  scaleMax,
  OMT_LEVELS,
  type TrustDeltaRow,
} from '../lib/frameworks'
import {
  Card,
  CardContent,
  Badge,
  Button,
  Input,
  Stat,
} from '../components/ui'
import { useAuthCtx, useAuditCtx, useQuestionsCtx, useWorkspace } from '../lib/context'
import * as api from '../lib/api'
import { useLegacyAssessment } from '../lib/legacy-assessment'
import { LegacySaveStatus } from '../lib/legacy-state'

// ---------------------------------------------------------------------------
// Mock PR evidence narratives - what the PR submitted to justify the self-score.
// Keyed by Q_ID; falls back to a generic line so the modal is never empty.
// ---------------------------------------------------------------------------
const PR_EVIDENCE: Record<string, string> = {
  'OMT-FIN-01':
    'PR submitted a board-approved Finance Policy Manual (v4, 2025) and a chart of accounts. Monthly management accounts were attached for Q1–Q2. No reconciliation logs or variance-analysis memos were provided to demonstrate the system is actually used for decisions.',
  'OMT-GOV-01':
    'Board charter and a register of 11 directors supplied. Minutes for two of the last four quarterly meetings were attached; the remaining two were described as "pending sign-off".',
  'OMT-HR-01':
    'Signed job descriptions for all 24 staff and an organogram dated Jan 2026 were provided. Staff survey indicated 91% role clarity.',
  'OMT-TECH-01':
    'PR listed a cloud accounting subscription and a shared drive. No IT asset register, systems-review schedule, or helpdesk/incident logs were attached; two outages in the last quarter were acknowledged verbally.',
  'OMT-ADMIN-01':
    'Operations manual and procurement policy provided; both consistently referenced in sampled procurement files.',
  'OMT-MEL-01':
    'A logframe and an indicator tracking table were submitted. No evidence that findings were reviewed in management meetings or fed back into program adaptation was provided.',
}

const ASSESSOR_NOTE: Record<string, string> = {
  'OMT-FIN-01':
    'Policy exists on paper but no operational artefacts evidence its use. Sampled vouchers showed unapproved manual journals. Recommend Level 2 pending reconciliation evidence.',
  'OMT-GOV-01':
    'Oversight is real but follow-through on board resolutions is partial. Two meetings undocumented. Level 3.',
  'OMT-HR-01':
    'Documentation and survey corroborate. No divergence - Level 3 confirmed.',
  'OMT-TECH-01':
    'No asset register or review cadence; recurring outages contradict the self-rating. Level 1.',
  'OMT-ADMIN-01':
    'Field sampling confirms consistent application. No divergence - Level 2.',
  'OMT-MEL-01':
    'Measurement instruments exist but evidence of use for learning/adaptation is absent. Level 2.',
}

const NEG_RANGE_HINT = 'Enter a score within the question’s scale'

// SoE anchor lookup against the OMT 4-level scale (guarded for bounds).
function omtAnchor(score: number): string | undefined {
  const idx = score - 1
  if (idx < 0 || idx >= OMT_LEVELS.length) return undefined
  return OMT_LEVELS[idx]?.anchor
}
function omtLabel(score: number): string | undefined {
  const idx = score - 1
  if (idx < 0 || idx >= OMT_LEVELS.length) return undefined
  return OMT_LEVELS[idx]?.label
}

export function TrustDeltaPage() {
  const { currentUser, isDemo } = useAuthCtx()
  const { logActivity } = useAuditCtx()
  const { questions } = useQuestionsCtx()
  const { currentOrg, readOnly } = useWorkspace()
  const orgId = currentOrg?.id ?? currentUser?.orgId
  const [justifications, setJustifications, justificationStatus] = useLegacyAssessment<Record<string, string>>('trust-delta:justifications', {})
  // Demo sessions are seeded with an illustrative reconciliation register; a live
  // workspace starts empty until self vs independent scores are recorded.
  const [rows, setRows] = useState<TrustDeltaRow[]>(() =>
    isDemo ? TRUST_DELTA_SEED.map(r => ({ ...r })) : [],
  )
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  // Consensus narrative per Q_ID - the mandatory comment and the optional
  // assessor justification recorded during the debrief. Held alongside `rows`
  // so reopening a reconciled row restores what was written.
  const [consensus, setConsensus] = useState<Record<string, { comment: string; justification: string }>>({})

  // Hydrate previously-recorded negotiated scores and consensus notes for a
  // live (non-demo) workspace. Demo sessions stay entirely in-memory by design.
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setRows(isDemo ? TRUST_DELTA_SEED.map(r => ({ ...r })) : [])
    setConsensus({})
    setSelectedRow(null)
    if (!orgId || isDemo) return
    let active = true
    api.fetchResponseRecords(orgId).then(({ scores, details }) => {
      if (!active) return
      setRows(Object.entries(details).filter(([qId, d]) => d.assessorScore != null && scores[qId] != null).map(([qId, d]) => ({
        qId, domain: questions.find(q => q.id === qId)?.domain ?? qId.split('-')[0], question: questions.find(q => q.id === qId)?.question ?? qId,
        prScore: scores[qId], assessorScore: d.assessorScore!,
        negotiatedScore: d.negotiatedScore, scale: qId.startsWith('OMT-') ? 'omt-1-4' : 'fiduciary-0-5',
      })))
      setConsensus(prev => {
        const next = { ...prev }
        for (const [qId, d] of Object.entries(details)) {
          if (d.notes != null) next[qId] = { comment: d.notes, justification: next[qId]?.justification ?? '' }
        }
        return next
      })
    }).catch(() => { if (active) setError('Unable to load the response register. Please reconnect and reload.') })
    return () => {
      active = false
    }
  }, [orgId, isDemo, questions])


  // ---- summary metrics -----------------------------------------------------
  const avgOptimismBias = useMemo(() => {
    if (rows.length === 0) return 0
    const sum = rows.reduce((acc, r) => acc + optimismBias(r), 0)
    return Math.round((sum / rows.length) * 10) / 10
  }, [rows])

  const reconciled = rows.filter(r => r.negotiatedScore != null).length
  const flaggedPaper = useMemo(
    () =>
      rows.filter(
        r =>
          r.negotiatedScore != null &&
          paperCompliancePenalty(r.negotiatedScore, !!r.evidenceWeak).triggered,
      ).length,
    [rows],
  )

  // ---- diverging chart data -------------------------------------------------
  // PR self-score plots positive (emerald, right); assessor plots negative
  // (rose, left). Symmetric domain across the OMT max.
  const chartMax = useMemo(
    () => Math.max(5, ...rows.map(r => scaleMax(r.scale ?? 'omt-1-4'))),
    [rows],
  )
  const chartData = useMemo(
    () =>
      rows.map(r => ({
        qId: r.qId,
        pr: r.prScore,
        assessorNeg: -r.assessorScore,
      })),
    [rows],
  )

  const saveConsensus = async (idx: number, negotiated: number, comment: string, justification: string) => {
    const row = rows[idx]
    if (readOnly) return
    if (currentUser && !isDemo) {
      try {
        await api.saveResponseDetail(orgId!, row.qId,
          { negotiatedScore: negotiated, assessorScore: row.assessorScore, notes: comment }, currentUser.email)
      } catch {
        setError('Consensus was not saved. Please reconnect and retry.')
        return
      }
    }
    setRows(prev =>
      prev.map((r, i) => (i === idx ? { ...r, negotiatedScore: negotiated } : r)),
    )
    setConsensus(prev => ({ ...prev, [row.qId]: { comment, justification } }))
    setJustifications(prev => ({ ...prev, [row.qId]: justification }))
    // Persist the negotiated outcome to the audit register for live sessions.
    // The mandatory consensus comment is stored as the response note; the
    // assessor's proposed score is captured for the Trust Delta record.
    if (currentUser && !isDemo) {
      logActivity('Recorded negotiated consensus', `${row.qId} → ${negotiated}`, 'Assessment')
    }
    setSelectedRow(null)
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <LegacySaveStatus status={justificationStatus} />
      {/* Header --------------------------------------------------------------*/}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Scale className="h-3.5 w-3.5 text-emerald-600" />
            Independent Assurance · Facilitated Debrief
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            Trust Delta &amp; Negotiated Consensus
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Reconcile the Principal Recipient&rsquo;s self-assessment against the
            independent assessor / LFA score. Diverging scores are negotiated to a
            single validated figure through a structured, evidence-anchored debrief.
          </p>
        </div>
        <Badge className="self-start border-slate-300 bg-slate-50 text-slate-600" variant="outline">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" /> OMT v6 · Audit mode
        </Badge>
      </div>

      {/* Summary stats -------------------------------------------------------*/}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Scale className="h-7 w-7" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-700">No reconciliation records yet</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Once a self-assessment and an independent assessor / LFA score are recorded for this
              institution, diverging scores appear here for a facilitated, evidence-anchored debrief.
              Explore the demo workspace to see a fully populated Trust Delta.
            </p>
          </CardContent>
        </Card>
      ) : (
      <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Optimism Bias %"
          value={`${avgOptimismBias > 0 ? '+' : ''}${avgOptimismBias}%`}
          hint="Mean PR over-scoring vs assessor, % of scale"
          accent={avgOptimismBias >= 25 ? 'rose' : avgOptimismBias >= 10 ? 'amber' : 'emerald'}
        />
        <Stat
          label="Questions in scope"
          value={rows.length}
          hint="OMT v6 Statements of Excellence"
          accent="slate"
        />
        <Stat
          label="Consensus reached"
          value={`${reconciled}/${rows.length}`}
          hint="Negotiated score recorded"
          accent={reconciled === rows.length ? 'emerald' : 'amber'}
        />
        <Stat
          label="Paper-compliance flags"
          value={flaggedPaper}
          hint="Capped at Level 2 (Basic)"
          accent={flaggedPaper > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* Diverging bar chart -------------------------------------------------*/}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Trust Delta - Self vs Independent
              </h2>
              <p className="text-sm text-slate-500">
                Per question: PR self-score (right) vs assessor / LFA score (left). The
                wider the divergence across the centre line, the larger the trust gap.
              </p>
            </div>
            <TrendingUp className="hidden h-6 w-6 text-emerald-500 sm:block" />
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                stackOffset="sign"
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                barCategoryGap="24%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[-chartMax, chartMax]}
                  ticks={[-chartMax, -2, 0, 2, chartMax]}
                  tickFormatter={(v: number) => `${Math.abs(v)}`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  type="category"
                  dataKey="qId"
                  width={104}
                  tick={{ fontSize: 11, fill: '#475569', fontFamily: 'JetBrains Mono, monospace' }}
                  stroke="#cbd5e1"
                />
                <ReferenceLine x={0} stroke="#0f172a" strokeWidth={1.5} />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                  formatter={(value, name) => [
                    Math.abs(Number(value)),
                    String(name),
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  iconType="circle"
                />
                <Bar dataKey="pr" name="PR Self-Score" radius={[0, 4, 4, 0]}>
                  {chartData.map(d => (
                    <Cell key={`pr-${d.qId}`} fill="#10b981" />
                  ))}
                  <LabelList
                    dataKey="pr"
                    position="right"
                    formatter={(v: ReactNode) => `${v}`}
                    style={{ fontSize: 11, fill: '#047857', fontWeight: 600 }}
                  />
                </Bar>
                <Bar
                  dataKey="assessorNeg"
                  name="Assessor / LFA Score"
                  radius={[4, 0, 0, 4]}
                >
                  {chartData.map(d => (
                    <Cell key={`as-${d.qId}`} fill="#f43f5e" />
                  ))}
                  <LabelList
                    dataKey="assessorNeg"
                    position="left"
                    formatter={(v: ReactNode) => `${Math.abs(Number(v))}`}
                    style={{ fontSize: 11, fill: '#be123c', fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Reconciliation table ------------------------------------------------*/}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 font-display text-xl font-bold text-slate-900">
            Reconciliation Register
          </h2>
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Q_ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Question</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">PR</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Assessor</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Variance</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Negotiated</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => {
                  const v = variance(r)
                  const penalty =
                    r.negotiatedScore != null
                      ? paperCompliancePenalty(r.negotiatedScore, !!r.evidenceWeak)
                      : { triggered: false as const }
                  const displayNeg = penalty.triggered
                    ? penalty.cappedScore
                    : r.negotiatedScore
                  return (
                    <Fragment key={r.qId}>
                      <tr className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.qId}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <div className="font-medium text-slate-800">{r.question}</div>
                          <div className="text-xs text-slate-400">{r.domain}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
                            {r.prScore}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-sm font-bold text-rose-700">
                            {r.assessorScore}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            className={cn(
                              v > 1
                                ? 'bg-rose-100 text-rose-700'
                                : v === 1
                                  ? 'bg-amber-100 text-amber-700'
                                  : v === 0
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-emerald-100 text-emerald-700',
                            )}
                          >
                            {v > 0 ? `+${v}` : v}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {displayNeg != null ? (
                            <span
                              className={cn(
                                'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold',
                                penalty.triggered
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-900 text-white',
                              )}
                            >
                              {displayNeg}
                              {penalty.triggered && (
                                <AlertTriangle className="ml-1 h-3.5 w-3.5" />
                              )}
                            </span>
                          ) : (
                            <span className="text-xs italic text-slate-400">pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant={r.negotiatedScore != null ? 'outline' : 'primary'}
                            size="sm"
                            disabled={readOnly}
                            onClick={() => setSelectedRow(i)}
                          >
                            <Gavel className="h-3.5 w-3.5" />
                            {r.negotiatedScore != null ? 'Review' : 'Open Debrief'}
                          </Button>
                        </td>
                      </tr>
                      {penalty.triggered && (
                        <tr>
                          <td colSpan={7} className="bg-amber-50/60 px-4 pb-3">
                            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>{penalty.message}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {/* Facilitated Debrief modal ------------------------------------------*/}
      {selectedRow != null && rows[selectedRow] && (
        <DebriefModal
          isDemo={isDemo}
          row={rows[selectedRow]}
          initialComment={consensus[rows[selectedRow].qId]?.comment ?? ''}
          initialJustification={justifications[rows[selectedRow].qId] ?? consensus[rows[selectedRow].qId]?.justification ?? ''}
          onClose={() => setSelectedRow(null)}
          onSave={(negotiated, comment, justification) =>
            saveConsensus(selectedRow, negotiated, comment, justification)
          }
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Facilitated Debrief modal - split-screen consensus workspace.
// ---------------------------------------------------------------------------
function DebriefModal({
  isDemo,
  row,
  initialComment,
  initialJustification,
  onClose,
  onSave,
}: {
  isDemo: boolean
  row: TrustDeltaRow
  initialComment: string
  initialJustification: string
  onClose: () => void
  onSave: (negotiated: number, comment: string, justification: string) => void
}) {
  const [negotiatedRaw, setNegotiatedRaw] = useState<string>(
    row.negotiatedScore != null ? String(row.negotiatedScore) : '',
  )
  const [justification, setJustification] = useState<string>(initialJustification)
  const [comment, setComment] = useState<string>(initialComment)

  const negotiatedNum = Number(negotiatedRaw)
  const negValid =
    negotiatedRaw.trim() !== '' &&
    Number.isFinite(negotiatedNum) &&
    negotiatedNum >= (row.scale === 'omt-1-4' || row.scale === 'oca-1-4' ? 1 : 0) &&
    negotiatedNum <= scaleMax(row.scale ?? 'fiduciary-0-5')
  const commentValid = comment.trim().length > 0
  const canSave = negValid && commentValid

  const livePenalty = negValid
    ? paperCompliancePenalty(negotiatedNum, !!row.evidenceWeak)
    : { triggered: false as const }

  const prAnchor = omtAnchor(row.prScore)
  const asAnchor = omtAnchor(row.assessorScore)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* modal header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Gavel className="h-3.5 w-3.5 text-emerald-600" /> Facilitated Debrief
            </div>
            <h3 className="mt-1 font-display text-xl font-bold text-slate-900">
              {row.question}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono text-slate-700">{row.qId}</span>
              <span>·</span>
              <span>{row.domain}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {/* live paper-compliance banner */}
          {livePenalty.triggered && (
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0" />
              <div>
                <p className="font-semibold">{livePenalty.message}</p>
                <p className="mt-0.5 text-xs">
                  Recorded final score will be capped at{' '}
                  <span className="font-bold">Level {livePenalty.cappedScore}</span> until
                  operational evidence is supplied.
                </p>
              </div>
            </div>
          )}

          {/* split screen: PR (left) vs Assessor (right) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* LEFT - PR */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  PR Self-Assessment
                </span>
                <ScorePill score={row.prScore} tone="emerald" />
              </div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Submitted evidence
              </p>
              <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{isDemo ? PR_EVIDENCE[row.qId] ?? 'No supporting narrative supplied by the PR.' : 'Review the actual documents in the secure workspace Evidence registry.'}</span>
              </div>
            </div>

            {/* RIGHT - Assessor */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                  Independent Assessor / LFA
                </span>
                <ScorePill score={row.assessorScore} tone="rose" />
              </div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Proposed score justification
              </p>
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>{isDemo ? ASSESSOR_NOTE[row.qId] ?? 'Assessor justification pending.' : 'Record the independent rationale below. No illustrative assessor note applies to this record.'}</span>
              </div>
              <textarea
                value={justification}
                onChange={e => setJustification(e.target.value)}
                rows={3}
                placeholder="Add assessor field-verification notes (optional)…"
                className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
              />
            </div>
          </div>

          {/* CENTER band - Statements of Excellence for both levels */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Info className="h-3.5 w-3.5" /> OMT v6 Statements of Excellence
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SoeCard
                heading="PR claimed level"
                level={row.prScore}
                label={omtLabel(row.prScore)}
                anchor={prAnchor}
                tone="emerald"
              />
              <SoeCard
                heading="Assessor proposed level"
                level={row.assessorScore}
                label={omtLabel(row.assessorScore)}
                anchor={asAnchor}
                tone="rose"
              />
            </div>
          </div>

          {/* Negotiated consensus controls */}
          <div className="mt-5 rounded-xl border border-slate-300 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <Scale className="h-4 w-4 text-emerald-600" />
              <span className="font-display text-base font-bold text-slate-900">
                Negotiated Consensus
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[160px_1fr]">
              <div>
                <Input
                  label="Negotiated Score (0–5)"
                  type="number"
                  min={0}
                  max={5}
                  step={1}
                  value={negotiatedRaw}
                  onChange={e => setNegotiatedRaw(e.target.value)}
                  error={
                    negotiatedRaw.trim() !== '' && !negValid ? NEG_RANGE_HINT : undefined
                  }
                />
                {negValid && livePenalty.triggered && (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    Effective: Level {livePenalty.cappedScore}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Consensus comment <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  placeholder="Markdown supported. Record the rationale for the agreed score and any agreed remediation actions. This comment is mandatory and forms part of the audit trail."
                  className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {!commentValid && (
                  <p className="mt-1 text-xs text-slate-400">
                    A consensus comment is required to save.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* modal footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <p className="text-xs text-slate-400">
            Saving records the negotiated score to the audit register.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!canSave}
              onClick={() => onSave(negotiatedNum, comment.trim(), justification.trim())}
            >
              <CheckCircle2 className="h-4 w-4" />
              Save Consensus
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------
function ScorePill({ score, tone }: { score: number; tone: 'emerald' | 'rose' }) {
  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-bold',
        tone === 'emerald' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white',
      )}
    >
      {score}
    </span>
  )
}

function SoeCard({
  heading,
  level,
  label,
  anchor,
  tone,
}: {
  heading: string
  level: number
  label?: string
  anchor?: string
  tone: 'emerald' | 'rose'
}): ReactNode {
  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-3',
        tone === 'emerald' ? 'border-emerald-200' : 'border-rose-200',
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {heading}
        </span>
        <Badge
          className={cn(
            tone === 'emerald'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-rose-100 text-rose-700',
          )}
        >
          L{level}
          {label ? ` · ${label}` : ''}
        </Badge>
      </div>
      <p className="text-sm text-slate-600">
        {anchor ?? 'No Statement of Excellence defined for this level on the OMT scale.'}
      </p>
    </div>
  )
}
