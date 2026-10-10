export const RECOVERY_ERROR = 'This password reset link is invalid or has expired. Request a new link and try again.'

export async function discardRecoverySession(logout: () => Promise<void>) {
  try {
    await logout()
  } finally {
    // SDK 1.2.0's logout can throw before removing cookies on a network failure.
    if (typeof document !== 'undefined') {
      for (const name of ['nf_jwt', 'nf_refresh']) {
        document.cookie = `${name}=; path=/; secure; samesite=lax; max-age=0`
      }
    }
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem('gotrue.user') } catch { /* Storage may be disabled. */ }
    }
  }
}

/** Inspect before the SDK callback handler: it otherwise signs in recovery users. */
export function readRecoveryHash(hash: string): { recovery: boolean; token: string | null } {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const recovery = params.has('recovery_token') || params.get('type') === 'recovery'
  if (!recovery) return { recovery: false, token: null }
  const token = params.get('recovery_token')
  const valid = params.getAll('recovery_token').length === 1 &&
    !!token && token.length <= 4096 && !/[\s\x00-\x1f]/.test(token) &&
    !['access_token', 'confirmation_token', 'invite_token', 'email_change_token', 'error'].some(key => params.has(key))
  return { recovery: true, token: valid ? token : null }
}

export async function completePasswordRecovery<T extends { email?: string }>(
  token: string,
  password: string,
  identity: {
    recoverPassword: (token: string, password: string) => Promise<T>
    login: (email: string, password: string) => Promise<T>
    logout: () => Promise<void>
  },
): Promise<T> {
  try {
    const user = await identity.recoverPassword(token, password)
    if (!user.email) throw new Error(RECOVERY_ERROR)
    // SDK 1.2.0's recovery helper does not set browser auth cookies; login does.
    return await identity.login(user.email, password)
  } catch {
    // Redemption may create a session before the password update fails.
    await discardRecoverySession(identity.logout).catch(() => {})
    throw new Error(RECOVERY_ERROR)
  }
}
