// Renders every lifecycle email variant with sample data to docs/qa/lifecycle-emails/email-<id>.png.
//   E2E_CHROMIUM_PATH=/path/to/chrome node --experimental-transform-types scripts/screenshot-lifecycle-emails.mts
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { LIFECYCLE_VARIANTS, renderSample } from '../src/lib/lifecycleEmail.ts'

const out = 'docs/qa/lifecycle-emails'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 640, height: 800 } })
for (const v of LIFECYCLE_VARIANTS) {
  const mail = renderSample(v.id, 'http://localhost:3000', new Date('2026-10-21T00:00:00Z'))!
  // The signature image is served by the app (public/email); inline it so the screenshot works offline.
  const html = mail.html.replace('http://localhost:3000/email/signature-abiola-pauline.png', `data:image/png;base64,${(await import('node:fs')).readFileSync('public/email/signature-abiola-pauline.png').toString('base64')}`)
  await page.setContent(html)
  await page.screenshot({ path: `${out}/email-${v.id}.png`, fullPage: true })
  writeFileSync(`${out}/email-${v.id}.txt`, `Subject: ${mail.subject}\n\n${mail.text}\n`)
}
await browser.close()
console.log(`wrote ${LIFECYCLE_VARIANTS.length} previews to ${out}`)
