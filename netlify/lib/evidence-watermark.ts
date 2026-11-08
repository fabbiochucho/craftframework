// View-only evidence for independent assessors: the file is returned as a PDF with the viewer's name and
// the time stamped on every page, so it is shown inside CRAFT rather than downloaded as the original.
// PDFs are stamped; PNG and JPEG are placed on a page and stamped; anything else cannot be viewed.
// ponytail: deters casual copying and makes a leaked copy traceable; it cannot stop screenshots.
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export type Viewable = { ok: true; pdf: Uint8Array } | { ok: false; reason: string }

const isPdf = (b: Uint8Array) => b.length > 4 && String.fromCharCode(...b.subarray(0, 5)) === '%PDF-'
const isPng = (b: Uint8Array) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff

export async function watermarkedPdf(input: ArrayBuffer | Uint8Array, viewer: string, at = new Date()): Promise<Viewable> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  let doc: PDFDocument
  try {
    if (isPdf(bytes)) {
      doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false })
    } else if (isPng(bytes) || isJpeg(bytes)) {
      doc = await PDFDocument.create()
      const img = isPng(bytes) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
      const page = doc.addPage([img.width, img.height])
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
    } else {
      return { ok: false, reason: 'This type of file cannot be viewed on CRAFT. Ask the organisation to submit it as a PDF.' }
    }
    return { ok: true, pdf: await stamp(doc, viewer, at) }
  } catch {
    return { ok: false, reason: 'This file could not be opened for viewing (it may be damaged or password-protected). Ask the organisation for a plain PDF.' }
  }
}

async function stamp(doc: PDFDocument, viewer: string, at: Date): Promise<Uint8Array> {
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const text = `Viewed by ${viewer} · ${at.toISOString().slice(0, 16).replace('T', ' ')} UTC · Confidential · CRAFT independent assessment`
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
