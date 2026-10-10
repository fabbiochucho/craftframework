export interface FrameworkScope {
  userId: string
  orgId: number
  workspaceId: number
}
export interface FrameworkData {
  name: string
  description: string
  questions: { id: string; text: string; domain: string }[]
  evidenceRefs: number[]
}
export interface FrameworkRecord {
  id: string
  version: number
  deleted: boolean
  data: FrameworkData
}
export interface FrameworkOperation {
  operationId: string
  frameworkId: string
  action: 'create' | 'update' | 'delete'
  baseVersion: number
  data?: FrameworkData
}
export interface FrameworkPending extends FrameworkOperation {
  attempts: number
  nextAttemptAt: number
  failure?: 'conflict' | 'permanent' | 'retry'
  error?: string
  serverRecord?: FrameworkRecord
}
export interface FrameworkState {
  scope: FrameworkScope
  records: FrameworkRecord[]
  pending: FrameworkPending[]
}
export const sameScope = (a: FrameworkScope, b: FrameworkScope) =>
  a.userId === b.userId && a.orgId === b.orgId && a.workspaceId === b.workspaceId
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateFrameworkData(value: unknown): FrameworkData {
  if (!value || typeof value !== 'object') throw new Error('Framework data required')
  const v = value as FrameworkData
  if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 200 ||
      typeof v.description !== 'string' || v.description.length > 10000 ||
      !Array.isArray(v.questions) || v.questions.length > 500 ||
      !Array.isArray(v.evidenceRefs) || v.evidenceRefs.length > 100) throw new Error('Invalid framework data')
  const ids = new Set<string>()
  for (const q of v.questions) {
    if (!q || typeof q.id !== 'string' || !q.id || q.id.length > 100 || ids.has(q.id) ||
        typeof q.text !== 'string' || !q.text.trim() || q.text.length > 4000 ||
        typeof q.domain !== 'string' || q.domain.length > 200) throw new Error('Invalid framework question')
    ids.add(q.id)
  }
  if (v.evidenceRefs.some(id => !Number.isSafeInteger(id) || id <= 0) ||
      new Set(v.evidenceRefs).size !== v.evidenceRefs.length) throw new Error('Invalid evidence references')
  return { name: v.name.trim(), description: v.description,
    questions: v.questions.map(q => ({ id: q.id, text: q.text, domain: q.domain })), evidenceRefs: [...v.evidenceRefs] }
}

export function validateFrameworkOperation(value: unknown): FrameworkOperation {
  if (!value || typeof value !== 'object') throw new Error('Mutation required')
  const v = value as FrameworkOperation
  if (!uuid.test(v.operationId) || !uuid.test(v.frameworkId) ||
      !['create', 'update', 'delete'].includes(v.action) ||
      !Number.isSafeInteger(v.baseVersion) || v.baseVersion < 0 ||
      (v.action === 'create' ? v.baseVersion !== 0 : v.baseVersion === 0)) throw new Error('Invalid framework mutation')
  return { operationId: v.operationId, frameworkId: v.frameworkId, action: v.action,
    baseVersion: v.baseVersion, ...(v.action === 'delete' ? {} : { data: validateFrameworkData(v.data) }) }
}

export function projectFrameworks(state: FrameworkState): FrameworkRecord[] {
  const records = new Map(state.records.map(record => [record.id, record]))
  for (const op of state.pending) {
    const old = records.get(op.frameworkId)
    records.set(op.frameworkId, { id: op.frameworkId, version: op.baseVersion + 1,
      deleted: op.action === 'delete', data: op.data ?? old?.data ?? { name: '', description: '', questions: [], evidenceRefs: [] } })
  }
  return [...records.values()]
}

export function applyFrameworkOperation(current: FrameworkRecord | undefined, op: FrameworkOperation): FrameworkRecord | null {
  if (op.action === 'create' ? Boolean(current) : !current || current.deleted || current.version !== op.baseVersion) return null
  return { id: op.frameworkId, version: op.baseVersion + 1, deleted: op.action === 'delete',
    data: op.data ?? current!.data }
}
