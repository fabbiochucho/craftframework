import { Link } from '@tanstack/react-router'
import { Eye, Network, ArrowRight, Lock, ExternalLink } from 'lucide-react'
import { Button, Reveal } from '../components/ui'
import { useI18n } from '../lib/i18n'

// Each card opens a seeded, fully-isolated demo session in a new tab. The
// `?demo=<role>` query param is read by AppLayout, which bootstraps a throwaway
// session pre-loaded with illustrative sample data (never touches a real vault).
const DEMOS = [
  {
    role: 'assessor' as const,
    href: '/dashboard?demo=assessor',
    icon: Eye,
    title: 'Assessor Workspace',
    blurb:
      'Walk a single institution through the readiness assessment: dashboard, scoring wizard, findings, and capacity plan, all pre-populated.',
    accent: 'emerald',
  },
  {
    role: 'portfolio' as const,
    href: '/admin/portfolio?demo=portfolio',
    icon: Network,
    title: 'Portfolio View',
    blurb:
      'See how a funder or hub compares readiness across a portfolio of institutions, with aggregate indices and risk heatmaps.',
    accent: 'indigo',
  },
]

const accentClasses: Record<string, { ring: string; icon: string; chip: string }> = {
  emerald: { ring: 'ring-emerald-200', icon: 'bg-emerald-100 text-emerald-700', chip: 'text-emerald-700' },
  indigo: { ring: 'ring-indigo-200', icon: 'bg-indigo-100 text-indigo-700', chip: 'text-indigo-700' },
}

export function DemoPage() {
  const { t } = useI18n()
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100 via-white to-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 py-20 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <Lock className="h-3.5 w-3.5" /> {t('demo.badge', 'Isolated · Read-only · No sign-up')}
            </div>
            <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-emerald-900 md:text-5xl">
              {t('demo.title', 'Explore CRAFT with live sample data')}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600">
              {t(
                'demo.subtitle',
                'Open either demo below in a new tab. Each launches a fully populated, throwaway session seeded with illustrative institutions that stays completely isolated and never touches a real workspace.',
              )}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 sm:grid-cols-2 md:max-w-3xl md:mx-auto">
            {DEMOS.map((d, i) => {
              const a = accentClasses[d.accent]
              const Icon = d.icon
              return (
                <Reveal key={d.role} delay={i * 80}>
                  <div className={`flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ${a.ring}`}>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${a.icon}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <p className={`mt-4 text-xs font-semibold uppercase tracking-wider ${a.chip}`}>
                      {d.role} demo
                    </p>
                    <h2 className="mt-1 font-display text-xl font-bold text-emerald-900">{d.title}</h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{d.blurb}</p>
                    <a
                      href={d.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-block"
                    >
                      <Button className="w-full justify-center">
                        {t('demo.launch', 'Launch demo')} <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </Reveal>
              )
            })}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-slate-500">{t('demo.readyPrompt', 'Ready to run your own readiness assessment?')}</p>
            <Link to="/auth" className="mt-3 inline-block">
              <Button variant="outline" size="lg">
                {t('demo.registerCta', 'Register your institution')} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
