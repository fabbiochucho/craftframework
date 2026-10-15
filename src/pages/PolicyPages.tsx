import { Link } from '@tanstack/react-router'
import { BRAND } from '../lib/data'
import { Mail, PolicyLayout, type PolicySection } from '../components/PolicyLayout'

const EFFECTIVE = '15 October 2026'
const L = ({ to, children }: { to: string; children: React.ReactNode }) => <Link to={to} className="text-emerald-700 underline">{children}</Link>

// --- Acceptable Use ------------------------------------------------------------------------------
const AUP: PolicySection[] = [
  { title: 'Purpose', body: <p>This policy sets out what you may not do with {BRAND.product}. It forms part of the <L to="/terms">Terms of Service</L> and applies to everyone who uses the platform, including invited reviewers, validators and firms.</p> },
  { title: 'Use the platform honestly', body: <ul>
    <li>Do not upload documents, scores or evidence you know to be false, altered or misleading, or present an assessment as independent when it is not.</li>
    <li>Do not present a CRAFT score, report or scorecard as a certification, credit rating, regulator-issued rating, audit opinion or guarantee of compliance.</li>
    <li>Do not approve your own work where the platform requires a second person (segregation of duties), or ask others to approve without review.</li>
    <li>Only register an organisation type (for example a national public health institute or a government body) that is accurate.</li>
  </ul> },
  { title: 'Respect other people’s data', body: <ul>
    <li>Upload personal data only when you are entitled to and it is needed for the assessment; prefer anonymised or summarised evidence.</li>
    <li>Do not upload special-category data (health records of individuals, biometric data, data about children) unless your organisation has a lawful basis and has approved it.</li>
    <li>Do not use the platform to harass, discriminate against or expose whistleblowers, founders, staff or communities.</li>
  </ul> },
  { title: 'Keep the platform secure', body: <ul>
    <li>Do not share accounts, bypass multi-factor sign-in or access organisations, workspaces or data you have not been granted.</li>
    <li>Do not probe, scan or load-test the service, or attempt to break its security, except as allowed under our <L to="/security">responsible disclosure</L> rules.</li>
    <li>Do not upload malware, scrape the service, or use automated tools that place unreasonable load on it.</li>
  </ul> },
  { title: 'Lawful use', body: <p>Do not use {BRAND.product} for anything unlawful, including fraud, money laundering, sanctions evasion, infringement of intellectual property, or breach of confidentiality or data protection law.</p> },
  { title: 'Reporting and enforcement', body: <p>Report misuse to <Mail />. We may remove content, suspend access or close accounts that breach this policy, and will tell the affected organisation where appropriate. Serious matters may be referred to the relevant authorities.</p> },
]
export const AcceptableUsePage = () => <PolicyLayout title="Acceptable Use Policy" effective={EFFECTIVE} sections={AUP} intro={<>The rules for using {BRAND.product} responsibly and safely.</>} />

// --- Security ----------------------------------------------------------------------------------
const SEC: PolicySection[] = [
  { title: 'Our approach', body: <p>{BRAND.product} holds governance, fiduciary and evidence records that organisations rely on with funders and regulators. We design for least privilege, tenant isolation, verifiable records and transparency about limits.</p> },
  { title: 'Safeguards in place', body: <ul>
    <li><b>Encryption:</b> HTTPS everywhere with HSTS; sensitive fields (contact details, reviewer notes, sensitive findings, multi-factor secrets) encrypted at rest with AES-256-GCM and rotatable keys.</li>
    <li><b>Sign-in:</b> password sign-in plus optional multi-factor sign-in with an authenticator app and single-use recovery codes; organisations can require it for all members. Sessions time out after inactivity.</li>
    <li><b>Access control:</b> roles per organisation (owner, admin, assessor, viewer); every request is checked server-side; other organisations’ records are not discoverable.</li>
    <li><b>Segregation of duties:</b> creators cannot approve their own assessments, uploaders cannot approve their own evidence, and corrective actions close only on verified evidence.</li>
    <li><b>Verification of restricted roles:</b> national public health institutes are verified by institute email domain or by a platform operator before health-security assessments unlock.</li>
    <li><b>Audit trail:</b> changes and sensitive reads are logged with actor, time, IP address and browser; finalised reports are frozen snapshots.</li>
    <li><b>Abuse protection:</b> shared rate limits on every endpoint, stricter limits on multi-factor code attempts, and an organisational email domain to create an organisation.</li>
    <li><b>Uploads:</b> file-type allow-list, 10 MB limit, image metadata stripped, content checked against the document’s name, downloads served as attachments.</li>
    <li><b>Browser protections:</b> Content Security Policy (no third-party scripts), frame blocking, MIME sniffing protection, a strict referrer policy and a Permissions-Policy that disables camera, microphone, location and payment features.</li>
    <li><b>Engineering:</b> code review, automated tests, static analysis (CodeQL), dependency auditing and automated dependency updates on every change; secrets are kept only in the hosting provider’s environment settings.</li>
  </ul> },
  { title: 'Your part', body: <ul>
    <li>Turn on <L to="/app/security">multi-factor sign-in</L>, and keep your recovery codes somewhere safe.</li>
    <li>Give people the lowest role they need, and remove members who leave.</li>
    <li>Avoid uploading personal data that is not needed.</li>
  </ul> },
  { title: 'Reporting a vulnerability', body: <>
    <p>Email <Mail /> with a description, the affected page or endpoint, steps to reproduce and the impact. Please do not open a public issue. Our machine-readable contact is at <code>/.well-known/security.txt</code>.</p>
    <p>We aim to acknowledge reports within five working days, keep you informed during triage and fix, and credit you if you wish.</p>
  </> },
  { title: 'Safe harbour', body: <p>We will not pursue action against good-faith research that follows these rules: only test accounts and data you own or are authorised to use; do not access, change or keep other people’s data; avoid service disruption (no denial-of-service, spam or heavy automated scanning); and give us reasonable time to fix an issue before disclosing it.</p> },
  { title: 'Incidents', body: <p>If a breach affects personal data, we will notify the affected organisations without undue delay so they can meet their own obligations, and notify regulators where the law requires — for example within 72 hours under the Nigeria Data Protection Act and the GDPR.</p> },
]
export const SecurityPolicyPage = () => <PolicyLayout kicker="Trust" title="Security" effective={EFFECTIVE} sections={SEC} intro={<>How {BRAND.product} protects your data, what you can do, and how to report a vulnerability.</>} />

// --- Sub-processors ------------------------------------------------------------------------------
const SUB: PolicySection[] = [
  { title: 'Current sub-processors', body: <table><thead><tr><th>Provider</th><th>Purpose</th><th>Data involved</th><th>When</th></tr></thead><tbody>
    <tr><td>Netlify</td><td>Hosting, serverless functions, sign-in (Identity), file storage (Blobs) and the Postgres database</td><td>All platform data</td><td>Always</td></tr>
    <tr><td>SendGrid (Twilio)</td><td>Scheduled reports and escalation email</td><td>Recipient email, report content</td><td>When reports or escalations are sent</td></tr>
    <tr><td>Cloudflare (Turnstile)</td><td>Security check that stops automated sign-ups</td><td>IP address and browser signals during the check; no cookies for tracking</td><td>When you register an account</td></tr>
    <tr><td>Resend</td><td>Invitations, reminders and compliance-deadline alerts</td><td>Recipient email, message content</td><td>When these emails are sent</td></tr>
    <tr><td>Anthropic (through Netlify’s AI gateway)</td><td>Translating interface text into other languages</td><td>Interface text shown on screen</td><td>When you choose a language other than English</td></tr>
    <tr><td>PostHog (EU)</td><td>Optional analytics of support-chat events</td><td>Event type only; no message content or identity</td><td>Only if you opt in</td></tr>
    <tr><td>GitHub</td><td>Public support issues you choose to publish</td><td>Your redacted message</td><td>Only after you accept public disclosure</td></tr>
  </tbody></table> },
  { title: 'What does not leave your browser', body: <p>Optical character recognition of scanned documents runs in your browser with files served from our own site; no OCR or document data is sent to a third party.</p> },
  { title: 'Changes', body: <p>We update this list before a new sub-processor processes workspace data. Organisations that need advance notice can ask at <Mail />.</p> },
]
export const SubprocessorsPage = () => <PolicyLayout kicker="Trust" title="Sub-processors" effective={EFFECTIVE} sections={SUB} intro={<>Service providers that process data on our behalf, what they receive and when.</>} />

// --- Data processing terms -------------------------------------------------------------------------
const DPT: PolicySection[] = [
  { title: 'Scope and roles', body: <p>These terms apply when an organisation (the <b>controller</b>) uses {BRAND.product} to process personal data in its workspaces, and the DiBadili Institute processes that data as <b>processor</b>. They form part of the <L to="/terms">Terms of Service</L> and are intended to meet the processor requirements of the Nigeria Data Protection Act 2023, Kenya’s Data Protection Act 2019, POPIA, the GDPR and similar laws.</p> },
  { title: 'Instructions', body: <p>We process workspace personal data only to provide the service as configured by the organisation and its members, and on its documented instructions, unless the law requires otherwise (in which case we will tell the organisation unless legally prohibited).</p> },
  { title: 'Confidentiality and security', body: <p>People authorised to process the data are bound by confidentiality. We maintain the technical and organisational measures described on the <L to="/security">Security</L> page and review them regularly.</p> },
  { title: 'Sub-processors', body: <p>The organisation authorises the sub-processors listed on the <L to="/subprocessors">Sub-processors</L> page. We impose equivalent data protection obligations on them and remain responsible for them. We will update the list before adding a sub-processor that processes workspace data, and the organisation may object on reasonable grounds.</p> },
  { title: 'Assistance', body: <ul>
    <li>Data subject requests: the platform provides exports and an erasure workflow; we help with requests we receive.</li>
    <li>Breaches: we notify the organisation without undue delay after becoming aware of a personal data breach affecting its workspace.</li>
    <li>Impact assessments and regulator enquiries: we provide reasonable information about our processing.</li>
  </ul> },
  { title: 'Transfers', body: <p>Where processing involves a cross-border transfer, we rely on a lawful transfer mechanism such as adequacy or the provider’s standard contractual clauses.</p> },
  { title: 'Deletion and return', body: <p>When the organisation stops using the service, it can export its data. On request we delete its workspace data, except where the law requires us to keep it, and keep finalised audit records only as needed to show requests were handled.</p> },
  { title: 'Audits', body: <p>We make available the information reasonably needed to show compliance with these terms, including this documentation, our audit logs for the organisation’s workspaces and summaries of security testing, and cooperate with reasonable audits on notice.</p> },
  { title: 'Signed agreement', body: <p>Organisations that need a countersigned data processing agreement can request one at <Mail />.</p> },
]
export const DataProcessingPage = () => <PolicyLayout title="Data Processing Terms" effective={EFFECTIVE} sections={DPT} intro={<>Our commitments when we process personal data on behalf of your organisation.</>} />

// --- Accessibility -------------------------------------------------------------------------------
const ACC: PolicySection[] = [
  { title: 'Our goal', body: <p>We aim for {BRAND.product} to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, so that people using screen readers, keyboards, magnification or low-bandwidth connections can assess and report on their organisations.</p> },
  { title: 'What we do', body: <ul>
    <li>Labelled form controls, keyboard-operable controls and visible focus.</li>
    <li>Semantic headings, landmarks and status messages announced to assistive technology.</li>
    <li>Respect for reduced-motion settings; content readable without animation.</li>
    <li>Offline mode and exports (Word, PDF, Excel, CSV) for low-connectivity settings.</li>
    <li>Browser tests that find controls by their accessible names and roles for key journeys, so missing labels break the build.</li>
  </ul> },
  { title: 'Known limitations', body: <ul>
    <li>Some charts and the dependency graph are visual; their figures are also given in tables and exports.</li>
    <li>Interface translations into some languages are machine-assisted and may contain errors.</li>
    <li>Older legacy dashboard pages have not yet been fully reviewed.</li>
  </ul> },
  { title: 'Feedback', body: <p>If something is hard to use, tell us at <Mail /> with the page and the assistive technology you use. We aim to respond within five working days and to offer the information in another format.</p> },
]
export const AccessibilityPage = () => <PolicyLayout kicker="Trust" title="Accessibility Statement" effective={EFFECTIVE} sections={ACC} intro={<>Our commitment to making {BRAND.product} usable by everyone.</>} />
