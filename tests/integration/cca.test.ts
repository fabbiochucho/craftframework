import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { blobStores, pool, rows, truncateAll } from './harness.ts'
import { dashboard, improvementPlan, swotSeed } from '../../src/lib/cca/engine.ts'
import { CCA_MODULE_IDS, isAwardModule } from '../../src/lib/cca/modules.ts'
import { SPECIALIZED_READONLY_ROLES } from '../../netlify/lib/access-policy.ts'

const cca = (await import(new URL('../../netlify/functions/cca.mts', import.meta.url).href)).default
const archive = (await import(new URL('../../netlify/functions/assessment-archive.mts', import.meta.url).href)).default

const ALICE = 'alice@org-a.example' // admin of org_a
const BOB = 'bob@org-b.example' // admin of org_b

async function call(email: string | null, method: string, path = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email, name: email } : null
  const res: Response = await cca(new Request(`http://localhost/api/cca${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  const text = await res.text()
  let parsed: any = null
  try { parsed = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: parsed }
}

const st = (id: string) => [{ id, text: `Statement ${id}` }]
const dom = (id: string, critical = false) => ({ id, name: id, level1: 'Nothing yet.', critical, levels: { 2: st(`${id}.2`), 3: st(`${id}.3`), 4: st(`${id}.4`) } })
const MODULES = [
  { id: 'community', name: 'Community', audience: 'CSOs', areas: [{ id: 'gov', name: 'Governance', domains: [dom('g1'), dom('g2'), dom('g3')] }] },
  { id: 'pre_award', name: 'Pre-Award', audience: 'Applicants', areas: [{ id: 'fin', name: 'Finance', domains: [dom('f1', true), dom('f2'), dom('f3')] }] },
]
const publish = () => blobStores().set('cca-private', new Map([['modules', { bytes: Buffer.from(JSON.stringify(MODULES)) }]]))
const ok = { met: true, evidence: 'Seen: signed minutes, 12 March' }

describe('CRAFT Capacity Assessment API', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country) VALUES('org_a','Riverbend','Kenya'),('org_b','Hidden Trust','Kenya')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
  })

  it('serves module content only to signed-in users, and says when it is not published', async () => {
    assert.equal((await call(null, 'GET', '/modules')).status, 401)
    assert.equal((await call(ALICE, 'GET', '/modules')).status, 503)
    publish()
    const r = await call(ALICE, 'GET', '/modules')
    assert.equal(r.status, 200)
    assert.deepEqual(r.body.modules.map((m: any) => m.id), ['community', 'pre_award'])
  })

  it('retains each capacity revision by reporting year while current metrics use the latest answers', async () => {
    publish()
    const id = (await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).body.id
    const first = await call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.2': ok } })
    await rows("UPDATE assessment_revisions SET saved_at = saved_at - interval '1 hour'") // a later sitting, not the same autosave window
    const second = await call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.3': ok } })
    assert.ok(first.body.savedAt && second.body.savedAt)
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.2': { evidence: 'x'.repeat(1001) } } })).status, 400)
    const response = await archive(new Request('http://localhost/api/assessment-archive?source=capacity&period=2026'))
    const history = await response.json()
    assert.equal(history.revisions.length, 2)
    assert.equal(history.revisions[0].savedAt, second.body.savedAt)
    assert.equal(history.revisions[0].period, '2026')
    assert.deepEqual(Object.keys(history.revisions[1].snapshot.responses), ['g1.2'])
    assert.deepEqual(Object.keys(history.revisions[0].snapshot.responses), ['g1.2', 'g1.3'])
    const current = (await call(ALICE, 'GET', `/${id}`)).body.assessment
    assert.equal(dashboard(MODULES[0] as any, current.responses).areas[0].domains[0].score, 3)
    assert.equal((await rows('SELECT 1 FROM cca_assessments')).length, 1)
  })

  it('does not discard another concurrent partial save when merging capacity answers', async () => {
    publish()
    const id = (await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).body.id
    const saves = await Promise.all([
      call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.2': ok } }),
      call(ALICE, 'PUT', `/${id}`, { responses: { 'g2.2': ok } }),
    ])
    assert.deepEqual(saves.map(s => s.status), [200, 200])
    assert.deepEqual(Object.keys((await call(ALICE, 'GET', `/${id}`)).body.assessment.responses).sort(), ['g1.2', 'g2.2'])
  })

  it('validates the latest answers when completion waits behind a concurrent update', async () => {
    publish()
    const id = (await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).body.id
    await call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.2': ok } })
    const client = await pool.connect()
    let completion: ReturnType<typeof call> | undefined
    try {
      await client.query('BEGIN')
      await client.query('SELECT id FROM cca_assessments WHERE id=$1 FOR UPDATE', [id])
      completion = call(ALICE, 'POST', `/${id}/complete`)
      let blocked = false
      for (let i = 0; i < 100 && !blocked; i++) {
        const waiting = await rows("SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query ILIKE '%cca_assessments%' AND pid <> pg_backend_pid()")
        blocked = waiting.length > 0
        if (!blocked) await new Promise(resolve => setTimeout(resolve, 20))
      }
      assert.ok(blocked, 'completion should wait for the in-flight assessment update')
      await client.query("UPDATE cca_assessments SET not_assessed = '{\"g2\":\"\"}'::jsonb WHERE id=$1", [id])
      await client.query('COMMIT')
      const result = await completion
      assert.equal(result.status, 400)
      assert.match(result.body.error, /reason/i)
      assert.equal((await rows('SELECT status FROM cca_assessments WHERE id=$1', [id]))[0].status, 'draft')
    } finally {
      await client.query('ROLLBACK')
      client.release()
      if (completion) await completion
    }
  })

  it('runs an assessment: start, save evidence, complete, then locked; other organisations are refused', async () => {
    publish()
    assert.equal((await call(BOB, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).status, 403)
    const created = await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })
    assert.equal(created.status, 201)
    const id = created.body.id
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).status, 409, 'one per module and year')
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'pre_award', year: 2026 })).status, 400, 'grant stages name the award')
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'pre_award', year: 2026, awardRef: 'Health grant 2026' })).status, 201)

    // Responses merge across saves.
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.2': ok }, assessor: 'Amina', orgLead: 'Musa' })).status, 200)
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.3': ok, 'g2.2': { met: true, evidence: '' } }, votes: { g1: [3, 3, 4] } })).status, 200)
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.2': { met: true, evidence: 'x'.repeat(1001) } } })).status, 400)
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { plan: [{ domainId: 'g2', lines: { technicalAssistance: 500, trainingPerParticipant: 20, participants: 10 }, timeline: 'Q1', responsible: 'Programme lead' }] })).status, 200)
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { plan: [{ domainId: 'g2', lines: { bribes: 1 } }] })).status, 400, 'only the known cost lines')
    assert.equal((await call(BOB, 'GET', `/${id}`)).status, 403)
    const got = (await call(ALICE, 'GET', `/${id}`)).body.assessment
    assert.deepEqual(Object.keys(got.responses).sort(), ['g1.2', 'g1.3', 'g2.2'])
    assert.deepEqual(got.votes.g1, [3, 3, 4])
    assert.equal(improvementPlan(MODULES[0] as any, got.responses, got.plan).rows.find((x) => x.domainId === 'g2')!.cost, 700)
    // The engine scores from the saved responses: g1 reaches 3; g2 stays at 1 (met without evidence does not count).
    const d = dashboard(MODULES[0] as any, got.responses)
    assert.deepEqual(d.areas[0].domains.map((x) => x.score), [3, 1, 1])

    // A domain can be left out with a reason, except in grant-stage modules.
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { notAssessed: { g3: '' } })).status, 200, 'an unfinished draft can be saved')
    assert.equal((await call(ALICE, 'POST', `/${id}/complete`)).status, 400, 'needs a reason to complete')
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { notAssessed: { g3: 'No volunteers this year' } })).status, 200)
    const pre = (await call(ALICE, 'GET', '?orgId=org_a')).body.assessments.find((a: any) => a.module === 'pre_award')
    assert.equal((await call(ALICE, 'PUT', `/${pre.id}`, { notAssessed: { g3: 'Not relevant' } })).status, 400, 'grant stages assess every domain')
    const saved = (await call(ALICE, 'GET', `/${id}`)).body.assessment
    assert.deepEqual(saved.notAssessed, { g3: 'No volunteers this year' })
    assert.deepEqual(dashboard(MODULES[0] as any, saved.responses, saved.notAssessed).areas[0].average, 2, 'g3 left out: (3 + 1) / 2')

    assert.equal((await call(ALICE, 'POST', `/${id}/complete`)).status, 200)
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { responses: { 'g2.2': ok } })).status, 409, 'complete is final')
    const list = (await call(ALICE, 'GET', '?orgId=org_a')).body.assessments
    assert.deepEqual(list.map((a: any) => [a.module, a.status]), [['community', 'complete'], ['pre_award', 'draft']])
    assert.deepEqual(list.map((a: any) => a.domainIds), [['g1', 'g2', 'g3'], null], 'completion records the domains covered')
    assert.equal((await call(BOB, 'GET', '?orgId=org_a')).status, 403)
    // Government modules can be run per place; the same module and year twice for one place is refused.
    const govMods = [...MODULES, { ...MODULES[0], id: 'local', name: 'Local Government' }]
    blobStores().set('cca-private', new Map([['modules', { bytes: Buffer.from(JSON.stringify(govMods)) }]]))
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'local', year: 2026, region: 'Kano', district: 'Dala' })).status, 201)
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'local', year: 2026, region: 'Kano', district: 'Fagge' })).status, 201)
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'local', year: 2026, region: 'Kano', district: 'Dala' })).status, 409)
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2027, region: 'Kano' })).status, 201)
    const places = (await call(ALICE, 'GET', '?orgId=org_a')).body.assessments.map((a: any) => [a.module, a.year, a.region, a.district])
    assert.deepEqual(places.filter((p: any[]) => p[0] !== 'pre_award').sort(), [['community', 2026, '', ''], ['community', 2027, '', ''], ['local', 2026, 'Kano', 'Dala'], ['local', 2026, 'Kano', 'Fagge']], 'place only for government modules')
    const audit = await rows(`SELECT action FROM audit_logs WHERE org_id='org_a' AND action NOT LIKE '%local%' AND action NOT LIKE '%2027%' ORDER BY id`)
    assert.deepEqual(audit.map((a) => a.action.split(' (')[0]), ['Started capacity assessment', 'Started capacity assessment', 'Completed capacity assessment'])
  })

  it('saves and completes assessments with a large automatically seeded SWOT across module types', async () => {
    for (const module of CCA_MODULE_IDS) {
      const areas = Array.from({ length: 10 }, (_, area) => ({
        id: `area${area}`, name: `Area ${area}`,
        domains: Array.from({ length: 4 }, (_, domain) => dom(`${module}.${area}.${domain}`)),
      }))
      const mod = { id: module, name: module, audience: 'Organisations', areas }
      blobStores().set('cca-private', new Map([['modules', { bytes: Buffer.from(JSON.stringify([mod])) }]]))
      const created = await call(ALICE, 'POST', '', { orgId: 'org_a', module, year: 2026, ...(isAwardModule(module) ? { awardRef: 'Grant' } : {}) })
      assert.equal(created.status, 201)
      const id = created.body.id
      const swot = swotSeed(dashboard(mod as any, {}))
      assert.equal(swot.weaknesses.length, 40)
      const saved = await call(ALICE, 'PUT', `/${id}`, {
        responses: { [`${module}.0.0.2`]: ok }, votes: {}, consensus: {}, plan: [], swot,
        planReviewNotes: {}, ...(isAwardModule(module) ? {} : { notAssessed: { [`${module}.0.1`]: 'Not applicable yet' } }),
        assessor: 'Assessor', orgLead: 'Lead',
      })
      assert.equal(saved.status, 200, JSON.stringify(saved.body))
      assert.deepEqual((await call(ALICE, 'GET', `/${id}`)).body.assessment.swot, swot)
      assert.equal((await call(ALICE, 'POST', `/${id}/complete`)).status, 200)
    }
  })

  it('identifies the invalid field rather than blaming evidence and skipped domains for every save error', async () => {
    const id = (await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).body.id
    const evidence = await call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.2': { met: true, evidence: 'x'.repeat(1001) } } })
    assert.equal(evidence.status, 400)
    assert.match(evidence.body.error, /Evidence or response \(g1\.2, evidence\)/)
    const reason = await call(ALICE, 'PUT', `/${id}`, { notAssessed: { g1: 'x'.repeat(301) } })
    assert.equal(reason.status, 400)
    assert.match(reason.body.error, /Not assessed reason \(g1\)/)
    const swot = await call(ALICE, 'PUT', `/${id}`, { swot: { strengths: [], weaknesses: ['x'.repeat(301)], opportunities: [], threats: [] } })
    assert.equal(swot.status, 400)
    assert.match(swot.body.error, /SWOT \(weaknesses, 0\)/)
    const votes = await call(ALICE, 'PUT', `/${id}`, { votes: { g1: [1.5] } })
    assert.equal(votes.status, 400)
    assert.match(votes.body.error, /Facilitated votes \(g1, 0\)/)
    const largeSwot = { strengths: [], weaknesses: Array(1000).fill('Domain'), opportunities: [], threats: [] }
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { swot: largeSwot })).status, 200)
    const tooLarge = await call(ALICE, 'PUT', `/${id}`, { swot: { ...largeSwot, weaknesses: [...largeSwot.weaknesses, 'Another'] } })
    assert.equal(tooLarge.status, 400)
    assert.match(tooLarge.body.error, /SWOT \(weaknesses\)/)
  })

  it('preserves other draft data while reasons are unfinished and supports removing an unused consensus score', async () => {
    publish()
    const id = (await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).body.id
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.2': ok }, notAssessed: { g3: ' ' }, consensus: { g1: { agreed: 4, note: '' } } })).status, 200)
    const draft = (await call(ALICE, 'GET', `/${id}`)).body.assessment
    assert.deepEqual(draft.responses['g1.2'], ok)
    const blocked = await call(ALICE, 'POST', `/${id}/complete`)
    assert.deepEqual(blocked.body.missingReasons, ['g3'])
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { notAssessed: { g3: 'Not applicable' }, consensus: {}, replaceConsensus: true })).status, 200)
    assert.deepEqual((await call(ALICE, 'GET', `/${id}`)).body.assessment.consensus, {})
    assert.equal((await call(ALICE, 'POST', `/${id}/complete`)).status, 200)
  })

  it('allows members, scoped writers, creators, reviewers and the Super Admin to enter data, without granting readers write access', async () => {
    publish()
    const member = 'member@org-a.example', writer = 'writer@partner.example', creator = 'creator@partner.example', reviewer = 'reviewer@partner.example'
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('member',$1,'org_a','assessor')`, [member])
    await rows(`UPDATE organizations SET created_by=$1, reviewer=$2 WHERE id='org_a'`, [creator, reviewer])
    await rows(`INSERT INTO access_grants(id,org_id,grantee,role,status,level) VALUES('writer','org_a',$1,'assessor','active','write')`, [writer])
    const id = (await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).body.id
    for (const email of [ALICE, member, writer, creator, reviewer, 'fabbiochucho@gmail.com']) {
      const list = await call(email, 'GET', '?orgId=org_a')
      assert.equal(list.status, 200, email)
      assert.equal(list.body.canWrite, true, email)
      assert.equal((await call(email, 'PUT', `/${id}`, { responses: { 'g1.2': ok }, assessor: email })).status, 200, email)
    }
    const reader = 'reader@partner.example'
    await rows(`INSERT INTO access_grants(id,org_id,grantee,role,status,level) VALUES('reader','org_a',$1,'independent_assessor','active','read')`, [reader])
    for (const role of SPECIALIZED_READONLY_ROLES) {
      const email = `${role}@partner.example`
      await rows(`INSERT INTO access_grants(id,org_id,grantee,role,status,level,expires_at) VALUES($1,'org_a',$2,$3,'active','write',now() + interval '1 day')`, [role, email, role])
    }
    for (const email of [reader, ...[...SPECIALIZED_READONLY_ROLES].map(role => `${role}@partner.example`)]) {
      const list = await call(email, 'GET', '?orgId=org_a')
      assert.equal(list.status, 200, email)
      assert.equal(list.body.canWrite, false, email)
      assert.equal((await call(email, 'PUT', `/${id}`, { responses: { 'g1.2': ok } })).status, 403, email)
      assert.equal((await call(email, 'POST', `/${id}/complete`)).status, 403, email)
      assert.equal((await call(email, 'POST', '', { orgId: 'org_a', module: 'community', year: 2027 })).status, 403, email)
    }
    assert.equal((await call(writer, 'POST', `/${id}/complete`)).status, 200)
    assert.equal((await call(member, 'PUT', `/${id}`, { assessor: 'Changed' })).status, 409)
    assert.equal((await call(BOB, 'PUT', `/${id}`, { assessor: 'Changed' })).status, 403)
    const self = 'new@self.example', orgId = 'self_new_self_example'
    const own = await call(self, 'POST', '', { orgId, module: 'community', year: 2026 })
    assert.equal(own.status, 201)
    assert.equal((await call(self, 'PUT', `/${own.body.id}`, { responses: { 'g1.2': ok } })).status, 200)
    assert.equal((await call(self, 'POST', `/${own.body.id}/complete`)).status, 200)
  })

  it('an empty assessment cannot be completed; a completed one is reopened only by the independent assessor or the Super Admin', async () => {
    const MARTIN = 'martin@assessor.example'
    await rows(`INSERT INTO access_grants(id, org_id, grantee, role, status, level) VALUES('g1', 'org_a', $1, 'independent_assessor', 'active', 'read')`, [MARTIN])
    const id = (await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).body.id
    assert.equal((await call(ALICE, 'POST', `/${id}/complete`)).status, 400, 'nothing answered')
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { responses: { 'g2.2': { met: false, evidence: 'No board minutes exist yet' } } })).status, 200)
    assert.equal((await call(ALICE, 'POST', `/${id}/complete`)).status, 200, 'a note on what is missing counts as an answer')
    assert.equal((await call(ALICE, 'POST', `/${id}/reopen`, { reason: 'x' })).status, 403, 'the organisation cannot reopen its own')
    assert.equal((await call(MARTIN, 'POST', `/${id}/reopen`, {})).status, 400, 'a reason is required')
    assert.equal((await call(MARTIN, 'POST', `/${id}/reopen`, { reason: 'Completed before the group met' })).status, 200)
    assert.equal((await call(MARTIN, 'POST', `/${id}/reopen`, { reason: 'again' })).status, 409)
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { responses: { 'g2.2': ok } })).status, 200, 'editable again')
    assert.equal((await call(BOB, 'POST', `/${id}/reopen`, { reason: 'x' })).status, 403)
    assert.match((await rows(`SELECT action FROM audit_logs WHERE action LIKE 'Reopened%'`))[0].action, /Completed before the group met/)
  })

  it('Approach II: an agreed score above the evidence needs a note before completion', async () => {
    publish()
    const id = (await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).body.id
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { responses: { 'g1.2': ok }, consensus: { g1: { agreed: 4, note: '' }, g2: { agreed: 1, note: '' } } })).status, 200)
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { consensus: { g1: { agreed: 5, note: '' } } })).status, 400, 'scores are 1 to 4')
    const blocked = await call(ALICE, 'POST', `/${id}/complete`)
    assert.deepEqual([blocked.status, blocked.body.consensusGaps], [400, ['g1']], 'g1 agreed 4, evidence supports 2; g2 agreed 1 stands')
    assert.equal((await call(ALICE, 'PUT', `/${id}`, { consensus: { g1: { agreed: 4, note: 'Practice is strong but minutes are not signed' } } })).status, 200)
    assert.equal((await call(ALICE, 'POST', `/${id}/complete`)).status, 200)
    assert.equal((await call(ALICE, 'GET', `/${id}`)).body.assessment.consensus.g2.agreed, 1, 'entries merge across saves')
  })

  it('does not require hidden consensus notes for domains deliberately not assessed', async () => {
    publish()
    const id = (await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).body.id
    assert.equal((await call(ALICE, 'PUT', `/${id}`, {
      responses: { 'g2.2': ok }, notAssessed: { g1: 'Outside this assessment' }, consensus: { g1: { agreed: 4, note: '' } },
    })).status, 200)
    assert.equal((await call(ALICE, 'POST', `/${id}/complete`)).status, 200)
  })

  it('a reassessment completes only once every missed target from last year’s plan is explained', async () => {
    publish()
    const y1 = (await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2025 })).body.id
    assert.equal((await call(ALICE, 'PUT', `/${y1}`, { responses: { 'g1.2': ok } })).status, 200) // plan: g1 2→3, g2 1→2, g3 1→2
    assert.equal((await call(ALICE, 'POST', `/${y1}/complete`)).status, 200, 'first year: nothing to review')
    const y2 = (await call(ALICE, 'POST', '', { orgId: 'org_a', module: 'community', year: 2026 })).body.id
    assert.equal((await call(ALICE, 'PUT', `/${y2}`, { responses: { 'g1.2': ok, 'g2.2': ok } })).status, 200) // g2 reached; g1 and g3 missed
    const blocked = await call(ALICE, 'POST', `/${y2}/complete`)
    assert.deepEqual([blocked.status, blocked.body.missing.sort()], [400, ['g1', 'g3']])
    assert.equal((await call(ALICE, 'PUT', `/${y2}`, { planReviewNotes: { g1: 'Auditor contract delayed to Q1', g3: 'x' } })).status, 200)
    assert.deepEqual((await call(ALICE, 'POST', `/${y2}/complete`)).body.missing, ['g3'], 'a two-letter note is not an explanation')
    assert.equal((await call(ALICE, 'PUT', `/${y2}`, { planReviewNotes: { g1: 'Auditor contract delayed to Q1', g3: 'No volunteers recruited; budget moved to outreach' } })).status, 200)
    assert.equal((await call(ALICE, 'POST', `/${y2}/complete`)).status, 200)
    const saved = (await call(ALICE, 'GET', `/${y2}`)).body.assessment
    assert.equal(saved.planReviewNotes.g3, 'No volunteers recruited; budget moved to outreach')
  })
})
