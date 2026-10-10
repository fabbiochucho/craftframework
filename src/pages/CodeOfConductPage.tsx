import { ShieldCheck, Users, Scale, Mail } from 'lucide-react'
import { Reveal } from '../components/ui'
import { BRAND } from '../lib/data'

const STANDARDS = [
  'Using welcoming and inclusive language.',
  'Being respectful of differing viewpoints and experiences.',
  'Gracefully accepting constructive criticism.',
  'Focusing on what is best for the global health security and governance community.',
  'Showing empathy towards other community members.',
]

export function CodeOfConductPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-emerald-900 to-slate-900 py-20 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">Community</p>
          <h1 className="mt-3 font-display text-5xl font-bold">Code of Conduct</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Fostering a safe, inclusive, and collaborative environment for everyone who builds with
            and contributes to {BRAND.product} ({BRAND.framework}).
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="mb-6 leading-relaxed text-slate-600">
          This page is a summary. Read the{' '}
          <a
            href="https://github.com/fabbiochucho/craftframework/blob/main/CODE_OF_CONDUCT.md"
            className="font-semibold text-emerald-700 underline underline-offset-2"
          >
            full Code of Conduct and enforcement policy
          </a>
          {' '}for the governing standards, scope, private reporting, confidentiality limits,
          protective measures, fair investigation, and appeals within 30 calendar days.
        </p>
        <Reveal>
          <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-emerald-900">Our Pledge</h2>
              <p className="mt-3 leading-relaxed text-slate-600">
                In the interest of fostering an open and welcoming environment, we as contributors
                and maintainers of the {BRAND.framework} framework pledge to make participation in
                our project and community a harassment-free experience for everyone, regardless of
                age, body size, visible or invisible disability, ethnicity, sex characteristics,
                gender identity and expression, level of experience, education, socio-economic status,
                nationality, personal appearance, race, caste, color, religion, or sexual identity
                and orientation.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-amber-600" />
              <h2 className="font-display text-2xl font-bold text-emerald-900">Our Standards</h2>
            </div>
            <p className="mt-3 text-slate-600">
              Examples of behavior that contributes to a positive environment include:
            </p>
            <ul className="mt-4 space-y-2">
              {STANDARDS.map(s => (
                <li key={s} className="flex items-start gap-2 text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="mt-6 flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-emerald-900">Our Responsibilities</h2>
              <p className="mt-3 leading-relaxed text-slate-600">
                Project maintainers are responsible for clarifying the
                standards of acceptable behavior and are expected to take appropriate and fair
                corrective action in response to any instances of unacceptable behavior.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={220}>
          <div className="mt-6 flex items-start gap-4 rounded-2xl bg-emerald-900 p-8 text-emerald-50 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-800 text-amber-400">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Reporting</h2>
              <p className="mt-3 leading-relaxed text-emerald-100">
                Instances of abusive, harassing, or otherwise unacceptable behavior may be reported
                by contacting the project team at{' '}
                <a
                  href={`mailto:${BRAND.contactEmail}`}
                  className="font-semibold text-amber-400 underline-offset-2 hover:underline"
                >
                  {BRAND.contactEmail}
                </a>
                . Do not use public issues or the support chatbot for conduct, security, or
                confidential concerns. You may omit your name or use a pseudonym, but ordinary
                email cannot guarantee anonymity.
              </p>
              <p className="mt-3 leading-relaxed text-emerald-100">
                Reports are handled on a need-to-know basis; absolute confidentiality cannot be
                guaranteed. Retaliation is prohibited. Maintainers aim to acknowledge reports within
                5 business days and provide a decision or update within 30 calendar days, subject
                to capacity. This mailbox is not continuously monitored or an emergency service.
              </p>
            </div>
          </div>
        </Reveal>

        <p className="mt-8 text-center text-xs text-slate-500">
          Adapted from the{' '}
          <a
            href="https://www.contributor-covenant.org/version/2/1/code_of_conduct/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-emerald-700"
          >
            Contributor Covenant
          </a>
          , version 2.1.
        </p>
      </section>
    </div>
  )
}
