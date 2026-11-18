import assert from 'node:assert/strict'
import { readAnswers } from './offlineWorkbook.ts'

const known = new Set(['CRAFT-ONC-01', 'GOV-01'])
const r = (code: unknown, score: unknown, notes: unknown = '', row = 2) => ({ sheet: 'S', row, code, score, notes })

const ok = readAnswers([r('CRAFT-ONC-01', 3, 'Minutes seen'), r('GOV-01', '0'), r('', 4), r('CRAFT-ONC-01 ', ' 2 ')], known)
assert.deepEqual(ok.scores, { 'CRAFT-ONC-01': 2, 'GOV-01': 0 }, 'trimmed; later row wins; blank code skipped')
assert.deepEqual(ok.notes, { 'CRAFT-ONC-01': 'Minutes seen' })
assert.deepEqual(ok.problems, [])

const blank = readAnswers([r('GOV-01', ''), r('GOV-01', null)], known)
assert.deepEqual(blank.scores, {}, 'a blank score is not an answer')

const bad = readAnswers([r('XYZ-9', 3, '', 5), r('GOV-01', 6, '', 6), r('GOV-01', 2.5, '', 7), r('GOV-01', 'yes', '', 8), r('GOV-01', 1, 'x'.repeat(2001), 9)], known)
assert.equal(bad.problems.length, 5)
assert.match(bad.problems[0], /S, row 5 \(XYZ-9\): not a question/)
assert.match(bad.problems[1], /row 6 .*whole number from 0 to 5/)
console.log('offlineWorkbook.test.ts: all assertions passed')
