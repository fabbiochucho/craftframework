import { useMemo, useState } from 'react'
import {
  FolderLock, FileCheck, ShieldCheck, Building2, Scale, Link as LinkIcon, UploadCloud,
  X, Eye, ExternalLink, AlertTriangle, Filter, Check, Flag, FileText, Globe2,
} from 'lucide-react'
import { useApp } from '../lib/context'
import { ARCHETYPES, Archetype } from '../lib/data'
import {
  COUNTRIES, SECTORS_BY_ARCHETYPE, subsectorsForSector, countryName, countryFlag,
  generateChecklist, requirementsByCategory, computeProgress, isVerifiedDataRoom,
  statusOf, STATUS_META, PRIORITY_META, MASTER_COMPLIANCE_MATRIX,
  seedDataRoom, ComplianceRequirement, DataRoomItem, EvidenceType,
  injectedStatutoryRequirements,
} from '../lib/dataroom'
import {
  REGULATORY_PILLARS, SECTOR_LABEL, SectorArchetype,
} from '../lib/regulatory-context'
import { Card, Button, Badge, Select, Input, ProgressBar, Toast, Tabs } from '../components/ui'
import { cn } from '../lib/utils'
import { DataRoomVaultsPage } from './DataRoomVaultsPage'
import { EvidencePage } from './EvidencePage'

const DATA_ROOM_TABS = [
  { id: 'compliance', label: 'Compliance Engine' },
  { id: 'frameworks', label: 'Framework Vaults' },
  { id: 'documents', label: 'Document Vault' },
]

// ICARF v4.0 - a single, unified Data Room. The dynamic regulatory-compliance
// checklist, the framework-specific evidence vaults, and the centralized document
// vault are now three tabs of one surface rather than three separate routes.
export function DataRoomPage() {
  const [tab, setTab] = useState('compliance')
  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
          <FolderLock className="h-4 w-4 text-emerald-600" /> Secure Data Room
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Unified Data Room</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          One vault for due-diligence: the dynamic compliance checklist, framework-specific evidence
          vaults, and your centralized document store.
        </p>
      </div>
      <Tabs tabs={DATA_ROOM_TABS} active={tab} onChange={setTab} />
      {tab === 'compliance' && <ComplianceEngineSection />}
      {tab === 'frameworks' && <DataRoomVaultsPage />}
      {tab === 'documents' && <EvidencePage />}
    </div>
  )
}

function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function ComplianceEngineSection() {
  const { currentUser, isDemo, entityProfile, setEntityProfile, logActivity } = useApp()
  const { archetype, country, sector, subsector } = entityProfile

  // The reviewer/oversight roles act as the Independent Assessor who can verify
  // or flag a client's evidence; the org assessor uploads but cannot self-verify.
  const isReviewer = currentUser?.role === 'portfolio' || currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  // Evidence records persist across profile changes (keyed by requirement id).
  const [items, setItems] = useState<Record<string, DataRoomItem>>(() =>
    seedDataRoom(isDemo, MASTER_COMPLIANCE_MATRIX),
  )
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [addFor, setAddFor] = useState<ComplianceRequirement | null>(null)
  const [flagFor, setFlagFor] = useState<ComplianceRequirement | null>(null)

  const reqs = useMemo(
    () => [
      ...generateChecklist(archetype, country, sector, subsector),
      ...injectedStatutoryRequirements(entityProfile.jurisdictions, entityProfile.regSector),
    ],
    [archetype, country, sector, subsector, entityProfile.jurisdictions, entityProfile.regSector],
  )
  const progress = useMemo(() => computeProgress(reqs, items), [reqs, items])
  const verified = useMemo(() => isVerifiedDataRoom(reqs, items), [reqs, items])
  const grouped = useMemo(() => requirementsByCategory(reqs), [reqs])

  const sectorOptions = archetype ? SECTORS_BY_ARCHETYPE[archetype as Archetype] : []
  const subsectorOptions = subsectorsForSector(sector)

  function saveEvidence(req: ComplianceRequirement, name: string, type: EvidenceType, value: string) {
    setItems(prev => ({
      ...prev,
      [req.id]: {
        requirementId: req.id,
        documentName: name.trim() || req.documentName,
        evidenceType: type,
        fileName: type === 'upload' ? value : undefined,
        fileUrl: type === 'external_link' ? value : undefined,
        status: 'uploaded',
        updatedAt: todayISO(),
      },
    }))
    setAddFor(null)
    setToast(type === 'external_link' ? '🔗 External link saved and pending verification.' : `⬆️ "${name || req.documentName}" uploaded to the Data Room.`)
    if (!isDemo) logActivity('Added Data Room evidence', req.documentName, 'Config')
  }

  function verifyDoc(req: ComplianceRequirement) {
    setItems(prev => {
      const existing = prev[req.id]
      if (!existing) return prev
      return { ...prev, [req.id]: { ...existing, status: 'verified', assessorNote: undefined, verifiedBy: currentUser?.email, updatedAt: todayISO() } }
    })
    setToast(`✅ ${req.documentName} verified by Assessor.`)
    if (!isDemo) logActivity('Verified Data Room document', req.documentName, 'Assessment')
  }

  function flagDoc(req: ComplianceRequirement, note: string) {
    setItems(prev => {
      const existing = prev[req.id]
      if (!existing) return prev
      return { ...prev, [req.id]: { ...existing, status: 'flagged', assessorNote: note.trim(), verifiedBy: undefined, updatedAt: todayISO() } }
    })
    setFlagFor(null)
    setToast(`🚩 ${req.documentName} flagged for correction.`)
    if (!isDemo) logActivity('Flagged Data Room document', req.documentName, 'Assessment')
  }

  const flaggedCount = progress.flagged

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
            <FolderLock className="h-4 w-4 text-emerald-600" /> Dynamic Data Room
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Regulatory Compliance Engine</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            A dynamic, due-diligence-ready checklist mapped to your <strong>archetype</strong>, <strong>country</strong> and{' '}
            <strong>sector</strong>. Complete it once and you are ready for investor, donor or sovereign review.
          </p>
        </div>
        {verified && (
          <span className="inline-flex animate-[fadeIn_0.3s_ease] items-center gap-2 rounded-full border border-emerald-300 bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/30">
            <ShieldCheck className="h-5 w-5" /> CRAFT Verified Data Room · Ready for Due Diligence
          </span>
        )}
      </div>

      {/* Profile selector */}
      <Card className="p-5">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Building2 className="h-3.5 w-3.5 text-emerald-600" /> Entity Profile - drives the dynamic checklist
        </p>
        <div className={cn('grid gap-3 sm:grid-cols-3', subsectorOptions.length > 0 && 'lg:grid-cols-4')}>
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

        {/* Global Regulatory jurisdiction injection (Feature 1) */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Globe2 className="h-3.5 w-3.5 text-emerald-600" /> Global Regulatory jurisdictions - inject statutory disclosures
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REGULATORY_PILLARS.map(p => {
              const on = entityProfile.jurisdictions.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    setEntityProfile({
                      jurisdictions: on
                        ? entityProfile.jurisdictions.filter(x => x !== p.id)
                        : [...entityProfile.jurisdictions, p.id],
                    })
                  }
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    on ? 'border-emerald-500 bg-emerald-100 text-emerald-800' : 'border-slate-300 bg-white text-slate-500 hover:border-emerald-300',
                  )}
                >
                  {p.flag} {p.name}
                </button>
              )
            })}
          </div>
          {entityProfile.jurisdictions.length > 0 && (
            <div className="mt-3 max-w-xs">
              <Select
                label="Regulatory sector archetype"
                placeholder="Select regulatory sector"
                value={entityProfile.regSector}
                onChange={v => setEntityProfile({ regSector: v as SectorArchetype })}
                options={(Object.keys(SECTOR_LABEL) as SectorArchetype[]).map(s => ({ value: s, label: SECTOR_LABEL[s] }))}
              />
            </div>
          )}
        </div>

        {archetype && (
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <Globe2 className="h-3.5 w-3.5 text-emerald-600" />
            Showing requirements for{' '}
            <span className="font-semibold text-emerald-700">{ARCHETYPES.find(a => a.id === archetype)?.label}</span>
            {country && <>· {countryFlag(country)} {countryName(country)}</>}
            {sector && <>· {sector}</>}
            {subsector && <>· {subsector}</>}
          </p>
        )}
      </Card>

      {/* No archetype yet */}
      {!archetype && (
        <Card className="p-10 text-center">
          <Scale className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-display text-lg font-bold text-slate-700">Select your entity archetype to begin</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            The Data Room adapts to who you are: a fintech startup, a member cooperative and a public ministry each see a
            different, hyper-relevant set of legal, financial and regulatory documents.
          </p>
          <div className="mx-auto mt-5 grid max-w-2xl gap-3 sm:grid-cols-3">
            {ARCHETYPES.map(a => (
              <button
                key={a.id}
                onClick={() => setEntityProfile({ archetype: a.id })}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-emerald-400 hover:shadow-sm"
              >
                <p className="text-sm font-bold text-emerald-900">{a.label}</p>
                <p className="mt-1 text-xs text-slate-500">{a.blurb}</p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {archetype && (
        <>
          {/* Progress + metrics */}
          <Card className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data Room Completeness</p>
                <p className="mt-1 font-display text-3xl font-bold text-emerald-900">{progress.percent}%</p>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                <Metric label="Provided" value={`${progress.provided}/${progress.total}`} tone="slate" />
                <Metric label="Verified" value={progress.verified} tone="emerald" />
                <Metric label="Flagged" value={progress.flagged} tone="rose" />
                <Metric label="Missing" value={progress.missing} tone="amber" />
              </div>
            </div>
            <ProgressBar value={progress.percent} className="mt-4 h-2.5" />
          </Card>

          {/* Reviewer banner */}
          {isReviewer ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Independent Assessor mode - review the client's Data Room, then <strong className="text-emerald-300">Verify</strong> or{' '}
              <strong className="text-rose-300">Flag</strong> each document.
            </div>
          ) : flaggedCount > 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
              <AlertTriangle className="h-4 w-4" />
              {flaggedCount} document{flaggedCount > 1 ? 's' : ''} flagged by your assessor - please review the notes and re-upload.
            </div>
          ) : null}

          {/* Filter */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {reqs.length} required document{reqs.length === 1 ? '' : 's'} across {grouped.length} categories
            </p>
            <button
              onClick={() => setOnlyOpen(o => !o)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                onlyOpen ? 'border-amber-400 bg-amber-100 text-amber-700' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300',
              )}
            >
              <Filter className="h-3.5 w-3.5" /> {onlyOpen ? 'Showing only outstanding' : 'Show only outstanding'}
            </button>
          </div>

          {/* Categorized checklist */}
          <div className="space-y-6">
            {grouped.map(group => {
              const visible = onlyOpen
                ? group.items.filter(r => statusOf(items[r.id]) === 'missing' || statusOf(items[r.id]) === 'flagged')
                : group.items
              if (visible.length === 0) return null
              return (
                <div key={group.category}>
                  <p className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-900">
                    <FileCheck className="h-4 w-4 text-emerald-600" /> {group.category}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{visible.length}</span>
                  </p>
                  <div className="space-y-2.5">
                    {visible.map(req => {
                      const item = items[req.id]
                      const status = statusOf(item)
                      const sm = STATUS_META[status]
                      return (
                        <Card key={req.id} className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-800">{req.documentName}</p>
                                <Badge className={PRIORITY_META[req.priority]}>{req.priority}</Badge>
                                <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold', sm.cls)}>
                                  <span className={cn('h-1.5 w-1.5 rounded-full', sm.dot)} /> {sm.label}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">{req.description}</p>

                              {/* Evidence reference */}
                              {item && (item.fileName || item.fileUrl) && (
                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                                  {item.evidenceType === 'external_link' ? (
                                    <a href={item.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:underline">
                                      <ExternalLink className="h-3 w-3" /> {item.documentName}
                                    </a>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                                      <FileText className="h-3 w-3" /> {item.fileName}
                                    </span>
                                  )}
                                  {item.verifiedBy && <span className="text-slate-400">Verified by {item.verifiedBy}</span>}
                                  {item.updatedAt && <span className="text-slate-400">· {item.updatedAt}</span>}
                                </div>
                              )}

                              {/* Assessor flag note */}
                              {status === 'flagged' && item?.assessorNote && (
                                <div className="mt-2 flex items-start gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
                                  <Flag className="mt-0.5 h-3 w-3 shrink-0" /> <span>{item.assessorNote}</span>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              {isReviewer ? (
                                status === 'missing' ? (
                                  <span className="text-xs italic text-slate-400">Awaiting client upload</span>
                                ) : (
                                  <>
                                    {item?.evidenceType === 'external_link' ? (
                                      <a href={item.fileUrl} target="_blank" rel="noreferrer">
                                        <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5" /> Open Link</Button>
                                      </a>
                                    ) : (
                                      <Button variant="outline" size="sm" onClick={() => setToast(`Encrypted preview · ${item?.fileName}`)}><Eye className="h-3.5 w-3.5" /> Preview</Button>
                                    )}
                                    {status !== 'verified' && (
                                      <Button size="sm" onClick={() => verifyDoc(req)}><Check className="h-3.5 w-3.5" /> Verify</Button>
                                    )}
                                    <Button variant="outline" size="sm" className="text-rose-600" onClick={() => setFlagFor(req)}><Flag className="h-3.5 w-3.5" /> Flag</Button>
                                  </>
                                )
                              ) : status === 'missing' ? (
                                <Button size="sm" onClick={() => setAddFor(req)}><UploadCloud className="h-3.5 w-3.5" /> Add Evidence</Button>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => setAddFor(req)}>
                                  {status === 'flagged' ? 'Re-upload' : 'Replace'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-center text-xs text-slate-400">
            Scoped to {currentUser?.orgName}. {isDemo ? 'Demo data - not saved to a live workspace.' : 'Evidence stays in this session.'}
          </p>
        </>
      )}

      {addFor && (
        <AddEvidenceDialog req={addFor} onClose={() => setAddFor(null)} onSave={saveEvidence} />
      )}
      {flagFor && (
        <FlagDialog req={flagFor} onClose={() => setFlagFor(null)} onFlag={flagDoc} />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: 'emerald' | 'rose' | 'amber' | 'slate' }) {
  const cls: Record<string, string> = {
    emerald: 'text-emerald-600', rose: 'text-rose-600', amber: 'text-amber-600', slate: 'text-slate-700',
  }
  return (
    <div>
      <p className={cn('text-xl font-bold', cls[tone])}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  )
}

// Dual-mode "Add Evidence" dialog - Upload or verifiable External Link.
function AddEvidenceDialog({
  req, onClose, onSave,
}: {
  req: ComplianceRequirement
  onClose: () => void
  onSave: (req: ComplianceRequirement, name: string, type: EvidenceType, value: string) => void
}) {
  const [tab, setTab] = useState<EvidenceType>('upload')
  const [name, setName] = useState(req.documentName)
  const [url, setUrl] = useState('')
  const [fileName, setFileName] = useState('')

  const canSave = tab === 'upload' ? !!fileName : /^https?:\/\/.+/.test(url)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <p className="font-semibold text-slate-800">Add Evidence</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-5 py-4">
          <p className="mb-3 text-xs text-slate-500">Required: <span className="font-semibold text-slate-700">{req.documentName}</span></p>

          {/* Mode tabs */}
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {([['upload', 'Upload', UploadCloud], ['external_link', 'External Link', LinkIcon]] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors',
                  tab === id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500',
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <Input label="Document Name" value={name} onChange={e => setName(e.target.value)} placeholder="Your label for this document" />
            {tab === 'upload' ? (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 hover:border-emerald-300">
                <UploadCloud className="h-6 w-6" />
                {fileName ? <span className="font-medium text-emerald-700">{fileName}</span> : 'Drag & drop or click to upload (PDF/DOCX/XLSX)'}
                <input
                  type="file"
                  className="hidden"
                  onChange={e => setFileName(e.target.files?.[0]?.name ?? 'document.pdf')}
                />
              </label>
            ) : (
              <div>
                <Input label="Shareable URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://drive.google.com/..." />
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(url, '_blank', 'noopener')}
                    disabled={!/^https?:\/\/.+/.test(url)}
                  >
                    <LinkIcon className="h-3.5 w-3.5" /> Test Link
                  </Button>
                  <p className="text-[11px] text-slate-400">Ensure sharing permissions are set so your assessor can open it.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!canSave} onClick={() => onSave(req, name, tab, tab === 'upload' ? fileName : url)}>
            Save Evidence
          </Button>
        </div>
      </div>
    </div>
  )
}

// Assessor "Flag for Correction" dialog - mandatory note.
function FlagDialog({
  req, onClose, onFlag,
}: {
  req: ComplianceRequirement
  onClose: () => void
  onFlag: (req: ComplianceRequirement, note: string) => void
}) {
  const [note, setNote] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <p className="flex items-center gap-2 font-semibold text-slate-800"><Flag className="h-4 w-4 text-rose-600" /> Flag for Correction</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-5 py-4">
          <p className="mb-2 text-xs text-slate-500">{req.documentName}</p>
          <label className="mb-1 block text-sm font-medium text-slate-700">Correction note (sent to the client)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            placeholder="e.g. Tax clearance certificate is expired. Please upload the current-year certificate."
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" size="sm" disabled={!note.trim()} onClick={() => onFlag(req, note)}>
            <Flag className="h-3.5 w-3.5" /> Flag Document
          </Button>
        </div>
      </div>
    </div>
  )
}
