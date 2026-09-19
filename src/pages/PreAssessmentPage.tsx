import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  FileText,
  Lock,
  Globe2,
  Landmark,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { BRAND, PAPER_COMPLIANCE_THRESHOLD } from '../lib/data'

// ---------------------------------------------------------------------------
// Quick Readiness Check - public, no-auth lead magnet.
// 10 high-impact questions across core G2G, DFI and donor fiduciary domains. Self-assessment
// produces an instant "Quick Score", then strategically reveals the limits of
// self-reporting (the Paper Compliance Penalty) to drive full registration.
// ---------------------------------------------------------------------------

type Answer = 'strong' | 'partial' | 'weak'

interface QuickQuestion {
  id: string
  domain: string
  text: string
}

const QUESTIONS: QuickQuestion[] = [
  { id: 'Q1', domain: 'Finance', text: 'Do you have a documented fund flow process with defined approval thresholds?' },
  { id: 'Q2', domain: 'Finance', text: 'Can your financial system automatically track funds by specific donor/activity without manual spreadsheets?' },
  { id: 'Q3', domain: 'Procurement', text: 'Is vendor selection transparent, with all bidding and evaluation matrices formally documented?' },
  { id: 'Q4', domain: 'Procurement', text: 'Do you have a centralized contract management system that tracks deliverables and timelines?' },
  { id: 'Q5', domain: 'HR', text: 'Is there a clear organogram with qualified, retained staff in all key fiduciary roles?' },
  { id: 'Q6', domain: 'Data', text: 'Are your data collection systems functional, validated, and actively used for real-time decision-making?' },
  { id: 'Q7', domain: 'Program', text: 'Is sub-national/state-level coordination structured and actively managed?' },
  { id: 'Q8', domain: 'Performance', text: 'Are program indicators clearly defined, with reporting strictly aligned to means of verification?' },
  { id: 'Q9', domain: 'Risk', text: 'Are institutional risks formally identified, with documented controls and escalation mechanisms?' },
  { id: 'Q10', domain: 'Coordination', text: 'Is there structured, routine engagement with the Ministry of Finance and partner MDAs?' },
]

const ANSWER_WEIGHT: Record<Answer, number> = { strong: 100, partial: 50, weak: 0 }

const OPTIONS: { value: Answer; label: string; icon: typeof CheckCircle2; classes: { idle: string; active: string } }[] = [
  {
    value: 'strong',
    label: 'Strong',
    icon: CheckCircle2,
    classes: {
      idle: 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700',
      active: 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
    },
  },
  {
    value: 'partial',
    label: 'Partial',
    icon: AlertTriangle,
    classes: {
      idle: 'border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:bg-amber-50/60 hover:text-amber-700',
      active: 'border-amber-400 bg-amber-400 text-amber-950 shadow-lg shadow-amber-400/30',
    },
  },
  {
    value: 'weak',
    label: 'Weak / No',
    icon: XCircle,
    classes: {
      idle: 'border-slate-200 bg-white text-slate-500 hover:border-rose-300 hover:bg-rose-50/60 hover:text-rose-700',
      active: 'border-rose-500 bg-rose-500 text-white shadow-lg shadow-rose-500/30',
    },
  },
]

type StatusKey = 'strong' | 'moderate' | 'risk'

function classify(score: number): { key: StatusKey; label: string; text: string; bg: string; ring: string } {
  if (score > 80) return { key: 'strong', label: 'Strong', text: 'text-emerald-700', bg: 'bg-emerald-100', ring: 'ring-emerald-200' }
  if (score >= 50) return { key: 'moderate', label: 'Moderate', text: 'text-amber-700', bg: 'bg-amber-100', ring: 'ring-amber-200' }
  return { key: 'risk', label: 'High Risk', text: 'text-rose-700', bg: 'bg-rose-100', ring: 'ring-rose-200' }
}

// Smoothly tween a displayed integer toward `target` (the satisfying count up/down).
function useCountUp(target: number, duration = 550) {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = fromRef.current
    if (from === target) return
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      const next = Math.round(from + (target - from) * eased)
      setDisplay(next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = target
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      fromRef.current = target
    }
  }, [target, duration])

  return display
}

export function PreAssessmentPage() {
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [popId, setPopId] = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const answeredCount = Object.keys(answers).length
  const complete = answeredCount === QUESTIONS.length

  const score = useMemo(() => {
    if (answeredCount === 0) return 0
    const total = Object.values(answers).reduce((sum, a) => sum + ANSWER_WEIGHT[a], 0)
    return Math.round(total / answeredCount)
  }, [answers, answeredCount])

  const displayScore = useCountUp(score)
  const status = classify(score)

  function select(qId: string, value: Answer) {
    setAnswers(prev => ({ ...prev, [qId]: value }))
    setPopId(qId + ':' + value)
    window.setTimeout(() => setPopId(null), 340)
  }

  // Smooth-scroll to the revealed results the moment the last answer lands.
  useEffect(() => {
    if (complete && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [complete])

  return (
    <div className="bg-white pb-32 md:pb-40">
      {/* 1 - HERO ------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="mx-auto max-w-4xl px-6 py-20 text-center md:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300">
            <Sparkles className="h-3.5 w-3.5" /> 2-Minute Quick Readiness Check
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight md:text-6xl">
            Is Your Institution Truly Ready for Direct G2G, DFI and Donor Funding?
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-emerald-100/90">
            Take this 2-minute Quick Readiness Check to benchmark your institutional capacity against
            global fiduciary standards. <span className="font-semibold text-white">No registration required.</span>
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 font-medium text-emerald-50">
              <Landmark className="h-4 w-4 text-amber-300" /> Developed by the {BRAND.institute}
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 font-medium text-emerald-50">
              <Globe2 className="h-4 w-4 text-amber-300" /> Aligned with G2G, DFIs and Donor Standards
            </span>
          </div>

          <a
            href="#quick-check"
            className="mt-10 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition-transform hover:scale-[1.03] hover:bg-emerald-400"
          >
            Start the Check <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* 2 - INTERACTIVE ASSESSMENT ----------------------------------------- */}
      <section id="quick-check" className="mx-auto max-w-3xl px-6 py-16 md:py-20">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold text-emerald-950 md:text-4xl">10 High-Impact Questions</h2>
          <p className="mt-3 text-slate-600">
            Rate your institution honestly against each core G2G, DFI and donor fiduciary domain. Your Quick Score updates live.
          </p>
        </div>

        <ol className="mt-10 space-y-4">
          {QUESTIONS.map((q, i) => {
            const current = answers[q.id]
            return (
              <li
                key={q.id}
                className={cn(
                  'rounded-2xl border bg-white p-5 shadow-sm transition-colors md:p-6',
                  current ? 'border-emerald-200' : 'border-slate-200',
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-emerald-950 font-mono text-xs font-bold text-amber-300">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">{q.domain}</span>
                    <p className="mt-1 text-[15px] font-medium leading-snug text-slate-800">{q.text}</p>
                  </div>
                </div>

                {/* 3-way thumb-friendly toggle */}
                <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3 md:pl-10">
                  {OPTIONS.map(opt => {
                    const active = current === opt.value
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => select(q.id, opt.value)}
                        className={cn(
                          'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-3 text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 active:scale-95',
                          active ? opt.classes.active : opt.classes.idle,
                          popId === q.id + ':' + opt.value && 'animate-craft-pop',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="leading-none">{opt.label}</span>
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ol>

        {/* 4 - REVEAL / CONVERSION HOOK ------------------------------------- */}
        <div ref={resultsRef} className="scroll-mt-24">
          {complete ? (
            <ResultsCard score={displayScore} status={status} />
          ) : (
            <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Lock className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-500">
                Answer all 10 questions to reveal your Quick Readiness Score &amp; full results.
              </p>
              <p className="mt-1 text-xs text-slate-400">{QUESTIONS.length - answeredCount} remaining</p>
            </div>
          )}
        </div>
      </section>

      {/* 3 - STICKY LIVE SCORE WIDGET --------------------------------------- */}
      <QuickScoreBar
        answered={answeredCount}
        total={QUESTIONS.length}
        score={displayScore}
        status={status}
        complete={complete}
      />
    </div>
  )
}

// --- Sticky bottom widget --------------------------------------------------
function QuickScoreBar({
  answered,
  total,
  score,
  status,
  complete,
}: {
  answered: number
  total: number
  score: number
  status: ReturnType<typeof classify>
  complete: boolean
}) {
  const pct = Math.round((answered / total) * 100)
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-3 md:py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{answered} of {total} Answered</span>
            <span className={cn('font-semibold', answered > 0 ? status.text : 'text-slate-400')}>
              {answered > 0 ? status.label : 'Not started'}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-500',
                complete ? 'bg-emerald-500' : 'bg-emerald-400',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex flex-none items-baseline gap-1 text-right">
          <span
            className={cn(
              'font-display text-2xl font-bold tabular-nums md:text-3xl',
              answered > 0 ? status.text : 'text-slate-300',
            )}
          >
            {answered > 0 ? score : '-'}
          </span>
          {answered > 0 && <span className="text-sm font-semibold text-slate-400">%</span>}
        </div>
      </div>
    </div>
  )
}

// --- Full results card (revealed on completion) ----------------------------
function ResultsCard({ score, status }: { score: number; status: ReturnType<typeof classify> }) {
  return (
    <div className="mt-12 animate-craft-reveal">
      {/* Score headline */}
      <div
        className={cn(
          'overflow-hidden rounded-3xl border bg-gradient-to-br from-white to-slate-50 shadow-xl ring-1',
          status.ring,
        )}
      >
        <div className="flex flex-col items-center gap-6 p-8 text-center md:flex-row md:gap-10 md:p-10 md:text-left">
          <div
            className={cn(
              'flex h-32 w-32 flex-none flex-col items-center justify-center rounded-full ring-8 ring-offset-2',
              status.bg,
              status.ring,
            )}
          >
            <span className={cn('font-display text-5xl font-bold tabular-nums', status.text)}>{score}</span>
            <span className={cn('text-sm font-semibold', status.text)}>%</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Your Quick Readiness Score</p>
            <div className="mt-2 flex items-center justify-center gap-3 md:justify-start">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold', status.bg, status.text)}>
                <ShieldCheck className="h-4 w-4" /> {status.label}
              </span>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
              This self-reported snapshot benchmarks your <strong>policy intent</strong> across 10 core G2G, DFI and donor domains,
              a strong starting point. But intent is not the same as system-enforced execution.
            </p>
          </div>
        </div>

        {/* Paper Compliance teaser (the hook) */}
        <div className="mx-6 mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 md:mx-10 md:mb-8">
          <p className="text-sm leading-relaxed text-amber-900">
            <span className="font-bold">⚠️ Important Note:</span> This quick check measures policy intent. It does
            not test for operational evidence. Under the full CRAFT ({BRAND.framework}) framework, institutions
            lacking system-enforced implementation face a <strong>“Paper Compliance Penalty”</strong> that can reduce
            their true accreditation score by up to <strong>40%</strong>
            <span className="text-amber-700"> (capped below the {PAPER_COMPLIANCE_THRESHOLD}% evidence threshold)</span>.
          </p>
        </div>
      </div>

      {/* Massive glowing CTA */}
      <div className="mt-8 text-center">
        <Link
          to="/auth"
          className="animate-craft-glow group inline-flex w-full max-w-2xl flex-col items-center gap-1 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-6 text-white transition-transform hover:scale-[1.02]"
        >
          <span className="flex items-center gap-2 font-display text-xl font-bold md:text-2xl">
            Unlock Your Full G2G, DFI and Donor Accreditation &amp; 24-Month Capacity Plan
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </span>
          <span className="text-sm font-medium text-emerald-50/90">
            Register your institution to access the questions, calculate your official
            Level A–E Accreditation, and auto-generate your budgeted remediation roadmap.
          </span>
        </Link>

        {/* Secondary CTA - for the skeptics */}
        <div className="mt-5">
          <Link
            to="/methodology"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 underline-offset-4 hover:text-emerald-700 hover:underline"
          >
            <FileText className="h-4 w-4" />
            Not ready to register? Download our free G2G, DFI and Donor Readiness Whitepaper
          </Link>
        </div>
      </div>
    </div>
  )
}
