// ESG & Sustainability Implementation Planner (SEC Nigeria plan), Corrective Action &
// Evidence Hub lifecycle and the CRAFT Governance Scorecard, against a real Postgres.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import {
  ADMIN, ASSESSOR, OWNER, VIEWER, as, createCap, createOrg, expectStatus, rows, truncateAll, uploadEvidence,
} from './harness.ts'

let wsId = 0
const P = () => `/workspaces/${wsId}`

describe('ESG framework catalogue', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  it('seeds every catalogue framework with source metadata, idempotently, including for older workspaces', async () => {
    const first = expectStatus(await as(VIEWER).get(`${P()}/esg-frameworks`), 200).body
    const names = first.map((f: any) => f.frameworkName).sort()
    for (const n of ['CDP', 'ESRS', 'GHG Protocol', 'GRI', 'IR', 'ISSB', 'SASB', 'SEC-NG-IFRS', 'TNFD']) assert.ok(names.includes(n), n)
    const sec = first.find((f: any) => f.frameworkName === 'SEC-NG-IFRS')
    assert.equal(sec.meta.obligation, 'mandatory')
    assert.equal(new URL(sec.meta.sourceUrl).hostname, 'www.sec.gov.ng')
    assert.equal(first.find((f: any) => f.frameworkName === 'TNFD').meta.requiresVerification, true)

    // A workspace seeded before the new frameworks existed receives them without duplicates.
    await rows(`DELETE FROM esg_requirements WHERE framework_id IN (SELECT id FROM esg_frameworks WHERE framework_name IN ('TNFD', 'SEC-NG-IFRS'))`)
    await rows(`DELETE FROM esg_frameworks WHERE framework_name IN ('TNFD', 'SEC-NG-IFRS')`)
    await rows(`DELETE FROM esg_requirements WHERE requirement_id = 'IFRS S1-STR'`)
    const again = expectStatus(await as(VIEWER).get(`${P()}/esg-frameworks`), 200).body
    assert.equal(again.length, first.length)
    const [{ n }] = await rows(`SELECT count(*)::int AS n FROM esg_requirements WHERE requirement_id = 'IFRS S1-STR'`)
    assert.equal(n, 1)
    const [{ secReqs }] = await rows(`SELECT count(*)::int AS "secReqs" FROM esg_requirements r JOIN esg_frameworks f ON f.id = r.framework_id WHERE f.framework_name = 'SEC-NG-IFRS'`)
    assert.equal(secReqs, 8)
  })
})

describe('SEC Nigeria IFRS S1/S2 implementation plan', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  const body = { organisationName: 'Acme Plc', entityType: 'public_company', readiness: 'early', horizon: '12m', startDate: '2026-10-12' }

  it('generates the eight circular elements, never overwrites edits silently, and exports Word and CSV', async () => {
    assert.equal((await as(VIEWER).post(`${P()}/esg-planner/sec-ng`, body)).status, 403, 'viewers cannot generate')
    assert.equal((await as(ASSESSOR).get(`${P()}/esg-planner/sec-ng/export`)).status, 409, 'nothing to export yet')
    assert.equal((await as(ASSESSOR).post(`${P()}/esg-planner/sec-ng`, { ...body, horizon: '5y' })).status, 400)

    const gen = expectStatus(await as(ASSESSOR).post(`${P()}/esg-planner/sec-ng`, body), 201)
    assert.equal(gen.body.created, 8)
    assert.equal(gen.body.settings.firstReportingYear, 2028, 'SEC date for public companies')
    assert.deepEqual(gen.body.rows.map((r: any) => r.requirementId), ['SEC-NG-1', 'SEC-NG-2', 'SEC-NG-3', 'SEC-NG-4', 'SEC-NG-5', 'SEC-NG-6', 'SEC-NG-7', 'SEC-NG-8'])
    for (const r of gen.body.rows) {
      assert.equal(r.milestones.length, 3)
      assert.ok(r.timelineStart >= '2026-10-12' && r.timelineEnd <= '2027-10-12', r.requirementId)
    }
    const [{ adoption }] = await rows(`SELECT adoption_status AS adoption FROM esg_frameworks WHERE framework_name = 'SEC-NG-IFRS'`)
    assert.equal(adoption, 'adopted')

    // The organisation edits an owner; a second generate leaves it alone unless regeneration is asked for.
    const planId = gen.body.rows[0].planId
    expectStatus(await as(ASSESSOR).put(`${P()}/esg-plans/${planId}`, { owner: 'Jane Doe, Company Secretary' }), 200)
    const again = expectStatus(await as(ASSESSOR).post(`${P()}/esg-planner/sec-ng`, body), 200)
    assert.equal(again.body.created, 0)
    assert.equal(again.body.updated, 0)
    assert.equal(again.body.rows[0].owner, 'Jane Doe, Company Secretary')
    const regen = expectStatus(await as(ASSESSOR).post(`${P()}/esg-planner/sec-ng`, { ...body, horizon: '24m', regenerate: true }), 200)
    assert.equal(regen.body.updated, 8)
    assert.ok(regen.body.rows[4].timelineEnd > '2027-10-12', 'regenerated onto the 24-month horizon')

    // Unknown entity types get no invented first reporting year.
    const other = expectStatus(await as(ASSESSOR).post(`${P()}/esg-planner/sec-ng`, { ...body, entityType: 'other' }), 200)
    assert.equal(other.body.settings.firstReportingYear, null)

    const doc = expectStatus(await as(VIEWER).get(`${P()}/esg-planner/sec-ng/export`), 200)
    assert.match(doc.headers.get('content-type') ?? '', /msword/)
    assert.ok(doc.text.includes('2026-10-15') && doc.text.includes('requires confirmation'))
    assert.ok(doc.text.includes('Key implementation challenges'))
    const csv = expectStatus(await as(VIEWER).get(`${P()}/esg-planner/sec-ng/export?format=csv`), 200)
    assert.match(csv.headers.get('content-type') ?? '', /text\/csv/)
    assert.equal(csv.text.trim().split('\n').length, 1 + 8 * 3)
  })
})

describe('Corrective Action & Evidence Hub', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  // Brings a CAP to a closable state: one action with approved, verified evidence.
  const readyToClose = async (capId: number) => {
    const a = expectStatus(await as(ASSESSOR).post(`${P()}/cap/${capId}/actions`, { actionDescription: 'Adopt policy' }), 201).body.id
    const ev = await uploadEvidence(wsId)
    expectStatus(await as(ASSESSOR).put(`${P()}/cap/${capId}/actions/${a}`, { evidenceId: ev }), 200)
    expectStatus(await as(OWNER).post(`${P()}/evidence/${ev}/approve`, { status: 'approved' }), 200)
    expectStatus(await as(ADMIN).put(`${P()}/cap/${capId}/actions/${a}`, { verify: true }), 200)
  }

  it('records root cause and context, requires an effectiveness review when asked, and reopens on failure', async () => {
    const capId = await createCap(wsId, ASSESSOR, { rootCause: 'No policy owner', expectedOutcome: 'Policy applied', resources: 'Legal review', dependencies: 'Board meeting', assignedTo: ASSESSOR })
    const [cap] = await rows('SELECT root_cause, expected_outcome, effectiveness_status FROM cap_records WHERE id = $1', [capId])
    assert.equal(cap.root_cause, 'No policy owner')
    assert.equal(cap.effectiveness_status, 'not_required')
    assert.equal((await as(ADMIN).post(`${P()}/cap/${capId}/reopen`, { reason: 'x' })).status, 409, 'cannot reopen an open CAP')

    await readyToClose(capId)
    const closed = expectStatus(await as(ADMIN).post(`${P()}/cap/${capId}/close`, { effectivenessRequired: true, effectivenessDue: '2027-03-31', residualRisk: 'Low' }), 200)
    assert.equal(closed.body.effectivenessStatus, 'pending')
    assert.equal(closed.body.residualRisk, 'Low')
    assert.equal((await as(ASSESSOR).post(`${P()}/cap/${capId}/effectiveness`, { result: 'effective', notes: 'x' })).status, 403, 'admins review effectiveness')
    assert.equal((await as(ADMIN).post(`${P()}/cap/${capId}/effectiveness`, { result: 'effective' })).status, 400, 'notes required')

    const failed = expectStatus(await as(ADMIN).post(`${P()}/cap/${capId}/effectiveness`, { result: 'not_effective', notes: 'Sample showed the control is not applied' }), 200)
    assert.equal(failed.body.status, 'in_progress')
    assert.equal(failed.body.effectivenessStatus, 'not_effective')
    assert.equal(failed.body.reopenedCount, 1)
    assert.equal(failed.body.effectivenessReviewedBy, ADMIN)
    assert.equal((await as(ADMIN).post(`${P()}/cap/${capId}/effectiveness`, { result: 'effective', notes: 'x' })).status, 409, 'open CAPs cannot be reviewed')

    // Second cycle: close without a review, then reopen manually with a reason.
    expectStatus(await as(ADMIN).post(`${P()}/cap/${capId}/close`, {}), 200)
    assert.equal((await as(ADMIN).post(`${P()}/cap/${capId}/reopen`, {})).status, 400, 'reason required')
    const reopened = expectStatus(await as(ADMIN).post(`${P()}/cap/${capId}/reopen`, { reason: 'Issue recurred' }), 200)
    assert.equal(reopened.body.reopenedCount, 2)
    const sum = expectStatus(await as(VIEWER).get(`${P()}/cap/summary`), 200).body
    assert.equal(sum.reopened, 1)
  })

  it('stops the accountable owner reviewing their own effectiveness', async () => {
    const capId = await createCap(wsId, ASSESSOR, { assignedTo: ADMIN })
    await readyToClose(capId)
    expectStatus(await as(OWNER).post(`${P()}/cap/${capId}/close`, { effectivenessRequired: true }), 200)
    const own = await as(ADMIN).post(`${P()}/cap/${capId}/effectiveness`, { result: 'effective', notes: 'fine' })
    assert.equal(own.status, 403)
    assert.match(own.body.error, /Segregation of duties/)
    expectStatus(await as(OWNER).post(`${P()}/cap/${capId}/effectiveness`, { result: 'effective', notes: 'Sampled and applied' }), 200)
  })

  it('raises a CAP from a governance finding with its context, without leaking sensitive text or touching scores', async () => {
    const aId = expectStatus(await as(ASSESSOR).post(`${P()}/assessments`, { assessmentType: 'G2G' }), 201).body.id
    expectStatus(await as(ASSESSOR).put(`${P()}/assessments/${aId}/scores/Pillar/Domain`, { score: 1 }), 200)
    const f = expectStatus(await as(ASSESSOR).post(`${P()}/assessments/${aId}/findings`, {
      domain: 'Domain', description: 'Board oversight undocumented', recommendation: 'Approve a board charter', ownerAssignment: 'Company Secretary', dueDate: '2027-01-31',
    }), 201).body
    const capId = expectStatus(await as(ASSESSOR).post(`${P()}/cap`, { sourceType: 'governance_finding', sourceId: f.id }), 201).body.id
    const [cap] = await rows('SELECT finding_description, corrective_action, assigned_to, due_date::text, source_type FROM cap_records WHERE id = $1', [capId])
    assert.equal(cap.finding_description, 'Board oversight undocumented')
    assert.equal(cap.corrective_action, 'Approve a board charter')
    assert.equal(cap.assigned_to, 'Company Secretary')
    assert.equal(cap.due_date, '2027-01-31')

    const secret = expectStatus(await as(ASSESSOR).post(`${P()}/assessments/${aId}/findings`, { domain: 'Domain', description: 'Named whistleblower case', severity: 'high', sensitive: true }), 201).body
    const sCap = expectStatus(await as(ASSESSOR).post(`${P()}/cap`, { sourceType: 'governance_finding', sourceId: secret.id }), 201).body
    assert.ok(!sCap.findingDescription.includes('whistleblower'))
    assert.match(sCap.findingDescription, /Sensitive governance finding/)

    await readyToClose(capId)
    expectStatus(await as(ADMIN).post(`${P()}/cap/${capId}/close`, {}), 200)
    const [score] = await rows('SELECT tier_level FROM governance_scores WHERE assessment_id = $1', [aId])
    assert.equal(score.tier_level, 1, 'closing a CAP never raises a score')
    const [finding] = await rows('SELECT status FROM governance_findings WHERE id = $1', [f.id])
    assert.equal(finding.status, 'open', 'the finding stays open until reassessed')
  })
})

describe('CRAFT Governance Scorecard', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  it('validates criteria, requires a reason for N/A, scores transparently and keeps history per version', async () => {
    const cat = expectStatus(await as(VIEWER).get(`${P()}/craft-scorecard/catalogue`), 200).body
    assert.equal(cat.pillars.length, 10)
    const id = expectStatus(await as(ASSESSOR).post(`${P()}/assessments`, { assessmentType: 'CRAFT', reportingPeriod: 'FY2026' }), 201).body.id
    const put = (pillar: string, crit: string, b: Record<string, unknown>) => as(ASSESSOR).put(`${P()}/assessments/${id}/scores/${pillar}/${crit}`, b)
    assert.equal((await put('leadership', 'ETH-1', { score: 3 })).status, 400, 'criterion from another pillar')
    assert.equal((await put('leadership', 'LDR-1', { score: 0 })).status, 400, 'CRAFT scores are 1-5')
    assert.equal((await put('financial', 'FIN-3', { notApplicable: true })).status, 400, 'N/A needs a reason')
    expectStatus(await put('financial', 'FIN-3', { notApplicable: true, naReason: 'No procurement function' }), 200)
    expectStatus(await put('leadership', 'LDR-1', { score: 5, evidenceUploaded: true }), 200)
    expectStatus(await put('leadership', 'LDR-2', { score: 5, evidenceUploaded: false }), 200)

    const sc = expectStatus(await as(VIEWER).get(`${P()}/assessments/${id}/scorecard`), 200).body
    assert.equal(sc.methodology.isProvisional, false)
    assert.equal(sc.methodology.version, 'CRAFT-GS 1.0')
    assert.deepEqual(sc.notApplicable, ['FIN-3'])
    assert.deepEqual(sc.unevidenced, ['LDR-2'])
    assert.equal(sc.complete, false)
    const leadership = sc.pillars.find((p: any) => p.id === 'leadership')
    assert.equal(leadership.score, 70, '(5 + capped 2) / 2 / 5')
    assert.equal(sc.overall, 70, 'only leadership answered so far')
    assert.ok(sc.recommendations.some((r: any) => r.criterionId === 'LDR-2'))

    // Founder-protection criteria are refused unless the assessment covers an innovation-support institution.
    assert.equal((await put('ethics', 'ETH-4', { score: 3, evidenceUploaded: true })).status, 400)
    const inno = expectStatus(await as(ASSESSOR).post(`${P()}/assessments`, { assessmentType: 'CRAFT', reportingPeriod: 'FY2026', innovationSupport: true }), 201).body.id
    expectStatus(await as(ASSESSOR).put(`${P()}/assessments/${inno}/scores/ethics/ETH-4`, { score: 2, evidenceUploaded: true }), 200)
    const isc = expectStatus(await as(VIEWER).get(`${P()}/assessments/${inno}/scorecard`), 200).body
    assert.ok(isc.missingResponses.includes('DAT-4') && isc.recommendations.some((r: any) => r.criterionId === 'ETH-4'))
    assert.ok(!sc.missingResponses.includes('ETH-4'), 'not part of an ordinary assessment')

    // Independent validation: approved assessments only, independence declared, creator excluded.
    const vpath = `${P()}/assessments/${id}/validations`
    const vbody = { validatorName: 'Ada Obi', validatorOrganisation: 'Independent Reviews Ltd', independenceDeclared: true, method: 'sample_testing', outcome: 'validated_with_qualifications', notes: 'Board charter review not evidenced', scores: { 'LDR-1': { score: 3, evidence: true, comment: 'Charter not reviewed in 3 years' } } }
    assert.equal((await as(VIEWER).post(vpath, vbody)).status, 409, 'not approved yet')
    expectStatus(await as(ASSESSOR).post(`${P()}/assessments/${id}/submit`, {}), 200)
    expectStatus(await as(ADMIN).post(`${P()}/assessments/${id}/approve`, {}), 200)
    assert.equal((await as(ASSESSOR).post(vpath, vbody)).status, 403, 'creator cannot validate')
    assert.equal((await as(VIEWER).post(vpath, { ...vbody, independenceDeclared: false })).status, 400)
    assert.equal((await as(VIEWER).post(vpath, { ...vbody, notes: '' })).status, 400, 'qualifications need notes')
    assert.equal((await as(VIEWER).post(vpath, { ...vbody, scores: { 'ETH-4': { score: 3 } } })).status, 400, 'overlay criterion not in this assessment')
    const val = expectStatus(await as(VIEWER).post(vpath, vbody), 201).body
    assert.equal(val.selfOverall, 70)
    assert.ok(val.validatedOverall < 70 && val.delta < 0)
    assert.equal((await as(VIEWER).post(vpath, vbody)).status, 409, 'one validation per validator')
    const vsc = expectStatus(await as(VIEWER).get(`${P()}/assessments/${id}/scorecard`), 200).body
    assert.equal(vsc.validations.length, 1)
    assert.equal(vsc.validations[0].outcome, 'validated_with_qualifications')
    assert.equal(vsc.overall, 70, 'the self-assessed score is unchanged by validation')

    const hist = expectStatus(await as(VIEWER).get(`${P()}/craft-scorecard/history`), 200).body
    assert.equal(hist.length, 2)
    assert.equal(hist[1].innovationSupport, true)
    assert.equal(hist[0].validation.outcome, 'validated_with_qualifications')
    assert.equal(hist[0].reportingPeriod, 'FY2026')
    assert.equal(hist[0].overall, 70)
  })
})
