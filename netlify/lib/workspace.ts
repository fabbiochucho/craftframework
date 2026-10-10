// ============================================================================
// Workspace platform — pure business rules (no I/O)
// ----------------------------------------------------------------------------
// RBAC, scoring, CAP and evidence helpers shared by netlify/functions/
// workspace-api.mts. Kept side-effect free so they can be unit-tested with
// `node netlify/lib/workspace.test.ts`.
// ============================================================================

export const ORG_ROLES = ['viewer', 'assessor', 'admin', 'owner'] as const
export type OrgRole = (typeof ORG_ROLES)[number]

export function isOrgRole(v: unknown): v is OrgRole {
  return typeof v === 'string' && (ORG_ROLES as readonly string[]).includes(v)
}

// Higher index = more privilege. owner > admin > assessor > viewer.
export function hasMinRole(role: string | null | undefined, minRole: OrgRole): boolean {
  if (!isOrgRole(role)) return false
  return ORG_ROLES.indexOf(role) >= ORG_ROLES.indexOf(minRole)
}

// Admins may invite members but cannot promote anyone to owner (or change an
// owner's role); only owners can.
export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (!isOrgRole(targetRole)) return false
  if (actorRole === 'owner') return true
  if (actorRole === 'admin') return targetRole !== 'owner'
  return false
}

const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'aol.com', 'icloud.com', 'proton.me', 'protonmail.com', 'mailinator.com',
])

// Organizations must be created with an organizational email: the address has
// to be well-formed and not a consumer/disposable mailbox provider.
export function isVerifiedOrgEmailDomain(email: string): boolean {
  const m = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/.exec(email.trim().toLowerCase())
  return !!m && !FREE_MAIL_DOMAINS.has(m[1])
}

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const
export type Severity = (typeof SEVERITIES)[number]

// 0–5 slider score → Tier 1–5.
export function tierFromScore(score: number): number {
  if (!Number.isFinite(score)) return 1
  return Math.min(5, Math.max(1, Math.round(score)))
}

// Low tiers generate findings; Tier 4–5 are considered adequate.
export function severityFromTier(tier: number): Severity | null {
  if (tier <= 1) return 'critical'
  if (tier === 2) return 'high'
  if (tier === 3) return 'medium'
  return null
}

export function riskClassification(avgTier: number): 'Critical' | 'High' | 'Moderate' | 'Low' {
  if (avgTier < 2) return 'Critical'
  if (avgTier < 3) return 'High'
  if (avgTier < 4) return 'Moderate'
  return 'Low'
}

export function buildScorecard(
  scores: { pillar: string; domain: string; tierLevel: number }[],
  findings: { severity: string; status: string }[],
) {
  const byPillar: Record<string, { avgTier: number; domains: number }> = {}
  const sums: Record<string, { total: number; n: number }> = {}
  for (const s of scores) {
    const e = (sums[s.pillar] ??= { total: 0, n: 0 })
    e.total += s.tierLevel
    e.n += 1
  }
  for (const [p, { total, n }] of Object.entries(sums)) byPillar[p] = { avgTier: total / n, domains: n }
  const all = scores.length ? scores.reduce((a, s) => a + s.tierLevel, 0) / scores.length : 0
  const findingsBySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const f of findings) if (f.status !== 'resolved') findingsBySeverity[f.severity] = (findingsBySeverity[f.severity] ?? 0) + 1
  return {
    pillars: byPillar,
    domains: scores.map((s) => ({ pillar: s.pillar, domain: s.domain, tier: s.tierLevel })),
    overallTier: all,
    risk: scores.length ? riskClassification(all) : null,
    findingsBySeverity,
  }
}

// --- CAP ---------------------------------------------------------------------
export function effectiveCapStatus(
  status: string,
  dueDate: string | null | undefined,
  now: Date = new Date(),
): string {
  if (status === 'completed') return status
  if (dueDate && dueDate < now.toISOString().slice(0, 10)) return 'overdue'
  return status
}

// A CAP can be closed only when it has actions and each one has been
// evidenced and verified by someone.
export function capCloseBlockers(
  actions: { status: string; evidenceUploadedAt: Date | null; verifiedBy: string | null }[],
): string[] {
  if (!actions.length) return ['CAP has no action items']
  const out: string[] = []
  for (const [i, a] of actions.entries()) {
    if (!a.evidenceUploadedAt) out.push(`Action ${i + 1} has no evidence`)
    else if (!a.verifiedBy) out.push(`Action ${i + 1} evidence is not verified`)
  }
  return out
}

export function summarizeCaps(
  caps: { status: string; severity: string; dueDate: string | null; createdAt: Date; completionDate: Date | null }[],
  now: Date = new Date(),
) {
  const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  let open = 0, overdue = 0, completed = 0, closeDays = 0
  for (const c of caps) {
    const st = effectiveCapStatus(c.status, c.dueDate, now)
    if (st === 'completed') {
      completed++
      if (c.completionDate) closeDays += (c.completionDate.getTime() - c.createdAt.getTime()) / 86_400_000
      continue
    }
    open++
    if (st === 'overdue') overdue++
    bySeverity[c.severity] = (bySeverity[c.severity] ?? 0) + 1
  }
  return {
    total: caps.length,
    open,
    overdue,
    completed,
    bySeverity,
    percentComplete: caps.length ? Math.round((completed / caps.length) * 100) : 0,
    avgDaysToClose: completed ? Math.round((closeDays / completed) * 10) / 10 : 0,
  }
}

// --- Evidence ----------------------------------------------------------------------
export const ALLOWED_EVIDENCE_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024

export function evidenceExpiryState(
  expiryDate: string | null | undefined,
  now: Date = new Date(),
): 'none' | 'expired' | 'expiring' | 'valid' {
  if (!expiryDate) return 'none'
  const today = now.toISOString().slice(0, 10)
  if (expiryDate < today) return 'expired'
  const limit = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)
  return expiryDate <= limit ? 'expiring' : 'valid'
}

// --- Misc ------------------------------------------------------------------------------
// The API persists these fixed-window counters in Postgres; keep only the
// deterministic windowing and threshold rules here for unit tests.
export function rateLimitWindowStart(now: number, windowMs = 60_000): number {
  return Math.floor(now / windowMs) * windowMs
}

export function isRateLimitedCount(count: number, limit: number): boolean {
  return count > limit
}

export function nextReportRun(cadence: 'weekly' | 'monthly' | 'quarterly', from: Date, anchorDay = from.getUTCDate()): Date {
  const next = new Date(from)
  if (cadence === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7)
    return next
  }
  const day = Math.min(Math.max(1, anchorDay), 31)
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth() + (cadence === 'monthly' ? 1 : 3))
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  next.setUTCDate(Math.min(day, lastDay))
  return next
}

export const ALLOWED_ORIGINS = ['https://craftframework.becomechange.institute']
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  }
}

export function csvEscape(v: unknown): string {
  let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
