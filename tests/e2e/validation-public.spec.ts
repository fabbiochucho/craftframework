import { createHash } from 'node:crypto'
import { test, expect, forwardApi } from './fixtures'

const API = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8899}`

// engagement -> review -> finalise (through the real handlers, seeded server-side) -> the public verification page,
// with no sign-in: what it shows, what it never shows, the PDF hash, and "report a concern".
test('anyone with the ID can verify a validation; nothing private is shown; a concern can be reported', async ({ page, request }) => {
  await forwardApi(page.context())
  expect((await request.post(`${API}/__test/reset`)).status()).toBe(204)
  const seeded = await request.post(`${API}/__test/seed-validation`)
  expect(seeded.ok()).toBeTruthy()
  const { verificationId } = await seeded.json() as { verificationId: string }
  expect(verificationId).toMatch(/^CRAFT-V-[0-9A-Z]{8}$/)

  // Lookup by ID (no list of validations exists).
  await page.goto('/validation')
  await expect(page.getByRole('heading', { name: 'Verify a CRAFT validation' })).toBeVisible()
  await page.getByLabel('Verification ID').fill(verificationId.toLowerCase())
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page).toHaveURL(new RegExp(`/validation/${verificationId}`, 'i'))

  // The page: ID, status badge, organisation, label and rung, who did it, the standard wording.
  await expect(page.getByRole('heading', { name: verificationId })).toBeVisible()
  await expect(page.getByText('Current', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Riverbend Cooperative, Kenya')).toBeVisible()
  await expect(page.getByText('Validated by Valerie Okafor, engaged by Riverbend Cooperative')).toBeVisible()
  await expect(page.getByText('ICAN ICAN-4411 (self-declared)')).toBeVisible()
  await expect(page.getByText('Site visit')).toBeVisible()
  await expect(page.getByText('It is not an audit or review of financial statements', { exact: false })).toBeVisible()
  await expect(page.getByText('Always check the verification page before relying on a copy.')).toBeVisible()
  const body = await page.locator('body').innerText()
  for (const secret of ['PRIVATE-COMMENT', 'CRL-', 'e2e@acme.example', 'org_e2e', 'e2e-validator']) expect(body).not.toContain(secret)

  // The PDF is the one whose SHA-256 the page shows.
  const shown = (await page.getByText(/SHA-256: [0-9a-f]{64}/).innerText()).replace('SHA-256: ', '').trim()
  const pdf = await request.get(`${API}/api/public/validation/${verificationId}/statement.pdf`)
  expect(pdf.headers()['content-type']).toBe('application/pdf')
  expect(createHash('sha256').update(await pdf.body()).digest('hex')).toBe(shown)

  // Report a concern.
  await page.getByRole('button', { name: 'Report a concern' }).click()
  await page.getByLabel('Describe your concern').fill('The fieldwork dates do not match what I saw on site.')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Your concern has been sent to the CRAFT programme team.')).toBeVisible()

  // An unknown ID says so plainly.
  await page.goto('/validation/CRAFT-V-ZZZZZZZZ')
  await expect(page.getByRole('alert')).toContainText('No validation was found with that ID')
})
