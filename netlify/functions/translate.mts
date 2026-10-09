import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { logger } from '../lib/logger.js'

// /api/translate — runtime UI translation for every page that isn't covered by
// the hand-written dictionaries in src/lib/i18n.tsx. The client sends batches of
// English UI strings; each is translated once through Netlify AI Gateway and the
// result is cached permanently in Netlify Blobs, so every later visitor in that
// language gets it instantly and at no inference cost.

const LANGS: Record<string, string> = {
  fr: 'French (formal "vous" register, as used in francophone Africa and France)',
  es: 'Spanish (neutral international Spanish, formal "usted" register)',
  pt: 'European / African Portuguese (as used in Portugal, Angola and Mozambique — NOT Brazilian: use "registo", "contacto", "separador", "ecrã", "utilizador", "equipa", "ficheiro", "iniciar sessão")',
  sw: 'Swahili (standard Kiswahili sanifu as used in Kenya and Tanzania)',
  ar: 'Modern Standard Arabic',
}

// Curated terms from the hand-written navigation dictionaries, so page copy uses
// the same wording as the menus.
const GLOSSARY: Record<string, Record<string, string>> = {
  fr: { 'Readiness Check': 'Diagnostic de préparation', 'Sign in': 'Se connecter', 'Register your institution': 'Inscrire votre institution', 'Methodology': 'Méthodologie', 'The Institute': "L'Institut" },
  es: { 'Readiness Check': 'Diagnóstico de preparación', 'Sign in': 'Iniciar sesión', 'Register your institution': 'Registre su institución', 'Methodology': 'Metodología', 'The Institute': 'El Instituto' },
  pt: { 'Readiness Check': 'Diagnóstico de prontidão', 'Sign in': 'Iniciar sessão', 'Register your institution': 'Registe a sua instituição', 'Methodology': 'Metodologia', 'The Institute': 'O Instituto' },
  sw: { 'Readiness Check': 'Kipimo cha Utayari', 'Sign in': 'Ingia', 'Register your institution': 'Sajili taasisi yako', 'Methodology': 'Mbinu', 'The Institute': 'Taasisi' },
  ar: { 'Readiness Check': 'فحص الجاهزية', 'Sign in': 'تسجيل الدخول', 'Register your institution': 'سجّل مؤسستك', 'Methodology': 'المنهجية', 'The Institute': 'المعهد' },
}

const MODEL = 'claude-sonnet-4-6'
const MAX_TEXTS = 60
const MAX_LEN = 4000
const PROMPT_VERSION = 'v2'

const store = getStore('ui-translations')

async function hash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

function systemPrompt(lang: string): string {
  return `You are a professional translator localizing the user interface of CRAFT (Capacity Readiness & Fiduciary Assurance Toolkit), an institutional-readiness, governance, fiduciary-assurance, ESG and compliance platform run by the DiBadili Institute for African businesses, organizations and public institutions.

Translate each English UI string into ${LANGS[lang]}.

Rules:
- Translate accurately and completely, in the precise professional terminology used in public finance, governance, audit, compliance, ESG and sustainability reporting in that language.
- Keep these untranslated exactly as written: product, method and organization names (CRAFT, Trust Delta, DiBadili Institute, becomechange.institute), acronyms and standard identifiers (ISSB, IFRS S1, IFRS S2, ESG, OECD, G20, G7, GFA, FCR, CIP, CSRD, DORA, GDPR, KPI, PDF, CSV, API, SDG, etc.), question/item codes (e.g. "Q1.2", "T3-D4"), email addresses, URLs, numbers, dates, currency amounts and placeholders such as {name}, {{count}} or %s.
- Keep personal names and the names of specific real institutions or countries in their usual form for that language.
- Preserve punctuation style, capitalization style (title case stays a short label), symbols such as ·, →, •, %, and any leading/trailing characters.
- A string may be a short button label, a heading, a fragment of a sentence, or a full paragraph; translate it so it reads naturally on its own in that position.
- If a string is already in the target language, or has nothing translatable, return it unchanged.
- Use this glossary consistently, including inside longer phrases (e.g. "Quick Readiness Check"): ${Object.entries(GLOSSARY[lang]).map(([en, tr]) => `"${en}" → "${tr}"`).join('; ')}.
- Never add explanations, quotes or notes.

Respond with ONLY a JSON array of strings: the translations, in the same order and with exactly the same number of items as the input array.`
}

async function translateBatch(lang: string, texts: string[]): Promise<string[]> {
  const res = await fetch(`${process.env.ANTHROPIC_BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      temperature: 0,
      system: systemPrompt(lang),
      messages: [{ role: 'user', content: JSON.stringify(texts) }],
    }),
  })
  if (!res.ok) throw new Error(`AI Gateway responded ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = (await res.json()) as { content?: { type: string; text?: string }[] }
  const raw = (data.content ?? []).map(c => c.text ?? '').join('')
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end < start) throw new Error('Model response contained no JSON array')
  const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown
  if (!Array.isArray(parsed) || parsed.length !== texts.length) {
    throw new Error(`Expected ${texts.length} translations, received ${Array.isArray(parsed) ? parsed.length : 'non-array'}`)
  }
  return parsed.map((v, i) => (typeof v === 'string' && v.trim() ? v : texts[i]))
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // Browsers mark cross-site requests; only this site's own pages may use the endpoint.
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return new Response('Forbidden', { status: 403 })

  let body: { lang?: unknown; texts?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const lang = typeof body.lang === 'string' ? body.lang : ''
  if (!LANGS[lang]) return Response.json({ error: 'Unsupported language' }, { status: 400 })
  if (!Array.isArray(body.texts) || body.texts.length === 0 || body.texts.length > MAX_TEXTS) {
    return Response.json({ error: `Provide 1-${MAX_TEXTS} texts` }, { status: 400 })
  }
  const texts = body.texts.filter((t): t is string => typeof t === 'string' && t.length > 0 && t.length <= MAX_LEN)
  if (texts.length !== body.texts.length) return Response.json({ error: 'Invalid text entries' }, { status: 400 })

  try {
    const keys = await Promise.all(texts.map(async t => `${PROMPT_VERSION}/${lang}/${await hash(t)}`))
    const cached = await Promise.all(keys.map(k => store.get(k, { type: 'text' }).catch(() => null)))

    const missing = texts.map((t, i) => (cached[i] == null ? i : -1)).filter(i => i >= 0)
    const result = cached.slice() as (string | null)[]

    if (missing.length > 0) {
      const translated = await translateBatch(lang, missing.map(i => texts[i]))
      await Promise.all(
        missing.map(async (idx, j) => {
          result[idx] = translated[j]
          await store.set(keys[idx], translated[j]).catch(err => logger.warn('translate', 'cache write failed', { err }))
        }),
      )
    }

    return Response.json({ translations: result.map((r, i) => r ?? texts[i]) })
  } catch (err) {
    logger.error('translate', 'translation failed', err, { lang, count: texts.length })
    return Response.json({ error: 'Translation temporarily unavailable' }, { status: 502 })
  }
}

export const config: Config = {
  path: '/api/translate',
}
