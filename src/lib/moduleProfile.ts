// The organisation's answers that decide which index questions apply (public body, E&S screening).
// One hook so index pages, the Capacity Improvement Plan and reports all read the same saved profile.
import { useAuthCtx, useWorkspace } from './context'
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
