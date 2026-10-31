// Super Admin: professional review of network-assessment translations. Download the strings for a language (with the
// current machine translation), have a translator correct the "translation" column, and upload the file back.
import { useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '../ui'
import { uploadReviewedTranslations } from '../../lib/api'
import { parseCsv } from '../../lib/networkStrings'

const LANGS = [['fr', 'French'], ['pt', 'Portuguese'], ['es', 'Spanish'], ['sw', 'Swahili'], ['ar', 'Arabic']] as const

export function TranslationReviewPanel() {
  const [lang, setLang] = useState<string>('fr')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const upload = async (file: File) => {
    setBusy(true); setMessage(null)
    try {
      const [header, ...rows] = parseCsv((await file.text()).replace(/^﻿/, ''))
      const en = header?.indexOf('english') ?? -1, tr = header?.indexOf('translation') ?? -1
      if (en < 0 || tr < 0) throw new Error('The file needs "english" and "translation" columns')
      const entries = rows.map((r) => ({ english: (r[en] ?? '').trim(), translation: (r[tr] ?? '').trim() })).filter((e) => e.english && e.translation)
      if (!entries.length) throw new Error('No translations found in the file')
      setMessage(`Saved ${await uploadReviewedTranslations(lang, entries)} reviewed translations.`)
    } catch (e) { setMessage((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Reviewed translations (network assessments)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600">Download every network-assessment string with its current translation. A translator corrects the "translation" column; upload the file back and the reviewed wording is used on every screen and export from then on. Leave rows blank to keep the machine translation.</p>
        <label className="flex items-center gap-2 text-sm">Language
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
            {LANGS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <a href={`/api/translation-review/export.csv?lang=${lang}`}><Button variant="outline">Download strings (CSV)</Button></a>
          <label className="text-sm">Upload reviewed CSV <input type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} /></label>
        </div>
        {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
      </CardContent>
    </Card>
  )
}
