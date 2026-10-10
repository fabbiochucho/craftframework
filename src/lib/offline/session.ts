import { getUser } from '@netlify/identity'

export interface OfflineOwner {
  userId: string
  tenantId: string
  email: string
}

let owner: OfflineOwner | null = null
let controller = new AbortController()
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === 'craft_session_lock') setOfflineSession(null)
  })
}

export function setOfflineSession(next: OfflineOwner | null): void {
  if (JSON.stringify(owner) === JSON.stringify(next)) return
  controller.abort()
  controller = new AbortController()
  owner = next
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('craft:session'))
}

export function getOfflineSession(): OfflineOwner | null {
  return owner ? { ...owner } : null
}

export function ownsRecord(record: { owner?: OfflineOwner }): boolean {
  return Boolean(owner && record.owner && owner.userId === record.owner.userId && owner.tenantId === record.owner.tenantId)
}

export async function authenticatedSignal(): Promise<AbortSignal> {
  const expected = getOfflineSession()
  const signal = controller.signal
  const user = await getUser()
  if (!expected || signal.aborted || !user || user.id !== expected.userId || user.email !== expected.email) {
    throw new Error('Sign in as the original user to sync saved changes.')
  }
  // Identity's cached user can lag a cookie change made in another tab. Check the
  // actual request credential's subject too; the API still verifies its signature.
  const cookie = document.cookie.split('; ').find(value => value.startsWith('nf_jwt='))
  try {
    const token = decodeURIComponent(cookie?.slice('nf_jwt='.length) ?? '')
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (claims.sub !== expected.userId || !claims.exp || claims.exp * 1000 <= Date.now()) throw new Error()
  } catch {
    throw new Error('Session credential changed or expired. Saved changes remain locked.')
  }
  return signal
}

/** Lock pending work, never erase it automatically. Safe to call before logout. */
export async function clearOfflineSession(): Promise<void> {
  setOfflineSession(null)
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('craft:clear-sensitive'))
  try { window.localStorage.setItem('craft_session_lock', String(Date.now())) } catch { /* storage may be disabled */ }
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = window[name]
      for (const key of Object.keys(storage)) {
        // Legacy informal-economy answers may be unsynced: retain, never auto-erase.
        if (/^craft(?:[_.-])/.test(key) && key !== 'craft_lang' && !key.startsWith('craft-informal-')) storage.removeItem(key)
      }
    } catch { /* unavailable storage must not prevent other cleanup */ }
  }
  if ('caches' in window) {
    await Promise.all((await caches.keys()).map(name => caches.delete(name)))
  }
}
