// ESG Report Quality Checklist: applicability, evidence-gated status, N/A approval, critical
// gates, CAP linkage, finalised snapshots, carry-forward and tenant isolation, against Postgres.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { ADMIN, ASSESSOR, OUTSIDER, OWNER, VIEWER, as, createOrg, expectStatus, rows, truncateAll, uploadEvidence } from './harness.ts'

let wsId = 0
const P = () => `/workspaces/${wsId}`
const profileNG = { jurisdiction: 'NG', category: 'ng_pie', secScope: true, mofiScope: false, mofiOverlay: true, financialActivities: false, adoptingVoluntarily: false }

const newPeriod = async (body: Record<string, unknown> = {}, user = ASSESSOR) =>
  expectStatus(await as(user).post(`${P()}/qa/periods`, { label: 'FY2028', periodStart: '2028-01-01', periodEnd: '2028-12-31', profile: profileNG, ...body }), 201).body.id as number

describe('ESG Report Quality Checklist', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  it('serves the catalogue with jurisdictions and the approved 30-check baseline', async () => {
    const cat = expectStatus(await as(VIEWER).get(`${P()}/qa/catalogue`), 200).body
    assert.ok(cat.jurisdictions.some((j: any) => j.code === 'KE'))
    assert.equal(cat.legacy.imported, 30)
    assert.equal(cat.legacy.reconciled, true)
    assert.equal(cat.legacy.approvedOn, '2026-10-12')
    assert.ok(!('condition' in cat.checks[0]))
  })

  it('validates profiles and applies the right packs per jurisdiction and period', async () => {
    assert.equal((await as(ASSESSOR).post(`${P()}/qa/periods`, { label: 'x', periodStart: '2028-01-01', periodEnd: '2028-12-31', profile: { jurisdiction: 'XX', category: 'a' } })).status, 400)
    assert.equal((await as(ASSESSOR).post(`${P()}/qa/periods`, { label: 'x', periodStart: '2028-01-01', periodEnd: '2028-12-31', profile: { jurisdiction: 'KE', category: 'ng_pie' } })).status, 400)
    assert.equal((await as(VIEWER).post(`${P()}/qa/periods`, { label: 'x', periodStart: '2028-01-01', periodEnd: '2028-12-31', profile: profileNG })).status, 403)

    const ng = expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${await newPeriod()}`), 200).body
    const ids = ng.rows.map((r: any) => r.id)
    assert.ok(ids.includes('S1-04') && ids.includes('GQ-01') && ids.includes('EC-01') && ids.includes('SEC-01') && ids.includes('FRC-10') && ids.includes('MOFI-01'))
    assert.equal(ng.rows.find((r: any) => r.id === 'MOFI-01').mandatory, false, 'MOFI overlay is a benchmark when not in scope')
    assert.equal(ng.applicability.status, 'mandatory')

    // The same entity in a period beginning in 2027 is not yet mandatory (SRG 1 §18).
    const early = expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${await newPeriod({ label: 'FY2027/28', periodStart: '2027-07-01', periodEnd: '2028-06-30' })}`), 200).body
    assert.equal(early.applicability.status, 'not_required')
    assert.ok(!early.rows.some((r: any) => r.id.startsWith('S1-')))
    assert.ok(early.rows.some((r: any) => r.id === 'GQ-01'), 'general quality applies to every report')

    const ke = expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${await newPeriod({ label: 'KE FY2027', periodStart: '2027-01-01', periodEnd: '2027-12-31', profile: { jurisdiction: 'KE', category: 'ke_pie', secScope: true, mofiScope: true } })}`), 200).body
    const keIds = ke.rows.map((r: any) => r.id)
    assert.ok(keIds.includes('KE-01') && !keIds.some((i: string) => /^(SEC|FRC|MOFI)-/.test(i)), 'Nigerian packs never apply outside Nigeria')
  })

  it('gates Met on accepted evidence, requires approved N/A, blocks finalisation, and freezes the snapshot', async () => {
    const id = await newPeriod({}, OWNER)
    const put = (check: string, body: Record<string, unknown>, user = ASSESSOR) => as(user).put(`${P()}/qa/periods/${id}/checks/${check}`, body)
    assert.equal((await put('NOT-A-CHECK', { status: 'in_progress' })).status, 400)
    assert.equal((await put('S1-04', { status: 'met' })).status, 409, 'Met without evidence')
    const ev = await uploadEvidence(wsId)
    assert.equal((await put('S1-04', { status: 'met', evidenceId: ev })).status, 409, 'Met with pending evidence')
    expectStatus(await put('S1-04', { evidenceId: ev, owner: 'CFO' }), 200)
    let view = expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${id}`), 200).body
    assert.equal(view.rows.find((r: any) => r.id === 'S1-04').evidenceState, 'pending')
    assert.ok(view.summary.unreviewedEvidence.includes('S1-04'))

    expectStatus(await as(ADMIN).post(`${P()}/evidence/${ev}/approve`, { status: 'approved' }), 200)
    expectStatus(await put('S1-04', { status: 'met' }), 200)
    assert.equal((await put('S1-05', { status: 'partially_met' })).status, 400, 'partial needs the unmet criteria')
    assert.equal((await put('S1-06', { status: 'blocked' })).status, 400, 'blocked needs a blocker')
    expectStatus(await put('S1-06', { status: 'blocked', blocker: 'Awaiting board meeting (Company Secretary, escalate 2028-03-01)' }), 200)
    assert.equal((await put('S1-07', { status: 'not_met' })).status, 400, 'not met needs the gap')
    assert.equal((await put('S1-07', { status: 'returned' })).status, 400, 'returned needs what is missing')
    assert.equal((await put('S1-07', { status: 'pending_review' })).status, 400, 'pending review needs evidence')
    assert.equal((await put('GQ-10', { status: 'exception_approved', notes: 'x' })).status, 403, 'only admins approve exceptions')
    assert.equal((await put('S1-07', { status: 'exception_approved', notes: 'x' }, ADMIN)).status, 409, 'no exceptions on mandatory checks')
    expectStatus(await put('GQ-10', { status: 'exception_approved', notes: 'Planned improvements reported separately this year' }, ADMIN), 200)
    assert.equal((await put('S1-14', { status: 'not_applicable' })).status, 400, 'N/A needs a reason')
    expectStatus(await put('S1-14', { status: 'not_applicable', naReason: 'Horizons defined in the financial statements' }, ADMIN), 200)
    const ownNa = await as(ADMIN).post(`${P()}/qa/periods/${id}/checks/S1-14/approve-na`, {})
    assert.equal(ownNa.status, 403, 'cannot approve your own N/A')
    expectStatus(await as(OWNER).post(`${P()}/qa/periods/${id}/checks/S1-14/approve-na`, {}), 200)

    view = expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${id}`), 200).body
    assert.ok(view.summary.score > 0)
    assert.equal(view.summary.readyForApproval, false)
    assert.ok(view.summary.criticalOpen.length > 0)

    // A failed check becomes a corrective action carrying its context.
    const cap = expectStatus(await as(ASSESSOR).post(`${P()}/qa/periods/${id}/checks/S1-03/cap`, { rootCause: 'No materiality process' }), 201).body
    assert.equal(cap.sourceType, 'qa_check')
    assert.equal(cap.severity, 'critical')
    assert.match(cap.findingDescription, /S1-03 Materiality process/)
    view = expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${id}`), 200).body
    assert.equal(view.actions.total, 1)
    assert.equal(cap.rootCause, 'No materiality process')

    // Finalisation: preparer can't approve; blockers stop it.
    assert.equal((await as(OWNER).post(`${P()}/qa/periods/${id}/finalise`, {})).status, 403, 'preparer cannot approve')
    const blocked = await as(ADMIN).post(`${P()}/qa/periods/${id}/finalise`, {})
    assert.equal(blocked.status, 409)
    assert.ok(blocked.body.blockers.some((b: string) => /critical/.test(b)))

    // Satisfy every applicable check, then finalise and confirm the snapshot is frozen.
    view = expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${id}`), 200).body
    for (const r of view.rows) if (r.id !== 'S1-14') expectStatus(await put(r.id, { status: 'met', evidenceId: ev }), 200)
    const final = expectStatus(await as(ADMIN).post(`${P()}/qa/periods/${id}/finalise`, {}), 200).body
    assert.equal(final.status, 'final')
    const frozen = expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${id}`), 200).body
    assert.equal(frozen.frozen, true)
    assert.equal(frozen.summary.score, 100)
    assert.equal(frozen.period.approvedBy, ADMIN)
    assert.equal((await put('S1-04', { notes: 'late' })).status, 409, 'finalised periods are read-only')
    // Rejecting the evidence afterwards does not silently change the frozen result.
    await rows(`UPDATE evidence_registry SET status = 'rejected' WHERE id = $1`, [ev])
    assert.equal(expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${id}`), 200).body.summary.score, 100)

    const doc = expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${id}/export`), 200)
    assert.ok(doc.text.includes('Score 100/100') && !doc.text.includes('DRAFT') && doc.text.includes('not a regulator-issued rating'))
    const csv = expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${id}/export?format=csv`), 200)
    assert.equal(csv.text.trim().split('\n').length, 1 + view.rows.length)

    // Carry-forward suggests owners and notes, never statuses or evidence.
    const next = await newPeriod({ label: 'FY2029', periodStart: '2029-01-01', periodEnd: '2029-12-31', copyFrom: id })
    const nv = expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${next}`), 200).body
    const s102 = nv.rows.find((r: any) => r.id === 'S1-04')
    assert.equal(s102.status, 'not_started')
    assert.equal(s102.evidenceId, null)
    assert.equal(s102.owner, 'CFO')
    const list = expectStatus(await as(VIEWER).get(`${P()}/qa/periods`), 200).body
    assert.deepEqual(list.map((x: any) => x.label), ['FY2029', 'FY2028'])

    // Corrections to a finalised period create a revised version; the original stays frozen.
    assert.equal((await as(ADMIN).post(`${P()}/qa/periods/${id}/revise`, {})).status, 400, 'reason required')
    const rev = expectStatus(await as(ADMIN).post(`${P()}/qa/periods/${id}/revise`, { reason: 'Restated Scope 2 figure' }), 201).body
    assert.equal(rev.label, 'FY2028 (revision 1)')
    assert.equal(rev.revisionOf, id)
    const rv = expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${rev.id}`), 200).body
    assert.equal(rv.frozen, false)
    assert.equal(rv.rows.find((r: any) => r.id === 'S1-04').status, 'met', 'a revision starts from the finalised state')
    assert.equal(expectStatus(await as(VIEWER).get(`${P()}/qa/periods/${id}`), 200).body.frozen, true)
  })

  it('isolates periods between organisations', async () => {
    const id = await newPeriod()
    const other = await createOrg('Other Org', OUTSIDER, {})
    assert.equal((await as(OUTSIDER).get(`/workspaces/${other.wsId}/qa/periods/${id}`)).status, 404)
    assert.equal((await as(OUTSIDER).get(`${P()}/qa/periods/${id}`)).status, 404, 'other tenants cannot even see it exists')
  })
})
