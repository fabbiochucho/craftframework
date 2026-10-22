// Self-check — run directly with `node src/lib/survey.test.ts`.
import assert from 'node:assert/strict'
import { average, npsBand, npsSummary, npsTrend, parseSurveyAnswer } from './survey.ts'
import { badgeFileName, renderBadgeSvg, wrapName } from './memberBadge.ts'

const ok = { nps: 9, ease: 4, usedMost: ['Reports', 'Data Room', 'Reports'], improve: '  Faster uploads  ', wantsCall: true, callTimes: ' Tue mornings ' }
const parsed = parseSurveyAnswer(ok)
assert.ok(parsed.ok)
assert.deepEqual(parsed.ok && parsed.answer, { nps: 9, ease: 4, usedMost: ['Reports', 'Data Room'], improve: 'Faster uploads', wantsCall: true, callTimes: 'Tue mornings' })
// "No" to the call drops any preferred times.
assert.equal(parseSurveyAnswer({ ...ok, wantsCall: false }).ok && (parseSurveyAnswer({ ...ok, wantsCall: false }) as any).answer.callTimes, '')
// Optional: used-most and improve.
assert.ok(parseSurveyAnswer({ nps: 0, ease: 1, wantsCall: false }).ok)
for (const bad of [null, 'x', {}, { ...ok, nps: -1 }, { ...ok, nps: 11 }, { ...ok, nps: 7.5 }, { ...ok, nps: '9' }, { ...ok, ease: 0 }, { ...ok, ease: 6 }, { ...ok, ease: undefined },
  { ...ok, usedMost: ['Nothing'] }, { ...ok, usedMost: 'Reports' }, { ...ok, improve: 'x'.repeat(1001) }, { ...ok, improve: 5 }, { ...ok, wantsCall: 'yes' }, { ...ok, wantsCall: undefined }, { ...ok, callTimes: 'x'.repeat(301) }]) {
  assert.equal(parseSurveyAnswer(bad).ok, false, JSON.stringify(bad))
}
assert.ok(parseSurveyAnswer({ ...ok, improve: 'x'.repeat(1000) }).ok, '1000 characters is allowed')

// NPS: promoters 9-10, passives 7-8, detractors 0-6.
assert.deepEqual([0, 6, 7, 8, 9, 10].map(npsBand), ['detractor', 'detractor', 'passive', 'passive', 'promoter', 'promoter'])
assert.deepEqual(npsSummary([]), { responses: 0, promoters: 0, passives: 0, detractors: 0, score: null })
assert.deepEqual(npsSummary([10, 9, 9, 8, 7, 6, 3, 10]), { responses: 8, promoters: 4, passives: 2, detractors: 2, score: 25 })
assert.equal(npsSummary([10, 10]).score, 100)
assert.equal(npsSummary([0, 5]).score, -100)
assert.equal(npsSummary([9, 8, 8]).score, 33)
assert.deepEqual(npsTrend([{ at: new Date('2026-03-02T00:00:00Z'), nps: 10 }, { at: new Date('2026-02-20T00:00:00Z'), nps: 2 }, { at: new Date('2026-03-15T00:00:00Z'), nps: 8 }]).map((m) => [m.month, m.score]), [['2026-02', -100], ['2026-03', 50]])
assert.equal(average([4, 5, 3]), 4)
assert.equal(average([]), null)

// Badge: self-contained SVG with the organisation and year, escaped.
const svg = renderBadgeSvg({ orgName: 'Riverbend <Co> & Sons', year: 2026 })
assert.ok(svg.startsWith('<svg') && svg.includes('Member since 2026') && svg.includes('Riverbend &lt;Co&gt; &amp; Sons'))
assert.ok(!/(href|src)=|https?:\/\/(?!www\.w3\.org)/.test(svg), 'no external references')
assert.ok(renderBadgeSvg({ orgName: '', year: 2026 }).includes('Your organisation'))
assert.deepEqual(wrapName('Short Name'), ['Short Name'])
assert.equal(wrapName('The Very Long Named Association for Sustainable Rural Development Initiatives in Africa').length, 2)
assert.ok(wrapName('The Very Long Named Association for Sustainable Rural Development Initiatives in Africa').every((l) => l.length <= 30))
assert.equal(badgeFileName('Riverbend Co-op!', 2026), 'craft-member-since-2026-riverbend-co-op')
console.log('survey.test.ts ok')
