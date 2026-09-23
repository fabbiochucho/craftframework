import { useEffect, useMemo, useState } from 'react'
import {
  Calendar, Bell, AlertTriangle, ShieldCheck, Plus, X, CheckCircle2,
  ArrowUpDown, FolderClock, Building2, Filter,
} from 'lucide-react'
import { useAuthCtx, useAuditCtx } from '../lib/context'
import * as api from '../lib/api'
import {
  Card, CardContent, Button, Badge, Input, Select, Stat, Toast,
  Table, Thead, Tbody, Th, Td, Tabs,
} from '../components/ui'
import { cn } from '../lib/utils'
import { ComplianceCalendarPage } from './ComplianceCalendarPage'
import {
  Obligation, ObligationStream, ObligationType, ObligationFrequency,
  OBLIGATION_TYPE_LABEL, STREAM_LABEL, FREQUENCY_LABEL, FREQUENCY_OPTIONS,
  ROUTINE_TEMPLATES, ARCHETYPES, templateFacets, generateFromTemplate,
  makeCustomObligation, computeNextDueDate, computeMetrics, deriveSeverity,
  seedObligations, startOfToday, toISODate,
} from '../lib/obligations'

type StreamFilter = 'all' | ObligationStream
type SortKey = 'due' | 'severity'

const STREAM_TABS: { id: StreamFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'reporting', label: 'Reporting' },
  { id: 'regulatory', label: 'Regulatory' },
  { id: 'capacity', label: 'Capacity' },
]

const OBLIGATION_TABS = [
  { id: 'register', label: 'Obligations Register' },
  { id: 'calendar', label: 'Reporting Cycle Calendar' },
]

// ICARF v4.0 - a single, unified compliance surface. The obligations register
// (donor / regulatory / capacity deadlines) and the Global Fund PR reporting-cycle
// calendar are now two tabs of one route rather than two separate screens.
export function ObligationsPage() {
  const [tab, setTab] = useState('register')
  return (
    <div className="space-y-6">
      <Tabs tabs={OBLIGATION_TABS} active={tab} onChange={setTab} />
      {tab === 'register' ? <ObligationsRegisterSection /> : <ComplianceCalendarPage />}
    </div>
  )
}

function ObligationsRegisterSection() {
  const { currentUser, isDemo } = useAuthCtx()
  const { logActivity } = useAuditCtx()

  // Demo sessions are seeded with illustrative Pan-African obligations; a live
  // workspace starts empty (the prompt's strict demo/production separation).
  const [obligations, setObligations] = useState<Obligation[]>(() => seedObligations(isDemo))
  const [stream, setStream] = useState<StreamFilter>('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('severity')
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Live workspaces load their persisted obligations from the database
  // (compliance_items); demo sessions keep the in-memory illustrative seed.
  const orgId = currentUser?.orgId
  useEffect(() => {
    if (isDemo || !orgId) return
    let active = true
    api.fetchCompliance(orgId).then(rows => {
      if (active && rows.length) setObligations(rows)
    })
    return () => {
      active = false
    }
  }, [isDemo, orgId])

  const today = useMemo(() => startOfToday(), [])
  const metrics = useMemo(() => computeMetrics(obligations, today), [obligations, today])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = obligations
      .filter(o => stream === 'all' || o.stream === stream)
      .filter(o =>
        !q ||
        o.name.toLowerCase().includes(q) ||
        o.donorOrAuthority.toLowerCase().includes(q) ||
        o.owner.toLowerCase().includes(q),
      )
    return rows.sort((a, b) => {
      if (sortKey === 'due') return a.nextDueDate.localeCompare(b.nextDueDate)
      // severity: most pressing first, ties broken by soonest due date
      const sa = deriveSeverity(a, today)
      const sb = deriveSeverity(b, today)
      if (sb.rank !== sa.rank) return sb.rank - sa.rank
      return a.nextDueDate.localeCompare(b.nextDueDate)
    })
  }, [obligations, stream, search, sortKey, today])

  // Top alerts for the on-page notification strip - pressing items first.
  const alerts = useMemo(
    () =>
      obligations
        .map(o => ({ o, s: deriveSeverity(o, today) }))
        .filter(x => x.s.rank >= 3) // urgent + overdue
        .sort((a, b) => b.s.rank - a.s.rank || a.o.nextDueDate.localeCompare(b.o.nextDueDate))
        .slice(0, 5),
    [obligations, today],
  )

  function markSubmitted(ob: Obligation) {
    setObligations(prev =>
      prev.map(o => {
        if (o.id !== ob.id) return o
        if (o.frequency === 'one-off') {
          return { ...o, status: 'submitted' }
        }
        // Smart date pushing: advance the recurring obligation to its next cycle.
        return { ...o, status: 'pending', nextDueDate: computeNextDueDate(o.nextDueDate, o.frequency) }
      }),
    )
    if (ob.frequency === 'one-off') {
      setToast('Marked submitted.')
    } else {
      const next = computeNextDueDate(ob.nextDueDate, ob.frequency)
      setToast(`Report marked submitted - next occurrence auto-scheduled for ${next}.`)
    }
    if (!isDemo && orgId) {
      const nextDue = ob.frequency === 'one-off' ? ob.nextDueDate : computeNextDueDate(ob.nextDueDate, ob.frequency)
      api.updateComplianceStatus(ob.id, ob.frequency === 'one-off' ? 'submitted' : 'pending', nextDue)
      logActivity('Marked obligation submitted', ob.name, 'Config')
    }
  }

  function addObligations(list: Obligation[], message: string) {
    setObligations(prev => [...list, ...prev])
    setShowAdd(false)
    setToast(message)
    if (!isDemo && orgId) {
      api.saveCompliance(list.map(o => ({ ...o, orgId })))
      logActivity('Added reporting obligation', `${list.length} item(s)`, 'Config')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
            <Calendar className="h-4 w-4 text-emerald-600" /> Unified Calendar
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">
            Obligations Register
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Donor reports, regulatory expiries, and capacity targets in one adaptive view.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Add Obligation
        </Button>
      </div>

      {/* Header metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Compliance Health"
          value={`${metrics.healthPct}%`}
          hint={`${metrics.total} tracked obligation${metrics.total === 1 ? '' : 's'}`}
          accent={metrics.healthPct >= 80 ? 'emerald' : metrics.healthPct >= 50 ? 'amber' : 'rose'}
        />
        <Stat label="Reports Due (30 days)" value={metrics.reportsDue30} accent="amber" />
        <Stat label="Regulatory Expiries (30 days)" value={metrics.regulatoryExpiries30} accent="amber" />
        <Stat label="Overdue Items" value={metrics.overdue} accent={metrics.overdue > 0 ? 'rose' : 'emerald'} />
      </div>

      {/* Notification strip */}
      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <Bell className="h-4 w-4" /> Action needed - {alerts.length} pressing item{alerts.length === 1 ? '' : 's'}
            </p>
            <ul className="mt-2 space-y-1">
              {alerts.map(({ o, s }) => (
                <li key={o.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-700">
                    <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-amber-600" />
                    {o.name}
                  </span>
                  <Badge className={cn('shrink-0', s.badge)}>{s.label}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs tabs={STREAM_TABS} active={stream} onChange={id => setStream(id as StreamFilter)} />
        <div className="flex-1" />
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search name, donor, owner…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortKey(k => (k === 'severity' ? 'due' : 'severity'))}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort: {sortKey === 'severity' ? 'Severity' : 'Due date'}
        </Button>
      </div>

      {/* Table or empty state */}
      {visible.length === 0 ? (
        <EmptyState live={!isDemo} filtered={obligations.length > 0} onAdd={() => setShowAdd(true)} />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Obligation</Th>
              <Th>Stream</Th>
              <Th>Authority</Th>
              <Th>Frequency</Th>
              <Th>Next Due</Th>
              <Th>Status</Th>
              <Th>Owner</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </Thead>
          <Tbody>
            {visible.map(o => {
              const s = deriveSeverity(o, today)
              return (
                <tr key={o.id} className="hover:bg-slate-50/70">
                  <Td>
                    <p className="font-medium text-slate-800">{o.name}</p>
                    <p className="text-xs text-slate-400">
                      {OBLIGATION_TYPE_LABEL[o.type]} · {o.country} · {o.sector}
                    </p>
                  </Td>
                  <Td>
                    <Badge className="bg-slate-100 text-slate-600">{STREAM_LABEL[o.stream]}</Badge>
                  </Td>
                  <Td className="text-slate-600">{o.donorOrAuthority}</Td>
                  <Td className="text-slate-600">{FREQUENCY_LABEL[o.frequency]}</Td>
                  <Td className="font-mono text-xs text-slate-700">{o.nextDueDate}</Td>
                  <Td><Badge className={s.badge}>{s.label}</Badge></Td>
                  <Td className="text-slate-600">{o.owner}</Td>
                  <Td className="text-right">
                    {o.status === 'submitted' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <ShieldCheck className="h-3.5 w-3.5" /> Done
                      </span>
                    ) : (
                      <button
                        onClick={() => markSubmitted(o)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark submitted
                      </button>
                    )}
                  </Td>
                </tr>
              )
            })}
          </Tbody>
        </Table>
      )}

      {showAdd && (
        <AddObligationDialog
          onClose={() => setShowAdd(false)}
          onAdd={addObligations}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {currentUser && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <FolderClock className="h-3.5 w-3.5" />
          Scoped to {currentUser.orgName}. {isDemo ? 'Demo data - not saved to a live workspace.' : 'Saved to your secure database.'}
        </p>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------

function EmptyState({ live, filtered, onAdd }: { live: boolean; filtered: boolean; onAdd: () => void }) {
  if (filtered) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-14 text-center">
          <Filter className="h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">No obligations match this filter.</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Calendar className="h-7 w-7" />
        </div>
        <p className="mt-4 text-base font-semibold text-slate-700">No obligations tracked yet</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          {live
            ? 'Use the Predefined Routine generator to auto-populate your next four donor and regulatory deadlines, or add a custom obligation.'
            : 'Add your first obligation to start tracking deadlines.'}
        </p>
        <Button className="mt-5" onClick={onAdd}>
          <Plus className="h-4 w-4" /> Add Obligation
        </Button>
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------------------

const TYPE_OPTIONS: ObligationType[] = [
  'donor_financial',
  'donor_narrative',
  'regulatory_filing',
  'regulatory_expiry',
  'capacity_target',
]

function AddObligationDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (list: Obligation[], message: string) => void
}) {
  const [mode, setMode] = useState<'routine' | 'custom'>('routine')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <p className="flex items-center gap-2 font-semibold text-slate-800">
            <Plus className="h-4 w-4 text-emerald-600" /> Add Obligation
          </p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 pt-4">
          <Tabs
            tabs={[
              { id: 'routine', label: 'Predefined Routine' },
              { id: 'custom', label: 'Custom Entry' },
            ]}
            active={mode}
            onChange={id => setMode(id as 'routine' | 'custom')}
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {mode === 'routine' ? (
            <RoutineForm onAdd={onAdd} />
          ) : (
            <CustomForm onAdd={onAdd} />
          )}
        </div>
      </div>
    </div>
  )
}

function RoutineForm({ onAdd }: { onAdd: (list: Obligation[], message: string) => void }) {
  const facets = useMemo(() => templateFacets(), [])
  const [archetype, setArchetype] = useState<string>('')
  const [country, setCountry] = useState('')
  const [sector, setSector] = useState('')
  const [authority, setAuthority] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [firstDue, setFirstDue] = useState(toISODate(startOfToday()))

  const matches = useMemo(
    () =>
      ROUTINE_TEMPLATES.filter(
        t =>
          (!archetype || t.archetype === archetype) &&
          (!country || t.country === country) &&
          (!sector || t.sector === sector) &&
          (!authority || t.donorOrAuthority === authority),
      ),
    [archetype, country, sector, authority],
  )

  const selected = matches.find(t => t.id === templateId) ?? null

  function handleGenerate() {
    if (!selected) return
    const list = generateFromTemplate(selected, firstDue, 4)
    onAdd(list, `Generated the next 4 occurrences of “${selected.name}”.`)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Narrow by entity type, country, sector, and authority, then generate the next four
        occurrences automatically based on the routine&apos;s frequency.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Entity Type"
          placeholder="Any archetype"
          value={archetype}
          onChange={v => { setArchetype(v); setTemplateId('') }}
          options={ARCHETYPES.map(a => ({ value: a, label: a }))}
        />
        <Select
          label="Country"
          placeholder="Any country"
          value={country}
          onChange={v => { setCountry(v); setTemplateId('') }}
          options={facets.countries.map(c => ({ value: c, label: c }))}
        />
        <Select
          label="Sector"
          placeholder="Any sector"
          value={sector}
          onChange={v => { setSector(v); setTemplateId('') }}
          options={facets.sectors.map(s => ({ value: s, label: s }))}
        />
        <Select
          label="Donor / Authority"
          placeholder="Any authority"
          value={authority}
          onChange={v => { setAuthority(v); setTemplateId('') }}
          options={facets.authorities.map(a => ({ value: a, label: a }))}
        />
      </div>

      <Select
        label={`Routine (${matches.length} match${matches.length === 1 ? '' : 'es'})`}
        placeholder="Select a routine…"
        value={templateId}
        onChange={setTemplateId}
        options={matches.map(t => ({ value: t.id, label: `${t.name} · ${FREQUENCY_LABEL[t.frequency]}` }))}
      />

      {selected && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="flex items-center gap-1.5 font-medium text-slate-700">
            <Building2 className="h-3.5 w-3.5" /> {selected.archetype} · {selected.country} · {selected.sector}
          </p>
          <p className="mt-1">
            {FREQUENCY_LABEL[selected.frequency]} · owner defaults to {selected.defaultOwner} · authority {selected.donorOrAuthority}
          </p>
        </div>
      )}

      <Input
        label="First due date"
        type="date"
        value={firstDue}
        onChange={e => setFirstDue(e.target.value)}
      />

      <div className="flex justify-end">
        <Button onClick={handleGenerate} disabled={!selected}>
          <Plus className="h-4 w-4" /> Generate next 4 occurrences
        </Button>
      </div>
    </div>
  )
}

function CustomForm({ onAdd }: { onAdd: (list: Obligation[], message: string) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ObligationType>('donor_financial')
  const [frequency, setFrequency] = useState<ObligationFrequency>('quarterly')
  const [nextDueDate, setNextDueDate] = useState(toISODate(startOfToday()))
  const [authority, setAuthority] = useState('')
  const [owner, setOwner] = useState('')
  const [notes, setNotes] = useState('')

  const valid = name.trim().length > 0 && nextDueDate.length > 0

  function handleAdd() {
    if (!valid) return
    const ob = makeCustomObligation({
      name, type, frequency, nextDueDate, owner,
      donorOrAuthority: authority, notes,
    })
    onAdd([ob], 'Custom obligation added.')
  }

  return (
    <div className="space-y-4">
      <Input label="Obligation name" placeholder="e.g. Board-approved annual budget filing" value={name} onChange={e => setName(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Type"
          value={type}
          onChange={v => setType(v as ObligationType)}
          options={TYPE_OPTIONS.map(t => ({ value: t, label: OBLIGATION_TYPE_LABEL[t] }))}
        />
        <Select
          label="Frequency"
          value={frequency}
          onChange={v => setFrequency(v as ObligationFrequency)}
          options={FREQUENCY_OPTIONS.map(f => ({ value: f, label: FREQUENCY_LABEL[f] }))}
        />
        <Input label="Next due date" type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} />
        <Input label="Donor / Authority" placeholder="e.g. USAID" value={authority} onChange={e => setAuthority(e.target.value)} />
        <Input label="Owner" placeholder="e.g. Finance Manager" value={owner} onChange={e => setOwner(e.target.value)} />
      </div>
      <Input label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
      <div className="flex justify-end">
        <Button onClick={handleAdd} disabled={!valid}>
          <Plus className="h-4 w-4" /> Add obligation
        </Button>
      </div>
    </div>
  )
}
