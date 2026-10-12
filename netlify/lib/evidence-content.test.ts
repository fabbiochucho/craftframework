// Self-check — run directly with `node netlify/lib/evidence-content.test.ts`.
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { checkContent, DOCUMENT_KINDS, extractText, kindFromName, readZipEntries } from './evidence-content.ts'

const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

async function pdf(lines: string[]): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595, 842])
  lines.forEach((l, i) => page.drawText(l, { x: 40, y: 800 - i * 16, size: 10, font }))
  const bytes = await doc.save()
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

// Minimal ZIP writer for test fixtures (deflate entries + central directory).
function zip(files: Record<string, string>): ArrayBuffer {
  const parts: Buffer[] = [], central: Buffer[] = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.from(content, 'utf8'), data = deflateRawSync(raw), nb = Buffer.from(name)
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nb.length, 26)
    const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(raw.length, 24); cd.writeUInt16LE(nb.length, 28); cd.writeUInt32LE(offset, 42)
    parts.push(local, nb, data); central.push(cd, nb)
    offset += 30 + nb.length + data.length
  }
  const cdBuf = Buffer.concat(central)
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16)
  const all = Buffer.concat([...parts, cdBuf, end])
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) as ArrayBuffer
}

// Catalogue integrity
assert.equal(new Set(DOCUMENT_KINDS.map((k) => k.id)).size, DOCUMENT_KINDS.length)

// The file name decides what the document should be; longest alias wins.
assert.equal(kindFromName('Board-Charter_2025.pdf')?.id, 'board_charter')
assert.equal(kindFromName('internal audit charter.docx')?.id, 'internal_audit')
assert.equal(kindFromName('RiskRegister Q3.xlsx')?.id, 'risk_register')
assert.equal(kindFromName('scan0001.pdf'), null)

const charter = ['Board Charter of Acme Plc', 'Approved 2025', 'This charter sets out the responsibilities of the Board of Directors.',
  'Quorum: a majority of directors. The Chairperson presides over meetings.', 'Committees of the board report to the board.']
const register = ['Risk Register FY2025', 'Risk ID | Description | Likelihood | Impact | Inherent risk | Mitigation | Residual risk | Risk owner',
  'R1 | Fraud in procurement | High | High | 16 | Segregation of duties | 8 | CFO', 'R2 | Cyber attack | Medium | High | 12 | Backups | 6 | CIO']

// PDF: a real board charter matches its name.
const ok = checkContent({ fileName: 'Board Charter 2025.pdf', text: await extractText(await pdf(charter), PDF) })
assert.equal(ok.status, 'match', JSON.stringify(ok))
assert.ok(ok.matched.includes('board charter'))

// PDF named "board charter" but actually a risk register → flagged with what it looks like.
const wrong = checkContent({ fileName: 'Board Charter 2025.pdf', text: await extractText(await pdf(register), PDF) })
assert.equal(wrong.status, 'possible_mismatch')
assert.equal(wrong.detectedKind, 'risk_register')
assert.ok(wrong.warnings.some((w) => /look like "Risk register"/.test(w)))

// The declared type overrides the file name.
assert.equal(checkContent({ fileName: 'doc1.pdf', declaredKind: 'risk_register', text: await extractText(await pdf(register), PDF) }).status, 'match')

// Year in the file name missing from the text → warning, not a match.
const yr = checkContent({ fileName: 'Board Charter 2019.pdf', text: await extractText(await pdf(charter), PDF) })
assert.equal(yr.status, 'possible_mismatch')
assert.ok(yr.warnings.some((w) => /2019/.test(w)))

// Unknown name: no verdict, but a suggestion of what it looks like.
const unk = checkContent({ fileName: 'scan0001.pdf', text: await extractText(await pdf(register), PDF) })
assert.equal(unk.status, 'not_checked')
assert.equal(unk.detectedKind, 'risk_register')

// Unreadable: images and empty PDFs (e.g. scans without a text layer).
assert.equal(checkContent({ fileName: 'Board Charter.png', text: await extractText(new ArrayBuffer(8), 'image/png') }).status, 'unreadable')
assert.equal(checkContent({ fileName: 'Board Charter.pdf', text: await extractText(await pdf([]), PDF) }).status, 'unreadable')
assert.equal(await extractText(new TextEncoder().encode('not a pdf').buffer as ArrayBuffer, PDF), null, 'corrupt files do not throw')

// DOCX and XLSX text extraction.
const docx = zip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': `<w:document><w:body>${charter.map((l) => `<w:p><w:r><w:t>${l}</w:t></w:r></w:p>`).join('')}</w:body></w:document>` })
assert.equal(checkContent({ fileName: 'board_charter.docx', text: await extractText(docx, DOCX) }).status, 'match')
const xlsx = zip({ 'xl/sharedStrings.xml': `<sst>${register.map((l) => `<si><t>${l.replace(/&/g, '&amp;')}</t></si>`).join('')}</sst>`, 'xl/worksheets/sheet1.xml': '<worksheet/>' })
assert.equal(checkContent({ fileName: 'Risk register FY2025.xlsx', text: await extractText(xlsx, XLSX) }).status, 'match')
assert.equal(readZipEntries(Buffer.from('junk'), () => true).size, 0, 'non-zip input yields nothing')

console.log('evidence-content.test.ts: all assertions passed')
