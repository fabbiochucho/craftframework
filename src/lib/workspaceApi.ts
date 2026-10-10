// Thin client for the workspace platform API (netlify/functions/workspace-api.mts).
// Runs only in the browser (effects / event handlers), never during SSR.

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message)
  }
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, (data as any)?.error ?? res.statusText, data)
  return data as T
}

export const wsPath = (workspaceId: string | number, rest = '') => `/workspaces/${workspaceId}${rest}`

export const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-700',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-emerald-100 text-emerald-700',
}
export const STATUS_STYLE: Record<string, string> = {
  open: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  approved: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-rose-100 text-rose-700',
  expired: 'bg-rose-100 text-rose-700',
  rejected: 'bg-rose-100 text-rose-700',
  pending_review: 'bg-amber-100 text-amber-800',
  draft: 'bg-slate-100 text-slate-700',
  in_review: 'bg-blue-100 text-blue-700',
  not_started: 'bg-slate-100 text-slate-700',
}
export const TIER_LABEL = (tier: number) => `Tier ${tier}`
