import { useAuthCtx, useWorkspace } from './context'
import { usePersistedTenantState } from './legacy-state'

export function useLegacyAssessment<T>(key: string, initial: T | (() => T)) {
  const { currentUser, isDemo } = useAuthCtx()
  const { currentOrg, readOnly } = useWorkspace()
  return usePersistedTenantState(currentOrg?.id ?? currentUser?.orgId, isDemo, key, initial, readOnly)
}
