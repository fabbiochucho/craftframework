import { createHash } from 'node:crypto'

export type SupportCategory = 'bug' | 'feature' | 'question'

export type SupportClassification = {
  type: SupportCategory
  confidence: number
  urgency: 'high' | 'medium' | 'low'
}

const FAQS = [
  {
    keywords: ['setup', 'install', 'get started', 'local', 'run'],
    answer: `## Getting Started with craftframework

**Quick Setup:**
\`\`\`bash
npm install
npm run dev
\`\`\`

For local development, use \`netlify dev --port 8889\`.

**Requirements:** Node.js 18+, npm, and Git.

See the [README](https://github.com/fabbiochucho/craftframework#running-locally) for details.`,
  },
  {
    keywords: ['authentication', 'auth', 'login', 'credentials'],
    answer: `## Authentication

The demo environment allows any credentials for testing. Production authentication uses secure session management.

See the [authentication guide](https://github.com/fabbiochucho/craftframework).`,
  },
  {
    keywords: ['roles', 'permissions', 'access', 'admin'],
    answer: `## Roles and Access Control

The toolkit supports assessor and super-admin roles. In the demo, use the role switcher in the sidebar to change roles.`,
  },
  {
    keywords: ['assessment', 'scoring', 'evaluation', 'wizard'],
    answer: `## Assessment & Scoring

The toolkit provides a five-tier evaluation across governance, fiduciary, grant management, USG compliance, and digital readiness. The assessment wizard includes scoring, evidence upload, risk badges, and a Capacity Development Plan.`,
  },
  {
    keywords: ['export', 'report', 'download', 'pdf'],
    answer: `## Reports and Export

The dashboard provides real-time visualizations. For custom export or report generation, see the [GitHub issues](https://github.com/fabbiochucho/craftframework/issues).`,
  },
  {
    keywords: ['deployment', 'deploy', 'netlify', 'production'],
    answer: `## Deployment

The project is designed for Netlify deployment and is configured through \`netlify.toml\`. See the [contributing guide](https://github.com/fabbiochucho/craftframework/blob/main/CONTRIBUTING.md).`,
  },
  {
    keywords: ['standards', 'compliance', 'usaid', 'requirements'],
    answer: `## Standards & Compliance

The toolkit aligns with USAID (2 CFR 200), Global Fund, World Bank, PEPFAR/CDC, and WHO IHR requirements. Check the project repository for documentation.`,
  },
  {
    keywords: ['tech stack', 'technology', 'framework', 'react'],
    answer: `## Tech Stack

- Framework: TanStack Start (React 19)
- Routing: TanStack Router
- Styling: Tailwind CSS v4
- Charts: Recharts
- Deployment: Netlify`,
  },
]

const CATEGORY_RULES: Record<SupportCategory, string[]> = {
  bug: ['bug', 'error', 'crash', 'broken', 'does not work', "doesn't work", 'not working', 'not loading', 'fails', 'failure', 'cannot', "can't", 'unable to'],
  feature: ['feature request', 'enhancement', 'please add', 'would like', 'can we add', 'could you add', 'support for', 'add a', 'request a feature', 'capability'],
  question: ['how do i', 'how can i', 'what is', 'where can i', 'why does', 'question', 'can i', 'how '],
}

const URGENT_TERMS = ['urgent', 'critical', 'blocking', 'asap', 'immediately']

export function classifySupportMessage(message: string): SupportClassification {
  const text = normalizeSupportMessage(message)
  const scores = (Object.entries(CATEGORY_RULES) as [SupportCategory, string[]][])
    .map(([type, terms]) => [type, terms.filter((term) => text.includes(term)).length] as const)
    .sort((a, b) => b[1] - a[1] || ['bug', 'feature', 'question'].indexOf(a[0]) - ['bug', 'feature', 'question'].indexOf(b[0]))
  const questionForm = /^(?:how|what|where|when|why|can i|do i|does|is|are)\b/.test(text)
  const explicitFeatureRequest = /^(?:add\b)|\b(?:please add|could you add|can we add|would like|feature request|request a feature|support for)\b/.test(text)
  const bugMatch = scores.find(([type]) => type === 'bug')?.[1] ?? 0
  const [rankedType, matches] = scores[0]
  const type = questionForm && !explicitFeatureRequest && !bugMatch ? 'question' : rankedType
  const confidence = matches ? Math.min(0.99, 0.6 + matches * 0.15) : 0.55
  return {
    type: confidence >= 0.6 ? type : 'question',
    confidence,
    urgency: URGENT_TERMS.some((term) => text.includes(term)) ? 'high' : type === 'bug' ? 'medium' : 'low',
  }
}

export function isPrivateReport(message: string): boolean {
  return /\b(security (?:report|issue|bug|vulnerability|incident|problem|concern)|conduct (?:report|issue|concern)|data breach|privacy breach|harassment|misconduct|code of conduct|abuse report|whistleblow(?:er|ing)?|confidential|private report)\b/i.test(message)
}

export function rankSupportFaq(message: string): { answer: string; score: number } | null {
  const text = normalizeSupportMessage(message)
  const ranked = FAQS.map((faq, index) => {
    const matches = faq.keywords.filter((keyword) => text.includes(keyword))
    const score = matches.length
      ? Math.min(1, matches.length * 0.28 + (matches.some((keyword) => text === keyword) ? 0.25 : 0))
      : 0
    return { answer: faq.answer, score, index }
  }).sort((a, b) => b.score - a.score || a.index - b.index)
  const best = ranked[0]
  return best.score >= 0.28 ? { answer: best.answer, score: best.score } : null
}

export function normalizeSupportMessage(message: string): string {
  return message.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function redactSupportMessage(message: string): string {
  return message
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]')
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, '[redacted phone]')
    .replace(/\b(?:api[_ -]?key|access[_ -]?token|password|passwd|passcode|secret)\s*(?:is|[:=])\s*\S+/gi, '[redacted credential]')
    .replace(/\bbearer\s+[A-Za-z0-9._~+/=-]+/gi, '[redacted credential]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|re_[A-Za-z0-9]{20,})\b/g, '[redacted credential]')
    .replace(/https?:\/\/\S+/gi, '[redacted link]')
    .slice(0, 4000)
}

export function supportDeduplicationKey(category: SupportCategory, message: string, orgId: number | null = null, workspaceId: number | null = null): string {
  const digest = createHash('sha256')
    .update(`${orgId ?? 'public'}:${workspaceId ?? 'public'}:${category}:${normalizeSupportMessage(redactSupportMessage(message))}`)
    .digest('hex')
  return `chat/${digest}`
}
