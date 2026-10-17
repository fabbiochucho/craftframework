// The /onboarding wizard's server-side draft: what has been entered so far and the furthest step reached.
// Stored through the encrypted per-tenant legacy-state store (key `onboarding-draft`); never holds image data.
import { ARCHETYPES, type Archetype } from './data.ts'
import { ONBOARDING_STEPS } from './onboardingProgress.ts'

export const ONBOARDING_DRAFT_KEY = 'onboarding-draft'
export const ONBOARDING_DRAFT_DEBOUNCE_MS = 1500
const LAST_STEP = ONBOARDING_STEPS.length - 1
const MAX_INVITES = 50

export type OnboardingDraft = {
  orgName: string
  archetype: Archetype | ''
  country: string
  sector: string
  subsector: string
  invites: string[]
  path: 'web' | 'excel' | null
  /** 0-based furthest step reached; going Back never lowers it. */
  furthestStep: number
}

export const EMPTY_ONBOARDING_DRAFT: OnboardingDraft = {
  orgName: '', archetype: '', country: '', sector: '', subsector: '', invites: [''], path: null, furthestStep: 0,
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Step 1 is complete when the fields the Continue button requires are filled. */
export function step1Complete(d: Pick<OnboardingDraft, 'orgName' | 'archetype'>): boolean {
  return d.orgName.trim() !== '' && d.archetype !== ''
}

/** Defensive restore: anything stored that is not the expected shape falls back to the defaults. */
export function restoreDraft(saved: unknown): OnboardingDraft {
  if (!saved || typeof saved !== 'object') return { ...EMPTY_ONBOARDING_DRAFT, invites: [''] }
  const s = saved as Record<string, unknown>
  const archetype = ARCHETYPES.some(a => a.id === s.archetype) ? (s.archetype as Archetype) : ''
  const invites = Array.isArray(s.invites) ? s.invites.filter((e): e is string => typeof e === 'string').slice(0, MAX_INVITES).map(e => e.slice(0, 254)) : []
  const draft: OnboardingDraft = {
    orgName: str(s.orgName), archetype, country: str(s.country, 10), sector: str(s.sector), subsector: str(s.subsector),
    invites: invites.length ? invites : [''],
    path: s.path === 'web' || s.path === 'excel' ? s.path : null,
    furthestStep: 0,
  }
  draft.furthestStep = furthestStep(draft, typeof s.furthestStep === 'number' ? s.furthestStep : 0)
  return draft
}

/** Furthest step (0-based) a person may be reopened at: the larger of what was reached and what was asked for,
 *  clamped to the wizard, and never past step 1 while step 1 is incomplete. */
export function furthestStep(d: Pick<OnboardingDraft, 'orgName' | 'archetype'>, ...reached: number[]): number {
  const best = Math.max(0, ...reached.map(n => (Number.isFinite(n) ? Math.trunc(n) : 0)))
  return step1Complete(d) ? Math.min(best, LAST_STEP) : 0
}

/** Overlay a restored draft on the form's defaults; blank saved fields never wipe pre-filled values. */
export function mergeDraft(defaults: Pick<OnboardingDraft, 'orgName'>, saved: OnboardingDraft): OnboardingDraft {
  return { ...saved, orgName: saved.orgName || defaults.orgName }
}

/** Parse the `?step=` hint on the resume link (1-based) into a 0-based step, or 0. */
export function stepFromSearch(raw: unknown): number {
  const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN
  return Number.isInteger(n) && n >= 1 && n <= ONBOARDING_STEPS.length ? n - 1 : 0
}
