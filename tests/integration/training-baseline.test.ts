import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { getStore } from '@netlify/blobs'
import { rows, truncateAll } from './harness.ts'

const api = (await import(new URL('../../netlify/functions/training-baseline.mts', import.meta.url).href)).default

// A synthetic bank: the real one is private (craft-internal/training) and lives in the training-private blob store
const q = (id: string, correct: number) => ({ id, prompt: `Question ${id}`, options: ['a', 'b', 'c', 'd'], correct, explanation: `Why ${id}` })
const BANK = {
  m1: { pre: [q('p1', 1), q('p2', 1), q('p3', 1)], postExtra: [q('x1', 1), q('x2', 1)] },
  m2: { pre: [q('p1', 3), q('p2', 2), q('p3', 1)], postExtra: [q('x1', 1), q('x2', 1)] },
}

const LEARNER = 'lena@validators.example'
const OTHER = 'omar@validators.example'
const TEAM = 'pat@craft.example' // programme team

async function call(email: string | null, method: string, path = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await api(new Request(`http://localhost/api/training-baseline${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}

describe('training baseline: pre- and post-tests for the explainer videos', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO training_staff(email, role, added_by) VALUES($1,'programme_team','test')`, [TEAM])
    await getStore('training-private').setJSON('baseline-bank', BANK)
  })

  it('says so when the private bank has not been uploaded', async () => {
    await getStore('training-private').delete('baseline-bank')
    assert.equal((await call(LEARNER, 'GET')).status, 503)
  })

  it('needs a signed-in user', async () => {
    assert.equal((await call(null, 'GET')).status, 401)
  })

  it('serves questions without answers, scores on the server and records the attempt', async () => {
    const q = await call(LEARNER, 'GET', '/questions/m2/pre')
    assert.equal(q.status, 200, q.text)
    assert.equal(q.body.questions.length, 3)
    assert.ok(q.body.questions.every((x: any) => x.correct === undefined))

    const res = await call(LEARNER, 'POST', '', { moduleId: 'm2', kind: 'pre', answers: [3, 2, 0] })
    assert.equal(res.status, 200, res.text)
    assert.equal(res.body.score, 2)
    assert.equal(res.body.results[2].ok, false)
    assert.ok(res.body.results[2].explanation.length > 0, 'explanations come back after answering')

    const saved = await rows('SELECT email, module_id, kind, score, total FROM training_baseline_attempts')
    assert.deepEqual(saved, [{ email: LEARNER, module_id: 'm2', kind: 'pre', score: 2, total: 3 }])
  })

  it('allows one pre-test even when two arrive at once', async () => {
    const both = await Promise.all([0, 1].map(() => call(LEARNER, 'POST', '', { moduleId: 'm1', kind: 'pre', answers: [1, 1, 1] })))
    assert.deepEqual(both.map((r) => r.status).sort(), [200, 409])
    assert.equal((await rows(`SELECT count(*)::int AS n FROM training_baseline_attempts WHERE kind = 'pre'`))[0].n, 1)
  })

  it('takes the pre-test once; the post-test may be retaken and the latest counts', async () => {
    assert.equal((await call(LEARNER, 'POST', '', { moduleId: 'm2', kind: 'pre', answers: [0, 0, 0] })).status, 200)
    assert.equal((await call(LEARNER, 'POST', '', { moduleId: 'm2', kind: 'pre', answers: [3, 2, 1] })).status, 409)
    await call(LEARNER, 'POST', '', { moduleId: 'm2', kind: 'post', answers: [0, 0, 0, 0, 0] })
    await call(LEARNER, 'POST', '', { moduleId: 'm2', kind: 'post', answers: [3, 2, 1, 1, 1] })
    const me = await call(LEARNER, 'GET')
    assert.equal(me.status, 200)
    assert.equal(me.body.modules.m2.pre.score, 0)
    assert.equal(me.body.modules.m2.post.score, 5)
    assert.equal((await call(OTHER, 'GET')).body.modules.m2.pre, undefined, 'learners see only their own results')
  })

  it('rejects answers that do not fit the questions', async () => {
    for (const body of [{ moduleId: 'm2', kind: 'pre', answers: [1, 1] }, { moduleId: 'm2', kind: 'pre', answers: [1, 1, 7] },
      { moduleId: 'zz', kind: 'pre', answers: [0, 0, 0] }, { moduleId: 'toString', kind: 'pre', answers: [0, 0, 0] }, { moduleId: 'm2', kind: 'mid', answers: [0, 0, 0] }]) {
      assert.equal((await call(LEARNER, 'POST', '', body)).status, 400, JSON.stringify(body))
    }
    assert.equal((await rows('SELECT count(*)::int AS n FROM training_baseline_attempts'))[0].n, 0)
  })

  it('shows per-module averages to the programme team only, without names', async () => {
    await call(LEARNER, 'POST', '', { moduleId: 'm1', kind: 'pre', answers: [0, 0, 0] })
    await call(LEARNER, 'POST', '', { moduleId: 'm1', kind: 'post', answers: [1, 1, 1, 1, 1] })
    assert.equal((await call(LEARNER, 'GET', '/summary')).status, 403)
    const s = await call(TEAM, 'GET', '/summary')
    assert.equal(s.status, 200, s.text)
    const m1 = s.body.modules.find((x: any) => x.moduleId === 'm1')
    assert.deepEqual(m1.pre, { n: 1, meanPct: 0 })
    assert.equal(m1.paired.n, 1)
    assert.ok(!s.text.includes(LEARNER), 'the summary never lists learners')
  })
})
