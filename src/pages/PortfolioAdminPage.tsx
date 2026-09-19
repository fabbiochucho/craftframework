import { useMemo, useState } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import { useNavigate } from '@tanstack/react-router'
import { Network, ShieldAlert, ShieldCheck, Layers, Building2, Plus, FolderPlus, UserCheck, Eye, Archive, Trash2 } from 'lucide-react'
import { useApp } from '../lib/context'
import {
  COMPOSITE_INDICES, computeCompositeIndices, computeOrgScore,
  getAccreditation, getImplementationEvidence, LENSES, lensQuestionCount,
} from '../lib/data'
import { Card, CardContent, CardHeader, CardTitle, Badge, Select, Input, Button, Stat, Switch, Toast } from '../components/ui'
import { cn } from '../lib/utils'

const LINE_COLORS = ['#10B981', '#F59E0B', '#0EA5E9', '#f43f5e', '#8b5cf6']

// How a portfolio or institution presents its reviewer. Super Admins are never
// recorded as reviewers, so admin-created records read as platform oversight -
// they are watched over for governance, not assigned a named reviewer.
function reviewerLabel(reviewer?: string): string {
  return reviewer ?? 'Platform oversight (no named reviewer)'
}

export function PortfolioAdminPage() {
  const {
    currentUser, organizations, portfolios, scores,
    createOrganization, createPortfolio, mandatoryLenses, setMandatoryLens,
    accessGrants, setActiveClient,
    deleteOrganization, archiveOrganization, restoreOrganization,
    deletePortfolio, archivePortfolio,
  } = useApp()
  const navigate = useNavigate()

  // The grant an institution holds with the signed-in reviewer, if any. Tells the
  // reviewer whether a client's results are actually readable (pending / active /
  // revoked) rather than assuming access.
  function grantStatus(orgId: string): 'active' | 'pending' | 'revoked' | null {
    const email = currentUser?.email.toLowerCase()
    const g = accessGrants.find(x => x.orgId === orgId && x.grantee === email)
    return (g?.status as 'active' | 'pending' | 'revoked') ?? null
  }
  const [portfolioId, setPortfolioId] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  // New-institution form.
  const [orgName, setOrgName] = useState('')
  const [orgCountry, setOrgCountry] = useState('')
  const [orgDonor, setOrgDonor] = useState('')
  const [orgEmail, setOrgEmail] = useState('')

  // New-portfolio form.
  const [pfName, setPfName] = useState('')
  const [pfOrgIds, setPfOrgIds] = useState<string[]>([])

  // Resolve the portfolio currently in focus, defaulting to the first one.
  const portfolio = portfolios.find(p => p.id === portfolioId) ?? portfolios[0] ?? null
  const orgs = portfolio
    ? organizations.filter(o => portfolio.orgIds.includes(o.id) && o.status !== 'archived')
    : []

  // Archive / delete an institution across the whole platform. Deletion is a hard
  // cascade (every response, finding, obligation, team member and portfolio
  // membership for that institution is removed); archiving is reversible.
  function toggleArchiveOrg(o: { id: string; name: string; status?: string }) {
    if (o.status === 'archived') {
      restoreOrganization(o.id)
      setToast(`♻️ ${o.name} restored.`)
    } else {
      archiveOrganization(o.id)
      setToast(`📦 ${o.name} archived. It drops out of every portfolio view but its data is retained.`)
    }
  }

  function removeOrg(o: { id: string; name: string }) {
    if (!window.confirm(`Permanently delete “${o.name}” and cascade the removal across all of its assessment data, evidence, team members and portfolio memberships? This cannot be undone. Archive instead to keep the record.`)) return
    deleteOrganization(o.id)
    setToast(`🗑️ ${o.name} and all its data permanently deleted.`)
  }

  function archiveCurrentPortfolio() {
    if (!portfolio) return
    archivePortfolio(portfolio.id)
    setToast(`📦 Portfolio “${portfolio.name}” archived.`)
  }

  function deleteCurrentPortfolio() {
    if (!portfolio) return
    if (!window.confirm(`Delete portfolio “${portfolio.name}”? The institutions inside it are kept — only the grouping is removed.`)) return
    deletePortfolio(portfolio.id)
    setPortfolioId('')
    setToast(`🗑️ Portfolio “${portfolio.name}” deleted.`)
  }

  // Build multi-series radar: one value key per org across the 9 indices.
  const radarData = useMemo(() => {
    return COMPOSITE_INDICES.map(idx => {
      const row: Record<string, string | number> = { index: idx }
      orgs.forEach(o => {
        const indices = computeCompositeIndices(scores[o.id] || {})
        row[o.id] = indices.find(i => i.name === idx)?.value ?? 0
      })
      return row
    })
  }, [orgs, scores])

  // Role gate (after hooks to preserve hook order across role switches).
  if (currentUser && currentUser.role === 'assessor') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <ShieldAlert className="h-12 w-12 text-rose-400" />
        <h1 className="mt-4 font-display text-2xl font-bold text-emerald-900">Access Restricted</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          The Portfolio Admin portal requires Portfolio Reviewer, Administrator or Super Admin privileges.
        </p>
        <button onClick={() => navigate({ to: '/dashboard' })} className="mt-4 text-sm font-semibold text-emerald-600">
          Return to dashboard
        </button>
      </div>
    )
  }

  function submitOrg() {
    if (!orgName.trim()) {
      setToast('⚠️ An institution name is required.')
      return
    }
    const org = createOrganization({
      name: orgName,
      country: orgCountry,
      targetDonor: orgDonor,
      email: orgEmail,
    })
    setToast(`🏛️ ${org.name} registered. It is now available to add to a portfolio.`)
    setOrgName(''); setOrgCountry(''); setOrgDonor(''); setOrgEmail('')
  }

  function togglePfOrg(id: string) {
    setPfOrgIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  function submitPortfolio() {
    if (!pfName.trim()) {
      setToast('⚠️ A portfolio name is required.')
      return
    }
    const pf = createPortfolio({ name: pfName, orgIds: pfOrgIds })
    setToast(`🗂️ Portfolio “${pf.name}” created with ${pf.orgIds.length} institution(s).`)
    setPfName(''); setPfOrgIds([])
    setPortfolioId(pf.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 text-white">
            <Network className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-700">Portfolio Admin Portal</p>
            <h1 className="font-display text-3xl font-bold text-emerald-900">Portfolios &amp; Institutions</h1>
          </div>
        </div>
        {portfolios.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-64">
              <Select
                value={portfolio?.id ?? ''}
                onChange={setPortfolioId}
                options={portfolios.map(p => ({ value: p.id, label: p.name }))}
              />
            </div>
            {portfolio && (
              <>
                <button
                  onClick={archiveCurrentPortfolio}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-amber-50 hover:text-amber-700"
                  title="Archive this portfolio"
                >
                  <Archive className="h-4 w-4" /> Archive
                </button>
                <button
                  onClick={deleteCurrentPortfolio}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                  title="Delete this portfolio"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Build surface - register institutions and group them into portfolios */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-emerald-600" /> Register an Institution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">
              Add an institution to your administration. You can register as many as you need, then group them into one or
              more portfolios.
            </p>
            <Input label="Institution name" placeholder="National Public Health Agency" value={orgName} onChange={e => setOrgName(e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Country" placeholder="Kenya" value={orgCountry} onChange={e => setOrgCountry(e.target.value)} />
              <Input label="Target donor" placeholder="USAID" value={orgDonor} onChange={e => setOrgDonor(e.target.value)} />
            </div>
            <Input label="Primary contact email" placeholder="admin@institution.go" value={orgEmail} onChange={e => setOrgEmail(e.target.value)} />
            <Button onClick={submitOrg}><Plus className="h-4 w-4" /> Register Institution</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FolderPlus className="h-4 w-4 text-blue-600" /> Create a Portfolio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">
              Group institutions into a portfolio you administer. Select which of your institutions belong to it.
            </p>
            <Input label="Portfolio name" placeholder="East Africa Portfolio" value={pfName} onChange={e => setPfName(e.target.value)} />
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Institutions in this portfolio</p>
              {organizations.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  No institutions yet - register one on the left first.
                </p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {organizations.filter(o => o.status !== 'archived').map(o => {
                    const checked = pfOrgIds.includes(o.id)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => togglePfOrg(o.id)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                          checked ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        <span className="truncate">{o.name}</span>
                        <span className={cn('ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold', checked ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400')}>
                          {checked ? 'Added' : 'Add'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <Button onClick={submitPortfolio} disabled={organizations.length === 0}>
              <FolderPlus className="h-4 w-4" /> Create Portfolio
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Reviewer-privacy note */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <UserCheck className="h-5 w-5 shrink-0 text-slate-500" />
        <p className="text-sm text-slate-600">
          Portfolios and institutions list the <strong>Portfolio Reviewer</strong> accountable for them. The platform
          Super Admin can see everything for governance but is <strong>never listed as a reviewer</strong>. Oversight
          should never feel like surveillance.
        </p>
      </div>

      {portfolios.length === 0 || !portfolio ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Network className="h-10 w-10 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">No portfolios yet</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Register your institutions and create your first portfolio above to unlock cross-institution comparison,
              the composite-index radar, and funder-lens controls.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Scoped access banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="flex items-center gap-2 text-sm text-blue-800">
              <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600" />
              🛡️ <strong>Scoped Access Active</strong>: viewing the {orgs.length} institution(s) in the{' '}
              <strong>{portfolio.name}</strong>. Records outside this portfolio are isolated.
            </p>
            <Badge className="bg-white text-blue-700">Reviewer: {reviewerLabel(portfolio.reviewer)}</Badge>
          </div>

          {/* Portfolio scope configuration - mandate or recommend lenses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Layers className="h-4 w-4 text-blue-600" /> Portfolio Scope Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">
                Set the default and mandatory assessment scope for the institutions in this portfolio. A mandated lens is
                forced on for every grantee and cannot be deactivated at the institution level. Use this to enforce funder
                safeguards (e.g. World Bank ESS). Recommended lenses are switched on by default but remain the institution’s
                sovereign choice.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {LENSES.map(lens => {
                  const mandated = mandatoryLenses[lens.id]
                  return (
                    <div key={lens.id} className={cn('rounded-xl border p-4', mandated ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white')}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                            <span aria-hidden>{lens.emoji}</span> {lens.name.replace(/ Lens$/, '')}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">{lensQuestionCount(lens.id)} questions</p>
                        </div>
                        <Switch
                          checked={mandated}
                          onChange={next => setMandatoryLens(lens.id, next)}
                          label={`Mandate ${lens.name}`}
                        />
                      </div>
                      <Badge className={cn('mt-3', mandated ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500')}>
                        {mandated ? 'Mandatory for all grantees' : 'Optional (institution choice)'}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Institutions in Scope" value={orgs.length} accent="emerald" />
            <Stat
              label="Mean Composite"
              value={`${Math.round(orgs.reduce((a, o) => a + computeOrgScore(scores[o.id] || {}), 0) / (orgs.length || 1))}%`}
              accent="amber"
            />
            <Stat
              label="Below Penalty Threshold"
              value={orgs.filter(o => getImplementationEvidence(o.id) < 50).length}
              accent="rose"
            />
          </div>

          {orgs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                This portfolio has no institutions yet. Add institutions to it when creating a portfolio, or register more
                above.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle>9 Composite Indices: Multi-Institution Radar</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={420}>
                    <RadarChart data={radarData} outerRadius="72%">
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="index" tick={{ fontSize: 11, fill: '#475569' }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                      {orgs.map((o, i) => (
                        <Radar
                          key={o.id}
                          name={o.name.split(' ').slice(0, 2).join(' ')}
                          dataKey={o.id}
                          stroke={LINE_COLORS[i % LINE_COLORS.length]}
                          fill={LINE_COLORS[i % LINE_COLORS.length]}
                          fillOpacity={0.12}
                        />
                      ))}
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {orgs.map(o => {
                  const c = computeOrgScore(scores[o.id] || {})
                  const a = getAccreditation(c, getImplementationEvidence(o.id))
                  const gs = grantStatus(o.id)
                  return (
                    <Card key={o.id} className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">{o.name}</p>
                          <p className="text-xs text-slate-500">{[o.country, o.targetDonor].filter(Boolean).join(' · ') || '-'}</p>
                        </div>
                        {gs && (
                          <Badge
                            className={cn(
                              'shrink-0',
                              gs === 'active' ? 'bg-emerald-100 text-emerald-700'
                                : gs === 'pending' ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-700',
                            )}
                          >
                            {gs === 'active' ? 'Access granted' : gs === 'pending' ? 'Invite pending' : 'Access revoked'}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-2xl font-bold text-emerald-900">{c}%</span>
                        <Badge className={cn(a.bg, a.color)}>Level {a.level}</Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <UserCheck className="h-3 w-3" /> {reviewerLabel(o.reviewer)}
                        </p>
                        <button
                          onClick={() => { setActiveClient(o.id); navigate({ to: '/dashboard' }) }}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => toggleArchiveOrg(o)}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-amber-50 hover:text-amber-700"
                        >
                          <Archive className="h-3 w-3" /> Archive
                        </button>
                        <button
                          onClick={() => removeOrg(o)}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
