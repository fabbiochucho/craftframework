// Field-level encryption through the real API: ciphertext at rest (raw rows),
// plaintext on read, and member lookup by HMAC hash.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { createHmac } from 'node:crypto'
import {
  ADMIN, ASSESSOR, OWNER, VIEWER, as, createAssessment, createOrg, expectStatus, rows, truncateAll,
} from './harness.ts'

const isCipher = (v: unknown) => typeof v === 'string' && /^enc:v\d+:/.test(v)
let orgId = 0, wsId = 0

describe('field encryption at rest', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ orgId, wsId } = await createOrg())
  })

  it('stores organisation contacts and member ids as ciphertext and decrypts on read', async () => {
    const [raw] = await rows('SELECT contact_email, contact_phone FROM ws_organizations WHERE id = $1', [orgId])
    assert.ok(isCipher(raw.contact_email), 'contact_email is ciphertext')
    assert.ok(!raw.contact_email.includes(OWNER))
    await as(OWNER).put(`/orgs/${orgId}`, { contactPhone: '+254700000000' })
    assert.ok(isCipher((await rows('SELECT contact_phone FROM ws_organizations'))[0].contact_phone))
    const [org] = expectStatus(await as(OWNER).get('/orgs'), 200).body
    assert.equal(org.contactEmail, OWNER)
    assert.equal(org.contactPhone, '+254700000000')

    const members = await rows('SELECT user_id, user_id_hash FROM ws_org_members ORDER BY id')
    assert.equal(members.length, 4)
    for (const m of members) {
      assert.ok(isCipher(m.user_id), 'user_id is ciphertext')
      assert.match(m.user_id_hash, /^[0-9a-f]{64}$/)
    }
    const listed = expectStatus(await as(OWNER).get(`/orgs/${orgId}/members`), 200).body
    assert.deepEqual(listed.map((m: any) => m.userId).sort(), [ADMIN, ASSESSOR, OWNER, VIEWER].sort())
    assert.ok(listed.every((m: any) => !('userIdHash' in m)), 'hash is never exposed')
  })

  it('looks members up by keyed hash (not plaintext) and still honours legacy plaintext rows', async () => {
    const key = Buffer.from(process.env.FIELD_ENCRYPTION_KEY!, 'base64')
    const expected = createHmac('sha256', key).update(ADMIN).digest('hex')
    assert.equal((await rows('SELECT user_id_hash FROM ws_org_members ORDER BY id'))[1].user_id_hash, expected)
    // The hash is computed over the trimmed, lower-cased address.
    assert.equal((await as(' Admin@Acme.Example ').get(`/orgs/${orgId}/members`)).status, 200)
    assert.equal((await as('someone.else@acme.example').get(`/orgs/${orgId}/members`)).status, 404)
    assert.equal((await as(ADMIN).get(`/orgs/${orgId}/members`)).status, 200)
    // A pre-encryption row (plaintext id, no hash) keeps working.
    await rows("INSERT INTO ws_org_members (user_id, org_id, role) VALUES ($1, $2, 'viewer')", ['legacy@acme.example', orgId])
    expectStatus(await as('legacy@acme.example').get(`/orgs/${orgId}/members`), 200)
    const names = (await as('legacy@acme.example').get('/orgs')).body.map((o: any) => o.name)
    assert.deepEqual(names, ['Acme Org'])
    // Re-adding the same member updates their role instead of duplicating the row.
    expectStatus(await as(OWNER).post(`/orgs/${orgId}/members`, { email: 'LEGACY@acme.example', role: 'assessor' }), 200)
    assert.equal((await rows("SELECT count(*)::int AS n FROM ws_org_members WHERE role = 'assessor'"))[0].n, 2)
  })

  it('encrypts sensitive findings, reviewer notes, link notes, schedule recipients and support contacts', async () => {
    const id = await createAssessment(wsId)
    const score = expectStatus(await as(ASSESSOR).put(`/workspaces/${wsId}/assessments/${id}/scores/Pillar/Domain`, {
      score: 1, reviewerNotes: 'Interview with whistleblower',
    }), 200)
    assert.equal(score.body.reviewerNotes, 'Interview with whistleblower')
    const secret = 'Staff member named in fraud allegation'
    const sensitive = expectStatus(await as(ASSESSOR).post(`/workspaces/${wsId}/assessments/${id}/findings`, {
      domain: 'Domain', severity: 'high', description: secret, sensitive: true,
    }), 201)
    const plain = expectStatus(await as(ASSESSOR).post(`/workspaces/${wsId}/assessments/${id}/findings`, {
      domain: 'Domain', severity: 'low', description: 'Policy is outdated',
    }), 201)
    assert.equal(sensitive.body.description, secret)
    const raw = await rows('SELECT id, description, sensitive FROM governance_findings ORDER BY id')
    assert.ok(isCipher(raw[0].description) && raw[0].sensitive === true)
    assert.ok(!raw[0].description.includes('fraud'))
    assert.equal(raw[1].description, 'Policy is outdated')
    assert.ok(isCipher((await rows('SELECT reviewer_notes FROM governance_scores'))[0].reviewer_notes))
    const read = expectStatus(await as(VIEWER).get(`/workspaces/${wsId}/assessments/${id}`), 200).body
    assert.equal(read.findings.find((f: any) => f.id === sensitive.body.id).description, secret)
    assert.equal(read.findings.find((f: any) => f.id === plain.body.id).description, 'Policy is outdated')
    assert.equal(read.scores[0].reviewerNotes, 'Interview with whistleblower')
    // Flipping a finding to sensitive encrypts it in place.
    expectStatus(await as(ASSESSOR).put(`/workspaces/${wsId}/assessments/${id}/findings/${plain.body.id}`, { sensitive: true }), 200)
    assert.ok(isCipher((await rows('SELECT description FROM governance_findings WHERE id = $1', [plain.body.id]))[0].description))

    expectStatus(await as(ADMIN).post(`/workspaces/${wsId}/reports/schedules`, {
      reportType: 'cap_summary', cadence: 'weekly', recipients: ['board@acme.example'],
    }), 201)
    const [sched] = await rows('SELECT recipients FROM report_schedules')
    assert.ok(isCipher(sched.recipients[0]))
    assert.deepEqual((await as(ADMIN).get(`/workspaces/${wsId}/reports/schedules`)).body[0].recipients, ['board@acme.example'])

    const issue = expectStatus(await as(null).post('/support-bot/submit-issue', { description: 'Help', contactEmail: 'reporter@public.example' }), 201)
    assert.equal(issue.body.contactEmail, 'reporter@public.example')
    assert.ok(isCipher((await rows('SELECT contact_email FROM support_issues'))[0].contact_email))
  })

  it('fails closed instead of returning ciphertext when a stored value is tampered with', async () => {
    const id = await createAssessment(wsId)
    expectStatus(await as(ASSESSOR).post(`/workspaces/${wsId}/assessments/${id}/findings`, {
      domain: 'Domain', severity: 'high', description: 'secret finding', sensitive: true,
    }), 201)
    const [{ description }] = await rows('SELECT description FROM governance_findings')
    const parts = description.split(':')
    parts[4] = Buffer.from('tampered-bytes').toString('base64')
    await rows('UPDATE governance_findings SET description = $1', [parts.join(':')])
    const res = await as(VIEWER).get(`/workspaces/${wsId}/assessments/${id}`)
    assert.equal(res.status, 500)
    assert.ok(!res.text.includes('tampered') && !res.text.includes('enc:'))
  })
})
