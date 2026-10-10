import { test } from 'node:test'
import assert from 'node:assert/strict'
import { completePasswordRecovery, discardRecoverySession, readRecoveryHash, RECOVERY_ERROR } from './identityRecovery.ts'

test('recovery tokens are recognized separately from sign-in callbacks', () => {
  assert.deepEqual(readRecoveryHash('#recovery_token=one-use-link'), { recovery: true, token: 'one-use-link' })
  assert.deepEqual(readRecoveryHash('#confirmation_token=confirmation'), { recovery: false, token: null })
  assert.deepEqual(readRecoveryHash('#access_token=session'), { recovery: false, token: null })
})

test('empty, duplicated, mixed and malformed recovery links cannot sign in', () => {
  for (const hash of [
    '#recovery_token=', '#type=recovery', '#recovery_token=a&recovery_token=b',
    '#recovery_token=a&access_token=b', '#recovery_token=a&confirmation_token=b',
    '#recovery_token=a&invite_token=b', '#recovery_token=a&error=expired',
    '#recovery_token=bad%00token', '#recovery_token=bad+token',
    `#recovery_token=${'a'.repeat(4097)}`,
  ]) assert.deepEqual(readRecoveryHash(hash), { recovery: true, token: null })
})

test('reset completes the password change before establishing the signed-in cookie session', async () => {
  const calls: string[] = []
  const user = { email: 'member@example.test' }
  const result = await completePasswordRecovery('one-use-link', 'new-password', {
    async recoverPassword(token, password) {
      assert.equal(token, 'one-use-link')
      assert.equal(password, 'new-password')
      calls.push('changed')
      return user
    },
    async login(email, password) {
      assert.deepEqual(calls, ['changed'])
      assert.equal(email, user.email)
      assert.equal(password, 'new-password')
      calls.push('signed-in')
      return user
    },
    async logout() { calls.push('logout') },
  })
  assert.equal(result, user)
  assert.deepEqual(calls, ['changed', 'signed-in'])
})

test('expired tokens and failed password changes clear partial sessions without exposing details', async () => {
  let loggedOut = false
  await assert.rejects(completePasswordRecovery('expired', 'new-password', {
    async recoverPassword() { throw new Error('private provider detail') },
    async login() { throw new Error('must not sign in') },
    async logout() { loggedOut = true },
  }), { message: RECOVERY_ERROR })
  assert.equal(loggedOut, true)
})

test('failed session establishment and unavailable logout still report a safe reset error', async () => {
  let loggedOut = false
  await assert.rejects(completePasswordRecovery('link', 'new-password', {
    async recoverPassword() { return { email: 'member@example.test' } },
    async login() { throw new Error('network detail') },
    async logout() { loggedOut = true; throw new Error('offline') },
  }), { message: RECOVERY_ERROR })
  assert.equal(loggedOut, true)
})

test('failed logout still deletes SDK session storage and browser auth cookies', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const cookies: string[] = []
  const removed: string[] = []
  Object.defineProperty(globalThis, 'document', {
    configurable: true, value: { set cookie(value: string) { cookies.push(value) } },
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { removeItem(key: string) { removed.push(key) } },
  })
  try {
    await assert.rejects(discardRecoverySession(async () => { throw new Error('offline') }))
    assert.deepEqual(removed, ['gotrue.user'])
    assert.equal(cookies.length, 2)
    assert.ok(cookies.every(cookie => cookie.includes('max-age=0')))
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else Reflect.deleteProperty(globalThis, 'document')
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
