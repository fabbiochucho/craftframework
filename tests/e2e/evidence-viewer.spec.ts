import { test, expect, fakeSession, signInAs } from './fixtures'

const API = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8899}`
const ASSESSOR = 'e2e-assessor@craft.example'

// An independent assessor opens evidence the organisation submitted: it is shown inside CRAFT (never downloaded),
// and can be zoomed (buttons, slider, keys) and panned (drag, scrollbars) for close reading of wide pages.
test('an independent assessor views submitted evidence in the zoomable, pannable viewer', async ({ signedIn: page, context, request }) => {
  const seeded = await request.post(`${API}/__test/seed-assessor-evidence?assessor=${ASSESSOR}`)
  expect(seeded.ok(), await seeded.text()).toBeTruthy()
  const { requestId, evidenceId } = await seeded.json()
  const as = { headers: { cookie: `nf_jwt=${fakeSession(ASSESSOR).token}` } }

  // The original can never be downloaded by the assessor.
  expect((await request.get(`${API}/api/evidence-requests/${requestId}/items/${evidenceId}/download`, as)).status()).toBe(403)

  // Sign in as the assessor (onboarded), and open the Engagements page from inside the app.
  await context.clearCookies()
  await signInAs(context, ASSESSOR)
  const profile = await request.put(`${API}/api/legacy-state`, {
    ...as, data: { orgId: 'self_e2e_assessor_craft_example', key: 'entity-profile', value: { orgName: 'Assessor Practice', archetype: 'private', country: 'Nigeria', sector: 'consulting', onboardingComplete: true } },
  })
  expect(profile.status()).toBe(200)
  await page.goto('/app/workspaces')
  await page.getByRole('link', { name: 'Validation Engagements' }).first().click()
  await expect(page).toHaveURL(/\/engagements/)
  await expect(page.getByText('Evidence for your independent assessment')).toBeVisible()
  await expect(page.getByText('Budget and board minutes', { exact: true })).toBeVisible()

  // View opens the in-page viewer: both pages drawn, no browser PDF toolbar.
  await page.getByRole('button', { name: 'View', exact: true }).click()
  const viewer = page.getByRole('dialog', { name: /View Budget and minutes\.pdf/ })
  await expect(viewer).toBeVisible()
  await expect(viewer.getByText('2 pages · view only')).toBeVisible()
  const page1 = viewer.getByLabel('Page 1')
  await expect(page1).toBeVisible()
  await expect(viewer.getByLabel('Page 2')).toBeAttached()

  // Zoom in: the page grows, the percentage follows, and the wide page can be scrolled sideways.
  const scroller = viewer.getByLabel(/Document pages/)
  const widthAt = async () => (await page1.boundingBox())!.width
  const before = await widthAt()
  const pct = async () => Number((await viewer.getByText(/^\d+%$/).textContent())!.replace('%', ''))
  const pctBefore = await pct()
  await viewer.getByRole('button', { name: 'Zoom in' }).click()
  await viewer.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(widthAt).toBeGreaterThan(before * 1.3)
  expect(await pct()).toBeGreaterThan(pctBefore)
  expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth && el.scrollHeight > el.clientHeight)).toBe(true)

  // Drag to pan sideways and down.
  const box = (await scroller.boundingBox())!
  await scroller.evaluate((el) => { el.scrollLeft = 0; el.scrollTop = 0 })
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2 - 120, { steps: 5 })
  await page.mouse.up()
  const scrolled = await scroller.evaluate((el) => ({ l: el.scrollLeft, t: el.scrollTop }))
  expect(scrolled.l).toBeGreaterThan(100)
  expect(scrolled.t).toBeGreaterThan(50)

  // The slider sets the zoom; Fit width brings the widest page back into view; the "-" key zooms out.
  await viewer.getByLabel('Zoom', { exact: true }).fill('300')
  await expect.poll(pct).toBe(300)
  await viewer.getByRole('button', { name: 'Fit width' }).click()
  await expect.poll(async () => scroller.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(4)
  const fitted = await pct()
  await page.keyboard.press('-')
  await expect.poll(pct).toBeLessThan(fitted)

  // Escape closes it.
  await page.keyboard.press('Escape')
  await expect(viewer).toBeHidden()
})
