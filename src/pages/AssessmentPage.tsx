import { useEffect, useMemo, useState } from 'react'
import { useLegacyAssessment } from '../lib/legacy-assessment'
import { LegacySaveStatus } from '../lib/legacy-state'
import { Link } from '@tanstack/react-router'
import {
  ChevronLeft, ChevronRight, Lightbulb, Lock, ShieldCheck, UploadCloud, Layers, FolderCheck,
} from 'lucide-react'
import { useAuthCtx, useWorkspace, useScoresCtx, useLensCtx, useEntityProfileCtx } from '../lib/context'
import { activeQuestions, getRiskColor, TIER_NAMES, computeTierScore, scopeLabel, archetypeMatch, ARCHETYPES } from '../lib/data'
import { Card, Button, Stepper, Toast } from '../components/ui'
import { resolveRegulatoryContext, PRIORITY_RANK } from '../lib/regulatory-context'
import { ExcelImport } from '../components/ExcelImport'
import { NotesThread } from '../components/NotesThread'
import { cn } from '../lib/utils'

const EVIDENCE_LEVELS = [
  'No Evidence', 'Drafted', 'Approved', 'Disseminated', 'Partially Implemented', 'Implemented', 'System-Enforced',
]

export function AssessmentPage() {
  const { currentUser } = useAuthCtx()
  const { currentOrg } = useWorkspace()
  const {
    scores, getScore, updateScore,
    getAssessorScore, updateAssessorScore, scoreAttribution,
  } = useScoresCtx()
  const { activeLenses, lensSaveStatus, mandateSaveStatus } = useLensCtx()
  const { entityProfile, profileSaveStatus } = useEntityProfileCtx()
  const orgId = currentOrg?.id ?? currentUser?.orgId ?? 'org-001'
  // An Independent Assessor scores the same institution on a parallel track:
  // their input is written to assessor_score (reconciled on Trust Delta), never
  // overwriting the institution's own self-assessment.
  const isIndependent = currentUser?.role === 'independent'
  const readScore = isIndependent ? getAssessorScore : getScore
  const writeScore = isIndependent ? updateAssessorScore : updateScore
  const [tier, setTier] = useState(0)
  const [domainFilter, setDomainFilter] = useState('All')
  const [toast, setToast] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [evidence, setEvidence, evidenceStatus] = useLegacyAssessment<Record<string, number>>('craft:evidence-confidence', {})

  // Only questions in the active scope (Core Foundation + active lenses) AND
  // matching the workspace's entity archetype are visible - a Private startup
  // never sees Supreme Audit questions; a Public ministry never sees Cap Table.
  const inScope = useMemo(
    () => activeQuestions(activeLenses).filter(q => archetypeMatch(q, entityProfile.archetype)),
    [activeLenses, entityProfile.archetype],
  )
  const archetypeLabel = entityProfile.archetype
    ? ARCHETYPES.find(a => a.id === entityProfile.archetype)?.label
    : null

  // Feature 1 - statutory controls injected into the wizard by the selected
  // jurisdictions + regulatory sector (set on the Data Room / Global Regulatory).
  const injectedStatutory = useMemo(() => {
    if (!entityProfile.jurisdictions.length || !entityProfile.regSector) return []
    return resolveRegulatoryContext(entityProfile.jurisdictions, entityProfile.regSector)
      .requirements.slice()
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
  }, [entityProfile.jurisdictions, entityProfile.regSector])
  const tierQuestions = useMemo(() => inScope.filter(q => q.tier === tier + 1), [inScope, tier])
  const tierDomains = useMemo(
    () => Array.from(new Set(tierQuestions.map(q => q.domain))),
    [tierQuestions],
  )
  // Reset the domain filter whenever the active tier changes.
  useEffect(() => setDomainFilter('All'), [tier])
  const visibleQuestions = useMemo(
    () => (domainFilter === 'All' ? tierQuestions : tierQuestions.filter(q => q.domain === domainFilter)),
    [tierQuestions, domainFilter],
  )
  const tierScore = computeTierScore(scores[orgId] || {}, tier + 1, activeLenses)

  return (
    <div className="space-y-6">
      <LegacySaveStatus status={evidenceStatus} />
      <LegacySaveStatus status={lensSaveStatus} />
      <LegacySaveStatus status={mandateSaveStatus} />
      <LegacySaveStatus status={profileSaveStatus} />
      <p className="text-xs text-slate-500">Evidence matrix entries are self-reported confidence, not verified uploads.</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
            <Lock className="h-4 w-4 text-emerald-600" /> Assessment Wizard
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">5-Tier Capacity Assessment</h1>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Layers className="h-3.5 w-3.5" /> Assessing Scope: {scopeLabel(activeLenses)}
          </span>
          {archetypeLabel && (
            <span className="ml-2 mt-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              <ShieldCheck className="h-3.5 w-3.5" /> Archetype: {archetypeLabel}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowImport(s => !s)}>
          <UploadCloud className="h-4 w-4" /> Bulk Import
        </Button>
      </div>

      {showImport && (
        <Card className="p-5">
          <ExcelImport orgId={orgId} onImported={() => setToast('✅ Scores imported into your assessment.')} />
        </Card>
      )}

      {injectedStatutory.length > 0 && (
        <Card className="border-emerald-200 p-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            {injectedStatutory.length} statutory controls injected by jurisdiction
          </p>
          <p className="mt-1 text-xs text-slate-500">
            These regulatory obligations are triggered by the entity's selected jurisdictions and sector, and must be
            evidenced alongside the capacity assessment.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {injectedStatutory.map(r => (
              <div key={r.code} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-semibold text-slate-500">{r.code}</span>
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    r.priority === 'Critical' ? 'bg-rose-100 text-rose-700' : r.priority === 'High' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600',
                  )}>{r.priority}</span>
                  <span className="text-[10px] text-slate-400">· {r.authority}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-700">{r.requirement}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <Stepper steps={TIER_NAMES.map((_, i) => `Tier ${i + 1}`)} current={tier} />
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Tier {tier + 1}</p>
            <p className="font-display text-lg font-bold text-emerald-900">{TIER_NAMES[tier]}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Tier completeness</p>
            <p className="text-2xl font-bold text-emerald-900">{tierScore}%</p>
          </div>
        </div>
      </Card>

      {/* Domain filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-400">Filter by domain:</span>
        {['All', ...tierDomains].map(d => {
          const active = domainFilter === d
          const count = d === 'All' ? tierQuestions.length : tierQuestions.filter(q => q.domain === d).length
          return (
            <button
              key={d}
              onClick={() => setDomainFilter(d)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                active
                  ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300',
              )}
            >
              {d} <span className="text-slate-400">· {count}</span>
            </button>
          )
        })}
      </div>

      {/* Question cards */}
      <div className="space-y-5">
        {visibleQuestions.map(q => {
          const score = readScore(orgId, q.id)
          const risk = getRiskColor(score)
          const ev = evidence[q.id] ?? 0
          const lastBy = scoreAttribution[orgId]?.[q.id]
          return (
            <Card key={q.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-600">{q.id}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-medium text-slate-500">{q.domain}</span>
                  </div>
                  <p className="mt-1.5 font-medium text-slate-800">{q.question}</p>
                </div>
                <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', risk.bg, risk.text, risk.border)}>
                  {risk.label} Risk
                </span>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{q.insight}</span>
              </div>

              {q.scoringGuide && (
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-400">{q.scoringGuide}</p>
              )}

              {/* Data Room link - evidence for this question lives in the Data Room */}
              {q.requiredDataRoomDoc && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
                  <span className="text-xs text-emerald-800">
                    <span className="font-semibold">Required Evidence:</span> {q.requiredDataRoomDoc}
                  </span>
                  <Link to="/data-room">
                    <Button variant="outline" size="sm">
                      <FolderCheck className="h-3.5 w-3.5" /> Link from Data Room
                    </Button>
                  </Link>
                </div>
              )}

              {/* Slider */}
              <div className="mt-5">
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>{isIndependent ? 'Independent maturity score' : 'Maturity score'}</span>
                  <span className="font-mono text-base font-bold text-slate-800">{score} / 5</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={1}
                  value={score}
                  onChange={e => writeScore(orgId, q.id, Number(e.target.value))}
                  className="w-full"
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                  {[0, 1, 2, 3, 4, 5].map(n => <span key={n}>{n}</span>)}
                </div>
                {lastBy && (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Last scored by <span className="font-medium text-slate-500">{lastBy}</span>
                  </p>
                )}
              </div>

              {/* 7-point evidence matrix */}
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium text-slate-500">7-Point Evidence Matrix (implementation, not paper)</p>
                <div className="grid grid-cols-7 gap-1">
                  {EVIDENCE_LEVELS.map((label, idx) => {
                    const active = idx <= ev
                    return (
                      <button
                        key={label}
                        title={label}
                        onClick={() => setEvidence(prev => ({ ...prev, [q.id]: idx }))}
                        className={cn(
                          'flex h-12 flex-col items-center justify-center rounded-md border px-1 text-center text-[8px] font-semibold leading-tight transition-colors',
                          active
                            ? idx >= 4 ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                              : idx >= 2 ? 'border-amber-400 bg-amber-100 text-amber-700'
                              : 'border-rose-300 bg-rose-100 text-rose-700'
                            : 'border-slate-200 bg-slate-50 text-slate-400',
                        )}
                      >
                        {idx + 1}
                        <span className="hidden sm:block">{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Threaded, multi-author rationale — each persona explains their
                  score in their own voice; private to the author unless shared. */}
              <NotesThread
                orgId={orgId}
                questionId={q.id}
                currentUserEmail={currentUser?.email ?? ''}
                currentUserRole={currentUser?.role ?? 'assessor'}
                isDemo={currentUser?.isDemo ?? false}
              />
            </Card>
          )
        })}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setTier(t => Math.max(0, t - 1))} disabled={tier === 0}>
          <ChevronLeft className="h-4 w-4" /> Previous Tier
        </Button>
        <Button onClick={() => setToast('Assessment saved.')}>
          <ShieldCheck className="h-4 w-4" /> Save
        </Button>
        {tier < 4 ? (
          <Button variant="outline" onClick={() => setTier(t => Math.min(4, t + 1))}>
            Next Tier <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <span className="w-32" />
        )}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
