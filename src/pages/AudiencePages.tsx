import { Link } from '@tanstack/react-router'
import { ArrowRight, Gauge, Shield } from 'lucide-react'
import { Button } from '../components/ui'

interface Audience {
  kicker: string
  title: string
  intro: string
  problems: string[]
  modules: { name: string; detail: string }[]
  steps: string[]
  note: string
}

function AudienceLayout({ a }: { a: Audience }) {
  return (
    <div>
      <section className="bg-gradient-to-br from-emerald-900 to-slate-900 py-16 text-white">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">{a.kicker}</p>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">{a.title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">{a.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/pre-assessment"><Button size="lg"><Gauge className="h-5 w-5" /> Take the 2-minute Readiness Check</Button></Link>
            <Link to="/auth"><Button size="lg" variant="outline" className="border-white text-white hover:bg-emerald-800"><Shield className="h-5 w-5" /> Register your institution</Button></Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-5xl space-y-12 px-6 py-14">
        <div>
          <h2 className="font-display text-2xl font-bold text-emerald-900">The challenge</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">{a.problems.map(p => <li key={p}>{p}</li>)}</ul>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-emerald-900">What CRAFT gives you</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {a.modules.map(m => (
              <div key={m.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-emerald-900">{m.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{m.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-emerald-900">How it works</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">{a.steps.map(s => <li key={s}>{s}</li>)}</ol>
        </div>
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{a.note}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/pre-assessment"><Button size="lg">Start the Readiness Check <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link to="/methodology" className="text-sm font-semibold text-emerald-700 hover:underline">Read the methodology</Link>
          <Link to="/contact" className="text-sm font-semibold text-emerald-700 hover:underline">Talk to us</Link>
        </div>
      </section>
    </div>
  )
}

const NPHI: Audience = {
  kicker: 'For national public health institutes',
  title: 'Show your NPHI’s capacity — with evidence',
  intro: 'One workspace for your Africa CDC NPHI development assessment, WHO Joint External Evaluation and SPAR self-assessment, after-action reviews and simulation exercises, with every finding tracked to a corrective action.',
  problems: [
    'JEE, SPAR and NPHI development scores live in separate spreadsheets and reports, scored in different ways.',
    'Findings from after-action reviews and exercises are rarely tracked to completion.',
    'Funders and Africa CDC ask for evidence of progress, not only scores.',
  ],
  modules: [
    { name: 'NPHI development assessment', detail: 'Key attributes, the ten core functions, capacity building, establishment and legal framework, and optional regional Centre of Excellence readiness, based on the Africa CDC NPHI Development Framework 2.0.' },
    { name: 'WHO JEE and SPAR', detail: 'All 19 JEE technical areas and the 35 SPAR indicators, scored with WHO’s method; the SPAR average is SDG indicator 3.d.1.' },
    { name: 'Crosswalk', detail: 'See the same capacity across SPAR, JEE and your NPHI assessment, and spot where results disagree.' },
    { name: 'Subnational and after-action reviews', detail: 'State, county and provincial JEE-style self-assessments, plus findings from after-action reviews and simulation exercises.' },
  ],
  steps: [
    'Register your institute. Admins with an email on your institute’s official domain are verified automatically; others are verified by our team.',
    'Score each assessment, attaching evidence; findings below level 3 become corrective actions with owners and dates.',
    'Track closure, export reports (Word, Excel, PDF) and share progress with partners.',
  ],
  note: 'CRAFT supports self-assessment and preparation. It is not an official Africa CDC or WHO assessment: a JEE is conducted by WHO-led missions and SPAR is submitted by the National IHR Focal Point through WHO e-SPAR.',
}

const GOV: Audience = {
  kicker: 'For government and public bodies',
  title: 'Performance and accountability you can evidence',
  intro: 'Assess your ministry, department, agency or subnational government against the frameworks you are already held to — and turn the gaps into tracked action plans.',
  problems: [
    'Performance contracts, PFM reviews, APRM commitments and SDG reporting each ask for different evidence.',
    'Audit and evaluation findings recur because actions are not tracked to verified closure.',
    'Development partners want credible, comparable governance evidence before funding directly.',
  ],
  modules: [
    { name: 'Public-sector performance assessment', detail: 'The four APRM thematic areas, national performance systems and contracts, the seven PEFA public finance pillars, the OECD-DAC evaluation criteria, and Agenda 2063 and SDG alignment.' },
    { name: 'CRAFT Governance Scorecard', detail: 'Ten governance pillars with evidence-capped scoring and independent validation.' },
    { name: 'Corrective actions with escalation', detail: 'Owners, deadlines, verified evidence, duplicate merging and automatic escalation when actions slip.' },
    { name: 'Framework mapping', detail: 'Show how one assessment serves your SDG, Agenda 2063 and APRM reporting.' },
  ],
  steps: [
    'Register your organisation as a government body or subnational government.',
    'Run the assessment with your team; reviewers approve scores and evidence.',
    'Track actions, export reports and share them with oversight bodies and partners.',
  ],
  note: 'CRAFT results are self-assessments with optional independent validation. They are not an APRM country review, a PEFA assessment or an official performance rating.',
}

const ESG: Audience = {
  kicker: 'For ESG and sustainability reporting',
  title: 'IFRS S1/S2 readiness for every African market',
  intro: 'Know what applies to you in each of the 54 African countries, build your implementation plan, and check the quality of your sustainability report before it is published.',
  problems: [
    'Adoption of IFRS S1/S2 differs by country, entity type and phase — and changes often.',
    'Exchange and regulator disclosure rules sit in separate documents.',
    'Reports are published without a structured check of evidence and completeness.',
  ],
  modules: [
    { name: '54-country rule packs', detail: 'Securities regulators, exchanges, sustainability-disclosure rules and IFRS adoption status for every African country, with sources and verification dates.' },
    { name: 'ESG report quality checklist', detail: 'IFRS S1, S2, national and exchange checks, evidence acceptance and readiness gates before approval.' },
    { name: 'Implementation planner', detail: 'Workstreams, dependencies, critical path and budgets — including the SEC Nigeria IFRS S1/S2 plan generator.' },
    { name: 'Regulatory sources register', detail: 'Record re-verification of each source before every reporting cycle.' },
  ],
  steps: [
    'Choose your jurisdiction and entity category to see what applies and when.',
    'Generate your plan, assign owners and track milestones and budget.',
    'Run the quality checklist on your draft report and finalise with a frozen, auditable record.',
  ],
  note: 'CRAFT supports structured preparation and review. It does not replace legal, accounting or assurance advice; always confirm requirements with the regulator or standard-setter.',
}

export const NphiAudiencePage = () => <AudienceLayout a={NPHI} />
export const GovernmentAudiencePage = () => <AudienceLayout a={GOV} />
export const EsgAudiencePage = () => <AudienceLayout a={ESG} />
