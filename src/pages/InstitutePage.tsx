import { Compass, Lightbulb, Network, Award, Linkedin, ShieldCheck } from 'lucide-react'
import { Reveal } from '../components/ui'
import { BRAND, STRATEGIC_PILLARS, PANAFRICAN_BADGES } from '../lib/data'

const pillarIcons = [Compass, Lightbulb, Network]

// Founders, as published on becomechange.institute/about. Add a headshot by placing the file in public/team/
// and setting `photo` (until then the card shows initials).
const FOUNDERS = [
  {
    name: 'Pauline Abiola-Oshunniyi', initials: 'PA', photo: '/team/pauline-abiola-oshunniyi.webp' as string | null,
    role: 'Co-founder and Executive Director',
    tagline: 'Global Development Strategist • Systems Leadership Advocate • Partnership Architect for Sustainable Africa',
    bio: [
      'Pauline Abiola-Oshunniyi is an international development strategist and systems leadership advocate working at the intersection of governance, sustainability, and institutional collaboration across Africa. With more than two decades of experience spanning development practice, policy engagement, and multi-stakeholder collaboration, she works with governments, development institutions, philanthropic organizations, and private sector leaders to design initiatives that strengthen institutions, mobilize strategic partnerships, and enable sustainable development outcomes across the continent.',
      'She is a Pioneer Fellow of the Mandela Washington Fellowship under the Young African Leaders Initiative and a Vital Voices Global Partnership Lead Fellow.',
    ],
    competencies: ['Strategic Partnership Development', 'Governance and ESG Strategy', 'Institutional Strengthening', 'Development Finance', 'Systems Leadership'],
    record: [
      'Designed and executed partnerships with 30+ organizations across public, private, and civil sectors',
      'Facilitated multi-stakeholder convenings bringing together 100+ decision-makers annually',
      'Mobilized millions of dollars in development finance for institutional strengthening and capacity building initiatives across Africa',
    ],
    linkedin: 'https://www.linkedin.com/in/paulineabiolaoshunniyi',
  },
  {
    name: 'Abiola Olugbenga Oshunniyi', initials: 'AO', photo: '/team/abiola-oshunniyi.webp' as string | null,
    role: 'Co-Founder',
    tagline: 'Development Strategist | Systems Transformation Expert',
    bio: [
      'Abiola Oshunniyi is a development strategist and systems transformation expert with nearly two decades of experience advising governments, international institutions, and development partners on strengthening public systems and advancing sustainable development outcomes across Africa. He has supported and advised complex multi-million-dollar initiatives across sectors including health systems strengthening, governance reform, sustainability, digital transformation, and development finance.',
      'Abiola has worked with leading global institutions, including the World Bank, USAID, the Global Fund, the UK Government, the Bill & Melinda Gates Foundation, Qualcomm Wireless Reach, UNICEF, and Project HOPE.',
    ],
    competencies: ['Health Systems Strengthening', 'Systems Leadership', 'Institutional Reform', 'Sustainability Strategy', 'Governance Advisory'],
    record: [
      'Led institutional reform in 5+ African countries resulting in policy adoption and institutional strengthening',
      'Advised 15+ government entities on governance, health systems, and sustainability frameworks',
      'Published 20+ research pieces and policy briefs on African systems transformation',
    ],
    linkedin: 'https://www.linkedin.com/in/abiolaoshunniyi',
  },
]

// What keeps a CRAFT validation trustworthy. Each line describes how the platform actually works.
const SAFEGUARDS = [
  { t: 'Independent validators', d: 'A validation is carried out by an accredited validator who is independent of the organisation and signs an independence declaration for every engagement.' },
  { t: 'Accreditation is earned', d: 'Validators are accredited only by completing CRAFT training and passing a timed assessment, scenario cases and a capstone, renewed every year.' },
  { t: 'An Independent Review Panel', d: 'Disputes and complaints go to a new panel for each case, with no conflicts of interest. Platform administrators have no vote.' },
  { t: 'The organisation stays in control', d: 'A validator sees an organisation’s records only through an engagement the organisation accepted, and that access expires.' },
  { t: 'Anyone can check a result', d: 'Every issued validation has a public verification page that shows whether it is current, suspended, expired or withdrawn.' },
]

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
            The {BRAND.institute} exists to help African businesses, organizations and institutions close
            the distance between ambition and execution by building the systems, leaders, and accountability
            that turn policy into measurable outcomes.
          </p>
        </div>
      </section>

      {/* Founders */}
      <section id="founders" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">Who is behind CRAFT</p>
          <h2 className="mt-2 font-display text-4xl font-bold text-emerald-900">Our Founders</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">CRAFT is built and run by the {BRAND.institute}, founded by Pauline Abiola-Oshunniyi and Abiola Oshunniyi.</p>
        </Reveal>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {FOUNDERS.map((f, i) => (
            <Reveal key={f.name} delay={i * 90}>
              <article className="flex h-full flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="flex items-center gap-4">
                  {f.photo
                    ? <img src={f.photo} alt={`Portrait of ${f.name}`} width={80} height={80} className="h-20 w-20 shrink-0 rounded-full object-cover" />
                    : <div aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-display text-2xl font-bold text-emerald-800">{f.initials}</div>}
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl font-bold text-emerald-900">{f.name}</h3>
                    <p className="font-semibold text-emerald-700">{f.role}</p>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-500">{f.tagline}</p>
                {f.bio.map((para) => <p key={para.slice(0, 24)} className="leading-relaxed text-slate-700">{para}</p>)}
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {f.record.map((r) => <li key={r} className="flex gap-2"><span aria-hidden="true" className="text-emerald-600">✓</span><span>{r}</span></li>)}
                </ul>
                <ul className="flex flex-wrap gap-2" aria-label="Key competencies">
                  {f.competencies.map((c) => <li key={c} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">{c}</li>)}
                </ul>
                <a href={f.linkedin} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline">
                  <Linkedin className="h-4 w-4" /> {f.name} on LinkedIn
                </a>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Independence */}
      <section className="bg-emerald-50/60 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-emerald-600" />
              <h2 className="font-display text-4xl font-bold text-emerald-900">How CRAFT Stays Independent</h2>
            </div>
            <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">The {BRAND.institute} runs the platform and the validator programme. It does not decide an organisation’s result.</p>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SAFEGUARDS.map((g, i) => (
              <Reveal key={g.t} delay={i * 70}>
                <div className="h-full rounded-2xl border border-emerald-100 bg-white p-6">
                  <h3 className="font-display text-lg font-bold text-emerald-900">{g.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{g.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-sm text-slate-600">Questions about CRAFT: <a className="font-semibold text-emerald-700 underline" href="mailto:craftframework@becomechange.institute">craftframework@becomechange.institute</a></p>
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
