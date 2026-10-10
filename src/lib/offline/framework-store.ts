import { offlineDB } from './db.ts'
import { authenticatedSignal, getOfflineSession } from './session.ts'
import { projectFrameworks, sameScope, validateFrameworkData, type FrameworkData, type FrameworkScope, type FrameworkState } from './framework-protocol.ts'

export const frameworkKey = (scope: FrameworkScope) => `frameworks:${scope.orgId}:${scope.workspaceId}:${scope.userId}`

export function assertFrameworkOwner(scope: FrameworkScope): void {
  if (getOfflineSession()?.userId !== scope.userId) throw new Error('Saved frameworks are locked. Sign in as their original user.')
}

export async function frameworkLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error('This browser cannot safely coordinate offline edits across tabs.')
  return navigator.locks.request(`craft:${key}`, action)
}

export async function readFrameworkState(scope: FrameworkScope): Promise<FrameworkState> {
  assertFrameworkOwner(scope)
  const state = await offlineDB.getDraft<FrameworkState>(frameworkKey(scope))
  assertFrameworkOwner(scope)
  if (state && !sameScope(state.scope, scope)) throw new Error('Saved framework scope does not match this workspace')
  return state ?? { scope, records: [], pending: [] }
}

export async function changeFrameworkState(scope: FrameworkScope, change: (state: FrameworkState) => void): Promise<FrameworkState> {
  return frameworkLock(frameworkKey(scope), async () => {
    const state = await readFrameworkState(scope)
    change(state)
    assertFrameworkOwner(scope)
    if (!offlineDB.isAvailable()) throw new Error('IndexedDB unavailable; the change has not been saved')
    await offlineDB.putDraft(frameworkKey(scope), state)
    assertFrameworkOwner(scope)
    window.dispatchEvent(new Event('craft:frameworks'))
    return state
  })
}

export async function saveFramework(scope: FrameworkScope, action: 'create' | 'update' | 'delete', id: string, data?: FrameworkData, expectedVersion?: number) {
  const normalized = action === 'delete' ? undefined : validateFrameworkData(data)
  return changeFrameworkState(scope, state => {
    const record = projectFrameworks(state).find(record => record.id === id)
    if (action === 'create' ? Boolean(record) : !record || record.deleted) throw new Error('Framework no longer exists')
    if (expectedVersion !== undefined && record?.version !== expectedVersion)
      throw new Error('Framework changed since you opened the editor. Reopen it before saving to avoid overwriting another edit.')
    if (state.pending.some(op => op.frameworkId === id && op.failure)) throw new Error('Resolve or retry this framework’s failed change first')
    state.pending.push({ operationId: crypto.randomUUID(), frameworkId: id, action,
      baseVersion: action === 'create' ? 0 : record!.version, data: normalized, attempts: 0, nextAttemptAt: 0 })
  })
}

/** Verify the cookie subject and server membership before opening or refreshing a workspace. */
export async function openFrameworkWorkspace(workspaceId: number): Promise<{ state: FrameworkState; role: string }> {
  const owner = getOfflineSession()
  if (!owner) throw new Error('Sign in to unlock saved frameworks')
  const bindingKey = `framework-binding:${owner.userId}:${workspaceId}`
  const binding = await offlineDB.getDraft<{ scope: FrameworkScope; role: string }>(bindingKey)
  if (!navigator.onLine) {
    if (!binding || binding.scope.userId !== owner.userId) throw new Error('Open this workspace online once before editing offline')
    return { state: await readFrameworkState(binding.scope), role: binding.role }
  }
  const signal = AbortSignal.any([await authenticatedSignal(), AbortSignal.timeout(30_000)])
  const response = await fetch(`/api/workspaces/${workspaceId}/offline-frameworks`, { credentials: 'same-origin', cache: 'no-store', signal })
  if (!response.ok) {
    if ([401, 403, 404].includes(response.status)) await offlineDB.deleteDraft(bindingKey)
    throw new Error(`Workspace access verification failed (${response.status}); saved frameworks remain locked`)
  }
  const result = await response.json() as { scope: FrameworkScope; role: string; records: FrameworkState['records'] }
  if (signal.aborted || result.scope.userId !== owner.userId || result.scope.workspaceId !== workspaceId ||
      !Number.isSafeInteger(result.scope.orgId) || result.scope.orgId <= 0) throw new Error('Workspace identity changed')
  assertFrameworkOwner(result.scope)
  const state = await changeFrameworkState(result.scope, state => {
    const records = new Map(state.records.map(record => [record.id, record]))
    for (const record of result.records) {
      if ((records.get(record.id)?.version ?? 0) <= record.version) records.set(record.id, record)
    }
    state.records = [...records.values()]
  })
  await offlineDB.putDraft(bindingKey, { scope: result.scope, role: result.role })
  return { state, role: result.role }
}

export async function retryFramework(scope: FrameworkScope, id: string) {
  return changeFrameworkState(scope, state => {
    for (const op of state.pending.filter(op => op.frameworkId === id)) {
      if (op.failure === 'conflict') throw new Error('Version conflicts require an explicit resolution')
      op.attempts = 0; op.nextAttemptAt = 0; delete op.failure; delete op.error
    }
  })
}

export async function discardFailedFramework(scope: FrameworkScope, id: string) {
  return changeFrameworkState(scope, state => {
    const first = state.pending.find(op => op.frameworkId === id)
    if (!first?.failure || first.failure === 'conflict') throw new Error('Only failed non-conflict changes may be discarded here')
    state.pending = state.pending.filter(op => op.frameworkId !== id)
  })
}

export async function resolveFrameworkConflict(scope: FrameworkScope, id: string, choice: 'server' | 'local') {
  return changeFrameworkState(scope, state => {
    const pending = state.pending.filter(op => op.frameworkId === id)
    const first = pending[0]
    if (first?.failure !== 'conflict') throw new Error('No version conflict to resolve')
    const server = first.serverRecord
    if (choice === 'local' && (!server || server.deleted)) throw new Error('Server framework was deleted; accept deletion and create a new framework')
    state.records = state.records.filter(record => record.id !== id)
    if (server) state.records.push(server)
    if (choice === 'server') state.pending = state.pending.filter(op => op.frameworkId !== id)
    else {
      let version = server!.version
      for (const op of pending) {
        op.operationId = crypto.randomUUID()
        op.action = op.action === 'create' ? 'update' : op.action
        op.baseVersion = version++
        op.attempts = 0; op.nextAttemptAt = 0
        delete op.failure; delete op.error; delete op.serverRecord
      }
    }
  })
}
