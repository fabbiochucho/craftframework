// Evidence content check: reads an uploaded document and checks that its contents match what
// it is named / declared to be. Rule-based and local — no document leaves the server and the
// extracted text is never stored. The result informs the reviewer; it never approves or rejects.
// Self-check: `node netlify/lib/evidence-content.test.ts`.
import { inflateRawSync } from 'node:zlib'

export const CONTENT_CHECK_METHOD = 'text-rules-v1'

export interface DocumentKind {
  id: string
  label: string
  aliases: string[] // filename / title fragments (lower case)
  phrases: string[] // strong evidence the document IS this kind
  terms: string[] // supporting vocabulary
}

export const DOCUMENT_KINDS: DocumentKind[] = [
  { id: 'board_charter', label: 'Board charter / terms of reference', aliases: ['board charter', 'charter', 'terms of reference', 'tor'], phrases: ['board charter', 'terms of reference', 'charter of the board'], terms: ['board', 'directors', 'quorum', 'committee', 'chairman', 'chairperson', 'responsibilities', 'meetings'] },
  { id: 'minutes', label: 'Board or committee minutes / resolution', aliases: ['minutes', 'resolution', 'board meeting'], phrases: ['minutes of the', 'resolved that', 'board resolution', 'in attendance', 'apologies'], terms: ['meeting', 'present', 'chair', 'agenda', 'motion', 'seconded', 'resolved', 'quorum'] },
  { id: 'audited_financials', label: 'Audited financial statements', aliases: ['audited', 'financial statements', 'afs', 'accounts'], phrases: ['independent auditor', "auditor's report", 'auditors report', 'statement of financial position', 'statement of comprehensive income', 'financial statements'], terms: ['assets', 'liabilities', 'equity', 'revenue', 'cash flows', 'notes to the', 'opinion', 'audit'] },
  { id: 'management_letter', label: 'Audit management letter', aliases: ['management letter'], phrases: ['management letter', 'internal control observations'], terms: ['observation', 'recommendation', 'management response', 'audit', 'weakness'] },
  { id: 'risk_register', label: 'Risk register', aliases: ['risk register', 'risk log'], phrases: ['risk register', 'risk owner', 'residual risk', 'inherent risk'], terms: ['likelihood', 'impact', 'mitigation', 'rating', 'control', 'owner'] },
  { id: 'risk_framework', label: 'Risk management policy / framework', aliases: ['risk management', 'risk policy', 'risk framework', 'erm'], phrases: ['risk management policy', 'risk management framework', 'risk appetite', 'enterprise risk management'], terms: ['risk', 'tolerance', 'identification', 'assessment', 'monitoring', 'escalation'] },
  { id: 'code_of_conduct', label: 'Code of conduct / ethics', aliases: ['code of conduct', 'code of ethics', 'ethics'], phrases: ['code of conduct', 'code of ethics', 'ethical conduct'], terms: ['integrity', 'conduct', 'gifts', 'conflict', 'disciplinary', 'employees', 'behaviour', 'behavior'] },
  { id: 'conflict_of_interest', label: 'Conflict-of-interest policy / declaration', aliases: ['conflict of interest', 'coi', 'declaration of interest'], phrases: ['conflict of interest', 'declaration of interest', 'related party'], terms: ['declare', 'interest', 'disclosure', 'relationship', 'recuse'] },
  { id: 'whistleblowing', label: 'Whistleblowing / speak-up policy', aliases: ['whistleblowing', 'whistle blowing', 'speak up', 'speak-up'], phrases: ['whistleblowing', 'whistle-blowing', 'whistle blowing', 'speak up'], terms: ['anonymous', 'retaliation', 'report', 'concern', 'confidential', 'investigation'] },
  { id: 'anti_bribery', label: 'Anti-bribery / anti-corruption policy', aliases: ['anti-bribery', 'anti bribery', 'anti-corruption', 'anti corruption', 'abc policy'], phrases: ['anti-bribery', 'anti-corruption', 'bribery', 'corruption'], terms: ['facilitation', 'gifts', 'hospitality', 'due diligence', 'third party'] },
  { id: 'procurement_policy', label: 'Procurement policy / manual', aliases: ['procurement', 'purchasing'], phrases: ['procurement policy', 'procurement manual', 'procurement procedure', 'tender'], terms: ['quotation', 'bid', 'supplier', 'vendor', 'threshold', 'approval', 'evaluation'] },
  { id: 'internal_audit', label: 'Internal audit charter / plan / report', aliases: ['internal audit', 'audit plan', 'audit charter'], phrases: ['internal audit', 'audit plan', 'audit charter', 'audit committee'], terms: ['audit', 'findings', 'risk-based', 'assurance', 'independence', 'follow-up'] },
  { id: 'continuity_plan', label: 'Business continuity / disaster recovery plan', aliases: ['business continuity', 'bcp', 'disaster recovery', 'drp'], phrases: ['business continuity', 'disaster recovery', 'recovery time objective', 'continuity plan'], terms: ['recovery', 'incident', 'backup', 'critical', 'outage', 'crisis'] },
  { id: 'data_protection', label: 'Data protection / privacy policy', aliases: ['data protection', 'privacy', 'gdpr', 'ndpa', 'dpa'], phrases: ['data protection', 'privacy policy', 'personal data', 'data subject'], terms: ['consent', 'processing', 'retention', 'controller', 'breach', 'rights'] },
  { id: 'information_security', label: 'Information security / cybersecurity policy', aliases: ['information security', 'cyber', 'it security', 'isms'], phrases: ['information security', 'cybersecurity', 'cyber security', 'access control'], terms: ['password', 'encryption', 'access', 'incident', 'vulnerability', 'backup'] },
  { id: 'esg_policy', label: 'Sustainability / ESG policy or report', aliases: ['esg', 'sustainability', 'csr'], phrases: ['sustainability', 'environmental, social', 'esg', 'climate'], terms: ['emissions', 'social', 'governance', 'environment', 'stakeholder', 'targets'] },
  { id: 'materiality', label: 'Materiality assessment', aliases: ['materiality'], phrases: ['materiality assessment', 'material topics', 'materiality matrix', 'double materiality'], terms: ['stakeholder', 'impact', 'topics', 'significance', 'priority'] },
  { id: 'ghg_inventory', label: 'GHG emissions inventory', aliases: ['ghg', 'emissions', 'carbon', 'scope 1', 'scope 2'], phrases: ['greenhouse gas', 'scope 1', 'scope 2', 'tco2e', 'co2e'], terms: ['emission factor', 'emissions', 'fuel', 'electricity', 'tonnes', 'scope 3'] },
  { id: 'training_records', label: 'Training records / attendance', aliases: ['training', 'attendance'], phrases: ['attendance register', 'training record', 'certificate of attendance', 'training programme', 'training program'], terms: ['participants', 'trainer', 'session', 'attended', 'date', 'signature'] },
  { id: 'strategic_plan', label: 'Strategic plan', aliases: ['strategic plan', 'strategy'], phrases: ['strategic plan', 'strategic objectives', 'vision', 'mission'], terms: ['objectives', 'priorities', 'goals', 'targets', 'outcomes', 'implementation'] },
  { id: 'budget', label: 'Budget', aliases: ['budget'], phrases: ['budget', 'approved budget', 'budget estimates'], terms: ['expenditure', 'revenue', 'allocation', 'variance', 'forecast', 'actual'] },
  { id: 'bank_reconciliation', label: 'Bank reconciliation', aliases: ['bank reconciliation', 'bank rec', 'reconciliation'], phrases: ['bank reconciliation', 'balance per bank', 'balance per cash book', 'reconciled balance'], terms: ['bank statement', 'cash book', 'outstanding', 'uncleared', 'deposits'] },
  { id: 'delegation_of_authority', label: 'Delegation of authority / approval matrix', aliases: ['delegation of authority', 'doa', 'approval matrix', 'authority matrix'], phrases: ['delegation of authority', 'approval matrix', 'authority limits', 'approval limits'], terms: ['approve', 'limit', 'authority', 'signatory', 'threshold'] },
  { id: 'registration_certificate', label: 'Registration / incorporation certificate', aliases: ['certificate of incorporation', 'registration certificate', 'cac', 'incorporation'], phrases: ['certificate of incorporation', 'certificate of registration', 'corporate affairs commission', 'registrar'], terms: ['registered', 'incorporated', 'company', 'number', 'certify'] },
  { id: 'tax_clearance', label: 'Tax clearance certificate', aliases: ['tax clearance', 'tcc'], phrases: ['tax clearance certificate', 'tax clearance'], terms: ['tax', 'revenue', 'assessment', 'certify', 'years'] },
]

export const kindById = (id: string | null | undefined) => DOCUMENT_KINDS.find((k) => k.id === id) ?? null

const norm = (s: string) => s.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ')

// What the file name says it is (best alias match, longest alias wins).
export function kindFromName(fileName: string): DocumentKind | null {
  const n = ` ${norm(fileName.replace(/\.[a-z0-9]+$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2'))} `
  let best: { k: DocumentKind; len: number } | null = null
  for (const k of DOCUMENT_KINDS) for (const a of k.aliases) {
    if (n.includes(` ${a} `) && (!best || a.length > best.len)) best = { k, len: a.length }
  }
  return best?.k ?? null
}

const count = (hay: string, needle: string) => {
  let n = 0, i = hay.indexOf(needle)
  while (i !== -1 && n < 50) { n++; i = hay.indexOf(needle, i + needle.length) }
  return n
}

export function scoreKind(text: string, k: DocumentKind) {
  const t = norm(text)
  const phrases = k.phrases.filter((p) => count(t, p) > 0)
  const terms = k.terms.filter((w) => count(t, w) > 0)
  return { score: phrases.length * 3 + terms.length, phrases, terms }
}

export type ContentStatus = 'match' | 'possible_mismatch' | 'unreadable' | 'not_checked'
export interface ContentCheck {
  status: ContentStatus
  method: string
  expectedKind: string | null
  expectedLabel: string | null
  detectedKind: string | null
  detectedLabel: string | null
  matched: string[]
  warnings: string[]
  characters: number
  checkedAt: string
}

const MIN_TEXT = 40

export function checkContent(input: { fileName: string; declaredKind?: string | null; text: string | null }, now = new Date()): ContentCheck {
  const declared = kindById(input.declaredKind)
  const expected = declared ?? kindFromName(input.fileName)
  const base = { method: CONTENT_CHECK_METHOD, expectedKind: expected?.id ?? null, expectedLabel: expected?.label ?? null, checkedAt: now.toISOString() }
  const text = input.text ?? ''
  if (text.replace(/\s+/g, '').length < MIN_TEXT) {
    return { ...base, status: 'unreadable', detectedKind: null, detectedLabel: null, matched: [], characters: text.length,
      warnings: ['No readable text found (scanned image, photo, encrypted or empty file). Check the contents manually.'] }
  }
  const ranked = DOCUMENT_KINDS.map((k) => ({ k, ...scoreKind(text, k) })).sort((a, b) => b.score - a.score)
  const top = ranked[0].score >= 4 ? ranked[0] : null
  const warnings: string[] = []
  // A year in the file name (e.g. "Audited accounts 2025") should appear in the document.
  for (const y of input.fileName.match(/\b(19|20)\d{2}\b/g) ?? []) if (!text.includes(y)) warnings.push(`The file name mentions ${y}, but the document text does not.`)
  if (!expected) {
    return { ...base, status: 'not_checked', detectedKind: top?.k.id ?? null, detectedLabel: top?.k.label ?? null, matched: top ? top.phrases : [], characters: text.length,
      warnings: [...warnings, top ? `Could not tell from the name what this should be; its contents look like: ${top.k.label}.` : 'Could not tell from the name what this should be; choose the document type to check it.'] }
  }
  const mine = ranked.find((r) => r.k.id === expected.id)!
  // A match needs a strong phrase for the expected kind, or solid supporting vocabulary,
  // and must not be clearly outscored by a different kind of document.
  const strong = mine.phrases.length > 0 || mine.terms.length >= 4
  const outscored = top && top.k.id !== expected.id && top.score >= mine.score * 2 && top.score - mine.score >= 4
  if (strong && !outscored) {
    return { ...base, status: warnings.length ? 'possible_mismatch' : 'match', detectedKind: expected.id, detectedLabel: expected.label, matched: [...mine.phrases, ...mine.terms].slice(0, 8), characters: text.length, warnings }
  }
  return {
    ...base, status: 'possible_mismatch', detectedKind: top?.k.id ?? null, detectedLabel: top?.k.label ?? null, matched: top ? top.phrases.slice(0, 8) : [], characters: text.length,
    warnings: [...warnings, top && top.k.id !== expected.id
      ? `Named as "${expected.label}", but the contents look like "${top.k.label}".`
      : `Named as "${expected.label}", but the contents do not contain the expected wording.`],
  }
}

// --- Text extraction ---------------------------------------------------------------------------
// Minimal ZIP reader (DOCX/XLSX are ZIP containers): reads the central directory and inflates
// only the entries we need. Sizes are bounded to protect the function from zip bombs.
const MAX_ENTRY = 20 * 1024 * 1024
export function readZipEntries(buf: Buffer, want: (name: string) => boolean): Map<string, string> {
  const out = new Map<string, string>()
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) return out
  const entries = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < entries && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24)
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nlen)
    p += 46 + nlen + xlen + clen
    if (!want(name) || usize > MAX_ENTRY || local + 30 > buf.length) continue
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const data = buf.subarray(start, start + csize)
    try {
      out.set(name, (method === 0 ? data : inflateRawSync(data, { maxOutputLength: MAX_ENTRY })).toString('utf8'))
    } catch { /* unreadable entry: skip */ }
  }
  return out
}

const xmlText = (xml: string) => xml.replace(/<\/(w:p|a:p|row)>/g, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/[ 	]+/g, ' ')

const MAX_TEXT = 400_000

export async function extractText(bytes: ArrayBuffer, mimeType: string): Promise<string | null> {
  try {
    if (mimeType === 'application/pdf') {
      const { extractText: pdfText, getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(bytes.slice(0)), { verbosity: 0 })
      const { text } = await pdfText(pdf, { mergePages: true })
      return (Array.isArray(text) ? text.join('\n') : text).slice(0, MAX_TEXT)
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const files = readZipEntries(Buffer.from(bytes), (n) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n))
      return [...files.values()].map(xmlText).join('\n').slice(0, MAX_TEXT)
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const files = readZipEntries(Buffer.from(bytes), (n) => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n) || /^docProps\/(core|app)\.xml$/.test(n))
      return [...files.values()].map(xmlText).join('\n').slice(0, MAX_TEXT)
    }
    return null // images and ZIP archives: no text layer to read without OCR
  } catch {
    return null
  }
}
