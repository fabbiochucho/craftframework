// Self-check — run directly with `node src/lib/milestones.test.ts`.
import assert from 'node:assert/strict'
import { canApprove, nextStatuses, packGaps, registerSummary, type EvidenceItem, type Milestone } from './milestones.ts'

const m: Milestone = { id: 'm1', title: 'Clinic opened', owner: 'Programme lead', indicator: 'Clinics operating', baseline: '0', target: '3', verificationMeans: 'Licence and first-month register', dueDate: '2026-12-01', status: 'planned', approvedBy: null }
const ev: EvidenceItem[] = [{ id: 'e1', milestoneId: 'm1', description: 'Operating licence', ref: 'https://drive.example/licence', addedBy: 'amina@org.example' }]

assert.deepEqual(packGaps({ ...m, baseline: ' ' }, []), ['No baseline', 'No evidence in the verification pack'])
assert.deepEqual(packGaps(m, ev), [])
assert.deepEqual(packGaps(m, [{ ...ev[0], ref: '' }]), ['An evidence item has no description or location'])
assert.deepEqual(packGaps(m, [{ ...ev[0], milestoneId: 'other' }]), ['No evidence in the verification pack'], 'evidence must be indexed to this milestone')

assert.equal(canApprove(m, ev, 'AMINA@org.example').ok, false, 'the person who added evidence cannot approve it')
assert.equal(canApprove(m, ev, 'musa@org.example').ok, true)
assert.equal(canApprove({ ...m, status: 'submitted' }, ev, 'musa@org.example').ok, false)
assert.equal(canApprove({ ...m, status: 'rejected' }, ev, 'musa@org.example').ok, true, 'returned milestones can be re-approved')

assert.deepEqual(nextStatuses('submitted'), ['accepted', 'rejected'])
assert.deepEqual(nextStatuses('accepted'), [])

const s = registerSummary([m, { ...m, id: 'm2', status: 'accepted', dueDate: '2026-01-01' }, { ...m, id: 'm3', dueDate: '2026-01-01' }], '2026-11-06')
assert.deepEqual([s.byStatus.planned, s.byStatus.accepted, s.overdue], [2, 1, ['m3']])
console.log('milestones.test.ts: all assertions passed')
