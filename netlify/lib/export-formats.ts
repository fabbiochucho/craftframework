// XLSX and PDF renderers shared by the scorecard, planner and ESG report QA exports.
// Both take the same document model: a title, metadata, and blocks of headings, paragraphs and
// tables. XLSX puts each table on its own sheet (plus a summary sheet); PDF lays everything out on
// landscape A4 pages with wrapped table cells and repeated table headers.
// Self-check: `node netlify/lib/export-formats.test.ts`.
import { deflateRawSync } from 'node:zlib'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export type Cell = string | number | null | undefined
export interface ExportTable { title: string; sheet?: string; columns: { header: string; width?: number }[]; rows: Cell[][] }
export type ExportBlock = { kind: 'h2' | 'p'; text: string } | { kind: 'table'; table: ExportTable }
export interface ExportDoc { title: string; meta: [string, string][]; blocks: ExportBlock[]; footer?: string }

// --- XLSX ----------------------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
export function zip(files: Record<string, string | Buffer>): Buffer {
  const parts: Buffer[] = [], central: Buffer[] = []
  let offset = 0, count = 0
  for (const [name, content] of Object.entries(files)) {
    const raw = typeof content === 'string' ? Buffer.from(content, 'utf8') : content
    const data = deflateRawSync(raw), nb = Buffer.from(name, 'utf8'), crc = crc32(raw)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nb.length, 26)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8); cd.writeUInt16LE(8, 10)
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(raw.length, 24); cd.writeUInt16LE(nb.length, 28); cd.writeUInt32LE(offset, 42)
    parts.push(local, nb, data); central.push(cd, nb)
    offset += 30 + nb.length + data.length; count++
  }
  const cdBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, cdBuf, end])
}

// Strip characters XML 1.0 forbids, then escape.
const xml = (v: unknown) => String(v ?? '').replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]/g, '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!)
const colName = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s }
// Spreadsheet formula injection: text starting with = + - @ is stored with a leading apostrophe.
const safeText = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s)
const cellXml = (v: Cell, ref: string, header: boolean) => {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${header ? ' s="1"' : ''}><v>${v}</v></c>`
  return `<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(safeText(String(v)))}</t></is></c>`
}
function sheetXml(rows: Cell[][], widths: number[], headerRows: number): string {
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : ''
  const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => cellXml(v, `${colName(ci)}${ri + 1}`, ri < headerRows)).join('')}</row>`).join('')
  const freeze = headerRows ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRows}" topLeftCell="A${headerRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${cols}<sheetData>${body}</sheetData></worksheet>`
}
const sheetName = (s: string, used: Set<string>) => {
  let n = s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Sheet'
  for (let i = 2; used.has(n.toLowerCase()); i++) n = `${n.slice(0, 28)} ${i}`
  used.add(n.toLowerCase()); return n
}

export function renderXlsx(d: ExportDoc): Buffer {
  const used = new Set<string>()
  const summary: Cell[][] = [[d.title], [], ...d.meta.map(([k, v]) => [k, v] as Cell[]), [],
    ...d.blocks.filter((b) => b.kind !== 'table').map((b) => [(b as { text: string }).text] as Cell[]), ...(d.footer ? [[], [d.footer]] : [])]
  const sheets = [{ name: sheetName('Summary', used), xml: sheetXml(summary, [40, 90], 1) }]
  for (const b of d.blocks) {
    if (b.kind !== 'table') continue
    const t = b.table
    sheets.push({ name: sheetName(t.sheet ?? t.title, used), xml: sheetXml([t.columns.map((c) => c.header), ...t.rows], t.columns.map((c) => Math.max(10, Math.min(80, (c.width ?? 0.15) * 160))), 1) })
  }
  const files: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
  }
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = s.xml })
  return zip(files)
}

// --- PDF ------------------------------------------------------------------------------------------
const W = 842, H = 595, M = 36
const REPLACE: Record<string, string> = { '≥': '>=', '≤': '<=', '→': '->', '←': '<-', '✓': 'v', '✗': 'x', ' ': ' ', ' ': ' ', '‑': '-' }

export async function renderPdf(d: ExportDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(d.title)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const charset = new Set(font.getCharacterSet())
  const safe = (s: unknown) => [...String(s ?? '').replace(/[\r\t]/g, ' ')].map((ch) => REPLACE[ch] ?? (charset.has(ch.codePointAt(0)!) || ch === '\n' ? ch : '?')).join('')
  const lines = (text: string, f: PDFFont, size: number, width: number) => {
    const out: string[] = []
    for (const para of safe(text).split('\n')) {
      let cur = ''
      for (const word of para.split(/ +/)) {
        let w = word
        while (f.widthOfTextAtSize(w, size) > width) { // hard-break very long words
          let k = w.length; while (k > 1 && f.widthOfTextAtSize(w.slice(0, k), size) > width) k--
          if (cur) { out.push(cur); cur = '' }
          out.push(w.slice(0, k)); w = w.slice(k)
        }
        const next = cur ? `${cur} ${w}` : w
        if (f.widthOfTextAtSize(next, size) > width && cur) { out.push(cur); cur = w } else cur = next
      }
      out.push(cur)
    }
    return out
  }
  let page: PDFPage = pdf.addPage([W, H])
  let y = H - M
  const newPage = () => { page = pdf.addPage([W, H]); y = H - M }
  const ensure = (h: number) => { if (y - h < M + 14) newPage() }
  const text = (s: string, f: PDFFont, size: number, color = rgb(0.1, 0.1, 0.1)) => {
    for (const l of lines(s, f, size, W - 2 * M)) { ensure(size + 4); page.drawText(l, { x: M, y: y - size, size, font: f, color }); y -= size + 4 }
  }
  text(d.title, bold, 16, rgb(0.02, 0.31, 0.23)); y -= 4
  for (const [k, v] of d.meta) text(`${k}: ${v}`, font, 9)
  y -= 6
  for (const b of d.blocks) {
    if (b.kind !== 'table') {
      if (b.kind === 'h2') { y -= 6; ensure(30); text(b.text, bold, 12, rgb(0.02, 0.37, 0.27)) } else text(b.text, font, 9)
      y -= 2; continue
    }
    const t = b.table, size = 7.5, pad = 3
    const total = t.columns.reduce((a, c) => a + (c.width ?? 1), 0)
    const widths = t.columns.map((c) => ((c.width ?? 1) / total) * (W - 2 * M))
    const drawRow = (cells: Cell[], f: PDFFont, shade: boolean) => {
      const wrapped = cells.map((v, i) => lines(v === null || v === undefined ? '' : String(v), f, size, widths[i] - 2 * pad))
      const h = Math.max(...wrapped.map((w) => w.length)) * (size + 2) + 2 * pad
      if (y - h < M + 14) { newPage(); drawHeader() }
      let x = M
      wrapped.forEach((ls, i) => {
        if (shade) page.drawRectangle({ x, y: y - h, width: widths[i], height: h, color: rgb(0.91, 0.96, 0.93) })
        page.drawRectangle({ x, y: y - h, width: widths[i], height: h, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.5 })
        ls.forEach((l, j) => page.drawText(l, { x: x + pad, y: y - pad - (j + 1) * (size + 2) + 2, size, font: f }))
        x += widths[i]
      })
      y -= h
    }
    const drawHeader = () => drawRow(t.columns.map((c) => c.header), bold, true)
    y -= 4; ensure(40); text(t.title, bold, 10); drawHeader()
    for (const r of t.rows) drawRow(r, font, false)
    if (!t.rows.length) text('No rows.', font, 8)
    y -= 8
  }
  if (d.footer) { y -= 4; text(d.footer, font, 8, rgb(0.35, 0.35, 0.35)) }
  const pages = pdf.getPages()
  pages.forEach((p, i) => p.drawText(safe(`${d.title} — page ${i + 1} of ${pages.length}`), { x: M, y: 16, size: 7, font, color: rgb(0.45, 0.45, 0.45) }))
  return pdf.save()
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
/** Responds with the document in the requested format, or null for formats this helper does not handle. */
export async function exportResponse(d: ExportDoc, format: string, baseName: string): Promise<Response | null> {
  const name = baseName.replace(/[^\w.-]+/g, '_')
  if (format === 'xlsx') return new Response(new Uint8Array(renderXlsx(d)), { headers: { 'Content-Type': XLSX_TYPE, 'Content-Disposition': `attachment; filename="${name}.xlsx"` } })
  if (format === 'pdf') return new Response(new Uint8Array(await renderPdf(d)), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}.pdf"` } })
  return null
}
