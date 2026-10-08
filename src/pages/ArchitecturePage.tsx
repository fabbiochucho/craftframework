import { Link } from '@tanstack/react-router'
import { ArrowRight, Info } from 'lucide-react'
import { Reveal } from '../components/ui'
import { cn } from '../lib/utils'
import type { FrameworkId } from '../lib/frameworks'

interface ModuleLink {
  frameworkId: FrameworkId
  label: string
}

interface ArchitectureModule {
  no: string
  name: string
  question: string
  status: 'Live' | 'Partial' | 'Planned'
  links: ModuleLink[]
  note?: string
}

const FOUNDATION_LAYER: ArchitectureModule[] = [
  {
    no: '01', name: 'Institutional Capability', question: 'Can you execute?', status: 'Live',
    links: [
      { frameworkId: 'pact-omt-v6', label: 'Pact OMT v6' },
      { frameworkId: 'oca-opi', label: 'Pact OCA / OPI' },
    ],
  },
  {
    no: '02', name: 'Resilience', question: 'Can you survive disruption?', status: 'Partial',
    links: [{ frameworkId: 'capital-readiness-ladder', label: 'Capital Readiness Ladder - Level 3' }],
  },
  {
    no: '03', name: 'Accountability & Governance', question: 'Can people trust you?', status: 'Live',
    links: [
      { frameworkId: 'gf-pr-fcr', label: 'Global Fund PR FCR' },
      { frameworkId: 'esg-self-assessment', label: 'ESG Self-Assessment - Governance' },
      { frameworkId: 'capital-readiness-ladder', label: 'Capital Readiness Ladder - Level 2' },
    ],
  },
  {
    no: '04', name: 'Financial Sustainability', question: 'Can you create and manage economic value?', status: 'Live',
    links: [
      { frameworkId: 'gfa-diagnostic', label: 'GFA Business Diagnostic' },
      { frameworkId: 'gf-pr-fcr', label: 'Global Fund PR FCR' },
    ],
  },
  {
    no: '05', name: 'Transformation & Adaptability', question: 'Can you evolve?', status: 'Partial',
    links: [{ frameworkId: 'capital-readiness-ladder', label: 'Capital Readiness Ladder - Level 6' }],
  },
]

const CAPITAL_LAYER: ArchitectureModule[] = [
  {
    no: '06', name: 'ESG Materiality', question: 'How sustainable and responsible are you?', status: 'Live',
    links: [{ frameworkId: 'esg-self-assessment', label: 'ESG Self-Assessment' }],
  },
  {
    no: '07', name: 'Risk & Credit Readiness', question: 'How would a credit analyst see you?', status: 'Live',
    links: [
      { frameworkId: 'esg-self-assessment', label: 'ESG Self-Assessment - Rating Agency Translation' },
      { frameworkId: 'gfa-diagnostic', label: 'GFA Business Diagnostic - Risk pillar' },
    ],
  },
  {
    no: '08', name: 'Investment Readiness', question: 'Would external capital enter with confidence?', status: 'Live',
    links: [
      { frameworkId: 'gfa-diagnostic', label: 'GFA Business Diagnostic' },
      { frameworkId: 'capital-readiness-ladder', label: 'Capital Readiness Ladder - Level 5' },
    ],
  },
  {
    no: '09', name: 'Development Finance Readiness', question: 'Would a DFI clear you through due diligence?', status: 'Live',
    links: [{ frameworkId: 'capital-readiness-ladder', label: 'Capital Readiness Ladder - Level 7' }],
  },
  {
    no: '10', name: 'Capital Markets Readiness', question: 'Could you withstand bond, PE or public-market scrutiny?', status: 'Live',
    links: [{ frameworkId: 'capital-readiness-ladder', label: 'Capital Readiness Ladder - Level 7' }],
  },
]

const IMPACT_LAYER: ArchitectureModule[] = [
  {
    no: '11', name: 'Sustainable Value Creation', question: 'Does sustainability make the institution stronger?', status: 'Live',
    links: [
      { frameworkId: 'esg-self-assessment', label: 'ESG Self-Assessment - Environmental & Social' },
      { frameworkId: 'capital-readiness-ladder', label: 'Capital Readiness Ladder - Level 4' },
    ],
  },
  {
    no: '12', name: 'Intergenerational & Institutional Legacy', question: 'Does the institution outlast the people who built it?', status: 'Planned',
    links: [],
    note: 'No CRAFT framework assesses this yet. Flagged here deliberately rather than filled with placeholder content.',
  },
]

const STATUS_STYLE: Record<ArchitectureModule['status'], string> = {
  Live: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Partial: 'bg-amber-100 text-amber-700 border-amber-200',
  Planned: 'bg-slate-100 text-slate-500 border-slate-200',
}

function ModuleCard({ m, delay }: { m: ArchitectureModule; delay: number }) {
  return (
    <Reveal delay={delay}>
      <div className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs text-slate-400">{m.no}</span>
            <h3 className="font-display text-base font-bold text-slate-900">{m.name}</h3>
          </div>
          <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold', STATUS_STYLE[m.status])}>
            {m.status}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">{m.question}</p>

        {m.links.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {m.links.map(l => (
              <li key={l.label}>
                <Link
                  to="/assessment/$frameworkId"
                  params={{ frameworkId: l.frameworkId }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:underline"
                >
                  {l.label} <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          m.note && <p className="mt-3 text-xs italic text-slate-400">{m.note}</p>
        )}
      </div>
    </Reveal>
  )
}

export function ArchitecturePage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-slate-900 to-emerald-900 py-20 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">Institutional Readiness Architecture</p>
          <h1 className="mt-3 font-display text-5xl font-bold">
            CRAFT is an institutional intelligence and capital-readiness architecture.
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-300">
            Twelve questions, three layers, organizing every CRAFT framework into one map - from whether an
            institution can simply execute, through to whether it is ready for development finance or
            capital-markets scrutiny.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <p className="text-sm leading-relaxed text-slate-600">
            This map is an organizing layer, not a renaming. Pact OMT v6, Pact OCA/OPI, the Global Fund PR FCR
            and the G7/OECD AI Governance frameworks are built to be faithful replicas of those external
            methodologies, so they keep their own names here rather than being folded into CRAFT-authored
            module numbers. <span className="font-medium">Live</span> means a CRAFT framework fully covers that
            question today; <span className="font-medium">Partial</span> means one indicator or pillar touches
            it; <span className="font-medium">Planned</span> means no framework covers it yet.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <h2 className="font-display text-2xl font-bold text-emerald-900">Institutional Foundation Layer</h2>
        <p className="mt-1 text-sm text-slate-500">Is the institution itself sound?</p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FOUNDATION_LAYER.map((m, i) => <ModuleCard key={m.no} m={m} delay={i * 60} />)}
        </div>
      </section>

      <section className="bg-slate-50 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-2xl font-bold text-emerald-900">Capital Intelligence Layer</h2>
          <p className="mt-1 text-sm text-slate-500">Is the institution ready for external capital?</p>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPITAL_LAYER.map((m, i) => <ModuleCard key={m.no} m={m} delay={i * 60} />)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="font-display text-2xl font-bold text-emerald-900">Impact Layer</h2>
        <p className="mt-1 text-sm text-slate-500">Does the institution create value that lasts?</p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {IMPACT_LAYER.map((m, i) => <ModuleCard key={m.no} m={m} delay={i * 60} />)}
        </div>
      </section>

      <section className="border-t border-slate-200 py-10">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-sm text-slate-500">
            CRAFT sits upstream of formal ratings - it does not replicate, issue or predict a rating from
            Fitch, Moody&apos;s, S&amp;P, MSCI or any other agency. See the ESG Self-Assessment&apos;s{' '}
            <Link to="/assessment/$frameworkId" params={{ frameworkId: 'esg-self-assessment' }} className="font-medium text-emerald-700 hover:underline">
              rating-agency translation
            </Link>{' '}
            for how these modules connect to that world.
          </p>
        </div>
      </section>
    </div>
  )
}
