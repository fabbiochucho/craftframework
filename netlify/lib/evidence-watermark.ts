// View-only evidence for independent assessors: the file is returned as a PDF with the viewer's name and
// the time stamped on every page, so it is shown inside CRAFT rather than downloaded as the original.
// PDFs are stamped; PNG and JPEG are placed on a page; Word and Excel are converted to their text and
// tables (layout, images and charts are not reproduced); anything else cannot be viewed.
// ponytail: deters casual copying and makes a leaked copy traceable; it cannot stop screenshots.
// ponytail: Word/Excel → text-and-tables PDF, not a faithful render; a LibreOffice service would be needed for layout.
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib'
import { readZipEntries } from './evidence-content.js'

export type Viewable = { ok: true; pdf: Uint8Array } | { ok: false; reason: string }

const head = (b: Uint8Array, n: number) => String.fromCharCode(...b.subarray(0, n))
const isPdf = (b: Uint8Array) => b.length > 4 && head(b, 5) === '%PDF-'
const isPng = (b: Uint8Array) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
const isZip = (b: Uint8Array) => b.length > 30 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4
// Encrypted Word/Excel files (and old .doc/.xls) are OLE compound files rather than ZIPs.
const isCfb = (b: Uint8Array) => b.length > 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0

/**
 * True when the file needs a password (or is locked) so CRAFT cannot read it: an encrypted PDF, a
 * password-protected Word/Excel file, or a ZIP with encrypted entries.
 */
export function isPasswordProtected(input: ArrayBuffer | Uint8Array): boolean {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (isPdf(b)) return /\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(Buffer.from(b).toString('latin1'))
  if (isCfb(b)) return Buffer.from(b).includes(Buffer.from('EncryptionInfo', 'utf16le')) || Buffer.from(b).includes(Buffer.from('EncryptedPackage', 'utf16le'))
  if (isZip(b)) return (b[6] & 1) === 1 // general-purpose flag bit 0 on the first entry: encrypted
  return false
}

const LOCKED = 'This file is password-protected, so it cannot be shown. Ask the organisation to upload a copy without a password.'

export async function watermarkedPdf(input: ArrayBuffer | Uint8Array, viewer: string, at = new Date()): Promise<Viewable> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (isPasswordProtected(bytes)) return { ok: false, reason: LOCKED }
  let doc: PDFDocument
  try {
    if (isPdf(bytes)) {
      doc = await PDFDocument.load(bytes, { updateMetadata: false })
    } else if (isPng(bytes) || isJpeg(bytes)) {
      doc = await PDFDocument.create()
      const img = isPng(bytes) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
      const page = doc.addPage([img.width, img.height])
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
    } else if (isZip(bytes)) {
      const office = officeText(Buffer.from(bytes))
      if (!office) return { ok: false, reason: 'This type of file cannot be viewed on CRAFT. Ask the organisation to submit it as a PDF.' }
      doc = await textPdf(office.kind, office.text)
    } else if (isCfb(bytes)) {
      return { ok: false, reason: 'This is an old Word or Excel format (.doc or .xls) that cannot be viewed on CRAFT. Ask the organisation to save it as .docx, .xlsx or PDF.' }
    } else {
      return { ok: false, reason: 'This type of file cannot be viewed on CRAFT. Ask the organisation to submit it as a PDF.' }
    }
    return { ok: true, pdf: await stamp(doc, viewer, at) }
  } catch {
    return { ok: false, reason: 'This file could not be opened for viewing (it may be damaged). Ask the organisation for a plain PDF.' }
  }
}

// --- Word / Excel → text -------------------------------------------------------------------------
const MAX_CHARS = 300_000
const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&')
const strip = (xml: string) => decode(xml.replace(/<[^>]+>/g, ''))
const tidy = (text: string) => text.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter((l, i, a) => l || (i > 0 && a[i - 1])).join('\n').trim()

/** The text and tables of a .docx or .xlsx, or null when the ZIP is neither. */
export function officeText(buf: Buffer): { kind: 'Word' | 'Excel'; text: string } | null {
  const files = readZipEntries(buf, (n) => n === 'word/document.xml' || n === 'xl/workbook.xml' || n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
  const word = files.get('word/document.xml')
  if (word) return { kind: 'Word', text: docxText(word).slice(0, MAX_CHARS) }
  const book = files.get('xl/workbook.xml')
  if (book) return { kind: 'Excel', text: xlsxText(book, files).slice(0, MAX_CHARS) }
  return null
}

export function docxText(xml: string): string {
  const body = xml
    .replace(/<w:tab\/>/g, ' ').replace(/<w:br[^>]*\/>/g, '\n')
    // Table cells: keep a cell on one line, separate cells with " | ", one row per line.
    .replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => `${strip(cell.replace(/<\/w:p>/g, ' '))} | `)
    .replace(/ \| <\/w:tr>/g, '\n').replace(/<\/w:p>/g, '\n')
  return tidy(strip(body))
}

export function xlsxText(workbook: string, files: Map<string, string>): string {
  const shared = [...(files.get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decode(t[1])).join(''))
  const names = [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => decode(m[1]))
  const sheets = [...files.keys()].filter((n) => n.startsWith('xl/worksheets/')).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
  const out: string[] = []
  sheets.forEach((path, i) => {
    out.push(`Sheet: ${names[i] ?? `Sheet ${i + 1}`}`)
    for (const row of files.get(path)!.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [...row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, attrs, inner = '']) => {
        const t = attrs.match(/\bt="(\w+)"/)?.[1]
        if (t === 'inlineStr') return strip(inner)
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        if (v === undefined) return ''
        return t === 's' ? (shared[Number(v)] ?? '') : decode(v)
      })
      while (cells.length && !cells[cells.length - 1]) cells.pop()
      if (cells.length) out.push(cells.join(' | '))
    }
    out.push('')
  })
  return tidy(out.join('\n'))
}

// --- PDF ----------------------------------------------------------------------------------------
const PAGE: [number, number] = [595, 842] // A4 portrait
const MAX_PAGES = 300
const MAX_WIDE = 4000 // widest landscape page for spreadsheets, in points

async function textPdf(kind: 'Word' | 'Excel', text: string): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const charset = new Set(font.getCharacterSet())
  const safe = (s: string) => [...s].map((ch) => (charset.has(ch.codePointAt(0)!) ? ch : '?')).join('')
  const m = 40, size = 9.5, lead = 13
  const body = safe(text || '(This file has no text.)')
  // Spreadsheets: landscape pages as wide as the widest row (rows are not wrapped; the viewer scrolls sideways).
  const wide = kind === 'Excel'
  const longest = wide ? Math.max(0, ...body.split('\n').map((l) => font.widthOfTextAtSize(l, size))) : 0
  const pageSize: [number, number] = wide ? [Math.min(MAX_WIDE, Math.max(842, longest + 2 * m)), 595] : PAGE
  const [w, h] = pageSize
  let page = doc.addPage(pageSize)
  let y = h - m
  const newPage = () => { page = doc.addPage(pageSize); y = h - m }
  const line = (s: string, f: PDFFont = font, sz = size) => {
    if (y < m + 20) { if (doc.getPageCount() >= MAX_PAGES) return; newPage() }
    page.drawText(s, { x: m, y, size: sz, font: f, color: rgb(0.1, 0.1, 0.1) })
    y -= lead
  }
  line(`Converted from ${kind} for viewing: text and tables only. Formatting, images and charts are not shown.`, bold, 8.5)
  y -= 6
  for (const para of body.split('\n')) {
    if (!para) { y -= lead / 2; continue }
    if (wide) { // one row per line; cut only rows wider than the widest page
      let row = para
      while (row.length > 1 && font.widthOfTextAtSize(row, size) > w - 2 * m) row = `${row.slice(0, -2)}…`
      line(row)
      continue
    }
    let cur = ''
    for (const word of para.split(' ')) {
      let piece = word
      while (font.widthOfTextAtSize(piece, size) > w - 2 * m) { // hard-break very long words
        let k = piece.length
        while (k > 1 && font.widthOfTextAtSize(piece.slice(0, k), size) > w - 2 * m) k--
        if (cur) { line(cur); cur = '' }
        line(piece.slice(0, k)); piece = piece.slice(k)
      }
      const next = cur ? `${cur} ${piece}` : piece
      if (font.widthOfTextAtSize(next, size) > w - 2 * m) { line(cur); cur = piece } else cur = next
    }
    if (cur) line(cur)
  }
  if (doc.getPageCount() >= MAX_PAGES) line(`Shortened: only the first ${MAX_PAGES} pages are shown.`, bold)
  return doc
}

async function stamp(doc: PDFDocument, viewer: string, at: Date): Promise<Uint8Array> {
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const charset = new Set(font.getCharacterSet())
  const raw = `Viewed by ${viewer} · ${at.toISOString().slice(0, 16).replace('T', ' ')} UTC · Confidential · CRAFT independent assessment`
  const text = [...raw].map((ch) => (charset.has(ch.codePointAt(0)!) ? ch : '?')).join('')
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const size = Math.max(8, Math.min(width, height) / 45)
    // A footer line, and the same text diagonally across the page, faint enough to read through.
    page.drawText(text, { x: 12, y: 10, size: size * 0.8, font, color: rgb(0.6, 0.1, 0.1), opacity: 0.8 })
    page.drawText(text, { x: width * 0.08, y: height * 0.2, size, font, color: rgb(0.6, 0.1, 0.1), opacity: 0.18, rotate: degrees(Math.atan2(height, width) * 180 / Math.PI) })
  }
  doc.setTitle('CRAFT evidence (view only)')
  return doc.save()
}
