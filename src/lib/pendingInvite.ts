// Remembers an invitation link while the invitee creates an account or signs in, so they come back
// to /accept/<token> afterwards (an email-confirmation or Google sign-in returns via /auth without
// the original ?next=). Best effort: storage may be unavailable (private mode, blocked site data).
const KEY = 'craft:pendingInvite'
const TOKEN = /^[A-Za-z0-9_-]{8,100}$/

export function rememberInvite(token: string): void {
  if (!TOKEN.test(token)) return
  try { window.localStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() })) } catch { /* unavailable */ }
}

export function forgetInvite(): void {
  try { window.localStorage.removeItem(KEY) } catch { /* unavailable */ }
}

/** The accept path for a remembered invitation (kept for at most 14 days), clearing it. */
export function takeInvitePath(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    window.localStorage.removeItem(KEY)
    const { token, at } = JSON.parse(raw) as { token?: unknown; at?: unknown }
    if (typeof token !== 'string' || !TOKEN.test(token) || typeof at !== 'number' || Date.now() - at > 14 * 86_400_000) return null
    return `/accept/${token}`
  } catch {
    return null
  }
}
