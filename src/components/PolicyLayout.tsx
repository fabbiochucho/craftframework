import { Link } from '@tanstack/react-router'
import { BRAND } from '../lib/data'
import { DPO_CLAUSE } from '../lib/dpo'

export interface PolicySection { title: string; body: React.ReactNode }

export const POLICY_LINKS: { to: string; label: string }[] = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Service' },
  { to: '/acceptable-use', label: 'Acceptable Use Policy' },
  { to: '/data-processing', label: 'Data Processing Terms' },
  { to: '/subprocessors', label: 'Sub-processors' },
  { to: '/security', label: 'Security' },
  { to: '/accessibility', label: 'Accessibility' },
  { to: '/code-of-conduct', label: 'Code of Conduct' },
]

/** The DPO appointment and contact clause, rendered verbatim. */
export function DpoClause() {
  const d = DPO_CLAUSE
  const value = (k: string, v: string) => k === 'Official Contact Email' ? <a href={`mailto:${v}`} className="font-semibold text-emerald-700 underline">{v}</a>
    : k === 'Contact Phone Number' ? <a href={`tel:${v}`} className="font-semibold text-emerald-700 underline">{v}</a> : v
  return (
    <section id="dpo" aria-labelledby="dpo-heading" className="scroll-mt-24 rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-6 shadow-sm sm:p-8">
      <h2 id="dpo-heading" className="font-display text-lg font-bold text-emerald-900 sm:text-xl">{d.heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700 sm:text-[15px]">
        <p>{d.intro}</p>
        <p>{d.lead}</p>
        <ul className="ml-5 list-disc space-y-1">{d.details.map(([k, v]) => <li key={k}>{k}: {value(k, v)}</li>)}</ul>
        <p>{d.closing}</p>
      </div>
    </section>
  )
}

export const DpoMail = () => <a href={`mailto:${DPO_CLAUSE.email}`} className="font-semibold text-emerald-700 underline-offset-2 hover:underline">{DPO_CLAUSE.email}</a>

export const Mail = () => <a href={`mailto:${BRAND.contactEmail}`} className="font-semibold text-emerald-700 underline-offset-2 hover:underline">{BRAND.contactEmail}</a>

/** Shared layout for legal and trust pages: header, effective date, numbered sections and links to the other policies. */
export function PolicyLayout({ kicker = 'Legal', title, intro, effective, sections, notice }: { kicker?: string; title: string; intro: React.ReactNode; effective: string; sections: PolicySection[]; notice?: React.ReactNode }) {
  return (
    <div>
      <section className="bg-gradient-to-br from-emerald-900 to-slate-900 py-16 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">{kicker}</p>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">{title}</h1>
          <div className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">{intro}</div>
          <p className="mt-4 text-xs text-slate-400">Effective date: {effective}</p>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-6 py-12">
        <nav aria-label="On this page" className="mb-8 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="mb-2 font-semibold text-slate-700">On this page</p>
          {notice && <p className="mb-1"><a className="text-emerald-700 hover:underline" href="#dpo">Data Protection Officer (DPO) Appointment &amp; Contact</a></p>}
          <ol className="list-decimal space-y-1 pl-5">{sections.map((s, i) => <li key={s.title}><a className="text-emerald-700 hover:underline" href={`#s${i + 1}`}>{s.title}</a></li>)}</ol>
        </nav>
        <div className="space-y-5">
          {notice}
          {sections.map((s, i) => (
            <section key={s.title} id={`s${i + 1}`} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="font-display text-lg font-bold text-emerald-900 sm:text-xl">{i + 1}. {s.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700 sm:text-[15px] [&_li]:ml-5 [&_li]:list-disc [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:border-slate-200 [&_th]:bg-emerald-50 [&_th]:p-2 [&_th]:text-left">{s.body}</div>
            </section>
          ))}
        </div>
        <nav aria-label="Policies" className="mt-10 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
          {POLICY_LINKS.map(l => <Link key={l.to} to={l.to} className="text-emerald-700 hover:underline">{l.label}</Link>)}
        </nav>
        <p className="mt-6 text-center text-xs text-slate-400">{BRAND.footer}</p>
      </section>
    </div>
  )
}
