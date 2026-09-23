import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  getUser,
  onAuthChange,
  handleAuthCallback,
  type User,
} from '@netlify/identity'
import { useAuthCtx, SELF_ORG_ID } from '../lib/context'
import { isSuperAdminEmail, effectiveViewLevel, type ViewLevel } from '../lib/data'
import { fetchUserByEmail, recordSignIn } from '../lib/api'

// The view levels a visitor may self-register as (Super Admin is excluded — it
// is only ever granted from the allowlist / admin portal). Mirrors the choices
// offered on the registration form.
const VALID_SELF_ROLES = new Set<ViewLevel>(['assessor', 'independent', 'portfolio'])

// A confirmed Netlify Identity user is a real, signed-in institution. We map
// them onto their own isolated, initially-empty live workspace - never the
// demo's sample data.

/**
 * Bridges Netlify Identity - the real authentication and email-confirmation
 * provider - into the app's React-context session.
 *
 * Identity is the source of truth for "is this visitor a real, email-confirmed
 * user". A signed-up account cannot establish a session until the confirmation
 * link is clicked, so reaching this bridge with a user already means the email
 * was confirmed. Once that happens we hydrate the existing demo session (org +
 * role) so no downstream page needs to know Identity exists.
 */
export function IdentityBridge({ children }: { children: React.ReactNode }) {
  const { login, logout, setAuthReady } = useAuthCtx()
  const navigate = useNavigate()
  // Tracks which identity is currently reflected in app context so we only
  // hydrate/clear on genuine transitions (not on every token refresh).
  const syncedEmail = useRef<string | null>(null)

  useEffect(() => {
    let active = true

    function sync(user: User | null) {
      if (!active) return
      if (user?.email) {
        if (syncedEmail.current === user.email) return
        syncedEmail.current = user.email
        const fallbackOrgName =
          (user.userMetadata?.full_name as string) || user.name || 'My Institution'
        // The category the visitor chose at registration (AuthPage stores it in
        // Identity metadata). Honoured only for a genuinely new self-registrant
        // with no directory row; never allowed to escalate to Super Admin, which
        // is granted exclusively from the allowlist / admin portal.
        const requested = user.userMetadata?.requested_role as ViewLevel | undefined
        const requestedRole: ViewLevel =
          requested && requested !== 'admin' && requested !== 'super_admin' && VALID_SELF_ROLES.has(requested)
            ? requested
            : 'assessor'
        const signInRole = isSuperAdminEmail(user.email) ? 'super_admin' : requestedRole
        // Hydrate the app session IMMEDIATELY from the Identity user, before any
        // network lookup. This is what makes sign-in feel instant and stops the
        // route guard from bouncing a just-signed-in visitor back to /auth while
        // a database round-trip is still in flight: currentUser is populated the
        // moment the auth event fires. The directory lookup below only REFINES
        // this (assigned org + role); it is deliberately off the critical path.
        login(user.email, SELF_ORG_ID, signInRole, fallbackOrgName)
        // Stamp this sign-in into the user directory so the Super Admin sees
        // everyone who has ever authenticated (not just assigned staff) and who
        // is currently active. The server only updates last_seen_at / backfills
        // a blank name, so an admin's role & organisation assignment is safe.
        recordSignIn({
          email: user.email,
          name: fallbackOrgName,
          role: signInRole,
        })
        // Consult the user directory: a person's organisation and role are
        // ASSIGNED there (by an admin), not derived from their email. This is
        // what lets NBTI staff and an external consultant resolve to the SAME
        // org_nbti tenant. If a directory row exists, re-hydrate at the assigned
        // org/role, upgrading the optimistic self-workspace above. A brand-new
        // self-registrant has no row, so the optimistic session already stands.
        void fetchUserByEmail(user.email).then(row => {
          if (!active || syncedEmail.current !== user.email) return
          if (row && row.orgId) {
            // The allowlist is the sole source of the `super_admin` tier: a
            // super-admin email is always hydrated as `super_admin`; for anyone
            // else a `super_admin` assignment is clamped down, so only the one
            // operator holds platform Super Admin access no matter what the
            // directory row says.
            const role = effectiveViewLevel(user.email, row.role)
            const orgName = row.scopeLabel || fallbackOrgName
            // Only re-hydrate when the directory genuinely changes the workspace,
            // avoiding a redundant re-render for ordinary self-registrants.
            if (row.orgId !== SELF_ORG_ID || role !== signInRole || orgName !== fallbackOrgName) {
              login(user.email, row.orgId, role, orgName)
            }
          }
        })
      } else {
        if (syncedEmail.current === null) return
        syncedEmail.current = null
        logout()
      }
    }

    // 1) Handle a confirmation / recovery / OAuth token landing in the URL hash.
    //    When a freshly confirmed user clicks the email link they arrive here,
    //    get signed in, and are taken straight into the secure workspace.
    handleAuthCallback()
      .then(result => {
        if (result?.user) {
          sync(result.user)
          navigate({ to: '/dashboard' })
        }
      })
      .catch(() => {
        // Malformed or expired hash - ignore and fall through to normal load.
      })

    // 2) Hydrate from any existing session and stay in sync with future changes
    //    (login, logout, cross-tab changes, token refresh). Once this initial
    //    read settles — whether it finds a session or not — the auth gate opens
    //    so route guards can act on a known state instead of a transient null.
    getUser()
      .then(sync)
      .catch(() => {})
      .finally(() => {
        if (active) setAuthReady(true)
      })
    const unsubscribe = onAuthChange((_event, user) => sync(user ?? null))

    return () => {
      active = false
      unsubscribe()
    }
  }, [login, logout, navigate, setAuthReady])

  return <>{children}</>
}
