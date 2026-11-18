// Progress messages: each newly finished step tells the organisation what is left; finishing everything sends one
// congratulation, copied to its independent assessor. An assessor's score never counts as the organisation's answer.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'
import { checkProgress, progressMessage, stepsFor } from '../../netlify/lib/progress.ts'

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const responsesApi = await load('responses')
const progressApi = await load('progress')
const ORG = 'self_owner_x_example'
const OWNER = 'owner@x.example'
const ASSESSOR = 'assessor@y.example'

async function call(handler: any, email: string, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = { email }
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  return { status: res.status, body: await res.json().catch(() => null) }
}
const inbox = async () => (await rows(`SELECT recipient, subject FROM inbox_messages ORDER BY id`)) as { recipient: string; subject: string }[]
const onc = (n: number) => `CRAFT-ONC-${String(n).padStart(2, '0')}`

describe('progress messages', () => {
  beforeEach(async () => {
    delete process.env.RESEND_API_KEY
    await truncateAll()
    await rows(`INSERT INTO organizations(id, name, email, created_by) VALUES($1, 'Owner Org', $2, $2)`, [ORG, OWNER])
    await rows(`INSERT INTO access_grants(id, org_id, grantee, role, status, level) VALUES('g1', $1, $2, 'independent_assessor', 'active', 'read')`, [ORG, ASSESSOR])
  })

  it('tells the organisation each step it finishes, and congratulates it once at the end', async () => {
    await checkProgress(ORG)
    let msgs = await inbox()
    assert.equal(msgs.length, 1)
    assert.match(msgs[0].subject, /Set up your workspace done\. 5 steps left/)

    // The assessor scoring an indicator the organisation has not answered is not the organisation's answer.
    assert.equal((await call(responsesApi, ASSESSOR, 'POST', 'responses', { orgId: ORG, questionId: onc(1), assessorScore: 2 })).status, 200)
    assert.equal((await call(responsesApi, OWNER, 'GET', `responses?orgId=${ORG}`)).body.scores[onc(1)], undefined, 'no own answer yet')
    for (let i = 1; i <= 44; i++) await call(responsesApi, OWNER, 'POST', 'responses', { orgId: ORG, questionId: onc(i), score: 1 })
    msgs = await inbox()
    assert.equal(msgs.length, 2, 'one message for the CRAFT-ONC step, not one per answer')
    assert.match(msgs[1].subject, /Answer your own CRAFT-ONC done\. 4 steps left/)

    assert.equal((await call(progressApi, ASSESSOR, 'POST', 'progress', { orgId: ORG, wizardDone: true })).status, 403, 'only the organisation says its wizard is done')
    assert.equal((await call(progressApi, OWNER, 'POST', 'progress', { orgId: ORG, wizardDone: true })).status, 200)
    await rows(`INSERT INTO cca_assessments(id, org_id, module, year, status, created_by) VALUES('c1', $1, 'community', 2026, 'complete', $2)`, [ORG, OWNER])
    await rows(`INSERT INTO finance_roles(org_id, role, email, assigned_by) VALUES($1,'org_finance_officer','f@x.example',$2), ($1,'org_grant_manager','g@x.example',$2)`, [ORG, OWNER])
    await rows(`INSERT INTO financial_triangulations(id, org_id, context_key, donor_id, grant_id, report_type_id, stream_id, period_id, status) VALUES('t1', $1, 'k', 'd', 'g', 'r', 's', 'p', 'pending_review')`, [ORG])
    await checkProgress(ORG)
    msgs = await inbox()
    const last = msgs.filter((m) => /Congratulations/.test(m.subject))
    assert.deepEqual(last.map((m) => m.recipient).sort(), [ASSESSOR, OWNER], 'congratulation to the organisation and its assessor')
    await checkProgress(ORG)
    assert.equal((await inbox()).length, msgs.length, 'nothing new, nothing sent')
    assert.ok((await stepsFor(ORG)).every((s) => s.done))
  })

  it('writes a next step and a congratulation', () => {
    const s = (id: string, done: boolean) => ({ id, title: id, how: `how ${id}`, applies: true, done })
    const mid = progressMessage('Org', [s('a', true), s('b', false)], [s('a', true)])
    assert.equal(mid.complete, false)
    assert.match(mid.text, /Next: b \(how b\)/)
    assert.equal(progressMessage('Org', [s('a', true)], [s('a', true)]).complete, true)
  })
})
