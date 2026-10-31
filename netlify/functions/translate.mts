import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { logger, monitored } from '../lib/logger.js'
import { TRANSLATION_STORE, reviewedKey, textHash } from '../lib/translation-keys.js'
import { LANGS, MAX_LEN, MAX_TEXTS, PROMPT_VERSION, translateBatch } from '../lib/translation.js'

// /api/translate — runtime UI translation for every page that isn't covered by the hand-written dictionaries in
// src/lib/i18n.tsx. The translation core (glossary, model, cache, reviewed translations) lives in netlify/lib/translation.ts.

const store = getStore(TRANSLATION_STORE)
const hash = textHash

const handleRequest = async (req: Request) => {
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
    // A reviewed translation (uploaded by the CRAFT team from a professional translator) always wins over the AI one.
    const reviewed = await Promise.all(texts.map(async t => store.get(await reviewedKey(lang, t), { type: 'text' }).catch(() => null)))
    const cached = await Promise.all(keys.map((k, i) => reviewed[i] ?? store.get(k, { type: 'text' }).catch(() => null)))

    const missing = texts.map((_, i) => (cached[i] == null ? i : -1)).filter(i => i >= 0)
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

export default monitored(handleRequest)
