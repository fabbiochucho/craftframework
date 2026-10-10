import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { api, STATUS_STYLE } from '../../lib/workspaceApi'
import { Badge, Button, Input, Select } from '../../components/ui'

// Load JSON from the API on mount (and on `reload`). Browser-only.
export function useApi<T = any>(path: string | null) {
  const [result, setResult] = useState<{ path: string | null; data: T | null; error: string | null }>({ path, data: null, error: null })
  const [loading, setLoading] = useState(!!path)
  const request = useRef(0)
  const reload = useCallback(async () => {
    const id = ++request.current
    if (!path) { setResult({ path, data: null, error: null }); setLoading(false); return }
    setLoading(true)
    try {
      const data = await api<T>(path)
      if (id === request.current) setResult({ path, data, error: null })
    } catch (e) {
      if (id === request.current) setResult({ path, data: null, error: (e as Error).message })
    } finally {
      if (id === request.current) setLoading(false)
    }
  }, [path])
  useEffect(() => { void reload(); return () => { ++request.current } }, [reload])
  return { data: result.path === path ? result.data : null, error: result.path === path ? result.error : null, loading: !!path && (result.path !== path || loading), reload }
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

export function State({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) return <p className="text-sm text-slate-500">Loading…</p>
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

export const ErrorLine = ({ error }: { error: string | null }) =>
  error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null
