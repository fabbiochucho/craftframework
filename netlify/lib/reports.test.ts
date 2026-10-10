import assert from 'node:assert/strict'
import { escapeHtml, renderReportPdf } from './reports.ts'

assert.equal(escapeHtml(`<tag attr="x">&'`), '&lt;tag attr=&quot;x&quot;&gt;&amp;&#39;')
const bytes = await renderReportPdf({
  reportType: 'cap_summary', organizationName: 'Example organization',
  dataAsOfDate: '2026-10-10', generatedAt: new Date('2026-10-10T00:00:00Z'),
  snapshot: { result: 'ok' },
})
assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-')
console.log('reports.test.ts: all assertions passed')
