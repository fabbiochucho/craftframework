// NPHI, JEE and SPAR assessments (Org Workspaces) seen from the main CRAFT organisation they belong to
// (ws_organizations.craft_org_id): the institute's dashboard card and progress steps, its independent assessor's
// scores beside the institute's own, and the results a funder sees for a grant an assessment is linked to.
// Checked by tests/integration/nphi.test.ts.
import { and, desc, eq, inArray, isNotNull, isNull, like } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  catalogueIndependentScores, ccaAssessments, evidenceRegistry, governanceAssessments, governanceScores, responses, wsOrganizations, workspaces,
} from '../../db/schema.js'
import { catalogueByType, RESTRICTED_LABELS } from '../../src/lib/assessment-catalogues.js'
import { catalogueScore, type Responses } from '../../src/lib/health-security.js'
import { evidenceExpiryState } from './workspace.js'

/** The assessment types shown on the institute's dashboard and open to its independent assessor. */
export const NPHI_TYPES = ['NPHI', 'JEE', 'SPAR', 'JEE_SUB'] as const
export const isNphiType = (t: string) => (NPHI_TYPES as readonly string[]).includes(t)

type ScoreRow = { domain: string; tierLevel: number; evidenceUploaded: boolean; evidenceId: number | null; notApplicable: boolean; naReason: string }

/** Evidence documents that still count: not archived, rejected or expired. */
export async function liveEvidenceIds(orgId: number, ids: (number | null)[]): Promise<Set<number>> {
  const want = [...new Set(ids.filter((x): x is number => x !== null))]
  if (!want.length) return new Set()
  const docs = await db.select().from(evidenceRegistry).where(and(eq(evidenceRegistry.orgId, orgId), inArray(evidenceRegistry.id, want), isNull(evidenceRegistry.archivedAt)))
  return new Set(docs.filter((d) => d.status !== 'rejected' && evidenceExpiryState(d.expiryDate) !== 'expired').map((d) => d.id))
}

/** The institute's own answers. An older row without a document keeps its stored evidence flag. */
export async function catalogueResponses(orgId: number, scores: ScoreRow[]): Promise<Responses> {
  const live = await liveEvidenceIds(orgId, scores.map((s) => s.evidenceId))
  const evidenced = (s: ScoreRow) => (s.evidenceId === null ? s.evidenceUploaded : live.has(s.evidenceId))
  return Object.fromEntries(scores.map((s) => [s.domain, { score: s.notApplicable ? null : s.tierLevel, evidence: evidenced(s), notApplicable: s.notApplicable, naReason: s.naReason }]))
}

/** The independent assessor's levels. They score what they have seen, so no evidence cap applies. */
export function independentResponses(rows: { domain: string; score: number | null; notApplicable: boolean; note: string }[]): Responses {
  return Object.fromEntries(rows.map((r) => [r.domain, { score: r.notApplicable ? null : r.score, evidence: true, notApplicable: r.notApplicable, naReason: r.note }]))
}

export type AssessmentSummary = {
  id: number; workspaceId: number; wsOrgId: number; type: string; label: string; version: number; status: string; reportingPeriod: string
  own: { overall: number | null; completeness: number }; independent: { overall: number | null; answered: number; total: number }
}

export async function summarise(a: typeof governanceAssessments.$inferSelect): Promise<AssessmentSummary> {
  const cat = catalogueByType(a.assessmentType)!
  const [own, ind] = await Promise.all([
    db.select().from(governanceScores).where(and(eq(governanceScores.orgId, a.orgId), eq(governanceScores.assessmentId, a.id))),
    db.select().from(catalogueIndependentScores).where(eq(catalogueIndependentScores.assessmentId, a.id)),
  ])
  const o = catalogueScore(cat, await catalogueResponses(a.orgId, own), a.innovationSupport)
  const i = catalogueScore(cat, independentResponses(ind), a.innovationSupport)
  return {
    id: a.id, workspaceId: a.workspaceId, wsOrgId: a.orgId, type: a.assessmentType, label: RESTRICTED_LABELS[a.assessmentType] ?? a.assessmentType,
    version: a.version, status: a.status, reportingPeriod: a.reportingPeriod ?? '',
    own: { overall: o.overall, completeness: o.completeness },
    independent: { overall: ind.length ? i.overall : null, answered: ind.length, total: i.items.length },
  }
}

/** The institutes (Org Workspaces organisations) joined to a CRAFT organisation, with their assessments, newest first. */
export async function linkedTo(craftOrgId: string) {
  const orgs = await db.select().from(wsOrganizations).where(eq(wsOrganizations.craftOrgId, craftOrgId))
  if (!orgs.length) return { orgs: [], assessments: [] as AssessmentSummary[] }
  const ids = orgs.map((o) => o.id)
  const [ws, list] = await Promise.all([
    db.select().from(workspaces).where(inArray(workspaces.orgId, ids)),
    db.select().from(governanceAssessments).where(and(inArray(governanceAssessments.orgId, ids), inArray(governanceAssessments.assessmentType, [...NPHI_TYPES]))).orderBy(desc(governanceAssessments.id)),
  ])
  return {
    orgs: orgs.map((o) => ({ id: o.id, name: o.name, type: o.type, typeVerification: o.typeVerification, workspaceId: ws.filter((w) => w.orgId === o.id).map((w) => w.id).sort((x, y) => x - y)[0] ?? null })),
    assessments: await Promise.all(list.map(summarise)),
  }
}

/** An NPHI-type assessment and the CRAFT organisation its institute belongs to (null when it has none). */
export async function assessmentWithCraftOrg(id: number) {
  const [a] = await db.select().from(governanceAssessments).where(eq(governanceAssessments.id, id))
  if (!a || !isNphiType(a.assessmentType)) return null
  const [org] = await db.select().from(wsOrganizations).where(eq(wsOrganizations.id, a.orgId))
  return org?.craftOrgId ? { a, org, craftOrgId: org.craftOrgId } : null
}

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null)

/** One line of results for an assessment linked to a grant (assessment_links keys), for the grant's funder. */
export async function assessmentResult(orgId: string, key: string): Promise<{ key: string; label: string; summary: string }> {
  const ws = /^ws:(\d+)$/.exec(key)?.[1]
  if (ws) {
    const found = await assessmentWithCraftOrg(Number(ws))
    if (!found || found.craftOrgId !== orgId) return { key, label: 'Assessment', summary: 'No longer available' }
    const s = await summarise(found.a)
    const pct = (v: number | null) => (v === null ? '—' : `${v}%`)
    return { key, label: `${s.label} v${s.version}${s.reportingPeriod ? ` (${s.reportingPeriod})` : ''}`,
      summary: `${s.status.replace('_', ' ')} · institute ${pct(s.own.overall)} (${s.own.completeness}% answered) · independent assessor ${s.independent.answered ? pct(s.independent.overall) : 'not yet scored'}` }
  }
  if (key === 'craft-onc') {
    const rows = await db.select().from(responses).where(and(eq(responses.orgId, orgId), like(responses.questionId, 'CRAFT-ONC-%')))
    const own = rows.filter((r) => r.selfAt).map((r) => r.score)
    const ind = rows.map((r) => r.assessorScore).filter((x): x is number => x !== null)
    return { key, label: 'CRAFT-ONC', summary: `${own.length} of 44 answered, mean ${mean(own) ?? '—'} of 5 · independent assessor ${ind.length ? `${ind.length} scored, mean ${mean(ind)} of 5` : 'not yet scored'}` }
  }
  if (key === 'wizard') {
    const rows = await db.select({ q: responses.questionId }).from(responses).where(and(eq(responses.orgId, orgId), isNotNull(responses.selfAt)))
    return { key, label: '5-tier Assessment Wizard', summary: `${rows.filter((r) => !r.q.startsWith('CRAFT-ONC-')).length} questions answered` }
  }
  const cca = /^cca:(.+)$/.exec(key)?.[1]
  if (cca) {
    const [c] = await db.select().from(ccaAssessments).where(and(eq(ccaAssessments.id, cca), eq(ccaAssessments.orgId, orgId)))
    return { key, label: c ? `Capacity Assessment ${c.year}` : 'Capacity Assessment', summary: c ? c.status : 'No longer available' }
  }
  return { key, label: key, summary: '' }
}
