import { Database, Users2, Share2, ShieldCheck, Clock, Globe2, Cookie, Mail } from 'lucide-react'
import { Reveal } from '../components/ui'
import { BRAND } from '../lib/data'

// Last substantive revision of this policy. Update when the text changes.
const EFFECTIVE_DATE = 'September 21, 2026'

interface Clause {
  icon: typeof Database
  title: string
  body: React.ReactNode
}

const CLAUSES: Clause[] = [
  {
    icon: Database,
    title: '1. Data We Collect',
    body: (
      <>
        Account data: your name, email address, and organization affiliation when you register or are
        invited to a workspace. Workspace data: assessment responses, capacity-improvement plans,
        compliance records, financial reconciliation figures, and Data Room documents your organization
        enters or uploads. Usage data: sign-in timestamps and the directory record created when you first
        authenticate. We do not collect payment card data — {BRAND.product} does not process payments.
      </>
    ),
  },
  {
    icon: Users2,
    title: '2. How We Use Your Data',
    body: (
      <>
        To provide the Service: authenticate you, scope your workspace to your organization, compute
        readiness scores, and track your Capacity Improvement Plan. To operate the platform: send
        transactional emails (invitations, compliance-deadline reminders) and maintain an audit log of
        account and permission changes. We do not use your workspace data to train any AI model, and we do
        not sell your data to third parties.
      </>
    ),
  },
  {
    icon: Share2,
    title: '3. Who We Share Data With',
    body: (
      <>
        We use a small number of infrastructure providers to run the Service, each acting as a data
        processor under contract, never as an independent data controller of your information: our hosting
        and serverless function provider, our authentication provider, our Postgres database provider, our
        file-storage provider for Data Room evidence, and Resend for transactional email delivery. Within
        {' '}{BRAND.product} itself, your data is visible only to your own organization's workspace members,
        an access grant you or your organization has explicitly issued to a reviewer or firm, and platform
        administrators where necessary for support or legal compliance.
      </>
    ),
  },
  {
    icon: ShieldCheck,
    title: '4. Your Rights (GDPR / CCPA)',
    body: (
      <>
        If you are in the European Economic Area, the UK, or California, you have the right to access the
        personal data we hold about you, correct it, export it, and request its deletion (the
        "right to be forgotten"). Once signed in, download an export at <code>/api/privacy/export</code> or
        request organisation-scoped erasure through <code>POST /api/privacy/erasure-requests</code>. A different
        organisation admin or owner must approve erasure; you may also contact us for assistance. California residents additionally have the right to opt out of the sale
        or sharing of personal data — we do not sell or share personal data, so this right is satisfied by
        default. To exercise any of these rights, contact{' '}
        <a href={`mailto:${BRAND.contactEmail}`} className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
          {BRAND.contactEmail}
        </a>{' '}
        We respond to verified requests within 30 days.
      </>
    ),
  },
  {
    icon: Clock,
    title: '5. Data Retention',
    body: (
      <>
        We retain organisational assessment, compliance, financial, and evidence records while the
        organisation needs them for accountability. An approved erasure request removes the member's
        organisation membership and replaces their identity in audit actors and assigned/created-by fields
        with a pseudonym; archived evidence blobs are purged. The audit trail and a minimal erasure-request
        record are retained to preserve integrity and demonstrate that the request was handled. Active
        organisational evidence and business records may remain where needed for legal or audit obligations.
      </>
    ),
  },
  {
    icon: Globe2,
    title: '6. International Data Transfers',
    body: (
      <>
        {BRAND.product} serves institutions across Africa, the EU, the GCC, and beyond. Your data may be
        processed in a different country than the one you are located in. Where we transfer personal data
        out of the EEA or UK, we rely on our processors' standard contractual clauses or equivalent
        safeguards.
      </>
    ),
  },
  {
    icon: Cookie,
    title: '7. Cookies & Local Storage',
    body: (
      <>
        {BRAND.product} does not use advertising or analytics-tracking cookies. We use a small number of
        strictly necessary items stored in your browser: a session token to keep you signed in, and a
        language-preference cookie/local-storage value so the interface remembers your chosen language. No
        non-essential trackers are loaded, so no cookie-consent banner is required under applicable law.
      </>
    ),
  },
  {
    icon: Mail,
    title: '8. Changes & Contact',
    body: (
      <>
        We may revise this policy from time to time by updating this page and its effective date. For any
        privacy question, or to exercise a data-subject right, contact{' '}
        <a href={`mailto:${BRAND.contactEmail}`} className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
          {BRAND.contactEmail}
        </a>
        .
      </>
    ),
  },
]

export function PrivacyPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-emerald-900 to-slate-900 py-20 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">Legal</p>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Privacy Policy</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            What personal data {BRAND.product} collects, why, who it's shared with, and the rights you have
            over it.
          </p>
          <p className="mt-4 text-xs text-slate-400">Effective date: {EFFECTIVE_DATE}</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="space-y-5">
          {CLAUSES.map((c, i) => {
            const Icon = c.icon
            return (
              <Reveal key={c.title} delay={i * 60}>
                <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold text-emerald-900 sm:text-xl">{c.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-[15px]">{c.body}</p>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          {BRAND.footer}
        </p>
      </section>
    </div>
  )
}
