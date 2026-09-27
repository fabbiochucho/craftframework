import { Link } from '@tanstack/react-router'
import {
  Shield, ArrowRight, FileSpreadsheet, MapPinned, FileWarning, EyeOff,
  CheckCircle2, Fingerprint, Globe2, Eye, Network,
  Landmark, HeartHandshake, Building2,
} from 'lucide-react'
import { Button, Reveal } from '../components/ui'
import { BRAND, BLINDSPOTS, LIFECYCLE, PANAFRICAN_BADGES, ARCHETYPES } from '../lib/data'
import { SECTORS_BY_ARCHETYPE } from '../lib/dataroom'
import { useI18n } from '../lib/i18n'

const blindspotIcons: Record<string, typeof Shield> = {
  spreadsheet: FileSpreadsheet,
  map: MapPinned,
  paper: FileWarning,
  anon: EyeOff,
}

// Icon + framing for each organizational archetype the platform adapts to.
const archetypeMeta: Record<string, { icon: typeof Shield; positioning: string }> = {
  Public: { icon: Landmark, positioning: 'For G2G funding & public accountability' },
  'Civil Society': { icon: HeartHandshake, positioning: 'For grant eligibility & donor trust' },
  Private: { icon: Building2, positioning: 'For investment & contract readiness' },
}

export function LandingPage() {
  const { t } = useI18n()
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100 via-white to-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <Globe2 className="h-3.5 w-3.5" /> {BRAND.institute} · A Digital Public Good
          </div>
          <h1 className="mt-6 font-display text-6xl font-bold leading-none tracking-tight text-emerald-900 md:text-8xl">
            CRAFT
          </h1>
          <p className="mt-4 max-w-2xl font-display text-xl font-semibold text-emerald-800 md:text-2xl">
            Capacity Readiness &amp; Fiduciary Assurance Toolkit
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
            {BRAND.tagline}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link to="/auth">
              <Button size="lg">
                <Shield className="h-5 w-5" /> Register Your Institution
              </Button>
            </Link>
            <Link to="/methodology">
              <Button size="lg" variant="ghost" className="text-emerald-700 hover:bg-emerald-50">
                Explore the Methodology <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-8 font-mono text-xs uppercase tracking-widest text-slate-400">
            {BRAND.product} · {BRAND.framework}
          </p>
        </div>
      </section>

      {/* Blindspots */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">Universal Institutional Failures</p>
          <h2 className="mt-2 max-w-3xl font-display text-4xl font-bold text-emerald-900">
            The blindspots CRAFT was built to expose.
          </h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Abstracted from fiduciary assessments across the globe, the same structural gaps recur
            regardless of geography or mandate.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BLINDSPOTS.map((b, i) => {
            const Icon = blindspotIcons[b.icon]
            return (
              <Reveal key={b.title} delay={i * 90}>
                <div className="group h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-900 text-amber-400 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-emerald-900">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.desc}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* Organizational archetypes */}
      <section className="mx-auto max-w-7xl px-6 pb-4">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">One framework, three institutional realities</p>
          <h2 className="mt-2 max-w-3xl font-display text-4xl font-bold text-emerald-900">
            Built for every institution in the trust chain.
          </h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            A universal fiduciary core applies to all institutions. CRAFT then adapts the questions,
            evidence and Data Room to your organizational archetype - so you are measured against the
            standard that actually governs your funding.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {ARCHETYPES.map((a, i) => {
            const meta = archetypeMeta[a.id]
            const Icon = meta?.icon ?? Shield
            const sectors = SECTORS_BY_ARCHETYPE[a.id] ?? []
            return (
              <Reveal key={a.id} delay={i * 90}>
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-900 text-amber-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold text-emerald-900">{a.label}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">{meta?.positioning}</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{a.blurb}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {sectors.slice(0, 5).map(s => (
                      <span key={s} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* Lifecycle band */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <h2 className="text-center font-display text-4xl font-bold text-emerald-900">
              A four-layer lifecycle, from intent to execution.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-4">
            {LIFECYCLE.map((l, i) => (
              <Reveal key={l.name} delay={i * 80}>
                <div className="relative h-full rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="font-mono text-5xl font-bold text-slate-100">0{l.step}</span>
                  <h3 className="-mt-6 font-display text-xl font-bold text-emerald-900">{l.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{l.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pan-African + trust */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-4xl font-bold text-emerald-900">
              Pan-African excellence, institutional gravity.
            </h2>
            <p className="mt-4 text-slate-600">
              CRAFT carries the {BRAND.institute}'s commitment to integrity, sovereignty, and
              continuous development, engineered for the institutions shaping Africa's transformation.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {PANAFRICAN_BADGES.map(b => (
                <span key={b} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                  {b}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-900 to-slate-900 p-8 text-white">
              <div className="grid gap-5 sm:grid-cols-2">
                {[
                  { icon: Fingerprint, t: 'Multi-Tenant Isolation', d: 'Scoped strictly by organization_id.' },
                  { icon: CheckCircle2, t: 'Execution-First Scoring', d: 'Paper compliance never inflates a score.' },
                ].map(x => (
                  <div key={x.t}>
                    <x.icon className="h-6 w-6 text-emerald-400" />
                    <p className="mt-2 text-sm font-semibold">{x.t}</p>
                    <p className="mt-1 text-xs text-slate-400">{x.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Live demo */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">Explore Before You Register</p>
            <h2 className="mt-2 font-display text-4xl font-bold text-emerald-900">See CRAFT with live sample data.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              Open a fully populated, read-only demo in a new tab, with every screen pre-loaded with illustrative
              institutions. The demo is completely isolated and never touches a real workspace.
            </p>
          </Reveal>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a href="/dashboard?demo=assessor" target="_blank" rel="noopener noreferrer">
              <Button size="lg">
                <Eye className="h-5 w-5" /> Demo: Assessor Workspace
              </Button>
            </a>
            <a href="/admin/portfolio?demo=portfolio" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline">
                <Network className="h-5 w-5" /> Demo: Portfolio View
              </Button>
            </a>
          </div>
          <Reveal>
            <Link to="/demo" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
              {t('cta.seeDemo', 'See demo')} <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-emerald-600">
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <h2 className="font-display text-4xl font-bold text-white">Ready to choose to become it?</h2>
          <p className="mx-auto mt-3 max-w-xl text-emerald-100">
            Register your institution and run your first readiness assessment in minutes.
          </p>
          <Link to="/auth" className="mt-8 inline-block">
            <Button size="lg" className="bg-white text-emerald-700 hover:bg-slate-100 focus:ring-white">
              Register Your Institution <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
