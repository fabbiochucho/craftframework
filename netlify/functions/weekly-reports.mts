import type { Config } from '@netlify/functions'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { capRecords, reports, reportVersions, workspaces } from '../../db/schema.js'
import { logger } from '../lib/logger.js'
import { summarizeCaps } from '../lib/workspace.js'

// Weekly: store a CAP-progress snapshot for every active workspace so trends
// are available in the report hub without anyone clicking "Generate".
export default async () => {
  try {
    const active = await db.select().from(workspaces).where(eq(workspaces.status, 'active'))
    for (const ws of active) {
      const caps = await db.select().from(capRecords).where(and(eq(capRecords.orgId, ws.orgId), eq(capRecords.workspaceId, ws.id)))
      const [r] = await db.insert(reports).values({
        orgId: ws.orgId, workspaceId: ws.id, reportType: 'cap_summary', generatedBy: 'system',
        dataAsOfDate: new Date().toISOString().slice(0, 10), statusSnapshot: { cap_progress: summarizeCaps(caps) },
      }).returning()
      await db.insert(reportVersions).values({ orgId: ws.orgId, reportId: r.id, versionNum: 1, jsonExportUrl: `/api/workspaces/${ws.id}/reports/${r.id}` })
    }
  } catch (err) {
    logger.error('weekly-reports', 'failed', err)
  }
}

export const config: Config = { schedule: '@weekly' }
