import { db } from '../../db/index.js'
import { assessmentRevisions } from '../../db/schema.js'
import { encryptField } from './crypto.js'

export type ArchiveSource = 'capacity' | 'review' | 'workspace' | 'independent' | 'legacy' | 'scores' | 'funder'

export async function archiveAssessment(
  tx: Pick<typeof db, 'insert'>,
  record: { source: ArchiveSource; orgId: string; assessmentId: string; recordKey: string; period?: string | null; actor: string; snapshot: unknown; savedAt?: Date },
) {
  const savedAt = record.savedAt ?? new Date()
  await tx.insert(assessmentRevisions).values({ ...record, savedAt, snapshot: encryptField(JSON.stringify(record.snapshot)) })
  return savedAt.toISOString()
}
