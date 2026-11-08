import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { watermarkedPdf } from './evidence-watermark.ts'

const src = await PDFDocument.create()
src.addPage([400, 600]); src.addPage([600, 400])
const out = await watermarkedPdf(await src.save(), 'assessor@example.com', new Date('2026-11-08T21:30:00Z'))
assert.ok(out.ok)
const stamped = await PDFDocument.load(out.ok ? out.pdf : new Uint8Array())
assert.equal(stamped.getPageCount(), 2, 'every page kept')
assert.ok(out.ok && out.pdf.length > 0)

// A 1x1 PNG becomes a one-page PDF.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const img = await watermarkedPdf(png, 'a@b.c')
assert.ok(img.ok)
assert.equal((await PDFDocument.load(img.ok ? img.pdf : new Uint8Array())).getPageCount(), 1)

// Word files and damaged PDFs are refused with a reason.
const docx = await watermarkedPdf(Buffer.from('PK\u0003\u0004 word'), 'a@b.c')
assert.ok(!docx.ok && /PDF/.test(docx.reason))
const broken = await watermarkedPdf(Buffer.from('%PDF-1.4 not really'), 'a@b.c')
assert.ok(!broken.ok)
console.log('evidence-watermark: ok')
