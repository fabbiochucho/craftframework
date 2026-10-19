// Recurring statutory filings: the returns, remittances and registrations organisations must make in each country
// (company registry, tax, payroll and anti-money-laundering). Each one names its legal basis and a dated source.
// Information to support compliance, not legal or tax advice. Self-check: `node src/lib/filings/filings.test.ts`.
import type { Obligation, ObligationFrequency } from '../obligations.ts'
import { NG_FILINGS } from './ng.ts'
import { KE_FILINGS } from './ke.ts'
import { ZA_FILINGS } from './za.ts'
import { GH_FILINGS } from './gh.ts'
import { EAST_FILINGS } from './east.ts'
import { NW1_FILINGS } from './north_west1.ts'
import { ISLAND_FILINGS } from './islands.ts'
import { NORTH2_FILINGS } from './north2.ts'
import { WEST2_FILINGS } from './west2.ts'
import { CENTRAL_FILINGS } from './central.ts'

/** Who a filing applies to. An organisation is usually several at once (for example a company that employs staff). */
export type EntityKind = 'company' | 'ngo' | 'business-name' | 'employer' | 'vat-registered'

export type DueRule =
  | { kind: 'monthly'; day: number }
  | { kind: 'annual-after-year-end'; months: number }
  | { kind: 'annual-fixed'; month: number; day: number }
  | { kind: 'semi-annual-fixed'; dates: Array<{ month: number; day: number }> }
  /** Any number of fixed dates each year (for example three instalment dates). */
  | { kind: 'fixed-dates'; dates: Array<{ month: number; day: number }> }
  /** Instalments on a day of given months of the accounting year (month 1 is the month after the year end). */
  | { kind: 'instalments'; months: number[]; day: number }
  /** Due relative to an event with no fixed date (a payday, the AGM): shown as guidance, with no calendar date. */
  | { kind: 'event'; text: string }
  | { kind: 'one-off'; text: string }

export interface StatutoryFiling {
  id: string
  jurisdiction: string
  name: string
  authority: string
  appliesTo: EntityKind[]
  due: DueRule
  /** What the due rule means in plain words. */
  dueText: string
  legalBasis: string
  notes?: string
  source: { url: string; kind: 'official' | 'secondary'; checked: string }
}

export const FILINGS: StatutoryFiling[] = [...NG_FILINGS, ...KE_FILINGS, ...ZA_FILINGS, ...GH_FILINGS, ...EAST_FILINGS, ...NW1_FILINGS, ...ISLAND_FILINGS, ...NORTH2_FILINGS, ...WEST2_FILINGS, ...CENTRAL_FILINGS]

export const FILING_JURISDICTIONS = [...new Set(FILINGS.map((f) => f.jurisdiction))]

export function filingsFor(jurisdiction: string, kinds: EntityKind[]): StatutoryFiling[] {
  return FILINGS.filter((f) => f.jurisdiction === jurisdiction && f.appliesTo.some((k) => kinds.includes(k)))
}

// ---- dates (pure, string-based: no time zones) ----
const pad = (n: number) => String(n).padStart(2, '0')
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate() // m is 1-12
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(Math.min(d, daysIn(y, m)))}`
function addMonths(y: number, m: number, d: number, n: number): string {
  const total = (y * 12 + (m - 1)) + n
  const ny = Math.floor(total / 12), nm = (total % 12) + 1
  // A month-end date stays at month-end (31 December + 6 months is 30 June).
  return iso(ny, nm, d >= daysIn(y, m) ? daysIn(ny, nm) : d)
}

export type DueContext = { today: string; /** Financial year end as MM-DD. */ yearEnd: string }

/** The next due date on or after today, or null when the filing is tied to an event with no fixed date. */
export function nextDue(f: StatutoryFiling, ctx: DueContext): string | null {
  const [ty, tm, td] = ctx.today.split('-').map(Number)
  const r = f.due
  switch (r.kind) {
    case 'monthly':
      return td <= r.day ? iso(ty, tm, r.day) : addMonths(ty, tm, r.day, 1)
    case 'annual-fixed': {
      const thisYear = iso(ty, r.month, r.day)
      return thisYear >= ctx.today ? thisYear : iso(ty + 1, r.month, r.day)
    }
    case 'fixed-dates':
    case 'semi-annual-fixed': {
      const all = [ty, ty + 1].flatMap((y) => r.dates.map((d) => iso(y, d.month, d.day))).sort()
      return all.find((d) => d >= ctx.today) ?? null
    }
    case 'annual-after-year-end': {
      const [em, ed] = ctx.yearEnd.split('-').map(Number)
      for (const y of [ty - 1, ty, ty + 1]) {
        const due = addMonths(y, em, ed, r.months)
        if (due >= ctx.today) return due
      }
      return null
    }
    case 'instalments': {
      const [em] = ctx.yearEnd.split('-').map(Number)
      const all = [ty - 1, ty, ty + 1].flatMap((y) => r.months.map((k) => {
        const total = y * 12 + em + k - 1 // month k after the year end of year y (0-based month index)
        return iso(Math.floor(total / 12), (total % 12) + 1, r.day)
      })).sort()
      return all.find((d) => d >= ctx.today) ?? null
    }
    default:
      return null
  }
}

const FREQUENCY: Record<DueRule['kind'], ObligationFrequency> = {
  monthly: 'monthly', instalments: 'quarterly', 'annual-after-year-end': 'annual', 'annual-fixed': 'annual', 'semi-annual-fixed': 'semi-annual', 'fixed-dates': 'quarterly', event: 'monthly', 'one-off': 'one-off',
}

/** An entry for the obligations register. Filings with no calendar date (event-based) should be shown as guidance instead. */
export function toObligation(f: StatutoryFiling, ctx: DueContext, owner: string): Obligation {
  const due = nextDue(f, ctx) ?? ctx.today
  return {
    id: `fil-${f.id}-${due}`, name: f.name, stream: 'regulatory', type: 'regulatory_filing', donorOrAuthority: f.authority,
    frequency: FREQUENCY[f.due.kind], nextDueDate: due, country: f.jurisdiction, sector: 'All', owner, status: 'pending',
    notes: `${f.dueText} Legal basis: ${f.legalBasis}.${f.notes ? ` ${f.notes}` : ''}`,
  }
}
