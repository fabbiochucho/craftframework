import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { getStore } from '@netlify/blobs'
import { rows, truncateAll } from './harness.ts'
import { OPEN_TRAINING_CONTENT } from '../../src/lib/trainingContent.ts'
import { syntheticAnswerKey } from '../../src/lib/trainingAnswers.ts'

const directory = (await import(new URL('../../netlify/functions/directory.mts', import.meta.url).href)).default
const training = (await import(new URL('../../netlify/functions/training.mts', import.meta.url).href)).default
const firmsApi = (await import(new URL('../../netlify/functions/firms.mts', import.meta.url).href)).default

const ADMIN = 'fabbiochucho@gmail.com' // platform admin allowlist
const LEARNER = 'lena@validators.example'
const OTHER = 'omar@validators.example'
const TEAM = 'pat@craft.example' // programme team
const LEAD = 'lead@validators.example' // Lead Validator (marks only)
const OUTSIDER = 'nobody@elsewhere.example'

async function call(email: string | null, method: string, path: string, body?: unknown, handler = training) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  const res: Response = await handler(new Request(`http://localhost/api/${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, text }
}
const t = (email: string | null, method: string, path: string, body?: unknown) => call(email, method, `training/${path}`, body)

async function makeValidator(email = LEARNER, name = 'Lena Wanjiru') {
  const res = await call(email, 'PUT', 'directory/me/validator', { name, competencies: ['Audit'], countries: ['Kenya'] }, directory)
  assert.equal(res.status, 200, res.text)
  return res.body.id as string
}
// Marks every step of every module as done, as if the learner had worked through the programme.
async function finishModules(email: string) {
  await t(email, 'GET', 'me') // seeds the content
  for (const m of await rows('SELECT id FROM training_modules')) {
    for (const step of ['watch', 'try', 'decide', 'check', 'reflect']) {
      await rows('INSERT INTO training_progress(email,module_id,step) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [email, m.id, step])
    }
  }
}
async function startExam(email = LEARNER) {
  const res = await t(email, 'POST', 'exam/start')
  assert.equal(res.status, 200, res.text)
  return res.body as { id: string; questions: Array<{ id: string }>; note: string | null }
}
async function answerKey(ids: string[]) {
  const qs = await rows('SELECT id, correct_index FROM training_questions WHERE id = ANY($1)', [ids])
  return Object.fromEntries(qs.map((q: any) => [q.id, q.correct_index])) as Record<string, number>
}
async function passExam(email = LEARNER) {
  const exam = await startExam(email)
  const key = await answerKey(exam.questions.map((q) => q.id))
  const res = await t(email, 'POST', `exam/${exam.id}/submit`, { answers: key })
  assert.equal(res.status, 200, res.text)
  assert.equal(res.body.passed, true)
}
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')
async function submitAndMarkCases(email = LEARNER, percent = 85) {
  const cases = (await t(email, 'GET', 'cases')).body.cases as Array<{ id: string }>
  assert.equal(cases.length, 4)
  for (const cs of cases) {
    const sub = await t(email, 'POST', `cases/${cs.id}/submit`, { text: words(300) })
    assert.equal(sub.status, 201, sub.text)
    for (const marker of [TEAM, LEAD]) assert.equal((await t(marker, 'POST', `marking/${sub.body.id}`, { percent, comment: 'Good judgement' })).status, 200)
  }
}
const capstoneBody = async () => {
  const scores = Object.fromEntries((await rows("SELECT id FROM (VALUES ('CRL-1A'),('CRL-1B'),('CRL-1C'),('CRL-2A'),('CRL-2B'),('CRL-2C'),('CRL-3A'),('CRL-3B'),('CRL-3C'),('CRL-4A'),('CRL-4B'),('CRL-4C')) v(id)")).map((r: any) => [r.id, { score: 3, note: 'Evidence reviewed' }]))
  return {
    declaration: 'I declare no conflicts; the funder engaged me and that is disclosed.', scores, debrief: 'Firm, factual and courteous response to the pushback.',
    outcome: 'validated_with_qualifications', ratedRung: 2, qualifications: 'CRL-3A: reserves at 1 month; retest at follow-up', followUp: 'Milestone follow-up on reserves and impact data',
    validityMonths: 6, materialEvents: 'Finance director resigned: a material event',
  }
}
async function submitCapstone(email = LEARNER) {
  const res = await t(email, 'POST', 'capstone/riverbend/submit', await capstoneBody())
  assert.equal(res.status, 201, res.text)
  return res.body.id as string
}
const RUBRIC_ALL = (n: number) => ({ independence: n, scoring: n, evidence: n, outcome: n, followup: n, events: n })

describe('validator training and accreditation', () => {
  beforeEach(async () => {
    await truncateAll()
    // The real answer key is private; a placeholder key lets the content seed here.
    await getStore('training-private').setJSON('answer-key', syntheticAnswerKey(OPEN_TRAINING_CONTENT))
    await t(ADMIN, 'GET', 'me') // seeds the programme content
    assert.equal((await t(ADMIN, 'PUT', `manage/staff/${TEAM}`, { role: 'programme_team' })).status, 200)
    assert.equal((await t(ADMIN, 'PUT', `manage/staff/${LEAD}`, { role: 'lead_validator' })).status, 200)
  })

  it('refuses unauthenticated requests and seeds the programme content', async () => {
    for (const [m, p] of [['GET', 'me'], ['GET', 'exam'], ['POST', 'exam/start'], ['GET', 'marking/queue'], ['GET', 'manage/content']]) {
      assert.equal((await t(null, m, p, m === 'POST' ? {} : undefined)).status, 401, `${m} ${p}`)
    }
    const me = (await t(LEARNER, 'GET', 'me')).body
    assert.equal(me.modules.length, 9, 'eight modules plus module 9 (the CRAFT indices); specialist modules are listed separately')
    assert.deepEqual(me.specialist.map((s: any) => s.moduleId), ['s1', 's2'])
    assert.equal(me.progress.pct, 0)
    assert.equal((await rows('SELECT count(*)::int n FROM training_cases'))[0].n, 4)
    assert.equal((await rows('SELECT count(*)::int n FROM training_capstones'))[0].n, 1)
    // Seeding runs once: an edit is never overwritten by a later request.
    await t(ADMIN, 'PUT', 'manage/cases/case-a', { title: 'Case A edited', topic: 'x', prompt: 'Edited prompt', modelAnswer: '', active: true })
    await t(LEARNER, 'GET', 'me')
    assert.equal((await rows("SELECT title FROM training_cases WHERE id='case-a'"))[0].title, 'Case A edited')
  })

  it('only the programme team and platform admin edit content', async () => {
    const mod = (await t(ADMIN, 'GET', 'manage/content')).body.modules.find((x: any) => x.id === 'm1')
    const edit = (over: object = {}) => ({
      title: mod.title, outcome: mod.outcome, script: mod.script, youtubeUrl: null, reflectionPrompt: mod.reflectionPrompt, exercises: mod.exercises, scenario: mod.scenario, ...over,
    })
    for (const who of [LEARNER, LEAD, OUTSIDER]) {
      assert.equal((await t(who, 'PUT', 'manage/modules/m1', edit({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }))).status, 403, `${who} cannot edit`)
      assert.equal((await t(who, 'GET', 'manage/content')).status, 403)
      assert.equal((await t(who, 'POST', 'manage/questions', { prompt: 'q', options: ['a', 'b'], correctIndex: 0 })).status, 403)
      assert.equal((await t(who, 'PUT', `manage/staff/${who}`, { role: 'programme_team' })).status, 403, 'nobody promotes themselves')
    }
    // Programme team: paste a YouTube URL without a code change; the learner then gets the embed.
    assert.equal((await t(TEAM, 'PUT', 'manage/modules/m1', edit({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }))).status, 200)
    assert.equal((await t(LEARNER, 'GET', 'modules/m1')).body.videoId, 'dQw4w9WgXcQ')
    assert.equal((await rows("SELECT revision FROM training_modules WHERE id='m1'"))[0].revision, 2, 'a new video is a new revision')
    assert.equal((await t(TEAM, 'PUT', 'manage/modules/m1', edit({ youtubeUrl: 'https://evil.example/watch?v=dQw4w9WgXcQ' }))).status, 400)
    assert.equal((await t(TEAM, 'PUT', 'manage/modules/m1', edit({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', injected: 1 }))).status, 400, 'strict body')
    assert.equal((await t(ADMIN, 'PUT', 'manage/modules/m1', edit({ youtubeUrl: null }))).status, 200)
    assert.equal((await t(LEARNER, 'GET', 'modules/m1')).body.videoId, null, 'no video: the script is shown')
    assert.equal((await t(TEAM, 'POST', 'manage/questions', { moduleId: 'm1', prompt: 'New?', options: ['a', 'b'], correctIndex: 1, forExam: true })).status, 201)
    assert.equal((await t(TEAM, 'POST', 'manage/questions', { prompt: 'Bad', options: ['a', 'b'], correctIndex: 5 })).status, 400)
    // Staff are managed by the platform admin only.
    assert.equal((await t(TEAM, 'PUT', `manage/staff/${OTHER}`, { role: 'programme_team' })).status, 403)
    assert.equal((await t(ADMIN, 'DELETE', `manage/staff/${TEAM}`)).status, 200)
    assert.equal((await t(TEAM, 'GET', 'manage/content')).status, 403)
    assert.ok((await rows("SELECT 1 FROM audit_logs WHERE category='Training' AND actor=$1", [ADMIN])).length > 0)
  })

  it('works through a module: grading is server-side and answers stay hidden', async () => {
    const mod = (await t(LEARNER, 'GET', 'modules/m4')).body
    assert.ok(!JSON.stringify(mod).includes('correct'), 'no answer keys in the learner view')
    assert.ok(mod.scenario.choices.every((c: any) => !('consequence' in c) && !('best' in c)))
    assert.equal(mod.checkQuestions.length, 5)
    assert.ok(mod.checkQuestions.every((q: any) => !('correctIndex' in q) && !('explanation' in q)))
    assert.equal((await t(LEARNER, 'POST', 'modules/m4/watch')).status, 200)
    // Try: conflict spotter (a perfect score is remembered for the Clear Conscience badge).
    const [m4] = await rows("SELECT exercises, scenario FROM training_modules WHERE id = 'm4'")
    const m4Key: number[] = m4.exercises[0].items.map((i: any) => i.correct)
    const wrong = await t(LEARNER, 'POST', 'modules/m4/try/0', { answers: m4Key.map((c) => (c === 0 ? 1 : 0)) })
    assert.equal(wrong.body.score, 0)
    assert.ok(wrong.body.items.every((i: any) => 'explain' in i))
    const right = await t(LEARNER, 'POST', 'modules/m4/try/0', { answers: m4Key })
    assert.equal(right.body.score, m4Key.length)
    const decide = await t(LEARNER, 'POST', 'modules/m4/decide', { choice: m4.scenario.choices.findIndex((c: any) => !c.best) })
    assert.equal(decide.body.best, false); assert.ok(decide.body.consequence)
    // Check: unlimited retries with explanations; four of five passes.
    const ids = mod.checkQuestions.map((q: any) => q.id)
    const key = await answerKey(ids)
    const fail = await t(LEARNER, 'POST', 'modules/m4/check', { answers: Object.fromEntries(ids.map((id: string) => [id, (key[id] + 1) % 4])) })
    assert.equal(fail.body.passed, false); assert.ok(fail.body.results.every((r: any) => r.explanation))
    assert.equal((await t(LEARNER, 'POST', 'modules/m4/check', { answers: { [ids[0]]: key[ids[0]] } })).status, 400, 'cannot answer a single easy question')
    const ok = await t(LEARNER, 'POST', 'modules/m4/check', { answers: key })
    assert.equal(ok.body.passed, true)
    assert.equal((await t(LEARNER, 'POST', 'modules/m4/reflect', { text: 'short' })).status, 400)
    assert.equal((await t(LEARNER, 'POST', 'modules/m4/reflect', { text: 'I would disclose the relationship early and ask for advice.' })).status, 200)
    const me = (await t(LEARNER, 'GET', 'me')).body
    assert.equal(me.modules.find((x: any) => x.id === 'm4').complete, true)
    assert.equal(me.progress.xp, 10 + 20 + 15 + 20 + 10)
    assert.equal(me.progress.streak, 1)
    assert.equal(me.learningLog[0].moduleId, 'm4')
    await makeValidator()
    assert.deepEqual((await call(LEARNER, 'GET', 'directory/me', undefined, directory)).body.validator.badges.map((b: any) => b.key), ['clear-conscience'])
    // Rung calculator challenge: rung must be exactly 3; the server computes it.
    const hi = Object.fromEntries(['1A', '1B', '1C', '2A', '2B', '2C', '3A', '3B', '3C', '4A', '4B', '4C'].map((k) => [`CRL-${k}`, 4]))
    assert.equal((await t(LEARNER, 'POST', 'modules/m2/try/0', { scores: hi })).body.done, false)
    assert.equal((await t(LEARNER, 'POST', 'modules/m2/try/0', { scores: { ...hi, 'CRL-4A': 0, 'CRL-4B': 0, 'CRL-4C': 0 } })).body.done, true)
  })

  it('lets ICAN / ANAN / ACCA / CIA holders skip the Module 3 check, noting verified or not', async () => {
    await makeValidator()
    assert.equal((await t(LEARNER, 'POST', 'modules/m3/check/skip')).status, 403)
    await call(LEARNER, 'POST', 'directory/me/credentials', { body: 'ACCA', membershipNumber: 'A-1' }, directory)
    assert.equal((await t(LEARNER, 'GET', 'modules/m3')).body.checkSkip.verified, false)
    assert.equal((await t(LEARNER, 'POST', 'modules/m4/check/skip')).status, 400, 'only Module 3')
    const res = await t(LEARNER, 'POST', 'modules/m3/check/skip')
    assert.deepEqual([res.status, res.body.body, res.body.verified], [200, 'ACCA', false])
    assert.equal((await rows("SELECT detail FROM training_progress WHERE module_id='m3' AND step='check'"))[0].detail.skipped, true)
  })

  it('a suspended validator cannot sit the exam, and the exam needs a profile and the modules', async () => {
    assert.equal((await t(LEARNER, 'POST', 'exam/start')).status, 400, 'profile first')
    const id = await makeValidator()
    assert.equal((await t(LEARNER, 'POST', 'exam/start')).status, 400, 'modules first')
    await finishModules(LEARNER)
    assert.equal((await call(ADMIN, 'PUT', `directory/admin/validators/${id}`, { status: 'suspended', reason: 'Complaint upheld' }, directory)).status, 200)
    const res = await t(LEARNER, 'POST', 'exam/start')
    assert.equal(res.status, 403)
    assert.match(res.body.error, /suspended/)
    assert.equal((await rows('SELECT count(*)::int n FROM training_exam_attempts'))[0].n, 0)
    assert.equal((await t(LEARNER, 'POST', 'cases/case-a/submit', { text: words(300) })).status, 403)
    assert.equal((await t(LEARNER, 'POST', 'capstone/riverbend/submit', await capstoneBody())).status, 403)
    // Reinstating lets them sit it again, without granting anything.
    await call(ADMIN, 'PUT', `directory/admin/validators/${id}`, { status: 'registered', reason: 'Resolved' }, directory)
    assert.equal((await t(LEARNER, 'POST', 'exam/start')).status, 200)
    assert.equal((await rows('SELECT accredited_until FROM validator_profiles'))[0].accredited_until, null)
  })

  it('draws a timed exam from the bank with retake and yearly limits', async () => {
    await makeValidator(); await finishModules(LEARNER)
    // Back to the 20 starter questions (module 9 adds 20 more) to exercise the small-bank rule.
    await rows("UPDATE training_questions SET active = false WHERE module_id = 'm9'")
    const exam = await startExam()
    assert.equal(exam.questions.length, 20, 'the starter bank has 20 exam questions, so all are drawn')
    assert.ok(exam.questions.every((q: any) => !/^q-s[12]-/.test(q.id)), 'specialist questions never appear in the knowledge exam')
    assert.match(exam.note ?? '', /fewer than 40/)
    assert.ok(exam.questions.every((q: any) => !('correctIndex' in q) && !('explanation' in q)))
    assert.equal((await startExam()).id, exam.id, 'resumes the attempt in progress')
    // Enough questions: 40 are drawn and the pass mark is 32/40.
    for (let i = 0; i < 25; i++) await t(TEAM, 'POST', 'manage/questions', { prompt: `Extra ${i}?`, options: ['a', 'b', 'c'], correctIndex: 0, forExam: true })
    // Submit a failing attempt (everything wrong): retake window applies.
    const key = await answerKey(exam.questions.map((q) => q.id))
    const bad = await t(LEARNER, 'POST', `exam/${exam.id}/submit`, { answers: Object.fromEntries(Object.entries(key).map(([k, v]) => [k, (v + 1) % 4])) })
    assert.deepEqual([bad.body.passed, bad.body.score, bad.body.passMark], [false, 0, 16])
    assert.equal((await t(LEARNER, 'POST', `exam/${exam.id}/submit`, { answers: key })).status, 409, 'cannot resubmit')
    const retake = await t(LEARNER, 'POST', 'exam/start')
    assert.equal(retake.status, 429); assert.match(retake.body.error, /14 days/)
    // 14 days later: allowed, and now 40 questions are drawn with a pass mark of 32.
    await rows("UPDATE training_exam_attempts SET started_at = now() - interval '15 days'")
    const second = await startExam()
    assert.equal(second.questions.length, 40); assert.equal(second.note, null)
    // Time limit: an attempt submitted after 60 minutes (+ grace) is not accepted.
    await rows("UPDATE training_exam_attempts SET started_at = now() - interval '61 minutes 30 seconds', deadline = now() - interval '1 minute 30 seconds' WHERE id=$1", [second.id])
    const late = await t(LEARNER, 'POST', `exam/${second.id}/submit`, { answers: await answerKey(second.questions.map((q) => q.id)) })
    assert.equal(late.status, 409)
    assert.equal((await rows('SELECT status, passed FROM training_exam_attempts WHERE id=$1', [second.id]))[0].passed, false)
    // Three attempts a year: the third attempt is allowed after another 14 days, a fourth is not.
    await rows("UPDATE training_exam_attempts SET started_at = started_at - interval '20 days'")
    const third = await startExam()
    await t(LEARNER, 'POST', `exam/${third.id}/submit`, { answers: {} })
    await rows("UPDATE training_exam_attempts SET started_at = started_at - interval '20 days'")
    const fourth = await t(LEARNER, 'POST', 'exam/start')
    assert.equal(fourth.status, 429); assert.match(fourth.body.error, /three exam attempts/)
    assert.equal((await rows('SELECT count(*)::int n FROM training_exam_attempts'))[0].n, 3)
  })

  it('a learner cannot mark their own work, and only markers can mark', async () => {
    await makeValidator(); await finishModules(LEARNER)
    const cases = (await t(LEARNER, 'GET', 'cases')).body.cases
    assert.ok(cases.every((c: any) => !JSON.stringify(c).includes('modelAnswer')), 'model answers are for markers')
    assert.equal((await t(LEARNER, 'POST', `cases/${cases[0].id}/submit`, { text: words(10) })).status, 400, 'too short')
    const sub = (await t(LEARNER, 'POST', `cases/${cases[0].id}/submit`, { text: words(300) })).body.id
    assert.equal((await t(LEARNER, 'POST', `cases/${cases[0].id}/submit`, { text: words(300) })).status, 409, 'pending marking')
    // The learner is not a marker.
    for (const who of [LEARNER, OUTSIDER]) {
      assert.equal((await t(who, 'GET', 'marking/queue')).status, 403)
      assert.equal((await t(who, 'POST', `marking/${sub}`, { percent: 100 })).status, 403)
    }
    // Even a marker, a Lead Validator or the platform admin cannot mark their own submission.
    for (const who of [TEAM, LEAD, ADMIN]) {
      await makeValidator(who, `Marker ${who}`); await finishModules(who)
      const own = (await t(who, 'POST', `cases/${cases[1].id}/submit`, { text: words(300) })).body.id
      assert.equal((await t(who, 'POST', `marking/${own}`, { percent: 100, comment: 'great' })).status, 403, `${who} marking own work`)
      assert.equal((await t(who, 'GET', `marking/${own}`)).status, 403)
      await rows('DELETE FROM training_submissions WHERE id=$1', [own])
    }
    const queue = (await t(TEAM, 'GET', 'marking/queue')).body
    assert.equal(queue.length, 1); assert.equal(queue[0].marksNeeded, 2)
    const detail = (await t(TEAM, 'GET', `marking/${sub}`)).body
    assert.ok(detail.case.modelAnswer, 'markers see the model answer')
    assert.equal((await t(TEAM, 'POST', `marking/${sub}`, { percent: 60, comment: 'Thin on disclosure' })).body.status, 'pending')
    assert.equal((await t(TEAM, 'POST', `marking/${sub}`, { percent: 90 })).status, 409, 'one mark per marker')
    assert.equal((await t(LEARNER, 'GET', 'cases')).body.cases[0].submissions[0].feedback.length, 0, 'feedback waits for the result')
    assert.deepEqual((await t(LEAD, 'POST', `marking/${sub}`, { percent: 70 })).body, { ok: true, status: 'failed', percent: 65 }, 'the mean of 60 and 70 is below the pass mark of 70')
    const after = (await t(LEARNER, 'GET', 'cases')).body.cases[0]
    assert.equal(after.submissions[0].status, 'failed'); assert.equal(after.canSubmit, true, 'one resubmission')
    assert.deepEqual(after.submissions[0].feedback, ['Thin on disclosure'])
    assert.ok(!JSON.stringify(after).includes(TEAM), 'markers are anonymous to the learner')
  })

  it('accreditation cannot be set by any API except by passing all three parts', async () => {
    const id = await makeValidator(); await finishModules(LEARNER)
    const until = async () => (await rows('SELECT accredited_until, accreditation_status FROM validator_profiles'))[0]
    // The profile form and the admin endpoint ignore or reject accreditation fields.
    await call(LEARNER, 'PUT', 'directory/me/validator', { name: 'Lena', accreditedUntil: '2099-01-01', accreditationStatus: 'accredited', pilotAccredited: true }, directory)
    for (const who of [LEARNER, ADMIN, TEAM]) {
      for (const body of [{ status: 'accredited', reason: 'r' }, { accreditedUntil: '2099-01-01', reason: 'r' }, { pilotAccredited: true, reason: 'r' }]) {
        assert.ok([400, 403].includes((await call(who, 'PUT', `directory/admin/validators/${id}`, body, directory)).status))
      }
    }
    for (const [m, p, body] of [['PUT', 'manage/staff/x', {}], ['POST', 'renewal/complete', {}], ['PUT', 'me', { accreditedUntil: '2099-01-01' }], ['POST', 'accredit', {}]] as const) {
      const r = await t(ADMIN, m, p, body)
      assert.ok(r.status >= 400, `${m} ${p}`)
    }
    assert.deepEqual(await until(), { accredited_until: null, accreditation_status: 'registered' })
    // Parts 1 and 2 alone are not enough.
    await passExam(); await submitAndMarkCases()
    assert.equal((await until()).accredited_until, null)
    // A failed capstone does not accredit; the capstone pass does.
    const first = await submitCapstone()
    assert.equal((await t(TEAM, 'POST', `marking/${first}`, { criteria: { ...RUBRIC_ALL(3), outcome: 1 } })).body.status, 'failed', 'high total but Outcome below Meets')
    assert.equal((await until()).accredited_until, null)
    assert.equal((await t(LEARNER, 'GET', 'capstone')).body.noCaseForRetake, true, 'a retake needs a different sandbox case')
    await t(TEAM, 'POST', 'manage/capstones', { title: 'Second case', brief: 'Another fictional organisation', evidence: [], referenceScores: {}, rubric: (await rows("SELECT rubric FROM training_capstones WHERE id='riverbend'"))[0].rubric })
    const retakeCase = (await t(LEARNER, 'GET', 'capstone')).body.capstone
    assert.notEqual(retakeCase.id, 'riverbend')
    assert.equal((await t(LEARNER, 'POST', 'capstone/riverbend/submit', await capstoneBody())).status, 409, 'not the same case again')
    const second = await t(LEARNER, 'POST', `capstone/${retakeCase.id}/submit`, await capstoneBody())
    assert.equal(second.status, 201)
    const before = Date.now()
    assert.equal((await t(TEAM, 'POST', `marking/${second.body.id}`, { criteria: RUBRIC_ALL(2), comment: '12/18 is not enough' })).body.status, 'failed')
    assert.equal((await rows('SELECT status FROM training_submissions WHERE id=$1', [second.body.id]))[0].status, 'failed')
    assert.equal((await t(LEARNER, 'POST', `capstone/${retakeCase.id}/submit`, await capstoneBody())).status, 409, 'two attempts at most')
    assert.equal((await until()).accredited_until, null)
    // Pass the capstone (re-open as if a fresh attempt): 13+ and Meets on Independence and Outcome.
    await rows("UPDATE training_submissions SET status='pending' WHERE id=$1", [second.body.id]); await rows('DELETE FROM training_marks WHERE submission_id=$1', [second.body.id])
    const pass = await t(LEAD, 'POST', `marking/${second.body.id}`, { criteria: { ...RUBRIC_ALL(2), scoring: 3, evidence: 3, outcome: 3 }, comment: 'Solid' })
    assert.deepEqual([pass.body.status, pass.body.percent], ['passed', 83.3])
    const row = await until()
    const got = new Date(row.accredited_until).getTime()
    const oneYear = 365 * 86_400_000
    assert.ok(Math.abs(got - (before + oneYear)) < 3 * 86_400_000 && got > before + 360 * 86_400_000, 'accredited_until is now + 1 year')
    assert.equal(row.accreditation_status, 'accredited')
    assert.equal((await rows("SELECT actor, action FROM audit_logs WHERE category='Accreditation' AND actor='training programme'")).length, 1)
    // Passing again never re-grants or moves the date.
    await t(LEARNER, 'GET', 'me')
    assert.equal(new Date((await until()).accredited_until).getTime(), got)
  })

  it('passing makes the validator accredited and the directory shows the badges', async () => {
    const id = await makeValidator(); await finishModules(LEARNER)
    await call(LEARNER, 'POST', 'directory/me/credentials', { body: 'ICAN', membershipNumber: '1' }, directory)
    assert.equal((await call(OTHER, 'GET', `directory/validators/${id}`, undefined, directory)).body.accreditation, 'registered')
    await passExam(); await submitAndMarkCases()
    const cap = await submitCapstone()
    assert.equal((await t(TEAM, 'POST', `marking/${cap}`, { criteria: RUBRIC_ALL(3), comment: 'Excellent' })).body.status, 'passed')
    // Calibration, rung challenge and conflict spotter badges come from the learning record.
    const drill = (await t(LEARNER, 'GET', 'drill')).body.items
    assert.equal(drill.length, 10)
    const refs = Object.fromEntries((await rows('SELECT id, reference_score FROM training_calibration_items')).map((r: any) => [r.id, r.reference_score]))
    const drilled = await t(LEARNER, 'POST', 'modules/m2/try/1', { answers: Object.fromEntries(drill.map((i: any) => [i.id, refs[i.id]])) })
    assert.equal(drilled.body.pct, 100)

    const profile = (await call(OTHER, 'GET', `directory/validators/${id}`, undefined, directory)).body
    assert.equal(profile.accreditation, 'accredited')
    assert.equal(profile.level, 'Validator')
    assert.ok(new Date(profile.accreditedUntil).getTime() > Date.now() + 360 * 86_400_000)
    assert.deepEqual(profile.badges.map((b: any) => b.key).sort(), ['calibrated', 'riverbend-solved'])
    const found = (await call(OTHER, 'GET', 'directory/search?type=validators', undefined, directory)).body
    assert.equal(found[0].accreditation, 'accredited')
    assert.ok(found[0].badges.length === 2, 'badges show on search cards too')
    assert.ok(!JSON.stringify(profile).includes('reference'), 'no reference scores on public profiles')
    // Expiry: past accredited_until the profile shows lapsed with no accreditation.
    await rows("UPDATE validator_profiles SET accredited_until = now() - interval '1 day'")
    const lapsed = (await call(OTHER, 'GET', `directory/validators/${id}`, undefined, directory)).body
    assert.deepEqual([lapsed.accreditation, lapsed.level], ['lapsed', 'Associate'])
  })

  it('renews yearly: videos, CPD, calibration drill and declaration extend accredited_until by a year', async () => {
    const id = await makeValidator(); await finishModules(LEARNER)
    const base = Date.now()
    // Accredited 11 months ago... expires in 30 days: renewal is open.
    await rows("UPDATE validator_profiles SET accredited_until = now() + interval '30 days', accreditation_status='accredited'")
    await rows("UPDATE training_progress SET completed_at = now() - interval '13 months'")
    const state = (await t(LEARNER, 'GET', 'renewal')).body
    assert.equal(state.ready, false); assert.equal(state.open, true)
    assert.equal(state.items.find((i: any) => i.key === 'videos').detail, '0 of 9 done', 'last year’s watching does not count')
    assert.equal((await t(LEARNER, 'POST', 'renewal/complete')).status, 409)
    for (const m of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9']) assert.equal((await t(LEARNER, 'POST', `modules/${m}/watch`)).status, 200)
    assert.equal((await t(LEARNER, 'POST', 'renewal/complete')).status, 409, 'CPD, drill and declaration are still missing')
    assert.equal((await t(LEARNER, 'POST', 'renewal/cpd', { hours: 5, activity: 'ACCA CPD', occurredOn: '2026-09-01' })).status, 201)
    assert.equal((await t(LEARNER, 'POST', 'renewal/cpd', { hours: 30, activity: 'x', occurredOn: '2026-09-01' })).status, 400)
    const cpdId = (await t(LEARNER, 'POST', 'renewal/cpd', { hours: 3, activity: 'CRAFT cohort call', occurredOn: '2026-09-15' })).body.id
    await makeValidator(OTHER, 'Omar')
    assert.equal((await t(OTHER, 'DELETE', `renewal/cpd/${cpdId}`)).status, 404, 'only the owner deletes a CPD entry')
    const drill = (await t(LEARNER, 'GET', 'drill')).body.items
    const refs = Object.fromEntries((await rows('SELECT id, reference_score FROM training_calibration_items')).map((r: any) => [r.id, r.reference_score]))
    const low = await t(LEARNER, 'POST', 'renewal/drill', { answers: Object.fromEntries(drill.map((i: any) => [i.id, (refs[i.id] + 3) % 6])) })
    assert.equal(low.body.passed, false)
    assert.equal((await t(LEARNER, 'POST', 'renewal/drill', { answers: Object.fromEntries(drill.slice(0, 3).map((i: any) => [i.id, refs[i.id]])) })).status, 400, 'all ten indicators')
    assert.equal((await t(LEARNER, 'POST', 'renewal/drill', { answers: Object.fromEntries(drill.map((i: any) => [i.id, refs[i.id]])) })).body.passed, true)
    assert.equal((await t(LEARNER, 'POST', 'renewal/declaration', { confirm: true, clients: '' })).status, 400)
    assert.equal((await t(LEARNER, 'POST', 'renewal/declaration', { confirm: true, clients: 'None' })).status, 201)
    const done = await t(LEARNER, 'POST', 'renewal/complete')
    assert.equal(done.status, 200, done.text)
    const days = (new Date(done.body.until).getTime() - base) / 86_400_000
    assert.ok(days > 394 && days < 396, `extends the old expiry (30 days out) by a year, got ${days}`)
    assert.equal((await rows("SELECT count(*)::int n FROM audit_logs WHERE category='Accreditation' AND action LIKE 'accreditation renewed%'"))[0].n, 1)
    // The new year starts clean: nothing is carried over.
    const next = (await t(LEARNER, 'GET', 'renewal')).body
    assert.equal(next.ready, false); assert.equal(next.open, false, 'renewal opens 60 days before expiry')
    assert.equal((await t(LEARNER, 'POST', 'renewal/complete')).status, 409)
    // A suspended validator cannot renew.
    await call(ADMIN, 'PUT', `directory/admin/validators/${id}`, { status: 'suspended', reason: 'Complaint upheld' }, directory)
    assert.equal((await t(LEARNER, 'POST', 'renewal/complete')).status, 403)
  })

  it('shows a firm owner which team members have lapsed', async () => {
    await makeValidator(); await makeValidator(OTHER, 'Omar Diallo')
    const firm = await call(LEARNER, 'POST', 'firms', { name: 'Wanjiru & Co', kind: 'validator_firm', nature: 'Audit firm' }, firmsApi)
    assert.equal(firm.status, 201)
    await call(LEARNER, 'PUT', 'firms', { firmId: firm.body.id, email: OTHER }, firmsApi)
    await call(OTHER, 'PUT', 'firms', { firmId: firm.body.id, email: OTHER, status: 'active' }, firmsApi)
    await rows("UPDATE validator_profiles SET accredited_until = now() + interval '200 days', accreditation_status='accredited' WHERE email=$1", [LEARNER])
    await rows("UPDATE validator_profiles SET accredited_until = now() - interval '5 days', accreditation_status='accredited' WHERE email=$1", [OTHER])
    const team = await t(LEARNER, 'GET', `firm/${firm.body.id}/team`)
    assert.equal(team.status, 200)
    assert.equal(team.body.lapsed, 1)
    assert.deepEqual(team.body.team.map((m: any) => [m.name, m.state, m.lapsed]).sort(), [['Lena Wanjiru', 'accredited', false], ['Omar Diallo', 'lapsed', true]])
    // Only the owner sees it; a member or outsider does not.
    assert.equal((await t(OTHER, 'GET', `firm/${firm.body.id}/team`)).status, 403)
    assert.equal((await t(OUTSIDER, 'GET', `firm/${firm.body.id}/team`)).status, 403)
    // The state is recorded per member on their own profile.
    assert.equal((await rows("SELECT count(*)::int n FROM validator_profiles WHERE accredited_until IS NOT NULL"))[0].n, 2)
  })
})
