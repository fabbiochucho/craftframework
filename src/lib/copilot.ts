// Gap-to-Action Copilot: when a capacity domain scores low, draft a starting point (an SOP, procurement template, board
// charter or policy) from the APPROVED template library only — the Ask-A-Question pattern:
//   • retrieval is from human-approved templates matched to the domain, organisation type and country; nothing else
//   • the model must answer from those templates and cite them; if they do not cover the gap it says so, and the
//     question goes to a human expert instead (netlify/functions/copilot.mts)
//   • every draft is watermarked as an AI-drafted starting point. It is never evidence and never changes a score:
//     a policy on paper is exactly what CRAFT's Paper Compliance Penalty discounts; only proof of use lifts a level.
// Self-check (level 1 of the pre-deployment tests, retrieval accuracy): `node src/lib/copilot.test.ts`.

export const TEMPLATE_KINDS = [
  { id: 'sop', label: 'Standard operating procedure' },
  { id: 'procurement', label: 'Procurement template' },
  { id: 'board_charter', label: 'Board charter' },
  { id: 'policy', label: 'Policy' },
  { id: 'other', label: 'Other' },
] as const
export type TemplateKind = (typeof TEMPLATE_KINDS)[number]['id']

export interface ActionTemplate {
  id: number
  title: string
  kind: TemplateKind
  /** Capacity domain ids this template helps close (e.g. "fin.3"); matched exactly. */
  domains: string[]
  /** Keywords matched against the domain name when no domain id matches. */
  keywords: string[]
  /** Organisation types and ISO-2 countries it suits; empty means any. */
  archetypes: string[]
  countries: string[]
  body: string
  source: string
  status: 'draft' | 'approved' | 'retired'
}

export interface GapContext { domainId: string; domainName: string; archetype: string; country: string }

export const MAX_TEMPLATES = 3
export const NOT_COVERED = 'NOT_COVERED'
export const WATERMARK = 'AI-drafted starting point from CRAFT-approved templates. Adapt it, adopt it through your own governance, and use it: this draft is not evidence and does not change your score.'

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3))

/** The approved templates that fit this gap, best first. An exact domain match always outranks a keyword match. */
export function retrieve(templates: ActionTemplate[], gap: GapContext): ActionTemplate[] {
  const name = words(gap.domainName)
  const fits = (list: string[], value: string) => !list.length || list.some((x) => x.toLowerCase() === value.toLowerCase())
  return templates
    .filter((t) => t.status === 'approved' && fits(t.archetypes, gap.archetype) && fits(t.countries, gap.country))
    .map((t) => {
      const exact = t.domains.includes(gap.domainId) ? 100 : 0
      const overlap = t.keywords.filter((k) => name.has(k.toLowerCase()) || gap.domainName.toLowerCase().includes(k.toLowerCase())).length
      const local = (t.countries.length ? 2 : 0) + (t.archetypes.length ? 1 : 0)
      return { t, score: exact + overlap * 10 + local }
    })
    .filter((x) => x.score >= 10)
    .sort((a, b) => b.score - a.score || a.t.id - b.t.id)
    .slice(0, MAX_TEMPLATES)
    .map((x) => x.t)
}

export function systemPrompt(): string {
  return `You help African public institutions, civil society organisations and enterprises close a capacity gap by adapting approved templates.

Rules:
- Use ONLY the documents provided. Do not add requirements, laws, figures or practices that are not in them.
- Cite the documents you draw on.
- If the documents do not address the gap, reply with exactly ${NOT_COVERED} and nothing else. A human expert will answer instead.
- Write a practical starting draft the organisation can adapt: clear steps, roles and records to keep. Plain language; no legal advice.
- Respect the organisation's context. Do not lecture, rank or judge it.
- End with "Evidence that this is in use:" and list the records that would show the procedure is actually followed.`
}

export function userPrompt(gap: GapContext, note: string): string {
  return `Organisation type: ${gap.archetype || 'not stated'}. Country: ${gap.country || 'not stated'}.
Capacity area to strengthen: ${gap.domainName} (${gap.domainId}).${note ? `\nWhat the organisation says it needs: ${note}` : ''}

Draft a starting point from the documents.`
}
