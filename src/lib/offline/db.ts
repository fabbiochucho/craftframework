// ============================================================================
// CRAFT v4.0 — Local-first database (IndexedDB via `idb`)
// ----------------------------------------------------------------------------
// This is the on-device buffer that lets field assessors, supply-chain auditors
// and informal-economy users keep working with no connectivity. It is a
// TEMPORARY, security-sensitive cache — never a permanent store (see the
// 15-minute auto-wipe in hooks/use-offline-security.ts and the Sovereignty
// Shield rules in AGENTS/results).
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

export const DB_NAME = 'craft-offline'
export const DB_VERSION = 1

export const STORE_MUTATIONS = 'mutations' as const
export const STORE_DRAFTS = 'drafts' as const
export const STORE_FILES = 'files' as const

// A single queued write, expressed as a replayable request against the app's
// own /api/* layer (which persists to the Netlify Database) or any absolute URL.
// Keeping mutations transport-shaped means the sync engine can replay anything
// the online code path would have sent, without knowing the domain.
export interface QueuedMutation {
  id?: number
  // Human label for logging / the sync UI, e.g. "assessment:score" or
  // "financial-triangulation".
  kind: string
  endpoint: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  // De-dupe key: a newer mutation with the same dedupeKey supersedes older ones
  // still in the queue (e.g. repeated edits to the same score/field), so we sync
  // the final value rather than replaying every keystroke.
  dedupeKey?: string
  createdAt: number
  attempts: number
  lastError?: string
}

export interface DraftRecord {
  key: string
  value: unknown
  updatedAt: number
}

// A file awaiting upload. The blob is stored verbatim; on sync the engine calls
// the presigned-URL function, PUTs the bytes, then records document metadata.
export interface QueuedFile {
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
      },
    })
  }
  return dbPromise
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
    const db = await getDB()
    const record: QueuedMutation = {
      kind: input.kind,
      endpoint: input.endpoint,
      method: input.method,
      body: input.body,
      dedupeKey: input.dedupeKey,
      createdAt: input.createdAt ?? Date.now(),
      attempts: 0,
    }
    // Collapse superseded edits: drop any pending mutation sharing this dedupeKey
    // before enqueuing the newer value, so only the latest state is synced.
    if (record.dedupeKey) {
      const tx = db.transaction(STORE_MUTATIONS, 'readwrite')
      const idx = tx.store.index('by-dedupe')
      let cursor = await idx.openCursor(IDBKeyRange.only(record.dedupeKey))
      while (cursor) {
        await cursor.delete()
        cursor = await cursor.continue()
      }
      const id = await tx.store.add(record)
      await tx.done
      return id as number
    }
    return (await db.add(STORE_MUTATIONS, record)) as number
  },

  async getMutations(): Promise<QueuedMutation[]> {
    if (!hasIndexedDB()) return []
    const db = await getDB()
    return db.getAllFromIndex(STORE_MUTATIONS, 'by-created')
  },

  async deleteMutation(id: number): Promise<void> {
    if (!hasIndexedDB()) return
    const db = await getDB()
    await db.delete(STORE_MUTATIONS, id)
  },

  async updateMutation(record: QueuedMutation): Promise<void> {
    if (!hasIndexedDB() || record.id == null) return
    const db = await getDB()
    await db.put(STORE_MUTATIONS, record)
  },

  async countMutations(): Promise<number> {
    if (!hasIndexedDB()) return 0
    const db = await getDB()
    return db.count(STORE_MUTATIONS)
  },

  // --- Drafts (instant UI state) -------------------------------------------
  async putDraft(key: string, value: unknown): Promise<void> {
    if (!hasIndexedDB()) return
    const db = await getDB()
    await db.put(STORE_DRAFTS, { key, value, updatedAt: Date.now() })
  },

  async getDraft<T = unknown>(key: string): Promise<T | undefined> {
    if (!hasIndexedDB()) return undefined
    const db = await getDB()
    const rec = await db.get(STORE_DRAFTS, key)
    return rec?.value as T | undefined
  },

  async deleteDraft(key: string): Promise<void> {
    if (!hasIndexedDB()) return
    const db = await getDB()
    await db.delete(STORE_DRAFTS, key)
  },

  // --- File upload queue ----------------------------------------------------
  async addFile(
    input: Omit<QueuedFile, 'id' | 'createdAt' | 'attempts'> & { createdAt?: number },
  ): Promise<number | null> {
    if (!hasIndexedDB()) return null
    const db = await getDB()
    const record: QueuedFile = {
      ...input,
      createdAt: input.createdAt ?? Date.now(),
      attempts: 0,
    }
    return (await db.add(STORE_FILES, record)) as number
  },

  async getFiles(): Promise<QueuedFile[]> {
    if (!hasIndexedDB()) return []
    const db = await getDB()
    return db.getAllFromIndex(STORE_FILES, 'by-created')
  },

  async deleteFile(id: number): Promise<void> {
    if (!hasIndexedDB()) return
    const db = await getDB()
    await db.delete(STORE_FILES, id)
  },

  async updateFile(record: QueuedFile): Promise<void> {
    if (!hasIndexedDB() || record.id == null) return
    const db = await getDB()
    await db.put(STORE_FILES, record)
  },

  async countFiles(): Promise<number> {
    if (!hasIndexedDB()) return 0
    const db = await getDB()
    return db.count(STORE_FILES)
  },

  // --- Sovereignty Shield: full local wipe ---------------------------------
  // Called by the auto-wipe hook on inactivity and on sign-out. Purges every
  // store so no fiduciary/regulatory data lingers on the device.
  async clearAll(): Promise<void> {
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
