import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { blobStores, rows, truncateAll } from './harness.ts'

const handler = (await import(new URL('../../netlify/functions/benchmarks.mts', import.meta.url).href)).default
const { refreshBenchmarks } = await import(new URL('../../netlify/lib/benchmarks.ts', import.meta.url).href)

const st = (id: string) => [{ id, text: `Statement ${id}` }]
const dom = (id: string) => ({ id, name: id, level1: 'Nothing yet.', critical: false, levels: { 2: st(`${id}.2`), 3: st(`${id}.3`), 4: st(`${id}.4`) } })
const MODULES = [{ id: 'community', name: 'Community', audience: 'CSOs', areas: [{ id: 'gov', name: 'Governance', domains: [dom('g1'), dom('g2'), dom('g3')] }] }]

async function call(email: string | null, method: string, path = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email, name: email } : null
  const res: Response = await handler(new Request(`http://localhost/api/benchmarks${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  return { status: res.status, body: await res.json(), cache: res.headers.get('cache-control') }
}

describe('public benchmarks', () => {
  beforeEach(async () => {
    await truncateAll()
    blobStores().set('cca-private', new Map([['modules', { bytes: Buffer.from(JSON.stringify(MODULES)) }]]))
    // Seven organisations with a completed assessment; org 7 never opted in.
    for (let i = 1; i <= 7; i++) {
      await rows(`INSERT INTO organizations(id,name,country,sector) VALUES('org${i}','Org ${i}','KE','Health')`)
      await rows(`INSERT INTO users(id,email,org_id,role) VALUES('u${i}','admin${i}@org.example','org${i}','admin')`)
      const met = i % 2 ? { 'g1.2': { met: true, evidence: 'Seen' }, 'g2.2': { met: true, evidence: 'Seen' } } : {}
      await rows(`INSERT INTO cca_assessments(id,org_id,module,year,status,responses,created_by,completed_at) VALUES($1,$2,'community',2026,'complete',$3,'x',now())`, [`cca${i}`, `org${i}`, JSON.stringify(met)])
    }
  })

  it('lets only the organisation itself opt in, and publishes nothing for groups under five', async () => {
    assert.equal((await call('admin2@org.example', 'PUT', '/consent', { orgId: 'org1', optIn: true })).status, 403, 'another organisation cannot opt it in')
    for (let i = 1; i <= 4; i++) assert.equal((await call(`admin${i}@org.example`, 'PUT', '/consent', { orgId: `org${i}`, optIn: true, sizeBand: 'small' })).status, 200)
    await refreshBenchmarks()
    assert.deepEqual((await call(null, 'GET')).body.modules, [], 'four organisations are not enough to publish')
    assert.equal((await call('admin5@org.example', 'PUT', '/consent', { orgId: 'org5', optIn: true })).status, 200)
    const [consent] = await rows("SELECT benchmark_opt_in_by FROM organizations WHERE id='org5'")
    assert.equal(consent.benchmark_opt_in_by, 'admin5@org.example')
    assert.match((await rows("SELECT action FROM audit_logs WHERE org_id='org5'"))[0].action, /Joined the public CRAFT benchmarks/)
    await refreshBenchmarks()
    const pub = await call(null, 'GET')
    assert.equal(pub.cache, 'public, max-age=3600')
    const [m] = pub.body.modules
    assert.equal(m.id, 'community')
    assert.equal(m.overall.organisations, '5–9')
    assert.ok(!/org\d|Org \d/.test(JSON.stringify(pub.body)), 'no organisation identifiers in the public data')
    assert.ok(!JSON.stringify(pub.body).includes('Governance'), 'private module content is not published')
    assert.deepEqual(m.dimensions.size.map((g: any) => g.value), ['Other'], 'small (4) is not shown on its own; with the unstated one it forms Other (5)')
    // Opting out removes the organisation from the next snapshot.
    await call('admin5@org.example', 'PUT', '/consent', { orgId: 'org5', optIn: false })
    await refreshBenchmarks()
    assert.deepEqual((await call(null, 'GET')).body.modules, [])
  })

  it('reports consent to members and limits recomputing to the super admin', async () => {
    const got = await call('admin1@org.example', 'GET', '/consent?orgId=org1')
    assert.deepEqual([got.body.optedIn, got.body.canChange], [false, true])
    assert.equal((await call('admin1@org.example', 'GET', '/consent?orgId=org2')).status, 403)
    assert.equal((await call('admin1@org.example', 'POST', '/refresh')).status, 403)
    assert.equal((await call(null, 'PUT', '/consent', { orgId: 'org1', optIn: true })).status, 401)
  })
})
