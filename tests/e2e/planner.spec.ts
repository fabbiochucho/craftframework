import { test, expect } from './fixtures'

// Planner: set a dependency in the UI, then see workstreams, budget and the dependency graph on the roadmap.
test('planner dependencies, workstreams and budgets show on the roadmap', async ({ signedIn: page }) => {
  await page.goto('/app/workspaces')
  await page.getByLabel('Organization name').fill('Planner E2E')
  await page.getByLabel('Country').fill('Nigeria')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible()
  await page.getByLabel('New workspace').fill('Roadmap WS')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('link', { name: 'Roadmap WS' }).click()
  await page.waitForURL(/\/workspaces\/\d+\//)
  const workspaceId = /\/workspaces\/(\d+)\//.exec(page.url())![1]

  const rows = await page.evaluate(async ws => {
    const post = (b: object) => fetch(`/api/workspaces/${ws}/esg-planner/sec-ng`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json())
    return (await post({ organisationName: 'Acme', entityType: 'public_company', readiness: 'early', horizon: '12m', startDate: '2026-11-01' })).rows
  }, workspaceId)
  const [first, second] = rows
  await page.evaluate(async ({ ws, id }) => {
    await fetch(`/api/workspaces/${ws}/esg-plans/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workstream: 'Governance', budgetEstimate: 2500000, budgetCurrency: 'NGN' }) })
  }, { ws: workspaceId, id: first.planId })

  // Dependency set through the plan page.
  await page.goto(`/app/workspaces/${workspaceId}/esg/implementation/${second.requirementDbId}`)
  await page.getByRole('checkbox', { name: new RegExp(first.requirementId) }).check()
  await page.getByRole('button', { name: 'Save dependencies' }).click()
  await expect(page.getByRole('button', { name: 'Save dependencies' })).toBeDisabled()

  await page.goto(`/app/workspaces/${workspaceId}/esg/roadmap`)
  await expect(page.getByRole('cell', { name: 'Governance' })).toBeVisible()
  await expect(page.getByText(/NGN 2,500,000 budget/)).toBeVisible()
  await expect(page.getByRole('img', { name: 'Dependency graph' })).toBeVisible()
  await expect(page.getByText(/Critical path \(\d+ days\)/)).toBeVisible()
  const graph = page.getByRole('img', { name: 'Dependency graph' })
  await expect(graph.getByText(first.requirementId, { exact: true })).toBeVisible()
  await expect(graph.getByText(second.requirementId, { exact: true })).toBeVisible()
})
