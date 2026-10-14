// Self-check — run directly with `node src/lib/plan-graph.test.ts`.
import assert from 'node:assert/strict'
import { analysePlan, findCycle, layers, type PlanTask } from './plan-graph.ts'

const t = (id: number, o: Partial<PlanTask> = {}): PlanTask => ({ id, label: `T${id}`, workstream: '', status: 'not_started', start: null, end: null, dependsOn: [], budgetEstimate: null, budgetActual: null, budgetCurrency: '', ...o })
const tasks = [
  t(1, { workstream: 'Governance', status: 'completed', start: '2026-11-01', end: '2026-11-30', budgetEstimate: 1000, budgetActual: 1200, budgetCurrency: 'NGN' }),
  t(2, { workstream: 'Data', status: 'in_progress', start: '2026-11-15', end: '2027-01-31', dependsOn: [1, 3], budgetEstimate: 5000, budgetCurrency: 'NGN' }),
  t(3, { workstream: 'Data', start: '2026-12-01', end: '2026-12-20' }),
  t(4, { workstream: 'Governance', start: '2027-02-01', end: '2027-03-31', dependsOn: [2], budgetEstimate: 200, budgetCurrency: 'USD' }),
]

// Cycles are refused, with the path.
assert.deepEqual(findCycle(tasks, 1, [4]), [1, 4, 2, 1])
assert.equal(findCycle(tasks, 3, [1]), null)
assert.ok(findCycle(tasks, 2, [2]), 'self-dependency is a cycle')

assert.deepEqual([...layers(tasks).entries()].sort(), [[1, 0], [2, 1], [3, 0], [4, 2]])

const a = analysePlan(tasks)
assert.deepEqual(a.conflicts.map((c) => [c.taskId, c.dependsOn]).sort(), [[2, 1], [2, 3]], 'task 2 starts before 1 and 3 end')
assert.deepEqual(a.blocked, [{ taskId: 2, waitingOn: [3] }])
assert.deepEqual(a.criticalPath.taskIds, [1, 2, 4])
const gov = a.workstreams.find((w) => w.name === 'Governance')!
assert.equal(gov.percent, 50)
assert.deepEqual(gov.currencies.sort(), ['NGN', 'USD'])
assert.deepEqual(a.totals.find((x) => x.currency === 'NGN'), { currency: 'NGN', estimate: 6000, actual: 1200, variance: -4800 })
assert.equal(a.unbudgeted, 1)
console.log('plan-graph.test.ts: all assertions passed')
