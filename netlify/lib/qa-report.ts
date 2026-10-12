// Export renderers for the ESG Report Quality Checklist (Word-compatible HTML and CSV).
// Both render from the same view object, which for finalised periods is the frozen snapshot.
export interface QaViewRow {
  id: string; pack: string; title: string; label: string; severity: string; mandatory: boolean; reason: string; acceptance: string
  status: string; evidenceState: string; owner: string | null; reviewer: string | null; dueDate: string | null; naReason: string; blocker: string; notes: string
}
export interface QaView {
  period: { label: string; periodStart: string; periodEnd: string; status: string; approvedBy: string | null; approvedAt: string | null; preparedBy: string }
  organisation: string
  applicability: { status: string; scope: string; effectiveFrom: string | null; note: string; sourceUrl: string; requiresVerification: boolean }
  jurisdiction: { name: string; sourceTitle: string }
  summary: { version: string; score: number; band: string; coverage: number; evidenceAcceptance: number; mandatoryCoverage: number; mandatoryPassRate: number; readyForApproval: boolean; blockers: string[]; criticalOpen: string[] }
  rows: QaViewRow[]
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

export function renderQaDoc(v: QaView, generatedOn: string, meta: { reportId: string; author: string } = { reportId: '', author: '' }): string {
  const s = v.summary
  const draft = v.period.status !== 'final'
  const gate = s.readyForApproval ? 'Ready for approval' : `Approval blocked: ${s.blockers.join('; ')}`
  const rows = v.rows.map((r) => `<tr><td>${esc(r.id)}</td><td>${esc(r.title)}</td><td>${esc(r.label)}</td><td>${esc(r.severity)}</td><td>${esc(r.status)}</td><td>${esc(r.evidenceState)}</td><td>${esc(r.owner)}</td><td>${esc(r.status === 'not_applicable' ? r.naReason : r.status === 'blocked' ? r.blocker : r.notes)}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>ESG Report QA — ${esc(v.organisation)} — ${esc(v.period.label)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:10.5pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:3px;vertical-align:top}th{background:#e8f5ee}</style></head><body>
<h1>ESG Report Quality Review${draft ? ' — DRAFT' : ''}</h1>
<p><b>Organisation:</b> ${esc(v.organisation)}<br><b>Period:</b> ${esc(v.period.label)} (${esc(v.period.periodStart)} to ${esc(v.period.periodEnd)})<br>
<b>Report ID:</b> ${esc(meta.reportId)}<br><b>Checklist version:</b> ${esc(s.version)}<br><b>Generated:</b> ${esc(generatedOn)} by ${esc(meta.author)}${v.period.approvedBy ? `<br><b>Approved by:</b> ${esc(v.period.approvedBy)} on ${esc(v.period.approvedAt)}` : ''}<br><b>Prepared by:</b> ${esc(v.period.preparedBy)}</p>
<h2>Score and readiness</h2>
<p><b>Score ${esc(s.score)}/100 — ${esc(s.band)}.</b> ${esc(gate)}</p>
<p>Coverage ${esc(s.coverage)}% · Evidence acceptance ${esc(s.evidenceAcceptance)}% · Mandatory coverage ${esc(s.mandatoryCoverage)}% · Mandatory pass rate ${esc(s.mandatoryPassRate)}%</p>
<h2>Applicability</h2>
<p>${esc(v.jurisdiction.name)}: IFRS S1/S2 ${esc(v.applicability.status)}${v.applicability.effectiveFrom ? ` (periods beginning on or after ${esc(v.applicability.effectiveFrom)})` : ''}, scope ${esc(v.applicability.scope)}. ${esc(v.applicability.note)}<br>Source: ${esc(v.jurisdiction.sourceTitle)} — ${esc(v.applicability.sourceUrl)}${v.applicability.requiresVerification ? ' <b>(requires verification)</b>' : ''}</p>
<h2>Checklist detail</h2>
<table><tr><th>ID</th><th>Check</th><th>Class</th><th>Severity</th><th>Status</th><th>Evidence</th><th>Owner</th><th>Gap / rationale</th></tr>${rows}</table>
<h2>Limitations</h2><p>CRAFT supports structured report quality review and evidence management. A CRAFT score is an internal QA indicator for the stated scope, checklist version and evidence review. It is not a regulator-issued rating, certification, guarantee of compliance or assurance opinion, and does not replace official standards, regulator processes, legal or accounting advice, audit or independent assurance. Weights, score labels and the 30 general quality checks follow the CRAFT baseline approved on 12 October 2026.</p>
</body></html>`
}

export function qaCsv(v: QaView, escape: (x: unknown) => string): string {
  const cols = ['id', 'pack', 'title', 'label', 'severity', 'mandatory', 'status', 'evidenceState', 'owner', 'reviewer', 'dueDate', 'naReason', 'blocker', 'notes'] as const
  return [cols.join(','), ...v.rows.map((r) => cols.map((k) => escape(r[k])).join(','))].join('\n')
}
