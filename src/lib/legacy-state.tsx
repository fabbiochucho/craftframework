import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { fetchLegacyState, saveLegacyState } from './api'
import { useAuthCtx } from './context'
import { readDraft as vaultRead, removeDraft, writeDraft as vaultWrite } from './draftVault'

export type SaveStatus = 'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'signed-out' | 'demo' | 'read-only'

// Every change is kept on this device until the workspace confirms it, so an expired sign-in, a dropped connection or a
// closed tab never loses answers: the next load (same person, organisation and key) restores and saves them.
// ponytail: one browser only; another device starts from the workspace's copy.
// Drafts are encrypted at rest (draftVault) and record the saved value they were edited from: when the workspace has
// changed since (saved on another device), the workspace's copy wins and the draft is dropped.
const draftKeyOf = (userEmail: string | undefined, orgId: string, key: string) => `tenant-draft:${userEmail ?? ''}|${orgId}|${key}`
const readDraft = async <T,>(email: string, k: string): Promise<{ value: T; base?: T | null } | null> => { try { return await vaultRead(email, k) } catch { return null } }
const writeDraft = (email: string, k: string, value: unknown, base: unknown) => { void vaultWrite(email, k, { value, base, at: Date.now() }).catch(() => { /* storage full or blocked */ }) }
const dropDraft = (k: string) => { void removeDraft(k) }
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const failure = (err: unknown): SaveStatus => (String((err as Error)?.message ?? '').startsWith('401') ? 'signed-out' : 'error')

export function usePersistedTenantState<T>(
  orgId: string | undefined, demo: boolean, key: string, initial: T | (() => T), readOnly = false,
): [T, Dispatch<SetStateAction<T>>, SaveStatus] {
  const { currentUser } = useAuthCtx()
  return useTenantState(currentUser?.email, orgId, demo, key, initial, readOnly)
}

export function useTenantState<T>(
  userEmail: string | undefined, orgId: string | undefined, demo: boolean, key: string,
  initial: T | (() => T), readOnly = false,
): [T, Dispatch<SetStateAction<T>>, SaveStatus] {
  const initialRef = useRef(initial)
  initialRef.current = initial
  const fresh = useCallback(() => typeof initialRef.current === 'function'
    ? (initialRef.current as () => T)() : initialRef.current, [])
  const [value, setValue] = useState<T>(fresh)
  const [status, setStatus] = useState<SaveStatus>('loading')
  const statusRef = useRef(status)
  statusRef.current = status
  const current = useRef(value)
  const generation = useRef(0)
  const edited = useRef(false)
  const serverValue = useRef<T | null>(null)
  const writes = useRef(Promise.resolve())
  const scope = `${userEmail ?? ''}|${orgId ?? ''}|${demo}|${key}|${readOnly}`
  const activeScope = useRef(scope)
  activeScope.current = scope
  const controller = useRef(new AbortController())
  const loadedScope = useRef(scope)
  useEffect(() => {
    controller.current.abort()
    controller.current = new AbortController()
    const signal = controller.current.signal
    loadedScope.current = scope
    const gen = ++generation.current
    edited.current = false
    current.current = fresh()
    setValue(current.current)
    setStatus(demo ? 'demo' : readOnly ? 'read-only' : 'loading')
    if (!orgId || demo) return
    const draftKey = draftKeyOf(userEmail, orgId, key)
    void fetchLegacyState<T>(orgId, key, signal).then(async saved => {
      if (generation.current !== gen || edited.current) return
      serverValue.current = saved
      if (saved !== null) { current.current = saved; setValue(saved) }
      // Answers kept on this device that never reached the workspace come back, and are saved now.
      const draft = readOnly || !userEmail ? null : await readDraft<T>(userEmail, draftKey)
      if (generation.current !== gen || edited.current) return
      if (draft && 'base' in draft && !same(draft.base, saved)) dropDraft(draftKey)
      if (!draft || ('base' in draft && !same(draft.base, saved))) { setStatus(readOnly ? 'read-only' : 'ready'); return }
      current.current = draft.value
      edited.current = true
      setValue(draft.value)
      setStatus('saving')
      writes.current = writes.current.then(async () => {
        if (generation.current !== gen || activeScope.current !== scope || signal.aborted) return
        try {
          await saveLegacyState(orgId, key, draft.value, signal)
          serverValue.current = draft.value
          if (generation.current === gen && current.current === draft.value) { dropDraft(draftKey); setStatus('saved') }
        } catch (err) {
          if (generation.current === gen) setStatus(failure(err))
        }
      })
    }).catch((err) => { if (generation.current === gen) setStatus(failure(err)) })
    const lock = () => { ++generation.current; controller.current.abort(); setStatus('error') }
    const storageLock = (event: StorageEvent) => { if (event.key === 'craft_session_lock') lock() }
    window.addEventListener('craft:clear-sensitive', lock)
    window.addEventListener('storage', storageLock)
    return () => {
      lock()
      window.removeEventListener('craft:clear-sensitive', lock)
      window.removeEventListener('storage', storageLock)
    }
  }, [orgId, demo, key, readOnly, fresh, scope])

  const update: Dispatch<SetStateAction<T>> = useCallback(action => {
    if (readOnly || loadedScope.current !== scope || (!demo && (!orgId || controller.current.signal.aborted))) return
    // Never replace unknown server state after a failed/incomplete initial read.
    if (!demo && !edited.current && statusRef.current !== 'ready' && statusRef.current !== 'saved') return
    const next = typeof action === 'function' ? (action as (prev: T) => T)(current.current) : action
    current.current = next
    edited.current = true
    setValue(next)
    if (demo || !orgId) return
    const gen = generation.current
    const signal = controller.current.signal
    const draftKey = draftKeyOf(userEmail, orgId, key)
    if (userEmail) writeDraft(userEmail, draftKey, next, serverValue.current)
    setStatus('saving')
    writes.current = writes.current.catch(() => {}).then(async () => {
      if (generation.current !== gen || activeScope.current !== scope || signal.aborted) return
      if (typeof window !== 'undefined' && !navigator.onLine) {
        if (generation.current === gen) setStatus('error')
        return
      }
      try {
        await saveLegacyState(orgId, key, next, signal)
        serverValue.current = next
        if (current.current === next) dropDraft(draftKey)
        if (generation.current === gen && current.current === next) setStatus('saved')
      } catch (err) {
        if (generation.current === gen) setStatus(failure(err))
      }
    })
  }, [orgId, demo, key, readOnly, scope, userEmail])
  return loadedScope.current === scope ? [value, update, status] : [fresh(), update, 'loading']
}

// Several saved settings load on one page; show ONE line for all of them, the one that matters most.
const STATUS_RANK: SaveStatus[] = ['signed-out', 'error', 'loading', 'saving', 'saved', 'demo', 'read-only', 'ready']
export const combinedStatus = (statuses: SaveStatus[]): SaveStatus =>
  STATUS_RANK.find((s) => statuses.includes(s)) ?? 'ready'

export function LegacySaveStatus({ status: given }: { status: SaveStatus | SaveStatus[] }) {
  const status = Array.isArray(given) ? combinedStatus(given) : given
  const label = {
    loading: 'Loading saved assessment — editing will be available when loaded.',
    ready: 'Assessment loaded. Changes save to your workspace.',
    saving: 'Saving to workspace…',
    saved: 'Saved to workspace.',
    error: 'Could not save to the workspace just now. Your answers are kept on this computer and will be saved when you come back to this page.',
    'signed-out': 'Your sign-in has expired, so this was not saved. Your answers are kept on this computer: sign in again and open this page, and they will be saved.',
    demo: 'Illustrative demo — changes are not saved.',
    'read-only': 'Client workspace — read-only.',
  }[status]
  return <p role="status" className={status === 'error' || status === 'signed-out' ? 'text-sm text-rose-700' : 'text-xs text-slate-500'}>{label}</p>
}
