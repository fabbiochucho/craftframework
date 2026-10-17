import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { beforeEach, describe, it } from 'node:test'
import { getStore } from '@netlify/blobs'
import { rows, truncateAll } from './harness.ts'
import { encodeEvidence } from '../../netlify/lib/evidence-storage.ts'
import { devMapperSummary } from '../../netlify/lib/validator-quality.ts'
import { FRAMEWORKS } from '../../src/lib/validationReview.ts'

// Review follow-ups: partial scopes confirm levels, the organisation's evidence is linked per indicator,
// and a negotiated score above 2 on insufficient evidence is capped at 2.

const load = async (f: string) => (await import(new URL(`../../netlify/functions/${f}.mts`, import.meta.url).href)).default
const directory = await load('directory')
const engagements = await load('engagements')
const reviews = await load('validation-reviews')
const publicValidation = await load('public-validation')

const ALICE = 'alice@org-a.example'
const BOB = 'bob@org-b.example'
const VAL = 'val@validators.example'
const OTHER = 'other@validators.example'
const VIEWER = 'viewer@org-a.example'

const INDS = FRAMEWORKS['capital-readiness'].indicators
const idsOf = (...levels: number[]) => INDS.filter((i) => levels.includes(i.level)).map((i) => i.id)

async function call(email: string | null, method: string, path: string, body?: unknown, handler: any = reviews) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}
const rev = (email: string | null, method: string, path: string, body?: unknown) => call(email, method, `validation-reviews${path}`, body)
const eng = (email: string | null, method: string, path: string, body?: unknown) => call(email, method, `engagements${path}`, body, engagements)

async function profile(email: string, name: string) {
  const r = await call(email, 'PUT', 'directory/me/validator', { name }, directory)
  await rows("UPDATE validator_profiles SET accreditation_status='accredited', accredited_until = now() + interval '1 year' WHERE email=$1", [email])
  return r.body.id as string
}

let engId: string
let valId: string
const startEngagement = async (scope: unknown) => {
  const created = await eng(ALICE, 'POST', '', { side: 'organization', type: 'independent_validation', validatorId: valId, scope })
  assert.equal(created.status, 201, created.text)
  engId = created.body.id
  await eng(VAL, 'POST', `/${engId}/respond`, { side: 'validator', decision: 'accept' })
}
const open = async () => assert.equal((await eng(VAL, 'POST', `/${engId}/declaration`, { confirmed: true, signedName: 'Valerie Okafor' })).status, 200)
const setup = () => rev(VAL, 'PUT', `/${engId}/setup`, { method: 'combined', fieldworkStart: '2026-01-05', fieldworkEnd: '2026-01-09' })
const score = async (ids: string[], value: number, sufficiency = 'sufficient') => {
  for (const id of ids) assert.equal((await rev(VAL, 'PUT', `/${engId}/scores/${id}`, { score: value, sufficiency, comment: '', evidenceRef: '' })).status, 200)
}

describe('validation review follow-ups', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country,sector) VALUES('org_a','Acme Cooperative','Kenya','Agriculture'),('org_b','Hidden Trust','Kenya','Health')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin'),('v','${VIEWER}','org_a','admin')`)
    valId = await profile(VAL, 'Valerie Okafor')
    await profile(OTHER, 'Olu Other')
  })

  describe('partial scopes', () => {
    it('confirms each in-scope level but yields no rung, and shows the confirmed levels instead', async () => {
      await rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('org_a','capital:scores',$1)`, [JSON.stringify(Object.fromEntries(INDS.map((i) => [i.id, 4])))])
      await startEngagement({ kind: 'levels', levels: [3, 4] })
      await open(); await setup()
      await score(idsOf(3), 2); await score(idsOf(4), 5)
      const live = (await rev(VAL, 'GET', `/${engId}`)).body
      assert.equal(live.partialScope, true)
      assert.equal(live.rungs, null, 'no rung for a scope that skips level 1')
      assert.deepEqual(live.confirmedLevels.map((c: any) => [c.level, c.achieved]), [[3, false], [4, true]])
      // Level 3 is not confirmed: a plain "validated" outcome is refused, a qualified one is allowed.
      const refused = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated' })
      assert.equal(refused.status, 400)
      assert.ok(refused.body.problems.some((p: string) => /every level in scope confirmed/.test(p)), refused.text)
      // Fix level 3, then "validated" is allowed with no rung.
      await score(idsOf(3), 5)
      const done = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated' })
      assert.equal(done.status, 200, done.text)
      assert.equal(done.body.validatedRung, null)
      assert.deepEqual(done.body.confirmedLevels, [3, 4])
      const [review] = await rows('SELECT validated_rung, snapshot FROM validation_reviews')
      assert.equal(review.validated_rung, null)
      assert.equal(review.snapshot.validatedRung, null)
      assert.equal(review.snapshot.partialScope, true)
      assert.deepEqual(review.snapshot.confirmedLevels.map((c: any) => [c.level, c.achieved]), [[3, true], [4, true]])
      // The issued validation, the public page and DevMapper all show levels, not a rung.
      const [issued] = await rows('SELECT verification_id, validated_rung FROM validations')
      assert.equal(issued.validated_rung, 0)
      ;(globalThis as any).__craftTestIdentity = null
      const pub = await call(null, 'GET', `public/validation/${issued.verification_id}`, undefined, publicValidation)
      assert.equal(pub.status, 200, pub.text)
      const page = pub.body.validation ?? pub.body
      assert.equal(page.validatedRung, 0)
      assert.deepEqual(page.confirmedLevels.map((c: any) => [c.level, c.achieved]), [[3, true], [4, true]])
      const dm = await devMapperSummary('org_a')
      assert.equal(dm?.validation?.validatedRung, null)
      assert.deepEqual(dm?.validation?.confirmedLevels?.map((c) => c.level), [3, 4])
    })

    it('records a partly confirmed scope with qualifications, and still refuses when no level is confirmed', async () => {
      await startEngagement({ kind: 'levels', levels: [3, 4] })
      await open(); await setup()
      await score(idsOf(3), 1); await score(idsOf(4), 1)
      const q = await rev(VAL, 'POST', `/${engId}/qualifications`, { text: 'Gaps', indicatorIds: [idsOf(3)[0]] })
      assert.equal(q.status, 201)
      const none = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated_with_qualifications' })
      assert.equal(none.status, 400)
      assert.ok(none.body.problems.some((p: string) => /Not validated/.test(p)))
      await score(idsOf(4), 5)
      const ok = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated_with_qualifications' })
      assert.equal(ok.status, 200, ok.text)
      assert.deepEqual(ok.body.confirmedLevels, [4])
    })

    it('a scope that starts at level 1 still yields a rung', async () => {
      await startEngagement({ kind: 'levels', levels: [1] })
      await open(); await setup()
      await score(idsOf(1), 4)
      const done = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated' })
      assert.equal(done.status, 200, done.text)
      assert.equal(done.body.validatedRung, 1)
      assert.equal(done.body.confirmedLevels, null)
    })
  })

  describe('linked evidence', () => {
    let evA: number // held by the workspace organisation Alice assesses for
    let evOther: number // held by a workspace organisation she is not in
    let evViewerOnly: number // held by one where she is only a viewer
    const BYTES = new TextEncoder().encode('board minutes: SECRET-CONTENT')
    beforeEach(async () => {
      await rows(`INSERT INTO ws_organizations(id,name) VALUES(1,'Acme WS'),(2,'Elsewhere WS'),(3,'Viewer WS')`)
      await rows(`INSERT INTO ws_org_members(user_id,org_id,role) VALUES('${ALICE}',1,'assessor'),('${BOB}',2,'owner'),('${ALICE}',3,'viewer')`)
      const ins = async (org: number, name: string, path: string) => (await rows(
        `INSERT INTO evidence_registry(org_id,workspace_id,document_name,document_type,uploaded_by,file_path,file_size_kb,mime_type) VALUES($1,1,$2,'policy','x',$3,1,'text/plain') RETURNING id`, [org, name, path]))[0].id as number
      evA = await ins(1, 'Board minutes 2025.txt', 'k/minutes')
      evOther = await ins(2, 'Their secret.txt', 'k/secret')
      evViewerOnly = await ins(3, 'Viewer file.txt', 'k/viewer')
      await getStore('evidence').set('k/minutes', encodeEvidence(BYTES.buffer.slice(BYTES.byteOffset, BYTES.byteOffset + BYTES.byteLength) as ArrayBuffer))
      await startEngagement({ kind: 'levels', levels: [1] })
    })
    const L1 = () => idsOf(1)[0]

    it('lets the organisation link only evidence it may assess, and offers only those items', async () => {
      assert.equal((await rev(ALICE, 'POST', `/${engId}/evidence/${L1()}`, { evidenceId: evA })).status, 201)
      assert.equal((await rev(ALICE, 'POST', `/${engId}/evidence/${L1()}`, { evidenceId: evOther })).status, 404, 'another organisation\'s evidence is invisible')
      assert.equal((await rev(ALICE, 'POST', `/${engId}/evidence/${L1()}`, { evidenceId: evViewerOnly })).status, 403, 'a workspace viewer cannot share evidence')
      assert.equal((await rev(ALICE, 'POST', `/${engId}/evidence/${L1()}`, { evidenceId: 99999 })).status, 404)
      assert.equal((await rev(ALICE, 'POST', `/${engId}/evidence/${idsOf(2)[0]}`, { evidenceId: evA })).status, 400, 'indicator outside the scope')
      assert.equal((await rev(VAL, 'POST', `/${engId}/evidence/${L1()}`, { evidenceId: evA })).status, 403, 'a validator cannot link')
      assert.equal((await rev(BOB, 'POST', `/${engId}/evidence/${L1()}`, { evidenceId: evOther })).status, 404, 'another organisation cannot link')
      const opts = (await rev(ALICE, 'GET', `/${engId}/evidence-options`)).body.options
      assert.deepEqual(opts.map((o: any) => o.id), [evA])
      assert.equal((await rev(VAL, 'GET', `/${engId}/evidence-options`)).status, 403)
      // Linking twice is harmless; the link can be removed.
      assert.equal((await rev(ALICE, 'POST', `/${engId}/evidence/${L1()}`, { evidenceId: evA })).status, 200)
      assert.equal((await rows('SELECT count(*)::int AS n FROM validation_evidence_links'))[0].n, 1)
      assert.equal((await rev(ALICE, 'DELETE', `/${engId}/evidence/${L1()}/${evA}`)).status, 200)
      assert.equal((await rev(ALICE, 'DELETE', `/${engId}/evidence/${L1()}/${evA}`)).status, 404)
    })

    it('shows linked evidence to a validator only while their grant is active, and audit-logs the view', async () => {
      await rev(ALICE, 'POST', `/${engId}/evidence/${L1()}`, { evidenceId: evA })
      // Named but not yet declared (no active grant): no review rows, no evidence.
      const before = await rev(VAL, 'GET', `/${engId}`)
      assert.equal(before.status, 200)
      assert.equal(before.body.rows, undefined)
      assert.ok(!before.text.includes('Board minutes'), before.text)
      assert.equal((await rev(OTHER, 'GET', `/${engId}`)).status, 404, 'a validator not on the engagement sees nothing')
      assert.equal((await rev(BOB, 'GET', `/${engId}`)).status, 404)
      // The organisation sees what it linked (and the indicators to link to) before the debrief.
      const orgView = (await rev(ALICE, 'GET', `/${engId}`)).body
      assert.deepEqual(orgView.evidence.map((x: any) => x.name), ['Board minutes 2025.txt'])
      assert.equal(orgView.indicators.length, idsOf(1).length)
      await open()
      const active = (await rev(VAL, 'GET', `/${engId}`)).body
      const row = active.rows.find((r: any) => r.id === L1())
      assert.equal(row.evidence.length, 1)
      assert.equal(row.evidence[0].name, 'Board minutes 2025.txt')
      assert.equal(row.evidence[0].available, true)
      assert.equal(row.evidence[0].sha256, createHash('sha256').update(BYTES).digest('hex'))
      assert.ok(!JSON.stringify(active).includes('SECRET-CONTENT'), 'metadata only, never contents')
      assert.ok((await rows("SELECT 1 FROM audit_logs WHERE category='Validation' AND action ~ 'viewed 1 linked evidence'")).length >= 1)
      // Grant ends: the evidence disappears from the view again.
      await rows("UPDATE validation_engagements SET expires_at = now() - interval '1 minute'")
      await rows("UPDATE access_grants SET expires_at = now() - interval '1 minute' WHERE role='craft_validator'")
      const ended = await rev(VAL, 'GET', `/${engId}`)
      assert.equal(ended.body.rows, undefined)
      assert.ok(!ended.text.includes('Board minutes'))
    })

    it('freezes evidence references (id, name, hash) in the snapshot, never contents', async () => {
      await rev(ALICE, 'POST', `/${engId}/evidence/${L1()}`, { evidenceId: evA })
      await open(); await setup(); await score(idsOf(1), 4)
      const done = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated' })
      assert.equal(done.status, 200, done.text)
      const [r] = await rows('SELECT snapshot FROM validation_reviews')
      const ind = r.snapshot.indicators.find((i: any) => i.id === L1())
      assert.deepEqual(ind.evidence, [{ id: evA, name: 'Board minutes 2025.txt', type: 'policy', sha256: createHash('sha256').update(BYTES).digest('hex') }])
      assert.ok(!JSON.stringify(r.snapshot).includes('SECRET-CONTENT'))
      // Once frozen the links cannot change.
      assert.equal((await rev(ALICE, 'DELETE', `/${engId}/evidence/${L1()}/${evA}`)).status, 409)
      assert.equal((await rev(ALICE, 'POST', `/${engId}/evidence/${L1()}`, { evidenceId: evA })).status, 409)
    })
  })

  describe('paper-compliance cap', () => {
    const L1 = idsOf(1)
    const negotiateAll = async (value: number) => {
      for (const id of L1) assert.equal((await rev(VAL, 'PUT', `/${engId}/negotiated/${id}`, { score: value })).status, 200)
    }
    beforeEach(async () => {
      await rows(`INSERT INTO legacy_workspace_state(org_id,key,value) VALUES('org_a','capital:scores',$1)`, [JSON.stringify(Object.fromEntries(INDS.map((i) => [i.id, 5])))])
      await startEngagement({ kind: 'levels', levels: [1] })
      await open(); await setup()
    })

    it('caps a negotiated score above 2 at 2 when the evidence is insufficient, shown in the Trust Delta, debrief and snapshot', async () => {
      await score([L1[0]], 2, 'insufficient'); await score([L1[1], L1[2]], 2, 'sufficient')
      assert.equal((await rev(VAL, 'POST', `/${engId}/debrief/open`)).status, 200)
      await negotiateAll(4)
      const lead = (await rev(VAL, 'GET', `/${engId}`)).body
      const capped = lead.rows.find((r: any) => r.id === L1[0])
      assert.deepEqual([capped.negotiated, capped.paperCap.capped, capped.final], [4, 2, 2])
      assert.match(capped.paperCap.message, /PAPER COMPLIANCE/)
      assert.equal(lead.rows.find((r: any) => r.id === L1[1]).paperCap, null, 'sufficient evidence: no cap')
      assert.equal(lead.rows.find((r: any) => r.id === L1[1]).final, 4)
      // Level 1 now averages (2+4+4)/3 < 3.5, so no rung and "validated" is refused.
      assert.equal(lead.rungs.validator, 0)
      const org = (await rev(ALICE, 'GET', `/${engId}`)).body
      assert.equal(org.rows.find((r: any) => r.id === L1[0]).paperCap.capped, 2, 'the debrief shows the cap to the organisation')
      assert.equal(org.rows.find((r: any) => r.id === L1[1]).paperCap, null)
      const refused = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated' })
      assert.equal(refused.status, 400)
      assert.ok(refused.body.problems.some((p: string) => /Not validated/.test(p)))
      // A qualified outcome is not possible either; record the honest result.
      const nv = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'not_validated' })
      assert.equal(nv.status, 200, nv.text)
      const [r] = await rows('SELECT snapshot FROM validation_reviews')
      const a = r.snapshot.indicators.find((i: any) => i.id === L1[0])
      assert.deepEqual([a.negotiated, a.final, a.paperCap], [4, 2, { negotiated: 4, capped: 2 }])
      const b = r.snapshot.indicators.find((i: any) => i.id === L1[1])
      assert.deepEqual([b.negotiated, b.final, b.paperCap], [4, 4, null])
    })

    it('does not cap when the evidence is only partial, or when the negotiated score is 2 or less', async () => {
      await score([L1[0]], 2, 'partial'); await score([L1[1]], 2, 'sufficient'); await score([L1[2]], 1, 'insufficient')
      await rev(VAL, 'POST', `/${engId}/debrief/open`)
      await rev(VAL, 'PUT', `/${engId}/negotiated/${L1[0]}`, { score: 4 })
      await rev(VAL, 'PUT', `/${engId}/negotiated/${L1[1]}`, { score: 4 })
      await rev(VAL, 'PUT', `/${engId}/negotiated/${L1[2]}`, { score: 2 })
      const lead = (await rev(VAL, 'GET', `/${engId}`)).body
      assert.ok(lead.rows.filter((r: any) => L1.includes(r.id)).every((r: any) => r.paperCap === null))
      assert.deepEqual(L1.map((id) => lead.rows.find((r: any) => r.id === id).final), [4, 4, 2])
    })

    it('does not cap the validator\'s own score, only negotiated ones', async () => {
      await score(L1, 4, 'insufficient')
      const lead = (await rev(VAL, 'GET', `/${engId}`)).body
      assert.ok(lead.rows.filter((r: any) => L1.includes(r.id)).every((r: any) => r.paperCap === null && r.final === 4))
      assert.equal(lead.rungs.validator, 1)
    })

    it('a negotiated score that survives on sufficient evidence still supports the rung', async () => {
      await score(L1, 1, 'sufficient')
      await rev(VAL, 'POST', `/${engId}/debrief/open`)
      await negotiateAll(4)
      const done = await rev(VAL, 'POST', `/${engId}/finalise`, { outcome: 'validated' })
      assert.equal(done.status, 200, done.text)
      assert.equal(done.body.validatedRung, 1)
    })
  })
})
