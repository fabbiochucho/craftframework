import { getUser } from '@netlify/identity'
import { createHash } from 'node:crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { offlineFrameworks, offlineFrameworkReceipts } from '../../db/offline-schema.js'
import { evidenceRegistry, wsAuditLog } from '../../db/schema.js'
import { decryptField, encryptField } from './crypto.js'
import { HttpError } from './orgAccess.js'
import type { Caller } from './auth.js'
import { applyFrameworkOperation, validateFrameworkOperation, type FrameworkRecord } from '../../src/lib/offline/framework-protocol.js'

function expose(row: typeof offlineFrameworks.$inferSelect): FrameworkRecord {
  return { id: row.id, version: row.version, deleted: row.deleted === 1, data: JSON.parse(decryptField(row.payload)) }
}
async function scopeFor(caller: Caller, orgId: number, workspaceId: number) {
  const user = await getUser()
  if (!user?.id || user.email?.trim().toLowerCase() !== caller.email) throw new HttpError(401, 'Session changed')
  return { userId: user.id, orgId, workspaceId }
}
// Mounted only behind workspace-api's membership/role/expiry checks.
export async function listOfflineFrameworks(caller: Caller, orgId: number, workspaceId: number, role: string) {
  const scope = await scopeFor(caller, orgId, workspaceId)
  const rows = await db.select().from(offlineFrameworks).where(and(eq(offlineFrameworks.orgId, orgId), eq(offlineFrameworks.workspaceId, workspaceId)))
  return Response.json({ scope, role, records: rows.map(expose) }, { headers: { 'Cache-Control': 'no-store' } })
}
export async function mutateOfflineFramework(caller: Caller, orgId: number, workspaceId: number, body: unknown) {
  if (caller.readOnly) throw new HttpError(403, 'Read-only session')
  const scope = await scopeFor(caller, orgId, workspaceId)
  const input = body as { scope?: typeof scope; operation?: unknown } | null
  if (!input?.scope || input.scope.userId !== scope.userId || input.scope.orgId !== orgId || input.scope.workspaceId !== workspaceId)
    throw new HttpError(403, 'Saved mutation belongs to a different user, organization or workspace')
  let op
  try { op = validateFrameworkOperation(input.operation) } catch (error) { throw new HttpError(400, (error as Error).message) }
  const fingerprint = createHash('sha256').update(JSON.stringify(op)).digest('hex')
  const outcome = await db.transaction(async tx => {
    // Serialize all edits/receipts in this workspace, including creates with no row to lock.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`offline-frameworks:${orgId}:${workspaceId}`}, 0))`)
    const receiptWhere = and(eq(offlineFrameworkReceipts.orgId, orgId), eq(offlineFrameworkReceipts.workspaceId, workspaceId),
      eq(offlineFrameworkReceipts.userId, scope.userId), eq(offlineFrameworkReceipts.operationId, op.operationId))
    const [receipt] = await tx.select().from(offlineFrameworkReceipts).where(receiptWhere)
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) throw new HttpError(409, 'Idempotency key was reused with different content')
      return { status: 200, body: JSON.parse(decryptField(receipt.response)) }
    }
    const where = and(eq(offlineFrameworks.orgId, orgId), eq(offlineFrameworks.workspaceId, workspaceId), eq(offlineFrameworks.id, op.frameworkId))
    const [row] = await tx.select().from(offlineFrameworks).where(where)
    const current = row ? expose(row) : undefined
    const record = applyFrameworkOperation(current, op)
    if (!record) return { status: 409, body: { scope, error: 'Framework changed on the server. Resolve the conflict before replaying later edits.', current: current ?? null } }
    if (record.data.evidenceRefs.length && !record.deleted) {
      const evidence = await tx.select({ id: evidenceRegistry.id }).from(evidenceRegistry).where(and(
        eq(evidenceRegistry.orgId, orgId), eq(evidenceRegistry.workspaceId, workspaceId),
        inArray(evidenceRegistry.id, record.data.evidenceRefs), sql`${evidenceRegistry.archivedAt} IS NULL`))
      if (evidence.length !== record.data.evidenceRefs.length) throw new HttpError(422, 'Evidence reference is missing, archived or belongs to another workspace')
    }
    const values = { orgId, workspaceId, id: record.id, version: record.version, deleted: record.deleted ? 1 : 0,
      payload: encryptField(JSON.stringify(record.data)), updatedAt: new Date() }
    if (row) await tx.update(offlineFrameworks).set(values).where(where)
    else await tx.insert(offlineFrameworks).values(values)
    const response = { scope, operationId: op.operationId, record }
    await tx.insert(offlineFrameworkReceipts).values({ orgId, workspaceId, userId: scope.userId,
      operationId: op.operationId, fingerprint, response: encryptField(JSON.stringify(response)) })
    await tx.insert(wsAuditLog).values({ orgId, workspaceId, actorId: caller.email, resourceType: 'custom_framework',
      resourceId: record.id, action: op.action, details: { operationId: op.operationId, version: record.version } })
    return { status: 200, body: response }
  })
  return Response.json(outcome.body, { status: outcome.status, headers: { 'Cache-Control': 'no-store' } })
}
