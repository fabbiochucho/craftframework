// Finding risk ratings: likelihood × impact on a 5×5 matrix, before controls (inherent) and after them (residual).
// Bands: 1–4 Low, 5–9 Moderate, 10–16 High, 17–25 Critical. A statutory, fiduciary, safeguarding or safety finding
// escalates whatever its score. Self-check: `node src/lib/riskMatrix.test.ts`.

export const LIKELIHOOD = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'] as const
export const IMPACT = ['Insignificant', 'Minor', 'Moderate', 'Major', 'Severe'] as const
export const RISK_CATEGORIES = ['statutory', 'fiduciary', 'safeguarding', 'safety'] as const
export type RiskCategory = (typeof RISK_CATEGORIES)[number]
export const RISK_CATEGORY_LABEL: Record<RiskCategory, string> = { statutory: 'Statutory or legal', fiduciary: 'Fiduciary (misuse of funds)', safeguarding: 'Safeguarding', safety: 'Health and safety' }

export const RESPONSE_STANCES = ['agree', 'partly', 'disagree'] as const
export type ResponseStance = (typeof RESPONSE_STANCES)[number]
export const STANCE_LABEL: Record<ResponseStance, string> = { agree: 'Agrees', partly: 'Partly agrees', disagree: 'Disagrees' }

export type Band = 'Low' | 'Moderate' | 'High' | 'Critical'
export const isRating = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5

export const riskScore = (likelihood: number, impact: number) => likelihood * impact
export function band(score: number): Band {
  if (score <= 4) return 'Low'
  if (score <= 9) return 'Moderate'
  if (score <= 16) return 'High'
  return 'Critical'
}

export type Rating = { likelihood: number | null; impact: number | null }
export const scoreOf = (r: Rating) => (isRating(r.likelihood) && isRating(r.impact) ? riskScore(r.likelihood, r.impact) : null)

/** Why the ratings are not acceptable (null = fine): residual risk cannot be higher than inherent risk. */
export function ratingProblem(inherent: Rating, residual: Rating): string | null {
  const i = scoreOf(inherent), r = scoreOf(residual)
  if (i != null && r != null && r > i) return `Residual risk (${r}) cannot be higher than inherent risk (${i}): controls do not add risk`
  return null
}

/** Escalate when the residual (or, if not rated, inherent) band is High or Critical, or the category requires it. */
export function mustEscalate(inherent: Rating, residual: Rating, category: string): boolean {
  if ((RISK_CATEGORIES as readonly string[]).includes(category)) return true
  const s = scoreOf(residual) ?? scoreOf(inherent)
  return s != null && (band(s) === 'High' || band(s) === 'Critical')
}

/** A 5×5 heat map: counts by likelihood (rows, 5 at top) and impact (columns). */
export function heatMap(items: Rating[]): number[][] {
  const grid = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0])
  for (const x of items) if (isRating(x.likelihood) && isRating(x.impact)) grid[5 - x.likelihood][x.impact - 1]++
  return grid
}
