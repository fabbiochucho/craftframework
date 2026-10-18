// Which CRAFT questions show readiness for each area of law. Set once per area; a law may add more (`extraQuestions`).
import { INDICATOR_CATALOGUE, type CatalogueEntry } from '../crosswalkExisting.ts'
import { MOCK_QUESTIONS } from '../data.ts'
import { LADDER_INDICATORS } from '../capitalReadiness.ts'
import type { LawArea, LawEntry } from './types.ts'

const RULES: Record<LawArea, { core?: string[]; ladder?: string[]; prefix?: string[] }> = {
  company: { core: ['Legal & Regulatory', 'Governance & Leadership'], ladder: ['Legal Structure & Registration'] },
  data: { core: ['Digital Systems & Cyber'] },
  integrity: { core: ['Ethics & Anti-Fraud', 'Risk & Internal Controls'], prefix: ['CRAFT-FCR-'] },
  procurement: { core: ['Procurement & Supply Chain'] },
  governance: { core: ['Governance & Leadership', 'Audit & Assurance'], ladder: ['Core Governance & Leadership', 'Transparent Governance & Reporting'] },
  labour: { core: ['Human Resources'], ladder: ['Social Value & Human Capital'] },
  eia: { core: ['Env. & Social Safeguards'], prefix: ['CRAFT-ESS-'] },
  capital: { core: ['Audit & Assurance'], ladder: ['Capital Markets & Credit Readiness', 'Investor Protections & Regulatory Certainty', 'Transparent Governance & Reporting'] },
}
const coreDomain = new Map(MOCK_QUESTIONS.map((q) => [q.id, q.domain]))
const ladderDomain = new Map(LADDER_INDICATORS.map((q) => [q.id, q.domain]))

export const AREA_QUESTIONS = Object.fromEntries(Object.entries(RULES).map(([area, r]) => [area, INDICATOR_CATALOGUE.filter((e) =>
  (e.source === 'core' && !!r.core?.includes(coreDomain.get(e.id) ?? '')) ||
  (e.source === 'ladder' && !!r.ladder?.includes(ladderDomain.get(e.id) ?? '')) ||
  (r.prefix ?? []).some((p) => e.id.startsWith(p)))])) as Record<LawArea, CatalogueEntry[]>

export function questionsForLaw(e: LawEntry): CatalogueEntry[] {
  const base = AREA_QUESTIONS[e.area]
  const extra = INDICATOR_CATALOGUE.filter((q) => e.extraQuestions?.includes(q.id) && !base.includes(q))
  return [...base, ...extra]
}
