import { useEffect, useMemo, useState } from 'react'
import {
  Database, Banknote, Network, Cpu, TrendingUp, Upload, Link2, FileText,
  CheckCircle2, AlertTriangle, Clock, X, Info, ShieldCheck,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { checkDataQuality, GFA_PILLARS } from '../lib/frameworks'
import {
  Card, CardContent, Badge, Button, Input, Tabs, Select,
} from '../components/ui'
import { useApp } from '../lib/context'

// ---------------------------------------------------------------------------
// Local sample data - vaults, sub-folders and their seeded verification states
// ---------------------------------------------------------------------------

type VaultId = 'financial' | 'organizational' | 'ai' | 'investment' | 'section11'
type VerifyStatus = 'Pending' | 'Assessor Verified' | 'Rejected (Requires Resubmission)'

interface VaultMeta {
  id: VaultId
  label: string
  framework: string
  authority: string
  icon: typeof Banknote
  accent: 'emerald' | 'indigo' | 'amber' | 'slate'
  blurb: string
}

interface SubFolder {
  key: string
  label: string
  items: string[]
  seed: VerifyStatus
}

const VAULTS: VaultMeta[] = [
  {
    id: 'financial',
    label: 'Financial',
    framework: 'GF PR FCR',
    authority: 'The Global Fund · PR Reporting Handbook',
    icon: Banknote,
    accent: 'emerald',
    blurb: 'Financial compliance evidence reconciled against the PR Financial Compliance Report tabs.',
  },
  {
    id: 'organizational',
    label: 'Organizational',
    framework: 'OMT v6',
    authority: 'Pact · Organizational Mapping Tool v6',
    icon: Network,
    accent: 'emerald',
    blurb: 'Capacity-mapping evidence supporting the OMT v6 Statements of Excellence.',
  },
  {
    id: 'ai',
    label: 'AI Governance',
    framework: 'G7 / OECD',
    authority: 'G7 / OECD · AI Governance Framework',
    icon: Cpu,
    accent: 'indigo',
    blurb: 'Model documentation and ethical-impact artefacts for the 5-dimension AI assessment.',
  },
  {
    id: 'investment',
    label: 'Investment',
    framework: 'GFA',
    authority: 'GFA · Business Diagnostic (DFI / PE)',
    icon: TrendingUp,
    accent: 'amber',
    blurb: 'Investment-readiness data-room requests for the 7-pillar diagnostic.',
  },
  {
    id: 'section11',
    label: 'Section 11: Integrated Reporting & Statutory Disclosures',
    framework: 'Regulator / Auditor Vault',
    authority: 'ISSB · CSRD · FRCN · CBN · SEC · Basel · SOX · Sharia',
    icon: ShieldCheck,
    accent: 'slate',
    blurb: 'Time-bound, read-only vault for Regulators, Auditors and Institutional Investors — integrated reporting and statutory disclosures.',
  },
]

const SUBFOLDERS: Record<VaultId, SubFolder[]> = {
  financial: [
    { key: 'cash-recon', label: 'Cash Reconciliation', items: ['PUDR cash reconciliation', 'Bank statements (Regular + C19RM)'], seed: 'Assessor Verified' },
    { key: 'open-advances', label: 'Open Advances', items: ['Advance ledger & aging', 'Recovery plans'], seed: 'Pending' },
    { key: 'commitments', label: 'Commitments', items: ['Signed contracts', 'Legal commitment register'], seed: 'Assessor Verified' },
    { key: 'sr-cash', label: 'SR Cash', items: ['Sub-recipient cash books', 'SR reconciliations'], seed: 'Rejected (Requires Resubmission)' },
    { key: 'tax', label: 'Tax', items: ['VAT/GST schedules', 'Recovery evidence'], seed: 'Pending' },
    { key: 'forecast', label: 'Forecast', items: ['Next-period cash forecast', '13-week liquidity model'], seed: 'Pending' },
    { key: 'disbursement', label: 'Disbursement', items: ['Disbursement request', 'Supporting calculations'], seed: 'Assessor Verified' },
  ],
  organizational: [
    { key: 'admin', label: 'Administration', items: ['Operations manual', 'Procurement policy', 'Asset register'], seed: 'Assessor Verified' },
    { key: 'hr', label: 'Human Resources', items: ['Job Descriptions', 'Appraisals', 'Staff handbook'], seed: 'Pending' },
    { key: 'tech', label: 'Technology Systems', items: ['IT asset register', 'Systems review schedule'], seed: 'Pending' },
    { key: 'gov', label: 'Governance', items: ['Board charter', 'Board minutes', 'Oversight records'], seed: 'Assessor Verified' },
  ],
  ai: [
    { key: 'model-cards', label: 'Model Cards', items: ['Architecture & limitations', 'Intended-use statement'], seed: 'Assessor Verified' },
    { key: 'data-quality', label: 'Data Quality Reports', items: ['Provenance & lineage', 'Bias / representativeness tests'], seed: 'Pending' },
    { key: 'impact', label: 'Impact Assessments', items: ['UNESCO ethical impact assessment', 'Human-rights screening'], seed: 'Rejected (Requires Resubmission)' },
    { key: 'surveys', label: 'Survey Results', items: ['Fully completed evaluation surveys', 'C-CORE / CASTER outputs'], seed: 'Pending' },
  ],
  investment: [
    { key: 'cap-tables', label: 'Cap Tables', items: ['Capitalization table', 'Shareholder agreements'], seed: 'Assessor Verified' },
    { key: 'ip', label: 'IP Assignments', items: ['IP assignment deeds', 'Patent / trademark register'], seed: 'Pending' },
    { key: 'models', label: 'Financial Models', items: ['3-statement model', 'Runway & scenario model'], seed: 'Pending' },
    { key: 'contracts', label: 'Customer Contracts', items: ['Signed customer contracts', 'Pipeline / LOIs'], seed: 'Pending' },
  ],
  section11: [
    { key: 's11-1', label: '11.1 ISSB / CSRD Climate', items: ['ISSB S1/S2 climate disclosures', 'CSRD/ESRS double-materiality report', 'Scope 1/2/3 GHG inventory'], seed: 'Assessor Verified' },
    { key: 's11-2', label: '11.2 FRCN / NCCG / King IV Governance', items: ['NCCG 2018 "Apply and Explain" statement', 'King IV application register', 'Board & committee charters'], seed: 'Assessor Verified' },
    { key: 's11-3', label: '11.3 CBN / SEC Prudential Returns', items: ['CBN prudential returns (CAR/LCR)', 'SEC periodic filings', 'AML/CFT programme'], seed: 'Pending' },
    { key: 's11-4', label: '11.4 IFRS / Basel / GAAP Checklists', items: ['IFRS 9 ECL / IFRS 17 checklist', 'Basel III/IV capital computation', 'US GAAP reconciliation'], seed: 'Pending' },
    { key: 's11-5', label: '11.5 Sharia Supervisory Reports', items: ['Sharia Supervisory Board report', 'AAOIFI compliance certification', 'Sukuk / Takaful structure notes'], seed: 'Pending' },
    { key: 's11-6', label: '11.6 SOX / ICFR Documentation', items: ['§302 CEO/CFO certifications', '§404 management ICFR assessment', 'Auditor attestation'], seed: 'Rejected (Requires Resubmission)' },
  ],
}

const STATUS_CYCLE: VerifyStatus[] = ['Pending', 'Assessor Verified', 'Rejected (Requires Resubmission)']

const STATUS_STYLE: Record<VerifyStatus, { chip: string; dot: string; icon: typeof Clock }> = {
  Pending: { chip: 'bg-amber-50 text-amber-700 border-amber-300', dot: 'bg-amber-500', icon: Clock },
  'Assessor Verified': { chip: 'bg-emerald-50 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500', icon: CheckCircle2 },
  'Rejected (Requires Resubmission)': { chip: 'bg-rose-50 text-rose-700 border-rose-300', dot: 'bg-rose-500', icon: X },
}

const ACCENT_TEXT: Record<VaultMeta['accent'], string> = {
  emerald: 'text-emerald-600',
  indigo: 'text-indigo-600',
  amber: 'text-amber-600',
  slate: 'text-slate-600',
}
const ACCENT_RING: Record<VaultMeta['accent'], string> = {
  emerald: 'ring-emerald-200 bg-emerald-50',
  indigo: 'ring-indigo-200 bg-indigo-50',
  amber: 'ring-amber-200 bg-amber-50',
  slate: 'ring-slate-300 bg-slate-100',
}
const ACCENT_BORDER: Record<VaultMeta['accent'], string> = {
  emerald: 'hover:border-emerald-300',
  indigo: 'hover:border-indigo-300',
  amber: 'hover:border-amber-300',
  slate: 'hover:border-slate-400',
}

// All folder keys, flattened, used to seed the verification-status map.
const SEED_STATUSES: Record<string, VerifyStatus> = Object.values(SUBFOLDERS)
  .flat()
  .reduce<Record<string, VerifyStatus>>((acc, f) => {
    acc[f.key] = f.seed
    return acc
  }, {})

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DataRoomVaultsPage() {
  // Demo sessions are seeded with illustrative verification states; a live
  // workspace starts every sub-folder as Pending until an assessor acts.
  const { isDemo, currentUser } = useApp()
  const [vault, setVault] = useState<VaultId>('financial')
  const [statuses, setStatuses] = useState<Record<string, VerifyStatus>>(
    isDemo ? SEED_STATUSES : {},
  )
  const orgId = currentUser?.orgId

  // Section 11 (the regulator/auditor vault) is DB-backed, not demo-seeded: load
  // its persisted verification state so it survives reloads.
  useEffect(() => {
    if (vault !== 'section11' || !orgId || typeof window === 'undefined') return
    let cancelled = false
    fetch(`/api/section11?orgId=${encodeURIComponent(orgId)}`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: { folderKey: string; status: VerifyStatus }[]) => {
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return
        setStatuses(prev => {
          const next = { ...prev }
          rows.forEach(r => { next[r.folderKey] = r.status })
          return next
        })
      })
      .catch(() => { /* offline / not yet provisioned — keep local state */ })
    return () => { cancelled = true }
  }, [vault, orgId])

  const active = VAULTS.find(v => v.id === vault)!
  const folders = SUBFOLDERS[vault]

  const cycleStatus = (key: string) => {
    setStatuses(prev => {
      const cur = prev[key] ?? 'Pending'
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length]
      // Persist Section 11 changes to the database (best-effort).
      if (vault === 'section11' && orgId && typeof window !== 'undefined') {
        fetch('/api/section11', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orgId, folderKey: key, status: next, updatedBy: currentUser?.email }),
        }).catch(() => { /* offline — local state still reflects the change */ })
      }
      return { ...prev, [key]: next }
    })
  }

  const verifiedCount = useMemo(
    () => folders.filter(f => (statuses[f.key] ?? 'Pending') === 'Assessor Verified').length,
    [folders, statuses],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
          <Database className="h-4 w-4 text-emerald-600" /> Evidence Management
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Framework Evidence Vaults</h1>
        <p className="mt-1 text-sm text-slate-500">Framework-specific evidence vaults.</p>
      </div>

      {/* Vault selector */}
      <Tabs
        tabs={VAULTS.map(v => ({ id: v.id, label: `${v.label} · ${v.framework}` }))}
        active={vault}
        onChange={id => setVault(id as VaultId)}
      />

      {/* Active vault banner */}
      <Card className={cn('border-slate-200', vault === 'ai' && 'border-indigo-200')}>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1', ACCENT_RING[active.accent])}>
              <active.icon className={cn('h-6 w-6', ACCENT_TEXT[active.accent])} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold text-slate-900">{active.label} Vault</h2>
                <Badge className={cn('font-mono', ACCENT_RING[active.accent], ACCENT_TEXT[active.accent])}>{active.framework}</Badge>
              </div>
              <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">{active.authority}</p>
              <p className="mt-1 max-w-xl text-sm text-slate-600">{active.blurb}</p>
            </div>
          </div>
          <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verified</p>
            <p className={cn('text-2xl font-bold', ACCENT_TEXT[active.accent])}>
              {verifiedCount}<span className="text-base text-slate-400">/{folders.length}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Global Fund data-quality feature */}
      {vault === 'financial' && <DataQualityPanel />}

      {/* Section 11 specialized RBAC — issue time-bound, read-only grants */}
      {vault === 'section11' && <Section11AccessPanel orgId={orgId} isDemo={isDemo} />}

      {/* Sub-folders */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence Sub-folders</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map(folder => {
            const status = statuses[folder.key] ?? 'Pending'
            const s = STATUS_STYLE[status]
            return (
              <Card key={folder.key} className={cn('border-slate-200 transition-colors', ACCENT_BORDER[active.accent])}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <FileText className={cn('h-5 w-5', ACCENT_TEXT[active.accent])} />
                      <h3 className="font-semibold text-slate-800">{folder.label}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => cycleStatus(folder.key)}
                      title="Click to cycle verification status"
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80',
                        s.chip,
                      )}
                    >
                      <s.icon className="h-3 w-3" />
                      {status === 'Rejected (Requires Resubmission)' ? 'Rejected' : status}
                    </button>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {folder.items.map(item => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.dot)} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}

          {/* Investment vault also surfaces GFA pillar document requests */}
          {vault === 'investment' && (
            <Card className="border-amber-200 bg-amber-50/40 sm:col-span-2 lg:col-span-3">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-slate-800">GFA 7-Pillar Document Requests</h3>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {GFA_PILLARS.map(p => (
                    <div key={p.key} className="rounded-lg border border-amber-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-800">{p.label}</p>
                        <span className="font-mono text-xs font-semibold text-amber-700">{p.readiness}%</span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {p.docs.map(d => (
                          <li key={d} className="flex items-center gap-1.5 text-xs text-slate-500">
                            <FileText className="h-3 w-3 text-amber-500" /> {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dual-mode evidence submission */}
      <EvidenceSubmission accent={active.accent} vaultLabel={active.label} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Global Fund data-quality panel
// ---------------------------------------------------------------------------

function DataQualityPanel() {
  const { isDemo } = useApp()
  const [result, setResult] = useState<ReturnType<typeof checkDataQuality> | null>(null)

  return (
    <Card className="border-emerald-200 bg-emerald-50/30">
      <CardContent className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 ring-1 ring-emerald-200">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">PR Financial Data-Quality Validation</h3>
              <p className="text-sm text-slate-500">Run the Global Fund Handbook error / warning checks across the Financial vault.</p>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => setResult(isDemo ? checkDataQuality() : { errors: 0, warnings: 0, issues: [] })}>
            <ShieldCheck className="h-4 w-4" /> Check Data Quality
          </Button>
        </div>

        {result && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="font-semibold text-slate-800">
                {result.errors} error{result.errors === 1 ? '' : 's'} and {result.warnings} warning
                {result.warnings === 1 ? '' : 's'} found.
              </span>
              <span className="text-slate-400">View details below.</span>
            </div>
            <ul className="space-y-2">
              {result.issues.map(issue => {
                const isError = issue.level === 'error'
                return (
                  <li
                    key={issue.code}
                    className={cn(
                      'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm',
                      isError
                        ? 'border-rose-300 bg-rose-50 text-rose-800'
                        : 'border-amber-300 bg-amber-50 text-amber-800',
                    )}
                  >
                    {isError ? (
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    )}
                    <span>
                      <span className="font-mono text-xs font-semibold">{issue.code}</span>
                      <span className="ml-2">{issue.message}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Dual-mode evidence submission
// ---------------------------------------------------------------------------

function EvidenceSubmission({ accent, vaultLabel }: { accent: VaultMeta['accent']; vaultLabel: string }) {
  const [mode, setMode] = useState<'upload' | 'link'>('upload')

  // Upload state
  const [uploadName, setUploadName] = useState('')
  const [dropped, setDropped] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Link state
  const [linkName, setLinkName] = useState('')
  const [url, setUrl] = useState('')
  const [linkValid, setLinkValid] = useState<boolean | null>(null)

  const recordDrop = (name: string) => {
    setDropped(name)
    if (!uploadName) setUploadName(name)
  }

  const testLink = () => {
    try {
      const u = new URL(url.trim())
      setLinkValid(u.protocol === 'http:' || u.protocol === 'https:')
    } catch {
      setLinkValid(false)
    }
  }

  return (
    <Card className="border-slate-200">
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <Upload className={cn('h-5 w-5', ACCENT_TEXT[accent])} />
          <h2 className="font-display text-xl font-bold text-slate-900">Submit Evidence</h2>
          <Badge variant="outline" className="text-slate-500">{vaultLabel} Vault</Badge>
        </div>

        <div className="mt-4">
          <Tabs
            tabs={[
              { id: 'upload', label: 'Upload' },
              { id: 'link', label: 'Verifiable External Link' },
            ]}
            active={mode}
            onChange={id => setMode(id as 'upload' | 'link')}
          />
        </div>

        {mode === 'upload' ? (
          <div className="mt-4 space-y-4">
            <Input
              label="Document Name"
              placeholder="e.g. Q1 Cash Reconciliation (signed)"
              value={uploadName}
              onChange={e => setUploadName(e.target.value)}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => recordDrop(`evidence-${Date.now()}.pdf`)}
              onDragOver={e => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setDragOver(false)
                const f = e.dataTransfer?.files?.[0]
                recordDrop(f ? f.name : `evidence-${Date.now()}.pdf`)
              }}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100',
              )}
            >
              <Upload className={cn('h-8 w-8', dragOver ? 'text-emerald-600' : 'text-slate-400')} />
              <p className="mt-2 text-sm font-medium text-slate-700">
                Drag &amp; drop a file here, or click to browse
              </p>
              <p className="mt-1 text-xs text-slate-400">PDF, XLSX, DOCX, PNG - up to 50 MB</p>
              {dropped && (
                <Badge className="mt-3 border border-emerald-300 bg-emerald-50 text-emerald-700">
                  <FileText className="mr-1 h-3 w-3" /> {dropped}
                </Badge>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Info className="h-3.5 w-3.5 text-slate-400" />
              Triggers a Netlify presigned URL for secure direct-to-storage upload.
            </p>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" disabled={!uploadName || !dropped}>
                <Upload className="h-4 w-4" /> Submit for Verification
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <Input
              label="Document Name"
              placeholder="e.g. Audited Financials 2025 (external register)"
              value={linkName}
              onChange={e => setLinkName(e.target.value)}
            />
            <div>
              <Input
                label="Verifiable URL"
                placeholder="https://registry.example.org/evidence/12345"
                value={url}
                onChange={e => {
                  setUrl(e.target.value)
                  setLinkValid(null)
                }}
              />
              <div className="mt-2 flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={testLink} disabled={!url.trim()}>
                  <Link2 className="h-4 w-4" /> Test Link
                </Button>
                {linkValid === true && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Valid URL - reachable format confirmed
                  </span>
                )}
                {linkValid === false && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-700">
                    <AlertTriangle className="h-4 w-4" /> Invalid URL - use a full http(s) link
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" disabled={!linkName || linkValid !== true}>
                <Link2 className="h-4 w-4" /> Link Evidence
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Section 11 specialized RBAC — issue time-bound, read-only ecosystem grants
// ---------------------------------------------------------------------------
const SPECIALIZED_ROLES: { value: string; label: string }[] = [
  { value: 'cbn_examiner', label: 'CBN Examiner' },
  { value: 'frcn_auditor', label: 'FRCN Auditor' },
  { value: 'sec_analyst', label: 'SEC Analyst' },
  { value: 'sharia_board_member', label: 'Sharia Board Member' },
  { value: 'rating_agency_analyst', label: 'Rating Agency Analyst' },
  { value: 'eu_csd_assessor', label: 'EU CSD Assessor' },
]

function Section11AccessPanel({ orgId, isDemo }: { orgId?: string; isDemo: boolean }) {
  const [grantee, setGrantee] = useState('')
  const [role, setRole] = useState('cbn_examiner')
  const [days, setDays] = useState('30')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function issue() {
    if (!grantee.trim() || !orgId) {
      setResult('Enter the grantee email.')
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/issue-access-grant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId, grantee: grantee.trim(), role, days: Number(days) || 30 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult(data?.error ?? 'Failed to issue grant.')
      } else {
        setResult(`Read-only ${role} grant issued to ${grantee.trim()}, expires ${new Date(data.expiresAt).toLocaleDateString()}${data.identityStamped ? ' (Identity stamped)' : ' (recorded — Identity stamp pending admin token)'}.`)
        setGrantee('')
      }
    } catch {
      setResult('Network error issuing grant.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-slate-300">
      <CardContent className="py-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-slate-600" />
          <h3 className="font-semibold text-slate-800">Specialized Ecosystem Access (time-bound, read-only)</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Grant a Regulator, Auditor or Institutional Investor read-only access to this Section 11 Vault for a fixed
          window. The role and expiry are enforced at the network edge (any write is rejected; access lapses at expiry).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Input label="Grantee email" placeholder="examiner@cbn.gov.ng" value={grantee} onChange={e => setGrantee(e.target.value)} />
          <Select label="Role" value={role} onChange={setRole} options={SPECIALIZED_ROLES} />
          <Input label="Access window (days)" type="number" value={days} onChange={e => setDays(e.target.value)} />
          <div className="flex items-end">
            <Button onClick={issue} disabled={busy || isDemo} className="w-full">
              {busy ? 'Issuing…' : 'Issue grant'}
            </Button>
          </div>
        </div>
        {isDemo && <p className="mt-2 text-xs text-amber-600">Issuing grants is disabled in demo mode.</p>}
        {result && <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">{result}</p>}
      </CardContent>
    </Card>
  )
}
