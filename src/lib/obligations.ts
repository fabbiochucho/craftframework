// ============================================================================
// CRAFT (ICARF v4.0) - Unified Obligations & Reporting Calendar engine
// ----------------------------------------------------------------------------
// Merges three streams of institutional deadlines into a single model:
//   • Reporting obligations (donor financial / narrative filings)
//   • Regulatory expiries & filings (licences, certificates, statutory returns)
//   • Capacity-development targets (CIP milestones with due dates)
//
// Demo vs. live separation mirrors the rest of the platform: a LIVE workspace
// starts with an empty calendar and the institution populates it, while a DEMO
// session is seeded with illustrative Pan-African examples. The seed is gated
// behind the session's `isDemo` flag (see seedObligations) - the codebase's
// equivalent of the prompt's `isDemoMode`.
//
// No external date library is used (date-fns is not a dependency); all date
// maths is done with the native Date object via the small helpers below.
// ============================================================================

export type ObligationStream = 'reporting' | 'regulatory' | 'capacity'

export type ObligationType =
  | 'donor_financial'
  | 'donor_narrative'
  | 'regulatory_filing'
  | 'regulatory_expiry'
  | 'capacity_target'

export type ObligationFrequency =
  | 'monthly'
  | 'quarterly'
  | 'semi-annual'
  | 'annual'
  | 'one-off'

export type ObligationStatus = 'pending' | 'submitted' | 'overdue'

export interface Obligation {
  id: string
  name: string
  stream: ObligationStream
  type: ObligationType
  // The donor, regulator, or authority the obligation answers to.
  donorOrAuthority: string
  frequency: ObligationFrequency
  // ISO `yyyy-mm-dd`. Stored as a string (not a Date) so the module stays
  // SSR-safe and serialisable - no live Date objects in module scope.
  nextDueDate: string
  country: string
  sector: string
  owner: string
  status: ObligationStatus
  notes?: string
}

// ----------------------------------------------------------------------------
// Display metadata
// ----------------------------------------------------------------------------

export const OBLIGATION_TYPE_LABEL: Record<ObligationType, string> = {
  donor_financial: 'Donor Financial Report',
  donor_narrative: 'Donor Narrative Report',
  regulatory_filing: 'Regulatory Filing',
  regulatory_expiry: 'Licence / Certificate Expiry',
  capacity_target: 'Capacity Target',
}

export const STREAM_LABEL: Record<ObligationStream, string> = {
  reporting: 'Reporting',
  regulatory: 'Regulatory',
  capacity: 'Capacity',
}

export const FREQUENCY_LABEL: Record<ObligationFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'semi-annual': 'Semi-annual',
  annual: 'Annual',
  'one-off': 'One-off',
}

export const FREQUENCY_OPTIONS: ObligationFrequency[] = [
  'monthly',
  'quarterly',
  'semi-annual',
  'annual',
  'one-off',
]

// ----------------------------------------------------------------------------
// Native date helpers (no date-fns dependency)
// ----------------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

// Midnight today, used as the reference point for all "days remaining" maths.
export function startOfToday(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setMonth(x.getMonth() + n)
  return x
}

export function daysUntil(iso: string, today: Date = startOfToday()): number {
  const due = parseISODate(iso)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

const MONTHS_PER_CYCLE: Record<ObligationFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  'semi-annual': 6,
  annual: 12,
  'one-off': 0,
}

// The next cycle's due date. One-off obligations do not recur and return the
// same date unchanged (callers mark them complete instead of rescheduling).
export function computeNextDueDate(iso: string, frequency: ObligationFrequency): string {
  const months = MONTHS_PER_CYCLE[frequency]
  if (months === 0) return iso
  return toISODate(addMonths(parseISODate(iso), months))
}

// Generate the next `count` occurrences starting from (and including) `startISO`.
export function generateOccurrences(
  startISO: string,
  frequency: ObligationFrequency,
  count: number,
): string[] {
  const out: string[] = [startISO]
  if (frequency === 'one-off') return out
  let cur = startISO
  for (let i = 1; i < count; i++) {
    cur = computeNextDueDate(cur, frequency)
    out.push(cur)
  }
  return out
}

// ----------------------------------------------------------------------------
// Adaptive notification logic
// ----------------------------------------------------------------------------
// Lead/urgent windows scale with cadence: a monthly report warns 14/7 days out,
// while an annual licence renewal needs a 90/30-day runway.

export interface WarningThresholds {
  lead: number
  urgent: number
}

export function getWarningThresholds(frequency: ObligationFrequency): WarningThresholds {
  if (frequency === 'monthly') return { lead: 14, urgent: 7 }
  if (frequency === 'quarterly' || frequency === 'semi-annual') return { lead: 60, urgent: 30 }
  return { lead: 90, urgent: 30 } // annual or one-off
}

export type Severity = 'ok' | 'warning' | 'urgent' | 'overdue' | 'submitted'

export interface SeverityMeta {
  severity: Severity
  daysLeft: number
  label: string
  // Tailwind classes for badge backgrounds/text.
  badge: string
  // Rank for sorting/notification ordering (higher = more pressing).
  rank: number
}

export function deriveSeverity(ob: Obligation, today: Date = startOfToday()): SeverityMeta {
  const daysLeft = daysUntil(ob.nextDueDate, today)

  if (ob.status === 'submitted') {
    return {
      severity: 'submitted',
      daysLeft,
      label: 'Submitted',
      badge: 'bg-emerald-100 text-emerald-700',
      rank: 0,
    }
  }

  if (daysLeft < 0) {
    return {
      severity: 'overdue',
      daysLeft,
      label: `Overdue ${Math.abs(daysLeft)}d`,
      badge: 'bg-rose-100 text-rose-700',
      rank: 4,
    }
  }

  const { lead, urgent } = getWarningThresholds(ob.frequency)
  if (daysLeft <= urgent) {
    return {
      severity: 'urgent',
      daysLeft,
      label: `Due in ${daysLeft}d`,
      badge: 'bg-orange-100 text-orange-700',
      rank: 3,
    }
  }
  if (daysLeft <= lead) {
    return {
      severity: 'warning',
      daysLeft,
      label: `Due in ${daysLeft}d`,
      badge: 'bg-amber-100 text-amber-700',
      rank: 2,
    }
  }
  return {
    severity: 'ok',
    daysLeft,
    label: `Due in ${daysLeft}d`,
    badge: 'bg-slate-100 text-slate-600',
    rank: 1,
  }
}

// ----------------------------------------------------------------------------
// Header metrics
// ----------------------------------------------------------------------------

export interface ObligationMetrics {
  total: number
  // Share of obligations that are neither overdue nor submitted-late, as a %.
  healthPct: number
  reportsDue30: number
  regulatoryExpiries30: number
  overdue: number
}

export function computeMetrics(
  obligations: Obligation[],
  today: Date = startOfToday(),
): ObligationMetrics {
  let overdue = 0
  let reportsDue30 = 0
  let regulatoryExpiries30 = 0
  let onTrack = 0

  for (const ob of obligations) {
    const { severity, daysLeft } = deriveSeverity(ob, today)
    if (severity === 'overdue') overdue++
    else onTrack++

    const within30 = daysLeft >= 0 && daysLeft <= 30 && severity !== 'submitted'
    if (within30 && ob.stream === 'reporting') reportsDue30++
    if (within30 && ob.stream === 'regulatory') regulatoryExpiries30++
  }

  const total = obligations.length
  const healthPct = total === 0 ? 100 : Math.round((onTrack / total) * 100)

  return { total, healthPct, reportsDue30, regulatoryExpiries30, overdue }
}

// ----------------------------------------------------------------------------
// Predefined routine templates (Add Obligation · Mode 1)
// ----------------------------------------------------------------------------
// Clicking "Generate" expands a template into its next four occurrences. Adding
// support for a new country/sector/donor is purely additive - drop a row here,
// no UI changes required (the Pan-African scalability principle).

export interface RoutineTemplate {
  id: string
  // Entity archetype the routine applies to.
  archetype: 'Public' | 'Civil Society' | 'Private'
  country: string
  sector: string
  donorOrAuthority: string
  name: string
  type: ObligationType
  stream: ObligationStream
  frequency: ObligationFrequency
  defaultOwner: string
}

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: 'rt-usaid-q',
    archetype: 'Civil Society',
    country: 'NG',
    sector: 'Health',
    donorOrAuthority: 'USAID',
    name: 'USAID Quarterly Financial Report (SF-425)',
    type: 'donor_financial',
    stream: 'reporting',
    frequency: 'quarterly',
    defaultOwner: 'Finance Manager',
  },
  {
    id: 'rt-gf-pudr',
    archetype: 'Public',
    country: 'KE',
    sector: 'Health',
    donorOrAuthority: 'The Global Fund',
    name: 'Global Fund Progress Update & Disbursement Request (PU/DR)',
    type: 'donor_narrative',
    stream: 'reporting',
    frequency: 'semi-annual',
    defaultOwner: 'Grants Director',
  },
  {
    id: 'rt-ke-ngo-return',
    archetype: 'Civil Society',
    country: 'KE',
    sector: 'NGO',
    donorOrAuthority: 'NGO Coordination Board',
    name: 'Annual NGO Coordination Board Return',
    type: 'regulatory_filing',
    stream: 'regulatory',
    frequency: 'annual',
    defaultOwner: 'Executive Director',
  },
  {
    id: 'rt-ng-ndpr',
    archetype: 'Private',
    country: 'NG',
    sector: 'Fintech',
    donorOrAuthority: 'NITDA',
    name: 'NDPR Annual Data Protection Audit Filing',
    type: 'regulatory_filing',
    stream: 'regulatory',
    frequency: 'annual',
    defaultOwner: 'Data Protection Officer',
  },
  {
    id: 'rt-cbn-licence',
    archetype: 'Private',
    country: 'NG',
    sector: 'Fintech',
    donorOrAuthority: 'Central Bank of Nigeria',
    name: 'CBN Operating Licence Renewal',
    type: 'regulatory_expiry',
    stream: 'regulatory',
    frequency: 'annual',
    defaultOwner: 'Compliance Lead',
  },
  {
    id: 'rt-vat-monthly',
    archetype: 'Private',
    country: 'KE',
    sector: 'Tech',
    donorOrAuthority: 'Kenya Revenue Authority',
    name: 'Monthly VAT Return',
    type: 'regulatory_filing',
    stream: 'regulatory',
    frequency: 'monthly',
    defaultOwner: 'Finance Officer',
  },
]

export const ARCHETYPES: RoutineTemplate['archetype'][] = ['Public', 'Civil Society', 'Private']

// Distinct facet values, derived from the template library so dropdowns stay in
// sync as templates are added.
export function templateFacets() {
  const countries = new Set<string>()
  const sectors = new Set<string>()
  const authorities = new Set<string>()
  for (const t of ROUTINE_TEMPLATES) {
    countries.add(t.country)
    sectors.add(t.sector)
    authorities.add(t.donorOrAuthority)
  }
  return {
    countries: [...countries].sort(),
    sectors: [...sectors].sort(),
    authorities: [...authorities].sort(),
  }
}

let genSeq = 0
function nextId(prefix: string): string {
  genSeq += 1
  return `${prefix}-${genSeq}-${genSeq * 7 + 13}`
}

// Expand a template into concrete obligations for its next `count` cycles,
// starting from `firstDueISO`.
export function generateFromTemplate(
  template: RoutineTemplate,
  firstDueISO: string,
  count = 4,
): Obligation[] {
  const dates = generateOccurrences(firstDueISO, template.frequency, count)
  return dates.map(date => ({
    id: nextId('ob-gen'),
    name: template.name,
    stream: template.stream,
    type: template.type,
    donorOrAuthority: template.donorOrAuthority,
    frequency: template.frequency,
    nextDueDate: date,
    country: template.country,
    sector: template.sector,
    owner: template.defaultOwner,
    status: 'pending',
  }))
}

export function makeCustomObligation(input: {
  name: string
  type: ObligationType
  frequency: ObligationFrequency
  nextDueDate: string
  owner: string
  donorOrAuthority?: string
  country?: string
  sector?: string
  notes?: string
}): Obligation {
  const stream: ObligationStream =
    input.type === 'capacity_target'
      ? 'capacity'
      : input.type === 'regulatory_filing' || input.type === 'regulatory_expiry'
        ? 'regulatory'
        : 'reporting'
  return {
    id: nextId('ob-custom'),
    name: input.name.trim(),
    stream,
    type: input.type,
    donorOrAuthority: input.donorOrAuthority?.trim() || '-',
    frequency: input.frequency,
    nextDueDate: input.nextDueDate,
    country: input.country?.trim() || '-',
    sector: input.sector?.trim() || '-',
    owner: input.owner.trim() || 'Unassigned',
    status: 'pending',
    notes: input.notes?.trim() || undefined,
  }
}

// ----------------------------------------------------------------------------
// Demo seed (gated by the session's isDemo flag at the call site)
// ----------------------------------------------------------------------------
// Dates are expressed as offsets from "today" so the demo always shows a live
// mix of overdue, urgent, warning, and on-track items regardless of when it is
// opened.

function offsetISO(days: number, today: Date = startOfToday()): string {
  return toISODate(new Date(today.getTime() + days * 86_400_000))
}

// Returns the illustrative Pan-African obligations for a DEMO session. Callers
// MUST gate this behind `isDemo`; a live workspace receives an empty array.
export function seedObligations(isDemo: boolean): Obligation[] {
  if (!isDemo) return []
  return [
    {
      id: 'rep-01',
      name: 'USAID Quarterly Financial Report (SF-425)',
      stream: 'reporting',
      type: 'donor_financial',
      donorOrAuthority: 'USAID',
      frequency: 'quarterly',
      nextDueDate: offsetISO(12),
      country: 'NG',
      sector: 'Health',
      owner: 'Finance Manager',
      status: 'pending',
    },
    {
      id: 'rep-02',
      name: 'Annual NGO Coordination Board Return',
      stream: 'regulatory',
      type: 'regulatory_filing',
      donorOrAuthority: 'NGO Coordination Board',
      frequency: 'annual',
      nextDueDate: offsetISO(-3),
      country: 'KE',
      sector: 'NGO',
      owner: 'Executive Director',
      status: 'overdue',
    },
    {
      id: 'rep-03',
      name: 'Global Fund Progress Update & Disbursement Request',
      stream: 'reporting',
      type: 'donor_narrative',
      donorOrAuthority: 'The Global Fund',
      frequency: 'semi-annual',
      nextDueDate: offsetISO(48),
      country: 'KE',
      sector: 'Health',
      owner: 'Grants Director',
      status: 'pending',
    },
    {
      id: 'reg-01',
      name: 'CBN Operating Licence Renewal',
      stream: 'regulatory',
      type: 'regulatory_expiry',
      donorOrAuthority: 'Central Bank of Nigeria',
      frequency: 'annual',
      nextDueDate: offsetISO(74),
      country: 'NG',
      sector: 'Fintech',
      owner: 'Compliance Lead',
      status: 'pending',
    },
    {
      id: 'reg-02',
      name: 'NDPR Annual Data Protection Audit Filing',
      stream: 'regulatory',
      type: 'regulatory_filing',
      donorOrAuthority: 'NITDA',
      frequency: 'annual',
      nextDueDate: offsetISO(25),
      country: 'NG',
      sector: 'Fintech',
      owner: 'Data Protection Officer',
      status: 'pending',
    },
    {
      id: 'reg-03',
      name: 'Monthly VAT Return',
      stream: 'regulatory',
      type: 'regulatory_filing',
      donorOrAuthority: 'Kenya Revenue Authority',
      frequency: 'monthly',
      nextDueDate: offsetISO(5),
      country: 'KE',
      sector: 'Tech',
      owner: 'Finance Officer',
      status: 'pending',
    },
    {
      id: 'cap-01',
      name: 'Roll out automated bank reconciliation (CIP milestone)',
      stream: 'capacity',
      type: 'capacity_target',
      donorOrAuthority: 'Internal - CIP',
      frequency: 'one-off',
      nextDueDate: offsetISO(40),
      country: 'KE',
      sector: 'Health',
      owner: 'Finance Manager',
      status: 'pending',
      notes: 'Linked to finding FIN-22 in the Capacity Improvement Plan.',
    },
    {
      id: 'cap-02',
      name: 'Establish anonymous whistleblowing channel (CIP milestone)',
      stream: 'capacity',
      type: 'capacity_target',
      donorOrAuthority: 'Internal - CIP',
      frequency: 'one-off',
      nextDueDate: offsetISO(-10),
      country: 'KE',
      sector: 'NGO',
      owner: 'Head of Ethics',
      status: 'overdue',
    },
  ]
}
