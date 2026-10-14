// Planner analysis: workstreams, task dependencies and budgets for implementation plans.
// Pure functions shared by the API (validation, roadmap analysis) and the UI (dependency graph).
// Self-check: `node src/lib/plan-graph.test.ts`.

export interface PlanTask {
  id: number
  label: string
  workstream: string
  status: string // 'not_started' | 'in_progress' | 'completed'
  start: string | null
  end: string | null
  dependsOn: number[]
  budgetEstimate: number | null
  budgetActual: number | null
  budgetCurrency: string
}

/** Would adding these dependencies to `taskId` create a cycle? Returns the cycle path if so. */
export function findCycle(tasks: Pick<PlanTask, 'id' | 'dependsOn'>[], taskId: number, dependsOn: number[]): number[] | null {
  const deps = new Map(tasks.map((t) => [t.id, t.id === taskId ? dependsOn : t.dependsOn]))
  if (!deps.has(taskId)) deps.set(taskId, dependsOn)
  // DFS from each new dependency looking for a path back to taskId.
  const walk = (node: number, path: number[], seen: Set<number>): number[] | null => {
    if (node === taskId) return [...path, node]
    if (seen.has(node)) return null
    seen.add(node)
    for (const next of deps.get(node) ?? []) { const p = walk(next, [...path, node], seen); if (p) return p }
    return null
  }
  for (const d of dependsOn) { const p = walk(d, [taskId], new Set()); if (p) return p }
  return null
}

const days = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000))

/** Depth of each task in the dependency graph (0 = no dependencies); assumes no cycles. */
export function layers(tasks: PlanTask[]): Map<number, number> {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const depth = new Map<number, number>()
  const visit = (id: number, guard: Set<number>): number => {
    if (depth.has(id)) return depth.get(id)!
    if (guard.has(id)) return 0
    guard.add(id)
    const ds = (byId.get(id)?.dependsOn ?? []).filter((d) => byId.has(d))
    const v = ds.length ? Math.max(...ds.map((d) => visit(d, guard) + 1)) : 0
    depth.set(id, v)
    return v
  }
  for (const t of tasks) visit(t.id, new Set())
  return depth
}

export interface PlanAnalysis {
  workstreams: { name: string; tasks: number; completed: number; percent: number; budgetEstimate: number; budgetActual: number; variance: number; currencies: string[] }[]
  conflicts: { taskId: number; dependsOn: number; message: string }[]
  blocked: { taskId: number; waitingOn: number[] }[]
  criticalPath: { taskIds: number[]; days: number }
  totals: { currency: string; estimate: number; actual: number; variance: number }[]
  unbudgeted: number
}

export function analysePlan(tasks: PlanTask[]): PlanAnalysis {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const conflicts: PlanAnalysis['conflicts'] = []
  const blocked: PlanAnalysis['blocked'] = []
  for (const t of tasks) {
    const deps = t.dependsOn.map((d) => byId.get(d)).filter((d): d is PlanTask => !!d)
    for (const d of deps) {
      if (t.start && d.end && t.start < d.end) conflicts.push({ taskId: t.id, dependsOn: d.id, message: `${t.label} starts ${t.start}, before ${d.label} ends ${d.end}` })
    }
    const waiting = deps.filter((d) => d.status !== 'completed').map((d) => d.id)
    if (waiting.length && t.status !== 'not_started' && t.status !== 'completed') blocked.push({ taskId: t.id, waitingOn: waiting })
  }

  // Critical path: longest chain by duration through the dependency graph.
  const dur = (t: PlanTask) => (t.start && t.end ? days(t.start, t.end) : 1)
  const best = new Map<number, { total: number; path: number[] }>()
  const longest = (id: number, guard: Set<number>): { total: number; path: number[] } => {
    if (best.has(id)) return best.get(id)!
    const t = byId.get(id)!
    if (guard.has(id)) return { total: dur(t), path: [id] }
    guard.add(id)
    let top = { total: 0, path: [] as number[] }
    for (const d of t.dependsOn.filter((x) => byId.has(x))) { const p = longest(d, guard); if (p.total > top.total) top = p }
    const res = { total: top.total + dur(t), path: [...top.path, id] }
    best.set(id, res)
    return res
  }
  let critical = { total: 0, path: [] as number[] }
  for (const t of tasks) { const p = longest(t.id, new Set()); if (p.total > critical.total) critical = p }

  const groups = new Map<string, PlanTask[]>()
  for (const t of tasks) groups.set(t.workstream || 'Unassigned', [...(groups.get(t.workstream || 'Unassigned') ?? []), t])
  const sum = (xs: (number | null)[]) => Math.round(xs.reduce<number>((a, x) => a + (x ?? 0), 0) * 100) / 100
  const workstreams = [...groups.entries()].map(([name, ts]) => {
    const completed = ts.filter((t) => t.status === 'completed').length
    const est = sum(ts.map((t) => t.budgetEstimate)), act = sum(ts.map((t) => t.budgetActual))
    return { name, tasks: ts.length, completed, percent: Math.round((completed / ts.length) * 100), budgetEstimate: est, budgetActual: act, variance: Math.round((act - est) * 100) / 100,
      currencies: [...new Set(ts.filter((t) => t.budgetEstimate !== null || t.budgetActual !== null).map((t) => t.budgetCurrency || '—'))] }
  }).sort((a, b) => a.name.localeCompare(b.name))
  const cur = new Map<string, PlanTask[]>()
  for (const t of tasks.filter((x) => x.budgetEstimate !== null || x.budgetActual !== null)) cur.set(t.budgetCurrency || '—', [...(cur.get(t.budgetCurrency || '—') ?? []), t])
  const totals = [...cur.entries()].map(([currency, ts]) => {
    const estimate = sum(ts.map((t) => t.budgetEstimate)), actual = sum(ts.map((t) => t.budgetActual))
    return { currency, estimate, actual, variance: Math.round((actual - estimate) * 100) / 100 }
  })
  return { workstreams, conflicts, blocked, criticalPath: { taskIds: critical.path, days: critical.total }, totals, unbudgeted: tasks.filter((t) => t.budgetEstimate === null).length }
}
