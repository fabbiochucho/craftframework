import { and, desc, eq, gte } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { assessmentRevisions } from '../../db/schema.js'
import { encryptField } from './crypto.js'

export type ArchiveSource = 'capacity' | 'review' | 'workspace' | 'independent' | 'legacy' | 'scores' | 'funder'

// Autosave writes every few seconds. Saves of the same record by the same person within one clock-aligned window
// update that window's revision instead of adding one, so history keeps at most six revisions per record per hour.
const WINDOW_MS = 10 * 60_000

export async function archiveAssessment(
  tx: Pick<typeof db, 'insert' | 'select' | 'update'>,
  record: { source: ArchiveSource; orgId: string; assessmentId: string; recordKey: string; period?: string | null; actor: string; snapshot: unknown; savedAt?: Date },
) {
  const savedAt = record.savedAt ?? new Date()
  const snapshot = encryptField(JSON.stringify(record.snapshot))
  const windowStart = new Date(Math.floor(savedAt.getTime() / WINDOW_MS) * WINDOW_MS)
  const [recent] = await tx.select({ id: assessmentRevisions.id }).from(assessmentRevisions).where(and(
    eq(assessmentRevisions.source, record.source), eq(assessmentRevisions.assessmentId, record.assessmentId),
    eq(assessmentRevisions.recordKey, record.recordKey), eq(assessmentRevisions.actor, record.actor), gte(assessmentRevisions.savedAt, windowStart),
  )).orderBy(desc(assessmentRevisions.id)).limit(1)
  if (recent) await tx.update(assessmentRevisions).set({ snapshot, savedAt, period: record.period ?? null }).where(eq(assessmentRevisions.id, recent.id))
  else await tx.insert(assessmentRevisions).values({ ...record, savedAt, snapshot })
  return savedAt.toISOString()
}
