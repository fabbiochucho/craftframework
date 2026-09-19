import { Compass, Lightbulb, Network, Award } from 'lucide-react'
import { Reveal } from '../components/ui'
import { BRAND, STRATEGIC_PILLARS, PANAFRICAN_BADGES } from '../lib/data'

const pillarIcons = [Compass, Lightbulb, Network]

export function InstitutePage() {
  return (
    <div>
      <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100 via-white to-white py-20">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
            {BRAND.institute}: {BRAND.instituteMeaning}
          </p>
          <h1 className="mt-3 font-display text-5xl font-bold text-emerald-900">{BRAND.mandate}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
            The {BRAND.institute} exists to help African public institutions close the distance between
            ambition and execution by building the systems, leaders, and accountability that turn policy
            into measurable outcomes.
          </p>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <Reveal>
          <h2 className="font-display text-4xl font-bold text-emerald-900">Strategic Pillars</h2>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STRATEGIC_PILLARS.map((p, i) => {
            const Icon = pillarIcons[i]
            return (
              <Reveal key={p.name} delay={i * 90}>
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 font-display text-xl font-bold text-emerald-900">{p.name}</h3>
                  <p className="mt-2 leading-relaxed text-slate-600">{p.desc}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* Badges */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="flex items-center gap-3">
              <Award className="h-7 w-7 text-amber-500" />
              <h2 className="font-display text-4xl font-bold text-emerald-900">Our Hallmarks</h2>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PANAFRICAN_BADGES.map((b, i) => (
              <Reveal key={b} delay={i * 80}>
                <div className="h-full rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-slate-900">
                    <Award className="h-6 w-6" />
                  </div>
                  <p className="mt-4 font-display text-base font-bold text-emerald-900">{b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
