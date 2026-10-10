import { test, expect } from '@playwright/test'

test('recovery link is scrubbed and cannot sign in before passwords match', async ({ page }) => {
  let redeemed = false
  await page.route('**/.netlify/identity/verify', async route => {
    redeemed = true
    await route.fulfill({ status: 400, json: { msg: 'Expired token' } })
  })
  await page.goto('/auth#recovery_token=recovery-test-link')
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible()
  await expect(page).toHaveURL(/\/auth$/)
  expect(redeemed).toBe(false)
  expect(await page.evaluate(() => localStorage.getItem('gotrue.user'))).toBeNull()
  await page.getByLabel('New password', { exact: true }).fill('long-password')
  await page.getByLabel('Confirm new password').fill('different-password')
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('The passwords do not match.')
  expect(redeemed).toBe(false)
  await page.getByLabel('Confirm new password').fill('long-password')
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Link unavailable' })).toBeVisible()
  await expect(page).toHaveURL(/\/auth$/)
  expect(redeemed).toBe(true)
  expect(await page.evaluate(() => localStorage.getItem('gotrue.user'))).toBeNull()
})

test('malformed recovery link offers a new request rather than the workspace', async ({ page }) => {
  await page.goto('/auth#recovery_token=one&recovery_token=two')
  await expect(page.getByRole('heading', { name: 'Link unavailable' })).toBeVisible()
  await expect(page).toHaveURL(/\/auth$/)
  await page.getByRole('button', { name: 'Request a new reset link' }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password', exact: true })).toBeVisible()
})

test('recovery request hides account existence and provider failure details', async ({ page }) => {
  await page.route('**/.netlify/identity/recover', route => route.fulfill({
    status: 404, json: { msg: 'No user found for private@example.test' },
  }))
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Forgot your password?' }).click()
  await page.getByLabel('Work Email').fill('private@example.test')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toContainText('If an account exists')
  await expect(page.getByText('No user found')).toHaveCount(0)
})
