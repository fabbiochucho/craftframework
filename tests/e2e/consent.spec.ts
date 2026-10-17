import { test, expect, signInAs } from './fixtures'
import type { Page } from '@playwright/test'
import { classifyPath } from '../../src/lib/analyticsRoutes'
import { CONSENT_POLICY_VERSION, CONSENT_STORAGE_KEY } from '../../src/lib/consent'

// The consent banner and consented PostHog analytics. All PostHog traffic (eu.i.posthog.com and any other
// posthog.com host) is intercepted: nothing reaches the network and every request is recorded.
test.use({
  consent: 'ask',
  // posthog-js ignores headless/bot browsers; present as an ordinary one (as support-bot.spec.ts does).
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
})
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    Object.defineProperty(navigator, 'userAgentData', { get: () => undefined })
  })
})

type Capture = { url: string; from: string; events: Record<string, any>[] }
async function interceptPosthog(page: Page) {
  const calls: Capture[] = []
  await page.route(/^https:\/\/[^/]*posthog\.com\//, async route => {
    const req = route.request()
    let events: Record<string, any>[] = []
    if (req.method() === 'POST') {
      try {
        const body = req.postDataJSON()
        events = (body?.batch ?? (Array.isArray(body) ? body : [body])).filter((e: any) => e && typeof e.event === 'string')
      } catch { /* not JSON */ }
    }
    // The page the visitor was on when the request was made.
    calls.push({ url: req.url(), from: new URL(req.frame().url()).pathname, events })
    // The project's remote config: what the owner switched on in PostHog (replay, heatmaps, errors, web vitals).
    const remote = /^\/(flags|array\/[^/]+\/config)/.test(new URL(req.url()).pathname)
      ? { sessionRecording: { endpoint: '/s/' }, heatmaps: true, autocaptureExceptions: true, capturePerformance: { web_vitals: true }, supportedCompression: ['gzip', 'gzip-js'], flags: {}, featureFlags: {} }
      : {}
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(remote) })
  })
  const events = () => calls.flatMap(c => c.events)
  const pageviews = () => events().filter(e => e.event === '$pageview').map(e => new URL(e.properties.$current_url).pathname)
  return { calls, events, pageviews }
}
const stored = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), CONSENT_STORAGE_KEY)
const settle = (page: Page, ms = 2500) => page.waitForTimeout(ms)
const banner = (page: Page) => page.getByRole('region', { name: 'Analytics consent' })

test('first visit: the banner asks, and nothing loads or is sent until the visitor answers', async ({ page }) => {
  const ph = await interceptPosthog(page)
  const requests: string[] = []
  page.on('request', r => requests.push(r.url()))
  await page.goto('/')
  await expect(banner(page)).toBeVisible()
  await expect(banner(page).getByRole('button', { name: 'Accept analytics' })).toBeVisible()
  await expect(banner(page).getByRole('button', { name: 'Reject' })).toBeVisible()
  await expect(banner(page).getByRole('button', { name: 'Choose' })).toBeVisible()
  await page.goto('/methodology')
  await page.goto('/auth')
  await settle(page)
  expect(ph.calls).toHaveLength(0)
  expect(requests.filter(u => /posthog/i.test(u))).toEqual([])
  expect(await stored(page)).toBeNull()
})

test('Reject: nothing is ever sent, the choice is remembered with a timestamp and policy version', async ({ page }) => {
  const ph = await interceptPosthog(page)
  await page.goto('/')
  await banner(page).getByRole('button', { name: 'Reject' }).click()
  await expect(banner(page)).toHaveCount(0)
  const record = await stored(page)
  expect(record).toMatchObject({ analytics: false, replay: false, policyVersion: CONSENT_POLICY_VERSION })
  expect(Date.parse(record.timestamp)).toBeGreaterThan(Date.now() - 60_000)
  for (const path of ['/methodology', '/auth', '/privacy', '/']) { await page.goto(path); await page.mouse.click(5, 5) }
  await settle(page)
  expect(ph.calls).toHaveLength(0)
  await expect(banner(page)).toHaveCount(0)
})

test('Accept: public pages are measured, sensitive pages send nothing', async ({ page, context }) => {
  test.setTimeout(180_000)
  const ph = await interceptPosthog(page)
  await page.goto('/methodology')
  await banner(page).getByRole('button', { name: 'Accept analytics' }).click()
  await expect.poll(() => ph.pageviews()).toEqual(['/methodology'])
  expect(await stored(page)).toMatchObject({ analytics: true, replay: true })

  // Signed in: the directory is measured; assessment, evidence, workspace and engagement pages are not.
  await signInAs(context, 'owner@acme.example')
  await page.goto('/directory')
  await expect.poll(() => ph.pageviews()).toContain('/directory')
  const before = ph.events().length
  // In-app navigation into a sensitive page (no reload), then full loads of the others.
  await page.getByRole('link', { name: /Validation Engagements/ }).first().click()
  await expect(page).toHaveURL(/\/engagements/)
  await settle(page, 4000)
  await page.mouse.click(300, 300)
  for (const path of ['/assessment', '/evidence', '/app/workspaces', '/engagements', '/data-room', '/dashboard']) {
    await page.goto(path)
    await page.mouse.click(300, 300)
    await settle(page, 1000)
  }
  // Every event carries the address of a measured page; none was produced on a sensitive one.
  const urls = ph.events().filter(e => e.event !== '$snapshot').map(e => e.properties.$current_url as string | undefined)
  expect(urls.every(u => u && classifyPath(new URL(u).pathname) !== 'sensitive'), JSON.stringify(urls)).toBe(true)
  const sent = JSON.stringify(ph.events())
  for (const p of ['/assessment', '/evidence', '/app/', '/engagements', '/data-room', '/dashboard']) expect(sent).not.toContain(p)
  // (Opening a sensitive address while onboarding is unfinished redirects to /onboarding, which is a measured page.)
  expect(ph.pageviews()).toEqual(expect.arrayContaining(['/methodology', '/directory']))
  expect(ph.pageviews().every(p => classifyPath(p) !== 'sensitive')).toBe(true)
  expect(ph.events().length).toBeGreaterThanOrEqual(before)
  // Signed-in users are identified by a hash only.
  const ids = ph.events().filter(e => e.event === '$identify')
  expect(JSON.stringify(ph.events())).not.toContain('owner@acme.example')
  for (const id of ids) expect(id.properties.distinct_id ?? id.distinct_id).toMatch(/^[0-9a-f]{64}$/)
})

test('Choose: analytics without replay never starts a recording', async ({ page }) => {
  const ph = await interceptPosthog(page)
  await page.goto('/methodology')
  await banner(page).getByRole('button', { name: 'Choose' }).click()
  const replay = banner(page).getByRole('checkbox', { name: /Session replay/ })
  await expect(replay).toBeDisabled()
  await banner(page).getByRole('checkbox', { name: /Product analytics/ }).check()
  await expect(replay).toBeEnabled()
  await banner(page).getByRole('button', { name: 'Save choices' }).click()
  expect(await stored(page)).toMatchObject({ analytics: true, replay: false })
  await expect.poll(() => ph.pageviews()).toEqual(['/methodology'])
  await page.mouse.move(100, 100); await page.mouse.click(120, 120)
  await page.mouse.wheel(0, 400)
  await settle(page, 8000)
  expect(ph.calls.filter(c => /\/s\//.test(new URL(c.url).pathname))).toEqual([])
  expect(ph.events().filter(e => e.event === '$snapshot')).toEqual([])
})

test('Replay consent records public pages only, and stops when a sensitive page opens', async ({ page, context }) => {
  const ph = await interceptPosthog(page)
  await signInAs(context, 'owner@acme.example')
  await page.goto('/directory')
  await banner(page).getByRole('button', { name: 'Choose' }).click()
  await banner(page).getByRole('checkbox', { name: /Product analytics/ }).check()
  await banner(page).getByRole('checkbox', { name: /Session replay/ }).check()
  await banner(page).getByRole('button', { name: 'Save choices' }).click()
  const snapshots = () => ph.calls.filter(c => /\/s\//.test(new URL(c.url).pathname) || c.events.some(e => e.event === '$snapshot')).length
  // The recorder holds its upload until the visitor interacts after it has started, so keep interacting.
  await expect.poll(async () => { await page.mouse.move(150 + Math.random() * 100, 150); await page.mouse.click(160, 160); await page.mouse.wheel(0, 50); return snapshots() }, { timeout: 40_000 }).toBeGreaterThan(0)
  await page.getByRole('link', { name: /Validation Engagements/ }).first().click()
  await expect(page).toHaveURL(/\/engagements/)
  await settle(page, 1500)
  const atNavigation = snapshots()
  await page.mouse.move(200, 200); await page.mouse.click(250, 250); await page.mouse.wheel(0, 300)
  await settle(page, 9000)
  expect(snapshots()).toBe(atNavigation)
  expect(ph.events().filter(e => e.event !== '$snapshot').every(e => classifyPath(new URL(e.properties.$current_url).pathname) !== 'sensitive')).toBe(true)
})

test('replay masks what is typed and hides page text outside public information pages', async ({ page }) => {
  const ph = await interceptPosthog(page)
  await page.goto('/auth')
  await banner(page).getByRole('button', { name: 'Accept analytics' }).click()
  await page.getByRole('button', { name: 'Register', exact: true }).first().click()
  const email = page.getByLabel(/email/i).first()
  await expect(email).toBeVisible()
  const snapshots = () => ph.calls.filter(c => new URL(c.url).pathname.startsWith('/s/')).map(c => c.events.length ? JSON.stringify(c.events) : '').join('')
  await expect.poll(async () => {
    await email.click(); await email.fill('typed-secret@example.org'); await page.mouse.wheel(0, 40)
    return snapshots().length
  }, { timeout: 40_000 }).toBeGreaterThan(0)
  await page.waitForTimeout(3000)
  expect(snapshots()).not.toContain('typed-secret')
  expect(snapshots()).not.toContain('example.org')
  // Page text on a non-marketing page is replaced; the registration heading is not readable in the recording.
  expect(snapshots()).not.toContain('Register your institution')
  expect(JSON.stringify(ph.events())).not.toContain('typed-secret')
})

test('withdrawing consent stops collection and clears PostHog storage', async ({ page }) => {
  const ph = await interceptPosthog(page)
  await page.goto('/methodology')
  await banner(page).getByRole('button', { name: 'Accept analytics' }).click()
  await expect.poll(() => ph.pageviews()).toEqual(['/methodology'])
  await page.getByRole('button', { name: 'Cookie & analytics settings' }).click()
  await expect(banner(page).getByRole('heading', { name: 'Cookie & analytics settings' })).toBeFocused()
  await expect(banner(page).getByRole('checkbox', { name: /Product analytics/ })).toBeChecked()
  await banner(page).getByRole('checkbox', { name: /Product analytics/ }).uncheck()
  await banner(page).getByRole('button', { name: 'Save choices' }).click()
  expect(await stored(page)).toMatchObject({ analytics: false, replay: false })
  const sentBefore = ph.events().length
  await page.getByRole('link', { name: 'Privacy Policy' }).click()
  await page.goto('/privacy')
  await settle(page)
  expect(ph.events().length).toBe(sentBefore)
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ph_') || k.startsWith('__ph_')))).toEqual([])
})

test('a new policy version asks again and sends nothing until answered', async ({ page }) => {
  const ph = await interceptPosthog(page)
  await page.addInitScript(([key]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ analytics: true, replay: true, timestamp: '2026-01-01T00:00:00.000Z', policyVersion: '2025-01-01' }))
  }, [CONSENT_STORAGE_KEY] as const)
  await page.goto('/methodology')
  await expect(banner(page)).toBeVisible()
  await settle(page)
  expect(ph.calls).toHaveLength(0)
})

for (const [name, script] of [
  ['Global Privacy Control', () => Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true })],
  ['Do Not Track', () => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' })],
] as const) {
  test(`${name} is treated as a rejection, even over an earlier accept`, async ({ page }) => {
    const ph = await interceptPosthog(page)
    await page.addInitScript(script)
    await page.addInitScript(([key, version]) => {
      localStorage.setItem(key, JSON.stringify({ analytics: true, replay: true, timestamp: new Date().toISOString(), policyVersion: version }))
    }, [CONSENT_STORAGE_KEY, CONSENT_POLICY_VERSION] as const)
    await page.goto('/methodology')
    await expect(banner(page)).toHaveCount(0)
    await page.goto('/auth')
    await settle(page)
    expect(ph.calls).toHaveLength(0)
    await page.getByRole('button', { name: 'Cookie & analytics settings' }).click()
    await expect(banner(page).getByRole('status')).toContainText(/Do Not Track|Global Privacy Control/)
    await expect(banner(page).getByRole('checkbox', { name: /Product analytics/ })).toBeDisabled()
  })
}

test('the banner and settings are operable by keyboard alone', async ({ page }) => {
  const ph = await interceptPosthog(page)
  await page.goto('/')
  // The banner mounts after hydration; start tabbing from the top of the page only once it is there.
  await expect(banner(page)).toBeVisible()
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const focusedName = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? '')
  let found = false
  for (let i = 0; i < 12 && !found; i++) { await page.keyboard.press('Tab'); found = (await focusedName()) === 'Accept analytics' }
  expect(found).toBe(true)
  await page.keyboard.press('Tab'); expect(await focusedName()).toBe('Reject')
  await page.keyboard.press('Tab'); expect(await focusedName()).toBe('Choose')
  await page.keyboard.press('Enter')
  await page.getByRole('checkbox', { name: /Product analytics/ }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('checkbox', { name: /Product analytics/ })).toBeChecked()
  await page.getByRole('button', { name: 'Save choices' }).focus()
  await page.keyboard.press('Enter')
  await expect(banner(page)).toHaveCount(0)
  await expect.poll(() => ph.pageviews()).toEqual(['/'])
  // Reopen from the footer and close with Escape.
  await page.getByRole('button', { name: 'Cookie & analytics settings' }).focus()
  await page.keyboard.press('Enter')
  await expect(banner(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(banner(page)).toHaveCount(0)
})

test('on a phone the banner fits the screen and its buttons are easy to hit', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/')
  await expect(banner(page)).toBeVisible()
  const box = (await banner(page).boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(360)
  expect(box.y + box.height).toBeLessThanOrEqual(640)
  for (const name of ['Accept analytics', 'Reject', 'Choose']) {
    expect((await banner(page).getByRole('button', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})
