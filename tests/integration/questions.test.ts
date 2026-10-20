import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { blobStores, rows, truncateAll } from './harness.ts'

const questions = (await import(new URL('../../netlify/functions/questions.mts', import.meta.url).href)).default
const seed = (await import(new URL('../../netlify/functions/seed-db.mts', import.meta.url).href)).default
const ADMIN = 'fabbiochucho@gmail.com' // platform admin allowlist

async function call(handler: (r: Request) => Promise<Response>, email: string | null, method = 'GET') {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res = await handler(new Request('http://localhost/api/questions', { method }))
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

describe('question bank (private text)', () => {
  beforeEach(truncateAll)

  it('serves the full bank only to signed-in users', async () => {
    assert.equal((await call(questions, null)).status, 401)
    const res = await call(questions, 'member@org.example')
    assert.equal(res.status, 200)
    assert.equal(res.body.length, 519)
    assert.ok(res.body.every((q: any) => q.question), 'every question has its text')
    assert.equal(res.body.find((q: any) => q.id === 'GOV-02').archetypes, undefined, 'universal questions carry no archetype list')
  })

  it('never fills the database from the public index when the private bank is missing', async () => {
    blobStores().delete('questions-private')
    const res = await call(questions, 'member@org.example')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, [])
    assert.equal((await rows('SELECT count(*)::int AS n FROM questions'))[0].n, 0)
    assert.equal((await call(seed, ADMIN, 'POST')).status, 503, 'the admin re-sync refuses rather than blanking the text')
  })

  it('re-syncs from the private bank for the super admin only', async () => {
    assert.equal((await call(seed, 'member@org.example', 'POST')).status, 403)
    const res = await call(seed, ADMIN, 'POST')
    assert.equal(res.status, 200)
    assert.equal(res.body.questions, 519)
  })
})
