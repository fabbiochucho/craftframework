const FINANCE_FIELDS = ['openingBalance', 'incomeReceived', 'expenditures', 'adjustments', 'actualBankBalance', 'financeOfficerNotes']
const MANAGER_FIELDS = ['grantManagerCommentary']
const ASSESSOR_FIELDS = ['assessorNotes', 'verificationStatus']

export function financeMutationError(role: string, existing: Record<string, unknown> | null, body: Record<string, unknown>): string | null {
  const current = existing?.status ?? 'draft'
  const next = body.status ?? current
  if (current === 'locked' || existing?.lockedAt || existing?.lockedBy) return 'Locked submissions are immutable'
  const allowed = role === 'org_finance_officer' ? FINANCE_FIELDS
    : role === 'org_grant_manager' ? MANAGER_FIELDS
    : role === 'independent_assessor' ? ASSESSOR_FIELDS : null
  if (!allowed) return 'Finance workflow role required'
  if (!existing && role !== 'org_finance_officer') return 'Finance officer must create the submission'
  for (const field of ['donorId', 'grantId', 'reportTypeId', 'streamId', 'periodId']) {
    if (existing && body[field] !== undefined && body[field] !== existing[field]) return 'Reporting context is immutable'
  }
  for (const field of [...FINANCE_FIELDS, ...MANAGER_FIELDS, ...ASSESSOR_FIELDS]) {
    const fallback = field === 'verificationStatus' ? 'verified' : FINANCE_FIELDS.slice(0, 5).includes(field) ? 0 : ''
    if (body[field] !== undefined && body[field] !== (existing?.[field] ?? fallback) && !allowed.includes(field)) return `Cannot change ${field}`
  }
  if (role === 'org_finance_officer' && (current !== 'draft' || !['draft', 'pending_review'].includes(String(next)))) return 'Invalid finance officer transition'
  if (role === 'org_grant_manager' && (current !== 'pending_review' || !['pending_review', 'pending_assessor'].includes(String(next)))) return 'Invalid grant manager transition'
  if (role === 'independent_assessor' && (current !== 'pending_assessor' || !['pending_assessor', 'locked'].includes(String(next)))) return 'Invalid assessor transition'
  return null
}
