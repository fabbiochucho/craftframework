import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs } from '../../db/schema.js'
import { forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'
import { REVIEW_LANGS, TRANSLATION_STORE, reviewedKey, textHash } from '../lib/translation-keys.js'
import { PROMPT_VERSION } from '../lib/translation.js'
import { networkStrings } from '../../src/lib/networkStrings.js'
import { toCsv } from '../../src/lib/networkExchange.js'

// /api/translation-review — professional review of translations (Super Admin, with MFA).
//   GET  export.csv?lang=fr       every network-assessment string: English, current translation, and whether it is
//                                 reviewed, machine-translated or not yet translated
//   POST { lang, entries: [{ english, translation }] }   store reviewed translations; they win on every screen and export
// Reviewed translations are matched on the exact English text (trimmed), the same key the screens use.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const uploadSchema = z.object({
  lang: z.enum(REVIEW_LANGS),
  entries: z.array(z.object({ english: z.string().trim().min(1).max(4000), translation: z.string().trim().min(1).max(8000) }).strict()).min(1).max(3000),
}).strict()

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    if (!isSuperAdmin(caller.email) || caller.role !== 'super_admin' || caller.readOnly) return forbidden()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const url = new URL(req.url)
    const sub = url.pathname.replace(/^\/api\/translation-review\/?/, '')
    const store = getStore(TRANSLATION_STORE)

    if (req.method === 'GET' && sub === 'export.csv') {
      const lang = url.searchParams.get('lang') ?? ''
      if (!(REVIEW_LANGS as readonly string[]).includes(lang)) return json({ error: 'Choose fr, pt, es, sw or ar' }, 400)
      const rows: unknown[][] = [['english', 'translation', 'status']]
      for (const en of networkStrings()) {
        const reviewed = await store.get(await reviewedKey(lang, en), { type: 'text' }).catch(() => null)
        const machine = reviewed ? null : await store.get(`${PROMPT_VERSION}/${lang}/${await textHash(en)}`, { type: 'text' }).catch(() => null)
        rows.push([en, reviewed ?? machine ?? '', reviewed ? 'reviewed' : machine ? 'machine' : 'not yet translated'])
      }
      return new Response('﻿' + toCsv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="craft-network-strings-${lang}.csv"`, 'Cache-Control': 'private, no-store' } })
    }

    if (req.method === 'POST' && sub === '') {
      const origin = req.headers.get('origin')
      if (origin && origin !== url.origin) return forbidden()
      const p = uploadSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: p.error.issues[0]?.message ?? 'Send a language and a list of { english, translation }' }, 400)
      for (const e of p.data.entries) await store.set(await reviewedKey(p.data.lang, e.english), e.translation)
      await db.insert(auditLogs).values({ actor: caller.email, action: `Uploaded ${p.data.entries.length} reviewed ${p.data.lang} translations`, target: 'translations', category: 'Config' })
      return json({ saved: p.data.entries.length })
    }
    return json({ error: 'Not found' }, 404)
  } catch (err) {
    logger.error('translation-review', 'request failed', err)
    return json({ error: 'Request failed' }, 500)
  }
}

export const config: Config = { path: ['/api/translation-review', '/api/translation-review/*'] }

export default monitored(handleRequest)
