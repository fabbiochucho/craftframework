import { test, expect, signInAs } from './fixtures'

// An organisation registered as an NPHI runs a SPAR self-assessment and sees the crosswalk.
test('NPHI runs a SPAR self-assessment and sees the health-security overview', async ({ signedIn: page, browser }) => {
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

  // Not on a registered NPHI domain: pending until a platform operator verifies it.
  await page.goto('/app/org/settings')
  await expect(page.getByText('NPHI verification:')).toBeVisible()
  await expect(page.getByText('pending', { exact: true })).toBeVisible()
  const operatorContext = await browser.newContext()
  await signInAs(operatorContext, 'fabbiochucho@gmail.com')
  const operator = await operatorContext.newPage()
  await operator.goto('/app/org/settings')
  await operator.getByLabel('Decision note for NPHI E2E').fill('Establishment act and DG letter checked')
  await operator.getByRole('row', { name: /NPHI E2E/ }).getByRole('button', { name: 'Verify' }).click()
  await expect(operator.getByRole('row', { name: /NPHI E2E/ }).getByText('verified', { exact: true })).toBeVisible()
  await operatorContext.close()

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
  await expect(page.getByText('2.7%').first()).toBeVisible()

  await page.goto(dashboard)
  await page.getByRole('main').getByRole('link', { name: 'Health security (NPHI, JEE, SPAR, IHR)' }).click()
  await expect(page.getByRole('cell', { name: 'Legal instruments' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '40%' })).toBeVisible()

  // Framework mapping: the SPAR average contributes to SDG 3.d.
  await page.goto(dashboard)
  await page.getByRole('main').getByRole('link', { name: 'Framework mapping (SDGs, Agenda 2063, APRM)' }).click()
  await page.getByLabel('SDG goal').selectOption('3')
  await expect(page.getByRole('cell', { name: 'SPAR average (SDG indicator 3.d.1)' })).toBeVisible()
  await expect(page.getByRole('cell', { name: /Leadership, Board Effectiveness/ })).toHaveCount(0)
})
