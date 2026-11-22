import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { fetchLegacyState, saveLegacyState } from './api'
import { useAuthCtx } from './context'

export type SaveStatus = 'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'signed-out' | 'demo' | 'read-only'

// Every change is kept on this device until the workspace confirms it, so an expired sign-in, a dropped connection or a
// closed tab never loses answers: the next load (same person, organisation and key) restores and saves them.
// ponytail: one browser only; another device starts from the workspace's copy.
const draftKeyOf = (userEmail: string | undefined, orgId: string, key: string) => `tenant-draft:${userEmail ?? ''}|${orgId}|${key}`
const readDraft = <T,>(k: string): { value: T } | null => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') } catch { return null } }
const writeDraft = (k: string, value: unknown) => { try { localStorage.setItem(k, JSON.stringify({ value, at: Date.now() })) } catch { /* storage full or blocked */ } }
const dropDraft = (k: string) => { try { localStorage.removeItem(k) } catch { /* nothing to drop */ } }
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
    void fetchLegacyState<T>(orgId, key, signal).then(saved => {
      if (generation.current !== gen || edited.current) return
      if (saved !== null) { current.current = saved; setValue(saved) }
      // Answers kept on this device that never reached the workspace come back, and are saved now.
      const draft = readOnly ? null : readDraft<T>(draftKey)
      if (!draft) { setStatus(readOnly ? 'read-only' : 'ready'); return }
      current.current = draft.value
      edited.current = true
      setValue(draft.value)
      setStatus('saving')
      saveLegacyState(orgId, key, draft.value, signal).then(
        () => { if (generation.current === gen) { if (current.current === draft.value) dropDraft(draftKey); setStatus('saved') } },
        (err) => { if (generation.current === gen) setStatus(failure(err)) },
      )
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
    writeDraft(draftKey, next)
    setStatus('saving')
    writes.current = writes.current.catch(() => {}).then(async () => {
      if (generation.current !== gen || activeScope.current !== scope || signal.aborted) return
      if (typeof window !== 'undefined' && !navigator.onLine) {
        if (generation.current === gen) setStatus('error')
        return
      }
      try {
        await saveLegacyState(orgId, key, next, signal)
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
