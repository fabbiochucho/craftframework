// Copies the Tesseract worker, LSTM cores and English data into public/ocr so browser OCR
// is served from our own origin (the CSP blocks CDNs; documents never leave the browser).
import { copyFileSync, mkdirSync } from 'node:fs'

const out = 'public/ocr'
mkdirSync(out, { recursive: true })
copyFileSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`)
for (const v of ['lstm', 'simd-lstm', 'relaxedsimd-lstm']) copyFileSync(`node_modules/tesseract.js-core/tesseract-core-${v}.wasm.js`, `${out}/tesseract-core-${v}.wasm.js`)
copyFileSync('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', `${out}/eng.traineddata.gz`)
