import { mkdirSync } from 'node:fs'
import { test, expect, forwardApi, signInAs } from './fixtures'

const API = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8899}`
const SUPER = 'fabbiochucho@gmail.com'
// Set QA_SCREENSHOTS=1 to write the committed screenshots under docs/qa/lifecycle-emails/.
const SHOTS = process.env.QA_SCREENSHOTS ? 'docs/qa/lifecycle-emails' : 'test-results'
mkdirSync(SHOTS, { recursive: true })

// Someone opens the survey from their email (no sign-in), answers it and asks for a call. The Super Admin then sees
// the response, the NPS, the suggestion and the call request in the analytics, and marks the request handled.
test('a person fills in the survey from their email link and the Super Admin sees the response', async ({ page, context, request, browser }) => {
  expect((await request.post(`${API}/__test/reset`)).status()).toBe(204)
  const { token } = await (await request.post(`${API}/__test/seed-lifecycle`)).json()

  // The person: not signed in, on a phone.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await forwardApi(phone)
  const mobile = await phone.newPage()
  await mobile.goto(`/feedback/${token}`)
  await expect(mobile.getByRole('heading', { name: 'How is CRAFT working for Riverbend Cooperative?' })).toBeVisible()
  await mobile.getByRole('button', { name: 'Send my answers' }).click()
  await expect(mobile.getByRole('alert')).toContainText('question 1')
  const q = (n: number) => mobile.getByRole('group', { name: new RegExp(`^${n}\\.`) })
  await q(1).locator('label', { hasText: /^9$/ }).click()
  await q(2).locator('label', { hasText: /^4$/ }).click()
  await q(3).getByLabel('Reports').check()
  await q(3).getByLabel('Data Room').check()
  await mobile.getByLabel(/What’s one thing we should improve/).fill('Faster evidence uploads on slow connections.')
  await q(5).locator('label', { hasText: 'Yes' }).click()
  await mobile.getByLabel(/Preferred times/).fill('Weekday mornings, West Africa time')
  await mobile.screenshot({ path: `${SHOTS}/survey-form-mobile.png`, fullPage: true })
  await mobile.getByRole('button', { name: 'Send my answers' }).click()
  await expect(mobile.getByRole('heading', { name: 'Thank you, Amina' })).toBeVisible()
  await expect(mobile.getByAltText('Abiola & Pauline')).toBeVisible()
  await expect(mobile.getByText('CRAFT team, DiBadili Institute')).toBeVisible()
  await mobile.screenshot({ path: `${SHOTS}/survey-thank-you-mobile.png`, fullPage: true })
  // Within 24 hours the answers can be changed; reopening the link shows them.
  await mobile.reload()
  await expect(mobile.getByRole('heading', { name: 'How is CRAFT working for Riverbend Cooperative?' })).toBeVisible()
  await expect(mobile.getByRole('group', { name: /^1\./ }).getByLabel('9', { exact: true })).toBeChecked()
  await expect(mobile.getByRole('button', { name: 'Update my answers' })).toBeVisible()
  await phone.close()

  // A tampered link is refused with a clear message.
  await forwardApi(context)
  await page.goto(`/feedback/${token.slice(0, -3)}abc`)
  await expect(page.getByRole('heading', { name: 'This survey link can’t be used' })).toBeVisible()

  // The Super Admin.
  await signInAs(context, SUPER)
  await request.put(`${API}/api/legacy-state`, { // finished onboarding, so the app lets them into /admin
    headers: { cookie: `nf_jwt=${(await context.cookies()).find((c) => c.name === 'nf_jwt')!.value}` },
    data: { orgId: 'self_fabbiochucho_gmail_com', key: 'entity-profile', value: { orgName: 'CRAFT HQ', archetype: 'civil_society', country: 'Kenya', sector: 'health', onboardingComplete: true } },
  })
  const profileLoaded = page.waitForResponse((r) => r.url().includes('key=entity-profile') && r.status() === 200)
  await page.goto('/app/workspaces')
  await profileLoaded
  await page.getByRole('link', { name: 'Analytics', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Platform analytics' })).toBeVisible()
  await page.getByRole('button', { name: 'Lifecycle emails' }).click()
  await expect(page.getByRole('heading', { name: 'Survey results' })).toBeVisible()
  await expect(page.getByText('Net Promoter Score')).toBeVisible()
  await expect(page.getByText('1 responses')).toBeVisible()
  await expect(page.getByText('Faster evidence uploads on slow connections.')).toBeVisible()
  const row = page.getByRole('row', { name: /amina@riverbend\.example/ }).filter({ hasText: 'Weekday mornings' })
  await expect(row).toBeVisible()
  await page.getByRole('button', { name: /Mark handled: Amina Okoro/ }).click()
  await expect(row).toContainText('Handled')
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.screenshot({ path: `${SHOTS}/admin-lifecycle-survey-results.png`, fullPage: true })

  // Pause-all, and a preview of one template.
  await page.getByRole('button', { name: 'Pause all lifecycle emails' }).click()
  await expect(page.getByText('Paused: nothing is being sent')).toBeVisible()
  await page.getByRole('button', { name: 'Resume all lifecycle emails' }).click()
  await expect(page.getByText('Running', { exact: true })).toBeVisible()
  await page.getByLabel('Template and variant').selectOption('milestone_12_progress')
  await expect(page.getByTestId('lifecycle-preview-subject')).toHaveText('Happy one-year CRAFT anniversary, Amina!')
  const frame = page.frameLocator('iframe[title^="Email preview"]')
  await expect(frame.getByText('Independently validated at rung 3')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/admin-lifecycle-controls.png`, fullPage: true })
})

test('email preferences work from the signed link without signing in', async ({ context, request, page }) => {
  expect((await request.post(`${API}/__test/reset`)).status()).toBe(204)
  await request.post(`${API}/__test/seed-lifecycle`)
  await forwardApi(context)
  const { prefsToken } = await (await request.post(`${API}/__test/seed-lifecycle`)).json()
  await page.goto(`/email-preferences?t=${prefsToken}`)
  await expect(page.getByRole('heading', { name: 'Email preferences' })).toBeVisible()
  await expect(page.getByText('amina@riverbend.example')).toBeVisible()
  const celebrations = page.getByRole('switch', { name: 'Celebrations emails' })
  await expect(celebrations).toBeChecked()
  await celebrations.click()
  await expect(page.getByRole('status').filter({ hasText: 'Celebrations emails are now off.' })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Check-ins and feedback emails' })).toBeChecked()
  await page.screenshot({ path: `${SHOTS}/email-preferences.png`, fullPage: true })
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Celebrations emails' })).not.toBeChecked()
})
