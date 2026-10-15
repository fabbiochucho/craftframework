import type { Config } from '@netlify/functions'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { capRecords, wsAuditLog } from '../../db/schema.js'
import { escalationFor, ESCALATION_LEVELS } from '../lib/cap-tools.js'
import { logger } from '../lib/logger.js'

// Daily: raise open CAPs to the escalation level their severity and days overdue call for
// (never lowers a level), and record each escalation in the workspace audit log.
export default async () => {
  try {
    const now = new Date().toISOString().slice(0, 10)
    const caps = await db.select().from(capRecords).where(and(ne(capRecords.status, 'merged'), ne(capRecords.escalationLevel, 3)))
    let n = 0
    for (const cap of caps) {
      const e = escalationFor(cap, now)
      if (e.level <= cap.escalationLevel) continue
      await db.update(capRecords).set({ escalationLevel: e.level, escalatedAt: new Date(), escalatedTo: ESCALATION_LEVELS[e.level], escalationReason: e.reason }).where(eq(capRecords.id, cap.id))
      await db.insert(wsAuditLog).values({ orgId: cap.orgId, workspaceId: cap.workspaceId, actorId: 'system', resourceType: 'cap', resourceId: String(cap.id), action: 'update', details: { escalationLevel: e.level, reason: e.reason } })
      n++
    }
    logger.info('cap-escalations', `escalated ${n} of ${caps.length} CAP(s)`)
  } catch (err) {
    logger.error('cap-escalations', 'failed', err)
  }
}

export const config: Config = { schedule: '@daily' }
