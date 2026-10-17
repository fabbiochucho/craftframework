// Renders public/email/signature-abiola-pauline.png: 'Abiola & Pauline' in Great Vibes (SIL Open Font
// License 1.1, Google Fonts), CRAFT dark green, transparent background, 2x for sharp email display.
// Run once (needs network for the font): node scripts/render-email-signature.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const out = new URL('../public/email/signature-abiola-pauline.png', import.meta.url)
mkdirSync(new URL('../public/email/', import.meta.url), { recursive: true })

const browser = await chromium.launch(process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {})
const page = await browser.newPage({ viewport: { width: 440, height: 110 }, deviceScaleFactor: 2 })
await page.setContent(`<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=block" rel="stylesheet">
<style>html,body{margin:0;background:transparent}#s{display:inline-block;padding:4px 12px 10px 4px;font-family:'Great Vibes',cursive;font-size:56px;line-height:1.15;color:#064e3b;white-space:nowrap}</style>
</head><body><span id="s">Abiola &amp; Pauline</span></body></html>`)
await page.evaluate(() => document.fonts.ready)
const ok = await page.evaluate(() => document.fonts.check("56px 'Great Vibes'"))
if (!ok) throw new Error('Great Vibes did not load; check network access to fonts.googleapis.com')
await page.locator('#s').screenshot({ path: out.pathname.replace(/^\/([A-Za-z]:)/, '$1'), omitBackground: true })
await browser.close()
console.log('wrote', out.pathname)
