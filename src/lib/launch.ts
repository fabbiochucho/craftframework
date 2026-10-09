// Launch campaign content for craftframework.becomechange.institute.
// Single source of truth for the /launch press kit page AND the generated
// marketing/launch-copy.md (see marketing/scripts/build-assets.mjs). Keep this
// file free of imports so the Node build script can load it directly.

export const LAUNCH = {
  date: '2026-10-12',
  dateLong: 'Monday, 12 October 2026',
  dateShort: '12 October 2026',
  url: 'https://craftframework.becomechange.institute',
  displayUrl: 'craftframework.becomechange.institute',
  contactEmail: 'craftframework@becomechange.institute',
  product: 'CRAFT',
  productFull: 'CRAFT: Capacity Readiness & Fiduciary Assurance Toolkit',
  framework: 'ICARF v4.0',
  institute: 'DiBadili Institute',
  instituteUrl: 'https://www.becomechange.institute',
  headline: 'Building Fiduciary Trust for Direct G2G, DFI and Donor Partnerships.',
  hashtags: ['#CRAFTFramework', '#FiduciaryTrust', '#InstitutionalReadiness', '#DigitalPublicGood', '#DiBadili'],
} as const

export const KEY_MESSAGES = [
  {
    title: 'Readiness you can prove',
    body: 'CRAFT scores institutions across 5 tiers and 20 domains on a 0–5 maturity scale, backed by a 7-point evidence matrix.',
  },
  {
    title: 'Execution over paperwork',
    body: 'The Paper Compliance Penalty Engine caps ratings when implementation evidence is weak, so policy manuals alone never inflate a score.',
  },
  {
    title: 'From gaps to a plan',
    body: 'Every gap becomes a costed, owned, time-bound action inside a 24-month Capacity Improvement Plan.',
  },
  {
    title: 'Trust that travels',
    body: 'A Universal Data Room and independent Trust Delta verification give donors, DFIs, regulators and auditors one shared, evidence-backed view.',
  },
  {
    title: 'Open by design',
    body: 'CRAFT is a digital public good: software under GPL-3.0, framework under CC BY-SA 4.0.',
  },
] as const

export const AUDIENCES = [
  { name: 'Ministries & public agencies', pitch: 'Demonstrate readiness for direct G2G funding and public accountability.' },
  { name: 'NGOs & civil society', pitch: 'Strengthen grant eligibility and earn lasting donor trust.' },
  { name: 'Private sector & SMEs', pitch: 'Get investment- and contract-ready with evidence funders accept.' },
  { name: 'Donors, DFIs & auditors', pitch: 'Assess partners against one consistent, verifiable standard.' },
] as const

export const BOILERPLATE = {
  short:
    'CRAFT (Capacity Readiness & Fiduciary Assurance Toolkit) is an open-source platform from the DiBadili Institute that helps institutions prove they are ready to receive and manage direct funding.',
  medium:
    'CRAFT, the Capacity Readiness & Fiduciary Assurance Toolkit, is a secure, multi-tenant platform for institutional readiness assessment, fiduciary assurance and independent Trust Delta verification. Built on the ICARF v4.0 framework, it serves ministries, NGOs, private enterprises and the donors, DFIs and auditors who fund them.',
  institute:
    'The DiBadili Institute ("Become Change") helps African businesses, organizations and institutions close the distance between ambition and execution, building the systems, leaders and accountability that turn policy into measurable outcomes. Learn more at www.becomechange.institute.',
} as const

export const ONE_LINERS = [
  'CRAFT: the global standard for institutional readiness. Live 12 October 2026.',
  'Paper compliance never inflates a score. Meet CRAFT.',
  'From policy intent to execution clarity: prove your institution is ready for direct funding.',
  'One framework. Three institutional realities. Every gap turned into a plan.',
] as const

export type SocialPost = { channel: string; phase: string; text: string }

const tags = LAUNCH.hashtags.join(' ')

export const SOCIAL_POSTS: SocialPost[] = [
  {
    channel: 'LinkedIn',
    phase: 'Teaser (T-3 days)',
    text: `Something we've been building for a long time goes live on ${LAUNCH.dateLong}.

Too many capable institutions miss out on direct funding because they can't prove what they already do well. Too many funders rely on policy manuals that never reach practice.

CRAFT changes that. Save the date.

${LAUNCH.url}
${tags}`,
  },
  {
    channel: 'LinkedIn',
    phase: 'Launch day',
    text: `Today the DiBadili Institute launches CRAFT, the Capacity Readiness & Fiduciary Assurance Toolkit.

CRAFT helps ministries, NGOs and enterprises prove they are ready for direct G2G, DFI and donor partnerships:

✅ 5 tiers, 20 domains, a 0–5 maturity scale backed by evidence
✅ A Paper Compliance Penalty Engine: manuals alone never inflate a score
✅ Every gap converted into a costed 24-month Capacity Improvement Plan
✅ A Universal Data Room and independent Trust Delta verification
✅ Open source: GPL-3.0 software, CC BY-SA 4.0 framework

Register your institution or try the live demo: ${LAUNCH.url}

${tags}`,
  },
  {
    channel: 'LinkedIn',
    phase: 'Post-launch (week 1)',
    text: `What does "ready for direct funding" actually look like?

CRAFT's free Readiness Check gives you a first read in minutes, with no account needed. Then go deeper with the full assessment and turn every finding into an action plan.

Start here: ${LAUNCH.url}/pre-assessment
${tags}`,
  },
  {
    channel: 'X',
    phase: 'Teaser (T-3 days)',
    text: `3 days. One new standard for institutional readiness.

CRAFT launches ${LAUNCH.dateShort}. ${LAUNCH.url}
#CRAFTFramework #FiduciaryTrust`,
  },
  {
    channel: 'X',
    phase: 'Launch day',
    text: `CRAFT is live 🚀

The Capacity Readiness & Fiduciary Assurance Toolkit from @dibadiliafrica: evidence-backed readiness scoring, costed capacity plans and Trust Delta verification for G2G, DFI and donor funding.

Open source. Free to explore. ${LAUNCH.url}
#CRAFTFramework`,
  },
  {
    channel: 'X',
    phase: 'Post-launch (week 1)',
    text: `Perfect policy manual. Zero system-enforced implementation.

That's the Paper Compliance Illusion, and CRAFT is built to expose it. Try the Readiness Check: ${LAUNCH.url}/pre-assessment
#InstitutionalReadiness`,
  },
  {
    channel: 'Instagram / Facebook',
    phase: 'Launch day',
    text: `CRAFT is here. 🛡️

A new open standard that helps institutions prove they are ready for direct funding, and helps funders trust what they see.

Built by the DiBadili Institute for ministries, NGOs, enterprises and the partners who fund them.

🔗 ${LAUNCH.displayUrl}

${tags}`,
  },
  {
    channel: 'WhatsApp / Telegram',
    phase: 'Launch day',
    text: `Hi! Today we launched CRAFT, the DiBadili Institute's free, open-source toolkit for institutional and fiduciary readiness. If your organization works with donors, DFIs or government funding, take the 5-minute Readiness Check: ${LAUNCH.url}/pre-assessment`,
  },
]

export const LAUNCH_EMAIL = {
  subject: 'Introducing CRAFT: prove your institution is ready for direct funding',
  preheader: 'The DiBadili Institute launches an open standard for fiduciary trust on 12 October 2026.',
  body: `Dear colleague,

On ${LAUNCH.dateLong}, the DiBadili Institute launches CRAFT, the Capacity Readiness & Fiduciary Assurance Toolkit.

Institutions across the world are capable of managing direct funding, yet many struggle to prove it. Funders, meanwhile, too often rely on documents that never reach practice. CRAFT closes that gap with a single, evidence-backed standard.

With CRAFT you can:
• Assess readiness across 5 tiers and 20 domains with a 0–5 maturity scale
• Receive an A–E rating that rewards real implementation, not paperwork
• Turn every gap into a costed, owned 24-month Capacity Improvement Plan
• Share evidence securely through a Universal Data Room
• Invite independent Trust Delta verification for donors and auditors

CRAFT is a digital public good, free to explore and open source.

→ Take the Readiness Check: ${LAUNCH.url}/pre-assessment
→ Explore the live demo: ${LAUNCH.url}/demo
→ Register your institution: ${LAUNCH.url}/auth

Questions or partnership enquiries? Reply to this email or write to ${LAUNCH.contactEmail}.

With purpose,
The CRAFT team
DiBadili Institute`,
}

export const PRESS_RELEASE = {
  title: 'DiBadili Institute Launches CRAFT, an Open Standard for Institutional Readiness and Fiduciary Trust',
  subtitle:
    'The Capacity Readiness & Fiduciary Assurance Toolkit helps ministries, NGOs and enterprises prove they are ready for direct G2G, DFI and donor partnerships.',
  dateline: `FOR IMMEDIATE RELEASE · ${LAUNCH.dateShort}`,
  paragraphs: [
    `The DiBadili Institute today announced the public launch of CRAFT, the Capacity Readiness & Fiduciary Assurance Toolkit, available now at ${LAUNCH.displayUrl}. CRAFT gives institutions and their funders one evidence-backed way to measure, strengthen and verify readiness to receive and manage direct funding.`,
    'Built on the ICARF v4.0 framework, CRAFT assesses institutions across 5 tiers and 20 domains, from governance and fiduciary controls to grant management and digital readiness. Each response is scored on a 0–5 maturity scale and backed by a 7-point evidence matrix. A Paper Compliance Penalty Engine caps ratings where implementation evidence is weak, ensuring that a well-written policy manual never stands in for a working system.',
    'Every gap identified becomes a costed, owned and time-bound action within a 24-month Capacity Improvement Plan. Institutions can share supporting evidence through a secure Universal Data Room, and donors, DFIs, regulators and auditors can commission independent Trust Delta verification to confirm results.',
    '"Capable institutions are too often locked out of direct funding simply because they cannot prove what they already do well," said a spokesperson for the DiBadili Institute. "CRAFT moves the conversation from policy intent to execution clarity, giving both institutions and funders a shared, trustworthy picture."',
    'CRAFT adapts to three institutional realities: the public sector, civil society, and the private sector. It is released as a digital public good, with software licensed under GPL-3.0 and the framework under CC BY-SA 4.0.',
    `Institutions can begin with the free Readiness Check, explore a live demo with sample data, or register at ${LAUNCH.url}.`,
  ],
} as const

export const PRESS_CONTACT = {
  name: 'CRAFT Launch Team, DiBadili Institute',
  email: LAUNCH.contactEmail,
  web: LAUNCH.url,
} as const
