import { createHash } from 'node:crypto'
import { z } from 'zod'

const entry = z.object({
  legacyOrgId: z.string().min(1).max(200),
  sourceKey: z.string().min(1).max(1000),
  orgId: z.number().int().positive(),
  workspaceId: z.number().int().positive(),
  uploadedBy: z.string().email(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()

export const evidenceManifestSchema = z.object({
  version: z.literal(1),
  reviewedBy: z.string().email(),
  entries: z.array(entry).min(1).max(1000),
}).strict().superRefine((manifest, ctx) => {
  const seen = new Set<string>()
  for (const [index, row] of manifest.entries.entries()) {
    const source = `${legacyEvidenceStore(row.legacyOrgId)}\n${row.sourceKey}`
    if (seen.has(source)) ctx.addIssue({ code: 'custom', path: ['entries', index], message: 'Duplicate source evidence' })
    seen.add(source)
    if (!row.sourceKey.startsWith(`${legacyEvidenceSlug(row.legacyOrgId)}/`) || row.sourceKey.endsWith('.meta')) {
      ctx.addIssue({ code: 'custom', path: ['entries', index, 'sourceKey'], message: 'Key does not belong to the declared legacy tenant' })
    }
  }
})

export type EvidenceMigrationEntry = z.infer<typeof entry>

export function legacyEvidenceSlug(orgId: string): string {
  return orgId.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'evidence'
}

export function legacyEvidenceStore(orgId: string): string {
  return `data-room-${legacyEvidenceSlug(orgId)}`
}

export function consolidatedEvidenceKey(row: EvidenceMigrationEntry): string {
  const source = `${legacyEvidenceStore(row.legacyOrgId)}\n${row.sourceKey}`
  return `${row.orgId}/${row.workspaceId}/legacy-${createHash('sha256').update(source).digest('hex')}`
}
