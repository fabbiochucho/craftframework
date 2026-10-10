// GDPR data-subject export and admin-approved erasure, against a real Postgres.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import {
  ADMIN, ASSESSOR, OUTSIDER, OWNER, VIEWER, as, auditCount, blobStores, createAssessment, createCap, createOrg, expectStatus, pdfFile,
  rows, truncateAll, uploadEvidence,
} from './harness.ts'

let orgId = 0, wsId = 0

describe('GDPR export', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ orgId, wsId } = await createOrg('Acme Org'))
  })

  it('contains only the requester\'s own records within orgs they belong to', async () => {
    // Own data (assessor) and colleagues' data (admin) in the authorised org.
    const mineAssessment = await createAssessment(wsId, ASSESSOR)
    const theirAssessment = await createAssessment(wsId, ADMIN)
    const mineEvidence = await uploadEvidence(wsId, ASSESSOR, pdfFile('assessor-evidence.pdf'))
    await uploadEvidence(wsId, ADMIN, pdfFile('admin-evidence.pdf'))
    const mineCap = await createCap(wsId, ASSESSOR, { assignedTo: ASSESSOR })
    await createCap(wsId, ADMIN, { assignedTo: ADMIN, findingDescription: 'Admin-only CAP' })
    expectStatus(await as(ADMIN).post(`/workspaces/${wsId}/reports/schedules`, {
      reportType: 'cap_summary', cadence: 'weekly', recipients: ['colleague-secret@acme.example'],
    }), 201)
    expectStatus(await as(ASSESSOR).post(`/workspaces/${wsId}/reports/cap-summary`, {}), 201)
    expectStatus(await as(ADMIN).post(`/workspaces/${wsId}/reports/esg-status`, {}), 201)
    await as(null).post('/support-bot/submit-issue', { description: 'Someone else\'s issue', contactEmail: 'stranger@public.example' })
    await as(ASSESSOR).post('/support-bot/submit-issue', { description: 'My own issue', contactEmail: ASSESSOR })

    // A completely separate org the requester does not belong to.
    const otherOwner = 'owner@beta.example'
    const other = await createOrg('Beta Confidential Org', otherOwner, {})
    await createAssessment(other.wsId, otherOwner)
    await uploadEvidence(other.wsId, otherOwner, pdfFile('beta-secret.pdf'))
    await createCap(other.wsId, otherOwner, { findingDescription: 'Beta-only CAP' })
    await rows("INSERT INTO audit_logs (actor, action, target) VALUES ($1, 'signed in', 'app'), ($2, 'signed in', 'app')", [ASSESSOR, otherOwner])

    const res = expectStatus(await as(ASSESSOR).get('/privacy/export'), 200)
    assert.match(res.headers.get('content-disposition') ?? '', /attachment; filename="craft-data-export\.json"/)
    assert.equal(res.headers.get('cache-control'), 'no-store')
    const bundle = res.body
    assert.equal(bundle.subject, ASSESSOR)
    assert.deepEqual(bundle.memberships.map((m: any) => m.userId), [ASSESSOR])
    assert.deepEqual(bundle.organizations.map((o: any) => o.name), ['Acme Org'])
    assert.deepEqual(bundle.workspaces.map((w: any) => w.orgId), [orgId])
    assert.deepEqual(bundle.assessments.map((a: any) => a.id), [mineAssessment])
    assert.ok(!bundle.assessments.some((a: any) => a.id === theirAssessment))
    assert.deepEqual(bundle.evidence.map((e: any) => e.documentName), ['assessor-evidence.pdf'])
    assert.equal(bundle.evidence[0].id, mineEvidence)
    assert.deepEqual(bundle.capRecords.map((c: any) => c.id), [mineCap])
    assert.deepEqual(bundle.reportSchedules, [], 'schedules created by or addressed to others are excluded')
    assert.equal(bundle.reports.length, 1)
    assert.ok(bundle.auditEntries.length > 0 && bundle.auditEntries.every((a: any) => a.actorId === ASSESSOR))
    assert.deepEqual(bundle.legacyAuditEntries.map((a: any) => a.actor), [ASSESSOR])
    assert.deepEqual(bundle.supportIssues.map((i: any) => i.description), ['My own issue'])
    assert.ok(bundle.supportIssues[0].contactEmail === ASSESSOR, 'contact email decrypted for the subject')

    // Nothing from the other org or from colleagues leaks anywhere in the document.
    for (const forbidden of ['Beta Confidential', 'beta-secret', 'Beta-only', otherOwner, 'admin-evidence', 'Admin-only CAP',
      'colleague-secret', 'stranger@public', ADMIN, VIEWER]) {
      assert.ok(!res.text.includes(forbidden), `export leaked "${forbidden}"`)
    }
    assert.ok(!res.text.includes('enc:v'), 'no ciphertext in the export')
    assert.equal(await auditCount("resource_type = 'gdpr_export' AND actor_id = $1 AND org_id = $2", [ASSESSOR, orgId]), 1)
  })

  it('exports an empty, audited bundle for an authenticated user with no memberships', async () => {
    const res = expectStatus(await as(OUTSIDER).get('/privacy/export'), 200)
    assert.deepEqual(res.body.memberships, [])
    assert.deepEqual(res.body.assessments, [])
    assert.deepEqual(res.body.organizations, [])
    assert.equal((await rows("SELECT count(*)::int AS n FROM audit_logs WHERE actor = $1 AND category = 'Privacy'", [OUTSIDER]))[0].n, 1)
    assert.equal((await as(null).get('/privacy/export')).status, 401)
  })
})

describe('GDPR erasure', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ orgId, wsId } = await createOrg('Acme Org'))
  })
  const request = (user: string, org = orgId) => as(user).post('/privacy/erasure-requests', { orgId: org })

  it('requires membership to file, is idempotent while pending and is listed per role', async () => {
    assert.equal((await request(OUTSIDER)).status, 404)
    const first = expectStatus(await request(ADMIN), 201).body
    assert.equal(first.status, 'pending')
    assert.equal(first.requestType, 'erasure')
    const again = expectStatus(await request(ADMIN), 200).body
    assert.equal(again.id, first.id)
    expectStatus(await request(VIEWER), 201)
    assert.equal((await rows('SELECT count(*)::int AS n FROM gdpr_requests'))[0].n, 2)

    const ids = async (u: string) => (await as(u).get('/privacy/erasure-requests')).body.map((r: any) => r.requestedBy).sort()
    assert.deepEqual(await ids(VIEWER), [VIEWER], 'a viewer sees only their own request')
    assert.deepEqual(await ids(ADMIN), [ADMIN, VIEWER].sort(), 'an org admin sees the org queue')
    assert.deepEqual(await ids(OWNER), [ADMIN, VIEWER].sort())
    assert.deepEqual(await ids(OUTSIDER), [])
    assert.equal((await as(null).get('/privacy/erasure-requests')).status, 401)
  })

  it('needs a different admin: self, non-admin and foreign-org approvals are rejected', async () => {
    const req = expectStatus(await request(ADMIN), 201).body
    const approve = (u: string) => as(u).post(`/privacy/erasure-requests/${req.id}/approve`, {})
    const own = await approve(ADMIN)
    assert.equal(own.status, 403)
    assert.match(own.body.error, /different organization admin/)
    assert.equal((await approve(ASSESSOR)).status, 403)
    assert.equal((await approve(VIEWER)).status, 403)
    assert.equal((await approve(OUTSIDER)).status, 404)
    await createOrg('Beta Org', 'owner@beta.example', {})
    assert.equal((await approve('owner@beta.example')).status, 404)
    assert.equal((await as(OWNER).post('/privacy/erasure-requests/999999/approve', {})).status, 404)
    assert.equal((await rows('SELECT status FROM gdpr_requests'))[0].status, 'pending')
    assert.equal((await rows('SELECT count(*)::int AS n FROM ws_org_members WHERE role = \'admin\''))[0].n, 1, 'membership untouched')
  })

  it('pseudonymises the subject across org data while preserving every audit row', async () => {
    // The admin generates a trail of activity.
    const assessmentId = await createAssessment(wsId, ADMIN)
    expectStatus(await as(ADMIN).put(`/workspaces/${wsId}/assessments/${assessmentId}/scores/Pillar/Domain`, { score: 2, reviewerNotes: 'n' }), 200)
    const evidenceId = await uploadEvidence(wsId, ADMIN)
    const capId = await createCap(wsId, ADMIN, { assignedTo: ADMIN })
    expectStatus(await as(ADMIN).post(`/workspaces/${wsId}/cap/${capId}/actions`, { actionDescription: 'Do it', owner: ADMIN }), 201)
    expectStatus(await as(ADMIN).put(`/workspaces/${wsId}/cap/${capId}/actions/1`, { evidenceId }), 200)
    expectStatus(await as(ADMIN).post(`/workspaces/${wsId}/reports/cap-summary`, {}), 201)
    expectStatus(await as(ADMIN).post(`/workspaces/${wsId}/reports/schedules`, {
      reportType: 'cap_summary', cadence: 'weekly', recipients: [ADMIN, 'keep@acme.example'],
    }), 201)
    // An archived (soft-deleted) evidence blob is purged on erasure.
    const archivedId = await uploadEvidence(wsId, ASSESSOR)
    const [{ file_path: archivedKey }] = await rows('SELECT file_path FROM evidence_registry WHERE id = $1', [archivedId])
    expectStatus(await as(OWNER).del(`/workspaces/${wsId}/evidence/${archivedId}`), 200)
    assert.ok(blobStores().get('evidence')!.has(archivedKey))

    const req = expectStatus(await request(ADMIN), 201).body
    const totalBefore = await auditCount('org_id = $1', [orgId])
    const subjectRowsBefore = await auditCount('actor_id = $1', [ADMIN])
    assert.ok(subjectRowsBefore >= 5)

    const approved = expectStatus(await as(OWNER).post(`/privacy/erasure-requests/${req.id}/approve`, {}), 200).body
    assert.equal(approved.status, 'approved')
    assert.equal(approved.approvedBy, OWNER)
    assert.ok(approved.approvedAt)
    assert.equal((await as(OWNER).post(`/privacy/erasure-requests/${req.id}/approve`, {})).status, 409, 'cannot approve twice')

    // Audit rows are preserved (and only added to), with the actor pseudonymised.
    assert.ok((await auditCount('org_id = $1', [orgId])) >= totalBefore)
    assert.equal(await auditCount('actor_id = $1', [ADMIN]), 0)
    const [{ actor_id: pseudonym }] = await rows("SELECT actor_id FROM ws_audit_log WHERE actor_id LIKE 'erased:%' LIMIT 1")
    assert.match(pseudonym, /^erased:[0-9a-f]{24}$/)
    assert.equal(await auditCount('actor_id = $1', [pseudonym]), subjectRowsBefore)

    // The subject's identity is gone from every org table; the work product stays.
    const identityHits = [
      ['ws_audit_log', 'ws_audit_log'], ['governance_assessments', 'governance_assessments'], ['cap_records', 'cap_records'],
      ['action_items', 'action_items'], ['action_logs', 'action_logs'], ['evidence_registry', 'evidence_registry'],
      ['document_approvals', 'document_approvals'], ['reports', 'reports'], ['report_schedules', 'report_schedules'],
    ]
    for (const [table] of identityHits) {
      const hit = await rows(`SELECT count(*)::int AS n FROM ${table} t WHERE t::text ILIKE $1`, [`%${ADMIN}%`])
      assert.equal(hit[0].n, 0, `${table} still contains the erased email`)
    }
    assert.equal((await rows('SELECT created_by FROM governance_assessments WHERE id = $1', [assessmentId]))[0].created_by, pseudonym)
    assert.equal((await rows('SELECT assigned_to FROM cap_records WHERE id = $1', [capId]))[0].assigned_to, pseudonym)
    assert.equal((await rows('SELECT uploaded_by FROM evidence_registry WHERE id = $1', [evidenceId]))[0].uploaded_by, pseudonym)
    assert.equal((await rows('SELECT generated_by FROM reports'))[0].generated_by, pseudonym)
    assert.equal((await rows('SELECT count(*)::int AS n FROM cap_records'))[0].n, 1)
    assert.equal((await rows('SELECT count(*)::int AS n FROM ws_org_members WHERE role = \'admin\''))[0].n, 0, 'membership removed')
    const [schedule] = (await as(OWNER).get(`/workspaces/${wsId}/reports/schedules`)).body
    assert.deepEqual(schedule.recipients, ['keep@acme.example'])
    assert.equal(schedule.createdBy, pseudonym)

    // Archived evidence is hard-deleted along with its blob.
    assert.equal(blobStores().get('evidence')!.has(archivedKey), false)
    assert.equal((await rows('SELECT count(*)::int AS n FROM evidence_registry WHERE id = $1', [archivedId]))[0].n, 0)

    // The erased subject no longer has access.
    assert.equal((await as(ADMIN).get(`/orgs/${orgId}/members`)).status, 404)
    assert.ok((await rows("SELECT 1 FROM ws_audit_log WHERE resource_type = 'gdpr_erasure' AND actor_id = $1", [OWNER])).length >= 2)
  })

  it('protects the last owner from erasure until ownership is transferred', async () => {
    const req = expectStatus(await request(OWNER), 201).body
    const blocked = await as(ADMIN).post(`/privacy/erasure-requests/${req.id}/approve`, {})
    assert.equal(blocked.status, 409)
    assert.match(blocked.body.error, /last owner/)
    expectStatus(await as(OWNER).post(`/orgs/${orgId}/members`, { email: ADMIN, role: 'owner' }), 200)
    expectStatus(await as(ADMIN).post(`/privacy/erasure-requests/${req.id}/approve`, {}), 200)
    assert.equal((await rows("SELECT count(*)::int AS n FROM ws_org_members WHERE role = 'owner'"))[0].n, 1)
  })
})
