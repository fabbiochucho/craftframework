import { test, expect } from './fixtures'

// CAP hub: spot duplicates, merge them keeping provenance, then escalate the surviving CAP.
test('duplicate CAPs merge with provenance and the survivor can be escalated', async ({ signedIn: page }) => {
  await page.goto('/app/workspaces')
  await page.getByLabel('Organization name').fill('CAP E2E')
  await page.getByLabel('Country').fill('Ghana')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible()
  await page.getByLabel('New workspace').fill('Actions WS')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('link', { name: 'Actions WS' }).click()
  await page.waitForURL(/\/workspaces\/\d+\//)
  const ws = /\/workspaces\/(\d+)\//.exec(page.url())![1]
  const ids = await page.evaluate(async w => {
    const post = (b: object) => fetch(`/api/workspaces/${w}/cap`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceType: 'manual', ...b }) }).then(r => r.json())
    const a = await post({ findingDescription: 'Bank reconciliations are not reviewed monthly', severity: 'medium' })
    const b = await post({ findingDescription: 'Monthly bank reconciliations not reviewed', severity: 'critical' })
    return [a.id, b.id]
  }, ws)

  await page.goto(`/app/workspaces/${ws}/actions`)
  await expect(page.getByRole('heading', { name: /Possible duplicates/ })).toBeVisible()
  await page.getByRole('button', { name: `Keep #${ids[0]}, merge the others` }).click()
  await expect(page.getByRole('heading', { name: /Possible duplicates/ })).toHaveCount(0)

  await page.goto(`/app/workspaces/${ws}/actions/${ids[0]}`)
  await page.getByText(/Merged duplicates \(1\)/).click()
  await expect(page.getByText(/Monthly bank reconciliations not reviewed · critical/)).toBeVisible()
  await page.getByLabel('Immediate correction (fix this instance now)').fill('Review September reconciliations now')
  await page.getByRole('button', { name: 'Save changes' }).first().click()
  await page.getByLabel('Reason for escalating').fill('Donor audit in two weeks')
  await page.getByRole('button', { name: 'Escalate' }).click()
  await expect(page.getByText(/Level 1: Workspace admins/)).toBeVisible()
})
