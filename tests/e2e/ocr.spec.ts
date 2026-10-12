import { test, expect } from './fixtures'

test('a scanned image is read by OCR in the browser and checked against its name', async ({ signedIn: page }) => {
  // Pages carry the production CSP (src/server.ts); OCR and the rest of the page must run under it.
  const csp: string[] = []
  page.on('console', m => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()) })

  // A "scan": an image of a board charter, with no text layer.
  const scanPage = await page.context().newPage()
  await scanPage.setContent(`<div style="font:30px Arial;padding:40px;background:#fff;width:900px;line-height:1.6">
    <b>BOARD CHARTER 2025</b><br>This charter sets out the responsibilities of the Board of Directors.<br>
    Quorum: a majority of directors. The Chairperson presides over meetings.</div>`)
  const png = await scanPage.locator('div').screenshot()
  await scanPage.close()

  const doc = await page.goto('/app/workspaces')
  expect(doc!.headers()['content-security-policy']).toContain("'wasm-unsafe-eval'")
  expect(doc!.headers()['x-frame-options']).toBe('DENY')
  await page.getByLabel('Organization name').fill('OCR E2E Org')
  await page.getByLabel('Country').fill('Nigeria')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await page.getByLabel('New workspace').fill('OCR audit')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('link', { name: 'OCR audit' }).click()
  await page.getByRole('main').getByRole('link', { name: 'Evidence registry' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'Board Charter 2025.png', mimeType: 'image/png', buffer: png })

  await expect(page.getByText('content matches (OCR)')).toBeVisible({ timeout: 60_000 })
  expect(csp).toEqual([])
})
