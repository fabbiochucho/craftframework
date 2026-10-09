import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// ---------------------------------------------------------------------------
// Lightweight, dependency-free internationalization layer.
//
// Language is resolved on the client in this priority order:
//   1. An explicit choice the visitor made (persisted in localStorage).
//   2. An IP/geo hint cookie set at the edge (see netlify/edge-functions/lang-detect.ts).
//   3. The browser's own preferred language (navigator.language).
//   4. English, as the universal fallback.
//
// Rendering always starts in English so the server-rendered markup matches the
// first client paint (no hydration mismatch); the resolved language is then
// applied in an effect. Any key without a translation falls back to English,
// so the UI can never break on a missing string.
// ---------------------------------------------------------------------------

export type LangCode = 'en' | 'fr' | 'es' | 'pt' | 'ar' | 'sw'

export interface LanguageMeta {
  code: LangCode
  label: string // endonym - shown to the speaker of that language
  english: string // English name - for accessibility/aria
  flag: string
  dir: 'ltr' | 'rtl'
}

export const LANGUAGES: LanguageMeta[] = [
  { code: 'en', label: 'English', english: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'fr', label: 'Français', english: 'French', flag: '🇫🇷', dir: 'ltr' },
  { code: 'es', label: 'Español', english: 'Spanish', flag: '🇪🇸', dir: 'ltr' },
  { code: 'pt', label: 'Português', english: 'Portuguese', flag: '🇵🇹', dir: 'ltr' },
  { code: 'sw', label: 'Kiswahili', english: 'Swahili', flag: '🇰🇪', dir: 'ltr' },
  { code: 'ar', label: 'العربية', english: 'Arabic', flag: '🇸🇦', dir: 'rtl' },
]

const SUPPORTED = new Set<string>(LANGUAGES.map(l => l.code))
const STORAGE_KEY = 'craft_lang'
const HINT_COOKIE = 'craft_lang_hint'

export function langMeta(code: LangCode): LanguageMeta {
  return LANGUAGES.find(l => l.code === code) ?? LANGUAGES[0]
}

// ---------------------------------------------------------------------------
// Translation dictionary. Keys are stable identifiers; English is the source of
// truth and the fallback for any locale that has not yet translated a key.
// Visible chrome (navigation, footer, calls-to-action) is hand-translated here;
// all other page copy is translated at runtime by components/AutoTranslate.tsx.
// ---------------------------------------------------------------------------

type Dict = Record<string, string>

const en: Dict = {
  'nav.home': 'Home',
  'nav.readiness': 'Readiness Check',
  'nav.methodology': 'Methodology',
  'nav.architecture': 'Architecture',
  'nav.institute': 'The Institute',
  'nav.openSource': 'Open Source',
  'nav.contact': 'Contact',
  'nav.signIn': 'Sign in',
  'nav.register': 'Register Your Institution',
  'footer.codeOfConduct': 'Code of Conduct',
  'footer.openSource': 'Open Source',
  'footer.methodology': 'Methodology',
  'footer.pressKit': 'Press Kit',
  'footer.contact': 'Contact',
  'footer.terms': 'Terms of Service',
  'footer.privacy': 'Privacy Policy',
  'lang.label': 'Language',
  'tx.translating': 'Translating…',
  'demo.badge': 'Isolated · Read-only · No sign-up',
  'demo.title': 'Explore CRAFT with live sample data',
  'demo.subtitle':
    'Open either demo below in a new tab. Each launches a fully populated, throwaway session seeded with illustrative institutions that stays completely isolated and never touches a real workspace.',
  'demo.launch': 'Launch demo',
  'demo.readyPrompt': 'Ready to run your own readiness assessment?',
  'demo.registerCta': 'Register your institution',
  'cta.seeDemo': 'See demo',
}

const fr: Dict = {
  'nav.home': 'Accueil',
  'nav.readiness': 'Diagnostic de préparation',
  'nav.methodology': 'Méthodologie',
  'nav.architecture': 'Architecture',
  'nav.institute': "L'Institut",
  'nav.openSource': 'Open source',
  'nav.contact': 'Contact',
  'nav.signIn': 'Se connecter',
  'nav.register': 'Inscrire votre institution',
  'footer.codeOfConduct': 'Code de conduite',
  'footer.openSource': 'Open source',
  'footer.methodology': 'Méthodologie',
  'footer.pressKit': 'Kit presse',
  'footer.contact': 'Contact',
  'footer.terms': "Conditions d'utilisation",
  'footer.privacy': 'Politique de confidentialité',
  'lang.label': 'Langue',
  'tx.translating': 'Traduction en cours…',
  'demo.badge': 'Isolé · Lecture seule · Sans inscription',
  'demo.title': 'Explorez CRAFT avec des données d’exemple en direct',
  'demo.subtitle':
    'Ouvrez l’une des démos ci-dessous dans un nouvel onglet. Chacune lance une session temporaire entièrement renseignée, alimentée par des institutions fictives à titre d’illustration, totalement isolée et qui ne touche jamais un espace de travail réel.',
  'demo.launch': 'Lancer la démo',
  'demo.readyPrompt': 'Prêt à réaliser votre propre évaluation de préparation ?',
  'demo.registerCta': 'Inscrire votre institution',
  'cta.seeDemo': 'Voir la démo',
}

const es: Dict = {
  'nav.home': 'Inicio',
  'nav.readiness': 'Diagnóstico de preparación',
  'nav.methodology': 'Metodología',
  'nav.architecture': 'Arquitectura',
  'nav.institute': 'El Instituto',
  'nav.openSource': 'Código abierto',
  'nav.contact': 'Contacto',
  'nav.signIn': 'Iniciar sesión',
  'nav.register': 'Registre su institución',
  'footer.codeOfConduct': 'Código de conducta',
  'footer.openSource': 'Código abierto',
  'footer.methodology': 'Metodología',
  'footer.pressKit': 'Kit de prensa',
  'footer.contact': 'Contacto',
  'footer.terms': 'Términos del servicio',
  'footer.privacy': 'Política de privacidad',
  'lang.label': 'Idioma',
  'tx.translating': 'Traduciendo…',
  'demo.badge': 'Aislado · Solo lectura · Sin registro',
  'demo.title': 'Explore CRAFT con datos de muestra en vivo',
  'demo.subtitle':
    'Abra cualquiera de las demostraciones a continuación en una pestaña nueva. Cada una inicia una sesión temporal totalmente completada con instituciones ilustrativas, que permanece completamente aislada y nunca afecta a un espacio de trabajo real.',
  'demo.launch': 'Iniciar demostración',
  'demo.readyPrompt': '¿Listo para realizar su propia evaluación de preparación?',
  'demo.registerCta': 'Registre su institución',
  'cta.seeDemo': 'Ver demostración',
}

// European / African Portuguese (Portugal, Angola, Mozambique) - not Brazilian.
const pt: Dict = {
  'nav.home': 'Início',
  'nav.readiness': 'Diagnóstico de prontidão',
  'nav.methodology': 'Metodologia',
  'nav.architecture': 'Arquitetura',
  'nav.institute': 'O Instituto',
  'nav.openSource': 'Código aberto',
  'nav.contact': 'Contacto',
  'nav.signIn': 'Iniciar sessão',
  'nav.register': 'Registe a sua instituição',
  'footer.codeOfConduct': 'Código de conduta',
  'footer.openSource': 'Código aberto',
  'footer.methodology': 'Metodologia',
  'footer.pressKit': 'Kit de imprensa',
  'footer.contact': 'Contacto',
  'footer.terms': 'Termos de serviço',
  'footer.privacy': 'Política de privacidade',
  'lang.label': 'Idioma',
  'tx.translating': 'A traduzir…',
  'demo.badge': 'Isolado · Só de leitura · Sem registo',
  'demo.title': 'Explore o CRAFT com dados de exemplo em tempo real',
  'demo.subtitle':
    'Abra qualquer uma das demonstrações abaixo num novo separador. Cada uma inicia uma sessão temporária totalmente preenchida com instituições ilustrativas, que permanece completamente isolada e nunca toca num espaço de trabalho real.',
  'demo.launch': 'Iniciar demonstração',
  'demo.readyPrompt': 'Pronto para realizar a sua própria avaliação de prontidão?',
  'demo.registerCta': 'Registe a sua instituição',
  'cta.seeDemo': 'Ver demonstração',
}

const sw: Dict = {
  'nav.home': 'Mwanzo',
  'nav.readiness': 'Kipimo cha Utayari',
  'nav.methodology': 'Mbinu',
  'nav.architecture': 'Muundo',
  'nav.institute': 'Taasisi',
  'nav.openSource': 'Chanzo Huria',
  'nav.contact': 'Wasiliana Nasi',
  'nav.signIn': 'Ingia',
  'nav.register': 'Sajili Taasisi Yako',
  'footer.codeOfConduct': 'Kanuni za Maadili',
  'footer.openSource': 'Chanzo Huria',
  'footer.methodology': 'Mbinu',
  'footer.pressKit': 'Vifaa vya Habari',
  'footer.contact': 'Wasiliana Nasi',
  'footer.terms': 'Masharti ya Huduma',
  'footer.privacy': 'Sera ya Faragha',
  'lang.label': 'Lugha',
  'tx.translating': 'Inatafsiri…',
  'demo.badge': 'Imetengwa · Kusoma tu · Bila kujisajili',
  'demo.title': 'Chunguza CRAFT kwa data hai ya mfano',
  'demo.subtitle':
    'Fungua onyesho lolote kati ya yaliyo hapa chini kwenye kichupo kipya. Kila moja huanzisha kipindi cha muda kilichojazwa kikamilifu na taasisi za mfano; kimetengwa kabisa na hakigusi kamwe nafasi halisi ya kazi.',
  'demo.launch': 'Anzisha onyesho',
  'demo.readyPrompt': 'Uko tayari kufanya tathmini yako mwenyewe ya utayari?',
  'demo.registerCta': 'Sajili taasisi yako',
  'cta.seeDemo': 'Tazama onyesho',
}

const ar: Dict = {
  'nav.home': 'الرئيسية',
  'nav.readiness': 'فحص الجاهزية',
  'nav.methodology': 'المنهجية',
  'nav.architecture': 'البنية',
  'nav.institute': 'المعهد',
  'nav.openSource': 'مفتوح المصدر',
  'nav.contact': 'اتصل بنا',
  'nav.signIn': 'تسجيل الدخول',
  'nav.register': 'سجّل مؤسستك',
  'footer.codeOfConduct': 'مدونة السلوك',
  'footer.openSource': 'مفتوح المصدر',
  'footer.methodology': 'المنهجية',
  'footer.pressKit': 'الحقيبة الإعلامية',
  'footer.contact': 'اتصل بنا',
  'footer.terms': 'شروط الخدمة',
  'footer.privacy': 'سياسة الخصوصية',
  'lang.label': 'اللغة',
  'tx.translating': 'جارٍ الترجمة…',
  'demo.badge': 'معزول · للقراءة فقط · بدون تسجيل',
  'demo.title': 'استكشف CRAFT ببيانات نموذجية حيّة',
  'demo.subtitle':
    'افتح أيًا من العرضين أدناه في علامة تبويب جديدة. يُطلق كل منهما جلسة مؤقتة مكتملة البيانات بمؤسسات توضيحية، تبقى معزولة تمامًا ولا تمس أبدًا أي مساحة عمل حقيقية.',
  'demo.launch': 'ابدأ العرض التجريبي',
  'demo.readyPrompt': 'هل أنت مستعد لإجراء تقييم الجاهزية الخاص بك؟',
  'demo.registerCta': 'سجّل مؤسستك',
  'cta.seeDemo': 'شاهد العرض التجريبي',
}

const DICTS: Record<LangCode, Dict> = { en, fr, es, pt, sw, ar }

// Strings already rendered from a hand-written dictionary. The runtime page
// translator (components/AutoTranslate.tsx) skips these so curated wording is
// never re-translated.
export function dictionaryValues(lang: LangCode): Set<string> {
  return new Set(Object.values(DICTS[lang]).map(v => v.trim()))
}

// Map of country (ISO 3166 alpha-2) → default language for the IP/geo hint.
// Used by the edge function; exported so both sides stay in sync.
export const COUNTRY_LANG: Record<string, LangCode> = {
  // Francophone
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', CI: 'fr', SN: 'fr', ML: 'fr', BF: 'fr',
  NE: 'fr', GN: 'fr', TG: 'fr', BJ: 'fr', CM: 'fr', CD: 'fr', CG: 'fr', GA: 'fr',
  TD: 'fr', MG: 'fr', RW: 'fr', BI: 'fr', DJ: 'fr', HT: 'fr',
  // Hispanophone
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', CL: 'es', EC: 'es', GT: 'es',
  CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es', CR: 'es',
  PA: 'es', UY: 'es', VE: 'es',
  // Lusophone
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt', TL: 'pt',
  // Swahili-speaking East Africa
  KE: 'sw', TZ: 'sw', UG: 'sw',
  // Arabic-speaking
  SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar', DZ: 'ar', TN: 'ar', LY: 'ar', SD: 'ar',
  JO: 'ar', IQ: 'ar', KW: 'ar', QA: 'ar', BH: 'ar', OM: 'ar', YE: 'ar', LB: 'ar',
  SY: 'ar', PS: 'ar',
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function normalize(raw: string | null | undefined): LangCode | null {
  if (!raw) return null
  const code = raw.slice(0, 2).toLowerCase()
  return SUPPORTED.has(code) ? (code as LangCode) : null
}

// Resolve the best language for this visitor (client-only).
function detectLanguage(): LangCode {
  if (typeof window === 'undefined') return 'en'
  // 1. Explicit, remembered choice always wins.
  const saved = normalize(localStorage.getItem(STORAGE_KEY))
  if (saved) return saved
  // 2. Edge/IP geo hint.
  const hint = normalize(readCookie(HINT_COOKIE))
  if (hint) return hint
  // 3. Browser preference.
  const nav = normalize(typeof navigator !== 'undefined' ? navigator.language : null)
  if (nav) return nav
  return 'en'
}

interface I18nContextValue {
  lang: LangCode
  dir: 'ltr' | 'rtl'
  setLang: (code: LangCode) => void
  t: (key: string, fallback?: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>('en')

  // Resolve the visitor's language after mount (keeps SSR/first paint = English).
  useEffect(() => {
    const detected = detectLanguage()
    if (detected !== 'en') setLangState(detected)
  }, [])

  // Reflect the active language on the document for accessibility & RTL.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const meta = langMeta(lang)
    document.documentElement.lang = lang
    document.documentElement.dir = meta.dir
  }, [lang])

  const setLang = useCallback((code: LangCode) => {
    setLangState(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      /* storage may be unavailable (private mode) - selection still applies for the session */
    }
  }, [])

  const t = useCallback(
    (key: string, fallback?: string) => {
      const dict = DICTS[lang]
      return dict[key] ?? en[key] ?? fallback ?? key
    },
    [lang],
  )

  const value = useMemo<I18nContextValue>(
    () => ({ lang, dir: langMeta(lang).dir, setLang, t }),
    [lang, setLang, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
