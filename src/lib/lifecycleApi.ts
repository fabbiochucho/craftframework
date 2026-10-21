// Browser-side calls for the lifecycle email pages (/feedback, /email-preferences, /badge). The signed token in the
// link is the credential; signed-in people (the settings link, /badge) are identified by their session instead.
export type SurveyState = {
  firstName: string
  orgName: string | null
  state: 'open' | 'editable' | 'closed'
  editableUntil: string | null
  answer: { nps: number; ease: number; usedMost: string[]; improve: string; wantsCall: boolean; callTimes: string } | null
}
export type Preferences = { email: string; checkins: boolean; celebrations: boolean }
export type BadgeInfo = { orgName: string; year: number; fileName: string; svg: string; shareToken: string | null }

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/lifecycle/${path}`, { cache: 'no-store', credentials: 'same-origin', ...init })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(body?.error ?? 'Something went wrong. Please try again.', res.status)
  return body as T
}
const withToken = (path: string, token?: string | null) => (token ? `${path}?t=${encodeURIComponent(token)}` : path)
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export const fetchSurvey = (token: string) => request<SurveyState>(withToken('survey', token))
export const submitSurvey = (token: string, answer: unknown) =>
  request<{ ok: true; editableUntil: string; callRequested: boolean }>(withToken('survey', token), json('PUT', answer))
export const fetchPreferences = (token?: string | null) => request<Preferences>(withToken('preferences', token))
export const savePreferences = (token: string | null | undefined, prefs: { checkins: boolean; celebrations: boolean }) =>
  request<Preferences>(withToken('preferences', token), json('PUT', prefs))
export const fetchBadgeInfo = (token?: string | null) => request<BadgeInfo>(withToken('badge-info', token))
export { ApiError }

// --- Super Admin (/api/admin-lifecycle) -----------------------------------------------------------------------------
async function admin<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin-lifecycle${path}`, { cache: 'no-store', ...init })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(body?.error ?? 'Request failed', res.status)
  return body as T
}
export const adminLifecycle = {
  status: <T>() => admin<T>(''),
  schedule: <T>() => admin<T>('/schedule'),
  history: <T>(email?: string) => admin<T>(`/history${email ? `?email=${encodeURIComponent(email)}` : ''}`),
  variants: <T>() => admin<T>('/variants'),
  preview: <T>(id: string) => admin<T>(`/preview?id=${encodeURIComponent(id)}`),
  survey: <T>() => admin<T>('/survey'),
  pause: (paused: boolean) => admin<{ paused: boolean }>('/pause', json('PUT', { paused })),
  handled: (id: string, handled: boolean) => admin<{ id: string; handled: boolean }>(`/survey/${encodeURIComponent(id)}/handled`, json('PUT', { handled })),
}
