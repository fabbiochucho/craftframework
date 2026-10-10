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
import { authenticatedSignal, getOfflineSession, ownsRecord } from './session'

export type SyncStatus = 'idle' | 'offline' | 'syncing' | 'error'

export interface SyncState {
  status: SyncStatus
  pending: number
  failed: number
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
    failed: 0,
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
    window.addEventListener('craft:session', this.kick)

    this.state.status = navigator.onLine ? 'idle' : 'offline'
    void this.refreshPending().catch(() => this.emit({ status: 'error', lastError: 'Saved changes could not be read; they have been preserved.' }))
    // Attempt an initial drain in case we launched with a queue and a signal.
    if (navigator.onLine) void this.sync()
  }

  stop(): void {
    if (typeof window === 'undefined') return
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    window.removeEventListener('craft:sync', this.kick as EventListener)
    window.removeEventListener('craft:session', this.kick)
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
    const [m, f] = await Promise.all([offlineDB.getMutations(), offlineDB.getFiles()])
    this.emit({ pending: m.length + f.length, failed: [...m, ...f].filter(record => record.failed).length })
  }

  async retryFailed(): Promise<void> {
    if (this.running || !getOfflineSession()) return
    const [mutations, files] = await Promise.all([offlineDB.getMutations(), offlineDB.getFiles()])
    await Promise.all([
      ...mutations.filter(record => record.failed).map(record => offlineDB.updateMutation({ ...record, failed: false, attempts: 0, lastError: undefined })),
      ...files.filter(record => record.failed).map(record => offlineDB.updateFile({ ...record, failed: false, attempts: 0, lastError: undefined })),
    ])
    await this.sync()
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
    if (!getOfflineSession()) {
      this.emit({ status: 'idle', pending: 0, failed: 0, lastError: null, lastSyncedAt: null })
      return
    }

    this.running = true
    this.emit({ status: 'syncing', lastError: null })
    try {
      await this.processMutations()
      await this.processFiles()
      await this.refreshPending()
      this.emit({
        status: !navigator.onLine ? 'offline' : this.state.pending ? 'error' : 'idle',
        lastSyncedAt: this.state.pending ? this.state.lastSyncedAt : Date.now(),
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
      if (!navigator.onLine || !getOfflineSession()) return
      if (!ownsRecord(mutation) || mutation.failed) continue
      await this.replayMutation(mutation)
      await this.refreshPending()
    }
  }

  private async replayMutation(mutation: QueuedMutation): Promise<void> {
    try {
      const signal = await authenticatedSignal()
      if (!ownsRecord(mutation)) return
      const res = await fetch(safeEndpoint(mutation.endpoint), {
        signal,
        credentials: 'same-origin',
        cache: 'no-store',
        method: mutation.method,
        headers: { 'content-type': 'application/json' },
        body: mutation.body != null ? JSON.stringify(mutation.body) : undefined,
      })
      // CRUCIAL: only remove the queued write once the server confirms it.
      if (res.ok && !signal.aborted && ownsRecord(mutation)) {
        if (mutation.id != null) await offlineDB.deleteMutation(mutation.id)
        return
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 408 && res.status !== 429) {
        await this.recordMutationFailure(mutation, `Server rejected saved change (${res.status}). Review and retry.`, true)
        return
      }
      await this.recordMutationFailure(mutation, `${res.status} ${res.statusText}`)
    } catch (err) {
      // Network blip — keep it queued for the next pass.
      if (ownsRecord(mutation)) await this.recordMutationFailure(mutation, err instanceof Error ? err.message : String(err))
    }
  }

  private async recordMutationFailure(mutation: QueuedMutation, message: string, permanent = false): Promise<void> {
    const attempts = mutation.attempts + 1
    await offlineDB.updateMutation({ ...mutation, attempts, failed: permanent || attempts >= MAX_ATTEMPTS, lastError: message })
    this.emit({ lastError: message })
  }

  // --- Files ----------------------------------------------------------------
  private async processFiles(): Promise<void> {
    const queue = await offlineDB.getFiles()
    for (const file of queue) {
      if (!navigator.onLine || !getOfflineSession()) return
      if (!ownsRecord(file) || file.failed) continue
      await this.uploadFile(file)
      await this.refreshPending()
    }
  }

  private async uploadFile(file: QueuedFile): Promise<void> {
    try {
      const signal = await authenticatedSignal()
      if (!ownsRecord(file)) return
      // 1) Ask the Netlify function for a scoped, short-lived upload target.
      const presignRes = await fetch(safeEndpoint(file.presignEndpoint || PRESIGN_ENDPOINT), {
        signal,
        credentials: 'same-origin',
        cache: 'no-store',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileName: file.fileName,
          contentType: file.contentType,
          category: file.category,
          organizationId: file.organizationId,
        }),
      })
      if (!presignRes.ok) throw new HTTPFailure(presignRes.status)
      const { uploadUrl, key } = (await presignRes.json()) as { uploadUrl: string; key: string }
      if (!uploadUrl || new URL(uploadUrl).protocol !== 'https:') throw new Error('Invalid secure upload target')
      if (signal.aborted || !ownsRecord(file)) return

      // 2) PUT the bytes straight to storage (they never transit the app server).
      const putRes = await fetch(uploadUrl, {
        signal,
        credentials: 'omit',
        method: 'PUT',
        headers: { 'content-type': file.contentType || 'application/octet-stream' },
        body: file.blob,
      })
      if (!putRes.ok) throw new HTTPFailure(putRes.status)

      // 3) Record the document metadata now that the object exists. Optional:
      //    skipped when no metadata endpoint was supplied.
      if (file.metadataEndpoint) {
        await authenticatedSignal()
        if (signal.aborted || !ownsRecord(file)) return
        const metaRes = await fetch(safeEndpoint(file.metadataEndpoint), {
          signal,
          credentials: 'same-origin',
          cache: 'no-store',
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...file.metadata,
            key,
            fileName: file.fileName,
            contentType: file.contentType,
            category: file.category,
            organizationId: file.organizationId,
          }),
        })
        if (!metaRes.ok) throw new HTTPFailure(metaRes.status)
      }

      // Confirmed-delete: the blob only leaves the device after every step is OK.
      if (file.id != null && !signal.aborted && ownsRecord(file)) await offlineDB.deleteFile(file.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const attempts = file.attempts + 1
      if (!ownsRecord(file)) return
      await offlineDB.updateFile({ ...file, attempts, failed: attempts >= MAX_ATTEMPTS || (err instanceof HTTPFailure && err.permanent), lastError: message })
      this.emit({ lastError: message })
    }

    function safeEndpoint(endpoint: string): string {
      const url = new URL(endpoint, window.location.origin)
      if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
        throw new Error('Saved requests may only sync to this workspace API.')
      }
      return url.href
    }

    class HTTPFailure extends Error {
      permanent: boolean
      constructor(status: number) {
        super(`Upload rejected (${status}). Saved file retained.`)
        this.permanent = status >= 400 && status < 500 && ![401, 408, 429].includes(status)
      }
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
