import type { Config } from '@netlify/functions'
import { listOfflineFrameworks, mutateOfflineFramework } from '../lib/offline-frameworks.js'
import { escalateSupport } from '../lib/support-escalation.js'
import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { decodeEvidence, encodeEvidence } from '../lib/evidence-storage.js'
import { and, asc, desc, eq, gte, inArray, lte, isNull, isNotNull, or, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  wsOrganizations, wsOrgMembers, workspaces, governanceAssessments, governanceScores, governanceFindings,
  esgFrameworks, esgRequirements, esgImplementationPlans, esgMilestones, capRecords, actionItems, actionLogs,
  evidenceRegistry, evidenceLinks, documentApprovals, reports, reportVersions, wsAuditLog, supportIssues,
  supportIssueResponses, reportSchedules, gdprRequests, rateLimits, users, auditLogs, qaPeriods, qaCheckInstances, governanceValidations,
} from '../../db/schema.js'
import { resolveCaller, type Caller } from '../lib/auth.js'
import { HttpError, requireOrgAccess, requireWorkspaceAccess } from '../lib/orgAccess.js'
import {
  ALLOWED_EVIDENCE_MIME, MAX_EVIDENCE_BYTES, SEVERITIES, buildScorecard, canAssignRole, capCloseBlockers,
  capLifecycle, corsHeaders, csvEscape, effectiveCapStatus, evidenceExpiryState, hasMinRole, isRateLimitedCount,
  isVerificationEvidence, isVerifiedOrgEmailDomain, nextReportRun, rateLimitWindowStart, severityFromTier, summarizeCaps, tierFromScore, type OrgRole,
} from '../lib/workspace.js'
import { decryptField, encryptField, fieldLookupHashes, isEncryptedField, pseudonymizeIdentifier } from '../lib/crypto.js'
import { escapeHtml, renderReportPdf } from '../lib/reports.js'
import { logger } from '../lib/logger.js'
import {
  activeCriteria, craftScorecard, criterionById, GOVERNANCE_CRITERIA, GOVERNANCE_PILLARS, VALIDATION_METHODS, VALIDATION_OUTCOMES, validationDelta,
  type ValidatorScores,
} from '../../src/lib/craft-governance.js'
import {
  applicableChecks, CHECKLIST_VERSION, CHECKS, checkWeight, CLASS_LABELS, JURISDICTIONS, jurisdictionByCode, LEGACY_CHECKS_STATUS, PACK_LABELS, scoreChecklist, STATUS_LABELS,
  type CheckInstance, type CheckStatus, type EvidenceState, type QaProfile,
} from '../../src/lib/esg-checklist.js'
import { qaCsv, renderQaDoc, type QaView } from '../lib/qa-report.js'
import { checkContent, DOCUMENT_KINDS, extractText, kindById } from '../lib/evidence-content.js'
import {
  catalogueMeta, defaultFirstReportingYear, ESG_CATALOGUE, generateSecPlan, planCsv, renderPlanDoc, SEC_NG_FRAMEWORK,
  type EntityType, type Horizon, type PlanRow, type PlanSettings, type Readiness,
} from '../lib/esg-planner.js'
import {
  classifySupportMessage, isPrivateReport, rankSupportFaq, redactSupportMessage, supportDeduplicationKey,
} from '../lib/support-bot.js'

// ============================================================================
// Workspace platform API — orgs, governance, ESG, CAP, evidence, reports,
// support bot and audit. One route table; every route declares the minimum org
// role it needs and every query is filtered by the org id resolved from the
// workspace row (never from the request body).
// ============================================================================

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'craftframework@becomechange.institute'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const today = () => new Date().toISOString().slice(0, 10)
const exposeOrganization = <T extends { contactEmail: string; contactPhone: string }>(organization: T): T => ({
  ...organization, contactEmail: decryptField(organization.contactEmail), contactPhone: decryptField(organization.contactPhone),
})
const memberEmailFilter = (email: string) => {
  const hashes = fieldLookupHashes(email)
  return hashes.length ? or(inArray(wsOrgMembers.userIdHash, hashes), eq(wsOrgMembers.userId, email))! : eq(wsOrgMembers.userId, email)
}
const exposeMember = <T extends { userId: string; userIdHash?: string | null }>(member: T) => {
  const { userIdHash: _userIdHash, ...safe } = member
  return { ...safe, userId: decryptField(member.userId) }
}
function redactIdentity(value: unknown, subject: string, replacement: string): unknown {
  if (typeof value === 'string') return value.replace(new RegExp(subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replacement)
  if (Array.isArray(value)) return value.map((item) => redactIdentity(item, subject, replacement))
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactIdentity(item, subject, replacement)]),
  )
  return value
}

async function exportDataForCaller(c: Ctx, caller: Caller): Promise<Response> {
  const memberships = await db.select().from(wsOrgMembers).where(memberEmailFilter(caller.email))
  const orgIds = memberships.map((membership) => membership.orgId)
  if (orgIds.length) {
    for (const orgId of orgIds) await audit(c, orgId, null, 'gdpr_export', caller.email, 'read')
  } else {
    await db.insert(auditLogs).values({ actor: caller.email, action: 'exported personal data', target: 'GDPR data export', category: 'Privacy' })
  }
  const [profile] = await db.select().from(users).where(eq(users.email, caller.email))
  const legacyAuditEntries = await db.select().from(auditLogs).where(eq(auditLogs.actor, caller.email))
  const organizations = orgIds.length
    ? (await db.select().from(wsOrganizations).where(inArray(wsOrganizations.id, orgIds))).map(exposeOrganization)
    : []
  const scoped = async <T,>(table: any, orgColumn: any): Promise<T[]> =>
    orgIds.length ? db.select().from(table).where(inArray(orgColumn, orgIds)) as Promise<T[]> : []
  const [workspaceRows, assessmentRows, evidenceRows, capRows, allScheduleRows, reportRows, auditRows] = await Promise.all([
    scoped(workspaces, workspaces.orgId),
    orgIds.length ? db.select().from(governanceAssessments).where(and(inArray(governanceAssessments.orgId, orgIds), eq(governanceAssessments.createdBy, caller.email))) : [],
    orgIds.length ? db.select().from(evidenceRegistry).where(and(inArray(evidenceRegistry.orgId, orgIds), eq(evidenceRegistry.uploadedBy, caller.email))) : [],
    orgIds.length ? db.select().from(capRecords).where(and(inArray(capRecords.orgId, orgIds), eq(capRecords.assignedTo, caller.email))) : [],
    scoped<typeof reportSchedules.$inferSelect>(reportSchedules, reportSchedules.orgId),
    orgIds.length ? db.select().from(reports).where(and(inArray(reports.orgId, orgIds), eq(reports.generatedBy, caller.email))) : [],
    orgIds.length ? db.select().from(wsAuditLog).where(and(inArray(wsAuditLog.orgId, orgIds), eq(wsAuditLog.actorId, caller.email))) : [],
  ])
  const assessments = assessmentRows as typeof governanceAssessments.$inferSelect[]
  const [scores, findings, approvals, actions, actionEvents] = await Promise.all([
    assessments.length ? db.select().from(governanceScores).where(and(
      inArray(governanceScores.orgId, orgIds), inArray(governanceScores.assessmentId, assessments.map((a) => a.id)),
    )) : [],
    orgIds.length ? db.select().from(governanceFindings).where(and(
      inArray(governanceFindings.orgId, orgIds), eq(governanceFindings.ownerAssignment, caller.email),
    )) : [],
    orgIds.length ? db.select().from(documentApprovals).where(and(
      inArray(documentApprovals.orgId, orgIds), eq(documentApprovals.reviewerId, caller.email),
    )) : [],
    orgIds.length ? db.select().from(actionItems).where(and(
      inArray(actionItems.orgId, orgIds), eq(actionItems.owner, caller.email),
    )) : [],
    orgIds.length ? db.select().from(actionLogs).where(and(
      inArray(actionLogs.orgId, orgIds), eq(actionLogs.actorId, caller.email),
    )) : [],
  ])
  const scheduleRows = allScheduleRows.filter((schedule) =>
    schedule.createdBy === caller.email || schedule.recipients.map(decryptField).includes(caller.email))
  const recipientVersions = orgIds.length
    ? (await db.select().from(reportVersions).where(inArray(reportVersions.orgId, orgIds)))
      .filter((version) => version.emailSentTo && decryptField(version.emailSentTo).split(',').includes(caller.email))
    : []
  const allSupport = await db.select().from(supportIssues)
  const support = allSupport.filter((issue) => decryptField(issue.contactEmail) === caller.email)
    .map((issue) => ({ ...issue, contactEmail: decryptField(issue.contactEmail) }))
  const issueIds = support.map((issue) => issue.id)
  const supportResponses = issueIds.length
    ? await db.select().from(supportIssueResponses).where(inArray(supportIssueResponses.issueId, issueIds))
    : []
  const bundle = {
    exportedAt: new Date().toISOString(),
    subject: caller.email,
    profile: profile ?? null,
    legacyAuditEntries,
    memberships: memberships.map(exposeMember),
    organizations,
    workspaces: workspaceRows,
    assessments,
    scores: scores.map((score) => ({ ...score, reviewerNotes: decryptField(score.reviewerNotes) })),
    findings: findings.map((finding) => ({ ...finding, description: decryptField(finding.description) })),
    evidence: evidenceRows,
    approvals: approvals.map((approval) => ({ ...approval, comments: decryptField(approval.comments) })),
    actionItems: actions,
    actionEvents,
    capRecords: capRows,
    reportSchedules: scheduleRows.map((schedule) => ({
      ...schedule, recipients: schedule.recipients.map(decryptField),
    })),
    reports: reportRows,
    reportVersions: recipientVersions.map((version) => ({
      ...version, emailSentTo: version.emailSentTo ? decryptField(version.emailSentTo) : null,
    })),
    auditEntries: auditRows,
    supportIssues: support,
    supportIssueResponses: supportResponses,
  }
  return new Response(JSON.stringify(bundle, null, 2), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': 'attachment; filename="craft-data-export.json"',
    'Cache-Control': 'no-store',
  } })
}

async function approveErasureRequest(c: Ctx, caller: Caller, requestId: number): Promise<Response> {
  const [request] = await db.select().from(gdprRequests).where(eq(gdprRequests.id, requestId))
  if (!request) throw new HttpError(404, 'Not found')
  await requireOrgAccess(caller, request.orgId, 'admin')
  if (request.requestedBy === caller.email) throw new HttpError(403, 'A different organization admin must approve the request')
  if (request.requestType !== 'erasure' || request.status !== 'pending') throw new HttpError(409, 'Request is not pending erasure')

  const [membership] = await db.select().from(wsOrgMembers).where(and(
    eq(wsOrgMembers.orgId, request.orgId), memberEmailFilter(request.requestedBy),
  ))
  if (membership?.role === 'owner') {
    const owners = await db.select({ id: wsOrgMembers.id }).from(wsOrgMembers)
      .where(and(eq(wsOrgMembers.orgId, request.orgId), eq(wsOrgMembers.role, 'owner')))
    if (owners.length < 2) throw new HttpError(409, 'Transfer workspace ownership before erasing the last owner')
  }

  await audit(c, request.orgId, null, 'gdpr_erasure', request.id, 'update', { approvalStarted: true })
  const pseudonym = pseudonymizeIdentifier(request.requestedBy, String(request.orgId))
  const archivedEvidence = await db.select().from(evidenceRegistry).where(and(
    eq(evidenceRegistry.orgId, request.orgId), isNotNull(evidenceRegistry.archivedAt),
  ))
  for (const evidence of archivedEvidence) {
    await getStore('evidence').delete(evidence.filePath)
    await db.delete(evidenceLinks).where(and(eq(evidenceLinks.orgId, request.orgId), eq(evidenceLinks.evidenceId, evidence.id)))
    await db.delete(documentApprovals).where(and(eq(documentApprovals.orgId, request.orgId), eq(documentApprovals.evidenceId, evidence.id)))
    await db.delete(evidenceRegistry).where(and(eq(evidenceRegistry.orgId, request.orgId), eq(evidenceRegistry.id, evidence.id)))
  }

  await db.update(governanceAssessments).set({ createdBy: pseudonym }).where(and(
    eq(governanceAssessments.orgId, request.orgId), eq(governanceAssessments.createdBy, request.requestedBy),
  ))
  await db.update(governanceFindings).set({ ownerAssignment: pseudonym }).where(and(
    eq(governanceFindings.orgId, request.orgId), eq(governanceFindings.ownerAssignment, request.requestedBy),
  ))
  await db.update(capRecords).set({ assignedTo: pseudonym }).where(and(
    eq(capRecords.orgId, request.orgId), eq(capRecords.assignedTo, request.requestedBy),
  ))
  await db.update(actionItems).set({ owner: pseudonym }).where(and(
    eq(actionItems.orgId, request.orgId), eq(actionItems.owner, request.requestedBy),
  ))
  const subjectActionLogs = await db.select().from(actionLogs).where(and(
    eq(actionLogs.orgId, request.orgId), eq(actionLogs.actorId, request.requestedBy),
  ))
  for (const entry of subjectActionLogs) await db.update(actionLogs).set({
    actorId: pseudonym, oldValue: entry.oldValue == null ? null : String(redactIdentity(entry.oldValue, request.requestedBy, pseudonym)),
    newValue: entry.newValue == null ? null : String(redactIdentity(entry.newValue, request.requestedBy, pseudonym)),
  }).where(eq(actionLogs.id, entry.id))
  await db.update(evidenceRegistry).set({ uploadedBy: pseudonym }).where(and(
    eq(evidenceRegistry.orgId, request.orgId), eq(evidenceRegistry.uploadedBy, request.requestedBy),
  ))
  await db.update(documentApprovals).set({ reviewerId: pseudonym }).where(and(
    eq(documentApprovals.orgId, request.orgId), eq(documentApprovals.reviewerId, request.requestedBy),
  ))
  await db.update(reports).set({ generatedBy: pseudonym }).where(and(
    eq(reports.orgId, request.orgId), eq(reports.generatedBy, request.requestedBy),
  ))
  const orgReports = await db.select({ id: reports.id }).from(reports).where(eq(reports.orgId, request.orgId))
  for (const report of orgReports) {
    const versions = await db.select().from(reportVersions).where(and(
      eq(reportVersions.orgId, request.orgId), eq(reportVersions.reportId, report.id),
    ))
    for (const version of versions) {
      if (version.emailSentTo) {
        const sentTo = decryptField(version.emailSentTo).split(',').map((email) => email === request.requestedBy ? pseudonym : email)
        await db.update(reportVersions).set({ emailSentTo: encryptField(sentTo.join(',')) }).where(eq(reportVersions.id, version.id))
      }
    }
  }
  await db.update(reportSchedules).set({ createdBy: pseudonym }).where(and(
    eq(reportSchedules.orgId, request.orgId), eq(reportSchedules.createdBy, request.requestedBy),
  ))
  const schedules = await db.select().from(reportSchedules).where(eq(reportSchedules.orgId, request.orgId))
  for (const schedule of schedules) {
    const recipients = schedule.recipients.map(decryptField)
    if (recipients.includes(request.requestedBy)) {
      await db.update(reportSchedules).set({
        recipients: recipients.filter((email) => email !== request.requestedBy).map(encryptField),
      }).where(eq(reportSchedules.id, schedule.id))
    }
  }
  const subjectAuditRows = await db.select().from(wsAuditLog).where(and(
    eq(wsAuditLog.orgId, request.orgId), eq(wsAuditLog.actorId, request.requestedBy),
  ))
  for (const entry of subjectAuditRows) await db.update(wsAuditLog).set({
    actorId: pseudonym,
    resourceId: entry.resourceId === request.requestedBy ? pseudonym : entry.resourceId,
    details: redactIdentity(entry.details, request.requestedBy, pseudonym) as Record<string, unknown>,
  }).where(eq(wsAuditLog.id, entry.id))
  const orgIssues = await db.select().from(supportIssues).where(eq(supportIssues.orgId, request.orgId))
  const issueIds: number[] = []
  for (const issue of orgIssues) {
    issueIds.push(issue.id)
    if (decryptField(issue.contactEmail) === request.requestedBy) {
      await db.update(supportIssues).set({
        contactEmail: '', description: '[redacted following data subject erasure]',
      }).where(eq(supportIssues.id, issue.id))
    }
  }
  if (issueIds.length) {
    const responses = await db.select().from(supportIssueResponses).where(and(
      inArray(supportIssueResponses.issueId, issueIds), eq(supportIssueResponses.responder, request.requestedBy),
    ))
    for (const response of responses) await db.update(supportIssueResponses).set({
      responder: pseudonym, message: '[redacted following data subject erasure]',
    }).where(eq(supportIssueResponses.id, response.id))
  }
  const [org] = await db.select().from(wsOrganizations).where(eq(wsOrganizations.id, request.orgId))
  if (org && decryptField(org.contactEmail) === request.requestedBy) {
    await db.update(wsOrganizations).set({ contactEmail: '', contactPhone: '' }).where(eq(wsOrganizations.id, request.orgId))
  }
  if (membership) await db.delete(wsOrgMembers).where(eq(wsOrgMembers.id, membership.id))
  await audit(c, request.orgId, null, 'gdpr_erasure', request.id, 'update', { subject: pseudonym, purgedEvidenceBlobs: archivedEvidence.length })
  const [approved] = await db.update(gdprRequests).set({
    status: 'approved', approvedBy: caller.email, approvedAt: new Date(),
  }).where(eq(gdprRequests.id, request.id)).returning()
  return json(approved)
}

type Ctx = {
  req: Request
  url: URL
  p: string[] // captured path params
  body: any
  caller: Caller | null
  ip: string
}
type Route = {
  method: string
  pattern: string
  // 'public' routes need no session; otherwise the minimum role in the org/workspace.
  access: 'public' | 'authed' | OrgRole
  scope?: 'org' | 'workspace'
  handler: (c: Ctx, a: { caller: Caller; orgId: number; wsId: number; role: OrgRole }) => Promise<Response>
}

// --- validation helpers -------------------------------------------------------
const bad = (m: string) => new HttpError(400, m)
function str(v: unknown, field: string, max = 2000, required = true): string {
  if (v == null || v === '') {
    if (required) throw bad(`${field} required`)
    return ''
  }
  if (typeof v !== 'string' || v.length > max) throw bad(`${field} invalid`)
  return v.trim()
}
function oneOf<T extends string>(v: unknown, field: string, allowed: readonly T[], def?: T): T {
  if (v == null && def) return def
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) throw bad(`${field} must be one of ${allowed.join('/')}`)
  return v as T
}
function dateOrNull(v: unknown, field: string): string | null {
  if (v == null || v === '') return null
  if (typeof v !== 'string' || !DATE_RE.test(v)) throw bad(`${field} must be YYYY-MM-DD`)
  return v
}
function intParam(v: string): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, 'Not found')
  return n
}
const json = (data: unknown, status = 200) => Response.json(data, { status })

async function audit(
  c: Ctx, orgId: number, wsId: number | null, resourceType: string, resourceId: string | number | null,
  action: 'create' | 'read' | 'update' | 'delete', details: Record<string, unknown> = {},
) {
  await db.insert(wsAuditLog).values({
    orgId, workspaceId: wsId, actorId: c.caller?.email ?? 'anonymous', resourceType,
    resourceId: resourceId == null ? null : String(resourceId), action, ipAddress: c.ip,
    userAgent: c.req.headers.get('user-agent')?.slice(0, 300) ?? null, details,
  })
}

async function incrementRateLimit(key: string, now: number): Promise<number> {
  const windowStart = new Date(rateLimitWindowStart(now))
  const hashedKey = createHash('sha256').update(key).digest('hex')
  const [counter] = await db.insert(rateLimits).values({ key: hashedKey, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    }).returning({ count: rateLimits.count })
  if (Math.random() < 0.01) {
    await db.delete(rateLimits).where(lte(rateLimits.windowStart, new Date(now - 120_000)))
  }
  return counter.count
}

function tooManyRequests(now: number): Response {
  const seconds = Math.max(1, Math.ceil((rateLimitWindowStart(now) + 60_000 - now) / 1000))
  return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(seconds) } })
}

async function sendEmail(
  to: string[],
  subject: string,
  html: string,
  attachment?: { filename: string; bytes: Uint8Array },
): Promise<boolean> {
  const key = process.env.SENDGRID_API_KEY
  const from = process.env.SENDGRID_FROM_EMAIL
  if (!key || !from || !to.length) return false
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: to.map((email) => ({ email })) }],
      from: { email: from },
      subject,
      content: [{ type: 'text/html', value: html }],
      ...(attachment ? { attachments: [{
        content: Buffer.from(attachment.bytes).toString('base64'),
        type: 'application/pdf', filename: attachment.filename, disposition: 'attachment',
      }] } : {}),
    }),
  })
  return res.ok
}

async function createGithubIssue(title: string, body: string, labels: string[]): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN
  if (!token) return null
  const res = await fetch('https://api.github.com/repos/fabbiochucho/craftframework/issues', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, labels }),
  })
  if (!res.ok) return null
  return ((await res.json()) as { html_url?: string }).html_url ?? null
}

// --- loaders (all scoped by org + workspace) ---------------------------------------------
async function loadAssessment(orgId: number, wsId: number, id: number) {
  const [a] = await db.select().from(governanceAssessments)
    .where(and(eq(governanceAssessments.id, id), eq(governanceAssessments.orgId, orgId), eq(governanceAssessments.workspaceId, wsId)))
  if (!a) throw new HttpError(404, 'Not found')
  return a
}
async function loadCap(orgId: number, wsId: number, id: number) {
  const [c] = await db.select().from(capRecords)
    .where(and(eq(capRecords.id, id), eq(capRecords.orgId, orgId), eq(capRecords.workspaceId, wsId)))
  if (!c) throw new HttpError(404, 'Not found')
  return c
}
async function loadEvidence(orgId: number, wsId: number, id: number) {
  const [e] = await db.select().from(evidenceRegistry)
    .where(and(eq(evidenceRegistry.id, id), eq(evidenceRegistry.orgId, orgId), eq(evidenceRegistry.workspaceId, wsId), isNull(evidenceRegistry.archivedAt)))
  if (!e) throw new HttpError(404, 'Not found')
  return e
}

async function actionHasValidEvidence(orgId: number, wsId: number, capId: number, actionId: number, candidateId?: number) {
  let evidenceId = candidateId
  if (evidenceId === undefined) {
    const logs = await db.select().from(actionLogs).where(and(eq(actionLogs.orgId, orgId), eq(actionLogs.actionId, actionId))).orderBy(desc(actionLogs.id))
    const latest = logs.find(log => /^evidence:\d+$/.test(log.newValue ?? ''))
    if (!latest) return false
    evidenceId = Number(latest.newValue!.slice('evidence:'.length))
  }
  const [linked] = await db.select({ evidence: evidenceRegistry }).from(evidenceLinks)
    .innerJoin(evidenceRegistry, eq(evidenceRegistry.id, evidenceLinks.evidenceId))
    .where(and(eq(evidenceLinks.orgId, orgId), eq(evidenceLinks.evidenceId, evidenceId), eq(evidenceLinks.targetType, 'cap'),
      eq(evidenceLinks.targetId, capId), eq(evidenceRegistry.orgId, orgId), eq(evidenceRegistry.workspaceId, wsId)))
  return !!linked && isVerificationEvidence(linked.evidence)
}
async function loadRequirement(orgId: number, wsId: number, id: number) {
  const [r] = await db
    .select({ req: esgRequirements })
    .from(esgRequirements)
    .innerJoin(esgFrameworks, eq(esgFrameworks.id, esgRequirements.frameworkId))
    .where(and(eq(esgRequirements.id, id), eq(esgRequirements.orgId, orgId), eq(esgFrameworks.workspaceId, wsId)))
  if (!r) throw new HttpError(404, 'Not found')
  return r.req
}

async function refreshFindingsCount(orgId: number, assessmentId: number) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(governanceFindings)
    .where(and(eq(governanceFindings.orgId, orgId), eq(governanceFindings.assessmentId, assessmentId)))
  await db.update(governanceAssessments).set({ findingsCount: n })
    .where(and(eq(governanceAssessments.id, assessmentId), eq(governanceAssessments.orgId, orgId)))
}

// --- ESG catalogue (netlify/lib/esg-planner.ts), seeded lazily per workspace -----------------
// Idempotent per framework name and requirement id, so workspaces seeded before a framework
// was added still receive it, and edits to existing rows are never overwritten.
async function ensureEsgCatalogue(orgId: number, wsId: number) {
  const existing = await db.select().from(esgFrameworks).where(and(eq(esgFrameworks.orgId, orgId), eq(esgFrameworks.workspaceId, wsId)))
  const byName = new Map(existing.map((f) => [f.frameworkName, f]))
  const ids = existing.map((f) => f.id)
  const have = ids.length ? await db.select({ fw: esgRequirements.frameworkId, rid: esgRequirements.requirementId }).from(esgRequirements)
    .where(and(eq(esgRequirements.orgId, orgId), inArray(esgRequirements.frameworkId, ids))) : []
  const haveKey = new Set(have.map((r) => `${r.fw}|${r.rid}`))
  const deadline = `${new Date().getUTCFullYear() + 1}-12-31`
  for (const f of ESG_CATALOGUE) {
    let row = byName.get(f.name)
    if (!row) [row] = await db.insert(esgFrameworks).values({ orgId, workspaceId: wsId, frameworkName: f.name, jurisdiction: f.jurisdiction, applicability: f.applicability }).returning()
    const missing = f.reqs.filter(([rid]) => !haveKey.has(`${row!.id}|${rid}`))
    if (missing.length) await db.insert(esgRequirements).values(missing.map(([requirementId, requirementText, category, priority]) => ({
      orgId, frameworkId: row!.id, requirementId, requirementText, category, priority, implementationDeadline: deadline,
    })))
  }
}

function craftResponses(scores: { domain: string; tierLevel: number; evidenceUploaded: boolean; notApplicable: boolean }[]) {
  return scores.map((s) => ({ criterionId: s.domain, score: s.notApplicable ? null : s.tierLevel, evidence: s.evidenceUploaded, notApplicable: s.notApplicable }))
}

// --- ESG Report Quality Checklist helpers ------------------------------------------------------
function qaProfile(v: any): QaProfile {
  if (!v || typeof v !== 'object') throw bad('profile required')
  const j = jurisdictionByCode(String(v.jurisdiction ?? ''))
  if (!j) throw bad('unknown jurisdiction')
  if (!j.categories.some((x) => x.id === v.category)) throw bad('unknown entity category for this jurisdiction')
  const flag = (k: string) => v[k] === true
  return {
    jurisdiction: j.code, category: String(v.category), adoptingVoluntarily: flag('adoptingVoluntarily'), financialActivities: flag('financialActivities'),
    secScope: j.code === 'NG' && flag('secScope'), mofiScope: j.code === 'NG' && flag('mofiScope'), mofiOverlay: j.code === 'NG' && flag('mofiOverlay'),
  }
}

async function loadQaPeriod(orgId: number, wsId: number, id: number) {
  const [p] = await db.select().from(qaPeriods).where(and(eq(qaPeriods.id, id), eq(qaPeriods.orgId, orgId), eq(qaPeriods.workspaceId, wsId)))
  if (!p) throw new HttpError(404, 'Not found')
  return p
}

const qaApplicable = (p: { profile: unknown; periodStart: string }) => applicableChecks(p.profile as QaProfile, p.periodStart).checks

async function qaEvidenceState(orgId: number, wsId: number, evidenceId: number | null): Promise<EvidenceState> {
  if (!evidenceId) return 'none'
  const [e] = await db.select().from(evidenceRegistry).where(and(eq(evidenceRegistry.id, evidenceId), eq(evidenceRegistry.orgId, orgId), eq(evidenceRegistry.workspaceId, wsId)))
  if (!e || e.archivedAt) return 'none'
  if (isVerificationEvidence(e)) return 'accepted'
  return e.status === 'rejected' || evidenceExpiryState(e.expiryDate) === 'expired' ? 'rejected' : 'pending'
}

async function buildQaView(orgId: number, wsId: number, p: typeof qaPeriods.$inferSelect, signedOff = false): Promise<QaView & { checks: unknown[]; legacy: typeof LEGACY_CHECKS_STATUS; actions: Record<string, number | null>; revisionOf: number | null; revisionReason: string }> {
  const profile = p.profile as unknown as QaProfile
  const { applicability, checks } = applicableChecks(profile, p.periodStart)
  const items = await db.select().from(qaCheckInstances).where(and(eq(qaCheckInstances.orgId, orgId), eq(qaCheckInstances.periodId, p.id)))
  const byId = new Map(items.map((i) => [i.checkId, i]))
  const [org] = await db.select().from(wsOrganizations).where(eq(wsOrganizations.id, orgId))
  const evidence = new Map<number, EvidenceState>()
  for (const i of items) if (i.evidenceId && !evidence.has(i.evidenceId)) evidence.set(i.evidenceId, await qaEvidenceState(orgId, wsId, i.evidenceId))
  const instances: CheckInstance[] = checks.map(({ check }) => {
    const i = byId.get(check.id)
    return { checkId: check.id, status: (i?.status ?? 'not_started') as CheckStatus, evidence: i?.evidenceId ? evidence.get(i.evidenceId)! : 'none', naApproved: !!i?.naApprovedBy }
  })
  const summary = scoreChecklist(checks, instances, signedOff)
  const j = jurisdictionByCode(profile.jurisdiction)!
  // Corrective actions raised from this period's checks.
  const instIds = items.map((i) => i.id)
  const caps = instIds.length ? await db.select().from(capRecords).where(and(eq(capRecords.orgId, orgId), eq(capRecords.workspaceId, wsId), eq(capRecords.sourceType, 'qa_check'), inArray(capRecords.sourceId, instIds))) : []
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null)
  const openCaps = caps.filter((x) => x.status !== 'completed')
  const doneCaps = caps.filter((x) => x.status === 'completed')
  const reviewed = caps.filter((x) => x.effectivenessStatus === 'effective' || x.effectivenessStatus === 'not_effective')
  const actions = {
    total: caps.length,
    open: openCaps.length,
    overdueRate: pct(openCaps.filter((x) => effectiveCapStatus(x.status, x.dueDate) === 'overdue').length, openCaps.length),
    onTimeCompletion: pct(doneCaps.filter((x) => !x.dueDate || (x.completionDate && x.completionDate.toISOString().slice(0, 10) <= x.dueDate)).length, doneCaps.length),
    effectivenessPassRate: pct(reviewed.filter((x) => x.effectivenessStatus === 'effective').length, reviewed.length),
  }
  const rows = checks.map(({ check, mandatory, label, reason }, n) => {
    const i = byId.get(check.id)
    return {
      id: check.id, pack: check.pack, title: check.title, label, severity: check.severity, mandatory, reason, acceptance: check.acceptance, evidenceExamples: check.evidence,
      provisional: !!check.provisional, weight: checkWeight(check),
      status: instances[n].status, evidenceState: instances[n].evidence, evidenceId: i?.evidenceId ?? null, owner: i?.owner ?? null, reviewer: i?.reviewer ?? null,
      dueDate: i?.dueDate ?? null, naReason: i?.naReason ?? '', naApprovedBy: i?.naApprovedBy ?? null, blocker: i?.blocker ?? '', notes: i?.notes ?? '',
    }
  })
  return {
    period: { label: p.label, periodStart: p.periodStart, periodEnd: p.periodEnd, status: p.status, approvedBy: p.approvedBy, approvedAt: p.approvedAt?.toISOString() ?? null, preparedBy: p.preparedBy },
    organisation: org?.name ?? '', applicability, jurisdiction: { name: j.name, sourceTitle: j.sourceTitle }, summary, rows,
    checks: rows, legacy: LEGACY_CHECKS_STATUS, actions, revisionOf: p.revisionOf, revisionReason: p.revisionReason,
  }
}

function declaredDocumentKind(v: unknown): string | null {
  if (v == null || v === '') return null
  if (!kindById(String(v))) throw bad('unknown documentKind')
  return String(v)
}

// Root cause, expected outcome, resources, dependencies and residual risk on a CAP.
function capDetailFields(body: Record<string, any>) {
  const out: Record<string, string> = {}
  for (const k of ['rootCause', 'expectedOutcome', 'resources', 'dependencies', 'residualRisk'] as const) {
    if (body[k] !== undefined) out[k] = str(body[k], k, 4000, false)
  }
  return out
}

async function loadSecPlan(orgId: number, wsId: number) {
  await ensureEsgCatalogue(orgId, wsId)
  const [fw] = await db.select().from(esgFrameworks).where(and(eq(esgFrameworks.orgId, orgId), eq(esgFrameworks.workspaceId, wsId), eq(esgFrameworks.frameworkName, SEC_NG_FRAMEWORK)))
  const reqs = await db.select().from(esgRequirements).where(and(eq(esgRequirements.orgId, orgId), eq(esgRequirements.frameworkId, fw.id))).orderBy(asc(esgRequirements.requirementId))
  const plans = reqs.length ? await db.select().from(esgImplementationPlans).where(and(eq(esgImplementationPlans.orgId, orgId), eq(esgImplementationPlans.workspaceId, wsId), inArray(esgImplementationPlans.requirementId, reqs.map((r) => r.id)))) : []
  const ms = plans.length ? await db.select().from(esgMilestones).where(and(eq(esgMilestones.orgId, orgId), inArray(esgMilestones.planId, plans.map((p) => p.id)))).orderBy(asc(esgMilestones.milestoneNum)) : []
  const rows: (PlanRow & { requirementDbId: number; planId: number | null })[] = reqs.map((r) => {
    const p = plans.find((x) => x.requirementId === r.id)
    return {
      requirementDbId: r.id, planId: p?.id ?? null, requirementId: r.requirementId, requirementText: r.requirementText,
      owner: p?.owner ?? null, status: p?.status ?? 'not_started', timelineStart: p?.timelineStart ?? null, timelineEnd: p?.timelineEnd ?? null,
      milestones: p ? ms.filter((m) => m.planId === p.id).map((m) => ({ milestoneNum: m.milestoneNum, description: m.description, targetDate: m.targetDate, status: m.status, completionEvidenceLink: m.completionEvidenceLink })) : [],
    }
  })
  return { fw, rows, settings: fw.settings as Partial<PlanSettings> }
}

// --- report snapshot --------------------------------------------------------------------------------
async function buildSnapshot(orgId: number, wsId: number) {
  const [findings, caps, evidence, plans] = await Promise.all([
    db.select({ severity: governanceFindings.severity, status: governanceFindings.status })
      .from(governanceFindings)
      .innerJoin(governanceAssessments, eq(governanceAssessments.id, governanceFindings.assessmentId))
      .where(and(eq(governanceFindings.orgId, orgId), eq(governanceAssessments.workspaceId, wsId))),
    db.select().from(capRecords).where(and(eq(capRecords.orgId, orgId), eq(capRecords.workspaceId, wsId))),
    db.select().from(evidenceRegistry).where(and(eq(evidenceRegistry.orgId, orgId), eq(evidenceRegistry.workspaceId, wsId), isNull(evidenceRegistry.archivedAt))),
    db.select({ status: esgImplementationPlans.status }).from(esgImplementationPlans)
      .where(and(eq(esgImplementationPlans.orgId, orgId), eq(esgImplementationPlans.workspaceId, wsId))),
  ])
  const open: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const f of findings) if (f.status !== 'resolved') open[f.severity] = (open[f.severity] ?? 0) + 1
  const cap = summarizeCaps(caps.map((c) => ({ ...c, dueDate: c.dueDate })))
  const expiry = evidence
    .map((e) => ({ id: e.id, name: e.documentName, expiryDate: e.expiryDate, state: evidenceExpiryState(e.expiryDate) }))
    .filter((e) => e.state === 'expired' || e.state === 'expiring')
  const esgDone = plans.filter((p) => p.status === 'completed').length
  return {
    open_findings_by_severity: open,
    cap_progress: cap,
    esg_progress: { plans: plans.length, completed: esgDone, percent: plans.length ? Math.round((esgDone / plans.length) * 100) : 0 },
    compliance_percent: cap.percentComplete,
    pending_evidence_review: evidence.filter((e) => e.status === 'pending_review').length,
    expiry_alerts: expiry,
  }
}

async function generateReport(c: Ctx, orgId: number, wsId: number, caller: Caller, reportType: string) {
  const snapshot: Record<string, unknown> = await buildSnapshot(orgId, wsId)
  if (reportType === 'audit_trail') {
    snapshot.audit_entries = await db.select().from(wsAuditLog)
      .where(and(eq(wsAuditLog.orgId, orgId), eq(wsAuditLog.workspaceId, wsId))).orderBy(desc(wsAuditLog.id)).limit(5000)
  }
  const [report] = await db.insert(reports).values({
    orgId, workspaceId: wsId, reportType, generatedBy: caller.email, dataAsOfDate: today(), statusSnapshot: snapshot,
  }).returning()
  const [org] = await db.select({ name: wsOrganizations.name }).from(wsOrganizations).where(eq(wsOrganizations.id, orgId))
  const pdfBytes = await renderReportPdf({
    reportType, organizationName: org?.name ?? 'Organization', dataAsOfDate: report.dataAsOfDate,
    generatedAt: report.generatedAt, snapshot,
  })
  const pdfKey = `reports/${orgId}/${wsId}/${report.id}/v1.pdf`
  await getStore('reports').set(pdfKey, new Uint8Array(pdfBytes).buffer, { metadata: { contentType: 'application/pdf' } })
  const [createdVersion] = await db.insert(reportVersions).values({
    orgId, reportId: report.id, versionNum: 1,
    jsonExportUrl: `/api/workspaces/${wsId}/reports/${report.id}`,
  }).returning()
  const [version] = await db.update(reportVersions).set({
    pdfUrl: `/api/workspaces/${wsId}/reports/${report.id}/pdf?version=${createdVersion.versionNum}`,
  }).where(and(eq(reportVersions.orgId, orgId), eq(reportVersions.id, createdVersion.id))).returning()
  await audit(c, orgId, wsId, 'report', report.id, 'create', { reportType })
  return json({ ...report, versions: [version] }, 201)
}

// ============================================================================
// Route table
// ============================================================================
const W = '/workspaces/:ws'
const A = `${W}/assessments/:id`
const routes: Route[] = [
  { method: 'GET', pattern: `${W}/offline-frameworks`, access: 'viewer', scope: 'workspace',
    handler: (_c, { caller, orgId, wsId, role }) => listOfflineFrameworks(caller, orgId, wsId, role) },
  { method: 'POST', pattern: `${W}/offline-frameworks/mutations`, access: 'admin', scope: 'workspace',
    handler: (c, { caller, orgId, wsId }) => mutateOfflineFramework(caller, orgId, wsId, c.body) },
  { method: 'GET', pattern: '/privacy/export', access: 'authed', handler: (c, { caller }) => exportDataForCaller(c, caller) },
  { method: 'GET', pattern: '/privacy/erasure-requests', access: 'authed', handler: async (_c, { caller }) => {
    const memberships = await db.select({ orgId: wsOrgMembers.orgId, role: wsOrgMembers.role }).from(wsOrgMembers)
      .where(memberEmailFilter(caller.email))
    const orgIds = memberships.filter((membership) => membership.role === 'owner' || membership.role === 'admin')
      .map((membership) => membership.orgId)
    const own = await db.select().from(gdprRequests).where(eq(gdprRequests.requestedBy, caller.email))
    const managed = caller.role === 'super_admin'
      ? await db.select().from(gdprRequests)
      : orgIds.length ? await db.select().from(gdprRequests).where(inArray(gdprRequests.orgId, orgIds)) : []
    if (memberships.length) {
      for (const membership of memberships) await audit(_c, membership.orgId, null, 'gdpr_erasure', null, 'read')
    } else {
      await db.insert(auditLogs).values({ actor: caller.email, action: 'read erasure requests', target: 'GDPR requests', category: 'Privacy' })
    }
    return json([...new Map([...own, ...managed].map((request) => [request.id, request])).values()])
  } },
  { method: 'POST', pattern: '/privacy/erasure-requests', access: 'authed', handler: async (c, { caller }) => {
    const orgId = intParam(String(c.body.orgId))
    await requireOrgAccess(caller, orgId, 'viewer')
    const [pending] = await db.select().from(gdprRequests).where(and(
      eq(gdprRequests.orgId, orgId), eq(gdprRequests.requestedBy, caller.email), eq(gdprRequests.status, 'pending'),
    ))
    if (pending) {
      await audit(c, orgId, null, 'gdpr_erasure', pending.id, 'read')
      return json(pending)
    }
    const [request] = await db.insert(gdprRequests).values({ orgId, requestedBy: caller.email, requestType: 'erasure' }).returning()
    await audit(c, orgId, null, 'gdpr_erasure', request.id, 'create')
    return json(request, 201)
  } },
  { method: 'POST', pattern: '/privacy/erasure-requests/:id/approve', access: 'authed', handler: (c, { caller }) =>
    approveErasureRequest(c, caller, intParam(c.p[0])) },

  // ---------------------------- 2.1 Organizations ----------------------------
  { method: 'GET', pattern: '/orgs', access: 'authed', handler: async (_c, { caller }) => {
    const rows = await db.select({ org: wsOrganizations, role: wsOrgMembers.role }).from(wsOrgMembers)
      .innerJoin(wsOrganizations, eq(wsOrganizations.id, wsOrgMembers.orgId))
      .where(memberEmailFilter(caller.email))
    return json(rows.map((r) => ({ ...exposeOrganization(r.org), role: r.role })))
  } },
  { method: 'POST', pattern: '/orgs', access: 'authed', handler: async (c, { caller }) => {
    if (!isVerifiedOrgEmailDomain(caller.email)) throw new HttpError(403, 'An organizational (non-consumer) email domain is required to create an organization')
    const type = oneOf(c.body.type, 'type', ['government', 'ngo', 'private'] as const, 'private')
    const [org] = await db.insert(wsOrganizations).values({
      name: str(c.body.name, 'name', 200), type, country: str(c.body.country, 'country', 100, false),
      region: str(c.body.region, 'region', 100, false), contactEmail: encryptField(str(c.body.contactEmail, 'contactEmail', 200, false) || caller.email),
      contactPhone: encryptField(str(c.body.contactPhone, 'contactPhone', 50, false)),
    }).returning()
    await db.insert(wsOrgMembers).values({ userId: encryptField(caller.email), userIdHash: fieldLookupHashes(caller.email)[0] ?? null, orgId: org.id, role: 'owner' })
    const [ws] = await db.insert(workspaces).values({ orgId: org.id, workspaceName: 'Main workspace' }).returning()
    await audit(c, org.id, ws.id, 'org', org.id, 'create', { name: org.name })
    return json({ ...exposeOrganization(org), role: 'owner', defaultWorkspaceId: ws.id }, 201)
  } },
  { method: 'PUT', pattern: '/orgs/:org', access: 'admin', scope: 'org', handler: async (c, { orgId }) => {
    const set: Record<string, unknown> = {}
    if (c.body.name !== undefined) set.name = str(c.body.name, 'name', 200)
    if (c.body.type !== undefined) set.type = oneOf(c.body.type, 'type', ['government', 'ngo', 'private'] as const)
    for (const k of ['country', 'region', 'contactEmail', 'contactPhone'] as const) if (c.body[k] !== undefined) {
      const value = str(c.body[k], k, 200, false)
      set[k] = k === 'contactEmail' || k === 'contactPhone' ? encryptField(value) : value
    }
    if (!Object.keys(set).length) throw bad('nothing to update')
    const [org] = await db.update(wsOrganizations).set(set).where(eq(wsOrganizations.id, orgId)).returning()
    await audit(c, orgId, null, 'org', orgId, 'update', { fields: Object.keys(set) })
    return json(exposeOrganization(org))
  } },
  { method: 'GET', pattern: '/orgs/:org/members', access: 'viewer', scope: 'org', handler: async (_c, { orgId }) =>
    json((await db.select().from(wsOrgMembers).where(eq(wsOrgMembers.orgId, orgId)).orderBy(asc(wsOrgMembers.id))).map(exposeMember)) },
  { method: 'POST', pattern: '/orgs/:org/members', access: 'admin', scope: 'org', handler: async (c, { orgId, role, caller }) => {
    const email = str(c.body.email, 'email', 200).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('email invalid')
    const target = oneOf(c.body.role, 'role', ['owner', 'admin', 'assessor', 'viewer'] as const, 'viewer')
    if (!canAssignRole(role, target)) throw new HttpError(403, 'Cannot assign that role')
    const [existing] = await db.select().from(wsOrgMembers).where(and(eq(wsOrgMembers.orgId, orgId), memberEmailFilter(email)))
    if (existing && existing.role === 'owner' && role !== 'owner') throw new HttpError(403, 'Only an owner can change an owner')
    if (existing && existing.role === 'owner' && target !== 'owner') {
      const owners = await db.select({ id: wsOrgMembers.id }).from(wsOrgMembers).where(and(eq(wsOrgMembers.orgId, orgId), eq(wsOrgMembers.role, 'owner')))
      if (owners.length < 2) throw new HttpError(409, 'Cannot demote the last owner')
    }
    const [m] = existing
      ? await db.update(wsOrgMembers).set({ role: target }).where(eq(wsOrgMembers.id, existing.id)).returning()
      : await db.insert(wsOrgMembers).values({
        userId: encryptField(email), userIdHash: fieldLookupHashes(email)[0] ?? null, orgId, role: target,
      }).returning()
    await audit(c, orgId, null, 'org', orgId, existing ? 'update' : 'create', { memberHash: fieldLookupHashes(email)[0] ?? 'legacy', role: target, by: caller.email })
    return json(exposeMember(m), existing ? 200 : 201)
  } },
  { method: 'DELETE', pattern: '/orgs/:org/members/:member', access: 'admin', scope: 'org', handler: async (c, { orgId, role }) => {
    const [m] = await db.select().from(wsOrgMembers).where(and(eq(wsOrgMembers.id, intParam(c.p[1])), eq(wsOrgMembers.orgId, orgId)))
    if (!m) throw new HttpError(404, 'Not found')
    if (m.role === 'owner') {
      if (role !== 'owner') throw new HttpError(403, 'Only an owner can remove an owner')
      const owners = await db.select({ id: wsOrgMembers.id }).from(wsOrgMembers).where(and(eq(wsOrgMembers.orgId, orgId), eq(wsOrgMembers.role, 'owner')))
      if (owners.length < 2) throw new HttpError(409, 'Cannot remove the last owner')
    }
    await db.delete(wsOrgMembers).where(eq(wsOrgMembers.id, m.id))
    await audit(c, orgId, null, 'org', orgId, 'delete', { memberHash: m.userIdHash ?? 'legacy' })
    return json({ ok: true })
  } },
  { method: 'GET', pattern: '/orgs/:org/workspaces', access: 'viewer', scope: 'org', handler: async (_c, { orgId }) =>
    json(await db.select().from(workspaces).where(eq(workspaces.orgId, orgId)).orderBy(desc(workspaces.id))) },
  { method: 'POST', pattern: '/orgs/:org/workspaces', access: 'admin', scope: 'org', handler: async (c, { orgId }) => {
    const [ws] = await db.insert(workspaces).values({
      orgId, workspaceName: str(c.body.workspaceName, 'workspaceName', 200), description: str(c.body.description, 'description', 1000, false),
    }).returning()
    await audit(c, orgId, ws.id, 'org', ws.id, 'create', { workspace: ws.workspaceName })
    return json(ws, 201)
  } },

  // ---------------------------- 2.2 Governance ----------------------------
  { method: 'GET', pattern: `${W}/assessments`, access: 'viewer', scope: 'workspace', handler: async (_c, { orgId, wsId }) =>
    json(await db.select().from(governanceAssessments).where(and(eq(governanceAssessments.orgId, orgId), eq(governanceAssessments.workspaceId, wsId))).orderBy(desc(governanceAssessments.id))) },
  { method: 'POST', pattern: `${W}/assessments`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const assessmentType = oneOf(c.body.assessmentType, 'assessmentType', ['G2G', 'ISO', 'COSO', 'CRAFT'] as const, 'G2G')
    const reportingPeriod = str(c.body.reportingPeriod, 'reportingPeriod', 50, false)
    if (c.body.innovationSupport !== undefined && typeof c.body.innovationSupport !== 'boolean') throw bad('innovationSupport must be boolean')
    const innovationSupport = assessmentType === 'CRAFT' && c.body.innovationSupport === true
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(governanceAssessments)
      .where(and(eq(governanceAssessments.orgId, orgId), eq(governanceAssessments.workspaceId, wsId), eq(governanceAssessments.assessmentType, assessmentType)))
    const [a] = await db.insert(governanceAssessments).values({ orgId, workspaceId: wsId, assessmentType, reportingPeriod, innovationSupport, version: n + 1, createdBy: caller.email }).returning()
    await audit(c, orgId, wsId, 'assessment', a.id, 'create', { assessmentType })
    return json(a, 201)
  } },
  { method: 'GET', pattern: A, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const a = await loadAssessment(orgId, wsId, intParam(c.p[1]))
    const [scores, findings] = await Promise.all([
      db.select().from(governanceScores).where(and(eq(governanceScores.orgId, orgId), eq(governanceScores.assessmentId, a.id))),
      db.select().from(governanceFindings).where(and(eq(governanceFindings.orgId, orgId), eq(governanceFindings.assessmentId, a.id))),
    ])
    return json({
      ...a,
      scores: scores.map((s) => ({ ...s, reviewerNotes: decryptField(s.reviewerNotes) })),
      findings: findings.map((f) => ({ ...f, description: decryptField(f.description) })),
    })
  } },
  { method: 'PUT', pattern: `${A}/scores/:pillar/:domain`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const a = await loadAssessment(orgId, wsId, intParam(c.p[1]))
    if (a.status !== 'draft') throw new HttpError(409, 'Assessment is locked for review')
    const pillar = str(decodeURIComponent(c.p[2]), 'pillar', 100)
    const domain = str(decodeURIComponent(c.p[3]), 'domain', 100)
    const notApplicable = c.body.notApplicable === true
    let score = Number(c.body.score)
    if (a.assessmentType === 'CRAFT') {
      // CRAFT Governance Scorecard: pillar/criterion must exist; N/A needs a reason; otherwise a 1–5 rubric score.
      const crit = criterionById(domain)
      if (crit?.pillarId !== pillar) throw bad('unknown CRAFT pillar/criterion')
      if (crit.appliesTo === 'innovation_support' && !a.innovationSupport) throw bad('founder-protection criteria apply only to assessments of institutions that fund or support innovation')
      if (notApplicable) score = 1
      else if (!Number.isInteger(score) || score < 1 || score > 5) throw bad('score must be an integer 1-5')
    } else if (!Number.isFinite(score) || score < 0 || score > 5) throw bad('score must be 0-5')
    const naReason = notApplicable ? str(c.body.naReason, 'naReason', 1000) : ''
    const values = {
      tierLevel: tierFromScore(score), evidenceUploaded: !notApplicable && !!c.body.evidenceUploaded,
      reviewerNotes: encryptField(str(c.body.reviewerNotes, 'reviewerNotes', 2000, false)), notApplicable, naReason,
    }
    const [row] = await db.insert(governanceScores).values({ orgId, assessmentId: a.id, pillar, domain, ...values })
      .onConflictDoUpdate({ target: [governanceScores.assessmentId, governanceScores.pillar, governanceScores.domain], set: values }).returning()
    await audit(c, orgId, wsId, 'assessment', a.id, 'update', { pillar, domain, tier: row.tierLevel, by: caller.email })
    return json({ ...row, reviewerNotes: decryptField(row.reviewerNotes), suggestedSeverity: severityFromTier(row.tierLevel) })
  } },
  { method: 'POST', pattern: `${A}/findings`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const a = await loadAssessment(orgId, wsId, intParam(c.p[1]))
    if (a.status === 'approved') throw new HttpError(409, 'Assessment is approved')
    const domain = str(c.body.domain, 'domain', 100)
    let severity = c.body.severity
    if (severity == null) {
      // Derive from the domain's current score when not supplied ("create finding from low score").
      const [s] = await db.select().from(governanceScores).where(and(eq(governanceScores.orgId, orgId), eq(governanceScores.assessmentId, a.id), eq(governanceScores.domain, domain)))
      severity = s ? severityFromTier(s.tierLevel) : null
      if (!severity) throw bad('severity required (no low score for that domain)')
    }
    if (c.body.sensitive !== undefined && typeof c.body.sensitive !== 'boolean') throw bad('sensitive must be boolean')
    const sensitive = c.body.sensitive === true
    const [f] = await db.insert(governanceFindings).values({
      orgId, assessmentId: a.id, domain, severity: oneOf(severity, 'severity', SEVERITIES),
      description: sensitive ? encryptField(str(c.body.description, 'description', 4000)) : str(c.body.description, 'description', 4000),
      sensitive, recommendation: str(c.body.recommendation, 'recommendation', 4000, false),
      evidenceLink: str(c.body.evidenceLink, 'evidenceLink', 500, false) || null,
      ownerAssignment: str(c.body.ownerAssignment, 'ownerAssignment', 200, false) || null, dueDate: dateOrNull(c.body.dueDate, 'dueDate'),
    }).returning()
    await refreshFindingsCount(orgId, a.id)
    await audit(c, orgId, wsId, 'assessment', a.id, 'create', { finding: f.id })
    return json({ ...f, description: decryptField(f.description) }, 201)
  } },
  { method: 'PUT', pattern: `${A}/findings/:fid`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const a = await loadAssessment(orgId, wsId, intParam(c.p[1]))
    if (a.status === 'approved') throw new HttpError(409, 'Assessment is approved')
    const [existing] = await db.select().from(governanceFindings).where(and(
      eq(governanceFindings.id, intParam(c.p[2])), eq(governanceFindings.orgId, orgId), eq(governanceFindings.assessmentId, a.id),
    ))
    if (!existing) throw new HttpError(404, 'Not found')
    const set: Record<string, unknown> = {}
    const sensitive = c.body.sensitive === undefined ? existing.sensitive : c.body.sensitive
    if (typeof sensitive !== 'boolean') throw bad('sensitive must be boolean')
    if (c.body.sensitive !== undefined) set.sensitive = sensitive
    if (c.body.description !== undefined || c.body.sensitive !== undefined) {
      const description = c.body.description === undefined ? decryptField(existing.description) : str(c.body.description, 'description', 4000)
      set.description = sensitive ? (isEncryptedField(description) ? description : encryptField(description)) : description
    }
    if (c.body.severity !== undefined) set.severity = oneOf(c.body.severity, 'severity', SEVERITIES)
    if (c.body.status !== undefined) set.status = oneOf(c.body.status, 'status', ['open', 'in_progress', 'resolved'] as const)
    if (c.body.ownerAssignment !== undefined) set.ownerAssignment = str(c.body.ownerAssignment, 'ownerAssignment', 200, false) || null
    if (c.body.dueDate !== undefined) set.dueDate = dateOrNull(c.body.dueDate, 'dueDate')
    if (c.body.recommendation !== undefined) set.recommendation = str(c.body.recommendation, 'recommendation', 4000, false)
    if (c.body.evidenceLink !== undefined) set.evidenceLink = str(c.body.evidenceLink, 'evidenceLink', 500, false) || null
    if (!Object.keys(set).length) throw bad('nothing to update')
    const [f] = await db.update(governanceFindings).set(set)
      .where(and(eq(governanceFindings.id, intParam(c.p[2])), eq(governanceFindings.orgId, orgId), eq(governanceFindings.assessmentId, a.id))).returning()
    await audit(c, orgId, wsId, 'assessment', a.id, 'update', { finding: f.id, fields: Object.keys(set) })
    return json({ ...f, description: decryptField(f.description) })
  } },
  { method: 'GET', pattern: `${A}/scorecard`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const a = await loadAssessment(orgId, wsId, intParam(c.p[1]))
    const [scores, findings] = await Promise.all([
      db.select().from(governanceScores).where(and(eq(governanceScores.orgId, orgId), eq(governanceScores.assessmentId, a.id))),
      db.select().from(governanceFindings).where(and(eq(governanceFindings.orgId, orgId), eq(governanceFindings.assessmentId, a.id))),
    ])
    if (a.assessmentType === 'CRAFT') {
      const { findingsBySeverity } = buildScorecard([], findings)
      const opts = { innovationSupport: a.innovationSupport }
      const responses = craftResponses(scores)
      const vals = await db.select().from(governanceValidations).where(and(eq(governanceValidations.orgId, orgId), eq(governanceValidations.assessmentId, a.id))).orderBy(asc(governanceValidations.id))
      const validations = vals.map((v) => ({ ...v, ...validationDelta(responses, v.scores as ValidatorScores, opts) }))
      return json({ assessment: a, findingsBySeverity, validations, ...craftScorecard(responses, undefined, opts) })
    }
    return json({ assessment: a, ...buildScorecard(scores, findings) })
  } },
  { method: 'GET', pattern: `${W}/craft-scorecard/catalogue`, access: 'viewer', scope: 'workspace', handler: async () =>
    json({ pillars: Object.values(GOVERNANCE_PILLARS), criteria: GOVERNANCE_CRITERIA }) },
  { method: 'POST', pattern: `${A}/validations`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    // Independent (external) validation of an approved CRAFT assessment. Validators are usually
    // invited as viewers; they must declare independence and cannot be the assessment's creator.
    const a = await loadAssessment(orgId, wsId, intParam(c.p[1]))
    if (a.assessmentType !== 'CRAFT') throw bad('independent validation applies to CRAFT Governance Scorecard assessments')
    if (a.status !== 'approved') throw new HttpError(409, 'Only an approved assessment can be independently validated')
    if (a.createdBy === caller.email && caller.role !== 'super_admin') throw new HttpError(403, 'Segregation of duties: the assessment creator cannot validate it')
    if (c.body.independenceDeclared !== true) throw bad('The validator must declare independence from the assessed institution')
    const [dup] = await db.select({ id: governanceValidations.id }).from(governanceValidations)
      .where(and(eq(governanceValidations.orgId, orgId), eq(governanceValidations.assessmentId, a.id), eq(governanceValidations.validatorEmail, caller.email)))
    if (dup) throw new HttpError(409, 'You have already validated this assessment')
    const outcome = oneOf(c.body.outcome, 'outcome', VALIDATION_OUTCOMES)
    const notes = str(c.body.notes, 'notes', 4000, outcome !== 'validated')
    const allowed = new Set(activeCriteria({ innovationSupport: a.innovationSupport }).map((x) => x.id))
    const scores: ValidatorScores = {}
    if (c.body.scores != null) {
      if (typeof c.body.scores !== 'object' || Array.isArray(c.body.scores)) throw bad('scores must be an object of criterion re-scores')
      for (const [id, v] of Object.entries(c.body.scores as Record<string, any>)) {
        if (!allowed.has(id)) throw bad(`unknown criterion ${id}`)
        const score = Number(v?.score)
        if (!Number.isInteger(score) || score < 1 || score > 5) throw bad(`score for ${id} must be an integer 1-5`)
        scores[id] = { score, evidence: v?.evidence === true, comment: str(v?.comment, 'comment', 1000, false) }
      }
    }
    const [row] = await db.insert(governanceValidations).values({
      orgId, assessmentId: a.id, validatorEmail: caller.email, validatorName: str(c.body.validatorName, 'validatorName', 200),
      validatorOrganisation: str(c.body.validatorOrganisation, 'validatorOrganisation', 200, false), independenceDeclared: true,
      scope: str(c.body.scope, 'scope', 2000, false), method: oneOf(c.body.method, 'method', VALIDATION_METHODS), outcome, notes, scores,
    }).returning()
    const scoreRows = await db.select().from(governanceScores).where(and(eq(governanceScores.orgId, orgId), eq(governanceScores.assessmentId, a.id)))
    await audit(c, orgId, wsId, 'assessment', a.id, 'update', { externalValidation: row.id, outcome, reScored: Object.keys(scores).length })
    return json({ ...row, ...validationDelta(craftResponses(scoreRows), scores, { innovationSupport: a.innovationSupport }) }, 201)
  } },
  { method: 'GET', pattern: `${W}/craft-scorecard/history`, access: 'viewer', scope: 'workspace', handler: async (_c, { orgId, wsId }) => {
    // Every CRAFT assessment version with its own score: earlier results are never recalculated away.
    const list = await db.select().from(governanceAssessments).where(and(eq(governanceAssessments.orgId, orgId), eq(governanceAssessments.workspaceId, wsId), eq(governanceAssessments.assessmentType, 'CRAFT'))).orderBy(asc(governanceAssessments.version))
    const ids = list.map((x) => x.id)
    const scores = ids.length ? await db.select().from(governanceScores).where(and(eq(governanceScores.orgId, orgId), inArray(governanceScores.assessmentId, ids))) : []
    const vals = ids.length ? await db.select().from(governanceValidations).where(and(eq(governanceValidations.orgId, orgId), inArray(governanceValidations.assessmentId, ids))).orderBy(desc(governanceValidations.id)) : []
    return json(list.map((x) => {
      const r = craftScorecard(craftResponses(scores.filter((s) => s.assessmentId === x.id)), undefined, { innovationSupport: x.innovationSupport })
      const v = vals.find((y) => y.assessmentId === x.id)
      return { id: x.id, version: x.version, reportingPeriod: x.reportingPeriod, innovationSupport: x.innovationSupport, validation: v ? { outcome: v.outcome, validatorOrganisation: v.validatorOrganisation, at: v.createdAt } : null, status: x.status, startedAt: x.startedAt, overall: r.overall, rating: r.rating?.level ?? null, completeness: r.completeness, pillars: r.pillars.map((p) => ({ id: p.id, score: p.score })) }
    }))
  } },
  { method: 'POST', pattern: `${A}/submit`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const a = await loadAssessment(orgId, wsId, intParam(c.p[1]))
    if (a.status !== 'draft') throw new HttpError(409, 'Only draft assessments can be submitted')
    const [u] = await db.update(governanceAssessments).set({ status: 'in_review', completedAt: new Date() }).where(eq(governanceAssessments.id, a.id)).returning()
    await audit(c, orgId, wsId, 'assessment', a.id, 'update', { status: 'in_review' })
    return json(u)
  } },
  { method: 'POST', pattern: `${A}/approve`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const a = await loadAssessment(orgId, wsId, intParam(c.p[1]))
    if (a.status !== 'in_review') throw new HttpError(409, 'Only assessments in review can be approved')
    if (a.createdBy === caller.email && caller.role !== 'super_admin') throw new HttpError(403, 'Segregation of duties: the creator cannot approve their own assessment')
    await db.update(governanceScores).set({ verifiedAt: new Date() }).where(and(eq(governanceScores.orgId, orgId), eq(governanceScores.assessmentId, a.id)))
    const [u] = await db.update(governanceAssessments).set({ status: 'approved' }).where(eq(governanceAssessments.id, a.id)).returning()
    await audit(c, orgId, wsId, 'assessment', a.id, 'update', { status: 'approved' })
    return json(u)
  } },
  { method: 'POST', pattern: `${A}/reject`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const a = await loadAssessment(orgId, wsId, intParam(c.p[1]))
    if (a.status !== 'in_review') throw new HttpError(409, 'Only assessments in review can be rejected')
    const [u] = await db.update(governanceAssessments).set({ status: 'draft', completedAt: null }).where(eq(governanceAssessments.id, a.id)).returning()
    await audit(c, orgId, wsId, 'assessment', a.id, 'update', { status: 'draft', comments: str(c.body.comments, 'comments', 2000, false) })
    return json(u)
  } },

  // ---------------------------- 2.3 ESG ----------------------------
  { method: 'GET', pattern: `${W}/esg-frameworks`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    await ensureEsgCatalogue(orgId, wsId)
    const jurisdiction = c.url.searchParams.get('jurisdiction')
    const rows = await db.select().from(esgFrameworks).where(and(eq(esgFrameworks.orgId, orgId), eq(esgFrameworks.workspaceId, wsId)))
    const withMeta = rows.map((r) => ({ ...r, meta: catalogueMeta(r.frameworkName) }))
    return json(jurisdiction ? withMeta.filter((r) => r.jurisdiction.toLowerCase() === jurisdiction.toLowerCase()) : withMeta)
  } },
  { method: 'POST', pattern: `${W}/esg-frameworks/:id/adopt`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const [f] = await db.update(esgFrameworks).set({ adoptionStatus: 'adopted' })
      .where(and(eq(esgFrameworks.id, intParam(c.p[1])), eq(esgFrameworks.orgId, orgId), eq(esgFrameworks.workspaceId, wsId))).returning()
    if (!f) throw new HttpError(404, 'Not found')
    await audit(c, orgId, wsId, 'org', f.id, 'update', { adopted: f.frameworkName })
    return json(f)
  } },
  { method: 'GET', pattern: `${W}/esg-requirements`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const sector = c.url.searchParams.get('sector')
    const rows = await db.select({ req: esgRequirements, fw: esgFrameworks }).from(esgRequirements)
      .innerJoin(esgFrameworks, eq(esgFrameworks.id, esgRequirements.frameworkId))
      .where(and(eq(esgRequirements.orgId, orgId), eq(esgFrameworks.workspaceId, wsId), eq(esgFrameworks.adoptionStatus, 'adopted')))
    const plans = await db.select().from(esgImplementationPlans).where(and(eq(esgImplementationPlans.orgId, orgId), eq(esgImplementationPlans.workspaceId, wsId)))
    const planByReq = new Map(plans.map((p) => [p.requirementId, p]))
    return json(rows.map(({ req, fw }) => ({
      ...req, frameworkName: fw.frameworkName,
      // Sector-specific frameworks only apply once the workspace states a sector.
      applicable: fw.applicability === 'all' || !!sector,
      plan: planByReq.get(req.id) ?? null,
    })))
  } },
  { method: 'POST', pattern: `${W}/esg-requirements/:id/create-plan`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const r = await loadRequirement(orgId, wsId, intParam(c.p[1]))
    const [dup] = await db.select({ id: esgImplementationPlans.id }).from(esgImplementationPlans)
      .where(and(eq(esgImplementationPlans.orgId, orgId), eq(esgImplementationPlans.workspaceId, wsId), eq(esgImplementationPlans.requirementId, r.id)))
    if (dup) throw new HttpError(409, 'A plan already exists for this requirement')
    const ms = [1, 2, 3].map((n) => str(c.body[`milestone${n}`], `milestone${n}`, 500, false) || null)
    const [plan] = await db.insert(esgImplementationPlans).values({
      orgId, workspaceId: wsId, requirementId: r.id, owner: str(c.body.owner, 'owner', 200, false) || null,
      timelineStart: dateOrNull(c.body.timelineStart, 'timelineStart'), timelineEnd: dateOrNull(c.body.timelineEnd, 'timelineEnd') ?? r.implementationDeadline,
      milestone1: ms[0], milestone2: ms[1], milestone3: ms[2],
    }).returning()
    await db.insert(esgMilestones).values(ms.map((m, i) => ({ orgId, planId: plan.id, milestoneNum: i + 1, description: m ?? '' })))
    await audit(c, orgId, wsId, 'org', plan.id, 'create', { esgPlanFor: r.requirementId })
    return json(plan, 201)
  } },
  { method: 'PUT', pattern: `${W}/esg-plans/:id`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const id = intParam(c.p[1])
    const set: Record<string, unknown> = {}
    if (c.body.status !== undefined) set.status = oneOf(c.body.status, 'status', ['not_started', 'in_progress', 'completed'] as const)
    if (c.body.owner !== undefined) set.owner = str(c.body.owner, 'owner', 200, false) || null
    if (c.body.timelineStart !== undefined) set.timelineStart = dateOrNull(c.body.timelineStart, 'timelineStart')
    if (c.body.timelineEnd !== undefined) set.timelineEnd = dateOrNull(c.body.timelineEnd, 'timelineEnd')
    for (const k of ['milestone1', 'milestone2', 'milestone3'] as const) if (c.body[k] !== undefined) set[k] = str(c.body[k], k, 500, false) || null
    if (c.body.evidenceCount !== undefined) {
      const n = Number(c.body.evidenceCount)
      if (!Number.isInteger(n) || n < 0) throw bad('evidenceCount invalid')
      set.evidenceCount = n
    }
    const [plan] = Object.keys(set).length
      ? await db.update(esgImplementationPlans).set(set).where(and(eq(esgImplementationPlans.id, id), eq(esgImplementationPlans.orgId, orgId), eq(esgImplementationPlans.workspaceId, wsId))).returning()
      : await db.select().from(esgImplementationPlans).where(and(eq(esgImplementationPlans.id, id), eq(esgImplementationPlans.orgId, orgId), eq(esgImplementationPlans.workspaceId, wsId)))
    if (!plan) throw new HttpError(404, 'Not found')
    if (Array.isArray(c.body.milestones)) {
      for (const m of c.body.milestones.slice(0, 20)) {
        const mset: Record<string, unknown> = {}
        if (m.description !== undefined) mset.description = str(m.description, 'description', 500, false)
        if (m.targetDate !== undefined) mset.targetDate = dateOrNull(m.targetDate, 'targetDate')
        if (m.status !== undefined) mset.status = oneOf(m.status, 'status', ['not_started', 'in_progress', 'completed'] as const)
        if (m.completionEvidenceLink !== undefined) mset.completionEvidenceLink = str(m.completionEvidenceLink, 'completionEvidenceLink', 500, false) || null
        if (Object.keys(mset).length) await db.update(esgMilestones).set(mset)
          .where(and(eq(esgMilestones.orgId, orgId), eq(esgMilestones.planId, plan.id), eq(esgMilestones.milestoneNum, Number(m.milestoneNum))))
      }
    }
    await audit(c, orgId, wsId, 'org', plan.id, 'update', { esgPlan: true, fields: Object.keys(set) })
    return json(plan)
  } },
  { method: 'GET', pattern: `${W}/esg-roadmap`, access: 'viewer', scope: 'workspace', handler: async (_c, { orgId, wsId }) => {
    const rows = await db.select({ plan: esgImplementationPlans, req: esgRequirements }).from(esgImplementationPlans)
      .innerJoin(esgRequirements, eq(esgRequirements.id, esgImplementationPlans.requirementId))
      .where(and(eq(esgImplementationPlans.orgId, orgId), eq(esgImplementationPlans.workspaceId, wsId)))
    const planIds = rows.map((r) => r.plan.id)
    const ms = planIds.length ? await db.select().from(esgMilestones).where(and(eq(esgMilestones.orgId, orgId), inArray(esgMilestones.planId, planIds))) : []
    const items = rows.map(({ plan, req }) => {
      const mine = ms.filter((m) => m.planId === plan.id)
      const done = mine.filter((m) => m.status === 'completed').length
      return {
        planId: plan.id, requirementId: req.requirementId, text: req.requirementText, category: req.category,
        deadline: req.implementationDeadline, start: plan.timelineStart, end: plan.timelineEnd, status: plan.status,
        milestones: mine, percentComplete: plan.status === 'completed' ? 100 : mine.length ? Math.round((done / mine.length) * 100) : 0,
      }
    }).sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
    const byCategory: Record<string, { total: number; percent: number }> = {}
    for (const i of items) {
      const e = (byCategory[i.category] ??= { total: 0, percent: 0 })
      e.total++
      e.percent += i.percentComplete
    }
    for (const e of Object.values(byCategory)) e.percent = Math.round(e.percent / e.total)
    return json({ items, byCategory })
  } },

  // ---------------------------- 2.3b SEC Nigeria IFRS S1/S2 plan generator ----------------------------
  { method: 'GET', pattern: `${W}/esg-planner/sec-ng`, access: 'viewer', scope: 'workspace', handler: async (_c, { orgId, wsId }) => {
    const { fw, rows, settings } = await loadSecPlan(orgId, wsId)
    return json({ framework: { ...fw, meta: catalogueMeta(fw.frameworkName) }, settings, rows })
  } },
  { method: 'POST', pattern: `${W}/esg-planner/sec-ng`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const entityType = oneOf(c.body.entityType, 'entityType', ['public_company', 'spicmo', 'sme', 'other'] as const) as EntityType
    const readiness = oneOf(c.body.readiness, 'readiness', ['early', 'developing', 'advanced'] as const) as Readiness
    const horizon = oneOf(c.body.horizon, 'horizon', ['90d', '12m', '24m'] as const) as Horizon
    const startDate = dateOrNull(c.body.startDate, 'startDate') ?? today()
    let firstReportingYear: number | null = defaultFirstReportingYear(entityType)
    if (c.body.firstReportingYear != null && c.body.firstReportingYear !== '') {
      const y = Number(c.body.firstReportingYear)
      if (!Number.isInteger(y) || y < 2024 || y > 2040) throw bad('firstReportingYear must be a year between 2024 and 2040')
      firstReportingYear = y
    }
    const settings: PlanSettings = { organisationName: str(c.body.organisationName, 'organisationName', 200), entityType, readiness, horizon, startDate, firstReportingYear }
    const regenerate = c.body.regenerate === true
    const { fw, rows } = await loadSecPlan(orgId, wsId)
    await db.update(esgFrameworks).set({ adoptionStatus: 'adopted', settings: { ...settings } }).where(eq(esgFrameworks.id, fw.id))
    const gen = new Map(generateSecPlan(startDate, horizon).map((g) => [g.requirementId, g]))
    let created = 0, updated = 0
    for (const r of rows) {
      const g = gen.get(r.requirementId)
      if (!g) continue
      if (r.planId && !regenerate) continue // never overwrite an organisation's edits silently
      if (r.planId) {
        await db.update(esgImplementationPlans).set({ owner: g.owner, timelineStart: g.timelineStart, timelineEnd: g.timelineEnd }).where(eq(esgImplementationPlans.id, r.planId))
        for (const m of g.milestones) await db.update(esgMilestones).set({ description: m.description, targetDate: m.targetDate })
          .where(and(eq(esgMilestones.orgId, orgId), eq(esgMilestones.planId, r.planId), eq(esgMilestones.milestoneNum, m.milestoneNum)))
        updated++
      } else {
        const [plan] = await db.insert(esgImplementationPlans).values({
          orgId, workspaceId: wsId, requirementId: r.requirementDbId, owner: g.owner, timelineStart: g.timelineStart, timelineEnd: g.timelineEnd,
          milestone1: g.milestones[0].description, milestone2: g.milestones[1].description, milestone3: g.milestones[2].description,
        }).returning()
        await db.insert(esgMilestones).values(g.milestones.map((m) => ({ orgId, planId: plan.id, milestoneNum: m.milestoneNum, description: m.description, targetDate: m.targetDate })))
        created++
      }
    }
    await audit(c, orgId, wsId, 'org', fw.id, 'update', { secPlan: { entityType, readiness, horizon, startDate, firstReportingYear, created, updated } })
    const fresh = await loadSecPlan(orgId, wsId)
    return json({ created, updated, settings: fresh.settings, rows: fresh.rows }, created ? 201 : 200)
  } },
  { method: 'GET', pattern: `${W}/esg-planner/sec-ng/export`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const { rows, settings } = await loadSecPlan(orgId, wsId)
    if (!settings.entityType) throw new HttpError(409, 'Generate the plan before exporting it')
    await audit(c, orgId, wsId, 'org', wsId, 'read', { secPlanExport: c.url.searchParams.get('format') ?? 'doc' })
    if (c.url.searchParams.get('format') === 'csv') {
      return new Response(planCsv(rows, csvEscape), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ifrs-s1-s2-implementation-plan.csv"' } })
    }
    const doc = renderPlanDoc(settings as PlanSettings, rows, today())
    return new Response(doc, { headers: { 'Content-Type': 'application/msword; charset=utf-8', 'Content-Disposition': 'attachment; filename="ifrs-s1-s2-implementation-plan.doc"' } })
  } },

  // ---------------------------- 2.3c ESG Report Quality Checklist ----------------------------
  { method: 'GET', pattern: `${W}/qa/catalogue`, access: 'viewer', scope: 'workspace', handler: async () => json({
    version: CHECKLIST_VERSION, legacy: LEGACY_CHECKS_STATUS, classLabels: CLASS_LABELS, packLabels: PACK_LABELS, statusLabels: STATUS_LABELS,
    jurisdictions: JURISDICTIONS,
    checks: CHECKS.map(({ condition: _c, ...rest }) => rest),
  }) },
  { method: 'GET', pattern: `${W}/qa/periods`, access: 'viewer', scope: 'workspace', handler: async (_c, { orgId, wsId }) => {
    const list = await db.select().from(qaPeriods).where(and(eq(qaPeriods.orgId, orgId), eq(qaPeriods.workspaceId, wsId))).orderBy(desc(qaPeriods.periodStart))
    const out = []
    for (const [n, p] of list.entries()) {
      const v = p.status === 'final' && p.snapshot ? (p.snapshot as unknown as QaView) : await buildQaView(orgId, wsId, p)
      // Compare with the previous (older) period only when the basis is the same.
      const prev = list[n + 1]
      const prof = p.profile as any, pprof = prev?.profile as any
      const comparabilityWarning = !prev ? null
        : prof.jurisdiction !== pprof.jurisdiction || prof.category !== pprof.category ? `Entity basis differs from ${prev.label}; scores are not comparable.`
        : p.checklistVersion !== prev.checklistVersion ? `Checklist version differs from ${prev.label} (${prev.checklistVersion}); compare with care.` : null
      out.push({ id: p.id, label: p.label, periodStart: p.periodStart, periodEnd: p.periodEnd, status: p.status, jurisdiction: prof.jurisdiction, score: v.summary.score, band: v.summary.band, readyForApproval: v.summary.readyForApproval, revisionOf: p.revisionOf, comparabilityWarning })
    }
    return json(out)
  } },
  { method: 'POST', pattern: `${W}/qa/periods`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const label = str(c.body.label, 'label', 120)
    const periodStart = dateOrNull(c.body.periodStart, 'periodStart')
    const periodEnd = dateOrNull(c.body.periodEnd, 'periodEnd')
    if (!periodStart || !periodEnd || periodEnd <= periodStart) throw bad('periodStart and periodEnd are required, with the end after the start')
    const profile = qaProfile(c.body.profile)
    const [p] = await db.insert(qaPeriods).values({ orgId, workspaceId: wsId, label, periodStart, periodEnd, profile: { ...profile }, checklistVersion: CHECKLIST_VERSION, preparedBy: caller.email }).returning()
    // Carry-forward copies owners, reviewers and notes as suggestions only: statuses restart and evidence must be reconfirmed.
    if (c.body.copyFrom != null) {
      const prev = await loadQaPeriod(orgId, wsId, intParam(String(c.body.copyFrom)))
      const items = await db.select().from(qaCheckInstances).where(and(eq(qaCheckInstances.orgId, orgId), eq(qaCheckInstances.periodId, prev.id)))
      if (items.length) await db.insert(qaCheckInstances).values(items.map((i) => ({
        orgId, periodId: p.id, checkId: i.checkId, owner: i.owner, reviewer: i.reviewer,
        notes: i.notes ? `Carried forward from ${prev.label} — reconfirm: ${i.notes}`.slice(0, 4000) : '', updatedBy: caller.email,
      })))
    }
    await audit(c, orgId, wsId, 'org', p.id, 'create', { qaPeriod: label, jurisdiction: profile.jurisdiction, copyFrom: c.body.copyFrom ?? null })
    return json(p, 201)
  } },
  { method: 'GET', pattern: `${W}/qa/periods/:id`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const p = await loadQaPeriod(orgId, wsId, intParam(c.p[1]))
    // Finalised periods never silently recalculate: serve the frozen snapshot.
    return json(p.status === 'final' && p.snapshot ? { ...(p.snapshot as object), frozen: true, periodId: p.id } : { ...(await buildQaView(orgId, wsId, p)), frozen: false, periodId: p.id })
  } },
  { method: 'PUT', pattern: `${W}/qa/periods/:id/checks/:checkId`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId, caller, role }) => {
    const p = await loadQaPeriod(orgId, wsId, intParam(c.p[1]))
    if (p.status === 'final') throw new HttpError(409, 'Period is finalised; create a revised period to change it')
    const checkId = decodeURIComponent(c.p[2])
    const ac = qaApplicable(p).find((x) => x.check.id === checkId)
    if (!ac) throw bad('check is not applicable to this period')
    const [existing] = await db.select().from(qaCheckInstances).where(and(eq(qaCheckInstances.orgId, orgId), eq(qaCheckInstances.periodId, p.id), eq(qaCheckInstances.checkId, checkId)))
    const set: Record<string, unknown> = { updatedBy: caller.email, updatedAt: new Date() }
    for (const k of ['owner', 'reviewer'] as const) if (c.body[k] !== undefined) set[k] = str(c.body[k], k, 200, false) || null
    if (c.body.dueDate !== undefined) set.dueDate = dateOrNull(c.body.dueDate, 'dueDate')
    for (const k of ['notes', 'blocker'] as const) if (c.body[k] !== undefined) set[k] = str(c.body[k], k, 4000, false)
    if (c.body.evidenceId !== undefined) {
      if (c.body.evidenceId === null) set.evidenceId = null
      else set.evidenceId = (await loadEvidence(orgId, wsId, intParam(String(c.body.evidenceId)))).id
    }
    const merged = { status: existing?.status ?? 'not_started', notes: existing?.notes ?? '', blocker: existing?.blocker ?? '', evidenceId: existing?.evidenceId ?? null, ...set } as { status: string; notes: string; blocker: string; evidenceId: number | null }
    if (c.body.status !== undefined) {
      const status = oneOf(c.body.status, 'status', ['not_started', 'in_progress', 'met', 'partially_met', 'not_met', 'blocked', 'not_applicable', 'pending_review', 'returned', 'exception_approved'] as const)
      set.status = merged.status = status
      if (status === 'met' && await qaEvidenceState(orgId, wsId, merged.evidenceId) !== 'accepted') throw new HttpError(409, 'Met requires linked evidence accepted by an authorised reviewer')
      if (status === 'partially_met' && !merged.notes.trim()) throw bad('Partially met requires the unmet criteria in notes')
      if (status === 'not_met' && !merged.notes.trim()) throw bad('Not met requires the gap in notes')
      if (status === 'returned' && !merged.notes.trim()) throw bad('Returned requires what evidence is missing in notes')
      if (status === 'pending_review' && !merged.evidenceId) throw bad('Pending review requires linked evidence')
      if (status === 'exception_approved') {
        if (!hasMinRole(role, 'admin')) throw new HttpError(403, 'Only an admin can approve an exception')
        if (ac.mandatory) throw new HttpError(409, 'Exceptions can never waive a mandatory requirement')
        if (!merged.notes.trim()) throw bad('An exception requires its authorisation and reason in notes')
      }
      if (status === 'blocked' && !merged.blocker.trim()) throw bad('Blocked requires the blocker, its owner and the escalation date')
      if (status === 'not_applicable') {
        set.naReason = str(c.body.naReason, 'naReason', 2000)
        set.naSetBy = caller.email
        set.naApprovedBy = null
        set.naApprovedAt = null
      } else Object.assign(set, { naReason: '', naSetBy: null, naApprovedBy: null, naApprovedAt: null })
    }
    const [row] = existing
      ? await db.update(qaCheckInstances).set(set).where(eq(qaCheckInstances.id, existing.id)).returning()
      : await db.insert(qaCheckInstances).values({ orgId, periodId: p.id, checkId, ...set }).returning()
    await audit(c, orgId, wsId, 'org', p.id, 'update', { qaCheck: checkId, before: existing ? { status: existing.status, evidenceId: existing.evidenceId } : null, after: { status: row.status, evidenceId: row.evidenceId } })
    return json(row)
  } },
  { method: 'POST', pattern: `${W}/qa/periods/:id/checks/:checkId/approve-na`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const p = await loadQaPeriod(orgId, wsId, intParam(c.p[1]))
    if (p.status === 'final') throw new HttpError(409, 'Period is finalised')
    const checkId = decodeURIComponent(c.p[2])
    const [i] = await db.select().from(qaCheckInstances).where(and(eq(qaCheckInstances.orgId, orgId), eq(qaCheckInstances.periodId, p.id), eq(qaCheckInstances.checkId, checkId)))
    if (!i || i.status !== 'not_applicable') throw new HttpError(409, 'Only a check marked not applicable can be approved as such')
    if (i.naSetBy === caller.email && caller.role !== 'super_admin') throw new HttpError(403, 'Segregation of duties: the person who marked it not applicable cannot approve it')
    const [u] = await db.update(qaCheckInstances).set({ naApprovedBy: caller.email, naApprovedAt: new Date() }).where(eq(qaCheckInstances.id, i.id)).returning()
    await audit(c, orgId, wsId, 'org', p.id, 'update', { qaNaApproved: checkId, reason: i.naReason })
    return json(u)
  } },
  { method: 'POST', pattern: `${W}/qa/periods/:id/checks/:checkId/cap`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const p = await loadQaPeriod(orgId, wsId, intParam(c.p[1]))
    const checkId = decodeURIComponent(c.p[2])
    const ac = qaApplicable(p).find((x) => x.check.id === checkId)
    if (!ac) throw bad('check is not applicable to this period')
    let [i] = await db.select().from(qaCheckInstances).where(and(eq(qaCheckInstances.orgId, orgId), eq(qaCheckInstances.periodId, p.id), eq(qaCheckInstances.checkId, checkId)))
    if (!i) [i] = await db.insert(qaCheckInstances).values({ orgId, periodId: p.id, checkId, updatedBy: caller.email }).returning()
    const severity = ac.check.severity === 'critical' ? 'critical' : ac.check.severity
    const [cap] = await db.insert(capRecords).values({
      orgId, workspaceId: wsId, sourceType: 'qa_check', sourceId: i.id,
      findingDescription: str(c.body.findingDescription ?? `${p.label} · ${ac.check.id} ${ac.check.title}: ${ac.check.acceptance}`, 'findingDescription', 4000),
      severity, correctiveAction: str(c.body.correctiveAction, 'correctiveAction', 4000, false),
      assignedTo: str(c.body.assignedTo ?? i.owner, 'assignedTo', 200, false) || null, dueDate: dateOrNull(c.body.dueDate ?? i.dueDate, 'dueDate'),
      ...capDetailFields(c.body),
    }).returning()
    await audit(c, orgId, wsId, 'cap', cap.id, 'create', { sourceType: 'qa_check', qaPeriod: p.id, check: checkId })
    return json(cap, 201)
  } },
  { method: 'POST', pattern: `${W}/qa/periods/:id/finalise`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const p = await loadQaPeriod(orgId, wsId, intParam(c.p[1]))
    if (p.status === 'final') throw new HttpError(409, 'Period already finalised')
    if (p.preparedBy === caller.email && caller.role !== 'super_admin') throw new HttpError(403, 'Segregation of duties: the preparer cannot give final approval')
    const view = await buildQaView(orgId, wsId, p, true)
    if (!view.summary.readyForApproval) return json({ error: 'Approval blocked', blockers: view.summary.blockers }, 409)
    const approvedAt = new Date()
    const snapshot = { ...view, period: { ...view.period, status: 'final', approvedBy: caller.email, approvedAt: approvedAt.toISOString() } }
    const [u] = await db.update(qaPeriods).set({ status: 'final', approvedBy: caller.email, approvedAt, snapshot: snapshot as unknown as Record<string, unknown> }).where(eq(qaPeriods.id, p.id)).returning()
    await audit(c, orgId, wsId, 'org', p.id, 'update', { qaFinalised: p.label, score: view.summary.score })
    return json(u)
  } },
  { method: 'POST', pattern: `${W}/qa/periods/:id/revise`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const p = await loadQaPeriod(orgId, wsId, intParam(c.p[1]))
    if (p.status !== 'final') throw new HttpError(409, 'Only a finalised period can be revised')
    const reason = str(c.body.reason, 'reason', 2000)
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(qaPeriods).where(and(eq(qaPeriods.orgId, orgId), eq(qaPeriods.revisionOf, p.id)))
    const base = p.label.replace(/ \(revision \d+\)$/, '')
    const [r] = await db.insert(qaPeriods).values({
      orgId, workspaceId: wsId, label: `${base} (revision ${n + 1})`, periodStart: p.periodStart, periodEnd: p.periodEnd, profile: p.profile,
      checklistVersion: CHECKLIST_VERSION, preparedBy: caller.email, revisionOf: p.id, revisionReason: reason,
    }).returning()
    const items = await db.select().from(qaCheckInstances).where(and(eq(qaCheckInstances.orgId, orgId), eq(qaCheckInstances.periodId, p.id)))
    if (items.length) await db.insert(qaCheckInstances).values(items.map(({ id: _id, periodId: _p, ...i }) => ({ ...i, periodId: r.id, updatedBy: caller.email, updatedAt: new Date() })))
    await audit(c, orgId, wsId, 'org', r.id, 'create', { qaRevisionOf: p.id, reason })
    return json(r, 201)
  } },
  { method: 'GET', pattern: `${W}/qa/periods/:id/export`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const p = await loadQaPeriod(orgId, wsId, intParam(c.p[1]))
    const view = p.status === 'final' && p.snapshot ? (p.snapshot as unknown as QaView) : await buildQaView(orgId, wsId, p)
    const format = c.url.searchParams.get('format') === 'csv' ? 'csv' : 'doc'
    await audit(c, orgId, wsId, 'org', p.id, 'read', { qaExport: format, frozen: p.status === 'final' })
    const name = `esg-report-qa-${p.label.replace(/[^\w.-]+/g, '_')}`
    if (format === 'csv') return new Response(qaCsv(view, csvEscape), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"` } })
    return new Response(renderQaDoc(view, today(), { reportId: `QA-${p.id}-${p.status === 'final' ? 'FINAL' : 'DRAFT'}`, author: caller.email }), { headers: { 'Content-Type': 'application/msword; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.doc"` } })
  } },

  // ---------------------------- 2.4 CAP ----------------------------
  { method: 'GET', pattern: `${W}/cap/summary`, access: 'viewer', scope: 'workspace', handler: async (_c, { orgId, wsId }) =>
    json(summarizeCaps(await db.select().from(capRecords).where(and(eq(capRecords.orgId, orgId), eq(capRecords.workspaceId, wsId))))) },
  { method: 'GET', pattern: `${W}/cap`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const q = c.url.searchParams
    const now = new Date()
    const weekEnd = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10)
    const monthEnd = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)
    const rows = (await db.select().from(capRecords).where(and(eq(capRecords.orgId, orgId), eq(capRecords.workspaceId, wsId))).orderBy(desc(capRecords.id)))
      .map((r) => ({ ...r, status: effectiveCapStatus(r.status, r.dueDate, now) }))
    const due = q.get('due_date')
    return json(rows.filter((r) =>
      (!q.get('status') || r.status === q.get('status')) && (!q.get('severity') || r.severity === q.get('severity')) &&
      (!q.get('owner') || r.assignedTo === q.get('owner')) &&
      (!due || (due === 'overdue' ? r.status === 'overdue'
        : due === 'this_week' ? !!r.dueDate && r.dueDate >= today() && r.dueDate <= weekEnd
        : due === 'this_month' ? !!r.dueDate && r.dueDate >= today() && r.dueDate <= monthEnd
        : due === 'later' ? !!r.dueDate && r.dueDate > monthEnd : true))))
  } },
  { method: 'POST', pattern: `${W}/cap`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const sourceType = oneOf(c.body.sourceType, 'sourceType', ['governance_finding', 'esg_requirement', 'disclosure_finding', 'manual'] as const, 'manual')
    let sourceId: number | null = null
    let description = c.body.findingDescription
    let severity = c.body.severity
    if (sourceType === 'governance_finding') {
      sourceId = Number(c.body.sourceId)
      // The finding must live in an assessment of THIS workspace.
      const [f] = await db.select({ f: governanceFindings }).from(governanceFindings)
        .innerJoin(governanceAssessments, eq(governanceAssessments.id, governanceFindings.assessmentId))
        .where(and(eq(governanceFindings.id, sourceId), eq(governanceFindings.orgId, orgId), eq(governanceAssessments.workspaceId, wsId)))
      if (!f) throw bad('sourceId not found in this workspace')
      // A sensitive finding stays encrypted in its assessment; the CAP only references it.
      description ??= f.f.sensitive ? `Sensitive governance finding #${f.f.id} (${f.f.domain}) — see the assessment for details` : f.f.description
      severity ??= f.f.severity
      // Inherit the finding's context so the action keeps its provenance.
      c.body.correctiveAction ??= f.f.recommendation
      c.body.assignedTo ??= f.f.ownerAssignment
      c.body.dueDate ??= f.f.dueDate
    } else if (sourceType === 'esg_requirement') {
      sourceId = Number(c.body.sourceId)
      const r = await loadRequirement(orgId, wsId, sourceId)
      description ??= `Implement ${r.requirementId}: ${r.requirementText}`
      severity ??= r.priority === 'high' ? 'high' : 'medium'
    } else if (c.body.sourceId != null) sourceId = Number(c.body.sourceId) || null
    const [cap] = await db.insert(capRecords).values({
      orgId, workspaceId: wsId, sourceType, sourceId, findingDescription: str(description, 'findingDescription', 4000),
      severity: oneOf(severity, 'severity', SEVERITIES, 'medium'), correctiveAction: str(c.body.correctiveAction, 'correctiveAction', 4000, false),
      assignedTo: str(c.body.assignedTo, 'assignedTo', 200, false) || null, dueDate: dateOrNull(c.body.dueDate, 'dueDate'),
      ...capDetailFields(c.body),
    }).returning()
    await audit(c, orgId, wsId, 'cap', cap.id, 'create', { sourceType, sourceId })
    return json(cap, 201)
  } },
  { method: 'GET', pattern: `${W}/cap/:id`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const cap = await loadCap(orgId, wsId, intParam(c.p[1]))
    const actions = await db.select().from(actionItems).where(and(eq(actionItems.orgId, orgId), eq(actionItems.capId, cap.id))).orderBy(asc(actionItems.sequenceNum))
    const ids = actions.map((a) => a.id)
    const [logs, links] = await Promise.all([
      ids.length ? db.select().from(actionLogs).where(and(eq(actionLogs.orgId, orgId), inArray(actionLogs.actionId, ids))).orderBy(desc(actionLogs.id)) : [],
      db.select().from(evidenceLinks).where(and(eq(evidenceLinks.orgId, orgId), eq(evidenceLinks.targetType, 'cap'), eq(evidenceLinks.targetId, cap.id))),
    ])
    return json({ ...cap, status: effectiveCapStatus(cap.status, cap.dueDate), actions, history: logs, evidenceLinks: links })
  } },
  { method: 'PUT', pattern: `${W}/cap/:id`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const cap = await loadCap(orgId, wsId, intParam(c.p[1]))
    if (cap.status === 'completed') throw new HttpError(409, 'CAP is closed')
    const set: Record<string, unknown> = {}
    if (c.body.assignedTo !== undefined) set.assignedTo = str(c.body.assignedTo, 'assignedTo', 200, false) || null
    if (c.body.dueDate !== undefined) set.dueDate = dateOrNull(c.body.dueDate, 'dueDate')
    if (c.body.severity !== undefined) set.severity = oneOf(c.body.severity, 'severity', SEVERITIES)
    if (c.body.correctiveAction !== undefined) set.correctiveAction = str(c.body.correctiveAction, 'correctiveAction', 4000, false)
    if (c.body.status !== undefined) set.status = oneOf(c.body.status, 'status', ['open', 'in_progress'] as const) // closing goes through /close
    Object.assign(set, capDetailFields(c.body))
    const comment = str(c.body.comment, 'comment', 2000, false)
    if (!Object.keys(set).length && !comment) throw bad('nothing to update')
    const [u] = Object.keys(set).length ? await db.update(capRecords).set(set).where(eq(capRecords.id, cap.id)).returning() : [cap]
    await audit(c, orgId, wsId, 'cap', cap.id, 'update', { fields: Object.keys(set), comment: comment || undefined })
    return json(u)
  } },
  { method: 'POST', pattern: `${W}/cap/:id/actions`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const cap = await loadCap(orgId, wsId, intParam(c.p[1]))
    if (cap.status === 'completed') throw new HttpError(409, 'CAP is closed')
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(actionItems).where(and(eq(actionItems.orgId, orgId), eq(actionItems.capId, cap.id)))
    const [a] = await db.insert(actionItems).values({
      orgId, capId: cap.id, sequenceNum: n + 1, actionDescription: str(c.body.actionDescription, 'actionDescription', 2000),
      owner: str(c.body.owner, 'owner', 200, false) || null, targetDate: dateOrNull(c.body.targetDate, 'targetDate'),
    }).returning()
    await db.insert(actionLogs).values({ orgId, actionId: a.id, actorId: caller.email, event: 'created', newValue: a.actionDescription })
    if (cap.status === 'open') await db.update(capRecords).set({ status: 'in_progress' }).where(eq(capRecords.id, cap.id))
    await audit(c, orgId, wsId, 'cap', cap.id, 'create', { action: a.id })
    return json(a, 201)
  } },
  { method: 'PUT', pattern: `${W}/cap/:id/actions/:aid`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId, caller, role }) => {
    const cap = await loadCap(orgId, wsId, intParam(c.p[1]))
    if (cap.status === 'completed') throw new HttpError(409, 'CAP is closed')
    const [a] = await db.select().from(actionItems).where(and(eq(actionItems.id, intParam(c.p[2])), eq(actionItems.orgId, orgId), eq(actionItems.capId, cap.id)))
    if (!a) throw new HttpError(404, 'Not found')
    const set: Record<string, unknown> = {}
    const events: { event: string; oldValue: string | null; newValue: string | null }[] = []
    if (c.body.owner !== undefined) {
      set.owner = str(c.body.owner, 'owner', 200, false) || null
      events.push({ event: 'assigned', oldValue: a.owner, newValue: set.owner as string | null })
    }
    if (c.body.targetDate !== undefined) set.targetDate = dateOrNull(c.body.targetDate, 'targetDate')
    if (c.body.actionDescription !== undefined) set.actionDescription = str(c.body.actionDescription, 'actionDescription', 2000)
    if (c.body.evidenceId != null) {
      await loadEvidence(orgId, wsId, intParam(String(c.body.evidenceId))) // must exist in this workspace
      set.evidenceUploadedAt = new Date()
      set.verifiedBy = null
      const [dupLink] = await db.select({ id: evidenceLinks.id }).from(evidenceLinks).where(and(eq(evidenceLinks.orgId, orgId), eq(evidenceLinks.evidenceId, Number(c.body.evidenceId)), eq(evidenceLinks.targetType, 'cap'), eq(evidenceLinks.targetId, cap.id)))
      if (!dupLink) await db.insert(evidenceLinks).values({ orgId, evidenceId: Number(c.body.evidenceId), targetType: 'cap', targetId: cap.id, linkType: 'supports' })
      events.push({ event: 'updated', oldValue: null, newValue: `evidence:${c.body.evidenceId}` })
    }
    if (c.body.verify === true) {
      if (!hasMinRole(role, 'admin')) throw new HttpError(403, 'Only an admin can verify completion')
      if (!(set.evidenceUploadedAt ?? a.evidenceUploadedAt)) throw new HttpError(409, 'Evidence is required before verification')
      if (!await actionHasValidEvidence(orgId, wsId, cap.id, a.id, c.body.evidenceId == null ? undefined : Number(c.body.evidenceId))) {
        throw new HttpError(409, 'Approved, nonarchived, unexpired action evidence is required before verification')
      }
      set.verifiedBy = caller.email
    }
    if (c.body.status !== undefined) {
      const status = oneOf(c.body.status, 'status', ['open', 'in_progress', 'completed'] as const)
      set.status = status
      set.closedAt = status === 'completed' ? new Date() : null
      events.push({ event: status === 'completed' ? 'completed' : 'updated', oldValue: a.status, newValue: status })
    }
    if (!Object.keys(set).length) throw bad('nothing to update')
    const [u] = await db.update(actionItems).set(set).where(eq(actionItems.id, a.id)).returning()
    if (!events.length) events.push({ event: 'updated', oldValue: null, newValue: Object.keys(set).join(',') })
    await db.insert(actionLogs).values(events.map((e) => ({ orgId, actionId: a.id, actorId: caller.email, ...e })))
    await audit(c, orgId, wsId, 'cap', cap.id, 'update', { action: a.id, fields: Object.keys(set) })
    return json(u)
  } },
  { method: 'POST', pattern: `${W}/cap/:id/close`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const cap = await loadCap(orgId, wsId, intParam(c.p[1]))
    if (cap.status === 'completed') throw new HttpError(409, 'CAP already closed')
    const actions = await db.select().from(actionItems).where(and(eq(actionItems.orgId, orgId), eq(actionItems.capId, cap.id)))
    const blockers = capCloseBlockers(actions)
    if (blockers.length) return json({ error: 'Evidence verification required', blockers }, 409)
    const invalid = await Promise.all(actions.map(async (a, i) => await actionHasValidEvidence(orgId, wsId, cap.id, a.id) ? null : `Action ${i + 1} needs approved, nonarchived, unexpired evidence`))
    if (invalid.some(Boolean)) return json({ error: 'Evidence verification required', blockers: invalid.filter(Boolean) }, 409)
    const effectivenessRequired = c.body.effectivenessRequired === true
    const life = capLifecycle(cap, { type: 'close', effectivenessRequired })
    if ('error' in life) throw new HttpError(409, life.error)
    const [u] = await db.update(capRecords).set({
      status: life.patch.status, completionDate: new Date(), effectivenessStatus: life.patch.effectivenessStatus,
      effectivenessDue: effectivenessRequired ? dateOrNull(c.body.effectivenessDue, 'effectivenessDue') : null,
      ...(c.body.residualRisk !== undefined ? { residualRisk: str(c.body.residualRisk, 'residualRisk', 4000, false) } : {}),
    }).where(eq(capRecords.id, cap.id)).returning()
    // Closing deliberately leaves the source finding and every score untouched: reassess the criterion.
    await audit(c, orgId, wsId, 'cap', cap.id, 'update', { status: 'completed', effectivenessRequired, by: caller.email })
    return json(u)
  } },
  { method: 'POST', pattern: `${W}/cap/:id/effectiveness`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const cap = await loadCap(orgId, wsId, intParam(c.p[1]))
    if (cap.assignedTo && cap.assignedTo.toLowerCase() === caller.email.toLowerCase() && caller.role !== 'super_admin') {
      throw new HttpError(403, 'Segregation of duties: the accountable owner cannot review the effectiveness of their own action')
    }
    const result = oneOf(c.body.result, 'result', ['effective', 'not_effective'] as const)
    const life = capLifecycle(cap, { type: 'review', result })
    if ('error' in life) throw new HttpError(409, life.error)
    const [u] = await db.update(capRecords).set({
      status: life.patch.status, effectivenessStatus: life.patch.effectivenessStatus, reopenedCount: life.patch.reopenedCount,
      effectivenessNotes: str(c.body.notes, 'notes', 4000), effectivenessReviewedBy: caller.email, effectivenessReviewedAt: new Date(),
      ...(life.patch.reopened ? { completionDate: null } : {}),
      ...(c.body.residualRisk !== undefined ? { residualRisk: str(c.body.residualRisk, 'residualRisk', 4000, false) } : {}),
    }).where(eq(capRecords.id, cap.id)).returning()
    await audit(c, orgId, wsId, 'cap', cap.id, 'update', { effectiveness: result, reopened: life.patch.reopened, by: caller.email })
    return json(u)
  } },
  { method: 'POST', pattern: `${W}/cap/:id/reopen`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const cap = await loadCap(orgId, wsId, intParam(c.p[1]))
    const reason = str(c.body.reason, 'reason', 2000)
    const life = capLifecycle(cap, { type: 'reopen' })
    if ('error' in life) throw new HttpError(409, life.error)
    const [u] = await db.update(capRecords).set({ status: life.patch.status, reopenedCount: life.patch.reopenedCount, completionDate: null })
      .where(eq(capRecords.id, cap.id)).returning()
    await audit(c, orgId, wsId, 'cap', cap.id, 'update', { reopened: true, reason, by: caller.email })
    return json(u)
  } },

  // ---------------------------- 2.5 Evidence ----------------------------
  { method: 'POST', pattern: `${W}/evidence/upload`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const form = await c.req.formData().catch(() => null)
    const file = form?.get('file')
    if (!form || !(file instanceof File)) throw bad('multipart field "file" required')
    if (file.size === 0 || file.size > MAX_EVIDENCE_BYTES) throw bad(`file must be between 1 byte and ${MAX_EVIDENCE_BYTES / 1024 / 1024} MB`)
    if (!ALLOWED_EVIDENCE_MIME.includes(file.type)) throw bad('unsupported file type (PDF, DOCX, XLSX, images, ZIP)')
    const documentType = oneOf(form.get('documentType') ?? undefined, 'documentType', ['assessment', 'policy', 'evidence', 'certification'] as const, 'evidence')
    const declaredKind = declaredDocumentKind(form.get('documentKind'))
    const key = `${orgId}/${wsId}/${crypto.randomUUID()}`
    const bytes = await file.arrayBuffer()
    // Read the contents and check them against the name / declared kind. The text is not stored.
    const contentCheck = checkContent({ fileName: file.name, declaredKind, text: await extractText(bytes, file.type) })
    await getStore('evidence').set(key, encodeEvidence(bytes), { metadata: { mimeType: file.type } })
    const [e] = await db.insert(evidenceRegistry).values({
      orgId, workspaceId: wsId, documentName: file.name.slice(0, 255), documentType, uploadedBy: caller.email, filePath: key,
      fileSizeKb: Math.ceil(file.size / 1024), mimeType: file.type, expiryDate: dateOrNull(form.get('expiryDate') || null, 'expiryDate'),
      declaredKind, contentCheck: { ...contentCheck },
    }).returning()
    await audit(c, orgId, wsId, 'evidence', e.id, 'create', { name: e.documentName, contentCheck: contentCheck.status })
    return json(e, 201)
  } },
  { method: 'GET', pattern: `${W}/evidence/document-kinds`, access: 'viewer', scope: 'workspace', handler: async () =>
    json(DOCUMENT_KINDS.map(({ id, label }) => ({ id, label }))) },
  { method: 'POST', pattern: `${W}/evidence/:id/content-check`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    // Re-read a stored document, e.g. one uploaded before content checks existed or with a corrected kind.
    const e = await loadEvidence(orgId, wsId, intParam(c.p[1]))
    const declaredKind = c.body.documentKind !== undefined ? declaredDocumentKind(c.body.documentKind) : e.declaredKind
    const data = await getStore('evidence').get(e.filePath, { type: 'arrayBuffer' })
    if (!data) throw new HttpError(404, 'File not found')
    const contentCheck = checkContent({ fileName: e.documentName, declaredKind, text: await extractText(decodeEvidence(data), e.mimeType) })
    const [u] = await db.update(evidenceRegistry).set({ declaredKind, contentCheck: { ...contentCheck } }).where(eq(evidenceRegistry.id, e.id)).returning()
    await audit(c, orgId, wsId, 'evidence', e.id, 'update', { contentCheck: contentCheck.status, declaredKind })
    return json(u)
  } },
  { method: 'GET', pattern: `${W}/evidence/expiry-alerts`, access: 'viewer', scope: 'workspace', handler: async (_c, { orgId, wsId }) => {
    const limit = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
    const rows = await db.select().from(evidenceRegistry).where(and(
      eq(evidenceRegistry.orgId, orgId), eq(evidenceRegistry.workspaceId, wsId), isNull(evidenceRegistry.archivedAt),
      isNotNull(evidenceRegistry.expiryDate), lte(evidenceRegistry.expiryDate, limit)))
    return json(rows.map((r) => ({ ...r, expiryState: evidenceExpiryState(r.expiryDate) })))
  } },
  { method: 'GET', pattern: `${W}/evidence`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const q = c.url.searchParams
    const rows = (await db.select().from(evidenceRegistry)
      .where(and(eq(evidenceRegistry.orgId, orgId), eq(evidenceRegistry.workspaceId, wsId), isNull(evidenceRegistry.archivedAt))).orderBy(desc(evidenceRegistry.id)))
      .map((r) => ({ ...r, expiryState: evidenceExpiryState(r.expiryDate) }))
      .map((r) => ({ ...r, status: r.expiryState === 'expired' ? 'expired' : r.status }))
    return json(rows.filter((r) => (!q.get('type') || r.documentType === q.get('type')) && (!q.get('status') || r.status === q.get('status')) &&
      (!q.get('expiry') || r.expiryState === q.get('expiry'))))
  } },
  { method: 'GET', pattern: `${W}/evidence/:id`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const e = await loadEvidence(orgId, wsId, intParam(c.p[1]))
    const [links, approvals] = await Promise.all([
      db.select().from(evidenceLinks).where(and(eq(evidenceLinks.orgId, orgId), eq(evidenceLinks.evidenceId, e.id))),
      db.select().from(documentApprovals).where(and(eq(documentApprovals.orgId, orgId), eq(documentApprovals.evidenceId, e.id))).orderBy(desc(documentApprovals.id)),
    ])
    return json({
      ...e, expiryState: evidenceExpiryState(e.expiryDate),
      links: links.map((link) => ({ ...link, reviewerNotes: decryptField(link.reviewerNotes) })),
      approvals: approvals.map((approval) => ({ ...approval, comments: decryptField(approval.comments) })),
    })
  } },
  { method: 'PUT', pattern: `${W}/evidence/:id`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const e = await loadEvidence(orgId, wsId, intParam(c.p[1]))
    const set: Record<string, unknown> = {}
    if (c.body.expiryDate !== undefined) set.expiryDate = dateOrNull(c.body.expiryDate, 'expiryDate')
    if (c.body.documentType !== undefined) set.documentType = oneOf(c.body.documentType, 'documentType', ['assessment', 'policy', 'evidence', 'certification'] as const)
    // Approval/rejection only via /approve (reviewer segregation); callers may only re-submit for review.
    if (c.body.status !== undefined) set.status = oneOf(c.body.status, 'status', ['pending_review'] as const)
    if (c.body.link) {
      const targetType = oneOf(c.body.link.targetType, 'link.targetType', ['cap', 'assessment', 'requirement'] as const)
      const targetId = intParam(String(c.body.link.targetId))
      if (targetType === 'cap') await loadCap(orgId, wsId, targetId)
      else if (targetType === 'assessment') await loadAssessment(orgId, wsId, targetId)
      else await loadRequirement(orgId, wsId, targetId)
      await db.insert(evidenceLinks).values({
        orgId, evidenceId: e.id, targetType, targetId,
        linkType: oneOf(c.body.link.linkType, 'link.linkType', ['supports', 'verifies'] as const, 'supports'),
        reviewerNotes: encryptField(str(c.body.link.reviewerNotes, 'link.reviewerNotes', 2000, false)),
      })
    }
    if (!Object.keys(set).length && !c.body.link) throw bad('nothing to update')
    const [u] = Object.keys(set).length ? await db.update(evidenceRegistry).set(set).where(eq(evidenceRegistry.id, e.id)).returning() : [e]
    await audit(c, orgId, wsId, 'evidence', e.id, 'update', { fields: Object.keys(set), linked: !!c.body.link })
    return json(u)
  } },
  { method: 'POST', pattern: `${W}/evidence/:id/approve`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const e = await loadEvidence(orgId, wsId, intParam(c.p[1]))
    if (e.uploadedBy === caller.email && caller.role !== 'super_admin') throw new HttpError(403, 'Segregation of duties: uploader cannot approve their own evidence')
    const status = oneOf(c.body.status, 'status', ['approved', 'rejected'] as const, 'approved')
    const comments = str(c.body.comments, 'comments', 2000, false)
    const check = e.contentCheck as { status?: string } | null
    if (status === 'approved' && check?.status === 'possible_mismatch' && comments.trim().length < 10) {
      throw new HttpError(409, 'The content check flagged this document: record in the comments how you confirmed it is the right document before approving')
    }
    await db.insert(documentApprovals).values({ orgId, evidenceId: e.id, reviewerId: caller.email, status, comments: encryptField(comments) })
    if (status === 'approved') await db.update(evidenceLinks).set({ approvedBy: caller.email, approvalDate: new Date() }).where(and(eq(evidenceLinks.orgId, orgId), eq(evidenceLinks.evidenceId, e.id)))
    const [u] = await db.update(evidenceRegistry).set({ status }).where(eq(evidenceRegistry.id, e.id)).returning()
    await audit(c, orgId, wsId, 'evidence', e.id, 'update', { review: status })
    return json(u)
  } },
  { method: 'DELETE', pattern: `${W}/evidence/:id`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const e = await loadEvidence(orgId, wsId, intParam(c.p[1]))
    await db.update(evidenceRegistry).set({ archivedAt: new Date() }).where(eq(evidenceRegistry.id, e.id)) // soft delete; blob retained for audit
    await audit(c, orgId, wsId, 'evidence', e.id, 'delete', { name: e.documentName })
    return json({ ok: true })
  } },
  { method: 'GET', pattern: `${W}/evidence/:id/download`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const e = await loadEvidence(orgId, wsId, intParam(c.p[1]))
    const data = await getStore('evidence').get(e.filePath, { type: 'arrayBuffer' })
    if (!data) throw new HttpError(404, 'File not found')
    await audit(c, orgId, wsId, 'evidence', e.id, 'read', { download: true })
    return new Response(decodeEvidence(data), { headers: {
      'Content-Type': e.mimeType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${e.documentName.replace(/[^\w.\- ]/g, '_')}"`,
    } })
  } },

  // ---------------------------- 2.6 Reports ----------------------------
  ...(['governance-scorecard', 'esg-status', 'cap-summary', 'audit-trail'] as const).map((slug): Route => ({
    method: 'POST', pattern: `${W}/reports/${slug}`, access: slug === 'audit-trail' ? 'admin' : 'assessor', scope: 'workspace',
    handler: (c, { orgId, wsId, caller }) => generateReport(c, orgId, wsId, caller, slug.replace(/-/g, '_')),
  })),
  { method: 'GET', pattern: `${W}/reports`, access: 'viewer', scope: 'workspace', handler: async (_c, { orgId, wsId }) =>
    json(await db.select().from(reports).where(and(eq(reports.orgId, orgId), eq(reports.workspaceId, wsId))).orderBy(desc(reports.id)).limit(100)) },
  // Literal `schedules` must be registered before the `:id` routes below.
  { method: 'GET', pattern: `${W}/reports/schedules`, access: 'admin', scope: 'workspace', handler: async (_c, { orgId, wsId }) =>
    json((await db.select().from(reportSchedules).where(and(eq(reportSchedules.orgId, orgId), eq(reportSchedules.workspaceId, wsId))).orderBy(desc(reportSchedules.id)))
      .map((schedule) => ({ ...schedule, recipients: schedule.recipients.map(decryptField) }))) },
  { method: 'GET', pattern: `${W}/reports/:id/pdf`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const reportId = intParam(c.p[1])
    const [report] = await db.select({ id: reports.id }).from(reports).where(and(
      eq(reports.id, reportId), eq(reports.orgId, orgId), eq(reports.workspaceId, wsId),
    ))
    if (!report) throw new HttpError(404, 'Not found')
    const versionNum = Number(c.url.searchParams.get('version'))
    const versions = await db.select().from(reportVersions).where(and(eq(reportVersions.orgId, orgId), eq(reportVersions.reportId, reportId)))
      .orderBy(desc(reportVersions.versionNum)).limit(100)
    const version = Number.isInteger(versionNum) && versionNum > 0
      ? versions.find((row) => row.versionNum === versionNum)
      : versions.find((row) => !!row.pdfUrl)
    if (!version?.pdfUrl) throw new HttpError(404, 'PDF not found')
    const data = await getStore('reports').get(`reports/${orgId}/${wsId}/${reportId}/v${version.versionNum}.pdf`, { type: 'arrayBuffer' })
    if (!data) throw new HttpError(404, 'PDF not found')
    await audit(c, orgId, wsId, 'report', reportId, 'read', { download: 'pdf', version: version.versionNum })
    return new Response(data, { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="report-${reportId}-v${version.versionNum}.pdf"`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    } })
  } },
  { method: 'GET', pattern: `${W}/reports/:id`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const [r] = await db.select().from(reports).where(and(eq(reports.id, intParam(c.p[1])), eq(reports.orgId, orgId), eq(reports.workspaceId, wsId)))
    if (!r) throw new HttpError(404, 'Not found')
    await db.update(reportVersions).set({ viewedAt: new Date() }).where(and(eq(reportVersions.orgId, orgId), eq(reportVersions.reportId, r.id)))
    await audit(c, orgId, wsId, 'report', r.id, 'read')
    return json(r)
  } },
  { method: 'POST', pattern: `${W}/reports/:id/email`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const [r] = await db.select().from(reports).where(and(eq(reports.id, intParam(c.p[1])), eq(reports.orgId, orgId), eq(reports.workspaceId, wsId)))
    if (!r) throw new HttpError(404, 'Not found')
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) throw new HttpError(503, 'Email not configured')
    const recipients: string[] = Array.isArray(c.body.recipients) && c.body.recipients.length ? c.body.recipients : [SUPPORT_EMAIL]
    if (recipients.length > 10 || recipients.some((e) => typeof e !== 'string' || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(e))) throw bad('recipients invalid (max 10 emails)')
    const versions = await db.select().from(reportVersions).where(and(eq(reportVersions.orgId, orgId), eq(reportVersions.reportId, r.id)))
      .orderBy(desc(reportVersions.versionNum)).limit(1)
    const latest = versions.find((version) => !!version.pdfUrl)
    const pdf = latest?.pdfUrl
      ? await getStore('reports').get(`reports/${orgId}/${wsId}/${r.id}/v${latest.versionNum}.pdf`, { type: 'arrayBuffer' })
      : null
    const sent = await sendEmail(recipients, `CRAFT report: ${r.reportType} (${r.dataAsOfDate})`,
      `<p>A ${escapeHtml(r.reportType)} report was generated for workspace ${wsId} as of ${escapeHtml(r.dataAsOfDate)}.</p><pre>${escapeHtml(JSON.stringify(r.statusSnapshot, null, 2).slice(0, 8000))}</pre>`,
      pdf ? { filename: `report-${r.id}.pdf`, bytes: new Uint8Array(pdf) } : undefined)
    const [v] = await db.insert(reportVersions).values({
      orgId, reportId: r.id, versionNum: 1 + (await db.select({ id: reportVersions.id }).from(reportVersions).where(and(eq(reportVersions.orgId, orgId), eq(reportVersions.reportId, r.id)))).length,
      jsonExportUrl: `/api/workspaces/${wsId}/reports/${r.id}`, emailSentTo: encryptField(recipients.join(',')), sentAt: sent ? new Date() : null,
    }).returning()
    await audit(c, orgId, wsId, 'report', r.id, 'update', { recipientCount: recipients.length, delivered: sent })
    return json({ ...v, delivered: sent })
  } },
  { method: 'GET', pattern: `${W}/reports/:id/versions`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const [r] = await db.select({ id: reports.id }).from(reports).where(and(eq(reports.id, intParam(c.p[1])), eq(reports.orgId, orgId), eq(reports.workspaceId, wsId)))
    if (!r) throw new HttpError(404, 'Not found')
    return json((await db.select().from(reportVersions).where(and(eq(reportVersions.orgId, orgId), eq(reportVersions.reportId, r.id))).orderBy(desc(reportVersions.versionNum)))
      .map((version) => ({ ...version, emailSentTo: version.emailSentTo ? decryptField(version.emailSentTo) : null })))
  } },
  { method: 'POST', pattern: `${W}/reports/schedules`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const reportType = oneOf(c.body.reportType, 'reportType', ['governance_scorecard', 'esg_status', 'cap_summary', 'audit_trail'] as const)
    const cadence = oneOf(c.body.cadence, 'cadence', ['weekly', 'monthly', 'quarterly'] as const)
    const format = oneOf(c.body.format, 'format', ['pdf', 'json', 'both'] as const, 'pdf')
    const recipients = c.body.recipients
    if (!Array.isArray(recipients) || recipients.length < 1 || recipients.length > 10 ||
      recipients.some((email) => typeof email !== 'string' || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email.trim()))) {
      throw bad('recipients must contain 1–10 valid email addresses')
    }
    const [schedule] = await db.insert(reportSchedules).values({
      orgId, workspaceId: wsId, reportType, cadence, format, recipients: recipients.map((email: string) => encryptField(email.trim())),
      scheduleDay: new Date().getUTCDate(), nextRunAt: nextReportRun(cadence, new Date()), createdBy: caller.email,
    }).returning()
    await audit(c, orgId, wsId, 'report_schedule', schedule.id, 'create', { reportType, cadence })
    return json(schedule, 201)
  } },
  { method: 'POST', pattern: `${W}/reports/schedules/:id/pause`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    if (typeof c.body.paused !== 'boolean') throw bad('paused must be boolean')
    const [schedule] = await db.update(reportSchedules).set({ paused: c.body.paused }).where(and(
      eq(reportSchedules.id, intParam(c.p[1])), eq(reportSchedules.orgId, orgId), eq(reportSchedules.workspaceId, wsId),
    )).returning()
    if (!schedule) throw new HttpError(404, 'Not found')
    await audit(c, orgId, wsId, 'report_schedule', schedule.id, 'update', { paused: schedule.paused })
    return json(schedule)
  } },
  { method: 'DELETE', pattern: `${W}/reports/schedules/:id`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const [schedule] = await db.delete(reportSchedules).where(and(
      eq(reportSchedules.id, intParam(c.p[1])), eq(reportSchedules.orgId, orgId), eq(reportSchedules.workspaceId, wsId),
    )).returning()
    if (!schedule) throw new HttpError(404, 'Not found')
    await audit(c, orgId, wsId, 'report_schedule', schedule.id, 'delete')
    return json({ ok: true })
  } },

  // ---------------------------- 2.8 Audit ----------------------------
  { method: 'GET', pattern: `${W}/audit-log`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const rows = await queryAudit(c, orgId, wsId, Math.min(Number(c.url.searchParams.get('pageSize')) || 50, 200), Math.max(Number(c.url.searchParams.get('page')) || 1, 1))
    return json(rows)
  } },
  { method: 'POST', pattern: `${W}/audit-log/export`, access: 'admin', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const rows = await queryAudit(c, orgId, wsId, 10_000, 1)
    await audit(c, orgId, wsId, 'org', wsId, 'read', { auditExport: rows.length })
    if ((c.body.format ?? c.url.searchParams.get('format')) === 'csv') {
      const cols = ['id', 'timestamp', 'actorId', 'resourceType', 'resourceId', 'action', 'ipAddress', 'userAgent', 'details'] as const
      const csv = [cols.join(','), ...rows.map((r) => cols.map((k) => csvEscape((r as Record<string, unknown>)[k])).join(','))].join('\n')
      return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="audit-log.csv"' } })
    }
    return json(rows)
  } },

  // ---------------------------- 2.7 Support bot ----------------------------
  { method: 'POST', pattern: '/support-bot/submit-issue', access: 'public', handler: (c) => submitIssue(c, false) },
  { method: 'POST', pattern: '/support-bot/github-issue', access: 'public', handler: (c) => submitIssue(c, true) },
  { method: 'POST', pattern: '/support-bot/chat', access: 'public', handler: handleSupportChat },
  { method: 'POST', pattern: '/support-bot/escalate', access: 'public', handler: (c) => escalateSupport(c.body) },
  { method: 'GET', pattern: '/support-bot/issues', access: 'authed', handler: async (c, { caller }) => {
    const wsParam = c.url.searchParams.get('workspaceId')
    if (wsParam) {
      const { orgId, workspace } = await requireWorkspaceAccess(caller, intParam(wsParam), 'assessor')
      const issues = await db.select().from(supportIssues).where(and(eq(supportIssues.orgId, orgId), eq(supportIssues.workspaceId, workspace.id))).orderBy(desc(supportIssues.id)).limit(200)
      return json(issues.map((issue) => ({ ...issue, contactEmail: decryptField(issue.contactEmail) })))
    }
    if (caller.role !== 'super_admin') throw new HttpError(403, 'Forbidden')
    const issues = await db.select().from(supportIssues).orderBy(desc(supportIssues.id)).limit(200)
    return json(issues.map((issue) => ({ ...issue, contactEmail: decryptField(issue.contactEmail) })))
  } },
  { method: 'POST', pattern: '/support-bot/issue/:id/respond', access: 'authed', handler: async (c, { caller }) => {
    const [issue] = await db.select().from(supportIssues).where(eq(supportIssues.id, intParam(c.p[0])))
    if (!issue) throw new HttpError(404, 'Not found')
    if (issue.orgId) await requireOrgAccess(caller, issue.orgId, 'assessor')
    else if (caller.role !== 'super_admin') throw new HttpError(403, 'Forbidden')
    let capId: number | null = null
    if (c.body.capId != null) {
      if (!issue.orgId || !issue.workspaceId) throw bad('issue is not linked to a workspace')
      capId = (await loadCap(issue.orgId, issue.workspaceId, intParam(String(c.body.capId)))).id
    }
    const [r] = await db.insert(supportIssueResponses).values({ issueId: issue.id, responder: caller.email, message: str(c.body.message, 'message', 4000) }).returning()
    await db.update(supportIssues).set({ status: oneOf(c.body.status, 'status', ['open', 'responded', 'closed'] as const, 'responded'), ...(capId ? { capId } : {}) }).where(eq(supportIssues.id, issue.id))
    const contactEmail = decryptField(issue.contactEmail)
    if (contactEmail) await sendEmail([contactEmail], `Re: your CRAFT support issue #${issue.id}`, `<p>${escapeHtml(r.message)}</p>`)
    return json(r, 201)
  } },
]

async function submitIssue(c: Ctx, githubFirst: boolean): Promise<Response> {
  // Compatibility routes share the chat's publication safety contract.
  void githubFirst
  return handleSupportChat({ ...c, body: { ...c.body, message: c.body.description ?? c.body.message, contactEmail: c.body.contactEmail ?? c.body.email } })
}

async function handleSupportChat(c: Ctx): Promise<Response> {
  const message = str(c.body.message, 'message', 5000)

  if (isPrivateReport(message) || c.body.privacyLevel === 'private') {
    if (c.body.escalationConsent === true) {
      return escalateSupport({ ...c.body, message, classification: classifySupportMessage(message).type, privacyLevel: 'private' })
    }
    return json({
      success: true,
      type: 'private_report',
      classification: classifySupportMessage(message).type,
      escalationReason: 'private_report',
      answer: 'For conduct or security reports, please contact craftframework@becomechange.institute directly. Do not include sensitive details in this public chat.',
    })
  }
  if (c.body.publicIssueDisclosure !== true) throw bad('Public issue disclosure must be accepted')
  const contactEmail = str(c.body.contactEmail, 'contactEmail', 254, false)
  if (contactEmail && !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(contactEmail)) throw bad('contactEmail invalid')
  let orgId: number | null = null
  let workspaceId: number | null = null
  if (c.caller && c.body.workspaceId != null) {
    const ws = await requireWorkspaceAccess(c.caller, intParam(String(c.body.workspaceId)), 'viewer')
    orgId = ws.orgId
    workspaceId = ws.workspace.id
  }

  const classification = classifySupportMessage(message)
  const faq = classification.type === 'question' ? rankSupportFaq(message) : null
  const description = redactSupportMessage(message)
  const key = supportDeduplicationKey(classification.type, description, orgId, workspaceId)
  const digest = Buffer.from(key.split('/').at(-1)!, 'hex')
  const lockA = digest.readInt32BE(0)
  const lockB = digest.readInt32BE(4)
  const store = getStore('support-intake')
  const labels = classification.type === 'feature'
    ? ['enhancement']
    : classification.type === 'question'
      ? ['community-question']
      : ['bug']
  if (classification.urgency === 'high') labels.push('urgent')
  const title = `[${classification.type}] ${description.slice(0, 70) || 'Support request'}`
  const body = `${description}\n\n_Submitted through the public CRAFT support chat. No tenant or account context is included._`
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`)

    const retryIssue = async (id: number) => {
      const url = await createGithubIssue(title, body, labels)
      if (url) await tx.update(supportIssues).set({ githubIssueUrl: url }).where(eq(supportIssues.id, id))
      return { id, url, created: false }
    }
    const [existing] = await tx.select({ id: supportIssues.id, url: supportIssues.githubIssueUrl })
      .from(supportIssues)
      .where(and(
        orgId === null ? isNull(supportIssues.orgId) : eq(supportIssues.orgId, orgId),
        workspaceId === null ? isNull(supportIssues.workspaceId) : eq(supportIssues.workspaceId, workspaceId),
        eq(supportIssues.category, classification.type),
        eq(supportIssues.description, description),
      ))
      .orderBy(desc(supportIssues.id))
      .limit(1)
    if (existing) return existing.url ? { id: existing.id, url: existing.url, created: false } : retryIssue(existing.id)
    const url = await createGithubIssue(title, body, labels)
    const [issue] = await tx.insert(supportIssues).values({
      orgId, workspaceId,
      category: classification.type,
      description,
      contactEmail: encryptField(contactEmail),
      githubIssueUrl: url,
    }).returning({ id: supportIssues.id })
    return { id: issue.id, url, created: true }
  })

  await store.set(key, JSON.stringify({ id: result.id, url: result.url })).catch((error) => {
    logger.error('/api/workspace-api', 'support deduplication cache write failed', error)
  })
  return json({
    id: result.id,
    orgId, workspaceId,
    githubIssueUrl: result.url,
    emailed: false,
    success: true,
    type: classification.type,
    classification: classification.type,
    escalationReason: classification.type === 'question' && !faq ? 'unresolved_question' : null,
    confidence: classification.confidence,
    answer: faq?.answer,
    issueCreated: !!result.url,
    issueUrl: result.url,
    deduplicated: !result.created,
    message: result.url
      ? 'Your message has been added to a public GitHub issue.'
      : 'Your message was recorded, but GitHub issue creation is currently unavailable.',
  }, result.created ? 201 : 200)
}

async function queryAudit(c: Ctx, orgId: number, wsId: number, pageSize: number, page: number) {
  const q = c.url.searchParams
  const conds = [eq(wsAuditLog.orgId, orgId), eq(wsAuditLog.workspaceId, wsId)]
  if (q.get('actor')) conds.push(eq(wsAuditLog.actorId, q.get('actor')!))
  if (q.get('resource_type')) conds.push(eq(wsAuditLog.resourceType, q.get('resource_type')!))
  if (q.get('action')) conds.push(eq(wsAuditLog.action, q.get('action')!))
  const from = q.get('from'), to = q.get('to')
  if (from && DATE_RE.test(from)) conds.push(gte(wsAuditLog.timestamp, new Date(`${from}T00:00:00Z`)))
  if (to && DATE_RE.test(to)) conds.push(lte(wsAuditLog.timestamp, new Date(`${to}T23:59:59Z`)))
  return db.select().from(wsAuditLog).where(and(...conds)).orderBy(desc(wsAuditLog.id)).limit(pageSize).offset((page - 1) * pageSize)
}

// --- dispatcher ------------------------------------------------------------------------------------------------
function match(pattern: string, segs: string[]): string[] | null {
  const ps = pattern.split('/').filter(Boolean)
  if (ps.length !== segs.length) return null
  const params: string[] = []
  for (let i = 0; i < ps.length; i++) {
    if (ps[i].startsWith(':')) params.push(segs[i])
    else if (ps[i] !== segs[i]) return null
  }
  return params
}

export default async (req: Request) => {
  const origin = req.headers.get('origin')
  const cors = corsHeaders(origin)
  const finish = (res: Response) => {
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
  if (req.method === 'OPTIONS') return finish(new Response(null, { status: 204 }))
  try {
    const url = new URL(req.url)
    const segs = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean)
    const ip = req.headers.get('x-nf-client-connection-ip') ?? 'unknown'
    for (const r of routes) {
      if (r.method !== req.method) continue
      const m = match(r.pattern.replace(/^\//, ''), segs)
      if (!m) continue
      const caller = r.access === 'public' ? await resolveCaller().catch(() => null) : await resolveCaller()
      if (r.access !== 'public' && !caller) return finish(json({ error: 'Unauthorized' }, 401))
      // Atomic counters in shared Postgres apply across function instances. If
      // that store is unavailable, log and fail open so the application remains
      // available; the decision is deliberate and documented in platform-guide.
      const now = Date.now()
      try {
        if (r.access === 'public' && isRateLimitedCount(await incrementRateLimit(`pub:${ip}`, now), 100)) {
          return finish(tooManyRequests(now))
        }
        if (r.pattern.startsWith('/support-bot/') && isRateLimitedCount(await incrementRateLimit(`support-chat:${ip}`, now), 20)) {
          return finish(tooManyRequests(now))
        }
        if (isRateLimitedCount(await incrementRateLimit(caller ? `u:${caller.email}` : `ip:${ip}`, now), caller ? 1000 : 100)) {
          return finish(tooManyRequests(now))
        }
      } catch (rateLimitError) {
        if (r.pattern.startsWith('/support-bot/')) return finish(json({ error: 'Support temporarily unavailable' }, 503))
        logger.error('/api/workspace-api', 'shared rate limiter failed open', rateLimitError)
      }
      // Cross-site browser writes must come from an allowed origin.
      if (req.method !== 'GET' && origin && !cors['Access-Control-Allow-Origin'] && origin !== url.origin) return finish(json({ error: 'Forbidden origin' }, 403))
      let body: any = {}
      if (req.method !== 'GET' && req.method !== 'DELETE' && !(req.headers.get('content-type') ?? '').startsWith('multipart/')) {
        body = await req.json().catch(() => ({}))
        if (body === null || typeof body !== 'object' || Array.isArray(body)) throw bad('JSON object body required')
      }
      const ctx: Ctx = { req, url, p: m, body, caller, ip }
      let orgId = 0, wsId = 0, role: OrgRole = 'viewer'
      if (r.access !== 'public' && r.access !== 'authed') {
        if (r.scope === 'workspace') {
          wsId = intParam(m[0])
          const a = await requireWorkspaceAccess(caller!, wsId, r.access)
          orgId = a.orgId
          role = a.role
        } else {
          orgId = intParam(m[0])
          role = await requireOrgAccess(caller!, orgId, r.access)
        }
      }
      return finish(await r.handler(ctx, { caller: caller!, orgId, wsId, role }))
    }
    return finish(json({ error: 'Not found' }, 404))
  } catch (err) {
    if (err instanceof HttpError) return finish(json({ error: err.message }, err.status))
    logger.error('/api/workspace-api', 'failed', err)
    return finish(json({ error: 'Request failed' }, 500))
  }
}

export const config: Config = {
  path: ['/api/orgs', '/api/orgs/*', '/api/workspaces/*', '/api/support-bot/*', '/api/privacy/*'],
}
