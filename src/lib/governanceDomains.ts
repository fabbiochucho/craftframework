import { DOMAINS, MOCK_QUESTIONS, TIER_NAMES } from './data.ts'

// The question bank is canonical: its T1–T5 categories define the workspace
// pillars, while DOMAIN_DISPLAY defines the 20 governance-domain labels.
export const GOVERNANCE_DOMAINS: Record<string, string[]> = Object.fromEntries(
  TIER_NAMES.map((pillar, index) => [
    pillar,
    DOMAINS.filter((domain) => MOCK_QUESTIONS.some((question) => question.domain === domain && question.tier === index + 1)),
  ]),
)

export const ALL_DOMAINS = Object.entries(GOVERNANCE_DOMAINS)
  .flatMap(([pillar, domains]) => domains.map((domain) => ({ pillar, domain })))
