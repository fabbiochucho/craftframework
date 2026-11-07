// Evidence-registry items a person may link to an engagement (validation review indicators or evidence
// requests): items of the workspace organisations where they are an assessor or above. Shared by
// /api/validation-reviews and /api/evidence-requests so both follow the same rule.
import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { evidenceRegistry, wsOrgMembers } from '../../db/schema.js'
import { fieldLookupHashes } from './crypto.js'
import { decodeEvidence } from './evidence-storage.js'

export async function evidenceOptions(email: string, superAdmin: boolean) {
  const hashes = fieldLookupHashes(email)
  const memberOf = hashes.length ? or(inArray(wsOrgMembers.userIdHash, hashes), eq(wsOrgMembers.userId, email))! : eq(wsOrgMembers.userId, email)
  const orgIds = superAdmin ? null : (await db.select({ orgId: wsOrgMembers.orgId }).from(wsOrgMembers)
    .where(and(memberOf, inArray(wsOrgMembers.role, ['owner', 'admin', 'assessor'])))).map((m) => m.orgId)
  if (orgIds && !orgIds.length) return []
  const items = await db.select().from(evidenceRegistry)
    .where(and(isNull(evidenceRegistry.archivedAt), ne(evidenceRegistry.status, 'rejected'), orgIds ? inArray(evidenceRegistry.orgId, orgIds) : undefined))
    .limit(500)
  return items.map((x) => ({ id: x.id, name: x.documentName, documentType: x.documentType, status: x.status, expiryDate: x.expiryDate, mimeType: x.mimeType, sizeKb: x.fileSizeKb }))
}

/** SHA-256 of the stored evidence file, or null when it cannot be read. Only the hash is kept. */
export async function evidenceSha256(filePath: string): Promise<string | null> {
  try {
    const data = await getStore('evidence').get(filePath, { type: 'arrayBuffer' })
    return data ? createHash('sha256').update(Buffer.from(decodeEvidence(data))).digest('hex') : null
  } catch { return null }
}
