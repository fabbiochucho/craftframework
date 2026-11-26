import Anthropic from '@anthropic-ai/sdk'
import { NOT_COVERED, systemPrompt, userPrompt, type ActionTemplate, type GapContext } from '../../src/lib/copilot.js'

// The one place the Copilot calls Claude. Credentials and the endpoint come from ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL
// (Netlify AI Gateway sets both). Templates go in as documents with citations on, so every claim points to one.
export const COPILOT_MODEL = 'claude-opus-5-5'

export type DraftResult =
  | { covered: false }
  | { covered: true; text: string; citations: Array<{ templateId: number; title: string; citedText: string }> }

export async function draftFromTemplates(templates: ActionTemplate[], gap: GapContext, note: string): Promise<DraftResult> {
  const client = new Anthropic()
  const response = await client.beta.messages.create({
    model: COPILOT_MODEL,
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    // If a safety classifier declines, the API retries on a suitable model instead of failing the organisation's request.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: systemPrompt(),
    messages: [{
      role: 'user',
      content: [
        ...templates.map((t) => ({
          type: 'document' as const,
          source: { type: 'text' as const, media_type: 'text/plain' as const, data: t.body },
          title: t.title,
          context: `Source: ${t.source}`,
          citations: { enabled: true },
        })),
        { type: 'text' as const, text: userPrompt(gap, note) },
      ],
    }],
  })
  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return { covered: false }
  const texts = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
  const text = texts.map((b) => b.text).join('').trim()
  if (!text || text === NOT_COVERED || text.startsWith(NOT_COVERED)) return { covered: false }
  const citations = texts.flatMap((b) => (b.citations ?? []).flatMap((c) => 'document_index' in c && templates[c.document_index]
    ? [{ templateId: templates[c.document_index].id, title: templates[c.document_index].title, citedText: c.cited_text }] : []))
  // An answer that cites nothing did not come from the library: treat it as not covered.
  if (!citations.length) return { covered: false }
  return { covered: true, text, citations }
}
