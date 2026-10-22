import { test, expect, signInAs } from './fixtures'

const SUPER = 'fabbiochucho@gmail.com'

// The e2e build has no VITE_SENTRY_DSN, so monitoring must stay completely silent (no SDK, no requests).
test('a render error shows the friendly fallback, and without a DSN nothing is sent to Sentry', async ({ page, context }) => {
  const sentry: string[] = []
  page.on('request', r => { if (new URL(r.url()).hostname.endsWith('.sentry.io')) sentry.push(r.url()) })
  await signInAs(context, SUPER)
  await page.goto('/app/monitoring-test')
  await expect(page.getByRole('heading', { name: 'Error monitoring test' })).toBeVisible()

  await page.getByRole('button', { name: /Crash this page/ }).click()
  const fallback = page.getByRole('alert')
  await expect(fallback).toContainText('Something went wrong — the CRAFT team has been notified.')
  await expect(fallback.getByRole('button', { name: 'Reload the page' })).toBeVisible()

  // Reloading brings the page back.
  await fallback.getByRole('button', { name: 'Reload the page' }).click()
  await expect(page.getByRole('heading', { name: 'Error monitoring test' })).toBeVisible()
  expect(sentry).toEqual([])
})

test('the test page is for the Super Admin only', async ({ signedIn: page }) => {
  await page.goto('/app/monitoring-test')
  await expect(page.getByText('This page is for the platform Super Admin.')).toBeVisible()
})
