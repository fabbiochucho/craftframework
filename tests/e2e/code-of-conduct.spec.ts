import { test, expect } from '@playwright/test'

test('public conduct summary links to the canonical policy and private reporting', async ({ page }) => {
  await page.goto('/code-of-conduct')
  await expect(page.getByRole('heading', { name: 'Code of Conduct', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'full Code of Conduct and enforcement policy' }))
    .toHaveAttribute('href', 'https://github.com/fabbiochucho/craftframework/blob/main/CODE_OF_CONDUCT.md')
  await expect(page.getByRole('link', { name: 'craftframework@becomechange.institute', exact: true }).first())
    .toHaveAttribute('href', 'mailto:craftframework@becomechange.institute')
  await expect(page.getByText(/Do not use public issues or the support chatbot/)).toBeVisible()
  await expect(page.getByText(/Retaliation is prohibited/)).toBeVisible()
  await expect(page.getByText(/appeals within 30 calendar days/)).toBeVisible()
  await expect(page.getByText(/ordinary email cannot guarantee anonymity/)).toBeVisible()
  await expect(page.getByText(/subject to capacity/)).toBeVisible()
})
