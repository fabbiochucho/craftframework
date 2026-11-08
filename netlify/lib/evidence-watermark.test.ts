import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { zip } from './export-formats.ts'
import { docxText, isPasswordProtected, officeText, watermarkedPdf } from './evidence-watermark.ts'

const pages = async (v: Awaited<ReturnType<typeof watermarkedPdf>>) => (v.ok ? await PDFDocument.load(v.pdf) : null)

// PDFs keep every page.
const src = await PDFDocument.create()
src.addPage([400, 600]); src.addPage([600, 400])
const out = await watermarkedPdf(await src.save(), 'assessor@example.com', new Date('2026-11-08T21:30:00Z'))
assert.equal((await pages(out))?.getPageCount(), 2, 'every page kept')

// A 1x1 PNG becomes a one-page PDF.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
assert.equal((await pages(await watermarkedPdf(png, 'a@b.c')))?.getPageCount(), 1)

// Word: paragraphs and table rows (cells joined with " | ").
const docXml = '<w:document><w:body><w:p><w:r><w:t>Board minutes</w:t></w:r></w:p>'
  + '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Item</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Decision &amp; owner</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
  + '<w:p><w:r><w:t>Signed ₦ chair</w:t></w:r></w:p></w:body></w:document>'
assert.equal(docxText(docXml), 'Board minutes\nItem | Decision & owner\nSigned ₦ chair')
// Entities decode once ("&amp;lt;" stays the text "&lt;"); hex and decimal character references.
assert.equal(docxText('<w:p><w:t>a &amp;lt;b&amp;gt; &#x20AC;5 &#8358;</w:t></w:p>'), 'a &lt;b&gt; €5 ₦')
const docx = zip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': docXml })
assert.equal(officeText(docx)?.kind, 'Word')
const wordPdf = await pages(await watermarkedPdf(docx, 'a@b.c'))
assert.ok(wordPdf && wordPdf.getPage(0).getWidth() < wordPdf.getPage(0).getHeight(), 'Word: portrait A4 (and unsupported characters do not break it)')

// Excel: shared and inline strings, numbers, sheet names; a wide sheet gives a wide landscape page.
const longRow = Array.from({ length: 40 }, (_, i) => `<c t="inlineStr"><is><t>Column ${i + 1} value</t></is></c>`).join('')
const xlsx = zip({
  'xl/workbook.xml': '<workbook><sheets><sheet name="Budget" r:id="r1"/></sheets></workbook>',
  'xl/sharedStrings.xml': '<sst><si><t>Line</t></si><si><t>Amount</t></si></sst>',
  'xl/worksheets/sheet1.xml': `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Salaries</t></is></c><c r="B2"><v>1200</v></c></row><row r="3">${longRow}</row></sheetData></worksheet>`,
})
const sheet = officeText(xlsx)
assert.equal(sheet?.kind, 'Excel')
assert.ok(sheet!.text.startsWith('Sheet: Budget\nLine | Amount\nSalaries | 1200'), sheet!.text.slice(0, 80))
const excelPdf = await pages(await watermarkedPdf(xlsx, 'a@b.c'))
assert.ok(excelPdf && excelPdf.getPage(0).getWidth() > 842, 'Excel: wider than A4 landscape for a wide sheet')

// Password-protected files are detected, and not shown.
const locked = await PDFDocument.create(); locked.addPage()
// An encrypted PDF names its /Encrypt dictionary in the trailer (or the cross-reference stream dictionary).
assert.ok(isPasswordProtected(Buffer.concat([Buffer.from(await locked.save()), Buffer.from('\ntrailer\n<< /Size 9 /Encrypt 9 0 R >>\n')])))
assert.ok(!isPasswordProtected(await src.save()))
const cfb = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(64), Buffer.from('EncryptionInfo', 'utf16le')])
assert.ok(isPasswordProtected(cfb), 'encrypted Word/Excel')
const encZip = Buffer.from(docx); encZip[6] |= 1
assert.ok(isPasswordProtected(encZip), 'ZIP with encrypted entries')
assert.ok(!isPasswordProtected(docx) && !isPasswordProtected(png))
const lockedView = await watermarkedPdf(cfb, 'a@b.c')
assert.ok(!lockedView.ok && /password-protected/.test(lockedView.reason))

// Old .doc/.xls, unknown types and damaged PDFs are refused with a reason.
const oldDoc = await watermarkedPdf(Buffer.concat([cfb.subarray(0, 8), Buffer.alloc(64)]), 'a@b.c')
assert.ok(!oldDoc.ok && /\.docx/.test(oldDoc.reason))
const other = await watermarkedPdf(Buffer.from('plain text'), 'a@b.c')
assert.ok(!other.ok && /PDF/.test(other.reason))
assert.ok(!(await watermarkedPdf(Buffer.from('%PDF-1.4 not really'), 'a@b.c')).ok)
console.log('evidence-watermark: ok')
