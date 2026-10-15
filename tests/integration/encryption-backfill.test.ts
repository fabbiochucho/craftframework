// Encrypted-field backfill: plaintext rows (written without a key) become encrypted, stay readable, and reruns are no-ops.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { OWNER, as, createOrg, expectStatus, rows, truncateAll } from './harness.ts'
import { runEncryptionBackfill } from '../../netlify/lib/encryption-backfill.ts'
import { mfaUserKey } from '../../netlify/lib/mfa.ts'

let orgId = 0
describe('encryption backfill', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ orgId } = await createOrg())
  })

  it('encrypts plaintext fields across tables and is idempotent', async () => {
    await rows('UPDATE ws_organizations SET contact_email = $1, contact_phone = $2 WHERE id = $3', ['ops@acme.example', '+2348000000000', orgId])
    await rows('INSERT INTO user_mfa (user_key, secret, enabled) VALUES ($1, $2, true)', [mfaUserKey('x@acme.example'), 'JBSWY3DPEHPK3PXP'])
    await rows('INSERT INTO legacy_workspace_state (org_id, key, value) VALUES ($1, $2, $3)', ['self_x', 'k', '{"a":1}'])

    const counts = await runEncryptionBackfill()
    assert.ok(counts.ws_organizations >= 1 && counts.user_mfa === 1 && counts.legacy_workspace_state === 1, JSON.stringify(counts))
    const [org] = await rows('SELECT contact_email, contact_phone FROM ws_organizations WHERE id = $1', [orgId])
    assert.ok(!org.contact_email.includes('ops@acme') && !org.contact_phone.includes('234'), 'stored encrypted')
    const [mfa] = await rows('SELECT secret FROM user_mfa')
    assert.ok(!mfa.secret.includes('JBSWY3'))

    // Still readable through the API.
    const orgs = expectStatus(await as(OWNER).get('/orgs'), 200).body
    assert.equal(orgs.find((o: any) => o.id === orgId).contactEmail, 'ops@acme.example')

    const again = await runEncryptionBackfill()
    assert.deepEqual(again, {}, 'second run changes nothing')
  })
})
