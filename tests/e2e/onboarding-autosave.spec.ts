import { test, expect, signInAs } from './fixtures'

const API = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8899}`

// Someone fills step 1, moves to step 2 and leaves. Coming back (reload, or signing in again through
// /auth?next=/onboarding) reopens step 2 with step-1 intact, and the wizard says it saved.
test('onboarding saves as people go and resumes at the furthest step', async ({ page, context, request }) => {
  expect((await request.post(`${API}/__test/reset`)).status()).toBe(204)
  await signInAs(context, 'newcomer@fresh.example')

  await page.goto('/onboarding')
  await expect(page.getByRole('heading', { name: 'Set up your workspace' })).toBeVisible()
  await page.getByLabel('Organization Name').fill('Riverbend Cooperative')
  await page.getByLabel('Entity Archetype').selectOption('Civil Society')
  await page.getByLabel('Country of Operation').selectOption({ index: 1 })
  const country = await page.getByLabel('Country of Operation').inputValue()

  // Debounced save while typing, then an immediate save when moving on.
  const saved = page.waitForResponse((r) => r.url().includes('/api/legacy-state') && r.request().method() === 'PUT' && r.status() === 200)
  await page.getByRole('button', { name: /Continue/ }).click()
  await saved
  await expect(page.getByRole('heading', { name: 'Align to your donors' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible()

  // Reload: lands on step 2.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Align to your donors' })).toBeVisible()
  // Back to step 1: values intact.
  await page.getByRole('button', { name: /Back/ }).click()
  await expect(page.getByLabel('Organization Name')).toHaveValue('Riverbend Cooperative')
  await expect(page.getByLabel('Entity Archetype')).toHaveValue('Civil Society')
  await expect(page.getByLabel('Country of Operation')).toHaveValue(country)

  // Signing back in through the resume link also lands on step 2.
  await page.goto('/auth?next=%2Fonboarding%3Fstep%3D2')
  await expect(page.getByRole('heading', { name: 'Align to your donors' })).toBeVisible()
  await page.goto('/auth?next=/onboarding')
  await expect(page.getByRole('heading', { name: 'Align to your donors' })).toBeVisible()
  await page.getByRole('button', { name: /Back/ }).click()
  await expect(page.getByLabel('Organization Name')).toHaveValue('Riverbend Cooperative')

})
