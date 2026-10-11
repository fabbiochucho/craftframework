import { test, expect, signInAs } from './fixtures'

test('evidence review, links, download and archive survive reloads', async ({ signedIn: page, browser }) => {
  await page.goto('/app/workspaces')
  await page.getByLabel('Organization name').fill('Evidence E2E Org')
  await page.getByLabel('Country').fill('Kenya')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible()
  const orgId = (await page.evaluate(() => fetch('/api/orgs').then(r => r.json())))[0].id
  await page.getByLabel('New workspace').fill('Evidence audit')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('link', { name: 'Evidence audit' }).click()
  const workspaceId = /\/workspaces\/(\d+)\//.exec(page.url())![1]
  const cap = await page.evaluate(async id => {
    const response = await fetch(`/api/workspaces/${id}/cap`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceType: 'manual', findingDescription: 'Retain policy evidence', severity: 'high', correctiveAction: 'Review policy' }),
    })
    if (!response.ok) throw new Error(`CAP creation failed: ${response.status}`)
    return response.json()
  }, workspaceId)
  await page.getByRole('main').getByRole('link', { name: 'Evidence registry' }).click()
  await page.locator('input[type=file]').setInputFiles({
    name: 'audit-policy.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% browser evidence regression\n'),
  })
  await page.getByRole('link', { name: 'audit-policy.pdf' }).click()
  const evidenceUrl = page.url()

  // Segregation of duties: the API rejects a reviewer approving their own
  // upload, so approval has to come from a second admin in a separate
  // signed-in context, matching how this is meant to be used for real.
  await page.evaluate(oid => fetch(`/api/orgs/${oid}/members`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'reviewer@acme.example', role: 'admin' }),
  }), orgId)
  const reviewerContext = await browser.newContext()
  await signInAs(reviewerContext, 'reviewer@acme.example')
  const reviewerPage = await reviewerContext.newPage()
  await reviewerPage.goto(evidenceUrl)
  await reviewerPage.getByLabel('Reviewer comments').fill('Reviewed against the adopted policy')
  await reviewerPage.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(reviewerPage.getByText('Reviewed against the adopted policy')).toBeVisible()
  await reviewerContext.close()

  await page.reload()
  await expect(page.getByText('Reviewed against the adopted policy')).toBeVisible()
  await page.getByLabel('Target ID (in this workspace)').fill(String(cap.id))
  await page.getByRole('button', { name: 'Link evidence', exact: true }).click()
  await expect(page.getByText(`cap #${cap.id} (supports)`, { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Reviewed against the adopted policy')).toBeVisible()
  await expect(page.getByText(`cap #${cap.id} (supports)`, { exact: true })).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download', exact: true }).click(),
  ])
  const chunks: Buffer[] = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer)
  expect(Buffer.concat(chunks).subarray(0, 4).toString()).toBe('%PDF')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Archive (admin)' }).click()
  await expect(page.getByRole('heading', { name: 'Evidence archived' })).toBeVisible()
  await page.getByRole('link', { name: 'Registry', exact: true }).click()
  await expect(page.getByRole('link', { name: 'audit-policy.pdf' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Evidence registry' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'audit-policy.pdf' })).toHaveCount(0)
})
