// Test-only in-memory replacement for @netlify/blobs.
const stores = (globalThis.__craftTestBlobs ??= new Map())

export function getStore(name) {
  if (!stores.has(name)) stores.set(name, new Map())
  const store = stores.get(name)
  return {
    async set(key, value, options) {
      const bytes = value instanceof Uint8Array ? Buffer.from(value) : Buffer.from(value)
      store.set(key, { bytes, metadata: options?.metadata })
    },
    async get(key, options) {
      const entry = store.get(key)
      if (!entry) return null
      if (options?.type === 'arrayBuffer') {
        return entry.bytes.buffer.slice(entry.bytes.byteOffset, entry.bytes.byteOffset + entry.bytes.byteLength)
      }
      return entry.bytes.toString('utf8')
    },
    async delete(key) {
      store.delete(key)
    },
  }
}
