// Self-check for the Telegram bot's commands and the quick screen as a chat.
import assert from 'node:assert/strict'
import { applyScreenAnswer, clip, nextScreenStep, parseCommand } from './telegramBot.ts'
import type { QuickScreen } from './cca/quickScreen.ts'

assert.deepEqual(parseCommand('/start ABC123'), { name: 'start', arg: 'ABC123' })
assert.deepEqual(parseCommand('/ask@CraftBot How do we run a tender?'), { name: 'ask', arg: 'How do we run a tender?' })
assert.deepEqual(parseCommand('How do we run a tender?'), { name: 'ask', arg: 'How do we run a tender?' }, 'plain text is a question')
assert.equal(parseCommand('/delete_everything').name, 'unknown')

const screen: QuickScreen = { name: 'Quick screen', sections: [{ id: 's', name: 'S', questions: [
  { id: 'q1', text: 'Do you have audited accounts?', kind: 'yes_no' },
  { id: 'q2', text: 'How many staff manage finance?', kind: 'choice', options: [{ value: 'none', label: 'None', points: 0 }, { value: 'two', label: 'Two or more', points: 2 }] },
] }] }
let state = { answers: {} }
let step = nextScreenStep(screen, state)
assert.ok(!step.done && step.text.startsWith('1/2.') && step.buttons[0][0].callback_data === 's:0:0')
assert.equal(applyScreenAnswer(screen, state, 's:0:9'), null, 'unknown option')
assert.equal(applyScreenAnswer(screen, state, 'x'), null)
state = applyScreenAnswer(screen, state, 's:0:0')!
assert.equal(applyScreenAnswer(screen, state, 's:0:1'), null, 'an answered question cannot be pressed again')
state = applyScreenAnswer(screen, state, 's:1:1')!
step = nextScreenStep(screen, state)
assert.ok(step.done && /Eligible, with minimal support \(100%\)/.test(step.text) && /not saved/.test(step.text))
assert.ok(clip('x'.repeat(5000)).length <= 3500)
console.log('telegramBot ok')
