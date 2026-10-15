// Encrypts every field that should be encrypted at rest but is still plaintext (for example rows
// written before FIELD_ENCRYPTION_KEY was configured), and re-encrypts with the active key when
// rotating. Idempotent: encrypted values are skipped unless `rotate` is set. Used by the manual
// script (netlify/scripts/encrypt-existing-fields.mts) and the daily `encryption-backfill` job.
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  documentApprovals, evidenceLinks, governanceFindings, governanceScores, reportSchedules, reportVersions,
  supportIssues, userMfa, wsOrgMembers, wsOrganizations,
} from '../../db/schema.js'
import { legacyWorkspaceState } from '../../db/legacy-schema.js'
import { offlineFrameworkReceipts, offlineFrameworks } from '../../db/offline-schema.js'
import { decryptField, encryptField, fieldLookupHashes, isEncryptedField } from './crypto.js'

export async function runEncryptionBackfill({ rotate = false } = {}): Promise<Record<string, number>> {
  if (!process.env.FIELD_ENCRYPTION_KEY) throw new Error('Set FIELD_ENCRYPTION_KEY before running the backfill')
  const needs = (v: unknown): v is string => typeof v === 'string' && !!v && (!isEncryptedField(v) || rotate)
  const enc = (v: string) => encryptField(isEncryptedField(v) ? decryptField(v) : v)
  const counts: Record<string, number> = {}
  const bump = (k: string) => { counts[k] = (counts[k] ?? 0) + 1 }

  async function byId<T extends { id: number }>(name: string, rows: T[], fields: (keyof T)[], update: (id: number, values: Partial<T>) => Promise<unknown>) {
    for (const row of rows) {
      const values: Partial<T> = {}
      for (const f of fields) if (needs(row[f])) (values as Record<string, unknown>)[f as string] = enc(row[f] as string)
      if (Object.keys(values).length) { await update(row.id, values); bump(name) }
    }
  }
  await byId('ws_organizations', await db.select().from(wsOrganizations), ['contactEmail', 'contactPhone'], (id, set) => db.update(wsOrganizations).set(set).where(eq(wsOrganizations.id, id)))
  await byId('governance_scores', await db.select().from(governanceScores), ['reviewerNotes'], (id, set) => db.update(governanceScores).set(set).where(eq(governanceScores.id, id)))
  await byId('governance_findings', await db.select().from(governanceFindings).where(eq(governanceFindings.sensitive, true)), ['description'], (id, set) => db.update(governanceFindings).set(set).where(eq(governanceFindings.id, id)))
  await byId('evidence_links', await db.select().from(evidenceLinks), ['reviewerNotes'], (id, set) => db.update(evidenceLinks).set(set).where(eq(evidenceLinks.id, id)))
  await byId('document_approvals', await db.select().from(documentApprovals), ['comments'], (id, set) => db.update(documentApprovals).set(set).where(eq(documentApprovals.id, id)))
  await byId('support_issues', await db.select().from(supportIssues), ['contactEmail'], (id, set) => db.update(supportIssues).set(set).where(eq(supportIssues.id, id)))
  await byId('report_versions', await db.select().from(reportVersions), ['emailSentTo'], (id, set) => db.update(reportVersions).set(set).where(eq(reportVersions.id, id)))

  for (const m of await db.select().from(wsOrgMembers)) {
    const email = decryptField(m.userId)
    const hash = fieldLookupHashes(email)[0]
    if (hash && (m.userIdHash !== hash || needs(m.userId))) {
      await db.update(wsOrgMembers).set({ userId: encryptField(email), userIdHash: hash }).where(eq(wsOrgMembers.id, m.id)); bump('ws_org_members')
    }
  }
  for (const s of await db.select().from(reportSchedules)) {
    const next = s.recipients.map((e) => (needs(e) ? enc(e) : e))
    if (next.some((e, i) => e !== s.recipients[i])) { await db.update(reportSchedules).set({ recipients: next }).where(eq(reportSchedules.id, s.id)); bump('report_schedules') }
  }
  for (const r of await db.select().from(userMfa)) {
    const set: Record<string, string> = {}
    if (needs(r.secret)) set.secret = enc(r.secret)
    if (needs(r.pendingSecret)) set.pendingSecret = enc(r.pendingSecret)
    if (Object.keys(set).length) { await db.update(userMfa).set(set).where(eq(userMfa.userKey, r.userKey)); bump('user_mfa') }
  }
  for (const r of await db.select().from(legacyWorkspaceState)) {
    if (needs(r.value)) { await db.update(legacyWorkspaceState).set({ value: enc(r.value) }).where(and(eq(legacyWorkspaceState.orgId, r.orgId), eq(legacyWorkspaceState.key, r.key))); bump('legacy_workspace_state') }
  }
  for (const r of await db.select().from(offlineFrameworks)) {
    if (needs(r.payload)) { await db.update(offlineFrameworks).set({ payload: enc(r.payload) }).where(and(eq(offlineFrameworks.orgId, r.orgId), eq(offlineFrameworks.workspaceId, r.workspaceId), eq(offlineFrameworks.id, r.id))); bump('offline_frameworks') }
  }
  for (const r of await db.select().from(offlineFrameworkReceipts)) {
    if (needs(r.response)) {
      await db.update(offlineFrameworkReceipts).set({ response: enc(r.response) }).where(and(eq(offlineFrameworkReceipts.orgId, r.orgId), eq(offlineFrameworkReceipts.workspaceId, r.workspaceId), eq(offlineFrameworkReceipts.userId, r.userId), eq(offlineFrameworkReceipts.operationId, r.operationId)))
      bump('offline_framework_receipts')
    }
  }
  return counts
}
