// Self-check — run directly with `node netlify/lib/cap-tools.test.ts`.
import assert from 'node:assert/strict'
import { escalationFor, findDuplicateGroups, maxSeverity, similarity, type CapLike } from './cap-tools.ts'

const cap = (id: number, o: Partial<CapLike> = {}): CapLike => ({ id, status: 'open', severity: 'medium', dueDate: null, findingDescription: `Finding ${id}`, sourceType: 'manual', sourceId: null, ...o })

// Escalation by severity and days overdue.
assert.deepEqual(escalationFor(cap(1, { severity: 'critical', dueDate: '2026-10-14' }), '2026-10-15'), { level: 1, reason: 'critical CAP 1 day(s) overdue' })
assert.equal(escalationFor(cap(1, { severity: 'critical', dueDate: '2026-09-01' }), '2026-10-15').level, 3)
assert.equal(escalationFor(cap(1, { severity: 'high', dueDate: '2026-10-05' }), '2026-10-15').level, 0, 'high escalates after 14 days')
assert.equal(escalationFor(cap(1, { severity: 'high', dueDate: '2026-09-01' }), '2026-10-15').level, 2)
assert.equal(escalationFor(cap(1, { severity: 'low', dueDate: '2026-01-01' }), '2026-10-15').level, 3)
assert.equal(escalationFor(cap(1, { status: 'completed', dueDate: '2026-01-01' }), '2026-10-15').level, 0)
assert.equal(escalationFor(cap(1, { status: 'merged', dueDate: '2026-01-01' }), '2026-10-15').level, 0)
assert.deepEqual(escalationFor(cap(1, { status: 'completed', effectivenessStatus: 'not_effective' }), '2026-10-15'), { level: 1, reason: 'Effectiveness review found the action not effective' })

// Duplicates: same source, or similar text; completed and merged CAPs are ignored.
assert.ok(similarity('Board minutes are not signed or filed', 'Board minutes not signed and not filed') >= 0.6)
assert.ok(similarity('Board minutes are not signed', 'Procurement plan missing') < 0.2)
const groups = findDuplicateGroups([
  cap(1, { findingDescription: 'Board minutes are not signed or filed on time' }),
  cap(2, { findingDescription: 'Board minutes not signed and not filed on time' }),
  cap(3, { findingDescription: 'Procurement plan missing', sourceType: 'governance_finding', sourceId: 9 }),
  cap(4, { findingDescription: 'No approved procurement plan for FY2026', sourceType: 'governance_finding', sourceId: 9 }),
  cap(5, { findingDescription: 'Board minutes are not signed or filed on time', status: 'completed' }),
  cap(6, { findingDescription: 'Unrelated cyber risk register gap' }),
])
assert.deepEqual(groups.map((g) => g.ids), [[1, 2], [3, 4]])
assert.match(groups[1].reason, /same governance finding #9/)
assert.equal(maxSeverity(['medium', 'critical', 'high']), 'critical')
console.log('cap-tools.test.ts: all assertions passed')
