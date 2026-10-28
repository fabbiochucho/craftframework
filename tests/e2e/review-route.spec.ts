import { test, expect, fakeSession, signInAs } from './fixtures'

const API = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8899}`

// The validator review workspace (scoring, Trust Delta, debrief, outcome) opens from its engagement.
test('validator opens the review workspace from the engagement page', async ({ page, context, request }) => {
  expect((await request.post(`${API}/__test/reset`)).status()).toBe(204)
  const seeded = await request.post(`${API}/__test/seed-validation`)
  expect(seeded.ok()).toBeTruthy()
  const { validatorEmail } = await seeded.json() as { validatorEmail: string }
  const list = await request.get(`${API}/api/engagements`, { headers: { cookie: `nf_jwt=${fakeSession(validatorEmail).token}` } })
  const body = await list.json() as { id: string }[] | { engagements: { id: string }[] }
  const id = (Array.isArray(body) ? body : body.engagements)[0].id

  await signInAs(context, validatorEmail)
  await page.goto(`/engagements/${id}`)
  await page.getByRole('link', { name: 'View the frozen review' }).click()
  await expect(page).toHaveURL(new RegExp(`/engagements/${id}/review$`))
  await expect(page.getByRole('heading', { level: 1, name: 'Review' })).toBeVisible()
})
