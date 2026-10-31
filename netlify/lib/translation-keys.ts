// Keys for the ui-translations blob store, shared by /api/translate and /api/translation-review.
// AI translations: `<PROMPT_VERSION>/<lang>/<sha256>`; reviewed translations (which always win): `reviewed/<lang>/<sha256>`.
export const TRANSLATION_STORE = 'ui-translations'
export const REVIEW_LANGS = ['fr', 'pt', 'es', 'sw', 'ar'] as const

export async function textHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const reviewedKey = async (lang: string, text: string) => `reviewed/${lang}/${await textHash(text)}`
