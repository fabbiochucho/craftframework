import { test, expect, fakeSession } from './fixtures'

const API = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8899}`

// Feedback on a validator, in the browser: the organisation of a finished validation rates its
// validator once, the rating appears on the validator's directory profile with party and country
// (never names), and the validator's public reply shows next to it.
test('the organisation rates its validator; the rating and the validator’s reply show on the profile', async ({ signedIn: page, request }) => {
  const seeded = await request.post(`${API}/__test/seed-validation?org=owner@acme.example`)
  expect(seeded.ok()).toBeTruthy()
  const { validatorEmail } = await seeded.json() as { validatorEmail: string }

  // Load an exempt /app/ page first (a full legacy page load counts onboarding as incomplete until the profile arrives).
  const profileLoaded = page.waitForResponse((r) => r.url().includes('key=entity-profile') && r.status() === 200)
  await page.goto('/app/workspaces')
  await profileLoaded
  await page.getByRole('link', { name: 'Validations', exact: true }).first().click()
  await expect(page).toHaveURL(/\/validations$/)

  await expect(page.getByRole('heading', { name: 'Rate your validator' })).toBeVisible()
  const submit = page.getByRole('button', { name: 'Submit rating' })
  await expect(submit).toBeDisabled()
  await page.getByRole('radio', { name: '4', exact: true }).check()
  await page.getByLabel(/^Comment \(optional/).fill('Clear and well explained.')
  await submit.click()
  await expect(page.getByText('Thank you — your rating is published')).toBeVisible()
  // Once only: the form is replaced by the published rating.
  await expect(page.getByRole('button', { name: 'Submit rating' })).toHaveCount(0)

  // The validator replies publicly (its own session).
  const { token } = fakeSession(validatorEmail)
  const mine = await request.get(`${API}/api/validator-quality/me`, { headers: { cookie: `nf_jwt=${token}` } })
  const ratings = (await mine.json() as { ratings: Array<{ id: string }> }).ratings
  expect(ratings).toHaveLength(1)
  const reply = await request.put(`${API}/api/validator-quality/ratings/${ratings[0].id}/reply`, { headers: { cookie: `nf_jwt=${token}` }, data: { reply: 'Thank you, glad it helped.' } })
  expect(reply.ok()).toBeTruthy()

  // The profile shows the count, the stars, the comment, the reply, the party and country — not who.
  await page.getByRole('link', { name: 'Validator Directory' }).first().click()
  await page.getByRole('link', { name: /Valerie Okafor/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible()
  await expect(page.getByText('1 finished validation')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Average 4 out of 5' })).toBeVisible()
  await expect(page.getByText('Clear and well explained.')).toBeVisible()
  await expect(page.getByText('Thank you, glad it helped.')).toBeVisible()
  await expect(page.getByText('The organisation, Kenya')).toBeVisible()
  const text = await page.locator('main').innerText()
  for (const secret of ['owner@acme.example', 'Riverbend', 'E2E Institution']) expect(text).not.toContain(secret)
})
