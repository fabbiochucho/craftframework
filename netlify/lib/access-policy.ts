export const SPECIALIZED_READONLY_ROLES = new Set([
  'cbn_examiner', 'frcn_auditor', 'sec_analyst', 'sharia_board_member',
  'rating_agency_analyst', 'eu_csd_assessor',
])

export function grantAllows(
  grant: { status: string; level: string; role: string | null; expiresAt: Date | null },
  access: 'read' | 'write',
  now = new Date(),
): boolean {
  if (grant.status !== 'active') return false
  if (grant.expiresAt && grant.expiresAt.getTime() <= now.getTime()) return false
  if (grant.role && SPECIALIZED_READONLY_ROLES.has(grant.role) && !grant.expiresAt) return false
  return access === 'read' || (grant.level === 'write' && !SPECIALIZED_READONLY_ROLES.has(grant.role ?? ''))
}
