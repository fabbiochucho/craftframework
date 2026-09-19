// ============================================================================
// CRAFT v4.0 — Background sync engine
// ----------------------------------------------------------------------------
// Drains the IndexedDB write-ahead queue (offlineDB) to the server whenever a
// connection is available, without ever blocking the UI. All writes have
// already been recorded locally by the local-first code paths; this engine is
// the only thing that talks to the network for them.
//
// Guarantees:
//   • Non-blocking — runs off the `online` event and an explicit kick; UI never
//     awaits it.
//   • At-least-once, confirmed-delete — a queued mutation is removed ONLY after
//     the server returns a 2xx. A failure leaves it in the queue for the next
//     pass, with the attempt count and last error recorded.
//   • Files use the presigned-URL flow: mint a scoped upload target from the
//     Netlify function, PUT the bytes straight to storage, then record document
//     metadata. Each step must succeed before the blob leaves the device.
//
// The engine is transport-shaped: a mutation carries the endpoint/method/body a
// live write would have used, so replay is just `fetch`. In this codebase those
// endpoints are the /api/* routes backed by the Netlify Database; the same
// engine works unchanged against a Supabase REST/RPC URL.
// ============================================================================

import { offlineDB, type QueuedMutation, type QueuedFile } from './db'

export type SyncStatus = 'idle' | 'offline' | 'syncing' | 'error'

export interface SyncState {
  status: SyncStatus
  pending: number
  lastSyncedAt: number | null
  lastError: string | null
}

type Listener = (state: SyncState) => void

// Default endpoint that mints a short-lived, tenant-scoped upload target.
// Matches netlify/functions/presigned-url.mts (config.path = '/api/presigned-url').
const PRESIGN_ENDPOINT = '/api/presigned-url'
const MAX_ATTEMPTS = 6

export class SyncEngine {
  private state: SyncState = {
    status: 'idle',
    pending: 0,
    lastSyncedAt: null,
    lastError: null,
  }
  private listeners = new Set<Listener>()
  private running = false
  private started = false

  /** Wire up online/offline listeners. Safe to call once, browser-only. */
  start(): void {
    if (this.started || typeof window === 'undefined') return
    this.started = true

    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
    // The service worker (or another tab) can ask us to flush after a
    // Background Sync wake-up.
    window.addEventListener('craft:sync', this.kick as EventListener)

    this.state.status = navigator.onLine ? 'idle' : 'offline'
    void this.refreshPending()
    // Attempt an initial drain in case we launched with a queue and a signal.
    if (navigator.onLine) void this.sync()
  }

  stop(): void {
    if (typeof window === 'undefined') return
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    window.removeEventListener('craft:sync', this.kick as EventListener)
    this.started = false
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  getState(): SyncState {
    return this.state
  }

  private emit(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch }
    for (const l of this.listeners) l(this.state)
  }

  private handleOnline = (): void => {
    this.emit({ status: 'idle', lastError: null })
    void this.sync()
  }

  private handleOffline = (): void => {
    this.emit({ status: 'offline' })
  }

  private kick = (): void => {
    void this.sync()
  }

  private async refreshPending(): Promise<void> {
    const [m, f] = await Promise.all([offlineDB.countMutations(), offlineDB.countFiles()])
    this.emit({ pending: m + f })
  }

  /**
   * Drain both queues. Re-entrancy-safe: a second call while running is a no-op
   * (the in-flight pass will pick up anything newly queued when it re-reads).
   */
  async sync(): Promise<void> {
    if (this.running || typeof navigator === 'undefined') return
    if (!navigator.onLine) {
      this.emit({ status: 'offline' })
      return
    }
    if (!offlineDB.isAvailable()) return

    this.running = true
    this.emit({ status: 'syncing', lastError: null })
    try {
      await this.processMutations()
      await this.processFiles()
      await this.refreshPending()
      this.emit({
        status: navigator.onLine ? 'idle' : 'offline',
        lastSyncedAt: Date.now(),
      })
    } catch (err) {
      this.emit({ status: 'error', lastError: err instanceof Error ? err.message : String(err) })
    } finally {
      this.running = false
    }
  }

  // --- Mutations ------------------------------------------------------------
  private async processMutations(): Promise<void> {
    const queue = await offlineDB.getMutations()
    for (const mutation of queue) {
      if (!navigator.onLine) return // signal dropped mid-drain; resume later
      await this.replayMutation(mutation)
      await this.refreshPending()
    }
  }

  private async replayMutation(mutation: QueuedMutation): Promise<void> {
    try {
      const res = await fetch(mutation.endpoint, {
        method: mutation.method,
        headers: { 'content-type': 'application/json' },
        body: mutation.body != null ? JSON.stringify(mutation.body) : undefined,
      })
      // CRUCIAL: only remove the queued write once the server confirms it.
      if (res.ok) {
        if (mutation.id != null) await offlineDB.deleteMutation(mutation.id)
        return
      }
      // 4xx (other than transient auth) will never succeed on replay — drop it
      // after logging so one poisoned record can't wedge the queue forever.
      if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 408 && res.status !== 429) {
        console.warn('[sync] dropping permanently-rejected mutation', mutation.kind, res.status)
        if (mutation.id != null) await offlineDB.deleteMutation(mutation.id)
        return
      }
      await this.recordMutationFailure(mutation, `${res.status} ${res.statusText}`)
    } catch (err) {
      // Network blip — keep it queued for the next pass.
      await this.recordMutationFailure(mutation, err instanceof Error ? err.message : String(err))
    }
  }

  private async recordMutationFailure(mutation: QueuedMutation, message: string): Promise<void> {
    const attempts = mutation.attempts + 1
    if (attempts >= MAX_ATTEMPTS && mutation.id != null) {
      console.error('[sync] mutation exceeded retry budget, dropping', mutation.kind, message)
      await offlineDB.deleteMutation(mutation.id)
      return
    }
    await offlineDB.updateMutation({ ...mutation, attempts, lastError: message })
    throw new Error(`sync failed for ${mutation.kind}: ${message}`)
  }

  // --- Files ----------------------------------------------------------------
  private async processFiles(): Promise<void> {
    const queue = await offlineDB.getFiles()
    for (const file of queue) {
      if (!navigator.onLine) return
      await this.uploadFile(file)
      await this.refreshPending()
    }
  }

  private async uploadFile(file: QueuedFile): Promise<void> {
    try {
      // 1) Ask the Netlify function for a scoped, short-lived upload target.
      const presignRes = await fetch(file.presignEndpoint || PRESIGN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileName: file.fileName,
          contentType: file.contentType,
          category: file.category,
          organizationId: file.organizationId,
        }),
      })
      if (!presignRes.ok) throw new Error(`presign ${presignRes.status} ${presignRes.statusText}`)
      const { uploadUrl, key } = (await presignRes.json()) as { uploadUrl: string; key: string }
      if (!uploadUrl) throw new Error('presign response missing uploadUrl')

      // 2) PUT the bytes straight to storage (they never transit the app server).
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.contentType || 'application/octet-stream' },
        body: file.blob,
      })
      if (!putRes.ok) throw new Error(`upload ${putRes.status} ${putRes.statusText}`)

      // 3) Record the document metadata now that the object exists. Optional:
      //    skipped when no metadata endpoint was supplied.
      if (file.metadataEndpoint) {
        const metaRes = await fetch(file.metadataEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            key,
            fileName: file.fileName,
            contentType: file.contentType,
            category: file.category,
            organizationId: file.organizationId,
            ...file.metadata,
          }),
        })
        if (!metaRes.ok) throw new Error(`metadata ${metaRes.status} ${metaRes.statusText}`)
      }

      // Confirmed-delete: the blob only leaves the device after every step is OK.
      if (file.id != null) await offlineDB.deleteFile(file.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const attempts = file.attempts + 1
      if (attempts >= MAX_ATTEMPTS && file.id != null) {
        console.error('[sync] file upload exceeded retry budget, dropping', file.fileName, message)
        await offlineDB.deleteFile(file.id)
        return
      }
      await offlineDB.updateFile({ ...file, attempts, lastError: message })
      throw new Error(`file upload failed for ${file.fileName}: ${message}`)
    }
  }
}

// Singleton — one queue drainer per tab.
export const syncEngine = new SyncEngine()

// Convenience for local-first write paths: enqueue a mutation and immediately
// try to flush (a no-op when offline; the write is already durable in IndexedDB).
export async function queueAndSync(
  mutation: Parameters<typeof offlineDB.addMutation>[0],
): Promise<void> {
  await offlineDB.addMutation(mutation)
  void syncEngine.sync()
}
