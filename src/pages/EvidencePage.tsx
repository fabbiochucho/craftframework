import { useState } from 'react'
import { FolderLock, FileText, FileSpreadsheet, FileImage, Eye, X, ShieldCheck, Clock, ShieldX } from 'lucide-react'
import { EVIDENCE_DOCS, EvidenceDoc } from '../lib/data'
import { Card, CardContent, Badge } from '../components/ui'
import { ExcelImport } from '../components/ExcelImport'
import { useAuthCtx } from '../lib/context'

const typeIcon: Record<EvidenceDoc['type'], typeof FileText> = {
  PDF: FileText, XLSX: FileSpreadsheet, DOCX: FileText, IMG: FileImage,
}
const statusMeta: Record<EvidenceDoc['status'], { icon: typeof ShieldCheck; cls: string }> = {
  Validated: { icon: ShieldCheck, cls: 'bg-emerald-100 text-emerald-700' },
  'Pending Review': { icon: Clock, cls: 'bg-amber-100 text-amber-700' },
  Invalidated: { icon: ShieldX, cls: 'bg-slate-200 text-slate-600' },
}

export function EvidencePage() {
  const { currentUser, isDemo } = useAuthCtx()
  const [preview, setPreview] = useState<EvidenceDoc | null>(null)
  // Demo sessions show an illustrative document set; a live vault starts empty
  // and fills as documents are imported or uploaded.
  const docs = isDemo ? EVIDENCE_DOCS : []

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
          <FolderLock className="h-4 w-4 text-emerald-600" /> Document Vault
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Centralized Evidence Vault</h1>
        <p className="mt-1 text-sm text-slate-500">Scoped to your organization.</p>
      </div>

      <Card className="p-5">
        <ExcelImport orgId={currentUser?.orgId ?? 'org-001'} />
      </Card>

      {docs.length === 0 ? (
        <Card className="p-10 text-center">
          <FolderLock className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-display text-lg font-bold text-slate-700">No documents in the vault yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Import an assessment workbook above, or add evidence from the Compliance Engine. Uploaded
            documents are scoped to your organization.
          </p>
        </Card>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map(doc => {
          const Icon = typeIcon[doc.type]
          const sm = statusMeta[doc.status]
          return (
            <Card key={doc.id} className="group overflow-hidden">
              <div className="flex h-32 items-center justify-center border-b border-slate-100 bg-slate-50">
                <Icon className="h-12 w-12 text-slate-300 transition-colors group-hover:text-emerald-400" />
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-800" title={doc.name}>{doc.name}</p>
                  <Badge className={`shrink-0 ${sm.cls}`}>
                    <sm.icon className="mr-1 h-3 w-3" /> {doc.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">{doc.domain}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono">↳ {doc.linkedRisk} · {doc.sizeKb} KB</span>
                  <button onClick={() => setPreview(doc)} className="flex items-center gap-1 font-medium text-emerald-600 hover:underline">
                    <Eye className="h-3 w-3" /> Preview
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">{doc.uploadedBy} · {doc.uploadedAt}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      )}

      {/* PDF preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <p className="font-semibold text-slate-800">{preview.name}</p>
              <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex h-80 flex-col items-center justify-center bg-slate-100 text-slate-400">
              <FileText className="h-16 w-16" />
              <p className="mt-3 text-sm">{preview.type} · {preview.sizeKb} KB</p>
              <p className="text-xs">Linked to finding {preview.linkedRisk}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
