import { test, expect, fakeSession } from './fixtures'

const API = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8899}`

// The organisation's side of a validation's follow-up, in the browser: the CIP page lists the
// actions that came out of the qualifications, each needs an owner, a due date and proof, finishing
// them points the user back to the self-assessment, and a funding partner can be let in to follow
// progress (counts only), which the funder's own session then sees.
test('CIP page: owner, due date and proof; progress; funder consent', async ({ signedIn: page, request }) => {
  const seeded = await request.post(`${API}/__test/seed-validation?org=owner@acme.example&qualify=1`)
  expect(seeded.ok()).toBeTruthy()
  const { verificationId, funderEmail } = await seeded.json() as { verificationId: string; funderEmail: string }

  // A full page load of a legacy page briefly counts onboarding as incomplete until the profile arrives, so
  // load the exempt /app/ area first, wait for the profile, and then navigate inside the app to the CIP.
  const profileLoaded = page.waitForResponse((r) => r.url().includes('key=entity-profile') && r.status() === 200)
  await page.goto('/app/workspaces')
  await profileLoaded
  await page.getByRole('link', { name: 'Capacity Plan' }).first().click()
  await expect(page).toHaveURL(/\/cip$/)
  await expect(page.getByText('Validation follow-up').first()).toBeVisible()
  await expect(page.getByRole('link', { name: verificationId })).toBeVisible()
  await expect(page.getByText('0 of 1 action done, no follow-up scheduled')).toBeVisible()
  await expect(page.getByText('Board minutes are incomplete')).toBeVisible()

  // Proof alone is not enough: the action needs an owner and a due date first.
  await page.getByLabel('Proof it was done (document reference or link)').fill('Board minutes 12 August')
  await page.getByRole('button', { name: 'Mark done' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Name the owner' })).toBeVisible()

  await page.getByLabel('Owner', { exact: true }).first().fill('Board chair')
  await page.getByLabel('Due date', { exact: true }).first().fill('2030-03-15')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Action saved' })).toBeVisible()
  // The action is due in 2030, but the follow-up is capped at the end of the validity: the CIP never extends it.
  await expect(page.getByText(/Valid until .* next follow-up/)).toBeVisible()

  await page.getByLabel('Proof it was done (document reference or link)').fill('Board minutes 12 August')
  await page.getByRole('button', { name: 'Mark done' }).click()
  await expect(page.getByText('1 of 1 action done')).toBeVisible()
  await expect(page.getByText('proof: Board minutes 12 August')).toBeVisible()
  await expect(page.getByRole('link', { name: 'open the Capital Readiness Ladder' })).toBeVisible()

  // Let the funding partner follow progress.
  await page.getByLabel('Find a funding partner').fill('Savannah')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: 'Allow' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Savannah Capital can now follow this' })).toBeVisible()
  await expect(page.getByText('Savannah Capital').first()).toBeVisible()

  // The funder, with its own session, sees counts and dates, never the action, owner or proof.
  const { token } = fakeSession(funderEmail)
  const funder = await request.get(`${API}/api/validations/funder`, { headers: { cookie: `nf_jwt=${token}` } })
  expect(funder.ok()).toBeTruthy()
  const list = await funder.json() as Array<{ progressLine: string }>
  expect(list).toHaveLength(1)
  expect(list[0].progressLine).toMatch(/^1 of 1 action done/)
  const raw = JSON.stringify(list)
  for (const secret of ['Board minutes', 'Board chair', 'Gap in', 'proof']) expect(raw).not.toContain(secret)

  // Withdrawing consent ends it at once.
  await page.getByRole('button', { name: 'Withdraw' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'can no longer follow this' })).toBeVisible()
  const after = await request.get(`${API}/api/validations/funder`, { headers: { cookie: `nf_jwt=${token}` } })
  expect(await after.json()).toEqual([])
})
