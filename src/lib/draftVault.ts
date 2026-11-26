// Unsaved answers kept on this device are encrypted (AES-GCM) with a per-person key from /api/draft-key. The key is
// held in memory and in this tab's sessionStorage (cleared at sign-out with every craft_ key), so answers left on a
// shared computer survive sign-out but can only be read once the same person signs in again. Drafts written before
// encryption are read once and stored again encrypted. Self-check: `node src/lib/draftVault.test.ts`.
const SESSION = 'craft_draft_key'
const PREFIX = 'dv1:'

export class DraftUnreadable extends Error {}

let cached: { email: string; key: Promise<CryptoKey> } | null = null
if (typeof window !== 'undefined') window.addEventListener('craft:clear-sensitive', () => { cached = null })

const b64 = (bytes: Uint8Array) => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(out)
}
const unb64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0))

function keyFor(email: string): Promise<CryptoKey> {
  if (!email) return Promise.reject(new Error('Sign in to keep unsaved answers on this device.'))
  if (cached?.email === email) return cached.key
  const key = (async () => {
    let raw: string | null = null
    try { const s = JSON.parse(sessionStorage.getItem(SESSION) ?? 'null'); if (s?.email === email) raw = s.key } catch { /* no session copy */ }
    if (!raw) {
      const res = await fetch('/api/draft-key', { credentials: 'same-origin' })
      if (!res.ok) throw new Error(res.status === 401 ? 'Sign in again to keep unsaved answers on this device.' : 'Unsaved answers cannot be protected on this device right now.')
      raw = String((await res.json()).key)
      try { sessionStorage.setItem(SESSION, JSON.stringify({ email, key: raw })) } catch { /* memory copy still works */ }
    }
    return crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', false, ['encrypt', 'decrypt'])
  })()
  cached = { email, key }
  key.catch(() => { if (cached?.key === key) cached = null })
  return key
}

// One queue per stored name, so a later write or removal never lands before an earlier one.
const queues = new Map<string, Promise<unknown>>()
function queued<T>(name: string, task: () => Promise<T>): Promise<T> {
  const run = (queues.get(name) ?? Promise.resolve()).catch(() => {}).then(task)
  queues.set(name, run)
  return run
}

async function seal(email: string, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(JSON.stringify(value))
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(email), data))
  return `${PREFIX}${b64(iv)}:${b64(sealed)}`
}

export function writeDraft(email: string, name: string, value: unknown): Promise<void> {
  return queued(name, async () => { localStorage.setItem(name, await seal(email, value)) })
}

/** The draft, or null when there is none. Throws DraftUnreadable when it belongs to someone else or an older key. */
export function readDraft<T>(email: string, name: string): Promise<T | null> {
  return queued(name, async () => {
    const stored = localStorage.getItem(name)
    if (stored === null) return null
    if (!stored.startsWith(PREFIX)) {
      const value = JSON.parse(stored) as T
      localStorage.setItem(name, await seal(email, value))
      return value
    }
    const [iv, data] = stored.slice(PREFIX.length).split(':')
    const key = await keyFor(email)
    try {
      return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(data)))) as T
    } catch {
      throw new DraftUnreadable('An unsaved draft on this device belongs to another sign-in and was left untouched.')
    }
  })
}

export function removeDraft(name: string): Promise<void> {
  return queued(name, async () => { localStorage.removeItem(name) })
}
