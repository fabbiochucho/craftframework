import { authenticatedSignal } from './session.ts'
import { assertFrameworkOwner, changeFrameworkState, frameworkKey, frameworkLock, readFrameworkState } from './framework-store.ts'
import { sameScope, validateFrameworkOperation, type FrameworkPending, type FrameworkRecord, type FrameworkScope } from './framework-protocol.ts'

export type FrameworkTransport = (scope: FrameworkScope, operation: FrameworkPending) => Promise<Response>
const transport: FrameworkTransport = async (scope, pending) => {
  const signal = AbortSignal.any([await authenticatedSignal(), AbortSignal.timeout(30_000)])
  assertFrameworkOwner(scope)
  return fetch(`/api/workspaces/${scope.workspaceId}/offline-frameworks/mutations`, {
    credentials: 'same-origin', cache: 'no-store', signal, method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, operation: validateFrameworkOperation(pending) }),
  })
}

export async function syncFrameworks(scope: FrameworkScope, send: FrameworkTransport = transport): Promise<void> {
  if (!navigator.onLine) return
  await frameworkLock(`sync:${frameworkKey(scope)}`, async () => {
    const queue = (await readFrameworkState(scope)).pending
    const blocked = new Set<string>()
    for (const op of queue) {
      assertFrameworkOwner(scope)
      if (!navigator.onLine) return
      if (blocked.has(op.frameworkId)) continue
      // Re-read: another tab may have resolved/discarded this chain while we waited.
      const current = (await readFrameworkState(scope)).pending.find(item => item.operationId === op.operationId)
      if (!current) continue
      if (current.failure || current.nextAttemptAt > Date.now()) { blocked.add(op.frameworkId); continue }
      let response: Response | undefined
      let result: { scope?: FrameworkScope; operationId?: string; record?: FrameworkRecord; current?: FrameworkRecord; error?: string } = {}
      let error = 'Network unavailable; saved change retained'
      try {
        response = await send(scope, current)
        result = await response.json()
        assertFrameworkOwner(scope)
        if (!result.scope || !sameScope(result.scope, scope)) {
          // HTTP errors can omit scope, but no success or conflict is accepted without it.
          if (response.ok || response.status === 409) throw new Error('Server response scope was not verified')
        }
        if (response.ok && result.operationId === op.operationId && result.record?.id === op.frameworkId &&
            result.record.version === op.baseVersion + 1 && result.record.deleted === (op.action === 'delete')) {
          await changeFrameworkState(scope, state => {
            // Confirmation and the local server snapshot are one durable write.
            const cached = state.records.find(record => record.id === op.frameworkId)
            if (!cached || cached.version <= result.record!.version) {
              state.records = state.records.filter(record => record.id !== op.frameworkId)
              state.records.push(result.record!)
            }
            state.pending = state.pending.filter(item => item.operationId !== op.operationId)
          })
          continue
        }
        error = result.error ?? `Server rejected saved change (${response.status})`
      } catch (cause) {
        assertFrameworkOwner(scope)
        error = cause instanceof Error ? cause.message : error
      }
      blocked.add(op.frameworkId)
      await changeFrameworkState(scope, state => {
        const item = state.pending.find(item => item.operationId === op.operationId)
        if (!item) return
        item.attempts++
        item.error = error
        item.nextAttemptAt = Date.now() + Math.min(300_000, 1000 * 2 ** item.attempts)
        if (response?.status === 409 && result.scope && sameScope(result.scope, scope)) {
          item.failure = 'conflict'; item.serverRecord = result.current
        } else if (response && response.status >= 400 && response.status < 500 && ![401, 408, 429].includes(response.status)) {
          item.failure = 'permanent'
        } else if (item.attempts >= 6) item.failure = 'retry'
      })
      if (response?.status === 401) return
    }
  })
}
