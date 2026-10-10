import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { api, STATUS_STYLE } from '../../lib/workspaceApi'
import { Badge } from '../../components/ui'

// Load JSON from the API on mount (and on `reload`). Browser-only.
export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!path)
  const reload = useCallback(async () => {
    if (!path) return
    setLoading(true)
    try {
      setData(await api<T>(path))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [path])
  useEffect(() => { void reload() }, [reload])
  return { data, error, loading, reload }
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
