import { test, expect } from './fixtures'

// An organisation registered as an NPHI runs a SPAR self-assessment and sees the crosswalk.
test('NPHI runs a SPAR self-assessment and sees the health-security overview', async ({ signedIn: page }) => {
  await page.goto('/app/workspaces')
  await page.getByLabel('Organization name').fill('NPHI E2E')
  await page.getByLabel('Country').fill('Nigeria')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible()
  const orgId = (await page.evaluate(() => fetch('/api/orgs').then(r => r.json())))[0].id
  await page.getByLabel('New workspace').fill('IHR')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('link', { name: 'IHR' }).click()
  const dashboard = page.url()

  // Not an NPHI yet: the overview explains how to unlock the assessments.
  await page.getByRole('main').getByRole('link', { name: 'Health security (NPHI, JEE, SPAR, IHR)' }).click()
  await expect(page.getByText(/available to organisations registered as a/)).toBeVisible()
  expect((await page.evaluate(id => fetch(`/api/orgs/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'nphi' }) }).then(r => r.status), orgId))).toBe(200)

  await page.goto(dashboard)
  await page.getByRole('main').getByRole('link', { name: 'Governance assessments & CRAFT Scorecard' }).click()
  await page.getByLabel('Framework').selectOption('SPAR')
  await page.getByLabel('Reporting period').fill('2026')
  await page.getByRole('button', { name: 'New assessment' }).click()
  await page.getByRole('link', { name: 'SPAR' }).click()
  await expect(page.getByRole('heading', { name: /IHR SPAR self-assessment \(WHO 2nd ed\.\) v1 — 2026/ })).toBeVisible()

  await page.getByRole('button', { name: 'Scoring Wizard' }).click()
  await page.getByLabel('Level').first().selectOption('4')
  await page.getByRole('button', { name: 'Save' }).first().click()
  await expect(page.getByText('completed').first()).toBeVisible()
  await page.getByRole('button', { name: 'Scorecard' }).click()
  await expect(page.getByText('SDG 3.d.1', { exact: true })).toBeVisible()
  await expect(page.getByText('80%').first()).toBeVisible()

  await page.goto(dashboard)
  await page.getByRole('main').getByRole('link', { name: 'Health security (NPHI, JEE, SPAR, IHR)' }).click()
  await expect(page.getByRole('cell', { name: 'Legal instruments' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '80%' })).toBeVisible()
})
