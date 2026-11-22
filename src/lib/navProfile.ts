// Which sidebar links a person sees, from how they signed in (their role) and, for an ordinary account, what they
// said brings them to CRAFT. Pages are never locked by this: a "Show all pages" switch brings every link back, and
// every page still opens from its address. Self-check: `node src/lib/navProfile.test.ts`.
import type { StartChoice } from './startChoice.ts'

export type NavProfile = 'all' | 'organisation' | 'independent' | 'validator' | 'funder' | 'network'

export const PROFILE_LABEL: Record<NavProfile, string> = {
  all: 'All pages',
  organisation: 'Organisation',
  independent: 'Independent assessor',
  validator: 'Validator or consultant',
  funder: 'Funder or investor',
  network: 'Network coordinator',
}

// `hasOrganisation`: the account finished setting up its own organisation (the choice is only kept per browser).
export function navProfile(role: string, choice: StartChoice | null, hasOrganisation = false): NavProfile {
  if (role === 'super_admin' || role === 'admin') return 'all'
  if (role === 'independent') return 'independent'
  if (role === 'portfolio') return 'funder'
  return choice ?? (hasOrganisation ? 'organisation' : 'all')
}

// Shown to everyone.
const ALWAYS = ['/inbox', '/settings', '/help', '/guide', '/assessment-archive']

const PAGES: Record<Exclude<NavProfile, 'all'>, string[]> = {
  organisation: [
    '/dashboard', '/frameworks', '/assessment', '/capacity', '/awards', '/findings', '/verify', '/cip', '/risk',
    '/finance-triangulation', '/data-room', '/obligations', '/regulatory-compliance', '/issb-disclosures',
    '/narrative-report', '/informal-economy', '/reports', '/app/workspaces', '/app/org/members', '/engagements',
    '/invitations', '/networks', '/audit-log',
    // Finding a validator, seeing its validations and raising a dispute with the Review Panel.
    '/directory', '/validations', '/panel',
  ],
  // Assesses other organisations: scores, evidence, the Trust Delta and the report; invites organisations.
  independent: ['/dashboard', '/frameworks', '/assessment', '/capacity', '/findings', '/verify', '/finance-triangulation', '/data-room', '/reports', '/engagements', '/invitations', '/directory', '/training'],
  validator: ['/directory', '/training', '/engagements', '/validations', '/panel', '/invitations'],
  funder: ['/dashboard', '/findings', '/verify', '/reports', '/networks', '/engagements', '/invitations', '/directory'],
  network: ['/networks', '/capacity', '/reports', '/engagements', '/invitations'],
}

export function showsLink(profile: NavProfile, to: string): boolean {
  return profile === 'all' || ALWAYS.includes(to) || PAGES[profile].includes(to)
}

/** Whether the organisation's own accreditation badge means anything to this person. */
export const showsAccreditation = (profile: NavProfile) => profile === 'all' || profile === 'organisation'
