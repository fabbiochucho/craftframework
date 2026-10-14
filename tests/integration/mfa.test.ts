// Multi-factor sign-in through the real API, against Postgres.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { ADMIN, ASSESSOR, OWNER, as, createOrg, expectStatus, truncateAll } from './harness.ts'
import { totp } from '../../netlify/lib/mfa.ts'

let orgId = 0, wsId = 0
const step = () => Math.floor(Date.now() / 30_000)
const cookieOf = (res: any) => (res.headers.get('set-cookie') ?? '').split(';')[0]
const withCookie = (cookie: string) => ({ headers: { cookie } })

async function enroll(user: string) {
  const e = expectStatus(await as(user).post('/mfa/enroll', {}), 200).body
  assert.match(e.otpauthUri, /^otpauth:\/\/totp\/CRAFT/)
  assert.equal((await as(user).post('/mfa/enroll/confirm', { code: '000000' })).status, 401)
  const used = step()
  const res = await as(user).post('/mfa/enroll/confirm', { code: totp(e.secret, used) })
  assert.equal(res.status, 200, res.text)
  assert.equal(res.body.recoveryCodes.length, 10)
  assert.match(res.headers.get('set-cookie') ?? '', /craft_mfa=.*HttpOnly; Secure; SameSite=Lax/)
  return { secret: e.secret, used, cookie: cookieOf(res), recoveryCodes: res.body.recoveryCodes as string[] }
}

describe('multi-factor sign-in', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ orgId, wsId } = await createOrg())
  })

  it('requires a second factor once enrolled, refuses replays and accepts recovery codes once', async () => {
    assert.equal(expectStatus(await as(OWNER).get('/mfa/status'), 200).body.enabled, false)
    const { secret, used, cookie, recoveryCodes } = await enroll(OWNER)

    // Without the MFA session cookie, every API call is refused; with it, allowed.
    const blocked = await as(OWNER).get(`/workspaces/${wsId}/assessments`)
    assert.equal(blocked.status, 401)
    assert.equal(blocked.body.error, 'mfa_required')
    expectStatus(await as(OWNER).get(`/workspaces/${wsId}/assessments`, withCookie(cookie)), 200)
    assert.equal((await as(OWNER).get(`/workspaces/${wsId}/assessments`, withCookie(`${cookie}x`))).status, 401, 'tampered cookie')
    assert.equal((await as(ADMIN).get(`/workspaces/${wsId}/assessments`, withCookie(cookie))).status, 200, 'another user without MFA is unaffected')

    // The confirm code's step is used: the same code is refused (replay), the next one works.
    assert.equal((await as(OWNER).post('/mfa/verify', { code: totp(secret, used) })).status, 401)
    const v = await as(OWNER).post('/mfa/verify', { code: totp(secret, used + 1) })
    assert.equal(v.status, 200, v.text)

    const r = await as(OWNER).post('/mfa/verify', { recoveryCode: recoveryCodes[0].toUpperCase() })
    assert.equal(r.body.method, 'recovery')
    assert.equal((await as(OWNER).post('/mfa/verify', { recoveryCode: recoveryCodes[0] })).status, 401, 'recovery codes are single use')
    assert.equal(expectStatus(await as(OWNER).get('/mfa/status', withCookie(cookieOf(r))), 200).body.recoveryCodesLeft, 9)
  })

  it('lets admins require MFA for their organisation', async () => {
    assert.equal((await as(OWNER).put(`/orgs/${orgId}/security`, { requireMfa: true })).status, 409, 'admin must enrol first')
    const { cookie, secret } = await enroll(OWNER)
    expectStatus(await as(OWNER).put(`/orgs/${orgId}/security`, { requireMfa: true }, withCookie(cookie)), 200)

    const member = await as(ASSESSOR).get(`/workspaces/${wsId}/assessments`)
    assert.equal(member.status, 403)
    assert.equal(member.body.error, 'mfa_enrollment_required')
    const st = expectStatus(await as(ASSESSOR).get('/mfa/status'), 200).body
    assert.deepEqual(st.requiredBy.map((o: any) => o.id), [orgId])
    const m = await enroll(ASSESSOR)
    expectStatus(await as(ASSESSOR).get(`/workspaces/${wsId}/assessments`, withCookie(m.cookie)), 200)

    // Cannot switch MFA off while an organisation requires it.
    const off = await as(OWNER).post('/mfa/disable', { code: totp(secret, step() + 1) })
    assert.equal(off.status, 409)
    assert.match(off.body.error, /requires multi-factor sign-in/)
  })
})
