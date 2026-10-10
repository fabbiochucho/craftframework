import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { and, asc, desc, eq, gte, inArray, lte, isNull, isNotNull, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  wsOrganizations, wsOrgMembers, workspaces, governanceAssessments, governanceScores, governanceFindings,
  esgFrameworks, esgRequirements, esgImplementationPlans, esgMilestones, capRecords, actionItems, actionLogs,
  evidenceRegistry, evidenceLinks, documentApprovals, reports, reportVersions, wsAuditLog, supportIssues,
  supportIssueResponses,
} from '../../db/schema.js'
import { resolveCaller, type Caller } from '../lib/auth.js'
import { HttpError, requireOrgAccess, requireWorkspaceAccess } from '../lib/orgAccess.js'
import { logger } from '../lib/logger.js'
import {
  ALLOWED_EVIDENCE_MIME, MAX_EVIDENCE_BYTES, SEVERITIES, buildScorecard, canAssignRole, capCloseBlockers,
  corsHeaders, csvEscape, effectiveCapStatus, evidenceExpiryState, hasMinRole,
  isVerifiedOrgEmailDomain, rateLimited, severityFromTier, summarizeCaps, tierFromScore, type OrgRole,
} from '../lib/workspace.js'

// ============================================================================
// Workspace platform API — orgs, governance, ESG, CAP, evidence, reports,
// support bot and audit. One route table; every route declares the minimum org
// role it needs and every query is filtered by the org id resolved from the
// workspace row (never from the request body).
// ============================================================================

const SUPPORT_EMAIL = 'craftframework@becomechange.institute'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const today = () => new Date().toISOString().slice(0, 10)

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

async function sendEmail(to: string[], subject: string, text: string): Promise<boolean> {
  const key = process.env.SENDGRID_API_KEY
  if (!key || !to.length) return false
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: to.map((email) => ({ email })) }],
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'noreply@craftframework.becomechange.institute' },
      subject,
      content: [{ type: 'text/plain', value: text }],
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

// --- ESG starter catalogue (seeded lazily per workspace) -------------------------------------
const ESG_CATALOGUE = [
  { name: 'ESRS', jurisdiction: 'EU', applicability: 'all', reqs: [
    ['ESRS E1-1', 'Transition plan for climate change mitigation', 'environmental', 'high'],
    ['ESRS S1-1', 'Policies related to own workforce', 'social', 'medium'],
    ['ESRS G1-1', 'Business conduct policies and corporate culture', 'governance', 'high'],
  ] },
  { name: 'ISSB', jurisdiction: 'global', applicability: 'all', reqs: [
    ['IFRS S1-GOV', 'Governance of sustainability-related risks and opportunities', 'governance', 'high'],
    ['IFRS S2-MET', 'Climate-related metrics and targets (GHG emissions)', 'environmental', 'high'],
  ] },
  { name: 'GRI', jurisdiction: 'global', applicability: 'sector_specific', reqs: [
    ['GRI 2-9', 'Governance structure and composition', 'governance', 'medium'],
    ['GRI 305-1', 'Direct (Scope 1) GHG emissions', 'environmental', 'medium'],
    ['GRI 403-1', 'Occupational health and safety management system', 'social', 'medium'],
  ] },
] as const

async function ensureEsgCatalogue(orgId: number, wsId: number) {
  const existing = await db.select({ id: esgFrameworks.id }).from(esgFrameworks)
    .where(and(eq(esgFrameworks.orgId, orgId), eq(esgFrameworks.workspaceId, wsId))).limit(1)
  if (existing.length) return
  const deadline = `${new Date().getUTCFullYear() + 1}-12-31`
  for (const f of ESG_CATALOGUE) {
    const [row] = await db.insert(esgFrameworks).values({
      orgId, workspaceId: wsId, frameworkName: f.name, jurisdiction: f.jurisdiction, applicability: f.applicability,
    }).returning()
    await db.insert(esgRequirements).values(f.reqs.map(([requirementId, requirementText, category, priority]) => ({
      orgId, frameworkId: row.id, requirementId, requirementText, category, priority, implementationDeadline: deadline,
    })))
  }
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
  const [version] = await db.insert(reportVersions).values({
    orgId, reportId: report.id, versionNum: 1,
    jsonExportUrl: `/api/workspaces/${wsId}/reports/${report.id}`,
  }).returning()
  await audit(c, orgId, wsId, 'report', report.id, 'create', { reportType })
  return json({ ...report, versions: [version] }, 201)
}

// ============================================================================
// Route table
// ============================================================================
const W = '/workspaces/:ws'
const A = `${W}/assessments/:id`
const routes: Route[] = [
  // ---------------------------- 2.1 Organizations ----------------------------
  { method: 'GET', pattern: '/orgs', access: 'authed', handler: async (_c, { caller }) => {
    const rows = await db.select({ org: wsOrganizations, role: wsOrgMembers.role }).from(wsOrgMembers)
      .innerJoin(wsOrganizations, eq(wsOrganizations.id, wsOrgMembers.orgId))
      .where(eq(wsOrgMembers.userId, caller.email))
    return json(rows.map((r) => ({ ...r.org, role: r.role })))
  } },
  { method: 'POST', pattern: '/orgs', access: 'authed', handler: async (c, { caller }) => {
    if (!isVerifiedOrgEmailDomain(caller.email)) throw new HttpError(403, 'An organizational (non-consumer) email domain is required to create an organization')
    const type = oneOf(c.body.type, 'type', ['government', 'ngo', 'private'] as const, 'private')
    const [org] = await db.insert(wsOrganizations).values({
      name: str(c.body.name, 'name', 200), type, country: str(c.body.country, 'country', 100, false),
      region: str(c.body.region, 'region', 100, false), contactEmail: str(c.body.contactEmail, 'contactEmail', 200, false) || caller.email,
      contactPhone: str(c.body.contactPhone, 'contactPhone', 50, false),
    }).returning()
    await db.insert(wsOrgMembers).values({ userId: caller.email, orgId: org.id, role: 'owner' })
    const [ws] = await db.insert(workspaces).values({ orgId: org.id, workspaceName: 'Main workspace' }).returning()
    await audit(c, org.id, ws.id, 'org', org.id, 'create', { name: org.name })
    return json({ ...org, role: 'owner', defaultWorkspaceId: ws.id }, 201)
  } },
  { method: 'PUT', pattern: '/orgs/:org', access: 'admin', scope: 'org', handler: async (c, { orgId }) => {
    const set: Record<string, unknown> = {}
    if (c.body.name !== undefined) set.name = str(c.body.name, 'name', 200)
    if (c.body.type !== undefined) set.type = oneOf(c.body.type, 'type', ['government', 'ngo', 'private'] as const)
    for (const k of ['country', 'region', 'contactEmail', 'contactPhone'] as const) if (c.body[k] !== undefined) set[k] = str(c.body[k], k, 200, false)
    if (!Object.keys(set).length) throw bad('nothing to update')
    const [org] = await db.update(wsOrganizations).set(set).where(eq(wsOrganizations.id, orgId)).returning()
    await audit(c, orgId, null, 'org', orgId, 'update', { fields: Object.keys(set) })
    return json(org)
  } },
  { method: 'GET', pattern: '/orgs/:org/members', access: 'viewer', scope: 'org', handler: async (_c, { orgId }) =>
    json(await db.select().from(wsOrgMembers).where(eq(wsOrgMembers.orgId, orgId)).orderBy(asc(wsOrgMembers.id))) },
  { method: 'POST', pattern: '/orgs/:org/members', access: 'admin', scope: 'org', handler: async (c, { orgId, role, caller }) => {
    const email = str(c.body.email, 'email', 200).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('email invalid')
    const target = oneOf(c.body.role, 'role', ['owner', 'admin', 'assessor', 'viewer'] as const, 'viewer')
    if (!canAssignRole(role, target)) throw new HttpError(403, 'Cannot assign that role')
    const [existing] = await db.select().from(wsOrgMembers).where(and(eq(wsOrgMembers.orgId, orgId), eq(wsOrgMembers.userId, email)))
    if (existing && existing.role === 'owner' && role !== 'owner') throw new HttpError(403, 'Only an owner can change an owner')
    if (existing && existing.role === 'owner' && target !== 'owner') {
      const owners = await db.select({ id: wsOrgMembers.id }).from(wsOrgMembers).where(and(eq(wsOrgMembers.orgId, orgId), eq(wsOrgMembers.role, 'owner')))
      if (owners.length < 2) throw new HttpError(409, 'Cannot demote the last owner')
    }
    const [m] = existing
      ? await db.update(wsOrgMembers).set({ role: target }).where(eq(wsOrgMembers.id, existing.id)).returning()
      : await db.insert(wsOrgMembers).values({ userId: email, orgId, role: target }).returning()
    await audit(c, orgId, null, 'org', orgId, existing ? 'update' : 'create', { member: email, role: target, by: caller.email })
    return json(m, existing ? 200 : 201)
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
    await audit(c, orgId, null, 'org', orgId, 'delete', { member: m.userId })
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
    const assessmentType = oneOf(c.body.assessmentType, 'assessmentType', ['G2G', 'ISO', 'COSO'] as const, 'G2G')
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(governanceAssessments)
      .where(and(eq(governanceAssessments.orgId, orgId), eq(governanceAssessments.workspaceId, wsId), eq(governanceAssessments.assessmentType, assessmentType)))
    const [a] = await db.insert(governanceAssessments).values({ orgId, workspaceId: wsId, assessmentType, version: n + 1, createdBy: caller.email }).returning()
    await audit(c, orgId, wsId, 'assessment', a.id, 'create', { assessmentType })
    return json(a, 201)
  } },
  { method: 'GET', pattern: A, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const a = await loadAssessment(orgId, wsId, intParam(c.p[1]))
    const [scores, findings] = await Promise.all([
      db.select().from(governanceScores).where(and(eq(governanceScores.orgId, orgId), eq(governanceScores.assessmentId, a.id))),
      db.select().from(governanceFindings).where(and(eq(governanceFindings.orgId, orgId), eq(governanceFindings.assessmentId, a.id))),
    ])
    return json({ ...a, scores, findings })
  } },
  { method: 'PUT', pattern: `${A}/scores/:pillar/:domain`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId, caller }) => {
    const a = await loadAssessment(orgId, wsId, intParam(c.p[1]))
    if (a.status !== 'draft') throw new HttpError(409, 'Assessment is locked for review')
    const score = Number(c.body.score)
    if (!Number.isFinite(score) || score < 0 || score > 5) throw bad('score must be 0-5')
    const pillar = str(decodeURIComponent(c.p[2]), 'pillar', 100)
    const domain = str(decodeURIComponent(c.p[3]), 'domain', 100)
    const values = {
      tierLevel: tierFromScore(score), evidenceUploaded: !!c.body.evidenceUploaded,
      reviewerNotes: str(c.body.reviewerNotes, 'reviewerNotes', 2000, false),
    }
    const [row] = await db.insert(governanceScores).values({ orgId, assessmentId: a.id, pillar, domain, ...values })
      .onConflictDoUpdate({ target: [governanceScores.assessmentId, governanceScores.pillar, governanceScores.domain], set: values }).returning()
    await audit(c, orgId, wsId, 'assessment', a.id, 'update', { pillar, domain, tier: row.tierLevel, by: caller.email })
    return json({ ...row, suggestedSeverity: severityFromTier(row.tierLevel) })
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
    const [f] = await db.insert(governanceFindings).values({
      orgId, assessmentId: a.id, domain, severity: oneOf(severity, 'severity', SEVERITIES),
      description: str(c.body.description, 'description', 4000), recommendation: str(c.body.recommendation, 'recommendation', 4000, false),
      evidenceLink: str(c.body.evidenceLink, 'evidenceLink', 500, false) || null,
      ownerAssignment: str(c.body.ownerAssignment, 'ownerAssignment', 200, false) || null, dueDate: dateOrNull(c.body.dueDate, 'dueDate'),
    }).returning()
    await refreshFindingsCount(orgId, a.id)
    await audit(c, orgId, wsId, 'assessment', a.id, 'create', { finding: f.id })
    return json(f, 201)
  } },
  { method: 'PUT', pattern: `${A}/findings/:fid`, access: 'assessor', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const a = await loadAssessment(orgId, wsId, intParam(c.p[1]))
    if (a.status === 'approved') throw new HttpError(409, 'Assessment is approved')
    const set: Record<string, unknown> = {}
    if (c.body.severity !== undefined) set.severity = oneOf(c.body.severity, 'severity', SEVERITIES)
    if (c.body.status !== undefined) set.status = oneOf(c.body.status, 'status', ['open', 'in_progress', 'resolved'] as const)
    if (c.body.ownerAssignment !== undefined) set.ownerAssignment = str(c.body.ownerAssignment, 'ownerAssignment', 200, false) || null
    if (c.body.dueDate !== undefined) set.dueDate = dateOrNull(c.body.dueDate, 'dueDate')
    if (c.body.recommendation !== undefined) set.recommendation = str(c.body.recommendation, 'recommendation', 4000, false)
    if (c.body.evidenceLink !== undefined) set.evidenceLink = str(c.body.evidenceLink, 'evidenceLink', 500, false) || null
    if (!Object.keys(set).length) throw bad('nothing to update')
    const [f] = await db.update(governanceFindings).set(set)
      .where(and(eq(governanceFindings.id, intParam(c.p[2])), eq(governanceFindings.orgId, orgId), eq(governanceFindings.assessmentId, a.id))).returning()
    if (!f) throw new HttpError(404, 'Not found')
    await audit(c, orgId, wsId, 'assessment', a.id, 'update', { finding: f.id, fields: Object.keys(set) })
    return json(f)
  } },
  { method: 'GET', pattern: `${A}/scorecard`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const a = await loadAssessment(orgId, wsId, intParam(c.p[1]))
    const [scores, findings] = await Promise.all([
      db.select().from(governanceScores).where(and(eq(governanceScores.orgId, orgId), eq(governanceScores.assessmentId, a.id))),
      db.select().from(governanceFindings).where(and(eq(governanceFindings.orgId, orgId), eq(governanceFindings.assessmentId, a.id))),
    ])
    return json({ assessment: a, ...buildScorecard(scores, findings) })
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
    return json(jurisdiction ? rows.filter((r) => r.jurisdiction.toLowerCase() === jurisdiction.toLowerCase()) : rows)
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
      description ??= f.f.description
      severity ??= f.f.severity
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
      const [dupLink] = await db.select({ id: evidenceLinks.id }).from(evidenceLinks).where(and(eq(evidenceLinks.orgId, orgId), eq(evidenceLinks.evidenceId, Number(c.body.evidenceId)), eq(evidenceLinks.targetType, 'cap'), eq(evidenceLinks.targetId, cap.id)))
      if (!dupLink) await db.insert(evidenceLinks).values({ orgId, evidenceId: Number(c.body.evidenceId), targetType: 'cap', targetId: cap.id, linkType: 'supports' })
      events.push({ event: 'updated', oldValue: null, newValue: `evidence:${c.body.evidenceId}` })
    }
    if (c.body.verify === true) {
      if (!hasMinRole(role, 'admin')) throw new HttpError(403, 'Only an admin can verify completion')
      if (!(set.evidenceUploadedAt ?? a.evidenceUploadedAt)) throw new HttpError(409, 'Evidence is required before verification')
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
    const [u] = await db.update(capRecords).set({ status: 'completed', completionDate: new Date() }).where(eq(capRecords.id, cap.id)).returning()
    await audit(c, orgId, wsId, 'cap', cap.id, 'update', { status: 'completed', by: caller.email })
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
    const key = `${orgId}/${wsId}/${crypto.randomUUID()}`
    await getStore('evidence').set(key, await file.arrayBuffer(), { metadata: { mimeType: file.type } })
    const [e] = await db.insert(evidenceRegistry).values({
      orgId, workspaceId: wsId, documentName: file.name.slice(0, 255), documentType, uploadedBy: caller.email, filePath: key,
      fileSizeKb: Math.ceil(file.size / 1024), mimeType: file.type, expiryDate: dateOrNull(form.get('expiryDate') || null, 'expiryDate'),
    }).returning()
    await audit(c, orgId, wsId, 'evidence', e.id, 'create', { name: e.documentName })
    return json(e, 201)
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
    return json({ ...e, expiryState: evidenceExpiryState(e.expiryDate), links, approvals })
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
      await db.insert(evidenceLinks).values({ orgId, evidenceId: e.id, targetType, targetId, linkType: oneOf(c.body.link.linkType, 'link.linkType', ['supports', 'verifies'] as const, 'supports') })
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
    await db.insert(documentApprovals).values({ orgId, evidenceId: e.id, reviewerId: caller.email, status, comments })
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
    return new Response(data, { headers: {
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
    const recipients: string[] = Array.isArray(c.body.recipients) && c.body.recipients.length ? c.body.recipients : [SUPPORT_EMAIL]
    if (recipients.length > 10 || recipients.some((e) => typeof e !== 'string' || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(e))) throw bad('recipients invalid (max 10 emails)')
    const sent = await sendEmail(recipients, `CRAFT report: ${r.reportType} (${r.dataAsOfDate})`,
      `A ${r.reportType} report was generated for workspace ${wsId} as of ${r.dataAsOfDate}.\n\n${JSON.stringify(r.statusSnapshot, null, 2).slice(0, 8000)}`)
    const [v] = await db.insert(reportVersions).values({
      orgId, reportId: r.id, versionNum: 1 + (await db.select({ id: reportVersions.id }).from(reportVersions).where(and(eq(reportVersions.orgId, orgId), eq(reportVersions.reportId, r.id)))).length,
      jsonExportUrl: `/api/workspaces/${wsId}/reports/${r.id}`, emailSentTo: recipients.join(','), sentAt: sent ? new Date() : null,
    }).returning()
    await audit(c, orgId, wsId, 'report', r.id, 'update', { emailed: recipients, delivered: sent })
    return json({ ...v, delivered: sent })
  } },
  { method: 'GET', pattern: `${W}/reports/:id/versions`, access: 'viewer', scope: 'workspace', handler: async (c, { orgId, wsId }) => {
    const [r] = await db.select({ id: reports.id }).from(reports).where(and(eq(reports.id, intParam(c.p[1])), eq(reports.orgId, orgId), eq(reports.workspaceId, wsId)))
    if (!r) throw new HttpError(404, 'Not found')
    return json(await db.select().from(reportVersions).where(and(eq(reportVersions.orgId, orgId), eq(reportVersions.reportId, r.id))).orderBy(desc(reportVersions.versionNum)))
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
  { method: 'GET', pattern: '/support-bot/issues', access: 'authed', handler: async (c, { caller }) => {
    const wsParam = c.url.searchParams.get('workspaceId')
    if (wsParam) {
      const { orgId, workspace } = await requireWorkspaceAccess(caller, intParam(wsParam), 'assessor')
      return json(await db.select().from(supportIssues).where(and(eq(supportIssues.orgId, orgId), eq(supportIssues.workspaceId, workspace.id))).orderBy(desc(supportIssues.id)).limit(200))
    }
    if (caller.role !== 'super_admin') throw new HttpError(403, 'Forbidden')
    return json(await db.select().from(supportIssues).orderBy(desc(supportIssues.id)).limit(200))
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
    if (issue.contactEmail) await sendEmail([issue.contactEmail], `Re: your CRAFT support issue #${issue.id}`, r.message)
    return json(r, 201)
  } },
]

async function submitIssue(c: Ctx, githubFirst: boolean): Promise<Response> {
  const category = oneOf(c.body.category, 'category', ['bug', 'feature', 'question', 'documentation'] as const, 'question')
  const description = str(c.body.description ?? c.body.message, 'description', 5000)
  const contactEmail = str(c.body.contactEmail ?? c.body.email, 'contactEmail', 200, false)
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw bad('contactEmail invalid')
  let orgId: number | null = null
  let workspaceId: number | null = null
  if (c.caller && c.body.workspaceId != null) {
    const ws = await requireWorkspaceAccess(c.caller, intParam(String(c.body.workspaceId)), 'viewer')
    orgId = ws.orgId
    workspaceId = ws.workspace.id
  }
  const label = githubFirst || category === 'question' ? 'community-question' : category
  const url = await createGithubIssue(`[${category}] ${description.slice(0, 80)}`, `${description}\n\n_Submitted via the CRAFT support bot._`, [label])
  const [issue] = await db.insert(supportIssues).values({ orgId, workspaceId, category, description, contactEmail, githubIssueUrl: url }).returning()
  const emailed = await sendEmail([SUPPORT_EMAIL], `[CRAFT ${category}] issue #${issue.id}`, `${description}\n\nContact: ${contactEmail || 'n/a'}\nGitHub: ${url ?? 'n/a'}`)
  return json({ ...issue, emailed }, 201)
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
      // Public (side-effecting) routes are always limited per IP, even with a session.
      if (r.access === 'public' && rateLimited(`pub:${ip}`, 100)) return finish(json({ error: 'Too many requests' }, 429))
      if (rateLimited(caller ? `u:${caller.email}` : `ip:${ip}`, caller ? 1000 : 100)) return finish(json({ error: 'Too many requests' }, 429))
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
  path: ['/api/orgs', '/api/orgs/*', '/api/workspaces/*', '/api/support-bot/*'],
}
