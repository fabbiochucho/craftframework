import { test, expect, signInAs } from './fixtures'
import { totp } from '../../netlify/lib/mfa.ts'

const code = (secret: string, offset = 0) => totp(secret, Math.floor(Date.now() / 30_000) + offset)

// Turn on multi-factor sign-in, then a new browser session must enter a code before seeing data.
test('multi-factor sign-in: enrol with an authenticator, then verify in a new session', async ({ browser }) => {
  const email = 'mfa.user@acme.example'
  const ctx = await browser.newContext()
  await signInAs(ctx, email)
  const page = await ctx.newPage()
  await page.goto('/app/security')
  await page.getByRole('button', { name: 'Turn on multi-factor sign-in' }).click()
  await expect(page.getByRole('img', { name: 'QR code for your authenticator app' })).toBeVisible()
  const secret = (await page.locator('code').innerText()).replace(/\s/g, '')
  await page.getByLabel('Authentication code').fill(code(secret))
  await page.getByRole('button', { name: 'Confirm and turn on' }).click()
  await expect(page.getByRole('list', { name: 'Recovery codes' }).getByRole('listitem')).toHaveCount(10)
  await expect(page.getByText(/Multi-factor sign-in is on/)).toBeVisible()
  await ctx.close()

  // A fresh session (password only) is stopped at the code prompt.
  const ctx2 = await browser.newContext()
  await signInAs(ctx2, email)
  const p2 = await ctx2.newPage()
  await p2.goto('/app/workspaces')
  await expect(p2.getByText('Enter your authentication code')).toBeVisible()
  await p2.getByLabel('Authentication code').fill(code(secret, 1))
  await p2.getByRole('button', { name: 'Verify' }).click()
  await expect(p2.getByText('Enter your authentication code')).toHaveCount(0)
  await expect(p2.getByLabel('Organization name')).toBeVisible()
  await ctx2.close()
})
