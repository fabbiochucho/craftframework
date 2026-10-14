import { Link } from '@tanstack/react-router'
import { BRAND } from '../lib/data'
import { Mail, PolicyLayout, type PolicySection } from '../components/PolicyLayout'

// Last substantive revision of this policy. Update when the text changes.
export const PRIVACY_EFFECTIVE_DATE = '15 October 2026'

const SECTIONS: PolicySection[] = [
  { title: 'Who we are and our role', body: <>
    <p>{BRAND.product} is operated by the DiBadili Institute. For your account (name, email, sign-in and security records) we are the <b>controller</b>. For the information an organisation puts into its workspace — assessments, findings, plans, evidence and reports — the <b>organisation is the controller</b> and we act as its <b>processor</b> under our <Link to="/data-processing" className="text-emerald-700 underline">Data Processing Terms</Link>.</p>
    <p>Data protection contact: <Mail />.</p>
  </> },
  { title: 'Data we collect', body: <ul>
    <li><b>Account data:</b> name, email address, organisation memberships and roles.</li>
    <li><b>Security data:</b> sign-in session records, multi-factor sign-in status (the authenticator secret is encrypted; recovery codes are stored only as one-way hashes), rate-limit counters and audit-log entries (who did what, when, and the IP address and browser type of the request).</li>
    <li><b>Workspace data:</b> assessment responses and scores, findings, corrective actions, plans, budgets, ESG report checks, organisational design reviews, health-security assessments, regulatory source checks and uploaded evidence.</li>
    <li><b>Support data:</b> messages you send to the support assistant, redacted before storage; an optional contact email.</li>
    <li><b>We do not collect</b> payment card data, and we do not use advertising trackers.</li>
  </ul> },
  { title: 'How we use it and our lawful bases', body: <table><thead><tr><th>Purpose</th><th>Lawful basis</th></tr></thead><tbody>
    <tr><td>Provide the service: sign-in, workspaces, scoring, reports, exports</td><td>Contract with you or your organisation</td></tr>
    <tr><td>Security: authentication, multi-factor sign-in, rate limiting, audit trails, fraud and abuse prevention</td><td>Legitimate interests and legal obligations to secure personal data</td></tr>
    <tr><td>Transactional email: invitations, reminders, scheduled reports, escalations</td><td>Contract; legitimate interests</td></tr>
    <tr><td>Optional product analytics of support-chat events</td><td>Consent (off unless you opt in)</td></tr>
    <tr><td>Answering requests and complaints; meeting legal duties</td><td>Legal obligation; legitimate interests</td></tr>
  </tbody></table> },
  { title: 'How documents are checked', body: <>
    <p>When evidence is uploaded, the server reads the document’s text to check that it matches its name or declared type. The extracted text is <b>not stored</b>; only the result (match, possible mismatch, unreadable) and matched keywords are kept. Scanned documents are read by optical character recognition <b>inside your own browser</b>; only the recognised text is sent for the check, and the image never leaves your device for OCR.</p>
    <p>We do not use workspace data to train AI models, and we do not sell personal data.</p>
  </> },
  { title: 'Who we share it with', body: <>
    <p>Inside {BRAND.product}, workspace data is visible only to members of that organisation’s workspaces, people the organisation grants access to (for example an independent validator or reviewer), and platform operators where needed for support, security or legal compliance.</p>
    <p>We use a small number of service providers as sub-processors, listed with their purpose and data on the <Link to="/subprocessors" className="text-emerald-700 underline">Sub-processors</Link> page. Support messages you choose to make public are published, after personal details are redacted, as issues in the public CRAFT GitHub repository; conduct and security reports are never published.</p>
  </> },
  { title: 'Your rights', body: <>
    <p>Depending on where you are, data protection law gives you rights to access, correct, delete, restrict or object to processing of your personal data, to data portability, and to withdraw consent. These include the Nigeria Data Protection Act 2023, Kenya’s Data Protection Act 2019, South Africa’s Protection of Personal Information Act, Ghana’s Data Protection Act 2012, Uganda’s Data Protection and Privacy Act 2019, Rwanda’s Law No. 058/2021, the EU and UK GDPR, and similar laws elsewhere.</p>
    <ul>
      <li>Download a copy of your data from the platform (privacy export).</li>
      <li>Ask for erasure from within your organisation; another organisation admin or owner approves it.</li>
      <li>Or write to <Mail />. We respond to verified requests within 30 days.</li>
    </ul>
    <p>Where workspace data belongs to an organisation, we pass requests about it to that organisation as controller.</p>
  </> },
  { title: 'Retention', body: <>
    <p>Workspace records are kept while the organisation needs them for accountability, then deleted or anonymised at its request. Finalised reports, assessments and checklists are kept as frozen snapshots so they stay verifiable.</p>
    <p>An approved erasure request removes the person’s memberships, replaces their identity in audit actors and assignment fields with a pseudonym, and purges archived evidence files. The audit trail and a minimal record of the request are kept to show it was handled. Rate-limit counters are deleted within minutes; multi-factor secrets and recovery-code hashes are deleted when you turn multi-factor sign-in off.</p>
  </> },
  { title: 'International transfers', body: <p>Our service providers may process data outside your country. Where a transfer requires safeguards — for example under the Nigeria Data Protection Act, POPIA or the GDPR — we rely on adequacy, the provider’s standard contractual clauses, or another lawful transfer mechanism, and we keep the list of providers and locations on the <Link to="/subprocessors" className="text-emerald-700 underline">Sub-processors</Link> page.</p> },
  { title: 'Cookies and browser storage', body: <><table><thead><tr><th>Name</th><th>Purpose</th><th>Type</th><th>Duration</th></tr></thead><tbody>
    <tr><td><code>nf_jwt</code></td><td>Keeps you signed in</td><td>Strictly necessary</td><td>Session; renewed while active</td></tr>
    <tr><td><code>craft_mfa</code></td><td>Shows a multi-factor code was entered in this browser</td><td>Strictly necessary (HttpOnly, Secure)</td><td>12 hours</td></tr>
    <tr><td><code>craft_lang_hint</code></td><td>Suggests an interface language from your approximate country (only when you have not chosen one)</td><td>Functional cookie</td><td>30 days</td></tr>
    <tr><td>Language preference</td><td>Remembers the language you chose</td><td>Functional (browser storage)</td><td>Until cleared</td></tr>
    <tr><td><code>craft_session_lock</code> and workspace selection</td><td>Inactivity sign-out across tabs; remembers the selected organisation</td><td>Strictly necessary / functional (browser storage)</td><td>Until cleared</td></tr>
    <tr><td>Offline queue</td><td>Holds edits made offline until they sync</td><td>Functional (browser database)</td><td>Until synced or cleared</td></tr>
  </tbody></table><p>Support-chat analytics (PostHog, EU) is off unless you opt in; it keeps no cookies or browser storage and records only the type of support event, never message content.</p></> },
  { title: 'Security', body: <p>We protect data with encryption in transit (HTTPS with HSTS), field-level encryption of sensitive fields at rest, role-based access per organisation and workspace, optional and organisation-enforceable multi-factor sign-in, segregation-of-duties checks, rate limiting, strict security headers and audit logs. See <Link to="/security" className="text-emerald-700 underline">Security</Link> for details and how to report a vulnerability.</p> },
  { title: 'Children', body: <p>{BRAND.product} is for organisations and professionals. It is not directed at children and we do not knowingly collect children’s personal data.</p> },
  { title: 'Complaints', body: <p>Please contact us first at <Mail />. You may also complain to your data protection authority, for example the Nigeria Data Protection Commission, Kenya’s Office of the Data Protection Commissioner, South Africa’s Information Regulator, Ghana’s Data Protection Commission, Uganda’s Personal Data Protection Office, Rwanda’s National Cyber Security Authority, or your EU or UK supervisory authority.</p> },
  { title: 'Changes', body: <p>We update this policy when our processing changes and change the effective date above. Material changes are highlighted at the top of this page.</p> },
]

export function PrivacyPage() {
  return <PolicyLayout title="Privacy Policy" effective={PRIVACY_EFFECTIVE_DATE} sections={SECTIONS}
    intro={<>What personal data {BRAND.product} collects, why, who it is shared with, how long it is kept and the rights you have over it.</>} />
}
