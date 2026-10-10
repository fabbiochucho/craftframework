import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  documentApprovals, evidenceLinks, governanceFindings, governanceScores, reportSchedules, reportVersions,
  supportIssues, wsOrgMembers, wsOrganizations,
} from '../../db/schema.js'
import { decryptField, encryptField, fieldLookupHashes, isEncryptedField } from '../lib/crypto.js'

if (!process.env.FIELD_ENCRYPTION_KEY) throw new Error('Set FIELD_ENCRYPTION_KEY before running the backfill')
const rotate = process.argv.includes('--rotate')

async function backfill<T extends { id: number }>(
  rows: T[],
  fields: (keyof T)[],
  update: (id: number, values: Partial<T>) => Promise<unknown>,
) {
  for (const row of rows) {
    const values: Partial<T> = {}
    for (const field of fields) {
      const value = row[field]
      if (typeof value === 'string' && value && (!isEncryptedField(value) || rotate)) {
        ;(values as Record<string, unknown>)[field as string] = encryptField(isEncryptedField(value) ? decryptField(value) : value)
      }
    }
    if (Object.keys(values).length) await update(row.id, values)
  }
}

await backfill(await db.select().from(wsOrganizations), ['contactEmail', 'contactPhone'], (id, set) =>
  db.update(wsOrganizations).set(set).where(eq(wsOrganizations.id, id)))
await backfill(await db.select().from(governanceScores), ['reviewerNotes'], (id, set) =>
  db.update(governanceScores).set(set).where(eq(governanceScores.id, id)))
await backfill(await db.select().from(governanceFindings).where(eq(governanceFindings.sensitive, true)), ['description'], (id, set) =>
  db.update(governanceFindings).set(set).where(eq(governanceFindings.id, id)))
await backfill(await db.select().from(evidenceLinks), ['reviewerNotes'], (id, set) =>
  db.update(evidenceLinks).set(set).where(eq(evidenceLinks.id, id)))
await backfill(await db.select().from(documentApprovals), ['comments'], (id, set) =>
  db.update(documentApprovals).set(set).where(eq(documentApprovals.id, id)))
await backfill(await db.select().from(supportIssues), ['contactEmail'], (id, set) =>
  db.update(supportIssues).set(set).where(eq(supportIssues.id, id)))
for (const member of await db.select().from(wsOrgMembers)) {
  const email = decryptField(member.userId)
  const hash = fieldLookupHashes(email)[0]
  if (hash && (member.userIdHash !== hash || !isEncryptedField(member.userId))) {
    await db.update(wsOrgMembers).set({ userId: encryptField(email), userIdHash: hash }).where(eq(wsOrgMembers.id, member.id))
  }
}
for (const schedule of await db.select().from(reportSchedules)) {
  const encrypted = schedule.recipients.map((email) =>
    isEncryptedField(email) && !rotate ? email : encryptField(decryptField(email)))
  if (encrypted.some((email, index) => email !== schedule.recipients[index])) {
    await db.update(reportSchedules).set({ recipients: encrypted }).where(eq(reportSchedules.id, schedule.id))
  }
}
for (const version of await db.select().from(reportVersions)) {
  if (version.emailSentTo && (!isEncryptedField(version.emailSentTo) || rotate)) {
    await db.update(reportVersions).set({
      emailSentTo: encryptField(isEncryptedField(version.emailSentTo) ? decryptField(version.emailSentTo) : version.emailSentTo),
    }).where(eq(reportVersions.id, version.id))
  }
}

console.log('Encrypted-field backfill complete')
