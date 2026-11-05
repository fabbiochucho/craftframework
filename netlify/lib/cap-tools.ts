// Corrective-action helpers: escalation rules and duplicate detection.
// Self-check: `node netlify/lib/cap-tools.test.ts`.
import { band, RISK_CATEGORIES, RISK_CATEGORY_LABEL, scoreOf } from '../../src/lib/riskMatrix.ts'

export const ESCALATION_LEVELS = ['None', 'Workspace admins', 'Organisation owner / executive', 'Board or governing body'] as const
// Days overdue at which each level is reached, by severity. Critical items escalate fastest.
export const ESCALATION_RULES: Record<string, [number, number, number]> = {
  critical: [1, 14, 30],
  high: [14, 30, 60],
  medium: [30, 60, 90],
  low: [60, 90, 120],
}

export interface CapLike {
  id: number; status: string; severity: string; dueDate: string | null; effectivenessStatus?: string; escalationLevel?: number; findingDescription: string; sourceType: string; sourceId: number | null
  // Finding risk (src/lib/riskMatrix.ts): residual rating, falling back to inherent; escalation category.
  inherentLikelihood?: number | null; inherentImpact?: number | null; residualLikelihood?: number | null; residualImpact?: number | null; riskCategory?: string
}

/**
 * The level the finding's risk calls for: High → 1 (workspace admins), Critical → 2 (owner / executive); a statutory,
 * fiduciary, safeguarding or safety finding → at least 2 whatever its score; Critical in one of those categories → 3
 * (board). Uses the residual rating, or the inherent one when residual is not rated yet.
 */
export function riskEscalation(cap: CapLike): { level: number; reason: string } {
  const residual = scoreOf({ likelihood: cap.residualLikelihood ?? null, impact: cap.residualImpact ?? null })
  const s = residual ?? scoreOf({ likelihood: cap.inherentLikelihood ?? null, impact: cap.inherentImpact ?? null })
  const b = s == null ? null : band(s)
  const category = (RISK_CATEGORIES as readonly string[]).includes(cap.riskCategory ?? '') ? cap.riskCategory as keyof typeof RISK_CATEGORY_LABEL : null
  let level = b === 'Critical' ? 2 : b === 'High' ? 1 : 0
  if (category) level = Math.max(level, b === 'Critical' ? 3 : 2)
  if (!level) return { level: 0, reason: '' }
  const parts = [b && (b === 'Critical' || b === 'High') ? `${residual != null ? 'Residual' : 'Inherent'} risk ${b} (${s})` : '', category ? `${RISK_CATEGORY_LABEL[category]} finding` : ''].filter(Boolean)
  return { level, reason: parts.join('; ') }
}

/** The escalation level a CAP should be at on `today` (YYYY-MM-DD), with the reason. */
export function escalationFor(cap: CapLike, today: string): { level: number; reason: string } {
  if (cap.status === 'completed' && cap.effectivenessStatus !== 'not_effective') return { level: 0, reason: '' }
  if (cap.status === 'merged') return { level: 0, reason: '' }
  let level = 0, reason = ''
  if (cap.dueDate && cap.dueDate < today && cap.status !== 'completed') {
    const days = Math.round((Date.parse(today) - Date.parse(cap.dueDate)) / 86_400_000)
    const rule = ESCALATION_RULES[cap.severity] ?? ESCALATION_RULES.medium
    level = rule.filter((d) => days >= d).length
    if (level) reason = `${cap.severity} CAP ${days} day(s) overdue`
  }
  if (cap.effectivenessStatus === 'not_effective' && level < 1) { level = 1; reason = 'Effectiveness review found the action not effective' }
  // Risk-based escalation applies while the finding is open (not once it is closed as effective).
  if (cap.status !== 'completed') {
    const r = riskEscalation(cap)
    if (r.level > level) { level = r.level; reason = r.reason }
  }
  return { level, reason }
}

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'is', 'are', 'be', 'not', 'no', 'with', 'by', 'at', 'as', 'it', 'this', 'that', 'has', 'have', 'was', 'were'])
export const tokens = (s: string) => new Set(s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))
export function similarity(a: string, b: string): number {
  const x = tokens(a), y = tokens(b)
  if (!x.size || !y.size) return 0
  let inter = 0
  for (const w of x) if (y.has(w)) inter++
  return inter / (x.size + y.size - inter)
}

export const DUPLICATE_THRESHOLD = 0.6

/** Groups of open CAPs that look like duplicates: same source record, or very similar finding text. */
export function findDuplicateGroups(caps: CapLike[]): { ids: number[]; reason: string; similarity: number }[] {
  const open = caps.filter((c) => c.status !== 'completed' && c.status !== 'merged')
  const parent = new Map(open.map((c) => [c.id, c.id]))
  const find = (x: number): number => (parent.get(x) === x ? x : find(parent.get(x)!))
  const why = new Map<string, { reason: string; sim: number }>()
  for (let i = 0; i < open.length; i++) for (let j = i + 1; j < open.length; j++) {
    const a = open[i], b = open[j]
    const sameSource = a.sourceType !== 'manual' && a.sourceType === b.sourceType && a.sourceId !== null && a.sourceId === b.sourceId
    const sim = similarity(a.findingDescription, b.findingDescription)
    if (!sameSource && sim < DUPLICATE_THRESHOLD) continue
    parent.set(find(b.id), find(a.id))
    why.set(`${a.id}-${b.id}`, { reason: sameSource ? `same ${a.sourceType.replace('_', ' ')} #${a.sourceId}` : 'similar finding text', sim })
  }
  const groups = new Map<number, number[]>()
  for (const c of open) groups.set(find(c.id), [...(groups.get(find(c.id)) ?? []), c.id])
  return [...groups.values()].filter((g) => g.length > 1).map((ids) => {
    const pairs = [...why.entries()].filter(([k]) => { const [a, b] = k.split('-').map(Number); return ids.includes(a) && ids.includes(b) })
    return { ids: ids.sort((a, b) => a - b), reason: [...new Set(pairs.map(([, v]) => v.reason))].join('; '), similarity: Math.round(Math.max(...pairs.map(([, v]) => v.sim)) * 100) / 100 }
  })
}

const RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
export const maxSeverity = (xs: string[]) => xs.reduce((a, b) => ((RANK[b] ?? 1) > (RANK[a] ?? 1) ? b : a), 'low')
