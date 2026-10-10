import { test, expect } from './fixtures'

test('production SSR document hydrates and protects workspace navigation', async ({ page, request }) => {
  const response = await request.get('/code-of-conduct')
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain('Code of Conduct')
  const runtimeErrors: string[] = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && /hydration|Minified React error|server rendered/i.test(message.text())) {
      runtimeErrors.push(message.text())
    }
  })
  await page.goto('/code-of-conduct')
  await page.getByRole('button', { name: 'Open support chat' }).click()
  await expect(page.getByRole('dialog', { name: 'craftframework Support' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto('/app/workspaces')
  await expect(page).toHaveURL(/\/auth$/)
  await expect(page.getByLabel('Work Email')).toBeVisible()
  expect(runtimeErrors).toEqual([])
})
