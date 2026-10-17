import { test, expect, signInAs } from './fixtures'

const API = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8899}`
const SUPER = 'fabbiochucho@gmail.com'

// The Super Admin opens the analytics dashboard, finds a person who stopped part-way through onboarding, and
// previews the 'finish setting up' email. No email provider is configured in the test API, so nothing is delivered.
test('the Super Admin opens /admin/analytics and previews a resume-onboarding email', async ({ page, context, request }) => {
  expect((await request.post(`${API}/__test/reset`)).status()).toBe(204)
  expect((await request.post(`${API}/__test/seed-onboarding`)).status()).toBe(204)
  await signInAs(context, SUPER)
  const session = (await context.cookies()).find((c) => c.name === 'nf_jwt')!.value
  const profile = await request.put(`${API}/api/legacy-state`, {
    headers: { cookie: `nf_jwt=${session}` },
    data: { orgId: 'self_fabbiochucho_gmail_com', key: 'entity-profile', value: { orgName: 'CRAFT HQ', archetype: 'civil_society', country: 'Kenya', sector: 'health', onboardingComplete: true } },
  })
  expect(profile.status()).toBe(200)

  // Enter through the exempt /app area, then navigate in-app (a full load of a legacy page briefly counts onboarding as incomplete).
  const profileLoaded = page.waitForResponse((r) => r.url().includes('key=entity-profile') && r.status() === 200)
  await page.goto('/app/workspaces')
  await profileLoaded
  await page.getByRole('link', { name: 'Analytics', exact: true }).first().click()
  await expect(page).toHaveURL(/\/admin\/analytics$/)
  await expect(page.getByRole('heading', { name: 'Platform analytics' })).toBeVisible()

  // Funnel counts and the people who stalled.
  await expect(page.getByText('Started onboarding')).toBeVisible()
  const row = page.getByRole('row', { name: /amina@riverbend\.example/ })
  await expect(row).toContainText('Riverbend Cooperative')
  await expect(row).toContainText('2 of 3: Donor Alignment')

  // Select her and preview the email.
  await expect(page.getByRole('button', { name: /Email selected \(0\)/ })).toBeDisabled()
  await page.getByRole('checkbox', { name: /Select Amina Okoro/ }).check()
  await page.getByRole('button', { name: /Email selected \(1\)/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Email selected people' })
  await expect(dialog.getByText('Finish setting up your CRAFT workspace').first()).toBeVisible()
  await dialog.getByLabel(/Personal note/).fill('Happy to help with the donor step.')
  await expect(dialog.getByText('Will be sent')).toBeVisible()
  await dialog.getByRole('button', { name: 'Show preview' }).click()
  const frame = dialog.frameLocator('iframe[title="Email preview for amina@riverbend.example"]')
  await expect(frame.getByText('Hi Amina,')).toBeVisible()
  await expect(frame.getByText('step 2 of 3: Donor Alignment')).toBeVisible()
  await expect(frame.getByText('Happy to help with the donor step.')).toBeVisible()
  await expect(frame.getByRole('link', { name: 'Continue where you left off' })).toHaveAttribute('href', /\/auth\?next=\/onboarding%3Fstep%3D2$/)
  await page.screenshot({ path: 'test-results/admin-analytics-preview.png', fullPage: true })
  // The test API has no email provider: sending reports that plainly rather than pretending it worked.
  await dialog.getByRole('button', { name: 'Send to 1' }).click()
  await expect(dialog.getByRole('status')).toContainText('Email is not configured on this deployment')
})

test('a person who is not the Super Admin cannot read analytics', async ({ page, context, request }) => {
  expect((await request.post(`${API}/__test/reset`)).status()).toBe(204)
  await signInAs(context, 'owner@acme.example')
  const session = (await context.cookies()).find((c) => c.name === 'nf_jwt')!.value
  expect((await request.get(`${API}/api/admin-analytics`, { headers: { cookie: `nf_jwt=${session}` } })).status()).toBe(403)
  expect((await request.get(`${API}/api/admin-analytics`)).status()).toBe(401)
  void page
})

// The 'continue where you left off' button goes to /auth?next=/onboarding. `next` is honoured only for same-site paths.
test('/auth?next= returns to a same-site page after sign-in and never to another site', async ({ signedIn: page }) => {
  await page.goto('/auth?next=https%3A%2F%2Fevil.example%2Fphish')
  await expect(page).toHaveURL(/localhost:\d+\/dashboard$/)
  await page.goto('/auth?next=%2F%2Fevil.example')
  await expect(page).toHaveURL(/localhost:\d+\/dashboard$/)
  await page.goto('/auth?next=%2Fcip')
  await expect(page).toHaveURL(/localhost:\d+\/cip$/)
  // Someone who already finished onboarding is not sent back into it.
  await page.goto('/auth?next=%2Fonboarding')
  await expect(page).toHaveURL(/localhost:\d+\/dashboard$/)
})
