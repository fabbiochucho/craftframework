import { useEffect, useState } from 'react'
import { Loader2, MailWarning } from 'lucide-react'
import { Card, CardContent, Switch } from '../components/ui'
import { CATEGORY_HELP, CATEGORY_LABEL, type LifecycleCategory } from '../lib/lifecycle'
import { fetchPreferences, savePreferences, type Preferences } from '../lib/lifecycleApi'

// Which lifecycle emails a person receives. Reached from the footer of every lifecycle email with a signed token
// (no sign-in), or from Settings for the signed-in person (no token). Welcome, invitation, security and
// validation emails are transactional and are not affected.
export function EmailPreferencesPage({ token, embedded }: { token?: string | null; embedded?: boolean }) {
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    fetchPreferences(token).then((p) => live && setPrefs(p)).catch((e: Error) => live && setError(e.message))
    return () => { live = false }
  }, [token])

  async function change(category: LifecycleCategory, receiving: boolean) {
    if (!prefs) return
    const next = { checkins: prefs.checkins, celebrations: prefs.celebrations, [category]: receiving }
    setSaving(true); setStatus('')
    try {
      setPrefs(await savePreferences(token, next))
      setStatus(`${CATEGORY_LABEL[category]} emails are now ${receiving ? 'on' : 'off'}.`)
    } catch (e) {
      setError((e as Error).message)
    } finally { setSaving(false) }
  }

  const body = (
    <>
      {!embedded && <h1 className="font-display text-2xl font-bold text-emerald-900 sm:text-3xl">Email preferences</h1>}
      <p className="mt-2 text-sm leading-relaxed text-slate-600">Choose which emails from the CRAFT team you would like to receive{prefs ? <> at <b>{prefs.email}</b></> : ''}. Welcome, invitation, security and validation emails are not affected.</p>
      {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><MailWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}</p>}
      {!prefs && !error && <p className="mt-4 flex items-center gap-2 text-sm text-slate-500" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…</p>}
      {prefs && (
        <ul className="mt-5 space-y-3">
          {(['checkins', 'celebrations'] as const).map((c) => (
            <li key={c} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <p id={`pref-${c}`} className="text-sm font-semibold text-slate-900">{CATEGORY_LABEL[c]}</p>
                <p className="mt-1 text-sm text-slate-600">{CATEGORY_HELP[c]}</p>
              </div>
              <Switch checked={prefs[c]} disabled={saving} label={`${CATEGORY_LABEL[c]} emails`} onChange={(v) => change(c, v)} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 min-h-5 text-sm text-emerald-800" role="status" aria-live="polite">{status}</p>
    </>
  )
  return embedded ? <div>{body}</div> : <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12"><Card><CardContent className="p-5 sm:p-8">{body}</CardContent></Card></main>
}
