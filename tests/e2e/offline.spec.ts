import { test, expect } from './fixtures'

test('offline status is accessible and the service worker does not cache private API responses', async ({ signedIn: page, context }) => {
  await page.goto('/app/workspaces')
  await expect(page.getByLabel('Organization name')).toBeVisible()
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return registration?.active?.state
  })).toBe('activated')
  await context.setOffline(true)
  await expect(page.getByRole('status').filter({ hasText: 'Offline Mode. Changes saved locally.' })).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText('Offline Mode. Changes saved locally.', { exact: true })).toHaveCount(0)
  const privateCached = await page.evaluate(async () => {
    const requests = await Promise.all((await caches.keys()).map(async name => (await caches.open(name)).keys()))
    return requests.flat().map(request => new URL(request.url).pathname)
      .filter(path => path === '/api' || path.startsWith('/api/'))
  })
  expect(privateCached).toEqual([])
})

test('custom framework edits persist through an interrupted upload and reload, then sync to Postgres', async ({ signedIn: page, context }) => {
    await page.goto('/app/workspaces')
    await page.getByLabel('Organization name').fill('Offline E2E Org')
    await page.getByLabel('Country').fill('Kenya')
    await page.getByRole('button', { name: 'Create organization' }).click()
    await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible()
    await page.getByLabel('New workspace').fill('Offline workspace')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await page.getByRole('link', { name: 'Offline workspace' }).click()
    await page.getByRole('main').getByRole('link', { name: 'ESG frameworks', exact: true }).click()
    const editor = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Custom framework editor' }) })
    await expect(editor.getByLabel('Framework name')).toBeVisible()
    await page.route('**/offline-frameworks/mutations', route => route.abort('internetdisconnected'))
    await context.setOffline(true)
    await editor.getByLabel('Framework name').fill('Field governance')
    await editor.getByLabel('Description', { exact: true }).fill('Collected without connectivity')
    await editor.getByLabel('Questions (one per line: ID | domain | question)').fill('FIELD-1 | Governance | Are board minutes retained?')
    await editor.getByRole('button', { name: 'Create framework', exact: true }).click()
    await expect(editor.getByRole('status')).toContainText('1 saved change(s) pending')
    await expect(editor.getByText('Field governance · version 1 · 1 questions')).toBeVisible()
    // Restore document transport but keep mutation uploads unavailable through reload.
    await context.setOffline(false)
    await page.reload()
    await expect(editor.getByRole('status')).toContainText('1 saved change(s) pending')
    await expect(editor.getByText('Field governance · version 1 · 1 questions')).toBeVisible()
    await page.unroute('**/offline-frameworks/mutations')
    await editor.getByRole('button', { name: 'Sync saved changes' }).click()
    await expect(editor.getByRole('status')).toContainText('0 saved change(s) pending')
    const records = await page.evaluate(async () => {
      const workspaceId = /\/workspaces\/(\d+)\//.exec(location.pathname)![1]
      const response = await fetch(`/api/workspaces/${workspaceId}/offline-frameworks`)
      if (!response.ok) throw new Error(`Framework read failed: ${response.status}`)
      return response.json()
    })
    expect(JSON.stringify(records)).toContain('Field governance')
    expect(JSON.stringify(records)).toContain('Are board minutes retained?')
})
