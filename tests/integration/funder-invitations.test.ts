// Funder invitations: staff of one funder (e.g. GIZ) each get their own invitation and join ONE shared
// funding-partner account. Nobody can add themselves to an existing funder by naming it. Joining shares
// no organisation's data (that needs the organisation's consent through a funder review).
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const invitations = (await import(new URL('../../netlify/functions/invitations.mts', import.meta.url).href)).default
const ASSESSOR = 'martin@consult.example'
const STRANGER = 'someone@else.example'
const A = 'a@giz.example', B = 'b@giz.example'
let ip = 0

async function call(email: string | null, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await invitations(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': `203.0.113.${(ip = (ip % 250) + 1)}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}
const inviteFunder = (by: string, email: string, funderName = 'GIZ') => call(by, 'POST', 'invitations', { kind: 'funder', email, funderName, send: false })
const send = (_by: string, id: string) => rows(`UPDATE invitations SET sent_at = now(), expires_at = now() + interval '14 days' WHERE id = $1`, [id])

describe('funder invitations', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO users(id,email,role) VALUES('u1','${ASSESSOR}','independent'),('u2','${STRANGER}','assessor')`)
  })

  it('each person gets their own invitation into one shared account; accepting joins it; strangers cannot hijack it', async () => {
    const ia = await inviteFunder(ASSESSOR, A)
    assert.equal(ia.status, 201, ia.text)
    const ib = await inviteFunder(ASSESSOR, B, '  giz ')
    assert.equal(ib.status, 201, ib.text)
    const firmsRows = await rows(`SELECT id, kind FROM firms`)
    assert.equal(firmsRows.length, 1, 'one shared account, matched case-insensitively')
    assert.equal(firmsRows[0].kind, 'funding_partner')
    assert.equal(ia.body.firmId, ib.body.firmId)
    assert.equal((await inviteFunder(STRANGER, STRANGER)).status, 403, 'cannot add yourself to an existing funder by naming it')

    for (const [who, inv] of [[A, ia], [B, ib]] as const) {
      await send(ASSESSOR, inv.body.id)
      const accepted = await call(who, 'POST', 'invitations/accept', { token: inv.body.token })
      assert.equal(accepted.status, 200, accepted.text)
      assert.equal(accepted.body.next, '/engagements')
    }
    const seats = await rows(`SELECT email, role, status FROM firm_members ORDER BY email`)
    assert.deepEqual(seats.map((s: any) => [s.email, s.role, s.status]), [[A, 'owner', 'active'], [B, 'consultant', 'active']])
    assert.equal((await rows(`SELECT 1 FROM access_grants`)).length, 0, 'joining shares no organisation data')
    assert.equal((await inviteFunder(ASSESSOR, 'c@giz.example')).status, 403, 'once staff have joined, only its owners invite colleagues')
    assert.equal((await inviteFunder(A, 'c@giz.example')).status, 201, 'an owner can invite colleagues')
  })

  it('the email says funding partner and explains consent', async () => {
    const inv = await inviteFunder(ASSESSOR, A)
    const p = await call(ASSESSOR, 'GET', `invitations?preview=${inv.body.id}`)
    assert.equal(p.status, 200, p.text)
    assert.match(p.body.subject, /join GIZ on CRAFT as a funding partner/)
    assert.match(p.body.html, /without its consent/)
  })
})
