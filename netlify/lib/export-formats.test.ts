// Self-check — run directly with `node netlify/lib/export-formats.test.ts`.
import assert from 'node:assert/strict'
import { getDocumentProxy, extractText } from 'unpdf'
import { renderPdf, renderXlsx, type ExportDoc } from './export-formats.ts'
import { readZipEntries } from './evidence-content.ts'

const rows = Array.from({ length: 120 }, (_, i) => [`R${i + 1}`, `A long description that needs wrapping across several lines in the PDF table cell ${i} ≥ 3 → ok`, i, i % 2 ? '=HYPERLINK("x")' : null])
const doc: ExportDoc = {
  title: 'CRAFT test export — Ministry ’s plan',
  meta: [['Organisation', 'Acme & Sons <Ltd>'], ['Generated', '2026-10-15']],
  blocks: [{ kind: 'h2', text: 'Summary' }, { kind: 'p', text: 'Overall 72%.' }, { kind: 'table', table: { title: 'Items', columns: [{ header: 'ID', width: 0.6 }, { header: 'Description', width: 4 }, { header: 'Score', width: 0.6 }, { header: 'Formula?', width: 1 }], rows } }],
  footer: 'Not an assurance opinion.',
}

// XLSX: valid zip, summary + table sheet, escaped XML, numbers as numbers, formula injection neutralised.
const x = renderXlsx(doc)
const entries = readZipEntries(x, () => true)
assert.ok(entries.has('[Content_Types].xml') && entries.has('xl/workbook.xml') && entries.has('xl/worksheets/sheet2.xml'))
assert.match(entries.get('xl/workbook.xml')!, /name="Summary".*name="Items"/)
assert.match(entries.get('xl/worksheets/sheet1.xml')!, /Acme &amp; Sons &lt;Ltd&gt;/)
const s2 = entries.get('xl/worksheets/sheet2.xml')!
assert.match(s2, /<c r="C2"><v>0<\/v><\/c>/, 'numbers stay numeric')
assert.match(s2, /'=HYPERLINK/, 'formula-like text is prefixed')
assert.ok(!s2.includes('<f>'))

// PDF: multiple pages, wrapped text, unsupported glyphs replaced, page numbers.
const pdf = await renderPdf(doc)
const proxy = await getDocumentProxy(pdf, { verbosity: 0 })
assert.ok(proxy.numPages >= 3, `${proxy.numPages} pages`)
const { text } = await extractText(proxy, { mergePages: true })
assert.match(text, /CRAFT test export/)
assert.match(text, /R120/)
assert.match(text, />= 3 -> ok/)
assert.match(text, /page 1 of \d+/)
console.log('export-formats.test.ts: all assertions passed')
