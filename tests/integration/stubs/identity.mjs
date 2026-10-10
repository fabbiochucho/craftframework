// Test-only stand-in for @netlify/identity. The "verified" Identity user is
// supplied by the test harness: per request through AsyncLocalStorage (E2E API
// server, where requests overlap) or, for sequential in-process calls, through
// a plain global. With neither set the caller is anonymous.
import { AsyncLocalStorage } from 'node:async_hooks'

export const identityStorage = (globalThis.__craftTestIdentityAls ??= new AsyncLocalStorage())

export async function getUser() {
  const scoped = identityStorage.getStore()
  if (scoped !== undefined) return scoped
  return globalThis.__craftTestIdentity ?? null
}
