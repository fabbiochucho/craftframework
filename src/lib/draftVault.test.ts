// Self-check for draftVault: encrypted at rest, readable only with the owner's key, legacy plaintext upgraded.
import assert from 'node:assert/strict'

const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m } }
const local = store()
const session = store()
Object.assign(globalThis, { localStorage: local, sessionStorage: session })
let fetches = 0
globalThis.fetch = (async () => {
  fetches++
  const key = Buffer.alloc(32, fetches === 1 ? 1 : 2).toString('base64')
  return new Response(JSON.stringify({ key }))
}) as typeof fetch

const { writeDraft, readDraft, removeDraft, DraftUnreadable } = await import('./draftVault.ts')

await writeDraft('a@x.org', 'd1', { answer: 'secret evidence' })
assert.ok(local.getItem('d1')!.startsWith('dv1:'))
assert.ok(!local.getItem('d1')!.includes('secret'), 'stored encrypted')
assert.deepEqual(await readDraft('a@x.org', 'd1'), { answer: 'secret evidence' })
assert.equal(fetches, 1, 'key fetched once and reused')

// Someone else on the same browser (a different key) cannot read it, and it is left in place.
session.m.clear()
await assert.rejects(readDraft('b@x.org', 'd1'), DraftUnreadable)
assert.ok(local.getItem('d1'))

// A draft written before encryption is returned and stored again encrypted.
local.setItem('old', JSON.stringify({ n: 1 }))
assert.deepEqual(await readDraft('b@x.org', 'old'), { n: 1 })
assert.ok(local.getItem('old')!.startsWith('dv1:'))

// Writes and removals keep their order.
void writeDraft('b@x.org', 'd2', 1)
await removeDraft('d2')
assert.equal(local.getItem('d2'), null)
console.log('draftVault ok')
