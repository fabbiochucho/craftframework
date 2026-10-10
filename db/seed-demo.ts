// Demo data for the workspace platform. Run against a provisioned database, e.g.
//   netlify dev:exec node db/seed-demo.ts
// Idempotent: does nothing if the demo organization already exists.
import { eq } from 'drizzle-orm'
import {
  db, wsOrganizations, wsOrgMembers, workspaces, governanceAssessments, governanceScores, governanceFindings,
  capRecords, actionItems,
} from './index.js'

const OWNER = process.env.DEMO_OWNER_EMAIL ?? 'demo.owner@example.org'

const [existing] = await db.select().from(wsOrganizations).where(eq(wsOrganizations.name, 'Demo Ministry of Health'))
if (existing) {
  console.log('Demo data already present — skipping')
} else {
  const [org] = await db.insert(wsOrganizations).values({
    name: 'Demo Ministry of Health', type: 'government', country: 'Kenya', region: 'East Africa', contactEmail: OWNER,
  }).returning()
  await db.insert(wsOrgMembers).values([
    { userId: OWNER, orgId: org.id, role: 'owner' },
    { userId: 'demo.assessor@example.org', orgId: org.id, role: 'assessor' },
    { userId: 'demo.viewer@example.org', orgId: org.id, role: 'viewer' },
  ])
  const [ws] = await db.insert(workspaces).values({ orgId: org.id, workspaceName: 'FY2026 G2G readiness', description: 'Sample workspace' }).returning()
  const [a] = await db.insert(governanceAssessments).values({ orgId: org.id, workspaceId: ws.id, assessmentType: 'G2G', createdBy: 'demo.assessor@example.org' }).returning()
  await db.insert(governanceScores).values([
    { orgId: org.id, assessmentId: a.id, pillar: 'Governance', domain: 'Board Oversight', tierLevel: 4, evidenceUploaded: true },
    { orgId: org.id, assessmentId: a.id, pillar: 'Fiduciary', domain: 'Internal Controls', tierLevel: 2 },
    { orgId: org.id, assessmentId: a.id, pillar: 'Fiduciary', domain: 'Procurement', tierLevel: 1 },
  ])
  const [finding] = await db.insert(governanceFindings).values({
    orgId: org.id, assessmentId: a.id, domain: 'Procurement', severity: 'critical',
    description: 'No documented procurement thresholds or conflict-of-interest declarations.',
    recommendation: 'Adopt a procurement manual and annual declarations.',
  }).returning()
  await db.update(governanceAssessments).set({ findingsCount: 1 }).where(eq(governanceAssessments.id, a.id))
  const [cap] = await db.insert(capRecords).values({
    orgId: org.id, workspaceId: ws.id, sourceType: 'governance_finding', sourceId: finding.id,
    findingDescription: finding.description, severity: 'critical', correctiveAction: 'Publish procurement manual',
    assignedTo: 'demo.assessor@example.org', dueDate: new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10),
  }).returning()
  await db.insert(actionItems).values({ orgId: org.id, capId: cap.id, sequenceNum: 1, actionDescription: 'Draft procurement manual', owner: 'demo.assessor@example.org' })
  console.log(`Seeded demo org ${org.id}, workspace ${ws.id}`)
}
