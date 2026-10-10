import { test, expect } from './fixtures'

// Minimal end-to-end smoke path through the real UI -> real workspace-api -> real Postgres.
test('org/workspace -> assessment -> finding -> CAP -> evidence -> report PDF', async ({ signedIn: page }) => {
  // Org (the signed-in test user has none yet)
  await page.goto('/app/workspaces')
  await page.getByLabel('Organization name').fill('Acme E2E Org')
  await page.getByLabel('Country').fill('Kenya')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible()
  await expect(page.getByLabel('Organization', { exact: true })).toBeVisible()

  // Workspace
  await page.getByLabel('New workspace').fill('E2E Workspace')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('link', { name: /E2E Workspace/ }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Workspace dashboard' })).toBeVisible()
  const dashboardUrl = page.url()

  // Governance assessment + finding
  await page.getByRole('main').getByRole('link', { name: 'Governance assessments' }).click()
  await page.getByRole('button', { name: 'New assessment' }).click()
  await page.getByRole('link', { name: 'G2G' }).click()
  await page.getByRole('button', { name: 'Findings', exact: true }).click()
  await page.getByLabel('Description').fill('Board minutes are not retained')
  await page.getByLabel('Owner assignment').fill('assessor@acme.example')
  await page.getByLabel('Finding due date').fill('2027-01-15')
  await page.getByLabel('Recommendation').fill('Keep signed minutes')
  await page.getByRole('button', { name: 'Add finding' }).click()
  await expect(page.getByText('Board minutes are not retained')).toBeVisible()
  await page.getByLabel('Recommendation').last().fill('Retain approved signed minutes')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Findings', exact: true }).click()
  await expect(page.getByLabel('Recommendation').last()).toHaveValue('Retain approved signed minutes')

  // Corrective action plan
  await page.goto(dashboardUrl)
  await page.getByRole('main').getByRole('link', { name: 'Corrective actions' }).click()
  await page.getByText('New manual CAP').click()
  await page.getByLabel('Finding', { exact: true }).fill('Retain board minutes')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Retain board minutes' })).toBeVisible()

  // Evidence upload
  await page.goto(dashboardUrl)
  await page.getByRole('main').getByRole('link', { name: 'Evidence registry' }).click()
  await page.locator('input[type=file]').setInputFiles({
    name: 'policy.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% e2e evidence\n'),
  })
  await expect(page.getByText('policy.pdf')).toBeVisible()
  await page.getByRole('link', { name: 'policy.pdf' }).click()
  await page.getByLabel('Expiry date').fill('2027-02-01')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.reload()
  await expect(page.getByLabel('Expiry date')).toHaveValue('2027-02-01')

  // Report generation + PDF download
  await page.goto(dashboardUrl)
  await page.getByRole('main').getByRole('link', { name: 'Reports', exact: true }).click()
  await page.getByLabel('Scheduled report type').selectOption('esg_status')
  await page.getByRole('button', { name: 'Generate' }).click()
  await page.getByRole('link', { name: 'governance scorecard' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download PDF' }).click(),
  ])
  const chunks: Buffer[] = []
  for await (const c of await download.createReadStream()) chunks.push(c as Buffer)
  const pdf = Buffer.concat(chunks)
  expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF')
})
