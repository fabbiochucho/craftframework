import { useEffect, useState } from 'react'
import { Link, useRouterState, useNavigate } from '@tanstack/react-router'
import { logout as identityLogout } from '@netlify/identity'
import { cn } from '../lib/utils'
import { useAuthCtx, useWorkspace, useScoresCtx } from '../lib/context'
import { Badge } from './ui'
import { Footer } from './Footer'
import { Logo } from './Logo'
import { LanguageToggle } from './LanguageToggle'
import { SessionTimer } from './SessionTimer'
import { ComplianceDeadlineBadge } from './ComplianceDeadlineBadge'
import { useOfflineSecurity } from '../hooks/use-offline-security'
import { BRAND, getAccreditation, computeOrgScore } from '../lib/data'
import {
  LayoutDashboard, ClipboardList, AlertTriangle, TrendingUp, FileBarChart,
  Settings, ScrollText, HelpCircle, Shield, Network, Menu, X, LogOut, Building2,
  Users, Lock, CalendarClock, FolderCheck, BookOpen,
  Layers, Scale, Banknote, Eye, ArrowLeft, Globe, Leaf, Smartphone,
} from 'lucide-react'

// ICARF v4.0 - a single, unified workspace. The core assessment process (v3
// lineage) and the explicit framework integrations (Pact OMT/OCA, Global Fund PR
// FCR, G7/OECD AI Governance, GFA Diagnostic) are now one continuous flow rather
// than two separate sections.
const workspaceNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/frameworks', label: 'Assessment Frameworks', icon: Layers },
  { to: '/assessment', label: 'Assessment Wizard', icon: ClipboardList },
  { to: '/findings', label: 'Findings', icon: AlertTriangle },
  { to: '/verify', label: 'Trust Delta & Verify', icon: Scale },
  { to: '/cip', label: 'Capacity Plan', icon: TrendingUp },
  { to: '/finance-triangulation', label: 'Finance Triangulation', icon: Banknote },
  { to: '/data-room', label: 'Data Room & Evidence', icon: FolderCheck },
  { to: '/obligations', label: 'Obligations & Compliance', icon: CalendarClock },
  { to: '/regulatory-compliance', label: 'Global Regulatory', icon: Globe },
  { to: '/issb-disclosures', label: 'ISSB & CSRD Disclosures', icon: Leaf },
  { to: '/informal-economy', label: 'Informal Economy Track', icon: Smartphone },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
]
const orgNav = [
  { to: '/settings', label: 'Settings & Team', icon: Settings },
  { to: '/audit-log', label: 'Audit Log', icon: ScrollText },
  { to: '/help', label: 'Help & Glossary', icon: HelpCircle },
  { to: '/guide', label: 'User Guide', icon: BookOpen },
]
const adminNav = [
  { to: '/admin', label: 'Super Admin', icon: Shield },
  { to: '/admin/portfolio', label: 'Portfolio Admin', icon: Network },
]

// Secure multi-tenant vault chrome (Zones 3 & 4).
export function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, setRole, logout, onboardingComplete, enterDemo, authReady } = useAuthCtx()
  const { currentOrg, organizations, activeClientOrgId, setActiveClient, isViewingClient } = useWorkspace()
  const { scores, implementationEvidence } = useScoresCtx()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouterState()
  const navigate = useNavigate()
  const pathname = router.location.pathname

  // Sovereignty Shield — wipe the on-device buffer after 15 minutes idle, drop
  // session state, and return to the login gateway with a timeout reason. Only
  // armed for signed-in, non-demo sessions (demo data is disposable anyway).
  useOfflineSecurity({
    enabled: Boolean(currentUser) && !currentUser?.isDemo,
    onWipe: () => {
      try {
        identityLogout()
      } catch {
        /* identity may be absent in local/demo */
      }
      logout()
    },
  })

  // Route protection - bounce unauthenticated visitors to the gateway, unless a
  // `?demo=<role>` link was opened in a new tab, which bootstraps a seeded,
  // fully-isolated demo session in place.
  useEffect(() => {
    // Wait until Identity has resolved the initial session. Redirecting on the
    // transient null that exists while the session hydrates is what caused a
    // just-signed-in user to be bounced back to the login screen.
    if (!authReady) return
    if (!currentUser) {
      const demo =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('demo')
          : null
      if (demo === 'assessor' || demo === 'portfolio') {
        enterDemo(demo)
        return
      }
      navigate({ to: '/auth' })
    } else if (!onboardingComplete) {
      navigate({ to: '/onboarding' })
    }
  }, [authReady, currentUser, onboardingComplete, navigate, enterDemo])

  if (!currentUser) return null

  const composite = currentOrg ? computeOrgScore(scores[currentOrg.id] || {}) : 0
  const accred = getAccreditation(composite, implementationEvidence)

  function NavItem({ to, label, Icon, accent }: { to: string; label: string; Icon: typeof Shield; accent?: 'admin' }) {
    const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to + '/'))
    return (
      <Link
        to={to}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-all',
          active
            ? accent === 'admin'
              ? 'border-amber-300 bg-amber-500 text-slate-900 shadow-sm'
              : 'border-emerald-400 bg-emerald-500/20 text-white shadow-sm'
            : 'border-transparent text-slate-400 hover:bg-emerald-800/40 hover:text-white',
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', active && accent !== 'admin' ? 'text-emerald-400' : !active ? 'text-slate-400' : '')} />
        {label}
      </Link>
    )
  }

  return (
    <div className="flex h-screen bg-emerald-50/30 font-sans">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Vault sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-gradient-to-b from-emerald-900 to-slate-900 transition-transform duration-300 lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-3 border-b border-slate-700/60 px-5 py-5">
          <Link
            to="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg transition-opacity hover:opacity-80"
            aria-label={`${BRAND.product} - go to dashboard`}
          >
            <Logo className="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold tracking-tight text-white">{BRAND.product}</p>
              <p className="text-[10px] text-slate-400">{BRAND.framework} · Secure Vault</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Org tenant */}
        <div className="border-b border-slate-700/60 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{currentUser.orgName}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                <Lock className="h-2.5 w-2.5" /> Isolated tenant · {currentUser.orgId}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-md bg-slate-800/70 px-2.5 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-400">Accreditation</span>
            <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">
              {accred.level}
            </span>
          </div>
        </div>

        {/* Client switcher - Administrators, Portfolio Reviewers & the Super
            Admin can open any institution they administer or hold access to,
            read-only. */}
        {(currentUser.role === 'portfolio' || currentUser.role === 'admin' || currentUser.role === 'super_admin') && !currentUser.isDemo && organizations.length > 0 && (
          <div className="border-b border-slate-700/60 px-4 py-3">
            <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/80">
              <Eye className="h-3 w-3" /> Viewing
            </label>
            <select
              value={activeClientOrgId ?? ''}
              onChange={e => setActiveClient(e.target.value || null)}
              className="w-full rounded-md border border-slate-600 bg-slate-800/70 px-2 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
            >
              <option value="">My workspace</option>
              {organizations.filter(o => o.status !== 'archived').map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-emerald-400/80">ICARF v4.0 Workspace</p>
          {workspaceNav.map(i => <NavItem key={i.to} to={i.to} label={i.label} Icon={i.icon} />)}
          <p className="mb-2 mt-4 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Organization</p>
          {orgNav.map(i => <NavItem key={i.to} to={i.to} label={i.label} Icon={i.icon} />)}
          {(currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'portfolio') && (
            <>
              <p className="mb-2 mt-4 px-2 text-xs font-semibold uppercase tracking-wider text-amber-500/80">Admin Portals</p>
              {adminNav
                .filter(i => currentUser.role === 'super_admin' || i.to === '/admin/portfolio')
                .map(i => <NavItem key={i.to} to={i.to} label={i.label} Icon={i.icon} accent="admin" />)}
            </>
          )}
        </nav>

        {/* Role switcher - demo sessions only */}
        {currentUser.isDemo && (
          <div className="border-t border-slate-700/60 px-4 py-3">
            <p className="mb-2 flex items-center gap-1 text-xs text-slate-500">
              <Users className="h-3 w-3" /> Demo Role Switcher
            </p>
            <div className="flex gap-1">
              {(['assessor', 'portfolio'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    'flex-1 rounded-md py-1.5 text-[10px] font-semibold capitalize transition-all',
                    currentUser.role === r
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700/70 text-slate-300 hover:bg-slate-600',
                  )}
                >
                  {r === 'portfolio' ? 'Portfolio' : r}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-slate-700/60 px-4 py-3">
          <button
            onClick={() => {
              // Clear the real Identity session first so it can't re-hydrate the
              // demo session on the next page load, then drop local app state.
              identityLogout().catch(() => {})
              logout()
              navigate({ to: '/' })
            }}
            className="flex w-full items-center gap-2 text-xs text-slate-400 transition-colors hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6 py-3.5">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-500 hover:text-slate-800 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold text-slate-700">Secure Workspace:</span>
            <span className="hidden text-slate-500 sm:inline">{currentUser.orgName}</span>
          </div>
          <div className="flex-1" />
          <ComplianceDeadlineBadge orgId={currentOrg?.id} />
          <LanguageToggle tone="light" />
          <Badge
            className={cn(
              'text-xs',
              currentUser.role === 'super_admin'
                ? 'bg-amber-100 text-amber-800'
                : currentUser.role === 'admin'
                  ? 'bg-indigo-100 text-indigo-700'
                  : currentUser.role === 'portfolio'
                    ? 'bg-blue-100 text-blue-700'
                    : currentUser.role === 'independent'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-emerald-100 text-emerald-700',
            )}
          >
            {currentUser.role === 'super_admin'
              ? 'Super Admin'
              : currentUser.role === 'admin'
                ? 'Administrator'
                : currentUser.role === 'portfolio'
                  ? 'Portfolio Admin'
                  : currentUser.role === 'independent'
                    ? 'Independent Assessor'
                    : 'Assessor'}
          </Badge>
        </header>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {currentUser.isDemo && (
            <div className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-center text-xs font-semibold text-slate-900">
              <Users className="h-3.5 w-3.5" />
              Demo Mode: sample data for exploration only. Nothing here is saved to a live workspace.
            </div>
          )}
          {isViewingClient && currentOrg && (
            <div className="flex flex-wrap items-center justify-center gap-2 bg-blue-600 px-4 py-1.5 text-center text-xs font-semibold text-white">
              <Eye className="h-3.5 w-3.5" />
              Viewing <strong>{currentOrg.name}</strong> — read-only client workspace.
              <button
                onClick={() => setActiveClient(null)}
                className="ml-1 inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 font-semibold hover:bg-white/30"
              >
                <ArrowLeft className="h-3 w-3" /> Return to my workspace
              </button>
            </div>
          )}
          <main className="flex-1 p-6">{children}</main>
          <Footer />
        </div>
      </div>

      <SessionTimer />
    </div>
  )
}
