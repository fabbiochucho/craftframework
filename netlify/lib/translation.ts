// Translation core shared by /api/translate (screens) and server-side exports (PDF, XLSX, CSV), so every surface uses
// the same cache, the same glossary and the same reviewed translations.
import { getStore } from '@netlify/blobs'
import { logger } from './logger.js'
import { TRANSLATION_STORE, reviewedKey, textHash } from './translation-keys.js'

// /api/translate — runtime UI translation for every page that isn't covered by
// the hand-written dictionaries in src/lib/i18n.tsx. The client sends batches of
// English UI strings; each is translated once through Netlify AI Gateway and the
// result is cached permanently in Netlify Blobs, so every later visitor in that
// language gets it instantly and at no inference cost.

export const LANGS: Record<string, string> = {
  fr: 'French (formal "vous" register, as used in francophone Africa and France)',
  es: 'Spanish (neutral international Spanish, formal "usted" register)',
  pt: 'European / African Portuguese (as used in Portugal, Angola and Mozambique — NOT Brazilian: use "registo", "contacto", "separador", "ecrã", "utilizador", "equipa", "ficheiro", "iniciar sessão")',
  sw: 'Swahili (standard Kiswahili sanifu as used in Kenya and Tanzania)',
  ar: 'Modern Standard Arabic',
}

// Curated terms from the hand-written navigation dictionaries, so page copy uses
// the same wording as the menus.
const GLOSSARY: Record<string, Record<string, string>> = {
  fr: { 'Readiness Check': 'Diagnostic de préparation', 'Sign in': 'Se connecter', 'Register your institution': 'Inscrire votre institution', 'Methodology': 'Méthodologie', 'The Institute': "L'Institut",
    // Networks
    'Network': 'Réseau', 'Networks': 'Réseaux', 'Totals only': 'Totaux uniquement', 'Named results': 'Résultats nominatifs', 'Coordinator': 'Coordinateur', 'Secretariat': 'Secrétariat',
    'Assessment round': "Cycle d'évaluation", 'Network Value Scorecard': 'Tableau de valeur du réseau', 'Capacity-building plan': 'Plan de renforcement des capacités', 'Peer learning': 'Apprentissage entre pairs',
    'Study tour': "Voyage d'étude", 'Exchange visit': "Visite d'échange", 'Mentoring': 'Mentorat', 'Cohort': 'Cohorte', 'Latent': 'Latent', 'Emerging': 'Émergent', 'Established': 'Établi', 'Advanced': 'Avancé',
    'Immediate action required': 'Action immédiate requise', 'Attention needed': 'Attention nécessaire', 'Good, but may need improvement': 'Bon, mais peut être amélioré', 'Safeguarding': 'Protection contre les abus', 'Community-led monitoring': 'Suivi communautaire' },
  es: { 'Readiness Check': 'Diagnóstico de preparación', 'Sign in': 'Iniciar sesión', 'Register your institution': 'Registre su institución', 'Methodology': 'Metodología', 'The Institute': 'El Instituto' ,
    // Networks
    'Network': 'Red', 'Networks': 'Redes', 'Totals only': 'Solo totales', 'Named results': 'Resultados nominativos', 'Coordinator': 'Coordinador', 'Secretariat': 'Secretaría',
    'Assessment round': 'Ronda de evaluación', 'Network Value Scorecard': 'Cuadro de valor de la red', 'Capacity-building plan': 'Plan de fortalecimiento de capacidades', 'Peer learning': 'Aprendizaje entre pares',
    'Study tour': 'Viaje de estudio', 'Exchange visit': 'Visita de intercambio', 'Mentoring': 'Mentoría', 'Cohort': 'Cohorte', 'Latent': 'Latente', 'Emerging': 'Emergente', 'Established': 'Establecido', 'Advanced': 'Avanzado',
    'Immediate action required': 'Se requiere acción inmediata', 'Attention needed': 'Requiere atención', 'Good, but may need improvement': 'Bien, pero puede mejorar', 'Safeguarding': 'Salvaguarda', 'Community-led monitoring': 'Monitoreo dirigido por la comunidad' },
  pt: { 'Readiness Check': 'Diagnóstico de prontidão', 'Sign in': 'Iniciar sessão', 'Register your institution': 'Registe a sua instituição', 'Methodology': 'Metodologia', 'The Institute': 'O Instituto',
    // Networks
    'Network': 'Rede', 'Networks': 'Redes', 'Totals only': 'Apenas totais', 'Named results': 'Resultados identificados', 'Coordinator': 'Coordenador', 'Secretariat': 'Secretariado',
    'Assessment round': 'Ciclo de avaliação', 'Network Value Scorecard': 'Quadro de valor da rede', 'Capacity-building plan': 'Plano de reforço de capacidades', 'Peer learning': 'Aprendizagem entre pares',
    'Study tour': 'Visita de estudo', 'Exchange visit': 'Visita de intercâmbio', 'Mentoring': 'Mentoria', 'Cohort': 'Coorte', 'Latent': 'Latente', 'Emerging': 'Emergente', 'Established': 'Estabelecido', 'Advanced': 'Avançado',
    'Immediate action required': 'Ação imediata necessária', 'Attention needed': 'Requer atenção', 'Good, but may need improvement': 'Bom, mas pode ser melhorado', 'Safeguarding': 'Salvaguarda', 'Community-led monitoring': 'Monitorização liderada pela comunidade' },
  sw: { 'Readiness Check': 'Kipimo cha Utayari', 'Sign in': 'Ingia', 'Register your institution': 'Sajili taasisi yako', 'Methodology': 'Mbinu', 'The Institute': 'Taasisi' ,
    // Networks
    'Network': 'Mtandao', 'Networks': 'Mitandao', 'Totals only': 'Jumla pekee', 'Named results': 'Matokeo yenye majina', 'Coordinator': 'Mratibu', 'Secretariat': 'Sekretarieti',
    'Assessment round': 'Awamu ya tathmini', 'Network Value Scorecard': 'Kadi ya thamani ya mtandao', 'Capacity-building plan': 'Mpango wa kujenga uwezo', 'Peer learning': 'Kujifunza kati ya wenzao',
    'Study tour': 'Ziara ya mafunzo', 'Exchange visit': 'Ziara ya kubadilishana uzoefu', 'Mentoring': 'Ushauri elekezi', 'Cohort': 'Kundi', 'Latent': 'Changa', 'Emerging': 'Kinachoibuka', 'Established': 'Kilichoimarika', 'Advanced': 'Kilichoendelea',
    'Immediate action required': 'Hatua ya haraka inahitajika', 'Attention needed': 'Inahitaji uangalizi', 'Good, but may need improvement': 'Nzuri, lakini inaweza kuboreshwa', 'Safeguarding': 'Ulinzi dhidi ya madhara', 'Community-led monitoring': 'Ufuatiliaji unaoongozwa na jamii' },
  ar: { 'Readiness Check': 'فحص الجاهزية', 'Sign in': 'تسجيل الدخول', 'Register your institution': 'سجّل مؤسستك', 'Methodology': 'المنهجية', 'The Institute': 'المعهد' ,
    // Networks
    'Network': 'الشبكة', 'Networks': 'الشبكات', 'Totals only': 'المجاميع فقط', 'Named results': 'نتائج بالاسم', 'Coordinator': 'المنسق', 'Secretariat': 'الأمانة',
    'Assessment round': 'جولة التقييم', 'Network Value Scorecard': 'بطاقة قيمة الشبكة', 'Capacity-building plan': 'خطة بناء القدرات', 'Peer learning': 'التعلم بين الأقران',
    'Study tour': 'زيارة دراسية', 'Exchange visit': 'زيارة تبادلية', 'Mentoring': 'الإرشاد', 'Cohort': 'مجموعة', 'Latent': 'كامن', 'Emerging': 'ناشئ', 'Established': 'راسخ', 'Advanced': 'متقدم',
    'Immediate action required': 'مطلوب إجراء فوري', 'Attention needed': 'يحتاج إلى اهتمام', 'Good, but may need improvement': 'جيد، لكنه قد يحتاج إلى تحسين', 'Safeguarding': 'الحماية من الأذى', 'Community-led monitoring': 'الرصد بقيادة المجتمع' },
}

const MODEL = 'claude-sonnet-4-6'
export const MAX_TEXTS = 60
export const MAX_LEN = 4000
export const PROMPT_VERSION = 'v2'

const store = getStore(TRANSLATION_STORE)
const hash = textHash

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

export async function translateBatch(lang: string, texts: string[]): Promise<string[]> {
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


/**
 * Translate English strings into `lang`: reviewed translation first, then the AI cache, then the model (cached for
 * next time). Order and length are preserved; anything that fails comes back in English rather than breaking a page.
 */
export async function translateTexts(lang: string, texts: string[]): Promise<string[]> {
  if (!LANGS[lang] || !texts.length) return texts
  const out = texts.slice()
  const unique = [...new Set(texts.map((t) => t.trim()).filter((t) => t && t.length <= MAX_LEN && /\p{L}/u.test(t)))]
  const done = new Map<string, string>()
  for (let i = 0; i < unique.length; i += MAX_TEXTS) {
    const batch = unique.slice(i, i + MAX_TEXTS)
    const keys = await Promise.all(batch.map(async (t) => `${PROMPT_VERSION}/${lang}/${await hash(t)}`))
    const reviewed = await Promise.all(batch.map(async (t) => store.get(await reviewedKey(lang, t), { type: 'text' }).catch(() => null)))
    const cached = await Promise.all(keys.map((k, j) => reviewed[j] ?? store.get(k, { type: 'text' }).catch(() => null)))
    const missing = batch.map((_, j) => (cached[j] == null ? j : -1)).filter((j) => j >= 0)
    if (missing.length) {
      try {
        const translated = await translateBatch(lang, missing.map((j) => batch[j]))
        await Promise.all(missing.map(async (j, k) => { cached[j] = translated[k]; await store.set(keys[j], translated[k]).catch(() => undefined) }))
      } catch (err) {
        logger.warn('translation', 'batch failed; keeping English', { lang, count: missing.length, err })
      }
    }
    batch.forEach((t, j) => { if (cached[j]) done.set(t, cached[j] as string) })
  }
  return out.map((t) => {
    const core = t.trim()
    const tr = done.get(core)
    return tr ? t.replace(core, tr) : t
  })
}
