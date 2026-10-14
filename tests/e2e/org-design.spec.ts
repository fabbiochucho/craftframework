import { test, expect } from './fixtures'

// Organisational design & diagnosis: rate the structure, see the diagnosis update, download the report.
test('org design review diagnoses structure and produces the organisational analysis report', async ({ signedIn: page }) => {
  await page.goto('/app/workspaces')
  await page.getByLabel('Organization name').fill('Org Design E2E')
  await page.getByLabel('Country').fill('Kenya')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible()
  await page.getByLabel('New workspace').fill('Design review')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('link', { name: 'Design review' }).click()

  await page.getByRole('main').getByRole('link', { name: 'Organisational design & diagnosis' }).click()
  await page.getByLabel(/New review/).fill('Health agency 2026')
  await page.getByRole('button', { name: 'Start review' }).click()
  await page.getByRole('link', { name: 'Health agency 2026' }).click()

  await page.getByRole('button', { name: /3\. Organisational structure/ }).click()
  for (const name of ['Core work is done by trained professionals', 'Coordination relies on professional standards', 'Professionals have a strong say']) {
    await page.getByRole('group', { name: new RegExp(name) }).getByText('5', { exact: true }).click()
  }
  await page.getByRole('button', { name: 'Save section' }).click()
  const diag = page.getByRole('complementary', { name: 'Diagnosis' })
  await expect(diag.getByText('Professional bureaucracy', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /7\. Design evaluation/ }).click()
  await page.getByLabel(/People test: Does the design reflect/).selectOption('fail')
  await page.getByRole('button', { name: 'Save section' }).click()
  await expect(diag.getByText(/Redesign needed/)).toBeVisible()
  await expect(diag.getByText(/People test is marked fail but has no design change/)).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download report (Word)' }).click()
  expect((await download).suggestedFilename()).toBe('organisational-analysis-Health_agency_2026.doc')
})
