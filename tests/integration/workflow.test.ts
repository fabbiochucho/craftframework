// Segregation of duties, assessment locking, CAP closure rules, evidence
// handling and audit-row side effects, against a real Postgres.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import {
  ADMIN, ASSESSOR, OWNER, VIEWER, as, auditCount, blobStores, call, createAssessment, createCap, createOrg, expectStatus, pdfFile, rows,
  truncateAll, uploadEvidence,
} from './harness.ts'

let wsId = 0

describe('segregation of duties', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  it('does not let an assessment creator approve their own assessment', async () => {
    const id = await createAssessment(wsId, ADMIN) // admins hold assessor rights too
    expectStatus(await as(ADMIN).put(`/workspaces/${wsId}/assessments/${id}/scores/Pillar/Domain`, { score: 4 }), 200)
    expectStatus(await as(ADMIN).post(`/workspaces/${wsId}/assessments/${id}/submit`, {}), 200)
    const own = await as(ADMIN).post(`/workspaces/${wsId}/assessments/${id}/approve`, {})
    assert.equal(own.status, 403)
    assert.match(own.body.error, /Segregation of duties/)
    assert.equal((await rows('SELECT status FROM governance_assessments WHERE id = $1', [id]))[0].status, 'in_review')
    expectStatus(await as(OWNER).post(`/workspaces/${wsId}/assessments/${id}/approve`, {}), 200)
    const [a] = await rows('SELECT status FROM governance_assessments WHERE id = $1', [id])
    assert.equal(a.status, 'approved')
    assert.ok((await rows('SELECT verified_at FROM governance_scores WHERE assessment_id = $1', [id]))[0].verified_at)
  })

  it('does not let an evidence uploader approve their own evidence', async () => {
    const id = await uploadEvidence(wsId, ADMIN)
    const own = await as(ADMIN).post(`/workspaces/${wsId}/evidence/${id}/approve`, { status: 'approved' })
    assert.equal(own.status, 403)
    assert.match(own.body.error, /uploader cannot approve/)
    assert.equal((await rows('SELECT status FROM evidence_registry WHERE id = $1', [id]))[0].status, 'pending_review')
    assert.equal((await as(ASSESSOR).post(`/workspaces/${wsId}/evidence/${id}/approve`, {})).status, 403)
    expectStatus(await as(OWNER).post(`/workspaces/${wsId}/evidence/${id}/approve`, { status: 'approved', comments: 'looks fine' }), 200)
    assert.equal((await rows('SELECT status FROM evidence_registry WHERE id = $1', [id]))[0].status, 'approved')
    assert.equal((await rows('SELECT reviewer_id FROM document_approvals'))[0].reviewer_id, OWNER)
  })
})

describe('assessment locking', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  it('locks scores once submitted, allows rework after rejection and locks findings once approved', async () => {
    const id = await createAssessment(wsId)
    const score = (n: number) => as(ASSESSOR).put(`/workspaces/${wsId}/assessments/${id}/scores/Pillar/Domain`, { score: n })
    expectStatus(await score(1), 200)
    expectStatus(await as(ASSESSOR).post(`/workspaces/${wsId}/assessments/${id}/findings`, {
      domain: 'Domain', description: 'Weak controls', recommendation: 'Fix',
    }), 201)
    expectStatus(await as(ASSESSOR).post(`/workspaces/${wsId}/assessments/${id}/submit`, {}), 200)
    assert.equal((await score(3)).status, 409, 'score edit on a submitted assessment')
    assert.equal((await as(ASSESSOR).post(`/workspaces/${wsId}/assessments/${id}/submit`, {})).status, 409, 'double submit')
    expectStatus(await as(ADMIN).post(`/workspaces/${wsId}/assessments/${id}/reject`, { comments: 'More detail' }), 200)
    expectStatus(await score(3), 200)
    expectStatus(await as(ASSESSOR).post(`/workspaces/${wsId}/assessments/${id}/submit`, {}), 200)
    expectStatus(await as(ADMIN).post(`/workspaces/${wsId}/assessments/${id}/approve`, {}), 200)
    assert.equal((await score(5)).status, 409, 'score edit on an approved assessment')
    assert.equal((await as(ASSESSOR).post(`/workspaces/${wsId}/assessments/${id}/findings`, { domain: 'D', severity: 'low', description: 'late' })).status, 409)
    assert.equal((await as(ADMIN).post(`/workspaces/${wsId}/assessments/${id}/approve`, {})).status, 409, 'double approve')
    assert.equal((await rows('SELECT status FROM governance_assessments WHERE id = $1', [id]))[0].status, 'approved')
  })

  it('derives finding severity from a low score and keeps findings_count in sync', async () => {
    const id = await createAssessment(wsId)
    expectStatus(await as(ASSESSOR).put(`/workspaces/${wsId}/assessments/${id}/scores/Pillar/Domain`, { score: 0 }), 200)
    const f = expectStatus(await as(ASSESSOR).post(`/workspaces/${wsId}/assessments/${id}/findings`, { domain: 'Domain', description: 'No policy' }), 201)
    assert.ok(['critical', 'high'].includes(f.body.severity))
    assert.equal((await rows('SELECT findings_count FROM governance_assessments WHERE id = $1', [id]))[0].findings_count, 1)
    assert.equal((await as(ASSESSOR).post(`/workspaces/${wsId}/assessments/${id}/findings`, { domain: 'Unscored', description: 'x' })).status, 400)
  })
})

describe('CAP closure requires verified evidence on every action', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  const addAction = async (capId: number, description: string) =>
    expectStatus(await as(ASSESSOR).post(`/workspaces/${wsId}/cap/${capId}/actions`, { actionDescription: description }), 201).body.id as number

  it('blocks closing with no actions, missing evidence or unverified evidence', async () => {
    const capId = await createCap(wsId)
    const close = () => as(ADMIN).post(`/workspaces/${wsId}/cap/${capId}/close`, {})
    let res = await close()
    assert.equal(res.status, 409)
    assert.deepEqual(res.body.blockers, ['CAP has no action items'])

    const a1 = await addAction(capId, 'Draft policy')
    const a2 = await addAction(capId, 'Train staff')
    res = await close()
    assert.deepEqual(res.body.blockers, ['Action 1 has no evidence', 'Action 2 has no evidence'])

    const evidence = await uploadEvidence(wsId)
    expectStatus(await as(ASSESSOR).put(`/workspaces/${wsId}/cap/${capId}/actions/${a1}`, { evidenceId: evidence }), 200)
    expectStatus(await as(ASSESSOR).put(`/workspaces/${wsId}/cap/${capId}/actions/${a2}`, { evidenceId: evidence }), 200)
    res = await close()
    assert.deepEqual(res.body.blockers, ['Action 1 evidence is not verified', 'Action 2 evidence is not verified'])

    // Only an admin may verify, and only once evidence is attached.
    assert.equal((await as(ASSESSOR).put(`/workspaces/${wsId}/cap/${capId}/actions/${a1}`, { verify: true })).status, 403)
    expectStatus(await as(ADMIN).put(`/workspaces/${wsId}/cap/${capId}/actions/${a1}`, { verify: true }), 200)
    res = await close()
    assert.equal(res.status, 409)
    assert.deepEqual(res.body.blockers, ['Action 2 evidence is not verified'])
    assert.equal((await rows('SELECT status FROM cap_records WHERE id = $1', [capId]))[0].status, 'in_progress')

    expectStatus(await as(ADMIN).put(`/workspaces/${wsId}/cap/${capId}/actions/${a2}`, { verify: true }), 200)
    assert.equal((await as(ASSESSOR).post(`/workspaces/${wsId}/cap/${capId}/close`, {})).status, 403, 'assessors cannot close')
    const closed = expectStatus(await close(), 200)
    assert.equal(closed.body.status, 'completed')
    assert.ok(closed.body.completionDate)
    assert.equal((await close()).status, 409, 'already closed')
    assert.equal((await as(ASSESSOR).put(`/workspaces/${wsId}/cap/${capId}`, { severity: 'low' })).status, 409, 'closed CAP is read-only')
    assert.equal((await as(ASSESSOR).post(`/workspaces/${wsId}/cap/${capId}/actions`, { actionDescription: 'late' })).status, 409)
  })

  it('refuses verification without evidence and lets /cap/:id PUT move status only to open/in_progress', async () => {
    const capId = await createCap(wsId)
    const a = await addAction(capId, 'Draft policy')
    const res = await as(ADMIN).put(`/workspaces/${wsId}/cap/${capId}/actions/${a}`, { verify: true })
    assert.equal(res.status, 409)
    assert.equal((await as(ADMIN).put(`/workspaces/${wsId}/cap/${capId}`, { status: 'completed' })).status, 400)
    assert.equal((await rows('SELECT status FROM cap_records WHERE id = $1', [capId]))[0].status, 'in_progress')
  })
})

describe('evidence handling', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })
  const upload = (file: File) => as(ASSESSOR).upload(`/workspaces/${wsId}/evidence/upload`, file, { documentType: 'evidence' })

  it('enforces type and size limits', async () => {
    const MAX = 10 * 1024 * 1024
    expectStatus(await upload(new File([Buffer.alloc(MAX, 1)], 'max.zip', { type: 'application/zip' })), 201)
    assert.equal((await upload(new File([Buffer.alloc(MAX + 1, 1)], 'big.zip', { type: 'application/zip' }))).status, 400)
    assert.equal((await upload(new File([], 'empty.pdf', { type: 'application/pdf' }))).status, 400)
    for (const type of ['text/html', 'application/x-msdownload', 'image/svg+xml', 'application/javascript', '']) {
      assert.equal((await upload(new File(['x'], 'bad.bin', { type }))).status, 400, `type "${type}"`)
    }
    expectStatus(await upload(new File([Buffer.from([0x89, 0x50, 0x4e, 0x47])], 'scan.png', { type: 'image/png' })), 201)
    const noFile = await as(ASSESSOR).post(`/workspaces/${wsId}/evidence/upload`, {})
    assert.equal(noFile.status, 400)
    assert.equal((await rows('SELECT count(*)::int AS n FROM evidence_registry'))[0].n, 2, 'rejected uploads leave no rows')
    assert.equal([...blobStores().get('evidence')!.keys()].length, 2, 'rejected uploads leave no blobs')
  })

  it('soft-deletes evidence: hidden from reads, row and blob retained, audit written', async () => {
    const id = await uploadEvidence(wsId)
    const [{ file_path }] = await rows('SELECT file_path FROM evidence_registry WHERE id = $1', [id])
    expectStatus(await as(ADMIN).del(`/workspaces/${wsId}/evidence/${id}`), 200)
    assert.equal((await as(VIEWER).get(`/workspaces/${wsId}/evidence/${id}`)).status, 404)
    assert.equal((await as(VIEWER).get(`/workspaces/${wsId}/evidence/${id}/download`)).status, 404)
    assert.deepEqual((await as(VIEWER).get(`/workspaces/${wsId}/evidence`)).body, [])
    assert.equal((await as(ADMIN).del(`/workspaces/${wsId}/evidence/${id}`)).status, 404, 'cannot delete twice')
    const [row] = await rows('SELECT archived_at FROM evidence_registry WHERE id = $1', [id])
    assert.ok(row.archived_at)
    assert.ok(blobStores().get('evidence')!.has(file_path), 'blob retained for audit')
    assert.equal(await auditCount("resource_type = 'evidence' AND action = 'delete' AND resource_id = $1", [String(id)]), 1)
  })

  it('writes audit rows for downloads, report views and audit exports', async () => {
    const id = await uploadEvidence(wsId)
    const before = await auditCount("action = 'read'")
    const dl = expectStatus(await as(VIEWER).get(`/workspaces/${wsId}/evidence/${id}/download`), 200)
    assert.equal(dl.headers.get('content-type'), 'application/pdf')
    assert.equal(dl.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(await auditCount("resource_type = 'evidence' AND action = 'read' AND actor_id = $1 AND details->>'download' = 'true'", [VIEWER]), 1)

    const reportId = expectStatus(await as(ASSESSOR).post(`/workspaces/${wsId}/reports/governance-scorecard`, {}), 201).body.id
    expectStatus(await as(VIEWER).get(`/workspaces/${wsId}/reports/${reportId}`), 200)
    assert.equal(await auditCount("resource_type = 'report' AND action = 'read' AND actor_id = $1", [VIEWER]), 1)
    assert.ok((await rows('SELECT viewed_at FROM report_versions WHERE report_id = $1', [reportId]))[0].viewed_at)
    expectStatus(await as(VIEWER).get(`/workspaces/${wsId}/reports/${reportId}/pdf`), 200)
    assert.equal(await auditCount("resource_type = 'report' AND action = 'read' AND details->>'download' = 'pdf'"), 1)

    const json = expectStatus(await as(ADMIN).post(`/workspaces/${wsId}/audit-log/export`, {}), 200)
    assert.ok(Array.isArray(json.body))
    const csv = expectStatus(await as(ADMIN).post(`/workspaces/${wsId}/audit-log/export?format=csv`, {}), 200)
    assert.match(csv.headers.get('content-type') ?? '', /text\/csv/)
    assert.match(csv.text, /^id,timestamp,actorId,resourceType/)
    assert.equal(await auditCount("action = 'read' AND details ? 'auditExport' AND actor_id = $1", [ADMIN]), 2)
    assert.ok((await auditCount("action = 'read'")) >= before + 5)
    assert.equal((await as(ASSESSOR).post(`/workspaces/${wsId}/audit-log/export`, {})).status, 403)
  })

  it('accepts an expiry date, reports expiry alerts and rejects malformed dates', async () => {
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)
    const form = new FormData()
    form.set('file', pdfFile('cert.pdf'))
    form.set('documentType', 'certification')
    form.set('expiryDate', soon)
    const res = await call(ASSESSOR, 'POST', `/workspaces/${wsId}/evidence/upload`, { form })
    expectStatus(res, 201)
    const alerts = expectStatus(await as(VIEWER).get(`/workspaces/${wsId}/evidence/expiry-alerts`), 200)
    assert.equal(alerts.body.length, 1)
    const bad = new FormData()
    bad.set('file', pdfFile('cert.pdf'))
    bad.set('expiryDate', '10/10/2030')
    assert.equal((await call(ASSESSOR, 'POST', `/workspaces/${wsId}/evidence/upload`, { form: bad })).status, 400)
  })
})
