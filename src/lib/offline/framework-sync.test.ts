import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { offlineDB } from './db.ts'
import { clearOfflineSession, setOfflineSession } from './session.ts'
import { applyFrameworkOperation, projectFrameworks, validateFrameworkData, validateFrameworkOperation, type FrameworkScope, type FrameworkState } from './framework-protocol.ts'
import { changeFrameworkState, discardFailedFramework, frameworkKey, readFrameworkState, resolveFrameworkConflict, saveFramework } from './framework-store.ts'
import { syncFrameworks } from './framework-sync.ts'

const scope: FrameworkScope = { userId: 'user-a', orgId: 12, workspaceId: 34 }
const owner = { userId: scope.userId, tenantId: 'legacy-a', email: 'a@example.org' }
const data = { name: 'Framework', description: 'Description', questions: [{ id: 'q1', text: 'Question', domain: 'Governance' }], evidenceRefs: [1] }
const drafts = new Map<string, unknown>()
const locks = new Map<string, Promise<unknown>>()
beforeEach(() => {
  drafts.clear(); locks.clear()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent() {}, localStorage: {}, sessionStorage: {} } })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true, locks: {
    request<T>(key: string, run: () => Promise<T>) {
      const result = (locks.get(key) ?? Promise.resolve()).then(run)
      locks.set(key, result.catch(() => {}))
      return result
    },
  } } })
  setOfflineSession(owner)
  offlineDB.isAvailable = () => true
  offlineDB.getDraft = async <T>(key: string) => structuredClone(drafts.get(key)) as T
  offlineDB.putDraft = async (key, value) => { drafts.set(key, structuredClone(value)) }
})
const id = () => crypto.randomUUID()
const state = () => readFrameworkState(scope)
const success = (operation: { operationId: string }, record: unknown) => Response.json({ scope, operationId: operation.operationId, record })

test('framework validation rejects invalid IDs, duplicate questions and foreign-shaped references', () => {
  assert.throws(() => validateFrameworkData({ ...data, evidenceRefs: ['1'] }))
  assert.throws(() => validateFrameworkData({ ...data, questions: [data.questions[0], data.questions[0]] }))
  assert.throws(() => validateFrameworkOperation({ frameworkId: id(), operationId: id(), action: 'update', baseVersion: 0, data }))
  assert.throws(() => validateFrameworkOperation({ frameworkId: '../elsewhere', operationId: id(), action: 'create', baseVersion: 0, data }))
})

test('create/update/delete survive reopening storage and replay once in strict version order', async () => {
  const frameworkId = id()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  await saveFramework(scope, 'create', frameworkId, data)
  await saveFramework(scope, 'update', frameworkId, { ...data, name: 'Updated' })
  await saveFramework(scope, 'delete', frameworkId)
  const reopened = await state()
  assert.equal(reopened.pending.length, 3)
  assert.deepEqual(reopened.pending.map(op => op.baseVersion), [0, 1, 2])
  assert.equal(projectFrameworks(reopened)[0].deleted, true)
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  let server: ReturnType<typeof applyFrameworkOperation> | undefined
  const calls: string[] = []
  await syncFrameworks(scope, async (_scope, op) => {
    calls.push(op.action)
    server = applyFrameworkOperation(server ?? undefined, op)!
    return success(op, server)
  })
  assert.deepEqual(calls, ['create', 'update', 'delete'])
  assert.equal((await state()).pending.length, 0)
  assert.equal((await state()).records[0].version, 3)
  assert.equal((await state()).records[0].deleted, true)
})

test('transient failure blocks dependent edits, preserves idempotency key and retries later', async () => {
  const a = id(), b = id()
  await saveFramework(scope, 'create', a, data)
  await saveFramework(scope, 'update', a, data)
  await saveFramework(scope, 'create', b, data)
  const original = (await state()).pending[0].operationId
  const calls: string[] = []
  await syncFrameworks(scope, async (_scope, op) => {
    calls.push(op.frameworkId)
    if (op.frameworkId === a) throw new Error('disconnected')
    return success(op, applyFrameworkOperation(undefined, op))
  })
  assert.deepEqual(calls, [a, b])
  assert.equal((await state()).pending[0].operationId, original)
  await changeFrameworkState(scope, state => { state.pending[0].nextAttemptAt = 0 })
  await syncFrameworks(scope, async (_scope, op) => success(op, applyFrameworkOperation(
    op.action === 'create' ? undefined : { id: a, version: 1, deleted: false, data }, op)))
  assert.equal((await state()).pending.length, 0)
})

test('version conflicts preserve local chain and explicit rebase creates new operation IDs', async () => {
  const frameworkId = id()
  await changeFrameworkState(scope, state => { state.records.push({ id: frameworkId, version: 1, deleted: false, data }) })
  await saveFramework(scope, 'update', frameworkId, { ...data, name: 'Local' })
  await saveFramework(scope, 'delete', frameworkId)
  const oldIds = (await state()).pending.map(op => op.operationId)
  const remote = { id: frameworkId, version: 4, deleted: false, data: { ...data, name: 'Remote' } }
  let calls = 0
  await syncFrameworks(scope, async () => { calls++; return Response.json({ scope, current: remote, error: 'Conflict' }, { status: 409 }) })
  assert.equal(calls, 1)
  assert.equal((await state()).pending[0].failure, 'conflict')
  await resolveFrameworkConflict(scope, frameworkId, 'local')
  const rebased = await state()
  assert.deepEqual(rebased.pending.map(op => op.baseVersion), [4, 5])
  assert.ok(rebased.pending.every(op => !oldIds.includes(op.operationId)))
})

test('permanent rejection remains blocked, logout and another user never replay saved changes', async () => {
  await saveFramework(scope, 'create', id(), data)
  await syncFrameworks(scope, async () => Response.json({ error: 'Invalid evidence' }, { status: 422 }))
  assert.equal((await state()).pending[0].failure, 'permanent')
  await clearOfflineSession()
  await assert.rejects(syncFrameworks(scope, async () => { throw new Error('must not reach network') }), /locked/)
  setOfflineSession({ ...owner, userId: 'other' })
  await assert.rejects(state(), /locked/)
  assert.equal((drafts.get(frameworkKey(scope)) as FrameworkState).pending.length, 1)
})

test('logout during confirmation preserves unacknowledged work', async () => {
  await saveFramework(scope, 'create', id(), data)
  await assert.rejects(syncFrameworks(scope, async (_scope, op) => {
    setOfflineSession(null)
    return success(op, applyFrameworkOperation(undefined, op))
  }), /locked/)
  setOfflineSession(owner)
  assert.equal((await state()).pending.length, 1)
})

test('two tabs use a shared sync lock and do not replay the same operation twice', async () => {
  await saveFramework(scope, 'create', id(), data)
  let calls = 0
  const send = async (_scope: FrameworkScope, op: (Awaited<ReturnType<typeof state>>)['pending'][number]) => {
    calls++; await new Promise(resolve => setTimeout(resolve, 5))
    return success(op, applyFrameworkOperation(undefined, op))
  }
  await Promise.all([syncFrameworks(scope, send), syncFrameworks(scope, send)])
  assert.equal(calls, 1)
})

test('incorrect response scope and version are never treated as confirmation', async () => {
  await saveFramework(scope, 'create', id(), data)
  await syncFrameworks(scope, async (_scope, op) => Response.json({ scope: { ...scope, orgId: 99 },
    operationId: op.operationId, record: applyFrameworkOperation(undefined, op) }))
  assert.equal((await state()).pending.length, 1)
})

test('accepting server deletion discards only that framework chain and preserves unrelated work', async () => {
  const a = id(), b = id()
  await changeFrameworkState(scope, state => { state.records.push({ id: a, version: 1, deleted: false, data }) })
  await saveFramework(scope, 'update', a, data)
  await saveFramework(scope, 'create', b, data)
  await syncFrameworks(scope, async (_scope, op) => op.frameworkId === a
    ? Response.json({ scope, current: { id: a, version: 2, deleted: true, data } }, { status: 409 })
    : Response.json({ error: 'Retry' }, { status: 503 }))
  await assert.rejects(resolveFrameworkConflict(scope, a, 'local'), /deleted/)
  await resolveFrameworkConflict(scope, a, 'server')
  assert.equal((await state()).pending.length, 1)
  assert.equal((await state()).pending[0].frameworkId, b)
  assert.equal(projectFrameworks(await state()).find(record => record.id === a)?.deleted, true)
})

test('same user frameworks are isolated by organization and workspace', async () => {
  await saveFramework(scope, 'create', id(), data)
  assert.equal((await readFrameworkState({ ...scope, orgId: 13 })).pending.length, 0)
  assert.equal((await readFrameworkState({ ...scope, workspaceId: 35 })).pending.length, 0)
})

test('retry exhaustion retains the operation rather than silently discarding work', async () => {
  await saveFramework(scope, 'create', id(), data)
  for (let i = 0; i < 6; i++) {
    await changeFrameworkState(scope, state => { state.pending[0].nextAttemptAt = 0 })
    await syncFrameworks(scope, async () => { throw new Error('Transient failure') })
  }
  assert.equal((await state()).pending.length, 1)
  assert.equal((await state()).pending[0].failure, 'retry')
  assert.equal((await state()).pending[0].attempts, 6)
})

test('stale open editors cannot overwrite updates accepted in another tab', async () => {
  const frameworkId = id()
  await saveFramework(scope, 'create', frameworkId, data)
  await saveFramework(scope, 'update', frameworkId, { ...data, name: 'Another tab' }, 1)
  await assert.rejects(saveFramework(scope, 'update', frameworkId, data, 1), /changed since/)
  assert.equal(projectFrameworks(await state())[0].data.name, 'Another tab')
})

test('explicit discard of permanent rejection unlocks corrections without erasing unrelated work', async () => {
  const frameworkId = id()
  await saveFramework(scope, 'create', frameworkId, data)
  await syncFrameworks(scope, async () => Response.json({ error: 'Missing evidence' }, { status: 422 }))
  await discardFailedFramework(scope, frameworkId)
  await saveFramework(scope, 'create', id(), { ...data, evidenceRefs: [] })
  assert.equal((await state()).pending.length, 1)
})
