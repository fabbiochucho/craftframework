import { Code2, BookOpen, GitFork, Globe, ShieldCheck, Lock, CheckCircle2 } from 'lucide-react'
import { Reveal } from '../components/ui'

// The nine official Digital Public Goods Alliance (DPGA) indicators, with how
// CRAFT satisfies each. Enumerated publicly so adopting institutions can verify
// the platform's standing against the DPG Standard.
const DPGA_INDICATORS = [
  {
    n: 1,
    title: 'Relevance to the SDGs',
    body: 'Strengthens institutional governance and accountability (SDG 16) and the partnerships that fund it (SDG 17).',
  },
  {
    n: 2,
    title: 'Use of approved open licences',
    body: 'Software under GPL-3.0; the ICARF v4.0 methodology under CC BY-SA 4.0 - both on the DPGA-approved list.',
  },
  {
    n: 3,
    title: 'Clear ownership',
    body: 'Copyright in the code and framework is held by the DiBadili Institute; institutional assessment data is owned exclusively by each institution.',
  },
  {
    n: 4,
    title: 'Platform independence',
    body: 'Built on open standards (React, Postgres) with no mandatory closed dependency. Any institution can self-host the stack.',
  },
  {
    n: 5,
    title: 'Documentation',
    body: 'Methodology, scoring model, question bank, and deployment steps are documented and openly published.',
  },
  {
    n: 6,
    title: 'Non-PII data extraction',
    body: 'Aggregate scores and framework definitions export in open, non-proprietary formats; no personal data is required to reuse the method.',
  },
  {
    n: 7,
    title: 'Privacy & applicable laws',
    body: 'Institutional data is encrypted, tenant-isolated, and governed by national data-protection law - never shared or repurposed.',
  },
  {
    n: 8,
    title: 'Standards & best practices',
    body: 'Aligns with recognised governance frameworks (Global Fund, Pact OCA, OECD/G7 AI) and modern secure-by-default engineering.',
  },
  {
    n: 9,
    title: 'Do no harm by design',
    body: 'Sovereign-data architecture, transparent scoring, and assessor accountability prevent extraction, surveillance, or punitive misuse.',
  },
]

export function OpenSourcePage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-emerald-900 to-slate-900 py-20 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">Open Source</p>
          <h1 className="mt-3 font-display text-5xl font-bold">Sovereign. Transparent. Community-Driven.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            CRAFT is a digital public good. Both the software and the assessment framework are openly
            licensed so any institution can adopt, adapt, and extend them without vendor lock-in.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Code2 className="h-6 w-6" />
              </div>
              <h2 className="mt-5 font-display text-2xl font-bold text-emerald-900">The Software</h2>
              <p className="mt-2 font-mono text-sm font-semibold text-emerald-600">GPL-3.0</p>
              <p className="mt-3 leading-relaxed text-slate-600">
                The CRAFT platform is released under the GNU General Public License v3.0, which guarantees
                that improvements remain free and open for the whole community.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="h-full rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <BookOpen className="h-6 w-6" />
              </div>
              <h2 className="mt-5 font-display text-2xl font-bold text-emerald-900">The Framework</h2>
              <p className="mt-2 font-mono text-sm font-semibold text-amber-600">CC BY-SA 4.0</p>
              <p className="mt-3 leading-relaxed text-slate-600">
                The ICARF v4.0 methodology, question bank, and scoring model are licensed under
                Creative Commons Attribution-ShareAlike 4.0: adapt freely, share alike.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={80}>
          <div className="mt-10 grid gap-6 rounded-2xl bg-slate-50 p-8 sm:grid-cols-3">
            {[
              { icon: GitFork, t: 'Fork & Adapt', d: 'Tailor the question bank to your national context.' },
              { icon: Globe, t: 'Public Good', d: 'Built for the commons, not for capture.' },
              { icon: BookOpen, t: 'Attribution', d: 'Credit the DiBadili Institute; share derivatives alike.' },
            ].map(x => (
              <div key={x.t} className="text-center">
                <x.icon className="mx-auto h-7 w-7 text-slate-700" />
                <p className="mt-3 font-semibold text-slate-900">{x.t}</p>
                <p className="mt-1 text-sm text-slate-600">{x.d}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* The 9 DPGA indicators */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
              Digital Public Goods Alliance · DPG Standard
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-emerald-900">
              Compliant with all nine DPGA indicators
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">
              The DPG Standard sets nine indicators a project must meet to be recognised as a
              digital public good. CRAFT satisfies each one in full.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DPGA_INDICATORS.map(ind => (
              <Reveal key={ind.n} delay={(ind.n % 3) * 60}>
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 font-mono text-sm font-bold text-emerald-700">
                      {ind.n.toString().padStart(2, '0')}
                    </span>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-emerald-900">{ind.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{ind.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Three-Layer Sovereignty Shield */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
              Digital Public Good · Data Sovereignty
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-emerald-900">
              The Three-Layer Sovereignty Shield
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">
              Openness applies to the tools and the method - never to your institution&apos;s data.
              The Share-Alike obligation stops at the boundary of what you create.
            </p>
          </Reveal>

          <div className="mt-10 space-y-4">
            {[
              {
                n: 1,
                icon: Code2,
                title: 'Software',
                licence: 'GPL-3.0',
                body: 'The platform code is open. Any modifications you deploy remain open for the community - the engine can never be captured or closed.',
                tone: 'emerald',
              },
              {
                n: 2,
                icon: BookOpen,
                title: 'Methodology',
                licence: 'CC BY-SA 4.0',
                body: 'The ICARF v4.0 framework, question bank, and scoring model are shared alike. Translations and national adaptations flow back to the commons so every institution benefits.',
                tone: 'amber',
              },
              {
                n: 3,
                icon: Lock,
                title: 'Institutional Data',
                licence: '100% PROPRIETARY',
                body: 'Your assessments, evidence, and scores are yours alone. The institution retains absolute, exclusive ownership. DiBadili has ZERO access, and the Share-Alike clause NEVER applies to your data.',
                tone: 'slate',
              },
            ].map(layer => (
              <Reveal key={layer.n} delay={layer.n * 60}>
                <div
                  className={
                    layer.tone === 'slate'
                      ? 'flex flex-col gap-4 rounded-2xl border-2 border-emerald-900 bg-emerald-950 p-7 text-white shadow-lg sm:flex-row sm:items-center'
                      : 'flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:flex-row sm:items-center'
                  }
                >
                  <div
                    className={
                      layer.tone === 'slate'
                        ? 'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-900'
                        : layer.tone === 'amber'
                          ? 'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600'
                          : 'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600'
                    }
                  >
                    <layer.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={layer.tone === 'slate' ? 'text-xs font-semibold uppercase tracking-wider text-amber-300' : 'text-xs font-semibold uppercase tracking-wider text-slate-400'}>
                        Layer {layer.n}
                      </span>
                      <h3 className={layer.tone === 'slate' ? 'font-display text-xl font-bold text-white' : 'font-display text-xl font-bold text-emerald-900'}>
                        {layer.title}
                      </h3>
                      <span
                        className={
                          layer.tone === 'slate'
                            ? 'rounded-full bg-amber-400 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-900'
                            : 'rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-slate-600'
                        }
                      >
                        {layer.licence}
                      </span>
                    </div>
                    <p className={layer.tone === 'slate' ? 'mt-2 leading-relaxed text-slate-200' : 'mt-2 leading-relaxed text-slate-600'}>
                      {layer.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm font-medium text-emerald-800">
              <ShieldCheck className="h-4 w-4" />
              Open engine, shared method, sovereign data - the foundation of a trustworthy public good.
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
