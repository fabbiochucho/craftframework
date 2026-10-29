import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { and, eq, like, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { offlineFrameworks } from '../../db/offline-schema.js'
import { documentApprovals, evidenceLinks, evidenceRegistry, users, wsAuditLog } from '../../db/schema.js'
import { canAccessOrg, effectiveRole, type Caller } from '../lib/auth.js'
import { requireWorkspaceAccess } from '../lib/orgAccess.js'
import { consolidatedEvidenceKey, evidenceManifestSchema, legacyEvidenceStore } from '../lib/evidence-consolidation.ts'
import { decodeEvidence, encodeEvidence } from '../lib/evidence-storage.ts'
import { decryptField } from '../lib/crypto.js'
import { ALLOWED_EVIDENCE_MIME, MAX_EVIDENCE_BYTES } from '../lib/workspace.js'

async function directoryCaller(email: string): Promise<Caller> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user || user.status !== 'active') throw new Error('Migration identities must be active directory users')
  return { email: user.email, name: user.name, orgId: user.orgId ?? '', role: effectiveRole(user.email, user.role) }
}

export async function consolidateEvidence(input: unknown, mode: '--dry-run' | '--apply' | '--rollback' = '--dry-run') {
if (!['--dry-run', '--apply', '--rollback'].includes(mode)) throw new Error('Invalid migration mode')
if (!process.env.FIELD_ENCRYPTION_KEY) throw new Error('FIELD_ENCRYPTION_KEY is required')
const manifest = evidenceManifestSchema.parse(input)
const reviewer = await directoryCaller(manifest.reviewedBy)
for (const entry of manifest.entries) {
  if (!await canAccessOrg(reviewer, entry.legacyOrgId, 'write')) throw new Error('Reviewer lacks legacy tenant access')
  const { workspace, orgId } = await requireWorkspaceAccess(reviewer, entry.workspaceId, 'admin')
  if (orgId !== entry.orgId || workspace.status !== 'active') throw new Error('Workspace ownership/status mismatch')
  const uploader = await directoryCaller(entry.uploadedBy)
  if (!await canAccessOrg(uploader, entry.legacyOrgId, 'read')) throw new Error('Uploader lacks legacy tenant access')
  if ((await requireWorkspaceAccess(uploader, entry.workspaceId, 'viewer')).orgId !== entry.orgId) {
    throw new Error('Uploader workspace ownership mismatch')
  }
  const key = consolidatedEvidenceKey(entry)
  const sourceDigest = key.split('/').at(-1)!
  const source = getStore({ name: legacyEvidenceStore(entry.legacyOrgId), consistency: 'strong' })
  const meta = await source.get(`${entry.sourceKey}.meta`, { type: 'json' }) as Record<string, unknown> | null
  if (!meta || meta.organizationId !== entry.legacyOrgId || meta.status !== 'uploaded') {
    throw new Error('Source is not an uploaded object owned by the declared legacy tenant')
  }
  const stored = await source.get(entry.sourceKey, { type: 'arrayBuffer' })
  if (!stored) throw new Error('Source file is missing')
  const bytes = decodeEvidence(stored)
  if (createHash('sha256').update(Buffer.from(bytes)).digest('hex') !== entry.sha256) throw new Error('Source checksum mismatch')
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_EVIDENCE_BYTES ||
    typeof meta.contentType !== 'string' || !ALLOWED_EVIDENCE_MIME.includes(meta.contentType)) {
    throw new Error('Source exceeds canonical evidence limits; retain for separate review')
  }
  if (typeof meta.fileName !== 'string' || !meta.fileName || typeof meta.uploadedAt !== 'string' ||
    !Number.isFinite(Date.parse(meta.uploadedAt))) throw new Error('Source metadata is incomplete')

  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${sourceDigest}, 0))`)
    const matches = await tx.select().from(evidenceRegistry).where(like(evidenceRegistry.filePath, `%/${sourceDigest}`))
    if (matches.length > 1 || matches.some(row => row.filePath !== key || row.orgId !== entry.orgId || row.workspaceId !== entry.workspaceId)) {
      throw new Error('Source already mapped to a different workspace; manual reconciliation required')
    }
    const existing = matches[0]
    if (existing) {
      const [receipt] = await tx.select().from(wsAuditLog).where(and(
        eq(wsAuditLog.orgId, entry.orgId), eq(wsAuditLog.resourceType, 'evidence'),
        eq(wsAuditLog.resourceId, String(existing.id)), eq(wsAuditLog.action, 'create'),
      )).limit(1)
      const details = receipt?.details as { consolidation?: string; sha256?: string } | undefined
      if (details?.consolidation !== sourceDigest || details.sha256 !== entry.sha256 || existing.uploadedBy !== entry.uploadedBy) {
        throw new Error('Existing evidence lacks matching migration provenance')
      }
      if (mode === '--rollback' && !existing.archivedAt) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`offline-frameworks:${entry.orgId}:${entry.workspaceId}`}, 0))`)
        const [links, approvals] = await Promise.all([
          tx.select({ id: evidenceLinks.id }).from(evidenceLinks).where(eq(evidenceLinks.evidenceId, existing.id)).limit(1),
          tx.select({ id: documentApprovals.id }).from(documentApprovals).where(eq(documentApprovals.evidenceId, existing.id)).limit(1),
        ])
        const frameworks = await tx.select({ payload: offlineFrameworks.payload }).from(offlineFrameworks).where(and(
          eq(offlineFrameworks.orgId, entry.orgId), eq(offlineFrameworks.workspaceId, entry.workspaceId),
          eq(offlineFrameworks.deleted, 0),
        ))
        const referenced = frameworks.some(row => {
          const data = JSON.parse(decryptField(row.payload)) as { evidenceRefs?: unknown }
          if (!Array.isArray(data.evidenceRefs)) throw new Error('Framework evidence references need manual reconciliation')
          return data.evidenceRefs.includes(existing.id)
        })
        if (links.length || approvals.length || referenced || existing.status !== 'pending_review') {
          throw new Error('Rollback blocked: evidence has downstream links or review; reconcile manually')
        }
        await tx.update(evidenceRegistry).set({ archivedAt: new Date() }).where(eq(evidenceRegistry.id, existing.id))
        await tx.insert(wsAuditLog).values({
          orgId: entry.orgId, workspaceId: entry.workspaceId, actorId: reviewer.email,
          resourceType: 'evidence', resourceId: String(existing.id), action: 'delete',
          details: { consolidation: sourceDigest, rollback: 'soft_archive' },
        })
      }
      console.log(JSON.stringify({ mode, workspaceId: entry.workspaceId, evidenceId: existing.id, result: existing.archivedAt ? 'retained_archived' : mode === '--rollback' ? 'archived' : 'already_present' }))
      return
    }
    if (mode !== '--apply') {
      console.log(JSON.stringify({ mode, workspaceId: entry.workspaceId, result: mode === '--rollback' ? 'not_present' : 'would_import' }))
      return
    }
    const destination = getStore({ name: 'evidence', consistency: 'strong' })
    const priorBytes = await destination.get(key, { type: 'arrayBuffer' })
    if (priorBytes && createHash('sha256').update(Buffer.from(decodeEvidence(priorBytes))).digest('hex') !== entry.sha256) {
      throw new Error('Destination key contains different bytes')
    }
    // Blob writes cannot join the SQL transaction. A failed insert leaves a
    // deterministic orphan that a retry can reconcile without deleting sources.
    await destination.set(key, encodeEvidence(bytes), { metadata: { mimeType: meta.contentType as string } })
    const [created] = await tx.insert(evidenceRegistry).values({
      orgId: entry.orgId, workspaceId: entry.workspaceId, filePath: key,
      documentName: (meta.fileName as string).slice(0, 255), uploadedBy: uploader.email,
      uploadedAt: new Date(meta.uploadedAt as string), mimeType: meta.contentType as string,
      fileSizeKb: Math.ceil(bytes.byteLength / 1024), status: 'pending_review',
    }).returning()
    await tx.insert(wsAuditLog).values({
      orgId: entry.orgId, workspaceId: entry.workspaceId, actorId: reviewer.email,
      resourceType: 'evidence', resourceId: String(created.id), action: 'create',
      details: { consolidation: sourceDigest, sha256: entry.sha256 },
    })
    console.log(JSON.stringify({ mode, workspaceId: entry.workspaceId, evidenceId: created.id, result: 'imported_pending_review' }))
  })
}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const mode = args.find(arg => ['--dry-run', '--apply', '--rollback'].includes(arg)) ?? '--dry-run'
  const manifestPath = args.find(arg => !arg.startsWith('--'))
  if (!manifestPath || args.filter(arg => !arg.startsWith('--')).length !== 1 ||
    args.some(arg => arg.startsWith('--') && !['--dry-run', '--apply', '--rollback'].includes(arg)) ||
    args.filter(arg => arg.startsWith('--')).length > 1) {
    throw new Error('Usage: node netlify/scripts/consolidate-evidence.mts <reviewed-manifest.json> [--dry-run|--apply|--rollback]')
  }
  await consolidateEvidence(JSON.parse(readFileSync(manifestPath, 'utf8')), mode as '--dry-run' | '--apply' | '--rollback')
}
