// Browser-only OCR for scanned evidence. Tesseract runs on the uploader's machine from files
// served at /ocr (scripts/copy-ocr-assets.mjs), so documents are never sent to a third party.
import { api, wsPath } from './workspaceApi'

const MAX_PDF_PAGES = 5 // ponytail: enough to identify a document; raise if long scans are misjudged

export const canOcr = (mime: string) => mime === 'application/pdf' || /^image\/(png|jpe?g|bmp|webp|gif)$/.test(mime)

async function pdfPages(file: Blob): Promise<HTMLCanvasElement[]> {
  const { getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()), { disableFontFace: true })
  const pages: HTMLCanvasElement[] = []
  for (let n = 1; n <= Math.min(pdf.numPages, MAX_PDF_PAGES); n++) {
    const page = await pdf.getPage(n)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width; canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport } as Parameters<typeof page.render>[0]).promise
    pages.push(canvas)
  }
  return pages
}

export async function ocrText(file: Blob): Promise<string> {
  // Render PDF pages first so a corrupt file fails before the ~4 MB OCR engine loads.
  const images = file.type === 'application/pdf' ? await pdfPages(file) : [file]
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, { workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr', workerBlobURL: false })
  try {
    const out: string[] = []
    for (const img of images) out.push((await worker.recognize(img)).data.text)
    return out.join('\n')
  } finally {
    await worker.terminate()
  }
}

// Read a stored scan in the browser and send only the text back for the server's content check.
export async function ocrCheck(workspaceId: string, evidenceId: number | string, file: Blob) {
  return api(wsPath(workspaceId, `/evidence/${evidenceId}/content-check`), { method: 'POST', body: { ocrText: (await ocrText(file)).slice(0, 400_000) } })
}
