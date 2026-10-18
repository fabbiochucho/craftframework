// The organisation's answers that decide which index questions apply (public body, E&S screening).
// One hook so index pages, the Capacity Improvement Plan and reports all read the same saved profile.
import { useEffect, useState } from 'react'
import { useAuthCtx, useWorkspace } from './context'
import { fetchLegacyState } from './api'
import { useTenantState } from './legacy-state'
import type { ModuleProfile } from './foundationModules'
import type { EsScreeningAnswers } from './indices/safeguards'

export type StoredModuleProfile = ModuleProfile & { esAnswers?: EsScreeningAnswers }

export function useModuleProfile() {
  const { currentUser } = useAuthCtx()
  const { currentOrg, readOnly } = useWorkspace()
  const orgId = currentOrg?.id ?? currentUser?.orgId ?? ''
  return useTenantState<StoredModuleProfile>(currentUser?.email, orgId, !!currentUser?.isDemo, 'modules:profile', {}, readOnly)
}

/**
 * Saved profiles for several organisations (the portfolio Wallboard): one request per organisation.
 * `complete` is false while loading or if any request failed, so callers can fall back to core-only counts.
 */
export function useModuleProfiles(orgIds: string[], demo: boolean) {
  const { values, complete } = useOrgStates<StoredModuleProfile>(orgIds, 'modules:profile', demo)
  return { profiles: values as Record<string, ModuleProfile>, complete }
}

/**
 * One saved state key for several organisations (the portfolio Wallboard): one request per organisation.
 * `complete` is false while loading or if any request failed, so callers can fall back to core-only counts.
 */
export function useOrgStates<T extends object>(orgIds: string[], stateKey: string, demo: boolean) {
  const key = orgIds.join(',')
  const [state, setState] = useState<{ key: string; values: Record<string, T>; failed: boolean }>({ key: '', values: {}, failed: false })
  useEffect(() => {
    if (demo || !key) return
    const ids = key.split(',')
    const controller = new AbortController()
    void Promise.allSettled(ids.map((id) => fetchLegacyState<T>(id, stateKey, controller.signal))).then((rs) => {
      if (controller.signal.aborted) return
      setState({
        key,
        values: Object.fromEntries(rs.map((r, i) => [ids[i], r.status === 'fulfilled' ? r.value ?? ({} as T) : ({} as T)])),
        failed: rs.some((r) => r.status === 'rejected'),
      })
    })
    return () => controller.abort()
  }, [key, stateKey, demo])
  return { values: state.values, complete: demo || (state.key === key && !state.failed) }
}
