// CRAFT on Telegram: a low-bandwidth channel for people who mostly use a phone. Plain short messages, buttons instead of
// typing, nothing heavier than text. What it does (netlify/functions/telegram.mts):
//   /start CODE   link this chat to a CRAFT account (the code comes from Settings → Telegram, valid 15 minutes)
//   /ask …        a question: approved guidance if the library covers it, otherwise a CRAFT expert answers here
//   /screen       the quick pre-award screen, one question at a time (self-reported, not saved as a record)
//   /status       what is waiting: draft assessments and expert answers
//   /stop         unlink this chat
// Notices CRAFT already emails (validation reminders, debriefs) are also sent to linked chats.
// Self-check: `node src/lib/telegramBot.test.ts`.
import { OUTCOME_LABEL, OUTCOME_NEXT, scoreScreen, type QuickScreen, type ScreenAnswers } from './cca/quickScreen.ts'

export type Command = { name: 'start' | 'ask' | 'screen' | 'status' | 'stop' | 'help'; arg: string } | { name: 'unknown'; arg: string }

export function parseCommand(text: string): Command {
  const m = /^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/.exec(text.trim())
  if (!m) return { name: 'ask', arg: text.trim() } // plain text is a question
  const name = m[1].toLowerCase()
  return ['start', 'ask', 'screen', 'status', 'stop', 'help'].includes(name) ? { name: name as Exclude<Command['name'], 'unknown'>, arg: m[2].trim() } : { name: 'unknown', arg: m[2].trim() }
}

export const HELP = [
  'CRAFT on Telegram',
  '/ask your question — guidance from approved CRAFT templates, or a CRAFT expert replies here',
  '/screen — the quick pre-award readiness screen (about 5 minutes)',
  '/status — what is waiting for you',
  '/stop — unlink this chat',
].join('\n')

export type Button = { text: string; callback_data: string }

/** The quick screen as a chat: where it is, the next question and its buttons, or the result when done. */
export type ScreenState = { answers: ScreenAnswers }
export function nextScreenStep(s: QuickScreen, state: ScreenState): { done: false; text: string; buttons: Button[][] } | { done: true; text: string } {
  const questions = s.sections.flatMap((sec) => sec.questions)
  const i = questions.findIndex((q) => state.answers[q.id] === undefined)
  if (i < 0) {
    const result = scoreScreen(s, state.answers)
    return { done: true, text: `Result: ${OUTCOME_LABEL[result.outcome]} (${result.percent}%).\n${OUTCOME_NEXT[result.outcome]}\n\nThis is self-reported and not saved. To record it for an award, use the quick screen in CRAFT.` }
  }
  const q = questions[i]
  const options = q.kind === 'yes_no' ? [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] : q.options
  // callback_data is limited to 64 bytes: send the question's position and the option's position, not ids.
  return { done: false, text: `${i + 1}/${questions.length}. ${q.text}`, buttons: options.map((o, j) => [{ text: o.label, callback_data: `s:${i}:${j}` }]) }
}

/** Apply a button press ("s:<question>:<option>") to the screen; null when it is stale or invalid. */
export function applyScreenAnswer(s: QuickScreen, state: ScreenState, data: string): ScreenState | null {
  const m = /^s:(\d+):(\d+)$/.exec(data)
  if (!m) return null
  const questions = s.sections.flatMap((sec) => sec.questions)
  const q = questions[Number(m[1])]
  if (!q || state.answers[q.id] !== undefined) return null
  const options = q.kind === 'yes_no' ? ['yes', 'no'] : q.options.map((o) => o.value)
  const value = options[Number(m[2])]
  return value === undefined ? null : { answers: { ...state.answers, [q.id]: value } }
}

/** Telegram messages are capped at 4096 characters; keep notices short and cut cleanly. */
export const clip = (text: string, max = 3500) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`)
