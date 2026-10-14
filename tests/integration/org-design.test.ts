// Organisational design & diagnosis through the real API, against Postgres.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { ADMIN, ASSESSOR, OWNER, VIEWER, as, createOrg, expectStatus, truncateAll } from './harness.ts'
import { NINE_TESTS, SECTIONS } from '../../src/lib/org-design.ts'

// Rate every statement in a section at `low`, then override some.
const ratings = (section: string, prefix: RegExp, low: number) => Object.fromEntries(SECTIONS.find((s) => s.id === section)!.fields.filter((f) => prefix.test(f.key)).map((f) => [f.key, low]))

let wsId = 0
const P = () => `/workspaces/${wsId}`

describe('organisational design & diagnosis', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  it('diagnoses structure and culture, runs the nine tests, finalises and renders the report', async () => {
    const cat = expectStatus(await as(VIEWER).get(`${P()}/org-design/catalogue`), 200).body
    assert.equal(cat.nineTests.length, 9)
    assert.equal((await as(VIEWER).post(`${P()}/org-design`, { title: 'x' })).status, 403)
    const r = expectStatus(await as(ASSESSOR).post(`${P()}/org-design`, { title: 'Ministry of Health 2026' }), 201).body
    const put = (section: string, body: object, who = ASSESSOR) => as(who).put(`${P()}/org-design/${r.id}/sections/${section}`, body)

    assert.equal((await put('structure', { cfg_m1: 9 })).status, 400)
    assert.equal((await put('structure', { bogus: 1 })).status, 400)
    assert.equal((await put('bogus', {})).status, 400)

    expectStatus(await put('intro', { role: 'Director of Planning', sector: 'government', size: 'large', nature: 'A federal ministry', offerings: 'Policy and services', unitDefinition: 'A directorate' }), 200)
    expectStatus(await put('planning', { sources: 'HR, finance', timeline: [{ activity: 'Interviews', start: '2026-11-01', end: '2026-11-14' }], difficulties: 'Access', mitigation: 'Sponsor letter', execution: 'On plan' }), 200)
    expectStatus(await put('environment', { stability: 2, complexity: 2, diversity: 1, hostility: 2, factors: 'Budget cycles' }), 200)
    expectStatus(await put('structure', { ...ratings('structure', /^cfg_/, 1), definitionView: 'Useful', cfg_m1: 5, cfg_m2: 5, cfg_m3: 5, cfg_s1: 2, coordination: 'work_processes', effectiveness: 'Efficient but slow',
      dp_specialisation: 4, dp_formalisation: 5, dp_training: 3, dp_indoctrination: 2, dp_grouping: 3, dp_unit_size: 3, dp_planning_control: 4, dp_liaison: 2, dp_decentralisation: 2 }), 200)
    expectStatus(await put('culture', { ...ratings('culture', /^hd_/, 1), st_1: 4, st_2: 3, st_3: 3, st_4: 4, shouldBeStrong: 'Yes', hd_r1: 5, hd_r2: 5, hd_r3: 4, handyPreferred: 'role', dkRisk: 2, dkFeedback: 1, dkPreferred: 'process', metaphor: 'machine', metaphorNotes: 'Rules', managementGrip: 'Partly' }), 200)
    const fnBody: Record<string, unknown> = {}
    for (const u of ['hr', 'marketing', 'operations', 'ict', 'finance']) Object.assign(fnBody, { [`${u}_analysis`]: 'a', [`${u}_interface`]: 'b', [`${u}_effectiveness`]: 3, [`${u}_efficiency`]: 3, [`${u}_problems`]: 'c', [`${u}_recommendations`]: `Improve ${u}` })
    expectStatus(await put('functions', fnBody), 200)
    expectStatus(await put('legal', { gta: 'written', gtaPositives: 'Clear', gtaImprovements: 'Liability', consumerProtection: 'FCCPA 2018', legalIdentity: 'government', legalAlternatives: 'Agency', employmentLaw: 'Labour Act', employmentPolicies: 'Equal pay' }), 200)

    // Finalising is blocked until the nine tests are assessed.
    const blocked = await as(ADMIN).post(`${P()}/org-design/${r.id}/finalise`, {})
    assert.equal(blocked.status, 409)
    assert.match(blocked.body.error, /Market advantage test not assessed/)

    const tests: Record<string, string> = {}
    for (const t of NINE_TESTS) Object.assign(tests, { [`t_${t.id}`]: t.id === 'flexibility' ? 'concern' : 'pass', [`t_${t.id}_rationale`]: 'Evidence', [`t_${t.id}_action`]: t.id === 'flexibility' ? 'Set up a delivery unit' : '' })
    const after = expectStatus(await put('tests', tests), 200).body
    assert.equal(after.diagnosis.configuration.dominant, 'machine')
    assert.equal(after.diagnosis.configuration.fit, 'fits')
    assert.equal(after.diagnosis.culture.dealKennedy.type, 'process')
    assert.match(after.diagnosis.tests.verdict, /Sound with concerns/)

    assert.equal((await as(ASSESSOR).post(`${P()}/org-design/${r.id}/finalise`, {})).status, 403, 'finalising needs admin')
    const fin = expectStatus(await as(OWNER).post(`${P()}/org-design/${r.id}/finalise`, {}), 200).body
    assert.equal(fin.status, 'final')
    assert.equal((await put('intro', { role: 'changed' })).status, 409, 'finalised reviews are frozen')

    const list = expectStatus(await as(VIEWER).get(`${P()}/org-design`), 200).body
    assert.equal(list[0].dominant, 'machine')
    assert.equal(list[0].data, undefined, 'list omits answers')

    const report = await as(VIEWER).get(`${P()}/org-design/${r.id}/report`)
    assert.equal(report.status, 200)
    const html = report.text
    assert.match(html, /Organisational Analysis/)
    assert.match(html, /Machine bureaucracy/)
    assert.match(html, /Set up a delivery unit/)
    assert.match(html, /OD-\d+-FINAL/)
  })
})
