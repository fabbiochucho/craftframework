// Small fetch helper shared by the /training pages. Every rule is enforced by /api/training;
// the pages only reflect what the server allows.
export async function api<T = any>(path: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method, cache: 'no-store',
    headers: init?.json !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(body?.error === 'mfa_required' ? 'Multi-factor sign-in required' : body?.error || `Request failed (${res.status})`), { body })
  return body as T
}
export const training = <T = any>(path: string, init?: { method?: string; json?: unknown }) => api<T>(`/api/training/${path}`, init)
