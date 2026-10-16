import { test, expect, fakeSession } from './fixtures'

const API = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8899}`
const ADMIN = 'fabbiochucho@gmail.com'
const CONVENOR = 'e2e-convenor@craft.example'
const REVIEWERS = ['e2e-reviewer1@panel.example', 'e2e-reviewer2@panel.example']
const DECLARATION = 'I confirm I have no conflict of interest in this case: I am not a party to it, I am not in the same firm as the validator concerned, and I have not worked for or with any party within the last three years.'

// The Independent Review Panel in the browser: the organisation raises a dispute, the programme team seats a
// panel (convenor + two reviewers who each sign a no-conflict declaration), the organisation writes its response,
// the panel decides by majority with reasons, and the organisation sees the decision and may appeal.
test('an organisation raises a dispute; a seated panel decides; the organisation sees the decision and can appeal', async ({ signedIn: page, request }) => {
  const seeded = await request.post(`${API}/__test/seed-validation?org=owner@acme.example`)
  expect(seeded.ok()).toBeTruthy()
  expect((await request.post(`${API}/__test/seed-panel`)).status()).toBe(204)
  const as = (email: string) => ({ headers: { cookie: `nf_jwt=${fakeSession(email).token}` } })

  // A full load of a legacy page briefly counts onboarding as incomplete, so enter via the exempt /app/ area and navigate in-app.
  const openPanel = async () => {
    const profileLoaded = page.waitForResponse((r) => r.url().includes('key=entity-profile') && r.status() === 200)
    await page.goto('/app/workspaces')
    await profileLoaded
    await page.getByRole('link', { name: 'Review Panel', exact: true }).first().click()
    await expect(page).toHaveURL(/\/panel$/)
  }
  await openPanel()
  await expect(page.getByRole('heading', { name: 'Independent Review Panel' })).toBeVisible()

  // Raise a dispute about the validation.
  await page.getByRole('button', { name: 'Raise a case…' }).click()
  await page.getByLabel('The validation').selectOption({ index: 1 })
  await page.getByLabel(/What happened, and what outcome/).fill('The rung does not reflect the board evidence we supplied.')
  await page.getByRole('button', { name: 'Raise case' }).click()
  await expect(page.getByText('Case raised.')).toBeVisible()
  await page.getByRole('link', { name: /Dispute about a validation’s result/ }).click()
  await expect(page.getByText('Waiting for a panel').first()).toBeVisible()
  const caseId = page.url().split('/').pop()!

  // The programme team seats the panel; the organisation cannot.
  const forbidden = await request.post(`${API}/api/review-panel/cases/${caseId}/members`, { ...as('owner@acme.example'), data: { email: REVIEWERS[0], role: 'reviewer' } })
  expect(forbidden.status()).toBe(403)
  for (const [email, role] of [[CONVENOR, 'convenor'], [REVIEWERS[0], 'reviewer'], [REVIEWERS[1], 'reviewer']]) {
    const r = await request.post(`${API}/api/review-panel/cases/${caseId}/members`, { ...as(ADMIN), data: { email, role } })
    expect(r.status(), await r.text()).toBe(201)
  }
  // No one can accept without the exact declaration.
  const noDecl = await request.post(`${API}/api/review-panel/cases/${caseId}/respond`, { ...as(CONVENOR), data: { accept: true } })
  expect(noDecl.status()).toBe(400)
  for (const email of [CONVENOR, ...REVIEWERS]) {
    const r = await request.post(`${API}/api/review-panel/cases/${caseId}/respond`, { ...as(email), data: { accept: true, declaration: DECLARATION } })
    expect(r.status(), await r.text()).toBe(200)
  }

  // The organisation now writes its response with an evidence reference.
  await openPanel()
  await page.getByRole('link', { name: /Dispute about a validation’s result/ }).click()
  await expect(page.getByText('Written responses').first()).toBeVisible()
  await page.getByLabel('Your written response').fill('We supplied the signed board pack for Q3.')
  await page.getByLabel(/Evidence reference/).fill('Board pack Q3')
  await page.getByRole('button', { name: 'Add response' }).click()
  await expect(page.getByText('We supplied the signed board pack for Q3.')).toBeVisible()
  await expect(page.getByText('Evidence: Board pack Q3')).toBeVisible()
  // The organisation sees the panel's names but no frozen review and no votes.
  await expect(page.getByText('The frozen review')).toHaveCount(0)

  // The validator answers, the convenor opens voting, two members vote, the convenor decides.
  const validator = 'e2e-validator@validators.example'
  expect((await request.post(`${API}/api/review-panel/cases/${caseId}/submissions`, { ...as(validator), data: { text: 'The method was followed.' } })).status()).toBe(201)
  expect((await request.post(`${API}/api/review-panel/cases/${caseId}/deliberate`, { ...as(CONVENOR), data: {} })).status()).toBe(200)
  const read = await request.get(`${API}/api/review-panel/cases/${caseId}`, as(REVIEWERS[0]))
  expect(((await read.json()) as { evidence: { indicators: unknown[] } }).evidence.indicators.length).toBeGreaterThan(0)
  for (const email of REVIEWERS) {
    const r = await request.put(`${API}/api/review-panel/cases/${caseId}/vote`, { ...as(email), data: { validation: 'stands', reasons: 'The evidence supports the validator.' } })
    expect(r.status(), await r.text()).toBe(200)
  }
  const decided = await request.post(`${API}/api/review-panel/cases/${caseId}/decide`, { ...as(CONVENOR), data: { reasons: 'The board pack was reviewed and supports the validated rung.' } })
  expect(decided.status(), await decided.text()).toBe(200)

  // The organisation reads the decision and the reasons, and may appeal once.
  await openPanel()
  await page.getByRole('link', { name: /Dispute about a validation’s result/ }).click()
  await expect(page.getByRole('heading', { name: 'Decision' })).toBeVisible()
  await expect(page.getByText('Dismissed — the validation stands')).toBeVisible()
  await expect(page.getByText('The board pack was reviewed and supports the validated rung.')).toBeVisible()
  await page.getByRole('button', { name: /Appeal to a fresh panel/ }).click()
  await page.getByLabel(/Why are you appealing/).fill('The panel overlooked the Q3 board minutes we supplied.')
  await page.getByRole('button', { name: 'Appeal', exact: true }).click()
  await expect(page.getByText('Appeal raised')).toBeVisible()
  await expect(page.getByText('This decision was appealed')).toBeVisible()
})
