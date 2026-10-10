import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  MOCK_ORGANIZATIONS,
  MOCK_PORTFOLIOS,
  MOCK_QUESTIONS,
  Question,
  Organization,
  Portfolio,
  UNIVERSAL_RISKS,
  RiskStatus,
  AUDIT_LOG,
  AuditEntry,
  ViewLevel,
  getViewLevel,
  isSuperAdminEmail,
  buildWelcomeEmailHtml,
  computeImplementationEvidence,
  clampSessionTimeout,
  SESSION_TIMEOUT_DEFAULT,
  LensId,
  defaultActiveLenses,
  Archetype,
} from './data'
import * as api from './api'
import { offlineDB } from './offline/db'
import { queueAndSync } from './offline/sync-engine'
import type { JurisdictionId, SectorArchetype } from './regulatory-context'
import { usePersistedTenantState, type SaveStatus } from './legacy-state'
import { clearOfflineSession } from './offline/session'

// ============================================================================
// This used to be a single AppContext exposing 40+ values through one object,
// recreated (and thus re-rendered to every one of its ~25 consumers) on every
// state change anywhere in the app — typing one assessment score re-rendered
// the admin team directory, the audit log, everything mounted. It's now split
// into focused contexts grouped by how often they actually change together:
// Scores (changes every keystroke) is isolated from Workspace/Auth/Team/etc.
// (change rarely), so a component that only reads e.g. the team directory no
// longer re-renders when someone elsewhere is filling out an assessment.
//
// All state/effects/callbacks still live in ONE AppProvider component body
// (below) — they're genuinely interdependent internally (nearly everything
// reads currentUser and calls appendAudit). Only how the final values are
// grouped and exposed to consumers has changed. Each exported hook
// (useAuthCtx, useWorkspace, useScoresCtx, etc.) reads its own memoized
// context, so a component only re-renders when the slice it actually asked
// for changes.
// ============================================================================

// A user's view level (Organization Assessor / Portfolio Reviewer / Super
// Admin) is the single preference that drives what they can see across the app.
export type UserRole = ViewLevel

// A person with access to the current workspace. Members are invited by the
// workspace owner and each carries a view level plus the scope it applies to.
export interface TeamMember {
  id: string
  name: string
  email: string
  title: string
  role: UserRole
  scopeId?: string
  scopeLabel: string
  status: 'active' | 'invited'
  invitedAt: string
}

export interface InviteInput {
  name: string
  email: string
  title: string
  role: UserRole
  scopeId?: string
  scopeLabel: string
}

// Fields captured when a Portfolio Reviewer or Super Admin registers a new
// institution into their administration.
export interface CreateOrgInput {
  name: string
  country: string
  targetDonor: string
  email: string
}

// Fields captured when creating a portfolio (a named grouping of institutions).
export interface CreatePortfolioInput {
  name: string
  orgIds: string[]
}

// The institutional identity that drives dynamic question filtering and the
// Pan-African Data Room: which archetype the entity is, and the country/sector/
// subsector it operates in. A live workspace starts blank and the user picks
// these; the demo seeds an illustrative Nigerian digital-lending fintech.
export interface EntityProfile {
  archetype: Archetype | ''
  country: string
  sector: string
  subsector: string
  // Global Regulatory context (Feature 1): the jurisdictions the entity operates
  // in / targets for capital, and the regulatory sector archetype. These drive
  // dynamic injection of statutory checklists into the Data Room & Wizard.
  jurisdictions: JurisdictionId[]
  regSector: SectorArchetype | ''
}

interface AuthUser {
  id: string
  email: string
  orgId: string
  role: UserRole
  orgName: string
  portfolioId?: string
  // Demo sessions are fully isolated from the live workspace: they are seeded
  // with illustrative sample data and never persist to a real vault.
  isDemo: boolean
}

// --- Per-domain context shapes -----------------------------------------------

interface AuthContextType {
  currentUser: AuthUser | null
  isDemo: boolean
  onboardingComplete: boolean
  // False until Netlify Identity has resolved the initial session (from the URL
  // hash or an existing cookie). Route guards wait for this before deciding to
  // bounce a visitor to /auth, so a signed-in user is never briefly redirected
  // out while the session is still hydrating.
  authReady: boolean
  setAuthReady: (ready: boolean) => void
  login: (email: string, orgId: string, role: UserRole, orgName: string) => void
  register: (email: string, orgName: string) => void
  completeOnboarding: () => void
  logout: () => void
  setRole: (role: UserRole) => void
  // Security-bounded idle session timeout (minutes). Users may tune it, but
  // only within the permitted 5–60 minute range - see clampSessionTimeout.
  sessionTimeout: number
  setSessionTimeout: (minutes: number) => void
  // Demo entry (opens a seeded, throwaway session - used by the public demo tabs)
  enterDemo: (role: UserRole) => void
}

interface WorkspaceContextType {
  organizations: Organization[]
  portfolios: Portfolio[]
  createOrganization: (input: CreateOrgInput) => Organization
  editOrganization: (id: string, patch: Partial<CreateOrgInput>) => void
  deleteOrganization: (id: string) => void
  archiveOrganization: (id: string) => void
  restoreOrganization: (id: string) => void
  createPortfolio: (input: CreatePortfolioInput) => Portfolio
  deletePortfolio: (id: string) => void
  renamePortfolio: (id: string, name: string) => void
  archivePortfolio: (id: string) => void
  restorePortfolio: (id: string) => void
  currentOrg: Organization | null
  // Portfolio Reviewer drill-down: open any administered/granted client's
  // workspace (Dashboard, Findings, Evidence, CIP) read-only. `null` = the
  // reviewer's own workspace. `readOnly` is true while a client is active so
  // the reviewer cannot mutate the client's data from within the drill-down.
  activeClientOrgId: string | null
  setActiveClient: (orgId: string | null) => void
  isViewingClient: boolean
  readOnly: boolean
}

interface ScoresContextType {
  scores: Record<string, Record<string, number>>
  updateScore: (orgId: string, qId: string, score: number) => void
  getScore: (orgId: string, qId: string) => number
  bulkImportScores: (orgId: string, imported: Record<string, number>) => void
  assessorScores: Record<string, Record<string, number>>
  updateAssessorScore: (orgId: string, qId: string, score: number) => void
  getAssessorScore: (orgId: string, qId: string) => number
  scoreAttribution: Record<string, Record<string, string>>
  implementationEvidence: number
  refreshScores: () => Promise<void>
}

interface QuestionsContextType {
  questions: Question[]
}

interface AccessContextType {
  accessGrants: api.AccessGrant[]
  grantAccess: (orgId: string, grantee: string, portfolioId?: string) => void
  revokeAccess: (orgId: string, grantee: string) => void
  sentInvitations: api.Invitation[]
  firm: api.Firm | null
  createFirmEntity: (name: string) => void
  addFirmSeat: (email: string, role?: 'owner' | 'consultant') => void
  removeFirmSeat: (email: string) => void
}

interface CIPContextType {
  cipStatuses: Record<string, RiskStatus>
  updateCIPStatus: (riskId: string, status: RiskStatus) => void
}

interface LensContextType {
  activeLenses: Record<LensId, boolean>
  toggleLens: (id: LensId) => void
  setLensActive: (id: LensId, on: boolean) => void
  mandatoryLenses: Record<LensId, boolean>
  setMandatoryLens: (id: LensId, on: boolean) => void
  lensSaveStatus: SaveStatus
  mandateSaveStatus: SaveStatus
}

interface EntityProfileContextType {
  entityProfile: EntityProfile
  setEntityProfile: (patch: Partial<EntityProfile>) => void
  profileSaveStatus: SaveStatus
}

interface TeamContextType {
  teamMembers: TeamMember[]
  inviteTeamMember: (input: InviteInput) => void
  updateTeamMemberRole: (id: string, role: UserRole, scopeId: string | undefined, scopeLabel: string) => void
  removeTeamMember: (id: string) => void
}

interface AuditContextType {
  auditLog: AuditEntry[]
  logActivity: (action: string, target: string, category: AuditEntry['category']) => void
}

const AuthCtx = createContext<AuthContextType | null>(null)
const WorkspaceCtx = createContext<WorkspaceContextType | null>(null)
const ScoresCtx = createContext<ScoresContextType | null>(null)
const QuestionsCtx = createContext<QuestionsContextType | null>(null)
const AccessCtx = createContext<AccessContextType | null>(null)
const CIPCtx = createContext<CIPContextType | null>(null)
const LensCtx = createContext<LensContextType | null>(null)
const EntityProfileCtx = createContext<EntityProfileContextType | null>(null)
const TeamCtx = createContext<TeamContextType | null>(null)
const AuditCtx = createContext<AuditContextType | null>(null)

// Stable identifier for a live (non-demo) tenant's own workspace.
export const SELF_ORG_ID = 'self'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function nowStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// Merge two access-grant lists, deduped by (orgId, grantee) with the later list
// winning so a status flip (accept/revoke) always replaces the stale row.
function mergeGrants(prev: api.AccessGrant[], incoming: api.AccessGrant[]): api.AccessGrant[] {
  const byKey = new Map<string, api.AccessGrant>()
  for (const g of prev) byKey.set(`${g.orgId}|${g.grantee}`, g)
  for (const g of incoming) byKey.set(`${g.orgId}|${g.grantee}`, g)
  return [...byKey.values()]
}

// Merge firm seats, deduped by email with the later entry winning.
function mergeSeats(prev: api.FirmSeat[], incoming: api.FirmSeat[]): api.FirmSeat[] {
  const byEmail = new Map<string, api.FirmSeat>()
  for (const s of prev) byEmail.set(s.email, s)
  for (const s of incoming) byEmail.set(s.email, s)
  return [...byEmail.values()]
}

// Seed every demo tenant with its illustrative sample scores.
function buildDemoScores(): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const org of MOCK_ORGANIZATIONS) out[org.id] = { ...org.scores }
  return out
}

function buildDemoCIP(): Record<string, RiskStatus> {
  const out: Record<string, RiskStatus> = {}
  for (const r of UNIVERSAL_RISKS) out[r.id] = r.status
  return out
}

// Illustrative co-assessors for the demo workspace - one of each view level so
// the Team & Roles screen shows the full range of preferences.
function buildDemoTeam(orgName: string): TeamMember[] {
  return [
    {
      id: 'tm-demo-1', name: 'Amara Okeke', email: 'a.okeke@craft.demo', title: 'Finance Lead',
      role: 'assessor', scopeLabel: orgName, status: 'active', invitedAt: '2025-05-12 09:14:00',
    },
    {
      id: 'tm-demo-2', name: 'Daniel Mwangi', email: 'd.mwangi@craft.demo', title: 'Programme Director',
      role: 'portfolio', scopeId: 'pf-east', scopeLabel: 'East Africa Portfolio',
      status: 'active', invitedAt: '2025-05-18 15:40:00',
    },
    {
      id: 'tm-demo-3', name: 'Priya Sharma', email: 'p.sharma@craft.demo', title: 'Consortium Administrator',
      role: 'admin', scopeLabel: 'Consortium administration', status: 'invited', invitedAt: '2025-06-02 11:05:00',
    },
  ]
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Start signed-out so the public storefront is the entry point. The live
  // workspace starts EMPTY - no mock data - and is filled by the user's answers.
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [onboardingComplete, setOnboardingComplete] = useState(true)
  // Gate that flips true once IdentityBridge has resolved the initial session.
  const [authReady, setAuthReady] = useState(false)
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({})
  // Independent-assessor scores and per-question attribution, kept parallel to
  // `scores` and hydrated from the Trust Delta detail columns.
  const [assessorScores, setAssessorScores] = useState<Record<string, Record<string, number>>>({})
  const [scoreAttribution, setScoreAttribution] = useState<Record<string, Record<string, string>>>({})
  // The question bank, hydrated from the database on mount. Starts from the
  // in-code bank so the wizard renders instantly, then is replaced by the
  // DB-served copy (identical data, but now the persisted source of truth).
  const [questions, setQuestions] = useState<Question[]>(MOCK_QUESTIONS)
  // Live workspaces start with NO institutions or portfolios - the seeded mock
  // data is reserved for the throwaway demo session only.
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  // Portfolio Reviewer drill-down target (null = own workspace).
  const [activeClientOrgId, setActiveClientOrgId] = useState<string | null>(null)
  // Cross-tenant access grants, consulting firm, and sent invitations.
  const [accessGrants, setAccessGrants] = useState<api.AccessGrant[]>([])
  const [firm, setFirm] = useState<api.Firm | null>(null)
  const [sentInvitations, setSentInvitations] = useState<api.Invitation[]>([])
  const orgSeq = useRef(0)
  const pfSeq = useRef(0)
  const [cipStatuses, setCipStatuses] = useState<Record<string, RiskStatus>>({})
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const teamSeq = useRef(0)
  const [sessionTimeout, setSessionTimeoutState] = useState<number>(SESSION_TIMEOUT_DEFAULT)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const auditSeq = useRef(0)
  // Active thematic lenses (Core Foundation is always on, tracked implicitly).
  const [activeLenses, setActiveLenses, lensSaveStatus] = usePersistedTenantState<Record<LensId, boolean>>(activeClientOrgId ?? currentUser?.orgId, !!currentUser?.isDemo, 'active-lenses', defaultActiveLenses, !!activeClientOrgId)
  // Portfolio-mandated lenses - forced on for every institution in the portfolio.
  const [mandatoryLenses, setMandatoryLenses, mandateSaveStatus] = usePersistedTenantState<Record<LensId, boolean>>(activeClientOrgId ?? currentUser?.orgId, !!currentUser?.isDemo, 'mandatory-lenses', {
    climate: false, emergency: false, research: false,
  }, !!activeClientOrgId)
  // Entity profile - blank in a live workspace until the user selects it.
  const [entityProfile, setEntityProfileState, profileSaveStatus] = usePersistedTenantState<EntityProfile>(activeClientOrgId ?? currentUser?.orgId, !!currentUser?.isDemo, 'entity-profile', {
    archetype: currentUser?.isDemo ? 'Private' : '', country: currentUser?.isDemo ? 'NG' : '', sector: currentUser?.isDemo ? 'Fintech' : '', subsector: currentUser?.isDemo ? 'Digital Lending & Credit' : '', jurisdictions: currentUser?.isDemo ? ['NG', 'EU'] : [], regSector: currentUser?.isDemo ? 'bank_dfi' : '',
  }, !!activeClientOrgId)

  // A reviewer drilled into a client's workspace views it strictly read-only in
  // this phase (write-back depends on the access-grant write level, deferred).
  // Kept in a ref so the mutation callbacks can gate without re-subscribing.
  const isViewingClient =
    !!activeClientOrgId &&
    !!currentUser &&
    !currentUser.isDemo &&
    (currentUser.role === 'portfolio' || currentUser.role === 'admin' || currentUser.role === 'super_admin')
  const readOnly = isViewingClient
  const readOnlyRef = useRef(false)
  readOnlyRef.current = readOnly

  // Load the question bank from the database once on mount. The endpoint lazily
  // seeds a fresh database from the canonical code bank on first call.
  useEffect(() => {
    let active = true
    api.fetchQuestions().then(rows => {
      if (active && rows && rows.length) setQuestions(rows)
    })
    return () => {
      active = false
    }
  }, [])

  // Hydrate a live (non-demo) workspace from the database whenever a different
  // tenant signs in. Demo sessions stay entirely in-memory by design. Runs once
  // per tenant (tracked by hydratedOrg) so it never clobbers in-session edits.
  const hydratedOrg = useRef<string | null>(null)
  useEffect(() => {
    if (!currentUser || currentUser.isDemo) {
      hydratedOrg.current = null
      return
    }
    const orgId = currentUser.orgId
    if (hydratedOrg.current === orgId) return
    hydratedOrg.current = orgId
    let active = true

    // Ensure the tenant's organization row exists, then load its persisted data.
    api.upsertOrganization({
      id: orgId,
      name: currentUser.orgName,
      email: currentUser.email,
      createdBy: currentUser.email,
    })
    api.fetchScores(orgId).then(loaded => {
      if (active && Object.keys(loaded).length) {
        setScores(prev => ({ ...prev, [orgId]: { ...loaded, ...(prev[orgId] || {}) } }))
      }
    })
    // Independent-assessor scores + per-question attribution come from the same
    // response rows (the Trust Delta detail columns).
    api.fetchResponseDetails(orgId).then(details => {
      if (!active || !Object.keys(details).length) return
      const asMap: Record<string, number> = {}
      const attrMap: Record<string, string> = {}
      for (const [qId, d] of Object.entries(details)) {
        if (d.assessorScore != null) asMap[qId] = d.assessorScore
        if (d.updatedBy) attrMap[qId] = d.updatedBy
      }
      if (Object.keys(asMap).length) {
        setAssessorScores(prev => ({ ...prev, [orgId]: { ...asMap, ...(prev[orgId] || {}) } }))
      }
      if (Object.keys(attrMap).length) {
        setScoreAttribution(prev => ({ ...prev, [orgId]: { ...attrMap, ...(prev[orgId] || {}) } }))
      }
    })
    // Hydrate the workspace team from the persistent user directory: everyone
    // assigned to this organisation, other than the signed-in owner.
    api.fetchUsers().then(rows => {
      if (!active) return
      const members = rows
        .filter(u => u.orgId === orgId && u.email.toLowerCase() !== currentUser.email.toLowerCase())
        .map<TeamMember>(u => ({
          id: u.id,
          name: u.name || u.email,
          email: u.email,
          title: u.title || '-',
          role: (u.role as UserRole) || 'assessor',
          scopeId: u.scopeId ?? undefined,
          scopeLabel: u.scopeLabel || currentUser.orgName,
          status: (u.status as TeamMember['status']) || 'active',
          invitedAt: '',
        }))
      if (members.length) setTeamMembers(members)
    })
    api.fetchAudit(orgId).then(entries => {
      if (active && entries.length) {
        setAuditLog(prev => {
          const seen = new Set(prev.map(e => `${e.action}|${e.target}|${e.timestamp}`))
          const merged = entries.filter(e => !seen.has(`${e.action}|${e.target}|${e.timestamp}`))
          return [...prev, ...merged]
        })
      }
    })
    api.fetchCapacityStatuses(orgId).then(statuses => {
      if (active && Object.keys(statuses).length) {
        setCipStatuses(prev => ({ ...statuses, ...prev }))
      }
    })
    // Access grants naming this org: the client-side view so an institution can
    // see which firms/reviewers hold access and revoke them (data sovereignty).
    api.fetchAccessGrants({ orgId }).then(grants => {
      if (active && grants.length) {
        setAccessGrants(prev => mergeGrants(prev, grants))
      }
    })

    // Reviewers and admins also see the institutions they administer, their
    // portfolios, every client's scores (Phase 1), the firms they belong to
    // (Phase 5), and the access grants they hold over clients (Phase 4).
    if (currentUser.role === 'portfolio' || currentUser.role === 'admin' || currentUser.role === 'super_admin') {
      const email = currentUser.email
      // Gather org ids across administered orgs + portfolio memberships +
      // active grants, then batch-load all their scores in one round-trip.
      const collectAndLoadScores = (orgIds: string[]) => {
        const unique = [...new Set(orgIds.filter(Boolean))]
        if (!unique.length) return
        api.fetchScoresForOrgs(unique, email).then(byOrg => {
          if (!active || !Object.keys(byOrg).length) return
          setScores(prev => {
            const next = { ...prev }
            for (const [id, s] of Object.entries(byOrg)) {
              next[id] = { ...s, ...(prev[id] || {}) }
            }
            return next
          })
        })
      }

      Promise.all([
        api.fetchOrganizations(email),
        api.fetchPortfolios(email),
        api.fetchAccessGrants({ grantee: email }),
      ]).then(([orgs, pfs, grants]) => {
        if (!active) return
        if (orgs.length) {
          setOrganizations(prev => {
            const ids = new Set(prev.map(o => o.id))
            return [...prev, ...orgs.filter(o => !ids.has(o.id))]
          })
        }
        if (pfs.length) {
          setPortfolios(prev => {
            const ids = new Set(prev.map(p => p.id))
            return [...prev, ...pfs.filter(p => !ids.has(p.id))]
          })
        }
        if (grants.length) setAccessGrants(prev => mergeGrants(prev, grants))
        const grantedOrgIds = grants.filter(g => g.status === 'active').map(g => g.orgId)
        const pfOrgIds = pfs.flatMap(p => p.orgIds)
        collectAndLoadScores([...orgs.map(o => o.id), ...pfOrgIds, ...grantedOrgIds])
      })

      // Firm membership (any consultant on the firm shares the client book).
      api.fetchFirms(email).then(firms => {
        if (active && firms.length) setFirm(firms[0])
      })
      api.fetchInvitations(email).then(invs => {
        if (active && invs.length) setSentInvitations(invs)
      })
    }

    return () => {
      active = false
    }
  }, [currentUser])

  const appendAudit = useCallback(
    (actor: string, action: string, target: string, category: AuditEntry['category']) => {
      auditSeq.current += 1
      const entry: AuditEntry = {
        id: `A-${auditSeq.current}`,
        timestamp: nowStamp(),
        actor,
        action,
        target,
        category,
      }
      setAuditLog(prev => [entry, ...prev])
      // Persist activity for live workspaces so the audit trail survives reloads.
      if (currentUser && !currentUser.isDemo) {
        api.postAudit({ orgId: currentUser.orgId, actor, action, target, category })
      }
    },
    [currentUser],
  )

  const logActivity = useCallback(
    (action: string, target: string, category: AuditEntry['category']) => {
      const actor = currentUser?.email ?? 'system'
      appendAudit(actor, action, target, category)
    },
    [appendAudit, currentUser],
  )

  const login = useCallback(
    (email: string, orgId: string, role: UserRole, orgName: string) => {
      // Authenticated "self" workspaces all arrive as SELF_ORG_ID; derive a
      // stable per-tenant id so each institution is isolated in the database.
      const tenantId = orgId === SELF_ORG_ID ? api.tenantOrgId(email) : orgId
      setCurrentUser({ id: `user-${email}`, email, orgId: tenantId, role, orgName, isDemo: false })
      setOnboardingComplete(true)
      setScores(prev => (prev[tenantId] ? prev : { ...prev, [tenantId]: {} }))
      setTeamMembers([])
      appendAudit(email, 'Signed in', 'Secure Workspace', 'Auth')
    },
    [appendAudit],
  )

  const register = useCallback(
    (email: string, orgName: string) => {
      // New registrants land in the guided onboarding flow with an empty vault.
      // Derive a stable per-tenant id (matching login) so the workspace is
      // isolated in the database from the very first sign-in.
      const tenantId = api.tenantOrgId(email)
      setCurrentUser({ id: `user-${email}`, email, orgId: tenantId, role: 'assessor', orgName, isDemo: false })
      setOnboardingComplete(false)
      setScores(prev => (prev[tenantId] ? prev : { ...prev, [tenantId]: {} }))
      setTeamMembers([])
      appendAudit(email, 'Registered institution', orgName, 'Auth')
    },
    [appendAudit],
  )

  const enterDemo = useCallback((role: UserRole) => {
    const org = MOCK_ORGANIZATIONS[0]
    setScores(buildDemoScores())
    setCipStatuses(buildDemoCIP())
    setAuditLog(AUDIT_LOG)
    setTeamMembers(buildDemoTeam(org.name))
    setOrganizations(MOCK_ORGANIZATIONS)
    setPortfolios(MOCK_PORTFOLIOS)
    setOnboardingComplete(true)
    // Showcase the dynamic engines with an illustrative Nigerian fintech.
    setCurrentUser({
      id: 'demo-user',
      email: 'demo@craft.dibadili',
      orgId: org.id,
      role,
      orgName: org.name,
      portfolioId: 'pf-east',
      isDemo: true,
    })
  }, [])

  const completeOnboarding = useCallback(() => setOnboardingComplete(true), [])

  const setEntityProfile = useCallback(
    (patch: Partial<EntityProfile>) => {
      if (readOnlyRef.current) return
      setEntityProfileState(prev => {
        const next = { ...prev, ...patch }
        // Changing archetype invalidates the previously selected sector and
        // subsector; changing sector invalidates the previously chosen subsector.
        if (patch.archetype !== undefined && patch.archetype !== prev.archetype) {
          if (patch.sector === undefined) next.sector = ''
          if (patch.subsector === undefined) next.subsector = ''
        }
        if (patch.sector !== undefined && patch.sector !== prev.sector && patch.subsector === undefined) {
          next.subsector = ''
        }
        return next
      })
      if (currentUser && !currentUser.isDemo) {
        const label = patch.archetype ?? patch.country ?? patch.sector ?? patch.subsector ?? ''
        appendAudit(currentUser.email, 'Updated entity profile', String(label), 'Config')
      }
    },
    [appendAudit, currentUser],
  )

  const logout = useCallback(() => {
    void clearOfflineSession().catch(error => console.warn('[session] local cleanup failed', error))
    setCurrentUser(null)
    setOnboardingComplete(true)
    // Drop all session state so the next sign-in starts from a clean vault.
    setScores({})
    setAssessorScores({})
    setScoreAttribution({})
    setCipStatuses({})
    setTeamMembers([])
    setOrganizations([])
    setPortfolios([])
    setActiveClientOrgId(null)
    setAccessGrants([])
    setFirm(null)
    setSentInvitations([])
    orgSeq.current = 0
    pfSeq.current = 0
    setAuditLog([])
    auditSeq.current = 0
  }, [])

  const setRole = useCallback((role: UserRole) => {
    setCurrentUser(prev => {
      if (!prev) return null
      // The platform `super_admin` (Super Admin) view is reserved for the single
      // allowlisted operator; no other session can switch itself into it. The
      // ordinary `admin` (Administrator) view is freely selectable.
      const next = role === 'super_admin' && !isSuperAdminEmail(prev.email) ? prev.role : role
      return { ...prev, role: next }
    })
  }, [])

  const setSessionTimeout = useCallback(
    (minutes: number) => {
      const safe = clampSessionTimeout(minutes)
      setSessionTimeoutState(safe)
      appendAudit(currentUser?.email ?? 'system', 'Updated session timeout', `${safe} minutes`, 'Auth')
    },
    [appendAudit, currentUser],
  )

  const updateScore = useCallback(
    (orgId: string, qId: string, score: number) => {
      // A reviewer drilled into a client's workspace is read-only.
      if (readOnlyRef.current) return
      // Layer 1 — instant, in-memory UI update (zero latency, no spinner).
      setScores(prev => ({ ...prev, [orgId]: { ...(prev[orgId] || {}), [qId]: score } }))
      if (currentUser && !currentUser.isDemo) {
        // Layer 2 — local-first persistence. Mirror the value into the drafts
        // store so it survives reload, then queue the authoritative write to the
        // mutations queue. queueAndSync drains immediately when online and holds
        // the write safely in IndexedDB when offline. The dedupeKey collapses
        // repeated edits to the same answer into a single pending mutation.
        const draftKey = `score:${orgId}:${qId}`
        void offlineDB.putDraft(draftKey, { orgId, qId, score, updatedBy: currentUser.email })
        void queueAndSync({
          kind: 'assessment:score',
          endpoint: '/api/responses',
          method: 'POST',
          body: { orgId, questionId: qId, score, updatedBy: currentUser.email },
          dedupeKey: draftKey,
        })
        // Record who set this self-score so co-assessors can see contributions.
        setScoreAttribution(prev => ({
          ...prev,
          [orgId]: { ...(prev[orgId] || {}), [qId]: currentUser.email },
        }))
        appendAudit(currentUser.email, 'Updated maturity score', `${qId} → ${score}`, 'Assessment')
      }
    },
    [appendAudit, currentUser],
  )

  // An independent assessor writes to assessor_score, leaving the institution's
  // self-score untouched. The two meet on the Trust Delta reconciliation screen.
  const updateAssessorScore = useCallback(
    (orgId: string, qId: string, score: number) => {
      if (readOnlyRef.current) return
      // Same local-first pattern as updateScore: instant UI update, then a
      // deduped queued write so rapid edits (e.g. a dragged slider) collapse
      // into one pending mutation instead of firing on every tick.
      setAssessorScores(prev => ({ ...prev, [orgId]: { ...(prev[orgId] || {}), [qId]: score } }))
      if (currentUser && !currentUser.isDemo) {
        const draftKey = `assessor-score:${orgId}:${qId}`
        void offlineDB.putDraft(draftKey, { orgId, qId, score, updatedBy: currentUser.email })
        void queueAndSync({
          kind: 'assessment:assessor-score',
          endpoint: '/api/responses',
          method: 'POST',
          body: { orgId, questionId: qId, assessorScore: score, updatedBy: currentUser.email },
          dedupeKey: draftKey,
        })
        setScoreAttribution(prev => ({
          ...prev,
          [orgId]: { ...(prev[orgId] || {}), [qId]: currentUser.email },
        }))
        appendAudit(currentUser.email, 'Updated independent score', `${qId} → ${score}`, 'Assessment')
      }
    },
    [appendAudit, currentUser],
  )

  const getAssessorScore = useCallback(
    (orgId: string, qId: string) => assessorScores[orgId]?.[qId] ?? 0,
    [assessorScores],
  )

  const bulkImportScores = useCallback(
    (orgId: string, imported: Record<string, number>) => {
      if (readOnlyRef.current) return
      setScores(prev => ({ ...prev, [orgId]: { ...(prev[orgId] || {}), ...imported } }))
      if (currentUser && !currentUser.isDemo) {
        api.saveScoresBulk(orgId, imported)
        appendAudit(currentUser.email, 'Bulk import', `${Object.keys(imported).length} scores`, 'Assessment')
      }
    },
    [appendAudit, currentUser],
  )

  const getScore = useCallback(
    (orgId: string, qId: string) => scores[orgId]?.[qId] ?? 0,
    [scores],
  )
  const refreshScores = useCallback(async () => {
    if (!currentUser || currentUser.isDemo) return
    const sessionOrg = hydratedOrg.current
    const ids = [...new Set([currentUser.orgId, ...organizations.map(org => org.id)])]
    const records = await Promise.all(ids.map(async id => [id, await api.fetchResponseRecords(id)] as const))
    if (hydratedOrg.current !== sessionOrg) return
    setScores(prev => {
      const next = { ...prev }
      for (const [id, record] of records) next[id] = record.scores
      return next
    })
  }, [currentUser, organizations])

  const updateCIPStatus = useCallback((riskId: string, status: RiskStatus) => {
    if (readOnlyRef.current) return
    setCipStatuses(prev => ({ ...prev, [riskId]: status }))
    if (currentUser && !currentUser.isDemo) {
      api.saveCapacityStatus(currentUser.orgId, riskId, status)
    }
  }, [currentUser])

  // A portfolio-mandated lens can never be switched off by the institution.
  const setLensActive = useCallback(
    (id: LensId, on: boolean) => {
      if (readOnlyRef.current) return
      setActiveLenses(prev => ({ ...prev, [id]: mandatoryLenses[id] ? true : on }))
      if (currentUser && !currentUser.isDemo) {
        appendAudit(currentUser.email, on ? 'Activated lens' : 'Deactivated lens', id, 'Config')
      }
    },
    [appendAudit, currentUser, mandatoryLenses],
  )

  const toggleLens = useCallback(
    (id: LensId) => {
      if (readOnlyRef.current) return
      setActiveLenses(prev => {
        const next = mandatoryLenses[id] ? true : !prev[id]
        return { ...prev, [id]: next }
      })
    },
    [mandatoryLenses],
  )

  // Mandating a lens forces it on across the workspace immediately.
  const setMandatoryLens = useCallback(
    (id: LensId, on: boolean) => {
      if (readOnlyRef.current) return
      setMandatoryLenses(prev => ({ ...prev, [id]: on }))
      if (on) setActiveLenses(prev => ({ ...prev, [id]: true }))
      appendAudit(
        currentUser?.email ?? 'system',
        on ? 'Mandated lens for portfolio' : 'Lifted lens mandate',
        id,
        'Config',
      )
    },
    [appendAudit, currentUser],
  )

  const inviteTeamMember = useCallback(
    (input: InviteInput) => {
      // Persist to the user directory so the assignment survives sign-out and is
      // seen by the invitee when they log in (they resolve to this org + role).
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? `usr_${crypto.randomUUID()}`
          : `tm-${(teamSeq.current += 1)}`
      const member: TeamMember = {
        id,
        status: 'invited',
        invitedAt: nowStamp(),
        ...input,
      }
      setTeamMembers(prev => [member, ...prev])
      if (currentUser && !currentUser.isDemo) {
        api.upsertUser({
          id,
          email: input.email,
          name: input.name,
          title: input.title,
          orgId: currentUser.orgId,
          role: input.role,
          scopeId: input.scopeId ?? null,
          scopeLabel: input.scopeLabel,
          status: 'invited',
        })
        // Persist a tokenised invitation and dispatch the branded welcome email.
        // The email is a real transactional send when a mail provider is
        // configured server-side, and degrades gracefully otherwise. This closes
        // the previous "welcome email is a template only" gap.
        api.createInvitation({
          email: input.email,
          inviter: currentUser.email,
          inviterName: currentUser.email,
          portfolioId: input.scopeId,
          role: input.role,
          scopeLabel: input.scopeLabel,
        }).then(inv => {
          if (!inv) return
          setSentInvitations(prev => [inv, ...prev])
          const { subject, html } = buildWelcomeEmailHtml({
            name: input.name,
            email: input.email,
            role: input.role,
            scopeLabel: input.scopeLabel,
            inviterName: currentUser.email,
            inviterEmail: currentUser.email,
          })
          api.sendInviteEmail({ to: input.email, subject, html })
        })
      }
      appendAudit(
        currentUser?.email ?? 'system',
        'Invited co-assessor',
        `${input.email} · ${getViewLevel(input.role).short}`,
        'Auth',
      )
    },
    [appendAudit, currentUser],
  )

  const updateTeamMemberRole = useCallback(
    (id: string, role: UserRole, scopeId: string | undefined, scopeLabel: string) => {
      setTeamMembers(prev => prev.map(m => (m.id === id ? { ...m, role, scopeId, scopeLabel } : m)))
      const member = teamMembers.find(m => m.id === id)
      if (member) {
        if (currentUser && !currentUser.isDemo) {
          api.upsertUser({
            id,
            email: member.email,
            name: member.name,
            title: member.title,
            orgId: currentUser.orgId,
            role,
            scopeId: scopeId ?? null,
            scopeLabel,
            status: member.status,
          })
        }
        appendAudit(
          currentUser?.email ?? 'system',
          'Changed access level',
          `${member.email} → ${getViewLevel(role).short}`,
          'Auth',
        )
      }
    },
    [appendAudit, currentUser, teamMembers],
  )

  const removeTeamMember = useCallback(
    (id: string) => {
      const member = teamMembers.find(m => m.id === id)
      setTeamMembers(prev => prev.filter(m => m.id !== id))
      if (member) {
        if (currentUser && !currentUser.isDemo) api.deleteUser(member.email)
        appendAudit(currentUser?.email ?? 'system', 'Revoked access', member.email, 'Auth')
      }
    },
    [appendAudit, currentUser, teamMembers],
  )

  // The reviewer of record for anything the signed-in user creates. The platform
  // Super Admin is deliberately never recorded - platform oversight is not a
  // "reviewer", so institutions and portfolios never list the operator watching
  // over them. An ordinary Administrator, who genuinely administers their own
  // institutions, IS recorded as their reviewer.
  const reviewerOfRecord = (): string | undefined =>
    currentUser && currentUser.role !== 'super_admin' ? currentUser.email : undefined

  const createOrganization = useCallback(
    (input: CreateOrgInput): Organization => {
      orgSeq.current += 1
      const today = nowStamp().split(' ')[0]
      // Use a globally-unique id so the row is stable across the optimistic UI
      // update and the database write.
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? `org_${crypto.randomUUID()}`
          : `org-new-${orgSeq.current}`
      const org: Organization = {
        id,
        name: input.name.trim(),
        country: input.country.trim(),
        targetDonor: input.targetDonor.trim(),
        email: input.email.trim(),
        createdAt: today,
        lastUpdated: today,
        scores: {},
        reviewer: reviewerOfRecord(),
      }
      setOrganizations(prev => [...prev, org])
      setScores(prev => (prev[org.id] ? prev : { ...prev, [org.id]: {} }))
      // Persist for live workspaces (demo institutions stay in-memory).
      if (currentUser && !currentUser.isDemo) {
        api.upsertOrganization({
          id: org.id,
          name: org.name,
          country: org.country,
          targetDonor: org.targetDonor,
          email: org.email,
          reviewer: org.reviewer,
          createdBy: currentUser.email,
        })
      }
      appendAudit(currentUser?.email ?? 'system', 'Created institution', org.name, 'Config')
      return org
    },
    [appendAudit, currentUser],
  )

  const editOrganization = useCallback(
    (id: string, patch: Partial<CreateOrgInput>) => {
      setOrganizations(prev =>
        prev.map(o => (o.id === id ? { ...o, ...patch, lastUpdated: nowStamp().split(' ')[0] } : o)),
      )
      if (currentUser && !currentUser.isDemo) {
        api.updateOrganization({ id, ...patch })
        appendAudit(currentUser.email, 'Edited institution', patch.name ?? id, 'Config')
      }
    },
    [appendAudit, currentUser],
  )

  const deleteOrganization = useCallback(
    (id: string) => {
      setOrganizations(prev => prev.filter(o => o.id !== id))
      if (currentUser && !currentUser.isDemo) {
        api.deleteOrganization(id)
        appendAudit(currentUser.email, 'Removed institution', id, 'Config')
      }
    },
    [appendAudit, currentUser],
  )

  // Soft-archive / restore an institution. The row is retained (with all its
  // data) and simply flagged, so working surfaces can hide it while it stays
  // recoverable. Demo sessions mutate in-memory only.
  const setOrgStatus = useCallback(
    (id: string, status: 'active' | 'archived') => {
      setOrganizations(prev => prev.map(o => (o.id === id ? { ...o, status } : o)))
      const org = organizations.find(o => o.id === id)
      if (currentUser && !currentUser.isDemo) {
        api.setOrganizationStatus(id, status)
        appendAudit(
          currentUser.email,
          status === 'archived' ? 'Archived institution' : 'Restored institution',
          org?.name ?? id,
          'Config',
        )
      }
    },
    [appendAudit, currentUser, organizations],
  )
  const archiveOrganization = useCallback((id: string) => setOrgStatus(id, 'archived'), [setOrgStatus])
  const restoreOrganization = useCallback((id: string) => setOrgStatus(id, 'active'), [setOrgStatus])

  const createPortfolio = useCallback(
    (input: CreatePortfolioInput): Portfolio => {
      pfSeq.current += 1
      // Globally-unique id so the row is stable across the optimistic UI update
      // and the database write (mirrors createOrganization).
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? `pf_${crypto.randomUUID()}`
          : `pf-new-${pfSeq.current}`
      const portfolio: Portfolio = {
        id,
        name: input.name.trim(),
        orgIds: [...input.orgIds],
        reviewer: reviewerOfRecord(),
      }
      setPortfolios(prev => [...prev, portfolio])
      // Persist for live workspaces so portfolios survive reload (demo stays
      // in-memory). Membership is stored in the portfolio_orgs join table.
      if (currentUser && !currentUser.isDemo) {
        api.savePortfolio({
          id,
          name: portfolio.name,
          orgIds: portfolio.orgIds,
          reviewer: portfolio.reviewer,
          firmId: firm?.id,
          createdBy: currentUser.email,
        })
      }
      appendAudit(
        currentUser?.email ?? 'system',
        'Created portfolio',
        `${portfolio.name} · ${portfolio.orgIds.length} institutions`,
        'Config',
      )
      return portfolio
    },
    [appendAudit, currentUser, firm],
  )

  const deletePortfolio = useCallback(
    (id: string) => {
      setPortfolios(prev => prev.filter(p => p.id !== id))
      if (currentUser && !currentUser.isDemo) {
        api.deletePortfolio(id)
        appendAudit(currentUser.email, 'Removed portfolio', id, 'Config')
      }
    },
    [appendAudit, currentUser],
  )

  const renamePortfolio = useCallback(
    (id: string, name: string) => {
      const clean = name.trim()
      if (!clean) return
      setPortfolios(prev => prev.map(p => (p.id === id ? { ...p, name: clean } : p)))
      if (currentUser && !currentUser.isDemo) {
        api.updatePortfolio({ id, name: clean })
        appendAudit(currentUser.email, 'Renamed portfolio', clean, 'Config')
      }
    },
    [appendAudit, currentUser],
  )

  const setPortfolioStatus = useCallback(
    (id: string, status: 'active' | 'archived') => {
      setPortfolios(prev => prev.map(p => (p.id === id ? { ...p, status } : p)))
      const pf = portfolios.find(p => p.id === id)
      if (currentUser && !currentUser.isDemo) {
        api.updatePortfolio({ id, status })
        appendAudit(
          currentUser.email,
          status === 'archived' ? 'Archived portfolio' : 'Restored portfolio',
          pf?.name ?? id,
          'Config',
        )
      }
    },
    [appendAudit, currentUser, portfolios],
  )
  const archivePortfolio = useCallback((id: string) => setPortfolioStatus(id, 'archived'), [setPortfolioStatus])
  const restorePortfolio = useCallback((id: string) => setPortfolioStatus(id, 'active'), [setPortfolioStatus])

  // Open (or leave) a client's workspace read-only. On entry, lazily hydrate the
  // client's scores and capacity plan if they are not already loaded.
  const setActiveClient = useCallback(
    (orgId: string | null) => {
      setActiveClientOrgId(orgId)
      if (orgId && currentUser && !currentUser.isDemo) {
        if (!scores[orgId] || Object.keys(scores[orgId]).length === 0) {
          api.fetchScoresForOrgs([orgId], currentUser.email).then(byOrg => {
            if (byOrg[orgId]) {
              setScores(prev => ({ ...prev, [orgId]: { ...byOrg[orgId], ...(prev[orgId] || {}) } }))
            }
          })
        }
        api.fetchCapacityStatuses(orgId).then(statuses => {
          if (Object.keys(statuses).length) setCipStatuses(prev => ({ ...statuses, ...prev }))
        })
        const org = organizations.find(o => o.id === orgId)
        appendAudit(currentUser.email, 'Opened client workspace (read-only)', org?.name ?? orgId, 'Auth')
      }
    },
    [appendAudit, currentUser, organizations, scores],
  )

  // Create/activate an access grant from a client org to a firm/reviewer.
  const grantAccess = useCallback(
    (orgId: string, grantee: string, portfolioId?: string) => {
      const optimistic: api.AccessGrant = {
        id: `grant-${orgId}-${grantee}`,
        orgId,
        grantee: grantee.toLowerCase(),
        grantedBy: currentUser?.email,
        level: 'read',
        status: 'active',
        portfolioId,
      }
      setAccessGrants(prev => mergeGrants(prev, [optimistic]))
      if (currentUser && !currentUser.isDemo) {
        api.saveAccessGrant({
          orgId,
          grantee,
          grantedBy: currentUser.email,
          firmId: firm?.id,
          status: 'active',
          portfolioId,
        })
        appendAudit(currentUser.email, 'Granted access', `${grantee} → ${orgId}`, 'Auth')
      }
    },
    [appendAudit, currentUser, firm],
  )

  const revokeAccess = useCallback(
    (orgId: string, grantee: string) => {
      setAccessGrants(prev =>
        prev.map(g => (g.orgId === orgId && g.grantee === grantee.toLowerCase() ? { ...g, status: 'revoked' } : g)),
      )
      if (currentUser && !currentUser.isDemo) {
        api.updateAccessGrantStatus(orgId, grantee.toLowerCase(), 'revoked')
        appendAudit(currentUser.email, 'Revoked access', `${grantee} ✕ ${orgId}`, 'Auth')
      }
    },
    [appendAudit, currentUser],
  )

  const createFirmEntity = useCallback(
    (name: string) => {
      if (!currentUser || currentUser.isDemo) return
      api.createFirm(name.trim(), currentUser.email).then(created => {
        if (created) {
          setFirm({ ...created, members: [{ email: currentUser.email.toLowerCase(), role: 'owner', status: 'active' }] })
        }
      })
      appendAudit(currentUser.email, 'Created firm', name.trim(), 'Config')
    },
    [appendAudit, currentUser],
  )

  const addFirmSeat = useCallback(
    (email: string, role: 'owner' | 'consultant' = 'consultant') => {
      if (!firm || !currentUser || currentUser.isDemo) return
      const seat: api.FirmSeat = { email: email.trim().toLowerCase(), role, status: 'active' }
      setFirm(prev => (prev ? { ...prev, members: mergeSeats(prev.members, [seat]) } : prev))
      api.saveFirmMember({ firmId: firm.id, email: seat.email, role, status: 'active' })
      appendAudit(currentUser.email, 'Added firm consultant', seat.email, 'Auth')
    },
    [appendAudit, currentUser, firm],
  )

  const removeFirmSeat = useCallback(
    (email: string) => {
      if (!firm || !currentUser || currentUser.isDemo) return
      const lower = email.trim().toLowerCase()
      setFirm(prev => (prev ? { ...prev, members: prev.members.filter(m => m.email !== lower) } : prev))
      api.deleteFirmMember(firm.id, lower)
      appendAudit(currentUser.email, 'Removed firm consultant', lower, 'Auth')
    },
    [appendAudit, currentUser, firm],
  )

  // Resolve the current organization. Demo sessions map onto a sample tenant;
  // live sessions synthesize a workspace scoped to the signed-in institution.
  // When a reviewer has drilled into a client, resolve to that client's org so
  // every working surface (Dashboard, Findings, Evidence, CIP) renders it.
  // Deliberately does NOT embed `.scores` (unlike the old single-context
  // version) — nothing reads it (confirmed: no component accesses
  // `currentOrg.scores` anywhere), and embedding it here would recouple the
  // Workspace context to every scores change, defeating the point of the split.
  // Callers needing the current org's scores read them from useScoresCtx().
  const currentOrg: Organization | null = useMemo(() => {
    if (!currentUser) return null
    if (currentUser.isDemo) return organizations.find(o => o.id === currentUser.orgId) ?? null
    if (isViewingClient && activeClientOrgId) {
      const client = organizations.find(o => o.id === activeClientOrgId)
      if (client) return client
    }
    return {
      id: currentUser.orgId,
      name: currentUser.orgName,
      country: '',
      targetDonor: '',
      email: currentUser.email,
      createdAt: '',
      lastUpdated: '',
      scores: {},
    }
  }, [currentUser, organizations, isViewingClient, activeClientOrgId])

  const implementationEvidence = useMemo(
    () => (currentOrg ? computeImplementationEvidence(scores[currentOrg.id] || {}) : 0),
    [currentOrg, scores],
  )

  // --- Memoized per-domain context values --------------------------------
  const authValue = useMemo<AuthContextType>(
    () => ({
      currentUser, isDemo: currentUser?.isDemo ?? false, onboardingComplete,
      authReady, setAuthReady,
      login, register, completeOnboarding, logout, setRole, enterDemo,
      sessionTimeout, setSessionTimeout,
    }),
    [currentUser, onboardingComplete, authReady, login, register, completeOnboarding, logout, setRole, enterDemo, sessionTimeout, setSessionTimeout],
  )

  const workspaceValue = useMemo<WorkspaceContextType>(
    () => ({
      organizations, portfolios, createOrganization, editOrganization, deleteOrganization,
      archiveOrganization, restoreOrganization,
      createPortfolio, deletePortfolio, renamePortfolio, archivePortfolio, restorePortfolio,
      currentOrg, activeClientOrgId, setActiveClient, isViewingClient, readOnly,
    }),
    [organizations, portfolios, createOrganization, editOrganization, deleteOrganization, archiveOrganization, restoreOrganization, createPortfolio, deletePortfolio, renamePortfolio, archivePortfolio, restorePortfolio, currentOrg, activeClientOrgId, setActiveClient, isViewingClient, readOnly],
  )

  const scoresValue = useMemo<ScoresContextType>(
    () => ({
      scores, updateScore, getScore, bulkImportScores,
      assessorScores, updateAssessorScore, getAssessorScore, scoreAttribution,
      implementationEvidence, refreshScores,
    }),
    [scores, updateScore, getScore, bulkImportScores, assessorScores, updateAssessorScore, getAssessorScore, scoreAttribution, implementationEvidence, refreshScores],
  )

  const questionsValue = useMemo<QuestionsContextType>(() => ({ questions }), [questions])

  const accessValue = useMemo<AccessContextType>(
    () => ({
      accessGrants, grantAccess, revokeAccess, sentInvitations,
      firm, createFirmEntity, addFirmSeat, removeFirmSeat,
    }),
    [accessGrants, grantAccess, revokeAccess, sentInvitations, firm, createFirmEntity, addFirmSeat, removeFirmSeat],
  )

  const cipValue = useMemo<CIPContextType>(
    () => ({ cipStatuses, updateCIPStatus }),
    [cipStatuses, updateCIPStatus],
  )

  const lensValue = useMemo<LensContextType>(
    () => ({ activeLenses, toggleLens, setLensActive, mandatoryLenses, setMandatoryLens, lensSaveStatus, mandateSaveStatus }),
    [activeLenses, toggleLens, setLensActive, mandatoryLenses, setMandatoryLens, lensSaveStatus, mandateSaveStatus],
  )

  const entityProfileValue = useMemo<EntityProfileContextType>(
    () => ({ entityProfile, setEntityProfile, profileSaveStatus }),
    [entityProfile, setEntityProfile, profileSaveStatus],
  )

  const teamValue = useMemo<TeamContextType>(
    () => ({ teamMembers, inviteTeamMember, updateTeamMemberRole, removeTeamMember }),
    [teamMembers, inviteTeamMember, updateTeamMemberRole, removeTeamMember],
  )

  const auditValue = useMemo<AuditContextType>(
    () => ({ auditLog, logActivity }),
    [auditLog, logActivity],
  )

  return (
    <AuthCtx.Provider value={authValue}>
      <WorkspaceCtx.Provider value={workspaceValue}>
        <ScoresCtx.Provider value={scoresValue}>
          <QuestionsCtx.Provider value={questionsValue}>
            <AccessCtx.Provider value={accessValue}>
              <CIPCtx.Provider value={cipValue}>
                <LensCtx.Provider value={lensValue}>
                  <EntityProfileCtx.Provider value={entityProfileValue}>
                    <TeamCtx.Provider value={teamValue}>
                      <AuditCtx.Provider value={auditValue}>{children}</AuditCtx.Provider>
                    </TeamCtx.Provider>
                  </EntityProfileCtx.Provider>
                </LensCtx.Provider>
              </CIPCtx.Provider>
            </AccessCtx.Provider>
          </QuestionsCtx.Provider>
        </ScoresCtx.Provider>
      </WorkspaceCtx.Provider>
    </AuthCtx.Provider>
  )
}

function useCtx<T>(ctx: React.Context<T | null>, name: string): T {
  const v = useContext(ctx)
  if (!v) throw new Error(`${name} must be used within AppProvider`)
  return v
}

export const useAuthCtx = () => useCtx(AuthCtx, 'useAuthCtx')
export const useWorkspace = () => useCtx(WorkspaceCtx, 'useWorkspace')
export const useScoresCtx = () => useCtx(ScoresCtx, 'useScoresCtx')
export const useQuestionsCtx = () => useCtx(QuestionsCtx, 'useQuestionsCtx')
export const useAccessCtx = () => useCtx(AccessCtx, 'useAccessCtx')
export const useCIPCtx = () => useCtx(CIPCtx, 'useCIPCtx')
export const useLensCtx = () => useCtx(LensCtx, 'useLensCtx')
export const useEntityProfileCtx = () => useCtx(EntityProfileCtx, 'useEntityProfileCtx')
export const useTeamCtx = () => useCtx(TeamCtx, 'useTeamCtx')
export const useAuditCtx = () => useCtx(AuditCtx, 'useAuditCtx')
