// Cloudflare Turnstile: server-side check of the sign-up challenge token. Self-check:
// `node netlify/lib/turnstile.test.ts`.
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** 'pass' | 'fail' | 'unavailable' (Cloudflare unreachable — the caller decides). */
export async function verifyTurnstile(token: unknown, secret: string, ip?: string, fetchImpl: typeof fetch = fetch): Promise<'pass' | 'fail' | 'unavailable'> {
  if (typeof token !== 'string' || !token || token.length > 2048) return 'fail'
  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)
  try {
    const res = await fetchImpl(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) })
    if (!res.ok) return 'unavailable'
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    // A wrong or rotated secret is our misconfiguration, not a bot: don't block every sign-up for it.
    if (data['error-codes']?.some((c) => c.includes('secret'))) return 'unavailable'
    return data.success === true ? 'pass' : 'fail'
  } catch {
    return 'unavailable'
  }
}
