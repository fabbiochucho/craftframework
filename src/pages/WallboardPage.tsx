import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import {
  Maximize2, Minimize2, X, Radio, ShieldCheck, AlertOctagon, Building2, Activity,
} from 'lucide-react'
import { useAuthCtx, useWorkspace, useScoresCtx } from '../lib/context'
import {
  computeOrgScore, computeImplementationEvidence, computeCompositeIndices,
  getAccreditation, deriveFindings, BRAND,
} from '../lib/data'

// ============================================================================
// Wallboard — a full-screen, auto-refreshing "livescreen" broadcast of the
// workspace's headline readiness analytics. Built to be thrown onto a wall
// display or a second monitor: no chrome, oversized type, a live clock, and a
// gentle pulse so a room can read it at a glance. It reads the SAME live context
// state as the dashboard, so scores entered anywhere update here in real time.
//
// Scope follows the signed-in view level: an assessor sees their own institution
// in detail; a Portfolio Reviewer / Super Admin sees the whole book of
// institutions aggregated, with a spotlight panel that rotates through each one.
// ============================================================================

function useClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function scoreTone(v: number): { text: string; bar: string } {
  if (v >= 70) return { text: 'text-emerald-400', bar: '#10b981' }
  if (v >= 50) return { text: 'text-amber-400', bar: '#f59e0b' }
  return { text: 'text-rose-400', bar: '#f43f5e' }
}

export function WallboardPage() {
  const { currentUser, enterDemo } = useAuthCtx()
  const { currentOrg, organizations } = useWorkspace()
  const { scores } = useScoresCtx()
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const [isFull, setIsFull] = useState(false)
  const clock = useClock()

  // Route protection mirrors AppLayout: allow a `?demo=<role>` link to bootstrap
  // a seeded session in a new tab, otherwise bounce to the sign-in gateway.
  useEffect(() => {
    if (currentUser) return
    const demo =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('demo')
        : null
    if (demo === 'assessor' || demo === 'portfolio') enterDemo(demo)
    else navigate({ to: '/auth' })
  }, [currentUser, enterDemo, navigate])

  // Keep the fullscreen toggle in sync with the browser (Esc, F11, etc.).
  useEffect(() => {
    const onChange = () => setIsFull(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    } else {
      void rootRef.current?.requestFullscreen().catch(() => {})
    }
  }

  // Aggregate mode for reviewers/admins who administer more than one institution.
  const isAggregate =
    !!currentUser &&
    (currentUser.role === 'portfolio' || currentUser.role === 'admin' || currentUser.role === 'super_admin') &&
    organizations.length > 0

  // Rotating spotlight index (aggregate mode) — advances every 6 seconds so a
  // wall display cycles through each institution unattended.
  const [spotlight, setSpotlight] = useState(0)
  useEffect(() => {
    if (!isAggregate || organizations.length === 0) return
    const id = setInterval(() => setSpotlight(i => (i + 1) % organizations.length), 6000)
    return () => clearInterval(id)
  }, [isAggregate, organizations.length])

  const aggregate = useMemo(() => {
    const rows = organizations.map(o => {
      const s = scores[o.id] || {}
      return {
        id: o.id,
        name: o.name,
        composite: computeOrgScore(s),
        evidence: computeImplementationEvidence(s),
        criticals: deriveFindings(s).filter(f => f.severity === 'Critical').length,
      }
    })
    const mean = Math.round(rows.reduce((a, r) => a + r.composite, 0) / (rows.length || 1))
    return {
      rows,
      mean,
      count: rows.length,
      totalCriticals: rows.reduce((a, r) => a + r.criticals, 0),
      belowThreshold: rows.filter(r => r.evidence < 50).length,
    }
  }, [organizations, scores])

  const solo = useMemo(() => {
    const s = currentOrg ? scores[currentOrg.id] || {} : {}
    return {
      composite: computeOrgScore(s),
      evidence: computeImplementationEvidence(s),
      indices: computeCompositeIndices(s),
      criticals: deriveFindings(s).filter(f => f.severity === 'Critical'),
    }
  }, [currentOrg, scores])

  if (!currentUser) return null

  const headline = isAggregate ? aggregate.mean : solo.composite
  const headlineTone = scoreTone(headline)
  const accred = getAccreditation(headline, isAggregate ? 100 : solo.evidence)

  return (
    <div
      ref={rootRef}
      className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 font-sans text-white"
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-amber-400/10 blur-3xl" />

      {/* Top bar */}
      <header className="relative flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
          </span>
          <Radio className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
              {BRAND.product} · Live Wallboard
            </p>
            <p className="text-xs text-slate-400">
              {isAggregate ? 'Portfolio readiness broadcast' : currentUser.orgName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="font-mono text-2xl font-bold tabular-nums text-slate-200">{clock}</span>
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
          >
            {isFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isFull ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
          <button
            onClick={() => navigate({ to: '/dashboard' })}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
          >
            <X className="h-4 w-4" /> Close
          </button>
        </div>
      </header>

      <div className="relative grid gap-6 px-8 pb-8 lg:grid-cols-3">
        {/* Headline composite */}
        <div className="flex flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {isAggregate ? 'Mean composite readiness' : 'Composite readiness'}
          </p>
          <p className={`mt-2 font-display text-8xl font-black leading-none ${headlineTone.text}`}>
            {headline}
            <span className="text-4xl">%</span>
          </p>
          <div className="mt-6 flex items-center gap-3">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${accred.bg}`}>
              <span className={`font-display text-3xl font-black ${accred.color}`}>{accred.level}</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Accreditation</p>
              <p className={`text-lg font-bold ${accred.color}`}>{accred.label}</p>
            </div>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-6 lg:col-span-2">
          {isAggregate ? (
            <>
              <KpiTile icon={Building2} label="Institutions live" value={aggregate.count} tone="text-emerald-400" />
              <KpiTile icon={Activity} label="Mean composite" value={`${aggregate.mean}%`} tone={scoreTone(aggregate.mean).text} />
              <KpiTile icon={AlertOctagon} label="Open critical risks" value={aggregate.totalCriticals} tone="text-rose-400" />
              <KpiTile icon={ShieldCheck} label="Below evidence threshold" value={aggregate.belowThreshold} tone="text-amber-400" />
            </>
          ) : (
            <>
              <KpiTile icon={Activity} label="Composite score" value={`${solo.composite}%`} tone={scoreTone(solo.composite).text} />
              <KpiTile icon={ShieldCheck} label="Implementation evidence" value={`${solo.evidence}%`} tone={scoreTone(solo.evidence).text} />
              <KpiTile icon={AlertOctagon} label="Open critical risks" value={solo.criticals.length} tone="text-rose-400" />
              <KpiTile icon={Building2} label="Composite indices" value={solo.indices.length} tone="text-emerald-400" />
            </>
          )}
        </div>

        {/* Main visual */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
            {isAggregate ? 'Composite by institution' : `${solo.indices.length} composite indices`}
          </p>
          <ResponsiveContainer width="100%" height={340}>
            {isAggregate ? (
              <BarChart data={aggregate.rows.map(r => ({ name: r.name.split(' ').slice(0, 2).join(' '), value: r.composite }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#cbd5e1' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#fff' }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {aggregate.rows.map((r, i) => (
                    <Cell key={i} fill={scoreTone(r.composite).bar} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <RadarChart data={solo.indices} outerRadius="74%">
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 12, fill: '#cbd5e1' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Radar name="Readiness" dataKey="value" stroke="#34d399" fill="#34d399" fillOpacity={0.4} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#fff' }} />
              </RadarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Side panel: rotating spotlight (aggregate) or top risks (solo) */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          {isAggregate ? (
            <SpotlightPanel row={aggregate.rows[spotlight]} index={spotlight} total={aggregate.count} />
          ) : (
            <>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Top critical risks</p>
              {solo.criticals.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">No critical risks. Keep completing the assessment.</p>
              ) : (
                <ul className="space-y-3">
                  {solo.criticals.slice(0, 5).map(r => (
                    <li key={r.id} className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
                      <p className="font-mono text-[11px] font-bold text-rose-300">{r.id}</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-100">{r.topic}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiTile({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string | number; tone: string }) {
  return (
    <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <Icon className={`h-7 w-7 ${tone}`} />
      <div className="mt-4">
        <p className={`font-display text-5xl font-black leading-none ${tone}`}>{value}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      </div>
    </div>
  )
}

function SpotlightPanel({ row, index, total }: { row: { name: string; composite: number; evidence: number; criticals: number } | undefined; index: number; total: number }) {
  if (!row) return null
  const tone = scoreTone(row.composite)
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Spotlight</p>
        <p className="font-mono text-[11px] text-slate-500">{index + 1} / {total}</p>
      </div>
      <p className="truncate font-display text-2xl font-bold text-white">{row.name}</p>
      <p className={`mt-3 font-display text-6xl font-black ${tone.text}`}>{row.composite}<span className="text-2xl">%</span></p>
      <div className="mt-6 space-y-2 text-sm">
        <div className="flex items-center justify-between border-t border-white/10 pt-2">
          <span className="text-slate-400">Implementation evidence</span>
          <span className={`font-bold ${scoreTone(row.evidence).text}`}>{row.evidence}%</span>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 pt-2">
          <span className="text-slate-400">Open critical risks</span>
          <span className="font-bold text-rose-400">{row.criticals}</span>
        </div>
      </div>
    </div>
  )
}
