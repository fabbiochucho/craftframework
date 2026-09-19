import { useMemo } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Link } from '@tanstack/react-router'
import { Lock, AlertOctagon, ShieldCheck, ArrowRight, Gauge, ClipboardList, Globe, Radio } from 'lucide-react'
import { useApp } from '../lib/context'
import {
  computeOrgScore, computeTierScore, computeCompositeIndices,
  getAccreditation, deriveFindings, severityStyle, PAPER_COMPLIANCE_THRESHOLD,
  TIER_NAMES, answeredCount, CLIMATE_QUESTIONS, lensQuestionCount,
} from '../lib/data'
import {
  Card, CardHeader, CardTitle, CardContent, Stat, StatusBadge, ProgressBar, Button,
  Table, Thead, Tbody, Th, Td,
} from '../components/ui'

export function DashboardPage() {
  const { currentUser, currentOrg, scores, cipStatuses, implementationEvidence, activeLenses } = useApp()
  const orgScores = currentOrg ? scores[currentOrg.id] || {} : {}

  const composite = useMemo(() => computeOrgScore(orgScores), [orgScores])
  const indices = useMemo(() => computeCompositeIndices(orgScores, activeLenses), [orgScores, activeLenses])
  const tiers = useMemo(
    () => TIER_NAMES.map((name, i) => ({ name: name.split(' ')[0], full: name, value: computeTierScore(orgScores, i + 1, activeLenses) })),
    [orgScores, activeLenses],
  )
  const findings = useMemo(() => deriveFindings(orgScores), [orgScores])
  const answered = answeredCount(orgScores)
  const accred = getAccreditation(composite, implementationEvidence)
  const penalty = answered > 0 && implementationEvidence < PAPER_COMPLIANCE_THRESHOLD
  const criticalFindings = findings.filter(f => f.severity === 'Critical')
  const offTrack = findings.filter(f => cipStatuses[f.id] === 'Off-Track').length
  // Climate & ESG lens prompt - active lens but no climate questions answered yet.
  const climateAnswered = CLIMATE_QUESTIONS.filter(q => q.id in orgScores).length
  const climatePrompt = activeLenses.climate && answered > 0 && climateAnswered === 0

  // The live wallboard opens in a new tab so it can be thrown onto a second
  // screen while work continues here. Demo sessions carry their role through the
  // query string so the new tab bootstraps the same seeded session.
  const wallboardHref = currentUser?.isDemo
    ? `/wallboard?demo=${currentUser.role === 'portfolio' ? 'portfolio' : 'assessor'}`
    : '/wallboard'

  // Empty workspace - no answers yet.
  if (answered === 0) {
    return (
      <div className="space-y-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <Lock className="h-4 w-4 text-emerald-600" /> Secure Workspace:{' '}
            <span className="text-slate-800">{currentUser?.orgName}</span>
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Readiness Dashboard</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center py-20 text-center">
            <ClipboardList className="h-14 w-14 text-slate-300" />
            <h2 className="mt-4 font-display text-2xl font-bold text-emerald-900">Your dashboard is ready for data</h2>
            <p className="mt-2 max-w-lg text-sm text-slate-500">
              This workspace reflects only your own assessment. Start the 5-tier Assessment Wizard, and your
              composite score, accreditation level, findings, and 24-month capacity plan will build
              automatically from your answers.
            </p>
            <Link to="/assessment" className="mt-6">
              <Button size="lg"><ShieldCheck className="h-5 w-5" /> Start Your Assessment</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <Lock className="h-4 w-4 text-emerald-600" /> Secure Workspace:{' '}
            <span className="text-slate-800">{currentUser?.orgName}</span>
            <span className="text-slate-300">|</span> Session: 14:59
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Readiness Dashboard</h1>
        </div>
        {/* Accreditation badge + live wallboard launcher */}
        <div className="flex items-center gap-3">
          <a href={wallboardHref} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <Radio className="h-4 w-4" /> Open Wallboard
            </Button>
          </a>
          <div className={`flex items-center gap-3 rounded-xl border bg-white px-5 py-3 shadow-sm ring-2 ${accred.ring}`}>
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${accred.bg}`}>
              <span className={`font-display text-2xl font-bold ${accred.color}`}>{accred.level}</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Accreditation</p>
              <p className={`text-sm font-bold ${accred.color}`}>{accred.label}</p>
              {accred.capped && <p className="text-[10px] font-medium text-rose-600">⚠ Capped by penalty engine</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Paper compliance penalty banner */}
      {penalty && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-rose-300 bg-rose-50 p-4">
          <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="flex-1">
            <p className="font-semibold text-rose-800">Paper Compliance Penalty Active</p>
            <p className="text-sm text-rose-700">
              Implementation Evidence is <strong>{implementationEvidence}%</strong>, below the{' '}
              {PAPER_COMPLIANCE_THRESHOLD}% threshold. Accreditation is mathematically capped at Level C
              until system-enforced execution is demonstrated.
            </p>
          </div>
          <Link to="/findings" className="shrink-0 self-center text-sm font-semibold text-rose-700 hover:underline">
            Review gaps →
          </Link>
        </div>
      )}

      {/* Climate & ESG lens active but not yet started */}
      {climatePrompt && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <Globe className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-800">Your Climate &amp; ESG Lens is active</p>
            <p className="text-sm text-emerald-700">
              0 of {lensQuestionCount('climate')} Climate &amp; ESG questions are complete. Begin the module to populate
              the Climate &amp; ESG radar axis and unlock your Article 6 readiness signals.
            </p>
          </div>
          <Link to="/assessment" className="shrink-0 self-center text-sm font-semibold text-emerald-700 hover:underline">
            Start Climate Assessment →
          </Link>
        </div>
      )}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Composite Score" value={`${composite}%`} accent={composite >= 70 ? 'emerald' : composite >= 50 ? 'amber' : 'rose'} hint="Weighted across answered domains" />
        <Stat label="Implementation Evidence" value={`${implementationEvidence}%`} accent={penalty ? 'rose' : 'emerald'} hint="System-enforced execution" />
        <Stat label="Open Critical Risks" value={criticalFindings.length} accent="rose" hint="Top of the mitigation queue" />
        <Stat label="Plan Items Off-Track" value={offTrack} accent="amber" hint="Capacity plan attention" />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gauge className="h-4 w-4 text-emerald-600" /> {indices.length} Composite Indices</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={indices} outerRadius="72%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Radar name="Readiness" dataKey="value" stroke="#10B981" fill="#10B981" fillOpacity={0.35} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> 5-Tier Maturity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={tiers} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip formatter={(v, _n, p: { payload?: { full?: string } }) => [`${v}%`, p?.payload?.full]} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {tiers.map((t, i) => (
                    <Cell key={i} fill={t.value >= 70 ? '#10b981' : t.value >= 50 ? '#f59e0b' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top critical risks */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Top Critical Risks</CardTitle>
          <Link to="/findings" className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline">
            All findings <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {(criticalFindings.length ? criticalFindings : findings).length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No gaps identified so far. Keep completing the assessment to surface risks.
            </p>
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>ID</Th>
                  <Th>Finding</Th>
                  <Th>Severity</Th>
                  <Th>Status</Th>
                </tr>
              </Thead>
              <Tbody>
                {(criticalFindings.length ? criticalFindings : findings).slice(0, 8).map(r => {
                  const sev = severityStyle(r.severity)
                  return (
                    <tr key={r.id} className="align-top">
                      <Td><span className="font-mono text-xs font-semibold text-slate-700">{r.id}</span></Td>
                      <Td>
                        <p className="font-medium text-slate-800">{r.topic}</p>
                        <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-500 line-clamp-2">{r.description}</p>
                      </Td>
                      <Td>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${sev.bg} ${sev.text} ${sev.border}`}>
                          {r.severity}
                        </span>
                      </Td>
                      <Td><StatusBadge status={cipStatuses[r.id] ?? 'To-be-Initiated'} /></Td>
                    </tr>
                  )
                })}
              </Tbody>
            </Table>
          )}
          <div className="mt-3">
            <p className="mb-1 text-xs text-slate-400">Composite progress</p>
            <ProgressBar value={composite} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
