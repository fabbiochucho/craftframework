// Self-check — run directly with `node src/lib/supportTickets.test.ts`.
import assert from 'node:assert/strict'
import { defaultDue, describeChanges, inboxOrder, isOverdue, matchesSearch, type TicketSummary } from './supportTickets.ts'

const now = new Date('2026-11-04T12:00:00Z')
assert.equal(defaultDue('urgent', now).toISOString(), '2026-11-05T12:00:00.000Z')
assert.equal(defaultDue('low', now).toISOString(), '2026-11-14T12:00:00.000Z')

const past = '2026-11-01T00:00:00Z'
assert.equal(isOverdue({ status: 'open', dueAt: past }, now), true)
assert.equal(isOverdue({ status: 'waiting', dueAt: past }, now), false, 'waiting on them is not our overdue')
assert.equal(isOverdue({ status: 'resolved', dueAt: past }, now), false)
assert.equal(isOverdue({ status: 'new', dueAt: null }, now), false)

const t = (id: number, over: Partial<TicketSummary>): TicketSummary => ({
  id, subject: `Ticket ${id}`, source: 'email', contactName: '', contactEmail: '', organisation: '', category: 'question',
  priority: 'normal', status: 'open', dueAt: '2026-11-09T00:00:00Z', createdAt: past, updatedAt: past, ...over,
})
const list = [
  t(1, { status: 'closed', updatedAt: '2026-11-03T00:00:00Z' }),
  t(2, { priority: 'low' }),
  t(3, { priority: 'urgent' }),
  t(4, { dueAt: past }), // overdue
  t(5, { status: 'resolved', updatedAt: '2026-11-04T00:00:00Z' }),
]
assert.deepEqual(list.sort(inboxOrder(now)).map((x) => x.id), [4, 3, 2, 5, 1])

const rec = { id: 42, subject: 'Cannot upload evidence', contactName: 'Amina Okoro', contactEmail: 'amina@riverbend.example', organisation: 'Riverbend' }
assert.ok(matchesSearch(rec, 'upload'))
assert.ok(matchesSearch(rec, 'RIVERBEND'))
assert.ok(matchesSearch(rec, '#42'))
assert.ok(!matchesSearch(rec, '4'), 'a number searches ticket ids exactly')
assert.ok(matchesSearch(rec, '  '))

assert.equal(describeChanges({ status: 'new', priority: 'normal' }, { status: 'waiting', priority: 'normal' }), 'Status: New → Waiting on them')
assert.equal(describeChanges({ dueAt: null }, { dueAt: '2026-11-10T00:00:00.000Z' }), 'Due: (none) → 2026-11-10')
assert.equal(describeChanges({ category: 'bug' }, { category: 'bug' }), '')

console.log('supportTickets.test.ts: all assertions passed')
