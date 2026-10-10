import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { and, desc, eq, lte } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  capRecords, esgImplementationPlans, governanceAssessments, governanceFindings, governanceScores,
  reports, reportSchedules, reportVersions, wsAuditLog, wsOrganizations,
} from '../../db/schema.js'
import { logger } from '../lib/logger.js'
import { buildScorecard, nextReportRun, summarizeCaps } from '../lib/workspace.js'
import { escapeHtml, renderReportPdf } from '../lib/reports.js'
import { decryptField, encryptField } from '../lib/crypto.js'

const today = () => new Date().toISOString().slice(0, 10)

async function buildScheduledSnapshot(orgId: number, workspaceId: number, reportType: string) {
  if (reportType === 'cap_summary') {
    const caps = await db.select().from(capRecords).where(and(eq(capRecords.orgId, orgId), eq(capRecords.workspaceId, workspaceId)))
    return { cap_progress: summarizeCaps(caps) }
  }
  if (reportType === 'governance_scorecard') {
    const assessments = await db.select().from(governanceAssessments).where(and(
      eq(governanceAssessments.orgId, orgId), eq(governanceAssessments.workspaceId, workspaceId),
    ))
    const ids = assessments.map((assessment) => assessment.id)
    const scores = ids.length ? await db.select().from(governanceScores).where(eq(governanceScores.orgId, orgId)) : []
    const findings = ids.length ? await db.select().from(governanceFindings).where(eq(governanceFindings.orgId, orgId)) : []
    return buildScorecard(
      scores.filter((score) => ids.includes(score.assessmentId)),
      findings.filter((finding) => ids.includes(finding.assessmentId)),
    )
  }
  if (reportType === 'esg_status') {
    const plans = await db.select().from(esgImplementationPlans).where(and(
      eq(esgImplementationPlans.orgId, orgId), eq(esgImplementationPlans.workspaceId, workspaceId),
    ))
    const completed = plans.filter((plan) => plan.status === 'completed').length
    return { plans: plans.length, completed, percent: plans.length ? Math.round(completed / plans.length * 100) : 0 }
  }
  return {
    entries: await db.select().from(wsAuditLog).where(and(
      eq(wsAuditLog.orgId, orgId), eq(wsAuditLog.workspaceId, workspaceId),
    )).orderBy(desc(wsAuditLog.id)).limit(5000),
  }
}

export default async () => {
  try {
    const due = await db.select().from(reportSchedules).where(and(eq(reportSchedules.paused, false), lte(reportSchedules.nextRunAt, new Date())))
    for (const schedule of due) {
      const workspaceId = schedule.workspaceId
      const snapshot = await buildScheduledSnapshot(schedule.orgId, workspaceId, schedule.reportType)
      const [report] = await db.insert(reports).values({
        orgId: schedule.orgId, workspaceId, reportType: schedule.reportType, generatedBy: 'system',
        dataAsOfDate: today(), statusSnapshot: snapshot,
      }).returning()
      const [organization] = await db.select({ name: wsOrganizations.name }).from(wsOrganizations).where(eq(wsOrganizations.id, schedule.orgId))
      let pdfBytes: Uint8Array | null = null
      if (schedule.format !== 'json') {
        pdfBytes = await renderReportPdf({
          reportType: schedule.reportType, organizationName: organization?.name ?? 'Organization',
          dataAsOfDate: report.dataAsOfDate, generatedAt: report.generatedAt, snapshot,
        })
        await getStore('reports').set(`reports/${schedule.orgId}/${workspaceId}/${report.id}/v1.pdf`, pdfBytes, {
          metadata: { contentType: 'application/pdf' },
        })
      }
      let delivered = false
      if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
        const attachments = []
        if (schedule.format !== 'pdf') attachments.push({
          content: Buffer.from(JSON.stringify(snapshot, null, 2)).toString('base64'),
          type: 'application/json', filename: `report-${report.id}.json`, disposition: 'attachment',
        })
        if (pdfBytes) attachments.push({
          content: Buffer.from(pdfBytes).toString('base64'),
          type: 'application/pdf', filename: `report-${report.id}.pdf`, disposition: 'attachment',
        })
        try {
          const sent = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personalizations: [{ to: schedule.recipients.map(decryptField).map((email) => ({ email })) }],
              from: { email: process.env.SENDGRID_FROM_EMAIL },
              subject: `CRAFT report: ${schedule.reportType} (${report.dataAsOfDate})`,
              content: [{ type: 'text/html', value: `<p>Scheduled ${escapeHtml(schedule.reportType)} report for ${escapeHtml(organization?.name ?? 'Organization')}, as of ${report.dataAsOfDate}.</p>` }],
              attachments,
            }),
          })
          delivered = sent.ok
          if (!delivered) logger.warn('weekly-reports', `email delivery failed for schedule ${schedule.id}`)
        } catch (err) {
          logger.warn('weekly-reports', `email delivery failed for schedule ${schedule.id}`, { error: err })
        }
      } else {
        logger.warn('weekly-reports', `email not configured; schedule ${schedule.id} report was generated but not delivered`)
      }
      await db.insert(reportVersions).values({
        orgId: schedule.orgId, reportId: report.id, versionNum: 1,
        jsonExportUrl: `/api/workspaces/${workspaceId}/reports/${report.id}`,
        pdfUrl: pdfBytes ? `/api/workspaces/${workspaceId}/reports/${report.id}/pdf?version=1` : null,
        emailSentTo: delivered ? encryptField(schedule.recipients.map(decryptField).join(',')) : null,
        sentAt: delivered ? new Date() : null,
      })
      await db.insert(wsAuditLog).values({
        orgId: schedule.orgId, workspaceId, actorId: 'system', resourceType: 'report', resourceId: String(report.id),
        action: 'create', details: { scheduled: true, scheduleId: schedule.id, emailDelivered: delivered },
      })
      const cadence = schedule.cadence as 'weekly' | 'monthly' | 'quarterly'
      const now = new Date()
      let nextRunAt = nextReportRun(cadence, schedule.nextRunAt, schedule.scheduleDay)
      while (nextRunAt <= now) nextRunAt = nextReportRun(cadence, nextRunAt, schedule.scheduleDay)
      await db.update(reportSchedules).set({ nextRunAt })
        .where(and(eq(reportSchedules.id, schedule.id), eq(reportSchedules.orgId, schedule.orgId), eq(reportSchedules.workspaceId, workspaceId)))
    }
    logger.info('weekly-reports', `processed ${due.length} due schedule(s)`)
  } catch (err) {
    logger.error('weekly-reports', 'failed', err)
  }
}

export const config: Config = { schedule: '@daily' }
