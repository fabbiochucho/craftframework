import { PDFDocument, StandardFonts } from 'pdf-lib'

const DISCLAIMER = 'This output is not certification or assurance.'
const METHODOLOGY = 'Methodology: point-in-time workspace records and approved assessment data available at generation.'

function pdfSafe(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '?')
}

function wrap(line: string, width = 92): string[] {
  const safe = pdfSafe(line)
  const chunks: string[] = []
  for (let i = 0; i < safe.length; i += width) chunks.push(safe.slice(i, i + width))
  return chunks.length ? chunks : ['']
}

export async function renderReportPdf(input: {
  reportType: string
  organizationName: string
  dataAsOfDate: string
  generatedAt: Date
  snapshot: unknown
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let page = pdf.addPage([612, 792])
  let y = 744
  const write = (text: string, isBold = false, size = 10) => {
    for (const part of wrap(text)) {
      if (y < 48) {
        page = pdf.addPage([612, 792])
        y = 744
      }
      page.drawText(part, { x: 48, y, size, font: isBold ? bold : font })
      y -= size + 5
    }
  }

  write('CRAFT Governance Report', true, 18)
  y -= 8
  write(`Report: ${input.reportType}`, true)
  write(`Organization: ${input.organizationName}`)
  write(`Reporting period / data as of: ${input.dataAsOfDate}`)
  write(`Generated: ${input.generatedAt.toISOString()}`)
  y -= 8
  write(METHODOLOGY)
  write(DISCLAIMER, true)
  y -= 10
  write('Report data', true, 12)
  const serialized = JSON.stringify(input.snapshot, null, 2) ?? '{}'
  for (const line of serialized.slice(0, 250_000).split('\n')) write(line)
  if (serialized.length > 250_000) write('[Report data truncated for PDF output.]')
  return pdf.save()
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!)
}
