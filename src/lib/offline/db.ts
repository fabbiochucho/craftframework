// ============================================================================
// CRAFT v4.0 — Local-first database (IndexedDB via `idb`)
// ----------------------------------------------------------------------------
// This is the on-device buffer that lets field assessors, supply-chain auditors
// and informal-economy users keep working with no connectivity. It is a
// Security-sensitive buffer: sign-out locks rather than erases pending work.
//
// Three object stores:
//   • mutations — the durable write-ahead queue. Every state change (assessment
//                 score, triangulation update, metadata edit) is recorded here
//                 as a replayable API request and only removed once the server
//                 confirms it (see sync-engine.ts).
//   • drafts    — instant UI state, keyed by a caller-chosen string. Written on
//                 every keystroke so forms are zero-latency and survive reloads.
//   • files     — binary blobs queued for upload once a signal returns. Uploaded
//                 via the presigned-URL flow, then removed.
//
// SSR-safe: IndexedDB only exists in the browser, so the connection is opened
// lazily and every read/write no-ops (or returns an empty result) on the server.
// ============================================================================

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { getOfflineSession, ownsRecord, type OfflineOwner } from './session.ts'

export const DB_NAME = 'craft-offline'
export const DB_VERSION = 2

export const STORE_MUTATIONS = 'mutations' as const
export const STORE_DRAFTS = 'drafts' as const
export const STORE_FILES = 'files' as const

// A single queued write, expressed as a replayable request against the app's
// own /api/* layer (which persists to the Netlify Database).
// Keeping mutations transport-shaped means the sync engine can replay anything
// the online code path would have sent, without knowing the domain.
export interface QueuedMutation {
  owner?: OfflineOwner
  failed?: boolean
  id?: number
  // Human label for logging / the sync UI, e.g. "assessment:score" or
  // "financial-triangulation".
  kind: string
  endpoint: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  // Logical grouping only; every accepted edit is retained until confirmed.
  dedupeKey?: string
  createdAt: number
  attempts: number
  lastError?: string
}

export interface DraftRecord {
  owner?: OfflineOwner
  key: string
  value: unknown
  updatedAt: number
}

// A file awaiting upload. The blob is encrypted; on sync the engine calls
// the presigned-URL function, PUTs the bytes, then records document metadata.
export interface QueuedFile {
  owner?: OfflineOwner
  failed?: boolean
  id?: number
  fileName: string
  contentType: string
  category?: string
  organizationId?: string
  // Endpoint that mints the upload target (defaults to the CRAFT presigned-url fn).
  presignEndpoint?: string
  // Optional endpoint to record document metadata after a successful upload.
  metadataEndpoint?: string
  // Extra fields merged into the metadata write (e.g. questionId, contextKey).
  metadata?: Record<string, unknown>
  blob: Blob
  createdAt: number
  attempts: number
  lastError?: string
}

interface CraftDB extends DBSchema {
  keys: { key: string; value: CryptoKey }
  mutations: {
    key: number
    value: QueuedMutation
    indexes: { 'by-dedupe': string; 'by-created': number }
  }
  drafts: {
    key: string
    value: DraftRecord
  }
  files: {
    key: number
    value: QueuedFile
    indexes: { 'by-created': number }
  }
}

let dbPromise: Promise<IDBPDatabase<CraftDB>> | null = null

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined'
}

function getDB(): Promise<IDBPDatabase<CraftDB>> {
  if (!hasIndexedDB()) {
    return Promise.reject(new Error('IndexedDB unavailable (server or unsupported browser)'))
  }
  if (!dbPromise) {
    dbPromise = openDB<CraftDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
          const store = db.createObjectStore(STORE_MUTATIONS, { keyPath: 'id', autoIncrement: true })
          store.createIndex('by-dedupe', 'dedupeKey')
          store.createIndex('by-created', 'createdAt')
        }
        if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
          db.createObjectStore(STORE_DRAFTS, { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          const store = db.createObjectStore(STORE_FILES, { keyPath: 'id', autoIncrement: true })
          store.createIndex('by-created', 'createdAt')
        }
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys')
      },
    })
  }

  return dbPromise
}

  type Envelope = {
    encrypted: true
    iv: Uint8Array<ArrayBuffer>
    ciphertext: ArrayBuffer
    blobIv?: Uint8Array<ArrayBuffer>
    blobCiphertext?: ArrayBuffer
    owner?: OfflineOwner
    id?: number
    key?: string
    createdAt?: number
    dedupeKey?: string
  }

  async function encryptionKey(db: IDBPDatabase<CraftDB>): Promise<CryptoKey> {
    const existing = await db.get('keys', 'device')
    if (existing) return existing
    if (!globalThis.crypto?.subtle) throw new Error('Secure browser storage is unavailable; pending data was not removed.')
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    const tx = db.transaction('keys', 'readwrite')
    const raced = await tx.store.get('device')
    if (!raced) await tx.store.put(key, 'device')
    await tx.done
    return raced ?? key
  }

  async function seal<T extends QueuedMutation | QueuedFile | DraftRecord>(db: IDBPDatabase<CraftDB>, record: T): Promise<T> {
    const key = await encryptionKey(db)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const payload = { ...record } as Record<string, unknown>
    let blobIv: Uint8Array<ArrayBuffer> | undefined
    let blobCiphertext: ArrayBuffer | undefined
    if ('blob' in record) {
      blobIv = crypto.getRandomValues(new Uint8Array(12))
      blobCiphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: blobIv }, key, await record.blob.arrayBuffer())
      delete payload.blob
      payload.blobType = record.blob.type
    }
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload)))
    return { encrypted: true, iv, ciphertext, blobIv, blobCiphertext, owner: record.owner, ...('id' in record ? { id: record.id } : {}),
      ...('key' in record ? { key: record.key } : {}),
      ...('createdAt' in record ? { createdAt: record.createdAt } : {}),
      ...('dedupeKey' in record ? { dedupeKey: record.dedupeKey } : {}) } as unknown as T
  }

  async function unseal<T>(db: IDBPDatabase<CraftDB>, stored: T): Promise<T> {
    const envelope = stored as unknown as Envelope
    if (!envelope.encrypted) return stored // Existing pending plaintext records remain recoverable.
    const key = await db.get('keys', 'device')
    if (!key) throw new Error('Offline encryption key is missing. Saved records have been preserved.')
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.iv }, key, envelope.ciphertext)
    const record = JSON.parse(new TextDecoder().decode(plaintext))
    if (!ownsRecord(record)) throw new Error('Saved record belongs to another session; it has been retained.')
    if (envelope.blobIv && envelope.blobCiphertext) {
      const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.blobIv }, key, envelope.blobCiphertext)
      record.blob = new Blob([bytes], { type: record.blobType })
    }
    if (envelope.id != null) record.id = envelope.id
    return record as T
  }

async function readOwned<T extends QueuedMutation | QueuedFile>(db: IDBPDatabase<CraftDB>, records: T[]): Promise<T[]> {
  const result: T[] = []
  for (const stored of records.filter(ownsRecord)) {
    try { result.push(await unseal(db, stored)) } catch {
      // A damaged/missing-key record stays untouched; it must not block others.
    }
  }
  return result
}
// ---------------------------------------------------------------------------
// Public API — a small, framework-agnostic facade used by hooks, the sync
// engine and the local-first UI paths.
// ---------------------------------------------------------------------------
export const offlineDB = {
  /** True when the local buffer can be used (browser with IndexedDB). */
  isAvailable: hasIndexedDB,

  // --- Mutations queue ------------------------------------------------------
  async addMutation(
    input: Omit<QueuedMutation, 'id' | 'createdAt' | 'attempts'> & { createdAt?: number },
  ): Promise<number | null> {
    if (!hasIndexedDB()) return null
    const owner = getOfflineSession() ?? undefined
    const db = await getDB()
    const record: QueuedMutation = {
      owner,
      kind: input.kind,
      endpoint: input.endpoint,
      method: input.method,
      body: input.body,
      dedupeKey: input.dedupeKey,
      createdAt: input.createdAt ?? Date.now(),
      attempts: 0,
    }
    // Never replace an in-flight or legacy record: each accepted write is durable.
    return (await db.add(STORE_MUTATIONS, await seal(db, record))) as number
  },

  async getMutations(): Promise<QueuedMutation[]> {
    if (!hasIndexedDB()) return []
    const db = await getDB()
    const records = await db.getAllFromIndex(STORE_MUTATIONS, 'by-created')
    return readOwned(db, records)
  },

  async deleteMutation(id: number): Promise<void> {
    if (!hasIndexedDB()) return
    const db = await getDB()
    await db.delete(STORE_MUTATIONS, id)
  },

  async updateMutation(record: QueuedMutation): Promise<void> {
    if (!hasIndexedDB() || record.id == null) return
    const db = await getDB()
    await db.put(STORE_MUTATIONS, await seal(db, record))
  },

  async countMutations(): Promise<number> {
    if (!hasIndexedDB()) return 0
    const db = await getDB()
    return db.count(STORE_MUTATIONS)
  },

  // --- Drafts (instant UI state) -------------------------------------------
  async putDraft(key: string, value: unknown): Promise<void> {
    if (!hasIndexedDB()) return
    const owner = getOfflineSession()
    if (!owner) throw new Error('Saved changes are locked')
    const db = await getDB()
    const scopedKey = JSON.stringify([owner.userId, owner.tenantId, key])
    const sealed = await seal(db, { key: scopedKey, value, updatedAt: Date.now(), owner })
    if (!ownsRecord({ owner })) throw new Error('Session changed before the draft was saved')
    await db.put(STORE_DRAFTS, sealed)
  },

  async getDraft<T = unknown>(key: string): Promise<T | undefined> {
    if (!hasIndexedDB()) return undefined
    const db = await getDB()
    const owner = getOfflineSession()
    if (!owner) return undefined
    const rec = await db.get(STORE_DRAFTS, JSON.stringify([owner.userId, owner.tenantId, key]))
    return rec && ownsRecord(rec) ? (await unseal(db, rec)).value as T : undefined
  },

  async deleteDraft(key: string): Promise<void> {
    if (!hasIndexedDB()) return
    const db = await getDB()
    const owner = getOfflineSession()
    if (owner) await db.delete(STORE_DRAFTS, JSON.stringify([owner.userId, owner.tenantId, key]))
  },

  // --- File upload queue ----------------------------------------------------
  async addFile(
    input: Omit<QueuedFile, 'id' | 'createdAt' | 'attempts'> & { createdAt?: number },
  ): Promise<number | null> {
    if (!hasIndexedDB()) return null
    const owner = getOfflineSession() ?? undefined
    const db = await getDB()
    const record: QueuedFile = {
      ...input,
      owner,
      createdAt: input.createdAt ?? Date.now(),
      attempts: 0,
    }
    return (await db.add(STORE_FILES, await seal(db, record))) as number
  },

  async getFiles(): Promise<QueuedFile[]> {
    if (!hasIndexedDB()) return []
    const db = await getDB()
    const records = await db.getAllFromIndex(STORE_FILES, 'by-created')
    return readOwned(db, records)
  },

  async deleteFile(id: number): Promise<void> {
    if (!hasIndexedDB()) return
    const db = await getDB()
    await db.delete(STORE_FILES, id)
  },

  async updateFile(record: QueuedFile): Promise<void> {
    if (!hasIndexedDB() || record.id == null) return
    const db = await getDB()
    await db.put(STORE_FILES, await seal(db, record))
  },

  async countFiles(): Promise<number> {
    if (!hasIndexedDB()) return 0
    const db = await getDB()
    return db.count(STORE_FILES)
  },

  async clearDrafts(): Promise<void> {
    if (!hasIndexedDB()) return
    const db = await getDB()
    await db.clear(STORE_DRAFTS)
  },

  // Destruction of pending writes requires explicit caller/user confirmation.
  async clearAll(options?: { discardPending: true }): Promise<void> {
    if (!options?.discardPending) throw new Error('Explicit confirmation is required to discard pending changes.')
    if (!hasIndexedDB()) return
    const db = await getDB()
    const tx = db.transaction([STORE_MUTATIONS, STORE_DRAFTS, STORE_FILES], 'readwrite')
    await Promise.all([
      tx.objectStore(STORE_MUTATIONS).clear(),
      tx.objectStore(STORE_DRAFTS).clear(),
      tx.objectStore(STORE_FILES).clear(),
    ])
    await tx.done
  },
}

export type OfflineDB = typeof offlineDB
