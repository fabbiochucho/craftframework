import type { Config } from '@netlify/functions'
import { and, eq, isNotNull, isNull, lte } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { evidenceRegistry, wsAuditLog } from '../../db/schema.js'
import { logger } from '../lib/logger.js'
import { evidenceExpiryState } from '../lib/workspace.js'

// Daily: flag expired evidence, mark it `expired`, and record the alert in the
// audit log (the compliance dashboard and evidence registry surface these).
export default async () => {
  try {
    const limit = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
    const rows = await db.select().from(evidenceRegistry).where(and(isNull(evidenceRegistry.archivedAt), isNotNull(evidenceRegistry.expiryDate), lte(evidenceRegistry.expiryDate, limit)))
    for (const r of rows) {
      const state = evidenceExpiryState(r.expiryDate)
      if (state === 'expired' && r.status !== 'expired') {
        await db.update(evidenceRegistry).set({ status: 'expired' }).where(eq(evidenceRegistry.id, r.id))
      }
      await db.insert(wsAuditLog).values({
        orgId: r.orgId, workspaceId: r.workspaceId, actorId: 'system', resourceType: 'evidence', resourceId: String(r.id),
        action: 'update', details: { alert: state, expiryDate: r.expiryDate },
      })
    }
    logger.info('evidence-expiry-alerts', `processed ${rows.length} document(s)`)
  } catch (err) {
    logger.error('evidence-expiry-alerts', 'failed', err)
  }
}

export const config: Config = { schedule: '@daily' }
