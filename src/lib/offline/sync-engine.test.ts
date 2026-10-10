import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import { offlineDB, type QueuedMutation, type QueuedFile } from './db.ts'
import { SyncEngine } from './sync-engine.ts'
import { clearOfflineSession, setOfflineSession, ownsRecord } from './session.ts'

const owner = { userId: 'verified-user', email: 'user@example.org', tenantId: 'org-a' }
let mutations: QueuedMutation[] = []
let files: QueuedFile[] = []
let calls: string[] = []
let status = 200

beforeEach(() => {
  mutations = []
  files = []
  calls = []
  status = 200
  setOfflineSession(owner)
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { origin: 'https://craft.example' }, dispatchEvent() {}, addEventListener() {}, removeEventListener() {},
    localStorage: {}, sessionStorage: {},
  } })
  offlineDB.isAvailable = () => true
  offlineDB.getMutations = async () => mutations.filter(ownsRecord)
  offlineDB.getFiles = async () => files.filter(ownsRecord)
  offlineDB.countMutations = async () => mutations.length
  offlineDB.countFiles = async () => files.length
  offlineDB.updateMutation = async record => { mutations = mutations.map(old => old.id === record.id ? record : old) }
  offlineDB.updateFile = async record => { files = files.map(old => old.id === record.id ? record : old) }
  offlineDB.deleteMutation = async id => { mutations = mutations.filter(record => record.id !== id) }
  offlineDB.deleteFile = async id => { files = files.filter(record => record.id !== id) }
  globalThis.fetch = async input => {
    calls.push(String(input))
    const responseStatus = String(input).endsWith('/api/bad') ? status : 200
    return new Response(JSON.stringify({ uploadUrl: 'https://storage.example/file', key: 'key' }), { status: responseStatus })
  }
})

function mutation(id: number, endpoint = '/api/good'): QueuedMutation {
  return { id, owner, kind: 'assessment', endpoint, method: 'POST', body: { orgId: owner.tenantId }, createdAt: id, attempts: 0 }
}

const engine = () => new SyncEngine(async () => new AbortController().signal)

test('permanent rejection retains record, continues queue, and explicit retry recovers', async () => {
  status = 422
  mutations = [mutation(1, '/api/bad'), mutation(2)]
  const sync = engine()
  await sync.sync()
  assert.equal(mutations.length, 1)
  assert.equal(mutations[0].failed, true)
  assert.equal(mutations[0].attempts, 1)
  assert.equal(sync.getState().failed, 1)
  const count = calls.length
  await sync.sync()
  assert.equal(calls.length, count)
  status = 200
  await sync.retryFailed()
  assert.equal(mutations.length, 0)
})

test('retry exhaustion keeps pending record and does not wedge later records or files', async () => {
  status = 503
  mutations = [{ ...mutation(1, '/api/bad'), attempts: 5 }, mutation(2)]
  files = [{ id: 3, owner, fileName: 'evidence.pdf', contentType: 'application/pdf', blob: new Blob(['evidence']), createdAt: 1, attempts: 0 }]
  await engine().sync()
  assert.equal(mutations.length, 1)
  assert.equal(mutations[0].attempts, 6)
  assert.equal(mutations[0].failed, true)
  assert.equal(files.length, 0)
})

test('unowned legacy and different-user records are never replayed or deleted', async () => {
  mutations = [{ ...mutation(1), owner: undefined }, { ...mutation(2), owner: { ...owner, userId: 'someone-else' } }]
  const sync = engine()
  await sync.sync()
  assert.deepEqual(calls, [])
  assert.equal(mutations.length, 2)
  assert.equal(sync.getState().blocked, 2)
  assert.equal(sync.getState().lastSyncedAt, null)
})

test('public/logout session cannot replay and preserves unsynced records', async () => {
  mutations = [mutation(1)]
  await clearOfflineSession()
  await engine().sync()
  assert.deepEqual(calls, [])
  assert.equal(mutations.length, 1)
})

test('cross-tenant payload and external mutation endpoints never reach fetch', async () => {
  mutations = [{ ...mutation(1), body: { orgId: 'org-b' } }, mutation(2, 'https://attacker.example/api/data')]
  await engine().sync()
  assert.deepEqual(calls, [])
  assert.equal(mutations.length, 2)
})

test('failed file uploads are retained while other files drain', async () => {
  status = 403
  const base = { owner, fileName: 'evidence.pdf', contentType: 'application/pdf', blob: new Blob(['evidence']), createdAt: 1, attempts: 0 }
  files = [{ ...base, id: 1, presignEndpoint: '/api/bad' }, { ...base, id: 2 }]
  await engine().sync()
  assert.equal(files.length, 1)
  assert.equal(files[0].failed, true)
})

test('logout during response preserves in-flight record for original user', async () => {
  mutations = [mutation(1)]
  globalThis.fetch = async () => { setOfflineSession(null); return new Response('{}') }
  await engine().sync()
  assert.equal(mutations.length, 1)
})
