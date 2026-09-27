import { useState } from 'react'
import { Settings, Building2, Users, Shield, Lock, UserPlus, X, Check, Layers, Clock, Mail, Eye, Globe, Briefcase, ShieldOff } from 'lucide-react'
import { useAuthCtx, useTeamCtx, useWorkspace, useLensCtx, useEntityProfileCtx, useAccessCtx, UserRole } from '../lib/context'
import { Card, CardContent, CardHeader, CardTitle, Input, Select, Button, Badge, Tabs, Toast, Switch } from '../components/ui'
import { VIEW_LEVELS, ASSIGNABLE_VIEW_LEVELS, getViewLevel, isSuperAdminEmail, Portfolio, BRAND, SESSION_TIMEOUT_OPTIONS, buildWelcomeEmail, buildWelcomeEmailHtml, LENSES, lensQuestionCount, ARCHETYPES, Archetype } from '../lib/data'
import { COUNTRIES, SECTORS_BY_ARCHETYPE, subsectorsForSector } from '../lib/dataroom'
import { cn } from '../lib/utils'

// View levels assignable to a co-assessor from an org workspace. The platform
// Super Admin is a reserved, invisible operator tier granted only from the
// allowlist - and is never listed as a workspace reviewer - so it is omitted
// from team assignment here. The ordinary Administrator tier IS assignable.
const TEAM_ROLE_LEVELS = VIEW_LEVELS.filter(v => v.id !== 'super_admin')

// Resolve the human-readable scope a view level applies to.
function resolveScope(
  role: UserRole,
  orgName: string,
  portfolioId: string,
  portfolios: Portfolio[],
): { scopeId?: string; scopeLabel: string } {
  if (role === 'portfolio') {
    const pf = portfolios.find(p => p.id === portfolioId) ?? portfolios[0]
    return pf ? { scopeId: pf.id, scopeLabel: pf.name } : { scopeLabel: 'Unassigned portfolio' }
  }
  if (role === 'super_admin') return { scopeLabel: 'Entire platform' }
  return { scopeLabel: orgName }
}

function RoleBadge({ role }: { role: UserRole }) {
  const v = getViewLevel(role)
  return <Badge className={cn(v.badge.bg, v.badge.text)}>{v.label}</Badge>
}

export function SettingsPage() {
  const { currentUser, setRole, sessionTimeout, setSessionTimeout } = useAuthCtx()
  const { teamMembers, inviteTeamMember, updateTeamMemberRole, removeTeamMember } = useTeamCtx()
  const { portfolios } = useWorkspace()
  const { activeLenses, setLensActive, mandatoryLenses } = useLensCtx()
  const { entityProfile, setEntityProfile } = useEntityProfileCtx()
  const { accessGrants, revokeAccess, firm, createFirmEntity, addFirmSeat, removeFirmSeat } = useAccessCtx()
  const [tab, setTab] = useState('profile')
  const [toast, setToast] = useState<string | null>(null)
  // Firm seat + new-firm form state (Phase 5).
  const [firmName, setFirmName] = useState('')
  const [seatEmail, setSeatEmail] = useState('')

  // Firms/reviewers currently holding access to THIS institution's data — the
  // client-side sovereignty view: revoke any of them at will.
  const ownGrants = accessGrants.filter(g => g.orgId === currentUser?.orgId && g.status !== 'revoked')
  const isReviewer = currentUser?.role === 'portfolio' || currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const { archetype, country, sector, subsector } = entityProfile
  const sectorOptions = archetype ? SECTORS_BY_ARCHETYPE[archetype as Archetype] : []
  const subsectorOptions = subsectorsForSector(sector)

  const orgName = currentUser?.orgName ?? 'Your institution'

  // Portfolio options come from the live, user-built portfolios (none until a
  // Portfolio Reviewer or Super Admin creates one).
  const portfolioOptions = portfolios.map(p => ({ value: p.id, label: p.name }))
  const defaultPortfolioId = portfolios[0]?.id ?? ''

  // People shown in the team list - the platform Super Admin is an invisible
  // operator, not a workspace reviewer, so it is never surfaced here.
  const visibleMembers = teamMembers.filter(m => m.role !== 'super_admin')

  // Owner's own view-level preference (drives sidebar + portal access).
  const [ownerPortfolio, setOwnerPortfolio] = useState(defaultPortfolioId)

  // Invite form state.
  const [inviteOpen, setInviteOpen] = useState(false)
  const [iName, setIName] = useState('')
  const [iEmail, setIEmail] = useState('')
  const [iTitle, setITitle] = useState('')
  const [iRole, setIRole] = useState<UserRole>('assessor')
  const [iPortfolio, setIPortfolio] = useState(defaultPortfolioId)
  const [iMessage, setIMessage] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState<'html' | 'text'>('html')

  function resetInvite() {
    setIName(''); setIEmail(''); setITitle(''); setIRole('assessor'); setIPortfolio(defaultPortfolioId); setIMessage('')
    setInviteOpen(false)
  }

  // Compose the branded welcome email the invitee would receive.
  function currentEmail() {
    const { scopeLabel } = resolveScope(iRole, orgName, iPortfolio, portfolios)
    return buildWelcomeEmail({
      name: iName.trim(),
      email: iEmail.trim(),
      role: iRole,
      scopeLabel,
      inviterName: currentUser?.email ?? 'A CRAFT administrator',
      inviterEmail: currentUser?.email ?? '-',
      message: iMessage,
    })
  }

  // The rendered HTML template artifact for the same invitation.
  function currentEmailHtml() {
    const { scopeLabel } = resolveScope(iRole, orgName, iPortfolio, portfolios)
    return buildWelcomeEmailHtml({
      name: iName.trim(),
      email: iEmail.trim(),
      role: iRole,
      scopeLabel,
      inviterName: currentUser?.email ?? 'A CRAFT administrator',
      inviterEmail: currentUser?.email ?? '-',
      message: iMessage,
    })
  }

  function submitInvite() {
    if (!iName.trim() || !iEmail.trim()) {
      setToast('⚠️ A name and email are required to send an invitation.')
      return
    }
    const { scopeId, scopeLabel } = resolveScope(iRole, orgName, iPortfolio, portfolios)
    inviteTeamMember({
      name: iName.trim(),
      email: iEmail.trim(),
      title: iTitle.trim() || '-',
      role: iRole,
      scopeId,
      scopeLabel,
    })
    setToast(`✉️ Invitation sent to ${iEmail.trim()}. A DiBadili Institute welcome email is on its way.`)
    resetInvite()
  }

  function changeMemberRole(id: string, role: UserRole) {
    // Keep an existing portfolio scope where one was set, else default.
    const existing = teamMembers.find(m => m.id === id)
    const portfolioId = existing?.scopeId ?? defaultPortfolioId
    const { scopeId, scopeLabel } = resolveScope(role, orgName, portfolioId, portfolios)
    updateTeamMemberRole(id, role, scopeId, scopeLabel)
    setToast(`Access level updated to ${getViewLevel(role).label}.`)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
          <Settings className="h-4 w-4 text-emerald-600" /> Settings
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Organization &amp; Team</h1>
      </div>

      <Tabs
        tabs={[{ id: 'profile', label: 'Org Profile' }, { id: 'scope', label: 'Assessment Scope & Lenses' }, { id: 'team', label: 'Team & Roles' }, { id: 'security', label: 'Security' }]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'profile' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Organization Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Organization Name" defaultValue={currentUser?.orgName} />
            <p className="text-xs text-slate-500">
              Your archetype, country and sector drive which questions appear in the Assessment Wizard and which documents
              your Data Room requires. Changes apply to both immediately.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Entity Archetype"
                placeholder="Select archetype"
                value={archetype}
                onChange={v => setEntityProfile({ archetype: v as Archetype })}
                options={ARCHETYPES.map(a => ({ value: a.id, label: a.label }))}
              />
              <Select
                label="Country of Operation"
                placeholder="Select country"
                value={country}
                onChange={v => setEntityProfile({ country: v })}
                options={COUNTRIES.map(c => ({ value: c.code, label: `${c.flag} ${c.name}` }))}
              />
              <Select
                label="Sector / Mandate"
                placeholder={archetype ? 'Select sector' : 'Select archetype first'}
                value={sector}
                onChange={v => setEntityProfile({ sector: v })}
                options={sectorOptions.map(s => ({ value: s, label: s }))}
              />
              {subsectorOptions.length > 0 && (
                <Select
                  label="Subsector"
                  placeholder="Select subsector"
                  value={subsector}
                  onChange={v => setEntityProfile({ subsector: v })}
                  options={subsectorOptions.map(s => ({ value: s, label: s }))}
                />
              )}
            </div>
            <Input label="Primary Contact Email" defaultValue={currentUser?.email} />
            <Button onClick={() => setToast('Profile saved.')}>Save Changes</Button>
          </CardContent>
        </Card>
      )}

      {tab === 'scope' && (
        <div className="space-y-6">
          {/* Header / sovereignty messaging */}
          <Card>
            <CardHeader className="rounded-t-xl bg-emerald-950 text-white">
              <CardTitle className="flex items-center gap-2 text-white">
                <Globe className="h-4 w-4 text-amber-400" /> Define Your Institutional Assessment Scope
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-slate-600">
                CRAFT respects institutional sovereignty. Activate only the thematic lenses relevant to your current
                mandate, donor requirements, and national context. Your overall accreditation is calculated based on
                your active modules. The Dashboard radar and Assessment Wizard recalculate the moment you change scope.
              </p>
            </CardContent>
          </Card>

          {/* Core Foundation - always active, locked */}
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <Lock className="h-5 w-5 text-emerald-700" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Core Foundation</p>
                  <p className="text-sm text-slate-500">
                    Governance · Fiduciary Assurance · Grant Management · Donor &amp; USG Readiness · Digital &amp; Operational
                  </p>
                  <p className="mt-1 text-xs font-medium text-emerald-700">Always active, required for the G2G, DFI and donor baseline</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700">Locked ON</Badge>
                <Switch checked disabled label="Core Foundation (locked on)" />
              </div>
            </CardContent>
          </Card>

          {/* Thematic Lenses */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Thematic Lenses</p>
            <div className="grid gap-4 md:grid-cols-3">
              {LENSES.map(lens => {
                const on = activeLenses[lens.id]
                const locked = mandatoryLenses[lens.id]
                const count = lensQuestionCount(lens.id)
                return (
                  <Card key={lens.id} className={cn('flex flex-col p-5 transition-colors', on ? 'ring-1 ring-emerald-200' : '')}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl" aria-hidden>{lens.emoji}</span>
                      <Switch
                        checked={on}
                        disabled={locked}
                        onChange={next => {
                          setLensActive(lens.id, next)
                          setToast(`Scope updated. Assessment Wizard and Dashboard recalculating…`)
                        }}
                        label={`${lens.name} ${on ? 'active' : 'inactive'}`}
                      />
                    </div>
                    <p className="mt-2 font-semibold text-slate-800">{lens.name}</p>
                    <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{lens.description}</p>
                    <p className="mt-2 text-[11px] italic leading-relaxed text-slate-400">{lens.geoNote}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-[11px] font-medium text-slate-500">
                        {count} questions · +1 radar axis
                      </span>
                      {locked ? (
                        <Badge className="bg-amber-100 text-amber-800">Mandated by portfolio</Badge>
                      ) : (
                        <Badge className={on ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                          {on ? 'Active' : 'Deactivated'}
                        </Badge>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Deactivating a lens hides its questions from the Wizard and removes its axis from the Dashboard radar; your
            answers are retained and reappear if you reactivate it. Lenses mandated by a portfolio funder cannot be
            switched off.
          </p>
        </div>
      )}

      {tab === 'team' && (
        <div className="space-y-6">
          {/* Your own view level - the preference that drives what you see */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Layers className="h-4 w-4" /> Your Access Level</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">
                Choose the view your workspace presents. This preference is enforced across the app: it controls the
                navigation you see and which portals you can open.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {(isSuperAdminEmail(currentUser?.email) ? VIEW_LEVELS : ASSIGNABLE_VIEW_LEVELS).map(v => {
                  const active = currentUser?.role === v.id
                  return (
                    <button
                      key={v.id}
                      onClick={() => setRole(v.id)}
                      className={cn(
                        'rounded-xl border p-4 text-left transition-all',
                        active
                          ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-white hover:border-slate-300',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', v.badge.bg, v.badge.text)}>
                          {v.label}
                        </span>
                        {active && <Check className="h-4 w-4 text-emerald-600" />}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">{v.description}</p>
                    </button>
                  )
                })}
              </div>
              {currentUser?.role === 'portfolio' && (
                <div className="max-w-sm">
                  {portfolioOptions.length > 0 ? (
                    <Select
                      label="Portfolio in scope"
                      value={ownerPortfolio}
                      onChange={setOwnerPortfolio}
                      options={portfolioOptions}
                    />
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      No portfolios yet. Create one in the Portfolio Admin portal to scope your view.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Team Role Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-slate-500">
                These are the people with access to this workspace. Invite co-assessors and grant each one a view level,
                scoped to your institution, to a portfolio of institutions, or to the whole platform.
              </p>

              <div className="space-y-3">
                {/* Workspace owner (the signed-in user) */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                      {(currentUser?.email ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{currentUser?.email}</p>
                      <p className="text-xs text-slate-500">Workspace Owner · {orgName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentUser && <RoleBadge role={currentUser.role} />}
                    <Badge className="bg-amber-100 text-amber-800">Owner</Badge>
                  </div>
                </div>

                {/* Invited / active members */}
                {visibleMembers.map(m => (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {m.name} <span className="font-normal text-slate-400">· {m.title}</span>
                        </p>
                        <p className="text-xs text-slate-500">{m.email} · {m.scopeLabel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.status === 'invited' && <Badge className="bg-slate-100 text-slate-500">Invited</Badge>}
                      <div className="w-44">
                        <Select
                          value={m.role}
                          onChange={val => changeMemberRole(m.id, val as UserRole)}
                          options={TEAM_ROLE_LEVELS.map(v => ({ value: v.id, label: v.label }))}
                        />
                      </div>
                      <button
                        onClick={() => { removeTeamMember(m.id); setToast(`Access revoked for ${m.email}.`) }}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Revoke access for ${m.email}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Invite form */}
              {inviteOpen ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <UserPlus className="h-4 w-4" /> Invite a Co-Assessor
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input label="Full name" placeholder="Jane Doe" value={iName} onChange={e => setIName(e.target.value)} />
                    <Input label="Email" placeholder="colleague@institution.org" value={iEmail} onChange={e => setIEmail(e.target.value)} />
                    <Input label="Job title" placeholder="Finance Officer" value={iTitle} onChange={e => setITitle(e.target.value)} />
                    <Select
                      label="View level"
                      value={iRole}
                      onChange={val => setIRole(val as UserRole)}
                      options={TEAM_ROLE_LEVELS.map(v => ({ value: v.id, label: v.label }))}
                    />
                    {iRole === 'portfolio' && portfolioOptions.length > 0 && (
                      <Select label="Portfolio in scope" value={iPortfolio} onChange={setIPortfolio} options={portfolioOptions} />
                    )}
                  </div>
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Personal welcome note <span className="font-normal text-slate-400">(optional)</span></label>
                    <textarea
                      value={iMessage}
                      onChange={e => setIMessage(e.target.value)}
                      rows={2}
                      placeholder="Add a short note that appears in their welcome email…"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {getViewLevel(iRole).description} <span className="font-medium text-slate-600">Scope: {resolveScope(iRole, orgName, iPortfolio, portfolios).scopeLabel}.</span>
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={submitInvite}>Send Invitation</Button>
                    <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
                      <Eye className="h-4 w-4" /> Preview Email
                    </Button>
                    <Button size="sm" variant="ghost" onClick={resetInvite}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button className="mt-4" variant="outline" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Invite Co-Assessor
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Data sovereignty: firms/reviewers with access to this institution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldOff className="h-4 w-4 text-rose-500" /> Firms &amp; Reviewers With Access</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-slate-500">
                These parties have been granted access to your institution's results. You retain full ownership — revoke
                any of them at any time. Revocation takes effect immediately.
              </p>
              {ownGrants.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  No external party currently has access to your data.
                </p>
              ) : (
                <div className="space-y-2">
                  {ownGrants.map(g => (
                    <div key={`${g.orgId}-${g.grantee}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{g.grantee}</p>
                        <p className="text-xs text-slate-500">{g.level === 'write' ? 'Read & write' : 'Read-only'} access</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={g.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}>
                          {g.status === 'active' ? 'Active' : 'Pending'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { revokeAccess(g.orgId, g.grantee); setToast(`Access revoked for ${g.grantee}.`) }}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Consulting firm & seats (Phase 5) - only for reviewers/admins */}
          {isReviewer && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-blue-600" /> Your Consulting Firm</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-500">
                  A firm lets several consultants share one client book. Portfolios and client access held by the firm are
                  visible to every consultant, and each seat can be revoked independently.
                </p>
                {!firm ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <Input label="Firm name" placeholder="Sahel Advisory Partners" value={firmName} onChange={e => setFirmName(e.target.value)} />
                    </div>
                    <Button
                      onClick={() => { if (firmName.trim()) { createFirmEntity(firmName.trim()); setToast(`Firm "${firmName.trim()}" created.`); setFirmName('') } }}
                    >
                      <Briefcase className="h-4 w-4" /> Create Firm
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                      <p className="text-sm font-semibold text-blue-900">{firm.name}</p>
                      <Badge className="bg-blue-100 text-blue-700">{firm.members.length} seat(s)</Badge>
                    </div>
                    <div className="space-y-2">
                      {firm.members.map(m => (
                        <div key={m.email} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{m.email}</p>
                            <p className="text-xs capitalize text-slate-500">{m.role}</p>
                          </div>
                          {m.role !== 'owner' && (
                            <button
                              onClick={() => { removeFirmSeat(m.email); setToast(`Removed ${m.email} from the firm.`) }}
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              aria-label={`Remove ${m.email}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[220px]">
                        <Input label="Add consultant (email)" placeholder="consultant@firm.com" value={seatEmail} onChange={e => setSeatEmail(e.target.value)} />
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => { if (seatEmail.trim()) { addFirmSeat(seatEmail.trim()); setToast(`Invited ${seatEmail.trim()} to the firm.`); setSeatEmail('') } }}
                      >
                        <UserPlus className="h-4 w-4" /> Add Seat
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Auto-logout after inactivity</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">
                For security, your session automatically expires after this period of inactivity. Choose a duration that
                balances security with convenience: shorter timeouts are more secure, longer ones more convenient.
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-44">
                  <Select
                    label="Session timeout"
                    value={String(sessionTimeout)}
                    onChange={val => setSessionTimeout(Number(val))}
                    options={SESSION_TIMEOUT_OPTIONS.map(m => ({ value: String(m), label: `${m} minutes` }))}
                  />
                </div>
                <Badge className="mb-2 bg-emerald-100 text-emerald-700">Current: {sessionTimeout} minutes</Badge>
              </div>
              <p className="text-xs text-slate-400">
                Permitted range is 5–60 minutes; the platform enforces these bounds so a session can never be left open indefinitely.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Security &amp; Isolation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { t: 'Multi-Tenant Data Isolation', d: `All records scoped to ${currentUser?.orgId}.`, on: true },
                { t: 'Idle Session Timeout', d: `Sessions expire after ${sessionTimeout} minutes of inactivity.`, on: true },
              ].map(s => (
                <div key={s.t} className="flex items-center justify-between rounded-lg border border-slate-100 p-4">
                  <div className="flex items-center gap-3">
                    <Lock className="h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{s.t}</p>
                      <p className="text-xs text-slate-500">{s.d}</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700">Enabled</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Branded welcome-email preview */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-emerald-950 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/20">
                  <Mail className="h-4 w-4 text-amber-400" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-white">{BRAND.institute}</p>
                  <p className="text-[11px] text-amber-400">“{BRAND.instituteMeaning}.”</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="rounded-md p-1 text-emerald-200 transition-colors hover:bg-emerald-900 hover:text-white"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Subject</p>
                  <p className="text-sm font-semibold text-slate-800">{currentEmail().subject}</p>
                </div>
                <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                  {(['html', 'text'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPreviewMode(m)}
                      className={`rounded-md px-3 py-1.5 capitalize transition-all ${previewMode === m ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                    >
                      {m === 'html' ? 'HTML' : 'Plain text'}
                    </button>
                  ))}
                </div>
              </div>
              {previewMode === 'html' ? (
                <iframe
                  title="Welcome email preview"
                  srcDoc={currentEmailHtml().html}
                  className="h-[44vh] w-full rounded-lg border border-slate-200 bg-white"
                />
              ) : (
                <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-[11px] leading-relaxed text-slate-700">
                  {currentEmail().body}
                </pre>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <Button size="sm" variant="ghost" onClick={() => setPreviewOpen(false)}>Close</Button>
              <Button size="sm" onClick={() => { setPreviewOpen(false); submitInvite() }}>
                <Mail className="h-4 w-4" /> Send Invitation
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
