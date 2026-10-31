import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { api, downloadApi, STATUS_STYLE } from '../../lib/workspaceApi'
import { Badge, Button, Input, Select } from '../../components/ui'
import { useI18n } from '../../lib/i18n'

// Load JSON from the API on mount (and on `reload`). Browser-only.
export function useApi<T = any>(path: string | null, scope = '') {
  const key = `${scope}|${path ?? ''}`
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null }>({ key, data: null, error: null })
  const [loading, setLoading] = useState(!!path)
  const request = useRef(0)
  const reload = useCallback(async () => {
    const id = ++request.current
    if (!path) { setResult({ key, data: null, error: null }); setLoading(false); return }
    setLoading(true)
    try {
      const data = await api<T>(path)
      if (id === request.current) setResult({ key, data, error: null })
    } catch (e) {
      if (id === request.current) setResult({ key, data: null, error: (e as Error).message })
    } finally {
      if (id === request.current) setLoading(false)
    }
  }, [path, key])
  useEffect(() => { void reload(); return () => { ++request.current } }, [reload])
  return { data: result.key === key ? result.data : null, error: result.key === key ? result.error : null, loading: !!path && (result.key !== key || loading), reload }
}

export function EditFields({ initial, fields, save, disabled = false }: {
  initial: Record<string, any>; fields: { name: string; label: string; type?: string; options?: string[] }[];
  save: (body: Record<string, unknown>) => Promise<unknown>; disabled?: boolean
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const { run, error, busy } = useAction(() => setDraft({}))
  const submit = () => run(() => save(Object.fromEntries(Object.entries(draft).map(([key, value]) => {
    const type = fields.find(f => f.name === key)?.type
    return [key, type === 'date' ? value || null : type === 'number' ? Number(value) : value]
  }))))
  return <div className="space-y-3">
    {fields.map(f => { const value = draft[f.name] ?? String(initial[f.name] ?? ''); return f.options
      ? <fieldset key={f.name} disabled={disabled || busy}><Select label={f.label} value={value} onChange={v => { if (!disabled && !busy) setDraft({ ...draft, [f.name]: v }) }} options={f.options.map(v => ({ value: v, label: v.replace(/_/g, ' ') }))} /></fieldset>
      : <Input key={f.name} label={f.label} type={f.type ?? 'text'} disabled={disabled || busy} value={value} onChange={e => setDraft({ ...draft, [f.name]: e.target.value })} /> })}
    <ErrorLine error={error} />
    <Button disabled={disabled || busy || !Object.keys(draft).length} onClick={submit}>Save changes</Button>
  </div>
}

export function Header({ title, subtitle, back }: { title: string; subtitle?: string; back?: { to: string; params?: Record<string, string>; label: string } }) {
  return (
    <div className="mb-6">
      {back && <Link to={back.to} params={back.params as never} className="text-xs font-medium text-emerald-700 hover:underline">← {back.label}</Link>}
      <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  )
}

// The API answers 'mfa_required' when the account uses multi-factor sign-in and this browser has
// not entered a code yet, and 'mfa_enrollment_required' when an organisation requires MFA.
export function MfaPrompt() {
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState(false)
  const { run, error, busy } = useAction(() => window.location.reload())
  return (
    <form className="max-w-md space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4" onSubmit={e => { e.preventDefault(); void run(() => api('/mfa/verify', { method: 'POST', body: recovery ? { recoveryCode: code } : { code } })) }}>
      <p className="font-semibold text-amber-900">Enter your authentication code</p>
      <p className="text-sm text-amber-900">{recovery ? 'Enter one of your recovery codes. Each works once.' : 'Open your authenticator app and enter the 6-digit code for CRAFT.'}</p>
      <Input label={recovery ? 'Recovery code' : 'Authentication code'} autoComplete="one-time-code" inputMode={recovery ? 'text' : 'numeric'} value={code} onChange={e => setCode(e.target.value)} />
      <ErrorLine error={error} />
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={busy || !code.trim()}>Verify</Button>
        <button type="button" className="text-sm underline" onClick={() => { setRecovery(!recovery); setCode('') }}>{recovery ? 'Use the authenticator app' : 'Use a recovery code'}</button></div>
    </form>
  )
}

export function State({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) return <p className="text-sm text-slate-500">Loading…</p>
  if (error === 'mfa_required') return <MfaPrompt />
  if (error === 'mfa_enrollment_required') return <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This organisation requires multi-factor sign-in. <Link className="underline" to="/app/security">Turn it on in Account security</Link>, then come back.</p>
  if (error) return <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
  return null
}

export function StatusPill({ value }: { value: string }) {
  return <Badge className={STATUS_STYLE[value] ?? 'bg-slate-100 text-slate-700'}>{value.replace(/_/g, ' ')}</Badge>
}

export function Tile({ label, value, tone = 'text-emerald-900' }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  )
}

export function useAction(onDone?: () => void | Promise<void>) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await onDone?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return { run, error, busy }
}

/** Excel (XLSX) and PDF download buttons for an export endpoint that takes ?format=xlsx|pdf. */
export function ExportButtons({ path, name }: { path: string; name: string }) {
  const { run, error, busy } = useAction()
  const { lang } = useI18n()
  // The file comes back in the reader's language (Arabic PDFs stay in English: PDF fonts cannot shape Arabic).
  const sep = `${path.includes('?') ? '&' : '?'}${lang && lang !== 'en' ? `lang=${lang}&` : ''}`
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="outline" disabled={busy} onClick={() => run(() => downloadApi(`${path}${sep}format=xlsx`, `${name}.xlsx`))}>Excel (XLSX)</Button>
      <Button variant="outline" disabled={busy} onClick={() => run(() => downloadApi(`${path}${sep}format=pdf`, `${name}.pdf`))}>PDF</Button>
      {error && <span role="alert" className="text-sm text-rose-700">{error}</span>}
    </span>
  )
}

export const ErrorLine = ({ error }: { error: string | null }) =>
  error === 'mfa_required' || error === 'mfa_enrollment_required' ? <State loading={false} error={error} />
  : error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null
