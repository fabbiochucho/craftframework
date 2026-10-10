import { getUser } from '@netlify/identity'

export interface OfflineOwner {
  userId: string
  tenantId: string
  email: string
}

let owner: OfflineOwner | null = null
let controller = new AbortController()

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
  return signal
}

/** Lock pending work, never erase it automatically. Safe to call before logout. */
export async function clearOfflineSession(): Promise<void> {
  setOfflineSession(null)
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('craft:clear-sensitive'))
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of Object.keys(storage)) {
      if (/^craft(?:[_.-])/.test(key) && key !== 'craft_lang') storage.removeItem(key)
    }
  }
  const { offlineDB } = await import('./db')
  await offlineDB.clearDrafts()
  if ('caches' in window) {
    await Promise.all((await caches.keys()).map(name => caches.delete(name)))
  }
}
