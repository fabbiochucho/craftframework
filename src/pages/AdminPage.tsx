import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useNavigate } from '@tanstack/react-router'
import { Shield, Building2, Globe2, ShieldAlert, Sliders, Lock, Network, FolderPlus, Plus, UserCheck, Users, Trash2, Save, X, Archive, RotateCcw, Pencil } from 'lucide-react'
import { useApp } from '../lib/context'
import {
  computeOrgScore, computeDomainScore, getAccreditation, getImplementationEvidence,
  DOMAIN_WEIGHTS, MOCK_QUESTIONS, UNIVERSAL_RISKS, ASSIGNABLE_VIEW_LEVELS,
  getViewLevel, isSuperAdminEmail,
} from '../lib/data'
import type { ViewLevel } from '../lib/data'
import {
  Card, CardContent, CardHeader, CardTitle, Badge, Stat, Tabs,
  Table, Thead, Tbody, Th, Td, Input, Button, Toast, Select,
} from '../components/ui'
import * as api from '../lib/api'
import type { UserDirectoryRow } from '../lib/api'
import { cn } from '../lib/utils'

const HEATMAP_DOMAINS = [
  'Financial Management', 'Procurement & Supply Chain', 'Governance & Leadership',
  'Risk & Internal Controls', 'Audit & Assurance', 'Digital Systems & Cyber',
]

function heatColor(v: number) {
  if (v >= 70) return 'bg-emerald-500 text-white'
  if (v >= 50) return 'bg-amber-400 text-slate-900'
  if (v >= 35) return 'bg-orange-400 text-white'
  return 'bg-rose-500 text-white'
}

// Human-friendly "time since last sign-in", used in the directory so the admin
// can tell at a glance who is currently active. Returns null when the person
// has no recorded sign-in (assigned but never authenticated yet).
function formatLastSeen(iso: string | null | undefined): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const mins = Math.floor((Date.now() - then) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toISOString().slice(0, 10)
}

// A person counts as "currently active" if they signed in within the last 15
// minutes — surfaced with a live badge in the directory.
function isCurrentlyActive(iso: string | null | undefined): boolean {
  if (!iso) return false
  const then = new Date(iso).getTime()
  return !Number.isNaN(then) && Date.now() - then < 15 * 60000
}

export function AdminPage() {
  const { currentUser, organizations, portfolios, scores, createOrganization, editOrganization, deleteOrganization,
    archiveOrganization, restoreOrganization, createPortfolio, deletePortfolio, renamePortfolio,
    archivePortfolio, restorePortfolio, auditLog } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [toast, setToast] = useState<string | null>(null)

  // New-institution form (admins can register institutions to administer).
  const [orgName, setOrgName] = useState('')
  const [orgCountry, setOrgCountry] = useState('')
  const [orgDonor, setOrgDonor] = useState('')
  const [orgEmail, setOrgEmail] = useState('')

  // New-portfolio form.
  const [pfName, setPfName] = useState('')
  const [pfOrgIds, setPfOrgIds] = useState<string[]>([])

  // User directory (persistent role/org assignment, backed by /api/users).
  const [directory, setDirectory] = useState<UserDirectoryRow[]>([])
  const [duEmail, setDuEmail] = useState('')
  const [duName, setDuName] = useState('')
  const [duTitle, setDuTitle] = useState('')
  const [duOrgId, setDuOrgId] = useState('')
  const [duRole, setDuRole] = useState<ViewLevel>('assessor')

  // Inline institution editing (rename / re-key profile fields, or remove).
  const [editOrgId, setEditOrgId] = useState<string | null>(null)
  const [eoName, setEoName] = useState('')
  const [eoCountry, setEoCountry] = useState('')
  const [eoDonor, setEoDonor] = useState('')

  // Inline portfolio rename.
  const [editPfId, setEditPfId] = useState<string | null>(null)
  const [epName, setEpName] = useState('')

  const isSuperAdmin = currentUser?.role === 'super_admin'

  // Load the directory whenever the operator opens the Users tab. Most-recently
  // active people are surfaced first so the operator sees who is currently signed in.
  useEffect(() => {
    if (!isSuperAdmin || tab !== 'users') return
    let active = true
    api.fetchUsers().then(rows => {
      if (!active) return
      const sorted = [...rows].sort((a, b) => {
        const ta = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0
        const tb = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0
        if (tb !== ta) return tb - ta
        return a.email.localeCompare(b.email)
      })
      setDirectory(sorted)
    })
    return () => {
      active = false
    }
  }, [isSuperAdmin, tab])

  function orgNameFor(id: string | null): string {
    if (!id) return '— (no organisation)'
    return organizations.find(o => o.id === id)?.name ?? id
  }

  async function assignUser() {
    const email = duEmail.trim().toLowerCase()
    if (!email) {
      setToast('⚠️ An email is required to assign a role.')
      return
    }
    const orgName = duOrgId ? orgNameFor(duOrgId) : ''
    const row = await api.upsertUser({
      email,
      name: duName.trim(),
      title: duTitle.trim(),
      orgId: duOrgId || null,
      role: duRole,
      scopeLabel: duRole === 'portfolio' ? 'Assigned portfolio' : orgName,
    })
    if (row) {
      setDirectory(prev => {
        const rest = prev.filter(u => u.email.toLowerCase() !== email)
        return [...rest, row].sort((a, b) => a.email.localeCompare(b.email))
      })
      setToast(`👤 ${email} assigned as ${getViewLevel(duRole).label}${duOrgId ? ` on ${orgName}` : ''}.`)
      setDuEmail(''); setDuName(''); setDuTitle(''); setDuOrgId(''); setDuRole('assessor')
    } else {
      setToast('⚠️ Could not save the assignment. Please try again.')
    }
  }

  async function changeUserRole(row: UserDirectoryRow, role: ViewLevel) {
    const updated = await api.upsertUser({ ...row, role })
    if (updated) setDirectory(prev => prev.map(u => (u.id === updated.id ? updated : u)))
  }

  async function changeUserOrg(row: UserDirectoryRow, orgId: string) {
    const updated = await api.upsertUser({ ...row, orgId: orgId || null, scopeLabel: orgNameFor(orgId || null) })
    if (updated) setDirectory(prev => prev.map(u => (u.id === updated.id ? updated : u)))
  }

  function removeUser(row: UserDirectoryRow) {
    api.deleteUser(row.email)
    setDirectory(prev => prev.filter(u => u.id !== row.id))
    setToast(`Access revoked for ${row.email}.`)
  }

  function startEditOrg(id: string) {
    const o = organizations.find(x => x.id === id)
    if (!o) return
    setEditOrgId(id)
    setEoName(o.name); setEoCountry(o.country ?? ''); setEoDonor(o.targetDonor ?? '')
  }

  async function saveEditOrg() {
    if (!editOrgId) return
    editOrganization(editOrgId, { name: eoName.trim(), country: eoCountry.trim(), targetDonor: eoDonor.trim() })
    setToast(`✏️ ${eoName.trim()} updated.`)
    setEditOrgId(null)
  }

  function removeOrg(id: string) {
    const o = organizations.find(x => x.id === id)
    if (!window.confirm(`Permanently delete “${o?.name ?? id}” and ALL of its assessment data, evidence, team members and portfolio memberships? This cannot be undone. To keep the record, archive it instead.`)) return
    deleteOrganization(id)
    setToast('🗑️ Institution and all its data permanently deleted.')
  }

  function toggleArchiveOrg(id: string) {
    const o = organizations.find(x => x.id === id)
    if (o?.status === 'archived') {
      restoreOrganization(id)
      setToast(`♻️ ${o?.name ?? 'Institution'} restored.`)
    } else {
      archiveOrganization(id)
      setToast(`📦 ${o?.name ?? 'Institution'} archived. Its data is retained and can be restored.`)
    }
  }

  function startEditPf(id: string, name: string) {
    setEditPfId(id)
    setEpName(name)
  }

  function saveEditPf() {
    if (!editPfId) return
    renamePortfolio(editPfId, epName)
    setToast(`✏️ Portfolio renamed to “${epName.trim()}”.`)
    setEditPfId(null)
  }

  function toggleArchivePf(id: string) {
    const p = portfolios.find(x => x.id === id)
    if (p?.status === 'archived') {
      restorePortfolio(id)
      setToast(`♻️ Portfolio “${p?.name}” restored.`)
    } else {
      archivePortfolio(id)
      setToast(`📦 Portfolio “${p?.name ?? ''}” archived.`)
    }
  }

  function removePf(id: string) {
    const p = portfolios.find(x => x.id === id)
    if (!window.confirm(`Delete portfolio “${p?.name ?? id}”? The institutions inside it are kept — only the grouping is removed.`)) return
    deletePortfolio(id)
    setToast('🗑️ Portfolio deleted.')
  }

  const aggregate = useMemo(() => {
    const active = organizations.filter(o => o.status !== 'archived')
    const all = active.map(o => computeOrgScore(scores[o.id] || {}))
    const avg = Math.round(all.reduce((a, b) => a + b, 0) / (all.length || 1))
    return { avg, count: active.length }
  }, [organizations, scores])

  const barData = organizations
    .filter(o => o.status !== 'archived')
    .map(o => ({
      name: o.name.split(' ').slice(0, 2).join(' '),
      value: computeOrgScore(scores[o.id] || {}),
    }))

  // Role gate (after hooks to preserve hook order across role switches).
  if (currentUser && currentUser.role !== 'super_admin') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <ShieldAlert className="h-12 w-12 text-rose-400" />
        <h1 className="mt-4 font-display text-2xl font-bold text-emerald-900">Access Restricted</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          The Super Admin portal is the platform control center and is reserved for the platform operator.
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
    const org = createOrganization({ name: orgName, country: orgCountry, targetDonor: orgDonor, email: orgEmail })
    setToast(`🏛️ ${org.name} registered.`)
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
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-slate-900">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-700">Super Admin Portal</p>
          <h1 className="font-display text-3xl font-bold text-emerald-900">Global Control Center</h1>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'overview', label: 'Aggregate KPIs' },
          { id: 'users', label: 'User Directory' },
          { id: 'portfolios', label: 'Portfolios' },
          { id: 'heatmap', label: 'Systemic Risk Heatmap' },
          { id: 'audit', label: 'Security Audit Log' },
          { id: 'config', label: 'System Configuration' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div className="space-y-6">
          {organizations.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-10 w-10 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-700">No institutions registered yet</p>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  This is a live platform with no demo data. Register institutions and group them into portfolios from
                  the <button onClick={() => setTab('portfolios')} className="font-semibold text-emerald-600">Portfolios</button> tab, and aggregate KPIs will populate here.
                </p>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Institutions" value={aggregate.count} accent="emerald" hint="Active tenants" />
            <Stat label="Mean Composite" value={`${aggregate.avg}%`} accent="amber" hint="Across portfolio" />
            <Stat label="Critical Findings" value={UNIVERSAL_RISKS.filter(r => r.severity === 'Critical').length} accent="rose" hint="Universal register" />
            <Stat label="Question Bank" value={MOCK_QUESTIONS.length} accent="slate" hint="Across 5 tiers" />
          </div>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> Composite by Institution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {barData.map((d, i) => (
                      <Cell key={i} fill={d.value >= 70 ? '#10b981' : d.value >= 50 ? '#f59e0b' : '#f43f5e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table className="rounded-none border-0">
                <Thead>
                  <tr><Th>Institution</Th><Th>Composite</Th><Th>Impl. Evidence</Th><Th>Accreditation</Th><Th> </Th></tr>
                </Thead>
                <Tbody>
                  {organizations.map(o => {
                    const c = computeOrgScore(scores[o.id] || {})
                    const ie = getImplementationEvidence(o.id)
                    const a = getAccreditation(c, ie)
                    if (editOrgId === o.id) {
                      return (
                        <tr key={o.id} className="bg-slate-50">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="grid gap-3 sm:grid-cols-3">
                              <Input label="Name" value={eoName} onChange={e => setEoName(e.target.value)} />
                              <Input label="Country" value={eoCountry} onChange={e => setEoCountry(e.target.value)} />
                              <Input label="Target donor" value={eoDonor} onChange={e => setEoDonor(e.target.value)} />
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" onClick={saveEditOrg}><Save className="h-4 w-4" /> Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditOrgId(null)}><X className="h-4 w-4" /> Cancel</Button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={o.id} className={o.status === 'archived' ? 'opacity-60' : ''}>
                        <Td className="font-medium text-slate-800">
                          {o.name}
                          {o.status === 'archived' && (
                            <Badge className="ml-2 bg-slate-200 text-slate-600">Archived</Badge>
                          )}
                        </Td>
                        <Td>{c}%</Td>
                        <Td className={ie < 50 ? 'font-semibold text-rose-600' : ''}>{ie}%</Td>
                        <Td>
                          <Badge className={cn(a.bg, a.color)}>Level {a.level}{a.capped ? ' (capped)' : ''}</Badge>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditOrg(o.id)}
                              className="rounded-md px-2 py-1 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleArchiveOrg(o.id)}
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                              aria-label={o.status === 'archived' ? `Restore ${o.name}` : `Archive ${o.name}`}
                              title={o.status === 'archived' ? 'Restore' : 'Archive'}
                            >
                              {o.status === 'archived' ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => removeOrg(o.id)}
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              aria-label={`Delete ${o.name}`}
                              title="Delete permanently"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                </Tbody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <UserCheck className="h-5 w-5 shrink-0 text-slate-500" />
            <p className="text-sm text-slate-600">
              The user directory is the source of truth for <strong>who belongs to which institution and in what role</strong>.
              <strong> Everyone who registers appears here automatically</strong> — even before their first sign-in — so you can
              see the whole roster and place each person by assigning their organisation and role below. When a person signs in, their organisation and role
              are read from here, so assigning two people to the same institution makes all their assessments land on that single
              tenant. Assign an <strong>Independent Assessor</strong> to let a consultant score the same institution on a parallel
              track (reconciled on Trust Delta), or <strong>Portfolio Reviewer</strong> to let an incubator oversee a cohort of
              institutions.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-emerald-600" /> Assign a Person to an Institution &amp; Role</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Email" placeholder="staff@nbti.gov.ng" value={duEmail} onChange={e => setDuEmail(e.target.value)} />
                <Input label="Full name" placeholder="Ada Obi" value={duName} onChange={e => setDuName(e.target.value)} />
                <Input label="Job title" placeholder="Finance Officer" value={duTitle} onChange={e => setDuTitle(e.target.value)} />
                <Select
                  label="Organisation"
                  placeholder={organizations.length ? 'Select institution' : 'Register an institution first'}
                  value={duOrgId}
                  onChange={setDuOrgId}
                  options={organizations.map(o => ({ value: o.id, label: o.name }))}
                />
                <Select
                  label="Role (view level)"
                  value={duRole}
                  onChange={v => setDuRole(v as ViewLevel)}
                  options={ASSIGNABLE_VIEW_LEVELS.map(v => ({ value: v.id, label: v.label }))}
                />
              </div>
              <p className="text-xs text-slate-500">{getViewLevel(duRole).description}</p>
              <Button onClick={assignUser}><Plus className="h-4 w-4" /> Assign / Update</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Directory
                {directory.length > 0 && (
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    {directory.length} {directory.length === 1 ? 'person' : 'people'}
                    {directory.some(u => isCurrentlyActive(u.lastSeenAt)) && (
                      <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {directory.filter(u => isCurrentlyActive(u.lastSeenAt)).length} active now
                      </span>
                    )}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {directory.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-500">No users yet. People appear here as soon as they register, or assign someone above.</p>
              ) : (
                <Table className="rounded-none border-0">
                  <Thead><tr><Th>User</Th><Th>Organisation</Th><Th>Role</Th><Th>Last seen</Th><Th> </Th></tr></Thead>
                  <Tbody>
                    {directory.map(u => {
                      const lastSeen = formatLastSeen(u.lastSeenAt)
                      const activeNow = isCurrentlyActive(u.lastSeenAt)
                      return (
                        <tr key={u.id}>
                          <Td>
                            <p className="font-medium text-slate-800">{u.name || u.email}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </Td>
                          <Td>
                            <div className="w-48">
                              <Select
                                value={u.orgId ?? ''}
                                onChange={v => changeUserOrg(u, v)}
                                placeholder="Unassigned"
                                options={organizations.map(o => ({ value: o.id, label: o.name }))}
                              />
                            </div>
                          </Td>
                          <Td>
                            <div className="w-44">
                              {isSuperAdminEmail(u.email) ? (
                                <Badge className="bg-amber-100 text-amber-800">Super Admin · locked</Badge>
                              ) : (
                                <Select
                                  value={u.role === 'super_admin' ? 'admin' : u.role}
                                  onChange={v => changeUserRole(u, v as ViewLevel)}
                                  options={ASSIGNABLE_VIEW_LEVELS.map(v => ({ value: v.id, label: v.label }))}
                                />
                              )}
                            </div>
                          </Td>
                          <Td>
                            {activeNow ? (
                              <Badge className="bg-emerald-100 text-emerald-700">
                                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
                                Active now
                              </Badge>
                            ) : lastSeen ? (
                              <span className="text-xs text-slate-500">{lastSeen}</span>
                            ) : (
                              <span className="text-xs text-slate-400">
                                {u.status === 'invited' ? 'Invited · not signed in' : 'Never signed in'}
                              </span>
                            )}
                          </Td>
                          <Td>
                            <button
                              onClick={() => removeUser(u)}
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              aria-label={`Revoke access for ${u.email}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </Td>
                        </tr>
                      )
                    })}
                  </Tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'portfolios' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <UserCheck className="h-5 w-5 shrink-0 text-slate-500" />
            <p className="text-sm text-slate-600">
              As the platform Super Admin you can register institutions and create portfolios for platform oversight. To avoid any
              feel of surveillance, you are <strong>never listed as the reviewer</strong> of what you create. Those
              records read as platform oversight with no named reviewer.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-emerald-600" /> Register an Institution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                <Input label="Portfolio name" placeholder="East Africa Portfolio" value={pfName} onChange={e => setPfName(e.target.value)} />
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-700">Institutions in this portfolio</p>
                  {organizations.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                      No institutions yet. Register one on the left first.
                    </p>
                  ) : (
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                      {organizations.map(o => {
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

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Network className="h-4 w-4 text-blue-600" /> All Portfolios</CardTitle></CardHeader>
            <CardContent className="p-0">
              {portfolios.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-500">No portfolios yet. Create one above.</p>
              ) : (
                <Table className="rounded-none border-0">
                  <Thead><tr><Th>Portfolio</Th><Th>Institutions</Th><Th>Mean Composite</Th><Th>Reviewer</Th><Th> </Th></tr></Thead>
                  <Tbody>
                    {portfolios.map(p => {
                      const pfOrgs = organizations.filter(o => p.orgIds.includes(o.id))
                      const mean = Math.round(pfOrgs.reduce((a, o) => a + computeOrgScore(scores[o.id] || {}), 0) / (pfOrgs.length || 1))
                      if (editPfId === p.id) {
                        return (
                          <tr key={p.id} className="bg-slate-50">
                            <td colSpan={5} className="px-4 py-3">
                              <div className="flex flex-wrap items-end gap-3">
                                <div className="min-w-[240px] flex-1">
                                  <Input label="Portfolio name" value={epName} onChange={e => setEpName(e.target.value)} />
                                </div>
                                <Button size="sm" onClick={saveEditPf}><Save className="h-4 w-4" /> Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditPfId(null)}><X className="h-4 w-4" /> Cancel</Button>
                              </div>
                            </td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={p.id} className={p.status === 'archived' ? 'opacity-60' : ''}>
                          <Td className="font-medium text-slate-800">
                            {p.name}
                            {p.status === 'archived' && (
                              <Badge className="ml-2 bg-slate-200 text-slate-600">Archived</Badge>
                            )}
                          </Td>
                          <Td>{p.orgIds.length}</Td>
                          <Td>{pfOrgs.length ? `${mean}%` : '-'}</Td>
                          <Td className="text-xs text-slate-500">{p.reviewer ?? 'Platform oversight (no named reviewer)'}</Td>
                          <Td>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => startEditPf(p.id, p.name)}
                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                                aria-label={`Rename ${p.name}`}
                                title="Rename"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => toggleArchivePf(p.id)}
                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                                aria-label={p.status === 'archived' ? `Restore ${p.name}` : `Archive ${p.name}`}
                                title={p.status === 'archived' ? 'Restore' : 'Archive'}
                              >
                                {p.status === 'archived' ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={() => removePf(p.id)}
                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                aria-label={`Delete ${p.name}`}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </Td>
                        </tr>
                      )
                    })}
                  </Tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'heatmap' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-rose-500" /> Systemic Risk Heatmap</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-slate-500">Institution</th>
                    {HEATMAP_DOMAINS.map(d => (
                      <th key={d} className="p-2 text-center font-medium text-slate-500">{d.split(' ')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {organizations.filter(o => o.status !== 'archived').map(o => (
                    <tr key={o.id}>
                      <td className="whitespace-nowrap p-2 text-left font-medium text-slate-700">{o.name.split(' ').slice(0, 3).join(' ')}</td>
                      {HEATMAP_DOMAINS.map(d => {
                        const v = computeDomainScore(scores[o.id] || {}, d)
                        return (
                          <td key={d} className={cn('rounded p-2 text-center font-bold', heatColor(v))}>{v}</td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-400">Cell = domain readiness %. Red indicates systemic capacity gaps across the portfolio.</p>
          </CardContent>
        </Card>
      )}

      {tab === 'audit' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Security Audit Log</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table className="rounded-none border-0">
              <Thead><tr><Th>Timestamp</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Category</Th></tr></Thead>
              <Tbody>
                {auditLog.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                      No activity recorded yet for this session.
                    </td>
                  </tr>
                )}
                {auditLog.map(e => (
                  <tr key={e.id}>
                    <Td><span className="font-mono text-xs text-slate-500">{e.timestamp}</span></Td>
                    <Td className="text-xs">{e.actor}</Td>
                    <Td className="text-sm">{e.action}</Td>
                    <Td className="text-xs text-slate-500">{e.target}</Td>
                    <Td><Badge className="bg-slate-100 text-slate-600">{e.category}</Badge></Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'config' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sliders className="h-4 w-4" /> Global Domain Weights</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(DOMAIN_WEIGHTS).map(([domain, w]) => (
                <div key={domain}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-600">{domain}</span>
                    <span className="font-mono font-semibold text-slate-800">{(w * 100).toFixed(0)}%</span>
                  </div>
                  <input type="range" min={0} max={20} defaultValue={w * 100} className="w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Question Bank</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-slate-500">{MOCK_QUESTIONS.length} questions across 5 tiers and {new Set(MOCK_QUESTIONS.map(q => q.domain)).size} domains.</p>
              <div className="max-h-80 space-y-1.5 overflow-y-auto">
                {MOCK_QUESTIONS.map(q => (
                  <div key={q.id} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-1.5">
                    <span className="font-mono text-xs font-semibold text-emerald-600">{q.id}</span>
                    <span className="flex-1 px-3 text-xs text-slate-600 line-clamp-1">{q.domain}</span>
                    <Badge className="bg-slate-100 text-slate-500">T{q.tier}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
