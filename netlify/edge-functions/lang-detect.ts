import type { Context, Config } from '@netlify/edge-functions'

// Country (ISO 3166 alpha-2) → default UI language. Kept in sync with
// COUNTRY_LANG in src/lib/i18n.tsx. Duplicated here because edge functions run
// on Deno and cannot import from the Vite app bundle.
const COUNTRY_LANG: Record<string, string> = {
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', CI: 'fr', SN: 'fr', ML: 'fr', BF: 'fr',
  NE: 'fr', GN: 'fr', TG: 'fr', BJ: 'fr', CM: 'fr', CD: 'fr', CG: 'fr', GA: 'fr',
  TD: 'fr', MG: 'fr', RW: 'fr', BI: 'fr', DJ: 'fr', HT: 'fr',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', CL: 'es', EC: 'es', GT: 'es',
  CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es', CR: 'es',
  PA: 'es', UY: 'es', VE: 'es',
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt', TL: 'pt',
  KE: 'sw', TZ: 'sw', UG: 'sw',
  SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar', DZ: 'ar', TN: 'ar', LY: 'ar', SD: 'ar',
  JO: 'ar', IQ: 'ar', KW: 'ar', QA: 'ar', BH: 'ar', OM: 'ar', YE: 'ar', LB: 'ar',
  SY: 'ar', PS: 'ar',
}

// Sets a readable (non-HttpOnly) `craft_lang_hint` cookie derived from the
// visitor's IP geolocation. The client i18n layer reads it as a fallback when
// the visitor has not already chosen a language. We never override an explicit
// choice — that lives in localStorage on the client.
export default async (_req: Request, context: Context) => {
  const country = context.geo?.country?.code?.toUpperCase()
  const lang = country ? COUNTRY_LANG[country] : undefined

  // Only set the hint when geo maps to a non-default, supported language, and
  // only if one isn't already present, to avoid needless Set-Cookie churn.
  if (lang && !context.cookies.get('craft_lang_hint')) {
    context.cookies.set({
      name: 'craft_lang_hint',
      value: lang,
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'Lax',
    })
  }

  // Pass through to the normal response chain.
  return
}

export const config: Config = {
  // Run on top-level navigations to public entry pages where a first-time
  // visitor is likely to land; excludes static asset requests.
  path: ['/', '/demo', '/methodology', '/institute', '/open-source', '/contact', '/pre-assessment', '/terms', '/auth'],
}
