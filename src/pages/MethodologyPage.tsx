import { AlertOctagon, ArrowRight } from 'lucide-react'
import { Reveal } from '../components/ui'
import { LIFECYCLE, PAPER_COMPLIANCE_THRESHOLD } from '../lib/data'

export function MethodologyPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-emerald-900 to-slate-900 py-20 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">The CRAFT Methodology</p>
          <h1 className="mt-3 font-display text-5xl font-bold">From diagnosis to durable execution.</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            ICARF v4.0 assesses institutions across 5 tiers and 20 domains, then drives a closed
            loop of accreditation, strengthening, and monitoring.
          </p>
          <p className="mt-4 max-w-2xl text-slate-400">
            A universal fiduciary core runs through every assessment, while archetype-specific questions
            adapt it to Public Sector, Civil Society and Private Sector institutions - and optional
            thematic lenses extend it to climate, emergency and research mandates.
          </p>
        </div>
      </section>

      {/* Lifecycle stepper */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="space-y-6">
          {LIFECYCLE.map((l, i) => (
            <Reveal key={l.name} delay={i * 80}>
              <div className="flex items-start gap-6">
                <div className="flex flex-col items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 font-display text-lg font-bold text-white">
                    {l.step}
                  </div>
                  {i < LIFECYCLE.length - 1 && <div className="mt-1 h-16 w-0.5 bg-slate-200" />}
                </div>
                <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-2xl font-bold text-emerald-900">{l.name}</h3>
                    {i < LIFECYCLE.length - 1 && <ArrowRight className="h-4 w-4 text-slate-300" />}
                  </div>
                  <p className="mt-2 leading-relaxed text-slate-600">{l.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Penalty engine */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal>
            <div className="rounded-2xl border-2 border-rose-200 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <AlertOctagon className="h-6 w-6" />
                </div>
                <h2 className="font-display text-3xl font-bold text-emerald-900">The Paper Compliance Penalty Engine</h2>
              </div>
              <p className="mt-5 leading-relaxed text-slate-700">
                A perfect policy manual is not the same as a working control. CRAFT separates what an
                institution <em>documents</em> from what it <em>enforces</em>. Each maturity score is
                backed by a 7-point evidence matrix that measures system-enforced implementation.
              </p>
              <div className="mt-6 rounded-xl bg-slate-900 p-6 font-mono text-sm text-slate-200">
                <p className="text-amber-400">// Penalty rule</p>
                <p className="mt-2">
                  if (implementationEvidence &lt; {PAPER_COMPLIANCE_THRESHOLD}%) {'{'}
                </p>
                <p className="ml-6 text-rose-300">accreditationLevel = min(accreditationLevel, "C") // capped</p>
                <p>{'}'}</p>
              </div>
              <p className="mt-6 leading-relaxed text-slate-700">
                When implementation evidence falls below <strong>{PAPER_COMPLIANCE_THRESHOLD}%</strong>,
                accreditation is <strong>mathematically capped</strong>. No volume of paperwork can
                lift an institution into the top tiers without demonstrable execution.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
