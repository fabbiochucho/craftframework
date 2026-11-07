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

// No operator token in tests: behaves like Identity admin being unavailable,
// which callers (e.g. /api/users) already treat as "directory rows only".
// A test may set globalThis.__craftTestIdentityUsers = [{ id, email, name }] to stand in for registered
// accounts; listUsers then pages through them and deleteUser removes one.
export const admin = {
  async listUsers({ page = 1, perPage = 200 } = {}) {
    const list = globalThis.__craftTestIdentityUsers
    if (!list) throw new Error('Identity admin is unavailable in tests')
    return list.slice((page - 1) * perPage, page * perPage)
  },
  async deleteUser(id) {
    const list = globalThis.__craftTestIdentityUsers
    if (!list) throw new Error('Identity admin is unavailable in tests')
    globalThis.__craftTestIdentityUsers = list.filter((u) => u.id !== id)
  },
}
