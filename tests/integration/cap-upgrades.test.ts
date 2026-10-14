// CAP upgrades: correction vs preventive action, duplicate merging with provenance, escalation.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { ADMIN, ASSESSOR, VIEWER, as, createOrg, expectStatus, rows, truncateAll } from './harness.ts'

let wsId = 0
const P = () => `/workspaces/${wsId}`
const newCap = (body: object) => as(ASSESSOR).post(`${P()}/cap`, { sourceType: 'manual', ...body })

describe('CAP upgrades', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  it('records correction and preventive action, merges duplicates with provenance, and escalates', async () => {
    const a = expectStatus(await newCap({ findingDescription: 'Board minutes are not signed or filed on time', severity: 'medium', immediateCorrection: 'Sign and file the last three sets', preventiveAction: 'Company secretary checklist' }), 201).body
    assert.equal(a.immediateCorrection, 'Sign and file the last three sets')
    assert.equal(a.preventiveAction, 'Company secretary checklist')
    const b = expectStatus(await newCap({ findingDescription: 'Board minutes not signed and not filed on time', severity: 'high' }), 201).body
    expectStatus(await newCap({ findingDescription: 'Cyber risk register missing' }), 201)

    // Evidence linked to the duplicate moves to the survivor.
    const up = await as(ASSESSOR).upload(`${P()}/evidence/upload`, new File([Buffer.from('%PDF-1.4\n')], 'minutes.pdf', { type: 'application/pdf' }))
    expectStatus(await as(ASSESSOR).put(`${P()}/evidence/${up.body.id}`, { link: { targetType: 'cap', targetId: b.id, linkType: 'supports' } }), 200)

    const dups = expectStatus(await as(VIEWER).get(`${P()}/cap/duplicates`), 200).body
    assert.deepEqual(dups.map((g: any) => g.ids), [[a.id, b.id]])
    assert.equal((await as(ASSESSOR).post(`${P()}/cap/${a.id}/merge`, { duplicateIds: [b.id] })).status, 403, 'merging needs admin')
    assert.equal((await as(ADMIN).post(`${P()}/cap/${a.id}/merge`, { duplicateIds: [a.id] })).status, 400)
    const merged = expectStatus(await as(ADMIN).post(`${P()}/cap/${a.id}/merge`, { duplicateIds: [b.id] }), 200).body
    assert.equal(merged.severity, 'high', 'takes the highest severity')
    assert.equal(merged.mergedFrom[0].capId, b.id)
    assert.equal(merged.mergedFrom[0].mergedBy, ADMIN)
    const old = expectStatus(await as(VIEWER).get(`${P()}/cap/${b.id}`), 200).body
    assert.equal(old.status, 'merged')
    assert.equal(old.mergedInto, a.id)
    assert.equal((await as(ASSESSOR).put(`${P()}/cap/${b.id}`, { severity: 'low' })).status, 409)
    assert.equal((await as(ADMIN).post(`${P()}/cap/${a.id}/merge`, { duplicateIds: [b.id] })).status, 409, 'cannot merge twice')
    const links = expectStatus(await as(VIEWER).get(`${P()}/cap/${a.id}`), 200).body.evidenceLinks
    assert.equal(links.length, 1)
    const sum = expectStatus(await as(VIEWER).get(`${P()}/cap/summary`), 200).body
    assert.equal(sum.merged, 1)
    assert.equal(sum.total, 2, 'merged duplicates are not double-counted')
    assert.deepEqual(expectStatus(await as(VIEWER).get(`${P()}/cap/duplicates`), 200).body, [])

    // Manual escalation, then the automatic rule raises an overdue critical CAP.
    assert.equal((await as(ASSESSOR).post(`${P()}/cap/${a.id}/escalate`, {})).status, 400, 'reason required')
    const e = expectStatus(await as(ASSESSOR).post(`${P()}/cap/${a.id}/escalate`, { reason: 'Board meeting next week' }), 200).body
    assert.equal(e.escalationLevel, 1)
    assert.equal(e.escalatedTo, 'Workspace admins')
    const crit = expectStatus(await newCap({ findingDescription: 'Unreconciled donor account', severity: 'critical', dueDate: '2026-01-01' }), 201).body
    assert.equal((await as(ASSESSOR).post(`${P()}/cap/escalations/run`, {})).status, 403)
    assert.ok(expectStatus(await as(ADMIN).post(`${P()}/cap/escalations/run`, {}), 200).body.escalated >= 1)
    const [row] = await rows('SELECT escalation_level, escalation_reason FROM cap_records WHERE id = $1', [crit.id])
    assert.equal(row.escalation_level, 3)
    assert.match(row.escalation_reason, /critical CAP \d+ day\(s\) overdue/)
  })

  it('the daily job escalates overdue CAPs across workspaces and never lowers a level', async () => {
    const run = async () => (await import(new URL('../../netlify/functions/cap-escalations.mts', import.meta.url).href)).default()
    const high = expectStatus(await newCap({ findingDescription: 'Audit findings unresolved', severity: 'high', dueDate: '2026-01-01' }), 201).body
    const fresh = expectStatus(await newCap({ findingDescription: 'Policy review', severity: 'low', dueDate: '2099-01-01' }), 201).body
    await run()
    const [h] = await rows('SELECT escalation_level FROM cap_records WHERE id = $1', [high.id])
    const [f] = await rows('SELECT escalation_level FROM cap_records WHERE id = $1', [fresh.id])
    assert.equal(h.escalation_level, 3)
    assert.equal(f.escalation_level, 0)
    const audit = await rows("SELECT actor_id FROM ws_audit_log WHERE resource_type = 'cap' AND resource_id = $1", [String(high.id)])
    assert.ok(audit.some((x: any) => x.actor_id === 'system'))
    await run()
    const [again] = await rows('SELECT escalation_level FROM cap_records WHERE id = $1', [high.id])
    assert.equal(again.escalation_level, 3)
  })
})
