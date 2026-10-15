import { test, expect } from '@playwright/test'

const PAGES: [string, string][] = [
  ['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/acceptable-use', 'Acceptable Use Policy'],
  ['/data-processing', 'Data Processing Terms'], ['/subprocessors', 'Sub-processors'], ['/security', 'Security'],
  ['/accessibility', 'Accessibility Statement'], ['/code-of-conduct', 'Code of Conduct'],
]

test('every policy page is served with security headers and is linked from the footer', async ({ page, request }) => {
  for (const [path, heading] of PAGES) {
    const res = await page.goto(path)
    expect(res!.status(), path).toBe(200)
    expect(res!.headers()['permissions-policy'], path).toContain('camera=()')
    expect(res!.headers()['cross-origin-opener-policy'], path).toBe('same-origin')
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  await page.goto('/')
  const footer = page.getByRole('contentinfo')
  for (const label of ['Privacy Policy', 'Terms of Service', 'Acceptable Use', 'Data Processing', 'Sub-processors', 'Security', 'Accessibility']) {
    await expect(footer.getByRole('link', { name: label, exact: true })).toBeVisible()
  }
  const sec = await request.get('/.well-known/security.txt')
  expect(sec.status()).toBe(200)
  const body = await sec.text()
  expect(body).toMatch(/^Contact: mailto:/m)
  expect(new Date(/^Expires: (.+)$/m.exec(body)![1]).getTime()).toBeGreaterThan(Date.now())
})

test('policy pages do not scroll sideways on a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  for (const [path] of PAGES) {
    await page.goto(path)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})
